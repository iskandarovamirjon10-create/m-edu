# M-EDU Face Recognition Technical Documentation

## Overview

M-EDU implements a **computer-vision-based face identification system** for attendance tracking and security workflows. This is NOT equivalent to platform biometric authentication (e.g., Apple Face ID or Android BiometricPrompt).

## Architecture

### Pipeline

```
Camera → Frame → Rotation → Face Detection → Landmarks → Bounding Box
→ Quality Gate → Pose Check → Liveness (blink) → Signature (21-dim geometric)
→ Encryption (AES-256-GCM) → Storage (Isar) → Matcher (cosine similarity)
→ Margin Check → Temporal Consensus (3 consecutive frames) → Identity
→ Attendance → Local DB → Sync
```

### Components

| Component | Location | Description |
|-----------|----------|-------------|
| `FaceSignature` | `domain/value_objects/face_signature.dart` | 21-dimensional geometric signature |
| `FaceMatcher` | `application/face_matcher.dart` | Cosine similarity + margin matching |
| `FaceScanController` | `application/face_scan_controller.dart` | Decision engine (liveness → match → consensus → identity) |
| `FaceEncryptionService` | `infrastructure/services/face_encryption_service.dart` | AES-256-GCM encryption for stored signatures |
| `FaceQualityGate` | `infrastructure/services/face_quality_gate.dart` | Brightness, sharpness, size checks |
| `LivenessService` | `domain/services/liveness_service.dart` | Blink-based temporal liveness |
| `TemporalConsensusTracker` | `domain/services/recognition_state_machine.dart` | N consecutive frame identity confirmation |
| `BiometricPolicy` | `domain/value_objects/biometric_policy.dart` | Centralized thresholds and policy configuration |

### Face Signature

- **Type**: 21-dimensional geometric vector (NOT a neural embedding)
- **Normalization**: Inter-eye distance normalization for scale invariance
- **Source**: ML Kit (Android) / TFLite (Windows) landmark detection
- **Similarity metric**: Cosine similarity
- **Safety**: NaN, Infinity, zero-vector guard in `cosineSimilarityBetween`

### Thresholds (BiometricPolicy)

| Threshold | Default | Description |
|-----------|---------|-------------|
| `matchThreshold` | 0.92 | Score above which identity is accepted |
| `ambiguousThreshold` | 0.88 | Below this → no match candidate |
| `marginThreshold` | 0.05 | Minimum gap between best and second-best match |
| `temporalConsensusFrames` | 3 | Consecutive frames required before confirmation |
| `recognitionCooldown` | 120s | Minimum time between confirmations for same identity |

**UNCALIBRATED**: Default thresholds are engineering estimates, not empirically calibrated values. Real calibration requires a genuine-pair and impostor-pair dataset.

### Liveness Detection

- **Current**: Blink-based (eye open → close → open sequence)
- **NOT equivalent to anti-spoofing** — a photo of a person with open eyes could pass
- **Limitation documented**: Liveness is a defense layer, not a security guarantee

### Temporal Consensus

Requires `N` consecutive frames (default 3) identifying the same person before confirmation. Prevents:
- Accidental single-frame matches
- Rapid identity switching
- Stale frame contamination

### Security

- **Encryption**: AES-256-GCM with unique nonces per encryption
- **Key storage**: FlutterSecureStorage (Android Keystore)
- **Privacy**: Raw face images are NOT persisted; only encrypted signatures
- **Sync**: Biometric data is NOT synced to Firestore (local-only)

### Platform Support

| Feature | Android | Windows |
|---------|---------|---------|
| Camera | ✅ Camera2 API | ⚠️ USB/RTSP/Webcam |
| Face Detection | ✅ ML Kit | ✅ TFLite (native DLL) |
| Liveness | ✅ | ✅ |
| Encryption | ✅ | ✅ |
| Enrollment | ✅ | ✅ (requires hardware) |

### Known Limitations

1. **Uncalibrated thresholds** — Default values may produce excessive false accepts/rejects in production
2. **Blink-only liveness** — Sophisticated replay attacks (video, masks) are not detected
3. **Geometric signature** — Less robust than neural embeddings against lighting, pose, occlusion
4. **Windows requires native DLL** — `libtensorflowlite_c-win.dll` must be bundled
5. **No multi-face ranking** — When multiple faces detected, the system rejects (safe default)

### Testing

Unit tests cover:
- Signature construction and NaN/Infinity safety
- Cosine similarity edge cases (zero vectors, malformed data)
- Matcher threshold and margin logic
- Temporal consensus adversarial sequences (AAB, ABA, identity switching)
- Liveness state machine
- Quality gate thresholds
- Enrollment and encryption round-trip
