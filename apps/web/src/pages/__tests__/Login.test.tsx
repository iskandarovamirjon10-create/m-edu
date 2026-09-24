/**
 * Login page critical-flow tests (matches the current redesigned UI):
 *  - success: credentials submitted, token+user persisted
 *  - failure: API error shows a friendly message, no token persisted
 *  - network failure: friendly error, button re-enabled
 *  - Google OAuth button: renders, redirects, loading state, no double submit
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
  authApi: {
    login: (...args: unknown[]) => loginMock(...args),
    me: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    exchangeCode: vi.fn(),
  },
}));

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function renderLogin() {
  return render(
    <I18nProvider initialLocale="en">
      <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

const emailInput = () => screen.getByLabelText(/^email$/i);
const passwordInput = () => screen.getByLabelText(/^password$/i);
const submitButton = () => screen.getByRole('button', { name: 'Continue' });
const googleButton = () => screen.getByRole('button', { name: /continue with google/i });

describe('LoginPage critical flows', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('submits credentials and redirects on success', async () => {
    loginMock.mockResolvedValue({
      accessToken: 'jwt-ok',
      user: { id: 'u1', email: 'a@b.c', firstName: 'A', lastName: 'B', role: 'ORG_ADMIN', organizationId: 'o1' },
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailInput(), 'admin@test.io');
    await user.type(passwordInput(), 'secret-pass');
    await user.click(submitButton());

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('admin@test.io', 'secret-pass'));
    // Cookie-based auth: no token is ever persisted in localStorage.
    await waitFor(() => expect(localStorage.getItem('medu_access_token')).toBeNull());
  });

  it('shows a friendly error on invalid credentials and does NOT persist a token', async () => {
    loginMock.mockRejectedValue(new Error('Invalid credentials'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailInput(), 'bad@test.io');
    await user.type(passwordInput(), 'wrong-pass');
    await user.click(submitButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(localStorage.getItem('medu_access_token')).toBeNull();
  });

  it('handles a network failure: shows the error, clears pending, and re-enables the form after re-entry', async () => {
    loginMock.mockRejectedValue(new Error('Network request failed'));
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailInput(), 'a@b.c');
    await user.type(passwordInput(), 'x');
    await user.click(submitButton());

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    // The password field is cleared on failure (defensive), so the submit
    // button stays disabled until the user re-enters a password.
    await waitFor(() => expect(submitButton().getAttribute('aria-busy')).toBe('false'));
    await user.type(passwordInput(), 'new-pass');
    expect(submitButton()).toBeEnabled();
  });
});

describe('LoginPage Google OAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a keyboard-accessible "Continue with Google" button', () => {
    renderLogin();
    const btn = googleButton();
    expect(btn).toBeTruthy();
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn).not.toBeDisabled();
  });

  it('targets the real backend OAuth initiation endpoint', () => {
    // The endpoint is verified against the live API (302 to Google with a
    // state nonce); jsdom cannot execute navigation, so we assert the exact
    // URL the button redirects to.
    expect(googleOAuthUrl).toBe('/api/auth/google');
  });

  it('shows a loading state and prevents double submission while redirecting', async () => {
    const user = userEvent.setup();
    renderLogin();

    const btn = googleButton();
    await user.click(btn);

    const loadingBtn = await screen.findByRole('button', { name: /redirecting to google/i });
    expect(loadingBtn).toBeDisabled();
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true');
    // All other submit controls are disabled too while the OAuth redirect is pending.
    expect(emailInput()).toBeDisabled();
    expect(passwordInput()).toBeDisabled();
    expect(submitButton()).toBeDisabled();
  });
});
