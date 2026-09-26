/**
 * Register page critical-flow tests (Glass UI preserved — no UI redesign).
 *
 * Covers the required registration matrix:
 * - successful registration → POST /auth/register payload, redirect to /
 * - duplicate email (409 from the API) surfaces the server's message
 * - client-side validation: weak password, password mismatch,
 * empty required fields, invalid email
 * - busy state prevents double submission
 *
 * AuthCallback error/success handling is covered indirectly by the Google
 * URL contract tests in Login.test.tsx; the backend exchange endpoint is
 * covered by the API suite (auth code single-use, state rejection).
 */
import { describe, it, expect, vi, beforeEach, afterEach} from'vitest';
import { render, screen, waitFor} from'@testing-library/react';
import userEvent from'@testing-library/user-event';
import { MemoryRouter} from'react-router-dom';
import { AuthProvider} from'@/auth/AuthContext';
import { I18nProvider} from'@/i18n/I18nProvider';
import { RegisterPage} from'../Register';
import { ApiError} from'@/lib/api';

const registerMock = vi.fn();

vi.mock('@/lib/api', async (importOriginal) => {
 const actual = await importOriginal<typeof import('@/lib/api')>();
 return {
 ...actual,
 userStore: {
 get: vi.fn(() => null),
 set: vi.fn((u: unknown) => localStorage.setItem('medu_user', JSON.stringify(u))),
 clear: vi.fn(() => localStorage.removeItem('medu_user')),
},
 setUnauthorizedHandler: vi.fn(),
 authApi: {
 login: vi.fn(),
 me: vi.fn(),
 register: (...args: unknown[]) => registerMock(...args),
 logout: vi.fn(),
 refresh: vi.fn(),
 exchangeCode: vi.fn(),
},
};
});

vi.mock('react-router-dom', async (importOriginal) => {
 const actual = await importOriginal<typeof import('react-router-dom')>();
 return { ...actual, useNavigate: () => navigateMock};
});

const navigateMock = vi.fn();

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** The Register inputs use unassociated <label>s — query by placeholder. */
const field = (placeholder: string) => screen.getByPlaceholderText(placeholder);
/** Labels may append " *" for required fields — anchor to avoid Confirm password. */
const F = {
  firstName: () => field('John'),
  lastName: () => field('Doe'),
  email: () => field('john@example.com'),
  org: () => field('Bright Future Academy'),
  password: () => screen.getByLabelText(/^password/i),
  confirm: () => screen.getByLabelText(/^confirm password/i),
};

function renderRegister() {
 return render(
 <I18nProvider initialLocale="en">
 <MemoryRouter initialEntries={['/register']} future={{ v7_startTransition: true, v7_relativeSplatPath: true}}>
 <AuthProvider>
 <RegisterPage />
 </AuthProvider>
 </MemoryRouter>
 </I18nProvider>,
 );
}

const VALID = {
 firstName:'Jane',
 lastName:'Doe',
 email:'jane@example.com',
 org:'Bright Future Academy',
 password:'Str0ngPass!x',
 confirm:'Str0ngPass!x',
};

async function fill(user: ReturnType<typeof userEvent.setup>, over: Partial<typeof VALID> = {}) {
 const v = { ...VALID, ...over};
 await user.type(F.firstName(), v.firstName);
 await user.type(F.lastName(), v.lastName);
 await user.type(F.email(), v.email);
 await user.type(F.org(), v.org);
 await user.type(F.password(), v.password);
 await user.type(F.confirm(), v.confirm);
}

describe('RegisterPage critical flows', () => {
 beforeEach(() => {
 localStorage.clear();
 vi.clearAllMocks();
});
 afterEach(() => {
 vi.clearAllMocks();
});

 it('submits a valid registration payload and navigates to the app on success', async () => {
 registerMock.mockResolvedValue({
 user: { id:'u1', email: VALID.email, firstName:'Jane', lastName:'Doe', role:'ORG_ADMIN', organizationId:'o1'},
});
 const user = userEvent.setup();
 renderRegister();

 const submit = screen.getByRole('button', { name: /create|register|account/i});
 expect(submit).toBeDisabled(); // empty form → disabled (no empty-field submit)
 await fill(user);
 await user.click(submit);

 await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
 expect(registerMock).toHaveBeenCalledWith({
 firstName:'Jane',
 lastName:'Doe',
 email:'jane@example.com',
 phone: undefined,
 organizationName:'Bright Future Academy',
 password:'Str0ngPass!x',
});
 await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true}));
});

 it('shows the server error on duplicate email (409) and does NOT navigate', async () => {
 registerMock.mockRejectedValue(new ApiError(409,'Email already registered'));
 const user = userEvent.setup();
 renderRegister();

 await fill(user);
 await user.click(screen.getByRole('button', { name: /create|register|account/i}));

 await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
 expect(screen.getByRole('alert').textContent).toContain('Email already registered');
 expect(navigateMock).not.toHaveBeenCalled();
});

 it('rejects a password mismatch client-side without calling the API', async () => {
 const user = userEvent.setup();
 renderRegister();

 await fill(user, { confirm:'DifferentPass1'});
 await user.click(screen.getByRole('button', { name: /create|register|account/i}));

 await waitFor(() => expect(screen.getByText(/passwords do not match/i)).toBeTruthy());
 expect(registerMock).not.toHaveBeenCalled();
});

 it('rejects a weak password client-side without calling the API', async () => {
 const user = userEvent.setup();
 renderRegister();

 await fill(user, { password:'weak', confirm:'weak'});
 await user.click(screen.getByRole('button', { name: /create|register|account/i}));

 await waitFor(() => expect(screen.getByText(/8 characters/i)).toBeTruthy());
 expect(registerMock).not.toHaveBeenCalled();
});

 it('rejects an invalid email client-side without calling the API', async () => {
 const user = userEvent.setup();
 renderRegister();

 await fill(user, { email:'not-an-email'});
 await user.click(screen.getByRole('button', { name: /create|register|account/i}));

 await waitFor(() => expect(screen.getByText(/valid email/i)).toBeTruthy());
 expect(registerMock).not.toHaveBeenCalled();
});

 it('does not submit twice while a request is in flight (busy guard)', async () => {
 let resolveRegister!: (v: unknown) => void;
 registerMock.mockReturnValue(
 new Promise((resolve) => {
 resolveRegister = resolve;
}),
 );
 const user = userEvent.setup();
 renderRegister();

 await fill(user);
 const submit = screen.getByRole('button', { name: /create|register|account/i});
 await user.click(submit);
 await user.click(submit); // second click while busy

 await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
 resolveRegister({ user: { id:'u1'}});
 await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true}));
});
});
