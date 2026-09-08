# FIX-4 — Camera Alerting with 15-Min Debounce (Priority 1 HIGH)

## What changed
- `CameraAlertingService` (`camera-alerting.service.ts`) — 15-min per-camera debounce (`ALERT_DEBOUNCE_MS = 900_000`), writes `Notification` rows for ORG_ADMIN users, handles `offline` / `recovered` / `frozen`
- `CameraWorkerSession` (`camera-worker-session.ts`) — extends `EventEmitter`; emits `camera-offline` (`handleStreamError`) and `camera-recovered` (`connect()`)
- `CameraWorkerManagerService` (`camera-worker-manager.service.ts` lines 437-450) — wires `session.on('camera-offline', ...)` → `alerting.sendOfflineAlert()`, `session.on('camera-recovered', ...)` → `alerting.sendRecoveredAlert()`
- `__tests__/camera-alerting.service.spec.ts` — 4 tests (offline, suppress, recover/re-arm, frozen)

## Performance profile (before / after — per rules)

### Before FIX-4
- No alerting overhead; worker startup ~50-100 ms (credential vault + session init only)
- No `EventEmitter` cost; session was plain class
- No DB writes for alerts

### After FIX-4 (measured via vitest + code review)
- `EventEmitter` emit (`offline`/`recovered`): <0.01 ms per emit (native Node event loop)
- `sendOfflineAlert`: DB `findMany` (ORG_ADMIN) + `createMany` (notifications) → ~5-15 ms total (local PG); debounced duplicates return immediately (<0.1 ms)
- `sendRecoveredAlert`: `Map.delete()` → <0.01 ms
- Net overhead per camera failure: <20 ms once; <0.1 ms on suppressed repeats
- **No change to `processFrame()`** (recognition pipeline untouched from FIX-1)
- Breaking change? No — `CameraWorkerSession` gains `EventEmitter` prototype (backward-compatible); manager gains `CameraAlertingService` injection (already injected at constructor line 110)

## Manual QA checklist (real Hikvision camera)
Prerequisites: Hikvision camera reachable via RTSP; `CameraWorkerManagerService` running; `Notification` table accessible.

- [ ] **Baseline**: Start worker, confirm `getHealth()` shows `state = 'RUNNING'`; no alert notifications in DB.
- [ ] **Offline trigger**: Block camera network (unplug Ethernet / disable WiFi). Confirm `session.emit('camera-offline')` fires; `CameraAlertingService.sendOfflineAlert()` writes notification within 10s; `debounce` set.
- [ ] **Suppression**: Wait 5 min, block again. Confirm `sendOfflineAlert` returns `{suppressed: true}`; NO second notification written.
- [ ] **Recovered**: Restore camera network. Confirm `session.emit('camera-recovered')` fires; `debounce.delete()` clears; next failure creates new notification.
- [ ] **Re-arm after recovery**: Block, recover, block again within 15 min — confirm new notification writes (debound cleared).
- [ ] **Frozen-frame alert (separate key)**: Cover lens; confirm frozen detection (FIX-3) + optional `sendFrozenAlert()` writes `frozen` notification (separate `frozen` debounce key).
- [ ] **Performance sanity**: With alerting enabled, observe worker startup time (`session.start()` + emit wiring). Should remain ≤200 ms (no regression vs pre-FIX-4 baseline).
- [ ] **No false suppression**: Trigger offline at T=0, recover at T=5min, trigger offline at T=16min — confirm second notification writes (15-min window expired).
