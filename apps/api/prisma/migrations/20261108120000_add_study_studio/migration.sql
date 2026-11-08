-- STUDY STUDIO — spaced-repetition decks, review log and focus sessions.

-- CreateTable
CREATE TABLE "StudyDeck" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(120),
    "description" TEXT,
    "accent" VARCHAR(24) NOT NULL DEFAULT 'indigo',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyCard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyReview" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "rating" VARCHAR(8) NOT NULL,
    "intervalDays" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyFocusSession" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,
    "mode" VARCHAR(16) NOT NULL DEFAULT 'FOCUS',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyFocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyDeck_userId_archived_idx" ON "StudyDeck"("userId", "archived");

-- CreateIndex
CREATE INDEX "StudyDeck_organizationId_idx" ON "StudyDeck"("organizationId");

-- CreateIndex
CREATE INDEX "StudyCard_deckId_dueAt_idx" ON "StudyCard"("deckId", "dueAt");

-- CreateIndex
CREATE INDEX "StudyCard_dueAt_idx" ON "StudyCard"("dueAt");

-- CreateIndex
CREATE INDEX "StudyReview_userId_reviewedAt_idx" ON "StudyReview"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "StudyReview_organizationId_reviewedAt_idx" ON "StudyReview"("organizationId", "reviewedAt");

-- CreateIndex
CREATE INDEX "StudyFocusSession_userId_completedAt_idx" ON "StudyFocusSession"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "StudyFocusSession_organizationId_completedAt_idx" ON "StudyFocusSession"("organizationId", "completedAt");

-- AddForeignKey
ALTER TABLE "StudyCard" ADD CONSTRAINT "StudyCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "StudyDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyReview" ADD CONSTRAINT "StudyReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "StudyCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
