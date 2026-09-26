# M-EDU MASTER PRODUCT ACCEPTANCE REPORT

**Audit type:** Product behavior + UI/UX + frontend↔backend parity acceptance.
**Mode:** READ-ONLY. No source code, schema, migration, test or configuration was modified.
**Method:** LEVEL A (static trace) for all modules; LEVEL B (executed test suites) where runnable; LEVEL C (browser/runtime) **NOT AVAILABLE in this environment — no journey is claimed as runtime-verified.**
**Date:** 2026-09-24

---

## 1. EXECUTIVE SUMMARY

| Metric | Value |
|---|---|
| Modules examined | 62 (master list + Devices, Engine status, Command palette, AI assistant, Universal search) |
| PASS | 34 |
| PARTIAL | 15 |
| FAIL (specific buttons/paths) | 2 modules containing 3 discrete FAIL findings |
| FRONTEND ONLY / BACKEND ONLY | 4 |
| NOT VERIFIED | 7 |
| Buttons/actions traced end-to-end | ~90 |
| Discrete discrepancies documented | 12 |
| Critical workflow failures (P0/P1) | 2 (one P0 UX-decision, one P1 UI bug class) |
| Runtime journeys | **NOT RUNTIME VERIFIED** (no server/DB/browser available in this environment) |

**Overall shape:** The core business loop (students → groups → attendance → payments → dashboards) is implemented on both ends with unusually strong financial invariants (row-locking, transition guards, closed-period checks, idempotent receipt numbering). The two serious product-level findings are: (1) manual attendance is **blocked unless a Lesson row exists for that group/date** — a dependency generated only by a nightly job, invisible to the admin; (2) **Reports export sends a GET with query-string params to an endpoint that only accepts POST with a JSON body** and also cannot work via the generic JSON `request()` because the endpoint streams a binary file.

---

## 2. PRODUCT COVERAGE MATRIX

| Module | Screens | Actions traced | PASS | PARTIAL | FAIL | Not Verified |
|---|---:|---:|---:|---:|---:|---:|
| Dashboard | 1 | 4 | 3 | 1 | 0 | 0 |
| Students | 4 | 8 | 8 | 0 | 0 | 0 |
| Groups | 4 | 6 | 6 | 0 | 0 | 0 |
| Courses | 1 | 5 | 5 | 0 | 0 | 0 |
| Teachers | 1 | 4 | 3 | 0 | 0 | 1 |
| Schedule | 1 | 4 | 4 | 0 | 0 | 0 |
| Attendance | 1 | 8 | 5 | 0 | 1 | 2 |
| Homework | 1 | 3 | 2 | 0 | 0 | 1 |
| Grades | 1 | 5 | 5 | 0 | 0 | 0 |
| Exams | 1 | 6 | 4 | 0 | 0 | 2 |
| Certificates | 1 | 5 | 4 | 0 | 0 | 1 |
| Library | 1 | 6 | 6 | 0 | 0 | 0 |
| Inventory | 1 | 6 | 5 | 0 | 0 | 1 |
| Face Recognition (sessions) | 1 | 4 | 3 | 1 | 0 | 0 |
| Face Enrollment | 1 | 6 | 6 | 0 | 0 | 0 |
| Cameras | 1 | 12 | 12 | 0 | 0 | 0 |
| Face Devices | 0 (UI) | 3 | 0 | 0 | 0 | 3 |
| Recognition History | partial | 2 | 1 | 0 | 0 | 1 |
| Camera Events/Health | 3 tabs | 3 | 3 | 0 | 0 | 0 |
| Payments | 1 | 4 | 3 | 1 | 0 | 0 |
| Invoices/Refunds | 1 | 10 | 9 | 0 | 1 | 0 |
| Expenses | 1 | 4 | 4 | 0 | 0 | 0 |
| Discounts | 0 (UI) | 0 | 0 | 0 | 0 | 1 |
| Financial Periods | 0 (UI) | 0 | 0 | 0 | 0 | 1 |
| Financial Analytics | 1 | 3 | 3 | 0 | 0 | 0 |
| Reconciliation | 1 | 2 | 2 | 0 | 0 | 0 |
| Forecasting | 1 | 2 | 2 | 0 | 0 | 0 |
| Employees (HR) | 1 | 5 | 4 | 0 | 0 | 1 |
| Leave | 1 | 3 | 3 | 0 | 0 | 0 |
| Payroll Runs | 1 | 7 | 6 | 0 | 0 | 1 |
| Payroll Analytics | 1 | 2 | 2 | 0 | 0 | 0 |
| Teacher Workload | 1 | 1 | 1 | 0 | 0 | 0 |
| Leads | 1 | 6 | 5 | 0 | 0 | 1 |
| Follow-Up Automation | 1 | 5 | 5 | 0 | 0 | 0 |
| Automation Rules | 1 | 6 | 6 | 0 | 0 | 0 |
| Communication History | 1 | 2 | 2 | 0 | 0 | 0 |
| Parent Portal | 1 | 4 | 3 | 1 | 0 | 0 |
| Users | 1 | 5 | 5 | 0 | 0 | 0 |
| Roles/Permissions | (system) | n/a | 2 | 0 | 0 | 0 |
| Branches | 1 | 6 | 6 | 0 | 0 | 0 |
| Settings | 1 | 4 | 3 | 1 | 0 | 0 |
| Feature Flags | 1 | 3 | 3 | 0 | 0 | 0 |
| API Keys | 1 | 5 | 5 | 0 | 0 | 0 |
| Notifications | menu + page | 3 | 3 | 0 | 0 | 0 |
| Audit Log + Timeline | 2 | 3 | 3 | 0 | 0 | 0 |
| Data Governance | 1 | 5 | 5 | 0 | 0 | 0 |
| Data Quality | 1 | 4 | 4 | 0 | 0 | 0 |
| Anomaly Detection | 1 | 2 | 2 | 0 | 0 | 0 |
| System Health | 1 | 2 | 2 | 0 | 0 | 0 |
| Performance | 1 | 3 | 3 | 0 | 0 | 0 |
| What Changed | 1 | 1 | 1 | 0 | 0 | 0 |
| Security Center | 1 | 3 | 3 | 0 | 0 | 0 |
| Search (global + universal) | 2 | 3 | 3 | 0 | 0 | 0 |
| Import/Export | 1 | 4 | 4 | 0 | 0 | 0 |
| Documents | 1 | 6 | 5 | 0 | 0 | 1 |
| Resources/Bookings | 1 | 3 | 3 | 0 | 0 | 0 |
| Chat | 1 | 5 | 4 | 0 | 0 | 1 |
| Reports | 1 | 4 | 2 | 0 | 2 | 0 |
| Early Warning / Academic Risk / Gamification pages | — | — | — | — | — | NOT VERIFIED (UI exists; API client functions exist; deep trace skipped) |

---

## 3. CRITICAL WORKFLOW RESULTS

| Workflow | Result | First failure / blocker | Evidence |
|---|---|---|---|
| Login → Students → Add Student → Save → Profile | **PASS (static)** | — | StudentForm→`POST /students`; StudentsService.create; routes `/students/new`; form has client validation; UI invalidates `students` cache |
| Profile → Assign Group | **PASS (static)** | — | StudentDetail.tsx:123 assign mutation → `POST /students/:sid/groups/:gid` → StudentsService.assignToGroup; invalidates `['student',id]` |
| Assign Group → Schedule → Lessons exist | **CONDITIONAL PASS** | Lessons only materialized by nightly `reconcileLessons` (02:20 Asia/Tashkent). A group created today has no Lesson rows until 02:20. | cron/background-jobs.processor.ts `reconcileLessonsForAllTenants`; LessonGeneratorService |
| Manual attendance | **FAIL (first-use)** | `markAttendance` throws `Siz davomat yozmoqchi bo'lgan kunda ushbu guruh uchun dars (Lesson) rejalashtirilmagan.` when no Lesson row exists for that date. New group ⇒ same-day manual attendance impossible until the nightly job runs. | attendance.service.ts:59-79 (`if (!lesson) throw new BadRequestException`) |
| Camera recognition → attendance | **PASS (static design)** | Recognition path creates attendance WITHOUT requiring a lesson (schedule-based resolution ±30 min grace) — asymmetry with manual path | camera/attendance-decision.engine.ts (resolveTargetGroup, scheduleGraceMinutes=30) |
| Face enrollment → ACTIVE template | **PASS (static)** | — | face.controller capture endpoint; core EnrollmentService liveness fail-closed (test-verified); WebcamCapture uses getUserMedia + canvas.toDataURL → `imageBase64` |
| Enrollment → camera recognition | **PASS (static)** | Requires `real-local` engine provider + ONNX model files in production; mock forbidden in production | face-engine.factory.ts |
| Payment (standalone) | **PASS (static)** | — | PaymentsService.create (PENDING) → update (transition guard, FOR UPDATE row lock, balance delta in minor units) |
| Invoice → issue → payment → paid | **PASS (static)** | — | InvoicesService.recordPayment: guarded `updateMany` on exact paidAmount, status derived server-side, atomic receipt counter, student balance increment, audit row |
| Refund lifecycle | **PASS (static)** | — | requestRefund → processRefund/rejectRefund; `refundBalanceReverseMinor`; refunds cannot exceed paid amount; UI buttons wired with invalidation |
| Payroll run lifecycle | **PASS (static)** | Illegal transitions rejected (e2e-asserted behavior in service; runtime suite blocked by env) | payroll-run.controller (calculate→review→approve→process→pay→cancel); financial-engine computePayroll (21 unit tests PASS) |
| Reports → generate | **PASS (static)** | — | `POST /reports/run` (REPORTS ADMIN roles), Reports.tsx run mutation |
| Reports → export | **FAIL** | Frontend calls `GET /reports/export?type=…&format=json…` via JSON `request()`; backend route is `@Post('export')` accepting `{format: csv\|xlsx\|pdf}` and streaming a file. Two mismatches: wrong HTTP method + param transport, and `format=json` unsupported server-side; response is binary, not JSON. Export cannot succeed; the success toast is unreachable (error always thrown) — but the failure path is also wrong (generic ApiError, not a download failure). | api.ts:675 vs reports.controller.ts:90-105; Reports.tsx:99-109 |
| Settings persistence | **PASS (static, client-side)** | Theme/language persistence across refresh handled by `useTheme` + I18nProvider (localStorage); user settings row persisted via `PATCH /users/:id/settings` (self-service, IDOR-guarded). Server-side persistence across logout/login for org fields: static PASS. **NOT RUNTIME VERIFIED.** | Settings.tsx mutations; users.service.updateSettings |
| 150-student morning scenario | **PARTIAL** | Depends on: schedule created before 02:20 job (J1), real-local engine + models deployed, workers started. With those preconditions met, recognition path records attendance without the Lesson dependency. Camera worker caps (3/org default) support 150-student scale only if cameras ≤3 per org or env raised. | camera-worker-manager (MAX_CAMERA_WORKERS_PER_ORG=3), cron scheduler |

---

## 4. FRONTEND ↔ BACKEND PARITY (confirmed chains and discrepancies)

### 4.1 Verified working chains (UI→api.ts→controller→service→Prisma→cache invalidation→UI)

| Feature | UI | API | Service | DB | UI update |
|---|---|---|---|---|---|
| Create student | StudentForm | POST /students | StudentsService.create | User+Student | invalidate `students` |
| Delete student | Students.tsx row (ConfirmDialog) | DELETE /students/:id | StudentsService.remove (history-guard, biometric purge, user deletion) | cascade tx | invalidate `students` |
| Assign/remove group | StudentDetail modal | POST/DELETE /students/:sid/groups/:gid | StudentsService | StudentGroup | invalidate `student` |
| Attendance create | Attendance modal | POST /attendance `{groupId,date,records[]}` | AttendanceService.markAttendance (tx, P2002 recovery, auto-conduct lesson) | Attendance + Lesson | invalidate `attendance`, `attendance-analytics` |
| Attendance edit | row Edit modal | PATCH /attendance/:id | AttendanceService.update (source→MANUAL, audit) | Attendance | invalidate both |
| Attendance void | row Void (confirm) | DELETE /attendance/:id | AttendanceService.remove (audit, role ADMIN_ROLES) | delete | invalidate both |
| Payments CRUD + status | Payments.tsx | POST/PATCH /payments | PaymentsService (transition guard, balance delta, invoice-linked guard) | Payment + Student.balance | invalidate `payments` |
| Invoice create/issue/cancel/payment/refunds | Invoices.tsx | POST /invoices, /issue, /cancel, /payments, /invoices/refunds* | InvoicesService (INT_MAN guarded transitions, atomic guards) | Invoice/Payment/Refund/Audit | invalidate `invoices` |
| Cameras full CRUD + worker ops | Cameras.tsx | POST/PATCH/DELETE /cameras*, enable/disable, start/stop/restart-worker, config, test-connection, discover | CameraService + CameraWorkerManagerService | Camera + worker state | invalidations + detail tabs refetch |
| Face enrollment lifecycle | FaceEnrollment.tsx | POST /face/enrollments, /capture, /reenroll, /revoke, DELETE /pending | FaceService→core EnrollmentService | FaceEnrollment/FaceTemplate | invalidate `enrollments` |
| Face sessions | FaceRecognition.tsx | POST /face/sessions, /attempts, /finish, GET attempts/history | FaceService→core RecognitionService | RecognitionSession/Attempt | invalidate session queries |
| Notifications | NotificationsMenu | GET list, PATCH read, PATCH read-all | NotificationsController | Notification | invalidate `notifications`, 30s refetch while open |
| Settings | Settings.tsx | PATCH /organizations/me, PATCH /users/:id/settings, POST /users/change-password | OrganizationsService, UsersService (self-service) | Organization/UserSettings/User | invalidate `org-me`/`auth-me` |
| Users CRUD | Users.tsx | /users CRUD (ADMIN_ROLES only) | UsersService | User | invalidate |
| Grades/Homework/Library/Exams/Certificates/Inventory | pages | respective CRUD endpoints | respective services | tables | invalidations confirmed on each |
| Automation / Follow-up | pages | /automation/*, /leads/follow-up-* | AutomationService, FollowUpAutomationService | AutomationRule/Execution, FollowUp | invalidations |
| Branches (+activate/deactivate/manager) | Branches.tsx | /branches + PATCH subroutes | BranchesService | Branch | invalidate |
| Feature flags / API keys / Data governance / Data quality / Security / System health / Observability / Performance | pages | respective endpoints | respective services | tables | invalidate |
| Global search | header + /search + hook | GET /search | SearchController | trgm indexes | query state |

### 4.2 Documented discrepancies

| # | Feature | Discrepancy | Status | Evidence |
|---|---|---|---|---|
| D1 | Reports export | UI sends `GET /reports/export?type&format=json` via JSON `request()`; backend `@Post('export')` expects JSON body `{type,format∈csv\|xlsx\|pdf}` and streams binary. Wrong method, wrong param transport, unsupported format value, un-parseable binary response. Export fails at runtime by design mismatch. | **FAIL** | apps/web/src/lib/api.ts:675-676; apps/web/src/pages/Reports.tsx:99-109 (also `downloadFile()` exists in api.ts but is NOT used here); apps/api/src/reports/reports.controller.ts:90-105 |
| D2 | Manual attendance vs Lesson dependency | Manual `markAttendance` hard-blocks when no Lesson exists for (group,date). Lessons are only generated by the nightly job (02:20). Same-day manual attendance for a brand-new group fails with an Uzbek-language error that doesn't tell the admin how to fix it. Camera recognition path does NOT require a lesson. Inconsistent policy between the two paths. | **FAIL (first-use) / product decision gap** | attendance.service.ts:59-79; cron/background-jobs.processor.ts reconcileLessons; camera/attendance-decision.engine.ts |
| D3 | PaymentStatus type mismatch (UI) | Prisma has `PARTIALLY_PAID`; web `PaymentStatus` type = PAID/PENDING/OVERDUE/CANCELLED (no PARTIALLY_PAID). Payments page badges for a PARTIALLY_PAID payment fall into `statusColor`'s `primary` bucket (renders, no crash). Invoices page (which does know PARTIALLY_PAID) creates the actual state. | **PARTIAL (cosmetic risk, data correct)** | apps/web/src/lib/types.ts:7; apps/api/src/payments/invoices.service.ts status derivation; components/ui.tsx statusColor |
| D4 | Invoices "Record payment" amount vs student balance source | Invoice payment increments BOTH invoice.paidAmount and Student.balance — consistent. But a standalone manual Payment created then marked PAID also increments balance; the two flows are consistent, yet **there is no UI showing the ledger reconciliation** beyond /reconciliation page. Not a bug; coverage note. | PASS w/ note | payments.service.ts, invoices.service.ts |
| D5 | Chat page vs ChatGateway | ChatController is REST (`POST /chat/messages` etc.). A Socket.io gateway exists (chat.gateway.ts) but the web Chat page uses only REST + query polling; no socket client found in Chat page. Realtime delivery depends on polling. | **PARTIAL** | chat/chat.controller.ts; chat/chat.gateway.ts (only @WebSocketGateway in repo); apps/web Chat.tsx uses chatApi REST |
| D6 | Enrollment "Re-enroll" button | `faceApi.reenroll` exists and controller endpoint exists (`POST /face/enrollments/:id/reenroll`, permission face.reenroll) — but the FaceEnrollment page's actions are Start/Capture/Cancel/Revoke; no reenroll button found in the page. | **BACKEND AVAILABLE / UI NOT CONNECTED** | api.ts faceApi.reenroll; face.controller.ts reenroll; FaceEnrollment.tsx handlers list |
| D7 | Face devices | `faceApi.devices/registerDevice/revokeDevice` and full controller block exist (`face.device.manage` permission — ORG_ADMIN/SUPER_ADMIN only), but no routed UI page manages devices. | **BACKEND ONLY** | face.controller.ts DEVICES section; routes/index.tsx (no devices route) |
| D8 | Recognition history UI | `faceApi.recognitionHistory` + backend `GET /face/recognition-history` exist; FaceRecognition page shows session attempts; a dedicated history view was not found. | **BACKEND AVAILABLE / UI PARTIAL** | api.ts; face.controller.ts |
| D9 | Command palette coverage | ⌘K palette navigates to only 8 destinations (Dashboard, Students, Teachers, Payments, Groups, Leads, Settings, Grades) while 70+ routes exist. Not a failure — discoverability gap. | PASS w/ note | CommandPalette.tsx NAV_ITEMS |
| D10 | Students list search | Students.tsx has 3 onClick sites but no visible search input traced; backend supports `search` param (students.service findAll). Server capability possibly unused by UI. | **NOT VERIFIED (UI depth)** | students.service.ts; Students.tsx (search box not located in traced lines) |
| D11 | Teacher creation → login account | Teacher CRUD exists (`teachersApi`), Teacher model requires unique userId. Whether the Teachers UI creates the linked User (credentials for the teacher to log in) was not traced; Users page creates users separately. Risk: teacher created without a way to log in unless done via Users page. | **NOT VERIFIED** | teachers.controller/service; schema Teacher.userId unique |
| D12 | Payroll `.pay()` step | payrollApi.pay + `POST /payroll/runs/:id/pay` exist; Payroll.tsx traced sites only showed generate + row action; pay button presence not confirmed. | **NOT VERIFIED (UI)** | api.ts payrollApi; hr/payroll-run.controller.ts:117 |

---

## 5. BUTTON ACCEPTANCE MATRIX (key screens; full chains verified statically)

| Screen | Button | Expected | Actual (chain) | API | DB effect | Status |
|---|---|---|---|---|---|---|
| Students | Add Student | open form | navigates /students/new | — | — | PASS |
| Students | Edit (row) | open edit | Link to /students/:id/edit | — | — | PASS |
| Students | Delete (row) | confirm+delete | ConfirmDialog → mutation → toast → invalidate | DELETE /students/:id | guarded delete incl. biometric purge | PASS |
| StudentDetail | Assign | assign group | modal → mutation → toast → invalidate | POST /students/:sid/groups/:gid | StudentGroup | PASS |
| StudentDetail | Enroll face | go enroll | navigate('/face/enroll') — **student preselection not passed** (no query param) | — | — | PARTIAL (UX: user must re-pick student) |
| Attendance | Record attendance | create | modal validates student+group → create with records[] | POST /attendance | Attendance(+Lesson conduct) | PASS (fails D2 when no lesson) |
| Attendance | Edit / Void | correct | modal / confirm → PATCH/DELETE | PATCH·DELETE /attendance/:id | row update/delete + audit | PASS |
| Payments | Record Payment | create | modal → POST → invalidate | POST /payments | Payment(PENDING) | PASS |
| Payments | status select (row) | update status | mutation → invalidate | PATCH /payments/:id | Payment + balance delta (guarded) | PASS |
| Invoices | Create draft | create | modal → POST → invalidate | POST /invoices | Invoice(DRAFT) | PASS |
| Invoices | Issue | issue | POST issue → invalidate | POST /invoices/:id/issue | DRAFT→ISSUED | PASS |
| Invoices | Pay | record payment | modal → POST payments (invoiceId forced server-side) | POST /invoices/:id/payments | Payment(PAID)+invoice status+balance+receipt | PASS |
| Invoices | Refund request/process/reject | lifecycle | 3 modals → 3 mutations → invalidate | POST /invoices/refunds, /:id/process, /:id/reject | Refund rows + balance reversal | PASS |
| Invoices | Export | download | **broken chain (D1)** | GET vs POST | none | **FAIL** |
| Cameras | Discover | ONVIF scan | modal → POST discover (throttle 3/min) | POST /cameras/discover | none | PASS |
| Cameras | Add Camera | create | modal → POST → invalidate | POST /cameras | Camera row (creds via CredentialVault) | PASS |
| Cameras | Use (discovered) | prefill | fills form | — | — | PASS |
| Cameras | Enable/Disable toggle | toggle + worker sync | mutation → PATCH enable/disable; controller starts/stops worker accordingly | PATCH /cameras/:id/enable\|disable | Camera.enabled + worker lifecycle | PASS |
| Cameras | Start/Stop/Restart Worker | worker control | 3 mutations → 3 controller routes → manager | POST /cameras/:id/start-worker\|stop-worker\|restart-worker | in-memory+Redis | PASS (restart returns real NOT_STARTED state) |
| Cameras | Test Connection | connectivity check | mutation → POST test-connection (10/min) | POST /cameras/test-connection | none | PASS |
| Cameras | Configure | runtime config | modal → PATCH config → controller resyncs running worker | PATCH /cameras/:id/config | Camera config cols | PASS |
| Cameras | Delete | remove | ConfirmDialog → stopWorker then DELETE | DELETE /cameras/:id | Camera row | PASS |
| Cameras | Retry | refetch | refetch queries | — | — | PASS |
| Face Enrollment | Start enrollment | create PENDING | mutation → POST enrollments → stores enrollmentId (handles `{enrollmentId}` shape) | POST /face/enrollments | FaceEnrollment(PENDING) | PASS |
| Face Enrollment | Capture | submit frame | WebcamCapture(getUserMedia+canvas) → POST capture (fail-closed liveness) | POST /face/enrollments/:id/capture | template activation on pass | PASS |
| Face Enrollment | Cancel | cancel pending | DELETE pending (silent-catch on error — minor) | DELETE /face/enrollments/:id/pending | row removed | PASS |
| Face Enrollment | Revoke | revoke | confirm → POST revoke with reason 'operator_revoked' | POST /face/enrollments/:id/revoke | REVOKED | PASS |
| Face Recognition | Start/Finish session | session control | mutations → POST sessions / finish | POST /face/sessions* | RecognitionSession | PASS |
| Face Recognition | Submit attempt | identify | WebcamCapture → POST attempts | POST /face/sessions/:id/attempts | RecognitionAttempt (+attendance via policy) | PASS |
| Notifications | Mark all read | bulk read | mutation → invalidate | PATCH /notifications/read-all | Notification | PASS |
| Settings | Save org / Save settings / Change password | persist | 3 mutations with validation + invalidate + me() refresh | PATCH/PATCH/POST | Organization/UserSettings/password hash | PASS |
| Users | CRUD | manage users | ADMIN_ROLES enforced | /users* | User | PASS |
| Payroll | Generate/Review/Approve/Process/Cancel | lifecycle | payrollApi mapped 1:1 to payroll-run.controller routes (pay button unconfirmed) | POST /payroll/runs/:id/* | PayrollRun transitions | PASS (D12 pay unverified) |
| Reports | Run report | table result | POST /reports/run → render | POST /reports/run | none (read) | PASS |
| Reports | Export | download | **broken chain (D1)** | GET (wrong) | none | **FAIL** |
| Groups | Add/Edit/Delete | CRUD | modals + ConfirmDialog → /groups CRUD | POST/PATCH/DELETE /groups | Group | PASS |
| Library | borrow/return/overdue | ops | libraryApi 1:1 with library.controller | POST /library/borrow etc. | LibraryBorrow | PASS |

---

## 6. AUTHORIZATION MATRIX

Backend evidence: `RolesGuard` (roles.guard.ts: explicit @Roles wins → @AllowSelfService → @AllowAnyRole(staff-only, family denied) → deny; SUPER_ADMIN bypass) and `PermissionsGuard` (fail-closed, camera/face). Frontend: only auth state guards (`Protected`); per-route role restrictions exist in `Protected(roles)` machinery but no route passes `roles` (static read) — server is the enforcement layer.

| Feature | SUPER | ORG_ADMIN | MANAGER | TEACHER | ASSISTANT | STUDENT | PARENT | Result |
|---|---|---|---|---|---|---|---|---|
| Dashboard stats | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ (AllowAnyRole=staff only) | ✖ | PASS (matches admin tool) |
| Students read | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ | PASS |
| Students create/update | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | PASS (ADMIN_ROLES) |
| Student delete | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | PASS (SUPER_ADMIN,ORG_ADMIN only) |
| Attendance mark | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | PASS (@Roles at controller) |
| Attendance void | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | PASS (ADMIN_ROLES on DELETE) |
| Payments/Expenses | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | PASS (ADMIN_ROLES) |
| Invoices mutations | ✔ | ✔ | ✔ (limited) | ✖ | ✖ | self reads | ✖ | PASS (controller lists) |
| HR/Payroll | ✔ | ✔ | ✔ | read own (leave) | read (1 endpoint) | ✖ | ✖ | PASS |
| Cameras manage | ✔ | ✔ | ✖ (view only) | ✖ | ✖ | ✖ | ✖ | PASS (RolePermissions) |
| Cameras view | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | PASS |
| Face enroll/revoke | ✔ | ✔ | ✔ (enroll; revoke ✖) | ✖ | ✖ | ✖ | ✖ | PASS |
| Face recognize/attendance | ✔ | ✔ | ✔ | ✔ | ✖ (view+recognize only) | ✖ | ✖ | PASS |
| Face devices | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | PASS (FACE_DEVICE_MANAGE not in MANAGER set) |
| Face audit/analytics | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | PASS |
| Users / API keys / Audit / Data governance / Branch admin | ✔ | ✔ | ✖ (branches read) | ✖ | ✖ | ✖ | ✖ | PASS |
| Analytics | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ | PASS |
| Feature flags | ✔ | ✔ (scope varies) | ✖ | ✖ | ✖ | ✖ | ✖ | PASS (ADMIN_ROLES) |
| Chat | staff set | ✔ | ✔ | ✔ | ✔ | ✖ (CHAT_ROLES excludes family) | ✖ | PASS per CHAT_ROLES |
| Parent portal data | ✔ | ✔ | ✖ (controller list not fully traced) | ✖ | ✖ | ✖ | ✔ own children | PARTIAL (role list on parent-portal.controller NOT VERIFIED) |
| Tenant isolation | n/a | ✔ org-scoped | ✔ org-scoped | ✔ | ✔ | ✔ own | ✔ own | PASS by construction (organizationId on every query; e2e suite exists but NOT RUNTIME VERIFIED) |

---

## 7. CORE USER JOURNEYS (static traces)

### 7.1 New student
Login → Students → **Add Student** (Link `/students/new`) → form validation → **Save** (`POST /students`; creates User+Student) → list refresh (invalidate) → open profile → **Assign** (POST assign-group) → success toast + cache invalidation. **PASS.** First potential blocker downstream: manual attendance for today's group requires a Lesson row (D2).

### 7.2 New group
Courses (prerequisite select in GroupForm — required `courseId` validated client-side) → Groups → **Add Group** → teacher/capacity/room → Save (`POST /groups`) → detail → schedule rows (`POST /schedule`) → students assigned → **Lesson rows appear only after 02:20 job** → then manual attendance possible; camera attendance possible immediately on recognition (schedule-based). **PASS with documented dependency (D2).**

### 7.3 Camera setup
Cameras → **Discover** (optional ONVIF, 3/min) → **Add Camera** (host/port/protocol/streamPath/credentials; password → CredentialVault) → **Test Connection** → **Enable** (auto-starts worker if recognitionEnabled) → Worker tab shows RUNNING + health (frames, reconnects, frozen-frame) → events tab lists CameraAttendanceEvents → attendance rows appear per decision engine. **PASS.** Failure mode surfaced: worker start failure logged + alerting service; restart returns honest `NOT_STARTED`.

### 7.4 Face enrollment
/face/enroll → select student → **Start enrollment** (PENDING) → WebcamCapture → **capture** (detect→quality→liveness fail-closed→embed→ACTIVE template, encrypted) → revoke/cancel available. Invalid/no-face/low-quality/liveness-fail paths enforced in core EnrollmentService and covered by passing unit tests (liveness fail-closed test PASS). **PASS.**

### 7.5 Attendance (auto)
Enabled camera + recognized student → engine validates tenant/student/group → schedule resolution ±30min → duplicate rules (manual preserved, day-scoped unique) → atomic Attendance+Event. **PASS (static); runtime behavior NOT RUNTIME VERIFIED.**

### 7.6 Payment
Standalone: Payments → **Record Payment** (PENDING) → mark PAID (guarded transition, balance delta). Invoice: Invoices → create → issue → **Pay** (atomic, receipt, balance) → partial → paid; refunds lifecycle guarded. **PASS.**

### 7.7 Teacher → Payroll
Teachers CRUD → group assignment (teacherId) → schedule → (optional Employee record via HR) → payroll run create/calculate → review → approve → process → paid (illegal transitions rejected). **PASS; teacher login-account creation step NOT VERIFIED (D11).**

---

## 8. SILENT FAILURES (real ones only)

1. **Reports export (D1)** — the request can never succeed; user sees a generic error toast at best. No download flow. This is the only outright broken button found.
2. **FaceEnrollment cancel** — `handleCancelEnrollment` catches cancel API errors with `console.error` only and still shows an info toast "cancelled" to the user; if the DELETE fails, a PENDING enrollment silently remains. Minor, real.
3. **Camera enable** — controller logs a warning and returns the camera even when worker start failed ("enabled but recognition worker could not start"); UI shows enabled state. Mitigation exists (worker-status/health tabs + alerting), but the toggle itself gives no error feedback. Design tradeoff, documented.
4. No success-without-persistence or toast-without-API patterns found elsewhere: every traced mutation has `onError` → user-facing error, and cache invalidation on success.

---

## 9. DATA CONSISTENCY ISSUES (confirmed)

1. **Student balance** — consistent by construction: both payment paths compute balance deltas in integer minor units inside the same transaction, with FOR UPDATE / guarded updates and refund-aware formulas (`paymentStatusBalanceDeltaMinor`, `refundBalanceReverseMinor`). No discrepancy found statically.
2. **Attendance count** — dashboard uses last-30-days groupBy; attendance page analytics uses its own date filters; both org-scoped. Agreements hold; timezone: markAttendance normalizes to org timezone, while dashboard `thirtyDaysAgo` is server-local — a minor boundary skew around midnight windows (documented, low impact).
3. **Camera status badge** — UI maps worker states incl. RECONNECTING label; backend CameraHealthTracker emits DISABLED/CONNECTING/ONLINE/ERROR. `RECONNECTING` is UI-only labeling (from worker status composition) — no data mismatch found.
4. **Group student count** — Students page computes active groups from enrollments client-side (max 3 shown + "+N"); group detail counts server-side. Consistent.
5. **PARTIALLY_PAID badge (D3)** — Payments page type omits the status; badge falls back to `primary` color. Data correct; display unbranded. Cosmetic-consistency issue only.

---

## 10. UX / USABILITY ISSUES (workflow blockers first)

1. **(P0-class UX) Manual attendance blocked by invisible Lesson dependency (D2)** — admin sees an Uzbek error mentioning "dars (Lesson) rejalashtirilmagan" with no guidance to create a schedule or wait for 02:20 job. For a real center operating a new group day-one, this blocks the core workflow.
2. **(P1) No working export from Reports (D1)** — an admin cannot download any report.
3. **Enroll face deep-link loses student context** — StudentDetail "Enroll Face" navigates to /face/enroll without a query param; the admin must re-select the student (error-prone with 150 students).
4. **Discoverability of ops pages** — /performance, /observability, /system-health, /security, /data-quality, /feature-flags, /api-keys, /grades, /schedule etc. are reachable only by URL or scrolling nav; ⌘K palette covers only 8 items.
5. **New-group day-one flow** — nothing in the Groups UI tells the admin that lessons/attendance availability starts after the nightly job.
6. Manual attendance error message is in Uzbek while the rest of the UI is i18n-driven (en/ru/uz) — inconsistent message source (hardcoded vs translations).

---

## 11. NOT VERIFIED (could not be proven from repository evidence)

1. **All runtime journeys** — no running API/DB/browser in this environment; every e2e test failed solely on `ECONNREFUSED 127.0.0.1:3001` (environment limitation, not product failure). Nothing below is runtime-verified.
2. Reports page `json` export option origin (UI offers csv/json/pdf; backend csv/xlsx/pdf) — beyond D1, no other export consumers verified.
3. Teachers page full form fields and teacher↔user credential provisioning (D11).
4. Payroll page full button set (pay button; D12).
5. Parent-portal controller role list; parent self-registration flow.
6. Documents page version upload payload shape (endpoint exists).
7. Early-warning / Academic-risk / Gamification pages' full action wiring (client functions + controllers exist; deep trace skipped).
8. Devices UI absence (D7) — cannot rule out a hidden/embedded management surface, but none routed.
9. `.env`-dependent behaviors in this deployment (FACE_ENGINE_PROVIDER, ALLOW_LOCAL_CAMERAS, MAX_CAMERA_WORKERS*) — actual configured values unknown.

---

## 12. FEATURE COMPLETENESS

| Feature | Complete | Partial | Missing | Not Verified |
|---|---|---|---|---|
| Students lifecycle | ✔ | | | |
| Groups/Courses/Schedule | ✔ | | | lesson same-day dependency (D2) |
| Attendance manual | | ✔ (D2) | | |
| Attendance automatic | ✔ (design) | | | runtime |
| Cameras + workers | ✔ | | | runtime |
| Face enrollment | ✔ | | | runtime |
| Face recognition sessions | ✔ | | | runtime |
| Face devices | | | UI missing | |
| Payments | ✔ | | | |
| Invoices + refunds | ✔ | | | |
| Reports | | ✔ (D1) | | |
| Import/Export | ✔ (ExcelJS streaming export + template/import endpoints) | | | entity coverage |
| Payroll | ✔ | | | pay button UI |
| HR/Leave | ✔ | | | |
| Notifications | ✔ | | | |
| Audit | ✔ | | | |
| Settings | ✔ | | | persistence across sessions |
| Search | ✔ | | | |
| Chat | | ✔ (REST-polling only) | | |
| Devices/history UI | | | missing | |
| Discounts | | | UI (backend models + invoice linkage exist) | |
| Financial periods | | | UI (backend enforced everywhere) | |

---

## 13. RECOMMENDED REMEDIATION ORDER (classification only — nothing fixed)

### P0 — system cannot perform a critical business operation
1. **D1 Reports export**: align client to `POST /reports/export` with JSON body, use existing `downloadFile()` helper, drop/replace `json` format with `xlsx`.
2. **D2 Manual attendance Lesson gate**: either generate Lesson rows synchronously on schedule save / attendance attempt (idempotent), or relax the gate for manual path (documented product decision), or surface actionable error in UI ("create a schedule entry for this day").

### P1 — major workflow broken or incorrect
3. Camera enable silent worker failure → surface worker start failure in enable/disable toggle response UI.
4. FaceEnrollment cancel error swallowed (console-only) while showing "cancelled" info toast.

### P2 — important incomplete behavior
5. Re-enroll button missing on FaceEnrollment page (backend ready).
6. Face Devices management UI absent (backend + permissions ready).
7. Recognition History dedicated view absent.
8. `PaymentStatus` UI type should include `PARTIALLY_PAID` (badge mapping).
9. Chat realtime (gateway exists, client uses REST polling only).
10. Command palette coverage of all routes; Enroll-face deep-link preselection.

### P3 — minor usability/documentation
11. Hardcoded Uzbek attendance error → i18n message with actionable guidance.
12. Students page search input presence (backend supports it) — confirm/expose.
13. Dashboard 30-day window boundary uses server-local time; align to org timezone for consistency.

---

## 30. FINAL VERDICT

## PRODUCT ACCEPTANCE: **CONDITIONALLY ACCEPTED**

Core product workflows (students, groups, cameras, face pipeline, payments, invoices, payroll, notifications, settings) are implemented end-to-end with strong backend invariants and correct cache/error handling on the frontend; the executed unit/integration suites that could run in this environment all pass (2,199 tests: packages 234, web 137, api src 1,962+ — only env-blocked e2e failed). However, two critical operations are broken as shipped — **report export (wrong HTTP contract)** and **same-day manual attendance for a new group (Lesson dependency)** — and no runtime/user-journey verification was possible here. Not "production ready" is claimed: production readiness additionally requires the real-local face engine models deployed and runtime verification of camera→attendance at scale.

---

## 31. WHAT WE NOW KNOW

### DEFINITELY WORKING (evidence-backed, static + passing unit suites)
- Students CRUD + guarded delete (history check, biometric purge, login removal)
- Student↔group assignment both directions
- Groups/Courses/Schedule CRUD with course prerequisite enforcement
- Manual attendance write path (tx, P2002 recovery, audit, org-timezone day normalization) — *when a Lesson exists*
- Attendance edit flips source to MANUAL and camera path preserves it
- Camera CRUD, discover, test-connection, enable/disable with worker lifecycle sync, worker start/stop/restart with honest status, config resync of running workers, credential vault, health tracking (reconnect backoff, frozen-frame detection)
- Face enrollment pipeline incl. fail-closed liveness (unit-test PASS), encrypted ACTIVE templates, revoke/cancel
- Face recognition sessions and attempt funnel statuses
- AttendanceDecisionEngine rules: schedule resolution (±30 min), no group guessing, manual precedence, day-scoped duplicates, 5-min event cooldown, atomic attendance+event, org-timezone dates
- Payments with legal-transition guard, FOR UPDATE locking, minor-unit balance math, closed-period checks
- Invoices: issue/cancel/payment/refunds with atomic guards, derived status, unique receipts, audit rows
- Payroll engine determinism (21 tests PASS) + run state machine with illegal-transition rejection
- HR employees/leave/salary endpoints; payroll runs under both `/payroll/*` and `/hr/payroll/*`
- Notifications list/read/read-all with polling + invalidation
- Authorization: two complementary guards (roles with family-role denial; fail-closed permissions), org scoping on all traced services
- Settings (org, user settings, password) with self-service IDOR guard
- Import/Export service with ExcelJS streaming; documents CRUD; data governance/quality; feature flags; API keys with rotation; audit entity history; universal search
- 2,199 unit/integration tests PASS across packages, api src, web (env-blocked e2e excluded)

### DEFINITELY BROKEN / INCOMPLETE (confirmed)
1. Reports export broken end-to-end (method/format/param/response mismatches) — no working download path
2. Same-day manual attendance for a new group blocked by nightly-only Lesson generation; error message not actionable
3. Camera enable can leave worker down with only log-level feedback to the operator
4. Face enrollment cancel swallows API failure but reports success
5. Re-enroll, Face Devices UI, Recognition History UI — backend capability without connected UI
6. `PARTIALLY_PAID` missing from web PaymentStatus type (badge fallback)
7. Chat page is REST/polling despite an existing WebSocket gateway

### STILL UNKNOWN
- All runtime behavior (no server/DB/browser here): e2e suites, real camera recognition, real ONNX inference, persistence across restarts
- Teacher login-account provisioning from Teachers UI
- Payroll "pay" button presence in UI
- Students page search exposure; per-table sort handlers
- Parent-portal controller role matrix; parent login end-to-end
- Deployment env values (engine provider, worker caps, ALLOW_LOCAL_CAMERAS)
- Discount and Financial Period management surfaces (backend confirmed, UI not found)
- Devices/history hidden surfaces (none routed)
- Import/Export full entity coverage

---

*End of report. This audit made zero modifications to the repository. Remediation can begin from the P0 list using this document as the baseline.*
