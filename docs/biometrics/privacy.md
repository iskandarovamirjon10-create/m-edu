# M-EDU — Biometrics: Privacy

## Principles

M-EDU serves education centers, potentially involving minors. Privacy is a
first-class engineering requirement:

1. **Data minimization** — collect only what the pipeline needs; persist
   only the protected template, never raw captures.
2. **Local processing** — detection, liveness, embedding and matching are
   fully on-device/offline. No third-party cloud face API.
3. **Encryption** — templates are AES-256-GCM at rest.
4. **No telemetry** — no hidden analytics; no face images/embeddings leave
   the device. Observability is metadata-only.
5. **Controlled deletion** — revoke/delete removes the biometric record
   only, preserving all non-biometric history.

## What is stored (allow-list)

| Data | Where | Notes |
|---|---|---|
| Encrypted face signature | Isar `FaceRecord.encryptedSignature` | AES-256-GCM, key in secure storage |
| Sample count / source / timestamps | `FaceRecord` | metadata |
| Recognition attempt metadata | `RecognitionAttemptRecord` | outcome, identityId?, confidence, duration, source, timestamp — **no vectors** |

## What is never stored

- raw face images, camera frames, screenshots, debug dumps;
- plaintext embeddings;
- liveness frames;
- biometric data in logs / analytics / sync payloads.

## Sync

Biometric data is **not synced**. The sync engine carries attendance events
only. Template is device-local by design (documented ADR behavior).

## Deletion

`RevokeFaceIdentity` / `deleteFace` deletes the face record only. The
student account, attendance history, payments and audit history are never
touched. Retention-policy automation (scheduled cleanup) is a deployment
decision not yet automated.

## Testing

Synthetic/consent-authorized fixtures only — real student biometric data is
never committed (see `testing.md`).
