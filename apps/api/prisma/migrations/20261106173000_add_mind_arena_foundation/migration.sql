-- M-EDU MIND ARENA (AQL DUELLARI) — PHASE 1 FOUNDATION MIGRATION

-- CreateEnum
CREATE TYPE "AvatarRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "DuelMode" AS ENUM ('SOLO_1V1', 'TEAM_2V2');

-- CreateEnum
CREATE TYPE "DuelRoomStatus" AS ENUM ('WAITING', 'MATCHED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ArenaAvatar" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "element" TEXT NOT NULL DEFAULT 'NEON',
    "rarity" "AvatarRarity" NOT NULL DEFAULT 'COMMON',
    "thumbnailUrl" TEXT NOT NULL,
    "defaultRenderUrl" TEXT NOT NULL,
    "battleRenderUrl" TEXT NOT NULL,
    "victoryRenderUrl" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaAvatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDuelProfile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "activeAvatarId" UUID,
    "activeTitleId" UUID,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "peakRating" INTEGER NOT NULL DEFAULT 1000,
    "totalDuels" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalQuestionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "correctAnswersCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpeedBonus" INTEGER NOT NULL DEFAULT 0,
    "seasonNumber" INTEGER NOT NULL DEFAULT 1,
    "lastBattleAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDuelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAvatarUnlock" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "avatarId" UUID NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlockedVia" TEXT NOT NULL DEFAULT 'INITIAL_CATALOG',

    CONSTRAINT "StudentAvatarUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaTitle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT DEFAULT '🎖️',
    "rarity" "AvatarRarity" NOT NULL DEFAULT 'COMMON',
    "requirementType" TEXT NOT NULL DEFAULT 'DEFAULT',
    "requirementValue" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentArenaTitle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studentId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "earnedVia" TEXT NOT NULL DEFAULT 'ACHIEVEMENT',

    CONSTRAINT "StudentArenaTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelRoom" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "mode" "DuelMode" NOT NULL DEFAULT 'SOLO_1V1',
    "status" "DuelRoomStatus" NOT NULL DEFAULT 'WAITING',
    "subjectId" UUID,
    "winnerTeam" INTEGER,
    "totalRounds" INTEGER NOT NULL DEFAULT 5,
    "timePerRoundSec" INTEGER NOT NULL DEFAULT 15,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuelRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuelParticipant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "teamNumber" INTEGER NOT NULL DEFAULT 1,
    "score" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "speedBonus" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "ratingChange" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuelParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArenaAvatar_slug_key" ON "ArenaAvatar"("slug");

-- CreateIndex
CREATE INDEX "ArenaAvatar_rarity_idx" ON "ArenaAvatar"("rarity");

-- CreateIndex
CREATE INDEX "ArenaAvatar_isActive_sortOrder_idx" ON "ArenaAvatar"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDuelProfile_studentId_key" ON "StudentDuelProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentDuelProfile_organizationId_rating_idx" ON "StudentDuelProfile"("organizationId", "rating" DESC);

-- CreateIndex
CREATE INDEX "StudentDuelProfile_organizationId_wins_idx" ON "StudentDuelProfile"("organizationId", "wins" DESC);

-- CreateIndex
CREATE INDEX "StudentDuelProfile_studentId_idx" ON "StudentDuelProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentAvatarUnlock_organizationId_studentId_idx" ON "StudentAvatarUnlock"("organizationId", "studentId");

-- CreateIndex
CREATE INDEX "StudentAvatarUnlock_avatarId_idx" ON "StudentAvatarUnlock"("avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAvatarUnlock_studentId_avatarId_key" ON "StudentAvatarUnlock"("studentId", "avatarId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaTitle_slug_key" ON "ArenaTitle"("slug");

-- CreateIndex
CREATE INDEX "ArenaTitle_rarity_idx" ON "ArenaTitle"("rarity");

-- CreateIndex
CREATE INDEX "ArenaTitle_isActive_idx" ON "ArenaTitle"("isActive");

-- CreateIndex
CREATE INDEX "StudentArenaTitle_organizationId_studentId_idx" ON "StudentArenaTitle"("organizationId", "studentId");

-- CreateIndex
CREATE INDEX "StudentArenaTitle_titleId_idx" ON "StudentArenaTitle"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentArenaTitle_studentId_titleId_key" ON "StudentArenaTitle"("studentId", "titleId");

-- CreateIndex
CREATE INDEX "DuelRoom_organizationId_status_idx" ON "DuelRoom"("organizationId", "status");

-- CreateIndex
CREATE INDEX "DuelRoom_subjectId_idx" ON "DuelRoom"("subjectId");

-- CreateIndex
CREATE INDEX "DuelParticipant_roomId_idx" ON "DuelParticipant"("roomId");

-- CreateIndex
CREATE INDEX "DuelParticipant_studentId_idx" ON "DuelParticipant"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DuelParticipant_roomId_studentId_key" ON "DuelParticipant"("roomId", "studentId");

-- AddForeignKey
ALTER TABLE "StudentDuelProfile" ADD CONSTRAINT "StudentDuelProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDuelProfile" ADD CONSTRAINT "StudentDuelProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDuelProfile" ADD CONSTRAINT "StudentDuelProfile_activeAvatarId_fkey" FOREIGN KEY ("activeAvatarId") REFERENCES "ArenaAvatar"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDuelProfile" ADD CONSTRAINT "StudentDuelProfile_activeTitleId_fkey" FOREIGN KEY ("activeTitleId") REFERENCES "ArenaTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvatarUnlock" ADD CONSTRAINT "StudentAvatarUnlock_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvatarUnlock" ADD CONSTRAINT "StudentAvatarUnlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAvatarUnlock" ADD CONSTRAINT "StudentAvatarUnlock_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "ArenaAvatar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentArenaTitle" ADD CONSTRAINT "StudentArenaTitle_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentArenaTitle" ADD CONSTRAINT "StudentArenaTitle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentArenaTitle" ADD CONSTRAINT "StudentArenaTitle_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "ArenaTitle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelRoom" ADD CONSTRAINT "DuelRoom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelRoom" ADD CONSTRAINT "DuelRoom_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelParticipant" ADD CONSTRAINT "DuelParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "DuelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuelParticipant" ADD CONSTRAINT "DuelParticipant_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
