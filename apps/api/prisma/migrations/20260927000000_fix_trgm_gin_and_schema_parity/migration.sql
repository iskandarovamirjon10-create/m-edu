-- Migration: 20260927000000_fix_trgm_gin_and_schema_parity
-- Purpose:
-- 1. Ensure pg_trgm extension is active.
-- 2. Drop all legacy BTREE *trgm* indexes and recreate them using GIN with gin_trgm_ops.
-- 3. Drop redundant ApiKey_keyHash_idx (since ApiKey_keyHash_key already enforces unique btree on keyHash).
-- 4. Ensure useful foreign key / lookup indexes exist.
-- 5. Ensure UserSettings.quietHoursEnabled is NOT NULL DEFAULT false.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop redundant duplicate index on ApiKey(keyHash)
DROP INDEX IF EXISTS "ApiKey_keyHash_idx";

-- Drop legacy BTREE trigram indexes and recreate as GIN with gin_trgm_ops
DROP INDEX IF EXISTS "course_description_trgm_idx";
CREATE INDEX "course_description_trgm_idx" ON "Course" USING gin ("description" gin_trgm_ops);

DROP INDEX IF EXISTS "course_name_trgm_idx";
CREATE INDEX "course_name_trgm_idx" ON "Course" USING gin ("name" gin_trgm_ops);

DROP INDEX IF EXISTS "employee_position_trgm_idx";
CREATE INDEX "employee_position_trgm_idx" ON "Employee" USING gin ("position" gin_trgm_ops);

DROP INDEX IF EXISTS "group_name_trgm_idx";
CREATE INDEX "group_name_trgm_idx" ON "Group" USING gin ("name" gin_trgm_ops);

DROP INDEX IF EXISTS "lead_email_trgm_idx";
CREATE INDEX "lead_email_trgm_idx" ON "Lead" USING gin ("email" gin_trgm_ops);

DROP INDEX IF EXISTS "lead_first_name_trgm_idx";
CREATE INDEX "lead_first_name_trgm_idx" ON "Lead" USING gin ("firstName" gin_trgm_ops);

DROP INDEX IF EXISTS "lead_last_name_trgm_idx";
CREATE INDEX "lead_last_name_trgm_idx" ON "Lead" USING gin ("lastName" gin_trgm_ops);

DROP INDEX IF EXISTS "lead_phone_trgm_idx";
CREATE INDEX "lead_phone_trgm_idx" ON "Lead" USING gin ("phone" gin_trgm_ops);

DROP INDEX IF EXISTS "library_book_author_trgm_idx";
CREATE INDEX "library_book_author_trgm_idx" ON "LibraryBook" USING gin ("author" gin_trgm_ops);

DROP INDEX IF EXISTS "library_book_barcode_trgm_idx";
CREATE INDEX "library_book_barcode_trgm_idx" ON "LibraryBook" USING gin ("barcode" gin_trgm_ops);

DROP INDEX IF EXISTS "library_book_isbn_trgm_idx";
CREATE INDEX "library_book_isbn_trgm_idx" ON "LibraryBook" USING gin ("isbn" gin_trgm_ops);

DROP INDEX IF EXISTS "library_book_title_trgm_idx";
CREATE INDEX "library_book_title_trgm_idx" ON "LibraryBook" USING gin ("title" gin_trgm_ops);

DROP INDEX IF EXISTS "payment_description_trgm_idx";
CREATE INDEX "payment_description_trgm_idx" ON "Payment" USING gin ("description" gin_trgm_ops);

DROP INDEX IF EXISTS "payment_reference_trgm_idx";
CREATE INDEX "payment_reference_trgm_idx" ON "Payment" USING gin ("reference" gin_trgm_ops);

DROP INDEX IF EXISTS "user_email_trgm_idx";
CREATE INDEX "user_email_trgm_idx" ON "User" USING gin ("email" gin_trgm_ops);

DROP INDEX IF EXISTS "user_first_name_trgm_idx";
CREATE INDEX "user_first_name_trgm_idx" ON "User" USING gin ("firstName" gin_trgm_ops);

DROP INDEX IF EXISTS "user_last_name_trgm_idx";
CREATE INDEX "user_last_name_trgm_idx" ON "User" USING gin ("lastName" gin_trgm_ops);

DROP INDEX IF EXISTS "user_phone_trgm_idx";
CREATE INDEX "user_phone_trgm_idx" ON "User" USING gin ("phone" gin_trgm_ops);

DROP INDEX IF EXISTS "certificate_number_trgm_idx";
CREATE INDEX "certificate_number_trgm_idx" ON "Certificate" USING gin ("certificateNumber" gin_trgm_ops);

DROP INDEX IF EXISTS "certificate_verification_code_trgm_idx";
CREATE INDEX "certificate_verification_code_trgm_idx" ON "Certificate" USING gin ("verificationCode" gin_trgm_ops);

-- Ensure non-trigram phantom indexes exist
CREATE INDEX IF NOT EXISTS "Branch_organizationId_idx" ON "Branch"("organizationId");
CREATE INDEX IF NOT EXISTS "Branch_managerId_idx" ON "Branch"("managerId");
CREATE INDEX IF NOT EXISTS "Document_title_idx" ON "Document"("title");
CREATE INDEX IF NOT EXISTS "LibraryBook_isbn_idx" ON "LibraryBook"("isbn");
CREATE INDEX IF NOT EXISTS "Organization_email_idx" ON "Organization"("email");
CREATE INDEX IF NOT EXISTS "ParentSession_parentId_idx" ON "ParentSession"("parentId");
CREATE INDEX IF NOT EXISTS "Student_branchId_idx" ON "Student"("branchId");

-- Ensure UserSettings.quietHoursEnabled nullability and default
UPDATE "UserSettings" SET "quietHoursEnabled" = false WHERE "quietHoursEnabled" IS NULL;
ALTER TABLE "UserSettings" ALTER COLUMN "quietHoursEnabled" SET NOT NULL;
ALTER TABLE "UserSettings" ALTER COLUMN "quietHoursEnabled" SET DEFAULT false;
