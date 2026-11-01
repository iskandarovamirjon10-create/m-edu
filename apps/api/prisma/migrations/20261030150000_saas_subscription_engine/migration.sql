-- SaaS Subscription Engine Forward-Only Migration
-- Add new plan and status enum values
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'START';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'STANDARD';
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'PRO';

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIALING';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'GRACE_PERIOD';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

-- Alter Subscription table
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "planId" UUID;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "maxBranches" INTEGER DEFAULT 1;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "maxEmployees" INTEGER DEFAULT 5;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "hasFaceId" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "hasAiCopilot" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "priceUzs" BIGINT DEFAULT 299000;
ALTER TABLE "Subscription" ADD COLUMN IF NOT EXISTS "gracePeriodEndsAt" TIMESTAMP(3);

-- Create SaaSPlan table
CREATE TABLE IF NOT EXISTS "SaaSPlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "nameUz" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "priceUzsPerMonth" BIGINT NOT NULL,
    "maxStudents" INTEGER NOT NULL,
    "maxBranches" INTEGER NOT NULL,
    "maxEmployees" INTEGER NOT NULL,
    "maxCameras" INTEGER NOT NULL,
    "hasFaceId" BOOLEAN NOT NULL DEFAULT false,
    "hasAiCopilot" BOOLEAN NOT NULL DEFAULT true,
    "featureFlags" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaaSPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SaaSPlan_code_key" ON "SaaSPlan"("code");
CREATE INDEX IF NOT EXISTS "SaaSPlan_code_idx" ON "SaaSPlan"("code");
CREATE INDEX IF NOT EXISTS "SaaSPlan_isActive_idx" ON "SaaSPlan"("isActive");

-- Create SubscriptionInvoice table
CREATE TABLE IF NOT EXISTS "SubscriptionInvoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "amountUzs" BIGINT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" "PaymentGateway",
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_organizationId_idx" ON "SubscriptionInvoice"("organizationId");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_subscriptionId_idx" ON "SubscriptionInvoice"("subscriptionId");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_status_idx" ON "SubscriptionInvoice"("status");

-- Create SubscriptionPayment table
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "invoiceId" UUID NOT NULL,
    "provider" "PaymentGateway" NOT NULL,
    "amountUzs" BIGINT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalTransactionId" TEXT,
    "performedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubscriptionPayment_invoiceId_idx" ON "SubscriptionPayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_externalTransactionId_idx" ON "SubscriptionPayment"("externalTransactionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_status_idx" ON "SubscriptionPayment"("status");

-- Create OrganizationUsageSnapshot table
CREATE TABLE IF NOT EXISTS "OrganizationUsageSnapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "recordedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeStudentsCount" INTEGER NOT NULL DEFAULT 0,
    "branchesCount" INTEGER NOT NULL DEFAULT 0,
    "employeesCount" INTEGER NOT NULL DEFAULT 0,
    "camerasCount" INTEGER NOT NULL DEFAULT 0,
    "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "storageBytesUsed" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "OrganizationUsageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrganizationUsageSnapshot_organizationId_recordedDate_idx" ON "OrganizationUsageSnapshot"("organizationId", "recordedDate");

-- Foreign key constraints
ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_planId_fkey";
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SaaSPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice" DROP CONSTRAINT IF EXISTS "SubscriptionInvoice_organizationId_fkey";
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice" DROP CONSTRAINT IF EXISTS "SubscriptionInvoice_subscriptionId_fkey";
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT IF EXISTS "SubscriptionPayment_invoiceId_fkey";
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationUsageSnapshot" DROP CONSTRAINT IF EXISTS "OrganizationUsageSnapshot_organizationId_fkey";
ALTER TABLE "OrganizationUsageSnapshot" ADD CONSTRAINT "OrganizationUsageSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
