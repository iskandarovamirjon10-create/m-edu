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
  /** Human subject, e.g. "Davomat ma'lumotlari". */
  subject: string;
  /** Title of the confirmation card when this tool changes data. */
  proposal?: string;
}

/**
 * Tool vocabulary keyed by the names the backend registry actually exposes
 * (`apps/api/src/ai/tools/**`). Legacy aliases are kept so older transcript
 * entries still render a human label instead of a raw `a.b` string.
 */
const TOOL_META: Record<string, ToolMeta> = {
  'attendance.summary': { subject: "Davomat ma'lumotlari" },
  'attendance.today': { subject: "Davomat ma'lumotlari" },
  'attendance.groups': { subject: "Guruhlar davomati taqqoslovi" },
  'schedule.list': { subject: 'Dars jadvali' },
  'schedule.today': { subject: 'Dars jadvali' },
  'students.search': { subject: "O'quvchilar ro'yxati" },
  'teachers.list': { subject: "O'qituvchilar ro'yxati" },
  'groups.list': { subject: "Guruhlar ro'yxati" },
  'courses.list': { subject: "Kurslar ro'yxati" },
  'finance.debtors': { subject: "Qarzdorlar ro'yxati" },
  'finance.summary': { subject: 'Moliyaviy hisobot' },
  'reports.summary': { subject: 'Kunlik hisobot' },
  'notifications.broadcast': {
    subject: 'Xabarnoma',
    proposal: 'Xabarnoma yuborish',
  },
  'telegram.prepareMessage': {
    subject: 'Telegram xabari',
    proposal: 'Telegram xabari tayyorlash',
  },
  'students.create': {
    subject: "Yangi o'quvchi",
    proposal: "Yangi o'quvchi qo'shish",
  },
  'teachers.create': {
    subject: "Yangi o'qituvchi",
    proposal: "Yangi o'qituvchi qo'shish",
  },
  'groups.create': {
    subject: 'Yangi guruh',
    proposal: 'Yangi guruh yaratish',
  },
  'courses.create': {
    subject: 'Yangi kurs',
    proposal: 'Yangi kurs yaratish',
  },
  'schedule.create': {
    subject: 'Dars jadvali',
    proposal: "Jadvalga dars qo'shish",
  },
};

const TOOL_SUCCESS: Record<string, string> = {
  'attendance.summary': "Davomat ma'lumotlari olindi",
  'attendance.today': "Davomat ma'lumotlari olindi",
  'attendance.groups': "Guruhlar davomati taqqoslovi olindi",
  'schedule.list': 'Dars jadvali olindi',
  'schedule.today': 'Dars jadvali olindi',
  'students.search': "O'quvchilar ro'yxati olindi",
  'teachers.list': "O'qituvchilar ro'yxati olindi",
  'groups.list': "Guruhlar ro'yxati olindi",
  'courses.list': "Kurslar ro'yxati olindi",
  'finance.debtors': "Qarzdorlar ro'yxati olindi",
  'finance.summary': 'Moliyaviy hisobot olindi',
  'reports.summary': 'Hisobot tayyorlandi',
  'notifications.broadcast': 'Xabarnoma yuborish tayyorlandi',
  'telegram.prepareMessage': 'Telegram xabari tayyorlandi',
  'students.create': "Yangi o'quvchi qo'shish tayyorlandi",
  'teachers.create': "Yangi o'qituvchi qo'shish tayyorlandi",
  'groups.create': 'Yangi guruh yaratish tayyorlandi',
  'courses.create': 'Yangi kurs yaratish tayyorlandi',
  'schedule.create': "Jadvalga dars qo'shish tayyorlandi",
};

/** Parameter labels used by both confirmation and result cards. */
const PARAMETER_LABELS: Record<string, string> = {
  message: 'Xabar',
  audience: 'Kimga',
  title: 'Sarlavha',
  recipientGroup: 'Qabul qiluvchilar',
  dayOfWeek: 'Hafta kuni',
  startTime: 'Boshlanish',
  endTime: 'Tugash',
  room: 'Xona',
  courseId: 'Kurs',
  teacherId: "O'qituvchi",
  name: 'Nomi',
  group: 'Guruh',
  groupId: 'Guruh',
  student: 'O\'quvchi',
  studentId: 'O\'quvchi',
  firstName: 'Ism',
  lastName: 'Familiya',
  email: 'Elektron pochta',
  phone: 'Telefon',
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
      return TOOL_SUCCESS[toolName] ?? (subject ? `${subject} olindi` : 'Ma\'lumot olindi');
    case 'running':
      return subject ? `${subject} olinmoqda...` : 'Ma\'lumot olinmoqda...';
    case 'error':
      return subject ? `${subject} olinmadi` : 'Ma\'lumotni olib bo\'lmadi';
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
  message: 'AI bilan bog\'lanib bo\'lmadi. Internet aloqasini tekshirib, qayta urinib ko\'ring.',
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
          message: 'So\'rovni qabul qilib bo\'lmadi. Savolni boshqacha shaklda yozib ko\'ring.',
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
          message: 'Bu amal uchun sizda ruxsat yo\'q.',
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
              message: 'So\'ralgan ma\'lumot topilmadi.',
              retryable: false,
              code: 'not_found',
            };
      case 408:
        return {
          message: 'AI javob berishga ulgurmadi. Qayta urinib ko\'ring.',
          retryable: true,
          code: 'timeout',
        };
      case 429:
        return {
          message: 'So\'rovlar soni juda ko\'p. Biroz kutib, qayta urinib ko\'ring.',
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
            message: 'AI xizmatida xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.',
            retryable: true,
            code: 'server',
          };
        }
        return {
          message: 'Amalni tasdiqlashning iloji bo\'lmadi. Qayta urinib ko\'ring.',
          retryable: false,
          code: 'confirm_failed',
        };
    }
  }

  if (isNetworkFailure(error)) return NETWORK_ERROR;

  return {
    message: 'Kutilmagan xatolik yuz berdi. Qayta urinib ko\'ring.',
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
  options: {
    signal?: AbortSignal;
    conversationId?: string;
    route?: string;
    model?: string;
  } = {},
): Promise<AiChatResponse & { conversationId?: string }> {
  const wire = messages ?? [];
  const last = wire[wire.length - 1];
  const message = (last?.role === 'user' ? last.content : '') || '';
  const attachments = last?.attachments?.map((att) => ({
    type: att.type,
    mimeType: att.mimeType,
    base64: att.base64 || '',
    name: att.name,
  }));
  const history = wire
    .slice(0, last?.role === 'user' ? -1 : undefined)
    .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
    .filter((entry) => (entry.content || '').trim().length > 0)
    .map((entry) => ({ role: entry.role, content: entry.content || '' }));

  const response = await aiApi.chat(
    {
      message,
      history,
      conversationId: options.conversationId as string | undefined,
      attachments,
      model: options.model,
      route: options.route,
    },
    { signal: options.signal }
  );

  return {
    type: 'message',
    message: { role: 'assistant', content: response?.content ?? '' },
    conversationId: (response as any)?.conversationId,
  };
}

export async function aiChatStream(
  messages: AiWireMessage[],
  options: {
    signal?: AbortSignal;
    conversationId?: string;
    route?: string;
    model?: string;
    onDelta: (chunk: string) => void;
    onTool?: (event: unknown) => void;
  }
): Promise<{ conversationId: string; content: string }> {
  const wire = messages ?? [];
  const last = wire[wire.length - 1];
  const message = (last?.role === 'user' ? last.content : '') || '';
  const attachments = last?.attachments?.map((att) => ({
    type: att.type,
    mimeType: att.mimeType,
    base64: att.base64 || '',
    name: att.name,
  }));
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
  if (options.route) {
    const cleanRoute = options.route.replace(/[\r\n]/g, '').slice(0, 200);
    headers['X-Page-Context'] = cleanRoute;
  }
  const xsrf = readXsrfCookie();
  if (xsrf) headers['x-xsrf-token'] = xsrf;

  const res = await fetch(apiUrl('/ai/chat/stream'), {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      message,
      history,
      conversationId: options.conversationId ?? undefined,
      route: options.route ? options.route.slice(0, 200) : undefined,
      model: options.model ?? undefined,
      attachments: attachments && attachments.length > 0 ? attachments : undefined,
    }),
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
 * Execute a previously confirmed action.
 *
 * Confirmation is re-authorized server-side (identity, tenant, permission,
 * expiry, status and parameters) and the execution gate is atomic, so a
 * double click can never write twice.
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
  actionRoute?: string;
  actionLabel?: string;
  calculationRule?: string;
  timeRange?: string;
}

export const aiConversationsApi = {
  list: (limit = 50) => request<AiConversationSummary[]>(`/ai/conversations?limit=${limit}`),
  create: () => request<{ id: string }>('/ai/conversations', { method: 'POST' }),
  messages: (id: string) => request<AiWireMessage[]>(`/ai/conversations/${id}/messages`),
  rename: (id: string, title: string) =>
    request<AiConversationSummary>(`/ai/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  remove: (id: string) => request(`/ai/conversations/${id}`, { method: 'DELETE' }),
};

export const aiInsightsApi = {
  /** Page-scoped insights: the route travels as a header, never as `scope`. */
  list: (route?: string) =>
    request<AiInsight[]>('/ai/insights?scope=page', {
      headers: route ? { 'X-Page-Context': route } : undefined,
    }),
  dismiss: (id: string) =>
    request<{ ok: boolean; dismissedId: string }>(`/ai/insights/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST',
    }),
};

export interface AiBriefingPriorityAction {
  id: string;
  category: string;
  title: string;
  actionLabel: string;
  prompt: string;
}

export interface AiExecutiveBriefing {
  summary: string;
  sentiment: 'positive' | 'attention' | 'critical';
  priorityActions: AiBriefingPriorityAction[];
  metrics: {
    studentsCount: number;
    groupsCount: number;
    teachersCount: number;
    attendanceRate: number;
    presentToday: number;
    absentToday: number;
    lateToday: number;
    debtorsCount: number;
    overdueAmount: number;
    highRiskStudents: number;
    monthlyRevenue: number;
    pendingActionsCount: number;
    newEnrollmentsCount: number;
  };
  generatedAt: string;
}

export const aiBriefingApi = {
  get: () => request<AiExecutiveBriefing>('/ai/executive-briefing'),
};

export const aiActionsApi = {
  list: (query?: { status?: string; page?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (query?.status) params.set('status', query.status);
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return request<any>(`/workspace/ai/actions${qs ? `?${qs}` : ''}`);
  },
  confirm: (actionId: string) => confirmAiAction(actionId),
  reject: (actionId: string, reason?: string) => rejectAiAction(actionId, reason),
};

export const aiStudioApi = {
  diagnoseStudent: (studentId: string) =>
    request<any>(`/ai/diagnose/student/${encodeURIComponent(studentId)}`),
  draftParentMessage: (body: {
    studentId?: string;
    studentName: string;
    tone?: 'friendly' | 'formal' | 'urgent';
    topic?: 'attendance' | 'debt' | 'praise' | 'exam' | 'custom';
    details?: string;
    balanceDue?: number;
  }) => request<any>('/ai/draft-parent-message', { method: 'POST', body: JSON.stringify(body) }),
  generateQuiz: (body: {
    topic: string;
    subject?: string;
    level?: string;
    questionCount?: number;
    bloomsTaxonomyLevel?: string;
    difficulty?: string;
  }) => request<any>('/ai/generate-quiz', { method: 'POST', body: JSON.stringify(body) }),
  generateLessonPlan: (body: {
    topic: string;
    subject?: string;
    level?: string;
    durationMinutes?: number;
    learningObjectives?: string[];
    bloomsTaxonomyLevel?: string;
  }) => request<any>('/ai/generate-lesson-plan', { method: 'POST', body: JSON.stringify(body) }),
  generateReport: (body: {
    reportType: 'ATTENDANCE_WEEKLY' | 'ENROLLMENT_TRENDS' | 'TEACHER_WORKLOAD' | 'FINANCIAL_SUMMARY' | 'CUSTOM';
    timeRange?: '7d' | '30d' | '90d' | 'all';
    query?: string;
  }) => request<any>('/ai/reports', { method: 'POST', body: JSON.stringify(body) }),
  analyzeDocument: (body: {
    base64: string;
    mimeType: string;
    fileName?: string;
    instruction?: string;
    analysisType?: 'curriculum' | 'policy' | 'quiz_extraction' | 'summary';
  }) => request<any>('/ai/analyze-document', { method: 'POST', body: JSON.stringify(body) }),
};

export const aiSuggestionsApi = {
  list: (context: string) => request<string[]>(`/ai/suggestions?context=${encodeURIComponent(context)}`),
};

export type AiHealthMode = 'live' | 'fallback' | 'offline';

export interface AiHealthStatus {
  ok: boolean;
  model?: string;
  provider?: string;
  configured?: boolean;
  /** `live` = model provider ready, `fallback` = database-backed answers. */
  mode?: Exclude<AiHealthMode, 'offline'>;
  uptime?: number;
  timestamp?: string;
}

export const aiHealthApi = {
  check: () => request<AiHealthStatus>('/ai/health'),
};
