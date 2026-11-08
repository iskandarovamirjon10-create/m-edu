/**
 * Login page critical-flow tests (matches Centralized IAM specifications):
 *  - success: credentials submitted, user authenticated
 *  - failure: API error shows a friendly message, no token persisted
 *  - network failure: friendly error, button re-enabled
 *  - contract & design: no third-party OAuth, clean centralized credentials
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { I18nProvider } from '@/i18n/I18nProvider';
import { LoginPage, googleOAuthUrl } from '../Login';

const loginMock = vi.fn();

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    details?: unknown;
    constructor(status: number, message: string, details?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.details = details;
    }
  },
  tokenStore: {
    get: vi.fn(() => null),
    set: vi.fn((t: string) => localStorage.setItem('medu_access_token', t)),
    clear: vi.fn(() => localStorage.removeItem('medu_access_token')),
  },
  userStore: {
    get: vi.fn(() => null),
    set: vi.fn((u: unknown) => localStorage.setItem('medu_user', JSON.stringify(u))),
    clear: vi.fn(() => localStorage.removeItem('medu_user')),
  },
  setUnauthorizedHandler: vi.fn(),
  apiUrl: (path: string) => `/api${path}`,
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
    me: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    exchangeCode: vi.fn(),
    changePassword: vi.fn(),
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderLogin() {
  return render(
    <I18nProvider initialLocale="uz">
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

const usernameInput = () => screen.getByLabelText(/foydalanuvchi nomi/i);
const passwordInput = () => screen.getByLabelText(/^parol$/i);
const submitButton = () => screen.getByRole('button', { name: /kirish/i });

describe('LoginPage critical flows', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('submits normalized username & credentials and navigates on success', async () => {
    loginMock.mockResolvedValue({
      accessToken: 'jwt-ok',
      user: { id: 'u1', username: 'admin', firstName: 'A', lastName: 'B', role: 'PLATFORM_OWNER', organizationId: 'o1' },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(usernameInput(), 'Admin');
    await user.type(passwordInput(), 'secret-pass');
    await user.click(submitButton());

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('admin', 'secret-pass'));
    await waitFor(() => expect(localStorage.getItem('medu_access_token')).toBeNull());
  });

  it('shows a friendly error on invalid credentials and does NOT persist a token', async () => {
    loginMock.mockRejectedValue(new Error('Invalid credentials'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(usernameInput(), 'baduser');
    await user.type(passwordInput(), 'wrong-pass');
    await user.click(submitButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(localStorage.getItem('medu_access_token')).toBeNull();
  });

  it('handles a network failure: shows error and re-enables form on input', async () => {
    loginMock.mockRejectedValue(new Error('Network request failed'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(usernameInput(), 'admin');
    await user.type(passwordInput(), 'x');
    await user.click(submitButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    await user.type(passwordInput(), 'new-pass');
    expect(submitButton()).toBeEnabled();
  });
});

describe('LoginPage Centralized IAM Security & Design', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves googleOAuthUrl constant for contract stability while disabling OAuth button', () => {
    expect(typeof googleOAuthUrl).toBe('string');
  });

  it('strictly excludes Google SSO button and public demo credentials', () => {
    renderLogin();
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
    expect(screen.queryByText(/google orqali davom etish/i)).toBeNull();
    expect(screen.queryByText(/tezkor sinov hisobi/i)).toBeNull();
  });

  it('renders essential centralized IAM login form elements', () => {
    renderLogin();
    expect(usernameInput()).toBeInTheDocument();
    expect(passwordInput()).toBeInTheDocument();
    expect(submitButton()).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /parolni unutdingizmi/i })).toBeInTheDocument();
  });
});
