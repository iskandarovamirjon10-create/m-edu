# M-EDU — Biometrics: Architecture

## WHAT

The biometric subsystem answers **1:N identification** ("which person is this?")
for attendance, using an offline-first, encrypted, privacy-preserving pipeline.

## WHY

- Attendance must work without internet (offline-first).
- False positives are more harmful than "I don't know" — the system must be
  able to reject safely (§58).
- Face data is sensitive (minors in education centers) — encryption, minimal
  retention and no raw-image persistence are first-class requirements.

## HOW — pipeline

```
CAMERA (Hikvision RTSP / ISAPI snapshot)
  → Frame loop (FaceScanCameraDriver, bounded reconnect, exponential backoff)
  → Face analysis (FaceVisionEngine: detection + quality gate + signature)
  → FaceScanController (application, pure Dart):
      liveness (blink) gate → matcher (threshold + margin) →
      temporal consensus (N stable frames) → cooldown →
      identity confirmed
  → FaceAttendanceWriter (attendance domain: guard + RecordAttendanceCommand)
  → RecognitionAttemptRecord (observability, metadata only)
```

## Layering (existing M-EDU rules preserved)

```
presentation → application → domain → repository → infrastructure
```

| Layer | Files | Responsibilities |
|---|---|---|
| presentation | `face_scan_page.dart` (335 L), `widgets/*`, `face_scan_camera_driver.dart`, `face_frame_mapper.dart` | camera lifecycle, composition, display |
| application | `face_scan_controller.dart`, `face_scan_state.dart`, `face_matcher.dart`, `face_attendance_guard.dart` | decision engine, policies, no Flutter/DB deps |
| domain | `biometric_policy.dart`, `recognition_state_machine.dart`, `face_recognition_result.dart`, `face_recognition_error.dart`, `liveness_service.dart`, `face_signature.dart` | pure Dart value objects/services |
| repository | `recognition_attempt_repository.dart` (interface) | metadata audit |
| infrastructure | `face_vision_engine.dart` (ML Kit/TFLite), `face_quality_gate.dart`, `face_encryption_service.dart` (AES-256-GCM), Isar models/datasources | ML, storage, encryption |

### Boundaries enforced

- **Domain has no Flutter/Isar/ML Kit imports** — `Rect`, `Uint8List`, ML Kit
  types stay in infrastructure/presentation. `FaceScanFrameEvent` (domain-safe)
  is the presentation→application bridge (`face_frame_mapper.dart`).
- **Biometric subsystem does not write attendance** — it answers "who was
  recognized"; the page's `_writeAttendance` (attendance domain via
  `RecordAttendanceCommand`) decides "should this be recorded".
- **No fake implementations in production** — real ML Kit / TFLite engines
  only; mocks exist solely in tests.

## Key abstractions

- `BiometricPolicy` — single versioned source of every threshold (§9/§55).
- `FaceScanController` — recognition state machine (§43), owns liveness,
  consensus, cooldown and stale-result protection (§42).
- `FaceScanCameraDriver` — camera lifecycle: open, grab, snapshot fallback,
  bounded auto-reconnect (§23).
- `FaceRecognitionError` — sealed taxonomy, user-safe messages (§34).

## Failure modes (summary)

Camera unavailable / permission / config-invalid → `FaceScanFailed` with
retry path. No face / multiple faces / poor quality / liveness timeout /
unknown / ambiguous → explicit UI states, never a forced identity. See
`recognition.md` and `error` taxonomy in `face_recognition_error.dart`.
