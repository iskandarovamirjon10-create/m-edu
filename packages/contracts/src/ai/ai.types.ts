/**
 * Canonical M-EDU AI protocol — entities, tool contracts, stream events.
 *
 * This is the single contract shared by the backend AI engine and the frontend
 * AI workspace. Nothing in this file imports NestJS, Prisma, React or the
 * Gemini SDK.
 */
import type { ZodType } from 'zod';
import type {
  AiActionStatus,
  AiErrorCode,
  AiLocale,
  AiMessageStatus,
  AiRole,
  AiToolRiskLevel,
} from './ai.enums';

/* ── Context ───────────────────────────────────────────────────────────── */

/**
 * Authoritative AI context. Always derived server-side from the authenticated
 * request (JWT + `RolePermissions`); the frontend may only supply `route`,
 * `entity` and `locale`.
 */
export interface AiContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  route?: string;
  entity?: { type: string; id: string };
  locale: AiLocale;
}

/* ── Errors ────────────────────────────────────────────────────────────── */

export interface AiErrorPayload {
  code: AiErrorCode;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

/* ── Tool calls & results ──────────────────────────────────────────────── */

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiToolResult {
  toolCallId: string;
  toolName: string;
  ok: boolean;
  data?: unknown;
  error?: AiErrorPayload;
  action?: AiActionSummary;
}

/* ── Actions ───────────────────────────────────────────────────────────── */

/** Lightweight action view embedded in messages / stream events. */
export interface AiActionSummary {
  id: string;
  status: AiActionStatus;
  toolName: string;
  riskLevel: AiToolRiskLevel;
  summary: string;
  parameters: Record<string, unknown>;
  expiresAt: string;
  result?: Record<string, unknown> | null;
  error?: AiErrorPayload | null;
}

/** Full durable action record. */
export interface AiAction extends AiActionSummary {
  organizationId: string;
  conversationId: string;
  createdBy: string;
  confirmedAt: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Messages & conversations ──────────────────────────────────────────── */

export interface AiMessage {
  id: string;
  conversationId: string;
  role: AiRole;
  content: string;
  status: AiMessageStatus;
  createdAt: string;
  toolCalls?: AiToolCall[];
  toolResult?: AiToolResult;
  action?: AiActionSummary;
  error?: AiErrorPayload;
}

export interface AiConversation {
  id: string;
  organizationId: string;
  title: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  archivedAt: string | null;
  messageCount: number;
}

export interface AiConversationPage {
  items: AiConversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AiMessagePage {
  items: AiMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── Tool definition (implemented server-side) ─────────────────────────── */

export interface AiToolDefinition<TInput = unknown, TResult = unknown> {
  /** Stable machine name, e.g. `students.search`. */
  name: string;
  /** Natural-language description handed to the model. */
  description: string;
  /** Runtime-validated input schema; the boundary validates before execute. */
  inputSchema: ZodType<TInput>;
  riskLevel: AiToolRiskLevel;
  requiresConfirmation: boolean;
  /** Permission required, checked against `AiContext.permissions`. */
  permission: string;
  execute(input: TInput, context: AiContext): Promise<TResult>;
}

/* ── Streaming events (discriminated union) ────────────────────────────── */

export type AiStreamEvent =
  | { type: 'message.started'; messageId: string }
  | { type: 'message.delta'; messageId: string; delta: string }
  | { type: 'tool.started'; toolCallId: string; toolName: string }
  | { type: 'tool.completed'; toolCallId: string; toolName: string; ok: boolean }
  | { type: 'action.pending'; action: AiActionSummary }
  | { type: 'message.completed'; message: AiMessage }
  | { type: 'error'; error: AiErrorPayload };

/* ── HTTP request/response shapes ──────────────────────────────────────── */

export interface AiCreateConversationRequest {
  title?: string;
}

export interface AiRenameConversationRequest {
  title: string;
}

export interface AiSendMessageRequest {
  content: string;
  route?: string;
  entity?: { type: string; id: string };
  locale?: AiLocale;
}

export interface AiSendMessageResponse {
  conversationId: string;
  messages: AiMessage[];
  pendingAction: AiActionSummary | null;
}

export interface AiConfirmActionResponse {
  action: AiAction;
}

export interface AiRejectActionResponse {
  action: AiAction;
}

/* ── Provider port (implemented in infrastructure) ─────────────────────── */

export interface AiProviderMessage {
  role: AiRole;
  content: string;
  toolCalls?: AiToolCall[];
  toolCallId?: string;
  toolResult?: unknown;
}

export interface AiProviderTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiGenerateRequest {
  messages: AiProviderMessage[];
  tools: AiProviderTool[];
  systemInstruction: string;
  temperature?: number;
}

export interface AiGenerateResponse {
  text?: string;
  toolCall?: AiToolCall;
}
