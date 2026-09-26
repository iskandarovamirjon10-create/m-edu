-- ============================================================================
-- M-EDU Telegram — delivery tracking, Telegram notification preferences and
-- quiet hours.
--
-- Why: the notification worker delivered to a legacy `ParentAccount.telegramChatId`
-- pointer with no record of the outcome, no lifecycle awareness and no way to
-- distinguish a transient Telegram outage from a permanent "bot was blocked by
-- the user" relationship failure. This migration adds:
--
--   * `NotificationDelivery` — one tracking row per (event instance, principal,
--                              channel) with categorized provider failure, so
--                              permanent failures stop retrying and transient
--                              failures keep their backoff.
--   * `NotificationPreference.telegramEnabled` — per-category Telegram opt-in.
--   * `UserSettings.telegramNotifications` + quiet-hours columns — the server
--     side source of truth for Telegram delivery policy (including deferral).
--
-- Non-destructive / additive: all statements are idempotent and no existing
-- column is dropped. The legacy `User.telegramChatId` / `ParentAccount.telegramChatId`
-- columns remain dual-written as a compatibility mirror (see docs/TELEGRAM.md).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enum: NotificationDeliveryStatus
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationDeliveryStatus') THEN
    CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
      'PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED', 'DEFERRED'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- UserSettings: Telegram channel opt-in + quiet hours
-- ---------------------------------------------------------------------------
ALTER TABLE "UserSettings"
  ADD COLUMN IF NOT EXISTS "telegramNotifications" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "quietHoursStart" TEXT,
  ADD COLUMN IF NOT EXISTS "quietHoursEnd" TEXT;

-- ---------------------------------------------------------------------------
-- NotificationPreference: per-category Telegram opt-in
-- ---------------------------------------------------------------------------
ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "telegramEnabled" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- NotificationDelivery
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
    "id"                UUID NOT NULL,
    "organizationId"    UUID NOT NULL,
    "eventId"           TEXT NOT NULL,
    "eventType"         TEXT NOT NULL,
    "entityType"        TEXT NOT NULL,
    "entityId"          TEXT NOT NULL,
    "channel"           TEXT NOT NULL DEFAULT 'TELEGRAM',
    "principalType"     TEXT NOT NULL,
    "principalId"       UUID NOT NULL,
    "telegramAccountId" UUID,
    "status"            "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "failureCategory"   TEXT,
    "attempts"          INTEGER NOT NULL DEFAULT 0,
    "dedupKey"          TEXT NOT NULL,
    "title"             TEXT,
    "body"              TEXT,
    "deferredUntil"     TIMESTAMP(3),
    "attemptedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"            TIMESTAMP(3),
    "failedAt"          TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- Exactly one delivery record per (event, principal, channel).
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_dedupKey_key"
    ON "NotificationDelivery"("dedupKey");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_organizationId_idx"
    ON "NotificationDelivery"("organizationId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_organizationId_status_idx"
    ON "NotificationDelivery"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_telegramAccountId_idx"
    ON "NotificationDelivery"("telegramAccountId");
-- Drives the quiet-hours deferral sweep (status = DEFERRED AND deferredUntil <= now).
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_deferredUntil_idx"
    ON "NotificationDelivery"("status", "deferredUntil");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_createdAt_idx"
    ON "NotificationDelivery"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NotificationDelivery_organizationId_fkey') THEN
    ALTER TABLE "NotificationDelivery"
      ADD CONSTRAINT "NotificationDelivery_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
