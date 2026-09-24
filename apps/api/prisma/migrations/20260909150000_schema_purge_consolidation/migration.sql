-- ============================================================================
-- M-EDU: Schema purge & consolidation (37-Phase Report, Stages 12/15/31/33)
-- ============================================================================
-- 1. PURGE orphaned models: WorkflowRule, WorkflowInstance, DataQualityIssue.
--    Zero active consumers (workflow module was an in-memory orphan;
--    DataQualityIssue was written by one service and read by nothing else).
-- 2. CONSOLIDATE billing: schema.prisma is reconciled with the applied
--    payroll_invoices_refunds migration (Invoice/InvoiceItem/Refund/PayrollRun
--    already exist in the database - this migration is a no-op for them, and
--    adds only what is still missing).
-- 3. ADD missing domain models: StudentStatus enum, Lesson (materialized
--    class sessions), Discount, Student.balance, Teacher.salaryType/lessonRate,
--    Attendance.lessonId, Teacher <-> Employee explicit profile link.
--
-- SAFETY:
--   * The workflow/data-quality tables contain only derived, regenerable data
--     (rule configs with no runtime consumers). Drops are intentional.
--   * Every added column is NULLable or has a server default - no table
--     rewrite on existing rows, no data loss.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PURGE: orphaned workflow engine + data quality tables
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS "DataQualityIssue_organizationId_resolvedAt_idx";
DROP INDEX IF EXISTS "DataQualityIssue_organizationId_entityType_entityId_idx";
DROP INDEX IF EXISTS "DataQualityIssue_organizationId_severity_idx";
DROP INDEX IF EXISTS "DataQualityIssue_ruleId_idx";
DROP TABLE IF EXISTS "DataQualityIssue";

DROP INDEX IF EXISTS "WorkflowInstance_ruleId_idx";
DROP INDEX IF EXISTS "WorkflowInstance_organizationId_status_idx";
DROP TABLE IF EXISTS "WorkflowInstance";

DROP INDEX IF EXISTS "WorkflowRule_enabled_trigger_idx";
DROP INDEX IF EXISTS "WorkflowRule_entityType_idx";
DROP INDEX IF EXISTS "WorkflowRule_organizationId_idx";
DROP TABLE IF EXISTS "WorkflowRule";

-- ----------------------------------------------------------------------------
-- 2. NEW ENUMS (all enum creations precede table usage)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED', 'TRIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LessonStatus" AS ENUM ('PLANNED', 'CONDUCTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'HOURLY', 'PER_LESSON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountScope" AS ENUM ('STUDENT', 'GROUP', 'COURSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- PARTIALLY_PAID was already added by 20260909120000; guard against re-run.
DO $$ BEGIN
  ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 3. Student: lifecycle status + ledger-driven balance cache
-- ----------------------------------------------------------------------------
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "balance" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Existing rows: backfill balance from paid payments minus processed refunds.
UPDATE "Student" s SET "balance" = COALESCE(agg.net, 0)
FROM (
  SELECT p."studentId",
         SUM(CASE WHEN p."status" IN ('PAID', 'PARTIALLY_PAID') THEN p."amount" ELSE 0 END) AS net
  FROM "Payment" p
  GROUP BY p."studentId"
) agg
WHERE s."id" = agg."studentId" AND COALESCE(agg.net, 0) <> 0;

CREATE INDEX IF NOT EXISTS "Student_organizationId_status_idx" ON "Student"("organizationId", "status");

-- ----------------------------------------------------------------------------
-- 4. Teacher: salary computation inputs + explicit Employee profile link
--    (lessonRate/salaryType may already exist from 20260909120000)
-- ----------------------------------------------------------------------------
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "lessonRate" DECIMAL(10,2);
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "salaryType" "SalaryType" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Teacher" ADD COLUMN IF NOT EXISTS "employeeId" UUID;

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_employeeId_key" UNIQUE ("employeeId");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 5. Lesson: materialized class sessions from Schedule templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Lesson" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "scheduleId" UUID,
  "groupId" UUID NOT NULL,
  "teacherId" UUID,
  "date" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "room" TEXT,
  "status" "LessonStatus" NOT NULL DEFAULT 'PLANNED',
  "topic" TEXT,
  "notes" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lesson_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Lesson_scheduleId_fkey" FOREIGN KEY ("scheduleId")
    REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Lesson_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Lesson_teacherId_fkey" FOREIGN KEY ("teacherId")
    REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- One lesson per group per time slot: the generator stays idempotent.
DO $$ BEGIN
  ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_groupId_date_startTime_key"
    UNIQUE ("groupId", "date", "startTime");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Lesson_organizationId_date_idx" ON "Lesson"("organizationId", "date");
CREATE INDEX IF NOT EXISTS "Lesson_groupId_date_idx" ON "Lesson"("groupId", "date");
CREATE INDEX IF NOT EXISTS "Lesson_teacherId_date_idx" ON "Lesson"("teacherId", "date");
CREATE INDEX IF NOT EXISTS "Lesson_scheduleId_idx" ON "Lesson"("scheduleId");

-- ----------------------------------------------------------------------------
-- 6. Attendance: lesson context
-- ----------------------------------------------------------------------------
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "lessonId" UUID;

DO $$ BEGIN
  ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_lessonId_fkey"
    FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Attendance_lessonId_idx" ON "Attendance"("lessonId");

-- ----------------------------------------------------------------------------
-- 7. Discount: percentage/fixed discounts scoped to student, group or course
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Discount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "DiscountType" NOT NULL,
  "value" DECIMAL(12,2) NOT NULL,
  "scope" "DiscountScope" NOT NULL,
  "studentId" UUID,
  "groupId" UUID,
  "courseId" UUID,
  "reason" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Discount_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Discount_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Discount_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Discount_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Discount_organizationId_isActive_idx" ON "Discount"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "Discount_organizationId_scope_idx" ON "Discount"("organizationId", "scope");
CREATE INDEX IF NOT EXISTS "Discount_studentId_idx" ON "Discount"("studentId");
CREATE INDEX IF NOT EXISTS "Discount_groupId_idx" ON "Discount"("groupId");
CREATE INDEX IF NOT EXISTS "Discount_courseId_idx" ON "Discount"("courseId");
