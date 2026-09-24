# M-EDU REMAINING RISKS

**Original Audit:** 2026-09-14
**Last Updated:** 2026-09-23 (Google OAuth fail-fast fix + forensic re-verify)

---

## CURRENT STATUS: REMEDIATED — VERIFICATION PASSED (local tests)

`npm run build` ✅ (turbo 8/8), API full suite ✅ (**189 files / 1909 tests**,
includes e2e + security 19/19), web tests ✅ (28 files / 137 tests; Vitest
`testTimeout` 15s for jsdom load), web `tsc -b` ✅, `npm run lint` ✅
(13/13, 0 errors). Local Postgres started via Docker; all **17 Prisma
migrations applied** (`prisma migrate status` → up to date); API health
`200` on `:3001`.

Items marked **[FIXED]** were addressed during the 2026-09-22/23 passes.
Items below remain open.

---

## FIXED (verified this pass)

### 1. PRISMA SCHEMA RECOVERY **[FIXED]**
Schema parity repaired (`20260921120000_schema_parity_repair`,
`20260922000000_repair_drift` migrations staged). `prisma generate` rebuilt.

### 2. TYPESCRIPT COMPILATION **[FIXED]**
All API + Web TS errors resolved; `tsc --noEmit` clean.

### 3. ORPHAN MODULES **[FIXED]**
All 10 modules registered in `app.module.ts:133-143`: ChatModule,
GamificationModule, ApiKeysModule, BranchesModule, ReportsModule,
ParentPortalModule, DataGovernanceModule, AutomationModule,
ObservabilityModule, PerformanceModule.

### 4. RBAC SUPER_ADMIN BYPASS **[FIXED]**
`roles.guard.ts` — SUPER_ADMIN early-return added; 3 spec tests added.

### 6. THEME INITIALIZATION **[FIXED]**
Inline dark-mode script added to `apps/web/index.html` `<body>` head;
reads `medu-theme` from localStorage before React mounts.

### 7. FINANCIAL PRECISION **[FIXED]**
`hr/payroll.service.ts` uses `computePayroll()` from `@medu/financial-engine`.
`hr.service.ts` salary generation rounds tax/net to 2dp (`Math.round(x*100)/100`)
around the 0.12 rate; `processSalaryPayment` is TOCTOU-safe via `updateMany`.
Dashboard revenue aggregates on `paidAt` (cash basis) with regression test.
**Remaining (small):** `hr.service.ts:370` still holds the rate as a JS float
constant (0.12) rather than a Decimal column — outputs are rounded (P3).

### 8. SECURITY REMEDIATION **[FIXED]**
1. `set-pass.ts` + ~55 root/apps-api `fix*.js` scratch scripts deleted.
2. `seed.ts` — no hardcoded passwords: env override (`SEED_*_PASSWORD`) or
   random per-run secret; credentials only printed outside production.
3. Credential logging removed from production path.
4. CORS LAN IP (`192.168.0.6:3000`) removed from `main.ts`; dev allowlist
   is `http://localhost:3000` only.
5. ~20 root audit-report `.md` scratch files + apps-api scratch
   (`.log/.txt/.sql/.js`) deleted; patterns added to `.gitignore`.
6. Google OAuth secret lives in `.env` (gitignored) — rotate before launch.

### 9. JWT AUTHORIZATION HEADER **[FIXED]**
`jwt.strategy.ts:22-23` — `ExtractJwt.fromAuthHeaderAsBearerToken()` fallback
next to cookieExtractor.

### LINT / TOOLING **[FIXED]**
- Root lint script: `cross-env NODE_OPTIONS=--max-old-space-size=4096 turbo lint --concurrency=2`
  (fixes OOM, exit 134).
- `Settings.tsx:273` react-hooks eslint-disable removed (deps corrected).
- `test:e2e` = `vitest run test` (covers all e2e files).

### ATTENDANCE VOID/EDIT **[FIXED]**
`PATCH /attendance/:id` (edit status/note) + `DELETE /attendance/:id` (void),
org-scoped in service; controller+service specs (24 tests pass);
`attendanceApi.update/remove` + Edit/Void UI in `Attendance.tsx`.

### 10. FORENSIC FIX WAVE (Exams/Invoices/HR/security/payroll/PDF) **[FIXED]**
1. `types.ts` Exam/Invoice/Employee DTOs aligned to backend; Exams/Invoices/HR
   pages rewritten; `api.ts` list responses normalized to `{items,...}`;
   publish body `{ isPublished }` only (never `force`).
2. `auth-tracker.ts` verifies via `jsonwebtoken` + same secret resolution as
   `jwt.strategy`; `helmet()` enabled in `main.ts`.
3. Payroll `adjust()` restores `latePenaltyPerEvent`/`overtimeRate`/
   `workdaysInMonth` best-effort and persists `latePenalty`/`absencePenalty`.
4. `pdfmake/js/Printer` case fix (was `printer`, broke Windows exports).
5. Invoice `remaining = total - paid + refunded` (backend + frontend).
6. `Payments.tsx` methods limited to valid `PaymentMethod` union.
7. Camera worker session installs a default `error` listener (no unhandled
   `emit('error')` crash).
8. Inventory DAMAGE/DISPOSAL stock decrement + oversell rejection tests.
9. Notification events DLQ uses distinct `NOTIFICATION_EVENTS_DLQ` queue.
10. CSV formula-injection guard covered by regression test (CWE-1236).
11. Web 401 handler: protected paths call `onUnauthorized`; `/auth/me` probe
    does not (test updated to lock both behaviors).
12. Unused `terminationDate` dropped from web `Employee` type.
13. E2e fixtures: `updatedAt` on Invoice/Refund/PayrollRun/Lesson creates
    (schema has no `@updatedAt`); unique org/user emails; analytics URL →
    `/api/analytics/groups/:id/profitability`; attendance beforeAll creates
    a PLANNED Lesson; race-conditions assertion matches actual
    `CANCELLED cannot accept payments` message.
14. Web Vitest `testTimeout`/`hookTimeout` 15s (Register flows exceed 5s
    under full-suite jsdom load; assertions unchanged).

---

## REMAINING RISKS

### R1. i18n COMPLETION (HIGH) — open
~90% of pages still hardcoded English; legacy-slices (uz/ru/en) merged and
wired, but page-level `t()` migration is incomplete (45+ pages).

**Estimated Effort:** 20-40 hours

### R2. HR TAX RATE FLOAT (P3) — open (mitigated)
`hr.service.ts:370` uses `taxRate = 0.12` as a JS float, but tax/net are
rounded to 2dp before persist; main payroll path uses financial-engine.

**Estimated Effort:** 1-2 hours (move rate to config/Decimal)

### R3. FINANCIAL CONSISTENCY (MEDIUM) — fixed for dashboard
Dashboard revenue now aggregates on `paidAt` with regression test. Some
analytics SQL still uses `COALESCE("paidAt","createdAt")` fallbacks
(anomaly-detection/analytics month buckets) — acceptable but not uniform.

**Estimated Effort:** 1-2 hours to standardize remaining COALESCE paths

### R4. NOTIFICATION PREFERENCES (MEDIUM) — open
Preference model exists (`notification-preference.service.ts`) but not every
send path consults it.

### R5. PRISMA MIGRATIONS **[FIXED 2026-09-23]**
All **17 migrations applied** to local `medu_test` (Docker `postgres:15-alpine`,
creds `postgres:postgres`); `prisma migrate status` → *Database schema is up to
date*. Production/staging still need their own `npx prisma migrate deploy`.

### R6. GIT HYGIENE (P0) — partial
- Staged: all migration dirs (incl. the two repair migrations).
- Still untracked-but-needed: new source files (specs, DTOs, new pages) —
  stage intentionally before commit.
- Still untracked-ignored: pgdata/, .pgtmp*/, audit reports now gitignored.
- ~659 modified files await an intentional commit (not committed this pass).

---

## UNVERIFIED RISKS (runtime)

1. **Face Engine** — ONNX models present, integration tests pass (mock+real paths); live camera unverified
2. **Camera System** — RTSP/ONVIF implemented but unverified live
3. **Telegram** — Bot API implemented, no token configured
4. **SMS (Eskiz.uz)** — implemented, no credentials
5. **Email (Nodemailer)** — implemented; in notification pipeline (email.service) but no SMTP creds verified
6. **Google OAuth** — placeholder credentials removed; guard now fail-fast
   (`isGoogleOAuthConfigured` rejects `your-*` / non-`*.apps.googleusercontent.com`
   IDs). `GET /api/auth/google` → 302 to `/auth/callback?error=not configured`
   (verified live, no `accounts.google.com`). **Full sign-in still FAIL until**
   real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env` + API restart +
   Console: JS origin `http://localhost:3000`, redirect
   `http://localhost:3001/api/auth/google/callback`
7. **Browser behavior** — limited (route-sweep done; no full manual QA)
8. **Performance** — no production benchmark
9. **WebSocket/Chat** — ChatGateway registered, runtime unverified
10. **Gamification** — registered, runtime unverified

---

## RISK MATRIX (updated)

| Risk | Probability | Impact | Priority | Status |
|------|-------------|--------|----------|--------|
| Build failure | LOW | CRITICAL | P0 | FIXED |
| Orphan modules unreachable | LOW | HIGH | P0 | FIXED |
| Hardcoded creds in source | LOW | HIGH | P1 | FIXED |
| SUPER_ADMIN locked out | LOW | HIGH | P1 | FIXED |
| JWT Bearer broken | LOW | MEDIUM | P1 | FIXED |
| Theme flash | LOW | MEDIUM | P1 | FIXED |
| Lint OOM / lint error | LOW | MEDIUM | P1 | FIXED |
| Attendance no void/edit | — | MEDIUM | P2 | FIXED |
| Exams/Invoices/HR DTO drift | HIGH | HIGH | P0 | FIXED |
| Auth-tracker insecure verify | MEDIUM | HIGH | P1 | FIXED |
| Helmet missing | MEDIUM | MEDIUM | P2 | FIXED |
| Payroll adjust input loss | MEDIUM | HIGH | P1 | FIXED |
| PDF export case-break (Win) | HIGH | MEDIUM | P1 | FIXED |
| Invoice remaining undercount | MEDIUM | MEDIUM | P2 | FIXED |
| Invalid payment method UI | MEDIUM | LOW | P2 | FIXED |
| Migrations un-applied to DB | HIGH | HIGH | P0 | FIXED (local) |
| Security e2e pending DB | HIGH | HIGH | P0 | FIXED |
| i18n incomplete | CERTAIN | HIGH | P1 | OPEN |
| HR tax float (rounded) | LOW | MEDIUM | P3 | OPEN |
| Analytics COALESCE paidAt | LOW | MEDIUM | P3 | OPEN |
| Google OAuth placeholders / invalid_client | CERTAIN | HIGH | P1 | FIXED (guard) / full sign-in needs real creds |
| External integrations unverified | UNKNOWN | MEDIUM | P3 | OPEN |
| Face/camera unverified live | UNKNOWN | HIGH | P3 | OPEN |

---

## RECOMMENDED NEXT ORDER

1. **Apply migrations** to a healthy DB: `npx prisma migrate deploy`
2. **Commit** staged migrations + intentional source changes
3. **i18n page migration** (largest remaining effort)
4. HR tax rate → Decimal/financial-engine
5. Revenue `paidAt` standardization
6. Configure real Google OAuth web client in `.env` (+ Console origins/redirect);
   rotate any previously exposed secret; configure Telegram/SMS/SMTP creds
7. Live face/camera/integration verification
