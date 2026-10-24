# M-EDU API Exposure & Route Security Inventory

> **Audited Application:** M-EDU Education Operating System (NestJS API)
> **Audit Date:** October 2026
> **Auditor Role:** Principal Application Security Engineer & API Security Architect
> **Scope:** Exhaustive audit of all 78 NestJS Controllers & 483 HTTP Endpoints

---

## 1. Executive Perimeter Summary

| Classification | Count | Description | Primary Security Controls |
|---|---|---|---|
| **Public by design** | 24 | Intentionally exposed endpoints (login, registration, public verification, webhooks, docs) | Protected by `ThrottlerGuard`, HMAC signatures, strict DTO validation, and fail-closed public decorators |
| **Authenticated** | 19 | Self-service endpoints for authenticated principals (`/auth/me`, `/invoices/my`, etc.) | Protected by `JwtAuthGuard`, session revocation checks (`sid`), rate limiting |
| **Privileged** | 440 | Administrative, staff, and teacher endpoints scoped to specific roles and tenants | Protected by `JwtAuthGuard`, `RolesGuard` / `PermissionsGuard`, and strict multi-tenant boundary checks |
| **Internal** | 0 directly exposed | Infrastructure & telemetry routes (`/api/metrics`) | Edge proxy (`apps/web/nginx.conf`) strictly returns HTTP 404 for external requests |
| **Total Endpoints** | **483** | **100% of routes audited across 78 controllers** | **Fail-Closed Guard Coverage** |

---

## 2. The 24 Public-by-Design Endpoints

Every public endpoint is continuously verified by `apps/api/src/auth/__tests__/public-whitelist.spec.ts` to prevent accidental route exposure.

| HTTP Method | Route | Controller | Handler | Purpose / Data Returned | Threat Mitigations |
|---|---|---|---|---|---|
| `GET` | `/` | `RootController` | `getRoot` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/ai/health` | `AiController` | `health` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/auth/apple` | `AuthController` | `appleAuth` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `GET` | `/api/auth/apple/callback` | `AuthController` | `appleAuthCallback` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/bootstrap` | `AuthController` | `bootstrap` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/forgot-password` | `AuthController` | `forgotPassword` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `GET` | `/api/auth/google` | `AuthController` | `googleAuth` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `GET` | `/api/auth/google/callback` | `AuthController` | `googleAuthCallback` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/invitations/accept` | `AuthController` | `acceptInvitation` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/login` | `AuthController` | `login` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/oauth/exchange` | `AuthController` | `exchangeAuthCode` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/parent-login` | `AuthController` | `parentLogin` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/register` | `AuthController` | `register` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `POST` | `/api/auth/reset-password` | `AuthController` | `resetPassword` | User / Parent authentication | IP-based rate limiting, bcrypt hashing, generic timing |
| `GET` | `/api/certificates/verify/:code` | `CertificatesController` | `verifyCertificate` | Public certificate credential verification | Read-only, sanitized public metadata, UUID verification |
| `POST` | `/api/client-errors` | `ClientErrorsController` | `report` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/csrf-token` | `CsrfController` | `getToken` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/health` | `HealthController` | `check` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/live` | `LivenessController` | `check` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/liveness` | `LivenessController` | `check` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `GET` | `/api/metrics` | `PublicMetricsController` | `scrape` | Prometheus internal scraping | Blocked at Nginx reverse proxy (returns 404 to internet) |
| `GET` | `/api/readiness` | `ReadinessController` | `check` | Platform discovery / health metadata | Minimal information returned; no stack traces |
| `POST` | `/api/webhooks/telegram` | `TelegramWebhookController` | `handleWebhook` | Telegram Bot webhook ingress | SHA-256 timing-safe secret validation, replay deduplication |
| `POST` | `/api/webhooks/terminal/event` | `TerminalWebhookController` | `handleTerminalEvent` | Hardware attendance terminal webhook | API Key header verification (`TerminalAuthGuard`) |

---

## 3. Complete Controller-by-Controller Endpoint Directory

Below is the exhaustive inventory of all 483 API endpoints grouped by controller.

### `AcademicRiskController`
- **File:** [`apps/api/src/academic-risk/academic-risk.controller.ts`](file:///apps/api/src/academic-risk/academic-risk.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/academic-risk` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/academic-risk/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `AdminController`
- **File:** [`apps/api/src/admin/admin.controller.ts`](file:///apps/api/src/admin/admin.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/admin/access-requests` | `getAccessRequests` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/admin/access-requests/:id/approve` | `approveAccessRequest` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/admin/access-requests/:id/reject` | `rejectAccessRequest` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/admin/users/:id/revoke` | `revokeUser` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/admin/users/:id/suspend` | `suspendUser` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `AiController`
- **File:** [`apps/api/src/ai/ai.controller.ts`](file:///apps/api/src/ai/ai.controller.ts)
- **Total Endpoints:** 10

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/ai/chat` | `chat` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/ai/chat/stream` | `chatStream` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/ai/conversations` | `getConversations` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/ai/conversations` | `createConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/ai/conversations/:id` | `deleteConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/ai/conversations/:id/messages` | `getMessages` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/ai/conversations/import` | `importConversations` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/ai/health` | `health` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `GET` | `/api/ai/insights` | `getInsights` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/ai/suggestions` | `getSuggestions` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `AiWorkspaceController`
- **File:** [`apps/api/src/ai/ai-workspace.controller.ts`](file:///apps/api/src/ai/ai-workspace.controller.ts)
- **Total Endpoints:** 10

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/workspace/ai/actions/:id` | `getAction` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/workspace/ai/actions/:id/confirm` | `confirmAction` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/workspace/ai/actions/:id/reject` | `rejectAction` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/workspace/ai/conversations` | `listConversations` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/workspace/ai/conversations` | `createConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/workspace/ai/conversations/:id` | `archiveConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/workspace/ai/conversations/:id` | `getConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/workspace/ai/conversations/:id` | `renameConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/workspace/ai/conversations/:id/messages` | `listMessages` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/workspace/ai/conversations/:id/messages` | `sendMessage` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `AnalyticsController`
- **File:** [`apps/api/src/analytics/analytics.controller.ts`](file:///apps/api/src/analytics/analytics.controller.ts)
- **Total Endpoints:** 24

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/analytics/anomalies` | `getAnomalies` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/crm/aging` | `getCrmAging` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/crm/funnel` | `getCrmFunnel` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/crm/lost-reasons` | `getCrmLostReasons` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/crm/moderators` | `getCrmModerators` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/crm/sources` | `getCrmSources` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/crm/velocity` | `getCrmVelocity` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/executive-summary` | `getExecutiveSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/financial/anomalies` | `getFinancialAnomalies` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/financial/cash-flow` | `getCashFlow` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/financial/forecast` | `getForecast` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/financial/reconciliation` | `getReconciliation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/financial/what-if` | `getWhatIf` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/groups/:id/profitability` | `getGroupProfitability` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/overview` | `getOverview` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/payroll/by-teacher` | `getPayrollByTeacher` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/payroll/efficiency` | `getPayrollEfficiency` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/payroll/ratio` | `getPayrollRatio` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/payroll/summary` | `getPayrollSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/payroll/trend` | `getPayrollTrend` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/reconciliation/discrepancies` | `getReconciliationDiscrepancies` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/reconciliation/history` | `getReconciliationHistory` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/reconciliation/report` | `getReconciliationReport` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/analytics/reconciliation/student-balances` | `getStudentBalances` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `ApiKeysController`
- **File:** [`apps/api/src/api-keys/api-keys.controller.ts`](file:///apps/api/src/api-keys/api-keys.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/api-keys` | `list` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/api-keys` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/api-keys/:id` | `revoke` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/api-keys/:id/rotate` | `rotate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/api-keys/scopes` | `scopes` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/api-keys/usage` | `usageStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `AssessmentController`
- **File:** [`apps/api/src/assessment/assessment.controller.ts`](file:///apps/api/src/assessment/assessment.controller.ts)
- **Total Endpoints:** 7

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/assessment/attempts/:attemptId/submit` | `submitAttempt` | **Privileged** | STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/assessment/questions` | `findAllQuestions` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/assessment/questions` | `createQuestion` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/assessment/quizzes` | `findAllQuizzes` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/assessment/quizzes` | `createQuiz` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/assessment/quizzes/:id` | `findQuizForTeacher` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/assessment/quizzes/:id/start` | `startAttempt` | **Privileged** | STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |

### `AssignmentsController`
- **File:** [`apps/api/src/assignments/assignments.controller.ts`](file:///apps/api/src/assignments/assignments.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/assignments` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/assignments` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/assignments/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/assignments/:id/submit` | `submit` | **Privileged** | STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/assignments/submissions/:submissionId/grade` | `gradeSubmission` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `AttendanceController`
- **File:** [`apps/api/src/attendance/attendance.controller.ts`](file:///apps/api/src/attendance/attendance.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/attendance` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/attendance` | `markAttendance` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/attendance/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/attendance/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/attendance/analytics` | `getAnalytics` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `AuditController`
- **File:** [`apps/api/src/audit/audit.controller.ts`](file:///apps/api/src/audit/audit.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/audit` | `findAll` | **Privileged** | ORG_ADMIN, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/audit/:id` | `findOne` | **Privileged** | ORG_ADMIN, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/audit/entity/:entityType/:entityId` | `getEntityHistory` | **Privileged** | ORG_ADMIN, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `AuthController`
- **File:** [`apps/api/src/auth/auth.controller.ts`](file:///apps/api/src/auth/auth.controller.ts)
- **Total Endpoints:** 24

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/auth/apple` | `appleAuth` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `GET` | `/api/auth/apple/callback` | `appleAuthCallback` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/bootstrap` | `bootstrap` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/forgot-password` | `forgotPassword` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `GET` | `/api/auth/google` | `googleAuth` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `GET` | `/api/auth/google/callback` | `googleAuthCallback` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/invitations/accept` | `acceptInvitation` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/login` | `login` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/logout` | `logout` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/auth/me` | `getMe` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/auth/oauth/exchange` | `exchangeAuthCode` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/parent-login` | `parentLogin` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/refresh` | `refresh` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/auth/register` | `register` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `POST` | `/api/auth/reset-password` | `resetPassword` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `GET` | `/api/auth/sessions` | `getActiveSessions` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/auth/sessions/:id` | `revokeSession` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/auth/sessions/revoke-others` | `revokeOtherSessions` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/auth/whitelist` | `getWhitelist` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/auth/whitelist` | `addToWhitelist` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/auth/whitelist/:id` | `removeFromWhitelist` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/auth/whitelist/approve-user/:id` | `approveUser` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/auth/whitelist/reject-user/:id` | `rejectUser` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/auth/whitelist/settings` | `updateAccessControlSettings` | **Privileged** | SUPER_ADMIN, PLATFORM_OWNER | Enforced (`orgId`) | ValidationPipe + DTO |

### `AutomationController`
- **File:** [`apps/api/src/automation/automation.controller.ts`](file:///apps/api/src/automation/automation.controller.ts)
- **Total Endpoints:** 11

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/automation/evaluate-all` | `evaluateAllRules` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/automation/executions` | `getExecutions` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/automation/rules` | `listRules` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/automation/rules` | `createRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/automation/rules/:id` | `deleteRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/automation/rules/:id` | `getRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/automation/rules/:id` | `updateRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/automation/rules/:id/evaluate` | `evaluateRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/automation/rules/:id/stats` | `getRuleStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/automation/rules/:id/toggle` | `toggleRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/automation/stats` | `getOverallStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `BookingsController`
- **File:** [`apps/api/src/bookings/bookings.controller.ts`](file:///apps/api/src/bookings/bookings.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/bookings` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/bookings` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `BranchesController`
- **File:** [`apps/api/src/branches/branches.controller.ts`](file:///apps/api/src/branches/branches.controller.ts)
- **Total Endpoints:** 8

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/branches` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/branches` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/branches/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/branches/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/branches/:id/activate` | `activate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/branches/:id/deactivate` | `deactivate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/branches/:id/manager` | `assignManager` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/branches/:id/stats` | `getStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `CalendarController`
- **File:** [`apps/api/src/calendar/calendar.controller.ts`](file:///apps/api/src/calendar/calendar.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/calendar/events` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/calendar/events` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `CameraController`
- **File:** [`apps/api/src/camera/camera.controller.ts`](file:///apps/api/src/camera/camera.controller.ts)
- **Total Endpoints:** 16

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/cameras` | `listCameras` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/cameras` | `createCamera` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/cameras/:id` | `deleteCamera` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/cameras/:id` | `getCamera` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/cameras/:id` | `updateCamera` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/cameras/:id/config` | `updateConfig` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/cameras/:id/disable` | `disableCamera` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/cameras/:id/enable` | `enableCamera` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/cameras/:id/events` | `getEvents` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/cameras/:id/health` | `getHealth` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/cameras/:id/restart-worker` | `restartWorker` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/cameras/:id/start-worker` | `startWorker` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/cameras/:id/stop-worker` | `stopWorker` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/cameras/:id/worker-status` | `getWorkerStatus` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/cameras/discover` | `discoverCameras` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/cameras/test-connection` | `testConnection` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |

### `CertificatesController`
- **File:** [`apps/api/src/certificates/certificates.controller.ts`](file:///apps/api/src/certificates/certificates.controller.ts)
- **Total Endpoints:** 12

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/certificates` | `findAllCertificates` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/certificates/:id` | `findCertificateById` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/certificates/:id/download` | `downloadCertificate` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/certificates/generate` | `generateCertificate` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/certificates/student/:studentId` | `getStudentCertificates` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/certificates/templates` | `findAllTemplates` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/certificates/templates` | `createTemplate` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/certificates/templates/:id` | `deleteTemplate` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/certificates/templates/:id` | `findTemplateById` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/certificates/templates/:id` | `updateTemplate` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/certificates/templates/:id/default` | `setDefaultTemplate` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/certificates/verify/:code` | `verifyCertificate` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `ChatController`
- **File:** [`apps/api/src/chat/chat.controller.ts`](file:///apps/api/src/chat/chat.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/chat/conversations` | `getConversations` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/chat/conversations` | `createConversation` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/chat/conversations/:id/messages` | `getConversationMessages` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/chat/conversations/:id/read` | `markRead` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/chat/messages` | `sendMessage` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |

### `ClientErrorsController`
- **File:** [`apps/api/src/client-errors/client-errors.controller.ts`](file:///apps/api/src/client-errors/client-errors.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/client-errors` | `report` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `CommunicationController`
- **File:** [`apps/api/src/communication/communication.controller.ts`](file:///apps/api/src/communication/communication.controller.ts)
- **Total Endpoints:** 4

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/communication/announcements` | `findAllAnnouncements` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/communication/announcements` | `createAnnouncement` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/communication/messages` | `sendMessage` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/communication/messages/student/:studentId` | `getMessagesForStudent` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |

### `CommunicationHistoryController`
- **File:** [`apps/api/src/notifications/communication-history.controller.ts`](file:///apps/api/src/notifications/communication-history.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/communication/history` | `getHistory` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/communication/stats` | `getStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/communication/timeline` | `getTimeline` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `CoursesController`
- **File:** [`apps/api/src/courses/courses.controller.ts`](file:///apps/api/src/courses/courses.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/courses` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/courses` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/courses/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/courses/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/courses/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `CsrfController`
- **File:** [`apps/api/src/security/csrf.controller.ts`](file:///apps/api/src/security/csrf.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/csrf-token` | `getToken` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `CurriculumController`
- **File:** [`apps/api/src/curriculum/curriculum.controller.ts`](file:///apps/api/src/curriculum/curriculum.controller.ts)
- **Total Endpoints:** 7

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/curriculum` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/curriculum` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/curriculum/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/curriculum/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/curriculum/:id/modules` | `addModule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/curriculum/:id/modules/:moduleId/topics` | `addTopic` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/curriculum/:id/topics/:topicId/objectives` | `addObjective` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `DashboardController`
- **File:** [`apps/api/src/dashboard/dashboard.controller.ts`](file:///apps/api/src/dashboard/dashboard.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/dashboard/revenue` | `getRevenue` | **Privileged** | ORG_ADMIN, MANAGER, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/dashboard/stats` | `getStats` | **Privileged** | ORG_ADMIN, MANAGER, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `DataGovernanceController`
- **File:** [`apps/api/src/data-governance/data-governance.controller.ts`](file:///apps/api/src/data-governance/data-governance.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/data-governance/access-audit` | `getDataAccessAudit` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/data-governance/export-log` | `getExportLog` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/data-governance/export-stats` | `getExportStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/data-governance/retention-check` | `executeRetentionCheck` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/data-governance/retention-policies` | `getRetentionPolicies` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/data-governance/retention-policies` | `upsertRetentionPolicy` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `DataQualityController`
- **File:** [`apps/api/src/data-quality/data-quality.controller.ts`](file:///apps/api/src/data-quality/data-quality.controller.ts)
- **Total Endpoints:** 4

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/data-quality/issues` | `getIssues` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/data-quality/issues/:id/resolve` | `resolve` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/data-quality/run` | `runChecks` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/data-quality/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `DocumentsController`
- **File:** [`apps/api/src/documents/documents.controller.ts`](file:///apps/api/src/documents/documents.controller.ts)
- **Total Endpoints:** 8

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/documents` | `findAll` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/documents` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/documents/:id` | `delete` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/documents/:id` | `findOne` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/documents/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/documents/:id/download` | `getDownloadUrl` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/documents/:id/versions` | `uploadVersion` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/documents/upload-url` | `getUploadUrl` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `EarlyWarningController`
- **File:** [`apps/api/src/early-warning/early-warning.controller.ts`](file:///apps/api/src/early-warning/early-warning.controller.ts)
- **Total Endpoints:** 4

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/early-warning` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/early-warning/:id/resolve` | `resolve` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/early-warning/scan` | `runScan` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/early-warning/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `EmailController`
- **File:** [`apps/api/src/notifications/email.controller.ts`](file:///apps/api/src/notifications/email.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/email/send` | `sendEmail` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/email/templates` | `getTemplates` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/email/templates` | `createTemplate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/email/templates/:id` | `deleteTemplate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/email/templates/:id` | `getTemplateById` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/email/templates/:id` | `updateTemplate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `ExamsController`
- **File:** [`apps/api/src/exams/exams.controller.ts`](file:///apps/api/src/exams/exams.controller.ts)
- **Total Endpoints:** 10

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/exams` | `findAllExams` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/exams` | `createExam` | **Privileged** | ORG_ADMIN, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/exams/:examId/results` | `getExamResults` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/exams/:examId/results` | `createExamResult` | **Privileged** | ORG_ADMIN, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/exams/:id` | `deleteExam` | **Privileged** | ORG_ADMIN, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/exams/:id` | `findExamById` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/exams/:id` | `updateExam` | **Privileged** | ORG_ADMIN, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/exams/:id/publish` | `publishExam` | **Privileged** | ORG_ADMIN, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/exams/stats` | `getExamStats` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/exams/student/:studentId` | `getStudentExamResults` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `ExpensesController`
- **File:** [`apps/api/src/expenses/expenses.controller.ts`](file:///apps/api/src/expenses/expenses.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/expenses` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/expenses` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/expenses/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/expenses/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/expenses/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/expenses/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `FaceController`
- **File:** [`apps/api/src/face/face.controller.ts`](file:///apps/api/src/face/face.controller.ts)
- **Total Endpoints:** 19

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/face/analytics` | `getAnalytics` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/audit-log` | `getAuditLog` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/devices` | `listDevices` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/devices` | `registerDevice` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/devices/:id` | `getDevice` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/devices/:id/revoke` | `revokeDevice` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/engine-status` | `getEngineStatus` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/enrollments` | `listEnrollments` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/enrollments` | `startEnrollment` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/enrollments/:id` | `getEnrollment` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/enrollments/:id/capture` | `processCapture` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/face/enrollments/:id/pending` | `cancelPendingEnrollment` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/enrollments/:id/reenroll` | `reenroll` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/enrollments/:id/revoke` | `revokeEnrollment` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/recognition-history` | `getRecognitionHistory` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/sessions` | `startSession` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/face/sessions/:id/attempts` | `getSessionAttempts` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/sessions/:id/attempts` | `submitAttempt` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/face/sessions/:id/finish` | `finishSession` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |

### `FeatureFlagsController`
- **File:** [`apps/api/src/feature-flags/feature-flags.controller.ts`](file:///apps/api/src/feature-flags/feature-flags.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/feature-flags` | `findAll` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/feature-flags` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/feature-flags/:key` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `ForecastingController`
- **File:** [`apps/api/src/forecasting/forecasting.controller.ts`](file:///apps/api/src/forecasting/forecasting.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/forecasting` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/forecasting/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `GamificationController`
- **File:** [`apps/api/src/gamification/gamification.controller.ts`](file:///apps/api/src/gamification/gamification.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/gamification/leaderboard` | `getLeaderboard` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/gamification/me` | `getMyStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/gamification/me/events` | `getMyEvents` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/gamification/rewards` | `getRewards` | **Privileged** | STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/gamification/rewards/:id/claim` | `claimReward` | **Privileged** | STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/gamification/stats` | `getOrgStats` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `GradesController`
- **File:** [`apps/api/src/grades/grades.controller.ts`](file:///apps/api/src/grades/grades.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/grades` | `findAll` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/grades` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/grades/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/grades/:id` | `findOne` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/grades/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `GroupsController`
- **File:** [`apps/api/src/groups/groups.controller.ts`](file:///apps/api/src/groups/groups.controller.ts)
- **Total Endpoints:** 7

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/groups` | `findAll` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/groups` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/groups/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/groups/:id` | `findOne` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/groups/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/groups/:id/capacity` | `getCapacity` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/groups/:id/graduate` | `graduate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `HealthController`
- **File:** [`apps/api/src/health/health.controller.ts`](file:///apps/api/src/health/health.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/health` | `check` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `HomeworkController`
- **File:** [`apps/api/src/homework/homework.controller.ts`](file:///apps/api/src/homework/homework.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/homework` | `findAll` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/homework` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/homework/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/homework/:id` | `findOne` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/homework/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `HremployeeController`
- **File:** [`apps/api/src/hr/hr.controller.ts`](file:///apps/api/src/hr/hr.controller.ts)
- **Total Endpoints:** 14

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/hr/employees` | `findAllEmployees` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/employees` | `createEmployee` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/employees/:employeeId/salary` | `getEmployeeSalaryHistory` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/employees/:id` | `findEmployeeById` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/hr/employees/:id` | `updateEmployee` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/employees/:id/terminate` | `terminateEmployee` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/leave-requests` | `findAllLeaveRequests` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/leave-requests` | `createLeaveRequest` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/leave-requests/:id/approve` | `approveLeaveRequest` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/leave-requests/:id/reject` | `rejectLeaveRequest` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/:recordId/process` | `processSalaryPayment` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/generate` | `generatePayroll` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/payroll/summary` | `getPayrollSummary` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/stats` | `getHRStats` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `ImportExportController`
- **File:** [`apps/api/src/import-export/import-export.controller.ts`](file:///apps/api/src/import-export/import-export.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/export` | `exportData` | **Privileged** | ORG_ADMIN, SUPER_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/exports` | `listExports` | **Privileged** | ORG_ADMIN, SUPER_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/imports` | `listImports` | **Privileged** | ORG_ADMIN, SUPER_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/imports` | `startImport` | **Privileged** | ORG_ADMIN, SUPER_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/template` | `downloadTemplate` | **Privileged** | ORG_ADMIN, SUPER_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `InventoryController`
- **File:** [`apps/api/src/inventory/inventory.controller.ts`](file:///apps/api/src/inventory/inventory.controller.ts)
- **Total Endpoints:** 11

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/inventory/categories` | `getCategoryStats` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/inventory/items` | `findAllItems` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/inventory/items` | `createItem` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/inventory/items/:id` | `deleteItem` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/inventory/items/:id` | `findItemById` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/inventory/items/:id` | `updateItem` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/inventory/items/:id/adjust` | `adjustStock` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/inventory/items/:id/stock` | `updateStock` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/inventory/items/:itemId/transactions` | `getTransactionHistory` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/inventory/stock-report` | `getStockReport` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/inventory/transactions` | `createTransaction` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `InvoicesController`
- **File:** [`apps/api/src/payments/invoices.controller.ts`](file:///apps/api/src/payments/invoices.controller.ts)
- **Total Endpoints:** 16

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/invoices` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/invoices/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/:id/cancel` | `cancel` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/:id/issue` | `issue` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/:id/items` | `addItem` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/invoices/:id/payment-links` | `paymentLinks` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/:id/payments` | `recordPayment` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/invoices/my` | `myBalance` | **Privileged** | STUDENT, ORG_ADMIN, MANAGER, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/prorate` | `createProrated` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/prorate-preview` | `proratePreview` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/refunds` | `requestRefund` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/refunds/:id/process` | `processRefund` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/invoices/refunds/:id/reject` | `rejectRefund` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/invoices/students/:studentId/balance` | `studentBalance` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/invoices/students/:studentId/debtor-status` | `debtorStatus` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `LeadsController`
- **File:** [`apps/api/src/leads/leads.controller.ts`](file:///apps/api/src/leads/leads.controller.ts)
- **Total Endpoints:** 19

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/leads` | `findAll` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/leads/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/leads/:id` | `findOne` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/leads/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/:id/activities` | `addActivity` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/:id/convert` | `convert` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/leads/:id/stage` | `updateStage` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/:id/trial-attendance` | `recordTrialAttendance` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/:id/trial-schedule` | `scheduleTrial` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/leads/follow-up-rules` | `getFollowUpRules` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/follow-up-rules` | `createFollowUpRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/leads/follow-up-rules/:id` | `deleteFollowUpRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/leads/follow-up-rules/:id` | `updateFollowUpRule` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/follow-up-rules/evaluate` | `evaluateFollowUpRules` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/leads/follow-ups` | `getFollowUps` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/leads/follow-ups/:id/complete` | `completeFollowUp` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/leads/follow-ups/stats` | `getFollowUpStats` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/leads/trial-analytics` | `getTrialAnalytics` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |

### `LearningMaterialsController`
- **File:** [`apps/api/src/learning-materials/learning-materials.controller.ts`](file:///apps/api/src/learning-materials/learning-materials.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/learning-materials` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/learning-materials` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/learning-materials/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/learning-materials/folders` | `getFolders` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/learning-materials/folders` | `createFolder` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `LessonsController`
- **File:** [`apps/api/src/lessons/lessons.controller.ts`](file:///apps/api/src/lessons/lessons.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/lessons` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/lessons/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/lessons/:id/content` | `updateContent` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/lessons/:id/materials` | `linkMaterial` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/lessons/:id/materials/:materialId` | `unlinkMaterial` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/lessons/:id/status` | `updateStatus` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `LibraryController`
- **File:** [`apps/api/src/library/library.controller.ts`](file:///apps/api/src/library/library.controller.ts)
- **Total Endpoints:** 11

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/library/books` | `findAllBooks` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/library/books` | `createBook` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/library/books/:id` | `deleteBook` | **Privileged** | ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/library/books/:id` | `findBookById` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PUT` | `/api/library/books/:id` | `updateBook` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/library/books/search` | `searchBooks` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/library/borrow` | `borrowBook` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/library/overdue` | `getOverdueBooks` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/library/return/:id` | `returnBook` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/library/stats` | `getLibraryStats` | **Privileged** | ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/library/student/:studentId` | `getStudentBorrows` | **Privileged** | ORG_ADMIN, MANAGER, TEACHER | Enforced (`orgId`) | ValidationPipe + DTO |

### `LivenessController`
- **File:** [`apps/api/src/health/liveness.controller.ts`](file:///apps/api/src/health/liveness.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/live` | `check` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |
| `GET` | `/api/liveness` | `check` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `NotificationsController`
- **File:** [`apps/api/src/notifications/notifications.controller.ts`](file:///apps/api/src/notifications/notifications.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/notifications` | `findAll` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/notifications/:id/read` | `markAsRead` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/notifications/read-all` | `markAllAsRead` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |

### `ObservabilityController`
- **File:** [`apps/api/src/observability/observability.controller.ts`](file:///apps/api/src/observability/observability.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/observability/api-metrics` | `getApiMetrics` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/observability/database` | `getDatabaseMetrics` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/observability/health` | `getHealthCheck` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/observability/integrations` | `getIntegrationHealth` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/observability/metrics` | `getSystemMetrics` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/observability/queues` | `getQueueHealth` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `OrganizationsController`
- **File:** [`apps/api/src/organizations/organizations.controller.ts`](file:///apps/api/src/organizations/organizations.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/organizations/me` | `getOrganization` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/organizations/me` | `updateOrganization` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `ParentPortalController`
- **File:** [`apps/api/src/parent-portal/parent-portal.controller.ts`](file:///apps/api/src/parent-portal/parent-portal.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/parent-portal/children` | `listChildren` | **Privileged** | PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/parent-portal/children/:studentId/attendance` | `childAttendance` | **Privileged** | PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/parent-portal/children/:studentId/attendance/summary` | `childAttendanceSummary` | **Privileged** | PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/parent-portal/children/:studentId/grades` | `childGrades` | **Privileged** | PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/parent-portal/children/:studentId/invoices` | `childInvoices` | **Privileged** | PARENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/parent-portal/children/:studentId/schedule` | `childSchedule` | **Privileged** | PARENT | Enforced (`orgId`) | ValidationPipe + DTO |

### `PaymentsController`
- **File:** [`apps/api/src/payments/payments.controller.ts`](file:///apps/api/src/payments/payments.controller.ts)
- **Total Endpoints:** 4

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/payments` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payments` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/payments/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/payments/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `PayrollPeriodController`
- **File:** [`apps/api/src/hr/payroll-period.controller.ts`](file:///apps/api/src/hr/payroll-period.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/hr/payroll/period-summary` | `getPeriodSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/payroll/period-summary` | `getPeriodSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `PayrollRunController`
- **File:** [`apps/api/src/hr/payroll-run.controller.ts`](file:///apps/api/src/hr/payroll-run.controller.ts)
- **Total Endpoints:** 24

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/hr/payroll/runs` | `listRuns` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs` | `createRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/payroll/runs/:id` | `getRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/:id/approve` | `approveRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/:id/cancel` | `cancelRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/:id/pay` | `payRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/:id/process` | `processRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/:id/review` | `reviewRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/calculate` | `calculate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/payroll/runs/period-summary` | `getPeriodSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/hr/payroll/runs/revenue-share` | `getRevenueShare` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/hr/payroll/runs/revenue-share` | `createRevenueShareRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/payroll/runs` | `listRuns` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs` | `createRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/payroll/runs/:id` | `getRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/:id/approve` | `approveRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/:id/cancel` | `cancelRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/:id/pay` | `payRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/:id/process` | `processRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/:id/review` | `reviewRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/calculate` | `calculate` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/payroll/runs/period-summary` | `getPeriodSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/payroll/runs/revenue-share` | `getRevenueShare` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/payroll/runs/revenue-share` | `createRevenueShareRun` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `PerformanceController`
- **File:** [`apps/api/src/performance/performance.controller.ts`](file:///apps/api/src/performance/performance.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/performance/audit` | `runAudit` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/performance/cache-stats` | `getCacheStats` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/performance/slow-endpoints` | `getSlowEndpoints` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `PlatformController`
- **File:** [`apps/api/src/platform/platform.controller.ts`](file:///apps/api/src/platform/platform.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/platform/invitations` | `createInvitation` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/platform/organizations` | `getOrganizations` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/platform/statistics` | `getStatistics` | **Privileged** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |

### `ProgressController`
- **File:** [`apps/api/src/progress/progress.controller.ts`](file:///apps/api/src/progress/progress.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/progress/student-360/:studentId` | `getStudent360` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT, PARENT | Enforced (`orgId`) | ValidationPipe + DTO |

### `PublicMetricsController`
- **File:** [`apps/api/src/observability/public-metrics.controller.ts`](file:///apps/api/src/observability/public-metrics.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/metrics` | `scrape` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `ReadinessController`
- **File:** [`apps/api/src/health/readiness.controller.ts`](file:///apps/api/src/health/readiness.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/readiness` | `check` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `RelationshipsController`
- **File:** [`apps/api/src/relationships/relationships.controller.ts`](file:///apps/api/src/relationships/relationships.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/relationships/graph` | `getGraph` | **Privileged** | ORG_ADMIN, SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `ReportsController`
- **File:** [`apps/api/src/reports/reports.controller.ts`](file:///apps/api/src/reports/reports.controller.ts)
- **Total Endpoints:** 8

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/reports/definitions` | `listDefinitions` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/reports/definitions` | `saveDefinition` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/reports/definitions/:id` | `deleteDefinition` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/reports/definitions/:id/run` | `runSaved` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/reports/designs` | `listDesigns` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/reports/designs/:type` | `getDesign` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/reports/export` | `exportReport` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/reports/run` | `run` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `ResourcesController`
- **File:** [`apps/api/src/resources/resources.controller.ts`](file:///apps/api/src/resources/resources.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/resources` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/resources` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/resources/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/resources/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/resources/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `RootController`
- **File:** [`apps/api/src/common/root.controller.ts`](file:///apps/api/src/common/root.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/` | `getRoot` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `ScheduleController`
- **File:** [`apps/api/src/schedule/schedule.controller.ts`](file:///apps/api/src/schedule/schedule.controller.ts)
- **Total Endpoints:** 6

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/schedule` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/schedule` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/schedule/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/schedule/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT, STUDENT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/schedule/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/schedule/room-utilization` | `getRoomUtilization` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `SearchController`
- **File:** [`apps/api/src/search/search.controller.ts`](file:///apps/api/src/search/search.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/search` | `search` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `SecurityController`
- **File:** [`apps/api/src/security/security.controller.ts`](file:///apps/api/src/security/security.controller.ts)
- **Total Endpoints:** 3

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/security/alerts` | `findAlerts` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/security/alerts/:id/resolve` | `resolve` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/security/summary` | `getSummary` | **Privileged** | SUPER_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |

### `StudentsController`
- **File:** [`apps/api/src/students/students.controller.ts`](file:///apps/api/src/students/students.controller.ts)
- **Total Endpoints:** 13

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/students` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/students` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/students/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/students/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/students/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/students/:id/freeze` | `freeze` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/students/:id/groups/:groupId` | `removeFromGroup` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/students/:id/groups/:groupId` | `assignToGroup` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/students/:id/parents` | `getParents` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/students/:id/parents` | `createParent` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/students/:id/parents/:parentId` | `unlinkParent` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/students/:id/parents/:parentId` | `updateParentLink` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/students/:id/unfreeze` | `unfreeze` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `SubjectsController`
- **File:** [`apps/api/src/subjects/subjects.controller.ts`](file:///apps/api/src/subjects/subjects.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/subjects` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/subjects` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/subjects/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/subjects/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/subjects/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `SystemHealthController`
- **File:** [`apps/api/src/system-health/system-health.controller.ts`](file:///apps/api/src/system-health/system-health.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/system-health/components` | `getComponents` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/system-health/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `TeacherWorkloadController`
- **File:** [`apps/api/src/teacher-workload/teacher-workload.controller.ts`](file:///apps/api/src/teacher-workload/teacher-workload.controller.ts)
- **Total Endpoints:** 2

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/teacher-workload` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/teacher-workload/summary` | `getSummary` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |

### `TeachersController`
- **File:** [`apps/api/src/teachers/teachers.controller.ts`](file:///apps/api/src/teachers/teachers.controller.ts)
- **Total Endpoints:** 5

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/teachers` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/teachers` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/teachers/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/teachers/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER, TEACHER, ASSISTANT | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/teachers/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `TelegramAdminController`
- **File:** [`apps/api/src/telegram/telegram-admin.controller.ts`](file:///apps/api/src/telegram/telegram-admin.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/telegram/admin/overview` | `overview` | **Privileged** | SUPER_ADMIN, ORG_ADMIN, MANAGER | Enforced (`orgId`) | ValidationPipe + DTO |

### `TelegramController`
- **File:** [`apps/api/src/telegram/telegram.controller.ts`](file:///apps/api/src/telegram/telegram.controller.ts)
- **Total Endpoints:** 4

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `DELETE` | `/api/telegram/link` | `unlink` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/telegram/link` | `createLink` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/telegram/status` | `status` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/telegram/test-notification` | `testNotification` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |

### `TelegramWebhookController`
- **File:** [`apps/api/src/telegram/telegram-webhook.controller.ts`](file:///apps/api/src/telegram/telegram-webhook.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/webhooks/telegram` | `handleWebhook` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `TerminalWebhookController`
- **File:** [`apps/api/src/camera/terminal-webhook.controller.ts`](file:///apps/api/src/camera/terminal-webhook.controller.ts)
- **Total Endpoints:** 1

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `POST` | `/api/webhooks/terminal/event` | `handleTerminalEvent` | **Public by design** | None (Public) | N/A | ValidationPipe + DTO |

### `UsersController`
- **File:** [`apps/api/src/users/users.controller.ts`](file:///apps/api/src/users/users.controller.ts)
- **Total Endpoints:** 7

| Method | Route | Handler | Classification | Roles Allowed | Tenant Isolation | Validation |
|---|---|---|---|---|---|---|
| `GET` | `/api/users` | `findAll` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/users` | `create` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `DELETE` | `/api/users/:id` | `remove` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `GET` | `/api/users/:id` | `findOne` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/users/:id` | `update` | **Privileged** | SUPER_ADMIN, ORG_ADMIN | Enforced (`orgId`) | ValidationPipe + DTO |
| `PATCH` | `/api/users/:id/settings` | `updateSettings` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
| `POST` | `/api/users/change-password` | `changePassword` | **Authenticated** | Any Authenticated | Enforced (`orgId`) | ValidationPipe + DTO |
