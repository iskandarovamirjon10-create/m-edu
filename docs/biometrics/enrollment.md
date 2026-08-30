# M-EDU — Biometrics: Enrollment

## WHAT

Multi-sample, liveness-gated, consistency-checked face enrollment.

## WHY

A single photo is not a biometric template. Production enrollment requires
several validated samples, anti-spoofing, and same-person consistency so that
the stored template actually represents the identity — not a moment in bad
lighting or a photo replay.

## HOW (current implementation)

`face_enroll_page.dart` + `RegisterFaceCommand`:

1. Operator selects a student and opens enrollment (RBAC: `faceIdUse` —
   `Permissions.require` inside the command, fail-closed).
2. Camera config is validated up front (no half-built RTSP attempts).
3. The scan loop collects **5 valid samples** (`BiometricPolicy
   .enrollmentTargetSamples`):
   - detection (0 / 1 / 2+ faces handled explicitly),
   - quality gate (size / light / sharpness / pose),
   - **liveness gate** — a sample is only accepted after blink liveness
     passes (a static photo cannot be enrolled),
   - **same-person consistency** — each sample must be ≥
     `enrollmentMinSampleSimilarity` (0.80) cosine-similar to the first
     sample; a different person in the frame is rejected.
4. Samples are averaged (`FaceSignature.mean`) into one protected template.
5. Template is **encrypted (AES-256-GCM)** by `FaceEncryptionService` and
   stored in Isar (`FaceRecord`); plaintext is never written.
6. Audit timeline entry `faceEnrolled` is recorded (no biometric payload).

## UX language

- Progress: "Namunalar 3 / 5" with sample dots.
- Rejections are actionable: "Yuz sifati yetarli emas — yuzni yaxshiroq
  ko'rsating", "Iltimos, faqat bitta shaxs ko'rinsin", liveness blink prompt.
- Success message is meaningful: enrollment completion (not "Face saved").

## Known limitations

- A post-enrollment verification pass (matching the new template against a
  fresh live capture) is not yet a hard step — the same-person consistency
  gate plus the 5-sample requirement serve this role; a dedicated
  verify-after-enroll step is a future improvement.
- Consent/authorization flow depends on deployment policy; the command-level
  RBAC gate is the current authorization mechanism.
