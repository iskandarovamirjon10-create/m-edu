# M-EDU — Biometrics: Testing

## WHAT

The dedicated biometric test pyramid and adversarial scenarios.

## Current test inventory (face_recognition)

| Layer | File | Covers |
|---|---|---|
| Unit | `biometric_policy_test.dart` | policy defaults, validation, calibration merge |
| Unit | `recognition_state_machine_test.dart` | temporal consensus: stable chain, A/B/A flapping, UNKNOWN/AMBIGUOUS reset, window expiry, reset |
| Unit | `face_scan_controller_test.dart` | no single-frame attendance, N-frame confirmation, flapping never identifies, NoFace reset, UNKNOWN/AMBIGUOUS, liveness gate, liveness timeout, cooldown (in/expired), stale-result discard (§42), gallery failure, attendance outcome, multiple faces, quality rejected |
| Unit | `face_scan_camera_driver_test.dart` | streaming, snapshot fallback, reconnect/recovery, max attempts → error (no infinite loop), manual retry, pause/resume (fake_async) |
| Unit | `face_recognition_error_test.dart` | taxonomy messages, Failure mapping, no raw traces |
| Unit | `recognition_attempt_record_test.dart` | Isar round-trip, corrupt outcome resilience, best-effort writes |
| Unit | `liveness_service_test.dart` | blink counting, photo-replay timeout, hysteresis, EAR geometry |
| Unit | `face_matcher_test.dart` | threshold/margin decisions |
| Unit | `face_quality_gate_test.dart` | size/light/sharpness gates |
| Unit | `face_encryption_service_test.dart` | AES-GCM round-trip, integrity, key-change rejection |
| Unit | `face_attendance_guard_test.dart` | identity/student/group gating |
| Integration | `face_calibration_live_test.dart` | real-engine calibration (gated: NOT BENCHMARKED without corpus) |
| Integration | `isar_startup_test.dart` | all schemas (incl. RecognitionAttemptRecord) open cleanly |

## Adversarial scenarios covered

No face · multiple faces · face enters/leaves · camera disconnect/reconnect ·
snapshot fallback · poor quality · liveness failure/timeout · unknown person ·
ambiguous match · repeated recognition (cooldown) · stale async result · app
restart (Isar persistence) · corrupt records · gallery failure · attendance
duplicate.

## Not yet covered (honest)

- Real-camera E2E (enroll → recognize → attendance) on device — GAPS-G3,
  needs hardware + corpus.
- Widget tests for the new face-scan UI states (camera states, liveness UI,
  failure recovery) — the page is now controller-driven, so these are
  tractable next steps.
- Multi-person classroom recognition (not built — single-person gate by
  design).

## Privacy-safe data

Tests use synthetic vectors and consented/pseudonymous corpus files
(`test_data/calibration` is gitignored). Real student biometric data is
never committed.
