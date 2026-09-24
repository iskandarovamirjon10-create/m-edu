# M-EDU RUNTIME VERIFICATION REPORT

**Audit Date:** 2026-09-14

---

## VERIFICATION METHOD

Due to build failures (TypeScript compilation errors in both API and Web), runtime verification was performed through:
1. Static code analysis (comprehensive)
2. TypeScript type checking (confirmed errors)
3. Build execution (confirmed failure)

**No browser-based runtime testing was possible** because the application cannot compile.

---

## BUILD VERIFICATION

### turbo build: FAIL

```
@medu/contracts:build: EPERM: operation not permitted, open 'tsconfig.tsbuildinfo'
@medu/financial-engine:build: error TS5033: Could not write file tsconfig.tsbuildinfo
```

Windows EPERM error on tsbuildinfo files + TypeScript compilation errors cascade.

### API typecheck (npx tsc --noEmit): FAIL

**42 non-test errors** including:
- attendance.service.ts: Cannot find name 'toCreate', 'toUpdate', 'organizationId', 'date' (scope errors)
- data-quality.service.ts: 'dataQualityIssue' does not exist on PrismaService (model dropped)
- gamification.service.ts: 'gamificationXpEvent', 'studentGamification' not on PrismaClient
- face.service.ts: PrismaEnrollmentAdapter missing hardDeleteByStudentId
- chat.service.spec.ts: Uses Jest types instead of Vitest
- observability.service.ts: Redis constructor not constructable
- security.service.ts: 'dataQualityIssue' does not exist on PrismaService

### Web typecheck (npx tsc -b --noEmit): FAIL

**70+ errors** including:
- 9 pages import non-existent API clients from @/lib/api
- 4 pages import non-existent types from @/lib/types
- 4 pages import non-existent useLocalizedPageTitle from usePageTitle
- Multiple pages reference non-existent properties on analyticsApi
- Chat.tsx: implicit 'any' type on multiple parameters
- Invoices.tsx: implicit 'any' on parameter

---

## CRITICAL PATH VERIFICATION (Static Analysis)

### Path 1: Login -> Dashboard

| Step | Status | Notes |
|------|--------|-------|
| Login form renders | UNVERIFIED | No browser test |
| Login API call | IMPLEMENTED | auth.controller.ts, auth.service.ts |
| JWT cookie set | IMPLEMENTED | jwt.strategy.ts |
| Dashboard renders | UNVERIFIED | Would compile if schema fixed |
| Dashboard stats | IMPLEMENTED | dashboard.service.ts |
| Active groups count | IMPLEMENTED | Groups count from DB |

### Path 2: Create Course -> Create Group

| Step | Status | Notes |
|------|--------|-------|
| Course form | IMPLEMENTED | Courses.tsx, courses.service.ts |
| Course select in Group form | IMPLEMENTED | GroupForm.tsx:61-65 fetches active courses |
| Group creation | IMPLEMENTED | groups.service.ts |

### Path 3: Add Student to Group

| Step | Status | Notes |
|------|--------|-------|
| Student detail page | IMPLEMENTED | StudentDetail.tsx |
| Assign to group | IMPLEMENTED | studentsApi.assignGroup() |
| Remove from group | IMPLEMENTED | studentsApi.removeGroup() |

### Path 4: Mark Attendance

| Step | Status | Notes |
|------|--------|-------|
| Attendance form | IMPLEMENTED | Attendance.tsx |
| Mark attendance API | IMPLEMENTED | attendance.service.ts |
| Parent notification | IMPLEMENTED | emitParentNotifications() |
| **Private method scope** | **BROKEN** | attendance.service.ts:144-205 |

### Path 5: Record Payment

| Step | Status | Notes |
|------|--------|-------|
| Payment form | IMPLEMENTED | Payments.tsx |
| Record payment | IMPLEMENTED | payments.service.ts |
| **paidAt field** | **BROKEN** | Field missing from schema |

### Path 6: Payroll

| Step | Status | Notes |
|------|--------|-------|
| Teacher payroll (financial-engine) | IMPLEMENTED | decimal-safe |
| Employee payroll (hr.service) | **BROKEN** | float arithmetic |
| **PayrollRun model** | **BROKEN** | Missing from schema |

### Path 7: Invoice/Refund

| Step | Status | Notes |
|------|--------|-------|
| Invoice CRUD | **BROKEN** | Model missing from schema |
| Refund processing | **BROKEN** | Model missing from schema |

---

## SETTINGS VERIFICATION

| Feature | Status | Evidence |
|---------|--------|----------|
| Language save to DB | PASS | Settings.tsx:330-340 saves to usersApi.updateSettings |
| Language save to localStorage | PASS | I18nProvider.tsx:21 stores medu-lang |
| Language apply on load | PASS | I18nProvider.tsx:58-65 reads stored locale |
| Language switching | PASS | LanguageSwitcher.tsx updates context |
| Theme save to localStorage | PASS | Settings.tsx:171 stores medu-theme |
| Theme apply on load | **FAIL** | No initialization in main.tsx or App.tsx |
| Theme apply on switch | PASS | ThemeSwitcher.tsx:154-166 applies dark class |
| Profile update | PASS | users.service.ts:112-180 |
| Password change | PASS | users.service.ts:182-218 with session revocation |

---

## i18n VERIFICATION

| Check | Status | Evidence |
|-------|--------|----------|
| Locale files exist | PASS | en.ts, ru.ts, uz.ts with 128 keys each |
| Legacy slices exist | PASS | ~575 keys per locale |
| Legacy slices merged | **FAIL** | Never imported into DICTIONARIES |
| Provider setup | PASS | I18nProvider.tsx with localStorage, cross-tab sync |
| Core pages use t() | **FAIL** | 45+ pages hardcoded English |
| Sidebar uses t() | **FAIL** | AppLayout.tsx:65-92 hardcoded |
| Settings uses t() | **FAIL** | Imports useI18n but never calls t() |

---

## THEME VERIFICATION

| Check | Status | Evidence |
|-------|--------|----------|
| ThemeSwitcher works | PASS | Settings.tsx:143-241 |
| CSS variables | PASS | design-tokens.css complete |
| dark: Tailwind | PASS | tailwind.config.js darkMode: 'class' |
| Pre-hydration init | **FAIL** | No script in index.html or main.tsx |
| Cross-tab sync | **FAIL** | No storage event listener for medu-theme |
| localStorage persistence | PASS | Settings.tsx:171 |

---

## AUTH VERIFICATION

| Check | Status | Evidence |
|-------|--------|----------|
| Login endpoint | PASS | auth.controller.ts |
| Register endpoint | PASS | auth.controller.ts |
| JWT cookie | PASS | jwt.strategy.ts (cookie-only) |
| Password hashing | PASS | bcryptjs with salt rounds |
| Session management | PASS | Session model with expiry/revocation |
| Google OAuth | IMPLEMENTED | google.strategy.ts - RUNTIME UNVERIFIED |
| Forgot password | PASS | PasswordResetToken model |
| Reset password | PASS | AuthService.resetPassword() |

---

## RBAC VERIFICATION

| Check | Status | Evidence |
|-------|--------|----------|
| Roles enum | PASS | 6 roles defined |
| Permissions enum | PASS | 50+ permissions in contracts |
| PermissionsGuard | PASS | rbac.service.ts |
| RolesGuard | **FAIL** | No SUPER_ADMIN bypass |
| Controller guards | PARTIAL | Some endpoints missing @Roles |

---

## NOTIFICATION VERIFICATION

| Check | Status | Evidence |
|-------|--------|----------|
| Event types | PASS | 8 event types defined |
| BullMQ queue | PASS | notification-event.service.ts |
| Processor | PASS | notification-event.processor.ts |
| In-app delivery | PASS | Prisma Notification model |
| SMS (Eskiz) | IMPLEMENTED | sms.service.ts - RUNTIME UNVERIFIED |
| Telegram | IMPLEMENTED | telegram.service.ts - RUNTIME UNVERIFIED |
| Email | EXISTS | email.service.ts - NOT in pipeline |
| User preferences | STORED | notification-preference.service.ts - NOT enforced |

---

## SUMMARY

| Category | Status |
|----------|--------|
| Build | FAIL |
| API Compilation | FAIL |
| Web Compilation | FAIL |
| Database Schema | FAIL (drift) |
| Authentication | PASS (core) |
| RBAC | FAIL (SUPER_ADMIN) |
| i18n | FAIL (90% untranslated) |
| Theme | FAIL (no pre-hydration) |
| Settings | PARTIAL |
| Financial | FAIL (broken models) |
| Payroll | PARTIAL (dual systems) |
| CRM | PARTIAL |
| Notifications | PARTIAL |
| Face Engine | UNVERIFIED |
| Camera | UNVERIFIED |
| Browser Runtime | UNVERIFIED |
| Telegram | UNVERIFIED |
| SMS | UNVERIFIED |
