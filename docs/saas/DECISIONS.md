# M-EDU — Architecture Decision Records (ADRs)

## ADR-001: Separation of Platform Owner and Organization Super Admin
- **Status:** APPROVED
- **Context:** `SUPER_ADMIN` in the database was historically used for both the educational center school director and the SaaS platform owner. This caused privilege escalation where a school director could access platform-wide registration requests.
- **Decision:**
  - `PLATFORM_OWNER` is reserved strictly for the SaaS platform operator (Antigravity/M-EDU company).
  - `SUPER_ADMIN` / `ORGANIZATION_OWNER` represents the school director / customer tenant administrator.
  - Platform-wide administrative endpoints (`/platform/*`, cross-tenant `/admin/access-requests`) are guarded exclusively by `PlatformGuard` or `@Roles('PLATFORM_OWNER')`.
  - Organization-level administrative endpoints are scoped to `where: { organizationId }`.

## ADR-002: SaaS Subscription Model & Quota Architecture
- **Status:** APPROVED
- **Context:** The existing `SubscriptionPlan` enum (`FREE, BASIC, PREMIUM, ENTERPRISE`) was outdated compared to the proposed commercial tiers (`START, STANDARD, PRO, ENTERPRISE`).
- **Decision:**
  - Introduce dynamic database-backed `SaaSPlan` and `OrganizationSubscription` tables while maintaining backward compatibility with existing Prisma schema relationships.
  - Store prices as integer Uzbek So'm (UZS) values.
  - Enforce limits via NestJS `QuotaGuard` with concurrency safety before database insertions.

## ADR-003: Biometric Engine Explicit State Machine
- **Status:** APPROVED
- **Context:** Silent SHA-256 fallback masked real-world facial recognition failures.
- **Decision:**
  - Implement explicit states (`READY, DEGRADED, UNAVAILABLE, INITIALIZATION_FAILED`).
  - Production mode will fail closed with a typed exception rather than generating synthetic embeddings from image bytes.
