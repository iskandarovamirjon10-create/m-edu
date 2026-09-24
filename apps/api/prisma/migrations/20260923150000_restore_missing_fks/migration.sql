-- ============================================================================
-- Restore missing foreign keys (P1-31) with orphan pre-checks.
--
-- Several UUID columns were added as bare scalars without a Prisma relation,
-- so Postgres never got a constraint and cross-tenant / dangling references
-- were only enforced in application code. This migration:
--   1. Reports orphan counts (RAISE NOTICE) so operators can see impact.
--   2. Cleans orphans safely (SET NULL targets → NULL; CASCADE targets →
--      dangling audit rows are deleted).
--   3. Adds the constraints idempotently (IF NOT EXISTS via DO blocks).
--
-- Forward migration only — historical migrations are never edited.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Orphan report (visible in `prisma migrate deploy` output / Postgres log)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  orphans bigint;
BEGIN
  SELECT count(*) INTO orphans
  FROM "AutomationRule" ar
  LEFT JOIN "User" u ON u.id = ar."createdBy"
  WHERE ar."createdBy" IS NOT NULL AND u.id IS NULL;
  RAISE NOTICE 'AutomationRule.createdBy orphans: %', orphans;

  SELECT count(*) INTO orphans
  FROM "FinancialPeriod" fp
  LEFT JOIN "User" u ON u.id = fp."closedBy"
  WHERE fp."closedBy" IS NOT NULL AND u.id IS NULL;
  RAISE NOTICE 'FinancialPeriod.closedBy orphans: %', orphans;

  SELECT count(*) INTO orphans
  FROM "GamificationXpEvent" g
  LEFT JOIN "Student" s ON s.id = g."studentId"
  WHERE s.id IS NULL;
  RAISE NOTICE 'GamificationXpEvent.studentId orphans: %', orphans;

  SELECT count(*) INTO orphans
  FROM "ApiKey" k
  LEFT JOIN "User" u ON u.id = k."createdBy"
  WHERE k."createdBy" IS NOT NULL AND u.id IS NULL;
  RAISE NOTICE 'ApiKey.createdBy orphans: %', orphans;
END $$;

-- ---------------------------------------------------------------------------
-- Clean orphans BEFORE adding constraints (so deploy never fails mid-way)
-- ---------------------------------------------------------------------------

-- creator / closer columns: keep the row, drop the dangling reference
UPDATE "AutomationRule" ar
SET "createdBy" = NULL
WHERE ar."createdBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = ar."createdBy");

UPDATE "FinancialPeriod" fp
SET "closedBy" = NULL
WHERE fp."closedBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = fp."closedBy");

UPDATE "ApiKey" k
SET "createdBy" = NULL
WHERE k."createdBy" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = k."createdBy");

-- XP events are append-only audit rows: delete ones whose student is gone
DELETE FROM "GamificationXpEvent" g
WHERE NOT EXISTS (SELECT 1 FROM "Student" s WHERE s.id = g."studentId");

-- ---------------------------------------------------------------------------
-- Add constraints (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AutomationRule_createdBy_fkey'
  ) THEN
    ALTER TABLE "AutomationRule"
      ADD CONSTRAINT "AutomationRule_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinancialPeriod_closedBy_fkey'
  ) THEN
    ALTER TABLE "FinancialPeriod"
      ADD CONSTRAINT "FinancialPeriod_closedBy_fkey"
      FOREIGN KEY ("closedBy") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GamificationXpEvent_studentId_fkey'
  ) THEN
    ALTER TABLE "GamificationXpEvent"
      ADD CONSTRAINT "GamificationXpEvent_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_createdBy_fkey'
  ) THEN
    ALTER TABLE "ApiKey"
      ADD CONSTRAINT "ApiKey_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
