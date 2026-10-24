/**
 * Unit & Integration Test Suite for LeadsPage (Apple 10/10 VisionOS Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { LeadsPage } from '../Leads';
import type { Lead } from '@/lib/types';

const mockLeads: Lead[] = [
  {
    id: 'lead-1',
    organizationId: 'org-1',
    firstName: 'Shoxrux',
    lastName: 'Rustamov',
    phone: '+998901234567',
    email: 'shoxrux@example.com',
    source: 'Telegram Bot',
    stage: 'NEW',
    notes: 'Ingliz tili kursiga qiziqmoqda',
    createdAt: '2026-10-22T09:00:00Z',
    updatedAt: '2026-10-22T09:00:00Z',
  },
  {
    id: 'lead-2',
    organizationId: 'org-1',
    firstName: 'Nilufar',
    lastName: 'Qosimova',
    phone: '+998939876543',
    email: 'nilufar@example.com',
    source: 'Instagram',
    stage: 'TRIAL_LESSON',
    notes: 'Sinov darsi ertaga 14:00 da',
    createdAt: '2026-10-21T11:00:00Z',
    updatedAt: '2026-10-21T11:00:00Z',
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockUpdateStage = vi.fn();
const mockConvert = vi.fn();
const mockScheduleTrial = vi.fn();
const mockMarkTrialAttendance = vi.fn();
const mockGetTrialAnalytics = vi.fn();

vi.mock('@/lib/api', () => ({
  leadsApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
    updateStage: (...args: unknown[]) => mockUpdateStage(...args),
    convert: (...args: unknown[]) => mockConvert(...args),
    scheduleTrial: (...args: unknown[]) => mockScheduleTrial(...args),
    markTrialAttendance: (...args: unknown[]) => mockMarkTrialAttendance(...args),
    getTrialAnalytics: (...args: unknown[]) => mockGetTrialAnalytics(...args),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

function renderLeadsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <MemoryRouter>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <LeadsPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('LeadsPage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockLeads,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockGetTrialAnalytics.mockResolvedValue({
      totalTrialScheduled: 4,
      attended: 3,
      convertedWon: 2,
      conversionRate: 67,
      pendingAttendance: 1,
    });
  });

  it('renders page header, title, and total leads KPIs', async () => {
    renderLeadsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByText('Shoxrux Rustamov')).toBeInTheDocument();
      expect(screen.getByText('Nilufar Qosimova')).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('renders trial lesson conversion analytics strip when available', async () => {
    renderLeadsPage();

    await waitFor(() => {
      expect(screen.getByText(/Trial Lessons Funnel/i)).toBeInTheDocument();
      expect(screen.getByText(/Conversion: 67%/i)).toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('guarantees touch targets >= 44x44px for row action buttons', async () => {
    renderLeadsPage();

    await waitFor(() => {
      expect(screen.getByText('Shoxrux Rustamov')).toBeInTheDocument();
    }, { timeout: 4000 });

    const sidecarButtons = screen.getAllByLabelText(/Open lead sidecar details/i);
    expect(sidecarButtons.length).toBeGreaterThan(0);
    sidecarButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    const editButtons = screen.getAllByRole('button', { name: /Edit/i });
    expect(editButtons.length).toBeGreaterThan(0);
    editButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
    });

    const quickLookButtons = screen.getAllByTitle('Quick-Look (Space)');
    expect(quickLookButtons.length).toBeGreaterThan(0);
    quickLookButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
    });
  });

  it('allows selecting rows with accessible >= 44x44px checkbox touch targets', async () => {
    renderLeadsPage();

    await waitFor(() => {
      expect(screen.getByText('Shoxrux Rustamov')).toBeInTheDocument();
    }, { timeout: 4000 });

    const selectButtons = screen.getAllByLabelText(/Select lead Shoxrux Rustamov/i);
    expect(selectButtons.length).toBeGreaterThan(0);
    selectButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    // Select row
    fireEvent.click(selectButtons[0]);

    // Floating action island appears
    await waitFor(() => {
      expect(screen.getByText(/Mark as Won/i)).toBeInTheDocument();
      expect(screen.getByText(/Export \(CSV\)/i)).toBeInTheDocument();
    });
  });

  it('opens Add Lead modal when clicking add button', async () => {
    renderLeadsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Add Lead/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ali')).toBeInTheDocument();
    });
  });
});
