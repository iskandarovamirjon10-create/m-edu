/**
 * Canonical M-EDU AI protocol — enums.
 *
 * Mirrors the `const … as const` + union-type convention used in
 * `packages/contracts/src/enums.ts`. Shared verbatim by `@medu/api` and
 * `@medu/web`; there is exactly one AI protocol in the platform.
 */

export const AiRole = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  TOOL: 'tool',
} as const;
export type AiRole = (typeof AiRole)[keyof typeof AiRole];

export const AiMessageStatus = {
  PENDING: 'pending',
  STREAMING: 'streaming',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;
export type AiMessageStatus = (typeof AiMessageStatus)[keyof typeof AiMessageStatus];

export const AiActionStatus = {
  PROPOSED: 'PROPOSED',
  PENDING_CONFIRMATION: 'PENDING_CONFIRMATION',
  CONFIRMED: 'CONFIRMED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type AiActionStatus = (typeof AiActionStatus)[keyof typeof AiActionStatus];

/** Terminal states — an action in one of these can never execute again. */
export const AI_ACTION_TERMINAL_STATUSES: readonly AiActionStatus[] = [
  AiActionStatus.COMPLETED,
  AiActionStatus.REJECTED,
  AiActionStatus.EXPIRED,
  AiActionStatus.FAILED,
  AiActionStatus.CANCELLED,
];

export const AiToolRiskLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type AiToolRiskLevel = (typeof AiToolRiskLevel)[keyof typeof AiToolRiskLevel];

export const AiErrorCode = {
  AI_PROVIDER_UNAVAILABLE: 'AI_PROVIDER_UNAVAILABLE',
  AI_PROVIDER_TIMEOUT: 'AI_PROVIDER_TIMEOUT',
  AI_PROVIDER_CONFIG_ERROR: 'AI_PROVIDER_CONFIG_ERROR',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',
  AI_TOOL_NOT_FOUND: 'AI_TOOL_NOT_FOUND',
  AI_TOOL_NOT_AUTHORIZED: 'AI_TOOL_NOT_AUTHORIZED',
  AI_TOOL_INVALID_INPUT: 'AI_TOOL_INVALID_INPUT',
  AI_ACTION_NOT_FOUND: 'AI_ACTION_NOT_FOUND',
  AI_ACTION_EXPIRED: 'AI_ACTION_EXPIRED',
  AI_ACTION_NOT_AUTHORIZED: 'AI_ACTION_NOT_AUTHORIZED',
  AI_ACTION_ALREADY_RESOLVED: 'AI_ACTION_ALREADY_RESOLVED',
  AI_ACTION_FAILED: 'AI_ACTION_FAILED',
  AI_INVALID_INPUT: 'AI_INVALID_INPUT',
  AI_CONVERSATION_NOT_FOUND: 'AI_CONVERSATION_NOT_FOUND',
  AI_INTERNAL: 'AI_INTERNAL',
} as const;
export type AiErrorCode = (typeof AiErrorCode)[keyof typeof AiErrorCode];

export const AiLocale = {
  UZ: 'uz',
  RU: 'ru',
  EN: 'en',
} as const;
export type AiLocale = (typeof AiLocale)[keyof typeof AiLocale];
