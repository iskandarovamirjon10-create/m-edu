# M-EDU — RISK_REGISTER (updated 2026-08-17)

Format: **RISK · IMPACT · PROBABILITY · MITIGATION · STATUS**.
Sources: ARCHITECTURE_AUDIT findings (A1–A7), GAPS.md, live-QA, security review.
Severity: P0 crash/data-loss/security · P1 major · P2 significant · P3 minor.

| ID | RISK | IMPACT | PROB | MITIGATION | STATUS |
|---|---|---|---|---|---|
| R1 | **Biometric privacy** — face embeddings stored on-device; raw images transient | P0 (legal/trust) if leaked | LOW | Encrypted at rest (`face_encryption_service`, AES via local key); no raw images persisted; no embedding logging; consent workflow; cloud sync of biometrics forbidden by Firestore rules (tested) | ✅ Mitigated |
| R2 | **Biometric replay** — high-quality video replay of a face | P0 (security) | LOW–MED | Blink liveness (EAR/eyeOpenProbability) rejects static photo/screen replay; residual video-replay risk documented (DECISIONS-D6); challenge-response deferred | ⚠️ Residual (documented) |
| R3 | **Camera integration** — Hikvision RTSP stream failure/offline | P2 (attendance UX) | MED | `CameraService` adapter abstraction; manual + QR attendance continue (D5, verified live); diagnostics shows camera state | ✅ Mitigated |
| R4 | **Offline sync corruption** — duplicate/partial writes on reconnect | P1 (data integrity) | LOW | Idempotent deterministic operation IDs; version-gated upsert; in-flight crash recovery; exactly-once by design; torture tests still pending | ⚠️ Tests pending |
| R5 | **Sync conflicts** — two devices edit same entity | P1 (data integrity) | LOW–MED | Version conflict detection; blocked queue (no silent loss, no infinite retry); admin retry/discard UI (G4, D13) | ✅ Mitigated (2026-08-17) |
| R6 | **Financial integrity** — duplicate payments / silent overwrite | P0 | LOW | `ReceivePaymentCommand` idempotency, receipt numbers, transactional debt updates, payment sync mapper guards conflicts; 20+ command tests | ✅ Mitigated |
| R7 | **Permissions** — authorization bypass / privilege escalation | P0 | LOW | Deny-by-default RBAC; unknown role = lowest privilege; command-level `Permissions.require`; route guard via `state.fullPath` (P2-04); 20+ RBAC tests | ✅ Mitigated |
| R8 | **Weak credentials** — password compromise | P0 | LOW | Argon2id + per-account salt; legacy sha256 auto-upgrades; session TTL 30d; biometric quick-login optional | ✅ Mitigated |
| R9 | **Database migration** — schema upgrade destroys production data | P0 | LOW | Additive versioned migrations with backup + verify + report (`AttendanceSchemaV2Migration`); corruption-resilience tests; migration tests for fresh + upgrade paths | ✅ Mitigated |
| R10 | **Release signing** — silent fallback to debug keystore | P1 (deployment) | LOW | Prod keystore validated (release APK signed CN=M-Edu); `key.properties` required; fail-clear policy (§60) | ✅ Validated; ⚠️ on-device test pending (G3) |
| R11 | **Uncommitted work** — 193 files without commit trail | P1 (process) | HIGH | GAPS-G1: commit in logical units (QA fixes → tooling → docs) after re-verification; focused commits (§86) | ⚠️ Open — next priority |
| R12 | **No CI** — analyze/test/build gates manual | P2 (process) | HIGH | GAPS-G6: GitHub Actions (format → analyze → test → build debug → build release w/ keystore secret) | ⚠️ Open |
| R13 | **Android 16 16 KB page size** — native libs (isar, tflite, mpv) not aligned | P3 (device warning) | MED | Track upstream native lib alignment; informational dialog only (no crash) — G8c | ⚠️ Track |
| R14 | **Large dataset** — students list in memory, no pagination | P3 (perf) | LOW (center scale <2k) | Decision D7: paginate only if measurement demands; Isar offset/limit ready | ⚠️ Watch |
| R15 | **Localization drift** — strings bypass l10n | P3 | LOW | D10 policy; ARB + gen-l10n; audit sweeps | ⚠️ Watch |
| R16 | **Design regression** — hardcoded colors bypass v3.1 tokens | P3 (brand) | LOW | D12 rule (tokens only); review gates; existing hardcoded gradients migrated | ✅ Policy set |

Legend: ✅ mitigated/verified · ⚠️ residual/open/tracked · ❌ unmitigated (none open P0/P1).
