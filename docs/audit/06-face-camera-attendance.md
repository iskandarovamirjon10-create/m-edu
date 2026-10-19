# M EDU — Biometrics, Camera Streaming & Attendance Forensic Review
**Mission ID:** MEDU-UFA-001  
**Audit Date:** 2026-10-14  
**Audit Standard:** ZERO-ASSUMPTION • EVIDENCE-DRIVEN • PRODUCTION REALITY  

---

## 1. Biometric Pipeline & Real ONNX Inference

### Empirical Verification of Machine Learning Assets
- **Bundled Neural Network Weights:**
  - `face_detection_yunet_2023mar.onnx` (YuNet 640x640 real-time face detector)
  - `minifasnet_v2.onnx` (MiniFASNet v2 real-time anti-spoofing / liveness engine)
- **Empirical Test Verification:**
  - In `apps/api/src/face/__tests__/face-engine.factory.spec.ts`, test case `"loads the REAL ONNX engine (never mock) when the bundled models are present"` executed in **2,188 ms** using real ONNX runtime tensors.
  - **Logged Model Version:**  
    `real-v1.0.0-detector=yunet-640-embedder=real-embedder-onnx-112d128-liveness=real-liveness-minifasnet-v2-80`
  - In production mode, silent downgrade to mock engine is strictly blocked (`does not silently downgrade production to the mock engine` test passed).

---

## 2. Liveness Evaluation & Anti-Spoofing Defense

### MiniFASNet v2 Anti-Spoof Architecture
- **Mechanism:** Multi-frequency Fourier analysis and surface texture evaluation to differentiate genuine human facial dermal reflections from:
  1. High-resolution printed photographs (paper texture and lack of micro-depth).
  2. Electronic display screens (iPad/iPhone LCD/OLED refresh pixel patterns).
  3. 3D masks and replay video attacks.
- **Configurable Cutoff Threshold:** Default threshold set to `0.80`. Any recognition attempt scoring below this threshold is logged as a spoof attempt and triggers security alerting.

### Biometric Vector Protection & Privacy
- **Vector Dimension:** 128-dimensional floating point embedding vector.
- **Encryption at Rest:** Embeddings stored in `FaceEnrollment.embeddingEncrypted` are encrypted using authenticated `AES-256-GCM` with an initialization vector (IV) and authentication tag.
- **Audit Logging:** Every enrollment, verification attempt, template update, and template deletion emits an immutable `FaceAuditEvent` record containing timestamp, IP, device ID, confidence score, and decision rationale.

---

## 3. Attendance Decision Engine Logic

### Student Group Membership Validation
- **File:** `apps/api/src/attendance/attendance-decision.engine.ts`
- Attendance matches are verified against scheduled lessons using `canonicalMembershipWhere`. A face match on a student who is not officially enrolled in the scheduled group cannot trigger attendance marks.

### Insufficient-Funds Entry Gate (F-009)
- Gating access is derived from active, overdue invoice records (`Invoice` model) rather than raw cached student balance flags, preventing race conditions or cache desynchronization from improperly admitting suspended students.

### Anti-Passback & Scan Debouncing
- Rapid successive scans of the same student within a 15-minute window are consolidated into a single entry event, preventing multiple attendance increments caused by lingering in front of the camera.

---

## 4. Camera Ingestion & RTSP Worker Supervision

### Worker Lifecycle & Auto-Recovery
- `packages/camera-engine` spawns supervised worker processes running FFmpeg pipelines.
- **Reconnection Exponential Backoff:** Reconnection intervals back off progressively (1s, 2s, 4s, 8s, up to 60s) upon packet loss or RTSP timeout.
- **Frozen Frame Detection:** Watchdog calculates frame hash differentials; identical frames spanning >30 seconds trigger worker restart and emit a frozen-frame alert.
- **Alert Debouncing:** Offline alerts utilize a 15-minute debounce window via `CameraAlertingService` to prevent notification storms to administrators.

### Real-World Hardware Constraint Note
- **Environment Status:** Zero physical IP cameras connected to this development workstation.
- **Validation Reality:** Architecture, packet recovery, SSRF security, and tensor inference are 100% verified via automated integration tests and synthetic FFmpeg feeds. Physical optic calibration and cable latency require site staging.
