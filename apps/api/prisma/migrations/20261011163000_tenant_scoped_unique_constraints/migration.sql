-- M-EDU DB-002: Tenant-scoped unique constraints migration
-- Replaces global uniqueness with organization-scoped uniqueness for:
-- 1. LibraryBook.barcode
-- 2. Employee.employeeNumber
-- 3. Certificate.certificateNumber
-- NOTE: Certificate.verificationCode remains globally @unique for public verification.

-- Strategy:
-- Step 1: Create compound unique indexes first (ensures zero-gap uniqueness enforcement).
-- Step 2: Drop legacy global unique indexes.

-- ============================================================================
-- 1. LibraryBook (organizationId, barcode)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryBook_organizationId_barcode_key" 
ON "LibraryBook"("organizationId", "barcode");

DROP INDEX IF EXISTS "LibraryBook_barcode_key";

-- ============================================================================
-- 2. Employee (organizationId, employeeNumber)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_organizationId_employeeNumber_key" 
ON "Employee"("organizationId", "employeeNumber");

DROP INDEX IF EXISTS "Employee_employeeNumber_key";

-- ============================================================================
-- 3. Certificate (organizationId, certificateNumber)
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_organizationId_certificateNumber_key" 
ON "Certificate"("organizationId", "certificateNumber");

DROP INDEX IF EXISTS "Certificate_certificateNumber_key";
