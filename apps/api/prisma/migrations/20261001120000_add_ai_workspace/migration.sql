-- Canonical AI workspace persistence: conversations, messages and durable actions.
-- Every table is tenant-scoped by "organizationId"; indexes cover organization,
-- conversation, timestamps, action status and expiry.

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
  "title" TEXT,
  "preview" TEXT,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "archivedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "toolCalls" JSONB,
    "toolResult" JSONB,
    "actionId" UUID,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAction" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "messageId" UUID,
    "createdBy" UUID NOT NULL,
    "toolName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "summary" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiConversation_organizationId_updatedAt_idx" ON "AiConversation"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiConversation_organizationId_createdBy_idx" ON "AiConversation"("organizationId", "createdBy");

-- CreateIndex
CREATE INDEX "AiConversation_organizationId_archivedAt_idx" ON "AiConversation"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "AiMessage_organizationId_idx" ON "AiMessage"("organizationId");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiAction_organizationId_status_idx" ON "AiAction"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AiAction_conversationId_idx" ON "AiAction"("conversationId");

-- CreateIndex
CREATE INDEX "AiAction_expiresAt_idx" ON "AiAction"("expiresAt");

-- CreateIndex
CREATE INDEX "AiAction_status_expiresAt_idx" ON "AiAction"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
