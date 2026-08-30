# M-EDU — Biometrics: Recognition

## WHAT

1:N face identification with uncertainty handling, driving attendance.

## WHY

- Attendance needs "who is this?" — not "is this person X?".
- A single frame can flicker between candidates (lighting, motion, noise).
  One-frame decisions cause false accepts.

## HOW — decision pipeline (`FaceScanController`)

For every analyzed frame (`FaceScanFrameEvent`):

1. **Liveness gate** — matching only after blink liveness passes
   (`LivenessStatus.live`). Timeout → session reset (photo/screen replay
   rejected).
2. **Matching** — `FaceMatcher` over the encrypted enrolled gallery:
   - score < `ambiguousThreshold` → **UNKNOWN** (chain reset);
   - best vs second-best margin < `marginThreshold` (both confident) →
     **AMBIGUOUS** (chain reset, never forced);
   - confident single candidate → temporal consensus.
3. **Temporal consensus** (`TemporalConsensusTracker`):
   - the same unambiguous candidate must be confirmed on
     `requiredStableFrames` (default 3) consecutive live frames within
     `temporalWindow` (default 10 s);
   - any UNKNOWN / AMBIGUOUS / no-face / rejected / different-candidate
     frame resets the chain — `A,B,A` never identifies.
4. **Cooldown** (`recognitionCooldown`, default 15 s): after confirmation,
   the same identity is not re-recorded until the cooldown elapses
   (duplicate-attendance prevention on top of the DB-level idempotency in
   `RecordAttendanceCommand`).
5. **Attendance** — the page's `FaceAttendanceWriter` runs the guard
   (active identity + student in active lesson group) and
   `RecordAttendanceCommand` (check-in/check-out/duplicate). The attendance
   domain is the only writer.

## State machine (sealed, §43)

`Idle → Starting → Watching → FaceDetected → (liveness) → Confirming →
Identified | Unknown | Ambiguous | MultipleFaces | QualityRejected | Failed`

Each state is a sealed class in `face_scan_state.dart` — no boolean soup.

## Stale-result protection (§42)

Every frame increments a sequence; async match/attendance results are
discarded unless they still belong to the current frame/identification
(`_isCurrent`, `_identificationToken`). Frame B can never be overwritten by a
late Frame A result.

## Unknown vs Ambiguous (§46)

- **Unknown** — no candidate passes the policy. UI: "Bu yuz ro'yxatga olingan
  shaxslarga mos kelmadi".
- **Ambiguous** — candidates are too close. UI: "Yuz bir nechta shaxsga
  o'xshaydi — noaniq".
Both are safe rejections; attendance is never forced.

## Failure taxonomy (§34)

`face_recognition_error.dart`: camera permission/unavailable, no face,
multiple faces, quality insufficient, pose invalid, liveness failed,
embedding failed, gallery unavailable, ambiguous, unknown, timeout, storage
unavailable, model unavailable, unsupported platform — each with a
user-safe message and `Failure` mapping. No raw stack traces reach the UI.
