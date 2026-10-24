/**
 * @vitest-environment jsdom
 *
 * AppLayout navigation tests:
 *  - ADMIN sees the full nav (primary + administration sections)
 *  - STUDENT never sees administration/management routes
 *    (security-relevant UX: hidden links must not be rendered at all)
 *  - logout signs out and redirects to /login
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '../AppLayout';
import { ThemeProvider } from '../../hooks/useTheme';
import { I18nProvider } from '../../i18n/I18nProvider';

const { logoutMock, currentUser } = vi.hoisted(() => ({
  logoutMock: vi.fn(),
  currentUser: {
    id: 'u1',
    email: 'user@medu.test',
    firstName: 'Alex',
    lastName: 'Admin',
    role: 'SUPER_ADMIN' as string,
    organization: { id: 'org1', name: 'Test Center' },
  },
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, logout: logoutMock, loading: false }),
  useAuthState: () => ({ user: currentUser, loading: false }),
  useOptionalAuthState: () => ({ user: currentUser, loading: false }),
}));

// NotificationsMenu in the header uses react-query; provide a client with
// retries disabled so network failures surface as errors immediately.
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderLayout() {
  return render(
    <I18nProvider initialLocale="en">
      <ThemeProvider>
        <QueryClientProvider client={makeQueryClient()}>
          <MemoryRouter initialEntries={['/dashboard']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              <Route path="/dashboard" element={<AppLayout />} />
              <Route path="/login" element={<div>login page</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
}

describe('AppLayout navigation by role', () => {
  beforeEach(() => {
    cleanup();
    logoutMock.mockReset();
    currentUser.role = 'SUPER_ADMIN';
    // These assertions target the *desktop* sidebar (full labels + the
    // Administration section header). jsdom defaults to a 1024px viewport,
    // which renders the compact tablet rail instead, so pin the desktop
    // viewport explicitly — the expectations below are desktop-only.
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1440,
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      const minMatch = query.match(/min-width:\s*(\d+)px/);
      const min = minMatch ? parseInt(minMatch[1], 10) : 0;
      return {
        matches: window.innerWidth >= min,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    });
    window.dispatchEvent(new Event('resize'));
    window.localStorage.clear();
  });

  it('renders primary + administration nav for an admin', () => {
    renderLayout();
    // Primary nav
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Students' })[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teachers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Face Recognition' })).toBeInTheDocument();
    // Administration nav
    expect(screen.getByRole('link', { name: 'Audit Log' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  it('hides all administration/management routes for a STUDENT', () => {
    currentUser.role = 'STUDENT';
    renderLayout();

    // Student-visible
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Students' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Groups' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Attendance' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Face Recognition' })[0]).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Payments' })[0]).toBeInTheDocument();

    // Hidden for students (must not exist in the DOM at all)
    for (const label of [
      'Teachers',
      'Users',
      'Expenses',
      'Cameras',
      'Audit Log',
      'Settings',
      'Homework',
      'Leads',
    ]) {
      expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();
  });

  it('logs out and redirects to /login', async () => {
    const user = userEvent.setup();
    renderLayout();
    const logoutBtn = screen.getAllByRole('button', { name: /log out|sign out|logout/i })[0];
    await user.click(logoutBtn);
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });

  it('renders main content as a fully accessible and configured scroll container', () => {
    renderLayout();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'main-content');
    expect(main).toHaveAttribute('data-scroll-container');
    expect(main).toHaveAttribute('data-scroll-focus');
    expect(main.className).toContain('overflow-y-auto');
    expect(main.className).toContain('overscroll-y-contain');
    expect(main.className).toContain('touch-pan-y');
  });

  it('delegates window wheel events to main scroll container', () => {
    renderLayout();
    const main = screen.getByRole('main');
    const scrollBySpy = vi.fn();
    main.scrollBy = scrollBySpy;

    // Simulate wheel on TopBar / document body outside main
    const wheelEvent = new WheelEvent('wheel', { deltaY: 120, bubbles: true });
    window.dispatchEvent(wheelEvent);

    expect(scrollBySpy).toHaveBeenCalledWith({ top: 120, behavior: 'auto' });
  });
});
