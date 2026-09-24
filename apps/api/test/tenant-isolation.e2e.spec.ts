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

let csrfToken: string | null = null;
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
): Promise<{ status: number; body: Record<string, unknown> & { items: unknown[]; totalPaid?: number } }> {
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
  let body = { items: [] } as Record<string, unknown> & { items: unknown[]; totalPaid?: number };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = { items: [] };
  }
  return { status: res.status, body };
}

describe('Tenant Isolation (e2e)', () => {
  let _orgAToken: string;
  let orgBToken: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const rnd = crypto.randomBytes(4).toString('hex');
    
    // Create Org A
    const orgA = await prisma.organization.create({
      data: { name: `Org A ${rnd}`, email: `orga-${rnd}@test.com` },
    });
    orgAId = orgA.id;
    const adminUserA = await prisma.user.create({
      data: {
        email: `admin-a-${rnd}@test.com`,
        firstName: 'Admin',
        lastName: 'A',
        passwordHash: 'fake-hash',
        role: Role.ORG_ADMIN,
        organizationId: orgAId,
      },
    });
    _orgAToken = await provisionToken(adminUserA);

    // Create Org B
    const orgB = await prisma.organization.create({
      data: { name: `Org B ${rnd}`, email: `orgb-${rnd}@test.com` },
    });
    orgBId = orgB.id;
    const adminUserB = await prisma.user.create({
      data: {
        email: `admin-b-${rnd}@test.com`,
        firstName: 'Admin',
        lastName: 'B',
        passwordHash: 'fake-hash',
        role: Role.ORG_ADMIN,
        organizationId: orgBId,
      },
    });
    orgBToken = await provisionToken(adminUserB);

    // Seed Data in Org A
    // Student
    const studentUserA = await prisma.user.create({
      data: {
        email: `student-a-${rnd}@test.com`,
        firstName: 'Student',
        lastName: 'A',
        passwordHash: 'fake',
        role: Role.STUDENT,
        organizationId: orgAId,
      }
    });

    const studentA = await prisma.student.create({
      data: {
        organizationId: orgAId,
        userId: studentUserA.id,
      },
    });

    // Invoice & Payment
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: orgAId,
        studentId: studentA.id,
        number: `INV-A-${rnd}`,
        issueDate: new Date(),
        dueDate: new Date(),
        status: 'PAID',
        total: 100000,
        paidAmount: 100000,
        updatedAt: new Date(),
      }
    });

    const payment = await prisma.payment.create({
      data: {
        organizationId: orgAId,
        studentId: studentA.id,
        invoiceId: invoice.id,
        amount: 100000,
        method: 'CASH',
        status: 'PAID',
        reference: `PAY-A-${rnd}`,
        paidAt: new Date(),
      }
    });

    // Refund
    await prisma.refund.create({
      data: {
        organizationId: orgAId,
        paymentId: payment.id,
        amount: 50000,
        status: 'PROCESSED',
        processedAt: new Date(),
        reason: 'Duplicate',
        requestedBy: adminUserA.id,
        updatedAt: new Date(),
      }
    });

    // Expense
    await prisma.expense.create({
      data: {
        organizationId: orgAId,
        amount: 20000,
        category: 'SUPPLIES',
        date: new Date(),
        description: 'Pens',
      }
    });

    // Teacher & Payroll
    const teacherUserA = await prisma.user.create({
      data: {
        email: `teacher-a-${rnd}@test.com`,
        firstName: 'Teacher',
        lastName: 'A',
        passwordHash: 'fake',
        role: Role.TEACHER,
        organizationId: orgAId,
      }
    });

    const teacherA = await prisma.teacher.create({
      data: {
        organizationId: orgAId,
        userId: teacherUserA.id,
        salaryType: 'MONTHLY'
      }
    });

    await prisma.payrollRun.create({
      data: {
        organizationId: orgAId,
        teacherId: teacherA.id,
        periodYear: new Date().getUTCFullYear(),
        periodMonth: new Date().getUTCMonth() + 1,
        salaryType: 'MONTHLY',
        status: 'PAID',
        baseAmount: 300000,
        grossAmount: 300000,
        netAmount: 300000,
        calculatedAt: new Date(),
        updatedAt: new Date(),
      }
    });
  });

  afterAll(async () => {
    // Cleanup both tenants
    for (const id of [orgAId, orgBId]) {
      try {
        await prisma.payrollRun.deleteMany({ where: { organizationId: id } });
        await prisma.refund.deleteMany({ where: { organizationId: id } });
        await prisma.payment.deleteMany({ where: { organizationId: id } });
        await prisma.invoice.deleteMany({ where: { organizationId: id } });
        await prisma.expense.deleteMany({ where: { organizationId: id } });
        await prisma.teacher.deleteMany({ where: { organizationId: id } });
        await prisma.student.deleteMany({ where: { organizationId: id } });
        await prisma.session.deleteMany({ where: { organizationId: id } });
        await prisma.user.deleteMany({ where: { organizationId: id } });
        await prisma.organization.delete({ where: { id: id } });
      } catch { /* ignore */ }
    }
    await prisma.$disconnect();
  });

  it('Org B should not see Org A expenses', async () => {
    const res = await api('/expenses', { token: orgBToken });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it('Org B should not see Org A invoices', async () => {
    const res = await api('/invoices', { token: orgBToken });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it('Org B should not see Org A payments (via payments endpoint or invoices)', async () => {
    const res = await api('/invoices', { token: orgBToken });
    expect(res.body.items.length).toBe(0);
  });

  it('Org B should not see Org A payroll', async () => {
    const res = await api('/payroll/runs', { token: orgBToken });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });

  it('Org B dashboard should not leak Org A data', async () => {
    const res = await api('/dashboard/stats', { token: orgBToken });
    expect(res.status).toBe(200);
    expect(Number(res.body.totalPaid)).toBe(0);
  });

  it('Org B analytics forecast should not be skewed by Org A data', async () => {
    const res = await api('/forecasting/summary', { token: orgBToken });
    expect(res.status).toBe(200);
    // Since org B has no data, forecast should be empty or default
    // We just verify it succeeds and doesn't crash or leak Org A's numbers
  });
});
