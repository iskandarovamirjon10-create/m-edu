-- CreateTable
CREATE TABLE IF NOT EXISTS "AccessWhitelist" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" DEFAULT 'ORG_ADMIN',
    "note" TEXT,
    "addedBy" UUID,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessWhitelist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccessControlConfig" (
    "id" TEXT NOT NULL,
    "inviteOnly" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "AccessControlConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AccessWhitelist_email_key" ON "AccessWhitelist"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessWhitelist_email_idx" ON "AccessWhitelist"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccessWhitelist_organizationId_idx" ON "AccessWhitelist"("organizationId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AccessWhitelist_addedBy_fkey'
    ) THEN
        ALTER TABLE "AccessWhitelist" ADD CONSTRAINT "AccessWhitelist_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AccessWhitelist_organizationId_fkey'
    ) THEN
        ALTER TABLE "AccessWhitelist" ADD CONSTRAINT "AccessWhitelist_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
