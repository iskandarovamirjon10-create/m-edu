import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  AiActionStatus,
  AiToolRiskLevel,
  type AiContext,
  type AiToolDefinition,
} from '@medu/contracts';
import { AiActionService } from '../action.service';
import { AiException } from '../../domain/ai.errors';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { AuditService } from '../../../audit/audit.service';
import type { ToolRegistryService } from '../../tools/registry/tool-registry.service';
import type { AiPolicyService } from '../ai-policy.service';

const context: AiContext = {
  userId: 'user-1',
  organizationId: 'org-1',
  role: 'MANAGER',
  permissions: ['schedule:write'],
  locale: 'uz',
};

function actionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    organizationId: 'org-1',
    conversationId: 'conv-1',
    messageId: null,
    createdBy: 'user-1',
    toolName: 'schedule.create',
    riskLevel: AiToolRiskLevel.MEDIUM,
    status: AiActionStatus.PENDING_CONFIRMATION,
    summary: 'schedule.create',
    parameters: { groupId: 'g-1' },
    result: null,
    error: null,
    expiresAt: new Date(Date.now() + 60_000),
    confirmedAt: null,
    executedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AiActionService', () => {
  let service: AiActionService;
  let prisma: {
    aiAction: {
      findFirst: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
  };
  let registry: { require: ReturnType<typeof vi.fn> };
  let policy: { assertCanExecuteTool: ReturnType<typeof vi.fn> };
  let audit: { record: ReturnType<typeof vi.fn> };
  let tool: AiToolDefinition;

  beforeEach(() => {
    const execute = vi.fn().mockResolvedValue({ id: 'lesson-1' });
    tool = {
      name: 'schedule.create',
      description: 'create a lesson',
      inputSchema: z.object({ groupId: z.string() }),
      riskLevel: AiToolRiskLevel.MEDIUM,
      requiresConfirmation: true,
      permission: 'schedule:write',
      execute,
    };

    prisma = {
      aiAction: {
        findFirst: vi.fn().mockResolvedValue(actionRow()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve(actionRow(data)),
        ),
        findUniqueOrThrow: vi.fn().mockResolvedValue(actionRow()),
      },
    };
    registry = { require: vi.fn().mockReturnValue(tool) };
    policy = { assertCanExecuteTool: vi.fn() };
    audit = { record: vi.fn().mockResolvedValue(undefined) };

    service = new AiActionService(
      prisma as unknown as PrismaService,
      registry as unknown as ToolRegistryService,
      policy as unknown as AiPolicyService,
      audit as unknown as AuditService,
    );
  });

  it('executes a pending action and marks it COMPLETED', async () => {
    const result = await service.confirm(context, 'action-1');

    expect(tool.execute).toHaveBeenCalledWith({ groupId: 'g-1' }, context);
    expect(result.status).toBe(AiActionStatus.COMPLETED);
    expect(audit.record).toHaveBeenCalled();
  });

  it('refuses to execute an already-resolved action', async () => {
    prisma.aiAction.findFirst.mockResolvedValue(actionRow({ status: AiActionStatus.COMPLETED }));

    await expect(service.confirm(context, 'action-1')).rejects.toBeInstanceOf(AiException);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('marks an expired action EXPIRED and refuses execution', async () => {
    prisma.aiAction.findFirst.mockResolvedValue(
      actionRow({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(service.confirm(context, 'action-1')).rejects.toBeInstanceOf(AiException);
    expect(prisma.aiAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: AiActionStatus.EXPIRED } }),
    );
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('prevents replay when the atomic claim fails (double confirmation)', async () => {
    prisma.aiAction.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.confirm(context, 'action-1')).rejects.toBeInstanceOf(AiException);
    expect(tool.execute).not.toHaveBeenCalled();
  });

  it('records a FAILED action when the tool throws', async () => {
    (tool.execute as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const result = await service.confirm(context, 'action-1');
    expect(result.status).toBe(AiActionStatus.FAILED);
  });

  it('rejects an action and marks it REJECTED', async () => {
    prisma.aiAction.findUniqueOrThrow.mockResolvedValue(
      actionRow({ status: AiActionStatus.REJECTED }),
    );
    const result = await service.reject(context, 'action-1', 'not now');
    expect(prisma.aiAction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: AiActionStatus.REJECTED } }),
    );
    expect(result.status).toBe(AiActionStatus.REJECTED);
  });

  it('does not find an action owned by another user/tenant', async () => {
    prisma.aiAction.findFirst.mockResolvedValue(null);
    await expect(service.confirm(context, 'action-1')).rejects.toBeInstanceOf(AiException);
  });

  it('lists paginated actions filtered by organization and status', async () => {
    prisma.aiAction.count = vi.fn().mockResolvedValue(1);
    prisma.aiAction.findMany = vi.fn().mockResolvedValue([actionRow()]);

    const result = await service.list(context, { status: AiActionStatus.PENDING_CONFIRMATION });
    expect(prisma.aiAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          status: AiActionStatus.PENDING_CONFIRMATION,
        }),
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
