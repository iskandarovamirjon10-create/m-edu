# M-EDU — ROADMAP (v5, updated 2026-08-17)

Basis: verified CURRENT_STATE + ARCHITECTURE_AUDIT + GAPS.
Phases re-ordered against v5 §40 because the audit shows most §40 phases are
already done (see Phase markers). Definition of Done = v5 §41 checklist.

## Phase 0 — Stabilization & release gate (NOW)

- [ ] **G1**: commit hygiene — commit in logical units after on-device
      re-verification (QA fixes, tooling, docs).
- [ ] **G3**: reconnect device → release APK install → regression
      (`integration_test/live_qa_test.dart`) → face + offline/sync live tests →
      `dumpsys gfxinfo`/`meminfo` → logcat watch.
- [ ] Release gate: cold/warm start, P0/P1 = 0, no critical logcat exceptions.

## Phase 1 — Security hardening (v5 §4)

- [ ] **G5**: face liveness/anti-spoofing (blink/static-frame detection) +
      unit tests + live replay test.
- [ ] Re-audit post-action `go()` call sites (G2 residual: command palette,
      face-scan settings shortcuts).
- [ ] §47 checklist run (auth bypass, privilege escalation, insecure storage,
      sensitive logs, fail-open permissions, hardcoded secrets).

## Phase 2 — Sync & conflict handling (v5 §19–20)

- [x] **G4**: conflict detection (version-based, blocked queue) — done prior;
      admin review/resolution UI (retry/discard blocked ops) — **done
      2026-08-17** (DECISIONS-D13). Remaining: sync torture tests.
- [ ] Sync torture tests: 1 / 10 / 50 offline ops → reconnect → exactly-once,
      ordering, dedup, partial failure.

## Phase 3 — UX polish (P3 findings from live QA)

- [ ] **G8a**: auto-scroll focused field above keyboard on all forms.
- [ ] **G8b**: bottom safe-area padding on identity profile + student detail.
- [ ] **G8c**: document 16 KB page-size status; track upstream native lib fixes.

## Phase 4 — Engineering practices (v5 §35)

- [ ] **G6**: CI pipeline (format → analyze → test → build debug → build
      release with keystore secret).
- [ ] **G7**: pagination if measurement demands (decision D7).

## Phase 5 — Scale-out (only if market requires)

- [ ] D1 revisit: thin Teacher/Student entry points sharing core/features.
- [ ] REST API layer on the existing application commands (v5 §43) — domain
      already HTTP-agnostic.

---

## Acceptance criteria tracker (v5 §54 — current status)

| Criterion | Status |
|---|---|
| LessonInstance production-ready | ✅ implemented (attendance session service, 797 tests green) |
| Attendance lesson-based | ✅ |
| Saved Reports persistent | ✅ |
| Revenue date filter functional | ✅ |
| Auth fail-closed | ✅ |
| Strong password hashing | ✅ Argon2id |
| Android release keystore validated | ✅ release APK built 219.2MB, signed with CN=M-Edu (prod keystore, not debug); on-device test pending |
| Phase 2 integrated and tested | ⏳ uncommitted (G1) |
| Face enrollment functional | ✅ |
| Face recognition functional | ✅ (live on-device test pending) |
| Liveness / anti-spoofing | ✅ implemented (blink detection, 13 tests) — settings toggle follow-up |
| Liquid Glass v3.1 tokens | ✅ migrated 2026-08-17 (D12) — brand #4A6CF7, glass/blur/shadow/radius per spec |
| QR functional | ✅ (scan flow verified in code; on-device camera test pending) |
| RFID functional | ⏳ decision D9 (hardware absent — adapter deferred, not faked) |
| Hikvision adapter functional | ✅ (config + RTSP stream service) |
| Offline mode functional | ✅ verified live (offline-first, no Firebase) |
| Sync functional | ✅ engine + blocked-queue review (G4 closed 2026-08-17) |
| Conflict handling | ✅ version detection + admin retry/discard (D13); ⏳ torture tests |
| Admin/Teachers/Student apps | ⏳ decision D1 (single RBAC app) |
| 50 core / 20 premium features | ⏳ inventory audit next (gamification/intelligence/CRM exist; count pending) |
| No demo data / no fake workflows / no TODO | ✅ (verified policy; sweep pending) |
| flutter analyze / test | ✅ 0 issues / 797 pass |
| Integration tests | ✅ suite written; ⏳ full green run on device |
| Android release build | ⏳ in progress |
| Windows build | ⏳ not yet run this session |
| Security / performance / UX audit | ⏳ in progress |
