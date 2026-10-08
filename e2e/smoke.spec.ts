import { test, expect } from '@playwright/test';

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

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-404');
    await expect(
      page.getByText(/404|topilmadi|not found/i).first(),
    ).toBeVisible();
  });
});
