# M-EDU COMPLETE FORENSIC FINDINGS

**Audit Date:** 2026-09-14

---

## Finding Format

Each finding has: ID, Severity, Module, File, Line, Problem, Root Cause, Impact, Evidence

---

## P0 - PRODUCTION BLOCKERS

### P0-01: Prisma Schema Missing 10+ Models

- **Module:** Database
- **File:** apps/api/prisma/schema.prisma
- **Problem:** 10 models that exist in the database (via migrations) are missing from schema.prisma
- **Root Cause:** Schema was reconstructed from compiled artifacts; migrations added tables but schema was never regenerated
- **Impact:** prisma generate produces a Client that cannot compile - entire backend fails
- **Missing Models:** Invoice, InvoiceItem, Refund, PayrollRun, FinancialPeriod, Branch, Lesson, AutomationRule, AutomationExecution, ApiKey

### P0-02: Prisma Schema Missing 15+ Columns

- **Module:** Database
- **File:** apps/api/prisma/schema.prisma
- **Problem:** Multiple existing models are missing columns added by migrations
- **Missing on Payment:** paidAt, invoiceId, receiptNumber, receiptIssuedAt
- **Missing on Student:** status, balance, branchId
- **Missing on Teacher:** salaryType, lessonRate, branchId, employeeId
- **Missing on Group:** branchId
- **Missing on User:** branchId

### P0-03: Prisma Schema Missing 9+ Enums

- **Module:** Database
- **File:** apps/api/prisma/schema.prisma
- **Problem:** Enums added by migrations are missing from schema
- **Missing:** PayrollStatus, SalaryType, InvoiceStatus, RefundStatus, StudentStatus, LessonStatus, DiscountType, DiscountScope, PeriodStatus, PARTIALLY_PAID on PaymentStatus

### P0-04: API TypeScript Compilation Errors

- **Module:** Backend
- **File:** apps/api/src/ (multiple)
- **Problem:** 42+ non-test TypeScript errors prevent compilation
- **Key errors:**
  - attendance.service.ts:144-205 - private methods reference out-of-scope variables (toCreate, toUpdate, organizationId, date)
  - data-quality.service.ts - dataQualityIssue not on PrismaService (model dropped by migration)
  - gamification.service.ts - gamificationXpEvent, studentGamification not on PrismaClient
  - face.service.ts - PrismaEnrollmentAdapter missing hardDeleteByStudentId
  - chat.service.spec.ts - uses Jest instead of Vitest types

### P0-05: Web TypeScript Compilation Errors

- **Module:** Frontend
- **File:** apps/web/src/ (multiple)
- **Problem:** 70+ TypeScript errors prevent compilation
- **Key errors:**
  - ApiKeys.tsx, AutomationEngine.tsx, Branches.tsx, Chat.tsx, CommunicationHistory.tsx, DataGovernance.tsx, Invoices.tsx, Observability.tsx, ParentPortal.tsx - import non-existent API clients from @/lib/api
  - Branches.tsx, Chat.tsx, Invoices.tsx, ParentPortal.tsx - import non-existent types from @/lib/types
  - Chat.tsx - import useLocalizedPageTitle from usePageTitle (does not exist)
  - AnomalyDetection.tsx, CRMAnalytics.tsx, ExecutiveDashboard.tsx, FinancialAnalytics.tsx, Reconciliation.tsx - property does not exist on analyticsApi

### P0-06: 10 Orphan Backend Modules

- **Module:** Backend
- **File:** apps/api/src/app.module.ts
- **Problem:** 10 modules have controllers, services, and routes but are never imported into AppModule
- **Orphan Modules:** PerformanceModule, GamificationModule, ParentPortalModule, ObservabilityModule, ChatModule, DataGovernanceModule, BranchesModule, ApiKeysModule, ReportsModule, AutomationModule
- **Impact:** All HTTP endpoints in these modules are unreachable; ObservabilityModule's MetricsMiddleware never loads

### P0-07: attendance.service.ts Scope Errors

- **Module:** Backend
- **File:** apps/api/src/attendance/attendance.service.ts:144-205
- **Problem:** Private methods emitParentNotifications() and awardAttendanceXp() reference variables from calling method markAttendance() - toCreate, toUpdate, organizationId, date are not in scope
- **Root Cause:** Methods were likely extracted from markAttendance without parameterizing dependencies
- **Impact:** TypeScript compilation error; feature is broken

### P0-08: Payment.paidAt Missing from Schema

- **Module:** Database/Financial
- **File:** apps/api/src/payments/payments.service.ts:134
- **Problem:** Code references paidAt field on Payment model but it does not exist in schema.prisma
- **Impact:** Prisma runtime error when marking payment as PAID

### P0-09: Pages Import Non-Existent API Clients

- **Module:** Frontend
- **Files:** Branches.tsx:3, Chat.tsx:17, Invoices.tsx:8, Observability.tsx:4, ParentPortal.tsx:8, CommunicationHistory.tsx:22, DataGovernance.tsx:5, AutomationEngine.tsx:3, ApiKeys.tsx:13
- **Problem:** These pages import API clients (branchesApi, chatApi, invoicesApi, observabilityApi, parentPortalApi, communicationApi, dataGovernanceApi, automationApi, apiKeysApi) that are not exported from @/lib/api
- **Impact:** Pages crash at runtime with import errors

### P0-10: Pages Import Non-Existent Types

- **Module:** Frontend
- **Files:** Branches.tsx:24, Chat.tsx:19, Invoices.tsx:30, ParentPortal.tsx:18-22
- **Problem:** These pages import types (Branch, ChatConversation, ChatMessage, Invoice, InvoiceTotals, ParentChild, ParentAttendanceRecord, ParentAttendanceSummary, ParentGradesResponse, ParentInvoicesResponse) that are not in @/lib/types
- **Impact:** TypeScript compilation error

### P0-11: Dual Payroll Systems

- **Module:** Financial
- **File:** apps/api/src/hr/hr.service.ts:324-394 vs apps/api/src/hr/payroll.service.ts:159-331
- **Problem:** Two completely separate payroll systems with different formulas
- **HremployeeService.generatePayroll():** Uses plain Number float math, simple formula, no audit trail
- **PayrollService.calculateRun():** Uses financial-engine with integer minor units, full breakdown, audit trail
- **Impact:** Non-teacher employees paid via imprecise float calculation; potential pay discrepancies

### P0-12: Invoice/Refund/PayrollRun Systems Broken

- **Module:** Financial
- **Files:** apps/api/src/payments/invoices.service.ts, apps/api/src/hr/payroll.service.ts
- **Problem:** These services reference Invoice, InvoiceItem, Refund, PayrollRun models that don't exist in Prisma schema
- **Impact:** Invoice CRUD, refund processing, and teacher payroll lifecycle completely broken

---

## P1 - CRITICAL

### P1-01: Seed Logs Passwords to stdout
- **File:** apps/api/prisma/seed.ts:285-290
- **Impact:** Credentials captured in CI/CD logs

### P1-02: Weak Default Passwords
- **File:** apps/api/prisma/seed.ts:9-12
- **Values:** admin123, demo123, teacher123, student123

### P1-03: Developer Email + Password in Source
- **File:** apps/api/set-pass.ts:6-9
- **Impact:** Personal email and weak password in source control

### P1-04: CORS Hardcoded LAN IP
- **File:** apps/api/src/main.ts:65
- **Value:** 192.168.0.6:3000
- **Impact:** Unauthorized cross-origin requests from that IP

### P1-05: Google OAuth Placeholder Credentials **[FIXED 2026-09-23]**
- **File:** apps/api/src/auth/google.strategy.ts:37-38; guard in
  `google-oauth-config.ts`
- **Impact:** Strategy constructed with PLACEHOLDER_CLIENT_ID at module init;
  live flow 302'd to Google with `client_id=your-google-client-id-here` → 401
  invalid_client
- **Fix:** `.env` placeholders cleared; `isGoogleOAuthConfigured` rejects
  template values and requires `*.apps.googleusercontent.com`; initiation
  fail-fast to `/auth/callback?error=...` (verified). Real Console credentials
  still required for end-to-end sign-in.

### P1-06: JWT Ignores Authorization Header
- **File:** apps/api/src/auth/jwt.strategy.ts:5-9
- **Impact:** Bearer tokens from mobile apps/programmatic consumers cannot authenticate

### P1-07: RolesGuard Denies SUPER_ADMIN
- **File:** apps/api/src/auth/roles.guard.ts:9-21
- **Problem:** Strict includes() check without SUPER_ADMIN bypass
- **Impact:** SUPER_ADMIN locked out of role-restricted routes

### P1-08: Legacy Slices Never Merged
- **File:** apps/web/src/i18n/index.ts
- **Problem:** ~575 translation keys defined in legacy-slices files but never spread into DICTIONARIES
- **Impact:** All attendance, students, teachers, payments, leads translations show raw keys

### P1-09: 45+ Pages Hardcoded English
- **Files:** All core pages (Dashboard, Students, Teachers, Groups, Courses, etc.)
- **Impact:** ~90% of app is English-only regardless of language selection

### P1-10: No Pre-Hydration Theme Initialization
- **File:** apps/web/src/main.tsx
- **Impact:** Flash of light theme on every page load for dark mode users

### P1-11: Sidebar Labels Hardcoded English
- **File:** apps/web/src/layouts/AppLayout.tsx:65-92
- **Impact:** Sidebar never changes language

### P1-12: Float Arithmetic in Payroll
- **File:** apps/api/src/hr/hr.service.ts:368-371
- **Problem:** JavaScript Number (IEEE 754 float64) for financial calculations
- **Impact:** Silent rounding errors in tax amounts

### P1-13: No RBAC on Read Endpoints
- **Files:** apps/api/src/students/students.controller.ts, teachers, groups
- **Impact:** Any authenticated user can list all students, grades, payments

---

## P2 - HIGH

### P2-01: Two Toast APIs Coexist
- **Files:** useToasts (Dashboard, Payments, etc.) vs useToast (Grades, Schedule, etc.)

### P2-02: Raw fetch() Bypassing API Client
- **Files:** AuditTimeline.tsx:41, WhatChanged.tsx:37, RelationshipGraph.tsx:42, Forecasting.tsx:41

### P2-03: Query Key Mismatch
- **Files:** Multiple pages use raw string arrays instead of queryKeys factory

### P2-04: Revenue Date Inconsistency
- **Files:** dashboard.service.ts (createdAt) vs financial-brain.service.ts (paidAt)

### P2-05: Notification Preferences Not Enforced
- **File:** notification-event.processor.ts:54-66

### P2-06: Email Not Wired Into Pipeline
- **File:** notification-event.processor.ts

### P2-07: Lead Conversion Notification Never Emitted
- **File:** leads.service.ts:104-145

### P2-08: Vite Dev Server 0.0.0.0
- **File:** apps/web/vite.config.ts:13

### P2-09: ~35 Test Scripts in Repo Root
- **Impact:** Credential leak surface, confusion

### P2-10: TOCTOU Race on SalaryRecord
- **File:** apps/api/src/hr/hr.service.ts:405-406

---

## P3 - MEDIUM (15 findings)

1. No cross-tab theme sync
2. Theme labels not translated
3. Observability redefines GlassCard locally
4. PageHeader inconsistency (old vs Glass)
5. GroupDetail has no enrollment management UI
6. GroupDetail has no empty state
7. fix-orbs3.js in pages directory
8. Invoice cancellation does not cancel linked payments
9. Balance cache can drift from ledger
10. Forecast uses course.price as monthly rate
11. HremployeeService uses any types
12. @CurrentUser() user: any in HR controller
13. Schedule model lacks organizationId
14. FeatureFlag model lacks organizationId
15. Seed creates fake data without production guard
