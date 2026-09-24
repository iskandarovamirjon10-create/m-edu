-- Universal search acceleration: trigram (pg_trgm) GIN indexes.
--
-- The search endpoints previously scanned every row of the tenant's table with
-- ILIKE '%term%' (sequential scan per keystroke). These GIN trigram indexes let
-- PostgreSQL answer contains-style matches via index scans.
--
-- Column names are the ACTUAL Prisma/PostgreSQL names (camelCase: "firstName",
-- "lastName"). An earlier revision of this file used snake_case names and
-- failed with `column "first_name" does not exist` (42703).
--
-- These indexes are declared in schema.prisma (type: Gin + gin_trgm_ops, with
-- `map` so the names match), which is why they are created here by hand:
-- Prisma does not emit operator-class indexes on its own.
--
-- ON A LARGE EXISTING DATABASE: a plain CREATE INDEX takes a SHARE lock, which
-- blocks writes for the duration of the build. Prisma wraps each migration in a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run inside a transaction
-- (`25001`), so concurrency is not available here. Release procedure: build the
-- indexes out-of-band with CREATE INDEX CONCURRENTLY, then record this
-- migration as applied (prisma migrate resolve --applied). The statements are
-- IF NOT EXISTS, so they are no-ops when the indexes already exist.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users: name/email/phone lookup in the admin user list and global search.
CREATE INDEX IF NOT EXISTS "user_first_name_trgm_idx" ON "User" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_last_name_trgm_idx" ON "User" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_email_trgm_idx" ON "User" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "user_phone_trgm_idx" ON "User" USING gin ("phone" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "group_name_trgm_idx" ON "Group" USING gin ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "course_name_trgm_idx" ON "Course" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "course_description_trgm_idx" ON "Course" USING gin ("description" gin_trgm_ops);

-- CRM: fuzzy lead search by name/contact.
CREATE INDEX IF NOT EXISTS "lead_first_name_trgm_idx" ON "Lead" USING gin ("firstName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_last_name_trgm_idx" ON "Lead" USING gin ("lastName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_email_trgm_idx" ON "Lead" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lead_phone_trgm_idx" ON "Lead" USING gin ("phone" gin_trgm_ops);

-- Payments: receipt/reference lookup and description search.
CREATE INDEX IF NOT EXISTS "payment_description_trgm_idx" ON "Payment" USING gin ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "payment_reference_trgm_idx" ON "Payment" USING gin ("reference" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "employee_position_trgm_idx" ON "Employee" USING gin ("position" gin_trgm_ops);

-- Library catalogue search.
CREATE INDEX IF NOT EXISTS "library_book_title_trgm_idx" ON "LibraryBook" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_author_trgm_idx" ON "LibraryBook" USING gin ("author" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_isbn_trgm_idx" ON "LibraryBook" USING gin ("isbn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "library_book_barcode_trgm_idx" ON "LibraryBook" USING gin ("barcode" gin_trgm_ops);

-- Public certificate verification lookup.
CREATE INDEX IF NOT EXISTS "certificate_number_trgm_idx" ON "Certificate" USING gin ("certificateNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "certificate_verification_code_trgm_idx" ON "Certificate" USING gin ("verificationCode" gin_trgm_ops);
