-- CreateTable
CREATE TABLE "FollowUpRule" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerDays" INTEGER NOT NULL,
    "targetStage" TEXT,
    "actionType" TEXT NOT NULL,
    "channel" TEXT,
    "message" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationHistory" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "relatedEntityId" UUID,
    "relatedEntityType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpRule_organizationId_idx" ON "FollowUpRule"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationHistory_organizationId_idx" ON "CommunicationHistory"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationHistory_entityType_entityId_idx" ON "CommunicationHistory"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CommunicationHistory_channel_idx" ON "CommunicationHistory"("channel");

-- CreateIndex
CREATE INDEX "CommunicationHistory_createdAt_idx" ON "CommunicationHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "FollowUpRule" ADD CONSTRAINT "FollowUpRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationHistory" ADD CONSTRAINT "CommunicationHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

