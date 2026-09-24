# M-EDU FINAL PRODUCTION READINESS REPORT

**Audit Date:** 2026-09-14
**Scope:** Full monorepo - apps/api, apps/web, packages/*, database, security, i18n, theme

---

## FINAL VERDICT

# NOT READY FOR PRODUCTION

---

## Executive Summary

M-EDU is a comprehensive education management platform with a NestJS backend, React/Vite frontend, Prisma ORM, and 59 backend modules + 60+ frontend pages. **The application cannot compile, cannot build, and contains multiple critical runtime blockers.** The root cause is Prisma schema drift causing TypeScript compilation failures across the entire codebase.

## Build Status: FAIL

| Check | Result |
|-------|--------|
| turbo build | FAIL |
| API typecheck | FAIL - 42+ errors |
| Web typecheck | FAIL - 70+ errors |
| Lint | NOT RUN |

## Frontend Status: FAIL

- 70+ TypeScript errors (missing exports, broken imports)
- 45+ pages hardcoded English - zero i18n
- i18n legacy slices (~575 keys) never merged
- Theme flash on every load - no pre-hydration init
- Sidebar labels hardcoded English
- Pages import non-existent API clients (Branches, Chat, Invoices, etc.)
- Two different toast APIs coexist

## Backend Status: FAIL

- Prisma schema missing 10+ models, 15+ columns, 9+ enums
- 10 orphan modules not registered in AppModule
- attendance.service.ts scope errors
- RolesGuard denies SUPER_ADMIN
- CORS hardcoded LAN IP 192.168.0.6
- Google OAuth placeholder credentials **[FIXED 2026-09-23 — fail-fast guard;
  real Console client still required]**
- JWT ignores Authorization header

## Database Status: FAIL

**10 Models Missing:** Invoice, InvoiceItem, Refund, PayrollRun, FinancialPeriod, Branch, Lesson, AutomationRule, AutomationExecution, ApiKey

**Missing Columns:** Payment.paidAt/invoiceId, Student.status/balance, Teacher.salaryType/lessonRate, Group.branchId, User.branchId

**Missing Enums:** PayrollStatus, SalaryType, InvoiceStatus, RefundStatus, StudentStatus, etc.

## Security Status: FAIL

- Seed logs passwords to stdout
- Weak default passwords (admin123, demo123)
- Developer email + password123 in set-pass.ts
- CORS hardcoded LAN IP
- ~35 test scripts in repo root

## i18n: FAIL

- 128 keys per locale + 575 legacy keys defined but never loaded
- 45+ pages hardcoded English
- Settings page uses useI18n but never calls t()
- Sidebar labels hardcoded English

## Theme: FAIL

- No pre-hydration theme initialization
- Flash of wrong theme on every load
- No cross-tab theme sync

## Financial System: FAIL

- Dual payroll systems with different formulas
- Float arithmetic in employee payroll
- Invoice/Refund systems broken (missing schema)
- Revenue date inconsistency (dashboard vs analytics)

## Authentication: PARTIAL

- Login/Register/Logout: PASS
- Session persistence: PASS
- Google OAuth: FAIL-FIXED (placeholder guard live; needs real client for full flow)

## RBAC: FAIL

- RolesGuard denies SUPER_ADMIN on role-restricted routes

## Notifications: PARTIAL

- Event pipeline: PASS (BullMQ)
- SMS/Telegram: UNVERIFIED
- Email: Not wired into pipeline
- User preferences: Not enforced

## Face Engine: UNVERIFIED
## Camera: UNVERIFIED
## Browser Runtime: UNVERIFIED
## Telegram: UNVERIFIED
## SMS: UNVERIFIED

---

## P0 Findings (12 Production Blockers)

1. Prisma schema missing 10+ models
2. Prisma schema missing 15+ columns
3. Prisma schema missing 9+ enums
4. API: 42+ TypeScript errors
5. Web: 70+ TypeScript errors
6. 10 orphan modules not registered
7. attendance.service.ts scope errors
8. Payment.paidAt missing from schema
9. Pages import non-existent API clients
10. Pages import non-existent types
11. Dual payroll systems
12. Invoice/Refund systems broken

## P1 Findings (13 Critical)

1. Seed logs passwords to stdout
2. Weak default passwords
3. Developer email + password123 in set-pass.ts
4. CORS hardcoded LAN IP
5. Google OAuth placeholder credentials **[FIXED 2026-09-23]**
6. JWT ignores Authorization header
7. RolesGuard denies SUPER_ADMIN
8. Legacy slices never merged
9. 45+ pages hardcoded English
10. No pre-hydration theme initialization
11. Sidebar labels hardcoded English
12. Float arithmetic in payroll
13. No RBAC on read endpoints

---

## Minimum Required Before Production

1. Run `prisma db pull` to recover schema from live DB
2. Fix all TypeScript compilation errors (42 API + 70 web)
3. Register or delete 10 orphan modules
4. Fix RolesGuard SUPER_ADMIN bypass
5. Fix attendance.service.ts scope errors
6. Fix floating-point payroll calculation
7. Add theme initialization to index.html
8. Remove hardcoded credentials from source
