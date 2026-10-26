import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../Dashboard';
import { I18nProvider } from '@/i18n/I18nProvider';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

let mockUser: any = {
  id: 'u1',
  role: 'ADMIN',
  firstName: 'Admin',
  organization: { name: 'M-EDU Academy' },
};

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockStatsData = {
  totalStudents: 150,
  activeStudents: 140,
  totalTeachers: 12,
  activeGroups: 8,
  attendanceRate: 94,
  totalPaid: '15000000',
  totalPending: '2000000',
  totalOverdue: '500000',
  monthlyRevenue: [{ month: 'Jan', total: 1000000 }],
  recentPayments: [],
  upcomingFollowUps: [],
  attendanceStats: [],
  leadByStage: [],
  totalLeads: 25,
  wonLeads: 10,
  newLeadsThisMonth: 5,
  conversionRate: 40,
};

const mockStatsApi = vi.fn().mockResolvedValue(mockStatsData);

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    stats: () => mockStatsApi(),
    revenue: () => Promise.resolve([]),
  },
  aiApi: {
    getExecutiveBriefing: () => Promise.resolve(null),
  },
}));

function renderDashboard() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <I18nProvider initialLocale="en">
          <DashboardPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'u1',
      role: 'ADMIN',
      firstName: 'Admin',
      organization: { name: 'M-EDU Academy' },
    };
  });

  it('renders dashboard content and header for admin users', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Dashboard/i })).toBeInTheDocument();
    });
    expect(mockStatsApi).toHaveBeenCalled();
  });

  it('redirects PARENT role to parent portal without querying admin stats', async () => {
    mockUser = { id: 'u2', role: 'PARENT' };
    renderDashboard();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/parent-portal', { replace: true });
    });
    // Query must be gated and not called
    expect(mockStatsApi).not.toHaveBeenCalled();
  });

  it('redirects TEACHER role to attendance and STUDENT to schedule', async () => {
    mockUser = { id: 'u3', role: 'TEACHER' };
    renderDashboard();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/attendance', { replace: true });
    });

    mockUser = { id: 'u4', role: 'STUDENT' };
    renderDashboard();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/schedule', { replace: true });
    });
  });

  it('renders the daily pulse ribbon and quick action rail', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Dashboard/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: /Today's pulse/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Quick actions/i })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /New student/i })).toHaveAttribute(
      'href',
      '/students/new',
    );
    expect(screen.getByRole('link', { name: /Take attendance/i })).toHaveAttribute(
      'href',
      '/attendance',
    );
  });

  it('allows manual refresh via keyboard shortcut R', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Dashboard/i })).toBeInTheDocument();
    });

    const initialCallCount = mockStatsApi.mock.calls.length;

    fireEvent.keyDown(window, { key: 'r' });

    await waitFor(() => {
      expect(mockStatsApi.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  it('navigates to /students/new on keyboard shortcut N', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /Dashboard/i })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'n' });

    expect(mockNavigate).toHaveBeenCalledWith('/students/new');
  });
});
