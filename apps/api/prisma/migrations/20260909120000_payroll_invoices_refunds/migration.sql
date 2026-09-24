-- ============================================================================
-- M-EDU: Payroll lifecycle + Student invoices/refunds + payment receipts
-- ============================================================================
-- ADDITIVE ONLY:
--   * New enums: PayrollStatus, SalaryType, InvoiceStatus, RefundStatus
--   * New tables: PayrollRun, Invoice, InvoiceItem, Refund
--   * New columns: Teacher.lessonRate/.salaryType,
--     Payment.invoiceId/.receiptNumber/.receiptIssuedAt/.paidAt
--   * New enum value: PaymentStatus.PARTIALLY_PAID (added last - PG cannot
--     use a freshly added enum value inside the same transaction).
-- No column is dropped, renamed, or retyped; no existing row is modified.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID', 'CANCELLED');
CREATE TYPE "SalaryType" AS ENUM ('MONTHLY', 'HOURLY', 'PER_LESSON');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED');

-- ----------------------------------------------------------------------------
-- Teacher: salary computation inputs
-- ----------------------------------------------------------------------------
ALTER TABLE "Teacher" ADD COLUMN "lessonRate" DECIMAL(10,2);
ALTER TABLE "Teacher" ADD COLUMN "salaryType" "SalaryType" NOT NULL DEFAULT 'MONTHLY';

-- ----------------------------------------------------------------------------
-- Payment: invoice link + receipt + payment timestamp
-- ----------------------------------------------------------------------------
ALTER TABLE "Payment" ADD COLUMN "invoiceId" UUID;
ALTER TABLE "Payment" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN "receiptIssuedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "paidAt" TIMESTAMP(3);

-- ----------------------------------------------------------------------------
-- PayrollRun: one authoritative calculation per teacher per period
-- ----------------------------------------------------------------------------
CREATE TABLE "PayrollRun" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "teacherId" UUID NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
  "salaryType" "SalaryType" NOT NULL,
  "baseAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lessonsCount" INTEGER NOT NULL DEFAULT 0,
  "hoursWorked" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "hourlyRate" DECIMAL(10,2),
  "lessonRate" DECIMAL(10,2),
  "overtimeHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "overtimeRate" DECIMAL(10,2),
  "bonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "absenceDays" INTEGER NOT NULL DEFAULT 0,
  "absencePenalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "lateCount" INTEGER NOT NULL DEFAULT 0,
  "latePenalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "otherDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "breakdown" JSONB,
  "notes" TEXT,
  "calculatedBy" UUID,
  "calculatedAt" TIMESTAMP(3),
  "reviewedBy" UUID,
  "reviewedAt" TIMESTAMP(3),
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "cancelledBy" UUID,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PayrollRun_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PayrollRun_teacherId_fkey" FOREIGN KEY ("teacherId")
    REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Duplicate payroll generation is rejected at the DB level.
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_organizationId_teacherId_periodYear_periodMonth_key"
  UNIQUE ("organizationId", "teacherId", "periodYear", "periodMonth");
-- A payroll period must be a real calendar month (1-12).
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodMonth_check" CHECK ("periodMonth" BETWEEN 1 AND 12);

CREATE INDEX "PayrollRun_organizationId_idx" ON "PayrollRun"("organizationId");
CREATE INDEX "PayrollRun_organizationId_status_idx" ON "PayrollRun"("organizationId", "status");
CREATE INDEX "PayrollRun_organizationId_periodYear_periodMonth_idx" ON "PayrollRun"("organizationId", "periodYear", "periodMonth");
CREATE INDEX "PayrollRun_teacherId_idx" ON "PayrollRun"("teacherId");

-- ----------------------------------------------------------------------------
-- Invoice: student billing document with recomputed denormalized totals
-- ----------------------------------------------------------------------------
CREATE TABLE "Invoice" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "number" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "penalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "refundedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "issueDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_number_key" UNIQUE ("organizationId", "number");
-- Totals cannot be negative (discount/penalty validated in app layer too).
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_discount_check" CHECK ("discount" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_penalty_check" CHECK ("penalty" >= 0);

CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");
CREATE INDEX "Invoice_studentId_idx" ON "Invoice"("studentId");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- ----------------------------------------------------------------------------
-- InvoiceItem: line items; deleted together with their draft invoice
-- ----------------------------------------------------------------------------
CREATE TABLE "InvoiceItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "invoiceId" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId")
    REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");
CREATE INDEX "InvoiceItem_organizationId_idx" ON "InvoiceItem"("organizationId");

-- ----------------------------------------------------------------------------
-- Refund: approved money-out flow against an existing payment
-- ----------------------------------------------------------------------------
CREATE TABLE "Refund" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "paymentId" UUID NOT NULL,
  "invoiceId" UUID,
  "amount" DECIMAL(12,2) NOT NULL,
  "reason" TEXT,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedBy" UUID NOT NULL,
  "processedBy" UUID,
  "externalId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Refund_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Refund_invoiceId_fkey" FOREIGN KEY ("invoiceId")
    REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Gateway idempotency: one external refund reference per tenant.
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_organizationId_externalId_key" UNIQUE ("organizationId", "externalId");

CREATE INDEX "Refund_organizationId_idx" ON "Refund"("organizationId");
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- ----------------------------------------------------------------------------
-- Payment: new relations + indexes
-- ----------------------------------------------------------------------------
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId")
  REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Receipt numbers are unique per tenant once issued (NULL = not issued;
-- Postgres unique indexes allow multiple NULLs, so legacy rows are fine).
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_receiptNumber_key" UNIQUE ("organizationId", "receiptNumber");
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- ----------------------------------------------------------------------------
-- New enum values must be added in a statement that follows all usage above.
-- Safe: no column in this migration defaults to or stores PARTIALLY_PAID.
-- ----------------------------------------------------------------------------
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_PAID';
