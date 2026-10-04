import type {
  AiAction as PrismaAiAction,
  AiConversation as PrismaAiConversation,
  AiMessage as PrismaAiMessage,
} from '@prisma/client';
import {
  AiActionStatus,
  AiMessageStatus,
  AiRole,
  AiToolRiskLevel,
  type AiAction,
  type AiActionSummary,
  type AiConversation,
  type AiErrorPayload,
  type AiMessage,
  type AiToolCall,
  type AiToolResult,
} from '@medu/contracts';

const ACTION_STATUSES = new Set<string>(Object.values(AiActionStatus));
const MESSAGE_STATUSES = new Set<string>(Object.values(AiMessageStatus));
const ROLES = new Set<string>(Object.values(AiRole));
const RISK_LEVELS = new Set<string>(Object.values(AiToolRiskLevel));

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function toRole(value: string): AiRole {
  return ROLES.has(value) ? (value as AiRole) : AiRole.ASSISTANT;
}

function toMessageStatus(value: string): AiMessageStatus {
  return MESSAGE_STATUSES.has(value) ? (value as AiMessageStatus) : AiMessageStatus.COMPLETED;
}

function toActionStatus(value: string): AiActionStatus {
  return ACTION_STATUSES.has(value) ? (value as AiActionStatus) : AiActionStatus.PENDING_CONFIRMATION;
}

function toRiskLevel(value: string): AiToolRiskLevel {
  return RISK_LEVELS.has(value) ? (value as AiToolRiskLevel) : AiToolRiskLevel.LOW;
}

function toToolCalls(value: unknown): AiToolCall[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const calls = value
    .map((entry) => asRecord(entry))
    .filter((entry) => typeof entry.id === 'string' && typeof entry.name === 'string')
    .map((entry) => ({
      id: entry.id as string,
      name: entry.name as string,
      arguments: asRecord(entry.arguments),
    }));
  return calls.length > 0 ? calls : undefined;
}

function toError(value: unknown): AiErrorPayload | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = asRecord(value);
  if (typeof record.code !== 'string' || typeof record.message !== 'string') return undefined;
  return {
    code: record.code as AiErrorPayload['code'],
    message: record.message,
    retryable: record.retryable === true,
  };
}

export function toAiConversation(
  row: PrismaAiConversation & { _count?: { messages: number } },
): AiConversation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    messageCount: row._count?.messages ?? 0,
  };
}

export function toAiMessage(row: PrismaAiMessage): AiMessage {
  const toolResultRecord = row.toolResult ? asRecord(row.toolResult) : null;
  const toolResult: AiToolResult | undefined = toolResultRecord
    ? {
        toolCallId: String(toolResultRecord.toolCallId ?? ''),
        toolName: String(toolResultRecord.toolName ?? ''),
        ok: toolResultRecord.ok === true,
        ...(toolResultRecord.data !== undefined ? { data: toolResultRecord.data } : {}),
        ...(toolResultRecord.error !== undefined
          ? { error: toError(toolResultRecord.error) }
          : {}),
      }
    : undefined;

  return {
    id: row.id,
    conversationId: row.conversationId,
    role: toRole(row.role),
    content: row.content,
    status: toMessageStatus(row.status),
    createdAt: row.createdAt.toISOString(),
    ...(toToolCalls(row.toolCalls) ? { toolCalls: toToolCalls(row.toolCalls) } : {}),
    ...(toolResult ? { toolResult } : {}),
    ...(toError(row.error) ? { error: toError(row.error) } : {}),
  };
}

export function toActionSummary(row: PrismaAiAction): AiActionSummary {
  return {
    id: row.id,
    status: toActionStatus(row.status),
    toolName: row.toolName,
    riskLevel: toRiskLevel(row.riskLevel),
    summary: row.summary,
    parameters: asRecord(row.parameters),
    expiresAt: row.expiresAt.toISOString(),
    result: row.result ? asRecord(row.result) : null,
    error: toError(row.error) ?? null,
  };
}

export function toAiAction(row: PrismaAiAction): AiAction {
  return {
    ...toActionSummary(row),
    organizationId: row.organizationId,
    conversationId: row.conversationId,
    createdBy: row.createdBy,
    confirmedAt: row.confirmedAt ? row.confirmedAt.toISOString() : null,
    executedAt: row.executedAt ? row.executedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
