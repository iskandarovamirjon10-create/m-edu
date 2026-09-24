/**
 * Financial Flows E2E — REAL HTTP surface
 * ----------------------------------------
 * Exercises the production contracts end-to-end against a running API:
 *   Invoice:  create (DRAFT) → issue (ISSUED) → record payment (PAID)
 *   Payroll:  calculate (CALCULATED) → REVIEWED → APPROVED → PAID
 *
 * Auth is COOKIE-ONLY (HttpOnly `access_token` cookie — see jwt.strategy.ts),
 * and mutating requests must complete the double-submit CSRF handshake
 * (XSRF-TOKEN cookie echoed as X-XSRF-TOKEN header — see csrf.middleware.ts).
 * The helpers below speak exactly the protocol the real frontend uses.
 *
 * Requires a running API on E2E_BASE_URL (default http://localhost:3001).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET || 'medu-dev-secret-do-not-use-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
});

async function provisionToken(user: { id: string; email: string; role: string; organizationId: string }): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return jwtService.sign({
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    sid: session.id,
  });
}

// ---------------------------------------------------------------------------
// HTTP helper: cookie auth + double-submit CSRF (mirrors web/src/lib/api.ts)
// ---------------------------------------------------------------------------
let csrfToken: string | null = null;

/**
 * Any /api request makes the server issue an XSRF-TOKEN cookie (the CSRF
 * middleware runs before guards, so even a 401 response sets the cookie).
 * NOTE: the bare `/` RootController route does NOT pass through the Nest
 * middleware pipeline — the URL must be under /api.
 */
async function ensureCsrfToken(): Promise<void> {
  if (csrfToken) return;
  const res = await fetch(`${BASE_URL}/api/analytics/overview`, { redirect: 'manual' });
  const cookies = res.headers.getSetCookie?.() ?? [];
  for (const c of cookies) {
    const m = c.match(/XSRF-TOKEN=([^;]+)/);
    if (m) csrfToken = m[1];
  }
}

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const method = (opts.method ?? (opts.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (mutating) await ensureCsrfToken();

  const cookieParts: string[] = [];
  if (opts.token) cookieParts.push(`access_token=${opts.token}`);
  if (mutating && csrfToken) cookieParts.push(`XSRF-TOKEN=${csrfToken}`);

  const headers: Record<string, string> = {};
  if (cookieParts.length > 0) headers.Cookie = cookieParts.join('; ');
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (mutating && csrfToken) headers['X-XSRF-TOKEN'] = csrfToken;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { status: res.status, body };
}

describe('Financial Flows (e2e)', () => {
  let adminToken: string;
  let orgId: string;
  let _adminId: string;

  beforeAll(async () => {
    // 1. Create a dedicated organization and admin user
    const rnd = crypto.randomBytes(4).toString('hex');
    const org = await prisma.organization.create({
      data: { name: `Fin Org ${rnd}`, email: `fin-org-${rnd}@test.com` },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `fin-admin-${rnd}@test.com`,
        firstName: 'Fin',
        lastName: 'Admin',
        passwordHash: 'fake-hash',
        role: Role.ORG_ADMIN,
        organizationId: orgId,
      },
    });
    _adminId = user.id;

    adminToken = await provisionToken(user);
  });

  afterAll(async () => {
    // Child-first cleanup of the dedicated tenant
    try {
      await prisma.payrollRun.deleteMany({ where: { organizationId: orgId } });
      await prisma.refund.deleteMany({ where: { organizationId: orgId } });
      await prisma.payment.deleteMany({ where: { organizationId: orgId } });
      await prisma.invoice.deleteMany({ where: { organizationId: orgId } });
      await prisma.expense.deleteMany({ where: { organizationId: orgId } });
      await prisma.studentGroup.deleteMany({ where: { organizationId: orgId } });
      await prisma.group.deleteMany({ where: { organizationId: orgId } });
      await prisma.course.deleteMany({ where: { organizationId: orgId } });
      await prisma.teacher.deleteMany({ where: { organizationId: orgId } });
      await prisma.student.deleteMany({ where: { organizationId: orgId } });
      await prisma.session.deleteMany({ where: { organizationId: orgId } });
      await prisma.user.deleteMany({ where: { organizationId: orgId } });
      await prisma.financialPeriod.deleteMany({ where: { organizationId: orgId } });
      await prisma.auditLog.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.delete({ where: { id: orgId } });
    } catch {
      // best-effort cleanup; never mask test results
    }
    await prisma.$disconnect();
  });

  describe('Payment Flow', () => {
    let studentId: string;
    let invoiceId: string;

    it('should create a student', async () => {
      const user = await prisma.user.create({
        data: {
          email: `fin-student-${crypto.randomBytes(4).toString('hex')}@test.com`,
          firstName: 'Fin',
          lastName: 'Student',
          passwordHash: 'fake-hash',
          role: Role.STUDENT,
          organizationId: orgId,
        },
      });
      const student = await prisma.student.create({
        data: {
          organizationId: orgId,
          userId: user.id,
        },
      });
      studentId = student.id;
      expect(studentId).toBeDefined();
    });

    it('should create an invoice', async () => {
      const res = await api('/invoices', {
        token: adminToken,
        body: {
          studentId,
          number: `INV-E2E-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          dueDate: new Date(Date.now() + 86400000).toISOString(),
          items: [
            { description: 'Math Course', quantity: 1, unitPrice: 150000 },
          ],
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('DRAFT');
      expect(Number(res.body.total)).toBe(150000);
      invoiceId = res.body.id;
    });

    it('should issue the invoice', async () => {
      const res = await api(`/invoices/${invoiceId}/issue`, {
        method: 'POST',
        token: adminToken,
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ISSUED');
    });

    it('should record a payment and mark the invoice as PAID', async () => {
      const res = await api(`/invoices/${invoiceId}/payments`, {
        token: adminToken,
        body: {
          invoiceId,
          amount: 150000,
          method: 'CASH',
          reference: `REF-${crypto.randomBytes(4).toString('hex')}`,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PAID');

      // Authoritative invoice state must reflect the full payment
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      expect(invoice?.status).toBe('PAID');
      expect(Number(invoice?.paidAmount)).toBe(150000);
    });
  });

  describe('Payroll Flow', () => {
    let teacherId: string;
    let runId: string;

    it('should create a teacher', async () => {
      const user = await prisma.user.create({
        data: {
          email: `fin-teacher-${crypto.randomBytes(4).toString('hex')}@test.com`,
          firstName: 'Fin',
          lastName: 'Teacher',
          passwordHash: 'fake-hash',
          role: Role.TEACHER,
          organizationId: orgId,
        },
      });
      const teacher = await prisma.teacher.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          salaryType: 'MONTHLY',
        },
      });
      teacherId = teacher.id;
      expect(teacherId).toBeDefined();
    });

    it('should calculate a payroll run (CALCULATED on create)', async () => {
      // POST /hr/payroll/runs IS the calculate endpoint — it creates the run
      // in CALCULATED state (MONTHLY requires an explicit baseAmount).
      const res = await api('/hr/payroll/runs', {
        token: adminToken,
        body: {
          teacherId,
          periodYear: new Date().getUTCFullYear(),
          periodMonth: new Date().getUTCMonth() + 1,
          salaryType: 'MONTHLY',
          baseAmount: 5000000,
          bonus: 500000,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('CALCULATED');
      // Gross: 5000000 (base) + 500000 (bonus) = 5500000
      expect(Number(res.body.grossAmount)).toBe(5500000);
      runId = res.body.id;
    });

    it('should reject an illegal transition (CALCULATED → APPROVED)', async () => {
      const res = await api(`/hr/payroll/runs/${runId}/approve`, {
        method: 'POST',
        token: adminToken,
      });
      expect(res.status).toBe(409);
    });

    it('should transition through REVIEWED → APPROVED → PAID', async () => {
      let res = await api(`/hr/payroll/runs/${runId}/review`, {
        method: 'POST',
        token: adminToken,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('REVIEWED');

      res = await api(`/hr/payroll/runs/${runId}/approve`, {
        method: 'POST',
        token: adminToken,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('APPROVED');

      res = await api(`/hr/payroll/runs/${runId}/pay`, {
        method: 'POST',
        token: adminToken,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PAID');
    });
  });
});
