-- ============================================================================
-- M-EDU v2 Premium Features Migration
-- ============================================================================
-- Adds: Library, HR/Payroll, Exams, Certificates, Inventory, Email/SMS,
-- Chat, Branding, Reports, Audit, Payment Gateways, Parent Portal
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE "BorrowStatus" AS ENUM ('ACTIVE', 'RETURNED', 'OVERDUE', 'LOST');
CREATE TYPE "ContractType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN');
CREATE TYPE "ExamType" AS ENUM ('MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT');
CREATE TYPE "InventoryCategory" AS ENUM ('BOOKS', 'EQUIPMENT', 'FURNITURE', 'SUPPLIES', 'ELECTRONICS');
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'DAMAGED', 'DISPOSED');
CREATE TYPE "TransactionType" AS ENUM ('PURCHASE', 'ISSUE', 'RETURN', 'DAMAGE', 'DISPOSAL');
CREATE TYPE "EmailCategory" AS ENUM ('ATTENDANCE', 'PAYMENT', 'GRADES', 'HOMEWORK', 'GENERAL');
CREATE TYPE "SMSStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');
CREATE TYPE "ReportType" AS ENUM ('ATTENDANCE', 'FINANCIAL', 'ACADEMIC', 'CUSTOM');
CREATE TYPE "PaymentGateway" AS ENUM ('PAYME', 'CLICK', 'UZUM', 'STRIPE', 'PAYPAL', 'CASH', 'BANK');
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED');
CREATE TYPE "LeaveType" AS ENUM ('SICK', 'VACATION', 'PERSONAL', 'UNPAID');
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- ============================================================================
-- LIBRARY MANAGEMENT
-- ============================================================================

CREATE TABLE "LibraryBook" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "author" TEXT,
  "isbn" TEXT,
  "barcode" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "available" INTEGER NOT NULL DEFAULT 1,
  "location" TEXT,
  "publisher" TEXT,
  "publishedYear" INTEGER,
  "language" TEXT DEFAULT 'en',
  "description" TEXT,
  "coverImage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LibraryBook_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "LibraryBook_barcode_key" ON "LibraryBook"("barcode");
CREATE INDEX "LibraryBook_organizationId_idx" ON "LibraryBook"("organizationId");
CREATE INDEX "LibraryBook_category_idx" ON "LibraryBook"("category");
CREATE INDEX "LibraryBook_isbn_idx" ON "LibraryBook"("isbn");

CREATE TABLE "LibraryBorrow" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "borrowedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP NOT NULL,
  "returnedAt" TIMESTAMP,
  "lateFee" DECIMAL(10,2),
  "status" "BorrowStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LibraryBorrow_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "LibraryBorrow_bookId_fkey" FOREIGN KEY ("bookId")
    REFERENCES "LibraryBook"("id") ON DELETE CASCADE,
  CONSTRAINT "LibraryBorrow_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE
);

CREATE INDEX "LibraryBorrow_organizationId_idx" ON "LibraryBorrow"("organizationId");
CREATE INDEX "LibraryBorrow_bookId_idx" ON "LibraryBorrow"("bookId");
CREATE INDEX "LibraryBorrow_studentId_idx" ON "LibraryBorrow"("studentId");
CREATE INDEX "LibraryBorrow_status_idx" ON "LibraryBorrow"("status");
CREATE INDEX "LibraryBorrow_dueDate_idx" ON "LibraryBorrow"("dueDate");

-- ============================================================================
-- HR & PAYROLL
-- ============================================================================

CREATE TABLE "Employee" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "hireDate" TIMESTAMP NOT NULL,
  "terminationDate" TIMESTAMP,
  "salary" DECIMAL(12,2) NOT NULL,
  "contractType" "ContractType" NOT NULL,
  "bankAccount" TEXT,
  "taxId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Employee_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

CREATE TABLE "SalaryRecord" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "month" TIMESTAMP NOT NULL,
  "baseSalary" DECIMAL(12,2) NOT NULL,
  "bonuses" DECIMAL(10,2),
  "deductions" DECIMAL(10,2),
  "tax" DECIMAL(10,2),
  "netSalary" DECIMAL(12,2) NOT NULL,
  "paymentDate" TIMESTAMP,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalaryRecord_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "SalaryRecord_employeeId_fkey" FOREIGN KEY ("employeeId")
    REFERENCES "Employee"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "SalaryRecord_employeeId_month_key" ON "SalaryRecord"("employeeId", "month");
CREATE INDEX "SalaryRecord_organizationId_idx" ON "SalaryRecord"("organizationId");
CREATE INDEX "SalaryRecord_status_idx" ON "SalaryRecord"("status");

CREATE TABLE "LeaveRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "employeeId" UUID NOT NULL,
  "type" "LeaveType" NOT NULL,
  "startDate" TIMESTAMP NOT NULL,
  "endDate" TIMESTAMP NOT NULL,
  "reason" TEXT,
  "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
  "approvedBy" UUID,
  "approvedAt" TIMESTAMP,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId")
    REFERENCES "Employee"("id") ON DELETE CASCADE
);

CREATE INDEX "LeaveRequest_organizationId_idx" ON "LeaveRequest"("organizationId");
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- ============================================================================
-- EXAMS & CERTIFICATES
-- ============================================================================

CREATE TABLE "Exam" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "examDate" TIMESTAMP NOT NULL,
  "duration" INTEGER NOT NULL, -- minutes
  "totalMarks" DECIMAL(6,2) NOT NULL,
  "passingMarks" DECIMAL(6,2) NOT NULL,
  "examType" "ExamType" NOT NULL,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Exam_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Exam_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "Group"("id") ON DELETE CASCADE
);

CREATE INDEX "Exam_organizationId_idx" ON "Exam"("organizationId");
CREATE INDEX "Exam_groupId_idx" ON "Exam"("groupId");
CREATE INDEX "Exam_examDate_idx" ON "Exam"("examDate");

CREATE TABLE "ExamResult" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "examId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "marksObtained" DECIMAL(6,2) NOT NULL,
  "grade" TEXT,
  "rank" INTEGER,
  "isPassed" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP,
  "evaluatedAt" TIMESTAMP,
  "notes" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExamResult_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ExamResult_examId_fkey" FOREIGN KEY ("examId")
    REFERENCES "Exam"("id") ON DELETE CASCADE,
  CONSTRAINT "ExamResult_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ExamResult_examId_studentId_key" ON "ExamResult"("examId", "studentId");
CREATE INDEX "ExamResult_organizationId_idx" ON "ExamResult"("organizationId");
CREATE INDEX "ExamResult_studentId_idx" ON "ExamResult"("studentId");

CREATE TABLE "Certificate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "courseId" UUID NOT NULL,
  "certificateNumber" TEXT NOT NULL,
  "issueDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "templateId" UUID,
  "pdfUrl" TEXT,
  "verificationCode" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Certificate_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "Certificate_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE,
  CONSTRAINT "Certificate_courseId_fkey" FOREIGN KEY ("courseId")
    REFERENCES "Course"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Certificate_certificateNumber_key" ON "Certificate"("certificateNumber");
CREATE UNIQUE INDEX "Certificate_verificationCode_key" ON "Certificate"("verificationCode");
CREATE INDEX "Certificate_organizationId_idx" ON "Certificate"("organizationId");
CREATE INDEX "Certificate_studentId_idx" ON "Certificate"("studentId");

CREATE TABLE "CertificateTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "htmlTemplate" TEXT NOT NULL,
  "cssStyles" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CertificateTemplate_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "CertificateTemplate_organizationId_idx" ON "CertificateTemplate"("organizationId");

-- ============================================================================
-- INVENTORY MANAGEMENT
-- ============================================================================

CREATE TABLE "InventoryItem" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "category" "InventoryCategory" NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "unit" TEXT NOT NULL,
  "minStock" INTEGER NOT NULL DEFAULT 0,
  "purchasePrice" DECIMAL(12,2),
  "sellingPrice" DECIMAL(12,2),
  "location" TEXT,
  "supplier" TEXT,
  "purchaseDate" TIMESTAMP,
  "warrantyExpiry" TIMESTAMP,
  "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
  "description" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryItem_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");
CREATE INDEX "InventoryItem_quantity_idx" ON "InventoryItem"("quantity");

CREATE TABLE "InventoryTransaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "itemId" UUID NOT NULL,
  "type" "TransactionType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "notes" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryTransaction_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "InventoryTransaction_itemId_fkey" FOREIGN KEY ("itemId")
    REFERENCES "InventoryItem"("id") ON DELETE CASCADE
);

CREATE INDEX "InventoryTransaction_organizationId_idx" ON "InventoryTransaction"("organizationId");
CREATE INDEX "InventoryTransaction_itemId_idx" ON "InventoryTransaction"("itemId");
CREATE INDEX "InventoryTransaction_type_idx" ON "InventoryTransaction"("type");
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

-- ============================================================================
-- COMMUNICATIONS (EMAIL, SMS, CHAT)
-- ============================================================================

CREATE TABLE "EmailTemplate" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "textBody" TEXT,
  "variables" TEXT[],
  "category" "EmailCategory" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailTemplate_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "EmailTemplate_organizationId_idx" ON "EmailTemplate"("organizationId");
CREATE INDEX "EmailTemplate_category_idx" ON "EmailTemplate"("category");

CREATE TABLE "EmailLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "templateId" UUID,
  "status" TEXT NOT NULL,
  "sentAt" TIMESTAMP,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailLog_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "EmailLog_organizationId_idx" ON "EmailLog"("organizationId");
CREATE INDEX "EmailLog_status_idx" ON "EmailLog"("status");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

CREATE TABLE "SMSLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "recipient" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SMSStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT NOT NULL,
  "externalId" TEXT,
  "sentAt" TIMESTAMP,
  "deliveredAt" TIMESTAMP,
  "errorMessage" TEXT,
  "cost" DECIMAL(10,4),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SMSLog_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "SMSLog_organizationId_idx" ON "SMSLog"("organizationId");
CREATE INDEX "SMSLog_status_idx" ON "SMSLog"("status");
CREATE INDEX "SMSLog_provider_idx" ON "SMSLog"("provider");

CREATE TABLE "ChatConversation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'DIRECT', -- DIRECT, GROUP
  "title" TEXT,
  "createdBy" UUID NOT NULL,
  "lastMessageAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatConversation_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "ChatConversation_organizationId_idx" ON "ChatConversation"("organizationId");
CREATE INDEX "ChatConversation_lastMessageAt_idx" ON "ChatConversation"("lastMessageAt");

CREATE TABLE "ChatParticipant" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "joinedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastReadAt" TIMESTAMP,

  CONSTRAINT "ChatParticipant_conversationId_fkey" FOREIGN KEY ("conversationId")
    REFERENCES "ChatConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "ChatParticipant_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ChatParticipant_conversationId_userId_key" ON "ChatParticipant"("conversationId", "userId");
CREATE INDEX "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

CREATE TABLE "ChatMessage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "conversationId" UUID NOT NULL,
  "senderId" UUID NOT NULL,
  "message" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP,
  "editedAt" TIMESTAMP,
  "deletedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ChatMessage_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId")
    REFERENCES "ChatConversation"("id") ON DELETE CASCADE,
  CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId")
    REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "ChatMessage_organizationId_idx" ON "ChatMessage"("organizationId");
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");
CREATE INDEX "ChatMessage_senderId_idx" ON "ChatMessage"("senderId");
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");
CREATE INDEX "ChatMessage_isRead_idx" ON "ChatMessage"("isRead");

-- ============================================================================
-- PARENT PORTAL
-- ============================================================================

CREATE TABLE "ParentAccount" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentAccount_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ParentAccount_organizationId_email_key" ON "ParentAccount"("organizationId", "email");
CREATE INDEX "ParentAccount_organizationId_idx" ON "ParentAccount"("organizationId");

CREATE TABLE "ParentStudent" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "parentId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "relationship" TEXT NOT NULL DEFAULT 'parent',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "canViewGrades" BOOLEAN NOT NULL DEFAULT true,
  "canViewPayments" BOOLEAN NOT NULL DEFAULT true,
  "canViewAttendance" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParentStudent_parentId_fkey" FOREIGN KEY ("parentId")
    REFERENCES "ParentAccount"("id") ON DELETE CASCADE,
  CONSTRAINT "ParentStudent_studentId_fkey" FOREIGN KEY ("studentId")
    REFERENCES "Student"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "ParentStudent_parentId_studentId_key" ON "ParentStudent"("parentId", "studentId");
CREATE INDEX "ParentStudent_studentId_idx" ON "ParentStudent"("studentId");

-- ============================================================================
-- WHITE-LABEL BRANDING
-- ============================================================================

CREATE TABLE "OrganizationBranding" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "logoUrl" TEXT,
  "faviconUrl" TEXT,
  "primaryColor" TEXT,
  "secondaryColor" TEXT,
  "accentColor" TEXT,
  "backgroundColor" TEXT,
  "textColor" TEXT,
  "customDomain" TEXT,
  "emailSignature" TEXT,
  "faviconEmoji" TEXT,
  "supportEmail" TEXT,
  "supportPhone" TEXT,
  "socialLinks" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrganizationBranding_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "OrganizationBranding_organizationId_key" ON "OrganizationBranding"("organizationId");
CREATE UNIQUE INDEX "OrganizationBranding_customDomain_key" ON "OrganizationBranding"("customDomain");

-- ============================================================================
-- REPORTS & AUDIT
-- ============================================================================

CREATE TABLE "Report" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ReportType" NOT NULL,
  "parameters" JSONB NOT NULL,
  "schedule" TEXT, -- cron expression
  "lastRunAt" TIMESTAMP,
  "nextRunAt" TIMESTAMP,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");
CREATE INDEX "Report_type_idx" ON "Report"("type");
CREATE INDEX "Report_nextRunAt_idx" ON "Report"("nextRunAt");

CREATE TABLE "AuditLog" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "userId" UUID,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resourceId" TEXT,
  "changes" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "method" TEXT,
  "path" TEXT,
  "statusCode" INTEGER,
  "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- ============================================================================
-- PAYMENT GATEWAYS
-- ============================================================================

CREATE TABLE "PaymentTransaction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "paymentId" UUID,
  "gateway" "PaymentGateway" NOT NULL,
  "externalId" TEXT,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UZS',
  "status" TEXT NOT NULL,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentTransaction_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE,
  CONSTRAINT "PaymentTransaction_paymentId_fkey" FOREIGN KEY ("paymentId")
    REFERENCES "Payment"("id") ON DELETE SET NULL
);

CREATE INDEX "PaymentTransaction_organizationId_idx" ON "PaymentTransaction"("organizationId");
CREATE INDEX "PaymentTransaction_gateway_idx" ON "PaymentTransaction"("gateway");
CREATE INDEX "PaymentTransaction_externalId_idx" ON "PaymentTransaction"("externalId");
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE "Subscription" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "trialStartAt" TIMESTAMP,
  "trialEndAt" TIMESTAMP,
  "currentPeriodStart" TIMESTAMP NOT NULL,
  "currentPeriodEnd" TIMESTAMP NOT NULL,
  "cancelledAt" TIMESTAMP,
  "features" JSONB,
  "maxStudents" INTEGER,
  "maxTeachers" INTEGER,
  "maxCameras" INTEGER,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- ============================================================================
-- ADVANCED PERMISSIONS
-- ============================================================================

CREATE TABLE "CustomRole" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "permissions" TEXT[] NOT NULL, -- e.g. ["students:read", "payments:write"]
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomRole_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "CustomRole_organizationId_name_key" ON "CustomRole"("organizationId", "name");

CREATE TABLE "UserRole" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "roleId" UUID NOT NULL,
  "assignedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" UUID,

  CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId")
    REFERENCES "CustomRole"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- ============================================================================
-- MOBILE APP SUPPORT
-- ============================================================================

CREATE TABLE "DeviceToken" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL, -- ios, android, web
  "deviceId" TEXT,
  "appVersion" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastUsedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "DeviceToken_userId_token_key" ON "DeviceToken"("userId", "token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");
CREATE INDEX "DeviceToken_token_idx" ON "DeviceToken"("token");

CREATE TABLE "NotificationPreference" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "category" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- ============================================================================
-- ORGANIZATION TIMEZONE (v2 enhancement)
-- ============================================================================

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'en';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'UZS';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "subscriptionId" UUID;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "settings" JSONB;

-- ============================================================================
-- STUDENT ENHANCEMENTS
-- ============================================================================

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "enrollmentDate" TIMESTAMP;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active';
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "discount" DECIMAL(5,2);
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "notes" TEXT;
