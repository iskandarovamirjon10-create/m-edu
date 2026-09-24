import { lazy, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ErrorBoundaryWrapper, Protected, PublicOnly } from '../App';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() => import('@/pages/Login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/Register').then((m) => ({ default: m.RegisterPage })));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallback').then((m) => ({ default: m.AuthCallbackPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPasswordPage })));
const TermsPage = lazy(() => import('@/pages/Terms').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/Privacy').then((m) => ({ default: m.PrivacyPage })));
const DashboardPage = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const StudentsPage = lazy(() => import('@/pages/Students').then((m) => ({ default: m.StudentsPage })));
const StudentDetailPage = lazy(() => import('@/pages/StudentDetail').then((m) => ({ default: m.StudentDetailPage })));
const StudentFormPage = lazy(() => import('@/pages/StudentForm').then((m) => ({ default: m.StudentFormPage })));
const TeachersPage = lazy(() => import('@/pages/Teachers').then((m) => ({ default: m.TeachersPage })));
const GroupsPage = lazy(() => import('@/pages/Groups').then((m) => ({ default: m.GroupsPage })));
const GroupDetailPage = lazy(() => import('@/pages/GroupDetail').then((m) => ({ default: m.GroupDetailPage })));
const CoursesPage = lazy(() => import('@/pages/Courses').then((m) => ({ default: m.CoursesPage })));
const AttendancePage = lazy(() => import('@/pages/Attendance').then((m) => ({ default: m.AttendancePage })));
const FaceRecognitionPage = lazy(() => import('@/pages/FaceRecognition').then((m) => ({ default: m.FaceRecognitionPage })));
const FaceEnrollmentPage = lazy(() => import('@/pages/FaceEnrollment').then((m) => ({ default: m.FaceEnrollmentPage })));
const PaymentsPage = lazy(() => import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })));
const InvoicesPage = lazy(() => import('@/pages/Invoices').then((m) => ({ default: m.InvoicesPage })));
const ReportsPage = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.ReportsPage })));
const ExpensesPage = lazy(() => import('@/pages/Expenses').then((m) => ({ default: m.ExpensesPage })));
const LeadsPage = lazy(() => import('@/pages/Leads').then((m) => ({ default: m.LeadsPage })));
const CamerasPage = lazy(() => import('@/pages/Cameras').then((m) => ({ default: m.CamerasPage })));
const UsersPage = lazy(() => import('@/pages/Users').then((m) => ({ default: m.UsersPage })));
const AuditPage = lazy(() => import('@/pages/Audit').then((m) => ({ default: m.AuditPage })));
const AuditTimelinePage = lazy(() => import('@/pages/AuditTimeline').then((m) => ({ default: m.AuditTimelinePage })));
const UniversalSearchPage = lazy(() => import('@/pages/UniversalSearch').then((m) => ({ default: m.UniversalSearchPage })));
const DataQualityCenterPage = lazy(() => import('@/pages/DataQualityCenter').then((m) => ({ default: m.DataQualityCenterPage })));
const DocumentsPage = lazy(() => import('@/pages/Documents').then((m) => ({ default: m.DocumentsPage })));
const ResourceBookingPage = lazy(() => import('@/pages/ResourceBooking').then((m) => ({ default: m.ResourceBookingPage })));
const FeatureFlagsPage = lazy(() => import('@/pages/FeatureFlags').then((m) => ({ default: m.FeatureFlagsPage })));
const SecurityCenterPage = lazy(() => import('@/pages/SecurityCenter').then((m) => ({ default: m.SecurityCenterPage })));
const SystemHealthPage = lazy(() => import('@/pages/SystemHealth').then((m) => ({ default: m.SystemHealthPage })));
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })));
const HomeworkPage = lazy(() => import('@/pages/Homework').then((m) => ({ default: m.HomeworkPage })));
const GroupFormPage = lazy(() => import('@/pages/GroupForm').then((m) => ({ default: m.GroupFormPage })));
const GradesPage = lazy(() => import('@/pages/Grades').then((m) => ({ default: m.GradesPage })));
const SchedulePage = lazy(() => import('@/pages/Schedule').then((m) => ({ default: m.SchedulePage })));

// v2 premium module pages
const LibraryPage = lazy(() => import('@/pages/Library').then((m) => ({ default: m.LibraryPage })));
const HRPage = lazy(() => import('@/pages/HR').then((m) => ({ default: m.HRPage })));
const ExamsPage = lazy(() => import('@/pages/Exams').then((m) => ({ default: m.ExamsPage })));
const CertificatesPage = lazy(() => import('@/pages/Certificates').then((m) => ({ default: m.CertificatesPage })));
const InventoryPage = lazy(() => import('@/pages/Inventory').then((m) => ({ default: m.InventoryPage })));
const EarlyWarningPage = lazy(() => import('@/pages/EarlyWarning').then((m) => ({ default: m.EarlyWarningPage })));
const AcademicRiskPage = lazy(() => import('@/pages/AcademicRisk').then((m) => ({ default: m.AcademicRiskPage })));
const TeacherWorkloadPage = lazy(() => import('@/pages/TeacherWorkload').then((m) => ({ default: m.TeacherWorkloadPage })));
const ForecastingPage = lazy(() => import('@/pages/Forecasting').then((m) => ({ default: m.ForecastingPage })));
const ImportExportPage = lazy(() => import('@/pages/ImportExport').then((m) => ({ default: m.ImportExportPage })));
const RelationshipGraphPage = lazy(() => import('@/pages/RelationshipGraph').then((m) => ({ default: m.RelationshipGraphPage })));
const NotificationsCenterPage = lazy(() => import('@/pages/NotificationsCenter').then((m) => ({ default: m.NotificationsCenterPage })));
const WhatChangedPage = lazy(() => import('@/pages/WhatChanged').then((m) => ({ default: m.WhatChangedPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })));
const UnauthorizedPage = lazy(() => import('@/pages/Unauthorized').then((m) => ({ default: m.UnauthorizedPage })));

// Unrouted production-ready pages — now exposed
const ChatPage = lazy(() => import('@/pages/Chat').then((m) => ({ default: m.ChatPage })));
const ParentPortalPage = lazy(() => import('@/pages/ParentPortal').then((m) => ({ default: m.ParentPortalPage })));
const ExecutiveDashboardPage = lazy(() => import('@/pages/ExecutiveDashboard').then((m) => ({ default: m.ExecutiveDashboardPage })));
const AutomationEnginePage = lazy(() => import('@/pages/AutomationEngine').then((m) => ({ default: m.AutomationEnginePage })));
const PayrollPage = lazy(() => import('@/pages/Payroll').then((m) => ({ default: m.PayrollPage })));
const FinancialAnalyticsPage = lazy(() => import('@/pages/FinancialAnalytics').then((m) => ({ default: m.FinancialAnalyticsPage })));
const PayrollAnalyticsPage = lazy(() => import('@/pages/PayrollAnalytics').then((m) => ({ default: m.PayrollAnalyticsPage })));
const CRMAnalyticsPage = lazy(() => import('@/pages/CRMAnalytics').then((m) => ({ default: m.CRMAnalyticsPage })));
const FollowUpAutomationPage = lazy(() => import('@/pages/FollowUpAutomation').then((m) => ({ default: m.FollowUpAutomationPage })));
const BranchesPage = lazy(() => import('@/pages/Branches').then((m) => ({ default: m.BranchesPage })));
const DataGovernancePage = lazy(() => import('@/pages/DataGovernance').then((m) => ({ default: m.DataGovernancePage })));
const AnomalyDetectionPage = lazy(() => import('@/pages/AnomalyDetection').then((m) => ({ default: m.AnomalyDetectionPage })));

// Unrouted production-ready pages
const ApiKeysPage = lazy(() => import('@/pages/ApiKeys').then((m) => ({ default: m.ApiKeysPage })));
const ObservabilityPage = lazy(() => import('@/pages/Observability').then((m) => ({ default: m.ObservabilityPage })));
const PerformanceMonitorPage = lazy(() => import('@/pages/PerformanceMonitor').then((m) => ({ default: m.PerformanceMonitorPage })));
const ReconciliationPage = lazy(() => import('@/pages/Reconciliation').then((m) => ({ default: m.ReconciliationPage })));
const CommunicationHistoryPage = lazy(() => import('@/pages/CommunicationHistory').then((m) => ({ default: m.CommunicationHistoryPage })));

export type RouteConfig = {
  path?: string;
  index?: boolean;
  element: ReactNode;
  title?: string;
  /** i18n key for the document title (preferred over `title`). */
  titleKey?: string;
  pattern?: RegExp;
  type?: 'public' | 'protected' | 'none';
  children?: RouteConfig[];
  errorLabel?: string;
};

export const routeConfig: RouteConfig[] = [
  { path: '/login', element: <LoginPage />, type: 'public', title: 'Sign In', titleKey: 'nav.signIn' },
  { path: '/register', element: <RegisterPage />, type: 'public', title: 'Create Account', titleKey: 'nav.createAccount' },
  { path: '/auth/callback', element: <AuthCallbackPage />, type: 'none' },
  { path: '/forgot-password', element: <ForgotPasswordPage />, type: 'public', title: 'Reset Password', titleKey: 'auth.forgotPasswordTitle' },
  { path: '/reset-password', element: <ResetPasswordPage />, type: 'public', title: 'Set New Password', titleKey: 'auth.resetPasswordTitle' },
  { path: '/terms', element: <TermsPage />, type: 'none', title: 'Terms of Service', titleKey: 'terms.title' },
  { path: '/privacy', element: <PrivacyPage />, type: 'none', title: 'Privacy Policy', titleKey: 'privacy.title' },
  {
    path: '/',
    element: <AppLayout />,
    type: 'protected',
    children: [
      { index: true, element: <DashboardPage />, title: 'Dashboard', titleKey: 'nav.dashboard', pattern: /^\/$/ },
      { path: 'students', element: <StudentsPage />, title: 'Students', titleKey: 'nav.students', pattern: /^\/students$/ },
      { path: 'students/new', element: <StudentFormPage />, title: 'New Student', titleKey: 'students.formTitle' },
      { path: 'students/:id', element: <StudentDetailPage />, title: 'Student', titleKey: 'students.detailsTitle', pattern: /^\/students\/([^/]+)$/ },
      { path: 'students/:id/edit', element: <StudentFormPage />, title: 'Edit Student', titleKey: 'students.formTitle', pattern: /^\/students\/([^/]+)\/edit$/ },
      { path: 'teachers', element: <TeachersPage />, title: 'Teachers', titleKey: 'nav.teachers' },
      { path: 'groups', element: <GroupsPage />, title: 'Groups', titleKey: 'nav.groups', pattern: /^\/groups$/ },
      { path: 'groups/new', element: <GroupFormPage />, title: 'New Group', titleKey: 'groups.title' },
      { path: 'groups/:id', element: <GroupDetailPage />, title: 'Group', titleKey: 'groups.detailsTitle', pattern: /^\/groups\/([^/]+)$/ },
      { path: 'groups/:id/edit', element: <GroupFormPage />, title: 'Edit Group', titleKey: 'groups.title', pattern: /^\/groups\/([^/]+)\/edit$/ },
      { path: 'courses', element: <CoursesPage />, title: 'Courses', titleKey: 'nav.courses' },
      { path: 'attendance', element: <AttendancePage />, title: 'Attendance', titleKey: 'nav.attendance' },
      { path: 'face', element: <FaceRecognitionPage />, title: 'Face Recognition', titleKey: 'nav.faceRecognition', pattern: /^\/face$/ },
      { path: 'face/enroll', element: <FaceEnrollmentPage />, title: 'Face Enrollment', titleKey: 'faceEnrollment.title', pattern: /^\/face\/enroll$/ },
      { path: 'payments', element: <PaymentsPage />, title: 'Payments', titleKey: 'nav.payments' },
      { path: 'invoices', element: <InvoicesPage />, title: 'Invoices', titleKey: 'nav.invoices' },
      { path: 'reports', element: <ReportsPage />, title: 'Reports', titleKey: 'nav.reports' },
      { path: 'expenses', element: <ExpensesPage />, title: 'Expenses', titleKey: 'nav.expenses' },
      { path: 'leads', element: <LeadsPage />, title: 'Leads', titleKey: 'nav.leads' },
      { path: 'cameras', element: <CamerasPage />, title: 'Cameras', titleKey: 'nav.cameras' },
      { path: 'users', element: <UsersPage />, title: 'Users', titleKey: 'nav.users' },
      { path: 'audit', element: <AuditPage />, title: 'Audit Log', titleKey: 'nav.audit' },
      { path: 'audit-timeline', element: <AuditTimelinePage />, title: 'Audit Timeline', titleKey: 'auditTimeline.title' },
      { path: 'search', element: <UniversalSearchPage />, title: 'Search', titleKey: 'search.title' },
      { path: 'data-quality', element: <DataQualityCenterPage />, title: 'Data Quality' },
      { path: 'documents', element: <DocumentsPage />, title: 'Documents', titleKey: 'documents.title' },
      { path: 'resources', element: <ResourceBookingPage />, title: 'Resource Booking', titleKey: 'resourceBooking.title' },
      { path: 'feature-flags', element: <FeatureFlagsPage />, title: 'Feature Flags', titleKey: 'featureFlags.title' },
      { path: 'security', element: <SecurityCenterPage />, title: 'Security Center' },
      { path: 'system-health', element: <SystemHealthPage />, title: 'System Health', titleKey: 'systemHealth.title' },
      { path: 'settings', element: <SettingsPage />, title: 'Settings', titleKey: 'nav.settings' },
      { path: 'homework', element: <HomeworkPage />, title: 'Homework', titleKey: 'nav.homework' },
      { path: 'grades', element: <GradesPage />, title: 'Grades', titleKey: 'grades.title' },
      { path: 'schedule', element: <SchedulePage />, title: 'Schedule', titleKey: 'nav.schedule' },
      { path: 'library', element: <LibraryPage />, title: 'Library', titleKey: 'nav.library' },
      { path: 'hr', element: <HRPage />, title: 'HR & Payroll', titleKey: 'nav.hrPayroll' },
      { path: 'exams', element: <ExamsPage />, title: 'Exams', titleKey: 'nav.exams' },
      { path: 'certificates', element: <CertificatesPage />, title: 'Certificates', titleKey: 'nav.certificates' },
      { path: 'inventory', element: <InventoryPage />, title: 'Inventory', titleKey: 'nav.inventory' },
      { path: 'early-warning', element: <EarlyWarningPage />, title: 'Early Warning', titleKey: 'earlyWarning.title' },
      { path: 'academic-risk', element: <AcademicRiskPage />, title: 'Academic Risk', titleKey: 'academicRisk.title' },
      { path: 'teacher-workload', element: <TeacherWorkloadPage />, title: 'Teacher Workload', titleKey: 'teacherWorkload.title' },
      { path: 'forecast', element: <ForecastingPage />, title: 'Forecasting', titleKey: 'forecasting.title' },
      { path: 'import-export', element: <ImportExportPage />, title: 'Import / Export', titleKey: 'importExport.title' },
      { path: 'relationships', element: <RelationshipGraphPage />, title: 'Relationship Graph', titleKey: 'relationshipGraph.title' },
      { path: 'notifications', element: <NotificationsCenterPage />, title: 'Notifications', titleKey: 'notifications.title' },
      { path: 'what-changed', element: <WhatChangedPage />, title: 'What Changed?', titleKey: 'whatChanged.title' },
      // Newly exposed production-ready pages
      { path: 'chat', element: <ChatPage />, title: 'Chat', titleKey: 'chat.title' },
      { path: 'parent-portal', element: <ParentPortalPage />, title: 'Parent Portal', titleKey: 'parentPortal.title' },
      { path: 'executive-dashboard', element: <ExecutiveDashboardPage />, title: 'Executive Dashboard', titleKey: 'nav.executiveDashboard' },
      { path: 'automation', element: <AutomationEnginePage />, title: 'Automation', titleKey: 'nav.automation' },
      { path: 'payroll', element: <PayrollPage />, title: 'Payroll', titleKey: 'nav.payrollRuns' },
      { path: 'financial-analytics', element: <FinancialAnalyticsPage />, title: 'Financial Analytics', titleKey: 'nav.financialAnalytics' },
      { path: 'payroll-analytics', element: <PayrollAnalyticsPage />, title: 'Payroll Analytics', titleKey: 'nav.payrollAnalytics' },
      { path: 'crm-analytics', element: <CRMAnalyticsPage />, title: 'CRM Analytics', titleKey: 'nav.crmAnalytics' },
      { path: 'follow-up-automation', element: <FollowUpAutomationPage />, title: 'Follow-Up Automation', titleKey: 'nav.followUpRules' },
      { path: 'branches', element: <BranchesPage />, title: 'Branches', titleKey: 'nav.branches' },
      { path: 'data-governance', element: <DataGovernancePage />, title: 'Data Governance', titleKey: 'nav.dataGovernance' },
      { path: 'anomaly-detection', element: <AnomalyDetectionPage />, title: 'Anomaly Detection', titleKey: 'nav.anomalyDetection' },
      { path: 'api-keys', element: <ApiKeysPage />, title: 'API Keys', titleKey: 'apiKeys.title' },
      { path: 'observability', element: <ObservabilityPage />, title: 'Observability', titleKey: 'obs.title' },
      { path: 'performance', element: <PerformanceMonitorPage />, title: 'Performance Monitor', titleKey: 'performance.title' },
      { path: 'reconciliation', element: <ReconciliationPage />, title: 'Reconciliation', titleKey: 'reconciliation.title' },
      { path: 'communication-history', element: <CommunicationHistoryPage />, title: 'Communication History', titleKey: 'communication.title' },
      { path: 'unauthorized', element: <UnauthorizedPage />, type: 'none', title: 'Unauthorized', titleKey: 'error.forbiddenTitle' },
      { path: '*', element: <NotFoundPage />, type: 'none', title: 'Page Not Found', titleKey: 'error.notFoundTitle', errorLabel: 'Page not found' },
    ],
  },
  { path: '*', element: <Navigate to="/" replace />, type: 'none' },
];

function buildRegexPattern(path: string, index?: boolean): RegExp {
  if (index || path === '') return /^\/$/;
  if (path === '*') return /^\/404$/;
  
  // Convert simple parameters like :id to regex groups
  let regexStr = path.replace(/:[^/]+/g, '([^/]+)');
  
  if (!regexStr.startsWith('/')) {
    regexStr = '/' + regexStr;
  }
  
  return new RegExp(`^${regexStr}$`);
}

export const ROUTE_TITLES: Array<{ pattern: RegExp; title: string; titleKey?: string }> = [];

function extractTitles(routes: RouteConfig[], basePath = '') {
  for (const route of routes) {
    if (route.title || route.titleKey) {
      let pattern = route.pattern;
      if (!pattern) {
        let fullPath = basePath;
        if (route.path) {
          fullPath = basePath + (basePath.endsWith('/') || route.path.startsWith('/') ? '' : '/') + route.path;
        }
        pattern = buildRegexPattern(fullPath, route.index);
      }
      ROUTE_TITLES.push({ pattern, title: route.title ?? '', titleKey: route.titleKey });
    }
    if (route.children) {
      let nextBase = basePath;
      if (route.path && route.path !== '/') {
        nextBase = basePath + (basePath.endsWith('/') || route.path.startsWith('/') ? '' : '/') + route.path;
      }
      extractTitles(route.children, nextBase);
    }
  }
}

extractTitles(routeConfig);

function wrapElement(route: RouteConfig) {
  let el = route.element;
  
  // Wrap in ErrorBoundaryWrapper if it's not a Navigate or AppLayout
  if (route.path !== '*' && route.path !== '/' && !route.children) {
    el = <ErrorBoundaryWrapper label={route.errorLabel}>{el}</ErrorBoundaryWrapper>;
  }

  if (route.type === 'public') {
    return <PublicOnly>{el}</PublicOnly>;
  }
  if (route.type === 'protected') {
    return <Protected>{el}</Protected>;
  }
  return el;
}

export function AppRoutes() {
  const renderRoute = (route: RouteConfig, i: number) => {
    if (route.children) {
      return (
        <Route key={route.path || i} path={route.path} element={wrapElement(route)}>
          {route.children.map((child, j) => renderRoute(child, j))}
        </Route>
      );
    }
    return (
      <Route
        key={route.path || i}
        index={route.index}
        path={route.index ? undefined : route.path}
        element={wrapElement(route)}
      />
    );
  }

  return <Routes>{routeConfig.map((route, i) => renderRoute(route, i))}</Routes>;
}
