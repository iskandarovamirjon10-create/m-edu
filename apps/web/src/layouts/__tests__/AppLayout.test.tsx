/**
 * AppLayout navigation tests:
 *  - ADMIN sees the full nav (primary + administration sections)
 *  - STUDENT never sees administration/management routes
 *    (security-relevant UX: hidden links must not be rendered at all)
 *  - logout signs out and redirects to /login
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    logoutMock.mockReset();
    currentUser.role = 'SUPER_ADMIN';
  });

  it('renders primary + administration nav for an admin', () => {
    renderLayout();
    // Primary nav
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Students' })).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Groups' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Face Recognition' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Payments' })).toBeInTheDocument();

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
    await user.click(screen.getByRole('button', { name: /log out|sign out|logout/i }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('login page')).toBeInTheDocument();
  });
});
