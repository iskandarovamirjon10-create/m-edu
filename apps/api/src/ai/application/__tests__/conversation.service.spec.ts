import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AiContext } from '@medu/contracts';
import { ConversationService } from '../conversation.service';
import { AiException } from '../../domain/ai.errors';
import type { PrismaService } from '../../../prisma/prisma.service';

const context: AiContext = {
  userId: 'user-A',
  organizationId: 'org-A',
  role: 'MANAGER',
  permissions: ['students:read'],
  locale: 'uz',
};

function conversationRow(overrides: Record<string, unknown> = {}) {
  const now = new Date();
  return {
    id: 'conv-1',
    organizationId: 'org-A',
    createdBy: 'user-A',
    title: null,
    archivedAt: null,
    lastMessageAt: null,
    createdAt: now,
    updatedAt: now,
    _count: { messages: 0 },
    ...overrides,
  };
}

describe('ConversationService tenant/owner isolation', () => {
  let service: ConversationService;
  let prisma: {
    aiConversation: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    aiMessage: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    prisma = {
      aiConversation: {
        create: vi.fn().mockResolvedValue(conversationRow()),
        findMany: vi.fn().mockResolvedValue([conversationRow()]),
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn().mockResolvedValue(conversationRow()),
        update: vi.fn().mockResolvedValue(conversationRow()),
      },
      aiMessage: {
        create: vi.fn().mockResolvedValue({
          id: 'm1',
          organizationId: 'org-A',
          conversationId: 'conv-1',
          role: 'user',
          content: 'hi',
          status: 'completed',
          toolCalls: null,
          toolResult: null,
          actionId: null,
          error: null,
          createdAt: new Date(),
        }),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    };
    service = new ConversationService(prisma as unknown as PrismaService);
  });

  it('creates a conversation scoped to the caller tenant and user', async () => {
    await service.create(context, 'Title');
    expect(prisma.aiConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-A', createdBy: 'user-A' }),
      }),
    );
  });

  it('lists only the caller tenant + user, excluding archived conversations', async () => {
    await service.list(context, {});
    const where = prisma.aiConversation.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({
      organizationId: 'org-A',
      createdBy: 'user-A',
      archivedAt: null,
    });
  });

  it('scopes message reads to the conversation tenant', async () => {
    await service.listMessages(context, 'conv-1', {});
    expect(prisma.aiMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-A', conversationId: 'conv-1' }),
      }),
    );
  });

  it('throws not-found when the conversation belongs to another user/tenant', async () => {
    prisma.aiConversation.findFirst.mockResolvedValue(null);
    await expect(service.get(context, 'conv-other')).rejects.toBeInstanceOf(AiException);
  });

  it('stamps appended messages with the caller organization', async () => {
    await service.appendMessage(context, {
      conversationId: 'conv-1',
      role: 'user',
      content: 'hello',
    });
    expect(prisma.aiMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organizationId: 'org-A', conversationId: 'conv-1' }),
      }),
    );
  });
});
