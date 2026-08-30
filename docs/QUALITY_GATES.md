# M-EDU — QUALITY_GATES (updated 2026-08-17)

Every milestone (feature, fix, refactor, release candidate) must pass the gates
below **before it is declared done**. Gates are commands + evidence — never
assumptions.

## 0. Per-change gate (always)

```bash
dart format --set-exit-if-changed lib test integration_test
flutter analyze          # must be: No issues found
flutter test             # must be: All tests passed (797 pass / +1 skip, 2026-08-17)
```

- No new P0/P1 defects introduced (GAPS/RISK_REGISTER update if any).
- No hardcoded colors/secrets/demo data (D12 policy; §5 anti-patterns).
- No dead buttons / "Coming soon" / TODO production paths.
- Files < 300–400 lines where practical (§54).

## 1. Security gate (§58)

Checklist — run before any release:

- [ ] No authentication bypass (session TTL, deactivation invalidation tested)
- [ ] No authorization bypass (RBAC deny-by-default; unknown role → lowest privilege)
- [ ] No privilege escalation (command-level `Permissions.require`)
- [ ] Password hashing = Argon2id (no new plain/sha256 records)
- [ ] No hardcoded secrets / API keys in `lib/` (logger redaction verified)
- [ ] No biometric raw data persisted or logged; embeddings encrypted
- [ ] No unauthorized export (permission boundaries respected)
- [ ] Firestore rules fail-closed (unit-tested: `firestore_rules_test.dart`)

## 2. Data-integrity gate (§25, §29, §61)

- [ ] Critical ops transactional / idempotent (payments, attendance, enrollment)
- [ ] Migrations additive + backup + verify; fresh-install AND upgrade paths tested
- [ ] Corruption-resilience tests pass (corrupt records skipped, no crash)
- [ ] Sync: deterministic IDs, version conflict detection, no silent loss,
      admin resolution path (G4/D13)

## 3. UX gate (§52, §56)

Every important screen supports: loading · success · empty · error · offline ·
permission-denied · retry. No raw exception traces to users.

## 4. Release gate (§59, §60)

```bash
dart format .
flutter analyze
flutter test
flutter build windows        # where supported
flutter build apk --release  # must use prod keystore (CN=M-Edu), never debug fallback
```

- On-device regression: `integration_test/live_qa_test.dart` + face/offline/sync
  live checks + logcat watch (G3).
- Cold/warm start within prior baseline; no FATAL/exceptions in logcat.

## 5. Final v5 gate (§87 — current status)

| Criterion | Status |
|---|---|
| No P0 issues | ✅ (none open — see RISK_REGISTER) |
| No unresolved critical P1 | ✅ (G1 process item open — not product defect) |
| No fake production workflows | ✅ (policy verified; no demo data) |
| No hardcoded secrets | ✅ |
| Strong password hashing | ✅ Argon2id |
| Fail-closed authorization | ✅ |
| LessonInstance implemented | ✅ |
| Attendance lesson-based | ✅ |
| Saved reports persistent | ✅ |
| Revenue date filtering correct | ✅ |
| Face enrollment real | ✅ |
| Liveness real | ✅ (blink; video-replay residual documented) |
| Recognition real | ✅ (on-device live test pending — G3) |
| QR real | ✅ (signed QR, Ed25519) |
| RFID | ⏳ hardware absent — adapter deferred (D9), not faked |
| Hikvision integration real | ✅ (RTSP adapter; live test pending) |
| Camera failure fallback works | ✅ (manual/QR continue) |
| Offline mode works | ✅ (verified live) |
| Sync works | ✅ (engine) |
| Conflict handling works | ✅ (detection + admin retry/discard, D13) |
| Payments persistent | ✅ |
| Reports persistent | ✅ |
| Admin/Teacher/Student apps | ⏳ single RBAC app (D1) |
| Android release build verified | ⏳ APK builds signed; on-device regression pending (G3) |
| Windows build verified | ⏳ not run this session |
| Database migrations verified | ✅ (fresh + upgrade tested) |
| Critical tests pass | ✅ 797 pass |
| Security audit pass | ✅ (checklist above) |
| Performance audit | ⚠️ partial (formal frame metrics pending G3) |
| UX audit | ⚠️ P3 items open (G8a/G8b) |
