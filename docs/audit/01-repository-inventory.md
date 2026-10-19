# 01 — REAL REPOSITORY INVENTORY & CODEBASE TOPOGRAPHY

**Mission ID:** MEDU-UFA-001  
**Project:** M EDU (Education Web Platform)  
**Execution Timestamp:** 2026-10-14  
**Audit Standard:** Zero-Assumption Empirical Inventory  

---

## 1. MONOREPO TOPOGRAPHY & WORKSPACES

The M EDU repository is a monorepo configured with `npm workspaces` and orchestrated with `Turborepo` (`turbo 2.10.12`).

```
c:\Users\Amirjon\education web platform
├── apps/
│   ├── api/                     # NestJS 10 Enterprise SaaS API (Port 3001)
│   └── web/                     # React 18 + Vite SPA (Port 3000)
├── packages/
│   ├── camera-engine/           # RTSP ingestion, FFmpeg decode, worker sessions
│   ├── contracts/               # Shared DTOs, schemas, RBAC enums, Zod validators
│   ├── core/                    # Domain entities, Recognition Decision Policy, Ports
│   ├── face-engine/             # Real ONNX models (YuNet detection, SFace, MiniFASNet v2 liveness)
│   ├── face-security/           # AES-256-GCM biometric vault, retention, audit trail
│   └── financial-engine/        # High-precision decimal arithmetic, payroll, taxes
└── docs/
    └── audit/                   # Active forensic audit registry & findings
```

---

## 2. CODEBASE INVENTORY METRICS (EVIDENCE-VERIFIED)

| Metric | Measured Value | Verification Method |
|---|---|---|
| **Total Tracked & Untracked Source Files** | 1,355 files | `git ls-files` + untracked source files |
| **TypeScript (.ts) Files** | 938 files | File extension filter excluding `node_modules` and `dist` |
| **React TSX (.tsx) Files** | 212 files | File extension filter excluding `node_modules` and `dist` |
| **Total TS + TSX Source Files** | 1,150 files | Aggregated TypeScript codebase |
| **Prisma Database Models** | 126 models | Exact count of `model <Name>` in `schema.prisma` |
| **Prisma Migrations** | 40 migrations | Count of directories in `apps/api/prisma/migrations` |
| **NestJS API Controllers** | 78 controllers | `apps/api/src/**/*.controller.ts` |
| **NestJS API Services** | 105 services | `apps/api/src/**/*.service.ts` |
| **NestJS Route Endpoints** | 468 endpoints | Count of `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete` decorators |
| **NestJS Guards** | 10 guards | `apps/api/src/**/*.guard.ts` |
| **NestJS Modules** | 72 modules | `apps/api/src/**/*.module.ts` |
| **NestJS DTOs** | 55 DTO files | `apps/api/src/**/*.dto.ts` |
| **Frontend Page Views** | 82 page components | `apps/web/src/pages/*.tsx` |
| **Frontend UI Components** | 86 components | `apps/web/src/components/**/*.tsx` |
| **Frontend Custom Hooks** | 26 hooks | `apps/web/src/hooks/**/*.ts*` |
| **Frontend Registered Routes** | 97 routes | Route definitions in `apps/web/src/routes/index.tsx` |

---

## 3. WORKSPACE DEEP-DIVE & CONTRACTS

### 3.1 `@medu/api` (`apps/api`)
- **Role:** Central SaaS Backend application.
- **Entry Point:** `src/main.ts`
- **Primary Framework:** NestJS 10.4.0, Express, Socket.IO.
- **Data Layer:** Prisma ORM 5.20.0 connecting to PostgreSQL (`DATABASE_URL`).
- **Cache & Queue:** Redis 7 / BullMQ (with graceful in-memory and embedded fallback).
- **Security:** Global auth guard (`GlobalAuthGuard`), JWT strategy, Throttler, Helmet, CSRF protection, strict CORS.
- **Biometric Integration:** Connects to `@medu/face-engine` and `@medu/face-security` for camera attendance.

### 3.2 `@medu/web` (`apps/web`)
- **Role:** Web User Interface Single-Page Application.
- **Entry Point:** `src/main.tsx`
- **Primary Framework:** React 18.3.1, Vite 6.4.0, React Router v6.
- **State & Query:** `@tanstack/react-query` 5.59.0, custom React Contexts (`AuthContext`, `CameraContext`).
- **Design System:** Tailwind CSS 3.4.10, Framer Motion, Radix UI Slot, Lucide Icons, Glassmorphism design tokens.
- **I18n:** Multi-language support (Uzbek `uz`, Russian `ru`, English `en`).

### 3.3 `@medu/camera-engine` (`packages/camera-engine`)
- **Role:** RTSP camera ingestion, FFmpeg child-process management, frame extraction, perceptual hashing.
- **Key Modules:**
  - `FfmpegStreamIngester`: Spawns FFmpeg child processes to read RTSP H.264/H.265 streams.
  - `NetworkSecurity`: Strict SSRF mitigation, IP address validation, private subnet blocking.
  - `PerceptualHash`: Detects frozen camera frames and repeated noise.

### 3.4 `@medu/face-engine` (`packages/face-engine`)
- **Role:** Biometric facial detection, embedding extraction, and liveness analysis.
- **Neural Network Models (Real ONNX Artifacts in `packages/face-engine/models/`):**
  - Detection: YuNet (`face_detection_yunet_2023mar.onnx`, 640x640 input).
  - Embedding: SFace / Real Embedder (`real-embedder-onnx-112d128.onnx`, 128-dimensional L2-normalized float vector).
  - Liveness: MiniFASNet v2 (`minifasnet_v2.onnx`, anti-spoofing presentation attack detection).

### 3.5 `@medu/face-security` (`packages/face-security`)
- **Role:** Cryptographic protection and governance of biometric templates.
- **Key Features:**
  - AES-256-GCM authenticated encryption for stored 128-d biometric vectors.
  - Retention policies and automatic pseudonymization.
  - Tamper-evident audit logs (`FaceAuditEvent`).

### 3.6 `@medu/financial-engine` (`packages/financial-engine`)
- **Role:** Financial precision engine for currency conversions, payroll, taxes, and debt calculations.
- **Key Features:**
  - High-precision integer/scaled decimal calculations to prevent floating-point rounding errors.
  - Payroll calculation rules for hourly, fixed, bonus, and deduction schemas.

### 3.7 `@medu/core` (`packages/core`)
- **Role:** Shared domain logic, recognition decision policy, and enrollment business rules.
- **Decision Engine:** Evaluates confidence thresholds, organization membership, lesson scheduling, and duplicate detection.

### 3.8 `@medu/contracts` (`packages/contracts`)
- **Role:** Shared API contracts, Zod schemas, TypeScript types, and RBAC permission definitions.

---

## 4. DATABASE SCHEMA TOPOGRAPHY (126 MODELS)

The PostgreSQL database contains 126 distinct models covering 12 enterprise domains:

1. **Tenancy & Core Identity:** `Organization`, `User`, `UserSettings`, `Session`, `CustomRole`, `UserRole`, `ApiKey`.
2. **Academic & Students:** `Student`, `Teacher`, `Course`, `Group`, `StudentGroup`, `Schedule`, `Lesson`, `Subject`, `Topic`.
3. **Attendance & Biometrics:** `Attendance`, `FaceEnrollment`, `FaceTemplate`, `RecognitionSession`, `RecognitionAttempt`, `FaceDevice`, `FaceAuditEvent`, `Camera`, `CameraAttendanceEvent`.
4. **Finance & Payroll:** `Payment`, `PaymentTransaction`, `Expense`, `Invoice`, `InvoiceItem`, `Refund`, `Employee`, `SalaryRecord`, `PayrollRun`, `Discount`.
5. **CRM & Leads:** `Lead`, `LeadActivity`, `FollowUp`, `FollowUpRule`.
6. **Communications & Messaging:** `Notification`, `NotificationDelivery`, `NotificationPreference`, `ChatConversation`, `ChatMessage`, `EmailLog`, `SMSLog`, `CommunicationHistory`.
7. **Telegram Integration:** `TelegramAccount`, `TelegramLinkToken`, `TelegramLinkLog`, `TelegramUpdate`.
8. **Parent Portal:** `ParentAccount`, `ParentStudent`, `ParentSession`, `ParentTeacherMessage`.
9. **Exams & Gamification:** `Exam`, `ExamResult`, `Certificate`, `CertificateTemplate`, `GamificationXpEvent`, `StudentGamification`.
10. **Curriculum & Materials:** `Curriculum`, `CurriculumModule`, `LearningObjective`, `Material`, `MaterialFolder`, `Assignment`, `Homework`.
11. **Inventory & Operations:** `InventoryItem`, `InventoryTransaction`, `Resource`, `ResourceBooking`, `Branch`.
12. **AI Copilot & Governance:** `AiConversation`, `AiMessage`, `AiAction`, `AuditLog`, `SecurityEvent`, `DataQualityIssue`, `DataRetentionPolicy`.
