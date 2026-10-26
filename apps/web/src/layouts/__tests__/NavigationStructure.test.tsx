/**
 * M-EDU 4-Pillar Navigation Structure & RBAC Unit Tests
 * Verifies Phase 2 Safe Navigation Refactor:
 *  - 4 Core Pillars: Management, Academics, Finance, Communication
 *  - Secondary sections: Administration & More Modules
 *  - Role-based filtering for STAFF vs STUDENT
 *  - Mobile bottom tabs alignment
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../../i18n/I18nProvider';
import { ThemeProvider } from '../../hooks/useTheme';
import { DeviceProfileProvider } from '../core/singletons';
import {
  MANAGEMENT_NAV,
  ACADEMIC_NAV,
  FINANCE_NAV,
  COMMUNICATION_NAV,
  ADMINISTRATION_NAV,
  MORE_NAV,
  CORE_SECTIONS,
  HIDDEN_FOR_STUDENT,
  ALL_ITEMS_MAP,
  NavItems,
} from '../components/Sidebar';
import { MobileBottomNav, MobileMenuDrawer } from '../components/MobileNav';

function renderNavItems(role: string, collapsed = false, filter = '') {
  return render(
    <DeviceProfileProvider>
      <I18nProvider initialLocale="en">
        <ThemeProvider>
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <NavItems role={role} collapsed={collapsed} filter={filter} />
          </MemoryRouter>
        </ThemeProvider>
      </I18nProvider>
    </DeviceProfileProvider>,
  );
}

describe('4-Pillar Navigation Structure Contracts', () => {
  it('defines the 4 core pillars with correct item counts and routes', () => {
    expect(CORE_SECTIONS).toHaveLength(4);

    const sectionIds = CORE_SECTIONS.map((s) => s.id);
    expect(sectionIds).toEqual(['management', 'academics', 'finance', 'communication']);

    // 1. Management: Dashboard, AI Copilot, Reports, At-Risk Students
    expect(MANAGEMENT_NAV.map((i) => i.to)).toEqual([
      '/',
      '/ai-copilot',
      '/reports',
      '/early-warning',
    ]);

    // 2. Academics: Students, Teachers, Groups, Courses, Schedule, Attendance, Face ID, Homework, Grades
    expect(ACADEMIC_NAV.map((i) => i.to)).toEqual([
      '/students',
      '/teachers',
      '/groups',
      '/courses',
      '/schedule',
      '/attendance',
      '/face',
      '/homework',
      '/grades',
    ]);

    // 3. Finance: Payments, Invoices, Expenses, Payroll
    expect(FINANCE_NAV.map((i) => i.to)).toEqual(['/payments', '/invoices', '/expenses', '/payroll']);

    // 4. Communication: Leads, Telegram, Chat, Notifications
    expect(COMMUNICATION_NAV.map((i) => i.to)).toEqual([
      '/leads',
      '/telegram',
      '/chat',
      '/notifications',
    ]);

    // Secondary Administration
    expect(ADMINISTRATION_NAV.map((i) => i.to)).toEqual([
      '/users',
      '/branches',
      '/cameras',
      '/audit',
      '/settings',
    ]);
  });

  it('indexes all routes in ALL_ITEMS_MAP for deep links and breadcrumbs', () => {
    const allPaths = [
      ...MANAGEMENT_NAV,
      ...ACADEMIC_NAV,
      ...FINANCE_NAV,
      ...COMMUNICATION_NAV,
      ...ADMINISTRATION_NAV,
      ...MORE_NAV,
    ].map((i) => i.to);

    for (const path of allPaths) {
      expect(ALL_ITEMS_MAP.has(path)).toBe(true);
      expect(ALL_ITEMS_MAP.get(path)?.to).toBe(path);
    }
  });

  it('renders section headers and pillar links for ADMIN', () => {
    renderNavItems('SUPER_ADMIN');

    // Section headers
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Academics')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();
    expect(screen.getByText('Communication & CRM')).toBeInTheDocument();
    expect(screen.getByText('Administration')).toBeInTheDocument();

    // Representative links
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'At-Risk Students' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Grades' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telegram Integration' })).toBeInTheDocument();
  });

  it('strictly hides staff-only routes and empty sections for STUDENT', () => {
    renderNavItems('STUDENT');

    // Administration section must not appear at all
    expect(screen.queryByText('Administration')).not.toBeInTheDocument();

    // Hidden routes
    for (const route of HIDDEN_FOR_STUDENT) {
      const item = ALL_ITEMS_MAP.get(route);
      if (item) {
        expect(screen.queryByRole('link', { name: item.label })).not.toBeInTheDocument();
      }
    }

    // Student accessible routes must be present
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Payments' })).toBeInTheDocument();
  });

  it('renders 4 pillar mobile tabs for staff, student, and parent', () => {
    const onOpenMore = vi.fn();

    // Staff view
    const { unmount } = render(
      <DeviceProfileProvider>
        <I18nProvider initialLocale="en">
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <MobileBottomNav role="ADMIN" onOpenMore={onOpenMore} />
          </MemoryRouter>
        </I18nProvider>
      </DeviceProfileProvider>,
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open (navigation )?menu/i })).toBeInTheDocument();
    unmount();

    // Student view
    const studentRender = render(
      <DeviceProfileProvider>
        <I18nProvider initialLocale="en">
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <MobileBottomNav role="STUDENT" onOpenMore={onOpenMore} />
          </MemoryRouter>
        </I18nProvider>
      </DeviceProfileProvider>,
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attendance' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
    studentRender.unmount();

    // Parent view
    render(
      <DeviceProfileProvider>
        <I18nProvider initialLocale="en">
          <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <MobileBottomNav role="PARENT" onOpenMore={onOpenMore} />
          </MemoryRouter>
        </I18nProvider>
      </DeviceProfileProvider>,
    );

    expect(screen.getByRole('link', { name: 'Parent Portal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
  });

  it('renders MobileMenuDrawer with all navigation sections and triggers onClose', () => {
    const onClose = vi.fn();
    const onLogout = vi.fn();

    render(
      <DeviceProfileProvider>
        <I18nProvider initialLocale="en">
          <ThemeProvider>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <MobileMenuDrawer
                open={true}
                onClose={onClose}
                role="ADMIN"
                orgName="Test Academy"
                onLogout={onLogout}
              />
            </MemoryRouter>
          </ThemeProvider>
        </I18nProvider>
      </DeviceProfileProvider>,
    );

    expect(screen.getByText('Test Academy')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Students' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teachers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Audit Log' })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close menu/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
