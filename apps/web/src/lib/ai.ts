// M-EDU AI Copilot — integration pass
/**
 * M-EDU AI Copilot — transport + presentation helpers.
 *
 * Everything that talks to the AI backend lives here (so the hooks stay
 * testable), together with the small language-mapping helpers that turn opaque
 * tool names and statuses into short Uzbek phrases. Raw tool payloads and
 * server error text are never surfaced directly.
 */
import request, { ApiError, aiApi, apiUrl, ensureCsrfCookie, readXsrfCookie } from './api';
import type {
  AiChatResponse,
  AiErrorInfo,
  AiParameterField,
  AiToolActivityStatus,
  AiWireMessage,
  AiWireToolResult,
} from '@/types/ai';

/* ── Tool vocabulary ───────────────────────────────────────────────────── */

interface ToolMeta {
  /** Human subject, e.g. "Davomat ma’lumotlari". */
  subject: string;
  /** Title of the confirmation card when this tool changes data. */
  proposal?: string;
}

const TOOL_META: Record<string, ToolMeta> = {
  'attendance.today': { subject: 'Davomat ma’lumotlari' },
  'attendance.summary': { subject: 'Davomat hisoboti' },
  'schedule.today': { subject: 'Darslar jadvali' },
  'students.search': { subject: 'O‘quvchilar ro‘yxati' },
  'groups.list': { subject: 'Guruhlar ro‘yxati' },
  'finance.debtors': { subject: 'Qarzdorlar ro‘yxati' },
  'finance.summary': { subject: 'Moliyaviy hisobot' },
  'reports.summary': { subject: 'Kunlik hisobot' },
  'telegram.prepareMessage': {
    subject: 'Telegram xabari',
    proposal: 'Telegram xabari tayyorlash',
  },
};

const TOOL_SUCCESS: Record<string, string> = {
  'attendance.today': 'Davomat ma’lumotlari olindi',
  'attendance.summary': 'Davomat hisoboti olindi',
  'schedule.today': 'Darslar jadvali olindi',
  'students.search': 'O‘quvchilar ro‘yxati olindi',
  'groups.list': 'Guruhlar ro‘yxati olindi',
  'finance.debtors': 'Qarzdorlar ro‘yxati olindi',
  'finance.summary': 'Moliyaviy hisobot olindi',
  'reports.summary': 'Hisobot tayyorlandi',
  'telegram.prepareMessage': 'Telegram xabari tayyorlandi',
};

/** Parameter labels used by both confirmation and result cards. */
const PARAMETER_LABELS: Record<string, string> = {
  message: 'Xabar',
  audience: 'Olchov',
  group: 'Guruh',
  groupId: 'Guruh',
  student: 'O‘quvchi',
  studentId: 'O‘quvchi',
  amount: 'Summa',
  date: 'Sana',
  time: 'Vaqt',
  channel: 'Kanal',
  subject: 'Mavzu',
  reason: 'Sabab',
};

const RESULT_LABELS: Record<string, string> = {
  status: 'Holat',
  message: 'Xabar',
  id: 'Identifikator',
  actionId: 'Amal identifikatori',
  recipients: 'Qabul qiluvchilar',
  sentAt: 'Yuborilgan vaqt',
};

function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_.-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function labelFor(key: string, labels: Record<string, string>): string {
  return labels[key] ?? humanizeKey(key);
}

/** Normalised, human-readable description of a tool. */
export function describeAiTool(toolName: string): { known: boolean; subject: string } {
  const meta = TOOL_META[toolName];
  if (meta) return { known: true, subject: meta.subject };
  return { known: false, subject: '' };
}

/** Title for a confirmation card (falls back to a neutral phrase). */
export function describeAiProposal(toolName: string): string {
  const meta = TOOL_META[toolName];
  if (meta?.proposal) return meta.proposal;
  if (meta) return `${meta.subject}: amalni tasdiqlash`;
  return 'Amalni tasdiqlash';
}

/** Short Uzbek status phrase for a tool activity. */
export function aiToolStatusText(toolName: string, status: AiToolActivityStatus): string {
  const subject = TOOL_META[toolName]?.subject;

  switch (status) {
    case 'success':
      return TOOL_SUCCESS[toolName] ?? (subject ? `${subject} olindi` : 'Ma’lumot olindi');
    case 'running':
      return subject ? `${subject} olinmoqda...` : 'Ma’lumot olinmoqda...';
    case 'error':
      return subject ? `${subject} olinmadi` : 'Ma’lumotni olib bo‘lmadi';
    case 'pending_confirmation':
      return subject ? `${subject} tasdiqlashni kutmoqda` : 'Tasdiqlash kutilmoqda';
    case 'cancelled':
      return subject ? `${subject} bekor qilindi` : 'Amal bekor qilindi';
    default:
      return subject ?? 'AI amali';
  }
}

/** True when the backend parked a tool call for explicit user approval. */
export function isPendingConfirmation(result: AiWireToolResult): boolean {
  return String(result.status ?? '').toUpperCase() === 'PENDING_CONFIRMATION' || Boolean(result.actionId);
}

/** Flatten relayed JSON arguments into labelled parameter fields. */
export function parseActionParameters(rawArguments: string | undefined): AiParameterField[] {
  if (!rawArguments) return [];
  try {
    const parsed = JSON.parse(rawArguments) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => ({
        key,
        label: labelFor(key, PARAMETER_LABELS),
        value: typeof value === 'string' ? value : JSON.stringify(value),
      }));
  } catch {
    return [];
  }
}

/** Pretty-print raw arguments for the technical details fold. */
export function prettifyArguments(rawArguments: string | undefined): string | undefined {
  if (!rawArguments) return undefined;
  try {
    return JSON.stringify(JSON.parse(rawArguments), null, 2);
  } catch {
    return rawArguments;
  }
}

/** Build the structured success card from the backend's raw result object. */
export function buildActionResult(result: Record<string, unknown> | null | undefined): {
  title: string;
  summary?: string;
  fields: AiParameterField[];
  raw?: string;
} {
  const payload = result ?? {};
  const summary = typeof payload.message === 'string' ? payload.message : undefined;
  const fields = Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== 'object')
    .map(([key, value]) => ({
      key,
      label: labelFor(key, RESULT_LABELS),
      value: String(value),
    }));

  return {
    title: 'Amal muvaffaqiyatli bajarildi',
    summary,
    fields,
    raw: JSON.stringify(payload, null, 2),
  };
}

/* ── Error mapping ─────────────────────────────────────────────────────── */

export type AiErrorContext = 'chat' | 'confirm';

const NETWORK_ERROR: AiErrorInfo = {
  message: 'AI bilan bog‘lanib bo‘lmadi. Internet aloqasini tekshirib, qayta urinib ko‘ring.',
  retryable: true,
  code: 'network',
};

function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  return error instanceof Error && /network|fetch|failed to fetch|load failed/i.test(error.message);
}

/**
 * Translate any thrown value into a user-safe, actionable message.
 * Retry is only advertised when re-issuing the request is actually safe.
 */
export function toAiErrorInfo(error: unknown, context: AiErrorContext = 'chat'): AiErrorInfo {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
      case 422:
        return {
          message: 'So‘rovni qabul qilib bo‘lmadi. Savolni boshqacha shaklda yozib ko‘ring.',
          retryable: false,
          code: 'validation',
        };
      case 401:
        return {
          message: 'Sessiya muddati tugagan. Qaytadan tizimga kiring.',
          retryable: false,
          code: 'unauthorized',
        };
      case 403:
        return {
          message: 'Bu amal uchun sizda ruxsat yo‘q.',
          retryable: false,
          code: 'forbidden',
        };
      case 404:
        return context === 'confirm'
          ? {
              message: 'Tasdiqlanayotgan amal topilmadi yoki muddati tugagan',
              retryable: false,
              code: 'action_expired',
            }
          : {
              message: 'So‘ralgan ma’lumot topilmadi.',
              retryable: false,
              code: 'not_found',
            };
      case 408:
        return {
          message: 'AI javob berishga ulgurmadi. Qayta urinib ko‘ring.',
          retryable: true,
          code: 'timeout',
        };
      case 429:
        return {
          message: 'So‘rovlar soni juda ko‘p. Biroz kutib, qayta urinib ko‘ring.',
          retryable: true,
          code: 'rate_limited',
        };
      case 503:
        return {
          message: 'AI xizmati hozircha sozlanmagan. Administratorga murojaat qiling.',
          retryable: false,
          code: 'unavailable',
        };
      default:
        if (error.status >= 500 || context === 'chat') {
          return {
            message: 'AI xizmatida xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.',
            retryable: true,
            code: 'server',
          };
        }
        return {
          message: 'Amalni tasdiqlashning iloji bo‘lmadi. Qayta urinib ko‘ring.',
          retryable: false,
          code: 'confirm_failed',
        };
    }
  }

  if (isNetworkFailure(error)) return NETWORK_ERROR;

  return {
    message: 'Kutilmagan xatolik yuz berdi. Qayta urinib ko‘ring.',
    retryable: true,
    code: 'unknown',
  };
}

/* ── Transport ─────────────────────────────────────────────────────────── */

/**
 * Send one turn to the AI Copilot.
 *
 * `messages` is the full wire conversation (history + the new user turn). The
 * backend contract is `{ message, history }` with plain `{ role, content }`
 * entries, so tool plumbing is flattened away before the request leaves the
 * browser.
 */
export async function aiChat(
  messages: AiWireMessage[],
  options: { signal?: AbortSignal; conversationId?: string } = {},
): Promise<AiChatResponse & { conversationId?: string }> {
  const wire = messages ?? [];
  const last = wire[wire.length - 1];
  const message = (last?.role === 'user' ? last.content : '') || '';
  const history = wire
    .slice(0, last?.role === 'user' ? -1 : undefined)
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
    .filter((entry) => (entry.content || '').trim().length > 0)
    .map((entry) => ({ role: entry.role, content: entry.content || '' }));

  const response = await aiApi.chat({ message, history, conversationId: options.conversationId as string | undefined }, { signal: options.signal });

  return {
    type: 'message',
    message: { role: 'assistant', content: response?.content ?? '' },
    conversationId: (response as any)?.conversationId,
  };
}

export async function aiChatStream(
  messages: AiWireMessage[],
  options: { signal?: AbortSignal; conversationId?: string; onDelta: (chunk: string) => void; onTool?: (event: unknown) => void }
): Promise<{ conversationId: string; content: string }> {
  const wire = messages ?? [];
  const last = wire[wire.length - 1];
  const message = (last?.role === 'user' ? last.content : '') || '';
  const history = wire
    .slice(0, last?.role === 'user' ? -1 : undefined)
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
    .filter((entry) => (entry.content || '').trim().length > 0)
    .map((entry) => ({ role: entry.role, content: entry.content || '' }));

  // Authentication is cookie-only (HttpOnly access_token). CSRF uses the
  // same double-submit token as every other mutating request. No token is
  // ever read from storage — the previous `Bearer` header here sent an
  // empty credential and the missing `credentials: 'include'` dropped the
  // session cookie entirely, so this endpoint could never authorize.
  await ensureCsrfCookie();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const xsrf = readXsrfCookie();
  if (xsrf) headers['x-xsrf-token'] = xsrf;

  const res = await fetch(apiUrl('/ai/chat/stream'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ message, history, conversationId: options.conversationId ?? undefined }),
    signal: options.signal,
  });

  if (!res.ok) {
    // Surface the real failure class so the UI can react (401 → re-login,
    // 403 → forbidden, 429 → back off) instead of a generic message.
    let serverMessage: string | null = null;
    try {
      const body = (await res.json()) as { message?: string } | null;
      serverMessage = body?.message ?? null;
    } catch {
      /* non-JSON error body — fall back to status text */
    }
    throw new ApiError(res.status, serverMessage || `AI stream failed (${res.status}).`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new ApiError(500, 'No readable stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let finalConversationId = options.conversationId || '';
  let streamError: Error | null = null;

  // SSE frames may be split across chunks, so events are parsed from a
  // rolling buffer at frame boundaries (blank line), not per raw chunk.
  let eventType = '';
  const processFrame = (frame: string) => {
    let dataStr: string | null = null;
    for (const line of frame.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        dataStr = line.slice(6).trim();
      }
    }
    if (dataStr === null || dataStr === '') return;

    let data: unknown;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return; // malformed frame — ignore, never crash the stream
    }

    const payload = data as { content?: string; conversationId?: string; message?: string };
    if (eventType === 'delta' && payload.content) {
      fullContent += payload.content;
      options.onDelta(payload.content);
    } else if (eventType === 'done') {
      finalConversationId = payload.conversationId || finalConversationId;
    } else if (eventType === 'tool' && options.onTool) {
      options.onTool(data);
    } else if (eventType === 'error') {
      // Server-reported failure must not be swallowed by the JSON parse
      // guard above (the old implementation threw inside its own try/catch).
      streamError = new ApiError(500, payload.message || 'The AI service reported an error.');
    }
  };

  const flushFrames = (emitFinal: boolean) => {
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (frame.trim()) processFrame(frame);
    }
    if (emitFinal && buffer.trim()) {
      processFrame(buffer);
      buffer = '';
    }
  };

  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      flushFrames(false);
    }
    done = readerDone;
  }
  flushFrames(true);

  if (streamError) throw streamError;

  return { conversationId: finalConversationId, content: fullContent };
}

/**
 * Execute a previously proposed action.
 *
 * Backend limitation (documented, not worked around): `POST /ai/chat` is the
 * only AI route the API exposes today — it cannot yet resume a parked tool
 * call, so no endpoint accepts an `actionId`. The confirmation UI therefore
 * fails loudly and safely instead of pretending the action ran.
 */
export async function confirmAiAction(actionId: string): Promise<Record<string, unknown>> {
  return await request<Record<string, unknown>>(`/workspace/ai/actions/${actionId}/confirm`, {
    method: 'POST'
  });
}

/**
 * Reject a proposed action and record the rejection reason.
 */
export async function rejectAiAction(actionId: string, reason?: string): Promise<Record<string, unknown>> {
  return await request<Record<string, unknown>>(`/workspace/ai/actions/${actionId}/reject`, {
    method: 'POST',
    body: reason ? JSON.stringify({ reason }) : undefined,
  });
}
export interface AiConversationSummary {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiInsight {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  metric?: string;
  trend?: 'up' | 'down' | 'flat';
}

export const aiConversationsApi = {
  list: (limit = 50) => request<AiConversationSummary[]>(`/ai/conversations?limit=${limit}`),
  create: () => request<{ id: string }>('/ai/conversations', { method: 'POST' }),
  messages: (id: string) => request<AiWireMessage[]>(`/ai/conversations/${id}/messages`),
  remove: (id: string) => request(`/ai/conversations/${id}`, { method: 'DELETE' }),
};

export const aiInsightsApi = {
  list: (scope = 'current') => request<AiInsight[]>(`/ai/insights?scope=${scope}`),
};

export const aiSuggestionsApi = {
  list: (context: string) => request<string[]>(`/ai/suggestions?context=${encodeURIComponent(context)}`),
};

export const aiHealthApi = {
  check: () => request<{ ok: boolean; model?: string }>('/ai/health'),
};
