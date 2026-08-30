# M-EDU — CURRENT_STATE (verified 2026-08-17)

> Status: **Verified on repository + live device (Samsung Galaxy A27, Android 16)**.
> This document supersedes the stale §36 numbers in the v5 master prompt
> (259 files / 44k LOC / 141 tests were measured before Phase 2+3 landed).

## 1. Repository facts (measured)

| Metric | Value |
|---|---|
| Dart source files (`lib/`) | **429** |
| Source LOC (`lib/`) | **~133,400** |
| Test files (`test/`) | **~100** |
| Tests passing | **797 (+1 skipped)** — `flutter test` 2026-08-17 |
| `flutter analyze` | **0 issues** |
| Uncommitted changes | **193 files** (103 changed + 90 untracked) |
| Flutter | 3.27.0 stable (Dart 3.6.0) |
| Last commit | `00247a3` — RBAC gating, event-sync, l10n, crystal DS, backup/restore |

## 2. Tech stack (in use)

- **State**: flutter_riverpod 2.6 (StateNotifier + Future/Family providers)
- **Navigation**: go_router 14 (StatefulShellRoute — 5-tab shell + top-level routes + RBAC route guard)
- **Database**: Isar 3.1 (offline-first local source of truth), 26 collections
- **Auth**: local-only, Argon2id password hashing (per-account random salt, P1-05),
  secure storage, session TTL 30 days, biometric (local_auth)
- **Face**: google_mlkit_face_detection + tflite_flutter (embeddings) +
  face_encryption_service + quality gates + threshold calibration +
  **blink liveness** (landmark-based, EAR/eyeOpenProbability)
- **Camera**: mobile_scanner (QR) + camera_stream_service + Hikvision RTSP config adapter
- **Media**: media_kit (local patch in `third_party/media_kit_video`)
- **Network**: dio + connectivity_plus + optional Firebase (cloud_firestore) sync engine
- **Localization**: uz/ru/en via ARB + gen-l10n
- **Design**: Liquid Glass Design System **v3.1** — `AppColors` (ThemeExtension,
  single color source), `app_tokens.dart` (spacing/radius/blur/shadow/type),
  `module_colors.dart` (module + camera accents), Crystal Air + App component layers

## 3. Feature inventory (21 features)

`auth, identity, students, teachers, groups, scheduling (rooms), attendance,
payments (finance), reports, face_recognition, notifications, crm, grades,
gamification, intelligence, organization, settings, audit, diagnostics,
dashboard, l10n`

Each feature follows `presentation/ application/ domain/ infrastructure/`
with `commands/ queries/ events/` where applicable.

## 4. Live device QA result (2026-08-17, Galaxy A27 / Android 16)

- Clean install + cold start **3146 ms** (incl. first-run permission dialog),
  warm start **2548 ms**, session auto-restore verified.
- Core flows verified live: register student (Real ID + QR card),
  group create + assign student, payment 200,000 UZS + finance aggregation,
  dashboard counters, student-card projections (group name, paid status),
  empty states (dashboard/attendance/groups/group-members), back navigation.
- Logcat: no FATAL / no Flutter exceptions during all flows.
- **2 P1 bugs found and FIXED** (see GAPS.md):
  BUG-001 register→`go()` killed back stack (app exited); BUG-002 same in QR scan.
- **797 tests pass after the fixes**; `flutter analyze` clean.

## 5. Known gaps vs the v5 §36 list — re-verified

| §36 claim | Actual state |
|---|---|
| LessonInstance missing | **Implemented** (`attendance_session_service`, session lifecycle, lesson-based attendance) |
| Saved Reports persistence | **Implemented** (`report_repository`, ReportRecord collection) |
| Revenue date filtering | **Implemented** (`revenue_report_page.dart`, date-range query) |
| Auth fail-closed | **Implemented** (P1-04: unknown role → lowest privilege; P2-04 route guard fix) |
| Strong password hashing | **Implemented** (Argon2id + per-account salt; v0 sha256 legacy auto-migrates on login) |
| Android release keystore | **Present** (`android/key.properties` + `app/m_edu-release.jks`) — release APK builds |
| Phase 2 uncommitted | **193 uncommitted files** — still uncommitted (see GAPS-G1) |
| Face enrollment | **Implemented** (`face_enroll_page.dart`, revoke workflow) |
| Hikvision adapter | **Implemented** (RTSP config + camera_stream_service adapter) |
| Firebase sync | **Implemented as engine**; runs offline-first when no config present (by design) |
| Three separate apps | **NOT done** — single app with role-based shell (see DECISIONS-D1) |
| Liveness / anti-spoofing | **Implemented** (GAPS-G5: blink state machine + EAR geometry, ML Kit + TFLite; 13 unit tests) |
| Sync conflict handling | **Version-conflict detection + blocked-queue** implemented; **admin review/resolution UI** added 2026-08-17 (GAPS-G4) |
| Liquid Glass v3.1 tokens | **Migrated** 2026-08-17 — brand `#4A6CF7`, v3.1 neutrals/glass/shadows/blur; module + camera tokens (DECISIONS-D12) |

## 6. What needs work (short list)

1. Commit the 193 uncommitted files (Phase 2+3 stabilization + this session's
   token migration) in logical units (GAPS-G1).
2. G3 live-QA completion: release-APK on-device regression, face/liveness live
   test, offline/sync live test, frame/memory profiling (device disconnected).
3. CI quality gates (GAPS-G6 — none exist).
4. P3 UI findings from live QA (GAPS-G8: keyboard auto-scroll, bottom safe-area).
5. Students-list pagination if measurement demands (GAPS-G7, decision D7).
