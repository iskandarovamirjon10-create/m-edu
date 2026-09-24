import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, AuthGate } from '../AuthContext';
import { authApi, userStore } from '@/lib/api';

// AuthGate reads `useAuthState`/`useAuthActions` from the module it is defined
// in, so spying on those exports does not affect it. Exercise the real
// component through the real provider, driving the state via the API layer.
vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    register: vi.fn(),
  },
  userStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
  setUnauthorizedHandler: vi.fn(),
}));

const adminUser = {
  id: '1',
  email: 'admin@example.com',
  role: 'ORG_ADMIN',
  roles: ['ORG_ADMIN'],
};

function renderGate(ui: ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authApi.logout).mockResolvedValue({ message: 'ok' } as never);
  });

  it('Shows loading while booting', () => {
    vi.mocked(userStore.get).mockReturnValue(null);
    vi.mocked(authApi.me).mockReturnValue(new Promise(() => {}) as never);

    renderGate(
      <AuthGate loading={<div data-testid="loading">Loading...</div>}>
        <div data-testid="content">Content</div>
      </AuthGate>,
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('Shows fallback when unauthenticated', async () => {
    vi.mocked(userStore.get).mockReturnValue(null);
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 });

    renderGate(
      <AuthGate fallback={<div data-testid="fallback">Fallback</div>}>
        <div data-testid="content">Content</div>
      </AuthGate>,
    );

    expect(await screen.findByTestId('fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('Redirects to login when unauthenticated and no fallback provided', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { assign, pathname: '/', search: '' },
      writable: true,
    });
    vi.mocked(userStore.get).mockReturnValue(null);
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 });

    renderGate(
      <AuthGate>
        <div data-testid="content">Content</div>
      </AuthGate>,
    );

    await waitFor(() => expect(authApi.logout).toHaveBeenCalled());
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('Shows children when authenticated and role matches', async () => {
    vi.mocked(userStore.get).mockReturnValue(adminUser);
    vi.mocked(authApi.me).mockResolvedValue(adminUser as never);

    renderGate(
      <AuthGate roles={['ORG_ADMIN']}>
        <div data-testid="content">Content</div>
      </AuthGate>,
    );

    expect(await screen.findByTestId('content')).toBeInTheDocument();
  });

  it('Shows forbidden when role does not match', async () => {
    vi.mocked(userStore.get).mockReturnValue(adminUser);
    vi.mocked(authApi.me).mockResolvedValue(adminUser as never);

    renderGate(
      <AuthGate roles={['STUDENT']} forbidden={<div data-testid="forbidden">Forbidden</div>}>
        <div data-testid="content">Content</div>
      </AuthGate>,
    );

    expect(await screen.findByTestId('forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });
});
