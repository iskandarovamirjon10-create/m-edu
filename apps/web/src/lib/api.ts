// M-EDU API client — typed fetch wrapper with auth and error handling.
// Security: JWT token is transported exclusively via HttpOnly cookie
// (access_token). This file NEVER stores or sends tokens in headers
// or browser storage. Credentials are included so cookies travel.

import type { DashboardStats, MonthlyRevenue } from './types';
import { purgeSessionCaches } from './sessionCleanup';
import type {
  Anomaly,
  CashFlowData,
  CRMAgingResponse,
  CRMFunnelResponse,
  CRMLostReasonsResponse,
  CRMModeratorStats,
  CRMSources,
  CRMVelocityResponse,
  FinancialAnomaly,
  ForecastResult,
  ReconciliationData,
  WhatIfSimulationData,
} from '../types/analytics';
import type {
  DataAccessLog,
  DataGovernancePolicy,
  ExportLog,
  ExportStats,
  Paginated,
  RetentionCheckResult,
} from '../types/governance';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

// Token storage removed: JWT lives only as HttpOnly cookie (access_token).
// user data can stay in memory or be rebuilt from cookie-based /auth/me.
export const userStore = {
  get<T>(): T | null {
    try {
      const raw = localStorage.getItem('medu_user');
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set<T>(user: T) {
    if (!user || typeof user !== 'object') {
      localStorage.setItem('medu_user', JSON.stringify(user));
      return;
    }
    // Defense-in-depth (SEC-08): strip any accidental sensitive credentials before localStorage write
    const sanitized = { ...(user as Record<string, unknown>) };
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      'twoFactorSecret',
      'faceDescriptor',
      'embedding',
    ];
    for (const key of sensitiveKeys) {
      delete sanitized[key];
    }
    localStorage.setItem('medu_user', JSON.stringify(sanitized));
  },
  clear() {
    localStorage.removeItem('medu_user');
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function friendlyHttpMessage(status: number, serverMessage: string | null): string {
  if (status === 429) {
    return 'Too many requests — please wait a moment and try again.';
  }
  if (serverMessage && !/^ThrottlerException/i.test(serverMessage)) {
    return serverMessage;
  }
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'The request conflicts with the current state. Please refresh and retry.';
  return `Request failed with status ${status}.`;
}

const DEFAULT_TIMEOUT_MS = 60_000;
export type RequestOptions = RequestInit & {
  timeout?: number;
  defaultFilename?: string;
  _isCsrfRetry?: boolean;
  idempotencyKey?: string;
};

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'idemp_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

/**
 * API base path. Production builds honour `VITE_API_URL` (set in the Dockerfile
 * / CI) so the SPA can talk to a separately deployed API host; development
 * falls back to the Vite dev-server proxy at `/api`.
 */
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '/api';

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** Read the double-submit CSRF cookie, if the browser holds one. */
export function readXsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Guarantee the `XSRF-TOKEN` cookie exists before a mutating request.
 *
 * The API seeds the cookie on any response; hitting the public
 * `/csrf-token` route first removes the race where a brand-new browser
 * session submitted a mutation before any GET had returned (which used to
 * surface as a confusing 403 “Invalid CSRF token”).
 * Concurrent callers share one in-flight request.
 */
let csrfSeed: Promise<void> | null = null;
export async function ensureCsrfCookie(force = false): Promise<void> {
  if (typeof document === 'undefined') return;
  if (!force && readXsrfCookie()) return;
  if (!csrfSeed) {
    csrfSeed = fetch(`${API_BASE}/csrf-token`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        csrfSeed = null;
      });
  }
  await csrfSeed;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // NO Authorization: Bearer header. The browser sends the HttpOnly cookie (access_token)
  // automatically when credentials are included. No token is read from storage.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const method = options.method?.toUpperCase() || 'GET';
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    await ensureCsrfCookie();
    const token = readXsrfCookie();
    if (token) {
      headers['x-xsrf-token'] = token;
    }
  }

  const idempotencyKey =
    options.idempotencyKey ||
    (options.headers as Record<string, string> | undefined)?.['idempotency-key'] ||
    (options.headers as Record<string, string> | undefined)?.['Idempotency-Key'];
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  let res: Response;
  try {
    // credentials: 'include' is REQUIRED for HttpOnly cookie transport (same-origin and cross-origin with CORS credentials: true).
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
      credentials: 'include',
    });
  } catch (err) {
    const errName = (err as { name?: string } | null | undefined)?.name;
    if (errName === 'AbortError') {
      const timedOut = controller.signal.aborted && !options.signal?.aborted;
      throw new ApiError(
        408,
        timedOut ? 'The request timed out. Please check your connection and try again.' : 'The request was cancelled. Please try again.',
      );
    }
    throw err;
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }

  if (res.status === 401) {
    // Do NOT force sign-out/redirect for auth-probe or public-page requests:
    // - /auth/me 401 on boot is normal when logged out (public pages, OAuth, reset links)
    // - /auth/login 401 = wrong password, not a dead session (would log out other tabs)
    const isAuthProbe =
      path.startsWith('/auth/me') ||
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/auth/oauth') ||
      path.startsWith('/auth/forgot') ||
      path.startsWith('/auth/reset') ||
      path.startsWith('/auth/parent-login') ||
      path.startsWith('/telegram/webapp');
    const onPublic =
      typeof window !== 'undefined' &&
      /^\/(login|register|forgot-password|reset-password|terms|privacy|auth\/callback|tg-app|kiosk)/.test(
        window.location.pathname,
      );
    if (!isAuthProbe && !onPublic) {
      userStore.clear();
      // Hard boundary: wipe any cached (previous-session) data before the
      // redirect so nothing from this account can render afterwards.
      purgeSessionCaches();
      if (onUnauthorized) onUnauthorized();
    }
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const contentType = res.headers.get('content-type') || '';
  let body: unknown = null;
  if (contentType.includes('application/json')) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }

  if (res.status === 403 && !options._isCsrfRetry) {
    const serverMessage = (body as { message?: string } | null)?.message || (typeof body === 'string' ? body : '');
    if (typeof serverMessage === 'string' && (serverMessage.includes('CSRF') || serverMessage.includes('XSRF'))) {
      await ensureCsrfCookie(true);
      const freshToken = readXsrfCookie();
      const retryHeaders = { ...headers, ...(freshToken ? { 'x-xsrf-token': freshToken } : {}) };
      return request<T>(path, { ...options, headers: retryHeaders, _isCsrfRetry: true });
    }
  }

  if (!res.ok) {
    const rawMsg = (body as { message?: unknown } | null)?.message;
    const serverMessage = Array.isArray(rawMsg)
      ? rawMsg.join('; ')
      : typeof rawMsg === 'string'
      ? rawMsg
      : Array.isArray(body)
      ? body.map((b: any) => (typeof b === 'string' ? b : b?.message)).filter(Boolean).join('; ')
      : null;
    const message = friendlyHttpMessage(res.status, serverMessage);
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}

export function buildQuery(params: object | undefined): string {
  if (!params) return '';
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ user: unknown }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  parentLogin: (email: string, password: string) =>
    request<{ user: unknown }>('/auth/parent-login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data: {
    email: string; password: string; firstName: string; lastName: string; phone?: string; organizationName: string; inviteCode?: string;
  }) =>
    request<{ user: unknown }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<unknown>('/auth/me'),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  refresh: () => request<{ user: unknown }>('/auth/refresh', { method: 'POST' }),
  exchangeCode: (code: string, state?: string) =>
    // The session is set as an HttpOnly cookie by the API; no credential is
    // returned to JavaScript by design. State protects against Login CSRF.
    request<{ authenticated: boolean }>('/auth/oauth/exchange', {
      method: 'POST',
      body: JSON.stringify({ code, ...(state ? { state } : {}) }),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  getWhitelist: () =>
    request<{
      whitelist: Array<{
        id: string;
        email: string;
        role: string | null;
        note: string | null;
        addedBy: string | null;
        addedByName: string | null;
        organizationId: string | null;
        createdAt: string;
      }>;
      pendingUsers: Array<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        role: string;
        status: string;
        organizationId: string;
        organizationName: string;
        createdAt: string;
      }>;
      settings: {
        inviteOnly: boolean;
        requireApproval: boolean;
      };
    }>('/auth/whitelist'),
  addToWhitelist: (data: { email: string; note?: string; role?: string }) =>
    request<unknown>('/auth/whitelist', { method: 'POST', body: JSON.stringify(data) }),
  removeFromWhitelist: (id: string) =>
    request<{ success: boolean; message: string }>(`/auth/whitelist/${id}`, { method: 'DELETE' }),
  approveUser: (id: string) =>
    request<{ success: boolean; message: string }>(`/auth/whitelist/approve-user/${id}`, { method: 'POST' }),
  rejectUser: (id: string) =>
    request<{ success: boolean; message: string }>(`/auth/whitelist/reject-user/${id}`, { method: 'DELETE' }),
  updateAccessSettings: (data: { inviteOnly?: boolean; requireApproval?: boolean }) =>
    request<{ inviteOnly: boolean; requireApproval: boolean }>('/auth/whitelist/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getSessions: () => request<ActiveSession[]>('/auth/sessions'),
  revokeSession: (id: string) => request<{ message: string; id: string }>(`/auth/sessions/${id}`, { method: 'DELETE' }),
  revokeOtherSessions: () => request<{ message: string; revokedCount: number }>('/auth/sessions/revoke-others', { method: 'POST' }),
};

export interface ActiveSession {
  id: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  lastActiveAt: string;
  isCurrentSession: boolean;
}

function crud<T>(base: string) {
  return {
    list: (params?: object) => request<T>(`${base}${buildQuery(params)}`),
    get: (id: string) => request<T>(`${base}/${id}`),
    create: (data: unknown, options?: RequestOptions) =>
      request<T>(`${base}`, { method: 'POST', body: JSON.stringify(data), ...options }),
    update: (id: string, data: unknown, options?: RequestOptions) =>
      request<T>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...options }),
    remove: (id: string, options?: RequestOptions) =>
      request<unknown>(`${base}/${id}`, { method: 'DELETE', ...options }),
  };
}

export const studentsApi = {
  ...crud('/students'),
  assignGroup: (studentId: string, groupId: string) =>
    request(`/students/${studentId}/groups/${groupId}`, { method: 'POST' }),
  removeGroup: (studentId: string, groupId: string) =>
    request(`/students/${studentId}/groups/${groupId}`, { method: 'DELETE' }),
  getParents: (studentId: string) =>
    request<any[]>(`/students/${studentId}/parents`),
  addParent: (studentId: string, data: any) =>
    request<any>(`/students/${studentId}/parents`, { method: 'POST', body: JSON.stringify(data) }),
  updateParent: (studentId: string, parentId: string, data: any) =>
    request<any>(`/students/${studentId}/parents/${parentId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  unlinkParent: (studentId: string, parentId: string) =>
    request<{ success: boolean }>(`/students/${studentId}/parents/${parentId}`, { method: 'DELETE' }),
  freeze: (studentId: string, data: { startDate?: string; endDate?: string; reason?: string }) =>
    request<any>(`/students/${studentId}/freeze`, { method: 'POST', body: JSON.stringify(data) }),
  unfreeze: (studentId: string) =>
    request<any>(`/students/${studentId}/unfreeze`, { method: 'POST' }),
};
export const teachersApi = crud('/teachers');
export const coursesApi = crud('/courses');
export const groupsApi = {
  ...crud('/groups'),
  getCapacity: (id: string) => request<any>(`/groups/${id}/capacity`),
  graduate: (id: string, data: unknown) =>
    request<any>(`/groups/${id}/graduate`, { method: 'POST', body: JSON.stringify(data) }),
};
export const scheduleApi = {
  ...crud('/schedule'),
  getRoomUtilization: () => request<any>('/schedule/room-utilization'),
};
export const paymentsApi = {
  ...crud('/payments'),
  create: (data: unknown, options?: RequestOptions) =>
    request<any>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  getExecutiveBriefing: (options: RequestOptions = {}) =>
    request<AiExecutiveBriefing>('/ai/executive-briefing', options),
  diagnoseStudent: (studentId: string, options: RequestOptions = {}) =>
    request<AiStudentDiagnostic>('/ai/diagnose/student/' + encodeURIComponent(studentId), options),
  draftParentMessage: (
    data: {
      studentId?: string;
      studentName: string;
      tone?: 'friendly' | 'formal' | 'urgent';
      topic?: 'attendance' | 'debt' | 'praise' | 'exam' | 'custom';
      details?: string;
      balanceDue?: number;
    },
    options: RequestOptions = {},
  ) =>
    request<AiDraftMessageResponse>('/ai/draft-parent-message', {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    }),
  generateQuiz: (
    data: {
      topic: string;
      subject?: string;
      level?: string;
      questionCount?: number;
    },
    options: RequestOptions = {},
  ) =>
    request<AiGeneratedQuizResponse>('/ai/generate-quiz', {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    }),
};
export const expensesApi = {
  ...crud('/expenses'),
  create: (data: unknown, options?: RequestOptions) =>
    request<any>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  summary: (params?: object) => request(`/expenses/summary${buildQuery(params)}`),
};
export const leadsApi = {
  ...crud('/leads'),
  updateStage: (id: string, stage: string) =>
    request(`/leads/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  convert: (id: string, data: unknown) => request(`/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
  addActivity: (id: string, data: unknown) => request(`/leads/${id}/activities`, { method: 'POST', body: JSON.stringify(data) }),
  getFollowUpRules: (params?: object) => request(`/leads/follow-up-rules${buildQuery(params)}`),
  getFollowUps: (params?: object) => request(`/leads/follow-ups${buildQuery(params)}`),
  getFollowUpStats: () => request('/leads/follow-ups/stats'),
  createFollowUpRule: (data: unknown) => request('/leads/follow-up-rules', { method: 'POST', body: JSON.stringify(data) }),
  updateFollowUpRule: (id: string, data: unknown) => request(`/leads/follow-up-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteFollowUpRule: (id: string) => request(`/leads/follow-up-rules/${id}`, { method: 'DELETE' }),
  evaluateFollowUpRules: () => request('/leads/follow-up-rules/evaluate', { method: 'POST' }),
  completeFollowUp: (id: string, data?: unknown) => request(`/leads/follow-ups/${id}/complete`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  trialAnalytics: () => request<any>('/leads/trial-analytics'),
  getTrialAnalytics: () => request<any>('/leads/trial-analytics'),
  scheduleTrial: (id: string, data: unknown) =>
    request<any>(`/leads/${id}/trial-schedule`, { method: 'POST', body: JSON.stringify(data) }),
  recordTrialAttendance: (id: string, data: unknown) =>
    request<any>(`/leads/${id}/trial-attendance`, { method: 'POST', body: JSON.stringify(data) }),
  markTrialAttendance: (id: string, data: unknown) =>
    request<any>(`/leads/${id}/trial-attendance`, { method: 'POST', body: JSON.stringify(data) }),
};
export const usersApi = {
  ...crud('/users'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request('/users/change-password', { method: 'POST', body: JSON.stringify(data) }),
  updateSettings: (id: string, data: unknown) => request(`/users/${id}/settings`, { method: 'PATCH', body: JSON.stringify(data) }),
};
export const organizationsApi = {
  me: () => request('/organizations/me'),
  update: (data: unknown) => request('/organizations/me', { method: 'PATCH', body: JSON.stringify(data) }),
};
export const notificationsApi = {
  list: (params?: object) => request(`/notifications${buildQuery(params)}`),
  markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PATCH' }),
};

/**
 * Telegram integration (self-service).
 *
 * The server never returns the bot token, webhook secret, callback secret or
 * the raw chat id — the client only ever sees a coarse lifecycle status and a
 * one-time deep link that belongs to the caller.
 */
export type TelegramAccountState = 'ACTIVE' | 'DISCONNECTED' | 'BLOCKED' | 'SUSPENDED';
export interface TelegramStatusResponse {
  linked: boolean;
  status: TelegramAccountState | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
  linkedAt: string | null;
  lastSeenAt: string | null;
  pendingLinkExpiresAt: string | null;
}

export interface TelegramAdminOverview {
  configured: boolean;
  botUsername: string | null;
  organizationId: string;
  accounts: {
    total: number;
    active: number;
    disconnected: number;
    blocked: number;
    suspended: number;
    lastSeenAt: string | null;
  };
  deliveries: {
    last24h: { sent: number; failed: number; deferred: number; skipped: number };
    recentFailures: Array<{
      eventType: string;
      channel: string;
      failureCategory: string | null;
      attempts: number;
      failedAt: string | null;
    }>;
  };
  webhook: { updatesLast24h: number; lastUpdateAt: string | null } | null;
}
export const telegramApi = {
  status: () => request<TelegramStatusResponse>('/telegram/status'),
  adminOverview: () => request<TelegramAdminOverview>('/telegram/admin/overview'),
  createLink: () =>
    request<{ token: string; deepLink: string; expiresAt: string }>('/telegram/link', {
      method: 'POST',
    }),
  unlink: () => request<{ disconnected: boolean }>('/telegram/link', { method: 'DELETE' }),
  testNotification: () =>
    request<{ sent: boolean }>('/telegram/test-notification', { method: 'POST' }),
  webappAuth: (initData: string) =>
    request<{
      authenticated: boolean;
      accessToken?: string;
      user?: unknown;
      role?: string;
      organization?: unknown;
      message?: string;
    }>('/telegram/webapp/auth', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),
};

export const aiApi = {
  chat: (body: { message: string; history?: unknown[]; conversationId?: string; attachments?: unknown[]; model?: string }, options: RequestOptions = {}) =>
    request<{ content: string; conversationId?: string; role?: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),
  getExecutiveBriefing: (options: RequestOptions = {}) =>
    request<AiExecutiveBriefing>('/ai/executive-briefing', options),
  diagnoseStudent: (studentId: string, options: RequestOptions = {}) =>
    request<AiStudentDiagnostic>(`/ai/diagnose/student/${encodeURIComponent(studentId)}`, options),
  draftParentMessage: (body: { studentName: string; topic: string; details?: string; balanceDue?: number }, options: RequestOptions = {}) =>
    request<AiDraftMessageResponse>('/ai/draft-parent-message', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),
  generateQuiz: (body: { topic: string; subject?: string; gradeLevel?: string }, options: RequestOptions = {}) =>
    request<AiGeneratedQuizResponse>('/ai/generate-quiz', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),
};
export interface AiExecutiveBriefing {
  summary: string;
  sentiment: 'positive' | 'attention' | 'critical';
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
  };
  priorityActions: Array<{
    id: string;
    category: 'attendance' | 'finance' | 'risk' | 'academics';
    title: string;
    actionLabel: string;
    prompt: string;
  }>;
  generatedAt: string;
}

export interface AiStudentDiagnostic {
  studentId: string;
  studentName: string;
  overallScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  attendanceRate: number;
  averageGrade: number | null;
  balance: number;
  groups: string[];
  summary: string;
  strengths: string[];
  riskFactors: string[];
  recommendations: string[];
  suggestedParentMessage: string;
}

export interface AiDraftMessageResponse {
  message: string;
  tone: string;
  topic: string;
  charCount: number;
}

export interface AiGeneratedQuizResponse {
  topic: string;
  subject: string;
  level: string;
  lessonPlan: {
    title: string;
    durationMinutes: number;
    steps: Array<{ minute: string; name: string; goal: string }>;
  };
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
  }>;
}

export const gradesApi = crud('/grades');
export const homeworkApi = crud('/homework');
export const attendanceApi = {
  create: (data: unknown) => request('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: object) => request(`/attendance${buildQuery(params)}`),
  analytics: (params?: object) => request(`/attendance/analytics${buildQuery(params)}`),
  update: (id: string, data: unknown) =>
    request(`/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/attendance/${id}`, { method: 'DELETE' }),
};
export const dashboardApi = {
  stats: () => request<DashboardStats>('/dashboard/stats'),
  revenue: (period?: string) => request<MonthlyRevenue[]>(`/dashboard/revenue${buildQuery({ period })}`),
};
export const analyticsApi = {
  overview: () => request('/analytics/overview'),
  detectAllAnomalies: (params?: object) => request<Anomaly[]>(`/analytics/anomalies${buildQuery(params)}`),
  crmFunnel: (params?: object) => request<CRMFunnelResponse>(`/analytics/crm/funnel${buildQuery(params)}`),
  crmSources: (params?: object) => request<CRMSources[]>(`/analytics/crm/sources${buildQuery(params)}`),
  crmVelocity: (params?: object) => request<CRMVelocityResponse>(`/analytics/crm/velocity${buildQuery(params)}`),
  crmLostReasons: (params?: object) => request<CRMLostReasonsResponse>(`/analytics/crm/lost-reasons${buildQuery(params)}`),
  crmAging: (params?: object) => request<CRMAgingResponse>(`/analytics/crm/aging${buildQuery(params)}`),
  crmModerators: (params?: object) => request<CRMModeratorStats[]>(`/analytics/crm/moderators${buildQuery(params)}`),
  executiveSummary: (params?: object) => request(`/analytics/executive-summary${buildQuery(params)}`),
  payrollSummary: (params?: object) => request(`/analytics/payroll/summary${buildQuery(params)}`),
  payrollByTeacher: (params?: object) => request(`/analytics/payroll/by-teacher${buildQuery(params)}`),
  payrollTrend: (params?: object) => request(`/analytics/payroll/trend${buildQuery(params)}`),
  payrollRatio: (params?: object) => request(`/analytics/payroll/ratio${buildQuery(params)}`),
  payrollEfficiency: (params?: object) => request(`/analytics/payroll/efficiency${buildQuery(params)}`),
  whatIf: (params?: object) => request<WhatIfSimulationData>(`/analytics/financial/what-if${buildQuery(params)}`),
  forecast: (params?: object) => request<ForecastResult>(`/analytics/financial/forecast${buildQuery(params)}`),
  reconciliationReport: (params?: object) => request(`/analytics/reconciliation/report${buildQuery(params)}`),
  reconciliationDiscrepancies: (params?: object) => request(`/analytics/reconciliation/discrepancies${buildQuery(params)}`),
  studentBalances: (params?: object) => request(`/analytics/reconciliation/student-balances${buildQuery(params)}`),
  reconciliationHistory: (params?: object) => request(`/analytics/reconciliation/history${buildQuery(params)}`),
  cashFlow: (params?: object) => request<CashFlowData>(`/analytics/financial/cash-flow${buildQuery(params)}`),
  // /analytics/financial/anomalies returns the lean FinancialAnomaly shape,
  // not the richer Anomaly shape used by /analytics/anomalies.
  anomalies: (params?: object) => request<FinancialAnomaly[]>(`/analytics/financial/anomalies${buildQuery(params)}`),
  reconciliation: (params?: object) => request<ReconciliationData>(`/analytics/financial/reconciliation${buildQuery(params)}`),
};
export const libraryApi = {
  listBooks: (params?: object) => request(`/library/books${buildQuery(params)}`),
  searchBooks: (q: string) => request(`/library/books/search${buildQuery({ q })}`),
  getBook: (id: string) => request(`/library/books/${id}`),
  createBook: (data: unknown) => request('/library/books', { method: 'POST', body: JSON.stringify(data) }),
  updateBook: (id: string, data: unknown) => request(`/library/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBook: (id: string) => request(`/library/books/${id}`, { method: 'DELETE' }),
  borrow: (data: unknown) => request('/library/borrow', { method: 'POST', body: JSON.stringify(data) }),
  returnBook: (id: string, data: unknown) => request(`/library/return/${id}`, { method: 'POST', body: JSON.stringify(data) }),
  overdue: (params?: object) => request(`/library/overdue${buildQuery(params)}`),
  studentBorrows: (studentId: string) => request(`/library/student/${studentId}`),
  stats: () => request('/library/stats'),
};
export const hrApi = {
  // Backend returns { employees, total, page, limit, totalPages } — normalize to { items, ... }.
  listEmployees: async (params?: object) => {
    const data = await request<{
      employees: unknown[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/hr/employees${buildQuery(params)}`);
    return {
      items: data.employees,
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages,
    };
  },
  getEmployee: (id: string) => request(`/hr/employees/${id}`),
  createEmployee: (data: unknown) => request('/hr/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: unknown) => request(`/hr/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  // Controller reads @Body('reason') and rejects empty reason.
  terminateEmployee: (id: string, data: { reason: string }) =>
    request(`/hr/employees/${id}/terminate`, { method: 'POST', body: JSON.stringify(data) }),
  listLeaveRequests: (params?: object) => request(`/hr/leave-requests${buildQuery(params)}`),
  createLeaveRequest: (data: unknown) => request('/hr/leave-requests', { method: 'POST', body: JSON.stringify(data) }),
  approveLeave: (id: string) => request(`/hr/leave-requests/${id}/approve`, { method: 'POST' }),
  rejectLeave: (id: string, reason?: string) => request(`/hr/leave-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  employeeSalary: (employeeId: string) => request(`/hr/employees/${employeeId}/salary`),
  generatePayroll: (data: unknown) => request('/hr/payroll/generate', { method: 'POST', body: JSON.stringify(data) }),
  payrollSummary: (params?: object) => request(`/hr/payroll/summary${buildQuery(params)}`),
  processPayroll: (recordId: string) => request(`/hr/payroll/${recordId}/process`, { method: 'POST' }),
  stats: () => request('/hr/stats'),
};
// Backend returns { exams, total, ... } — normalize to Paginated-shaped { items, ... } for pages.
export const examsApi = {
  list: async (params?: object) => {
    const data = await request<{
      exams: unknown[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/exams${buildQuery(params)}`);
    return {
      items: data.exams,
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages,
    };
  },
  get: (id: string) => request(`/exams/${id}`),
  create: (data: unknown) => request('/exams', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request<unknown>(`/exams/${id}`, { method: 'DELETE' }),
  // PublishExamDto requires { isPublished }; force is NOT sent (product rule: results required).
  publish: (id: string) =>
    request(`/exams/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify({ isPublished: true }),
    }),
  results: (examId: string) => request(`/exams/${examId}/results`),
  addResult: (examId: string, data: unknown) => request(`/exams/${examId}/results`, { method: 'POST', body: JSON.stringify(data) }),
  stats: () => request('/exams/stats'),
  studentResults: (studentId: string) => request(`/exams/student/${studentId}`),
};
export const certificatesApi = {
  list: (params?: object) => request(`/certificates${buildQuery(params)}`),
  get: (id: string) => request(`/certificates/${id}`),
  studentCertificates: (studentId: string) => request(`/certificates/student/${studentId}`),
  generate: (data: unknown) => request('/certificates/generate', { method: 'POST', body: JSON.stringify(data) }),
  download: (id: string) => request(`/certificates/${id}/download`, { method: 'POST' }),
  verify: (code: string) => request(`/certificates/verify/${code}`),
  listTemplates: () => request('/certificates/templates'),
  getTemplate: (id: string) => request(`/certificates/templates/${id}`),
  createTemplate: (data: unknown) => request('/certificates/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: unknown) => request(`/certificates/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDefaultTemplate: (id: string) => request(`/certificates/templates/${id}/default`, { method: 'POST' }),
  removeTemplate: (id: string) => request(`/certificates/templates/${id}`, { method: 'DELETE' }),
};
export const inventoryApi = {
  listItems: (params?: object) => request(`/inventory/items${buildQuery(params)}`),
  getItem: (id: string) => request(`/inventory/items/${id}`),
  createItem: (data: unknown) => request('/inventory/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: string, data: unknown) => request(`/inventory/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id: string) => request(`/inventory/items/${id}`, { method: 'DELETE' }),
  itemTransactions: (id: string) => request(`/inventory/items/${id}/transactions`),
  createTransaction: (data: unknown) => request('/inventory/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateStock: (id: string, data: unknown) => request(`/inventory/items/${id}/stock`, { method: 'PUT', body: JSON.stringify(data) }),
  adjustStock: (id: string, data: unknown) => request(`/inventory/items/${id}/adjust`, { method: 'PATCH', body: JSON.stringify(data) }),
  stockReport: (params?: object) => request(`/inventory/stock-report${buildQuery(params)}`),
  categoryStats: () => request('/inventory/categories'),
};
export const faceApi = {
  engineStatus: () => request<{ provider: string; isReal: boolean }>('/face/engine-status'),
  enrollments: (params?: object) => request(`/face/enrollments${buildQuery(params)}`),
  startEnrollment: (studentId: string) =>
    request('/face/enrollments', { method: 'POST', body: JSON.stringify({ studentId }) }),
  getEnrollment: (id: string) => request(`/face/enrollments/${id}`),
  capture: (id: string, imageBase64: string) =>
    request(`/face/enrollments/${id}/capture`, { method: 'POST', body: JSON.stringify({ imageBase64 }) }),
  reenroll: (id: string, reason: string) =>
    request(`/face/enrollments/${id}/reenroll`, { method: 'POST', body: JSON.stringify({ reason }) }),
  revoke: (id: string, reason: string) =>
    request(`/face/enrollments/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  cancelPending: (id: string) =>
    request(`/face/enrollments/${id}/pending`, { method: 'DELETE' }),
  startSession: (data: unknown) => request('/face/sessions', { method: 'POST', body: JSON.stringify(data) }),
  submitAttempt: (sessionId: string, imageBase64: string) =>
    request(`/face/sessions/${sessionId}/attempts`, { method: 'POST', body: JSON.stringify({ imageBase64 }) }),
  finishSession: (sessionId: string, reason?: string) =>
    request(`/face/sessions/${sessionId}/finish`, { method: 'POST', body: JSON.stringify({ reason }) }),
  sessionAttempts: (sessionId: string) => request(`/face/sessions/${sessionId}/attempts`),
  recognitionHistory: (params?: object) => request(`/face/recognition-history${buildQuery(params)}`),
  devices: (params?: object) => request(`/face/devices${buildQuery(params)}`),
  registerDevice: (data: unknown) => request('/face/devices', { method: 'POST', body: JSON.stringify(data) }),
  revokeDevice: (id: string) => request(`/face/devices/${id}/revoke`, { method: 'POST' }),
  auditLog: (params?: object) => request(`/face/audit-log${buildQuery(params)}`),
  analytics: () => request('/face/analytics'),
};
export const camerasApi = {
  ...crud('/cameras'),
  discover: (data: unknown) => request('/cameras/discover', { method: 'POST', body: JSON.stringify(data ?? {}) }),
  enable: (id: string) => request(`/cameras/${id}/enable`, { method: 'PATCH' }),
  disable: (id: string) => request(`/cameras/${id}/disable`, { method: 'PATCH' }),
  testConnection: (data: unknown) => request('/cameras/test-connection', { method: 'POST', body: JSON.stringify(data) }),
  health: (id: string) => request(`/cameras/${id}/health`),
  events: (id: string, params?: object) => request(`/cameras/${id}/events${buildQuery(params)}`),
  config: (id: string, data: unknown) => request(`/cameras/${id}/config`, { method: 'PATCH', body: JSON.stringify(data) }),
  workerStatus: (id: string) => request(`/cameras/${id}/worker-status`),
  startWorker: (id: string) => request(`/cameras/${id}/start-worker`, { method: 'POST' }),
  stopWorker: (id: string) => request(`/cameras/${id}/stop-worker`, { method: 'POST' }),
  restartWorker: (id: string) => request(`/cameras/${id}/restart-worker`, { method: 'POST' }),
};
export const auditApi = {
  list: (params?: object) => request(`/audit${buildQuery(params)}`),
  get: (id: string) => request(`/audit/${id}`),
  entityHistory: (entityType: string, entityId: string) =>
    request(`/audit/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(entityId)}`),
};
export const searchApi = {
  search: (q: string, types?: string[], limit?: number) =>
    request(`/search${buildQuery({ q, types: types?.join(','), limit })}`),
};
export const documentsApi = {
  list: (params?: object) => request(`/documents${buildQuery(params)}`),
  get: (id: string) => request(`/documents/${id}`),
  create: (data: unknown) => request('/documents', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/documents/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/documents/${id}`, { method: 'DELETE' }),
  uploadVersion: (id: string, data: unknown) => request(`/documents/${id}/versions`, { method: 'POST', body: JSON.stringify(data) }),
};
export const dataQualityApi = {
  summary: () => request('/data-quality/summary'),
  issues: (params?: object) => request(`/data-quality/issues${buildQuery(params)}`),
  run: () => request('/data-quality/run', { method: 'POST' }),
  resolve: (id: string, note?: string) =>
    request(`/data-quality/issues/${id}/resolve`, { method: 'POST', body: JSON.stringify({ note }) }),
};
export const resourcesApi = {
  list: (params?: object) => request(`/resources${buildQuery(params)}`),
  bookings: (params?: object) => request(`/bookings${buildQuery(params)}`),
  createBooking: (data: unknown) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
};
export const featureFlagsApi = {
  list: () => request('/feature-flags'),
  create: (data: { key: string; name: string; description?: string; type?: string }) =>
    request('/feature-flags', { method: 'POST', body: JSON.stringify(data) }),
  update: (key: string, data: unknown) => request(`/feature-flags/${key}`, { method: 'PUT', body: JSON.stringify(data) }),
};
export const securityApi = {
  summary: () => request('/security/summary'),
  alerts: (params?: object) => request(`/security/alerts${buildQuery(params)}`),
  resolve: (id: string, note?: string) =>
    request(`/security/alerts/${id}/resolve`, { method: 'POST', body: JSON.stringify({ note }) }),
};

export const apiKeysApi = {
  list: (params?: object) => request(`/api-keys${buildQuery(params)}`),
  create: (data: unknown) => request('/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  rotate: (id: string, data?: unknown) =>
    request(`/api-keys/${id}/rotate`, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  remove: (id: string) => request(`/api-keys/${id}`, { method: 'DELETE' }),
  revoke: (id: string) => request(`/api-keys/${id}`, { method: 'DELETE' }),
  scopes: () => request('/api-keys/scopes'),
  usage: (params?: object) => request(`/api-keys/usage${buildQuery(params)}`),
  usageStats: (params?: object) => request(`/api-keys/usage${buildQuery(params)}`),
};

export const automationApi = {
  listRules: (params?: object) => request(`/automation/rules${buildQuery(params)}`),
  getRule: (id: string) => request(`/automation/rules/${id}`),
  createRule: (data: unknown) => request('/automation/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: string, data: unknown) => request(`/automation/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRule: (id: string) => request(`/automation/rules/${id}`, { method: 'DELETE' }),
  toggleRule: (id: string) => request(`/automation/rules/${id}/toggle`, { method: 'PATCH' }),
  evaluateRule: (id: string) => request(`/automation/rules/${id}/evaluate`, { method: 'POST' }),
  evaluateAll: () => request('/automation/evaluate-all', { method: 'POST' }),
  executions: (params?: object) => request(`/automation/executions${buildQuery(params)}`),
  ruleStats: (id: string) => request(`/automation/rules/${id}/stats`),
  stats: () => request('/automation/stats'),
};

export const branchesApi = {
  ...crud('/branches'),
  activate: (id: string) => request(`/branches/${id}/activate`, { method: 'PATCH' }),
  deactivate: (id: string) => request(`/branches/${id}/deactivate`, { method: 'PATCH' }),
  assignManager: (id: string, managerId: string) =>
    request(`/branches/${id}/manager`, { method: 'PATCH', body: JSON.stringify({ managerId }) }),
};

export const chatApi = {
  listConversations: (params?: object) => request(`/chat/conversations${buildQuery(params)}`),
  createConversation: (data: unknown) => request('/chat/conversations', { method: 'POST', body: JSON.stringify(data) }),
  getMessages: (conversationId: string, params?: object) =>
    request(`/chat/conversations/${conversationId}/messages${buildQuery(params)}`),
  sendMessage: (data: unknown) => request('/chat/messages', { method: 'POST', body: JSON.stringify(data) }),
  markRead: (conversationId: string) => request(`/chat/conversations/${conversationId}/read`, { method: 'POST' }),
};

export const communicationApi = {
  list: (params?: object) => request(`/communication/history${buildQuery(params)}`),
  getTimeline: (entityType: string, entityId: string) => request(`/communication/timeline${buildQuery({ entityType, entityId })}`),
  getHistory: (params?: object) => request(`/communication/history${buildQuery(params)}`),
  getStats: () => request('/communication/stats'),
  messages: (studentId: string) => request<any>(`/communication/messages/student/${studentId}`),
  sendMessage: (data: object) => request<any>('/communication/messages', { method: 'POST', body: JSON.stringify(data) }),
  announcements: () => request<any>('/communication/announcements'),
  createAnnouncement: (data: object) => request<any>('/communication/announcements', { method: 'POST', body: JSON.stringify(data) }),
};

export const dataGovernanceApi = {
  exportLogs: (params?: object) => request<Paginated<ExportLog>>(`/data-governance/export-log${buildQuery(params)}`),
  getRetentionPolicies: () => request<DataGovernancePolicy[]>('/data-governance/retention-policies'),
  // Backend exposes this as PUT /data-governance/retention-policies (upsert).
  upsertRetentionPolicy: (data: unknown) => request<DataGovernancePolicy>('/data-governance/retention-policies', { method: 'PUT', body: JSON.stringify(data) }),
  getDataAccessAudit: (params?: object) => request<Paginated<DataAccessLog>>(`/data-governance/access-audit${buildQuery(params)}`),
  getExportStats: () => request<ExportStats>('/data-governance/export-stats'),
  runRetentionCheck: () => request<RetentionCheckResult>('/data-governance/retention-check', { method: 'POST' }),
};

export const invoicesApi = {
  list: (params?: object) => request(`/invoices${buildQuery(params)}`),
  get: (id: string) => request(`/invoices/${id}`),
  create: (data: unknown, options?: RequestOptions) =>
    request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  update: (id: string, data: unknown, options?: RequestOptions) =>
    request(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data), ...options }),
  remove: (id: string, options?: RequestOptions) =>
    request(`/invoices/${id}`, { method: 'DELETE', ...options }),
  issue: (id: string, options?: RequestOptions) =>
    request(`/invoices/${id}/issue`, { method: 'POST', ...options }),
  cancel: (id: string, reason?: string, options?: RequestOptions) =>
    request(`/invoices/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }), ...options }),
  recordPayment: (id: string, data: unknown, options?: RequestOptions) =>
    request(`/invoices/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ ...(data as Record<string, unknown>), invoiceId: id }),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  requestRefund: (data: { paymentId: string; amount: number; reason?: string }, options?: RequestOptions) =>
    request('/invoices/refunds', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  processRefund: (id: string, gatewayExternalId?: string, options?: RequestOptions) =>
    request(`/invoices/refunds/${id}/process`, {
      method: 'POST',
      body: JSON.stringify(gatewayExternalId ? { gatewayExternalId } : {}),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  rejectRefund: (id: string, reason?: string, options?: RequestOptions) =>
    request(`/invoices/refunds/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }), ...options }),
  getPaymentLinks: (id: string) => request<any>(`/invoices/${id}/payment-links`),
  proratePreview: (data: unknown) =>
    request<any>('/invoices/prorate-preview', { method: 'POST', body: JSON.stringify(data) }),
  createProrated: (data: unknown, options?: RequestOptions) =>
    request<any>('/invoices/prorate', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: options?.idempotencyKey || generateIdempotencyKey(),
      ...options,
    }),
  debtorStatus: (studentId: string, graceDays?: number) =>
    request<any>(`/invoices/students/${studentId}/debtor-status${buildQuery({ graceDays })}`),
};

export async function downloadFile(path: string, options: RequestOptions = {}): Promise<void> {
  const method = options.method?.toUpperCase() || 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    await ensureCsrfCookie();
    const token = readXsrfCookie();
    if (token) headers['x-xsrf-token'] = token;
  }
  
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body,
  });
  
  if (!res.ok) {
    const errorBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errorBody?.message || res.statusText, errorBody);
  }
  
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  
  // Try to read filename from Content-Disposition header
  const contentDisposition = res.headers.get('Content-Disposition');
  let filename = options.defaultFilename || 'download';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1];
    }
  }
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
export const reportsApi = {
  designs: () => request('/reports/designs'),
  getDesign: (type: string) => request(`/reports/designs/${type}`),
  run: (params: { type: string; dateFrom?: string; dateTo?: string; status?: string; columns?: string[]; page?: number; pageSize?: number }) =>
    request('/reports/run', { method: 'POST', body: JSON.stringify(params) }),
  saveDefinition: (data: unknown) =>
    request('/reports/definitions', { method: 'POST', body: JSON.stringify(data) }),
  definitions: () => request('/reports/definitions'),
  export: (
    type: string,
    format: 'csv' | 'xlsx' | 'pdf',
    params?: { dateFrom?: string; dateTo?: string; status?: string; columns?: string[] },
  ) =>
    downloadFile('/reports/export', {
      method: 'POST',
      body: JSON.stringify({
        type,
        format,
        params: {
          type,
          ...params,
        },
        ...params,
      }),
      defaultFilename: `report_${type}.${format}`,
    }),
};

export const observabilityApi = {
  health: () => request('/observability/health'),
  metrics: (params?: object) => request(`/observability/metrics${buildQuery(params)}`),
  queues: () => request('/observability/queues'),
  integrations: () => request('/observability/integrations'),
  apiMetrics: (params?: object) => request(`/observability/api-metrics${buildQuery(params)}`),
  database: () => request('/observability/database'),
};

export const parentPortalApi = {
  children: () => request('/parent-portal/children'),
  attendance: (studentId: string, params?: object) =>
    request(`/parent-portal/children/${studentId}/attendance${buildQuery(params)}`),
  attendanceSummary: (studentId: string) =>
    request(`/parent-portal/children/${studentId}/attendance/summary`),
  grades: (studentId: string, params?: object) =>
    request(`/parent-portal/children/${studentId}/grades${buildQuery(params)}`),
  invoices: (studentId: string, params?: object) =>
    request(`/parent-portal/children/${studentId}/invoices${buildQuery(params)}`),
  schedule: (studentId: string) =>
    request<Array<{ id: string; dayOfWeek: string; startTime: string; endTime: string; room?: string | null; group: { id: string; name: string } }>>(`/parent-portal/children/${studentId}/schedule`),
  reportAbsence: (studentId: string, data: { date: string; reason: string }) =>
    request<{ success: boolean; message: string; attendance: unknown }>(
      `/parent-portal/children/${studentId}/absence`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
};

export const payrollApi = {
  listRuns: (params?: object) => request(`/payroll/runs${buildQuery(params)}`),
  getRun: (id: string) => request(`/payroll/runs/${id}`),
  createRun: (data: unknown) => request('/payroll/runs', { method: 'POST', body: JSON.stringify(data) }),
  calculate: (data: unknown) => request('/payroll/runs/calculate', { method: 'POST', body: JSON.stringify(data) }),
  processRun: (id: string) => request(`/payroll/runs/${id}/process`, { method: 'POST' }),
  review: (id: string) => request(`/payroll/runs/${id}/review`, { method: 'POST' }),
  approve: (id: string) => request(`/payroll/runs/${id}/approve`, { method: 'POST' }),
  approveRun: (id: string) => request(`/payroll/runs/${id}/approve`, { method: 'POST' }),
  pay: (id: string) => request(`/payroll/runs/${id}/pay`, { method: 'POST' }),
  cancel: (id: string, reason: string) => request(`/payroll/runs/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  periodSummary: (params?: object) => request(`/payroll/period-summary${buildQuery(params)}`),
  revenueShare: (params: any) =>
    request<any>(`/payroll/runs/revenue-share${buildQuery(params)}`),
  getRevenueShare: (params: any) =>
    request<any>(`/payroll/runs/revenue-share${buildQuery(params)}`),
  createRevenueShare: (data: unknown) =>
    request<any>('/payroll/runs/revenue-share', { method: 'POST', body: JSON.stringify(data) }),
  createRevenueShareRun: (data: unknown) =>
    request<any>('/payroll/runs/revenue-share', { method: 'POST', body: JSON.stringify(data) }),
  getSmartKpi: (params: { teacherId: string; year?: number; month?: number }) =>
    request<any>(`/payroll/runs/smart-kpi${buildQuery(params)}`),
  createSmartKpiRun: (data: { teacherId: string; year: number; month: number; customBonus?: number; notes?: string }) =>
    request<any>('/payroll/runs/smart-kpi', { method: 'POST', body: JSON.stringify(data) }),
};

export const performanceApi = {
  audit: (params?: object) => request(`/performance/audit${buildQuery(params)}`),
  slowEndpoints: (params?: object) => request(`/performance/slow-endpoints${buildQuery(params)}`),
  cacheStats: () => request('/performance/cache-stats'),
};

export const systemHealthApi = {
  summary: () => request('/system-health/summary'),
  components: () => request('/system-health/components'),
};

export const gamificationApi = {
  leaderboard: (params?: object) => request(`/gamification/leaderboard${buildQuery(params)}`),
  me: () => request('/gamification/me'),
  myEvents: (params?: object) => request(`/gamification/me/events${buildQuery(params)}`),
  stats: () => request('/gamification/stats'),
};

export const importExportApi = {
  listImports: (params?: object) => request(`/imports${buildQuery(params)}`),
  createImport: (data: unknown) => request('/imports', { method: 'POST', body: JSON.stringify(data) }),
  listExports: (params?: object) => request(`/exports${buildQuery(params)}`),
  template: (entityType: string) => request(`/template${buildQuery({ entityType })}`),
  exportData: (params?: object) => request(`/export${buildQuery(params)}`),
};

export const earlyWarningApi = {
  summary: () => request('/early-warning/summary'),
  list: (params?: object) => request(`/early-warning${buildQuery(params)}`),
  resolve: (id: string, note?: string) =>
    request(`/early-warning/${id}/resolve`, { method: 'POST', body: JSON.stringify({ note }) }),
  scan: () => request('/early-warning/scan', { method: 'POST' }),
};

export const academicRiskApi = {
  summary: () => request('/academic-risk/summary'),
  list: (params?: object) => request(`/academic-risk${buildQuery(params)}`),
};

export const forecastingApi = {
  summary: () => request('/forecasting/summary'),
  list: (params?: object) => request(`/forecasting${buildQuery(params)}`),
};

export const relationshipsApi = {
  graph: (entityType: string, entityId: string, depth?: number) =>
    request(`/relationships/graph${buildQuery({ entityType, entityId, depth })}`),
};

/* ============================================================================
 * EDUCATION OPERATING SYSTEM CORE APIS (P0)
 * ========================================================================== */

export const subjectsApi = {
  list: (params?: object) => request<any>(`/subjects${buildQuery(params)}`),
  get: (id: string) => request<any>(`/subjects/${id}`),
  create: (data: object) => request<any>('/subjects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) => request<any>(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/subjects/${id}`, { method: 'DELETE' }),
  /** Re-activate a soft-deleted subject (same PATCH endpoint, isActive: true). */
  restore: (id: string) => request<any>(`/subjects/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: true }) }),
};

export const curriculumApi = {
  list: (params?: object) => request<any>(`/curriculum${buildQuery(params)}`),
  get: (id: string) => request<any>(`/curriculum/${id}`),
  create: (data: object) => request<any>('/curriculum', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: object) => request<any>(`/curriculum/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addModule: (id: string, data: object) => request<any>(`/curriculum/${id}/modules`, { method: 'POST', body: JSON.stringify(data) }),
  addTopic: (id: string, moduleId: string, data: object) => request<any>(`/curriculum/${id}/modules/${moduleId}/topics`, { method: 'POST', body: JSON.stringify(data) }),
  addObjective: (id: string, topicId: string, data: object) => request<any>(`/curriculum/${id}/topics/${topicId}/objectives`, { method: 'POST', body: JSON.stringify(data) }),
};

export const lessonsApi = {
  list: (params?: { groupId?: string; teacherId?: string; date?: string; from?: string; to?: string; limit?: number; page?: number }) =>
    request<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(`/lessons${buildQuery(params)}`),
  get: (id: string) => request<any>(`/lessons/${id}`),
  updateStatus: (id: string, status: 'PLANNED' | 'CONDUCTED' | 'CANCELLED', cancellationReason?: string) =>
    request<any>(`/lessons/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, cancellationReason }),
    }),
  updateContent: (id: string, data: { notes?: string; room?: string }) =>
    request<any>(`/lessons/${id}/content`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  linkMaterial: (id: string, materialId: string) =>
    request<any>(`/lessons/${id}/materials`, {
      method: 'POST',
      body: JSON.stringify({ materialId }),
    }),
  unlinkMaterial: (id: string, materialId: string) =>
    request<any>(`/lessons/${id}/materials/${materialId}`, { method: 'DELETE' }),
};

export const assignmentsApi = {
  list: (params?: object) => request<any>(`/assignments${buildQuery(params)}`),
  get: (id: string) => request<any>(`/assignments/${id}`),
  create: (data: object) => request<any>('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  submit: (id: string, data: object) => request<any>(`/assignments/${id}/submit`, { method: 'POST', body: JSON.stringify(data) }),
  grade: (id: string, data: object) => request<any>(`/assignments/submissions/${id}/grade`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const assessmentApi = {
  questions: (params?: object) => request<any>(`/assessment/questions${buildQuery(params)}`),
  createQuestion: (data: object) => request<any>('/assessment/questions', { method: 'POST', body: JSON.stringify(data) }),
  quizzes: (params?: object) => request<any>(`/assessment/quizzes${buildQuery(params)}`),
  getQuiz: (id: string) => request<any>(`/assessment/quizzes/${id}`),
  createQuiz: (data: object) => request<any>('/assessment/quizzes', { method: 'POST', body: JSON.stringify(data) }),
  startAttempt: (quizId: string) => request<any>(`/assessment/quizzes/${quizId}/start`, { method: 'POST' }),
  submitAttempt: (attemptId: string, data: object) => request<any>(`/assessment/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify(data) }),
};

export const progressApi = {
  student360: (studentId: string) => request<any>(`/progress/student-360/${studentId}`),
};

export const calendarApi = {
  list: (params?: object) => request<any>(`/calendar/events${buildQuery(params)}`),
  create: (data: object) => request<any>('/calendar/events', { method: 'POST', body: JSON.stringify(data) }),
};

export default request;


