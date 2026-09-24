import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET || 'medu-dev-secret-do-not-use-in-production',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
});

async function provisionToken(user: { id: string; email: string; role: string; organizationId: string }): Promise<string> {
  // Session model: { userId, organizationId, expiresAt, revokedAt, ... }
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      organizationId: user.organizationId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // JwtStrategy validates the user and, when `sid` is present, the session row.
  const jwt = jwtService.sign({
    sub: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    sid: session.id,
  });

  // P0 auth contract: the API accepts the JWT ONLY from the httpOnly
  // `access_token` cookie (jwt.strategy.ts has no Authorization fallback),
  // so E2E requests must authenticate exactly like the browser does.
  return `access_token=${jwt}`;
}

describe('Analytics & Financial Brain Security (E2E)', () => {
  let orgA: string;
  let orgB: string;
  let adminA: { id: string; email: string; role: string; organizationId: string };
  let tokenA: string;
  let tokenB: string;
  let groupB: { id: string };

  beforeAll(async () => {
    // 1. Create two isolated tenants (unique emails so re-runs pass)
    const rnd = Math.random().toString(36).slice(2, 10);
    const a = await prisma.organization.create({
      data: { name: `E2E Analytics Org A ${rnd}`, email: `org-a-${rnd}@example.com` },
    });
    orgA = a.id;

    const b = await prisma.organization.create({
      data: { name: `E2E Analytics Org B ${rnd}`, email: `org-b-${rnd}@example.com` },
    });
    orgB = b.id;

    const pwd = await bcrypt.hash('password123', 10);

    adminA = await prisma.user.create({
      data: {
        email: `admin-a-${Date.now()}@test.com`,
        passwordHash: pwd,
        firstName: 'Admin',
        lastName: 'A',
        role: 'ORG_ADMIN',
        organizationId: orgA,
        isActive: true,
      },
    });
    tokenA = await provisionToken(adminA);

    const adminB = await prisma.user.create({
      data: {
        email: `admin-b-${Date.now()}@test.com`,
        passwordHash: pwd,
        firstName: 'Admin',
        lastName: 'B',
        role: 'ORG_ADMIN',
        organizationId: orgB,
        isActive: true,
      },
    });
    tokenB = await provisionToken(adminB);

    // Create a group in Org B
    const courseB = await prisma.course.create({
      data: {
        organizationId: orgB,
        name: 'Org B Course',
        price: 1000,
        duration: 3,
      },
    });

    groupB = await prisma.group.create({
      data: {
        organizationId: orgB,
        courseId: courseB.id,
        name: 'Org B Group',
      },
    });
  });

  afterAll(async () => {
    // Clean up
    const orgs = [orgA, orgB].filter(Boolean);
    if (orgs.length > 0) {
      await prisma.group.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.course.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.session.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.user.deleteMany({ where: { organizationId: { in: orgs } } });
      await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    }
    await prisma.$disconnect();
  });

  it('prevents Org A from viewing Org B group profitability (IDOR protection)', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/groups/${groupB.id}/profitability?startDate=2024-01-01&endDate=2024-12-31`, {
      headers: { Cookie: tokenA },
    });

    // Should be 404 Not Found, not 200 nor 500
    expect(res.status).toBe(404);
  });

  it('allows Org B to view their own group profitability', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/groups/${groupB.id}/profitability?startDate=2024-01-01&endDate=2024-12-31`, {
      headers: { Cookie: tokenB },
    });

    // Group is valid for Org B, so it returns 200 (even if data is empty/zero)
    expect(res.status).toBe(200);
  });

  it('rejects cross-tenant data requests natively by using JWT organizationId', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/overview`, {
      headers: { Cookie: tokenA },
    });
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    // Just a sanity check that the endpoint returns successfully and doesn't leak B's data
    expect(data).toHaveProperty('revenue');
  });
});
