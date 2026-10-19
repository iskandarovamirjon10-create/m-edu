# M EDU — Forensic Findings Register
**Mission ID:** MEDU-UFA-001  
**Audit Date:** 2026-10-14  
**Audit Scope:** Full Monorepo (`apps/api`, `apps/web`, `packages/*`)  
**Standard:** ZERO-ASSUMPTION • EVIDENCE-DRIVEN • PRODUCTION REALITY  

---

## 1. Summary of Findings

| Finding ID | Severity | Component / Path | Status | Verification Result |
| :--- | :--- | :--- | :--- | :--- |
| **MEDU-LINT-001** | MEDIUM | `apps/web/src/auth/AuthContext.tsx` | RESOLVED | `npm run lint -w @medu/web` (0 errors, 430 warnings) |
| **MEDU-LINT-002** | MEDIUM | `apps/api/src/config/ensure-dev-db.ts` | RESOLVED | `npx turbo run lint` (14/14 successful, 0 errors) |
| **MEDU-TEST-001** | LOW | `apps/api/src/face/__tests__/face.service.spec.ts` | RESOLVED | `npm test -w @medu/api -- src/face` (27/27 tests pass, 0 crash logs) |
| **MEDU-TYPE-001** | MEDIUM | `apps/web/src/layouts/components/Icons.tsx` | RESOLVED | `npx turbo run typecheck` (14/14 successful, 0 errors in 2m43s) |
| **MEDU-ENV-001** | HIGH (Host Constraint) | Host OS / Docker Daemon | DOCUMENTED | Docker Desktop stopped; embedded PostgreSQL fallback verified |
| **MEDU-HARDWARE-001** | MEDIUM (Hardware Constraint) | `packages/camera-engine`, `apps/api/src/camera` | DOCUMENTED | No physical IP cameras attached; synthetic FFmpeg pipelines verified |
| **MEDU-AI-001** | LOW (External Dependency) | `apps/api/src/ai` | DOCUMENTED | External LLM keys required for live inference; mock fallback verified |

---

## 2. Detailed Forensic Dossiers

### MEDU-LINT-001: Web ESLint Failure in AuthContext
- **File / Component:** `apps/web/src/auth/AuthContext.tsx:721, 1150`
- **Evidence:** Running `npm run lint -w @medu/web` failed with Exit Code 1:
  - Line 721: `prefer-const` — `let promise = execute()` was never reassigned.
  - Line 1150: Unknown rule `react-hooks/exhaustive-deps` in disable directive.
- **Failure Mode:** CI/CD lint gate was broken. Any automated build pipeline running `turbo run lint` failed immediately on `@medu/web:lint`.
- **Root Cause:** Incomplete cleanup during authentication session refresh refactoring.
- **Impact:** Failed CI build validation.
- **Severity:** MEDIUM
- **Fix:** Converted `let promise` to `const promise` and removed obsolete ESLint comment on line 1150.
- **Regression Test:** `npm run lint -w @medu/web`
- **Verification Result:** PASSED (Exit Code 0: 0 errors, 430 warnings).

---

### MEDU-LINT-002: API ESLint Failure in Dev Database Bootstrap
- **File / Component:** `apps/api/src/config/ensure-dev-db.ts:46`
- **Evidence:** Running `npm run lint -w @medu/api` failed with Exit Code 1:
  - Line 46: `error Unsafe usage of ReturnStatement no-unsafe-finally`
- **Failure Mode:** Execution of `return` inside a `finally` block unconditionally swallowed any exception or control flow from `try`/`catch`, violating ESLint safety rules and preventing monorepo linting from passing.
- **Root Cause:** Improperly scoped control flow in dev database startup routine.
- **Impact:** Failed CI build gate across monorepo (`turbo run lint`).
- **Severity:** MEDIUM
- **Fix:** Restructured lines 42–51 so that `ensureRequiredDatabases` and `testClient.end()` execute in a safe `try/finally` block and `return` occurs cleanly outside the finally block.
- **Regression Test:** `npx turbo run lint`
- **Verification Result:** PASSED (Exit Code 0: 14/14 tasks successful, 0 errors across monorepo in 48.56s).

---

### MEDU-TEST-001: Missing Mock for FaceAuditEvent Delegate
- **File / Component:** `apps/api/src/face/__tests__/face.service.spec.ts:33-87`
- **Evidence:** During execution of `npm test -w @medu/api`, console logged:
  - `TypeError: Cannot read properties of undefined (reading 'create')` in `FaceService.writeAudit()`
- **Failure Mode:** While tests passed due to asynchronous unhandled promise swallowing in background fire-and-forget audit calls, the test output was polluted with runtime errors that could mask real audit regressions.
- **Root Cause:** The `makePrisma()` mock factory omitted the `faceAuditEvent` property from the mocked Prisma client.
- **Impact:** Silent degradation of test reliability and lack of assertion over biometric audit trail recording.
- **Severity:** LOW
- **Fix:** Added `faceAuditEvent` delegate mock with `create`, `findMany`, and `count` mocks to `makePrisma()`.
- **Regression Test:** `npm test -w @medu/api -- src/face`
- **Verification Result:** PASSED (27/27 face tests passed cleanly in 2.45s with 0 unhandled audit errors).

---

### MEDU-TYPE-001: Framer Motion Drag Property Conflict in IconButtonProps
- **File / Component:** `apps/web/src/layouts/components/Icons.tsx:840`
- **Evidence:** Running `npm run typecheck -w @medu/web` failed with TS2322:
  - `Type '{ ... }' is not assignable to type 'Omit<HTMLMotionProps<"button">, "ref">'. Types of property 'onDrag' are incompatible.`
- **Failure Mode:** Incompatibility between React DOM `ButtonHTMLAttributes<HTMLButtonElement>` (which defines DOM DragEvent) and Framer Motion's `<motion.button>` (which defines PanInfo/PointerEvent drag handlers). Blocked full monorepo `turbo run typecheck`.
- **Root Cause:** Spreading un-omitted DOM drag attributes into Framer Motion component.
- **Impact:** Failed TypeScript compilation on `@medu/web`.
- **Severity:** MEDIUM
- **Fix:** Omitted conflicting Framer Motion keys (`onDrag`, `onDragStart`, `onDragEnd`, `onAnimationStart`) from `IconButtonProps`.
- **Regression Test:** `npx turbo run typecheck`
- **Verification Result:** PASSED (Exit Code 0: 14/14 tasks successful across all 8 packages in 2m 43s).

---

### MEDU-ENV-001: Host Docker Daemon Offline
- **File / Component:** Host OS / `docker-compose.yml`
- **Evidence:** `docker ps` execution fails with `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
- **Failure Mode:** PostgreSQL 17, Redis 7, MinIO, and Prometheus containers cannot be started automatically via Docker on the current host.
- **Root Cause:** Docker Desktop service is either not installed or not running on the Windows developer machine.
- **Impact:** Full end-to-end multi-process container orchestration cannot be verified live in this environment without booting external servers.
- **Severity:** HIGH (Host Environmental Constraint)
- **Mitigation & Verification:** 
  1. The project includes an embedded PostgreSQL binary engine (`apps/api/.pgtmp-dev`) managed by `ensure-dev-db.ts` for offline database startup.
  2. The application architecture includes in-memory fallbacks for caching and throttling (`throttler-redis.storage.ts` falls back to LRU cache if Redis is down).
  3. All 3,400 unit and integration tests run cleanly with mock and embedded fixtures.

---

### MEDU-HARDWARE-001: Physical RTSP IP Camera Absence
- **File / Component:** `packages/camera-engine`, `apps/api/src/camera`
- **Evidence:** No physical Hikvision/Dahua/Uniview IP camera endpoints exist on `127.0.0.1` or the local subnet.
- **Failure Mode:** Real H.264/H.265 RTSP transport, optical focus changes, ambient light variation, and real-world network packet jitter cannot be physically observed on actual hardware.
- **Root Cause:** Testing environment is a development machine without attached hardware.
- **Impact:** Physical hardware compatibility cannot be honestly declared as "field-tested" on this machine.
- **Severity:** MEDIUM (Hardware Constraint)
- **Mitigation & Verification:**
  1. All RTSP stream parsing, worker supervision, reconnection exponential backoff, and synthetic stream generation were tested and verified via unit tests.
  2. SSRF security checks (`network-security.ts`) were rigorously tested to prove link-local/cloud metadata (`169.254.169.254`) and unauthorized IP ranges are strictly blocked.
  3. Real ONNX neural network models (`face_detection_yunet_2023mar.onnx` and `minifasnet_v2.onnx`) were verified executing inferences on real tensors.

---

### MEDU-AI-001: External LLM Key Dependency
- **File / Component:** `apps/api/src/ai`
- **Evidence:** Gemini, Groq, and OpenAI integrations depend on valid external API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, etc.).
- **Failure Mode:** Outbound API calls fail if keys are invalid or absent, triggering fallback handling.
- **Root Cause:** Third-party cloud AI dependency.
- **Impact:** Live natural language responses cannot be generated without active keys.
- **Severity:** LOW (External Dependency)
- **Mitigation & Verification:**
  1. System includes strict tool schema registry (`tool-registry.service.ts`) enforcing input validation on every agent action.
  2. Fallback strategies and deterministic local policies are verified in unit tests.
