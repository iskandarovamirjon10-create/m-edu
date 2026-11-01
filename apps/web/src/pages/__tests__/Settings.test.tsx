/**
 * Enterprise Test Suite for Redesigned Settings Page
 *
 * Verifies:
 * 1. Apple VisionOS Header & Master-Detail Profile Card
 * 2. Category Panel Switching (Appearance, Sound, Account, Security, Devices, Telegram)
 * 3. All-in-One vs Category Panel View Modes
 * 4. Real-time Search Filter with Empty State
 * 5. Active Sessions List and Current Device Badge
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { SettingsPage } from '../Settings';

const { mockUser, mockOrg, mockSessions } = vi.hoisted(() => ({
  mockUser: {
    id: 'u-1',
    firstName: 'Sanjar',
    lastName: 'Karimov',
    email: 'sanjar@alxorazmiy.uz',
    role: 'ORG_ADMIN',
    settings: {
      language: 'uz',
      timezone: 'Asia/Tashkent',
    },
  },
  mockOrg: {
    id: 'org-1',
    name: 'Al-Xorazmiy Academy',
    email: 'info@alxorazmiy.uz',
    phone: '+998901234567',
  },
  mockSessions: [
    {
      id: 'sess-1',
      deviceName: 'MacBook Pro 16',
      browser: 'Chrome 122',
      os: 'macOS Sonoma',
      ipAddress: '84.54.72.10',
      isCurrentSession: true,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ],
}));

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    setUser: vi.fn(),
    hasAnyRole: (..._roles: string[]) => true,
  }),
  useOptionalAuthState: () => ({
    user: mockUser,
    isAuthenticated: true,
    status: 'authenticated',
  }),
  useAuthState: () => ({
    user: mockUser,
    isAuthenticated: true,
    status: 'authenticated',
  }),
}));

vi.mock('@/lib/api', () => ({
  organizationsApi: {
    me: vi.fn().mockResolvedValue(mockOrg),
    update: vi.fn().mockResolvedValue(mockOrg),
  },
  usersApi: {
    changePassword: vi.fn().mockResolvedValue({ success: true }),
    updateSettings: vi.fn().mockResolvedValue({ success: true }),
  },
  authApi: {
    me: vi.fn().mockResolvedValue(mockUser),
    getSessions: vi.fn().mockResolvedValue(mockSessions),
    revokeSession: vi.fn().mockResolvedValue({ success: true }),
    revokeOtherSessions: vi.fn().mockResolvedValue({ revokedCount: 1 }),
    getWhitelist: vi.fn().mockResolvedValue({ whitelist: [], pendingUsers: [] }),
    addToWhitelist: vi.fn().mockResolvedValue({ success: true }),
    removeFromWhitelist: vi.fn().mockResolvedValue({ success: true }),
    approveUser: vi.fn().mockResolvedValue({ success: true }),
    rejectUser: vi.fn().mockResolvedValue({ success: true }),
    updateAccessSettings: vi.fn().mockResolvedValue({ success: true }),
  },
  telegramApi: {
    status: vi.fn().mockResolvedValue({ connected: false, username: null }),
    createLink: vi.fn().mockResolvedValue({ deepLink: 'https://t.me/test_bot?start=123' }),
    unlink: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playPop: vi.fn(),
    playTick: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

function renderSettingsPage(locale = 'uz') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter>
      <I18nProvider initialLocale={locale as any}>
        <QueryClientProvider client={queryClient}>
          <SettingsPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('Redesigned SettingsPage Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header, user profile card, search input, and category navigation rail', async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Sanjar Karimov')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Sozlamalarni qidirish/i)).toBeInTheDocument();
    });

    // Check nav rail items exist
    expect(screen.getAllByText('Ovoz va Akustika')[0]).toBeInTheDocument();
    expect(screen.getAllByText(/Qurilmalar/i)[0]).toBeInTheDocument();
  });

  it('switches between categories in Panel Mode on category click', async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText('Sanjar Karimov')).toBeInTheDocument();
    });

    // Default category is Appearance (theme options visible)
    expect(screen.getByText(/tanlov shu qurilmada saqlanadi/i)).toBeInTheDocument();

    // Click Sound category
    const soundNavBtn = screen.getAllByRole('button', { name: /Ovoz va Akustika/i })[0];
    fireEvent.click(soundNavBtn);

    await waitFor(() => {
      // Sound studio should be visible
      expect(screen.getByText(/Apple VisionOS va Taptic standartidagi/i)).toBeInTheDocument();
    });

    // Click Devices category
    const devicesNavBtn = screen.getAllByRole('button', { name: /Qurilmalar/i })[0];
    fireEvent.click(devicesNavBtn);

    await waitFor(() => {
      // Active sessions should be visible
      expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
      expect(screen.getByText(/Joriy/i)).toBeInTheDocument();
    });
  });

  it('supports switching between Category View and All in One view modes', async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText('Sanjar Karimov')).toBeInTheDocument();
    });

    // Click 'Barchasini ko‘rish' (All in One view mode)
    const allModeBtn = screen.getByRole('button', { name: /Barchasini ko‘rish/i });
    fireEvent.click(allModeBtn);

    await waitFor(() => {
      // In all mode, multiple sections are rendered together
      expect(screen.getAllByText(/Ovoz va Akustika/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
    });
  });

  it('filters settings dynamically with instant search input', async () => {
    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Sozlamalarni qidirish/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Sozlamalarni qidirish/i);

    // Search for 'qurilma'
    fireEvent.change(searchInput, { target: { value: 'qurilma' } });

    await waitFor(() => {
      expect(screen.getByText('MacBook Pro 16')).toBeInTheDocument();
    });

    // Search for nonexistent term
    fireEvent.change(searchInput, { target: { value: 'xyzrandomnotfound' } });

    await waitFor(() => {
      expect(screen.getByText(/hech qanday sozlama topilmadi/i)).toBeInTheDocument();
    });
  });
});
