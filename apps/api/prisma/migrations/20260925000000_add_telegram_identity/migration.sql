-- ============================================================================
-- M-EDU Telegram foundation — durable identity, single-use link tokens and
-- webhook update deduplication.
--
-- Why: the pre-existing Telegram flow stored a PLAINTEXT link token directly on
-- `User`/`ParentAccount` (looked up by string equality) and had no update-level
-- idempotency, so a duplicated webhook delivery or a database dump could be
-- replayed. This migration adds:
--
--   * `TelegramAccount`      — durable external identity + lifecycle status
--                              (ACTIVE/DISCONNECTED/BLOCKED/SUSPENDED).
--   * `TelegramLinkToken`    — SHA-256-hashed, short-TTL, single-use link
--                              tokens consumed atomically via `usedAt`.
--   * `TelegramUpdate`       — update_id primary key => "process exactly once"
--                              across multiple API instances.
--
-- Non-destructive: the legacy `User.telegramChatId` / `telegramLinkToken`
-- columns are intentionally NOT dropped. `telegramChatId` is still dual-written
-- as the delivery pointer used by the notification worker, and the deprecated
-- `telegramLinkToken` columns are simply left unread (dropping columns is a
-- separate, explicitly-justified migration).
--
-- Idempotent: safe to run against a database that already contains any of it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enum: TelegramAccountStatus
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TelegramAccountStatus') THEN
    CREATE TYPE "TelegramAccountStatus" AS ENUM ('ACTIVE', 'DISCONNECTED', 'BLOCKED', 'SUSPENDED');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TelegramAccount
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TelegramAccount" (
    "id"              UUID NOT NULL,
    "organizationId"  UUID NOT NULL,
    "telegramUserId"  TEXT NOT NULL,
    "chatId"          TEXT NOT NULL,
    "username"        TEXT,
    "firstName"       TEXT,
    "lastName"        TEXT,
    "languageCode"    TEXT,
    "status"          "TelegramAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "userId"          UUID,
    "parentAccountId" UUID,
    "linkedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"      TIMESTAMP(3),
    "disconnectedAt"  TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

-- One Telegram identity => at most one M-EDU principal (single central bot).
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramAccount_telegramUserId_key"
    ON "TelegramAccount"("telegramUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramAccount_chatId_key"
    ON "TelegramAccount"("chatId");
CREATE INDEX IF NOT EXISTS "TelegramAccount_organizationId_idx"
    ON "TelegramAccount"("organizationId");
CREATE INDEX IF NOT EXISTS "TelegramAccount_userId_idx"
    ON "TelegramAccount"("userId");
CREATE INDEX IF NOT EXISTS "TelegramAccount_parentAccountId_idx"
    ON "TelegramAccount"("parentAccountId");
CREATE INDEX IF NOT EXISTS "TelegramAccount_status_idx"
    ON "TelegramAccount"("status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TelegramAccount_organizationId_fkey') THEN
    ALTER TABLE "TelegramAccount"
      ADD CONSTRAINT "TelegramAccount_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TelegramAccount_userId_fkey') THEN
    ALTER TABLE "TelegramAccount"
      ADD CONSTRAINT "TelegramAccount_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TelegramAccount_parentAccountId_fkey') THEN
    ALTER TABLE "TelegramAccount"
      ADD CONSTRAINT "TelegramAccount_parentAccountId_fkey"
      FOREIGN KEY ("parentAccountId") REFERENCES "ParentAccount"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TelegramLinkToken (hash-stored, single-use)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TelegramLinkToken" (
    "id"              UUID NOT NULL,
    "organizationId"  UUID NOT NULL,
    "tokenHash"       TEXT NOT NULL,
    "targetType"      TEXT NOT NULL,
    "userId"          UUID,
    "parentAccountId" UUID,
    "expiresAt"       TIMESTAMP(3) NOT NULL,
    "usedAt"          TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramLinkToken_tokenHash_key"
    ON "TelegramLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_expiresAt_idx"
    ON "TelegramLinkToken"("expiresAt");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_organizationId_idx"
    ON "TelegramLinkToken"("organizationId");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_usedAt_idx"
    ON "TelegramLinkToken"("usedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TelegramLinkToken_organizationId_fkey') THEN
    ALTER TABLE "TelegramLinkToken"
      ADD CONSTRAINT "TelegramLinkToken_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TelegramUpdate (webhook update_id deduplication)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "TelegramUpdate" (
    "updateId"   BIGINT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"     TEXT NOT NULL DEFAULT 'PROCESSED',

    CONSTRAINT "TelegramUpdate_pkey" PRIMARY KEY ("updateId")
);

CREATE INDEX IF NOT EXISTS "TelegramUpdate_receivedAt_idx"
    ON "TelegramUpdate"("receivedAt");
