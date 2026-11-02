import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TelegramPage } from '../Telegram';
import { I18nProvider } from '@/i18n/I18nProvider';

const {
  statusMock,
  createLinkMock,
  unlinkMock,
  testMock,
  adminOverviewMock,
  pushMock,
} = vi.hoisted(() => ({
  statusMock: vi.fn(),
  createLinkMock: vi.fn(),
  unlinkMock: vi.fn(),
  testMock: vi.fn(),
  adminOverviewMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  telegramApi: {
    status: statusMock,
    createLink: createLinkMock,
    unlink: unlinkMock,
    testNotification: testMock,
    adminOverview: adminOverviewMock,
  },
}));

const mockUser: any = {
  id: 'user-1',
  email: 'admin@medu.uz',
  firstName: 'Amirjon',
  lastName: 'Qodirov',
  role: 'ORG_ADMIN',
  isActive: true,
  organizationId: 'org-1',
};

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    isAuthenticated: true,
    isBooting: false,
    roles: [mockUser?.role],
    hasRole: (r: string) => mockUser?.role === r,
    hasAnyRole: (...roles: string[]) => roles.includes(mockUser?.role),
  }),
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    useToasts: () => ({ push: pushMock, toastNode: null }),
  };
});

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <I18nProvider initialLocale="en">
          <TelegramPage />
        </I18nProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const NOT_LINKED = {
  linked: false,
  status: null,
  username: null,
  firstName: null,
  lastName: null,
  languageCode: null,
  linkedAt: null,
  lastSeenAt: null,
  pendingLinkExpiresAt: null,
};

const LINKED = {
  linked: true,
  status: 'ACTIVE' as const,
  username: 'amirjon_tg',
  firstName: 'Amirjon',
  lastName: 'Qodirov',
  languageCode: 'uz',
  linkedAt: '2026-09-01T10:00:00Z',
  lastSeenAt: '2026-09-29T08:00:00Z',
  pendingLinkExpiresAt: null,
};

const ADMIN_OVERVIEW = {
  configured: true,
  botUsername: '@medu_education_bot',
  organizationId: 'org-1',
  accounts: {
    total: 120,
    active: 95,
    disconnected: 15,
    blocked: 8,
    suspended: 2,
    lastSeenAt: '2026-09-29T08:00:00Z',
  },
  deliveries: {
    last24h: {
      sent: 450,
      failed: 2,
      deferred: 5,
      skipped: 1,
    },
    recentFailures: [
      {
        eventType: 'ATTENDANCE_ALERT',
        channel: 'TELEGRAM',
        failureCategory: 'BLOCKED_BY_USER',
        attempts: 3,
        failedAt: '2026-09-29T07:30:00Z',
      },
    ],
  },
  webhook: {
    updatesLast24h: 1200,
    lastUpdateAt: '2026-09-29T08:15:00Z',
  },
};

describe('TelegramPage (Standalone Telegram Hub Screen)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    statusMock.mockResolvedValue(NOT_LINKED);
    adminOverviewMock.mockResolvedValue(ADMIN_OVERVIEW);
    createLinkMock.mockResolvedValue({
      token: 'test-token',
      deepLink: 'https://t.me/medu_education_bot?start=test-token',
      expiresAt: '2026-09-29T09:00:00Z',
    });
    unlinkMock.mockResolvedValue({ disconnected: true });
    testMock.mockResolvedValue({ sent: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders the Telegram Hub title, official bot badge, and navigation tabs', async () => {
    renderPage();
    expect(await screen.findByText('Telegram Integration')).toBeInTheDocument();
    expect(screen.getByText('Integration')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /My Connection/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Bot Features/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Admin Overview/i })).toBeInTheDocument();
  });

  it('generates a one-time deep-link and displays container on connect click', async () => {
    const user = userEvent.setup();
    renderPage();

    const connectBtn = await screen.findByRole('button', { name: /Generate Link/i });
    await user.click(connectBtn);

    expect(createLinkMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://t.me/medu_education_bot?start=test-token')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Open in Telegram/i })).toHaveAttribute(
        'href',
        'https://t.me/medu_education_bot?start=test-token',
      );
    });
  });

  it('copies the deep link to clipboard when copy button is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const connectBtn = await screen.findByRole('button', { name: /Generate Link/i });
    await user.click(connectBtn);

    const copyBtn = await screen.findByRole('button', { name: /Copy link/i });
    await user.click(copyBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('success', expect.any(String));
    });
  });

  it('renders linked account state with test notification button', async () => {
    statusMock.mockResolvedValue(LINKED);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('@amirjon_tg').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Connected to Telegram/i)).toBeInTheDocument();
    });

    const testBtn = screen.getByRole('button', { name: /Test Notification/i });
    await user.click(testBtn);

    expect(testMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('success', expect.any(String));
    });
  });

  it('opens confirmation modal and unlinks account when confirmed', async () => {
    statusMock.mockResolvedValue(LINKED);
    const user = userEvent.setup();
    renderPage();

    const unlinkBtn = await screen.findByRole('button', { name: /Disconnect/i });
    await user.click(unlinkBtn);

    const confirmBtn = await screen.findByRole('button', { name: /Delete/i });
    await user.click(confirmBtn);

    expect(unlinkMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('success', expect.any(String));
    });
  });

  it('renders admin observability analytics when switching to admin tab', async () => {
    const user = userEvent.setup();
    renderPage();

    const adminTab = await screen.findByRole('tab', { name: /Admin Overview/i });
    await user.click(adminTab);

    expect(await screen.findByText('120')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('95').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('450').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders features tab with feature descriptions', async () => {
    const user = userEvent.setup();
    renderPage();

    const featuresTab = await screen.findByRole('tab', { name: /Bot Features/i });
    await user.click(featuresTab);

    expect(await screen.findByText(/Instant Alerts/i)).toBeInTheDocument();
  });
});
