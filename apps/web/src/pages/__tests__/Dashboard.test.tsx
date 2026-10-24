import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
});
