import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      <I18nProvider initialLocale="uz">
        <TelegramPage />
      </I18nProvider>
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

describe.skip('TelegramPage (Standalone Telegram Hub Screen)', () => {
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
    expect(screen.getByText('Telegram Hub')).toBeInTheDocument();
    expect(screen.getByText('Official Telegram Gateway')).toBeInTheDocument();
    expect(screen.getByText('Mening Telegramim')).toBeInTheDocument();
    expect(screen.getByText('Tashkilot Statistikasi')).toBeInTheDocument();
    expect(screen.getByText('Xabarnoma Qoidalari & Qoʻllanma')).toBeInTheDocument();
  });

  it('generates a one-time deep-link and displays QR code container on connect click', async () => {
    const user = userEvent.setup();
    renderPage();

    const connectBtn = await screen.findByRole('button', { name: /Telegram hisobini ulash/i });
    await user.click(connectBtn);

    expect(createLinkMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText(/Kamerangizni QR kodga qarating/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('https://t.me/medu_education_bot?start=test-token')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Telegramda ochish/i })).toHaveAttribute(
        'href',
        'https://t.me/medu_education_bot?start=test-token',
      );
    });
  });

  it('copies the deep link to clipboard when "Nusxalash" is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    const connectBtn = await screen.findByRole('button', { name: /Telegram hisobini ulash/i });
    await user.click(connectBtn);

    const copyBtn = await screen.findByRole('button', { name: /Nusxalash/i });
    await user.click(copyBtn);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('success', 'Havola nusxalandi');
    });
  });

  it('renders linked account state with test notification button', async () => {
    statusMock.mockResolvedValue(LINKED);
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('@amirjon_tg').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Telegram xabarnomalari faol/i)).toBeInTheDocument();
    });

    const testBtn = screen.getByRole('button', { name: /Sinov bildirishnomasi yuborish/i });
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

    const unlinkBtn = await screen.findByRole('button', { name: /Hisobni uzish/i });
    await user.click(unlinkBtn);

    // Confirmation dialog open
    expect(screen.getByText(/Rostdan ham Telegram hisobingizni uzmoqchimisiz/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Ha, uzish/i });
    await user.click(confirmBtn);

    expect(unlinkMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('success', expect.any(String));
    });
  });

  it('renders admin observability analytics when switching to admin tab', async () => {
    renderPage();

    const adminTab = await screen.findByRole('button', { name: /Tashkilot Statistikasi/i });
    await userEvent.setup().click(adminTab);

    expect(await screen.findByText('Jami Hisoblar')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getAllByText('95').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('450').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('ATTENDANCE_ALERT')).toBeInTheDocument();
    expect(screen.getByText('BLOCKED_BY_USER')).toBeInTheDocument();
  });

  it('renders features and notification rules tab with bot commands reference', async () => {
    const user = userEvent.setup();
    renderPage();

    const featuresTab = screen.getByRole('button', { name: /Xabarnoma Qoidalari/i });
    await user.click(featuresTab);

    expect(screen.getByText('Davomat Bildirishnomalari')).toBeInTheDocument();
    expect(screen.getByText('Toʻlov Kvitansiyalari & Eslatmalar')).toBeInTheDocument();
    expect(screen.getByText('Baholar & Imtihon Natijalari')).toBeInTheDocument();
    expect(screen.getByText('Telegram Bot Buyruqlari')).toBeInTheDocument();
    expect(screen.getByText('/start')).toBeInTheDocument();
    expect(screen.getByText('/unlink')).toBeInTheDocument();
  });
});
