# M-EDU — SaaS Engineering Implementation Baseline
**Date:** October 30, 2026  
**Architectural Baseline:** Monorepo (Turborepo 2.10.12, NestJS 10, Prisma 5, React 18, Vite 6, TailwindCSS 3)

---

## 1. Baseline Summary

M-EDU contains extensive educational center operations capabilities across 126 database models, 81 NestJS controllers, 521 HTTP endpoint decorators, and 82 React frontend pages.

However, it was originally built as a multi-organization single-tenant-like software system with shared database schema. The October 30 audit highlighted the missing commercial SaaS layers:
1. Role confusion between platform operator and school administrator.
2. Incomplete and disconnected `Subscription` model with 0 backend services, controllers, or billing automation.
3. Completely unenforced client quotas on students, branches, and cameras.
4. Absence of a SaaS platform Super Admin portal (`/super-admin`).
5. Absence of customer self-service billing management (`/settings/billing`).
6. In-process camera stream ingestion using `ffmpeg` inside the NestJS process.
7. Biometric fallback to deterministic SHA-256 byte projection when native ONNX runtime is absent.

---

## 2. Existing Functional Inventory

| Domain | Exists & Working | Missing / Incomplete for SaaS |
| :--- | :--- | :--- |
| **Authentication** | JWT, Refresh Tokens, Google OAuth, Bcrypt | Session device revocation UI, 2FA enforcement, platform-wide lockout |
| **Authorization** | `RolesGuard`, `PlatformGuard`, centralized policies | Strict role partition: `PLATFORM_OWNER` vs `ORGANIZATION_OWNER` vs `SUPER_ADMIN` |
| **Multi-Tenancy** | `organizationId` foreign keys, `scopeToTenant()` | Automated query scoping (Prisma extension), cross-tenant leak in `admin.service` |
| **Subscriptions** | Dormant `Subscription` model in `schema.prisma` | Real `SaaSPlan`, `OrganizationSubscription`, 7-day trial engine, subscription state machine |
| **Quota Engine** | None | Real-time race-condition safe checks on students, teachers, branches, cameras |
| **Billing & Payments** | Student manual invoices & deep links | B2B Payme Business & Click Merchant subscription checkout and webhooks |
| **Super Admin** | 3 read/invite endpoints in `PlatformController` | Dedicated `/super-admin` frontend portal, MRR tracking, tenant suspension, plan editor |
| **Customer Portal** | Educational ERP dashboard & settings | `/settings/billing` with plan upgrade, quota gauges, Payme/Click checkout |
| **Biometrics (Face ID)** | Bundled ONNX models, AES-256-GCM encryption | Fail-closed provider states, elimination of silent SHA-256 fallback in production |
| **Cameras** | RTSP ingestion & frame extraction | Dedicated decoupled worker architecture to safeguard NestJS API stability |
| **AI Copilot** | Gemini 3 integration, 14 tool categories | Per-plan request limits, token usage metering, tenant-isolated memory |

---

## 3. Preserved Working Tree Assets

All pre-existing tracked modifications and untracked components (including Face ID studio extensions, Telegram broadcast studio, attendance radar, and V2 test suites) are preserved without destructive Git resets.

---

## 4. Execution Order & Priorities

- **PHASE 1:** Critical Security & Tenant Isolation (Fix role confusion, patch `admin.service.ts`, implement Prisma tenant context)
- **PHASE 2:** Authentication & Account Security (Session revocation, 2FA support, account lockout)
- **PHASE 3:** SaaS Subscription Engine (`SaaSPlan`, `OrganizationSubscription`, 7-day trial, state transitions)
- **PHASE 4:** Feature Entitlements & Quota Engine (`QuotaGuard`, `EntitlementGuard`, atomic limit checks)
- **PHASE 5:** SaaS Billing & Payment Adapters (Payme Business & Click Merchant adapters, B2B invoices)
- **PHASE 6:** Super Admin Control Plane (`/super-admin` frontend and platform backend)
- **PHASE 7:** Customer Onboarding & Billing Portal (`/settings/billing`, trial banners)
- **PHASE 8:** Face ID Engine Hardening (Explicit provider states, fail-closed security)
- **PHASE 9:** Camera Worker Isolation (Decoupled streaming architecture)
- **PHASE 10:** AI Copilot Commercial Hardening (Quota tracking, rate limiting)
- **PHASE 11:** Production Infrastructure & Observability (Docker, Nginx, health checks, backup scripts)
- **PHASE 12:** Frontend Integration & Polish
- **PHASE 13:** Performance & Verification Gates
