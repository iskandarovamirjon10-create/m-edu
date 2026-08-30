# M-EDU — Biometrics: Hikvision Integration

## WHAT

Hikvision is an **infrastructure adapter** behind the camera abstraction —
not a dependency of the biometric engine.

## WHY

The recognition pipeline must not care whether frames come from an Android
camera, a Windows webcam, a Hikvision RTSP stream or a test fixture. Hikvision
is a deployment choice; the engine consumes a standardized JPEG frame stream.

## HOW

```
HikvisionCameraConfig (IP/port/user/password/channel/RTSP path)
  → RTSP open + screenshot grab (CameraStreamService, media_kit)
  → ISAPI snapshot fallback (SnapshotService)
  → FaceScanCameraDriver loop → FaceVisionEngine.analyze(jpeg)
```

- `HikvisionCameraConfig` — validated config value object; incomplete config
  fails fast with an actionable message (FACE-01 fix), never half-built URLs.
- `CameraStreamService` — media_kit player; 10 s open timeout; screenshot as
  JPEG. `autoDispose` provider closes the player when the page closes.
- Snapshot fallback (ISAPI) kicks in when RTSP yields no frames.
- No Hikvision SDK calls in `face_scan_page.dart`, domain, attendance or
  student modules.

## Camera identity

The pipeline is already source-agnostic: `FaceScanController.cameraSource`
labels results ('hikvision' | 'device' | 'test') and recognition attempt
records store it. Multi-camera (entrance/classroom/reception) is a
configuration concern, not an engine change.

## Failure handling

- open timeout → snapshot fallback → 15 consecutive failed frames →
  bounded reconnect (1s→2s→4s→8s→16s, max 5) → manual retry UI.
- Camera unavailable never blocks attendance: manual + QR flows continue
  (documented D5).

## Future adapters

`DahuaAdapter` / `ONVIFAdapter` / `LocalCameraAdapter` slot behind the same
`CameraStreamService`-level abstraction (DECISIONS-D11).
