# M-EDU — GAPS (verified 2026-08-17)

Severity: **P0** crash/data loss/security · **P1** major workflow broken ·
**P2** significant UX/performance · **P3** minor. Each gap lists location,
impact, root cause, proposed fix, test requirement.

---

## G1 — Phase 2+3 work uncommitted (191 files) — P1 (process/risk)

- **Location**: entire working tree (103 changed files, +3,973/−2,137).
- **Impact**: no audit/rollback trail; a bad change cannot be bisected; the
  v5 §39 "commit-ready" state is unmet.
- **Root cause**: work accumulated across sessions without commits.
- **Proposed fix**: after the current live-QA fixes are re-verified on device,
  commit in logical units (QA fixes → tooling → docs).
- **Test**: `flutter analyze` = 0 + full `flutter test` before commit.

## G2 — Back navigation killed after push→go replacement — ✅ FIXED (was P1)

- **Location**: `identity/register` success → `context.go('/identity/:id')`
  (fixed → `pushReplacement`); `identity_scan_page.dart` QR success → same
  pattern (fixed → `pushReplacement`).
- **Impact**: Android back exited the app instead of returning to the previous
  screen (verified on device for BUG-001).
- **Root cause**: `go()` rebuilds the whole stack; `/identity/:id` is a
  top-level route outside the StatefulShellRoute.
- **Fix**: applied 2026-08-17; regression covered by
  `integration_test/live_qa_test.dart` (system-back after register must land on
  a real screen).
- **Residual**: audit other post-action `go()` calls — command palette
  (`intelligence/command_palette_page.dart:101`) and face-scan "settings"
  shortcuts (`face_scan_page.dart:487,624,813`) use the same pattern and
  deserve review (P3).

## G3 — Live-QA pending items — P2 (verification)

- **Location**: device testing.
- **Impact**: release gate (§47) not fully green: release-APK on-device
  regression, face pipeline live test, offline/sync live test, frame/memory
  profiling still pending.
- **Root cause**: physical USB link dropped mid-session.
- **Proposed fix**: reconnect device → run release APK → re-run
  `integration_test/live_qa_test.dart` → face/liveness checks → gfxinfo/meminfo.
- **Test**: `flutter drive` suite (already written) + logcat watch.

## G4 — Sync conflict strategy — ✅ FIXED (was P2 data-integrity)

- **Location**: `core/network/sync_engine.dart` (version-conflict detection +
  blocked queue), `sync_operation_datasource.dart`, `admin_diagnostics_page.dart`.
- **Impact (was)**: conflicts detectable but had no review/resolution path — an
  admin could see "X ziddiyat" in sync status but could not act on it.
- **Root cause**: engine defers conflicts (safe: no silent loss, no infinite
  retry) but the admin-review consumer was never built.
- **Fix (2026-08-17)**: `retryBlocked` (local-wins — re-queues with current
  version, clears backoff) and `discardBlocked` (remote-wins — drops local op)
  on the datasource; `blockedSyncOperationsProvider`; diagnostics page section
  lists conflict/permanent ops with per-item actions + discard confirmation
  (route-gated `settingsView`). Resolution is ALWAYS an explicit admin decision
  (DECISIONS-D13) — never automatic for financial/attendance data.
- **Tests**: `test/unit/sync_conflict_resolution_test.dart` — 5 tests (blocked
  list, retry→pending with cleared backoff/version, discard→deleted, permanent
  handled, non-blocked no-op).
- **Residual**: sync torture tests (1/10/50 offline ops → reconnect →
  exactly-once) still pending (P2).

## G5 — Face liveness / anti-spoofing — ✅ FIXED (was P1 security)

- **Location**: `features/face_recognition/` — now:
  - `domain/services/liveness_service.dart` — blink state machine (hysteresis,
    blink window, min/max blink duration) + EAR geometry helpers;
  - `face_vision_engine.dart` (ML Kit) — `enableClassification: true` →
    `eyeOpenProbability` (0..1) per frame;
  - `tflite_face_vision_engine_io.dart` (TFLite FaceMesh) — EAR from canonical
    eye landmark sets [362,385,387,263,373,380] / [33,160,158,133,153,144];
  - `face_scan_page.dart` + `face_enroll_page.dart` — recognition/enrollment
    only after liveness passes; photo-replay (no blink) → rejected with UI
    feedback; timeout → session reset for retry;
  - `face_recognition_providers.dart` — `faceLivenessConfigProvider`.
- **Impact**: static photo / screen replay no longer passes recognition or
  enrollment. Residual risk: high-quality video replay (documented, D6 —
  challenge-response deferred).
- **Tests**: `test/unit/liveness_service_test.dart` — 13 tests (blink counting,
  photo-replay timeout, too-short/too-long closures, hysteresis, window
  pruning, config, EAR geometry). Full suite: **797 tests pass**, analyze 0.
- **Follow-up**: settings UI toggle (config provider ready — one-line Switch).

## G6 — No CI quality gates — P2 (process)

- **Location**: repo root (`.github/workflows` absent).
- **Impact**: v5 §35 unmet — analyze/test/build/security gates are manual.
- **Proposed fix**: GitHub Actions: format → analyze → test → build debug →
  build release (key.properties secret) on PR/main.
- **Test**: pipeline green on a sample PR.

## G7 — Students list without pagination — ✅ FIXED 2026-08-17

- **Fix**: browse mode (no search/filter) now loads **paged** —
  `IsarStudentDataSource.findPage(offset, limit)` (Isar `offset().limit()`,
  `enrolledAt`↓), `countAll()` via Isar `count()` (no full-table read),
  and `IsarIdentityDataSource.findByIds` (`anyOf` list filter) so only the
  visible page's identities load. Infinite scroll in
  `students_list_page.dart` appends pages (100/page); search/filter mode
  keeps full-load (cross-field matching needs the set) with 180ms debounce.
- **Test**: `test/integration/student_list_scale_test.dart` — 1,000-row
  synthetic dataset: count exact, page window correctness, page ordering,
  boundary page, by-ids identity fetch. 6 tests green.

## G8 — P3 visual/UX findings from live QA

- **G8a** — Forms do not auto-scroll the focused field above the keyboard;
  submit buttons land behind the IME (register, identity-register). Pages:
  `auth/register_page.dart`, `identity/register_identity_page.dart`,
  `payments/new`. Fix: `Scrollable.ensureVisible` on focus / `ScrollPadding`.
- **G8b** — Some list bottoms reach the screen edge with no bottom safe-area
  padding (identity profile "Ma'lumotlar", student detail "Davomat" row):
  content can sit under the gesture bar. Fix: bottom `SafeArea`/padding on
  those ListViews.
- **G8c** — Android 16 16 KB-page-size system warning on first launch after
  install (native libs: isar, tflite, mpv, media_kit not aligned) — device-level
  informational dialog, not app crash; track upstream lib alignment.

## G9 — Three separate applications (Admin/Teacher/Student) — DECISION (D1)

Not a code gap yet — see DECISIONS-D1. Single RBAC app currently satisfies
permission separation; separate apps are a delivery decision.

---

## Priority order (proposed)

1. G1 commit hygiene (after on-device re-verification)
2. ~~G5 liveness (security)~~ ✅ fixed 2026-08-17
3. G3 live-QA completion (release gate — device disconnected)
4. ~~G4 conflict resolution UI~~ ✅ fixed 2026-08-17 (D13); torture tests remain
5. ~~G6 CI~~ ✅ fixed 2026-08-17 (`.github/workflows/ci.yml`)
6. G8 P3 UX fixes
7. ~~G7 pagination~~ ✅ fixed 2026-08-17 (paged browse + scale test)
7. G7 pagination

## G9 — Performance budgets (Phase 17) — ✅ MEASURED 2026-08-17

- **Before**: no formal frame/memory/query measurements (audit P3 #10).
- **Now**: `test/integration/query_performance_bench_test.dart` — 10,000-row
  synthetic corpus, warm-up + measured:
  - `countAll(10k)` = **0ms** (Isar `count()`, no full scan)
  - `findPage(100)` @ offset 5000 = **3ms**
  - `findAll(10k)` full scan = **20ms** (pagination yukini solishtirish)
  - realistic 5-page browse = **8ms** — to'liq skan bilan teng/arzonroq,
    xotira esa 500 qator bilan cheklangan (10k o'rniga)
- **Gates**: budgets fail on regression (count<50ms, page<50ms, scan<200ms,
  browse ≤ scan+20ms). Device-side frame/memory profiling remains a
  release-gate item (G3 — device disconnected this session).
