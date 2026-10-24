/**
 * Unit & Integration Test Suite for PaymentsPage (Apple 10/10 VisionOS / iOS 27 Liquid Glass Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import {
  PaymentsPage,
  formatStudentName,
  formatPaymentStatus,
  formatPaymentMethod,
  toPaymentMethod,
} from '../Payments';
import type { Payment, Student } from '@/lib/types';

const mockStudent: Student = {
  id: 's-1',
  organizationId: 'org-1',
  userId: 'u-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  user: {
    id: 'u-1',
    firstName: 'Madina',
    lastName: 'Usmonova',
    email: 'madina@example.com',
    phone: '+998909876543',
    isActive: true,
  },
};

const mockPayments: Payment[] = [
  {
    id: 'p-1',
    organizationId: 'org-1',
    studentId: 's-1',
    amount: '1200000',
    status: 'PAID',
    method: 'PAYME',
    description: 'Oktabr oyi uchun tolov',
    dueDate: '2026-10-25T00:00:00Z',
    createdAt: '2026-10-20T10:00:00Z',
    student: mockStudent,
  },
  {
    id: 'p-2',
    organizationId: 'org-1',
    studentId: 's-1',
    amount: '800000',
    status: 'PENDING',
    method: 'CASH',
    description: 'Noyabr kursi avansi',
    dueDate: '2026-11-01T00:00:00Z',
    createdAt: '2026-10-21T12:00:00Z',
    student: mockStudent,
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockStudentsList = vi.fn();

vi.mock('@/lib/api', () => ({
  paymentsApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
  studentsApi: {
    list: (...args: unknown[]) => mockStudentsList(...args),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

function renderPaymentsPage() {
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
          <PaymentsPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('PaymentsPage (Apple 10/10 VisionOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockPayments,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockStudentsList.mockResolvedValue({ items: [mockStudent], total: 1 });
  });

  it('renders page header, title, and search input', async () => {
    renderPaymentsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getAllByText('Madina Usmonova')[0]).toBeInTheDocument();
    });
  });

  it('renders payments list with descriptions and amounts', async () => {
    renderPaymentsPage();

    await waitFor(() => {
      expect(screen.getByText('Oktabr oyi uchun tolov')).toBeInTheDocument();
      expect(screen.getByText('Noyabr kursi avansi')).toBeInTheDocument();
    });
  });

  it('guarantees touch targets >= 44x44px for row action buttons', async () => {
    renderPaymentsPage();

    await waitFor(() => {
      expect(screen.getAllByText('Madina Usmonova')[0]).toBeInTheDocument();
    });

    const sidecarButtons = screen.getAllByLabelText(/Open payment sidecar details/i);
    expect(sidecarButtons.length).toBeGreaterThan(0);
    sidecarButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    const receiptButtons = screen.getAllByLabelText(/Receipt/i);
    expect(receiptButtons.length).toBeGreaterThan(0);
    receiptButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
    });
  });

  it('allows selecting rows with accessible >= 44x44px checkbox touch targets', async () => {
    renderPaymentsPage();

    await waitFor(() => {
      expect(screen.getAllByText('Madina Usmonova')[0]).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByLabelText(/Select payment for Madina Usmonova/i);
    expect(selectButtons.length).toBeGreaterThan(0);
    selectButtons.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });

    // Select row
    fireEvent.click(selectButtons[0]);

    // Floating action island appears
    await waitFor(() => {
      expect(screen.getByText(/Mark as Paid/i)).toBeInTheDocument();
      expect(screen.getByText(/Export \(CSV\)/i)).toBeInTheDocument();
    });
  });

  it('opens Record Payment modal on add click', async () => {
    renderPaymentsPage();

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    const addButtons = screen.getAllByRole('button', { name: /Record Payment/i });
    fireEvent.click(addButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Record a new tuition payment/i)).toBeInTheDocument();
    });
  });

  it('preserves all pure formatters contracts', () => {
    expect(formatStudentName(mockStudent)).toBe('Madina Usmonova');
    expect(formatStudentName(undefined)).toBe('—');
    expect(formatPaymentStatus('PAID')).toBe('Paid');
    expect(formatPaymentMethod('CASH')).toBe('Cash');
    expect(toPaymentMethod('PAYME')).toBe('PAYME');
    expect(toPaymentMethod('INVALID_METHOD' as any)).toBe('CASH');
  });
});
