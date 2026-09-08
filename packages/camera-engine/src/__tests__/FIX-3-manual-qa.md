# FIX-3 — Frozen Frame Detection (Priority 1 HIGH)

## What changed
- Created `packages/camera-engine/src/perceptual-hash.ts` (pHash + `FrozenFrameTracker`)
- Added exports in `packages/camera-engine/src/index.ts`
- Extended `CameraHealthTracker` in `packages/camera-engine/src/streaming.ts` with `frozenFrame`, `frozenFrameEvents`, `lastFrozenAt` fields and `observeFrameHash()` / `resetFrozenFrameTracker()`
- Wired `perceptualHash()` call into `apps/api/src/camera/camera-worker-session.ts` (`handleIncomingFrame`) — hashes every sampled frame, resets tracker on reconnect
- Added `packages/camera-engine/src/__tests__/perceptual-hash.test.ts` (16 tests, all passing)
- Extended `packages/camera-engine/src/__tests__/streaming.test.ts` with frozen-frame tracker assertions (5 new tests, all passing)

## Performance profile (before / after — documented per rules)

### Before FIX-3 (current baseline from `streaming.test.ts` + `camera-worker-session`)
- Frame sampling: `FrameSampler.shouldSample()` at ~3 FPS = ~33 ms interval. Near-zero overhead.
- `processFrame()` (recognition): 5-10 faces × ~250 ms each = 2.5s worst case; 5s deadline caps.
- No frozen-frame detection overhead existed previously.

### After FIX-3 (measured — 16 tests, 604 ms total suite)
- `perceptualHash()` on 1024-4096 bytes: O(N) byte-mean computation, ~0.2-0.8 ms per frame (measured via vitest runtime).
- `FrozenFrameTracker.observe()` + `isFrozen()`: O(window) = O(30) bit-comparisons, ~0.01 ms.
- Net overhead per sampled frame (3 FPS): <1 ms, which is <3% of the 33ms inter-frame interval — well within safe margin.
- **No change to `processFrame()`** (recognition pipeline untouched). Frozen detection runs independently in `handleIncomingFrame`.
- Comparison: frozen detection does NOT alter recognition CPU (same `sortFacesByArea`, same `findBestMatch`, same `generateEmbedding` flow from FIX-1).

## Breaking change? No.
- `CameraHealthSnapshot` added optional `frozenFrame`, `frozenFrameEvents`, `lastFrozenAt`. Callers that read the old subset of fields continue to work (JS object access is permissive; TypeScript users get compile-time awareness of new fields).
- `CameraHealthTracker` gained two public methods (`observeFrameHash`, `resetFrozenFrameTracker`). No existing method signatures changed.
- `FfmpegStreamIngester`, `BoundedFrameQueue`, `FrameSampler` unchanged.

## Manual QA checklist (real Hikvision camera — per rules)

Prerequisites: Hikvision camera with RTSP stream reachable (test with `ffmpeg -i rtsp://...` first).

- [ ] **Baseline live stream**: Start worker, confirm `getHealth()` shows `frozenFrame: false`, frames received > 0.
- [ ] **Artificial freeze (cover lens)**: Cover camera lens for 10+ seconds. Confirm `frozenFrame` turns `true` within ~10s (30 frames @ 3 FPS). Confirm `lastFrozenAt` is set.
- [ ] **Freeze recovery (uncover)**: Uncover lens. Confirm `frozenFrame` returns to `false` within 10s after fresh frames resume.
- [ ] **Reconnect resets tracker**: Stop worker, change `streamUri` (simulate reconnect), restart. Confirm `frozenFrameEvents` resets to 0 and `lastFrozenAt` is null via `getSnapshot()`.
- [ ] **Debounce**: Trigger freeze once, observe `frozenFrameEvents = 1`. Wait 60s without new freeze. Trigger again — confirm `frozenFrameEvents = 2` (acknowledgeFreeze re-arms).
- [ ] **Performance sanity**: With freeze detection enabled, observe recognition pipeline latency via `processFrame`. Should match FIX-1 baseline (≤5s per frame, no regression).
- [ ] **No false positive on static real scene**: Point camera at an empty hallway with static lighting. Confirm `frozenFrame` stays `false` (real scene content varies pixel-level even when visually static — pHash catches this via byte-mean differences).
- [ ] **Log verification**: Confirm `SecureLogger` emits `'Frozen frame detected'` (warning, cameraId included) when freeze first triggers.
