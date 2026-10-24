# M-EDU Security Test Results & Regression Evidence

> **Auditor Role:** Principal Application Security Engineer & DevSecOps Lead  
> **Environment:** Node.js v20+, Vitest v5.0.1, PostgreSQL 16 (pg_trgm), Redis 7  
> **Test Scope:** Authentication, Authorization, Multi-Tenant Isolation, Financial Integrity, Webhooks, CSRF, and BOLA Defenses  
> **Status:** 100% Tests Passed (450+ Security Assertions Verified)  

---

## 1. Executive Testing Summary

All critical security controls, authorization boundaries, and vulnerability patches were validated with automated Vitest suites. Zero security regressions were detected.

```
========================================================================================
Test Suite Group              Test Files     Passed    Failed    Duration   Status
========================================================================================
Auth & Multi-Tenant Core      28 files       328       0         29.08s     PASSED
Payments & Financial Ledgers  8 files        75        0         3.54s      PASSED
Security Center & CSRF        3 files        26        0         2.76s      PASSED
Webhooks & Replay Defense     1 file         21        0         0.04s      PASSED
----------------------------------------------------------------------------------------
TOTALS                        40 files       450       0         35.42s     100% PASS
========================================================================================
```

---

## 2. Test Suite 1: Multi-Tenant Cross-Organization Isolation

- **File:** [`apps/api/src/auth/__tests__/cross-tenant-isolation.spec.ts`](file:///apps/api/src/auth/__tests__/cross-tenant-isolation.spec.ts)
- **Execution Command:** `npx vitest run apps/api/src/auth/__tests__/cross-tenant-isolation.spec.ts`
- **Result:** **16 passed out of 16 tests** (28ms)

### Scope & Assertions
Validates that identity principals in Tenant A (`org-alpha`) cannot view, modify, or delete entities belonging to Tenant B (`org-beta`) across all sensitive educational resources:

1. **Student Records:** Reading or updating students from another tenant throws `NotFoundException` (preventing existence probing).
2. **Teacher Profiles:** Reassigning a teacher to an unauthorized tenant is rejected.
3. **Attendance Logs:** Marking attendance for a group outside the caller's tenant is denied.
4. **Groups & Classes:** Queries filter strictly by authenticated `organizationId`.
5. **Invoices & Ledgers:** Invoices from foreign organizations are completely unreachable.
6. **Parent Accounts:** Linked students must belong to the requesting tenant.

### Terminal Output Evidence
```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/auth/__tests__/cross-tenant-isolation.spec.ts (16 tests) 28ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Duration  1.21s
```

---

## 3. Test Suite 2: Public Route Whitelist Protection

- **File:** [`apps/api/src/auth/__tests__/public-whitelist.spec.ts`](file:///apps/api/src/auth/__tests__/public-whitelist.spec.ts)
- **Execution Command:** `npx vitest run apps/api/src/auth/__tests__/public-whitelist.spec.ts`
- **Result:** **5 passed out of 5 tests** (48ms)

### Scope & Assertions
Scans the metadata of all 78 controllers at runtime using NestJS reflection and asserts that:
1. No endpoint is accidentally exposed without an `@AllowPublic()` or explicit public decorator.
2. The number of public routes matches the approved platform whitelist exactly (24 routes).
3. No administrative or privileged handler carries `@AllowPublic()`.
4. All non-public controllers register `JwtAuthGuard` and `RolesGuard`.

### Terminal Output Evidence
```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/auth/__tests__/public-whitelist.spec.ts (5 tests) 48ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  2.15s
```

---

## 4. Test Suite 3: SEC-FIN-01 BOLA / Payment Links Regression Suite

- **File:** [`apps/api/src/payments/__tests__/invoices.controller.spec.ts`](file:///apps/api/src/payments/__tests__/invoices.controller.spec.ts)
- **Execution Command:** `npx vitest run apps/api/src/payments/__tests__/invoices.controller.spec.ts`
- **Result:** **14 passed out of 14 tests** (32ms)

### Scope & Assertions
Specifically verifies the patch for **SEC-FIN-01**:
1. When caller is a `STUDENT`, `InvoicesController.paymentLinks` invokes `invoicesService.getInvoiceForStudent(orgId, userId, id)`.
2. If the invoice does not belong to the calling student, `getInvoiceForStudent` rejects the call, propagating `NotFoundException`. The payment links service is never called.
3. When caller is an `ORG_ADMIN` or `MANAGER`, the student ownership check is bypassed and links are generated for the organization.

### Regression Test Implementation Snippet
```typescript
describe('paymentLinks (SEC-FIN-01 regression)', () => {
  it('verifies student ownership via getInvoiceForStudent if caller is STUDENT', async () => {
    service.getInvoiceForStudent.mockResolvedValue({ id: 'inv-1' });
    service.getPaymentLinks.mockResolvedValue({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
    const result = await controller.paymentLinks(
      { organizationId: orgId, id: userId, role: Role.STUDENT },
      'inv-1',
    );
    expect(service.getInvoiceForStudent).toHaveBeenCalledWith(orgId, userId, 'inv-1');
    expect(service.getPaymentLinks).toHaveBeenCalledWith(orgId, 'inv-1');
    expect(result).toEqual({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
  });

  it('rejects cross-student payment links request if invoice does not belong to student', async () => {
    service.getInvoiceForStudent.mockRejectedValue(new Error('Invoice not found'));
    await expect(
      controller.paymentLinks(
        { organizationId: orgId, id: userId, role: Role.STUDENT },
        'inv-other-student',
      ),
    ).rejects.toThrow('Invoice not found');
    expect(service.getInvoiceForStudent).toHaveBeenCalledWith(orgId, userId, 'inv-other-student');
    expect(service.getPaymentLinks).not.toHaveBeenCalled();
  });

  it('bypasses student ownership check if caller is ORG_ADMIN', async () => {
    service.getPaymentLinks.mockResolvedValue({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
    const result = await controller.paymentLinks(
      { organizationId: orgId, id: userId, role: Role.ORG_ADMIN },
      'inv-1',
    );
    expect(service.getInvoiceForStudent).not.toHaveBeenCalled();
    expect(service.getPaymentLinks).toHaveBeenCalledWith(orgId, 'inv-1');
    expect(result).toEqual({ paymeUrl: 'https://payme/1', clickUrl: 'https://click/1' });
  });
});
```

### Terminal Output Evidence
```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/payments/__tests__/invoices.controller.spec.ts (14 tests) 32ms

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Duration  1.42s
```

---

## 5. Test Suite 4: Financial Ledger & Anti-Double-Decrement Concurrency Suite

- **File:** [`apps/api/src/payments/__tests__/p0-balance-double-decrement.spec.ts`](file:///apps/api/src/payments/__tests__/p0-balance-double-decrement.spec.ts)
- **Execution Command:** `npx vitest run apps/api/src/payments/__tests__/p0-balance-double-decrement.spec.ts`
- **Result:** **10 passed out of 10 tests** (40ms)

### Scope & Assertions
Simulates race conditions and concurrent mutation attacks against student ledger balances and invoice settlement:
1. **Parallel Payment Race:** 5 concurrent payments against an invoice with a 100,000 UZS balance only settle up to the exact remaining total. Overpayments are rejected via optimistic guards.
2. **Refund Concurrency:** Processing simultaneous refunds against the same payment cannot exceed the original payment amount.
3. **Receipt Number Generation:** Sequential receipt numbers (`RCP-YYYY-NNNNNN`) are guaranteed non-colliding under load.

### Terminal Output Evidence
```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/payments/__tests__/p0-balance-double-decrement.spec.ts (10 tests) 40ms

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Duration  1.65s
```

---

## 6. Test Suite 5: Webhook HMAC Cryptographic & Replay Defense

- **File:** [`apps/api/src/telegram/__tests__/telegram-webhook.controller.spec.ts`](file:///apps/api/src/telegram/__tests__/telegram-webhook.controller.spec.ts)
- **Execution Command:** `npx vitest run apps/api/src/telegram/__tests__/telegram-webhook.controller.spec.ts`
- **Result:** **21 passed out of 21 tests** (40ms)

### Scope & Assertions
1. **Secret Validation:** Rejects requests with missing secret, invalid secret, or unconfigured server secret.
2. **Timing-Attack Resistance:** Enforces `crypto.timingSafeEqual` comparison.
3. **Payload Safeguards:** Rejects oversized payloads exceeding size thresholds.
4. **Replay Deduplication:** Simulates repeated delivery of identical `update_id` payloads; duplicate events are safely ignored without re-executing actions.

### Terminal Output Evidence
```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/telegram/__tests__/telegram-webhook.controller.spec.ts (21 tests) 40ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  1.12s
```

---

## 7. Test Suite 6: Security Center & CSRF Defenses

- **Files:**
  - [`apps/api/src/security/__tests__/security.service.spec.ts`](file:///apps/api/src/security/__tests__/security.service.spec.ts)
  - [`apps/api/src/security/__tests__/csrf.spec.ts`](file:///apps/api/src/security/__tests__/csrf.spec.ts)
  - [`apps/api/src/security/__tests__/security.controller.spec.ts`](file:///apps/api/src/security/__tests__/security.controller.spec.ts)
- **Execution Command:** `npx vitest run apps/api/src/security/__tests__/`
- **Result:** **26 passed out of 26 tests** (2.76s)

### Scope & Assertions
1. **Security Alert Derivation:** Validates that repeated `LOGIN_FAILED` entries from an IP within a 30-day window are grouped into a single `CRITICAL` alert.
2. **Honest Alert Resolution:** Confirms that calling `resolve` on a derived alert fails loudly rather than corrupting the unrelated `DataQualityIssue` table.
3. **CSRF Protection:** Validates cryptographic double-submit cookie CSRF tokens, header validation, and exclusion of safe HTTP methods (`GET`, `HEAD`, `OPTIONS`).

### Terminal Output Evidence
```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/security/__tests__/security.service.spec.ts (8 tests) 31ms
 ✓ apps/api/src/security/__tests__/csrf.spec.ts (14 tests) 25ms
 ✓ apps/api/src/security/__tests__/security.controller.spec.ts (4 tests) 11ms

 Test Files  3 passed (3)
      Tests  26 passed (26)
   Duration  2.76s
```

---

## 8. Test Suite 7: Full Payments & Invoices Domain

- **Directory:** `apps/api/src/payments/__tests__/`
- **Execution Command:** `npx vitest run apps/api/src/payments/__tests__/`
- **Result:** **75 passed out of 75 tests** (3.54s)

```text
 RUN  v5.0.1 C:/Users/Amirjon/education web platform

 ✓ apps/api/src/payments/__tests__/payment-links.util.spec.ts (4 tests) 45ms
 ✓ apps/api/src/payments/__tests__/invoices.service.spec.ts (17 tests) 49ms
 ✓ apps/api/src/payments/__tests__/p0-balance-double-decrement.spec.ts (10 tests) 40ms
 ✓ apps/api/src/payments/__tests__/payments.service.spec.ts (11 tests) 39ms
 ✓ apps/api/src/payments/__tests__/financial-cron.service.spec.ts (8 tests) 33ms
 ✓ apps/api/src/payments/__tests__/invoices.controller.spec.ts (14 tests) 32ms
 ✓ apps/api/src/payments/__tests__/invoice-outstanding.spec.ts (6 tests) 9ms
 ✓ apps/api/src/payments/__tests__/payments.controller.spec.ts (5 tests) 11ms

 Test Files  8 passed (8)
      Tests  75 passed (75)
   Duration  3.54s
```

---

## 9. Test Suite 8: Complete Auth & Identity Management

- **Directory:** `apps/api/src/auth/__tests__/`
- **Execution Command:** `npx vitest run apps/api/src/auth/__tests__/`
- **Result:** **328 passed out of 328 tests** (29.08s)

Key highlights:
- **Password Hashing:** `auth.register-dto.spec.ts` proves that only bcrypt hashes reach the database; plaintext passwords are never stored.
- **Password Reset:** `password-reset.spec.ts` proves reset tokens are stored as SHA-256 hashes, burned on use, and invalidated if email delivery fails.
- **Session Revocation:** `refresh-token.integration.spec.ts` verifies concurrent token refresh behavior and single-session minting.
- **Google OAuth:** `google-oauth.spec.ts` verifies rate limits (10 req/min per IP) and OIDC token validation.
