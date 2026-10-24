import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthCallbackPage } from '../AuthCallback';
import { authApi, userStore } from '@/lib/api';
import { AuthProvider } from '@/auth/AuthContext';
import { I18nProvider } from '@/i18n/I18nProvider';

vi.mock('@/lib/api', () => ({
  authApi: {
    me: vi.fn(),
    exchangeCode: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
  userStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
  readXsrfCookie: vi.fn().mockReturnValue('mock-xsrf'),
  ensureCsrfCookie: vi.fn().mockResolvedValue('mock-xsrf'),
  setUnauthorizedHandler: vi.fn(),
}));

function renderCallback(initialEntries: string[]) {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/login" element={<div>Login Page</div>} />
            <Route path="/" element={<div>Dashboard Page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe('AuthCallbackPage — OAuth state binding and security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges authorization code and state token, updating auth context on success', async () => {
    const mockUser = {
      id: 'u-oauth-1',
      email: 'user@example.com',
      role: 'ORG_ADMIN',
      organizationId: 'org-1',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    vi.mocked(authApi.exchangeCode).mockResolvedValue({ authenticated: true });
    vi.mocked(authApi.me).mockResolvedValue(mockUser);

    renderCallback(['/auth/callback?code=valid-auth-code&state=valid-state-nonce']);

    await waitFor(() => {
      expect(authApi.exchangeCode).toHaveBeenCalledWith('valid-auth-code', 'valid-state-nonce');
    });

    await waitFor(() => {
      expect(authApi.me).toHaveBeenCalled();
      expect(userStore.set).toHaveBeenCalledWith(mockUser);
    });
  });

  it('handles missing authorization code safely with error message', async () => {
    renderCallback(['/auth/callback']);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(authApi.exchangeCode).not.toHaveBeenCalled();
  });

  it('handles provider error query parameter without attempting exchange', async () => {
    renderCallback(['/auth/callback?error=access_denied&error_description=User%20cancelled']);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('User cancelled')).toBeInTheDocument();
    });

    expect(authApi.exchangeCode).not.toHaveBeenCalled();
  });

  it('displays user-safe error and back to sign in button on exchange failure', async () => {
    vi.mocked(authApi.exchangeCode).mockRejectedValue(new Error('Invalid state'));

    renderCallback(['/auth/callback?code=bad-code&state=mismatched-state']);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    const backButton = screen.getByRole('button', { name: /sign in/i });
    expect(backButton).toBeInTheDocument();
    await userEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });
});
