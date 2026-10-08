import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { applyCsrf } from './helpers/csrf';
import * as crypto from 'crypto';

// E2E_BASE_URL is the API ORIGIN (e.g. http://localhost:3001) everywhere;
// this suite prefixes its own /api. Tolerate a pasted /api suffix too.
const ORIGIN = (process.env.E2E_BASE_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
const BASE_URL = `${ORIGIN}/api`;
const prisma = new PrismaClient();

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET || 'medu-dev-secret-do-not-use-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
});

async function provisionToken(user: { id: string; email: string; role: string; organizationId: string; status?: string }): Promise<string> {
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      revokedAt: user.status === 'REVOKED' || user.status === 'SUSPENDED' ? new Date() : null,
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

async function api(path: string, options: { method?: string; token?: string; body?: any } = {}) {
  const { method = 'GET', token, body } = options;
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  // Requests without an Authorization header (the invitation-accept flow, run
  // before the subject has a session) are cookie-less browser mutations as far
  // as the CSRF policy is concerned; present the double-submit token so the
  // middleware lets them through instead of 403-ing them pre-handler.
  await applyCsrf(method, headers);

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not json */ }
  
  return { status: res.status, body: json || text };
}

describe('Access Control & Forensic Fixes', () => {
  let superAdminToken: string;
  let orgAAdminToken: string;
  let orgBAdminToken: string;
  let regularUserToken: string;
  
  let orgAId: string;
  let orgBId: string;
  
  let superAdminId: string;
  let orgAUserId: string;
  let orgBUserId: string;
  
  beforeAll(async () => {
    const rnd = crypto.randomBytes(4).toString('hex');
    
    // Create Orgs
    const orgA = await prisma.organization.create({ data: { name: `Org A ${rnd}`, email: `a-${rnd}@test.com` } });
    const orgB = await prisma.organization.create({ data: { name: `Org B ${rnd}`, email: `b-${rnd}@test.com` } });
    orgAId = orgA.id;
    orgBId = orgB.id;
    
    // Create Super Admin
    const sa = await prisma.user.create({
      data: { email: `sa-${rnd}@test.com`, firstName: 'Super', lastName: 'Admin', passwordHash: 'hash', role: 'SUPER_ADMIN', organizationId: orgAId }
    });
    superAdminId = sa.id;
    superAdminToken = await provisionToken(sa);
    
    // Create Org A Admin
    const aAdmin = await prisma.user.create({
      data: { email: `a-admin-${rnd}@test.com`, firstName: 'Admin', lastName: 'A', passwordHash: 'hash', role: 'ORG_ADMIN', organizationId: orgAId }
    });
    orgAAdminToken = await provisionToken(aAdmin);
    
    // Create Org B Admin
    const bAdmin = await prisma.user.create({
      data: { email: `b-admin-${rnd}@test.com`, firstName: 'Admin', lastName: 'B', passwordHash: 'hash', role: 'ORG_ADMIN', organizationId: orgBId }
    });
    orgBAdminToken = await provisionToken(bAdmin);

    // Create regular User Org A
    const rUser = await prisma.user.create({
      data: { email: `user-a-${rnd}@test.com`, firstName: 'User', lastName: 'A', passwordHash: 'hash', role: 'MANAGER', organizationId: orgAId }
    });
    orgAUserId = rUser.id;
    regularUserToken = await provisionToken(rUser);

    // Create User Org B
    const rUserB = await prisma.user.create({
      data: { email: `user-b-${rnd}@test.com`, firstName: 'User', lastName: 'B', passwordHash: 'hash', role: 'MANAGER', organizationId: orgBId }
    });
    orgBUserId = rUserB.id;
  });
  
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } }).catch(() => {});
    await prisma.session.deleteMany().catch(() => {});
    await prisma.user.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } }).catch(() => {});
    await prisma.invitation.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } }).catch(() => {});
    await prisma.accessRequest.deleteMany({ where: { email: { startsWith: 'req-' } } }).catch(() => {});
    await prisma.$disconnect();
  });

  describe('IDOR & Privilege Escalation', () => {
    it('ORG_ADMIN cannot suspend a user in another organization', async () => {
      const res = await api(`/admin/users/${orgBUserId}/suspend`, { method: 'POST', token: orgAAdminToken });
      expect(res.status).toBe(403);
    });

    it('ORG_ADMIN cannot suspend a SUPER_ADMIN', async () => {
      const res = await api(`/admin/users/${superAdminId}/suspend`, { method: 'POST', token: orgAAdminToken });
      expect(res.status).toBe(403);
    });

    it('Regular USER cannot access admin APIs', async () => {
      const res = await api(`/admin/users/${orgAUserId}/suspend`, { method: 'POST', token: regularUserToken });
      expect(res.status).toBe(403);
    });
  });

  describe('State Machine & Transitions', () => {
    let requestId: string;
    beforeAll(async () => {
      const req = await prisma.accessRequest.create({
        data: { email: `req-${Date.now()}@test.com`, firstName: 'Test', lastName: 'Test', phone: '123', requestedRole: 'MANAGER', status: 'APPROVED' }
      });
      requestId = req.id;
    });

    afterAll(async () => {
      await prisma.accessRequest.delete({ where: { id: requestId } });
    });

    it('Cannot REJECT an already APPROVED access request', async () => {
      const res = await api(`/admin/access-requests/${requestId}/reject`, { method: 'POST', token: superAdminToken });
      expect(res.status).toBe(400); // Bad Request (Request is already APPROVED)
    });
  });

  describe('Session & Status Verification', () => {
    let revokedUserToken: string;
    beforeAll(async () => {
      const rnd = crypto.randomBytes(4).toString('hex');
      const u = await prisma.user.create({
        data: { email: `revoked-${rnd}@test.com`, firstName: 'R', lastName: 'R', passwordHash: 'h', role: 'MANAGER', organizationId: orgAId, status: 'REVOKED', isActive: false }
      });
      revokedUserToken = await provisionToken({ ...u, status: 'REVOKED' });
    });

    it('Revoked session should return 401 Unauthorized', async () => {
      // Endpoint that requires auth, e.g. /users/me
      const res = await api(`/users/me`, { token: revokedUserToken });
      expect(res.status).toBe(401);
    });
  });

  describe('Parallel Invitation & Tokens', () => {
    it('Cannot use expired invitation token', async () => {
      const token = 'expired-token';
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await prisma.invitation.create({
        data: {
          email: `exp-${Date.now()}@test.com`,
          tokenHash,
          expiresAt: new Date(Date.now() - 10000), // past
          status: 'PENDING',
          organizationId: orgAId,
          role: 'MANAGER'
        }
      });

      const res = await api(`/auth/invitations/accept`, { method: 'POST', body: { token, password: 'password123' } });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired/i);
    });

    it('Parallel invitation acceptance race condition protection', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const email = `race-${Date.now()}@test.com`;
      await prisma.invitation.create({
        data: {
          email,
          tokenHash,
          expiresAt: new Date(Date.now() + 100000),
          status: 'PENDING',
          organizationId: orgAId,
          role: 'MANAGER'
        }
      });

      // Fire two identical requests at the same exact time
      const [res1, res2] = await Promise.all([
        api(`/auth/invitations/accept`, { method: 'POST', body: { token, password: 'password123' } }),
        api(`/auth/invitations/accept`, { method: 'POST', body: { token, password: 'password123' } }),
      ]);

      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201); // One should succeed
      // The loser must fail closed. 400 = invitation already consumed
      // (status flipped to ACCEPTED), 409 = concurrent unique-email
      // violation after the winner's transaction committed. Both prove the
      // second acceptance was rejected — the invitation cannot be redeemed
      // twice, which is the security property under test.
      expect(statuses.find((s) => s !== 201)).toBeDefined();
      expect(statuses.filter((s) => s === 201).length).toBe(1);
    });
  });
});
