-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PARENT';

-- DropForeignKey
ALTER TABLE "HomeworkSubmission" DROP CONSTRAINT "HomeworkSubmission_homeworkId_fkey";

-- DropForeignKey
ALTER TABLE "HomeworkSubmission" DROP CONSTRAINT "HomeworkSubmission_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ParentSession" DROP CONSTRAINT "ParentSession_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "ParentSession" DROP CONSTRAINT "ParentSession_parentId_fkey";

-- DropIndex
DROP INDEX "ApiKey_keyHash_idx";

-- DropIndex
DROP INDEX "ApiKey_keyHash_key";

-- DropIndex
DROP INDEX "ApiKey_organizationId_idx";

-- DropIndex
DROP INDEX "Branch_managerId_idx";

-- DropIndex
DROP INDEX "Branch_organizationId_idx";

-- DropIndex
DROP INDEX "Document_title_idx";

-- DropIndex
DROP INDEX "LibraryBook_isbn_idx";

-- DropIndex
DROP INDEX "NotificationDedup_dedupKey_idx";

-- DropIndex
DROP INDEX "Organization_email_idx";

-- DropIndex
DROP INDEX "ParentSession_parentId_idx";

-- DropIndex
DROP INDEX "Student_branchId_idx";

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "key" TEXT NOT NULL,
ALTER COLUMN "rateLimit" SET DEFAULT 100;

-- AlterTable
ALTER TABLE "AutomationExecution" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "AutomationRule" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "timezone" TEXT,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "CommunicationHistory" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "DataExportLog" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "DataQualityIssue" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "DataRetentionPolicy" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "FinancialPeriod" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "FollowUpRule" ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "GamificationXpEvent" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "branchId" UUID;

-- AlterTable
ALTER TABLE "HomeworkSubmission" RENAME COLUMN "score" TO "grade";

-- AlterTable
ALTER TABLE "HomeworkSubmission"
ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "homeworkId" SET NOT NULL,
ALTER COLUMN "status" TYPE TEXT USING "status"::text,
ALTER COLUMN "status" SET DEFAULT 'SUBMITTED',
ALTER COLUMN "updatedAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "NotificationDedup" ALTER COLUMN "entityType" SET NOT NULL,
ALTER COLUMN "entityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ParentSession" ADD COLUMN     "deviceInfo" TEXT,
ADD COLUMN     "token" TEXT NOT NULL DEFAULT gen_random_uuid(),
ALTER COLUMN "organizationId" DROP NOT NULL,
ALTER COLUMN "lastActiveAt" DROP NOT NULL,
ALTER COLUMN "lastActiveAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReceiptCounter" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
UPDATE "Student" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

ALTER TABLE "Student" ALTER COLUMN "enrollmentDate" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "status" SET NOT NULL;

-- AlterTable
ALTER TABLE "StudentGamification" ADD COLUMN     "currentXp" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveDate" TIMESTAMP(3),
ADD COLUMN     "streakDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalXp" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- DropEnum
DROP TYPE "HomeworkSubmissionStatus";

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE INDEX "Certificate_certificateNumber_idx" ON "Certificate"("certificateNumber");

-- CreateIndex
CREATE INDEX "Certificate_verificationCode_idx" ON "Certificate"("verificationCode");

-- CreateIndex
-- Omitted index recreation

-- CreateIndex
CREATE UNIQUE INDEX "ParentSession_token_key" ON "ParentSession"("token");

-- CreateIndex
CREATE INDEX "Payment_reference_idx" ON "Payment"("reference");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentSession" ADD CONSTRAINT "ParentSession_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGamification" ADD CONSTRAINT "StudentGamification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGamification" ADD CONSTRAINT "StudentGamification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

