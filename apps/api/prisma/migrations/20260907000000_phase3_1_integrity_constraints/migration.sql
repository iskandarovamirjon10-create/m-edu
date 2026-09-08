-- Migration: 20260907000000_phase3_1_integrity_constraints
-- Phase 3.1: Second-pass cascade audit
-- Fixes 5 wrong CASCADE decisions → RESTRICT (historical records preserved)
-- Adds SetNull for FaceAuditEvent.userId (audit trail survives user deletion)
-- Adds missing opposite relation back-references (Prisma schema validation fix)

-- 1. ExamResult: CASCADE → RESTRICT
-- Historical exam results must be preserved. If an exam or student is hard-deleted,
-- the DB rejects it rather than silently destroying student results.
ALTER TABLE "ExamResult" DROP CONSTRAINT IF EXISTS "ExamResult_examId_fkey";
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT;

ALTER TABLE "ExamResult" DROP CONSTRAINT IF EXISTS "ExamResult_studentId_fkey";
ALTER TABLE "ExamResult" ADD CONSTRAINT "ExamResult_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT;

-- 2. Certificate: CASCADE → RESTRICT
-- Certificates have a PUBLIC verification endpoint (no auth, no organizationId).
-- If a student or course is hard-deleted, the DB prevents it so certificates
-- cannot be silently destroyed.
ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_studentId_fkey";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT;

ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_courseId_fkey";
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT;

-- 3. LibraryBorrow: CASCADE → RESTRICT
-- Library borrow history must be preserved for audit and reporting.
-- The library.service only checks ACTIVE borrows before book deletion.
-- Historical records (RETURNED/OVERDUE/LOST) are intentionally kept.
ALTER TABLE "LibraryBorrow" DROP CONSTRAINT IF EXISTS "LibraryBorrow_bookId_fkey";
ALTER TABLE "LibraryBorrow" ADD CONSTRAINT "LibraryBorrow_bookId_fkey"
  FOREIGN KEY ("bookId") REFERENCES "LibraryBook"("id") ON DELETE RESTRICT;

ALTER TABLE "LibraryBorrow" DROP CONSTRAINT IF EXISTS "LibraryBorrow_studentId_fkey";
ALTER TABLE "LibraryBorrow" ADD CONSTRAINT "LibraryBorrow_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT;

-- 4. FaceAuditEvent: NO ACTION → SET NULL
-- FaceAuditEvent records the audit trail of face recognition operations.
-- When a user is deleted, the audit event should survive with userId = NULL.
ALTER TABLE "FaceAuditEvent" DROP CONSTRAINT IF EXISTS "FaceAuditEvent_userId_fkey";
ALTER TABLE "FaceAuditEvent" ADD CONSTRAINT "FaceAuditEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- 5. Missing opposite relation back-references (Prisma schema validation fixes)
-- These were added to fix P1012 validation errors:
-- ParentStudent ↔ Student (ParentStudent.studentId → Student)
-- ParentStudent ↔ ParentAccount (ParentStudent.parentId → ParentAccount)
-- Payment ↔ PaymentTransaction (PaymentTransaction.paymentId → Payment)
-- UserRole ↔ CustomRole (UserRole.roleId → CustomRole ON DELETE CASCADE)
-- NotificationPreference ↔ User (NotificationPreference.userId ON DELETE CASCADE)
-- Note: Prisma adds implicit back-references automatically when relations are defined.
-- The schema now has explicit back-edges on User.parentStudents and User.userRoles.
