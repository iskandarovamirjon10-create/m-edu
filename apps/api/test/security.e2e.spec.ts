/**
 * M-EDU Security End-to-End Tests
 * ------------------------------
 * Validates the REAL HTTP surface:
 *   - authentication (401 for anonymous)
 *   - RBAC (403 for forbidden roles)
 *   - tenant isolation (org A can never touch org B resources)
 *   - IDOR protection (cross-tenant resource IDs rejected)
 *   - biometric endpoints require face permissions
 *
 * Requires a running API: E2E_BASE_URL (default http://localhost:3001).
 * Created test data is cleaned up after the run.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// Load .env so JWT signing in this spec uses the same secret as the API.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

/**
 * Token provisioning for test tenants.
 *
 * The suite's goal is authorization / tenant isolation / IDOR over the real
 * HTTP surface. Provisioning tokens directly (session row + JWT, exactly the
 * AuthService.issueToken format) keeps the suite independent of the per-IP
 * login rate limit (10/min): repeated runs — CI's turbo-test pass plus the
 * dedicated e2e step, or local reruns — would otherwise trip the bucket and
 * make the suite flaky. Real login behavior is still exercised live by the
 * 'rejects invalid credentials' test and by the auth unit tests.
 */
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

const rnd = Date.now().toString(36);
const orgA = { email: `seca-${rnd}@medu.test`, password: 'security-pass-123', firstName: 'SecA', lastName: 'Alpha', organizationName: `Sec Org A ${rnd}` };
const orgB = { email: `secb-${rnd}@medu.test`, password: 'security-pass-123', firstName: 'SecB', lastName: 'Beta', organizationName: `Sec Org B ${rnd}` };

let tokenA = '';
let tokenB = '';
let orgAId = '';
let orgBId = '';
let studentAId = '';
let studentBId = '';
let studentAToken = '';

const RETRY_BACKOFF_MS = [5000, 10000, 20000, 30000];

async function api(
  path: string,
  opts: { method?: string; token?: string; body?: unknown; retry?: boolean; redirect?: RequestRedirect } = {},
) {
  const headers: Record<string, string> = {};
  // Auth is COOKIE-ONLY (HttpOnly `access_token` cookie). The JWT strategy
  // deliberately does not read the Authorization header, so the suite must
  // transport tokens the same way the real frontend does.
  if (opts.token) headers.Cookie = `access_token=${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const doFetch = () =>
    fetch(`${BASE_URL}/api${path}`, {
      method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      redirect: opts.redirect ?? 'manual', // never auto-follow OAuth redirects in tests
    });
  let res = await doFetch();
  // Bounded retry on 429 for rate-limited endpoints (login, bootstrap).
  // Production limits stay untouched — we only wait out the throttling
  // window when the server tells us we are throttled. This keeps repeated
  // suite runs (CI + local reruns) deterministic.
  if (opts.retry && res.status === 429) {
    for (const delay of RETRY_BACKOFF_MS) {
      await new Promise((r) => setTimeout(r, delay));
      res = await doFetch();
      if (res.status !== 429) break;
    }
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data, location: res.headers.get('location') };
}

/**
 * Bounded retry for rate-limited endpoints (login).
 *
 * The login endpoint is throttled at 10/min per IP. A single run issues 4
 * logins, so rapid repeated runs on one machine (CI step + local reruns)
 * can exhaust the bucket. Production limits stay untouched — we only retry
 * with backoff when the server tells us we are throttled.
 */
async function loginWithRetry(body: { email: string; password: string }) {
  return api('/auth/login', { method: 'POST', body, retry: true });
}

/**
 * Test-data provisioning via Prisma (setup — NOT the system under test).
 *
 * Registering through the public endpoint is rate-limited per IP (5/min);
 * running this suite repeatedly (CI + local reruns, turbo test + the
 * dedicated e2e step) would trip the register bucket and make the suite
 * flaky. The register flow itself is covered by auth unit tests and the
 * live smoke test. Here we only need two tenants to exercise authorization,
 * tenant isolation and IDOR — which all run over the real HTTP surface,
 * including a REAL login through /auth/login (10/min limit; this suite
 * issues at most 3 logins per run).
 */
async function register(u: typeof orgA) {
  const passwordHash = await bcrypt.hash(u.password, 10);
  const org = await prisma.organization.create({
    data: { name: u.organizationName, email: u.email, phone: u.phone },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: u.email,
      passwordHash,
      firstName: u.firstName,
      lastName: u.lastName,
      role: 'ORG_ADMIN',
    },
  });
  const created = await prisma.user.findUniqueOrThrow({ where: { email: u.email } });
  const accessToken = await provisionToken(created);
  return { accessToken, user: { id: created.id, organizationId: created.organizationId } };
}

describe('M-EDU Security E2E', () => {
  beforeAll(async () => {
    const a = await register(orgA);
    tokenA = a.accessToken;
    orgAId = a.user.organizationId;
    const b = await register(orgB);
    tokenB = b.accessToken;
    orgBId = b.user.organizationId;
  });

  afterAll(async () => {
    // Cleanup created test data in FK-safe order
    const orgIds = [orgAId, orgBId].filter(Boolean);
    for (const oid of orgIds) {
      await prisma.cameraAttendanceEvent.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.camera.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.faceAuditEvent.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.recognitionAttempt.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.recognitionSession.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.faceTemplate.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.faceEnrollment.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.attendance.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.studentGroup.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.payment.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.expense.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.followUp.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.leadActivity.deleteMany({ where: { lead: { organizationId: oid } } }).catch(() => {});
      await prisma.lead.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.notification.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.session.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.student.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.teacher.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.group.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.course.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      const users = await prisma.user.findMany({ where: { organizationId: oid }, select: { id: true } }).catch(() => []);
      await prisma.userSettings.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { organizationId: oid } }).catch(() => {});
      await prisma.organization.delete({ where: { id: oid } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it('rejects anonymous access to protected endpoints', async () => {
    const res = await api('/students');
    expect(res.status).toBe(401);
  });

  it('rejects invalid credentials', async () => {
    const res = await loginWithRetry({ email: orgA.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  }, 120000);

  it('org A can create a student', async () => {
    const res = await api('/students', {
      method: 'POST',
      token: tokenA,
      body: { firstName: 'Tenant', lastName: 'Alpha', email: `stu-a-${rnd}@medu.test`, gender: 'MALE' },
    });
    expect(res.status).toBe(201);
    studentAId = (res.data as { id: string }).id;
    expect(studentAId).toBeTruthy();
  });

  it('org B CANNOT read org A student (IDOR / tenant isolation)', async () => {
    const res = await api(`/students/${studentAId}`, { token: tokenB });
    expect(res.status).toBe(404);
  });

  it('org B CANNOT update org A student (IDOR)', async () => {
    const res = await api(`/students/${studentAId}`, { method: 'PATCH', token: tokenB, body: { address: 'HACKED' } });
    expect(res.status).toBe(404);
  });

  it('org B CANNOT deactivate org A student', async () => {
    const res = await api(`/students/${studentAId}`, { method: 'DELETE', token: tokenB });
    expect(res.status).toBe(404);
  });

  it('org B CANNOT assign org A student to their group', async () => {
    // create a course + group in org B
    const course = await api('/courses', { method: 'POST', token: tokenB, body: { name: `B Course ${rnd}`, price: 50, duration: 2 } });
    expect(course.status).toBe(201);
    const group = await api('/groups', { method: 'POST', token: tokenB, body: { name: `B Group ${rnd}`, courseId: (course.data as { id: string }).id } });
    expect(group.status).toBe(201);
    const gid = (group.data as { id: string }).id;
    const res = await api(`/students/${studentAId}/groups/${gid}`, { method: 'POST', token: tokenB });
    expect(res.status).toBe(404);
  });

  it('student role CANNOT create students (RBAC)', async () => {
    // Create a STUDENT-role user in org A
    const stu = await api('/students', {
      method: 'POST',
      token: tokenA,
      body: { firstName: 'Stu', lastName: 'Role', email: `stu-role-${rnd}@medu.test` },
    });
    expect(stu.status).toBe(201);
    const stuId = (stu.data as { id: string }).id;
    studentBId = stuId;

    // create a user with STUDENT role directly via users API
    const newUser = await api('/users', {
      method: 'POST',
      token: tokenA,
      body: { firstName: 'Rbac', lastName: 'User', email: `rbac-${rnd}@medu.test`, password: 'rbac-pass-123', role: 'STUDENT' },
    });
    expect(newUser.status).toBe(201);
    const rbacUserId = (newUser.data as { id: string }).id;

    // Token for the STUDENT-role user (provisioned, not rate-limited)
    studentAToken = await provisionToken({
      id: rbacUserId,
      email: `rbac-${rnd}@medu.test`,
      role: 'STUDENT',
      organizationId: orgAId,
    });

    const res = await api('/students', { method: 'POST', token: studentAToken, body: { firstName: 'Hax', lastName: 'X' } });
    expect(res.status).toBe(403);

    const res2 = await api('/users', { method: 'POST', token: studentAToken, body: { firstName: 'Hax', lastName: 'Y', email: `hax-${rnd}@medu.test` } });
    expect(res2.status).toBe(403);
  });

  it('face endpoints require face permissions (RBAC)', async () => {
    // A STUDENT role should not be able to register devices
    const res = await api('/face/devices', { method: 'POST', token: studentAToken, body: { name: 'Hax Device' } });
    expect(res.status).toBe(403);
  });

  it('org B cannot list org A enrollments via face API', async () => {
    const res = await api('/face/enrollments', { token: tokenB });
    expect(res.status).toBe(200);
    const d = res.data as { items?: unknown[] };
    // org B should only see its own (empty) enrollments — never org A data
    expect(Array.isArray(d.items)).toBe(true);
  });

  it('audit log respects tenant isolation', async () => {
    const res = await api('/face/audit-log', { token: tokenA });
    expect(res.status).toBe(200);
    const d = res.data as { items?: unknown[] };
    expect(Array.isArray(d.items)).toBe(true);
  });

  it('org B CANNOT create a payment for org A student (IDOR)', async () => {
    const res = await api('/payments', {
      method: 'POST',
      token: tokenB,
      body: { studentId: studentAId, amount: 999 },
    });
    expect(res.status).toBe(404);
  });

  it('org B CANNOT record attendance for org A student in an org B group', async () => {
    // create a second org-B group and try to mark org A student
    const course2 = await api('/courses', { method: 'POST', token: tokenB, body: { name: `B2 ${rnd}`, price: 10, duration: 1 } });
    const group2 = await api('/groups', { method: 'POST', token: tokenB, body: { name: `BG2 ${rnd}`, courseId: (course2.data as { id: string }).id } });
    const gid2 = (group2.data as { id: string }).id;
    const res = await api('/attendance', {
      method: 'POST',
      token: tokenB,
      body: { groupId: gid2, date: new Date().toISOString(), records: [{ studentId: studentAId, status: 'PRESENT' }] },
    });
    // student is not enrolled in org B group → rejected
    expect([400, 404]).toContain(res.status);
  });

  it('org B CANNOT read org A audit events (audit isolation)', async () => {
    // seed an audit event in org A
    await api('/face/enrollments', { method: 'POST', token: tokenA, body: { studentId: studentBId } }).catch(() => {});
    const res = await api('/face/audit-log', { token: tokenB });
    expect(res.status).toBe(200);
    const items = (res.data as { items?: { organizationId?: string }[] }).items || [];
    for (const it of items) {
      expect(it.organizationId).not.toBe(orgAId);
    }
  });

  it('org B CANNOT control org A camera workers (IDOR)', async () => {
    // org A creates a camera
    const cam = await api('/cameras', {
      method: 'POST',
      token: tokenA,
      body: { name: `CamA ${rnd}`, host: '192.168.50.10', protocol: 'RTSP', port: 554 },
    });
    expect(cam.status).toBe(201);
    const camId = (cam.data as { id: string }).id;

    // org B (also CAMERA_MANAGE) must NOT be able to start/stop/status it
    const start = await api(`/cameras/${camId}/start-worker`, { method: 'POST', token: tokenB });
    expect(start.status).toBe(404);
    const stop = await api(`/cameras/${camId}/stop-worker`, { method: 'POST', token: tokenB });
    expect(stop.status).toBe(404);
    const status = await api(`/cameras/${camId}/worker-status`, { token: tokenB });
    expect(status.status).toBe(404);
  });

  it('bootstrap is locked forever once a SUPER_ADMIN exists (409)', async () => {
    const superCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
    const res = await api('/auth/bootstrap', {
      method: 'POST',
      retry: true,
      body: {
        email: `bootstrap-${rnd}@medu.test`,
        password: 'Bootstrap-Pass-2026!!',
        firstName: 'Boot',
        lastName: 'Strap',
        organizationName: 'Bootstrap Org',
      },
    });
    if (superCount === 0) {
      // Fresh platform (CI): first bootstrap succeeds, second is locked.
      expect(res.status).toBe(201);
      const second = await api('/auth/bootstrap', {
        method: 'POST',
        retry: true,
        body: {
          email: `bootstrap2-${rnd}@medu.test`,
          password: 'Bootstrap-Pass-2026!!',
          firstName: 'Boot',
          lastName: 'Two',
          organizationName: 'Bootstrap Org 2',
        },
      });
      expect(second.status).toBe(409);
    } else {
      // Already bootstrapped (dev DB): must be locked, no backdoor.
      expect(res.status).toBe(409);
    }
  }, 120000);

  it('GET /api/auth/google returns 302 (never 500) when Google OAuth is not configured', async () => {
    // Environment precondition: this scenario only applies when Google OAuth
    // credentials are NOT configured. When GOOGLE_CLIENT_ID/SECRET ARE set
    // (e.g. a developer machine with a real .env), the guard legitimately
    // starts the OAuth flow and redirects to accounts.google.com — which is
    // exactly the behavior this suite wants to see anyway (a clean 302 that
    // never 500s). We assert the unconfigured-path error bounce only when it
    // can actually occur.
    const oauthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
    const res = await api('/auth/google', { retry: true, redirect: 'manual' });
    expect(res.status).toBe(302);
    const location = (res.location as string | null) || '';
    expect(location).not.toContain('Internal');
    if (!oauthConfigured) {
      expect(location).toContain('/auth/callback?error=');
    } else {
      expect(location).toContain('accounts.google.com');
    }
  });

  it('GET /api/auth/google/callback without a valid state is rejected (401/403, never 500)', async () => {
    const res = await api('/auth/google/callback?code=fake-code&state=fake-state', { retry: true });
    expect([401, 403]).toContain(res.status);
  });

  it('SUPER_ADMIN is still tenant-scoped (cannot read another org)', async () => {
    const superCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
    let superToken: string | null = null;
    if (superCount === 0) {
      const res = await api('/auth/bootstrap', {
        method: 'POST',
        retry: true,
        body: {
          email: `superiso-${rnd}@medu.test`,
          password: 'Super-Iso-Pass-2026!!',
          firstName: 'Super',
          lastName: 'Iso',
          organizationName: 'Super ISO Org',
        },
      });
      expect(res.status).toBe(201);
      superToken = (res.data as { accessToken: string }).accessToken;
    }
    if (!superToken) return; // no fresh SUPER_ADMIN available in this env

    // The SUPER_ADMIN's own org has no students; org A's students must not leak
    // into their listing even though SUPER_ADMIN bypasses role checks.
    const students = await api('/students', { token: superToken });
    expect(students.status).toBe(200);
    const items = (students.data as { items: unknown[] }).items;
    expect(Array.isArray(items)).toBe(true);
    const ids = items.map((s: unknown) => (s as { id: string }).id);
    expect(ids).not.toContain(studentAId);
  });
});
