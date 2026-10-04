import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { applyCsrf } from './helpers/csrf';

/**
 * Runtime proof for the PHASE 1 fail-closed authentication guard.
 *
 * `global-auth.guard.spec.ts` proves the guard logic in-process; this suite
 * proves the SAME contract against a real, already-running API over HTTP, so a
 * broken APP_GUARD wiring, a missing `@AllowPublic()` or a strategy that
 * stopped reading the cookie can never hide behind a unit-test mock.
 *
 * Conventions mirrored from the production frontend:
 *   - browser transport is the httpOnly `access_token` COOKIE (the strategy
 *     also accepts `Authorization: Bearer`, which is asserted explicitly below
 *     so any future change to that contract is caught here);
 *   - every state-changing request carries the double-submit CSRF pair
 *     (`test/helpers/csrf.ts`), otherwise the middleware 403s the request
 *     before any guard runs and the assertion would measure the wrong layer.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

const jwtService = new JwtService({
  secret: process.env.JWT_SECRET || 'your-jwt-secret-here-minimum-32-chars-long',
  expiresIn: '24h',
});

interface ApiOptions {
  method?: string;
  cookie?: string;
  bearer?: string;
  body?: unknown;
}

async function api(path: string, opts: ApiOptions = {}) {
  const method = (opts.method || (opts.body !== undefined ? 'POST' : 'GET')).toUpperCase();
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  await applyCsrf(method, headers);

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual',
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, body: json ?? text };
}

describe('Fail-closed auth on the running API (runtime proof)', () => {
  let orgId: string;
  let userId: string;
  let sessionId: string;
  let validCookie: string;
  let validBearer: string;

  beforeAll(async () => {
    const rnd = crypto.randomBytes(6).toString('hex');
    const org = await prisma.organization.create({
      data: { name: `FailClosed Org ${rnd}`, email: `failclosed-${rnd}@test.com` },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `failclosed-${rnd}@test.com`,
        firstName: 'Fail',
        lastName: 'Closed',
        passwordHash: 'not-a-real-hash',
        role: 'ORG_ADMIN',
        organizationId: orgId,
      },
    });
    userId = user.id;

    const session = await prisma.session.create({
      data: {
        userId,
        organizationId: orgId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    sessionId = session.id;

    const token = jwtService.sign({
      sub: userId,
      email: user.email,
      role: user.role,
      organizationId: orgId,
      sid: sessionId,
    });
    validCookie = `access_token=${token}`;
    validBearer = token;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { organizationId: orgId } });
    await prisma.user.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  describe('anonymous traffic is rejected (fail-closed default)', () => {
    it.each([
      ['GET', '/auth/me'],
      ['GET', '/students'],
      ['GET', '/expenses'],
      ['GET', '/dashboard/stats'],
      ['GET', '/invoices'],
    ])('%s %s without credentials -> 401', async (method, path) => {
      const res = await api(path, { method });
      expect(res.status).toBe(401);
    });
  });

  describe('public routes are reachable while neighbours stay protected', () => {
    it('GET /health is public -> 200', async () => {
      expect((await api('/health')).status).toBe(200);
    });

    it('GET /csrf-token is public -> 200', async () => {
      expect((await api('/csrf-token')).status).toBe(200);
    });

    it('POST /auth/forgot-password is public (guard skipped, handler answers) -> not 401/403', async () => {
      const rnd = crypto.randomBytes(4).toString('hex');
      const res = await api('/auth/forgot-password', {
        method: 'POST',
        body: { email: `definitely-not-registered-${rnd}@example.com` },
      });
      // The discriminator is precise: if `GlobalAuthGuard` had denied the
      // request the status would be 401, and if the CSRF middleware had eaten
      // it, 403. Anything else proves the request reached the handler.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      expect(res.status).toBeLessThan(500);
    });

    it('the protected sibling of a public route is still 401 in the same second', async () => {
      expect((await api('/auth/me')).status).toBe(401);
      expect((await api('/health')).status).toBe(200);
      expect((await api('/auth/me')).status).toBe(401);
    });
  });

  describe('credentials are validated, not merely present', () => {
    it('valid cookie -> 200 and resolves the provisioned subject', async () => {
      const res = await api('/auth/me', { cookie: validCookie });
      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      const resolved = (body?.user ?? body) as Record<string, unknown>;
      expect(resolved.id).toBe(userId);
      expect(resolved.organizationId).toBe(orgId);
    });

    it('valid Bearer header -> 200 (documented current contract)', async () => {
      expect((await api('/auth/me', { bearer: validBearer })).status).toBe(200);
    });

    it('garbage cookie -> 401', async () => {
      expect((await api('/auth/me', { cookie: 'access_token=not.a.jwt' })).status).toBe(401);
    });

    it('garbage Bearer -> 401', async () => {
      expect((await api('/auth/me', { bearer: 'garbage' })).status).toBe(401);
    });

    it('token signed with a foreign secret -> 401', async () => {
      const forged = new JwtService({ secret: 'a-completely-different-secret-value-000' }).sign({
        sub: userId,
        role: 'ORG_ADMIN',
        organizationId: orgId,
        sid: sessionId,
      });
      expect((await api('/auth/me', { cookie: `access_token=${forged}` })).status).toBe(401);
    });

    it('expired token -> 401', async () => {
      const expired = jwtService.sign(
        { sub: userId, role: 'ORG_ADMIN', organizationId: orgId, sid: sessionId },
        { expiresIn: '-1s' },
      );
      expect((await api('/auth/me', { cookie: `access_token=${expired}` })).status).toBe(401);
    });

    it('valid signature with an unknown sid -> 401 (one-time session verification)', async () => {
      const orphan = jwtService.sign({
        sub: userId,
        role: 'ORG_ADMIN',
        organizationId: orgId,
        sid: crypto.randomUUID(),
      });
      expect((await api('/auth/me', { cookie: `access_token=${orphan}` })).status).toBe(401);
    });

    // Deliberately NOT asserting anything about a token that carries NO `sid`
    // at all. Whether legacy sid-less tokens are accepted or rejected is a
    // JwtStrategy contract, asserted unit-side by
    // `src/auth/__tests__/jwt.strategy.spec.ts`, and that contract is being
    // tightened concurrently. Locking it in here as well would couple this
    // runtime proof to an in-flight change.

    it('revoked session -> 401', async () => {
      const revoked = await prisma.session.create({
        data: {
          userId,
          organizationId: orgId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          revokedAt: new Date(),
        },
      });
      const token = jwtService.sign({
        sub: userId,
        role: 'ORG_ADMIN',
        organizationId: orgId,
        sid: revoked.id,
      });
      expect((await api('/auth/me', { cookie: `access_token=${token}` })).status).toBe(401);
      await prisma.session.delete({ where: { id: revoked.id } });
    });

    it('token for a non-existent subject -> 401', async () => {
      const ghost = await prisma.session.create({
        data: {
          userId,
          organizationId: orgId,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const token = jwtService.sign({
        sub: crypto.randomUUID(),
        role: 'ORG_ADMIN',
        organizationId: orgId,
        sid: ghost.id,
      });
      expect((await api('/auth/me', { cookie: `access_token=${token}` })).status).toBe(401);
      await prisma.session.delete({ where: { id: ghost.id } });
    });

    it('token whose organizationId disagrees with the stored user -> 401', async () => {
      const token = jwtService.sign({
        sub: userId,
        role: 'ORG_ADMIN',
        organizationId: crypto.randomUUID(),
        sid: sessionId,
      });
      expect((await api('/auth/me', { cookie: `access_token=${token}` })).status).toBe(401);
    });
  });

  describe('terminal webhook is fail-closed for unauthenticated hardware', () => {
    it('POST /webhooks/terminal/event without a terminal token -> 401', async () => {
      const res = await api('/webhooks/terminal/event', {
        method: 'POST',
        body: { cameraId: '00000000-0000-0000-0000-000000000000', eventId: 'e2e', eventType: 'CHECK_IN', timestamp: new Date().toISOString() },
      });
      expect(res.status).toBe(401);
    });

    it('POST /webhooks/terminal/event with a garbage terminal token -> 4xx and never 2xx', async () => {
      const res = await fetch(`${BASE_URL}/api/webhooks/terminal/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-terminal-token': 'garbage-key',
        },
        body: JSON.stringify({
          cameraId: '00000000-0000-0000-0000-000000000000',
          eventId: 'e2e',
          eventType: 'CHECK_IN',
          timestamp: new Date().toISOString(),
        }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('observability surface', () => {
    it('GET /metrics is public at the app layer (edge nginx answers 404)', async () => {
      const res = await api('/metrics');
      // Documented contract: the endpoint itself is @AllowPublic and the
      // restriction is enforced at the edge by
      // `apps/web/nginx.conf: location = /api/metrics { return 404; }`.
      // Whether nginx actually answers 404 is NOT VERIFIED here (no deployed
      // edge in this environment) — verified instead by reading nginx.conf.
      expect(res.status).toBe(200);
    });
  });
});
