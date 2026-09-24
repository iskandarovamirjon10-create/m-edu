-- DropIndex
DROP INDEX "ApiKey_key_key";

-- DropIndex
DROP INDEX "certificate_number_trgm_idx";

-- DropIndex
DROP INDEX "certificate_verification_code_trgm_idx";

-- DropIndex
DROP INDEX "course_description_trgm_idx";

-- DropIndex
DROP INDEX "course_name_trgm_idx";

-- DropIndex
DROP INDEX "employee_position_trgm_idx";

-- DropIndex
DROP INDEX "FaceEnrollment_organizationId_studentId_status_key";

-- DropIndex
DROP INDEX "group_name_trgm_idx";

-- DropIndex
DROP INDEX "lead_email_trgm_idx";

-- DropIndex
DROP INDEX "lead_first_name_trgm_idx";

-- DropIndex
DROP INDEX "lead_last_name_trgm_idx";

-- DropIndex
DROP INDEX "lead_phone_trgm_idx";

-- DropIndex
DROP INDEX "library_book_author_trgm_idx";

-- DropIndex
DROP INDEX "library_book_barcode_trgm_idx";

-- DropIndex
DROP INDEX "library_book_isbn_trgm_idx";

-- DropIndex
DROP INDEX "library_book_title_trgm_idx";

-- DropIndex
DROP INDEX "payment_description_trgm_idx";

-- DropIndex
DROP INDEX "payment_reference_trgm_idx";

-- DropIndex
DROP INDEX "user_email_trgm_idx";

-- DropIndex
DROP INDEX "user_first_name_trgm_idx";

-- DropIndex
DROP INDEX "user_last_name_trgm_idx";

-- DropIndex
DROP INDEX "user_phone_trgm_idx";

-- AlterTable
ALTER TABLE "ApiKey" DROP COLUMN "key";

-- CreateIndex
CREATE INDEX "course_name_trgm_idx" ON "Course"("name");

-- CreateIndex
CREATE INDEX "course_description_trgm_idx" ON "Course"("description");

-- CreateIndex
CREATE INDEX "employee_position_trgm_idx" ON "Employee"("position");

-- CreateIndex
CREATE INDEX "group_name_trgm_idx" ON "Group"("name");

-- CreateIndex
CREATE INDEX "lead_first_name_trgm_idx" ON "Lead"("firstName");

-- CreateIndex
CREATE INDEX "lead_last_name_trgm_idx" ON "Lead"("lastName");

-- CreateIndex
CREATE INDEX "lead_email_trgm_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "lead_phone_trgm_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "library_book_title_trgm_idx" ON "LibraryBook"("title");

-- CreateIndex
CREATE INDEX "library_book_author_trgm_idx" ON "LibraryBook"("author");

-- CreateIndex
CREATE INDEX "library_book_isbn_trgm_idx" ON "LibraryBook"("isbn");

-- CreateIndex
CREATE INDEX "library_book_barcode_trgm_idx" ON "LibraryBook"("barcode");

-- CreateIndex
CREATE INDEX "payment_description_trgm_idx" ON "Payment"("description");

-- CreateIndex
CREATE INDEX "user_email_trgm_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "user_first_name_trgm_idx" ON "User"("firstName");

-- CreateIndex
CREATE INDEX "user_last_name_trgm_idx" ON "User"("lastName");

-- CreateIndex
CREATE INDEX "user_phone_trgm_idx" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "ParentSession" ADD CONSTRAINT "ParentSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Restore dropped indexes
CREATE INDEX IF NOT EXISTS "ApiKey_keyHash_idx" ON "ApiKey"("keyHash");
CREATE INDEX IF NOT EXISTS "ApiKey_organizationId_idx" ON "ApiKey"("organizationId");
CREATE INDEX IF NOT EXISTS "Branch_managerId_idx" ON "Branch"("managerId");
CREATE INDEX IF NOT EXISTS "Branch_organizationId_idx" ON "Branch"("organizationId");
CREATE INDEX IF NOT EXISTS "Document_title_idx" ON "Document"("title");
CREATE INDEX IF NOT EXISTS "LibraryBook_isbn_idx" ON "LibraryBook"("isbn");
CREATE INDEX IF NOT EXISTS "Organization_email_idx" ON "Organization"("email");
CREATE INDEX IF NOT EXISTS "ParentSession_parentId_idx" ON "ParentSession"("parentId");
CREATE INDEX IF NOT EXISTS "Student_branchId_idx" ON "Student"("branchId");
