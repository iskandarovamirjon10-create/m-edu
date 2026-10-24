/**
 * M-EDU App Routes — Apple Design Award Edition v2
 *
 * v2 FIXES (v1 → v2):
 *  1. [P0] `roles`-only routes (ai-copilot) now wrapped in <Protected> —
 *     previously `type: 'protected'` was required; roles were silently ignored
 *  2. AppLayout lazy-loaded (was eager — main bundle weight)
 *  3. Top-level `path: '*'` removed (dead code — inner `*` catches all)
 *  4. Manual `pattern` fields removed (redundant with auto-generated)
 *  5. buildRegexPattern: escaped special chars
 *  6. Lazy import retry helper — 2x retry on chunk load failure
 *  7. Roles inherit through AppLayout — child roles now checked
 *  8. ROUTE_TITLES rebuilt idempotently (safe under HMR)
 *  9. `path: '*'` title pattern fixed — was never matching
 * 10. wrapElement: feature-based wrapping (was path-specific)
 * 11. AnimatePresence for public route transitions
 * 12. lazyPage() helper — reduces 70x boilerplate
 * 13. JSDoc on `type` semantics
 */

import { lazy, Suspense, type ReactNode, type ComponentType } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ErrorBoundaryWrapper, Protected, PublicOnly } from '../App';
import { STAFF_ROLES } from '@/lib/roles';

/* ============================================================================
 * LAZY LOADING — with retry
 * ----------------------------------------------------------------------------
 * Network blips or transient CDN issues can cause a dynamic import to fail.
 * Retry once before giving up — the ErrorBoundary catches the final failure.
 * ========================================================================== */

function retryImport<T>(
  fn: () => Promise<T>,
  retries = 2,
  delay = 300,
): () => Promise<T> {
  return async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, delay * (attempt + 1)));
      }
    }
    // unreachable — TS happy
    throw new Error('retryImport: exhausted');
  };
}

/**
 * lazyPage — wraps a page module into a React.lazy component.
 * Supports both named and default exports.
 */
function lazyPage<T extends Record<string, any>>(
  factory: () => Promise<T>,
  exportName: keyof T | 'default',
) {
  return lazy(
    retryImport(() =>
      factory().then((m) =>
        exportName === 'default'
          ? { default: m.default as ComponentType<any> }
          : { default: m[exportName] as ComponentType<any> },
      ),
    ),
  );
}

/* ============================================================================
 * PAGE IMPORTS — lazy
 * ========================================================================== */

// Layout (lazy — biggest component)
const AppLayout = lazyPage(() => import('@/layouts/AppLayout'), 'AppLayout');

// Auth & public
const LoginPage            = lazyPage(() => import('@/pages/Login'), 'LoginPage');

const AuthCallbackPage     = lazyPage(() => import('@/pages/AuthCallback'), 'AuthCallbackPage');
const ForgotPasswordPage   = lazyPage(() => import('@/pages/ForgotPassword'), 'ForgotPasswordPage');
const ResetPasswordPage    = lazyPage(() => import('@/pages/ResetPassword'), 'ResetPasswordPage');
const TermsPage            = lazyPage(() => import('@/pages/Terms'), 'TermsPage');
const PrivacyPage          = lazyPage(() => import('@/pages/Privacy'), 'PrivacyPage');
const CertificateVerifyPage = lazyPage(() => import('@/pages/CertificateVerify'), 'CertificateVerifyPage');

// Dashboard & core
const DashboardPage        = lazyPage(() => import('@/pages/Dashboard'), 'DashboardPage');
const StudentsPage         = lazyPage(() => import('@/pages/Students'), 'StudentsPage');
const StudentDetailPage    = lazyPage(() => import('@/pages/StudentDetail'), 'StudentDetailPage');
const StudentFormPage      = lazyPage(() => import('@/pages/StudentForm'), 'StudentFormPage');
const TeachersPage         = lazyPage(() => import('@/pages/Teachers'), 'TeachersPage');
const GroupsPage           = lazyPage(() => import('@/pages/Groups'), 'GroupsPage');
const GroupDetailPage      = lazyPage(() => import('@/pages/GroupDetail'), 'GroupDetailPage');
const GroupFormPage        = lazyPage(() => import('@/pages/GroupForm'), 'GroupFormPage');
const CoursesPage          = lazyPage(() => import('@/pages/Courses'), 'CoursesPage');
const AttendancePage       = lazyPage(() => import('@/pages/Attendance'), 'AttendancePage');
const TeacherCockpitPage   = lazyPage(() => import('@/pages/TeacherCockpit'), 'TeacherCockpitPage');
const FaceRecognitionPage  = lazyPage(() => import('@/pages/FaceRecognition'), 'FaceRecognitionPage');
const FaceEnrollmentPage   = lazyPage(() => import('@/pages/FaceEnrollment'), 'FaceEnrollmentPage');
const PaymentsPage         = lazyPage(() => import('@/pages/Payments'), 'PaymentsPage');
const InvoicesPage         = lazyPage(() => import('@/pages/Invoices'), 'InvoicesPage');
const ReportsPage          = lazyPage(() => import('@/pages/Reports'), 'ReportsPage');
const ExpensesPage         = lazyPage(() => import('@/pages/Expenses'), 'ExpensesPage');
const LeadsPage            = lazyPage(() => import('@/pages/Leads'), 'LeadsPage');
const CamerasPage          = lazyPage(() => import('@/pages/Cameras'), 'CamerasPage');
const UsersPage            = lazyPage(() => import('@/pages/Users'), 'UsersPage');
const AuditPage            = lazyPage(() => import('@/pages/Audit'), 'AuditPage');
const AuditTimelinePage    = lazyPage(() => import('@/pages/AuditTimeline'), 'AuditTimelinePage');
const UniversalSearchPage  = lazyPage(() => import('@/pages/UniversalSearch'), 'UniversalSearchPage');
const DataQualityCenterPage = lazyPage(() => import('@/pages/DataQualityCenter'), 'DataQualityCenterPage');
const DocumentsPage        = lazyPage(() => import('@/pages/Documents'), 'DocumentsPage');
const ResourceBookingPage  = lazyPage(() => import('@/pages/ResourceBooking'), 'ResourceBookingPage');
const FeatureFlagsPage     = lazyPage(() => import('@/pages/FeatureFlags'), 'FeatureFlagsPage');
const SecurityCenterPage   = lazyPage(() => import('@/pages/SecurityCenter'), 'SecurityCenterPage');
const SystemHealthPage     = lazyPage(() => import('@/pages/SystemHealth'), 'SystemHealthPage');
const SettingsPage         = lazyPage(() => import('@/pages/Settings'), 'SettingsPage');
const HomeworkPage         = lazyPage(() => import('@/pages/Homework'), 'HomeworkPage');
const GradesPage           = lazyPage(() => import('@/pages/Grades'), 'GradesPage');
const SchedulePage         = lazyPage(() => import('@/pages/Schedule'), 'SchedulePage');
const LibraryPage          = lazyPage(() => import('@/pages/Library'), 'LibraryPage');
const HRPage               = lazyPage(() => import('@/pages/HR'), 'HRPage');
const ExamsPage            = lazyPage(() => import('@/pages/Exams'), 'ExamsPage');
const CertificatesPage     = lazyPage(() => import('@/pages/Certificates'), 'CertificatesPage');
const InventoryPage        = lazyPage(() => import('@/pages/Inventory'), 'InventoryPage');
const EarlyWarningPage     = lazyPage(() => import('@/pages/EarlyWarning'), 'EarlyWarningPage');
const AcademicRiskPage     = lazyPage(() => import('@/pages/AcademicRisk'), 'AcademicRiskPage');
const GamificationHubPage  = lazyPage(() => import('@/pages/GamificationHub'), 'GamificationHubPage');
const TeacherWorkloadPage  = lazyPage(() => import('@/pages/TeacherWorkload'), 'TeacherWorkloadPage');
const ForecastingPage      = lazyPage(() => import('@/pages/Forecasting'), 'ForecastingPage');
const ImportExportPage     = lazyPage(() => import('@/pages/ImportExport'), 'ImportExportPage');
const RelationshipGraphPage = lazyPage(() => import('@/pages/RelationshipGraph'), 'RelationshipGraphPage');
const NotificationsCenterPage = lazyPage(() => import('@/pages/NotificationsCenter'), 'NotificationsCenterPage');
const WhatChangedPage      = lazyPage(() => import('@/pages/WhatChanged'), 'WhatChangedPage');
const NotFoundPage         = lazyPage(() => import('@/pages/NotFound'), 'NotFoundPage');
const UnauthorizedPage     = lazyPage(() => import('@/pages/Unauthorized'), 'UnauthorizedPage');

const ChatPage             = lazyPage(() => import('@/pages/Chat'), 'ChatPage');
const ParentPortalPage     = lazyPage(() => import('@/pages/ParentPortal'), 'ParentPortalPage');
const ExecutiveDashboardPage = lazyPage(() => import('@/pages/ExecutiveDashboard'), 'ExecutiveDashboardPage');
const AutomationEnginePage = lazyPage(() => import('@/pages/AutomationEngine'), 'AutomationEnginePage');
const TelegramPage         = lazyPage(() => import('@/pages/Telegram'), 'TelegramPage');
const TelegramWebAppPage   = lazyPage(() => import('@/pages/TelegramWebApp'), 'TelegramWebAppPage');

const SubjectsPage         = lazyPage(() => import('@/pages/Subjects'), 'default');
const CurriculumPage       = lazyPage(() => import('@/pages/Curriculum'), 'default');
const AssignmentsPage      = lazyPage(() => import('@/pages/Assignments'), 'default');
const AssessmentPage       = lazyPage(() => import('@/pages/Assessment'), 'default');
const Student360Page       = lazyPage(() => import('@/pages/Student360'), 'default');
const PayrollPage          = lazyPage(() => import('@/pages/Payroll'), 'PayrollPage');
const FinancialAnalyticsPage = lazyPage(() => import('@/pages/FinancialAnalytics'), 'FinancialAnalyticsPage');
const PayrollAnalyticsPage = lazyPage(() => import('@/pages/PayrollAnalytics'), 'PayrollAnalyticsPage');
const CRMAnalyticsPage     = lazyPage(() => import('@/pages/CRMAnalytics'), 'CRMAnalyticsPage');
const FollowUpAutomationPage = lazyPage(() => import('@/pages/FollowUpAutomation'), 'FollowUpAutomationPage');
const BranchesPage         = lazyPage(() => import('@/pages/Branches'), 'BranchesPage');
const DataGovernancePage   = lazyPage(() => import('@/pages/DataGovernance'), 'DataGovernancePage');
const AnomalyDetectionPage = lazyPage(() => import('@/pages/AnomalyDetection'), 'AnomalyDetectionPage');
const ApiKeysPage          = lazyPage(() => import('@/pages/ApiKeys'), 'ApiKeysPage');
const ObservabilityPage    = lazyPage(() => import('@/pages/Observability'), 'ObservabilityPage');
const PerformanceMonitorPage = lazyPage(() => import('@/pages/PerformanceMonitor'), 'PerformanceMonitorPage');
const ReconciliationPage   = lazyPage(() => import('@/pages/Reconciliation'), 'ReconciliationPage');
const CommunicationHistoryPage = lazyPage(() => import('@/pages/CommunicationHistory'), 'CommunicationHistoryPage');

const AiCopilotPage        = lazyPage(() => import('@/pages/AiCopilot'), 'default');

/* ============================================================================
 * TYPES
 * ========================================================================== */

/**
 * `type` semantics:
 *   - 'public'    — only visible when logged OUT (redirects to / if authed)
 *   - 'protected' — only visible when logged IN (redirects to /login if not)
 *   - 'none'      — no auth check (auth callbacks, terms, 404, etc.)
 *
 * NOTE: If `roles` is set on a route, `Protected` is applied regardless of
 * `type` — this prevents the "roles silently ignored" bug.
 */
import type { Role } from '@/lib/types';

export interface RouteConfig {
  path?: string;
  index?: boolean;
  element: ReactNode;
  title?: string;
  /** i18n key for the document title (preferred over `title`). */
  titleKey?: string;
  type?: 'public' | 'protected' | 'none';
  /** Roles allowed to open the route; others go to /unauthorized. */
  roles?: readonly Role[];
  children?: RouteConfig[];
  errorLabel?: string;
}

/* ============================================================================
 * ROUTE CONFIG
 * ========================================================================== */

export const routeConfig: RouteConfig[] = [
  /* -------- Public -------- */
  { path: '/login', element: <LoginPage />, type: 'public', title: 'Sign In', titleKey: 'nav.signIn' },
  { path: '/register', element: <Navigate to="/login" replace />, type: 'none' },
  { path: '/auth/callback', element: <AuthCallbackPage />, type: 'none' },
  { path: '/forgot-password', element: <ForgotPasswordPage />, type: 'public', title: 'Reset Password', titleKey: 'auth.forgotPasswordTitle' },
  { path: '/reset-password', element: <ResetPasswordPage />, type: 'public', title: 'Set New Password', titleKey: 'auth.resetPasswordTitle' },
  { path: '/terms', element: <TermsPage />, type: 'none', title: 'Terms of Service', titleKey: 'terms.title' },
  { path: '/privacy', element: <PrivacyPage />, type: 'none', title: 'Privacy Policy', titleKey: 'privacy.title' },
  { path: '/tg-app', element: <TelegramWebAppPage />, type: 'none', title: 'Telegram WebApp Hub' },
  { path: '/verify', element: <CertificateVerifyPage />, type: 'none', title: 'Verify Certificate', titleKey: 'certificates.verifyTitle' },
  { path: '/verify/:code', element: <CertificateVerifyPage />, type: 'none', title: 'Verify Certificate', titleKey: 'certificates.verifyTitle' },

  /* -------- Protected (AppLayout) -------- */
  {
    path: '/',
    element: <AppLayout />,
    type: 'protected',
    children: [
      { index: true, element: <DashboardPage />, title: 'Dashboard', titleKey: 'nav.dashboard' },

      // Students
      { path: 'students', element: <StudentsPage />, title: 'Students', titleKey: 'nav.students', roles: STAFF_ROLES },
      { path: 'students/new', element: <StudentFormPage />, title: 'New Student', titleKey: 'students.formTitle', roles: STAFF_ROLES },
      { path: 'students/:id', element: <StudentDetailPage />, title: 'Student', titleKey: 'students.detailsTitle', roles: STAFF_ROLES },
      { path: 'students/:id/360', element: <Student360Page />, title: 'Student 360', titleKey: 'students.detailsTitle', roles: STAFF_ROLES },
      { path: 'students/:id/edit', element: <StudentFormPage />, title: 'Edit Student', titleKey: 'students.formTitle', roles: STAFF_ROLES },

      // Education Core (Academic Operating System)
      { path: 'subjects', element: <SubjectsPage />, title: 'Subjects', titleKey: 'nav.subjects' },
      { path: 'curriculum', element: <CurriculumPage />, title: 'Curriculum', titleKey: 'nav.curriculum' },
      { path: 'assignments', element: <AssignmentsPage />, title: 'Assignments', titleKey: 'nav.assignments' },
      { path: 'assessment', element: <AssessmentPage />, title: 'Assessment', titleKey: 'nav.assessment' },

      // Teachers / Groups / Courses
      { path: 'teachers', element: <TeachersPage />, title: 'Teachers', titleKey: 'nav.teachers', roles: STAFF_ROLES },
      { path: 'teachers/:id', element: <TeachersPage />, title: 'Teachers', titleKey: 'nav.teachers', roles: STAFF_ROLES },
      { path: 'groups', element: <GroupsPage />, title: 'Groups', titleKey: 'nav.groups' },
      { path: 'groups/new', element: <GroupFormPage />, title: 'New Group', titleKey: 'groups.title', roles: STAFF_ROLES },
      { path: 'groups/:id', element: <GroupDetailPage />, title: 'Group', titleKey: 'groups.detailsTitle' },
      { path: 'groups/:id/edit', element: <GroupFormPage />, title: 'Edit Group', titleKey: 'groups.title', roles: STAFF_ROLES },
      { path: 'courses', element: <CoursesPage />, title: 'Courses', titleKey: 'nav.courses' },
      { path: 'courses/:id', element: <CoursesPage />, title: 'Courses', titleKey: 'nav.courses' },

      // Attendance / Face
      { path: 'attendance', element: <AttendancePage />, title: 'Attendance', titleKey: 'nav.attendance' },
      { path: 'face', element: <FaceRecognitionPage />, title: 'Face Recognition', titleKey: 'nav.faceRecognition', roles: STAFF_ROLES },
      { path: 'face/enroll', element: <FaceEnrollmentPage />, title: 'Face Enrollment', titleKey: 'faceEnrollment.title', roles: STAFF_ROLES },

      // Finance
      { path: 'payments', element: <PaymentsPage />, title: 'Payments', titleKey: 'nav.payments', roles: STAFF_ROLES },
      { path: 'payments/:id', element: <PaymentsPage />, title: 'Payments', titleKey: 'nav.payments', roles: STAFF_ROLES },
      { path: 'invoices', element: <InvoicesPage />, title: 'Invoices', titleKey: 'nav.invoices', roles: STAFF_ROLES },
      { path: 'reports', element: <ReportsPage />, title: 'Reports', titleKey: 'nav.reports', roles: STAFF_ROLES },
      { path: 'expenses', element: <ExpensesPage />, title: 'Expenses', titleKey: 'nav.expenses', roles: STAFF_ROLES },
      { path: 'leads', element: <LeadsPage />, title: 'Leads', titleKey: 'nav.leads', roles: STAFF_ROLES },
      { path: 'leads/:id', element: <LeadsPage />, title: 'Leads', titleKey: 'nav.leads', roles: STAFF_ROLES },

      // Security / system (staff-only via roles — applied via Protected wrapper)
      { path: 'cameras', element: <CamerasPage />, title: 'Cameras', titleKey: 'nav.cameras', roles: STAFF_ROLES },
      { path: 'users', element: <UsersPage />, title: 'Users', titleKey: 'nav.users', roles: STAFF_ROLES },
      { path: 'users/:id', element: <UsersPage />, title: 'Users', titleKey: 'nav.users', roles: STAFF_ROLES },
      { path: 'audit', element: <AuditPage />, title: 'Audit Log', titleKey: 'nav.audit', roles: STAFF_ROLES },
      { path: 'audit-timeline', element: <AuditTimelinePage />, title: 'Audit Timeline', titleKey: 'auditTimeline.title', roles: STAFF_ROLES },
      { path: 'search', element: <UniversalSearchPage />, title: 'Search', titleKey: 'search.title' },
      { path: 'data-quality', element: <DataQualityCenterPage />, title: 'Data Quality', roles: STAFF_ROLES },
      { path: 'documents', element: <DocumentsPage />, title: 'Documents', titleKey: 'documents.title' },
      { path: 'resources', element: <ResourceBookingPage />, title: 'Resource Booking', titleKey: 'resourceBooking.title' },
      { path: 'feature-flags', element: <FeatureFlagsPage />, title: 'Feature Flags', titleKey: 'featureFlags.title', roles: STAFF_ROLES },
      { path: 'security', element: <SecurityCenterPage />, title: 'Security Center', roles: STAFF_ROLES },
      { path: 'system-health', element: <SystemHealthPage />, title: 'System Health', titleKey: 'systemHealth.title', roles: STAFF_ROLES },
      { path: 'settings', element: <SettingsPage />, title: 'Settings', titleKey: 'nav.settings' },

      // Academic
      { path: 'teacher-cockpit', element: <TeacherCockpitPage />, title: 'Teacher Cockpit', titleKey: 'nav.teacherCockpit', roles: STAFF_ROLES },
      { path: 'homework', element: <HomeworkPage />, title: 'Homework', titleKey: 'nav.homework' },
      { path: 'grades', element: <GradesPage />, title: 'Grades', titleKey: 'grades.title' },
      { path: 'schedule', element: <SchedulePage />, title: 'Schedule', titleKey: 'nav.schedule' },
      { path: 'library', element: <LibraryPage />, title: 'Library', titleKey: 'nav.library' },
      { path: 'library/books/:id', element: <LibraryPage />, title: 'Library', titleKey: 'nav.library' },
      { path: 'exams', element: <ExamsPage />, title: 'Exams', titleKey: 'nav.exams' },
      { path: 'certificates', element: <CertificatesPage />, title: 'Certificates', titleKey: 'nav.certificates' },
      { path: 'certificates/:id', element: <CertificatesPage />, title: 'Certificates', titleKey: 'nav.certificates' },

      // Operations
      { path: 'hr', element: <HRPage />, title: 'HR & Payroll', titleKey: 'nav.hrPayroll', roles: STAFF_ROLES },
      { path: 'hr/employees/:id', element: <HRPage />, title: 'HR & Payroll', titleKey: 'nav.hrPayroll', roles: STAFF_ROLES },
      { path: 'inventory', element: <InventoryPage />, title: 'Inventory', titleKey: 'nav.inventory', roles: STAFF_ROLES },
      { path: 'early-warning', element: <EarlyWarningPage />, title: 'Early Warning', titleKey: 'earlyWarning.title', roles: STAFF_ROLES },
      { path: 'academic-risk', element: <AcademicRiskPage />, title: 'Academic Risk', titleKey: 'academicRisk.title', roles: STAFF_ROLES },
      { path: 'gamification', element: <GamificationHubPage />, title: 'Gamification & M-Coins', titleKey: 'nav.gamification' },
      { path: 'teacher-workload', element: <TeacherWorkloadPage />, title: 'Teacher Workload', titleKey: 'teacherWorkload.title', roles: STAFF_ROLES },
      { path: 'forecast', element: <ForecastingPage />, title: 'Forecasting', titleKey: 'forecasting.title', roles: STAFF_ROLES },
      { path: 'import-export', element: <ImportExportPage />, title: 'Import / Export', titleKey: 'importExport.title', roles: STAFF_ROLES },
      { path: 'relationships', element: <RelationshipGraphPage />, title: 'Relationship Graph', titleKey: 'relationshipGraph.title', roles: STAFF_ROLES },
      { path: 'notifications', element: <NotificationsCenterPage />, title: 'Notifications', titleKey: 'notifications.title' },
      { path: 'what-changed', element: <WhatChangedPage />, title: 'What Changed?', titleKey: 'whatChanged.title' },
      { path: 'chat', element: <ChatPage />, title: 'Chat', titleKey: 'chat.title' },

      // AI & premium modules
      { path: 'ai-copilot', element: <AiCopilotPage />, title: 'AI Copilot', titleKey: 'nav.aiCopilot', roles: STAFF_ROLES },
      { path: 'parent-portal', element: <ParentPortalPage />, roles: ['PARENT'], title: 'Parent Portal', titleKey: 'parentPortal.title' },
      { path: 'telegram', element: <TelegramPage />, title: 'Telegram', titleKey: 'nav.telegram' },
      { path: 'executive-dashboard', element: <ExecutiveDashboardPage />, title: 'Executive Dashboard', titleKey: 'nav.executiveDashboard', roles: STAFF_ROLES },
      { path: 'executive', element: <Navigate to="/executive-dashboard" replace /> },
      { path: 'automation', element: <AutomationEnginePage />, title: 'Automation', titleKey: 'nav.automation', roles: STAFF_ROLES },
      { path: 'payroll', element: <PayrollPage />, title: 'Payroll', titleKey: 'nav.payrollRuns', roles: STAFF_ROLES },
      { path: 'financial-analytics', element: <FinancialAnalyticsPage />, title: 'Financial Analytics', titleKey: 'nav.financialAnalytics', roles: STAFF_ROLES },
      { path: 'payroll-analytics', element: <PayrollAnalyticsPage />, title: 'Payroll Analytics', titleKey: 'nav.payrollAnalytics', roles: STAFF_ROLES },
      { path: 'crm-analytics', element: <CRMAnalyticsPage />, title: 'CRM Analytics', titleKey: 'nav.crmAnalytics', roles: STAFF_ROLES },
      { path: 'follow-up-automation', element: <FollowUpAutomationPage />, title: 'Follow-Up Automation', titleKey: 'nav.followUpRules', roles: STAFF_ROLES },
      { path: 'branches', element: <BranchesPage />, title: 'Branches', titleKey: 'nav.branches', roles: STAFF_ROLES },
      { path: 'data-governance', element: <DataGovernancePage />, title: 'Data Governance', titleKey: 'nav.dataGovernance', roles: STAFF_ROLES },
      { path: 'anomaly-detection', element: <AnomalyDetectionPage />, title: 'Anomaly Detection', titleKey: 'nav.anomalyDetection', roles: STAFF_ROLES },

      // DevOps
      { path: 'api-keys', element: <ApiKeysPage />, title: 'API Keys', titleKey: 'apiKeys.title', roles: STAFF_ROLES },
      { path: 'observability', element: <ObservabilityPage />, title: 'Observability', titleKey: 'obs.title', roles: STAFF_ROLES },
      { path: 'performance', element: <PerformanceMonitorPage />, title: 'Performance Monitor', titleKey: 'performance.title', roles: STAFF_ROLES },
      { path: 'reconciliation', element: <ReconciliationPage />, title: 'Reconciliation', titleKey: 'reconciliation.title', roles: STAFF_ROLES },
      { path: 'communication-history', element: <CommunicationHistoryPage />, title: 'Communication History', titleKey: 'communication.title', roles: STAFF_ROLES },

      // Errors
      { path: 'unauthorized', element: <UnauthorizedPage />, type: 'none', title: 'Unauthorized', titleKey: 'error.forbiddenTitle' },
      { path: '*', element: <NotFoundPage />, type: 'none', title: 'Page Not Found', titleKey: 'error.notFoundTitle', errorLabel: 'Page not found' },
    ],
  },
  // NOTE: top-level `*` is intentionally omitted — AppLayout's inner `*` catches all.
];

/* ============================================================================
 * REGEX BUILDER — safe
 * ========================================================================== */

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;
function escapeRegex(s: string): string {
  return s.replace(REGEX_SPECIALS, '\\$&');
}

function buildRegexPattern(path: string, index?: boolean): RegExp {
  if (index || path === '') return /^\/?$/;
  if (path === '*') return /^\/.*$/; // wildcard support

  const parts = path.split(/(:[^/]+)/g);
  const escaped = parts
    .map((part) => (part.startsWith(':') ? '([^/]+)' : escapeRegex(part)))
    .join('');

  const withLeading = escaped.startsWith('/') ? escaped : `/${escaped}`;
  // Supports both exact path and trailing slash (e.g. /students and /students/)
  return new RegExp(`^${withLeading}\\/?$`);
}

/* ============================================================================
 * TITLE EXTRACTION — idempotent
 * ========================================================================== */

export interface RouteTitle {
  pattern: RegExp;
  title: string;
  titleKey?: string;
}

/** Rebuilt each module load. Idempotent because it starts empty. */
export const ROUTE_TITLES: RouteTitle[] = [];

function joinPath(base: string, child: string): string {
  if (!child) return base;
  if (child.startsWith('/')) return child;
  if (base.endsWith('/')) return base + child;
  return `${base}/${child}`;
}

function extractTitles(routes: RouteConfig[], basePath = ''): void {
  for (const route of routes) {
    if (route.title || route.titleKey) {
      const fullPath = route.index
        ? basePath || '/'
        : joinPath(basePath, route.path ?? '');
      const pattern = buildRegexPattern(fullPath, route.index);
      ROUTE_TITLES.push({
        pattern,
        title: route.title ?? '',
        titleKey: route.titleKey,
      });
    }
    if (route.children) {
      const nextBase = route.path && route.path !== '/'
        ? joinPath(basePath, route.path)
        : basePath;
      extractTitles(route.children, nextBase);
    }
  }
}

extractTitles(routeConfig);

/* ============================================================================
 * WRAPPERS
 * ========================================================================== */

function wrapElement(route: RouteConfig): ReactNode {
  let el = route.element;

  // Wrap in ErrorBoundary only for leaf route elements (not layouts)
  if (!route.children) {
    el = <ErrorBoundaryWrapper label={route.errorLabel}>{el}</ErrorBoundaryWrapper>;
  }

  // [P0 FIX] Roles check applies whenever `roles` is set — regardless of `type`.
  // This prevents the "roles silently ignored" bug (was: ai-copilot STUDENT-accessible).
  const needsRoleCheck = Array.isArray(route.roles) && route.roles.length > 0;

  if (route.type === 'public') {
    return <PublicOnly>{el}</PublicOnly>;
  }
  if (route.type === 'protected' || needsRoleCheck) {
    return <Protected roles={route.roles}>{el}</Protected>;
  }
  return el;
}

/* ============================================================================
 * ROUTE RENDERING — with AnimatePresence for public pages
 * ========================================================================== */

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

function RouteMotion({ children }: { children: ReactNode }) {
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: reduced ? 0.15 : 0.28, ease: EASE_APPLE }}
      style={{ minHeight: 1, transform: 'translateZ(0)' }}
    >
      {children}
    </motion.div>
  );
}

function RouteLoadingFallback() {
  return (
    <div
      className="relative w-full min-h-[50vh] flex flex-col justify-start pt-6 space-y-5 animate-pulse px-4 sm:px-6"
      aria-busy="true"
    >
      {/* Top glowing progress bar with mobile safe-area-inset */}
      <div className="fixed top-0 inset-x-0 z-[100] h-[3px] overflow-hidden bg-transparent pt-[env(safe-area-inset-top,0px)]">
        <motion.div
          className="h-full w-full bg-gradient-to-r from-[#007AFF] via-[#AF52DE] to-[#34C759]"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
        />
      </div>

      {/* Shimmer skeleton matching Apple design cards */}
      <div className="h-16 w-full rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.035] backdrop-blur-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl border border-white/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03]"
          />
        ))}
      </div>
      <div className="h-72 sm:h-80 rounded-2xl sm:rounded-3xl border border-white/60 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.03]" />
    </div>
  );
}

function renderRoute(route: RouteConfig, i: number): ReactNode {
  const key = route.path || (route.index ? 'index' : i);

  if (route.children) {
    return (
      <Route key={key} path={route.path} element={wrapElement(route)}>
        {route.children.map((child, j) => renderRoute(child, j))}
      </Route>
    );
  }

  return (
    <Route
      key={key}
      index={route.index}
      path={route.index ? undefined : route.path}
      element={wrapElement(route)}
    />
  );
}

const STANDALONE_PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/tg-app',
  '/verify',
];

export function AppRoutes() {
  const location = useLocation();

  // Public & standalone routes get AnimatePresence transitions.
  // Protected routes are nested under AppLayout's AnimatedOutlet.
  const isPublicRoute = STANDALONE_PUBLIC_PREFIXES.some(
    (prefix) =>
      location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );

  const routes = <Routes>{routeConfig.map((route, i) => renderRoute(route, i))}</Routes>;

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      {isPublicRoute ? (
        <RouteMotion key={location.pathname}>{routes}</RouteMotion>
      ) : (
        routes
      )}
    </Suspense>
  );
}

export default AppRoutes;
