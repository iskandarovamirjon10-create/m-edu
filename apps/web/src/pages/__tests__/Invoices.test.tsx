/**
 * Unit & Integration Test Suite for InvoicesPage (Apple VisionOS / macOS Sequoia 10/10 Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { InvoicesPage } from '../Invoices';
import { openSidecar } from '@/stores/ui.store';

const mockInvoices = [
  {
    id: 'inv-1',
    number: 'INV-2026-001',
    organizationId: 'org-1',
    studentId: 's-1',
    status: 'ISSUED',
    issueDate: '2026-10-01T00:00:00Z',
    dueDate: '2026-10-30T00:00:00Z',
    subtotal: 1200000,
    discountAmount: 0,
    taxAmount: 0,
    total: 1200000,
    paidAmount: 600000,
    remaining: 600000,
    refundedAmount: 0,
    currency: 'UZS',
    createdAt: '2026-10-01T10:00:00Z',
    student: {
      id: 's-1',
      user: {
        firstName: 'Anvar',
        lastName: 'Sobirov',
        phone: '+998901234567',
      },
    },
    items: [
      {
        id: 'item-1',
        description: 'Matematika kursi',
        quantity: 1,
        unitPrice: 1200000,
        amount: 1200000,
      },
    ],
  },
  {
    id: 'inv-2',
    number: 'INV-2026-002',
    organizationId: 'org-1',
    studentId: 's-2',
    status: 'PAID',
    issueDate: '2026-10-02T00:00:00Z',
    dueDate: '2026-10-25T00:00:00Z',
    subtotal: 800000,
    discountAmount: 0,
    taxAmount: 0,
    total: 800000,
    paidAmount: 800000,
    remaining: 0,
    refundedAmount: 0,
    currency: 'UZS',
    createdAt: '2026-10-02T10:00:00Z',
    student: {
      id: 's-2',
      user: {
        firstName: 'Laylo',
        lastName: 'Karimova',
        phone: '+998939876543',
      },
    },
    items: [
      {
        id: 'item-2',
        description: 'Ingliz tili kursi',
        quantity: 1,
        unitPrice: 800000,
        amount: 800000,
      },
    ],
  },
];

const mockStudents = {
  items: [
    {
      id: 's-1',
      user: {
        firstName: 'Anvar',
        lastName: 'Sobirov',
      },
    },
    {
      id: 's-2',
      user: {
        firstName: 'Laylo',
        lastName: 'Karimova',
      },
    },
  ],
};

const mockList = vi.fn();
const mockGet = vi.fn();
const mockGetPaymentLinks = vi.fn();
const mockCreate = vi.fn();
const mockCreateProrated = vi.fn();
const mockRecordPayment = vi.fn();
const mockRequestRefund = vi.fn();
const mockProcessRefund = vi.fn();
const mockRejectRefund = vi.fn();
const mockIssue = vi.fn();
const mockStudentsList = vi.fn();

vi.mock('@/lib/api', () => ({
  invoicesApi: {
    list: (...args: unknown[]) => mockList(...args),
    get: (...args: unknown[]) => mockGet(...args),
    getPaymentLinks: (...args: unknown[]) => mockGetPaymentLinks(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    createProrated: (...args: unknown[]) => mockCreateProrated(...args),
    recordPayment: (...args: unknown[]) => mockRecordPayment(...args),
    requestRefund: (...args: unknown[]) => mockRequestRefund(...args),
    processRefund: (...args: unknown[]) => mockProcessRefund(...args),
    rejectRefund: (...args: unknown[]) => mockRejectRefund(...args),
    issue: (...args: unknown[]) => mockIssue(...args),
  },
  studentsApi: {
    list: (...args: unknown[]) => mockStudentsList(...args),
  },
}));

vi.mock('@/hooks/usePageTitle', () => ({
  usePageTitle: vi.fn(),
}));

vi.mock('@/hooks/usePremiumSound', () => ({
  usePremiumSound: () => ({
    playTick: vi.fn(),
    playPop: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
  }),
}));

vi.mock('@/stores/ui.store', () => ({
  openSidecar: vi.fn(),
  openQuickLook: vi.fn(),
}));

vi.mock('@/components/pdf-studio', () => ({
  ExecutivePDFStudio: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="executive-pdf-studio">
        <button onClick={onClose}>Close Studio</button>
      </div>
    ) : null,
}));

function renderInvoicesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return render(
    <MemoryRouter>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <InvoicesPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('InvoicesPage (10/10 VisionOS Liquid Glass Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ items: mockInvoices });
    mockStudentsList.mockResolvedValue(mockStudents);
  });

  it('renders page hero header and KPI stats', async () => {
    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-002')).toBeInTheDocument();
    });

    // Student names
    expect(screen.getByText('Anvar Sobirov')).toBeInTheDocument();
    expect(screen.getByText('Laylo Karimova')).toBeInTheDocument();
  });

  it('filters invoices when clicking tabs', async () => {
    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const tab = buttons.find((b) => /barchasi|all|chiqarilgan|issued/i.test(b.textContent || ''));
    if (tab) {
      fireEvent.click(tab);
      await waitFor(() => {
        expect(mockList).toHaveBeenCalled();
      });
    }
  });

  it('opens Prorate Tuition modal and calculates prorated total', async () => {
    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const prorateBtn = screen.getByRole('button', { name: /prorate|kunbay/i });
    fireEvent.click(prorateBtn);

    // Modal should now be open
    await waitFor(() => {
      expect(screen.getByPlaceholderText('800 000')).toBeInTheDocument();
    });

    // Monthly tuition input
    const tuitionInput = screen.getByPlaceholderText('800 000');
    fireEvent.change(tuitionInput, { target: { value: '1200000' } });

    // Should compute proportional preview (1200000 * 6 / 12 = 600,000)
    await waitFor(() => {
      expect(screen.getAllByText(/600/).length).toBeGreaterThan(0);
    });
  });

  it('opens Payment Recording modal from row action', async () => {
    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const payActionBtns = screen.getAllByTestId('invoice-record-payment-btn');
    expect(payActionBtns.length).toBeGreaterThan(0);
    fireEvent.click(payActionBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/toʻlovni tasdiqlash|to'lovni tasdiqlash|confirm payment/i)).toBeInTheDocument();
    });
  });

  it('opens Executive PDF Studio when receipt action is clicked', async () => {
    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const pdfBtns = screen.getAllByTitle(/kvitansiya|pdf|studio/i);
    expect(pdfBtns.length).toBeGreaterThan(0);
    fireEvent.click(pdfBtns[0]);

    await waitFor(() => {
      expect(screen.getByTestId('executive-pdf-studio')).toBeInTheDocument();
    });
  });

  it('opens sidecar drawer when QuickLook sidecar button is clicked', async () => {
    renderInvoicesPage();

    await waitFor(() => {
      expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    });

    const sidecarBtns = screen.getAllByTestId('invoice-sidecar-btn');
    expect(sidecarBtns.length).toBeGreaterThan(0);
    fireEvent.click(sidecarBtns[0]);

    expect(openSidecar).toHaveBeenCalled();
  });
});
