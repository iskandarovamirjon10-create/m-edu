/**
 * AI Copilot frontend view models, wire types, and canonical protocol re-exports.
 * Canonical protocol contracts are imported directly from `@medu/contracts`.
 */

// Canonical protocol contracts from @medu/contracts
export {
  AiRole,
  AiMessageStatus,
  AiActionStatus,
  AI_ACTION_TERMINAL_STATUSES,
  AiToolRiskLevel,
  AiErrorCode,
  AiLocale,
} from '@medu/contracts';

export type {
  AiContext,
  AiErrorPayload,
  AiToolCall,
  AiToolResult,
  AiActionSummary,
  AiAction,
  AiMessage,
  AiConversation,
  AiConversationPage,
  AiMessagePage,
  AiStreamEvent,
  AiCreateConversationRequest,
  AiRenameConversationRequest,
  AiSendMessageRequest,
  AiSendMessageResponse,
  AiConfirmActionResponse,
  AiRejectActionResponse,
} from '@medu/contracts';

/* ── Frontend Copilot UI & Wire Types ───────────────────────────────────── */

export interface AIChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  type: 'text' | 'report' | 'chart' | 'table' | 'action' | 'error';
  data?: any;
  component?: string;
}

export interface CopilotQuickAction {
  label: string;
  icon: string;
  intent: string;
}

/** Legacy UI response shape */
export interface AIChatResponse {
  message: string;
  type: string;
  data: any;
  component?: string;
}

export type AiToolActivityStatus =
  | 'pending_confirmation'
  | 'error'
  | 'success'
  | 'running'
  | 'cancelled'
  | string;

export interface AiToolActivity {
  id?: string;
  toolName?: string;
  status?: AiToolActivityStatus;
  [key: string]: any;
}

export interface AiParameterField {
  name?: string;
  value?: string;
  key?: string;
  label?: string;
  [key: string]: any;
}

export interface AiPendingAction {
  actionId?: string;
  toolName?: string;
  parameters?: AiParameterField[];
  rawArguments?: string;
  backendMessage?: string;
  [key: string]: any;
}

export interface AiActionResult {
  type?: string;
  title?: string;
  summary?: string;
  fields?: AiParameterField[];
  raw?: string;
  actionId?: string;
  toolName?: string;
  message?: string;
  error?: string;
  [key: string]: any;
}

export interface AiErrorInfo {
  code?: string;
  message?: string;
  details?: string;
  retryable?: boolean;
  [key: string]: any;
}

export interface AiUiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | string;
  content: string;
  timestamp?: string;
  createdAt?: number;
  kind?: string;
  activities?: AiToolActivity[];
  toolActivities?: AiToolActivity[];
  pendingAction?: AiPendingAction;
  actionError?: any;
  confirmation?: any;
  error?: AiErrorInfo;
  [key: string]: any;
}

export interface AiWireToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AiWireToolResult {
  id?: string;
  actionId?: string;
  toolName?: string;
  message?: string;
  error?: string;
  status?: string;
  [key: string]: any;
}

export interface AiWireMessage {
  role: 'user' | 'assistant' | 'tool' | string;
  content?: string;
  tool_calls?: AiWireToolCall[];
  tool_call_id?: string;
  toolCallId?: string;
  [key: string]: any;
}

export interface AiChatResponse {
  content?: string;
  tool_calls?: AiWireToolCall[];
  error?: string;
  type?: string;
  message?: any;
  toolResults?: any[];
  conversationId?: string;
  [key: string]: any;
}
