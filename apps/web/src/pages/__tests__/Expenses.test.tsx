/**
 * Unit & Integration Test Suite for ExpensesPage (Apple 10/10 VisionOS / macOS Sequoia Edition)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/I18nProvider';
import { ExpensesPage, calculateTotal } from '../Expenses';
import { openSidecar } from '@/stores/ui.store';
import type { Expense } from '@/lib/types';

const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    organizationId: 'org-1',
    category: 'RENT',
    amount: '4500000',
    description: 'Bino ijarasi oktabr',
    date: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'exp-2',
    organizationId: 'org-1',
    category: 'UTILITIES',
    amount: '850000',
    description: 'Elektr va suv tolovi',
    date: '2026-10-05T00:00:00.000Z',
  },
];

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/lib/api', () => ({
  expensesApi: {
    list: (...args: unknown[]) => mockList(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: (...args: unknown[]) => mockRemove(...args),
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

function renderExpensesPage() {
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
          <ExpensesPage />
        </QueryClientProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('ExpensesPage (Apple 10/10 VisionOS / macOS Sequoia Edition)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: mockExpenses,
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    mockCreate.mockResolvedValue({ id: 'exp-3' });
    mockUpdate.mockResolvedValue({ id: 'exp-1' });
    mockRemove.mockResolvedValue({ success: true });
  });

  it('calculates total expense amount correctly via pure helper', () => {
    expect(calculateTotal([])).toBe(0);
    expect(calculateTotal(mockExpenses)).toBe(5350000);
    expect(calculateTotal([{ amount: 'invalid' } as any])).toBe(0);
  });

  it('renders page header, mini stats, and expense rows', async () => {
    renderExpensesPage();

    await waitFor(() => {
      expect(screen.getByText('Bino ijarasi oktabr')).toBeInTheDocument();
      expect(screen.getByText('Elektr va suv tolovi')).toBeInTheDocument();
    });

    // Check action buttons have >= 44x44px hitbox
    const editBtns = screen.getAllByTestId('expense-edit-btn');
    expect(editBtns.length).toBe(2);
    editBtns.forEach((btn) => {
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.className).toContain('min-w-[44px]');
    });
  });

  it('filters expenses by category when category pill is clicked', async () => {
    renderExpensesPage();

    await waitFor(() => {
      expect(screen.getByText('Bino ijarasi oktabr')).toBeInTheDocument();
    });

    const rentChips = screen.getAllByRole('button', { name: /ijara|rent/i });
    expect(rentChips.length).toBeGreaterThan(0);
    fireEvent.click(rentChips[0]);

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'RENT',
        })
      );
    });
  });

  it('opens new expense modal and submits creation', async () => {
    renderExpensesPage();

    await waitFor(() => {
      expect(screen.getByText('Bino ijarasi oktabr')).toBeInTheDocument();
    });

    const addBtns = screen.getAllByRole('button', { name: /xarajat qo'shish|add/i });
    fireEvent.click(addBtns[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/masalan, 500 000|500 000/i)).toBeInTheDocument();
    });

    // Enter amount
    const amountInput = screen.getByPlaceholderText(/masalan, 500 000|500 000/i);
    fireEvent.change(amountInput, { target: { value: '1200000' } });

    // Submit via form submit button
    const modalButtons = screen.getAllByRole('button', { name: /xarajat qo'shish|add/i });
    fireEvent.click(modalButtons[modalButtons.length - 1]);

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1200000,
        })
      );
    });
  });

  it('opens macOS Sidecar when Sidecar button is clicked', async () => {
    renderExpensesPage();

    await waitFor(() => {
      expect(screen.getByText('Bino ijarasi oktabr')).toBeInTheDocument();
    });

    const sidecarBtns = screen.getAllByTestId('expense-sidecar-btn');
    expect(sidecarBtns.length).toBeGreaterThan(0);
    fireEvent.click(sidecarBtns[0]);

    expect(openSidecar).toHaveBeenCalled();
  });

  it('allows multi-selection and displays batch floating island', async () => {
    renderExpensesPage();

    await waitFor(() => {
      expect(screen.getByText('Bino ijarasi oktabr')).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByLabelText(/xarajatini tanlash|select expense/i);
    expect(selectButtons.length).toBe(2);

    // Select first expense
    fireEvent.click(selectButtons[0]);

    // FloatingActionIsland appears
    await waitFor(() => {
      expect(screen.getByText(/eksport \(csv\)|export \(csv\)/i)).toBeInTheDocument();
    });
  });
});
