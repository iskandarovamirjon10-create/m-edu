import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { applyCsrf } from './helpers/csrf';

/**
 * Auth e2e smoke suite (moved from the orphaned root `tests/` directory —
 * it was wired to nothing, pointed at the wrong port and soft-skipped when
 * the API was down).
 *
 * Contract: E2E_BASE_URL is the API origin (default http://localhost:3001).
 * The CI workflow boots the API + database before running this suite; if the
 * API is unreachable the suite FAILS loudly (no skips, no false greens).
 */
const BASE_URL = (process.env.E2E_BASE_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
const EMAIL = `e2e-auth-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;
const PASSWORD = 'Password123!';
const prisma = new PrismaClient();

/** Latest access_token cookie (cleared by logout). */
let accessTokenCookie = '';
/** Provisioned platform invitation code for the register flow. */
let inviteCode = '';

function captureAuthCookie(res: Response): void {
  for (const header of res.headers.getSetCookie?.() ?? []) {
    if (!/^access_token=/i.test(header)) continue;
    const cleared = /Max-Age=0/i.test(header) || /Expires=Thu, 01 Jan 1970/i.test(header);
    accessTokenCookie = cleared ? '' : header.split(';')[0];
  }
}

async function api(
  path: string,
  options: { method?: string; body?: unknown; withCookie?: boolean } = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const { method = 'GET', body, withCookie = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (withCookie && accessTokenCookie) headers.Cookie = accessTokenCookie;
  await applyCsrf(method, headers);

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  captureAuthCookie(res);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON response */
  }
  return { status: res.status, body: json ?? text, headers: res.headers };
}

describe('Auth (e2e)', () => {
  beforeAll(async () => {
    // Root cause, not a skip: CI boots the API before this suite. If it is
    // not reachable, fail with an actionable message instead of going green.
    const health = await fetch(`${BASE_URL}/api/health`).catch((err: unknown) => {
      throw new Error(
        `API is not reachable at ${BASE_URL} — boot it first ` +
          `(CI: "node apps/api/dist/main.js"; local: npm run dev). ${String(err)}`,
      );
    });
    if (!health.ok) {
      throw new Error(`API health check failed: HTTP ${health.status} at ${BASE_URL}/api/health`);
    }

    // Registration is invitation-gated (RegisterDto.inviteCode). Provision a
    // PlatformInvitation row exactly like the admin approval flow would, so
    // the suite exercises the REAL redeem-on-register path.
    inviteCode = randomBytes(16).toString('hex');
    await prisma.platformInvitation.create({
      data: {
        codeHash: createHash('sha256').update(inviteCode).digest('hex'),
        maxUses: 5,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/auth/register', () => {
    it('creates a user organization and sets the access_token cookie', async () => {
      const res = await api('/auth/register', {
        method: 'POST',
        withCookie: false,
        body: {
          inviteCode,
          email: EMAIL,
          password: PASSWORD,
          firstName: 'E2E',
          lastName: 'User',
          organizationName: `E2E Org ${Date.now()}`,
        },
      });

      expect(res.status).toBe(201);
      expect(accessTokenCookie).not.toBe('');
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns the access_token cookie for the registered account', async () => {
      accessTokenCookie = '';
      const res = await api('/auth/login', {
        method: 'POST',
        withCookie: false,
        body: { email: EMAIL, password: PASSWORD },
      });

      // NestJS POST default status is 201 — the auth controller does not
      // override it, so 201 is the real login contract.
      expect(res.status).toBe(201);
      expect(accessTokenCookie).not.toBe('');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the profile for the authenticated cookie', async () => {
      const res = await api('/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(EMAIL);
    });

    it('fails closed without a session cookie (401)', async () => {
      const res = await api('/auth/me', { withCookie: false });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears the cookie and invalidates the session', async () => {
      const res = await api('/auth/logout', { method: 'POST' });
      expect(res.status).toBe(201);
      expect(accessTokenCookie).toBe('');

      const after = await api('/auth/me');
      expect(after.status).toBe(401);
    });
  });
});
