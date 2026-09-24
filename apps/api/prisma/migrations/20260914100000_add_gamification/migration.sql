-- Gamification: XP, coins and levels per student, plus an append-only XP
-- event ledger used both for idempotent awarding and the recent-activity UI.

CREATE TYPE "GamificationEventType" AS ENUM (
  'ATTENDANCE_ON_TIME',
  'HOMEWORK_ON_TIME_GOOD_GRADE',
  'EXAM_HIGH_SCORE'
);

CREATE TABLE "StudentGamification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGamification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamificationXpEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "GamificationEventType" NOT NULL,
    "xp" INTEGER NOT NULL,
    "coins" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamificationXpEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentGamification_studentId_key" ON "StudentGamification"("studentId");
CREATE INDEX "StudentGamification_organizationId_xp_idx" ON "StudentGamification"("organizationId", "xp" DESC);
CREATE INDEX "StudentGamification_organizationId_level_idx" ON "StudentGamification"("organizationId", "level" DESC);
CREATE INDEX "StudentGamification_organizationId_idx" ON "StudentGamification"("organizationId");

CREATE UNIQUE INDEX "GamificationXpEvent_studentId_type_refId_key" ON "GamificationXpEvent"("studentId", "type", "refId");
CREATE INDEX "GamificationXpEvent_organizationId_createdAt_idx" ON "GamificationXpEvent"("organizationId", "createdAt" DESC);
CREATE INDEX "GamificationXpEvent_studentId_idx" ON "GamificationXpEvent"("studentId");

ALTER TABLE "StudentGamification" ADD CONSTRAINT "StudentGamification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentGamification" ADD CONSTRAINT "StudentGamification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GamificationXpEvent" ADD CONSTRAINT "GamificationXpEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GamificationXpEvent" ADD CONSTRAINT "GamificationXpEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
