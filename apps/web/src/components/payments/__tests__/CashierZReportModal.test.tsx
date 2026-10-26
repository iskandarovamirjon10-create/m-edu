import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CashierZReportModal } from '../CashierZReportModal';
import { I18nProvider } from '@/i18n/I18nProvider';

const { getZReportSummaryMock, getRecentZReportsMock, closeCashierShiftMock, pushMock } = vi.hoisted(() => ({
  getZReportSummaryMock: vi.fn(),
  getRecentZReportsMock: vi.fn(),
  closeCashierShiftMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  paymentsApi: {
    getZReportSummary: getZReportSummaryMock,
    getRecentZReports: getRecentZReportsMock,
    closeCashierShift: closeCashierShiftMock,
  },
}));

vi.mock('@/components/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui')>();
  return {
    ...actual,
    useToast: () => ({ push: pushMock }),
  };
});

function renderModal(props: { open: boolean; onClose: () => void }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider initialLocale="uz">
        <CashierZReportModal {...props} />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

const MOCK_SUMMARY = {
  period: { start: '2026-10-26T00:00:00.000Z', end: '2026-10-26T18:00:00.000Z' },
  totalPaymentsCount: 5,
  totalCollected: 2500000,
  byMethod: {
    cash: { count: 3, amount: 1500000 },
    terminal: { count: 1, amount: 800000 },
    bankTransfer: { count: 1, amount: 200000 },
    other: { count: 0, amount: 0 },
  },
  receiptsIssuedCount: 5,
  refunds: {
    count: 1,
    totalAmount: 100000,
    cashRefundsAmount: 100000,
  },
  netCashDrawerExpected: 1400000, // 1500000 - 100000
  firstPaymentTime: '2026-10-26T09:15:00.000Z',
  lastPaymentTime: '2026-10-26T17:45:00.000Z',
};

describe('CashierZReportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getZReportSummaryMock.mockResolvedValue(MOCK_SUMMARY);
    getRecentZReportsMock.mockResolvedValue([]);
  });

  it('renders modal with summary metrics and expected cash drawer amount', async () => {
    renderModal({ open: true, onClose: vi.fn() });

    expect(screen.getByText(/Kunlik Kassa va Z-Hisobot/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Naqd kassa/i)).toBeInTheDocument();
      expect(screen.getByText(/Terminal/i)).toBeInTheDocument();
      expect(screen.getByText(/Bank hisob/i)).toBeInTheDocument();
    });

    // Check expected cash display
    expect(screen.getByText(/Kassadagi kutilayotgan naqd pul/i)).toBeInTheDocument();
  });

  it('calculates discrepancy variance dynamically when cash count changes', async () => {
    const user = userEvent.setup();
    renderModal({ open: true, onClose: vi.fn() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Masalan: 1400000/i)).toBeInTheDocument();
    });

    const cashInput = screen.getByPlaceholderText(/Masalan: 1400000/i);
    // User types 1350000 (shortage of 50,000)
    await user.clear(cashInput);
    await user.type(cashInput, '1350000');

    await waitFor(() => {
      expect(screen.getByText(/Kamomad aniqlandi/i)).toBeInTheDocument();
    });
  });

  it('submits cashier shift closure and renders printable Z-report view', async () => {
    const user = userEvent.setup();
    closeCashierShiftMock.mockResolvedValue({
      success: true,
      reportNumber: 'Z-20261026-8842',
      closedAt: '2026-10-26T18:30:00.000Z',
      cashierName: 'Nodira Salimova',
      summary: MOCK_SUMMARY,
      expectedCash: 1400000,
      actualCashCounted: 1400000,
      variance: 0,
      status: 'BALANCED',
      closingNotes: 'Barcha cheklar tekshirildi',
    });

    renderModal({ open: true, onClose: vi.fn() });

    await waitFor(() => {
      expect(screen.getByText(/Smenani yopish \(Z-Hisobot\)/i)).toBeInTheDocument();
    });

    const closeBtn = screen.getByText(/Smenani yopish \(Z-Hisobot\)/i);
    await user.click(closeBtn);

    await waitFor(() => {
      expect(closeCashierShiftMock).toHaveBeenCalled();
      expect(screen.getByText(/Kassa Smenasi Rasman Yopildi/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Z-20261026-8842/i).length).toBeGreaterThan(0);
    });
  });
});
