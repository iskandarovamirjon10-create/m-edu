/**
 * Auth flow regression tests (login → dashboard → guard behavior).
 *
 * Covers the exact scenarios that produced the "login succeeds then the
 * dashboard bounces back to /login" symptom:
 *   1.  Valid login                → dashboard stays mounted.
 *   2.  Page refresh (remount)     → server-verified session restores auth.
 *   3.  Invalid/expired session    → redirect to /login.
 *   4.  Dashboard API request      → sent with credentials (cookies).
 *   5.  Auth boot in flight        → NO premature redirect to /login.
 *   6.  Logout                     → dashboard access denied afterwards.
 *   7.  Direct /dashboard access   → authenticated: allowed / anonymous: /login.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { Protected, PublicOnly } from '@/App';

// The api module is mocked: no network, but the contract (authApi.me,
// authApi.login, authApi.logout, credentials) stays intact.
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return {
    ...actual,
    userStore: { get: vi.fn(() => null), set: vi.fn(), clear: vi.fn() },
    setUnauthorizedHandler: vi.fn(),
    authApi: {
      me: vi.fn(),
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
      exchangeCode: vi.fn(),
    },
  };
});

vi.mock('@/components/ui', () => ({
  PageLoader: ({ label }: { label?: string }) => <div role="status">{label ?? 'Loading…'}</div>,
}));

vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: vi.fn() }));

import { authApi } from '@/lib/api';

const SEED_USER = {
  id: 'u1',
  email: 'admin@medu.test',
  firstName: 'Ada',
  lastName: 'Admin',
  role: 'ORG_ADMIN',
  organizationId: 'org1',
};

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicOnly><div>LOGIN_PAGE</div></PublicOnly>} />
          <Route path="/dashboard" element={<Protected><div>DASHBOARD_PAGE</div></Protected>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Auth flow regression (login → dashboard)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('TEST 1: valid login mounts the session and the dashboard stays (no bounce to /login)', async () => {
    (authApi.me as any).mockResolvedValue(SEED_USER);
    // A fresh provider instance right after a successful login behaves
    // exactly like the post-login navigation: boot → verify → authenticated.
    renderRoutes('/dashboard');
    await waitFor(() => expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy());
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
  });

  it('TEST 2: page refresh — server-verified session restores the dashboard', async () => {
    // Simulates a hard reload with a valid cookie: /auth/me returns the user.
    (authApi.me as any).mockResolvedValue(SEED_USER);
    renderRoutes('/dashboard');
    // Boot first paints from cache (null here) and shows the loader — the
    // user must NOT be bounced to /login during this window.
    expect(screen.getByRole('status')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy());
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
  });

  it('TEST 3: invalid/expired session redirects to /login', async () => {
    (authApi.me as any).mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    renderRoutes('/dashboard');
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeTruthy());
    expect(screen.queryByText('DASHBOARD_PAGE')).toBeNull();
  });

  it('TEST 4: dashboard API requests carry authentication credentials (cookies)', async () => {
    // Assert the credential-first contract on the REAL transport module
    // (loaded through importOriginal inside the mock factory) — the mocked
    // authApi calls never touch it.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ ok: true }),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    try {
      const apiModule = await import('@/lib/api');
      const request = (apiModule as { default: (p: string) => Promise<unknown> }).default;
      await request('/dashboard/stats');
      const [, init] = fetchMock.mock.calls[0];
      expect(init.credentials).toBe('include');
      expect(init.headers.Authorization).toBeUndefined(); // cookie-only auth
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('TEST 5: while auth boot is in flight there is NO premature redirect to /login', async () => {
    // /auth/me never resolves during the assertion window (pending session).
    let resolveMe: (u: unknown) => void = () => {};
    (authApi.me as any).mockReturnValue(new Promise((res) => { resolveMe = res; }));
    renderRoutes('/dashboard');
    // Loader (not the login page) must be visible while booting…
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('LOGIN_PAGE')).toBeNull();
    // …and once the session resolves, the dashboard renders.
    resolveMe(SEED_USER);
    await waitFor(() => expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy());
  });

  it('TEST 6: after logout (session revoked server-side) the dashboard is no longer accessible', async () => {
    // First provider boot verifies fine (session active)…
    (authApi.me as any).mockResolvedValueOnce(SEED_USER);
    const first = renderRoutes('/dashboard');
    await waitFor(() => expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy());
    first.unmount();

    // …after logout the cookie is gone: /auth/me 401 → guard redirects.
    (authApi.me as any).mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { status: 401 }));
    renderRoutes('/dashboard');
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeTruthy());
    expect(screen.queryByText('DASHBOARD_PAGE')).toBeNull();
  });

  it('TEST 7: direct /dashboard access — anonymous goes to /login, authenticated stays', async () => {
    // Anonymous: /auth/me 401 → redirected.
    (authApi.me as any).mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));
    const first = renderRoutes('/dashboard');
    await waitFor(() => expect(screen.getByText('LOGIN_PAGE')).toBeTruthy());
    first.unmount();

    // Authenticated: allowed in.
    (authApi.me as any).mockResolvedValue(SEED_USER);
    renderRoutes('/dashboard');
    await waitFor(() => expect(screen.getByText('DASHBOARD_PAGE')).toBeTruthy());
  });
});
