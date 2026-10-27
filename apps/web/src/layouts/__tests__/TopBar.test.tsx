/**
 * @vitest-environment jsdom
 *
 * TopBar unit tests:
 *  - QuickActionHub 1-click creation popover and navigation
 *  - ThemeToggle spatial theme switcher & quick toggle
 *  - LiveClock time display and status ping
 *  - UserMenu profile, shortcuts, 360 spatial card, and logout actions
 *  - MobileTopBar dynamic route pill and action triggers
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../../i18n/I18nProvider';
import {
  QuickActionHub,
  ThemeToggle,
  LiveClock,
  UserMenu,
  MobileTopBar,
} from '../components/TopBar';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nProvider initialLocale="uz">
          <MemoryRouter>{children}</MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>
    );
  };
}

describe('TopBar component tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('QuickActionHub', () => {
    it('renders the trigger button with accessibility label', () => {
      const Wrapper = createWrapper();
      render(<QuickActionHub />, { wrapper: Wrapper });

      const trigger = screen.getByRole('button', { name: /tezkor yaratish amallari/i });
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens popover menu when clicked and displays core actions', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<QuickActionHub />, { wrapper: Wrapper });

      const trigger = screen.getByRole('button', { name: /tezkor yaratish amallari/i });
      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/tezkor yaratish markazi/i)).toBeInTheDocument();
      expect(screen.getByText("Yangi O'quvchi")).toBeInTheDocument();
      expect(screen.getByText("To'lov Qabul Qilish")).toBeInTheDocument();
      expect(screen.getByText("Yangi Guruh")).toBeInTheDocument();
      expect(screen.getByText("Dars Belgilash")).toBeInTheDocument();
      expect(screen.getByText("Sertifikat Berish")).toBeInTheDocument();
      expect(screen.getByText("AI Copilot Maslahatchi")).toBeInTheDocument();
    });

    it('closes popover menu when clicking escape', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<QuickActionHub />, { wrapper: Wrapper });

      const trigger = screen.getByRole('button', { name: /tezkor yaratish amallari/i });
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('ThemeToggle', () => {
    it('renders theme toggle button with accessible label', () => {
      const Wrapper = createWrapper();
      render(<ThemeToggle />, { wrapper: Wrapper });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label');
    });

    it('reveals spatial theme palette menu on right-click / context menu', () => {
      const Wrapper = createWrapper();
      render(<ThemeToggle />, { wrapper: Wrapper });

      const button = screen.getByRole('button');
      fireEvent.contextMenu(button);

      expect(screen.getByRole('menu', { name: /theme selector/i })).toBeInTheDocument();
      expect(screen.getByText(/Mavzular Palitrasi/i)).toBeInTheDocument();
      expect(screen.getByText("Yorug'")).toBeInTheDocument();
      expect(screen.getByText('Tungi')).toBeInTheDocument();
      expect(screen.getByText('OLED Qora')).toBeInTheDocument();
      expect(screen.getByText('Sepiya')).toBeInTheDocument();
      expect(screen.getByText('Tizim Rejimi')).toBeInTheDocument();
    });
  });

  describe('LiveClock', () => {
    it('renders the current time formatted as HH:MM', () => {
      const Wrapper = createWrapper();
      render(<LiveClock />, { wrapper: Wrapper });

      // Matches HH:MM format
      expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('UserMenu', () => {
    it('renders user details on trigger and opens menu on click', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      const handleShortcuts = vi.fn();
      const handleLogout = vi.fn();

      render(
        <UserMenu
          fullName="Jasur Aliyev"
          initialsStr="JA"
          role="ADMIN"
          user={{ id: 'u-1', firstName: 'Jasur', lastName: 'Aliyev', role: 'ADMIN' }}
          onOpenShortcuts={handleShortcuts}
          onLogout={handleLogout}
        />,
        { wrapper: Wrapper },
      );

      // Trigger displays user name and initials
      expect(screen.getByText('Jasur Aliyev')).toBeInTheDocument();
      expect(screen.getByText('JA')).toBeInTheDocument();

      const trigger = screen.getByRole('button', { name: /jasur aliyev/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      // Click to open
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // Menu contains key navigation items
      expect(screen.getByRole('menuitem', { name: /360° shaxsiy karta/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /klaviatura|shortcuts/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /chiqish|log out/i })).toBeInTheDocument();
    });

    it('triggers shortcuts and logout callbacks', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      const handleShortcuts = vi.fn();
      const handleLogout = vi.fn();

      render(
        <UserMenu
          fullName="Jasur Aliyev"
          initialsStr="JA"
          role="ADMIN"
          user={{ id: 'u-1', firstName: 'Jasur', lastName: 'Aliyev', role: 'ADMIN' }}
          onOpenShortcuts={handleShortcuts}
          onLogout={handleLogout}
        />,
        { wrapper: Wrapper },
      );

      const trigger = screen.getByRole('button', { name: /jasur aliyev/i });
      await user.click(trigger);

      const shortcutsBtn = screen.getByRole('menuitem', { name: /klaviatura|shortcuts/i });
      await user.click(shortcutsBtn);
      expect(handleShortcuts).toHaveBeenCalledTimes(1);

      // Re-open and click logout
      await user.click(trigger);
      const logoutBtn = screen.getByRole('menuitem', { name: /chiqish|log out/i });
      await user.click(logoutBtn);
      expect(handleLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('MobileTopBar', () => {
    it('renders mobile bar and triggers search and drawer handlers', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      const handleSearch = vi.fn();
      const handleMenu = vi.fn();

      render(
        <MobileTopBar onOpenSearch={handleSearch} onOpenMenu={handleMenu} />,
        { wrapper: Wrapper },
      );

      // Search button trigger
      const searchBtns = screen.getAllByRole('button', { name: /qidirish|search/i });
      expect(searchBtns.length).toBeGreaterThan(0);
      await user.click(searchBtns[0]);
      expect(handleSearch).toHaveBeenCalled();

      // Menu button trigger
      const menuBtn = screen.getByRole('button', { name: /navigatsiya menyusini|open navigation menu/i });
      expect(menuBtn).toBeInTheDocument();
      await user.click(menuBtn);
      expect(handleMenu).toHaveBeenCalled();
    });
  });
});
