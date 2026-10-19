-- M-EDU ATT-002: Multi-lesson attendance uniqueness migration
-- Allows independent, non-overwriting attendance records for multiple lessons on the same day per group,
-- while strictly enforcing that a student can only have one attendance record per lesson,
-- and preventing duplicate daily attendance when lessonId is NULL.

-- 1. Drop the legacy single-daily-attendance unique index
DROP INDEX IF EXISTS "Attendance_studentId_groupId_date_key";

-- 2. Create the per-lesson unique index
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_studentId_lessonId_key" ON "Attendance"("studentId", "lessonId");

-- 3. Create the partial unique index for unlinked / legacy daily attendance
CREATE UNIQUE INDEX IF NOT EXISTS "Attendance_studentId_groupId_date_null_lesson_idx" ON "Attendance"("studentId", "groupId", "date") WHERE "lessonId" IS NULL;

-- 4. Create composite index for querying attendance by student, group, and date
CREATE INDEX IF NOT EXISTS "Attendance_studentId_groupId_date_idx" ON "Attendance"("studentId", "groupId", "date");
