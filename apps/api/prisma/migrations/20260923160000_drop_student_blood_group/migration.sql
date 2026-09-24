-- ============================================================================
-- P0-02 residual: historical migration 20260906000000 added Student.bloodGroup
-- but it was never promoted to schema.prisma, so Prisma Client and the model
-- do not know about it. Dropping it here aligns the live database with the
-- schema without editing the historical migration (which would drift the
-- _prisma_migrations checksum).
-- ============================================================================

ALTER TABLE "Student" DROP COLUMN IF EXISTS "bloodGroup";
