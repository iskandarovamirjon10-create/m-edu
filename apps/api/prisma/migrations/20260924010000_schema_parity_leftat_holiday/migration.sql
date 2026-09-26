-- ============================================================================
-- Schema parity repair: `StudentGroup.leftAt` column and `OrganizationHoliday`
-- table are declared in schema.prisma but were never created by any migration.
--
-- Impact: Prisma Client selects every scalar field of a model, so each and every
-- `studentGroup.findMany` / `findFirst` / `create` / `upsert` / `count` —
-- attendance, grades, exams, certificates, analytics, camera decisions,
-- relationships, students, groups — failed at runtime with P2022
-- ("column StudentGroup.leftAt does not exist") on any database built from the
-- migration history alone, i.e. production, staging and a fresh CI database.
--
-- The long-lived development database had drifted ahead of the migration history
-- (consistent with a `prisma db push` having been run against it), so the gap was
-- invisible on the machine it was written on while `prisma migrate status`
-- reported "up to date".
--
-- Idempotent: safe to run against a database that already contains them.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- StudentGroup.leftAt (nullable — existing rows keep meaning "still active")
-- ---------------------------------------------------------------------------
ALTER TABLE "StudentGroup" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- OrganizationHoliday
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "OrganizationHoliday" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "OrganizationHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationHoliday_organizationId_date_key"
    ON "OrganizationHoliday"("organizationId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationHoliday_organizationId_fkey'
  ) THEN
    ALTER TABLE "OrganizationHoliday"
      ADD CONSTRAINT "OrganizationHoliday_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
