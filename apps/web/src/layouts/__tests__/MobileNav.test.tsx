/**
 * @vitest-environment jsdom
 *
 * Dedicated Test Suite for MobileNav (MobileBottomNav, MobileMenuDrawer, MobileSearchSheet)
 * Liquid Glass VisionOS / iOS 26 Design Standards
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  MobileBottomNav,
  MobileMenuDrawer,
  MobileSearchSheet,
} from '../components/MobileNav';

describe('MobileBottomNav', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders default staff tabs for ADMIN role', () => {
    const handleOpenMore = vi.fn();
    render(
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <MobileBottomNav role="ADMIN" onOpenMore={handleOpenMore} />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /payments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /leads/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open.*menu|more/i })).toBeInTheDocument();
  });

  it('renders teacher-specific mobile tabs for TEACHER role', () => {
    const handleOpenMore = vi.fn();
    render(
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <MobileBottomNav role="TEACHER" onOpenMore={handleOpenMore} />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('link', { name: /attendance/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /groups/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /grades/i })).toBeInTheDocument();
  });

  it('renders finance mobile tabs for ACCOUNTANT / FINANCE role', () => {
    const handleOpenMore = vi.fn();
    render(
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <MobileBottomNav role="ACCOUNTANT" onOpenMore={handleOpenMore} />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('link', { name: /payments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /invoices/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /expenses/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reports/i })).toBeInTheDocument();
  });

  it('triggers onOpenMore when tapping the More button', async () => {
    const handleOpenMore = vi.fn();
    render(
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <MobileBottomNav role="ADMIN" onOpenMore={handleOpenMore} />
        </MemoryRouter>
      </I18nProvider>,
    );

    const moreBtn = screen.getByRole('button', { name: /open.*menu|more/i });
    fireEvent.click(moreBtn);
    expect(handleOpenMore).toHaveBeenCalledTimes(1);
  });
});

describe('MobileMenuDrawer', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders drawer with user info and handles close / logout', async () => {
    const handleClose = vi.fn();
    const handleLogout = vi.fn();

    render(
      <I18nProvider initialLocale="en">
        <MemoryRouter>
          <MobileMenuDrawer
            open={true}
            onClose={handleClose}
            role="ADMIN"
            orgName="Star Academy"
            userName="John Doe"
            userInitials="JD"
            onLogout={handleLogout}
          />
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close menu/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const logoutBtn = screen.getByRole('button', { name: /log out/i });
    fireEvent.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalledTimes(1);
  });
});

describe('MobileSearchSheet', () => {
  beforeEach(() => {
    cleanup();
  });

  it('allows quick scope filtering and triggers submit', async () => {
    const handleClose = vi.fn();
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <I18nProvider initialLocale="en">
        <MobileSearchSheet
          open={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('searchbox')).toBeInTheDocument();

    // Quick scopes should be rendered
    const studentsScope = screen.getByRole('button', { name: /students/i });
    expect(studentsScope).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /teachers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /groups/i })).toBeInTheDocument();

    // Clicking students scope should insert prefix
    await user.click(studentsScope);
    const searchbox = screen.getByRole('searchbox') as HTMLInputElement;
    expect(searchbox.value).toContain('student:');

    // Type query and submit
    await user.type(searchbox, 'Alex');
    await user.keyboard('{Enter}');
    expect(handleSubmit).toHaveBeenCalledWith(expect.stringContaining('student: Alex'));
  });
});
