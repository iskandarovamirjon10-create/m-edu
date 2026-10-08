/**
 * M-EDU — Centralized React Query Key Registry (SF-1)
 * ====================================================
 *
 * SINGLE SOURCE OF TRUTH for every cache key used with `useQuery` /
 * `useMutation` invalidation.
 *
 * Why this exists
 * ---------------
 * Cache keys used to be hardcoded string arrays scattered across dozens of
 * components (`['students']`, `['dashboard']`, `['teachers-selector']`, …).
 * That caused "ghost data": a mutation invalidated `['teachers']` while another
 * screen had cached `['teachers-selector']`, so the dependent view never
 * refreshed. Prefix matching made this worse because `['teachers']` does NOT
 * prefix-match `['teachers-selector']`.
 *
 * Rules of the road (enforced by review + the patterns below)
 * ----------------------------------------------------------
 *  1. NEVER write a raw array as a `queryKey` in a component/page.
 *     Import `queryKeys` from `@/lib/query-keys.factory` instead.
 *  2. A namespace's `.all()` returns the ROOT prefix. Invalidating it also
 *     invalidates every child key (`list`, `detail`, …) — but NOT sibling
 *     namespaces whose first element differs (e.g. `students-selector`).
 *  3. Selector keys are their own namespace (`students.selector()` →
 *     `['students-selector']`) precisely because they do not live under
 *     `['students']`.
 *  4. Detail keys root at the singular resource (`student.detail(id)` →
 *     `['student', id]`) so `.details()` → `['student']` invalidates all of
 *     them at once.
 *
 * Adding a key: extend the matching namespace, never inline an array.
 */

/** A React Query key. Tuples are `readonly` so they can be used directly. */
export type QueryKey = readonly unknown[];

/** Params bag accepted by list endpoints. Kept opaque on purpose. */
export type ListParams = Record<string, unknown> | object | undefined;

export const queryKeys = {
  /* ── Students ─────────────────────────────────────────────────────────── */
  students: {
    /** Root prefix `['students']` — invalidates list + every param variant. */
    all: (): QueryKey => ['students'],
    list: (params?: ListParams): QueryKey => ['students', params],
    /** Student picker/selector, `['students-selector']`. */
    selectors: (): QueryKey => ['students-selector'],
    selector: (params?: ListParams): QueryKey => ['students-selector', params],
    /** Singular root `['student']` — invalidates all detail entries. */
    details: (): QueryKey => ['student'],
    detail: (id: string): QueryKey => ['student', id],
    /** Parents list for student detail screen. */
    parents: (id: string): QueryKey => ['student-parents', id],
    /** Enrolled-faces picker used by the face-enrollment screen. */
    faces: (): QueryKey => ['students-face'],
  },

  /* ── Teachers ─────────────────────────────────────────────────────────── */
  teachers: {
    all: (): QueryKey => ['teachers'],
    list: (params?: ListParams): QueryKey => ['teachers', params],
    selectors: (): QueryKey => ['teachers-selector'],
    selector: (params?: ListParams): QueryKey => ['teachers-selector', params],
  },

  /* ── Groups ───────────────────────────────────────────────────────────── */
  groups: {
    all: (): QueryKey => ['groups'],
    /** Paginated list uses discrete page/search segments for readable devtools. */
    paged: (page: number, search?: string): QueryKey => ['groups', page, search],
    list: (params?: ListParams): QueryKey => ['groups', params],
    selectors: (): QueryKey => ['groups-selector'],
    selector: (params?: ListParams): QueryKey => ['groups-selector', params],
    details: (): QueryKey => ['group'],
    detail: (id: string): QueryKey => ['group', id],
    homework: (): QueryKey => ['groups-homework'],
  },

  /* ── Courses ──────────────────────────────────────────────────────────── */
  courses: {
    all: (): QueryKey => ['courses'],
    paged: (page: number, search?: string): QueryKey => ['courses', page, search],
    list: (params?: ListParams): QueryKey => ['courses', params],
    selectors: (): QueryKey => ['courses-selector'],
    selector: (params?: ListParams): QueryKey => ['courses-selector', params],
  },

  /* ── Dashboard ────────────────────────────────────────────────────────── */
  dashboard: {
    all: (): QueryKey => ['dashboard'],
    stats: (): QueryKey => ['dashboard', 'stats'],
    revenue: (period: 'weekly' | 'monthly' | 'yearly'): QueryKey => [
      'dashboard',
      'revenue',
      period,
    ],
  },

  /* ── Finance ──────────────────────────────────────────────────────────── */
  payments: {
    all: (): QueryKey => ['payments'],
    list: (params?: ListParams): QueryKey => ['payments', params],
    students: (): QueryKey => ['students-payments'],
  },
  expenses: {
    all: (): QueryKey => ['expenses'],
    list: (params?: ListParams): QueryKey => ['expenses', params],
  },
  payroll: {
    summary: (year: number | string, month: number | string): QueryKey => ['payroll-summary', year, month],
    runs: (year: number | string, month: number | string): QueryKey => ['payroll-runs', year, month],
    teachers: (): QueryKey => ['teachers-for-payroll'],
  },
  invoices: {
    all: (): QueryKey => ['invoices'],
    list: (params?: ListParams): QueryKey => ['invoices', params],
  },

  /* ── Academics ────────────────────────────────────────────────────────── */
  attendance: {
    all: (): QueryKey => ['attendance'],
    list: (params?: ListParams): QueryKey => ['attendance', params],
    analytics: (groupId?: string, date?: string): QueryKey => ['attendance-analytics', groupId, date],
    analyticsAll: (): QueryKey => ['attendance-analytics'],
  },
  grades: {
    all: (): QueryKey => ['grades'],
    list: (params?: ListParams): QueryKey => ['grades', params],
  },
  homework: {
    all: (): QueryKey => ['homework'],
    list: (params?: ListParams): QueryKey => ['homework', params],
  },
  schedule: {
    all: (): QueryKey => ['schedule'],
    list: (params?: ListParams): QueryKey => ['schedule', params],
  },
  exams: {
    all: (): QueryKey => ['exams'],
    list: (params?: ListParams): QueryKey => ['exams', params],
  },

  /* ── CRM / Leads ──────────────────────────────────────────────────────── */
  leads: {
    all: (): QueryKey => ['leads'],
    list: (params?: ListParams): QueryKey => ['leads', params],
  },
  followUps: {
    rules: (): QueryKey => ['follow-up-rules'],
    list: (): QueryKey => ['follow-ups'],
    stats: (): QueryKey => ['follow-up-stats'],
  },
  crm: {
    funnel: (): QueryKey => ['crm-funnel'],
    sources: (): QueryKey => ['crm-sources'],
    velocity: (): QueryKey => ['crm-velocity'],
    lostReasons: (): QueryKey => ['crm-lost-reasons'],
    aging: (): QueryKey => ['crm-aging'],
    moderators: (): QueryKey => ['crm-moderators'],
  },

  /* ── Communication ────────────────────────────────────────────────────── */
  notifications: {
    all: (): QueryKey => ['notifications'],
    list: (params?: ListParams): QueryKey => ['notifications', params],
    preferences: (): QueryKey => ['notification-preferences'],
  },
  chat: {
    conversations: (): QueryKey => ['chat', 'conversations'],
    messages: (conversationId: string | null | undefined): QueryKey => ['chat', 'messages', conversationId],
  },
  communication: {
    timeline: (entityType: string, entityId: string): QueryKey => ['communication-timeline', entityType, entityId],
    history: (page: number, channel?: string, status?: string): QueryKey => ['communication-history', page, channel, status],
    stats: (): QueryKey => ['communication-stats'],
  },

  /* ── Admin / Org ──────────────────────────────────────────────────────── */
  users: {
    all: (): QueryKey => ['users'],
    list: (params?: ListParams): QueryKey => ['users', params],
    paged: (page: number, search?: string): QueryKey => ['users', page, search],
    listForManager: (): QueryKey => ['users-list-for-manager'],
  },
  branches: {
    all: (): QueryKey => ['branches'],
    list: (params?: ListParams): QueryKey => ['branches', params],
  },
  featureFlags: {
    all: (): QueryKey => ['feature-flags'],
    list: (params?: ListParams): QueryKey => ['feature-flags', params],
  },
  security: {
    summary: (): QueryKey => ['security-summary'],
    events: (params?: ListParams): QueryKey => ['security-events', params],
    alerts: (params?: ListParams): QueryKey => ['security-alerts', params],
  },
  audit: {
    all: (): QueryKey => ['audit'],
    list: (params?: ListParams): QueryKey => ['audit', params],
    timeline: (params?: ListParams): QueryKey => ['audit-timeline', params],
  },
  dataGovernance: {
    policies: (): QueryKey => ['dg-policies'],
    exportLog: (...params: unknown[]): QueryKey => ['dg-export-log', ...params],
    accessAudit: (...params: unknown[]): QueryKey => ['dg-access-audit', ...params],
    exportStats: (): QueryKey => ['dg-export-stats'],
  },

  /* ── Operations ───────────────────────────────────────────────────────── */
  face: {
    all: (): QueryKey => ['face'],
    engine: (): QueryKey => ['face-engine'],
    history: (params?: ListParams): QueryKey => ['face-history', params],
    enrollments: (params?: ListParams): QueryKey => ['face-enrollments', params],
    studentEnrollments: (id?: string): QueryKey => ['face-student-enrollments', id],
  },
  cameras: {
    all: (): QueryKey => ['cameras'],
    events: (cameraId: string | null | undefined): QueryKey => ['camera-events', cameraId],
    health: (cameraId: string | null | undefined): QueryKey => ['camera-health', cameraId],
    worker: (cameraId: string | null | undefined): QueryKey => ['camera-worker', cameraId],
    workersAll: (): QueryKey => ['camera-worker'],
  },
  automation: {
    rules: (): QueryKey => ['automation-rules'],
    executions: (): QueryKey => ['automation-executions'],
    stats: (): QueryKey => ['automation-stats'],
  },
  systemHealth: {
    summary: (): QueryKey => ['system-health-summary'],
    components: (): QueryKey => ['system-health-components'],
  },
  observability: {
    metrics: (params?: ListParams): QueryKey => ['observability-metrics', params],
  },
  apiKeys: {
    all: (): QueryKey => ['api-keys'],
    usage: (keyId?: string): QueryKey => ['api-keys-usage', keyId],
  },
  importExport: {
    jobs: (): QueryKey => ['import-jobs'],
  },
  whatChanged: {
    all: (): QueryKey => ['what-changed'],
  },
  executive: {
    summary: (): QueryKey => ['executive-summary'],
  },

  /* ── Intelligence / Analytics ─────────────────────────────────────────── */
  analytics: {
    finance: {
      whatIf: (...params: unknown[]): QueryKey => ['analytics', 'finance', 'what-if', ...params],
      forecast: (days: number): QueryKey => ['analytics', 'finance', 'forecast', days],
      reconciliation: (year: number, month: number): QueryKey => ['analytics', 'finance', 'reconciliation', year, month],
      cashFlow: (startDate: string, endDate: string): QueryKey => ['analytics', 'finance', 'cash-flow', startDate, endDate],
      anomalies: (startDate: string, endDate: string): QueryKey => ['analytics', 'finance', 'anomalies', startDate, endDate],
    },
  },
  earlyWarning: {
    all: (): QueryKey => ['early-warnings'],
    summary: (): QueryKey => ['early-warning-summary'],
  },
  academicRisk: {
    all: (): QueryKey => ['academic-risk'],
    summary: (): QueryKey => ['academic-risk-summary'],
  },
  teacherWorkload: {
    all: (): QueryKey => ['teacher-workload'],
    summary: (): QueryKey => ['teacher-workload-summary'],
  },
  forecasting: {
    summary: (): QueryKey => ['forecasting-summary'],
    series: (params?: ListParams): QueryKey => ['forecasting', params],
  },
  anomalies: {
    detectAll: (): QueryKey => ['anomalies-detect-all'],
  },

  /* ── Library / Inventory / Resources ──────────────────────────────────── */
  library: {
    all: (): QueryKey => ['library'],
    books: (params?: ListParams): QueryKey => ['library-books', params],
    loans: (params?: ListParams): QueryKey => ['library-loans', params],
  },
  inventory: {
    all: (): QueryKey => ['inventory'],
    list: (params?: ListParams): QueryKey => ['inventory', params],
  },
  resources: {
    all: (): QueryKey => ['resources'],
    list: (params?: ListParams): QueryKey => ['resources', params],
  },
  bookings: {
    all: (): QueryKey => ['bookings'],
    list: (params?: ListParams): QueryKey => ['bookings', params],
  },

  /* ── HR ───────────────────────────────────────────────────────────────── */
  hr: {
    employees: (): QueryKey => ['hr-employees'],
    leaveRequests: (): QueryKey => ['hr-leave-requests'],
  },

  /* ── Certificates ─────────────────────────────────────────────────────── */
  certificates: {
    all: (): QueryKey => ['certificates'],
    templates: (): QueryKey => ['certificate-templates'],
  },

  /* ── Portal / Misc ────────────────────────────────────────────────────── */
  parentPortal: {
    children: (): QueryKey => ['parent-portal-children'],
    attendance: (studentId: string | undefined): QueryKey => ['parent-portal-attendance', studentId],
    attendanceSummary: (studentId: string | undefined): QueryKey => ['parent-portal-attendance-summary', studentId],
  },
  documents: {
    all: (): QueryKey => ['documents'],
    list: (search: string, category: string): QueryKey => ['documents', search, category],
  },
  relationships: {
    graph: (...params: unknown[]): QueryKey => ['relationship-graph', ...params],
  },
  search: {
    universal: (query: string): QueryKey => ['universal-search', query],
  },
} as const;

/**
 * Escape hatch for one-off keys that legitimately do not belong to a namespace
 * (e.g. a feature-local wizard). Prefer adding a namespace above.
 *
 * @example queryKeys.custom('onboarding', orgId)
 */
export const customQueryKey = (...parts: unknown[]): QueryKey => parts;
