import { defineConfig, devices } from '@playwright/test';

/**
 * Browser E2E configuration.
 *
 * The previous config pointed at `./tests` (vitest specs, not Playwright) and
 * had no servers wired at all — `npx playwright test` could never pass. This
 * config boots (or reuses) the real stack:
 *
 *   1. API      → http://localhost:3001  (apps/api/dist/main.js, needs a
 *                  migrated DATABASE_URL in the environment)
 *   2. Web      → http://localhost:4173  (vite preview of apps/web/dist)
 *
 * A server that already answers its health URL is REUSED (so the vitest API
 * e2e suite and this browser suite can share one boot in CI).
 */
const API_ORIGIN = (process.env.E2E_API_URL || 'http://localhost:3001').replace(/\/api\/?$/, '');
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 4173);
const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'on-first-retry',
    baseURL: WEB_ORIGIN,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      url: `${API_ORIGIN}/api/health`,
      // CI starts the API in the background for the vitest API e2e suite and
      // exports E2E_API_URL. Reuse that instance instead of refusing to start
      // against the already-occupied health URL. Local runs keep reusing when
      // a server is up (same as before) and start one otherwise.
      reuseExistingServer: Boolean(process.env.E2E_API_URL) || !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `npm run preview -w @medu/web -- --port ${WEB_PORT} --strictPort`,
      url: WEB_ORIGIN,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
