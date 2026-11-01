# M-EDU — Known Issues & Technical Debt Tracker

| Issue ID | Module | Severity | Description | Target Resolution Phase |
| :--- | :--- | :---: | :--- | :---: |
| **SEC-001** | `AdminModule` | P0 | `AdminService.getAccessRequests` lacks `organizationId` filter; `@Roles('SUPER_ADMIN')` on controller allows educational center directors to view platform-wide access requests. | Phase 1 |
| **SUB-001** | `Subscription` | P0 | `Subscription` table is dormant with no service, controller, or server-side quota checks. | Phase 3 & 4 |
| **CAM-001** | `CameraModule` | P1 | RTSP FFmpeg child processes spawn in-process inside NestJS API server. | Phase 9 |
| **BIO-001** | `FaceModule` | P1 | Biometric engine falls back silently to SHA-256 byte projection when native ONNX runtime is absent. | Phase 8 |
| **TST-001** | `LeadsModule` | P2 | `leads.convert` test failure in `response-serialization.spec.ts` due to mock configuration. | Phase 13 |
| **TST-002** | `AiTools` | P2 | `tool-catalog.spec.ts` test assertion mismatch (18 actual tools vs 16 expected in static test list). | Phase 13 |
