# 🎓 M-EDU v2 Enterprise Platform
> **Next-Generation Smart Education ERP, LMS & Face ID Attendance System (Release 2.0.0)**

[![Version](https://img.shields.io/badge/Version-2.0.0_Enterprise-blue.svg)](#version)
[![Node.js](https://img.shields.io/badge/Node.js-20.x_LTS-green.svg)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-ea2849.svg)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-18.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.x-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.x-d82c20.svg)](https://redis.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-ef4444.svg)](https://turbo.build/)
[![Tests](https://img.shields.io/badge/Tests-3%2C061_Passed_(100%25)-success.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-Commercial_Enterprise-gold.svg)](#license)

---

## 🌟 Executive Overview

**M-EDU v2** is a comprehensive, production-ready enterprise SaaS platform engineered for educational centers, private academies, language institutions, and multi-branch school networks. 

Built with modern high-performance micro-monolith architecture, it consolidates **Academic Management**, **Double-Entry Financial Billing**, **AI Face ID Attendance via RTSP Cameras**, **Omnichannel CRM (Telegram Mini App, SMS, Email)**, **Parent & Student Portals**, **Library & Inventory Systems**, **HR & Payroll**, and **Interactive AI Copilot** into a unified, premium executive-grade interface.

---

## 🚀 Key Modules & Capabilities

### 1. 👁️ Biometric Face ID & IP Camera Attendance
* **RTSP IP Camera Streaming**: Connects seamlessly with Hikvision, Dahua, Uniview, and standard USB/Webcam streams.
* **On-Device ONNX AI Pipeline**:
  * **Face Detection**: Fast 60+ FPS detection via YuNet.
  * **Liveness Anti-Spoofing**: MiniFASNetV2 prevents photo/video screen attacks.
  * **Face Recognition**: SFace 128-dimensional cosine metric embedding.
* **Instant Attendance Marking**: Automatic check-in/out logging with automated parent Telegram & SMS delivery.

### 2. 📚 Academic & LMS Engine
* **Course & Curriculum Architecture**: Multi-level curriculums with modules, lesson topics, and learning objectives.
* **Conflict-Free Scheduling**: Automated calendar scheduling with instructor and classroom room collision detection.
* **Assessments & Grading**: Interactive quizzes, assignment submission tracking, automated GPA calculations, and PDF certificate generation with QR code verification.

### 3. 💳 Double-Entry Financial & Billing System
* **Invoicing & Partial Payments**: Flexible tuition billing, automated receipts (`RCP-YYYY-XXXXXX`), and student credit balances.
* **Debt Collection & Overdue Alerts**: Real-time tracking of unpaid invoices and aging receivables.
* **Automated Payroll**: Instructor workload tracking, hourly/commission-based payroll computation with audit trails.
* **Financial Analytics**: Cash flow forecasting, anomaly detection, and double-entry reconciliation.

### 4. 📱 Omnichannel CRM & Communication
* **Lead Conversion Funnel**: Kanban board pipeline tracking with automated follow-up scheduling.
* **Telegram Bot & Mini App**: Students and parents can check class schedules, attendance records, and pay tuition directly inside Telegram.
* **SMS Gateway Integration**: Eskiz SMS integration for high-priority attendance alerts and payment receipts.
* **Interactive AI Copilot**: Context-aware assistant powered by Google Gemini with semantic tools.

### 5. 🛡️ Enterprise Security & Multi-Tenancy
* **Data Isolation**: Strict multi-tenant boundaries at the ORM layer.
* **Zero Trust Auth**: Access Token + HttpOnly Refresh Token, Double-Submit CSRF cookie defense, and session invalidation.
* **Encrypted Biometrics**: 256-bit AES encryption for facial vector templates.
* **Granular RBAC**: `SUPER_ADMIN`, `ORG_ADMIN`, `TEACHER`, `STUDENT`, `PARENT`.

---

## 🏗️ Architecture & Monorepo Structure

```
education-web-platform/
├── apps/
│   ├── api/                      # NestJS 10 Enterprise API Server
│   │   ├── prisma/               # Database schema & 38 sequential migrations
│   │   └── src/                  # Modules: Auth, Finance, Attendance, Camera, CRM...
│   └── web/                      # React 18 + Vite 6 Modern Web Application
│       ├── src/components/       # Apple Glass Design System components
│       ├── src/pages/            # 40+ Enterprise dashboard screens
│       └── src/i18n/             # Multilingual: Uzbek (uz), Russian (ru), English (en)
├── packages/
│   ├── camera-engine/            # Distributed RTSP stream ingestion workers
│   ├── face-engine/              # ONNX runtime AI facial recognition models
│   ├── financial-engine/         # Double-entry ledger calculation library
│   └── contracts/                # Shared TypeScript types, schemas & DTOs
├── scripts/
│   ├── backup-db.sh              # Gzip-compressed automated database backup
│   └── test-api-login.js         # API integration verification script
├── deploy.sh                     # 1-Click Turnkey Linux VPS Deployment
├── docker-compose.yml            # Multi-container production Docker compose
└── turbo.json                    # Turborepo task pipeline orchestration
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
* **Node.js**: `v20.x LTS`
* **npm**: `v10.x+`
* **PostgreSQL**: `v16.x`
* **Redis**: `v7.x`

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/your-org/education-web-platform.git
cd education-web-platform

# Install monorepo dependencies
npm install
```

### 2. Database Setup & Seed
```bash
# Generate Prisma client
cd apps/api
npx prisma generate

# Apply migrations
npx prisma migrate deploy

# Seed initial master organization and administrator
npx prisma db seed
```

### 3. Start Development Servers
```bash
# From repository root (runs API on :3001, Web on :3000)
npm run dev
```

### 🔑 Default Master Credentials
* **URL**: `http://localhost:3000`
* **Email**: `admin@medu.test`
* **Password**: `Password123!`
* **Organization**: `M-EDU Ta'lim Markazi`

---

## 🌐 1-Click Production VPS Deployment

Deploy the entire production stack (Web + API + PostgreSQL + Redis + SSL + Daily Backups) on any clean Ubuntu 20.04/22.04/24.04 or Debian VPS:

```bash
# Make deployment script executable and run as root:
chmod +x deploy.sh
sudo ./deploy.sh
```

**The automated deployment script handles:**
1. Installing Docker & Docker Compose plugin if missing.
2. Generating secure 256-bit cryptographic secrets for `.env`.
3. Building optimized multi-stage Docker containers with Nginx edge caching.
4. Deploying database migrations and seeding the super administrator.
5. Setting up daily automated database backups with 14-day retention (`scripts/backup-db.sh`).
6. Verifying API health endpoints.

---

## 🧪 Quality Assurance & Test Coverage

M-EDU contains an exhaustive automated test suite covering unit, security, multi-tenant isolation, concurrency, and end-to-end integration flows:

```bash
# Run all backend tests (2,684 tests across 247 test suites)
npm run test -w @medu/api

# Run all web frontend tests (277 tests across 47 test suites)
npm run test -w @medu/web

# Run TypeScript compilation check
npm run typecheck
```

**Results:**
* ✅ **Backend Tests**: `2,684 / 2,684 PASSED` (100%)
* ✅ **Frontend Tests**: `277 / 277 PASSED` (100%)
* ✅ **TypeScript Diagnostics**: `0 errors`
* ✅ **Production Build**: Successfully passes Vite bundling in ~36 seconds.

---

## 🌍 Supported Languages
* 🇺🇿 **Uzbek (O'zbekcha)** — Native default, Latin orthography
* 🇷🇺 **Russian (Русский)** — Full business vocabulary
* 🇬🇧 **English** — International standard terminology

---

## 📄 License & Commercial Rights
This platform is proprietary intellectual property. All commercial rights, white-label distribution, and licensing terms are reserved for the platform owner.
