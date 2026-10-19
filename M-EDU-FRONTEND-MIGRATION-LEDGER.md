# M-EDU FRONTEND V2 — MIGRATION LEDGER

**Scope**: 100% Repository Audit & Migration Tracking (`apps/web/src`)  
**Standard**: "Premium, Not Neon" — Royal Blue (`#2563EB`), Obsidian Navy (`#0B0F17`), Clean Slate (`#F8FAFC`), Soft Violet (`#6366F1`)  
**Formula**: `Inventarizatsiya qilingan fayllar (330) = VERIFIED/COMPLETED (174) + NOT_APPLICABLE (156) + BLOCKED (0)`

---

## 1. Page Screens (`apps/web/src/pages/`) — 81 Files

| # | Fayl yo‘li | Fayl turi va vazifasi | Dizaynga ta’siri | Oldingi holati | Yangi holati | Mas’ul agent | Test natijasi | Yakuniy status |
|---|-----------|----------------------|-----------------|----------------|--------------|--------------|---------------|:--------------:|
| 1 | `apps/web/src/pages/Dashboard.tsx` | Executive Dashboard | Critical (Hero) | Redesigned | Clean SaaS Royal Blue / Slate | Agent C | Passed (5/5 calc) | VERIFIED |
| 2 | `apps/web/src/pages/ExecutiveDashboard.tsx` | Executive Analytics | High | Oled / Blur / Neon | Obsidian Navy / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 3 | `apps/web/src/pages/Student360.tsx` | 360 Student Profile | High | Oled / AppleBlue | Obsidian Navy / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 4 | `apps/web/src/pages/Students.tsx` | Student Directory | High | Excessive Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 5 | `apps/web/src/pages/StudentDetail.tsx` | Student Details | High | Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 6 | `apps/web/src/pages/StudentForm.tsx` | Student Create/Edit | High | Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 7 | `apps/web/src/pages/Groups.tsx` | Group Management | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 8 | `apps/web/src/pages/GroupDetail.tsx` | Group Details | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 9 | `apps/web/src/pages/GroupForm.tsx` | Group Create/Edit | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (1/1 edit) | VERIFIED |
| 10 | `apps/web/src/pages/Courses.tsx` | Courses Directory | High | Oled / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 11 | `apps/web/src/pages/Curriculum.tsx` | Curriculum View | High | Oled / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 12 | `apps/web/src/pages/Subjects.tsx` | Subjects Directory | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 13 | `apps/web/src/pages/Teachers.tsx` | Teachers Directory | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 14 | `apps/web/src/pages/TeacherWorkload.tsx` | Workload Matrix | Medium | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 15 | `apps/web/src/pages/Attendance.tsx` | Attendance Journal | Critical | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent E | Passed (Vite/TS) | COMPLETED |
| 16 | `apps/web/src/pages/FaceRecognition.tsx` | Face ID Scan | Critical | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent E | Passed (8/8 fmt) | VERIFIED |
| 17 | `apps/web/src/pages/FaceEnrollment.tsx` | Face Enrollment | Critical | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent E | Passed (1/1 contract) | VERIFIED |
| 18 | `apps/web/src/pages/Cameras.tsx` | CCTV / Webcams | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent E | Passed (Vite/TS) | COMPLETED |
| 19 | `apps/web/src/pages/Grades.tsx` | Gradebook | High | Zinc / Heavy Radius | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 20 | `apps/web/src/pages/Exams.tsx` | Exam Schedules | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 21 | `apps/web/src/pages/Assignments.tsx` | Assignments Hub | High | Oled / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 22 | `apps/web/src/pages/Homework.tsx` | Homework Submissions | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 23 | `apps/web/src/pages/Assessment.tsx` | Assessment Scoring | High | Oled / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 24 | `apps/web/src/pages/Payments.tsx` | Payments Register | Critical | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 25 | `apps/web/src/pages/Invoices.tsx` | Invoices / Billing | Critical | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 26 | `apps/web/src/pages/Expenses.tsx` | Expenses Tracker | High | Blur / Radius | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 27 | `apps/web/src/pages/Payroll.tsx` | Salary & Payroll | Critical | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 28 | `apps/web/src/pages/FinancialAnalytics.tsx` | Financial Charts | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 29 | `apps/web/src/pages/PayrollAnalytics.tsx` | Payroll Charts | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 30 | `apps/web/src/pages/CRMAnalytics.tsx` | CRM Funnel Charts | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 31 | `apps/web/src/pages/Leads.tsx` | CRM Leads Pipeline | High | Heavy Radius | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 32 | `apps/web/src/pages/Branches.tsx` | Branches Matrix | Medium | Blur / Radius | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 33 | `apps/web/src/pages/Inventory.tsx` | Physical Assets | Medium | Blur / Radius | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 34 | `apps/web/src/pages/Reconciliation.tsx` | Financial Audit | High | Clean Slate | Preserved / Verified | Agent F | Passed (Vite/TS) | VERIFIED |
| 35 | `apps/web/src/pages/AiCopilot.tsx` | AI Copilot Hub | Critical | Oled / Blur | Clean Slate / Royal Blue | Agent G | Passed (21/21 tests) | VERIFIED |
| 36 | `apps/web/src/pages/Chat.tsx` | Live Messaging | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent G | Passed (Vite/TS) | COMPLETED |
| 37 | `apps/web/src/pages/NotificationsCenter.tsx` | Alerts Center | High | Oled / AppleBlue | Clean Slate / Royal Blue | Agent G | Passed (4/4 tests) | VERIFIED |
| 38 | `apps/web/src/pages/CommunicationHistory.tsx` | Message Audit Logs | Medium | Heavy Radius | Clean Slate / Royal Blue | Agent G | Passed (Vite/TS) | COMPLETED |
| 39 | `apps/web/src/pages/Telegram.tsx` | Telegram Bot Link | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent G | Passed (7/7 tests) | VERIFIED |
| 40 | `apps/web/src/pages/TelegramWebApp.tsx` | Telegram Mini-App | High | Heavy Radius | Clean Slate / Royal Blue | Agent G | Passed (Vite/TS) | COMPLETED |
| 41 | `apps/web/src/pages/Documents.tsx` | Document Vault | Medium | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent G | Passed (Vite/TS) | COMPLETED |
| 42 | `apps/web/src/pages/SecurityCenter.tsx` | Security Dashboard | High | Zinc / Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 43 | `apps/web/src/pages/Privacy.tsx` | Privacy Policy | Low | Clean Slate | Preserved / Verified | Agent H | Passed (Vite/TS) | VERIFIED |
| 44 | `apps/web/src/pages/Terms.tsx` | Terms of Service | Low | Clean Slate | Preserved / Verified | Agent H | Passed (Vite/TS) | VERIFIED |
| 45 | `apps/web/src/pages/Settings.tsx` | Tenant Settings | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 46 | `apps/web/src/pages/Users.tsx` | User Management | High | Zinc / Blur / Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 47 | `apps/web/src/pages/Reports.tsx` | Reports Center | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 48 | `apps/web/src/pages/Certificates.tsx` | Certificate Center | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 49 | `apps/web/src/pages/CertificateVerify.tsx` | Certificate Verify | High | Oled / Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 50 | `apps/web/src/pages/Library.tsx` | Digital Library | Medium | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 51 | `apps/web/src/pages/Schedule.tsx` | Timetable Schedule | High | Oled / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 52 | `apps/web/src/pages/Audit.tsx` | Audit Logs | High | Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 53 | `apps/web/src/pages/AuditTimeline.tsx` | Timeline Logs | Medium | Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 54 | `apps/web/src/pages/SystemHealth.tsx` | Health Checks | High | Zinc / Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 55 | `apps/web/src/pages/DataGovernance.tsx` | Data Retention | Medium | Blur / Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 56 | `apps/web/src/pages/DataQualityCenter.tsx` | Data Quality Rules | Medium | Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 57 | `apps/web/src/pages/Observability.tsx` | Observability Hub | High | Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 58 | `apps/web/src/pages/AcademicRisk.tsx` | Risk Intelligence | High | Blur / Radius | Clean Slate / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 59 | `apps/web/src/pages/AnomalyDetection.tsx` | ML Anomaly Hub | High | Heavy Radius | Clean Slate / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 60 | `apps/web/src/pages/EarlyWarning.tsx` | Early Warning | High | Heavy Radius | Clean Slate / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 61 | `apps/web/src/pages/Forecasting.tsx` | Revenue Forecasts | High | Blur / Radius | Clean Slate / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 62 | `apps/web/src/pages/PerformanceMonitor.tsx` | Hardware Performance | High | Blur / Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 63 | `apps/web/src/pages/RelationshipGraph.tsx` | Social Graph | Medium | Blur / Radius | Clean Slate / Royal Blue | Agent C | Passed (Vite/TS) | COMPLETED |
| 64 | `apps/web/src/pages/ResourceBooking.tsx` | Room Bookings | Medium | Heavy Radius | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 65 | `apps/web/src/pages/FollowUpAutomation.tsx` | Follow-ups Engine | High | Heavy Radius | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 66 | `apps/web/src/pages/AutomationEngine.tsx` | Triggers / Rules | High | Blur / Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 67 | `apps/web/src/pages/FeatureFlags.tsx` | Feature Toggles | Medium | Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 68 | `apps/web/src/pages/ImportExport.tsx` | CSV / Excel Hub | Medium | Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 69 | `apps/web/src/pages/ApiKeys.tsx` | API Keys Token | High | Blur / Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 70 | `apps/web/src/pages/ParentPortal.tsx` | Parent View | High | Blur / Radius | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 71 | `apps/web/src/pages/HR.tsx` | Staff Records | High | Oled / Blur / AppleBlue | Clean Slate / Royal Blue | Agent F | Passed (Vite/TS) | COMPLETED |
| 72 | `apps/web/src/pages/GamificationHub.tsx` | Badges & Points | Medium | Oled / AppleBlue | Clean Slate / Royal Blue | Agent D | Passed (Vite/TS) | COMPLETED |
| 73 | `apps/web/src/pages/UniversalSearch.tsx` | Spotlight Search | High | Zinc / Heavy Radius | Clean Slate / Royal Blue | Agent B | Passed (Vite/TS) | COMPLETED |
| 74 | `apps/web/src/pages/WhatChanged.tsx` | Release Notes | Medium | Zinc / Heavy Radius | Clean Slate / Royal Blue | Agent H | Passed (Vite/TS) | COMPLETED |
| 75 | `apps/web/src/pages/Login.tsx` | Sign-in Screen | Critical | Blur / AppleBlue | Clean Slate / Royal Blue | Agent B | Passed (6/6 tests) | VERIFIED |
| 76 | `apps/web/src/pages/Register.tsx` | Sign-up Screen | Critical | Clean Slate | Clean Slate / Royal Blue | Agent B | Passed (6/6 tests) | VERIFIED |
| 77 | `apps/web/src/pages/ForgotPassword.tsx` | Password Recovery | High | Blur | Clean Slate / Royal Blue | Agent B | Passed (Vite/TS) | COMPLETED |
| 78 | `apps/web/src/pages/ResetPassword.tsx` | Password Reset | High | Blur | Clean Slate / Royal Blue | Agent B | Passed (Vite/TS) | COMPLETED |
| 79 | `apps/web/src/pages/AuthCallback.tsx` | OAuth Redirect | High | Blur / Radius | Clean Slate / Royal Blue | Agent B | Passed (4/4 tests) | VERIFIED |
| 80 | `apps/web/src/pages/Unauthorized.tsx` | 403 Forbidden | Medium | Blur | Clean Slate / Royal Blue | Agent B | Passed (Vite/TS) | COMPLETED |
| 81 | `apps/web/src/pages/NotFound.tsx` | 404 Not Found | Medium | Blur | Clean Slate / Royal Blue | Agent B | Passed (4/4 tests) | VERIFIED |

---

## 2. Shells, Navigation & Shared Components — 93 Files

| Fayl | Turi | Holati | Mas’ul Agent | Status |
|------|------|--------|--------------|:------:|
| `apps/web/src/layouts/AppLayout.tsx` | Application Layout | Clean Slate (`#0B0F17` dark, `#F8FAFC` light, no orbs) | Agent B | VERIFIED |
| `apps/web/src/layouts/AuthLayout.tsx` | Authentication Layout | Clean Slate, no aurora orbs, subtle aura | Agent B | VERIFIED |
| `apps/web/src/layouts/components/Sidebar.tsx` | Navigation Sidebar | Royal Blue gradient, Slate tokens, 0 neon | Agent B | VERIFIED |
| `apps/web/src/layouts/components/TopBar.tsx` | Top Navigation Bar | Slate tokens, Emerald status, Royal focus | Agent B | VERIFIED |
| `apps/web/src/layouts/components/MobileNav.tsx` | Mobile Navigation | Drawer overlay, 44px touch targets | Agent B | VERIFIED |
| `apps/web/src/layouts/components/GlassSurface.tsx` | Surface Primitive | Calibrated 12-16px blur, 120% sat, obsidian fill | Agent A | VERIFIED |
| `apps/web/src/layouts/components/LayoutDecorations.tsx` | Layout Accents | Disabled particles, royal-violet scroll progress | Agent B | VERIFIED |
| `apps/web/src/components/ui/GlassCard.tsx` | Core Card Primitive | Calibrated 12px blur, neutral border | Agent A | VERIFIED |
| `apps/web/src/components/ui/GlassButton.tsx` | Core Button Primitive | Royal Blue default, neutral borders | Agent A | VERIFIED |
| `apps/web/src/components/ui/GlassInput.tsx` | Core Input Primitive | Clean slate tokens, royal blue focus | Agent A | VERIFIED |
| `apps/web/src/components/ui/GlassModal.tsx` | Modal Primitive | Royal Blue actions, neutral borders | Agent A | VERIFIED |
| `apps/web/src/components/ui/GlassTable.tsx` | Table Primitive | Wrapped in `medu-scroll-x`, no body overflow | Agent A | VERIFIED |
| `apps/web/src/components/CommandPalette.tsx` | Global Search Palette | Royal Blue tokens, ⌘K trigger | Agent B | VERIFIED |
| `apps/web/src/components/NotificationsMenu.tsx` | Notifications Menu | Passed (4/4 tests), royal blue badges | Agent G | VERIFIED |
| `apps/web/src/components/TelegramIntegration.tsx` | Telegram Card | Passed (5/5 tests), royal tokens | Agent G | VERIFIED |
| `apps/web/src/components/WebcamCapture.tsx` | Camera Capture | Passed (8/8 error safety tests) | Agent E | VERIFIED |
| `apps/web/src/styles/design-tokens.css` | Global Design Tokens | Royal Blue, Obsidian Navy, Slate substrate | Agent A | VERIFIED |
| `apps/web/tailwind.config.js` | Tailwind Config | Brand scale `#EFF6FF`-`#1E3A8A`, Accent `#6366F1` | Agent A | VERIFIED |
| *(Remaining 75 UI components)* | Shared UI Primitives | 35 components updated, 40 clean primitives | Agents A-H | COMPLETED |

---

## 3. Non-UI, Logic & Support Files — 156 Files

| Kategoriya | Fayllar soni | Vazifasi | Status |
|------------|:------------:|----------|:------:|
| `types/*.ts` | 38 | TypeScript interfeyslari va turlari (dizaynga bevosita ta'siri yo'q) | NOT_APPLICABLE |
| `hooks/*.ts(x)` | 20 | WebSocket, data-fetching va audio holati boshqaruvi | NOT_APPLICABLE |
| `i18n/**/*.ts` | 15 | Mahalliy tildagi tarjimalar lug'ati (`uz.ts`, `ru.ts`, `en.ts`) | NOT_APPLICABLE |
| `lib/*.ts` & `auth/*.tsx` | 30 | HTTP klient, sessiya boshqaruvi va yordamchi funksiyalar | NOT_APPLICABLE |
| Tests & build configs | 53 | Vitest testlari, `tsconfig.json`, `vite.config.ts`, `main.tsx` | NOT_APPLICABLE |
