import { toLocalISOString } from '../lib/format';
import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassPagination, GlassInput, GlassSelect, GlassField, GlassModal, ConfirmDialog, GlassButton, useToasts, statusColor } from '@/components/ui';
import { formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Expense, ExpenseCategory } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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

function categoryKey(category: string): string {
  return `expenses.category.${category}`;
}

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
  date: toLocalISOString(),
};

function calculateTotal(expenses: Expense[]): number {
  // Backend serializes Decimal columns as strings; coerce to numbers before
  // summing or JS would concatenate ("0" + "150.00" = "0150.00").
  return expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
}

export function ExpensesPage() {
  const { t } = useI18n();
  usePageTitle(t('expenses.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

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
    queryKey: queryKeys.expenses.list(params),
    queryFn: () => expensesApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = expenses.data as Paginated<Expense> | undefined;
  const expenseList = useMemo(() => data?.items || [], [data]);
  const totalAmount = useMemo(
    () => (expenseList.length > 0 ? calculateTotal(expenseList) : 0),
    [expenseList],
  );

  // Create or update expense mutation
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        description: form.description.trim() || undefined,
        date: new Date(form.date).toISOString(),
      };
      return editingId ? expensesApi.update(editingId, payload) : expensesApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('expenses.updated') : t('expenses.recorded'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Delete expense mutation
  const remove = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: () => {
      push('success', t('expenses.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof ExpenseFormState, string>> = {};

    if (!form.amount || parseFloat(form.amount) <= 0) {
      errors.amount = t('expenses.validation.amountPositive');
    }
    if (!form.date) {
      errors.date = t('expenses.validation.dateRequired');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

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
      save.mutate();
    },
    [validateForm, save],
  );
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((expense: Expense) => {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
      date: toLocalISOString(new Date(expense.date)),
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchExpenses } = expenses;
  const handleRetry = useCallback(() => {
    void refetchExpenses();
  }, [refetchExpenses]);

  const hasActiveFilter = Boolean(category);
  const totalExpenses = data?.total || 0;

  // Early return for loading state
  if (expenses.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('expenses.title')}
            subtitle={t('expenses.subtitle')}
          />
          <div className="glass-card p-8">
            <GlassPageLoader label={t('expenses.loading')} />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (expenses.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('expenses.title')}
            subtitle={t('expenses.subtitle')}
          />
          <div className="glass-card p-8">
            <GlassErrorState
              title={t('expenses.loadError')}
              message={getErrorMessage(expenses.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "contents" }}>
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('expenses.title')}
          subtitle={t('expenses.subtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
            >
              {t('expenses.add')}
            </GlassButton>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="grid grid-cols-1 gap-3 sm:flex-1">
            <GlassSelect
              value={category}
              onChange={handleCategoryChange}
              aria-label={t('expenses.filterByCategory')}
            >
              <option value="">{t('expenses.allCategories')}</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(categoryKey(cat))}
                </option>
              ))}
            </GlassSelect>
          </div>
          <div className="flex items-center justify-between gap-4 sm:ml-4 sm:shrink-0">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {totalExpenses === 1
                ? t('expenses.countOne')
                : t('expenses.countMany', { count: totalExpenses })}
            </span>
            {expenseList.length > 0 && (
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {t('expenses.pageTotal', { amount: formatCurrency(totalAmount) })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expenses table */}
      <div className="glass-card">
        {expenseList.length === 0 ? (
          <GlassEmptyState
            title={hasActiveFilter ? t('expenses.noMatching') : t('expenses.emptyTitle')}
            message={
              hasActiveFilter
                ? t('common.adjustFilters')
                : t('expenses.emptyMessage')
            }
          />
        ) : (
          <>
            <div className="glass-table-wrap">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('expenses.category')}</th>
                    <th>{t('common.description')}</th>
                    <th style={{ textAlign: 'right' }}>{t('payments.col.amount')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseList.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap">
                        {formatDate(expense.date)}
                      </td>
                      <td>
                        <GlassBadge color={statusColor(expense.category)}>
                          {t(categoryKey(expense.category))}
                        </GlassBadge>
                      </td>
                      <td className="max-w-xs truncate" title={expense.description || undefined}>
                        {expense.description || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }} className="font-medium">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <GlassButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(expense)}
                          >
                            {t('common.edit')}
                          </GlassButton>
                          <GlassButton
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(expense.id)}
                          >
                            {t('common.delete')}
                          </GlassButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </div>

      {/* Add expense modal */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editingId ? t('expenses.editTitle') : t('expenses.addTitle')}
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('expenses.category')} required>
              <GlassSelect
                value={form.category}
                onChange={handleFormChange('category')}
                aria-label={t('expenses.categoryAria')}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(categoryKey(cat))}
                  </option>
                ))}
              </GlassSelect>
            </GlassField>
            <GlassField label={t('expenses.amountUsd')} required error={formErrors.amount}>
              <GlassInput
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
            </GlassField>
          </div>

          <GlassField label={t('common.date')} required error={formErrors.date}>
            <GlassInput
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
          </GlassField>

          <GlassField label={t('common.description')}>
            <GlassInput
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder={t('common.optionalDescription')}
            />
          </GlassField>

          <div className="flex justify-end gap-2">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={save.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={save.isPending}
            >
              {save.isPending
                ? t('common.saving')
                : editingId
                  ? t('expenses.saveChanges')
                  : t('expenses.add')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('expenses.deleteConfirm')}
        loading={remove.isPending}
      />

      {toastNode}
      </div>
    </div>
  );
}