import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Browser smoke suite for the full stack (API + built web app).
 *
 * Prerequisites (the CI workflow and the playwright `webServer` handle these):
 *  - API reachable at E2E_API_URL (default http://localhost:3001), DB migrated
 *  - web app preview at E2E_WEB_PORT (default 4173), built with `npm run build`
 *
 * These tests intentionally fail loudly when the stack is not up — they are
 * the last gate before hardware/provider smoke testing.
 */
const API = (process.env.E2E_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');

/** The playwright runner has no dotenv — reuse the API's DATABASE_URL. */
function prismaClient(): PrismaClient {
  if (process.env.DATABASE_URL) return new PrismaClient();
  try {
    const env = fs.readFileSync(path.join(__dirname, '..', 'apps', 'api', '.env'), 'utf8');
    const match = env.match(/^DATABASE_URL=(.+)$/m);
    if (match) {
      const url = match[1].trim().replace(/^["']|["']$/g, '');
      return new PrismaClient({ datasources: { db: { url } } });
    }
  } catch {
    // fall through to the default constructor (clear error if unset)
  }
  return new PrismaClient();
}

test.describe('stack smoke', () => {
  test('API health reports an up database', async ({ request }) => {
    const res = await request.get(`${API}/api/health`);
    expect(res.status(), `GET ${API}/api/health`).toBe(200);
    const body = (await res.json()) as { status: string; database: string };
    expect(body.database).toBe('up');
    expect(body.status).toBe('ok');
  });

  test('web app loads and routes unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
    // The login form must actually render (not a blank page / error boundary).
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('unknown route renders the 404 page for an authenticated user', async ({
    page,
    context,
  }) => {
    // The catch-all route lives behind the auth guard, so an anonymous hit
    // redirects to /login. Provision a real invite + account (same contract
    // as the API e2e suites), then verify the authenticated 404 surface.
    const prisma = prismaClient();
    try {
      const inviteCode = randomBytes(16).toString('hex');
      await prisma.platformInvitation.create({
        data: {
          codeHash: createHash('sha256').update(inviteCode).digest('hex'),
          maxUses: 3,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      // Double-submit handshake, exactly like the real SPA does before a
      // mutation: read the XSRF-TOKEN cookie, echo it back as a header.
      // context.request SHARES its cookie jar with the page (unlike the
      // separate `request` fixture), so the session lands in the browser.
      const csrfRes = await context.request.get(`${API}/api/csrf-token`);
      const xsrf = (await context.request.cookies()).find((c) => c.name === 'XSRF-TOKEN')?.value;
      expect(csrfRes.ok() || csrfRes.status() === 404, 'csrf probe reachable').toBeTruthy();
      const reg = await context.request.post(`${API}/api/auth/register`, {
        headers: { 'X-XSRF-TOKEN': xsrf ?? '' },
        data: {
          inviteCode,
          email: `pw-smoke-${Date.now()}@example.com`,
          password: 'Password123!',
          firstName: 'Play',
          lastName: 'Wright',
          organizationName: `PW Smoke ${Date.now()}`,
        },
      });
      expect(reg.status(), 'browser-context register must succeed').toBe(201);
    } finally {
      await prisma.$disconnect();
    }

    await page.goto('/this-route-does-not-exist-404');
    await expect(
      page.getByText(/404|topilmadi|not found/i).first(),
    ).toBeVisible();
  });
});
