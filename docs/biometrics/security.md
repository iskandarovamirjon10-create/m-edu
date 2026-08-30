# M-EDU — Biometrics: Security

## WHAT

Threat model and mitigations for the face identity subsystem.

## Data protection (at rest)

- Face signatures (embeddings) are **encrypted with AES-256-GCM**
  (`FaceEncryptionService`); the key lives in `flutter_secure_storage`
  (Android Keystore-backed), never in source code.
- Legacy plaintext records migrate to ciphertext on first read and are
  wiped.
- **No raw face images, camera frames, screenshots or debug dumps are
  persisted.**
- **No embeddings/vectors in logs, analytics, Crashlytics, event payloads or
  user-facing errors.**

## Threat model & mitigations

| Threat | Mitigation |
|---|---|
| Stolen device / DB copy | AES-256-GCM at rest; key in secure storage, not extractable with the DB |
| Template extraction | ciphertext only; `FaceEncryptionService` key never leaves the device |
| Unauthorized enrollment/re-enrollment | `RegisterFaceCommand` → `Permissions.require(faceIdUse)` (application layer, fail-closed) |
| Debug logging leakage | `AppLogger` redaction; recognition audit records carry metadata only |
| Printed photo / screen replay | blink liveness gate (see `liveness.md`) |
| Replayed frames / camera substitution | not fully addressed — camera source is authenticated by config only; documented residual risk |
| Template replacement | one template per identity (`identityId` unique); overwrite is an authorized re-enrollment |
| Model replacement | embeddings are version-keyed; mismatched versions never compare (`FaceEmbedding.versionKey`) |
| Sync manipulation | biometric data is never synced; only attendance events go through the sync engine |
| Malicious APK modification | out of scope of the app layer; standard Android signing/verification applies |

## Enrollment authorization & audit

- Enrollment is a **privileged command**, not a side effect of recognition.
- Audit timeline records who/what/when (identity activity), **never raw
  biometric payloads**.
- Revocation (`deleteFace` via identity detail) removes only the biometric
  record — student account, attendance and audit history are untouched.

## Honest limits

Perfect security is not claimed. Highest-priority open items: challenge-
response liveness (video replay), camera-substitution detection, and
per-deployment retention-policy enforcement.
