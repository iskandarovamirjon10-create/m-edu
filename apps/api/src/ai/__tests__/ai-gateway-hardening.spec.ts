import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  AiActionStatus,
  AiErrorCode,
  AiMessageStatus,
  AiRole,
  AiRolePermissions,
  AiToolRiskLevel,
  type AiAction,
  type AiContext,
  type AiMessage,
  type AiToolCall,
  type AiToolDefinition,
} from '@medu/contracts';
import { AiGatewayService } from '../application/ai-gateway.service';
import { AiPolicyService } from '../application/ai-policy.service';
import { ToolOrchestratorService } from '../application/tool-orchestrator.service';
import { ToolRegistryService } from '../tools/registry/tool-registry.service';
import { toAiMessage } from '../domain/ai.mappers';
import type { ConversationService } from '../application/conversation.service';
import type { AiActionService } from '../application/action.service';
import type { AiProvider } from '../infrastructure/providers/ai-provider.interface';

describe('AI Gateway Production Hardening Suite (Milestone 1)', () => {
  let policy: AiPolicyService;
  let registry: ToolRegistryService;
  let orchestrator: ToolOrchestratorService;
  let gateway: AiGatewayService;

  let provider: { generate: ReturnType<typeof vi.fn> };
  let conversation: {
    get: ReturnType<typeof vi.fn>;
    appendMessage: ReturnType<typeof vi.fn>;
    recentMessages: ReturnType<typeof vi.fn>;
  };
  let actionService: { createPending: ReturnType<typeof vi.fn> };

  const studentContext: AiContext = {
    userId: 'student-user-1',
    organizationId: 'tenant-org-alpha',
    role: 'STUDENT',
    permissions: AiRolePermissions.STUDENT,
    locale: 'uz',
  };

  const accountantContext: AiContext = {
    userId: 'accountant-user-1',
    organizationId: 'tenant-org-alpha',
    role: 'ACCOUNTANT',
    permissions: AiRolePermissions.ACCOUNTANT,
    locale: 'uz',
  };

  const adminContext: AiContext = {
    userId: 'admin-user-1',
    organizationId: 'tenant-org-alpha',
    role: 'ADMIN',
    permissions: AiRolePermissions.ADMIN,
    locale: 'uz',
  };

  // Mock catalog of tools with varying risk and permissions
  const mockTools: AiToolDefinition[] = [
    {
      name: 'attendance.summary',
      description: 'Summarize attendance',
      inputSchema: z.object({ groupId: z.string().uuid().optional() }),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: 'attendance:read',
      execute: vi.fn().mockResolvedValue({ total: 100, present: 95 }),
    },
    {
      name: 'finance.overview',
      description: 'Financial revenue and expenses',
      inputSchema: z.object({}),
      riskLevel: AiToolRiskLevel.LOW,
      requiresConfirmation: false,
      permission: 'finance:read',
      execute: vi.fn().mockResolvedValue({ totalRevenueUzs: 50_000_000 }),
    },
    {
      name: 'students.create',
      description: 'Create student',
      inputSchema: z.object({ firstName: z.string(), lastName: z.string() }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: 'students:write',
      execute: vi.fn().mockResolvedValue({ success: true, studentId: 'st-new-1' }),
    },
    {
      name: 'schedule.create',
      description: 'Create lesson in schedule',
      inputSchema: z.object({ groupId: z.string().uuid(), dayOfWeek: z.string() }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: 'schedule:write',
      execute: vi.fn().mockResolvedValue({ success: true, scheduleId: 'sch-new-1' }),
    },
  ];

  beforeEach(() => {
    policy = new AiPolicyService();
    registry = new ToolRegistryService(mockTools);
    orchestrator = new ToolOrchestratorService(registry, policy);

    provider = { generate: vi.fn() };
    conversation = {
      get: vi.fn().mockResolvedValue({ id: 'conv-101' }),
      appendMessage: vi.fn().mockImplementation((_ctx: unknown, input: any) =>
        Promise.resolve({
          id: `msg-${Date.now()}`,
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          status: input.status ?? AiMessageStatus.COMPLETED,
          createdAt: new Date().toISOString(),
          ...(input.toolCalls ? { toolCalls: input.toolCalls } : {}),
          ...(input.toolResult ? { toolResult: input.toolResult } : {}),
          ...(input.actionId ? { actionId: input.actionId } : {}),
        }),
      ),
      recentMessages: vi.fn().mockResolvedValue([]),
    };
    actionService = {
      createPending: vi.fn().mockResolvedValue({
        id: 'act-uuid-1',
        status: AiActionStatus.PENDING_CONFIRMATION,
        toolName: 'students.create',
        riskLevel: AiToolRiskLevel.MEDIUM,
        summary: 'students.create (firstName: Ali, lastName: Valiyev)',
        parameters: { firstName: 'Ali', lastName: 'Valiyev' },
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      }),
    };

    gateway = new AiGatewayService(
      provider as unknown as AiProvider,
      registry,
      orchestrator,
      conversation as unknown as ConversationService,
      actionService as unknown as AiActionService,
      policy,
    );
  });

  describe('1. Permission-based Tool Filtering', () => {
    it('filters tools presented to the provider strictly by user permissions', async () => {
      provider.generate.mockResolvedValue({ text: 'Javob' });

      // Student turn
      await gateway.sendMessage(studentContext, 'conv-101', 'Test student');
      const studentToolsCalled = provider.generate.mock.calls[0][0].tools;
      const studentToolNames = studentToolsCalled.map((t: any) => t.name);

      // Student should not see finance or write tools
      expect(studentToolNames).not.toContain('finance.overview');
      expect(studentToolNames).not.toContain('students.create');
      expect(studentToolNames).not.toContain('schedule.create');

      provider.generate.mockClear();

      // Accountant turn
      await gateway.sendMessage(accountantContext, 'conv-101', 'Test accountant');
      const accountantToolsCalled = provider.generate.mock.calls[0][0].tools;
      const accountantToolNames = accountantToolsCalled.map((t: any) => t.name);

      expect(accountantToolNames).toContain('finance.overview');
      expect(accountantToolNames).not.toContain('students.create');
      expect(accountantToolNames).not.toContain('schedule.create');

      provider.generate.mockClear();

      // Admin turn
      await gateway.sendMessage(adminContext, 'conv-101', 'Test admin');
      const adminToolsCalled = provider.generate.mock.calls[0][0].tools;
      const adminToolNames = adminToolsCalled.map((t: any) => t.name);

      expect(adminToolNames).toContain('finance.overview');
      expect(adminToolNames).toContain('students.create');
      expect(adminToolNames).toContain('schedule.create');
      expect(adminToolNames).toContain('attendance.summary');
    });
  });

  describe('2. Unauthorized Tool Execution & Hallucination Defense', () => {
    it('blocks unauthorized tool execution if model attempts to call forbidden tool', async () => {
      // Model hallucinates or is prompted to call students.create for an accountant
      provider.generate
        .mockResolvedValueOnce({
          toolCall: {
            id: 'call-unauth-1',
            name: 'students.create',
            arguments: { firstName: 'Eldor', lastName: 'Karimov' },
          },
        })
        .mockResolvedValueOnce({
          text: 'Sizda yangi talaba yaratish huquqi mavjud emas.',
        });

      const response = await gateway.sendMessage(accountantContext, 'conv-101', 'Yangi talaba yarat');

      // The gateway should NOT prepare or create an action for this forbidden tool
      expect(actionService.createPending).not.toHaveBeenCalled();

      // The tool error should have been fed back into round 2 of the provider
      expect(provider.generate).toHaveBeenCalledTimes(2);
      const secondRoundMessages = provider.generate.mock.calls[1][0].messages;
      const toolResultMessage = secondRoundMessages.find((m: any) => m.role === AiRole.TOOL);
      expect(toolResultMessage).toBeDefined();
      expect(toolResultMessage.toolResult).toEqual({
        error: 'You are not allowed to run this tool.',
      });

      expect(response.pendingAction).toBeNull();
    });

    it('blocks unauthorized read tool calls at orchestrator execution time', async () => {
      const call: AiToolCall = {
        id: 'call-read-1',
        name: 'finance.overview',
        arguments: {},
      };

      // Student attempts to run finance.overview
      const result = await orchestrator.executeReadTool(studentContext, call);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe(AiErrorCode.AI_TOOL_NOT_AUTHORIZED);
    });
  });

  describe('3. Durable Conversation Reconstruction & Serialization', () => {
    it('preserves toolCalls, toolResult, actionId, status, and ISO timestamps', () => {
      const dbRow: any = {
        id: '9903b44b-4b15-46eb-8149-1be71fecf482',
        conversationId: 'c1209b0b-6ff9-497d-b6a4-44df0db41477',
        role: 'assistant',
        content: 'I can do that, but it needs your confirmation',
        status: 'completed',
        createdAt: new Date('2026-11-11T12:00:00.000Z'),
        actionId: '3f684bf4-7ee6-4e5a-a28a-79f9d6ba181c',
        toolCalls: [
          {
            id: 'call-abc',
            name: 'schedule.create',
            arguments: { groupId: 'g-1' },
          },
        ],
        toolResult: {
          toolCallId: 'call-abc',
          toolName: 'schedule.create',
          ok: true,
          data: { success: true },
        },
        error: null,
      };

      const mapped = toAiMessage(dbRow);

      expect(mapped.id).toBe(dbRow.id);
      expect(mapped.role).toBe(AiRole.ASSISTANT);
      expect(mapped.actionId).toBe(dbRow.actionId);
      expect(mapped.toolCalls).toHaveLength(1);
      expect(mapped.toolCalls?.[0].name).toBe('schedule.create');
      expect(mapped.toolResult?.ok).toBe(true);
      expect(mapped.createdAt).toBe('2026-11-11T12:00:00.000Z');
      expect(mapped.status).toBe(AiMessageStatus.COMPLETED);
    });
  });

  describe('4. Action Lifecycle & Confirmation Security', () => {
    it('proposes write action cleanly with required parameter summary', async () => {
      provider.generate.mockResolvedValueOnce({
        toolCall: {
          id: 'call-write-1',
          name: 'students.create',
          arguments: { firstName: 'Ali', lastName: 'Valiyev' },
        },
      });

      const response = await gateway.sendMessage(adminContext, 'conv-101', 'Ali Valiyevni talaba qilib qo‘sh');

      expect(actionService.createPending).toHaveBeenCalledWith(
        adminContext,
        expect.objectContaining({
          toolName: 'students.create',
          parameters: { firstName: 'Ali', lastName: 'Valiyev' },
        }),
      );

      expect(response.pendingAction).toBeDefined();
      expect(response.pendingAction?.toolName).toBe('students.create');
      expect(response.messages[1].actionId).toBe('act-uuid-1');
    });
  });

  describe('5. Ephemeral Turn Execution & Safety', () => {
    it('executes read tool and returns clean text in ephemeral mode without DB writes', async () => {
      provider.generate
        .mockResolvedValueOnce({
          toolCall: {
            id: 'call-read-ephemeral',
            name: 'finance.overview',
            arguments: {},
          },
        })
        .mockResolvedValueOnce({
          text: 'Joriy oyda sof foyda 50,000,000 so‘m.',
        });

      const reply = await gateway.executeEphemeral(accountantContext, 'Moliyaviy hisobot qanday?');

      expect(reply).toBe('Joriy oyda sof foyda 50,000,000 so‘m.');
      expect(conversation.appendMessage).not.toHaveBeenCalled();
    });

    it('safely parks write tools without execution in ephemeral mode', async () => {
      provider.generate.mockResolvedValueOnce({
        toolCall: {
          id: 'call-write-ephemeral',
          name: 'students.create',
          arguments: { firstName: 'Temur', lastName: 'Bek' },
        },
      });

      const reply = await gateway.executeEphemeral(adminContext, 'Temur Bekni qo‘sh');

      expect(reply).toContain('tasdiqlash talab qilinadi');
      expect(actionService.createPending).not.toHaveBeenCalled();
    });
  });
});
