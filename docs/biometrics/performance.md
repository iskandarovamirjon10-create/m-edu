# M-EDU — Biometrics: Performance

## WHAT

Measured latency, memory and scaling posture for the face pipeline — plus the
calibration strategy for thresholds.

## WHY

"Face recognition is fast" is not a claim without measurement. The target is
**sub-2-second end-to-end recognition** on defined hardware — measured, not
asserted.

## Current instrumentation

- **Query budgets**: `test/integration/query_performance_bench_test.dart`
  (10k-row corpus): `countAll` 0 ms, `findPage(100)` @ offset 5000 = 3 ms,
  full scan 20 ms, 5-page browse 8 ms — budgets fail on regression.
- **Calibration harness**: `tool/calibrate_face_thresholds.dart` +
  `test/integration/face_calibration_live_test.dart` compute EER / FAR / FRR
  from a real corpus (`test_data/calibration`, gitignored, consented +
  pseudonymous). No corpus → **NOT BENCHMARKED** (no fake scores).
- **Frame pipeline**: per-frame allocation is bounded (one reusable scratch
  file; JPEG header-only dimension read; no double full decode).

## What is NOT yet measured (honest)

- End-to-end recognition latency (camera frame → decision) on-device:
  **pending** — requires a real device + calibration corpus (GAPS-G3).
- Sustained FPS / memory / CPU on Android and Windows: **pending** real-device
  profiling (gfxinfo/meminfo).
- Gallery scale benchmark (100 → 10k students) with the current linear
  matcher: **pending**. The matcher is O(N) cosine per frame; fine at
  private-center scale (<2k), revisit with an index if growth demands it.

## Threshold calibration strategy (§15)

1. Build a corpus: same-person and different-person samples across lighting,
   pose, glasses, camera differences.
2. Measure FAR / FRR / EER; pick match/ambiguous thresholds from the
   empirical distribution, not from intuition.
3. Record: threshold, model version, dataset version, camera conditions,
   date. `BiometricPolicy.withMatchThresholds` carries the result into the
   app (settings-backed values flow into `biometricPolicyProvider`).

## Where thresholds live

Every tunable value is in `BiometricPolicy` (name, unit, purpose, default,
validation, tests). No magic numbers in page/controller code.
