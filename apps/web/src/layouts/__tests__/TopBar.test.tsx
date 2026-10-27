/**
 * @vitest-environment jsdom
 *
 * TopBar unit tests:
 *  - TopBarBreadcrumb navigation and route display
 *  - QuickActionHub 1-click creation popover and navigation
 *  - ThemeToggle spatial theme switcher & quick toggle
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { QuickActionHub, ThemeToggle } from '../components/TopBar';

describe('TopBar component tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('QuickActionHub', () => {
    it('renders the trigger button with accessibility label', () => {
      render(
        <I18nProvider initialLocale="uz">
          <MemoryRouter>
            <QuickActionHub />
          </MemoryRouter>
        </I18nProvider>,
      );

      const trigger = screen.getByRole('button', { name: /tezkor yaratish amallari/i });
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens popover menu when clicked and displays core actions', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider initialLocale="uz">
          <MemoryRouter>
            <QuickActionHub />
          </MemoryRouter>
        </I18nProvider>,
      );

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
      render(
        <I18nProvider initialLocale="uz">
          <MemoryRouter>
            <QuickActionHub />
          </MemoryRouter>
        </I18nProvider>,
      );

      const trigger = screen.getByRole('button', { name: /tezkor yaratish amallari/i });
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.keyboard('{Escape}');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('ThemeToggle', () => {
    it('renders theme toggle button with accessible label', () => {
      render(
        <I18nProvider initialLocale="uz">
          <ThemeToggle />
        </I18nProvider>,
      );

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label');
    });

    it('reveals spatial theme palette menu on right-click / context menu', () => {
      render(
        <I18nProvider initialLocale="uz">
          <ThemeToggle />
        </I18nProvider>,
      );

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
});
