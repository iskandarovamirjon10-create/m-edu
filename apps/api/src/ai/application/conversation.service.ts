import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiErrorCode,
  AiMessageStatus,
  AiRole,
  type AiContext,
  type AiConversation,
  type AiConversationPage,
  type AiErrorPayload,
  type AiMessage,
  type AiMessagePage,
  type AiToolCall,
  type AiToolResult,
} from '@medu/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { parsePagination } from '../../lib/pagination';
import { AiException } from '../domain/ai.errors';
import { toAiConversation, toAiMessage } from '../domain/ai.mappers';

export interface AppendMessageInput {
  conversationId: string;
  role: AiRole;
  content: string;
  status?: AiMessageStatus;
  toolCalls?: AiToolCall[];
  toolResult?: AiToolResult;
  actionId?: string;
  error?: AiErrorPayload;
}

const DEFAULT_PAGE_LIMIT = 20;

/**
 * Durable, tenant-scoped conversation and message persistence.
 *
 * Every read/write is scoped to BOTH `organizationId` and the owning user, so a
 * user can never read or mutate another user's conversation — even inside the
 * same organization.
 */
@Injectable()
export class ConversationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(context: AiContext, title?: string): Promise<AiConversation> {
    const row = await this.prisma.aiConversation.create({
      data: {
        organizationId: context.organizationId,
        createdBy: context.userId,
        title: title ?? null,
      },
      include: { _count: { select: { messages: true } } },
    });
    return toAiConversation(row);
  }

  async list(
    context: AiContext,
    query: { page?: number; limit?: number } = {},
  ): Promise<AiConversationPage> {
    const { page, limit, skip } = parsePagination(query, {
      limit: DEFAULT_PAGE_LIMIT,
      maxLimit: 50,
    });
    const where: Prisma.AiConversationWhereInput = {
      organizationId: context.organizationId,
      createdBy: context.userId,
      archivedAt: null,
    };

    const [rows, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        include: { _count: { select: { messages: true } } },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aiConversation.count({ where }),
    ]);

    return {
      items: rows.map(toAiConversation),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    };
  }

  async get(context: AiContext, id: string): Promise<AiConversation> {
    const row = await this.prisma.aiConversation.findFirst({
      where: this.ownerWhere(context, id),
      include: { _count: { select: { messages: true } } },
    });
    if (!row) throw this.notFound();
    return toAiConversation(row);
  }

  async rename(context: AiContext, id: string, title: string): Promise<AiConversation> {
    await this.assertOwned(context, id);
    const row = await this.prisma.aiConversation.update({
      where: { id },
      data: { title },
      include: { _count: { select: { messages: true } } },
    });
    return toAiConversation(row);
  }

  async archive(context: AiContext, id: string): Promise<AiConversation> {
    await this.assertOwned(context, id);
    const row = await this.prisma.aiConversation.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { _count: { select: { messages: true } } },
    });
    return toAiConversation(row);
  }

  async listMessages(
    context: AiContext,
    id: string,
    query: { page?: number; limit?: number } = {},
  ): Promise<AiMessagePage> {
    await this.assertOwned(context, id);
    const { page, limit, skip } = parsePagination(query, {
      limit: 50,
      maxLimit: 200,
    });

    const where: Prisma.AiMessageWhereInput = {
      organizationId: context.organizationId,
      conversationId: id,
    };

    const [rows, total] = await Promise.all([
      this.prisma.aiMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.aiMessage.count({ where }),
    ]);

    return {
      items: rows.map(toAiMessage),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)),
    };
  }

  async appendMessage(context: AiContext, input: AppendMessageInput): Promise<AiMessage> {
    const row = await this.prisma.aiMessage.create({
      data: {
        organizationId: context.organizationId,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        status: input.status ?? AiMessageStatus.COMPLETED,
        toolCalls: jsonOrNull(input.toolCalls),
        toolResult: jsonOrNull(input.toolResult),
        actionId: input.actionId ?? null,
        error: jsonOrNull(input.error),
      },
    });

    await this.prisma.aiConversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    });

    return toAiMessage(row);
  }

  /** Bounded history for the model prompt (most recent `limit` turns). */
  async recentMessages(context: AiContext, id: string, limit = 20): Promise<AiMessage[]> {
    const rows = await this.prisma.aiMessage.findMany({
      where: { organizationId: context.organizationId, conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.reverse().map(toAiMessage);
  }

  private ownerWhere(context: AiContext, id: string): Prisma.AiConversationWhereInput {
    return {
      id,
      organizationId: context.organizationId,
      createdBy: context.userId,
    };
  }

  private async assertOwned(context: AiContext, id: string): Promise<void> {
    const found = await this.prisma.aiConversation.findFirst({
      where: this.ownerWhere(context, id),
      select: { id: true },
    });
    if (!found) throw this.notFound();
  }

  private notFound(): AiException {
    return new AiException(
      AiErrorCode.AI_CONVERSATION_NOT_FOUND,
      'Conversation not found',
    );
  }
}

function jsonOrNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}
