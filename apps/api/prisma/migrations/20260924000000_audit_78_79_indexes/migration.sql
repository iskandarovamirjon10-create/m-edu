-- Restore UNIQUE constraint on ApiKey.keyHash
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- Restore missing GIN Trigram Indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "user_email_trgm_idx" ON "User" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_first_name_trgm_idx" ON "User" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_last_name_trgm_idx" ON "User" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_phone_trgm_idx" ON "User" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "course_name_trgm_idx" ON "Course" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "course_description_trgm_idx" ON "Course" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "group_name_trgm_idx" ON "Group" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "payment_description_trgm_idx" ON "Payment" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "payment_reference_trgm_idx" ON "Payment" USING gin ("reference" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_first_name_trgm_idx" ON "Lead" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_last_name_trgm_idx" ON "Lead" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_email_trgm_idx" ON "Lead" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_phone_trgm_idx" ON "Lead" USING gin ("phone" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_title_trgm_idx" ON "LibraryBook" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_author_trgm_idx" ON "LibraryBook" USING gin ("author" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_isbn_trgm_idx" ON "LibraryBook" USING gin ("isbn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_barcode_trgm_idx" ON "LibraryBook" USING gin ("barcode" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "employee_position_trgm_idx" ON "Employee" USING gin ("position" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "certificate_number_trgm_idx" ON "Certificate" USING gin ("certificateNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "certificate_verification_code_trgm_idx" ON "Certificate" USING gin ("verificationCode" gin_trgm_ops);
-- Change default timezone to Asia/Tashkent
ALTER TABLE "Organization" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Tashkent';
