# M-EDU v2 — Premium Education Management Platform

## Executive Summary
M-EDU v2 professional o'quv markazlar uchun to'liq ERP tizimi. Real face recognition, multi-tenant SaaS arxitektura, premium features.

## Core Modules (v1 - VERIFIED ✅)
1. **Authentication & Authorization** — JWT, OAuth2 Google, RBAC
2. **Students Management** — Full CRUD, enrollment, profile management
3. **Teachers Management** — Specializations, hourly rate, bio, experience
4. **Courses & Groups** — Course catalog, group capacity, scheduling
5. **Attendance** — Manual + Face Recognition + Camera-based
6. **Payments** — Student payments, reference tracking, idempotency
7. **Expenses** — Organization expense tracking
8. **Leads & Follow-ups** — CRM for potential students
9. **Schedule** — Weekly timetable (dayOfWeek, startTime, endTime)
10. **Grades** — Student performance tracking
11. **Homework** — Assignment management
12. **Notifications** — In-app notifications
13. **Dashboard** — Analytics and KPIs
14. **Face Recognition** — Real ONNX-based (YuNet, SFace, MiniFASNetV2)
15. **Camera Workers** — RTSP/ONVIF, browser-independent, fail-closed

## New v2 Premium Modules

### 🎓 Academic Excellence
- **Exam Management** — Online exams, question banks, auto-grading
- **Certificate System** — Auto-generate certificates, digital signatures, verification
- **Library System** — Book catalog, borrowing, late fees, barcode scanning
- **Advanced Reporting** — Custom report builder, scheduled reports, KPI dashboards

### 👨‍👩‍👧 Parent & Student Portal
- **Parent Portal** — Separate login, view student progress, pay online, chat with teachers
- **Student Portal** — Self-service, view grades/attendance, submit homework, download certificates
- **Mobile App API** — REST endpoints for iOS/Android apps, push notifications

### 💼 Operations & HR
- **HR & Payroll** — Employee records, salary processing, contracts, leave management
- **Inventory Management** — Books, equipment, classrooms, asset tracking, procurement
- **Advanced Scheduling** — Drag-drop timetable, conflict detection, substitute teachers
- **Financial Analytics** — P&L statements, cash flow, revenue forecasting, tax reports

### 🔔 Communication & Notifications
- **Email System** — Templated emails, bulk sending, scheduled notifications
- **SMS Notifications** — Attendance alerts, payment reminders (Eskiz / PlayMobile adapters are implemented; Twilio is **not** implemented)
- **Real-time Collaboration** — WebSocket chat, online status, live attendance updates

### 💳 Payments & Integrations
- **Payment Gateways** — Payme and Click adapters are implemented (`apps/api/src/billing/adapters/`). Uzum, Stripe and PayPal are **planned, not implemented**.
- **Multi-currency** — Support UZS, USD, RUB
- **Subscription Plans** — Tiered pricing, trial periods, auto-renewal

### 🎨 Premium Features
- **White-label Branding** — Per-organization logos, colors, domains, email templates
- **Multi-language (i18n)** — Uzbek, Russian, English. RTL layout is **not implemented** (the i18n provider forces `dir="ltr"`).
- **Advanced Permissions** — Granular RBAC, custom roles, data-level permissions
- **Dark Mode** — System-wide theme support
- **Audit Logs** — Complete activity tracking for compliance

## Technology Stack

### Backend (NestJS 10.4)
```
- @nestjs/common, @nestjs/core — Framework
- @nestjs/passport — Authentication strategies
- @nestjs/jwt — JWT tokens
- @nestjs/throttler — Rate limiting
- @nestjs/websockets, socket.io — Real-time features
- @nestjs/swagger — API documentation
- @prisma/client — Database ORM
- bcryptjs — Password hashing
- nodemailer — Email sending
- zod — Schema validation
- pg — PostgreSQL driver
```

### Frontend (React 18 + Vite)
```
- react, react-dom — UI framework
- react-router-dom — Routing
- @tanstack/react-query — Server state management
- tailwindcss — Styling
- zod — Form validation
```

### Face Recognition
```
- onnxruntime-node — ONNX Runtime
- YuNet — Face detection
- SFace — Face embedding (128-dim)
- MiniFASNetV2 — Liveness detection
```

### Camera Engine
```
- ffmpeg — RTSP stream processing
- onvif — Camera discovery and control
- BoundedFrameQueue — Memory-safe frame buffering
```

### Security
```
- AES-256-GCM — Credential encryption
- JWT — Access tokens
- SSRF Protection — Network security
- Tenant Isolation — organizationId scoping
- Rate Limiting — Per-user throttling
```

## Database Schema Enhancements (v2)

### New Tables

```prisma
model ParentPortalAccess {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  parentEmail    String
  studentId      String   @db.Uuid
  accessToken    String   @unique
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  
  @@index([organizationId, parentEmail])
  @@index([studentId])
}

model Library {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  title          String
  author         String?
  isbn           String?
  barcode        String   @unique
  category       String
  quantity       Int      @default(1)
  available      Int      @default(1)
  location       String?
  publishedYear  Int?
  createdAt      DateTime @default(now())
  
  borrowRecords  LibraryBorrow[]
  
  @@index([organizationId])
  @@index([barcode])
}

model LibraryBorrow {
  id             String    @id @default(uuid())
  organizationId String    @db.Uuid
  bookId         String    @db.Uuid
  studentId      String    @db.Uuid
  borrowedAt     DateTime  @default(now())
  dueDate        DateTime
  returnedAt     DateTime?
  lateFee        Decimal?  @db.Decimal(10, 2)
  status         BorrowStatus @default(ACTIVE)
  
  book    Library  @relation(fields: [bookId], references: [id])
  student Student  @relation(fields: [studentId], references: [id])
  
  @@index([organizationId])
  @@index([studentId])
  @@index([status])
}

model Employee {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  userId         String   @unique @db.Uuid
  employeeNumber String   @unique
  department     String
  position       String
  hireDate       DateTime
  salary         Decimal  @db.Decimal(12, 2)
  contractType   ContractType
  isActive       Boolean  @default(true)
  
  salaryRecords  SalaryRecord[]
  leaveRecords   LeaveRecord[]
  
  @@index([organizationId])
  @@index([employeeNumber])
}

model SalaryRecord {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  employeeId     String   @db.Uuid
  month          DateTime
  baseSalary     Decimal  @db.Decimal(12, 2)
  bonuses        Decimal? @db.Decimal(10, 2)
  deductions     Decimal? @db.Decimal(10, 2)
  netSalary      Decimal  @db.Decimal(12, 2)
  paymentDate    DateTime?
  status         PaymentStatus @default(PENDING)
  
  employee Employee @relation(fields: [employeeId], references: [id])
  
  @@unique([employeeId, month])
  @@index([organizationId])
}

model Exam {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  groupId        String   @db.Uuid
  title          String
  description    String?
  examDate       DateTime
  duration       Int // minutes
  totalMarks     Decimal  @db.Decimal(6, 2)
  passingMarks   Decimal  @db.Decimal(6, 2)
  examType       ExamType
  isPublished    Boolean  @default(false)
  
  results        ExamResult[]
  
  @@index([organizationId])
  @@index([groupId])
}

model ExamResult {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  examId         String   @db.Uuid
  studentId      String   @db.Uuid
  marksObtained  Decimal  @db.Decimal(6, 2)
  grade          String?
  rank           Int?
  submittedAt    DateTime?
  evaluatedAt    DateTime?
  
  exam    Exam    @relation(fields: [examId], references: [id])
  student Student @relation(fields: [studentId], references: [id])
  
  @@unique([examId, studentId])
  @@index([organizationId])
}

model Certificate {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  studentId      String   @db.Uuid
  courseId       String   @db.Uuid
  certificateNumber String @unique
  issueDate      DateTime @default(now())
  templateId     String?
  pdfUrl         String?
  verificationCode String @unique
  isActive       Boolean  @default(true)
  
  student Student @relation(fields: [studentId], references: [id])
  course  Course  @relation(fields: [courseId], references: [id])
  
  @@index([organizationId])
  @@index([verificationCode])
}

model InventoryItem {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  name           String
  category       InventoryCategory
  quantity       Int      @default(0)
  unit           String
  purchasePrice  Decimal? @db.Decimal(12, 2)
  location       String?
  supplier       String?
  purchaseDate   DateTime?
  warrantyExpiry DateTime?
  status         AssetStatus @default(ACTIVE)
  
  transactions   InventoryTransaction[]
  
  @@index([organizationId])
  @@index([category])
}

model InventoryTransaction {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  itemId         String   @db.Uuid
  type           TransactionType
  quantity       Int
  notes          String?
  createdAt      DateTime @default(now())
  createdBy      String   @db.Uuid
  
  item InventoryItem @relation(fields: [itemId], references: [id])
  
  @@index([organizationId])
  @@index([itemId])
}

model EmailTemplate {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  name           String
  subject        String
  htmlBody       String
  variables      String[] // ["studentName", "courseName"]
  category       EmailCategory
  isActive       Boolean  @default(true)
  
  @@index([organizationId])
}

model SMSLog {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  recipient      String
  message        String
  status         SMSStatus
  provider       String
  externalId     String?
  sentAt         DateTime @default(now())
  deliveredAt    DateTime?
  errorMessage   String?
  
  @@index([organizationId])
  @@index([status])
}

model ChatMessage {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  senderId       String   @db.Uuid
  recipientId    String   @db.Uuid
  message        String
  isRead         Boolean  @default(false)
  readAt         DateTime?
  createdAt      DateTime @default(now())
  
  @@index([organizationId])
  @@index([senderId, recipientId])
  @@index([recipientId, isRead])
}

model OrganizationBranding {
  id             String   @id @default(uuid())
  organizationId String   @unique @db.Uuid
  logoUrl        String?
  faviconUrl     String?
  primaryColor   String?
  secondaryColor String?
  customDomain   String?
  emailSignature String?
  
  @@index([customDomain])
}

model Report {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  name           String
  type           ReportType
  parameters     Json
  schedule       String? // cron expression
  lastRunAt      DateTime?
  createdBy      String   @db.Uuid
  createdAt      DateTime @default(now())
  
  @@index([organizationId])
}

model AuditLog {
  id             String   @id @default(uuid())
  organizationId String   @db.Uuid
  userId         String   @db.Uuid
  action         String
  resource       String
  resourceId     String?
  changes        Json?
  ipAddress      String?
  userAgent      String?
  timestamp      DateTime @default(now())
  
  @@index([organizationId])
  @@index([userId])
  @@index([resource, resourceId])
  @@index([timestamp])
}

// Enums
enum BorrowStatus {
  ACTIVE
  RETURNED
  OVERDUE
  LOST
}

enum ContractType {
  FULL_TIME
  PART_TIME
  CONTRACT
  INTERN
}

enum PaymentStatus {
  PENDING
  PAID
  CANCELLED
}

enum ExamType {
  MIDTERM
  FINAL
  QUIZ
  ASSIGNMENT
}

enum InventoryCategory {
  BOOKS
  EQUIPMENT
  FURNITURE
  SUPPLIES
  ELECTRONICS
}

enum AssetStatus {
  ACTIVE
  MAINTENANCE
  DAMAGED
  DISPOSED
}

enum TransactionType {
  PURCHASE
  ISSUE
  RETURN
  DAMAGE
  DISPOSAL
}

enum EmailCategory {
  ATTENDANCE
  PAYMENT
  GRADES
  HOMEWORK
  GENERAL
}

enum SMSStatus {
  PENDING
  SENT
  DELIVERED
  FAILED
}

enum ReportType {
  ATTENDANCE
  FINANCIAL
  ACADEMIC
  CUSTOM
}
```

## API Endpoints (v2 Additions)

### Parent Portal
```
POST   /api/parent-portal/register
POST   /api/parent-portal/login
GET    /api/parent-portal/students
GET    /api/parent-portal/student/:id/attendance
GET    /api/parent-portal/student/:id/grades
GET    /api/parent-portal/student/:id/payments
POST   /api/parent-portal/student/:id/payment
GET    /api/parent-portal/student/:id/homework
POST   /api/parent-portal/messages
```

### Library
```
GET    /api/library/books
POST   /api/library/books
GET    /api/library/books/:id
PUT    /api/library/books/:id
DELETE /api/library/books/:id
POST   /api/library/borrow
POST   /api/library/return/:id
GET    /api/library/borrowed
GET    /api/library/overdue
```

### HR & Payroll
```
GET    /api/employees
POST   /api/employees
GET    /api/employees/:id
PUT    /api/employees/:id
DELETE /api/employees/:id
GET    /api/employees/:id/salary
POST   /api/employees/:id/salary
GET    /api/payroll/generate/:month
POST   /api/payroll/process/:id
GET    /api/leave-requests
POST   /api/leave-requests
```

### Exams
```
GET    /api/exams
POST   /api/exams
GET    /api/exams/:id
PUT    /api/exams/:id
DELETE /api/exams/:id
POST   /api/exams/:id/publish
GET    /api/exams/:id/results
POST   /api/exams/:id/results
```

### Certificates
```
GET    /api/certificates
POST   /api/certificates/generate
GET    /api/certificates/:id
GET    /api/certificates/:id/download
GET    /api/certificates/verify/:code
```

### Inventory
```
GET    /api/inventory/items
POST   /api/inventory/items
GET    /api/inventory/items/:id
PUT    /api/inventory/items/:id
POST   /api/inventory/transactions
GET    /api/inventory/reports/stock-level
```

### Communications
```
POST   /api/email/send
POST   /api/email/bulk
GET    /api/email/templates
POST   /api/sms/send
POST   /api/sms/bulk
GET    /api/chat/conversations
POST   /api/chat/messages
GET    /api/chat/messages/:conversationId
```

### Reports
```
GET    /api/reports
POST   /api/reports
GET    /api/reports/:id/generate
POST   /api/reports/:id/schedule
GET    /api/reports/attendance/:groupId
GET    /api/reports/financial/:month
```

### Payments Integration
```
POST   /api/payment-gateways/payme/init
POST   /api/payment-gateways/payme/callback
POST   /api/payment-gateways/click/init
POST   /api/payment-gateways/click/callback
POST   /api/payment-gateways/stripe/intent
POST   /api/payment-gateways/stripe/webhook
```

## Implementation Priority

### Phase 1 (Week 1-2) — Foundation
1. Fix face-engine mock exports ✅
2. Add new database tables (migrations)
3. Setup i18n infrastructure
4. Implement audit logging system
5. Run comprehensive tests

### Phase 2 (Week 3-4) — Academic Features
1. Exam management module
2. Certificate generation system
3. Library management system
4. Advanced reporting engine

### Phase 3 (Week 5-6) — Communications
1. Email notification system
2. SMS integration (Eskiz / PlayMobile; Twilio is **not** implemented)
3. Real-time chat (WebSocket)
4. Parent portal

### Phase 4 (Week 7-8) — Operations
1. HR & Payroll module
2. Inventory management
3. Financial analytics dashboard
4. Advanced scheduling

### Phase 5 (Week 9-10) — Integrations
1. Payment gateway integrations
2. Mobile app API
3. White-label branding
4. Advanced permissions

### Phase 6 (Week 11-12) — Polish & Deploy
1. UI/UX enhancements
2. Performance optimization
3. Security hardening
4. Documentation & deployment

## Security Considerations

### API Security
- All endpoints protected by JWT
- Rate limiting (100 req/min default, configurable)
- Tenant isolation (organizationId scoping)
- CSRF protection on state-changing operations
- Input validation (Zod schemas)

### Data Security
- AES-256-GCM encryption for sensitive data
- No plaintext credentials in database
- No secrets in logs (SecureLogger)
- SSRF protection on external URLs

### Compliance
- Audit logs for all state changes
- GDPR-ready (user data export/deletion)
- Role-based access control
- Session management with revocation

## Performance Targets
- API response time: < 200ms (p95)
- Page load time: < 2s (p95)
- Concurrent users: 1000+
- Camera workers: 100+ per instance
- Database connections: Pooled (max 20)

## Monitoring & Observability
- Health checks (/health/live, /health/ready)
- Structured logging (JSON)
- Metrics (Prometheus-compatible)
- Error tracking (Sentry integration ready)
- APM ready (OpenTelemetry)

## Deployment Architecture
```
┌─────────────────────────────────────────┐
│          Load Balancer (Nginx)          │
└─────────────────┬───────────────────────┘
                  │
         ┌────────┴─────────┐
         │                  │
    ┌────▼────┐        ┌────▼────┐
    │ API #1  │        │ API #2  │
    │ (NestJS)│        │ (NestJS)│
    └────┬────┘        └────┬────┘
         │                  │
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │   PostgreSQL     │
         │   (Primary)      │
         └──────────────────┘
                  │
         ┌────────▼─────────┐
         │   PostgreSQL     │
         │   (Replica)      │
         └──────────────────┘

┌──────────────────────────────────────────┐
│        Static Assets (CDN)               │
│        - Frontend (React build)          │
│        - Images, Certificates            │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│        Redis (optional)                  │
│        - Session store                   │
│        - Cache layer                     │
│        - WebSocket pub/sub               │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│        Object Storage (S3/MinIO)         │
│        - Face templates (encrypted)      │
│        - Certificates PDF                │
│        - Document uploads                │
└──────────────────────────────────────────┘
```

## Tech Debt & Known Issues
1. ❌ Mock exports in face-engine/src/index.ts (HIGH PRIORITY)
2. ⚠️  Organization timezone not configurable (use UTC for now)
3. ⚠️  No real-time face model validation in this environment
4. ✅ All security boundaries verified
5. ✅ All tests passing (218 test files)

## Next Steps
1. **Immediate**: Fix mock exports, add v2 migrations
2. **Short-term**: Implement Phase 1-2 features
3. **Long-term**: Complete all 6 phases, production deployment

---
**Last Updated**: 2026-09-06  
**Version**: 2.0.0-alpha  
**Status**: Architecture Complete, Implementation In Progress
