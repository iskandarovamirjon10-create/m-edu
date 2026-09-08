import { lazy, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageLoader, ToastHost } from '@/components/ui';

// Lazy-loaded pages for code splitting
const LoginPage = lazy(() =>
  import('@/pages/Login').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('@/pages/Register').then((m) => ({ default: m.RegisterPage })),
);
const AuthCallbackPage = lazy(() =>
  import('@/pages/AuthCallback').then((m) => ({ default: m.AuthCallbackPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPasswordPage })),
);
const TermsPage = lazy(() =>
  import('@/pages/Terms').then((m) => ({ default: m.TermsPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/Privacy').then((m) => ({ default: m.PrivacyPage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })),
);
const StudentsPage = lazy(() =>
  import('@/pages/Students').then((m) => ({ default: m.StudentsPage })),
);
const StudentDetailPage = lazy(() =>
  import('@/pages/StudentDetail').then((m) => ({ default: m.StudentDetailPage })),
);
const StudentFormPage = lazy(() =>
  import('@/pages/StudentForm').then((m) => ({ default: m.StudentFormPage })),
);
const TeachersPage = lazy(() =>
  import('@/pages/Teachers').then((m) => ({ default: m.TeachersPage })),
);
const GroupsPage = lazy(() =>
  import('@/pages/Groups').then((m) => ({ default: m.GroupsPage })),
);
const GroupDetailPage = lazy(() =>
  import('@/pages/GroupDetail').then((m) => ({ default: m.GroupDetailPage })),
);
const CoursesPage = lazy(() =>
  import('@/pages/Courses').then((m) => ({ default: m.CoursesPage })),
);
const AttendancePage = lazy(() =>
  import('@/pages/Attendance').then((m) => ({ default: m.AttendancePage })),
);
const FaceRecognitionPage = lazy(() =>
  import('@/pages/FaceRecognition').then((m) => ({ default: m.FaceRecognitionPage })),
);
const FaceEnrollmentPage = lazy(() =>
  import('@/pages/FaceEnrollment').then((m) => ({ default: m.FaceEnrollmentPage })),
);
const PaymentsPage = lazy(() =>
  import('@/pages/Payments').then((m) => ({ default: m.PaymentsPage })),
);
const ExpensesPage = lazy(() =>
  import('@/pages/Expenses').then((m) => ({ default: m.ExpensesPage })),
);
const LeadsPage = lazy(() =>
  import('@/pages/Leads').then((m) => ({ default: m.LeadsPage })),
);
const CamerasPage = lazy(() =>
  import('@/pages/Cameras').then((m) => ({ default: m.CamerasPage })),
);
const UsersPage = lazy(() =>
  import('@/pages/Users').then((m) => ({ default: m.UsersPage })),
);
const AuditPage = lazy(() =>
  import('@/pages/Audit').then((m) => ({ default: m.AuditPage })),
);
const AuditTimelinePage = lazy(() =>
  import('@/pages/AuditTimeline').then((m) => ({ default: m.AuditTimelinePage })),
);
const UniversalSearchPage = lazy(() =>
  import('@/pages/UniversalSearch').then((m) => ({ default: m.UniversalSearchPage })),
);
const DataQualityCenterPage = lazy(() =>
  import('@/pages/DataQualityCenter').then((m) => ({ default: m.DataQualityCenterPage })),
);
const DocumentsPage = lazy(() =>
  import('@/pages/Documents').then((m) => ({ default: m.DocumentsPage })),
);
const ResourceBookingPage = lazy(() =>
  import('@/pages/ResourceBooking').then((m) => ({ default: m.ResourceBookingPage })),
);
const FeatureFlagsPage = lazy(() =>
  import('@/pages/FeatureFlags').then((m) => ({ default: m.FeatureFlagsPage })),
);
const SecurityCenterPage = lazy(() =>
  import('@/pages/SecurityCenter').then((m) => ({ default: m.SecurityCenterPage })),
);
const SystemHealthPage = lazy(() =>
  import('@/pages/SystemHealth').then((m) => ({ default: m.SystemHealthPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })),
);
const HomeworkPage = lazy(() =>
  import('@/pages/Homework').then((m) => ({ default: m.HomeworkPage })),
);
const GroupFormPage = lazy(() =>
  import('@/pages/GroupForm').then((m) => ({ default: m.GroupFormPage })),
);
const GradesPage = lazy(() =>
  import('@/pages/Grades').then((m) => ({ default: m.GradesPage })),
);
const SchedulePage = lazy(() =>
  import('@/pages/Schedule').then((m) => ({ default: m.SchedulePage })),
);

// v2 premium module pages
const LibraryPage = lazy(() =>
  import('@/pages/Library').then((m) => ({ default: m.LibraryPage })),
);
const HRPage = lazy(() =>
  import('@/pages/HR').then((m) => ({ default: m.HRPage })),
);
const ExamsPage = lazy(() =>
  import('@/pages/Exams').then((m) => ({ default: m.ExamsPage })),
);
const CertificatesPage = lazy(() =>
  import('@/pages/Certificates').then((m) => ({ default: m.CertificatesPage })),
);
const InventoryPage = lazy(() =>
  import('@/pages/Inventory').then((m) => ({ default: m.InventoryPage })),
);
const EarlyWarningPage = lazy(() =>
  import('@/pages/EarlyWarning').then((m) => ({ default: m.EarlyWarningPage })),
);
const AcademicRiskPage = lazy(() =>
  import('@/pages/AcademicRisk').then((m) => ({ default: m.AcademicRiskPage })),
);
const TeacherWorkloadPage = lazy(() =>
  import('@/pages/TeacherWorkload').then((m) => ({ default: m.TeacherWorkloadPage })),
);
const ForecastingPage = lazy(() =>
  import('@/pages/Forecasting').then((m) => ({ default: m.ForecastingPage })),
);
const ImportExportPage = lazy(() =>
  import('@/pages/ImportExport').then((m) => ({ default: m.ImportExportPage })),
);
const RelationshipGraphPage = lazy(() =>
  import('@/pages/RelationshipGraph').then((m) => ({ default: m.RelationshipGraphPage })),
);
const NotificationsCenterPage = lazy(() =>
  import('@/pages/NotificationsCenter').then((m) => ({ default: m.NotificationsCenterPage })),
);
const WhatChangedPage = lazy(() =>
  import('@/pages/WhatChanged').then((m) => ({ default: m.WhatChangedPage })),
);

const NotFoundPage = lazy(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })),
);

// Create query client with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

// Loading fallback component
function PageFallback({ label = 'Loading page…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <PageLoader label={label} />
    </div>
  );
}

// Error boundary wrapper — catches runtime render errors (not just
// lazy-load failures) and shows a branded, actionable fallback.
function ErrorBoundaryWrapper({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={<PageFallback label={`Loading ${label ?? 'page'}…`} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

// Route → document.title map, so every screen gets a professional tab title
// (e.g. "Students — M-EDU") without each page managing it manually.
const ROUTE_TITLES: Array<{ pattern: RegExp; title: string }> = [
  { pattern: /^\/$/, title: 'Dashboard' },
  { pattern: /^\/students\/new$/, title: 'New Student' },
  { pattern: /^\/students\/([^/]+)\/edit$/, title: 'Edit Student' },
  { pattern: /^\/students\/([^/]+)$/, title: 'Student' },
  { pattern: /^\/students$/, title: 'Students' },
  { pattern: /^\/teachers$/, title: 'Teachers' },
  { pattern: /^\/groups\/new$/, title: 'New Group' },
  { pattern: /^\/groups\/([^/]+)\/edit$/, title: 'Edit Group' },
  { pattern: /^\/groups\/([^/]+)$/, title: 'Group' },
  { pattern: /^\/groups$/, title: 'Groups' },
  { pattern: /^\/courses$/, title: 'Courses' },
  { pattern: /^\/attendance$/, title: 'Attendance' },
  { pattern: /^\/face\/enroll$/, title: 'Face Enrollment' },
  { pattern: /^\/face$/, title: 'Face Recognition' },
  { pattern: /^\/payments$/, title: 'Payments' },
  { pattern: /^\/expenses$/, title: 'Expenses' },
  { pattern: /^\/leads$/, title: 'Leads' },
  { pattern: /^\/cameras$/, title: 'Cameras' },
  { pattern: /^\/users$/, title: 'Users' },
  { pattern: /^\/audit$/, title: 'Audit Log' },
  { pattern: /^\/audit-timeline$/, title: 'Audit Timeline' },
  { pattern: /^\/search$/, title: 'Search' },
  { pattern: /^\/data-quality$/, title: 'Data Quality' },
  { pattern: /^\/documents$/, title: 'Documents' },
  { pattern: /^\/resources$/, title: 'Resource Booking' },
  { pattern: /^\/feature-flags$/, title: 'Feature Flags' },
  { pattern: /^\/security$/, title: 'Security Center' },
  { pattern: /^\/system-health$/, title: 'System Health' },
  { pattern: /^\/settings$/, title: 'Settings' },
  { pattern: /^\/homework$/, title: 'Homework' },
  { pattern: /^\/grades$/, title: 'Grades' },
  { pattern: /^\/schedule$/, title: 'Schedule' },
  { pattern: /^\/library$/, title: 'Library' },
  { pattern: /^\/hr$/, title: 'HR & Payroll' },
  { pattern: /^\/exams$/, title: 'Exams' },
  { pattern: /^\/certificates$/, title: 'Certificates' },
  { pattern: /^\/inventory$/, title: 'Inventory' },
  { pattern: /^\/early-warning$/, title: 'Early Warning' },
  { pattern: /^\/academic-risk$/, title: 'Academic Risk' },
  { pattern: /^\/teacher-workload$/, title: 'Teacher Workload' },
  { pattern: /^\/forecast$/, title: 'Forecasting' },
  { pattern: /^\/import-export$/, title: 'Import / Export' },
  { pattern: /^\/relationships$/, title: 'Relationship Graph' },
  { pattern: /^\/notifications$/, title: 'Notifications' },
  { pattern: /^\/what-changed$/, title: 'What Changed?' },
  { pattern: /^\/404$/, title: 'Page Not Found' },
  { pattern: /^\/login$/, title: 'Sign In' },
  { pattern: /^\/register$/, title: 'Create Account' },
  { pattern: /^\/forgot-password$/, title: 'Reset Password' },
  { pattern: /^\/reset-password$/, title: 'Set New Password' },
  { pattern: /^\/terms$/, title: 'Terms of Service' },
  { pattern: /^\/privacy$/, title: 'Privacy Policy' },
];

function DocumentTitleManager() {
  const location = useLocation();
  useEffect(() => {
    const match = ROUTE_TITLES.find((r) => r.pattern.test(location.pathname));
    document.title = match ? `${match.title} — M-EDU` : 'M-EDU';
  }, [location.pathname]);
  return null;
}

// Protected route component
export function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Loading your session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public-only route component
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader label="Loading…" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Route transition wrapper
function RouteTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div
      key={location.pathname}
      className="animate-in fade-in duration-300"
      style={{ animationFillMode: 'both' }}
    >
      {children}
    </div>
  );
}

export default function App() {
  // Memoize routes to prevent unnecessary re-renders
  const routes = useMemo(
    () => (
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicOnly>
              <ErrorBoundaryWrapper>
                <LoginPage />
              </ErrorBoundaryWrapper>
            </PublicOnly>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnly>
              <ErrorBoundaryWrapper>
                <RegisterPage />
              </ErrorBoundaryWrapper>
            </PublicOnly>
          }
        />
        <Route
          path="/auth/callback"
          element={
            <ErrorBoundaryWrapper>
              <AuthCallbackPage />
            </ErrorBoundaryWrapper>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnly>
              <ErrorBoundaryWrapper>
                <ForgotPasswordPage />
              </ErrorBoundaryWrapper>
            </PublicOnly>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicOnly>
              <ErrorBoundaryWrapper>
                <ResetPasswordPage />
              </ErrorBoundaryWrapper>
            </PublicOnly>
          }
        />
        <Route
          path="/terms"
          element={
            <ErrorBoundaryWrapper>
              <TermsPage />
            </ErrorBoundaryWrapper>
          }
        />
        <Route
          path="/privacy"
          element={
            <ErrorBoundaryWrapper>
              <PrivacyPage />
            </ErrorBoundaryWrapper>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <Protected>
              <AppLayout />
            </Protected>
          }
        >
          <Route
            index
            element={
              <ErrorBoundaryWrapper>
                <DashboardPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="students"
            element={
              <ErrorBoundaryWrapper>
                <StudentsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="students/new"
            element={
              <ErrorBoundaryWrapper>
                <StudentFormPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="students/:id"
            element={
              <ErrorBoundaryWrapper>
                <StudentDetailPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="students/:id/edit"
            element={
              <ErrorBoundaryWrapper>
                <StudentFormPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="teachers"
            element={
              <ErrorBoundaryWrapper>
                <TeachersPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="groups"
            element={
              <ErrorBoundaryWrapper>
                <GroupsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="groups/:id"
            element={
              <ErrorBoundaryWrapper>
                <GroupDetailPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="groups/new"
            element={
              <ErrorBoundaryWrapper>
                <GroupFormPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="groups/:id/edit"
            element={
              <ErrorBoundaryWrapper>
                <GroupFormPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="courses"
            element={
              <ErrorBoundaryWrapper>
                <CoursesPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="attendance"
            element={
              <ErrorBoundaryWrapper>
                <AttendancePage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="face"
            element={
              <ErrorBoundaryWrapper>
                <FaceRecognitionPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="face/enroll"
            element={
              <ErrorBoundaryWrapper>
                <FaceEnrollmentPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="payments"
            element={
              <ErrorBoundaryWrapper>
                <PaymentsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="expenses"
            element={
              <ErrorBoundaryWrapper>
                <ExpensesPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="leads"
            element={
              <ErrorBoundaryWrapper>
                <LeadsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="cameras"
            element={
              <ErrorBoundaryWrapper>
                <CamerasPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="users"
            element={
              <ErrorBoundaryWrapper>
                <UsersPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="audit"
            element={
              <ErrorBoundaryWrapper>
                <AuditPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="audit-timeline"
            element={
              <ErrorBoundaryWrapper>
                <AuditTimelinePage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="search"
            element={
              <ErrorBoundaryWrapper>
                <UniversalSearchPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="data-quality"
            element={
              <ErrorBoundaryWrapper>
                <DataQualityCenterPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="documents"
            element={
              <ErrorBoundaryWrapper>
                <DocumentsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="resources"
            element={
              <ErrorBoundaryWrapper>
                <ResourceBookingPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="feature-flags"
            element={
              <ErrorBoundaryWrapper>
                <FeatureFlagsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="security"
            element={
              <ErrorBoundaryWrapper>
                <SecurityCenterPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="system-health"
            element={
              <ErrorBoundaryWrapper>
                <SystemHealthPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="settings"
            element={
              <ErrorBoundaryWrapper>
                <SettingsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="homework"
            element={
              <ErrorBoundaryWrapper>
                <HomeworkPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="grades"
            element={
              <ErrorBoundaryWrapper>
                <GradesPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="schedule"
            element={
              <ErrorBoundaryWrapper>
                <SchedulePage />
              </ErrorBoundaryWrapper>
            }
          />
          {/* v2 premium module routes */}
          <Route
            path="library"
            element={
              <ErrorBoundaryWrapper>
                <LibraryPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="hr"
            element={
              <ErrorBoundaryWrapper>
                <HRPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="exams"
            element={
              <ErrorBoundaryWrapper>
                <ExamsPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="certificates"
            element={
              <ErrorBoundaryWrapper>
                <CertificatesPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="inventory"
            element={
              <ErrorBoundaryWrapper>
                <InventoryPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="early-warning"
            element={
              <ErrorBoundaryWrapper>
                <EarlyWarningPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="academic-risk"
            element={
              <ErrorBoundaryWrapper>
                <AcademicRiskPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="teacher-workload"
            element={
              <ErrorBoundaryWrapper>
                <TeacherWorkloadPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="forecast"
            element={
              <ErrorBoundaryWrapper>
                <ForecastingPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="import-export"
            element={
              <ErrorBoundaryWrapper>
                <ImportExportPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="relationships"
            element={
              <ErrorBoundaryWrapper>
                <RelationshipGraphPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="notifications"
            element={
              <ErrorBoundaryWrapper>
                <NotificationsCenterPage />
              </ErrorBoundaryWrapper>
            }
          />
          <Route
            path="what-changed"
            element={
              <ErrorBoundaryWrapper>
                <WhatChangedPage />
              </ErrorBoundaryWrapper>
            }
          />
          {/* Unknown routes inside the app shell → branded 404 page */}
          <Route
            path="*"
            element={
              <ErrorBoundaryWrapper label="Page not found">
                <NotFoundPage />
              </ErrorBoundaryWrapper>
            }
          />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    ),
    [],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <DocumentTitleManager />
          <RouteTransition>{routes}</RouteTransition>
          {/* Global toast host — every useToast() call in the app renders here */}
          <ToastHost />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}