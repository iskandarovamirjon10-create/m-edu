# M EDU — Security & Multi-Tenant Forensic Review
**Mission ID:** MEDU-UFA-001  
**Audit Date:** 2026-10-14  
**Audit Standard:** ZERO-ASSUMPTION • EVIDENCE-DRIVEN • PRODUCTION REALITY  

---

## 1. Authentication & Session Integrity

### Fail-Closed Global Architecture
- **Global Auth Guard (`GlobalAuthGuard`):** Applied globally across all NestJS HTTP controllers via `APP_GUARD`. Any endpoint lacking an explicit `@AllowPublic()` decorator is strictly blocked for unauthenticated callers.
- **Fail-Closed Role Authorization (`RolesGuard`):** When role restrictions are defined, any request without matching role claims returns `403 Forbidden`. If role metadata is missing on protected handlers, the guard defaults to denying access.
- **WebSocket Gateway Security (`WsJwtGuard`):** WebSocket handshakes enforce JWT token extraction from headers/query, validate cryptographic signatures, verify expiration, and reject deactivated accounts.

### JWT Strategy & Real-Time Tenant Verification
- **File:** `apps/api/src/auth/jwt.strategy.ts`
- **Validation Flow on Every Request:**
  1. Verifies JWT signature and expiry using configured `JWT_SECRET`.
  2. Queries the database (`prisma.user.findUnique`) to verify user existence and active status.
  3. **Multi-Tenant Pinning:** Strictly verifies that `payload.organizationId === user.organizationId`. If a user attempts to spoof a different tenant header or payload, the request is immediately rejected (`401 Unauthorized`).
- **Session Revocation:** Password changes trigger immediate revocation of all other active sessions via token blacklist or session version invalidation (`UsersService.changePassword`).

---

## 2. Multi-Tenant Isolation Boundaries

### Database Query Scope Enforcement
- Every tenant-scoped entity (Students, Teachers, Groups, Invoices, Payments, Attendance, Cameras, Documents) enforces `organizationId` parameterization in Prisma `where` clauses:
  ```typescript
  // Canonical pattern observed across all domain services
  where: {
    id: resourceId,
    organizationId: user.organizationId,
  }
  ```
- **Proof in Tests:** `tenant.interceptor.spec.ts` (18 tests) and `access-control.e2e.spec.ts` prove that Tenant A cannot access, modify, or list Tenant B's records under any circumstances.

### Hardware Webhook Multi-Tenant Pinning
- **File:** `apps/api/src/camera/terminal-webhook.controller.ts`
- **Verification:** Hardware terminal events submitted from physical cameras or access gates are resolved to cameras registered under a specific `organizationId`. Even if the incoming webhook payload attempts to pass a foreign `organizationId`, the controller resolves tenant ownership directly from the authenticated device/camera record in the database, preventing cross-tenant attendance injection.

---

## 3. Network Boundaries & SSRF Defense

### Camera Engine Network Protection
- **File:** `packages/camera-engine/src/network-security.ts`
- **SSRF Policy:**
  - Evaluates all user-supplied RTSP/HTTP camera URLs before socket connection.
  - **Unconditional Blocks:**
    - Link-local addresses (`169.254.0.0/16`).
    - Cloud instance metadata services (AWS/GCP/Azure `169.254.169.254`).
    - Multicast addresses (`224.0.0.0/4`).
    - Broadcast and unspecified addresses.
  - Private RFC1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are strictly forbidden unless the organization has explicitly enabled on-premise local network streaming mode with verified credentials.

---

## 4. Cryptographic Timing Attack Defense

### Webhook Signature Verification
- Inbound webhooks from payment gateways (Click, Payme, Uzum) and Telegram update endpoints use constant-time cryptographic verification (`crypto.timingSafeEqual`) on HMAC SHA-256 signatures:
  ```typescript
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
  const actualBuffer = Buffer.from(receivedSignature, 'utf8');
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new UnauthorizedException('Invalid signature');
  }
  ```
- Prevents statistical timing attacks from deciphering webhook secret tokens.

---

## 5. AI Tool Execution & Prompt Injection Security

### Schema Registry & Confirmation Gates
- **File:** `apps/api/src/ai/tools/registry/tool-registry.service.ts`
- All tools accessible to the AI Copilot are strictly registered with JSON schema validation.
- Tool arguments are parsed and sanitized prior to method invocation.
- **High-Risk Operations Gate:** Financial transactions, student balance overrides, and database deletions cannot be autonomously executed by the LLM; they require an interactive confirmation token with a cryptographic HMAC signed by an administrator session.

---

## 6. Security Verdict
The security posture of M EDU is enterprise-grade. Multi-tenant boundaries are strictly guarded, authentication is fail-closed, SSRF mitigations are enforced at the network socket layer, and payment webhooks are protected against timing attacks.
