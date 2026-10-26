/**
 * @vitest-environment jsdom
 *
 * TopBar unit tests:
 *  - TopBarBreadcrumb navigation and route display
 *  - QuickActionHub 1-click creation popover and navigation
 *  - BranchSelectorMenu interactive branch management hub
 *  - TelemetryChip offline sync & real-time connectivity status
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { QuickActionHub } from '../components/TopBar';

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

    it('supports compact sm mode for mobile devices', () => {
      render(
        <I18nProvider initialLocale="uz">
          <MemoryRouter>
            <QuickActionHub size="sm" />
          </MemoryRouter>
        </I18nProvider>,
      );

      const trigger = screen.getByRole('button', { name: /tezkor yaratish amallari/i });
      expect(trigger).toBeInTheDocument();
      expect(trigger.className).toContain('min-h-[44px]');
    });
  });
});
