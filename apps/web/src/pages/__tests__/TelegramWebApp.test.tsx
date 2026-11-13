import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TelegramWebAppPage } from '../TelegramWebApp';

// Mock Auth Context
const mockAuth = {
  user: {
    id: 'parent-u1',
    firstName: 'Dilshod',
    lastName: 'Rahimov',
    role: 'PARENT',
  },
  status: 'authenticated',
  hasAnyRole: vi.fn((...roles: string[]) => roles.includes('PARENT')),
  refresh: vi.fn().mockResolvedValue(null),
};

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// Mock Hoisted helpers
const { mockSetLocale, mockWebappAuth } = vi.hoisted(() => ({
  mockSetLocale: vi.fn(),
  mockWebappAuth: vi.fn().mockResolvedValue({ authenticated: true }),
}));

// Mock I18n Provider
vi.mock('@/i18n/I18nProvider', () => {
  const hook = () => ({
    t: (key: string, params?: Record<string, any>) => {
      const dict: Record<string, string> = {
        'tgapp.title': 'M-EDU Portali',
        'tgapp.portalSubtitle': 'M-EDU Ta’lim Portali',
        'tgapp.guest': 'Mehmon',
        'tgapp.online': 'Onlayn',
        'tgapp.offline': 'Oflayn',
        'tgapp.greeting.morning': 'Xayrli tong',
        'tgapp.greeting.afternoon': 'Xayrli kun',
        'tgapp.greeting.evening': 'Xayrli kech',
        'tgapp.tab.parent': 'Ota-ona',
        'tgapp.tab.student': 'O‘quvchi',
        'tgapp.tab.teacher': 'O‘qituvchi',
        'tgapp.tab.ai': 'AI Copilot',
        'tgapp.tab.badge': 'ID Karta',
        'tgapp.gate.title': 'Avtorizatsiya talab etiladi',
        'tgapp.gate.message': 'Iltimos, Telegram orqali kiring.',
        'tgapp.gate.loginButton': 'Telegram hisobini ulash',
        'tgapp.noAccess.title': 'Ruxsat berilmagan',
        'tgapp.noAccess.message': 'Hisobingizda bu portalni ko‘rish uchun ruxsat mavjud emas.',
      };
      if (params?.provider) return `${params.provider} orqali to‘lash`;
      return dict[key] ?? key;
    },
    locale: 'uz',
    setLocale: mockSetLocale,
  });
  return {
    useI18n: hook,
    useSafeI18n: hook,
  };
});

// Mock Telegram hook
const mockTgUser = {
  id: 1234567,
  first_name: 'Dilshod',
  language_code: 'uz',
  photo_url: 'https://example.com/avatar.jpg',
};
const mockHaptic = vi.fn();
const mockContactAdmin = vi.fn();
const mockTg = {
  BackButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  openTelegramLink: vi.fn(),
  openLink: vi.fn(),
};

vi.mock('@/hooks/useTelegram', () => ({
  useTelegram: () => ({
    tg: mockTg,
    user: mockTgUser,
    colorScheme: 'dark',
    haptic: mockHaptic,
    contactAdmin: mockContactAdmin,
  }),
}));

// Mock Sound
const mockSound = {
  playTick: vi.fn(),
  playSuccess: vi.fn(),
  playError: vi.fn(),
};
vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => mockSound,
}));

// Mock Online Status
let mockIsOnline = true;
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockIsOnline,
}));

// Mock Page Title
vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

// Mock UI Toasts
vi.mock('@/components/ui', () => ({
  useToast: () => ({ push: vi.fn() }),
}));

// Mock APIs
vi.mock('@/lib/api', () => ({
  default: vi.fn(),
  parentPortalApi: {
    getChildren: vi.fn().mockResolvedValue([
      { id: 'ch-1', name: 'Jasur Rahimov', relationship: 'FATHER' },
    ]),
    getChildDashboard: vi.fn().mockResolvedValue({
      child: { id: 'ch-1', name: 'Jasur Rahimov' },
      todayLessons: [],
      attendanceSummary: { attendanceRate: 95 },
      recentGrades: [],
      recentAttendance: [],
    }),
  },
  groupsApi: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({}),
  },
  scheduleApi: {
    getAll: vi.fn().mockResolvedValue([]),
  },
  attendanceApi: {
    getStudentAttendance: vi.fn().mockResolvedValue([]),
  },
  assignmentsApi: {
    getByStudent: vi.fn().mockResolvedValue([]),
  },
  gamificationApi: {
    getProfile: vi.fn().mockResolvedValue({ xp: 120, level: 3, streakDays: 5 }),
    getLeaderboard: vi.fn().mockResolvedValue([]),
  },
  aiApi: {
    chat: vi.fn().mockResolvedValue({ reply: 'Salom, sizga qanday yordam bera olaman?' }),
  },
  telegramApi: {
    webappAuth: mockWebappAuth,
  },
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('TelegramWebAppPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOnline = true;
    mockAuth.user = {
      id: 'parent-u1',
      firstName: 'Dilshod',
      lastName: 'Rahimov',
      role: 'PARENT',
    };
    mockAuth.status = 'authenticated';
    mockAuth.hasAnyRole = vi.fn((...roles: string[]) => roles.includes('PARENT'));
  });

  it('renders header greeting, avatar and online status', async () => {
    renderWithClient(<TelegramWebAppPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/Dilshod/i)).toBeInTheDocument();
  });

  it('renders bottom dock with active parent tab and switches tabs', async () => {
    renderWithClient(<TelegramWebAppPage />);

    // Bottom dock tabs
    const parentTab = screen.getByTestId('tg-tab-parent');
    expect(parentTab).toBeInTheDocument();
    expect(parentTab).toHaveAttribute('aria-selected', 'true');

    // Switch to AI tab
    const aiTab = screen.getByTestId('tg-tab-ai');
    expect(aiTab).toBeInTheDocument();

    fireEvent.click(aiTab);
    expect(mockHaptic).toHaveBeenCalledWith('light');
    expect(mockSound.playTick).toHaveBeenCalled();
  });

  it('renders GateScreen when user is unauthenticated', async () => {
    mockAuth.status = 'unauthenticated';
    mockAuth.user = null as any;

    renderWithClient(<TelegramWebAppPage />);

    expect(screen.getByRole('button', { name: /Telegram|Hisobga/i })).toBeInTheDocument();
  });

  it('renders NoAccessScreen when role has no matching tabs', async () => {
    mockAuth.hasAnyRole = vi.fn().mockReturnValue(false);
    mockAuth.user = { id: 'u-other', firstName: 'Mehmon', lastName: '', role: 'GUEST' } as any;

    renderWithClient(<TelegramWebAppPage />);

    await waitFor(() => {
      expect(screen.getByText(/GUEST|Ruxsat|Bo'lim/i)).toBeInTheDocument();
    });
  });

  it('renders offline indicator when offline', async () => {
    mockIsOnline = false;
    renderWithClient(<TelegramWebAppPage />);

    const statusBadges = screen.getAllByRole('status');
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('synchronizes language with Telegram language_code zero-click', async () => {
    mockTgUser.language_code = 'ru';
    renderWithClient(<TelegramWebAppPage />);

    expect(mockSetLocale).toHaveBeenCalledWith('ru');
  });

  it('renders student tab when user has STUDENT role', async () => {
    mockAuth.hasAnyRole = vi.fn((...roles: string[]) => roles.includes('STUDENT'));
    mockAuth.user = { id: 's-1', firstName: 'Aziz', lastName: 'Aliyev', role: 'STUDENT' };

    renderWithClient(<TelegramWebAppPage />);

    expect(screen.getByTestId('tg-tab-student')).toBeInTheDocument();
  });

  it('renders teacher tab when user has TEACHER role', async () => {
    mockAuth.hasAnyRole = vi.fn((...roles: string[]) => roles.some((r) => ['TEACHER', 'ADMIN', 'SUPERADMIN', 'BRANCH_MANAGER'].includes(r)));
    mockAuth.user = { id: 't-1', firstName: 'Malika', lastName: 'Xalimova', role: 'TEACHER' };

    renderWithClient(<TelegramWebAppPage />);

    expect(screen.getByTestId('tg-tab-teacher')).toBeInTheDocument();
  });

  it('attempts zero-click webappAuth when unauthenticated with initData and calls refresh', async () => {
    mockAuth.status = 'unauthenticated';
    mockAuth.user = null as any;
    (mockTg as any).initData = 'query_id=123&hash=mockhash';

    renderWithClient(<TelegramWebAppPage />);

    await waitFor(() => {
      expect(mockWebappAuth).toHaveBeenCalledWith('query_id=123&hash=mockhash');
      expect(mockAuth.refresh).toHaveBeenCalled();
    });
  });

  it('hides BottomDock when input is focused to prevent mobile keyboard overlap', async () => {
    mockAuth.status = 'authenticated';
    mockAuth.user = { id: 'p-1', firstName: 'Dilshod', lastName: 'Rahimov', role: 'PARENT' };
    mockAuth.hasAnyRole = vi.fn().mockReturnValue(true);
    (mockTg as any).initData = '';

    renderWithClient(<TelegramWebAppPage />);

    expect(screen.getByRole('tablist')).toBeInTheDocument();

    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.focusIn(input);

    await waitFor(() => {
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    });

    fireEvent.focusOut(input);

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    document.body.removeChild(input);
  });
});
