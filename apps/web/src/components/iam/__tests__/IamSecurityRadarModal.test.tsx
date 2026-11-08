import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IamSecurityRadarModal } from '../IamSecurityRadarModal';
import { iamApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  iamApi: {
    getSecurityOverview: vi.fn(),
    getActiveSessions: vi.fn(),
    getSecurityEvents: vi.fn(),
    terminateSession: vi.fn(),
    suspendOrganization: vi.fn(),
    activateOrganization: vi.fn(),
  },
}));

describe('IamSecurityRadarModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(iamApi.getSecurityOverview).mockResolvedValue({
      activeSessionsCount: 7,
      totalUsersCount: 150,
      suspendedUsersCount: 2,
      mustChangePasswordCount: 14,
      organizations: { total: 5, active: 4, suspended: 1 },
      recentEvents24h: 38,
    });

    vi.mocked(iamApi.getActiveSessions).mockResolvedValue([
      {
        id: 'sess-1',
        userId: 'u-1',
        username: 'alice_admin',
        fullName: 'Alice Smith',
        role: 'ORG_ADMIN',
        organizationId: 'org-1',
        organizationName: 'Toshkent Filiali',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        lastActiveAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    ]);

    vi.mocked(iamApi.getSecurityEvents).mockResolvedValue([
      {
        id: 'ev-1',
        eventType: 'LOGIN_SUCCESS',
        ipAddress: '192.168.1.100',
        userId: 'u-1',
        success: true,
        timestamp: new Date().toISOString(),
      },
    ]);
  });

  it('renders overview KPIs and active sessions list', async () => {
    render(<IamSecurityRadarModal open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument();
      expect(screen.getByText('14')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('@alice_admin')).toBeInTheDocument();
    expect(screen.getByText(/192.168.1.100/)).toBeInTheDocument();
  });

  it('terminates an active session when terminate button is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(iamApi.terminateSession).mockResolvedValue({ message: 'Session terminated', id: 'sess-1' });

    render(<IamSecurityRadarModal open={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    const terminateBtn = screen.getByRole('button', { name: /Sessiyani uzish/i });
    await user.click(terminateBtn);

    expect(iamApi.terminateSession).toHaveBeenCalledWith('sess-1');
  });

  it('switches to Kill-Switch tab and executes tenant suspension', async () => {
    const user = userEvent.setup();
    vi.mocked(iamApi.suspendOrganization).mockResolvedValue({ message: 'Suspended', id: 'org-test-uuid' });

    render(<IamSecurityRadarModal open={true} onClose={vi.fn()} />);

    const killSwitchTab = screen.getByRole('button', { name: /Tashkilot Kill-Switch/i });
    await user.click(killSwitchTab);

    expect(screen.getByText(/Favqulodda Tashkilotni To'xtatish/i)).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Masalan: 3f8b1a20/i);
    await user.type(input, 'org-test-uuid');

    const suspendBtn = screen.getByRole('button', { name: /To'xtatish \(Freeze\)/i });
    await user.click(suspendBtn);

    expect(iamApi.suspendOrganization).toHaveBeenCalledWith('org-test-uuid');
  });
});
