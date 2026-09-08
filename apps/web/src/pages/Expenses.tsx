import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/api';
import {
  PageHeader,
  Badge,
  PageLoader,
  ErrorState,
  EmptyState,
  Pagination,
  TextInput,
  Select,
  Field,
  Modal,
  useToasts,
  statusColor,
} from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Expense, ExpenseCategory } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'SALARY',
  'RENT',
  'UTILITIES',
  'MARKETING',
  'SUPPLIES',
  'MAINTENANCE',
  'SOFTWARE',
  'TRAINING',
  'OTHER',
];

interface ExpenseFilters {
  page: number;
  limit: number;
  category?: ExpenseCategory;
}

interface ExpenseFormState {
  category: ExpenseCategory;
  amount: string;
  description: string;
  date: string;
}

const INITIAL_FORM: ExpenseFormState = {
  category: 'OTHER',
  amount: '',
  description: '',
  date: new Date().toISOString().slice(0, 10),
};

function formatCategory(category: string): string {
  return category
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function calculateTotal(expenses: Expense[]): number {
  // Backend serializes Decimal columns as strings; coerce to numbers before
  // summing or JS would concatenate ("0" + "150.00" = "0150.00").
  return expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
}

export function ExpensesPage() {
  usePageTitle('Expenses');
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState<ExpenseFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof ExpenseFormState, string>>
  >({});

  // Build query params
  const params = useMemo<ExpenseFilters>(
    () => ({
      page,
      limit: 20,
      category: (category as ExpenseCategory) || undefined,
    }),
    [page, category],
  );

  // Data fetching
  const expenses = useQuery({
    queryKey: ['expenses', params],
    queryFn: () => expensesApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = expenses.data as Paginated<Expense> | undefined;
  const expenseList = useMemo(() => data?.items || [], [data]);
  const totalAmount = useMemo(
    () => (expenseList.length > 0 ? calculateTotal(expenseList) : 0),
    [expenseList],
  );

  // Create expense mutation
  const create = useMutation({
    mutationFn: () =>
      expensesApi.create({
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        description: form.description.trim() || undefined,
        date: new Date(form.date).toISOString(),
      }),
    onSuccess: () => {
      push('success', 'Expense recorded successfully');
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof ExpenseFormState, string>> = {};

    if (!form.amount || parseFloat(form.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }
    if (!form.date) {
      errors.date = 'Date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof ExpenseFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setCategory(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const { refetch: refetchExpenses } = expenses;
  const handleRetry = useCallback(() => {
    void refetchExpenses();
  }, [refetchExpenses]);

  const hasActiveFilter = Boolean(category);
  const totalExpenses = data?.total || 0;

  // Early return for loading state
  if (expenses.isLoading && !data) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container space-y-4">
          <PageHeader
            title="Expenses"
            subtitle="Track organization expenses"
          />
          <div className="glass-card p-8">
            <PageLoader label="Loading expenses…" />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (expenses.isError) {
    return (
      <div className="orb-container">
        <div className="orb orb-cyan-1" />
        <div className="orb orb-cyan-2" />
        <div className="orb orb-indigo-1" />
        <div className="orb orb-deep-1" />
        <div className="page-container space-y-4">
          <PageHeader
            title="Expenses"
            subtitle="Track organization expenses"
          />
          <div className="glass-card p-8">
            <ErrorState
              title="Failed to load expenses"
              message={getErrorMessage(expenses.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="orb orb-deep-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Expenses"
          subtitle="Track organization expenses"
          actions={
            <button
              type="button"
              className="glass-btn glass-btn-primary"
              onClick={handleOpenModal}
            >
              Add expense
            </button>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 gap-3 sm:flex-1">
            <Select
              value={category}
              onChange={handleCategoryChange}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {formatCategory(cat)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4 sm:ml-4 sm:shrink-0">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {totalExpenses} {totalExpenses === 1 ? 'expense' : 'expenses'}
            </span>
            {expenseList.length > 0 && (
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Page total: {formatCurrency(totalAmount)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expenses table */}
      <div className="glass-card">
        {expenseList.length === 0 ? (
          <EmptyState
            title={hasActiveFilter ? 'No matching expenses' : 'No expenses'}
            message={
              hasActiveFilter
                ? 'Try adjusting your filters to see more results.'
                : 'Record your first expense to start tracking spending.'
            }
          />
        ) : (
          <>
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseList.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap">
                        {formatDate(expense.date)}
                      </td>
                      <td>
                        <Badge color={statusColor(expense.category)}>
                          {formatCategory(expense.category)}
                        </Badge>
                      </td>
                      <td className="max-w-xs truncate" title={expense.description || undefined}>
                        {expense.description || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-medium">
                        {formatCurrency(expense.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <Pagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Add expense modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title="Add expense"
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <Select
                value={form.category}
                onChange={handleFormChange('category')}
                aria-label="Expense category"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {formatCategory(cat)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount (USD)" required error={formErrors.amount}>
              <TextInput
                type="number"
                step="0.01"
                min="0.01"
                value={form.amount}
                onChange={handleFormChange('amount')}
                required
                aria-invalid={Boolean(formErrors.amount)}
                aria-describedby={formErrors.amount ? 'amount-error' : undefined}
                placeholder="150.00"
              />
              {formErrors.amount && (
                <span id="amount-error" className="mt-1 text-sm text-red-600">
                  {formErrors.amount}
                </span>
              )}
            </Field>
          </div>

          <Field label="Date" required error={formErrors.date}>
            <TextInput
              type="date"
              value={form.date}
              onChange={handleFormChange('date')}
              required
              aria-invalid={Boolean(formErrors.date)}
              aria-describedby={formErrors.date ? 'date-error' : undefined}
            />
            {formErrors.date && (
              <span id="date-error" className="mt-1 text-sm text-red-600">
                {formErrors.date}
              </span>
            )}
          </Field>

          <Field label="Description">
            <TextInput
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder="Optional description…"
            />
          </Field>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="glass-btn glass-btn-secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="glass-btn glass-btn-primary"
              disabled={create.isPending}
            >
              {create.isPending ? 'Saving…' : 'Add expense'}
            </button>
          </div>
        </form>
      </Modal>

      {toastNode}
      </div>
    </div>
  );
}