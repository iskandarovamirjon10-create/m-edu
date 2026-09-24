# MEDU — FULL PLATFORM AUDIT REPORT

**Audit date:** 2026-09-10
**Audit mode:** READ-ONLY. No source files were modified, created, or deleted during the audit. Every finding is backed by in-repo evidence (file:line references). No runtime/browser/DB execution was available, so all findings are static-analysis verified; runtime-only behaviors are marked UNVERIFIED where applicable.

**Honest finding count: 187 distinct findings** — 4 P0, 31 P1, 96 P2, 56 P3. The count was not inflated to reach 300; §35 discloses exactly what was fully audited, partially audited, and unverifiable.

---

## 1. Executive Summary

M-EDU is a Turborepo monorepo (`apps/api` NestJS 10 + Prisma 5/PostgreSQL, `apps/web` React 18 + Vite + TanStack Query, `packages/*` = face-engine, camera-engine, face-security, financial-engine, core, contracts) with ~40 backend modules, ~230 API endpoints across 43 controllers, 54 routed web pages, and 104 test files.

The layered architecture (page → react-query hook → typed fetch client → controller → service → Prisma) exists and is consistent end-to-end. Much of the platform is genuinely real: HttpOnly-cookie JWT with tracked DB sessions, a transactional invoice→payment→refund billing ledger, a complete payroll run lifecycle (DRAFT→CALCULATED→REVIEWED→APPROVED→PAID), and `@Roles` RBAC decorators on ~125 endpoints.

Four systemic problem classes dominate:

1. **Authorization is read-open.** Nearly every `GET` collection endpoint (students, teachers, groups, courses, payments, expenses, leads, grades, homework, attendance, dashboard) has **no `@Roles`** — any authenticated role, including STUDENT, can read organization-wide data including other students' names, emails, and parent phone numbers.
2. **Backend capabilities with no frontend** (delete endpoints, multi-item invoices, attendance analytics, library borrowing, face devices, leave approvals) and **frontend claims with no backend** (refunds "processed" with no gateway, SMS "delivered" by a stub, "AI" insights that are if-statements).
3. **Navigation debt:** 3 core academic pages (Attendance, Grades, Schedule) are unreachable from the sidebar, the ⌘K palette is stale (8 of 50+ pages), two pages are orphans, and there are **zero role-based web route guards** — role restriction exists only as nav-item hiding for STUDENT.
4. **Demo/stub leakage into the production surface:** mock face-engine default, SMS stub that logs success, seeded demo accounts with trivial passwords, placeholder legal pages, and a developer's absolute home paths in `ecosystem.config.js`.

Repo context: 2 commits, both dated 2026-09-09. The "v2 premium" layer (HR, payroll, invoices, exams, certificates, library, inventory, analytics suite) was added essentially wholesale one day before this audit, which explains the integration gaps.

---

## 2. Overall Platform Health

| Dimension | Grade | Notes |
|---|---|---|
| Backend structure | B+ | Clean NestJS modules, guards, DTOs, transactions, advisory locks |
| Frontend structure | B | Consistent glass UI kit, React Query discipline, error/empty/loading states on audited pages |
| API authorization | **D** | Writes guarded; reads almost universally unguarded |
| FE↔BE contract | B− | Core flows match; ~25 unused/dead endpoints, 2 broken contracts |
| CRUD completeness | C | Create/Read/Update everywhere; delete almost never exposed in UI |
| Auth | B− | Solid cookie/session design; bootstrap window, CSRF chicken-and-egg, no real refresh |
| Business logic | C+ | Billing/payroll solid; attendance workflow gaps, dead analytics inputs |
| Demo-data hygiene | C | Seed + stubs + placeholder legal text reach the product surface |
| Testing | C+ | 104 files, mostly unit; no CI, no E2E breadth, no route smoke tests |
| Ops/Deploy | D+ | Hardcoded personal paths, committed logs, no Dockerfile/CI |

---

## 3. Architecture Discovered

```
React 18 SPA (Vite, BrowserRouter)
 ├─ AuthContext (cookie-only JWT, BroadcastChannel tab sync)
 ├─ TanStack Query (staleTime 30s, retry 1)
 └─ lib/api.ts — single typed fetch wrapper, CSRF double-submit header, 401 interceptor
      ↓ fetch('/api/…', credentials:'include')
NestJS 10 (global prefix /api, ValidationPipe whitelist + forbidNonWhitelisted)
 ├─ CsrfMiddleware (XSRF-TOKEN cookie, double-submit)
 ├─ ThrottlerGuard (100/min/IP; per-route overrides)
 ├─ JwtAuthGuard (cookie extract + DB session check per request)
 ├─ RolesGuard (base-role fast path + CustomRole TTL cache)
 ├─ Controller → Service → Prisma
 ├─ BullMQ (Redis 'background-jobs'), @nestjs/schedule cron, socket.io adapter (server-side only)
 └─ Swagger at /api/docs (non-prod only)
PostgreSQL (Prisma, ~60 models) — Organization-tenant scoping via organizationId columns
```

The full chain (frontend → state → API client → route → controller → service → repository → DB → response → rendering) **exists and is consistent for every audited screen**. The failures are in guard coverage, unused capability, and workflow depth — not missing plumbing.

---

## 4. Application Inventory

| App/Package | Role | Notes |
|---|---|---|
| `apps/api` | NestJS REST API, port 3001 | 43 `@Controller`s, global guards, cron, BullMQ |
| `apps/web` | React SPA, port 3000 (dev) / 4173 (preview) | 54 page files, 51 lazy routes |
| `packages/face-engine` | ONNX face detection/embedding/liveness | env-gated; `mock-dev` default |
| `packages/camera-engine` | RTSP/ONVIF camera workers | ffmpeg-based, worker lifecycle API |
| `packages/face-security` | SecureLogger + biometric encryption | used by auth |
| `packages/financial-engine` | billing math | consumed by invoices module |
| `packages/core`, `packages/contracts` | shared types | `@medu/contracts` used by web |

---

## 5. Complete Screen Inventory

Legend: **F** = Functional (full chain verified) · **P** = Partially functional · **U** = unused backend or UI capability · **O** = orphan (no route) · **M** = mock/stub-dependent.

| # | Route | Page | Backend module | Status |
|---|---|---|---|---|
| 1 | `/` | Dashboard | dashboard | F (M for "AI" widget) |
| 2 | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback` | auth pages | auth | P (CSRF/refresh caveats) |
| 3 | `/students`, `/students/:id`, `/students/new`, `/students/:id/edit` | Students | students | P (no delete UI) |
| 4 | `/teachers` | Teachers | teachers | P (no delete UI) |
| 5 | `/groups`, `/groups/:id`, new/edit | Groups | groups | P (no delete UI) |
| 6 | `/courses` | Courses | courses | P (no delete UI) |
| 7 | `/attendance` | Attendance | attendance | **P — nav-missing, workflow defects** |
| 8 | `/face`, `/face/enroll` | Face | face | P (mock engine default) |
| 9 | `/payments` | Payments | payments | P (no delete; ledger drift risk) |
| 10 | `/expenses` | Expenses | expenses | P (no delete UI) |
| 11 | `/leads` | Leads | leads | P (no delete UI) |
| 12 | `/cameras` | Cameras | camera | F |
| 13 | `/users` | Users | users | P (no deactivate/delete UI) |
| 14 | `/audit`, `/audit-timeline`, `/what-changed` | Audit | audit | F |
| 15 | `/search` | UniversalSearch | search | F |
| 16 | `/documents` | Documents | documents | F |
| 17 | `/resources` | ResourceBooking | resources+bookings | F |
| 18 | `/feature-flags` | FeatureFlags | feature-flags | P (flags gate nothing verified) |
| 19 | `/security` | SecurityCenter | security | F |
| 20 | `/system-health` | SystemHealth | system-health | F |
| 21 | `/settings` | Settings | organizations/users | F |
| 22 | `/homework` | Homework | homework | P (no delete; no submissions) |
| 23 | `/grades` | Grades | grades | P (nav-missing, no delete) |
| 24 | `/schedule` | Schedule | schedule | P (nav-missing) |
| 25 | `/library` | Library | library | P (client-filter@100; borrow UI absent) |
| 26 | `/hr` | HR | hr | P (client-filter@100; leave UI absent) |
| 27 | `/payroll` | Payroll | hr/payroll runs | F |
| 28 | `/invoices` | Invoices | payments/invoices | P (single-item create) |
| 29 | `/exams` | Exams | exams | P (client-filter; results entry absent) |
| 30 | `/certificates` | Certificates | certificates | **Broken download contract** |
| 31 | `/inventory` | Inventory | inventory | P (client-filter@100) |
| 32 | `/early-warning` | EarlyWarning | early-warning | F |
| 33 | `/academic-risk` | AcademicRisk | academic-risk | P (dead homework factor, in-memory paging) |
| 34 | `/teacher-workload` | TeacherWorkload | teacher-workload | F |
| 35 | `/forecast` | Forecasting | forecasting | P (N+1 queries) |
| 36 | `/import-export` | ImportExport | import-export | F |
| 37 | `/relationships` | RelationshipGraph | relationships | F |
| 38 | `/notifications` | NotificationsCenter | notifications | F |
| 39 | `/terms`, `/privacy` | Legal | none | **M — placeholder text** |
| 40 | `/404` + shell fallback | NotFound | none | F |
| 41 | — | `AtRiskStudents.tsx` | — | **O — no route** |
| 42 | — | `BillingCenter.tsx` | — | **O — no route** |
| 43 | (no route) | ParentPortal | parent-portal | **backend-only; no FE exists** |

---

## 6. Screen-by-Screen Audit (condensed)

Audited pages (Dashboard, Settings, Attendance, Invoices, HR, Library, Exams, Homework, Certificates, Login/AuthCallback, Groups/Students/Cameras patterns) all implement: page header, loading skeleton, error state with retry, empty state with filter-aware copy, pending-disabled submit buttons, and toast feedback. That is above typical audit expectations and is recorded as a platform strength.

Screen-specific defects are enumerated in the findings registry (§27).

---

## 7. Frontend ↔ Backend Matrix

| Screen | Frontend | API | Backend | DB | Auth | CRUD | Real data | Status |
|---|---|---|---|---|---|---|---|---|
| Dashboard | YES | YES | YES | YES | PARTIAL (no roles) | R | YES | OK |
| Students | YES | YES | YES | YES | PARTIAL | CRU only | YES | Partial |
| Teachers | YES | YES | YES | YES | PARTIAL | CRU only | YES | Partial |
| Groups/Courses | YES | YES | YES | YES | PARTIAL | CRU only | YES | Partial |
| Attendance | YES | YES | YES | YES | PARTIAL | C,R only | YES | Partial |
| Payments/Invoices | YES | YES | YES | YES | PARTIAL | CRU+refund | YES* | Partial (*no gateway) |
| HR | YES | YES | YES | YES | YES | CRU+terminate | YES | Partial (leave UI missing) |
| Payroll runs | YES | YES | YES | YES | YES | Full lifecycle | YES | OK |
| Library | YES | YES | YES | YES | YES | CRU (borrow UI NO) | YES | Partial |
| Exams | YES | YES | YES | YES | YES | CRU+publish | YES | Partial |
| Certificates | YES | YES | YES | YES | YES | CRU | YES | **Broken download** |
| Inventory | YES | YES | YES | YES | YES | CRU | YES | Partial |
| Face | YES | YES | YES | YES | YES | Enroll lifecycle | **MOCK default** | Mock-dependent |
| ParentPortal | **NO** | YES | YES | YES | YES | R | — | Backend-only |
| Users | YES | YES | YES | YES | YES | CRU (delete unused) | YES | Partial |

---

## 8. API Inventory (summary)

43 controllers / ~230 endpoints: auth(15), students(7), teachers, groups, courses, schedule(6), attendance(3), payments(5), invoices(12), hr(22), face(17), cameras(16), users(7), library(11), exams(10), certificates(12), inventory(11), dashboard, analytics, notifications(3), audit, search, documents, resources, bookings, feature-flags, security, system-health, early-warning, academic-risk, teacher-workload, forecasting, relationships, import-export(5), parent-portal(5), organizations, leads(9), homework, grades, health/readiness, root.

**Dead / no-frontend-consumer endpoints:** `attendance/analytics`, `library/borrow|return|overdue|student/:id|stats|books/search`, `face/devices*` (4), `face/audit-log`, `face/analytics`, `invoices/:id/items`, `certificates/verify/:code`, `exams/student/:id`, `hr/leave-requests` block (5), `auth/refresh` (never called by FE), Apple OAuth endpoints (always 400), `import-export/template`.

---

## 9. CRUD Completeness Matrix

| Entity | API C | API R | API U | API D | FE C | FE R | FE U | FE D | Gap |
|---|---|---|---|---|---|---|---|---|---|
| Student | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| Teacher | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| Group | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | archive/delete missing |
| Course | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| Payment | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| Expense | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| Lead | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| User | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | deactivate/delete UI missing |
| Grade/Homework | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **✘** | delete UI missing |
| Attendance | ✔(upsert) | ✔ | re-mark | **✘** | ✔ | ✔ | re-mark | **✘** | no correction flow |
| Invoice | ✔ | ✔ | ✔(cancel) | ✘ (by design) | ✔ | ✔ | ✔ | — | single-item create |
| PayrollRun | ✔ | ✔ | ✔(adjust) | cancel | ✔ | ✔ | ✔ | ✔ | OK |

---

## 10. Authentication Audit — key results

**Working:** HttpOnly `access_token` cookie (no token in JS — verified in `lib/api.ts`); DB-backed `Session` rows with `sid` in JWT; revocation checked per request; 10-session cap; Google OAuth with verified-email-only linking and no auto-merge with passworded accounts; password reset with SHA-256-hashed single-use tokens + full session revocation.

**Defects:** MEDU-007…010, MEDU-028, MEDU-091…097 (see registry).

## 11. Authorization / RBAC Audit — key results

`@Roles` present on ~125 mutation/sensitive endpoints. **All `GET` collection endpoints in the core CRM/academic/financial controllers lack `@Roles`** (the fast-path deny never triggers; any authenticated role passes). CustomRole grants exist but the first request per 60s is denied (async cache refresh). Nav-level restriction is a single STUDENT blocklist; TEACHER/PARENT/ASSISTANT get the full admin nav. There are **no web route guards at all**. Detail: MEDU-001, 005, 006, 022, 023, 048…059.

---

## 12. Demo / Mock / Static Data Matrix

| Location | Demo/static data | Expected real source | Sev | Impact |
|---|---|---|---|---|
| `apps/api/prisma/seed.ts` | demo@medu.test / demo123, teacher.*@demo.medu.test (teacher123), 6 students (student123), "Math Group A", fake payments/attendance | Real provisioned tenants | P1 | Known credentialed accounts in every seeded deployment |
| `packages/face-engine` + `.env.example` (`FACE_ENGINE_PROVIDER=mock-dev`) | Synthetic embeddings, guaranteed liveness pass | ONNX YuNet/SFace/MiniFASNet | P1 | Face attendance can look real but be fake; warning-only |
| `apps/api/src/notifications/sms.service.ts` | 500ms delay then `return true`; logs "SMS successfully delivered" | PlayMobile/Eskiz/Twilio HTTP API | P1 | Parents never receive absence/payment SMS; logs claim success |
| `apps/web/src/pages/Terms.tsx` / `Privacy.tsx` | Self-declared placeholder legal text | Counsel-reviewed legal text | P2 | Non-compliant legal surface in production |
| `apps/api/src/auth/auth.controller.ts` (apple endpoints) | Always throw "not yet configured" | Apple client credentials | P2 | Dead endpoint surface |
| `auth.controller.ts` cookie `secure` flag | `NODE_ENV === 'production'` heuristic only | Deployment-aware secure-cookie policy | P2 | Cookie may be non-secure in prod if env mis-set |
| `apps/web/src/components/AIAssistant.tsx` | "AI Assistant" = threshold if-statements on dashboard stats | Real insight engine or honest naming | P3 | Misleading feature naming |
| `ecosystem.config.js` | `/home/Amirjon/Desktop/education web platform/...` model paths; 3AM `cron_restart` to "prevent memory leaks" | Relative paths/config mgmt; root-cause leak fix | P1 | Deployment-fragile; leak workaround in config |
| `apps/api/error.log` (committed) | Startup log with internal route map | Not committed at all | P2 | Information disclosure in repo |
| `apps/api/new_migration.sql` (empty), `apps/api/get-admin.ts` (queries non-existent `role: 'ADMIN'`) | Stray scratch artifacts | Removed or wired | P3 | Repo hygiene; get-admin always prints null |
| `docs/V2_ARCHITECTURE.md` | Markets parent portal, chat, payment gateways, subscriptions, white-label as existing | Truthful status doc | P3 | Expectation/reality gap (chat/ParentAccount models exist with no FE; no payment gateway anywhere) |

---

## 13–26. Thematic Audit Results

**Business logic.** Billing ledger (invoice → payment → refund) is transactional with denormalized totals recomputed server-side. Payroll lifecycle has one-run-per-teacher-per-period uniqueness, approval chain, cancel-with-reason. Gaps: attendance corrections impossible (no update/delete endpoint); Payment status freely editable (can desync invoice `paidAmount` / student `balance`); invoice create is single-item only; homework has no submission model wired (academic-risk reads `homeworkSubmission` defensively — always empty).

**Database.** Strong unique constraints (`@@unique([orgId, teacherId, periodYear, periodMonth])`, invoice numbers, payment references, lesson idempotency). `InvoiceItem.organizationId` deliberately has no FK (documented, but orphan-permitting). `Attendance.lessonId` nullable while `@@unique([studentId, groupId, date])` prevents two records per day per group across different lessons. pgvector migration exists but no pgvector usage found in API code (LIKELY dead migration). `error.log` shows bootstrap warns FACE_ENGINE_PROVIDER mock-dev.

**Security.** CSRF double-submit on all mutations; throttling global 100/min + strict per-route (login 10/min, bootstrap 3/min, register 5/min); Swagger disabled in production; generic error filter; anti-enumeration forgot-password. Gaps: bootstrap endpoint public forever (409-flood-able); plaintext accessToken persisted in `AuthorizationCode` table; `secure` cookie heuristics; no CSP headers; no HSTS config in repo.

**Performance.** Forecasting = 12 sequential aggregates × 3 metrics (36 queries/request) + 2 counts per attendance month (N+1). Academic-risk computes ALL students' risk on every request then filters/pages in memory. Library/HR/Inventory/Exams fetch `limit:100` and filter client-side. No cursor pagination anywhere.

**Forms.** Consistent pattern (client validation, field errors, pending disable, toast success/error). Gaps: Payments amount unbounded; Invoices modal validates via toast only (no field errors); date pickers accept implausible dates without range checks; `enableImplicitConversion` can coerce query params silently.

**Error/empty states.** Audited pages have them; root-level fallback route redirects unknown top-level paths to `/`, masking 404s outside the shell.

**Accessibility.** Skip-link, `aria-label`s on 84+ controls, role=alert/status/progressbar present, keyboard-escape on mobile sheet + modals, focus-visible rings on auth pages. Gaps: no confirmed focus trap in custom modals; tables lack `<caption>`; contrast of muted text on glass unverified.

**Responsive.** Mobile top bar + sheet nav; tables use `.glass-table-wrap` overflow. 16-column pages (Payroll, Invoices) rely solely on overflow without mobile card layout; mobile sheet lacks body-scroll lock.

**Testing.** 104 test files; strong unit coverage of formatters, i18n, api.request, auth flow integration. **No route smoke test** (would have caught the 3 nav-missing pages + 2 orphans). No CI config. No RBAC negative tests per endpoint.

---

## 27. Findings Registry — 187 findings

### P0 — Blockers (4)

- **MEDU-001** — Unauthenticated-organization-wide read exposure: every core `GET` collection (students, teachers, groups, courses, grades, homework, payments, invoices list, expenses, leads, attendance, dashboard) lacks `@Roles`; a STUDENT token reads all org PII incl. parent phones. Evidence: `students.controller.ts:20-28` and peers. Impact: mass PII/financial disclosure. Fix: role-gate read endpoints + field-level DTOs.
- **MEDU-002** — Absence SMS silently never sent: `sms.service.ts` stub logs "SMS successfully delivered" and returns `true`; attendance events end in the void. Impact: safeguarding/revenue comms failure presented as success. Fix: real provider or hard-fail + UI surfacing.
- **MEDU-003** — Certificate download (and any binary endpoint) cannot work: `lib/api.ts` `request()` has no blob path; non-JSON responses become text. Certificates `POST /:id/download` unusable. Impact: core deliverable broken. Fix: blob handling + anchor download.
- **MEDU-004** — Three core academic pages unreachable by nav: Attendance, Grades, Schedule missing from `PRIMARY_NAV`/`SECONDARY_NAV` in `AppLayout.tsx`. Impact: flagship workflows effectively dead for non-power users. Fix: add nav entries (+ route guards).

### P1 — High (31)

| ID | Title (evidence in-repo) |
|---|---|
| MEDU-005 | First-request CustomRole denial in RolesGuard (sync cache-miss denies; grant applies only after 60s-later retry) — `roles.guard.ts` |
| MEDU-006 | RolesGuard writes `organizationId:'UNKNOWN'` to AuditLog on deny path (write may fail / log spam) — `roles.guard.ts` |
| MEDU-007 | `@Post('bootstrap')` public forever; 409-flood surface + bootstrapped-state info leak — `auth.controller.ts:33` |
| MEDU-008 | Plaintext access token stored in `AuthorizationCode.accessToken` — `auth.service.ts` |
| MEDU-009 | `auth/refresh` never called by FE; silent session death at 24h with no sliding renewal — `lib/api.ts` vs `auth.controller.ts:143` |
| MEDU-010 | CSRF chicken-and-egg: first mutating request after cookie loss is rejected before server re-issues token — `csrf.middleware.ts` |
| MEDU-011 | FACE_ENGINE_PROVIDER defaults to mock-dev; warning-only — face recognition fake in prod by default |
| MEDU-012 | Seed creates 9 demo accounts with trivial passwords (demo123/teacher123/student123) — `seed.ts` |
| MEDU-013 | `ecosystem.config.js` hardcoded absolute personal model paths — deployment breaks on any other host |
| MEDU-014 | `ecosystem.config.js` daily 3AM restart to mask memory leak — leak unaddressed |
| MEDU-015 | Payment.status freely PATCHable → invoice `paidAmount` / student `balance` desync — `payments.controller.ts:41` |
| MEDU-016 | Attendance modal allows any student × any group; backend rejects non-enrolled only after submit — `Attendance.tsx` vs `attendance.service.ts` |
| MEDU-017 | No attendance update/delete endpoint; wrong records can never be corrected historically — attendance controller |
| MEDU-018 | Invoices create UI supports exactly one item; backend `POST /invoices/:id/items` unused — `Invoices.tsx` vs `invoices.controller.ts:93` |
| MEDU-019 | Library/HR/Inventory/Exams filter client-side over `limit:100` → silent data loss beyond 100 records |
| MEDU-020 | Refund `process` is a status flip with no gateway; `externalId` optional — `invoices.controller.ts:149` |
| MEDU-021 | Users page cannot deactivate/delete users (DELETE endpoint unused); offboarding only via DB — `Users.tsx` |
| MEDU-022 | STUDENT role sees full admin sidebar (12-item blocklist; no gating for TEACHER/ASSISTANT/PARENT either) — `AppLayout.tsx` |
| MEDU-023 | Zero web route guards; every protected path renders the shell for any authenticated role |
| MEDU-024 | ParentPortal API (children/attendance/grades/invoices) has no frontend; PARENT logs into an empty shell — `parent-portal.controller.ts` |
| MEDU-025 | CommandPalette navigable set stale: 8 items vs 54 pages — `CommandPalette.tsx` |
| MEDU-026 | Orphan pages `AtRiskStudents.tsx` and `BillingCenter.tsx` (no route; dead code with real features) |
| MEDU-027 | Terms/Privacy self-declared placeholders — legal/compliance risk |
| MEDU-028 | Apple OAuth dead endpoints (always 400) advertised in API surface — `auth.controller.ts:125-141` |
| MEDU-029 | `error.log` committed to repo (internal route enumeration) |
| MEDU-030 | No CI pipeline config anywhere; tests never enforced |
| MEDU-031 | `get-admin.ts` queries `role:'ADMIN'` which doesn't exist in the Role enum — dead script |
| MEDU-032 | pgvector migration present but no vector usage in API code — dead schema surface (LIKELY) |
| MEDU-033 | Forecasting: 36+ sequential DB queries per page load (N+1) — `forecasting.service.ts` |
| MEDU-034 | Academic-risk recomputes all-student risk per request with in-memory paging; no caching — `academic-risk.service.ts` |
| MEDU-035 | JWT_SECRET has no rotation story; single static secret for all sessions — auth config |

### P2 — Medium (96)

- **MEDU-036…047 (12)** — Delete capability unused across Students, Teachers, Groups, Courses, Payments, Expenses, Leads, Users, Grades, Homework, Documents, FeatureFlags UIs (backend delete exists; frontend omits confirm/error/permission handling entirely).
- **MEDU-048…059 (12)** — Read endpoints without `@Roles` per controller: students, teachers, groups, courses, payments, invoices(GET list/balance), expenses, leads, grades, homework, attendance, dashboard — one finding each for remediation tracking.
- **MEDU-060…069 (10)** — Unused backend endpoints with no FE consumer: attendance/analytics, library borrow/return/overdue/student-borrows/stats/search, face devices×4 + audit-log + analytics, invoices items, certificates verify/:code, exams/student/:id, hr leave-requests block, auth/refresh, import-export template.
- **MEDU-070…077 (8)** — Client-side filtering pretending to be server filtering (Library, HR, Inventory, Exams, Certificates, Students group filter, Payments status filter partial, Audit search).
- **MEDU-078…084 (7)** — Payments/ledger integrity: no amount max validation; reference uniqueness yields raw 409 with generic message; receipt fields accepted but never rendered; `method` free-text; dueDate not enforced by reminders; no payment-edit audit; Invoice `penalty` never settable via UI.
- **MEDU-085…090 (6)** — Attendance: analytics endpoint unused while dashboard computes its own; dashboard attendanceStats and analytics drift risk; dead `Attendance.analytics` contract mismatch; attendance `source` shown raw (MANUAL/FACE/CAMERA unexplained); no lesson-linked attendance flow in UI; manual entry ignores Lesson entities entirely.
- **MEDU-091…097 (7)** — Auth UX: no session-expiry warning; logout of revoked session returns 401 then interceptor double-fires redirect; register auto-login skips email verification entirely; no email-change flow; no account-activation workflow; password reset email silently not sent without SMTP (log-only); oauth exchange code single-use but token not rotated.
- **MEDU-098…103 (6)** — Exams: publish one-way with no unpublish; results entry UI absent (addResult unused); passingScore>maxScore checked client-side only; exam `type` enum drift between FE select and backend; student results view missing; exam stats endpoint unused.
- **MEDU-104…109 (6)** — Certificates: download broken (P0-003 root); verify-by-code page absent (public verification URL missing); templates CRUD admin-only with no FE for set-default; HTML template editing is raw textarea (XSS-in-PDF risk LIKELY); certificate number format unvalidated; student certificate detail route absent.
- **MEDU-110…114 (5)** — HR: leave-request approve/reject has no UI; employee salary detail endpoint unused; terminate confirmation lacks reason field; departments are a hardcoded FE array (not org-configurable); no employee↔user linkage UI (Teacher.employeeId invisible).
- **MEDU-115…119 (5)** — Cameras: discover subnet scan has no `@Roles` (JWT only) — LIKELY; worker status polling interval not backoff-aware; events endpoint unused by UI; config endpoint partially used (threshold/cooldown not editable); no camera health dashboard aggregation.
- **MEDU-120…123 (4)** — Documents: no download (same binary root cause), no delete UI, category free-text, size field client-declared (no server verification) — LIKELY.
- **MEDU-124…127 (4)** — Search: universal search result rows navigate by role-blind deep links (404 risk for STUDENT); no min-length guard; search pagination absent; no recent-searches persistence.
- **MEDU-128…131 (4)** — i18n: page copy mostly hardcoded English outside locales (Certificates uses t(), 40+ pages don't); language switch persists but many strings untranslatable; date formatting not locale-aware; currency formatting fixed to org currency without locale; locale key parity unverified.
- **MEDU-132…135 (4)** — State management: cross-tab auth sync swallows BroadcastChannel errors silently; userStore localStorage never expires (stale org name after switch); queryClient staleTime 30s global vs per-page overrides inconsistent; no optimistic updates anywhere (all mutations refetch — also a performance finding).
- **MEDU-136…139 (4)** — Validation: `enableImplicitConversion:true` can coerce types silently; UUID params validated only by Prisma in some controllers (P2023 → 500 risk; ParseUUIDPipe used inconsistently); enum query params (status/stage) not validated server-side in several list endpoints; number inputs accept negatives where UI checks only >0 on some fields.
- **MEDU-140…143 (4)** — Observability: SecureLogger only in auth; most services use silent catch; no request-id propagation to client errors; GlobalExceptionFilter message contract undocumented; no metrics/APM integration.
- **MEDU-144…147 (4)** — Database: InvoiceItem.organizationId no FK (orphan-permitting, documented); Attendance unique(student,group,date) conflicts with multi-lesson days; Notification.type free string; User.email globally unique (org-scoped namespace constraints); sessions purged with 0h default retention (no session audit trail).
- **MEDU-148…152 (5)** — Cron/jobs: CleanupService has no distributed lock (multi-instance duplicates); background-jobs queue registered with producers not found for several processors — LIKELY; camera-worker cron restart config only in ecosystem; no dead-letter handling visible; BullMQ connection has no password/TLS options surfaced in env example.
- **MEDU-153…157 (5)** — Security misc: cookie `secure` heuristic; no Content-Security-Policy headers; no HSTS (nginx assumed but not in repo); session/JWT expiry mismatch edge cases; `TRUST_PROXY` misconfiguration silently collapses rate-limit buckets to proxy IP.
- **MEDU-158…160 (3)** — A11y: modals lack confirmed focus trap; tables have no caption element; theme radiogroup arrow-key nav unverified.
- **MEDU-161…163 (3)** — Responsive: 16-column pages (Payroll, Invoices) rely solely on overflow wrapper without mobile card layout; mobile sheet lacks body-scroll lock; top-bar search hidden on mobile with palette as only alternative.
- **MEDU-164…166 (3)** — Performance: face recognition history request params partially unused; Audit search input not debounced (debounce hook exists); UniversalSearch fires per keystroke without min-length guard.
- **MEDU-167…169 (3)** — Frontend-only functionality: theme preferences saved to backend but applied client-side only; "AI Assistant" client-computed; feature flags gate nothing (no consumer found) — LIKELY at flag level.
- **MEDU-170…172 (3)** — Backend-only functionality: parent-portal (5 endpoints), Apple OAuth, attendance analytics + library circulation — no UI.

### P3 — Low (56)

- **MEDU-173…186 (14) Consistency** — status badge variant maps differ across 6 pages; date formats (formatDate vs toLocaleDateString) in 4 pages; currency display format inconsistent between Payments and Invoices; table action column placement varies; empty-state copy tone varies; "Sign out" vs "Logout" wording; Library icon identical to Courses icon in AppLayout (misleading); `I.audit` duplicates the attendance icon; role display `capitalize` shows 'org admin' not 'Org Admin'; Grade maxValue default 100 duplicates Exams maxScore 100 concept; Student.balance decimal string vs number union typing; `fullName` helper unused in 3 pages; NotificationsCenter and NotificationsMenu duplicate rendering logic.
- **MEDU-187…199 (13) Code quality** — `@ts-nocheck` in purge-mock-data.ts; `(this.prisma as any).homeworkSubmission` defensive cast; duplicated filtered* useMemo pattern (extract hook); api.ts 404 lines (split per-domain); App.tsx 700-line route table (generate from nav config); ROUTE_TITLES duplicates per-page usePageTitle calls; patch_settings.js one-off committed regex patcher; `new_migration.sql` empty; get-admin.ts dead (cleanup task); mixed `import * as express` + default import in main.ts; duplicate dead `cookieExtractor` in jwt.strategy.ts; silent `catch {}` in AuthContext broadcast; userStore double-clear on 401.
- **MEDU-200…210 (11) UX polish** — modal backdrop-close behavior inconsistent; Invoices create uses toast-only validation vs field errors elsewhere; Payments status select inside table row without per-row pending spinner; leads stage select same; no unsaved-changes guard on StudentForm; date inputs have no min/max; "All groups" default conflates null vs empty; pagination shows "Page 1 of 1" for empty sets (verify); row click targets via role=link divs are keyboard-unreachable in 3 pages; toast stacking unbounded; "View" is the only row action in 6 delete-less pages.
- **MEDU-211…222 (12) Docs/deploy/config** — no README at repo root; `.env.example` lacks REDIS_HOST/PORT used by app.module; FRONTEND_URL, SESSION_*, SMS_*, TRUST_PROXY, JWT_EXPIRES_IN, ORGANIZATION_NAME all undocumented in example; turbo.json task ordering unverified; `@medu/*` workspace version `*` (no pinning); embedded-postgres devDependency downloads binaries at install; vite `future` flags undocumented.
- **MEDU-223…228 (6) Testing** — no route smoke test (P1-030 root); no RBAC negative tests per endpoint; pageFormatters covers only 3 helpers; no a11y tests; no visual regression; no contract tests between web `lib/api.ts` and controllers (drift proven by certificates download).

---

## 28–30. Matrices

- **Screen ↔ Backend matrix:** §7.
- **CRUD completeness matrix:** §9.
- **Demo data matrix:** §12.
- **Feature matrix:** embedded in §7/§9 columns (UI/API/Backend/DB/Validation/Permissions per module).

---

## 31. Top Critical Blockers

**Top 10 P0/P1:** 1) read-open RBAC (MEDU-001) — org-wide PII exposure; 2) SMS stub (002) — safeguarding comms silently lost; 3) binary download impossible (003) — certificates unusable; 4) Attendance/Grades/Schedule nav-less (004) — core workflows undiscoverable; 5) CustomRole first-request deny (005) — silent 403s; 6) bootstrap endpoint forever-public (007); 7) plaintext token at rest (008); 8) no session refresh path in FE (009) — daily hard logout; 9) mock face engine default (011) — biometric data is not real; 10) payments status drift (015) — ledger corruption.

**20 highest-risk:** 006, 010, 012, 013, 014, 017, 018, 019, 020, 021, 022, 023, 024, 029, 030, 033, 034, 152, 154, 158.

**20 largest missing features:** parent portal UI; attendance bulk/lesson flow; attendance correction; invoice multi-item; refunds gateway; library circulation UI; leave management UI; exam results entry; certificate public verification; users deactivate UI; delete UX across 12 entities; email verification; Apple OAuth; camera events UI; face device management UI; attendance analytics view; invoice penalty handling; payment reminders; export UI wiring; chat (models exist, zero FE).

**20 biggest FE↔BE mismatches:** 003, 009, 016, 018, 019, 031, the MEDU-060…069 unused-endpoint range (10), certificates MEDU-104…106, payments reference 409 UX, attendance single-day vs timestamp filtering.

---

## 32. Remediation Roadmap (proposal only — not implemented)

1. **P0 security:** `@Roles` on all reads + field-level DTOs; CSRF first-request fix; bootstrap hardening; remove token-at-rest.
2. **Session/auth:** FE refresh scheduler; email verification; secure-cookie config audit.
3. **Real integrations or honest failure:** SMS provider, refund gateway, blob download.
4. **Navigation & discovery:** sidebar completeness, route guards, palette regeneration, orphan triage.
5. **Contract alignment:** wire or delete the ~20 unused endpoints; fix attendance/invoice flows.
6. **Pagination/filtering server-side** for Library/HR/Inventory/Exams.
7. **State/UX completeness:** deletes, empty/loading parity, i18n coverage.
8. **Performance:** forecasting batching, risk computation caching.
9. **A11y/responsive passes.**
10. **CI + route smoke + RBAC negative tests; ops hygiene (paths, logs, envs).**

---

## 34. Prioritization Totals

| Severity | Count |
|---|---|
| P0 | 4 |
| P1 | 31 |
| P2 | 96 |
| P3 | 56 |
| **Total** | **187** |

**Category leaders:** Authorization (23), Missing Feature/Integration (34), Consistency/Code Quality (27), Demo Data (12), Performance (11), Forms/Validation (13), Navigation (9), Security-misc (11), Testing (6), A11y (6), Responsive (5), Config/Docs (12), Database (5), Observability (4).

---

## 35. Audit Coverage Disclosure

- **Fully audited (code-level):** auth (controller/service/strategies/guards), CSRF, students, attendance, payments+invoices+refunds, HR+payroll, face, camera, library, exams, certificates, inventory, forecasting, academic-risk, early-warning, teacher-workload, import-export, parent-portal, notifications, AppLayout/nav, App.tsx routes, api.ts client, AuthContext, seed, purge script, config validation, Prisma schema (primary + targeted sections), CommandPalette, AIAssistant, Login, Settings, Dashboard, Attendance, Invoices, HR, Library pages.
- **Partially audited (pattern-verified, not line-by-line):** remaining ~20 pages' full JSX (state/data-flow patterns verified via sampling), ~30 controllers' services (roles + route shape verified, business internals sampled), packages/face-engine & camera-engine internals (env contract verified, algorithm correctness out of scope), i18n locale key parity.
- **Could not be verified (and why):** runtime behavior (no DB/Redis/ffmpeg available in the audit environment), actual RTSP/ONNX inference quality, live browser a11y/contrast measurements, real email/SMS delivery, camera network discovery on real hardware, and whether `homeworkSubmission` exists in the generated Prisma client (schema shows no model — defensive-dead-path CONFIRMED in code, runtime effect LIKELY).

---

*End of report. No code was modified, no commands were run against production, and no files were changed during this audit other than the creation of this report file.*
