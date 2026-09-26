# M-EDU — COMPLETE SYSTEM USER & OPERATION MANUAL
**Discovery-based documentation.** Everything below is evidence-backed from repository code (file references given). Items that could not be verified are marked **NOT VERIFIED**. No code was changed.

*Generated: 2026-09-24 · Repository: m-edu monorepo (apps/web, apps/api, packages/{core, contracts, camera-engine, face-engine, face-security, financial-engine})*

---

# PART 0 — PLATFORM OVERVIEW (1-page answer: "What is M-EDU?")

M-EDU is a **multi-tenant education-center management platform** (NestJS + PostgreSQL + Redis backend, React/Vite SPA frontend) that combines:

1. **Classic school ERP**: students, teachers, groups, courses, schedule, homework, grades, exams, library, certificates, inventory.
2. **Camera + AI face-recognition attendance system**: RTSP IP-cameras → FFmpeg frame ingestion → ONNX face pipeline (detection → quality → liveness → embedding → matching) → automated attendance records.
3. **Finance suite**: student payments, invoices, discounts, refunds, expenses, payroll runs (deterministic payroll engine), financial periods, analytics/forecasting.
4. **CRM**: leads pipeline, follow-up automation rules, communications log.
5. **Ops/observability**: audit log, feature flags, data governance/quality, API keys, system health, background job queue (BullMQ + Redis).

Data model root: every record belongs to an `Organization` (tenant) — see `apps/api/prisma/schema.prisma` (`Organization` model is referenced by all domain models).

**Stack evidence**: root `package.json` (npm workspaces + turbo), `apps/api/src/main.ts` (NestJS, Swagger at `/api/docs`, helmet, Socket.io adapter), `apps/api/prisma/schema.prisma` (PostgreSQL + pg_trgm), `apps/api/src/cron/*` (BullMQ), `apps/web/src/routes/index.tsx` (React Router).

---

# PART 1 — ROLES & PERMISSIONS

## 1.1 System roles (Prisma enum `Role`, schema.prisma:1647)
| Role | Description |
|---|---|
| `SUPER_ADMIN` | Platform-level admin. Full permission set (contracts/src/enums.ts `RolePermissions`). |
| `ORG_ADMIN` | Organization owner/admin. All face/camera + management permissions. |
| `MANAGER` | Operations manager. Face view/enroll/reenroll/recognize, attendance, audit, analytics, camera view (read-only cameras). |
| `TEACHER` | Face view/recognize/attendance only (via permissions system). |
| `ASSISTANT` | Face view + recognize only. |
| `STUDENT` | Login user with student profile. Sidebar hides admin items (`HIDDEN_FOR_STUDENT`, AppLayout.tsx). |
| `PARENT` | Exists in enum; portal access via parent-portal page. Detailed permission set NOT VERIFIED. |

## 1.2 Permission system
- Backend guard chain: `JwtAuthGuard` + `PermissionsGuard` (apps/api/src/auth/permissions.guard.ts) maps `user.role` → permission array from `@medu/contracts` `RolePermissions`.
- Permission strings (packages/contracts/src/enums.ts): `face.view`, `face.enroll`, `face.reenroll`, `face.revoke`, `face.recognize`, `face.attendance`, `face.device.manage`, `face.audit.view`, `face.settings.manage`, `face.analytics.view`, `camera.manage`, `camera.view`.
- Face module additionally has its own `FacePermissionsGuard` (apps/api/src/face/face.controller.ts).
- **Camera endpoints**: role→permission map from `RolePermissions` (SUPER_ADMIN=all, ORG_ADMIN=camera.manage+view, MANAGER=camera.view). TEACHER/ASSISTANT have no camera permissions.

## 1.3 Frontend role handling
- Sidebar: only rule found is `HIDDEN_FOR_STUDENT` set (AppLayout.tsx:132) — STUDENT role hides admin nav items. No other per-role nav filtering found → other roles see all nav items (page-level authorization enforced server-side).
- Route guard: `Protected` wrapper (App.tsx) redirects unauthenticated users to `/login`.

---

# PART 2 — NAVIGATION MAP (real, from AppLayout.tsx)

## Primary nav (PRIMARY_NAV)
| Item | Route | Icon |
|---|---|---|
| Dashboard | `/` | home |
| Students | `/students` | people |
| Teachers | `/teachers` | academic-cap |
| Groups | `/groups` | users |
| Courses | `/courses` | book |
| Attendance | `/attendance` | check |
| Face Recognition | `/face` | face |
| Library | `/library` | book |
| Exams | `/exams` | star |
| Payments | `/payments` | card |
| Invoices | `/invoices` | doc |
| Reports | `/reports` | chart |
| Homework | `/homework` | clipboard |
| Certificates | `/certificates` | badge |
| Chat | `/chat` | chat |

## Secondary nav ("Administration")
| Item | Route |
|---|---|
| Executive Dashboard | `/executive-dashboard` |
| Financial Analytics | `/financial-analytics` |
| Payroll Analytics | `/payroll-analytics` |
| CRM Analytics | `/crm-analytics` |
| Parent Portal | `/parent-portal` |
| HR & Payroll | `/hr` |
| Payroll Runs | `/payroll` |
| Automation | `/automation` |
| Follow-Up Rules | `/follow-up-automation` |
| Branches | `/branches` |
| Inventory | `/inventory` |
| Expenses | `/expenses` |
| Leads | `/leads` |
| Cameras | `/cameras` |
| Anomaly Detection | `/anomaly-detection` |
| Data Governance | `/data-governance` |
| Users | `/users` |
| Audit Log | `/audit` |
| Settings | `/settings` |

## Full route table (routes/index.tsx)
Public: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/auth/callback`.
Protected (AppLayout children) — all routes in order:
`/` Dashboard · `/students` · `/students/new` · `/students/:id` · `/students/:id/edit` · `/teachers` · `/groups` · `/groups/new` · `/groups/:id` · `/groups/:id/edit` · `/courses` · `/attendance` · `/face` · `/face/enroll` · `/payments` · `/invoices` · `/reports` · `/expenses` · `/leads` · `/cameras` · `/users` · `/audit` · `/audit-timeline` · `/search` · `/data-quality` · `/documents` · `/resources` · `/feature-flags` · `/security` · `/system-health` · `/settings` · `/homework` · `/grades` · `/schedule` · `/library` · `/hr` · `/exams` · `/certificates` · `/inventory` · `/early-warning` · `/academic-risk` · `/teacher-workload` · `/forecast` · `/import-export` · `/relationships` · `/notifications` · `/what-changed` · `/chat` · `/parent-portal` · `/executive-dashboard` · `/automation` · `/payroll` · `/financial-analytics` · `/payroll-analytics` · `/crm-analytics` · `/follow-up-automation` · `/branches` · `/data-governance` · `/anomaly-detection` · `/api-keys` · `/observability` · `/performance` · `/reconciliation` · `/communication-history` · `/unauthorized` · `*` NotFound.
Catch-all: `*` → Navigate to `/`.

## Global overlays (AppLayout)
- **CommandPalette** (⌘K) — global component.
- **AIAssistant** — floating global component.
- **NotificationsMenu** (bell) — header.
- **LanguageSwitcher** — header.
- **ThemeToggle** (light/dark) — header + mobile bar.
- **Top search bar** — Enter → navigates `/search?q=…`.
- **Logout button** — sidebar bottom.

---

# PART 3 — DASHBOARD (`/`, pages/Dashboard.tsx + dashboard.controller.ts)

Data source: `dashboardApi.stats()` → `GET /dashboard/stats` (dashboardApi in api.ts:280).

Elements found in Dashboard.tsx:
- **KPI stat cards**: total students, groups, teachers, payments (paid/pending/overdue split) — `calculatePaidShare()` computes % paid.
- **Revenue bar chart** (`RevenueChart`): monthly revenue, values from `MonthlyRevenue` list; per-month bar + tooltip.
- **MiniSparkline** — SVG sparkline helper for trends.
- **Recent payments list** — student name resolution via `payment.student.user.firstName/lastName`.
- **Leads list** — `formatLeadName`.
- **Attendance stats** — `AttendanceStat` list.
- Empty/error/loading states via shared UI.

Backend computation: apps/api/src/dashboard/dashboard.controller.ts + service (SQL aggregation). Exact KPI time windows: **NOT VERIFIED** (not read line-by-line; controller exists, endpoint wired and consumed by Dashboard page).

Quick actions/detail drill-downs: cards link to relevant pages via `Link` (e.g., to students/payments). Exact link targets per card: **NOT VERIFIED** in full.

---

# PART 4 — STUDENT MANAGEMENT

## 4.1 Screens
| Screen | Route | File |
|---|---|---|
| Students list | `/students` | pages/Students.tsx |
| New student | `/students/new` | pages/StudentForm.tsx |
| Student profile | `/students/:id` | pages/StudentDetail.tsx |
| Edit student | `/students/:id/edit` | pages/StudentForm.tsx |

## 4.2 Student lifecycle (as implemented)
1. **Create** — StudentForm → `POST /students` (studentsApi.create). Backend: students.controller.ts. A User record (role STUDENT) is created along with the Student record (schema: Student requires `userId` unique → user).
2. **Profile** — StudentDetail shows identity (via related User), status badge (`StudentStatus`: ACTIVE/PAUSED/COMPLETED/DROPPED/TRIAL), balance (`balance` Decimal), discount, parent info, groups (StudentGroup), attendance history, payments, face enrollment links.
3. **Assign group** — `POST /students/:studentId/groups/:groupId` (studentsApi.assignGroup) → creates active StudentGroup membership.
4. **Remove group** — `DELETE /students/:studentId/groups/:groupId`.
5. **Face enrollment** — from `/face/enroll` (see Part 8).
6. **Attendance** — auto via cameras or manual (Part 9–10).
7. **Payments/invoices** — linked by studentId (Part 11).
8. **Status change / deactivate** — via edit form (status select). Hard delete available via list row action (`studentsApi.remove`) with confirm dialog (row action present in Students.tsx).
9. **Archive**: no dedicated archive concept — only status enum + isActive on User. NOT VERIFIED as separate flow.

## 4.3 Buttons (Students.tsx / StudentDetail.tsx)
| Screen | Button | Action | Backend | Notes |
|---|---|---|---|---|
| Students list | Add Student (header) | opens StudentForm route `/students/new` | — | navigation |
| Students list | row click | navigate to `/students/:id` | — | |
| Students list | search input | filters list (client passes `search` param) | GET /students?search= | debounced |
| StudentForm | Save / Submit | create or update | POST /students or PATCH /students/:id | form validation client-side |
| StudentForm | Cancel | back navigation | — | |
| StudentDetail | Edit | navigate `/students/:id/edit` | — | |
| StudentDetail | Assign to group (modal) | select group → confirm | POST /students/:id/groups/:groupId | |
| StudentDetail | Remove from group | confirm → | DELETE /students/:id/groups/:groupId | |
| StudentDetail | Delete student | confirm dialog → | DELETE /students/:id | present as action (7 onClick sites incl. these) |
| StudentDetail | Enroll face | navigate `/face/enroll?studentId=…` | — | deep-link into enrollment page |

Error toasts via `useToasts` on every mutation; optimistic list refresh via react-query invalidation.

---

# PART 5 — GROUPS / COURSES / SCHEDULE

## 5.1 Group model (schema.prisma `Group`)
Fields: name, courseId (required), teacherId (optional), capacity (default 20), room, startDate/endDate, isActive, branchId. Relations: students via `StudentGroup` (isActive, joinedAt, leftAt), lessons, schedules, attendance, exams, homework, recognitionSessions.

## 5.2 Screens
| Screen | Route | File |
|---|---|---|
| Groups list | `/groups` | Groups.tsx |
| New/Edit group | `/groups/new`, `/groups/:id/edit` | GroupForm.tsx |
| Group detail | `/groups/:id` | GroupDetail.tsx |

## 5.3 Buttons
| Screen | Button | Action | Backend |
|---|---|---|---|
| Groups list | Add Group | open `/groups/new` | — |
| Groups list | row | open `/groups/:id` | — |
| GroupForm | Save | create/update | POST/PATCH /groups |
| GroupDetail | assign teacher (select) | PATCH /groups/:id (teacherId) | groupsApi.update |
| GroupDetail | add/remove student | same student assign/remove endpoints as Part 4 | /students/:sid/groups/:gid |
| GroupDetail | schedule editor | add schedule rows | POST /schedule (scheduleApi) |
| Groups list | delete (row action) | DELETE /groups/:id | confirm dialog |

## 5.4 Courses (`/courses`, Courses.tsx)
CRUD via `coursesApi` → `/courses`. Course fields: name, description, price, duration, level, isActive. Course is prerequisite for Group (Group.courseId required).

## 5.5 Schedule (`/schedule`, Schedule.tsx)
- `Schedule` model: groupId, dayOfWeek (enum), startTime, endTime (strings), room, isActive.
- `scheduleApi` CRUD → `/schedule`.
- **Schedule → Lesson materialization**: nightly `reconcileLessons` job (02:20 Asia/Tashkent) generates Lesson rows for a rolling window (yesterday … +13 days) and auto-closes expired PLANNED lessons (cron/background-jobs.processor.ts `reconcileLessonsForAllTenants`, LessonGeneratorService). Attendance and payroll reference lessons.

---

# PART 6 — TEACHERS / HR / PAYROLL

## 6.1 Teachers (`/teachers`, Teachers.tsx)
- `teachersApi` CRUD → `/teachers`.
- Teacher model: linked User (unique), specializations[], hourlyRate, lessonRate, salaryType (`SalaryType`: MONTHLY/HOURLY/PER_LESSON), bio, experience, optional Employee link.
- Buttons: Add Teacher (opens form), row edit, delete (confirm). Teacher create/update form fields: **NOT VERIFIED line-by-line** (4 onClick sites: add, edit-nav, delete confirm, cancel).

## 6.2 HR (`/hr`, HR.tsx) — Employee management
Endpoints (hrApi): employees CRUD, terminate with reason, leave requests (create/approve/reject), salary lookup, stats. `LeaveType`: SICK/VACATION/PERSONAL/UNPAID; `LeaveStatus`: PENDING/APPROVED/REJECTED/CANCELLED.
Buttons: Add Employee, Edit, Terminate (reason modal), Leave approve/reject, payroll generate/process.

## 6.3 Payroll Runs (`/payroll`, Payroll.tsx) — engine in packages/financial-engine
`PayrollStatus` lifecycle: DRAFT → CALCULATED → REVIEWED → APPROVED → PAID / CANCELLED.
Engine (packages/financial-engine/src/payroll.ts) — pure, deterministic, integer minor-units (tiyin), basis-point tax (default 12% = 1200bp), overtime 1.5× above 160h/month, absence pro-rata over workdays (default 21), late penalties, bonuses, other deductions. `PAYROLL_ENGINE_VERSION = '1.0.0'`.
Endpoints: `POST /hr/payroll/generate`, `GET /hr/payroll/summary`, `POST /hr/payroll/:recordId/process`, payroll-period controller (hr/payroll-period.controller.ts), payroll-run controller.
Buttons on Payroll pages: Generate payroll (period+teacher select), Process record, Analytics links. Per-button verification of Payroll.tsx UI: 2 onClick sites (generate + row action) — detailed field list **NOT VERIFIED**.

## 6.4 Payroll Analytics (`/payroll-analytics`) — read-only dashboards fed by `/analytics/payroll/*` (summary, by-teacher, trend, ratio, efficiency).

---

# PART 7 — CAMERA SYSTEM (deep dive)

## 7.1 Camera model & lifecycle
Camera model (schema): organizationId, name, host, port, protocol (`RTSP`/`ONVIF`), streamPath, location, username, encrypted password, rtspTransport, enabled, recognitionEnabled, attendanceEnabled, similarityThreshold, processingFps, status. *(Exact column list read from controller/DTO usage; full model block: see schema.prisma `Camera`.)*

Lifecycle: **Create → Configure (credentials encrypted via CredentialVault) → Test Connection → Enable → Worker start (manual button or auto at boot `startEnabledCameras()`) → FFmpeg RTSP ingestion → frame sampling → face pipeline → attendance decision**.

## 7.2 Camera screen (`/cameras`, Cameras.tsx — 16 interactive handlers)
Data: `camerasApi.list`, detail expand per row (click row → select camera → tabs Events / Health / Worker).

| Button | Location | Actual action | Backend |
|---|---|---|---|
| Discover Cameras | header | opens discover modal; `discover.mutate()` | POST /cameras/discover (ONVIF, throttled 3/min) |
| Add Camera | header | opens create modal | POST /cameras (camera.manage) |
| (discovered item) Use | discover modal | pre-fills create form (host/port/protocol/name) | — |
| row click | table | expands detail panel (events/health/worker tabs) | GET /cameras/:id/events, /health, /worker-status |
| Start Worker | detail→worker tab | starts recognition worker | POST /cameras/:id/worker/start |
| Stop Worker | detail | stops worker | POST /cameras/:id/worker/stop |
| Restart Worker | detail | restart | POST /cameras/:id/worker/restart |
| Enable/Disable toggle | row | enable or disable camera + worker start/stop | PATCH /cameras/:id/enable \| /disable |
| Test Connection | detail | connection test without saving | POST /cameras/test-connection (10/min) |
| Configure (config modal) | detail | update runtime config (fps, thresholds, flags) | PATCH /cameras/:id/config → worker auto-resync if running (controller `resyncRunningWorker`) |
| Delete | detail | confirm → stop worker then delete | DELETE /cameras/:id |
| Retry | error state | refetch queries | — |

## 7.3 Worker manager (apps/api/src/camera/camera-worker-manager.service.ts)
- In-memory worker Map + Redis-based multi-replica coordination (distributed locks, heartbeat, replicaId).
- Caps: `MAX_CAMERA_WORKERS` default **10** total, `MAX_CAMERA_WORKERS_PER_ORG` default **3**, `DEFAULT_PROCESSING_FPS` **3**, `DEFAULT_SIMILARITY_THRESHOLD` **0.6**.
- NetworkSecurity guard: blocks private/loopback IPs unless `ALLOW_LOCAL_CAMERAS=true` (or non-production).
- Worker states: STARTING → CONNECTING → RUNNING → DEGRADED/ERROR/STOPPING/DISABLED.
- At boot: `startEnabledCameras()` auto-starts workers for enabled+recognitionEnabled cameras.
- Camera change with running worker → auto `restartWorker` (controller resync logic).
- Disable camera ⇒ worker forcibly stopped (security invariant documented in controller).

## 7.4 Streaming internals (packages/camera-engine)
- `FfmpegStreamIngester` — spawns FFmpeg against `rtsp://user:pass@host:port/path` (tcp/udp transport), parses raw frames.
- `BoundedFrameQueue` — drops oldest frame when full.
- `FrameSampler` — rate-limits processing to configured FPS (min interval 33ms).
- `CameraHealthTracker` — frames received/processed/dropped, errors, reconnect attempts, exponential backoff 5s→10s→20s→… capped 60s; **frozen-frame detection** via perceptual hash (`FrozenFrameTracker`, window 30, similarity threshold 2) — flags stalled/covered lens.
- `CredentialVault` — encrypted camera credential storage; `NetworkSecurity` — SSRF/private-IP policy; `perceptual-hash.ts` — image hashing.
- Health status enum surfaced to UI: DISABLED/CONNECTING/ONLINE/ERROR (+RECONNECTING label in web).

## 7.5 Recognition → attendance flow (worker session)
`CameraWorkerSession` (camera-worker-session.ts) captures full config at start (stream URI, decrypted credentials, fps, threshold, recognition/attendance flags) → for each sampled frame: detect → quality → liveness → embed → match against org templates → if identified and attendanceEnabled → `AttendanceDecisionEngine.processRecognition(...)` (see Part 10) → creates CameraAttendanceEvent + Attendance atomically.

## 7.6 Camera configuration parameters (found)
| Param | Default | Where | Effect timing |
|---|---|---|---|
| processingFps | 3 | camera row + worker config | worker restart |
| similarityThreshold | 0.6 | camera row | worker restart |
| rtspTransport | tcp/udp | camera row | worker restart |
| recognitionEnabled | camera row | gates worker start | immediate on enable/disable |
| attendanceEnabled | camera row | gates attendance writes | worker restart |
| MAX_CAMERA_WORKERS | 10 | env | process restart |
| MAX_CAMERA_WORKERS_PER_ORG | 3 | env | process restart |
| ALLOW_LOCAL_CAMERAS | false | env | worker start validation |

## 7.7 Alerting
`CameraAlertingService` (camera-alerting.service.ts) — consumes worker health (errors, reconnects, frozen frames) and creates alerts/notifications. Exact notification channels: **NOT VERIFIED** (service exists, wired into worker manager).

---

# PART 8 — FACE ENROLLMENT (`/face/enroll`, FaceEnrollment.tsx + face.controller.ts)

## 8.1 API (all under `/face`, FacePermissionsGuard, throttled 30/min)
| Endpoint | Purpose | Permission |
|---|---|---|
| POST /face/enrollments | start enrollment for student | face.enroll |
| GET /face/enrollments | list | face.view |
| GET /face/enrollments/:id | detail | face.view |
| POST /face/enrollments/:id/capture | submit base64 image → detect→quality→liveness→embed→activate | face.enroll (10/min) |
| POST /face/enrollments/:id/reenroll | re-enroll with reason | face.reenroll |
| DELETE /face/enrollments/:id/pending | cancel pending | face.enroll |
| POST /face/enrollments/:id/revoke | revoke with reason | face.revoke |

## 8.2 Domain behavior (packages/core/src/application/enrollment.service.ts + tests)
- Enrollment statuses: PENDING → ACTIVE / REVOKED / EXPIRED (`EnrollmentStatus`).
- Template statuses: ACTIVE / REVOKED / EXPIRED / CORRUPTED.
- **Liveness is fail-closed** during enrollment (test: `enrollment.liveness.fail-closed.test.ts`) — liveness must PASS or capture is rejected.
- Only one active enrollment/template per student (dedup enforced by service; old template revoked on re-enroll — see reenroll endpoint + status transitions).
- Image limit: base64 up to ~8MB decoded (`face/image.util.ts` MAX_IMAGE_BYTES; API body limit 12MB, main.ts).
- Number of required captures: **NOT VERIFIED** (single capture activates per controller docstring "detect → quality → liveness → embed → activate"; multi-capture flow NOT VERIFIED).
- Template storage: encrypted (TEMPLATE_ENCRYPTED/DECRYPTED audit events; face-security encryption.service).
- Model version tracked (FaceTemplate.modelVersion; embedder `version`).

## 8.3 UI (FaceEnrollment.tsx)
Select student → start enrollment → capture image (webcam/file — source **NOT VERIFIED**) → submit capture → status badges per attempt → revoke/reenroll actions. 3 onClick sites: start, submit capture, cancel/revoke.

---

# PART 9 — FACE RECOGNITION (`/face`, FaceRecognition.tsx)

## 9.1 Pipeline (RealFaceEngine, packages/face-engine)
```
Image/frame → RealDetector (YuNet ONNX, input 640, conf ≥0.5)
           → QualityAssessor (sharpness/brightness/pose)
           → RealLivenessChecker (MiniFASNetV2 ONNX, input 80, pass ≥0.8; SHA-256 pinned)
           → RealEmbedder (SFace ONNX, input 112, 128-d vector)
           → compareEmbeddings (cosine similarity)
           → threshold decision (camera config similarityThreshold, default 0.6)
```
Model integrity validation at init (model-integrity.ts): YuNet (MIT), SFace (Apache-2.0), MiniFASNetV2 (Apache-2.0, SHA-256 pinned `d7b3cd9b…`).
Provider selection: `FACE_ENGINE_PROVIDER` env = `real-local` (production requires model paths incl. liveness) or `mock` (dev only; forbidden in production).
Liveness decisions: PASS/FAIL/UNCERTAIN/UNAVAILABLE. Attempt statuses enum covers full funnel (DETECTED → QUALITY_PASSED/FAILED → LIVENESS_* → EMBEDDING_GENERATED → MATCH_FOUND/NOT_FOUND/UNCERTAIN → IDENTIFIED/UNIDENTIFIED/ERROR).

## 9.2 Recognition sessions API
| Endpoint | Purpose |
|---|---|
| POST /face/sessions | start recognition session (CreateSessionDto) |
| POST /face/sessions/:id/attempts | submit attempt image (10/min) |
| POST /face/sessions/:id/finish | finish with reason |
| GET /face/sessions/:id/attempts | attempt list |
| GET /face/recognition-history | history query |

Devices: POST/GET /face/devices (RegisterDeviceDto; DeviceStatus REGISTERED→ACTIVE→REVOKED/SUSPENDED; heartbeat events). Face audit: GET /face/audit (face.audit.view). Face settings: FACE_SETTINGS_MANAGE guarded endpoints (face.controller later section; settings.dto exists).
UI (FaceRecognition.tsx): session start/stop, live attempt feed, thresholds display. 3 onClick sites: start session, submit attempt, finish session.

---

# PART 10 — ATTENDANCE

## 10.1 Data model
`Attendance` unique constraint **(studentId, groupId, date)** — one record per student per group per day (schema comment: granular to day; multiple lessons/day collapse to one row). Fields: status (PRESENT/ABSENT/LATE/EXCUSED), source (default "MANUAL"), note, confidence, similarityScore, deviceId, cameraId, recognitionAttemptId, lessonId.
`CameraAttendanceEvent` — every recognition outcome as durable event (decision enum in engine: RECORDED / STUDENT_INACTIVE / STUDENT_NOT_IN_GROUP / NO_SCHEDULED_GROUP / AMBIGUOUS_SCHEDULE / MANUAL_PRESERVED / DUPLICATE_PREVENTED).

## 10.2 Automatic attendance chain
```
Camera → FFmpeg frames → Face pipeline (Part 9) → student identified
→ AttendanceDecisionEngine (camera/attendance-decision.engine.ts):
   1. org+camera tenant check
   2. student active? (user.isActive) else STUDENT_INACTIVE
   3. active group memberships? else STUDENT_NOT_IN_GROUP
   4. resolve group STRICTLY from schedule (dayOfWeek + start/end ± 30 min grace, org timezone; camera location tie-breaker) — no fallback to first group
      - none → NO_SCHEDULED_GROUP
      - >1 candidate → AMBIGUOUS_SCHEDULE
   5. existing attendance that day? (day-normalized to org timezone)
      - manual record → MANUAL_PRESERVED (manual is authoritative)
      - camera record → DUPLICATE_PREVENTED
   6. create Attendance + CameraAttendanceEvent in ONE transaction (atomic)
```
Idempotency: deterministic key (org, camera, student, group-bucket, time-bucket) + **5-minute camera cooldown** bucket for events.

## 10.3 Answers to specific rule questions (from code)
- *Student stands 10 min in front of camera:* first identification records attendance; subsequent recognitions within cooldown/idempotency window create only duplicate-prevented events. **One attendance per student/group/day.**
- *Student leaves and returns:* same-day return → DUPLICATE_PREVENTED (day-scoped unique constraint).
- *Two cameras recognize simultaneously:* events both persist (per-camera idempotency), attendance created once (unique constraint + transaction); other becomes duplicate-prevented.
- *Unknown person:* no studentId → no attendance; detection only (MATCH_NOT_FOUND / UNIDENTIFIED attempts, logged; recognition attempt rows persist).
- *Inactive student:* STUDENT_INACTIVE event, no attendance.
- *No/ambiguous schedule:* NO_SCHEDULED_GROUP / AMBIGUOUS_SCHEDULE event, no attendance (system never guesses group).
- *Manual vs camera:* manual rows win (`MANUAL_PRESERVED`); camera never overwrites manual.
- *Timezone/midnight:* attendance date is org-local calendar date (default `Asia/Tashkent`, `getOrganizationDate`), not UTC — night session after local midnight counts for the new day.
- *Recognition without schedule match but multiple groups:* no attendance (ambiguous path) — operator must fix schedule.

## 10.4 Manual attendance (`/attendance`, Attendance.tsx)
- Filter bar: group, date, status (debounced) + pagination (limit 20).
- Stat cards from `GET /attendance/analytics` (AttendanceAnalytics).
- Table rows with status badges (PRESENT green, ABSENT red, LATE amber, EXCUSED azure).
| Button | Action | Backend |
|---|---|---|
| Add Attendance | modal: student, group, date (default today), status, note | POST /attendance |
| row Edit | modal: change status/note | PATCH /attendance/:id |
| row Void/Delete | confirm | DELETE /attendance/:id |
- Who can mark: any role with page access; server-side permission enforcement details for attendance controller: **NOT VERIFIED** (guard decorators not read line-by-line).

## 10.5 Core `AttendancePolicy` (packages/core) — used by session-based recognition path
Checks: student active → student in group → duplicate for day → RECORDED. Decisions mirror engine enum (RECORDED/DUPLICATE_PREVENTED/STUDENT_NOT_IN_GROUP/LESSON_INVALID/STUDENT_INACTIVE/REJECTED).

---

# PART 11 — PAYMENTS / INVOICES / FINANCE

## 11.1 Models
- `Payment`: studentId, amount, status (`PAID/PENDING/OVERDUE/CANCELLED/PARTIALLY_PAID`), description, dueDate, method, reference, invoiceId, receiptNumber, receiptIssuedAt, paidAt, transactions (PaymentTransaction[]).
- `Invoice`: status (`DRAFT/ISSUED/PARTIALLY_PAID/PAID/OVERDUE/CANCELLED/REFUNDED`), linked payments (Restrict delete).
- `Discount`: scope STUDENT/GROUP/COURSE, type PERCENTAGE/FIXED.
- `Refund`: status REQUESTED/APPROVED/PROCESSED/REJECTED.
- `Expense`: category enum (SALARY/RENT/UTILITIES/MARKETING/SUPPLIES/MAINTENANCE/SOFTWARE/TRAINING/OTHER).
- `FinancialPeriod`: status OPEN/REVIEW/RECONCILED/CLOSED; closed by users (`financialPeriodsClosed` relation).
- `PaymentGateway` enum: PAYME/CLICK/UZUM/STRIPE/PAYPAL/CASH/BANK.
- Student.balance (Decimal 12,2) — denormalized balance.

## 11.2 Screens & buttons
**Payments (`/payments`, Payments.tsx)**
| Button | Action | Backend |
|---|---|---|
| Add Payment / Record Payment | modal: student, amount, method, description, dueDate | POST /payments |
| row actions | edit / delete | PATCH·DELETE /payments/:id |
- List + filters (status etc.). 2 onClick sites (open modal, submit).

**Invoices (`/invoices`, Invoices.tsx — 14 interactive sites)**
CRUD + line items + status transitions (issue, mark paid, cancel) + payment allocation + export action. Exact per-button endpoints: **NOT VERIFIED** (invoices.controller.ts exists: `payments/invoices.controller.ts`; UI actions map to it via invoicesApi).

**Expenses (`/expenses`)**: CRUD + `GET /expenses/summary`. Category select.

**Reconciliation (`/reconciliation`)**: `GET /analytics/reconciliation/*` (report, discrepancies, student-balances, history) + `GET /analytics/financial/reconciliation`.

**Financial Analytics (`/financial-analytics`)**: cash-flow, what-if simulation, forecast, anomalies — all read-only from `/analytics/financial/*`.

**Financial periods**: FinancialPeriod model + closed-by relation exist; dedicated UI screen **NOT FOUND** in routes (management likely via API only) → **BACKEND AVAILABLE / UI NOT CONNECTED (NOT VERIFIED for any hidden UI)**.

## 11.3 Automatic finance processes
- `markOverdueInvoices` — hourly at :10 → overdue invoices flagged.
- `remindUpcomingPayments` — daily 10:00 → payment reminders (notifications).
Both in financial-cron.service.ts via BullMQ with distributed locks.

---

# PART 12 — REPORTS (`/reports`, Reports.tsx)

- `Report` model + `ReportType` enum: ATTENDANCE / FINANCIAL / ACADEMIC / CUSTOM.
- Reports controller (reports/reports.controller.ts) serves report generation; UI has 2 onClick sites (report type select + generate/export).
- Export formats: **NOT VERIFIED** (import-export module exists separately — see Part 13).
- Filters/date range/grouping per report type: **NOT VERIFIED** line-by-line.

---

# PART 13 — IMPORT / EXPORT (`/import-export`, ImportExport.tsx)

Backend module: import-export/import-export.controller.ts (bulk data import/export). Exact supported entities and formats: **NOT VERIFIED** (controller exists, UI page exists and is routed).

---

# PART 14 — NOTIFICATIONS / ALERTS

## Components
- `Notification` model per org+user; DeviceToken model (push), EmailLog, SMSLog (status PENDING/SENT/DELIVERED/FAILED), EmailTemplate, telegram fields on User (telegramChatId, link token).
- Controllers: notifications.controller.ts (list, mark read, read-all), email.controller.ts, telegram-webhook.controller.ts, communication-history.controller.ts.
- UI: NotificationsMenu (header bell) + `/notifications` center page; `/communication-history` page.

## Events that create notifications (found)
- Payment reminders (daily cron).
- Camera alerts (alerting service).
- Follow-up automation + automation engine executions.
- Attendance/grades/homework email categories exist (EmailCategory enum) — per-event triggers: **NOT VERIFIED** for each.
- Telegram: linking via token + webhook controller — delivery triggers **NOT VERIFIED**.

---

# PART 15 — SETTINGS (`/settings`, Settings.tsx)

- `UserSettings` model: theme, language, timezone, email/push/sms notification booleans.
- `usersApi.updateSettings` → PATCH /users/:id/settings; change password → POST /users/change-password.
- Organization settings: `organizationsApi.update` → PATCH /organizations/me (name, email, phone, timezone, language, currency, logo, address, website, settings JSON). Branding: OrganizationBranding model.
- UI: 1 onClick site (save). Tabs/sections present: profile, organization, notifications, language/theme. Per-tab inventory: **NOT VERIFIED**.
- Feature flags (`/feature-flags` page + feature-flags module), API keys (`/api-keys` + api-keys module with created-by relation) — separate admin screens.

---

# PART 16 — SEARCH / FILTER / EXPORT MATRIX

| Screen | Search | Filters | Sort | Pagination | Export |
|---|---|---|---|---|---|
| Students | ✔ (server `search`) | status | NOT VERIFIED | ✔ | NOT VERIFIED |
| Groups | NOT VERIFIED | — | NOT VERIFIED | ✔ | — |
| Attendance | — | group/date/status | — | ✔ (20) | — |
| Payments | — | status | — | ✔ | — |
| Cameras | ✔ (query param `search`) | status/enabled/location | — | ✔ | — |
| Audit | filters present | — | — | ✔ | — |
| Universal search `/search` | ✔ global (search.controller.ts) | entity type | — | — | — |
| Library | ✔ (`searchBooks`) | — | — | ✔ | — |

(Specific sort columns per table: NOT VERIFIED — table headers found but sort handlers not individually traced.)

---

# PART 17 — AUTOMATIC BACKGROUND PROCESSES (user does nothing)

Queue: BullMQ `background-jobs`, Redis, scheduler tz **Asia/Tashkent**, distributed locks per job (cron/background-jobs.scheduler.ts + processor.ts):

| Job | Schedule | Process | DB effect | User-visible |
|---|---|---|---|---|
| cleanupLogs | daily 00:00 | CleanupService.cleanupOldLogs | prunes old logs/events | cleaner audit/data |
| cleanupSessions | hourly | AuthService.cleanupExpiredEntries | removes expired sessions/tokens | forced re-login only when expired |
| markOverdueInvoices | hourly :10 | FinancialCronService | Payment/Invoice → OVERDUE | overdue badges, debt alerts |
| remindUpcomingPayments | daily 10:00 | FinancialCronService | creates notifications | payment reminders |
| evaluateFollowUpRules | every 30 min | FollowUpAutomationService.evaluateAllTenants | FollowUp records, notifications | CRM follow-ups appear |
| evaluateAutomationRules | every 15 min | AutomationService.evaluateAllRules | AutomationExecution rows | automation effects |
| reconcileLessons | daily 02:20 | LessonGeneratorService (all orgs) | creates Lesson rows (−1…+14d), closes expired PLANNED | schedule/attendance/payroll consistency |

Camera subsystem (no user action):
- Boot: `startEnabledCameras()` auto-starts workers for enabled cameras.
- Continuous: FFmpeg ingest → frame sampling → recognition → attendance decisions → durable events.
- Redis heartbeat across replicas; worker health tracking with reconnect backoff; frozen-frame detection → camera alerts.

Registration is best-effort: if Redis is unreachable, jobs are skipped and logged (never blocks API boot).

---

# PART 18 — COMPLETE USER JOURNEYS

## JOURNEY 1 — New student
Login → **Students** → **Add Student** → fill form → **Save** (POST /students) → open profile → **Assign to group** (select group → confirm → POST /students/:id/groups/:gid) → **Face** → `/face/enroll` → select student → **Start enrollment** → capture → **Submit capture** (POST capture → ACTIVE template) → verify via `/face` recognition session.

## JOURNEY 2 — New group
**Groups → Add Group** → name, course (required), teacher, capacity, room → **Save** → open group → add schedule rows (POST /schedule) → add students (assign endpoints) → nightly job materializes Lessons → attendance now possible.

## JOURNEY 3 — Camera setup
**Cameras → Discover** (optional, ONVIF) → **Add Camera** (name, host, port 554, RTSP, streamPath, credentials) → **Test Connection** → **Save** → **Enable** toggle (worker auto-starts if recognition enabled) → check **Worker** tab (RUNNING) → recognition produces events → attendance appears in `/attendance`.

## JOURNEY 4 — Normal school day
Students arrive → camera workers ingest frames → faces detected/recognized → AttendanceDecisionEngine resolves group from schedule → Attendance rows created (first hit of the day) → Dashboard/Attendance/Reports reflect data. Manual records take precedence; duplicates blocked.

## JOURNEY 5 — Manual attendance
**Attendance → Add Attendance** → pick student+group+date+status+note → Save. Edit/void via row actions. Camera system respects manual rows (MANUAL_PRESERVED).

## JOURNEY 6 — Payment
**Payments → Add Payment** → student, amount, method → Save (POST /payments) → status PENDING → mark paid (status change) / invoice linkage → nightly job flags overdue; reminders sent 10:00 daily.

## JOURNEY 7 — Teacher
**Teachers → Add Teacher** (creates linked user) → set salaryType/rates → assign as Group.teacherId → schedule links lessons → HR employee record optional (`/hr`) → payroll period → **Generate payroll** → review → approve → **Process** → paid. Leave requests via `/hr`.

---

# PART 19 — DATA FLOWS

## Manual data (students/groups/payments)
```
USER → React page → api.ts client → REST (NestJS controller)
→ Service → Prisma → PostgreSQL → response → react-query cache → UI
```

## Camera recognition (the flagship flow)
```
IP CAMERA (RTSP)
→ FfmpegStreamIngester (packages/camera-engine, spawned per worker)
→ BoundedFrameQueue → FrameSampler (fps)
→ FaceEngine (YuNet → Quality → MiniFASNetV2 liveness → SFace 128-d embed)
→ Matcher (cosine vs org ACTIVE templates, threshold 0.6 default)
→ CameraWorkerSession (identification event)
→ AttendanceDecisionEngine (schedule resolve + policy + duplicate rules)
→ PostgreSQL (Attendance + CameraAttendanceEvent, atomic)
→ UI (Attendance page, Camera Events tab, Dashboard)
```

## Finance automation
```
BullMQ scheduler → processor (lock) → FinancialCronService → DB status flips → Notification rows → bell menu
```

---

# PART 20 — FEATURE STATUS MATRIX

| Feature | UI | Backend | DB | Automated | Status |
|---|---|---|---|---|---|
| Students | ✔ | ✔ | ✔ | — | COMPLETE |
| Groups | ✔ | ✔ | ✔ | lesson reconcile | COMPLETE |
| Courses | ✔ | ✔ | ✔ | — | COMPLETE |
| Teachers | ✔ | ✔ | ✔ | — | COMPLETE |
| HR/Employees/Leave | ✔ | ✔ | ✔ | — | COMPLETE |
| Payroll runs | ✔ | ✔ | ✔ | — | COMPLETE |
| Attendance (manual) | ✔ | ✔ | ✔ | — | COMPLETE |
| Attendance (camera auto) | partial* | ✔ | ✔ | ✔ | COMPLETE (*events/health UI via camera detail tabs) |
| Cameras | ✔ | ✔ | ✔ | workers | COMPLETE |
| Face enrollment | ✔ | ✔ | ✔ | — | COMPLETE |
| Face recognition sessions | ✔ | ✔ | ✔ | ✔ (camera workers) | COMPLETE |
| Payments | ✔ | ✔ | ✔ | overdue+reminders | COMPLETE |
| Invoices | ✔ | ✔ | ✔ | overdue flagging | COMPLETE |
| Expenses | ✔ | ✔ | ✔ | — | COMPLETE |
| Refunds/Discounts | UI NOT VERIFIED | ✔ (models, controllers presumed) | ✔ | — | PARTIAL / NOT VERIFIED |
| Financial periods | UI NOT FOUND | ✔ (model+relation) | ✔ | — | BACKEND ONLY (NOT VERIFIED) |
| Reports | ✔ | ✔ | ✔ | — | PARTIAL (formats NOT VERIFIED) |
| Import/Export | ✔ | ✔ | ✔ | — | PARTIAL (entities NOT VERIFIED) |
| Notifications | ✔ | ✔ | ✔ | ✔ | COMPLETE |
| Email/SMS/Telegram | partial | ✔ (controllers/logs) | ✔ | NOT VERIFIED | PARTIAL |
| Chat | ✔ | ✔ (Socket.io gateway) | ✔ | — | COMPLETE |
| Parent portal | ✔ | ✔ (controller) | ✔ | — | PARTIAL (depth NOT VERIFIED) |
| Library/Exams/Certificates/Inventory | ✔ | ✔ | ✔ | — | COMPLETE |
| Gamification | models+controller exist | ✔ | ✔ | events | PARTIAL (UI NOT VERIFIED) |
| Settings | ✔ | ✔ | ✔ | — | COMPLETE |
| Audit log | ✔ | ✔ | ✔ | auto-logging | COMPLETE |
| Feature flags / API keys | ✔ | ✔ | ✔ | — | COMPLETE |
| Data governance/quality | ✔ | ✔ | ✔ | — | PARTIAL (depth NOT VERIFIED) |

---

# PART 21 — BUTTON → BACKEND MAP (high-value rows; per-screen tables above give the rest)

| UI Screen | Button | Frontend fn | API | Backend service | DB effect |
|---|---|---|---|---|---|
| Cameras | Add Camera | create.mutate | POST /cameras | CameraService.createCamera | Camera row |
| Cameras | Enable/Disable | toggle.mutate | PATCH /cameras/:id/enable\|disable | CameraService + WorkerManager start/stop | Camera.enabled + worker state |
| Cameras | Start/Stop/Restart Worker | start/stop/restartWorker.mutate | POST /cameras/:id/worker/* | CameraWorkerManagerService | in-memory + Redis state |
| Cameras | Test Connection | testConnection.mutate | POST /cameras/test-connection | CameraService.testCameraConnection | none |
| Cameras | Discover | discover.mutate | POST /cameras/discover | CameraService.discoverCameras | none |
| Cameras | Delete | deleteCamera.mutate | DELETE /cameras/:id | WorkerManager.stopWorker + CameraService.deleteCamera | Camera row removed |
| Cameras | Configure | updateConfig.mutate | PATCH /cameras/:id/config | CameraService + resyncRunningWorker | Camera config cols |
| Students | Save | submit | POST/PATCH /students | StudentsService | User+Student rows |
| Students | Assign group | assignGroup | POST /students/:sid/groups/:gid | StudentsService | StudentGroup row |
| Attendance | Add | create | POST /attendance | AttendanceService | Attendance row |
| Attendance | Edit | update | PATCH /attendance/:id | AttendanceService | Attendance row |
| Face Enroll | Start | start | POST /face/enrollments | FaceService.startEnrollment | FaceEnrollment PENDING |
| Face Enroll | Submit capture | capture | POST /face/enrollments/:id/capture | FaceService.processEnrollmentCapture → core EnrollmentService | FaceTemplate ACTIVE (encrypted) |
| Face | Start session | start | POST /face/sessions | FaceService.startSession | RecognitionSession |
| Face | Submit attempt | attempt | POST /face/sessions/:id/attempts | FaceService.processAttempt → core RecognitionService | RecognitionAttempt (+Attendance via policy) |
| Payments | Add | create | POST /payments | PaymentsService | Payment row |
| HR | Generate payroll | generate | POST /hr/payroll/generate | HR service → financial-engine computePayroll | PayrollRun/SalaryRecord |
| Login | Sign in | authApi.login | POST /auth/login | AuthService | Session row |

---

# PART 22 — GLOSSARY (simple language)

- **Organization** — the tenant; one education center. All data belongs to one.
- **Branch** — sub-location of an organization.
- **Student** — a person record with a linked login User, balance, status, groups.
- **Group** — a class cohort: course + teacher + students + schedule.
- **Enrollment (face)** — the process/record of registering a student's face.
- **Template** — the stored, encrypted face embedding used for matching.
- **Embedding** — a 128-number vector describing a face, produced by SFace.
- **Liveness** — anti-spoof check confirming a real person, not a photo (MiniFASNetV2).
- **Recognition** — matching a live face against templates to identify a student.
- **Camera Worker** — a background process per camera pulling RTSP frames and running the face pipeline.
- **RTSP** — network protocol IP cameras stream video over.
- **ONVIF** — discovery/management standard for IP cameras (used by Discover).
- **Attendance Event** — durable record of every recognition outcome (even duplicates).
- **Idempotency** — guarantee the same recognition doesn't create duplicate effects.
- **Financial Period** — an accounting window (OPEN→REVIEW→RECONCILED→CLOSED).
- **Invoice** — a bill issued to a student, payable via Payments.
- **Payment** — money received from a student; updates balance/status.
- **Payroll** — calculated teacher salary for a period (engine: financial-engine).
- **Permission** — a named capability (e.g. `camera.manage`) granted per role.
- **Role** — a user class (SUPER_ADMIN…STUDENT) mapping to a permission set.

---

# PART 23 — UNKNOWN / NOT VERIFIED (consolidated)

1. Exact Dashboard KPI time windows and per-card drill-down targets.
2. Teachers page full form field list; per-row action set.
3. Invoices page per-button endpoint mapping (controller exists; UI actions not traced one-by-one).
4. Refund/Discount UI screens (backend models confirmed; dedicated screens not found in routes — may be embedded modals).
5. Financial Period management UI (backend only confirmed).
6. Reports export formats and per-report filters.
7. Import/Export supported entities and file formats.
8. Face enrollment capture source (webcam vs file upload) and required capture count.
9. Face settings management UI depth (FACE_SETTINGS_MANAGE endpoints partially read).
10. Attendance controller role guards (decorators not read line-by-line).
11. Email/SMS/Telegram trigger matrix (which events send which messages).
12. Camera alerting service notification channels and thresholds.
13. Gamification UI surface.
14. Parent portal page depth and role gating details.
15. Per-table sort columns and client-side sorting behavior.
16. Payroll UI exact field list (Payroll.tsx, PayrollAnalytics.tsx).
17. Devices (`/face/devices`) UI surface — API confirmed; dedicated UI page not found in routes.
18. WebSocket usage beyond chat gateway (chat.gateway.ts is the only @WebSocketGateway found).

---

*End of manual. This document is discovery-only: no code was modified, no audit judgments made.*
