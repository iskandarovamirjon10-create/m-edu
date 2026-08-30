# Design Migration Progress

## Phase 1: Fix Structural Errors
- [x] 1.1 Fix undefined_identifier errors (111 — missing BuildContext) ✅
- [x] 1.2 Fix invalid_constant errors (26 — const/runtime mismatch) ✅
- [x] 1.3 Fix model errors (AuditAction.actionLabel + AuditLogEntry.description) ✅
- [x] 1.4 Fix undefined_method errors (added DsType.label()) ✅
- [x] 1.5 Verify: flutter analyze — **0 errors**, 27 pre-existing warnings/infos ✅

## Phase 2: Migrate ~44 Remaining Screens (color + i18n + a11y + responsive)
- [x] 2.1 Attendance screens (3) — i18n keys added, history + center migrated ✅
- [x] 2.2 Payments screens (5) — i18n keys added, finance + payments_list + debts migrated ✅
- [ ] 2.3 Teachers screens (2)
- [ ] 2.4 Groups screens (4)
- [ ] 2.5 Identity/Face screens (6)
- [ ] 2.6 CRM screens (2)
- [ ] 2.7 Notifications screens (1)
- [ ] 2.8 Reports/Grades/Homework/Scheduling (12)
- [ ] 2.9 Settings/Org/Admin (6)
- [ ] 2.10 Other screens (remaining)

## Phase 3: Remove Old Design System
- [ ] 3.1 Remove old design files (glass_card, liquid/*, shared/design_system/*)
- [ ] 3.2 Remove compatibility shims (app_theme_compat.dart)
- [ ] 3.3 Remove access_denied_page.dart AppTheme references
- [ ] 3.4 Remove liquid_aurora_background.dart AppColors references
- [ ] 3.5 Verify no old references remain

## Phase 4: Final Verification
- [ ] 4.1 flutter analyze — 0 errors, 0 warnings
- [ ] 4.2 flutter test — all tests pass
- [ ] 4.3 SUMMARY table

## Current Status
- **Total errors at start:** 143 errors, 9 warnings, 16 infos (168 total issues)
- **Last flutter analyze (Phase 1):** 0 errors ✅ | 9 warnings | 16 infos (all pre-existing)
- **Last flutter analyze (Phase 2 in progress):** 0 errors ✅
- **Last flutter test:** [pending — Phase 2 completion]
- **Screens migrated so far:** 6/44 (attendance_history, attendance_center, finance, payments_list, debts_list, attendance_page)
- **ARB keys added:** ~65 new keys across uz/en/ru
- **i18n:** Started — attendance_history, attendance_center, finance, payments_list, debts_list migrated
- **Accessibility:** attendance_history has Semantics on filter chips + expansion tiles
- **Responsive:** attendance_history has LayoutBuilder for wide/narrow layouts
