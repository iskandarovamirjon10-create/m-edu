# M-EDU — Biometrics: Liveness / Anti-Spoofing

## WHAT

Passive blink-based liveness to distinguish a live person from a static photo
or screen replay.

## WHY

A printed photo or a phone-screen image never blinks. For an attendance gate
the main spoof risk is presentation of a static face; blink liveness rejects
that class with no user annoyance (no challenge-response prompts).

## HOW

`LivenessService` (pure Dart, unit-tested) is a blink state machine with
hysteresis:

- each frame feeds `eyeOpenness` (0..1) —
  - ML Kit: `eyeOpenProbability` (classification enabled);
  - TFLite FaceMesh: EAR from canonical eye landmark sets, normalized.
- OPEN/CLOSED transitions use hysteresis (`closedThreshold` / `openThreshold`)
  to ignore noise;
- a blink is counted when the closed period is within
  `minBlinkDuration`…`maxBlinkDuration`;
- after `requiredBlinks` (default 2) blinks within `window` (default 8 s) →
  **live**;
- window expiry without enough blinks → **timedOut** → session reset.

Recognition and enrollment both run matching only after `live`.

## What it does NOT claim

This is **passive** liveness. It does **not** defeat:

- high-quality **video replay** of a live person (documented residual risk,
  DECISIONS-D6);
- sophisticated deepfake/replay with rendered blink motion.

Full challenge-response (random action prompts, head movement) is deferred
until a deployment requires it. The UI never claims "secure against all
spoofing".

## Configuration

All parameters come from `BiometricPolicy` (`livenessRequiredBlinks`,
`livenessWindow`) → `faceLivenessConfigProvider`. Values are engineering
defaults, **not empirically calibrated** — see `performance.md` and
`tool/calibrate_face_thresholds.dart` for the calibration strategy.
