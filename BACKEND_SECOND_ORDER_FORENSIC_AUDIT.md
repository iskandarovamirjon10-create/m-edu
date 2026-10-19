# M-EDU Backend — Second-Order / Adversarial Forensic Audit

Scope: `apps/api/**`, `packages/*/**`, backend config. Frontend untouched.
This pass targeted defects that **survive ordinary unit tests**: concurrency,
distributed state, partial failure, stale sessions, replay, and crash windows.

## Executive verdict

| Class | Count |
|-------|-------|
| Critical blockers | 0 |
| P0 | 0 |
| P1 | 1 (fixed) |
| P2 | 1 (fixed) |
| P3 | 0 new |

Base verdict remains **PRODUCTION READY WITH LIMITATIONS**.

## Findings

### SO-1 — P1 — Concurrent refresh-token replay mints two live sessions
- **File:** `apps/api/src/auth/auth.service.ts` (`refreshUserToken`, `refreshParentToken`)
- **Attack scenario:** An attacker who obtains one refresh/access token races the
  legitimate client. Two (or more) `POST /auth/refresh` requests carrying the same
  `sid` arrive concurrently.
- **Root cause:** Rotation was a non-atomic `findFirst(live)` → `updateMany(revoke)`
  → `issueToken()`. Both callers observed a live session, both revoked
  (the second a no-op whose `count` was ignored), and **both issued a new session**.
  The doc comment's claim that replay is "rejected twice over" held only for
  *sequential* replay.
- **Impact:** One stolen token yields multiple independent, non-revocable-by-rotation
  sessions → persistent account access (self-service family and staff accounts;
  parent accounts too).
- **Exploitability:** High (authenticated token holder, trivial concurrency).
- **Fix:** Make the conditional `updateMany({ where: { revokedAt: null } })` the
  single authority; require `count === 1` before issuing a replacement; otherwise
  401 + warn log. Applied to both the user and parent branches.
- **Regression test:** `src/auth/__tests__/refresh-token.integration.spec.ts` test 11
  fires 3 parallel rotations of one session against **real PostgreSQL** and asserts
  exactly one fulfilled / two rejected, and the spent session stays revoked.
- **Verification:** PASS (test 11 green; log shows "Refresh token reuse detected").

### SO-2 — P2 — Rate-limit counter can lose its TTL and lock a client forever
- **File:** `apps/api/src/common/guards/throttler-redis.storage.ts`
- **Attack scenario:** Not attacker-driven — a **crash/restart window**. The storage
  issued `INCR` and `PEXPIRE` as separate commands (`multi.incr`, then a separate
  `pttl`/`pexpire`). If the process died (or Redis dropped the connection) between
  them, the counter key persisted with **no expiry**.
- **Root cause:** Non-atomic increment + first-hit expiry.
- **Impact:** The key only ever grows, so that user/IP stays rate-limited
  **permanently** — a self-inflicted denial of service that worsens the longer the
  process has been up. Multi-instance makes the window more likely.
- **Exploitability:** Low (availability, not confidentiality/integrity).
- **Fix:** Single server-side Lua script (`INCR` + conditional `PEXPIRE` + `PTTL`)
  in one round-trip; a TTL-less result falls back to the configured TTL.
- **Regression test:** `src/common/__tests__/throttler-redis.storage.spec.ts`
  asserts exactly one `eval` call whose script contains `INCR` and `PEXPIRE`, plus
  the memory fallback on script failure.
- **Verification:** PASS (5/5).

## Verified-safe surfaces (reviewed, no change required)

| Surface | Evidence |
|---------|----------|
| Camera distributed lock | Owner-aware: `SET … EX 10 NX`, Lua compare-and-expire, Lua compare-and-DEL. A replica can never renew/release a peer's lock; lost lock stops the local worker. |
| OAuth auth-code exchange | Single-use via conditional `updateMany({ usedAt: null })` + `count === 1`. |
| Telegram deep-link token | SHA-256 at rest; atomic single-use claim (`usedAt: null` + count). |
| Chat gateway | `joinConversation`/`typing`/`sendMessage`/`markRead` all require participant **and** `conversation.organizationId === user.organizationId`; `chatService.sendMessage` re-checks `_requireParticipant`. |
| AI conversations | Reads/mutations scoped by `{ id, organizationId, createdBy: userId }`. |
| Inventory stock | `updateMany` with `quantity: { gte }` + org in WHERE (conditional decrement, no oversell). |
| API keys / lessons / curriculum | Ownership `findFirst({ id, organizationId })` before any id-only `update`. |
| Notification processor | Redis crash-phase markers (`PROCESSING_INTERNAL` → `DELIVERING_EXTERNAL`) prevent duplicate external sends; in-app dedup via unique key. |
| Attendance decision engine | `upsert` on `organizationId_idempotencyKey`; P2002 resolved by re-read; no fabricated event ids. |
| Tenant-scoped sort fields | `sortBy` allow-listed in both Prisma adapters. |

## Phase coverage notes

- **Tenancy (P2):** all `findUnique/findFirst/update/delete` with an id-only `where`
  were enumerated; every org-scoped hit is preceded by an ownership read or uses a
  tenant-qualified `updateMany`. Indirect chains (Topic→Module→Curriculum) were
  already fixed in the prior pass.
- **Auth/session:** logout, logout-all, revoke-one, revoke-others, and refresh all
  bind on `userId`/`parentId` and fail closed; refresh now replay-safe (SO-1).
- **Redis/locks:** owner-aware locks correct; readiness now gates Redis.
- **Camera/face:** SSRF/DNS-rebinding, credential vault, `spawn(..., {shell:false})`,
  bounded frame buffer, model-path hardening — reviewed, unchanged.
- **Input/output:** global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  implicit conversion) + image magic-byte/size bounds; no raw `$queryRawUnsafe`
  with interpolation (the one call is parameterized).

## Tests / checks (exact)

| Command | Result |
|---------|--------|
| `npx tsc --noEmit -p tsconfig.json` | exit 0 |
| `npx vitest run src` | **244 files / 2649 tests passed** |
| `npx vitest run --config vitest.integration.config.ts src/auth/__tests__/refresh-token.integration.spec.ts` | **11 passed** (real PostgreSQL) |
| `npx vitest run` (packages/face-security) | 5 files / 31 passed |
| `npm run lint` | **0 errors**, 350 pre-existing warnings |
| `npx nest build` | exit 0 |
| `npx prisma validate` | valid |

## Not verified / limitations

- **NOT VERIFIED** — multi-instance Redis coordination & BullMQ worker crash/retry
  under a real 2-replica deployment; the throttler fix is proven at unit level, not
  against a falling-over Redis.
- **NOT VERIFIED** — real ONNX face engine and the `test/**` e2e suites (need a running seeded API + models).
- **NOT VERIFIED** — graceful shutdown under SIGTERM with live workers.
- **LIMITATION** — the refresh "reuse detected" path rejects the second concurrent
  request; two browser tabs refreshing the same session at the same instant will
  cause one to re-authenticate (same trade-off the sequential rotation already had).
- **LIMITATION** — in-memory throttler fallback is per-process (documented
  resilience trade-off when Redis is down).

## Verdicts

- **SECURITY VERDICT:** No exploitable P0/P1 unauthorized-access flaw remains after
  SO-1. Fail-closed auth, tenant-qualified access, and single-use token handling hold.
- **DATA ISOLATION VERDICT:** PASS (adversarial review; no new cross-tenant path).
- **AUTHENTICATION VERDICT:** PASS (replay-safe rotation now concurrency-proven).
- **AUTHORIZATION VERDICT:** PASS for reviewed endpoints.
- **CONCURRENCY VERDICT:** Improved — refresh race closed; attendance/enrollment
  already idempotent/locked.
- **DATABASE VERDICT:** PASS (constraints + conditional updates carry the invariants).
- **REDIS/DISTRIBUTED VERDICT:** PASS with throttle-TTL fix; multi-instance runtime unverified.
- **CAMERA/BIOMETRIC VERDICT:** PASS on review; real engine unverified.
- **QUEUE/WORKER VERDICT:** PASS on review; crash/retry runtime unverified.
- **PRODUCTION READINESS VERDICT:** PRODUCTION READY WITH LIMITATIONS.
