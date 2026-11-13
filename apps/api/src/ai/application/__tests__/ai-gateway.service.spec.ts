import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  AiErrorCode,
  AiMessageStatus,
  AiRole,
  AiToolRiskLevel,
  type AiContext,
  type AiMessage,
  type AiToolDefinition,
} from '@medu/contracts';
import { AiGatewayService } from '../ai-gateway.service';
import { AiException, AiProviderError } from '../../domain/ai.errors';
import type { AiProvider } from '../../infrastructure/providers/ai-provider.interface';
import type { ToolRegistryService } from '../../tools/registry/tool-registry.service';
import type { ToolOrchestratorService } from '../tool-orchestrator.service';
import type { ConversationService } from '../conversation.service';
import type { AiActionService } from '../action.service';
import type { AiPolicyService } from '../ai-policy.service';

const context: AiContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  role: 'MANAGER',
  permissions: ['students:read', 'schedule:write'],
  locale: 'uz',
};

const message = (role: AiRole, content: string): AiMessage => ({
  id: `${role}-1`,
  conversationId: 'conv-1',
  role,
  content,
  status: AiMessageStatus.COMPLETED,
  createdAt: new Date().toISOString(),
});

describe('AiGatewayService', () => {
  let gateway: AiGatewayService;
  let provider: { generate: ReturnType<typeof vi.fn> };
  let registry: {
    toProviderTools: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    require: ReturnType<typeof vi.fn>;
  };
  let orchestrator: {
    executeReadTool: ReturnType<typeof vi.fn>;
    prepareWriteTool: ReturnType<typeof vi.fn>;
  };
  let conversation: {
    get: ReturnType<typeof vi.fn>;
    appendMessage: ReturnType<typeof vi.fn>;
    recentMessages: ReturnType<typeof vi.fn>;
  };
  let actionService: { createPending: ReturnType<typeof vi.fn> };
  let writeTool: AiToolDefinition;

  beforeEach(() => {
    writeTool = {
      name: 'schedule.create',
      description: 'create lesson',
      inputSchema: z.object({ groupId: z.string() }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: 'schedule:write',
      execute: vi.fn(),
    };

    provider = { generate: vi.fn() };
    registry = {
      toProviderTools: vi.fn().mockReturnValue([]),
      get: vi.fn(),
      require: vi.fn().mockReturnValue(writeTool),
    };
    orchestrator = {
      executeReadTool: vi.fn(),
      prepareWriteTool: vi.fn().mockReturnValue({
        toolName: 'schedule.create',
        parameters: { groupId: 'g-1' },
      }),
    };
    conversation = {
      get: vi.fn().mockResolvedValue({ id: 'conv-1' }),
      appendMessage: vi
        .fn()
        .mockImplementation((_ctx: unknown, input: { role: AiRole; content: string }) =>
          Promise.resolve(message(input.role, input.content)),
        ),
      recentMessages: vi.fn().mockResolvedValue([]),
    };
    actionService = {
      createPending: vi.fn().mockResolvedValue({
        id: 'action-1',
        status: 'PENDING_CONFIRMATION',
        toolName: 'schedule.create',
        riskLevel: 'medium',
        summary: 'schedule.create (groupId: g-1)',
        parameters: { groupId: 'g-1' },
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    };
    const policy = {
      canExecuteTool: vi.fn().mockReturnValue(true),
      assertCanExecuteTool: vi.fn(),
    };

    gateway = new AiGatewayService(
      provider as unknown as AiProvider,
      registry as unknown as ToolRegistryService,
      orchestrator as unknown as ToolOrchestratorService,
      conversation as unknown as ConversationService,
      actionService as unknown as AiActionService,
      policy as unknown as AiPolicyService,
    );
  });

  it('returns the assistant text for a plain answer', async () => {
    provider.generate.mockResolvedValue({ text: 'Salom!' });

    const result = await gateway.sendMessage(context, 'conv-1', 'Salom');

    expect(result.messages).toHaveLength(2);
    expect(result.pendingAction).toBeNull();
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it('creates a pending action instead of executing a write tool', async () => {
    registry.get.mockReturnValue(writeTool);
    provider.generate.mockResolvedValue({
      toolCall: { id: 'call-1', name: 'schedule.create', arguments: { groupId: 'g-1' } },
    });

    const result = await gateway.sendMessage(context, 'conv-1', 'Add a lesson');

    expect(orchestrator.prepareWriteTool).toHaveBeenCalled();
    expect(actionService.createPending).toHaveBeenCalled();
    expect(writeTool.execute).not.toHaveBeenCalled();
    expect(result.pendingAction?.id).toBe('action-1');
  });

  it('recovers from an unknown tool call and still answers', async () => {
    registry.get.mockReturnValue(undefined);
    provider.generate
      .mockResolvedValueOnce({
        toolCall: { id: 'call-1', name: 'does.not.exist', arguments: {} },
      })
      .mockResolvedValueOnce({ text: 'Done' });

    const result = await gateway.sendMessage(context, 'conv-1', 'do something');

    expect(provider.generate).toHaveBeenCalledTimes(2);
    expect(result.pendingAction).toBeNull();
  });

  it('maps provider failures to a typed AI exception', async () => {
    provider.generate.mockRejectedValue(
      new AiProviderError(AiErrorCode.AI_PROVIDER_UNAVAILABLE, 'down'),
    );

    await expect(gateway.sendMessage(context, 'conv-1', 'hi')).rejects.toBeInstanceOf(AiException);
  });
});
