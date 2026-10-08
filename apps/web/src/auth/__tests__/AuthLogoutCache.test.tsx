/**
 * Regression test: logout must clear the TanStack query cache (F-CACHE-001).
 *
 * Scenario (Phase 5 of the forensic audit):
 *   User A (Org A) browses → queries cached → logout → User B logs in.
 *   Invariant: NO cached Org A data can render for User B — the query cache
 *   must be empty after sign-out, including when sign-out is forced by the
 *   401 interceptor rather than an explicit logout().
 */
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuthState, useAuthActions } from '../AuthContext';
import { authApi, userStore } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

vi.mock('@/lib/api', () => ({
  authApi: {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue({ message: 'ok' }),
    me: vi.fn(),
    register: vi.fn(),
    parentLogin: vi.fn(),
    exchangeCode: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
  userStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
  setUnauthorizedHandler: vi.fn(),
}));

const userA = { id: 'a-1', email: 'a@org-a.test', roles: ['ORG_ADMIN'] };

function Harness() {
  const state = useAuthState();
  const actions = useAuthActions();
  return (
    <div>
      <div data-testid="status">{state.status}</div>
      <div data-testid="email">{state.user?.email ?? 'none'}</div>
      <button onClick={() => void actions.logout({ redirect: false })}>Logout</button>
    </div>
  );
}

describe('logout — query cache isolation (tenant boundary)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
  });

  it('explicit logout() wipes every cached query', async () => {
    vi.mocked(userStore.get).mockReturnValue(userA);
    vi.mocked(authApi.me).mockResolvedValue(userA);

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    // Simulate Org A data cached while user A was browsing.
    queryClient.setQueryData(['students'], { items: [{ id: 's-1', name: 'Org A student' }] });
    queryClient.setQueryData(['payments'], { items: [{ id: 'p-1', amount: 1000 }] });
    expect(queryClient.getQueryData(['students'])).toBeDefined();

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(userStore.clear).toHaveBeenCalled();
    // THE INVARIANT: no cached Org A data survives sign-out.
    expect(queryClient.getQueryData(['students'])).toBeUndefined();
    expect(queryClient.getQueryData(['payments'])).toBeUndefined();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('logout() still wipes the cache when the server logout call fails', async () => {
    vi.mocked(userStore.get).mockReturnValue(userA);
    vi.mocked(authApi.me).mockResolvedValue(userA);
    vi.mocked(authApi.logout).mockRejectedValue(new Error('network down'));

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    queryClient.setQueryData(['students'], { leak: 'org-a-data' });

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(queryClient.getQueryData(['students'])).toBeUndefined();
  });
});
