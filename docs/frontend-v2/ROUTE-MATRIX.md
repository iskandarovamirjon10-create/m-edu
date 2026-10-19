# M-EDU FRONTEND V2 — COMPLETE ROUTE MATRIX

Generated: 2026-10-11
Router: `apps/web/src/routes/index.tsx`

## Route Summary
Total Discovered Routes: 92

| Route Path | Screen Component | Access Type | Role Access | Document Title | Migration Status | Verification |
|------------|------------------|:-----------:|:-----------:|----------------|:----------------:|:------------:|
| `/login` | `LoginPage` | `public` | `ALL` | Sign In | VERIFIED | PASSED |
| `/register` | `RegisterPage` | `public` | `ALL` | Create Account | VERIFIED | PASSED |
| `/auth/callback` | `AuthCallbackPage` | `none` | `ALL` | AuthCallbackPage | VERIFIED | PASSED |
| `/forgot-password` | `ForgotPasswordPage` | `public` | `ALL` | Reset Password | VERIFIED | PASSED |
| `/reset-password` | `ResetPasswordPage` | `public` | `ALL` | Set New Password | VERIFIED | PASSED |
| `/terms` | `TermsPage` | `none` | `ALL` | Terms of Service | VERIFIED | PASSED |
| `/privacy` | `PrivacyPage` | `none` | `ALL` | Privacy Policy | VERIFIED | PASSED |
| `/tg-app` | `TelegramWebAppPage` | `none` | `ALL` | Telegram WebApp Hub | VERIFIED | PASSED |
| `/verify` | `CertificateVerifyPage` | `none` | `ALL` | Verify Certificate | VERIFIED | PASSED |
| `/verify/:code` | `CertificateVerifyPage` | `none` | `ALL` | Verify Certificate | VERIFIED | PASSED |
| `/` | `DashboardPage` | `protected` | `ALL` | Dashboard | VERIFIED | PASSED |
| `students` | `StudentsPage` | `protected` | `STAFF_ROLES` | Students | VERIFIED | PASSED |
| `students/new` | `StudentFormPage` | `protected` | `STAFF_ROLES` | New Student | VERIFIED | PASSED |
| `students/:id` | `StudentDetailPage` | `protected` | `STAFF_ROLES` | Student | VERIFIED | PASSED |
| `students/:id/360` | `Student360Page` | `protected` | `STAFF_ROLES` | Student 360 | VERIFIED | PASSED |
| `students/:id/edit` | `StudentFormPage` | `protected` | `STAFF_ROLES` | Edit Student | VERIFIED | PASSED |
| `subjects` | `SubjectsPage` | `protected` | `ALL` | Subjects | VERIFIED | PASSED |
| `curriculum` | `CurriculumPage` | `protected` | `ALL` | Curriculum | VERIFIED | PASSED |
| `assignments` | `AssignmentsPage` | `protected` | `ALL` | Assignments | VERIFIED | PASSED |
| `assessment` | `AssessmentPage` | `protected` | `ALL` | Assessment | VERIFIED | PASSED |
| `teachers` | `TeachersPage` | `protected` | `STAFF_ROLES` | Teachers | VERIFIED | PASSED |
| `teachers/:id` | `TeachersPage` | `protected` | `STAFF_ROLES` | Teachers | VERIFIED | PASSED |
| `groups` | `GroupsPage` | `protected` | `ALL` | Groups | VERIFIED | PASSED |
| `groups/new` | `GroupFormPage` | `protected` | `STAFF_ROLES` | New Group | VERIFIED | PASSED |
| `groups/:id` | `GroupDetailPage` | `protected` | `ALL` | Group | VERIFIED | PASSED |
| `groups/:id/edit` | `GroupFormPage` | `protected` | `STAFF_ROLES` | Edit Group | VERIFIED | PASSED |
| `courses` | `CoursesPage` | `protected` | `ALL` | Courses | VERIFIED | PASSED |
| `courses/:id` | `CoursesPage` | `protected` | `ALL` | Courses | VERIFIED | PASSED |
| `attendance` | `AttendancePage` | `protected` | `ALL` | Attendance | VERIFIED | PASSED |
| `face` | `FaceRecognitionPage` | `protected` | `STAFF_ROLES` | Face Recognition | VERIFIED | PASSED |
| `face/enroll` | `FaceEnrollmentPage` | `protected` | `STAFF_ROLES` | Face Enrollment | VERIFIED | PASSED |
| `payments` | `PaymentsPage` | `protected` | `STAFF_ROLES` | Payments | VERIFIED | PASSED |
| `payments/:id` | `PaymentsPage` | `protected` | `STAFF_ROLES` | Payments | VERIFIED | PASSED |
| `invoices` | `InvoicesPage` | `protected` | `STAFF_ROLES` | Invoices | VERIFIED | PASSED |
| `reports` | `ReportsPage` | `protected` | `STAFF_ROLES` | Reports | VERIFIED | PASSED |
| `expenses` | `ExpensesPage` | `protected` | `STAFF_ROLES` | Expenses | VERIFIED | PASSED |
| `leads` | `LeadsPage` | `protected` | `STAFF_ROLES` | Leads | VERIFIED | PASSED |
| `leads/:id` | `LeadsPage` | `protected` | `STAFF_ROLES` | Leads | VERIFIED | PASSED |
| `cameras` | `CamerasPage` | `protected` | `STAFF_ROLES` | Cameras | VERIFIED | PASSED |
| `users` | `UsersPage` | `protected` | `STAFF_ROLES` | Users | VERIFIED | PASSED |
| `users/:id` | `UsersPage` | `protected` | `STAFF_ROLES` | Users | VERIFIED | PASSED |
| `audit` | `AuditPage` | `protected` | `STAFF_ROLES` | Audit Log | VERIFIED | PASSED |
| `audit-timeline` | `AuditTimelinePage` | `protected` | `STAFF_ROLES` | Audit Timeline | VERIFIED | PASSED |
| `search` | `UniversalSearchPage` | `protected` | `ALL` | Search | VERIFIED | PASSED |
| `data-quality` | `DataQualityCenterPage` | `protected` | `STAFF_ROLES` | Data Quality | VERIFIED | PASSED |
| `documents` | `DocumentsPage` | `protected` | `ALL` | Documents | VERIFIED | PASSED |
| `resources` | `ResourceBookingPage` | `protected` | `ALL` | Resource Booking | VERIFIED | PASSED |
| `feature-flags` | `FeatureFlagsPage` | `protected` | `STAFF_ROLES` | Feature Flags | VERIFIED | PASSED |
| `security` | `SecurityCenterPage` | `protected` | `STAFF_ROLES` | Security Center | VERIFIED | PASSED |
| `system-health` | `SystemHealthPage` | `protected` | `STAFF_ROLES` | System Health | VERIFIED | PASSED |
| `settings` | `SettingsPage` | `protected` | `ALL` | Settings | VERIFIED | PASSED |
| `homework` | `HomeworkPage` | `protected` | `ALL` | Homework | VERIFIED | PASSED |
| `grades` | `GradesPage` | `protected` | `ALL` | Grades | VERIFIED | PASSED |
| `schedule` | `SchedulePage` | `protected` | `ALL` | Schedule | VERIFIED | PASSED |
| `library` | `LibraryPage` | `protected` | `ALL` | Library | VERIFIED | PASSED |
| `library/books/:id` | `LibraryPage` | `protected` | `ALL` | Library | VERIFIED | PASSED |
| `exams` | `ExamsPage` | `protected` | `ALL` | Exams | VERIFIED | PASSED |
| `certificates` | `CertificatesPage` | `protected` | `ALL` | Certificates | VERIFIED | PASSED |
| `certificates/:id` | `CertificatesPage` | `protected` | `ALL` | Certificates | VERIFIED | PASSED |
| `hr` | `HRPage` | `protected` | `STAFF_ROLES` | HR & Payroll | VERIFIED | PASSED |
| `hr/employees/:id` | `HRPage` | `protected` | `STAFF_ROLES` | HR & Payroll | VERIFIED | PASSED |
| `inventory` | `InventoryPage` | `protected` | `STAFF_ROLES` | Inventory | VERIFIED | PASSED |
| `early-warning` | `EarlyWarningPage` | `protected` | `STAFF_ROLES` | Early Warning | VERIFIED | PASSED |
| `academic-risk` | `AcademicRiskPage` | `protected` | `STAFF_ROLES` | Academic Risk | VERIFIED | PASSED |
| `gamification` | `GamificationHubPage` | `protected` | `ALL` | Gamification & M-Coins | VERIFIED | PASSED |
| `teacher-workload` | `TeacherWorkloadPage` | `protected` | `STAFF_ROLES` | Teacher Workload | VERIFIED | PASSED |
| `forecast` | `ForecastingPage` | `protected` | `STAFF_ROLES` | Forecasting | VERIFIED | PASSED |
| `import-export` | `ImportExportPage` | `protected` | `STAFF_ROLES` | Import / Export | VERIFIED | PASSED |
| `relationships` | `RelationshipGraphPage` | `protected` | `STAFF_ROLES` | Relationship Graph | VERIFIED | PASSED |
| `notifications` | `NotificationsCenterPage` | `protected` | `ALL` | Notifications | VERIFIED | PASSED |
| `what-changed` | `WhatChangedPage` | `protected` | `ALL` | What Changed? | VERIFIED | PASSED |
| `chat` | `ChatPage` | `protected` | `ALL` | Chat | VERIFIED | PASSED |
| `ai-copilot` | `AiCopilotPage` | `protected` | `STAFF_ROLES` | AI Copilot | VERIFIED | PASSED |
| `parent-portal` | `ParentPortalPage` | `protected` | `['PARENT']` | Parent Portal | VERIFIED | PASSED |
| `telegram` | `TelegramPage` | `protected` | `ALL` | Telegram | VERIFIED | PASSED |
| `executive-dashboard` | `ExecutiveDashboardPage` | `protected` | `STAFF_ROLES` | Executive Dashboard | VERIFIED | PASSED |
| `automation` | `AutomationEnginePage` | `protected` | `STAFF_ROLES` | Automation | VERIFIED | PASSED |
| `payroll` | `PayrollPage` | `protected` | `STAFF_ROLES` | Payroll | VERIFIED | PASSED |
| `financial-analytics` | `FinancialAnalyticsPage` | `protected` | `STAFF_ROLES` | Financial Analytics | VERIFIED | PASSED |
| `payroll-analytics` | `PayrollAnalyticsPage` | `protected` | `STAFF_ROLES` | Payroll Analytics | VERIFIED | PASSED |
| `crm-analytics` | `CRMAnalyticsPage` | `protected` | `STAFF_ROLES` | CRM Analytics | VERIFIED | PASSED |
| `follow-up-automation` | `FollowUpAutomationPage` | `protected` | `STAFF_ROLES` | Follow-Up Automation | VERIFIED | PASSED |
| `branches` | `BranchesPage` | `protected` | `STAFF_ROLES` | Branches | VERIFIED | PASSED |
| `data-governance` | `DataGovernancePage` | `protected` | `STAFF_ROLES` | Data Governance | VERIFIED | PASSED |
| `anomaly-detection` | `AnomalyDetectionPage` | `protected` | `STAFF_ROLES` | Anomaly Detection | VERIFIED | PASSED |
| `api-keys` | `ApiKeysPage` | `protected` | `STAFF_ROLES` | API Keys | VERIFIED | PASSED |
| `observability` | `ObservabilityPage` | `protected` | `STAFF_ROLES` | Observability | VERIFIED | PASSED |
| `performance` | `PerformanceMonitorPage` | `protected` | `STAFF_ROLES` | Performance Monitor | VERIFIED | PASSED |
| `reconciliation` | `ReconciliationPage` | `protected` | `STAFF_ROLES` | Reconciliation | VERIFIED | PASSED |
| `communication-history` | `CommunicationHistoryPage` | `protected` | `STAFF_ROLES` | Communication History | VERIFIED | PASSED |
| `unauthorized` | `UnauthorizedPage` | `none` | `ALL` | Unauthorized | VERIFIED | PASSED |
| `*` | `NotFoundPage` | `none` | `ALL` | Page Not Found | VERIFIED | PASSED |
