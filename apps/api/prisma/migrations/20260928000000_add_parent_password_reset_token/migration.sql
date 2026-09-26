-- CreateTable
CREATE TABLE IF NOT EXISTS "ParentPasswordResetToken" (
    "id" UUID NOT NULL,
    "parentId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ParentPasswordResetToken_tokenHash_key" ON "ParentPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentPasswordResetToken_parentId_idx" ON "ParentPasswordResetToken"("parentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentPasswordResetToken_tokenHash_idx" ON "ParentPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentPasswordResetToken_expiresAt_idx" ON "ParentPasswordResetToken"("expiresAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParentPasswordResetToken_parentId_fkey') THEN
    ALTER TABLE "ParentPasswordResetToken"
      ADD CONSTRAINT "ParentPasswordResetToken_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "ParentAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
