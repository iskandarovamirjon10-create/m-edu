/**
 * M-EDU App Routes — v2.0 ("Liquid Glass · Apple Vision Pro" Routing & Prefetch Engine)
 *
 * 🎯 v2.0 Architectural Fixes & Upgrades:
 *  1. [P0 Security & Perf] Guard-First Wrapping — `<Protected>` now evaluates BEFORE `<Suspense>` so unauthorized users never download restricted route chunks.
 *  2. [P0 Stability] Layout Resilience — `AppLayout` is now protected by `ErrorBoundaryWrapper` + top optical progress bar during initial chunk fetch.
 *  3. [P0 Bugfix] Wildcard Regex Fix — `buildRegexPattern` now properly handles both `*` and `/*` so 404 Document Titles resolve accurately.
 *  4. [UX] True `AnimatePresence` — Public standalone routes now pass `location` to `<Routes>` inside `<AnimatePresence mode="wait">` for real exit physics.
 *  5. [Perf] Zero-Latency Prefetching — `lazyPage` now exposes `.preload()` and memoizes promises; added `preloadRoute(path)` for Sidebar hover prefetching.
 *  6. [DRY] Automatic Error Labels — `wrapElement` automatically falls back to `route.title` for `ErrorBoundaryWrapper` telemetry context.
 *  7. [Clean] Unified Skeleton — Replaced duplicate `RouteLoadingFallback` with `PageFallback` from `App.tsx` + Spatial Top Progress Ribbon.
 */

import {
  lazy,
  Suspense,
  useState,
  useEffect,
  memo,
  type ReactNode,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ErrorBoundaryWrapper, PageFallback, Protected, PublicOnly } from '../App';
import { useAuth } from '@/auth/AuthContext';
import { ADMIN_ROLES, STAFF_ROLES, STUDENT_ROLES, TEACHER_ROLES } from '@/lib/roles';
import type { Role } from '@/lib/types';

/* ══════════════════════════════════════════════════════════════════════════
 * SMART LAZY LOADER — Exponential Jitter Retry + Zero-Latency Preload
 * ════════════════════════════════════════════════════════════════════════ */

export type PreloadableComponent<P = Record<string, unknown>> =
  LazyExoticComponent<ComponentType<P>> & {
    preload: () => Promise<{ default: ComponentType<P> }>;
  };

/**
 * Retries transient network/CDN blips with exponential backoff + jitter
 * before letting `ErrorBoundaryWrapper` trigger its Chunk-Reload Guard.
 */
function retryImport<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelay = 280,
): () => Promise<T> {
  return async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries) throw err;
        const jitter = Math.random() * 120;
        await new Promise((r) =>
          setTimeout(r, baseDelay * (attempt + 1) + jitter),
        );
      }
    }
    throw new Error('retryImport: exhausted');
  };
}

/**
 * Wraps a dynamic module import into a memoized `React.lazy` component
 * with an attached `.preload()` method for instant hover/idle prefetching.
 */
function lazyPage<T extends Record<string, any>>(
  factory: () => Promise<T>,
  exportName: keyof T | 'default' = 'default',
): PreloadableComponent<any> {
  let cachedPromise: Promise<{ default: ComponentType<any> }> | null = null;

  const load = retryImport(() => {
    if (!cachedPromise) {
      cachedPromise = factory()
        .then((m) => {
          const resolved =
            exportName === 'default' ? m.default : m[exportName];
          if (!resolved) {
            throw new Error(
              `[M-EDU Router] Missing export "${String(exportName)}" in lazy chunk.`,
            );
          }
          return { default: resolved as ComponentType<any> };
        })
        .catch((err) => {
          cachedPromise = null; // Reset cache so manual retry can re-fetch
          throw err;
        });
    }
    return cachedPromise;
  });

  const LazyComp = lazy(load) as PreloadableComponent<any>;
  LazyComp.preload = load;
  return LazyComp;
}

/* ══════════════════════════════════════════════════════════════════════════
 * LAZY PAGE DECLARATIONS
 * ════════════════════════════════════════════════════════════════════════ */

// Core App Shell Layout
const AppLayout = lazyPage(() => import('@/layouts/AppLayout'), 'AppLayout');

// Auth & Standalone Public Pages
const LoginPage                = lazyPage(() => import('@/pages/Login'), 'LoginPage');
const AuthCallbackPage         = lazyPage(() => import('@/pages/AuthCallback'), 'AuthCallbackPage');
const ForgotPasswordPage       = lazyPage(() => import('@/pages/ForgotPassword'), 'ForgotPasswordPage');
const ResetPasswordPage        = lazyPage(() => import('@/pages/ResetPassword'), 'ResetPasswordPage');
const TermsPage                = lazyPage(() => import('@/pages/Terms'), 'TermsPage');
const PrivacyPage              = lazyPage(() => import('@/pages/Privacy'), 'PrivacyPage');
const CertificateVerifyPage    = lazyPage(() => import('@/pages/CertificateVerify'), 'CertificateVerifyPage');

// Dashboard & Core Entities
const DashboardPage            = lazyPage(() => import('@/pages/Dashboard'), 'DashboardPage');
const StudentsPage             = lazyPage(() => import('@/pages/Students'), 'StudentsPage');
const StudentDetailPage        = lazyPage(() => import('@/pages/StudentDetail'), 'StudentDetailPage');
const StudentFormPage          = lazyPage(() => import('@/pages/StudentForm'), 'StudentFormPage');
const Student360Page           = lazyPage(() => import('@/pages/Student360'), 'default');
const TeachersPage             = lazyPage(() => import('@/pages/Teachers'), 'TeachersPage');
const GroupsPage               = lazyPage(() => import('@/pages/Groups'), 'GroupsPage');
const GroupDetailPage          = lazyPage(() => import('@/pages/GroupDetail'), 'GroupDetailPage');
const GroupFormPage            = lazyPage(() => import('@/pages/GroupForm'), 'GroupFormPage');
const CoursesPage              = lazyPage(() => import('@/pages/Courses'), 'CoursesPage');

// Attendance & Biometrics
const AttendancePage           = lazyPage(() => import('@/pages/Attendance'), 'AttendancePage');
const TeacherCockpitPage       = lazyPage(() => import('@/pages/TeacherCockpit'), 'TeacherCockpitPage');
const FaceRecognitionPage      = lazyPage(() => import('@/pages/FaceRecognition'), 'FaceRecognitionPage');
const FaceEnrollmentPage       = lazyPage(() => import('@/pages/FaceEnrollment'), 'FaceEnrollmentPage');

// Finance & CRM
const PaymentsPage             = lazyPage(() => import('@/pages/Payments'), 'PaymentsPage');
const InvoicesPage             = lazyPage(() => import('@/pages/Invoices'), 'InvoicesPage');
const ReportsPage              = lazyPage(() => import('@/pages/Reports'), 'ReportsPage');
const ExpensesPage             = lazyPage(() => import('@/pages/Expenses'), 'ExpensesPage');
const LeadsPage                = lazyPage(() => import('@/pages/Leads'), 'LeadsPage');
const PayrollPage              = lazyPage(() => import('@/pages/Payroll'), 'PayrollPage');
const FinancialAnalyticsPage   = lazyPage(() => import('@/pages/FinancialAnalytics'), 'FinancialAnalyticsPage');
const PayrollAnalyticsPage     = lazyPage(() => import('@/pages/PayrollAnalytics'), 'PayrollAnalyticsPage');
const CRMAnalyticsPage         = lazyPage(() => import('@/pages/CRMAnalytics'), 'CRMAnalyticsPage');
const FollowUpAutomationPage   = lazyPage(() => import('@/pages/FollowUpAutomation'), 'FollowUpAutomationPage');
const ReconciliationPage       = lazyPage(() => import('@/pages/Reconciliation'), 'ReconciliationPage');

// Academic Operating System
const SubjectsPage             = lazyPage(() => import('@/pages/Subjects'), 'default');
const CurriculumPage           = lazyPage(() => import('@/pages/Curriculum'), 'default');
const AssignmentsPage          = lazyPage(() => import('@/pages/Assignments'), 'default');
const AssessmentPage           = lazyPage(() => import('@/pages/Assessment'), 'default');
const HomeworkPage             = lazyPage(() => import('@/pages/Homework'), 'HomeworkPage');
const GradesPage               = lazyPage(() => import('@/pages/Grades'), 'GradesPage');
const SchedulePage             = lazyPage(() => import('@/pages/Schedule'), 'SchedulePage');
const LibraryPage              = lazyPage(() => import('@/pages/Library'), 'LibraryPage');
const StudyStudioPage          = lazyPage(() => import('@/pages/StudyStudio'), 'StudyStudioPage');
const ExamsPage                = lazyPage(() => import('@/pages/Exams'), 'ExamsPage');
const CertificatesPage         = lazyPage(() => import('@/pages/Certificates'), 'CertificatesPage');

// Operations, Risk & Intelligence
const HRPage                   = lazyPage(() => import('@/pages/HR'), 'HRPage');
const InventoryPage            = lazyPage(() => import('@/pages/Inventory'), 'InventoryPage');
const EarlyWarningPage         = lazyPage(() => import('@/pages/EarlyWarning'), 'EarlyWarningPage');
const AcademicRiskPage         = lazyPage(() => import('@/pages/AcademicRisk'), 'AcademicRiskPage');
const GamificationHubPage      = lazyPage(() => import('@/pages/GamificationHub'), 'GamificationHubPage');
const MindArenaPage            = lazyPage(() => import('@/pages/MindArena'), 'MindArenaPage');
const TeacherWorkloadPage      = lazyPage(() => import('@/pages/TeacherWorkload'), 'TeacherWorkloadPage');
const ForecastingPage          = lazyPage(() => import('@/pages/Forecasting'), 'ForecastingPage');
const ImportExportPage         = lazyPage(() => import('@/pages/ImportExport'), 'ImportExportPage');
const RelationshipGraphPage    = lazyPage(() => import('@/pages/RelationshipGraph'), 'RelationshipGraphPage');
const NotificationsCenterPage  = lazyPage(() => import('@/pages/NotificationsCenter'), 'NotificationsCenterPage');
const ChatPage                 = lazyPage(() => import('@/pages/Chat'), 'ChatPage');
const DocumentsPage            = lazyPage(() => import('@/pages/Documents'), 'DocumentsPage');
const ResourceBookingPage      = lazyPage(() => import('@/pages/ResourceBooking'), 'ResourceBookingPage');
const BranchesPage             = lazyPage(() => import('@/pages/Branches'), 'BranchesPage');
const CommunicationHistoryPage = lazyPage(() => import('@/pages/CommunicationHistory'), 'CommunicationHistoryPage');

// AI, Portals & Executive
const AiCopilotPage            = lazyPage(() => import('@/pages/AiCopilot'), 'default');
const ParentPortalPage         = lazyPage(() => import('@/pages/ParentPortal'), 'ParentPortalPage');
const ExecutiveDashboardPage   = lazyPage(() => import('@/pages/ExecutiveDashboard'), 'ExecutiveDashboardPage');
const ShowcasePage             = lazyPage(() => import('@/pages/Showcase'), 'Showcase');
const AutomationEnginePage     = lazyPage(() => import('@/pages/AutomationEngine'), 'AutomationEnginePage');
const TelegramPage             = lazyPage(() => import('@/pages/Telegram'), 'TelegramPage');
const TelegramWebAppPage       = lazyPage(() => import('@/pages/TelegramWebApp'), 'TelegramWebAppPage');

// Security, Governance & DevOps
const CamerasPage              = lazyPage(() => import('@/pages/Cameras'), 'CamerasPage');
const UsersPage                = lazyPage(() => import('@/pages/Users'), 'UsersPage');
const AuditPage                = lazyPage(() => import('@/pages/Audit'), 'AuditPage');
const UniversalSearchPage      = lazyPage(() => import('@/pages/UniversalSearch'), 'UniversalSearchPage');
const DataGovernancePage       = lazyPage(() => import('@/pages/DataGovernance'), 'DataGovernancePage');
const AnomalyDetectionPage     = lazyPage(() => import('@/pages/AnomalyDetection'), 'AnomalyDetectionPage');
const FeatureFlagsPage         = lazyPage(() => import('@/pages/FeatureFlags'), 'FeatureFlagsPage');
const SystemHealthPage         = lazyPage(() => import('@/pages/SystemHealth'), 'SystemHealthPage');
const ApiKeysPage              = lazyPage(() => import('@/pages/ApiKeys'), 'ApiKeysPage');
const ObservabilityPage        = lazyPage(() => import('@/pages/Observability'), 'ObservabilityPage');
const PerformanceMonitorPage   = lazyPage(() => import('@/pages/PerformanceMonitor'), 'PerformanceMonitorPage');
const SettingsPage             = lazyPage(() => import('@/pages/Settings'), 'SettingsPage');
const SuperAdminPage           = lazyPage(() => import('@/pages/SuperAdmin'), 'SuperAdminPage');
const BillingSettingsPage      = lazyPage(() => import('@/pages/BillingSettings'), 'BillingSettingsPage');

// Fallback Status Pages
const NotFoundPage             = lazyPage(() => import('@/pages/NotFound'), 'NotFoundPage');
const UnauthorizedPage         = lazyPage(() => import('@/pages/Unauthorized'), 'UnauthorizedPage');

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTE PREFETCH REGISTRY (For Sidebar / Command Palette Instant Hover)
 * ════════════════════════════════════════════════════════════════════════ */

const PRELOAD_MAP: Record<string, PreloadableComponent<any>> = {
  '/': DashboardPage,
  '/students': StudentsPage,
  '/teachers': TeachersPage,
  '/groups': GroupsPage,
  '/courses': CoursesPage,
  '/attendance': AttendancePage,
  '/payments': PaymentsPage,
  '/invoices': InvoicesPage,
  '/reports': ReportsPage,
  '/expenses': ExpensesPage,
  '/leads': LeadsPage,
  '/schedule': SchedulePage,
  '/homework': HomeworkPage,
  '/grades': GradesPage,
  '/study': StudyStudioPage,
  '/exams': ExamsPage,
  '/ai-copilot': AiCopilotPage,
  '/executive-dashboard': ExecutiveDashboardPage,
  '/showcase': ShowcasePage,
  '/settings': SettingsPage,
  '/settings/billing': BillingSettingsPage,
  '/super-admin': SuperAdminPage,
};

/**
 * Call on Sidebar `<NavLink onMouseEnter={() => preloadRoute(item.path)}>`
 * to warm up the route chunk before the user clicks.
 */
export function preloadRoute(path: string): void {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const target = PRELOAD_MAP[normalized];
  if (target) {
    void target.preload().catch(() => {
      /* Ignore background prefetch errors */
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTE CONFIGURATION & TYPES
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * `type` semantics:
 *   - 'public'    — only visible when logged OUT (redirects to `/` if authenticated)
 *   - 'protected' — only visible when logged IN (redirects to `/login` if unauthenticated)
 *   - 'none'      — no auth guard (callbacks, legal pages, certificate verification, 404)
 *
 * SECURITY INVARIANT: If `roles` is non-empty, `<Protected roles={...}>` is ALWAYS
 * enforced even if `type` was omitted.
 */
export interface RouteConfig {
  path?: string;
  index?: boolean;
  element: ReactNode;
  title?: string;
  /** i18n key for `<DocumentTitleManager />` (preferred over `title`). */
  titleKey?: string;
  type?: 'public' | 'protected' | 'none';
  /** Allowed RBAC roles; unauthorized users are routed to `/unauthorized`. */
  roles?: readonly Role[];
  children?: RouteConfig[];
  /** Custom label displayed in `ErrorBoundaryWrapper` & `PageFallback`. Defaults to `title`. */
  errorLabel?: string;
}

/* ══════════════════════════════════════════════════════════════════════════
 * SMART WORKSPACE HOME — Role-Based Landing Engine
 * ══════════════════════════════════════════════════════════════════════════ */

function WorkspaceHome() {
  const { user } = useAuth();
  const role = user?.role?.toUpperCase();
  if (role === 'TEACHER' || role === 'ASSISTANT') {
    return <Navigate to="/teacher-cockpit" replace />;
  }
  if (role === 'PARENT') {
    return <Navigate to="/parent-portal" replace />;
  }
  if (role === 'STUDENT') {
    return <Navigate to="/schedule" replace />;
  }
  return <DashboardPage />;
}

export const routeConfig: RouteConfig[] = [
  /* ── Standalone Public & Auth Flows ── */
  { path: '/login', element: <LoginPage />, type: 'public', title: 'Sign In', titleKey: 'nav.signIn' },
  // SC-01: self-registration was disabled by redirecting /register to /login,
  // which left a 1 366-line page unreachable. The API already owns the policy
  // (POST /auth/register is @AllowPublic and auth.service enforces
  // inviteOnly/requireApproval), so the route can safely render the real page.
  // Centralized IAM: Public registration is strictly prohibited (OWNER_ONLY provisioning).
  { path: '/register', element: <Navigate to="/login" replace />, type: 'none', title: 'Sign In' },
  { path: '/auth/callback', element: <AuthCallbackPage />, type: 'none', title: 'Authenticating…' },
  { path: '/forgot-password', element: <ForgotPasswordPage />, type: 'public', title: 'Reset Password', titleKey: 'auth.forgotPasswordTitle' },
  { path: '/reset-password', element: <ResetPasswordPage />, type: 'public', title: 'Set New Password', titleKey: 'auth.resetPasswordTitle' },
  { path: '/terms', element: <TermsPage />, type: 'none', title: 'Terms of Service', titleKey: 'terms.title' },
  { path: '/privacy', element: <PrivacyPage />, type: 'none', title: 'Privacy Policy', titleKey: 'privacy.title' },
  { path: '/tg-app', element: <TelegramWebAppPage />, type: 'none', title: 'Telegram WebApp Hub' },
  { path: '/verify', element: <CertificateVerifyPage />, type: 'none', title: 'Verify Certificate', titleKey: 'certificates.verifyTitle' },
  { path: '/verify/:code', element: <CertificateVerifyPage />, type: 'none', title: 'Verify Certificate', titleKey: 'certificates.verifyTitle' },

  /* ── Protected Application Workspace (AppLayout) ── */
  {
    path: '/',
    element: <AppLayout />,
    type: 'protected',
    title: 'M-EDU Workspace',
    children: [
      { index: true, element: <WorkspaceHome />, title: 'Dashboard', titleKey: 'nav.dashboard' },

      // Students
      { path: 'students', element: <StudentsPage />, title: 'Students', titleKey: 'nav.students', roles: STAFF_ROLES },
      { path: 'students/new', element: <StudentFormPage />, title: 'New Student', titleKey: 'students.formTitle', roles: ADMIN_ROLES },
      { path: 'students/:id', element: <StudentDetailPage />, title: 'Student Profile', titleKey: 'students.detailsTitle', roles: STAFF_ROLES },
      { path: 'students/:id/360', element: <Student360Page />, title: 'Student 360°', titleKey: 'students.detailsTitle', roles: STAFF_ROLES },
      { path: 'students/:id/edit', element: <StudentFormPage />, title: 'Edit Student', titleKey: 'students.formTitle', roles: ADMIN_ROLES },

      // Education Core (Academic Operating System)
      { path: 'subjects', element: <SubjectsPage />, title: 'Subjects', titleKey: 'nav.subjects', roles: STAFF_ROLES },
      { path: 'curriculum', element: <CurriculumPage />, title: 'Curriculum', titleKey: 'nav.curriculum', roles: STAFF_ROLES },
      { path: 'assignments', element: <AssignmentsPage />, title: 'Assignments', titleKey: 'nav.assignments' },
      { path: 'assessment', element: <AssessmentPage />, title: 'Assessment', titleKey: 'nav.assessment', roles: STAFF_ROLES },

      // Teachers / Groups / Courses
      { path: 'teachers', element: <TeachersPage />, title: 'Teachers', titleKey: 'nav.teachers', roles: ADMIN_ROLES },
      { path: 'teachers/:id', element: <TeachersPage />, title: 'Teacher Profile', titleKey: 'nav.teachers', roles: ADMIN_ROLES },
      { path: 'groups', element: <GroupsPage />, title: 'Groups', titleKey: 'nav.groups' },
      { path: 'groups/new', element: <GroupFormPage />, title: 'New Group', titleKey: 'groups.title', roles: ADMIN_ROLES },
      { path: 'groups/:id', element: <GroupDetailPage />, title: 'Group Details', titleKey: 'groups.detailsTitle' },
      { path: 'groups/:id/edit', element: <GroupFormPage />, title: 'Edit Group', titleKey: 'groups.title', roles: ADMIN_ROLES },
      { path: 'courses', element: <CoursesPage />, title: 'Courses', titleKey: 'nav.courses', roles: STAFF_ROLES },
      { path: 'courses/:id', element: <CoursesPage />, title: 'Course Details', titleKey: 'nav.courses', roles: STAFF_ROLES },

      // Attendance & Biometrics
      { path: 'attendance', element: <AttendancePage />, title: 'Attendance', titleKey: 'nav.attendance', roles: STAFF_ROLES },
      { path: 'face', element: <FaceRecognitionPage />, title: 'Face Recognition', titleKey: 'nav.faceRecognition', roles: STAFF_ROLES },
      { path: 'face/enroll', element: <FaceEnrollmentPage />, title: 'Face Enrollment', titleKey: 'faceEnrollment.title', roles: STAFF_ROLES },

      // Finance & CRM (Admin Only)
      { path: 'payments', element: <PaymentsPage />, title: 'Payments', titleKey: 'nav.payments', roles: ADMIN_ROLES },
      { path: 'payments/:id', element: <PaymentsPage />, title: 'Payment Details', titleKey: 'nav.payments', roles: ADMIN_ROLES },
      { path: 'invoices', element: <InvoicesPage />, title: 'Invoices', titleKey: 'nav.invoices', roles: ADMIN_ROLES },
      { path: 'reports', element: <ReportsPage />, title: 'Reports', titleKey: 'nav.reports', roles: ADMIN_ROLES },
      { path: 'expenses', element: <ExpensesPage />, title: 'Expenses', titleKey: 'nav.expenses', roles: ADMIN_ROLES },
      { path: 'leads', element: <LeadsPage />, title: 'Leads', titleKey: 'nav.leads', roles: ADMIN_ROLES },
      { path: 'leads/:id', element: <LeadsPage />, title: 'Lead Details', titleKey: 'nav.leads', roles: ADMIN_ROLES },

      // Security & System Administration (Admin Only)
      { path: 'cameras', element: <CamerasPage />, title: 'Cameras', titleKey: 'nav.cameras', roles: ADMIN_ROLES },
      { path: 'users', element: <UsersPage />, title: 'Users', titleKey: 'nav.users', roles: ADMIN_ROLES },
      { path: 'users/:id', element: <UsersPage />, title: 'User Profile', titleKey: 'nav.users', roles: ADMIN_ROLES },
      { path: 'audit', element: <AuditPage />, title: 'Audit Log', titleKey: 'nav.audit', roles: ADMIN_ROLES },
      { path: 'audit-timeline', element: <Navigate to="/audit" replace />, roles: ADMIN_ROLES },
      { path: 'search', element: <UniversalSearchPage />, title: 'Universal Search', titleKey: 'search.title' },
      { path: 'data-quality', element: <Navigate to="/audit" replace />, roles: ADMIN_ROLES },
      { path: 'documents', element: <DocumentsPage />, title: 'Documents', titleKey: 'documents.title' },
      { path: 'resources', element: <ResourceBookingPage />, title: 'Resource Booking', titleKey: 'resourceBooking.title', roles: ADMIN_ROLES },
      { path: 'feature-flags', element: <FeatureFlagsPage />, title: 'Feature Flags', titleKey: 'featureFlags.title', roles: ADMIN_ROLES },
      { path: 'security', element: <Navigate to="/audit" replace />, roles: ADMIN_ROLES },
      { path: 'system-health', element: <SystemHealthPage />, title: 'System Health', titleKey: 'systemHealth.title', roles: ADMIN_ROLES },
      { path: 'settings', element: <SettingsPage />, title: 'Settings', titleKey: 'nav.settings' },
      { path: 'settings/billing', element: <BillingSettingsPage />, title: 'Billing & Subscription', titleKey: 'nav.billing', roles: ADMIN_ROLES },
      { path: 'super-admin', element: <SuperAdminPage />, title: 'Super Admin Control Plane', roles: ['PLATFORM_OWNER'] },

      // Academic Tools
      { path: 'teacher-cockpit', element: <TeacherCockpitPage />, title: 'Teacher Cockpit', titleKey: 'nav.teacherCockpit', roles: [...TEACHER_ROLES, ...ADMIN_ROLES] },
      { path: 'homework', element: <HomeworkPage />, title: 'Homework', titleKey: 'nav.homework' },
      { path: 'grades', element: <GradesPage />, title: 'Grades', titleKey: 'grades.title' },
      { path: 'schedule', element: <SchedulePage />, title: 'Schedule', titleKey: 'nav.schedule' },
      { path: 'library', element: <LibraryPage />, title: 'Library', titleKey: 'nav.library' },
      { path: 'library/books/:id', element: <LibraryPage />, title: 'Book Details', titleKey: 'nav.library' },
      { path: 'study', element: <StudyStudioPage />, title: 'Study Studio', titleKey: 'study.title', roles: [...STAFF_ROLES, ...STUDENT_ROLES] },
      { path: 'exams', element: <ExamsPage />, title: 'Exams', titleKey: 'nav.exams', roles: STAFF_ROLES },
      { path: 'certificates', element: <CertificatesPage />, title: 'Certificates', titleKey: 'nav.certificates', roles: STAFF_ROLES },
      { path: 'certificates/:id', element: <CertificatesPage />, title: 'Certificate Details', titleKey: 'nav.certificates', roles: STAFF_ROLES },

      // Operations & Analytics
      { path: 'hr', element: <HRPage />, title: 'HR & Payroll', titleKey: 'nav.hrPayroll', roles: ADMIN_ROLES },
      { path: 'hr/employees/:id', element: <HRPage />, title: 'Employee Profile', titleKey: 'nav.hrPayroll', roles: ADMIN_ROLES },
      { path: 'inventory', element: <InventoryPage />, title: 'Inventory', titleKey: 'nav.inventory', roles: ADMIN_ROLES },
      { path: 'early-warning', element: <EarlyWarningPage />, title: 'Early Warning', titleKey: 'earlyWarning.title', roles: ADMIN_ROLES },
      { path: 'academic-risk', element: <AcademicRiskPage />, title: 'Academic Risk', titleKey: 'academicRisk.title', roles: ADMIN_ROLES },
      { path: 'gamification', element: <GamificationHubPage />, title: 'Gamification & M-Coins', titleKey: 'nav.gamification' },
      { path: 'arena', element: <MindArenaPage />, title: 'Mind Arena (Aql Duellari)' },
      { path: 'mind-arena', element: <MindArenaPage />, title: 'Mind Arena (Aql Duellari)' },
      { path: 'teacher-workload', element: <TeacherWorkloadPage />, title: 'Teacher Workload', titleKey: 'teacherWorkload.title', roles: ADMIN_ROLES },
      { path: 'forecast', element: <ForecastingPage />, title: 'Forecasting', titleKey: 'forecasting.title', roles: ADMIN_ROLES },
      { path: 'import-export', element: <ImportExportPage />, title: 'Import / Export', titleKey: 'importExport.title', roles: ADMIN_ROLES },
      { path: 'relationships', element: <RelationshipGraphPage />, title: 'Relationship Graph', titleKey: 'relationshipGraph.title', roles: ADMIN_ROLES },
      { path: 'notifications', element: <NotificationsCenterPage />, title: 'Notifications', titleKey: 'notifications.title' },
      { path: 'what-changed', element: <Navigate to="/audit" replace /> },
      { path: 'chat', element: <ChatPage />, title: 'Messages', titleKey: 'chat.title' },

      // AI Copilot & Enterprise Modules
      { path: 'ai-copilot', element: <AiCopilotPage />, title: 'AI Copilot', titleKey: 'nav.aiCopilot', roles: STAFF_ROLES },
      { path: 'parent-portal', element: <ParentPortalPage />, roles: ['PARENT', ...ADMIN_ROLES], title: 'Parent Portal', titleKey: 'parentPortal.title' },
      { path: 'telegram', element: <TelegramPage />, title: 'Telegram Hub', titleKey: 'nav.telegram' },
      { path: 'executive-dashboard', element: <ExecutiveDashboardPage />, title: 'Executive Dashboard', titleKey: 'nav.executiveDashboard', roles: ADMIN_ROLES },
      { path: 'showcase', element: <ShowcasePage />, title: ' Apple Innovation Suite', titleKey: 'nav.showcase', roles: STAFF_ROLES },
      { path: 'innovations', element: <Navigate to="/showcase" replace /> },
      { path: 'executive', element: <Navigate to="/executive-dashboard" replace /> },
      { path: 'automation', element: <AutomationEnginePage />, title: 'Automation Engine', titleKey: 'nav.automation', roles: ADMIN_ROLES },
      { path: 'payroll', element: <PayrollPage />, title: 'Payroll', titleKey: 'nav.payrollRuns', roles: ADMIN_ROLES },
      { path: 'financial-analytics', element: <FinancialAnalyticsPage />, title: 'Financial Analytics', titleKey: 'nav.financialAnalytics', roles: ADMIN_ROLES },
      { path: 'payroll-analytics', element: <PayrollAnalyticsPage />, title: 'Payroll Analytics', titleKey: 'nav.payrollAnalytics', roles: ADMIN_ROLES },
      { path: 'crm-analytics', element: <CRMAnalyticsPage />, title: 'CRM Analytics', titleKey: 'nav.crmAnalytics', roles: ADMIN_ROLES },
      { path: 'follow-up-automation', element: <FollowUpAutomationPage />, title: 'Follow-Up Automation', titleKey: 'nav.followUpRules', roles: ADMIN_ROLES },
      { path: 'branches', element: <BranchesPage />, title: 'Branches', titleKey: 'nav.branches', roles: ADMIN_ROLES },
      { path: 'data-governance', element: <DataGovernancePage />, title: 'Data Governance', titleKey: 'nav.dataGovernance', roles: ADMIN_ROLES },
      { path: 'anomaly-detection', element: <AnomalyDetectionPage />, title: 'Anomaly Detection', titleKey: 'nav.anomalyDetection', roles: ADMIN_ROLES },

      // DevOps & Observability
      { path: 'api-keys', element: <ApiKeysPage />, title: 'API Keys', titleKey: 'apiKeys.title', roles: ADMIN_ROLES },
      { path: 'observability', element: <ObservabilityPage />, title: 'Observability', titleKey: 'obs.title', roles: ADMIN_ROLES },
      { path: 'performance', element: <PerformanceMonitorPage />, title: 'Performance Monitor', titleKey: 'performance.title', roles: ADMIN_ROLES },
      { path: 'reconciliation', element: <ReconciliationPage />, title: 'Reconciliation', titleKey: 'reconciliation.title', roles: ADMIN_ROLES },
      { path: 'communication-history', element: <CommunicationHistoryPage />, title: 'Communication History', titleKey: 'communication.title', roles: ADMIN_ROLES },

      // Fallbacks
      { path: 'unauthorized', element: <UnauthorizedPage />, type: 'none', title: 'Unauthorized', titleKey: 'error.forbiddenTitle' },
      { path: '*', element: <NotFoundPage />, type: 'none', title: 'Page Not Found', titleKey: 'error.notFoundTitle', errorLabel: '404' },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════════════
 * SAFE REGEX COMPILER & IDEMPOTENT TITLE EXTRACTOR
 * ════════════════════════════════════════════════════════════════════════ */

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

function escapeRegex(s: string): string {
  return s.replace(REGEX_SPECIALS, '\\$&');
}

function buildRegexPattern(path: string, index?: boolean): RegExp {
  if (index || path === '' || path === '/') return /^\/?$/;
  // Properly handles both '*' and '/*' (from joinPath) as catch-all wildcards
  if (path === '*' || path === '/*' || path.endsWith('/*')) return /^\/.*$/;

  const parts = path.split(/(:[^/]+)/g);
  const escaped = parts
    .map((part) => (part.startsWith(':') ? '([^/]+)' : escapeRegex(part)))
    .join('');

  const withLeading = escaped.startsWith('/') ? escaped : `/${escaped}`;
  return new RegExp(`^${withLeading}\\/?$`);
}

export interface RouteTitle {
  pattern: RegExp;
  title: string;
  titleKey?: string;
}

export const ROUTE_TITLES: RouteTitle[] = [];

function joinPath(base: string, child: string): string {
  if (!child) return base || '/';
  if (child.startsWith('/')) return child;
  if (!base || base === '/') return `/${child}`;
  return base.endsWith('/') ? `${base}${child}` : `${base}/${child}`;
}

function buildRouteTitles(routes: RouteConfig[], basePath = ''): void {
  const wildcards: RouteTitle[] = [];

  function walk(list: RouteConfig[], currentBase: string): void {
    for (const route of list) {
      if (route.title || route.titleKey) {
        const fullPath = route.index
          ? currentBase || '/'
          : joinPath(currentBase, route.path ?? '');
        const entry: RouteTitle = {
          pattern: buildRegexPattern(fullPath, route.index),
          title: route.title ?? '',
          titleKey: route.titleKey,
        };
        // Push wildcards last so specific routes always match first
        if (route.path === '*') {
          wildcards.push(entry);
        } else {
          ROUTE_TITLES.push(entry);
        }
      }
      if (route.children) {
        const nextBase =
          route.path && route.path !== '/'
            ? joinPath(currentBase, route.path)
            : currentBase;
        walk(route.children, nextBase);
      }
    }
  }

  ROUTE_TITLES.length = 0; // Ensure HMR idempotency
  walk(routes, basePath);
  ROUTE_TITLES.push(...wildcards);
}

buildRouteTitles(routeConfig);

/* ══════════════════════════════════════════════════════════════════════════
 * SECURITY & RESILIENCE ROUTE WRAPPER
 * ════════════════════════════════════════════════════════════════════════ */

function wrapElement(route: RouteConfig): ReactNode {
  const isLayout = Array.isArray(route.children) && route.children.length > 0;
  const resolvedLabel = route.errorLabel ?? route.title;

  // 1. Wrap leaf routes (and AppLayout shell) inside ErrorBoundary + Suspense
  let el: ReactNode = (
    <ErrorBoundaryWrapper label={resolvedLabel}>
      {route.element}
    </ErrorBoundaryWrapper>
  );

  // 2. Apply Auth & RBAC Guards OUTSIDE ErrorBoundaryWrapper/Suspense
  //    so unauthenticated/unauthorized users redirect immediately without downloading chunks.
  const needsRoleCheck = Array.isArray(route.roles) && route.roles.length > 0;

  if (route.type === 'public') {
    el = <PublicOnly>{el}</PublicOnly>;
  } else if (route.type === 'protected' || needsRoleCheck) {
    el = <Protected roles={route.roles}>{el}</Protected>;
  }

  return isLayout ? el : el;
}

/* ══════════════════════════════════════════════════════════════════════════
 * SPATIAL MOTION & TOP OPTICAL PROGRESS SHELL
 * ════════════════════════════════════════════════════════════════════════ */

const EASE_APPLE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

const PublicRouteMotion = memo(function PublicRouteMotion({
  children,
}: {
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.992 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.995 }}
      transition={{ duration: reduced ? 0.14 : 0.26, ease: EASE_APPLE }}
      className="min-h-dvh w-full transform-gpu"
    >
      {children}
    </motion.div>
  );
});

const TopOpticalProgressFallback = memo(function TopOpticalProgressFallback() {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden bg-transparent pt-[env(safe-area-inset-top,0px)]"
      >
        <motion.div
          className="h-full w-full"
          style={{
            background:
              'linear-gradient(90deg, #007AFF 0%, #AF52DE 50%, #34C759 100%)',
            boxShadow: '0 0 12px rgba(0, 122, 255, 0.6)',
          }}
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.15, ease: 'easeInOut' }}
        />
      </div>
      <PageFallback />
    </>
  );
});

function renderRoute(route: RouteConfig, index: number): ReactNode {
  const key = route.path || (route.index ? `index-${index}` : `route-${index}`);

  if (route.children) {
    return (
      <Route key={key} path={route.path} element={wrapElement(route)}>
        {route.children.map((child, childIdx) => renderRoute(child, childIdx))}
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
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
  '/terms',
  '/privacy',
  '/tg-app',
  '/verify',
] as const;

export function AppRoutes() {
  const location = useLocation();

  const isStandalonePublic = STANDALONE_PUBLIC_PREFIXES.some(
    (prefix) =>
      location.pathname === prefix || location.pathname.startsWith(`${prefix}/`),
  );

  return (
    <Suspense fallback={<TopOpticalProgressFallback />}>
      {isStandalonePublic ? (
        <AnimatePresence mode="wait" initial={false}>
          <PublicRouteMotion key={location.pathname}>
            <Routes location={location}>
              {routeConfig.map((route, i) => renderRoute(route, i))}
            </Routes>
          </PublicRouteMotion>
        </AnimatePresence>
      ) : (
        <Routes>
          {routeConfig.map((route, i) => renderRoute(route, i))}
        </Routes>
      )}
    </Suspense>
  );
}

export default AppRoutes;