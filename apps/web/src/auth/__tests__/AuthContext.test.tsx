import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuthState, useAuthActions } from '../AuthContext';
import { authApi, userStore } from '@/lib/api';

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

const mockUser = { id: '1', email: 'test@example.com', roles: ['admin'] };

function TestComponent() {
  const state = useAuthState();
  const actions = useAuthActions();

  return (
    <div>
      <div data-testid="status">{state.status}</div>
      <div data-testid="user">{state.user ? state.user.email : 'none'}</div>
      <div data-testid="error">{state.error ? state.error.code : 'none'}</div>
      <button onClick={() => actions.login('test@example.com', 'pass').catch(() => {})}>Login</button>
      <button onClick={() => actions.logout({ redirect: false })}>Logout</button>
      <button onClick={() => actions.refresh()}>Refresh</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('boots with cached user from localStorage -> status = authenticated', async () => {
    vi.mocked(userStore.get).mockReturnValue(mockUser);
    vi.mocked(authApi.me).mockResolvedValue(mockUser);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('boots with no cached user, server returns 401 -> status = unauthenticated', async () => {
    vi.mocked(userStore.get).mockReturnValue(null);
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('status')).toHaveTextContent('booting');
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });
  });

  it('login() -> calls authApi.login, dispatches SIGNED_IN, persists user', async () => {
    vi.mocked(userStore.get).mockReturnValue(null);
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 });
    vi.mocked(authApi.login).mockResolvedValue({ user: mockUser });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'pass');
    expect(userStore.set).toHaveBeenCalledWith(mockUser);
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('login() with wrong credentials -> dispatches FAILED with INVALID_CREDENTIALS', async () => {
    vi.mocked(userStore.get).mockReturnValue(null);
    vi.mocked(authApi.me).mockRejectedValue({ status: 401 });
    vi.mocked(authApi.login).mockRejectedValue({ status: 401 });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    });

    await act(async () => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('INVALID_CREDENTIALS');
  });

  it('logout() -> calls authApi.logout, clears user, dispatches SIGNED_OUT', async () => {
    vi.mocked(userStore.get).mockReturnValue(mockUser);
    vi.mocked(authApi.me).mockResolvedValue(mockUser);
    vi.mocked(authApi.logout).mockResolvedValue({ message: 'ok' });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Logout').click();
    });

    expect(authApi.logout).toHaveBeenCalled();
    expect(userStore.clear).toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  it('refresh() -> calls authApi.me, updates user', async () => {
    vi.mocked(userStore.get).mockReturnValue(mockUser);
    vi.mocked(authApi.me).mockResolvedValue({ ...mockUser, email: 'updated@example.com' });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      screen.getByText('Refresh').click();
    });

    expect(authApi.me).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('updated@example.com');
    });
  });

  it('Cross-tab sync: SIGNED_OUT from another tab clears session', async () => {
    vi.mocked(userStore.get).mockReturnValue(mockUser);
    vi.mocked(authApi.me).mockResolvedValue(mockUser);

    // The provider prefers BroadcastChannel when it exists; delete it so this
    // test exercises the `storage`-event fallback it is asserting.
    const originalBroadcastChannel = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
    delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { assign: vi.fn(), pathname: '/', search: '' },
      writable: true,
    });
    
    render(
      <AuthProvider syncTabs={true}>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    });
    
    act(() => {
      const event = new StorageEvent('storage', {
        key: '__auth_sync__',
        newValue: JSON.stringify({ type: 'SIGNED_OUT', t: Date.now() }),
      });
      window.dispatchEvent(event);
    });
    
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(window.location.assign).toHaveBeenCalledWith('/login?returnTo=%2F');
    
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
    if (originalBroadcastChannel) {
      (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = originalBroadcastChannel;
    }
  });
});
