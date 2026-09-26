-- ============================================================================
-- M-EDU Google identity hardening.
--
-- Two problems this migration closes:
--
--   1. `User.googleLinkAllowed` existed in `schema.prisma` (documented as the
--      account-model opt-in for Google account linking, audit P0-2) but was
--      never created in the database. Any `prisma migrate` diff reported
--      drift, and the column could not be read or written in production.
--
--   2. `AuthorizationCode.accessToken` stored a freshly issued JWT verbatim
--      for up to five minutes. A bearer token at rest stays usable for its
--      whole JWT lifetime even after the row is purged, so the column is made
--      nullable (legacy rows keep their value until they expire) and is no
--      longer written. `sessionId` binds the single-use code to the session
--      that was pre-created during the OAuth callback; the token is re-signed
--      from that session at redemption time.
--
-- Non-destructive and idempotent:
--   * no column or row is dropped,
--   * `ADD COLUMN IF NOT EXISTS` / `ALTER COLUMN ... DROP NOT NULL` are safe
--     to re-run,
--   * the backfill only ever flips a default-false flag to true for accounts
--     that already depend on passwordless Google sign-in today, so no
--     existing user loses access.
--
-- Backfill policy for `googleLinkAllowed`:
--   * passwordless, non-privileged accounts  -> true  (they link today; the
--     flag becomes an explicit, admin-revocable record of that allowance),
--   * every other account                   -> false (unchanged).
--   * privileged roles (SUPER_ADMIN/ORG_ADMIN/MANAGER/TEACHER/ASSISTANT) are
--     never auto-linked regardless of this flag; see `canAutoLink()` in
--     `apps/api/src/auth/auth.service.ts`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Account-model opt-in flag for Google account linking.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleLinkAllowed" BOOLEAN NOT NULL DEFAULT false;

-- Preserve passwordless Google sign-in for the accounts that rely on it today.
UPDATE "User"
SET "googleLinkAllowed" = true
WHERE "passwordHash" IS NULL
  AND "role" NOT IN ('SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER', 'TEACHER', 'ASSISTANT')
  AND "googleLinkAllowed" = false;

-- ---------------------------------------------------------------------------
-- 2. Bind authorization codes to a session instead of storing a bearer token.
-- ---------------------------------------------------------------------------
ALTER TABLE "AuthorizationCode" ADD COLUMN IF NOT EXISTS "sessionId" UUID;
ALTER TABLE "AuthorizationCode" ALTER COLUMN "accessToken" DROP NOT NULL;
