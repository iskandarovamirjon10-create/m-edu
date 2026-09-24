-- Schema-parity repair (non-destructive).
--
-- WHY THIS MIGRATION EXISTS
-- ------------------------
-- `20260914110000_reconcile_prisma_schema` was meant to make the migration
-- chain reproduce schema.prisma exactly, but the chain still diverges from the
-- committed schema. A static replay of every migration compared against
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
-- shows (see .gate/schema-parity.mjs):
--
--   * ParentSession is declared in schema.prisma and written by the parent-login
--     path (auth.service.ts -> prisma.parentSession.create) and read by
--     jwt.strategy.ts, but NO migration ever created the table. A database built
--     from the chain raises P2021 ("relation does not exist") on every parent
--     login and on every parent-session JWT validation.
--
--   * Five columns the generated Prisma Client selects are never created, so
--     any un-scoped `findMany`/`findFirst`/`create` on those models raises P2022:
--       User.telegramLinkExpiresAt / ParentAccount.telegramLinkExpiresAt
--         (read + written by telegram-webhook.controller.ts),
--       GamificationXpEvent.reason (selected by gamification.service.ts),
--       DataExportLog.fileUrl (selected by data-governance.service.ts),
--       AutomationExecution.executedAt (selected by automation.service.ts).
--
--   * Several columns exist in the database as NOT NULL with no DEFAULT while
--     schema.prisma treats them as optional. Prisma omits those columns from
--     INSERTs, so writes fail with SQLSTATE 23502:
--       NotificationDedup.{entityType,entityId,eventType} and its stray `id`
--       column (used by notification-event.processor.ts upsert),
--       TelegramLinkLog.{chatId,status} and its stray `id` column (used by
--       telegram-webhook.controller.ts).
--
-- SAFETY
-- ------
-- Every statement is additive or a relaxation; nothing is dropped and no data
-- is discarded. Renames preserve the existing values (they are guarded so the
-- migration is a no-op on a database that already has the new column name).
-- The stray `id` columns are kept and given a DEFAULT instead of being dropped.

-- ---------------------------------------------------------------------------
-- 1. ParentSession: the table the parent-portal auth flow depends on.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ParentSession" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "parentId" UUID NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "ParentSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ParentSession_parentId_idx" ON "ParentSession"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSession_parentId_fkey'
  ) THEN
    ALTER TABLE "ParentSession"
      ADD CONSTRAINT "ParentSession_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "ParentAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSession_organizationId_fkey'
  ) THEN
    ALTER TABLE "ParentSession"
      ADD CONSTRAINT "ParentSession_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Columns declared in schema.prisma but never created by the chain.
-- ---------------------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramLinkExpiresAt" TIMESTAMP(3);
ALTER TABLE "ParentAccount" ADD COLUMN IF NOT EXISTS "telegramLinkExpiresAt" TIMESTAMP(3);
ALTER TABLE "GamificationXpEvent" ADD COLUMN IF NOT EXISTS "reason" TEXT;

-- DataExportLog: the chain created `filePath`, schema.prisma names it `fileUrl`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DataExportLog' AND column_name = 'filePath'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DataExportLog' AND column_name = 'fileUrl'
  ) THEN
    ALTER TABLE "DataExportLog" RENAME COLUMN "filePath" TO "fileUrl";
  END IF;
END $$;
ALTER TABLE "DataExportLog" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;

-- AutomationExecution: the chain renamed `executedAt` -> `startedAt`, while
-- schema.prisma still declares `executedAt` (NOT NULL, DEFAULT now()).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AutomationExecution' AND column_name = 'startedAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'AutomationExecution' AND column_name = 'executedAt'
  ) THEN
    ALTER TABLE "AutomationExecution" RENAME COLUMN "startedAt" TO "executedAt";
  END IF;
END $$;
ALTER TABLE "AutomationExecution" ADD COLUMN IF NOT EXISTS "executedAt" TIMESTAMP(3);
UPDATE "AutomationExecution"
   SET "executedAt" = COALESCE("executedAt", "triggeredAt", CURRENT_TIMESTAMP)
 WHERE "executedAt" IS NULL;
ALTER TABLE "AutomationExecution" ALTER COLUMN "executedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AutomationExecution" ALTER COLUMN "executedAt" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Relax columns that the schema treats as optional but the database requires.
--
-- These are currently NOT NULL without a DEFAULT; the generated Prisma Client
-- omits them from INSERTs, so writes fail with 23502. Dropping NOT NULL keeps
-- every existing value and unblocks inserts.
-- ---------------------------------------------------------------------------
ALTER TABLE "FollowUpRule" ALTER COLUMN "updatedAt" DROP NOT NULL;
ALTER TABLE "FollowUpRule" ALTER COLUMN "entityType" DROP NOT NULL;
ALTER TABLE "AutomationRule" ALTER COLUMN "entityType" DROP NOT NULL;
ALTER TABLE "CommunicationHistory" ALTER COLUMN "content" DROP NOT NULL;
ALTER TABLE "ApiKey" ALTER COLUMN "keyPrefix" DROP NOT NULL;
ALTER TABLE "DataRetentionPolicy" ALTER COLUMN "updatedAt" DROP NOT NULL;
ALTER TABLE "DataExportLog" ALTER COLUMN "entityType" DROP NOT NULL;
ALTER TABLE "HomeworkSubmission" ALTER COLUMN "homeworkId" DROP NOT NULL;
ALTER TABLE "HomeworkSubmission" ALTER COLUMN "updatedAt" DROP NOT NULL;
ALTER TABLE "TelegramLinkLog" ALTER COLUMN "chatId" DROP NOT NULL;
ALTER TABLE "TelegramLinkLog" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "NotificationDedup" ALTER COLUMN "entityType" DROP NOT NULL;
ALTER TABLE "NotificationDedup" ALTER COLUMN "entityId" DROP NOT NULL;
ALTER TABLE "NotificationDedup" ALTER COLUMN "eventType" DROP NOT NULL;

-- The `@id` fields of these two models are NOT primary keys in the database, so
-- give them the UNIQUE constraint Prisma requires for findUnique/upsert, and a
-- DEFAULT on the stray `id` column so inserts that omit it still succeed.
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDedup_dedupKey_key"
  ON "NotificationDedup"("dedupKey");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramLinkLog_idempotencyKey_key"
  ON "TelegramLinkLog"("idempotencyKey");

ALTER TABLE "NotificationDedup" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "TelegramLinkLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
