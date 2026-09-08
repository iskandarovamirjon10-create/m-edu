// M-EDU API client — typed fetch wrapper with auth and error handling.
// Security: JWT token is transported exclusively via HttpOnly cookie
// (access_token). This file NEVER stores or sends tokens in headers
// or browser storage. Credentials are included so cookies travel.

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
    localStorage.setItem('medu_user', JSON.stringify(user));
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
export type RequestOptions = RequestInit & { timeout?: number };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // NO Authorization: Bearer header. The browser sends the HttpOnly cookie (access_token)
  // automatically when credentials are included. No token is read from storage.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  const controller = new AbortController();
  const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  let res: Response;
  try {
    // credentials: 'include' is REQUIRED for HttpOnly cookie transport (same-origin and cross-origin with CORS credentials: true).
    res = await fetch(`/api${path}`, {
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
    userStore.clear();
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const contentType = res.headers.get('content-type') || '';
  let body: unknown = null;
  if (contentType.includes('application/json')) {
    body = await res.json().catch(() => null);
  } else {
    body = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const serverMessage =
      (body as { message?: string } | null)?.message ||
      (Array.isArray(body) ? (body as { message?: string }[]).map((b) => b.message).join('; ') : null) ||
      null;
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
  register: (data: {
    email: string; password: string; firstName: string; lastName: string; phone?: string; organizationName: string;
  }) =>
    request<{ user: unknown }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request<unknown>('/auth/me'),
  logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  refresh: () => request<{ user: unknown }>('/auth/refresh', { method: 'POST' }),
  exchangeCode: (code: string) =>
    request<{ accessToken: string }>('/auth/oauth/exchange', { method: 'POST', body: JSON.stringify({ code }) }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
};

function crud<T>(base: string) {
  return {
    list: (params?: object) => request<T>(`${base}${buildQuery(params)}`),
    get: (id: string) => request<T>(`${base}/${id}`),
    create: (data: unknown) => request<T>(`${base}`, { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) => request<T>(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<unknown>(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const studentsApi = {
  ...crud('/students'),
  assignGroup: (studentId: string, groupId: string) =>
    request(`/students/${studentId}/groups/${groupId}`, { method: 'POST' }),
  removeGroup: (studentId: string, groupId: string) =>
    request(`/students/${studentId}/groups/${groupId}`, { method: 'DELETE' }),
};
export const teachersApi = crud('/teachers');
export const coursesApi = crud('/courses');
export const groupsApi = { ...crud('/groups') };
export const scheduleApi = crud('/schedule');
export const paymentsApi = crud('/payments');
export const expensesApi = {
  ...crud('/expenses'),
  summary: (params?: object) => request(`/expenses/summary${buildQuery(params)}`),
};
export const leadsApi = {
  ...crud('/leads'),
  updateStage: (id: string, stage: string) =>
    request(`/leads/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
  convert: (id: string, data: unknown) => request(`/leads/${id}/convert`, { method: 'POST', body: JSON.stringify(data) }),
  addActivity: (id: string, data: unknown) => request(`/leads/${id}/activities`, { method: 'POST', body: JSON.stringify(data) }),
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
export const gradesApi = crud('/grades');
export const homeworkApi = crud('/homework');
export const attendanceApi = {
  create: (data: unknown) => request('/attendance', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: object) => request(`/attendance${buildQuery(params)}`),
  analytics: (params?: object) => request(`/attendance/analytics${buildQuery(params)}`),
};
export const dashboardApi = { stats: () => request('/dashboard/stats') };
export const analyticsApi = { overview: () => request('/analytics/overview') };
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
  listEmployees: (params?: object) => request(`/hr/employees${buildQuery(params)}`),
  getEmployee: (id: string) => request(`/hr/employees/${id}`),
  createEmployee: (data: unknown) => request('/hr/employees', { method: 'POST', body: JSON.stringify(data) }),
  updateEmployee: (id: string, data: unknown) => request(`/hr/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  terminateEmployee: (id: string, data: unknown) => request(`/hr/employees/${id}/terminate`, { method: 'POST', body: JSON.stringify(data) }),
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
export const examsApi = {
  list: (params?: object) => request(`/exams${buildQuery(params)}`),
  get: (id: string) => request(`/exams/${id}`),
  create: (data: unknown) => request('/exams', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: unknown) => request(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id: string) => request(`/exams/${id}`, { method: 'DELETE' }),
  publish: (id: string) => request(`/exams/${id}/publish`, { method: 'POST' }),
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
export const workflowApi = {
  listRules: (params?: object) => request(`/workflow/rules${buildQuery(params)}`),
  getRule: (id: string) => request(`/workflow/rules/${id}`),
  listInstances: (params?: object) => request(`/workflow/instances${buildQuery(params)}`),
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

export default request;
