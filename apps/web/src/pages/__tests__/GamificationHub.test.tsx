import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GamificationHubPage } from '../GamificationHub';
import request from '@/lib/api';

vi.mock('@/lib/api', () => ({
  default: vi.fn(),
  __esModule: true,
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

const mockUser = {
  id: 'user-1',
  role: 'STUDENT',
  firstName: 'Zafar',
  lastName: 'Olimov',
  organizationId: 'org-1',
};

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    hasAnyRole: () => true,
    hasRole: () => true,
  }),
  useOptionalAuthState: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
  useAuthState: () => ({
    user: mockUser,
    isAuthenticated: true,
  }),
}));

const mockMe = {
  xp: 1850,
  coins: 240,
  level: 19,
  xpToNextLevel: 50,
  rank: 3,
  rankTotal: 45,
  streak: 7,
  league: 'PLATINUM',
  zone: 'PROMOTION',
  seasonDaysRemaining: 5,
};

const mockLeaderboard = {
  items: [
    {
      rank: 1,
      studentId: 's1',
      studentName: 'Zafar Olimov',
      avatar: null,
      groupId: 'g1',
      groupName: 'Frontend Pro',
      xp: 3400,
      coins: 520,
      level: 35,
      league: 'DIAMOND',
      zone: 'PROMOTION',
    },
    {
      rank: 2,
      studentId: 's2',
      studentName: 'Madina Karimova',
      avatar: null,
      groupId: 'g1',
      groupName: 'Frontend Pro',
      xp: 2200,
      coins: 310,
      level: 23,
      league: 'PLATINUM',
      zone: 'PROMOTION',
    },
    {
      rank: 3,
      studentId: 's3',
      studentName: 'Temur Sobirov',
      avatar: null,
      groupId: 'g2',
      groupName: 'Python Backend',
      xp: 1850,
      coins: 240,
      level: 19,
      league: 'PLATINUM',
      zone: 'PROMOTION',
    },
    {
      rank: 4,
      studentId: 's4',
      studentName: 'Nilufar Rahimova',
      avatar: null,
      groupId: 'g2',
      groupName: 'Python Backend',
      xp: 850,
      coins: 120,
      level: 9,
      league: 'GOLD',
      zone: 'SAFE',
    },
    {
      rank: 5,
      studentId: 's5',
      studentName: 'Akmal Yusupov',
      avatar: null,
      groupId: 'g3',
      groupName: 'Design UI',
      xp: 150,
      coins: 40,
      level: 2,
      league: 'BRONZE',
      zone: 'RELEGATION',
    },
  ],
};

const mockLeagues = {
  season: {
    id: 'season-2026-10',
    title: '2026-yil Oktyabr Mavsumi',
    daysRemaining: 5,
    totalDays: 31,
    promotionZonePct: 20,
    relegationZonePct: 15,
  },
  leagues: [
    { tier: 'DIAMOND', name: 'Olmos Ligasi', icon: '💎', minXp: 3000, color: '#8B5CF6', badgeBg: 'rgba(139,92,246,0.15)', perk: '+25% coinlar', studentsCount: 4 },
    { tier: 'PLATINUM', name: 'Platina Ligasi', icon: '💠', minXp: 1500, color: '#06B6D4', badgeBg: 'rgba(6,182,212,0.15)', perk: '+15% coinlar', studentsCount: 8 },
    { tier: 'GOLD', name: 'Oltin Ligasi', icon: '🥇', minXp: 700, color: '#F59E0B', badgeBg: 'rgba(245,158,11,0.15)', perk: '+10% coinlar', studentsCount: 15 },
    { tier: 'SILVER', name: 'Kumush Ligasi', icon: '🥈', minXp: 300, color: '#94A3B8', badgeBg: 'rgba(148,163,184,0.15)', perk: '+5% coinlar', studentsCount: 12 },
    { tier: 'BRONZE', name: 'Bronza Ligasi', icon: '🥉', minXp: 0, color: '#CD7F32', badgeBg: 'rgba(205,127,50,0.15)', perk: 'Standart XP', studentsCount: 6 },
  ],
  dailyQuests: [
    { id: 'quest-attendance', title: "Darsga o'z vaqtida kelish", description: 'Turniket orqali', xp: 10, coins: 5, icon: '📍' },
    { id: 'quest-homework', title: "Uy vazifasini a'lo bahoga topshirish", description: '80+ ball', xp: 20, coins: 10, icon: '📚' },
  ],
};

const mockRewards = {
  items: [
    {
      id: 'merch-tshirt',
      title: 'M-EDU Brend Futbolka',
      description: 'Paxtali premium sifatli futbolka',
      costCoins: 150,
      category: 'MERCH',
      icon: '👕',
    },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('GamificationHubPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(request).mockImplementation(async (url: string) => {
      if (url.includes('/gamification/me')) return mockMe;
      if (url.includes('/gamification/leaderboard')) return mockLeaderboard;
      if (url.includes('/gamification/leagues')) return mockLeagues;
      if (url.includes('/gamification/rewards')) return mockRewards;
      return {};
    });
  });

  it('renders stats header with XP, coins and streak', async () => {
    renderWithClient(<GamificationHubPage />);

    await waitFor(() => {
      expect(screen.getAllByText('19').length).toBeGreaterThan(0);
      expect(screen.getByText(/7 kun/i)).toBeInTheDocument();
      expect(screen.getAllByText(/XP/i).length).toBeGreaterThan(0);
    });
  });

  it('renders season banner and leaderboard', async () => {
    renderWithClient(<GamificationHubPage />);

    await waitFor(() => {
      expect(screen.getByText(/2026-yil Oktyabr Mavsumi/i)).toBeInTheDocument();
      expect(screen.getByText(/5 kun qoldi/i)).toBeInTheDocument();
      expect(screen.getByText('Zafar Olimov')).toBeInTheDocument();
      expect(screen.getByText('Madina Karimova')).toBeInTheDocument();
    });
  });

  it('filters leaderboard by league filter chip', async () => {
    renderWithClient(<GamificationHubPage />);

    await waitFor(() => {
      expect(screen.getByText('Nilufar Rahimova')).toBeInTheDocument();
    });

    // Click Diamond filter
    const diamondBtn = screen.getByRole('button', { name: /Olmos/i });
    fireEvent.click(diamondBtn);

    await waitFor(() => {
      expect(screen.getByText('Zafar Olimov')).toBeInTheDocument();
      // Nilufar (Gold) should not appear when filtered to Diamond
      expect(screen.queryByText('Nilufar Rahimova')).toBeNull();
    });
  });

  it('switches to Ligalar & Mavsum tab and shows the 5 League tiers', async () => {
    renderWithClient(<GamificationHubPage />);

    await waitFor(() => {
      expect(screen.getByText('Ligalar & Mavsum')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ligalar & Mavsum'));

    await waitFor(() => {
      expect(screen.getByText('Oylik Liga Tizimi')).toBeInTheDocument();
      expect(screen.getByText('Ligalarning 5 Bosqichi')).toBeInTheDocument();
      expect(screen.getByText('Platina Ligasi')).toBeInTheDocument();
      expect(screen.getByText('Sizning Ligangiz')).toBeInTheDocument();
      expect(screen.getByText("Kunlik O‘quv Missiyalari (Quests)")).toBeInTheDocument();
    });
  });

  it('switches to M-Coins Dokoni tab and displays rewards', async () => {
    renderWithClient(<GamificationHubPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /M-Coins Do'koni/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /M-Coins Do'koni/i }));

    await waitFor(() => {
      expect(screen.getByText('M-EDU Brend Futbolka')).toBeInTheDocument();
      expect(screen.getByText('Paxtali premium sifatli futbolka')).toBeInTheDocument();
    });
  });

  it('switches to Mahorat Shajarasi (Skill Tree) tab and renders constellation studio', async () => {
    renderWithClient(<GamificationHubPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Mahorat Shajarasi/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Mahorat Shajarasi/i }));

    await waitFor(() => {
      expect(screen.getByText(/RPG Mahorat Shajarasi · Spatial Skill Constellation/i)).toBeInTheDocument();
      expect(screen.getByText(/Full-Stack Dasturlash & Bulut Tizimlari/i)).toBeInTheDocument();
    });
  });
});
