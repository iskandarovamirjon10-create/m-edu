-- Homework submission lifecycle: students submit, teachers grade.
--
-- One submission per (homework, student); a resubmission updates the same row,
-- which the unique index below enforces at the database level. The submission
-- deadline signal (isLate) feeds the academic-risk model.
--
-- NOTE (history): this migration previously rebuilt the "Homework" table via a
-- `new_Homework` copy in order to re-create its primary key and indexes. The
-- rebuild was both unnecessary (20260904185715_init already creates every
-- column and both indexes) and fatal: creating a PK constraint named
-- "Homework_pkey" on the new table collided with the index of the same name
-- that still existed on the live "Homework" table, so the migration failed with
-- `relation "Homework_pkey" already exists` (42P07) on every database. The
-- rebuild is removed; no data is copied, dropped or relocked.

CREATE TYPE "HomeworkSubmissionStatus" AS ENUM (
  'SUBMITTED',
  'RETURNED',
  'GRADED',
  'RESUBMISSION_REQUIRED'
);

CREATE TABLE "HomeworkSubmission" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "homeworkId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "HomeworkSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "content" TEXT,
    "fileUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resubmittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "gradedBy" UUID,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");
CREATE INDEX "HomeworkSubmission_organizationId_idx" ON "HomeworkSubmission"("organizationId");
CREATE INDEX "HomeworkSubmission_homeworkId_idx" ON "HomeworkSubmission"("homeworkId");
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");
CREATE INDEX "HomeworkSubmission_status_idx" ON "HomeworkSubmission"("status");

ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
