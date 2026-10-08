-- AlterTable
ALTER TABLE "AccessControlConfig" ALTER COLUMN "id" SET DEFAULT 'global';

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "markedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RecognitionAttempt" ADD COLUMN IF NOT EXISTS "attendanceDecision" TEXT,
ADD COLUMN IF NOT EXISTS "attendanceId" UUID,
ADD COLUMN IF NOT EXISTS "clientAttemptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RecognitionAttempt_clientAttemptId_key" ON "RecognitionAttempt"("clientAttemptId");
