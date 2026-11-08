import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiActionStatus,
  AiErrorCode,
  type AiAction,
  type AiActionSummary,
  type AiContext,
  type AiErrorPayload,
} from '@medu/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AiException } from '../domain/ai.errors';
import { toAiAction, toActionSummary } from '../domain/ai.mappers';
import { ToolRegistryService } from '../tools/registry/tool-registry.service';
import { AiPolicyService } from './ai-policy.service';

const ACTION_TTL_MS = 5 * 60 * 1000;

export interface CreatePendingActionInput {
  conversationId: string;
  messageId?: string;
  toolName: string;
  summary: string;
  parameters: Record<string, unknown>;
}

/**
 * Durable, backend-authorized action lifecycle.
 *
 * `PROPOSED → PENDING_CONFIRMATION → CONFIRMED → EXECUTING → COMPLETED`, with
 * `REJECTED / EXPIRED / FAILED / CANCELLED` failure paths. Confirmation
 * re-validates identity, tenant, permission, expiry, status and parameters, and
 * uses a conditional status update as the execution gate — so a double click,
 * retry or replay can never execute a write twice.
 */
@Injectable()
export class AiActionService {
  private readonly logger = new Logger(AiActionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ToolRegistryService,
    private readonly policy: AiPolicyService,
    private readonly audit: AuditService,
  ) {}

  async createPending(
    context: AiContext,
    input: CreatePendingActionInput,
  ): Promise<AiActionSummary> {
    const tool = this.registry.require(input.toolName);
    const row = await this.prisma.aiAction.create({
      data: {
        organizationId: context.organizationId,
        conversationId: input.conversationId,
        messageId: input.messageId ?? null,
        createdBy: context.userId,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        status: AiActionStatus.PENDING_CONFIRMATION,
        summary: input.summary,
        parameters: input.parameters as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + ACTION_TTL_MS),
      },
    });

    await this.safeAudit(context, 'AI_ACTION_CREATED', row.id, {
      toolName: tool.name,
      riskLevel: tool.riskLevel,
    });

    return toActionSummary(row);
  }

  async get(context: AiContext, id: string): Promise<AiAction> {
    const row = await this.findOwned(context, id);
    return toAiAction(row);
  }

  async list(
    context: AiContext,
    query: { status?: string; toolName?: string; limit?: string; page?: string },
  ): Promise<{ items: AiAction[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(query.limit ?? '20', 10) || 20));
    const skip = (page - 1) * limit;

    const isAdmin = ['PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN'].includes(
      (context.role || '').toUpperCase(),
    );

    const where: Prisma.AiActionWhereInput = {
      organizationId: context.organizationId,
      ...(isAdmin ? {} : { createdBy: context.userId }),
      ...(query.status ? { status: query.status as AiActionStatus } : {}),
      ...(query.toolName ? { toolName: query.toolName } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.aiAction.count({ where }),
      this.prisma.aiAction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows.map(toAiAction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / (limit || 1)) || 1,
    };
  }

  async confirm(context: AiContext, id: string): Promise<AiAction> {
    const row = await this.findOwned(context, id);
    const now = new Date();

    if (row.expiresAt.getTime() <= now.getTime()) {
      await this.markStatus(context, id, AiActionStatus.EXPIRED);
      await this.safeAudit(context, 'AI_ACTION_EXPIRED', id, { toolName: row.toolName });
      throw new AiException(AiErrorCode.AI_ACTION_EXPIRED, 'This action has expired');
    }

    if (row.status !== AiActionStatus.PENDING_CONFIRMATION) {
      throw new AiException(
        AiErrorCode.AI_ACTION_ALREADY_RESOLVED,
        'This action has already been resolved',
        { details: { status: row.status } },
      );
    }

    const tool = this.registry.require(row.toolName);
    this.policy.assertCanExecuteTool(context, tool);

    const parsed = tool.inputSchema.safeParse(row.parameters);
    if (!parsed.success) {
      const error: AiErrorPayload = {
        code: AiErrorCode.AI_TOOL_INVALID_INPUT,
        message: 'Action parameters are no longer valid',
        retryable: false,
      };
      await this.prisma.aiAction.update({
        where: { id },
        data: { status: AiActionStatus.FAILED, error: error as unknown as Prisma.InputJsonValue },
      });
      await this.safeAudit(context, 'AI_ACTION_FAILED', id, { reason: 'invalid_parameters' });
      throw new AiException(AiErrorCode.AI_TOOL_INVALID_INPUT, 'Action parameters are invalid');
    }

    // Atomic execution gate: only one caller can move PENDING_CONFIRMATION →
    // EXECUTING. Losers (double-click, retry, replay) get ALREADY_RESOLVED.
    const claimed = await this.prisma.aiAction.updateMany({
      where: {
        id,
        organizationId: context.organizationId,
        status: AiActionStatus.PENDING_CONFIRMATION,
      },
      data: { status: AiActionStatus.CONFIRMED },
    });
    if (claimed.count !== 1) {
      throw new AiException(
        AiErrorCode.AI_ACTION_ALREADY_RESOLVED,
        'This action has already been resolved',
      );
    }

    await this.prisma.aiAction.update({
      where: { id },
      data: { status: AiActionStatus.EXECUTING, confirmedAt: now },
    });

    try {
      const result = await tool.execute(parsed.data, context);
      const completed = await this.prisma.aiAction.update({
        where: { id },
        data: {
          status: AiActionStatus.COMPLETED,
          result: toJson(result),
          executedAt: new Date(),
        },
      });
      await this.safeAudit(context, 'AI_ACTION_COMPLETED', id, { toolName: tool.name });
      return toAiAction(completed);
    } catch (error) {
      const failed = await this.prisma.aiAction.update({
        where: { id },
        data: {
          status: AiActionStatus.FAILED,
          error: toJson({
            code: AiErrorCode.AI_ACTION_FAILED,
            message: 'The action could not be completed',
            retryable: true,
          }),
          executedAt: new Date(),
        },
      });
      this.logger.error(
        `Action ${id} (${tool.name}) failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      await this.safeAudit(context, 'AI_ACTION_FAILED', id, { toolName: tool.name });
      // Return the failed record; the controller/frontend reads `status`.
      return toAiAction(failed);
    }
  }

  async reject(context: AiContext, id: string, reason?: string): Promise<AiAction> {
    await this.findOwned(context, id);
    const rejected = await this.prisma.aiAction.updateMany({
      where: {
        id,
        organizationId: context.organizationId,
        status: AiActionStatus.PENDING_CONFIRMATION,
      },
      data: { status: AiActionStatus.REJECTED },
    });
    if (rejected.count !== 1) {
      throw new AiException(
        AiErrorCode.AI_ACTION_ALREADY_RESOLVED,
        'This action has already been resolved',
      );
    }
    const row = await this.prisma.aiAction.findUniqueOrThrow({ where: { id } });
    await this.safeAudit(context, 'AI_ACTION_REJECTED', id, { ...(reason ? { reason } : {}) });
    return toAiAction(row);
  }

  private async findOwned(context: AiContext, id: string) {
    const isAdmin = ['PLATFORM_OWNER', 'SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN'].includes(
      (context.role || '').toUpperCase(),
    );
    const row = await this.prisma.aiAction.findFirst({
      where: {
        id,
        organizationId: context.organizationId,
        ...(isAdmin ? {} : { createdBy: context.userId }),
      },
    });
    if (!row) {
      throw new AiException(AiErrorCode.AI_ACTION_NOT_FOUND, 'Action not found');
    }
    return row;
  }

  private async markStatus(context: AiContext, id: string, status: AiActionStatus): Promise<void> {
    await this.prisma.aiAction.updateMany({
      where: { id, organizationId: context.organizationId },
      data: { status },
    });
  }

  private async safeAudit(
    context: AiContext,
    action: string,
    resourceId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.record({
        organizationId: context.organizationId,
        userId: context.userId,
        action,
        resource: 'AiAction',
        resourceId,
        changes: { [action]: { old: null, new: metadata } },
      });
    } catch (error) {
      // Audit is best-effort and must never break the action flow.
      this.logger.warn(
        `Failed to record AI audit event ${action}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}
