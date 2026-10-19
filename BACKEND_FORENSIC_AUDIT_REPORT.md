# M-EDU Backend — Forensic Audit & Hardening Report

Scope: `apps/api/**`, `packages/*/**`, `apps/api/prisma/**`, backend config/CI.
Frontend (`apps/web/**`) was **not** modified.

Method: inventory → targeted source review of P0 surfaces (auth, tenant
isolation, camera, face/biometric, attendance, DB, Redis/queue, health, config)
→ fix → regression test → re-verify.

## Executive Verdict

**PRODUCTION READY WITH LIMITATIONS.**

The backend is already heavily hardened (fail-closed global auth, tenant-scoped
queries, AES-256-GCM biometric storage, SSRF/DNS-rebinding defenses, idempotent
attendance durable events, distributed camera locks). The audit found **no P0
exploitable vulnerability** in the surfaces reviewed, but it did find and fix
one **P1 authorization/session gap** and several P2/P3 defects. A number of
production behaviors could not be exercised in this environment (see
*Remaining Risks / NOT VERIFIED*), so full production sign-off still requires an
environment with PostgreSQL + Redis + the real ONNX models.

## Findings

| ID | Sev | Category | File | Finding | Exploit | Fix | Test |
|----|-----|----------|------|---------|---------|-----|------|
| F1 | P1 | Auth / Session | `apps/api/src/auth/sync.gateway.ts` | `/sync` WebSocket accepted a JWT without validating the `sid` session row (revokedAt/expiresAt/binding) or the token↔account organization binding. `JwtStrategy` and `WsJwtGuard` both enforce this; this gateway (not guard-protected) did not. | A logged-out/revoked session (e.g. after a compromise) kept a live `/sync` socket and kept receiving per-user `session:revoked` / `user:sync` events until JWT expiry. | Validate live session + binding + org, mirroring `JwtStrategy`/`WsJwtGuard`. | `apps/api/src/auth/__tests__/sync.gateway.spec.ts` (7 cases: no token, valid, revoked, expired, wrong user, org mismatch, parent) |
| F2 | P2 | Tenant isolation | `apps/api/src/curriculum/curriculum.service.ts`, `apps/api/src/lessons/lessons.service.ts` | `Topic` is org-scoped only transitively (`Topic → CurriculumModule → Curriculum.organizationId`). `addObjective` and `updateContent` fetched a topic with `findUnique({ id })` and trusted any UUID. | An org admin of A could attach a learning objective to, or link, a `Topic` owned by tenant B (cross-tenant write/pollution). | Look the topic up under the tenant chain (`CurriculumModule: { curriculumId, Curriculum: { organizationId } }`). | `curriculum.service.spec.ts`, `lessons.service.spec.ts` (scoped-where + foreign-topic rejection) |
| F3 | P2 | Health / Redis | `apps/api/src/health/readiness.controller.ts` | `/readiness` only checked PostgreSQL. Redis is a production-mandatory dependency (notifications + cron queues; `assertValidConfig` refuses prod without it). | Orchestrator kept routing traffic to a replica whose notification/cron pipeline was dead. | Probe Redis (`PING`) when `isRedisEnabled()`; report `redis` flag; 503 when required Redis is down. | `readiness.controller.spec.ts` (ready / db-down / redis-down / redis-disabled / no-leak) |
| F4 | P3 | Cryptography | `packages/face-security/src/encryption.service.ts` | `verifyHash` compared digests with `===` (non-constant-time). | Timing side-channel to recover a stored hash byte-by-byte. | `crypto.timingSafeEqual` over equal-length hex buffers; length mismatch → false. | `encryption.service.test.ts` (malformed/truncated hashes) |
| F5 | P3 | Observability | `apps/api/src/face/face.service.ts`, `face-engine.factory.ts` | `engineProvider` was initialized to `'mock'` and never updated, so `getEngineStatus()` always reported `isReal:false` — even with the real ONNX engine live. | Operators could not tell from the API which engine served recognition. | Resolve provider via exported `resolveFaceEngineProvider()` and record it after successful init. | `face-engine.factory.spec.ts` (resolver default + explicit) |

### Findings documented but not changed

| ID | Sev | Category | Location | Note |
|----|-----|----------|----------|------|
| U1 | P3 | Migrations | `apps/api/prisma/migrations/20261004120000_add_access_whitelist`, `...20261004120000_add_session_device_sync_fields` | Two migrations share the timestamp prefix `20261004120000`. Prisma orders by full directory name (deterministic), and both are listed by `migrate status`, but identical prefixes are a hygiene hazard. **Not renamed**: renaming a directory changes the `_prisma_migrations.migration_name` on already-migrated databases and risks a spurious "unapplied" state. |
| U2 | P3 | Logging | `packages/face-security/src/secure-logger.ts` | Redaction is regex/heuristic (string patterns + key-substring match). It handles the known cases (rtsp userinfo, `embedding`, `token`, `password`) but is not a structural allow-list. |
| U3 | P4 | Logging | `audit/audit.interceptor.ts`, `data-quality/data-quality.service.ts` | Direct `console.error` fallbacks bypass the structured logger. |
| U4 | P3 | Timezone | `face.service.ts` `getAnalytics` | Today/30-day boundaries use server-local midnight; code comment already flags this. |

## Changed Files

Modified (on top of pre-existing uncommitted working-tree changes):
- `apps/api/src/auth/sync.gateway.ts`
- `apps/api/src/curriculum/curriculum.service.ts`
- `apps/api/src/lessons/lessons.service.ts`
- `apps/api/src/face/face.service.ts`
- `apps/api/src/face/face-engine.factory.ts`
- `apps/api/src/health/readiness.controller.ts`
- `apps/api/src/common/redis/redis-pubsub.service.ts`
- `packages/face-security/src/encryption.service.ts`

Added:
- `apps/api/src/auth/__tests__/sync.gateway.spec.ts`

Tests updated:
- `apps/api/src/curriculum/__tests__/curriculum.service.spec.ts`
- `apps/api/src/lessons/__tests__/lessons.service.spec.ts`
- `apps/api/src/face/__tests__/face-engine.factory.spec.ts`
- `apps/api/src/health/__tests__/readiness.controller.spec.ts`
- `packages/face-security/src/__tests__/encryption.service.test.ts`

## Fix Categories

- **Security / auth:** F1 (WS session + tenant binding).
- **Tenant isolation:** F2 (topic reference chain).
- **Database:** no schema/migration/index changes (U1 documented only).
- **Concurrency:** no new race found in reviewed surfaces; existing idempotent
  attendance (`upsert` on `organizationId_idempotencyKey`, P2002 resolution) and
  row-level locks were verified by reading, not modified.
- **Camera:** reviewed SSRF/DNS-rebinding (`network-security.ts`,
  `resolveStreamHost`), credential vault (AES-GCM), `spawn('ffmpeg', args, {shell:false})`,
  bounded frame buffer. No change required.
- **Face/biometric:** F5; review found embeddings encrypted at rest, `SecureLogger`
  redaction, no embedding in DTOs/logs, model-path hardening. F4 applied to the
  shared encryption service.
- **Redis/queue:** F3; `RedisPubSubService.ping()` added.

## Verification Results (exact)

- `npx tsc --noEmit -p tsconfig.json` → **exit 0**.
- `npx vitest run src` (apps/api) → **Test Files 244 passed (244); Tests 2649 passed; 0 failed; 0 skipped** (~148 s).
- `npx vitest run` (packages/face-security) → **5 files passed; 31 tests passed**.
- `npm run lint` (apps/api) → **0 errors, 350 warnings** (pre-existing `any`/unused-var warnings in tests; no new errors).
- `npx prisma validate --schema=prisma/schema.prisma` → **valid**.
- `npx nest build` → **exit 0**.
- `npx prisma migrate status` → connects; lists all migrations; reports pending
  migrations against the local dev database ("run prisma migrate dev").

Baseline before changes: 243 files / 2634 tests passing. After: 244 / 2649.

## Remaining Risks / NOT VERIFIED

The following could **not** be exercised in this environment and must not be
considered verified:

- **NOT VERIFIED** — Real ONNX face engine (`FACE_ENGINE_PROVIDER=real-local`):
  model files are absent from the repo, so only the mock path and the pure
  provider resolver were tested. F5's end-to-end `isReal:true` assertion needs a
  host with the models.
- **NOT VERIFIED** — End-to-end suites (`test:e2e`) require a running, seeded API
  + PostgreSQL; not run here.
- **NOT VERIFIED** — BullMQ worker-crash / Redis-restart / retry-storm / DLQ
  behavior, and multi-instance distributed camera-lock behavior, under a real
  Redis.
- **NOT VERIFIED** — Graceful shutdown (SIGTERM child-process/ffmpeg cleanup) under
  a container orchestrator.
- **NOT VERIFIED** — Docker/Dockerfile/compose backend runtime.
- **LIMITATION** — `prisma migrate status` shows pending migrations on the local
  dev DB; production `migrate deploy` was not run (out of scope / not authorized).
- **LIMITATION** — U1–U4 above remain open by design (documented, low severity).

Do not treat this report as a claim of complete production certification. The
fixed defects and their tests are verified; the items above require a full
production-like environment to certify.
