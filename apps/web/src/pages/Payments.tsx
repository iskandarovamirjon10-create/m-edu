import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, studentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { GlassPageHeader, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassPagination, GlassInput, GlassSelect, GlassField, GlassModal, GlassButton, useToasts } from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Payment, Student, PaymentStatus, PaymentMethod } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { Receipt, Printer, CreditCard, Banknote, ShieldCheck } from 'lucide-react';

const PAYMENT_STATUSES: PaymentStatus[] = ['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'];
const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'PAYME',
  'CLICK',
  'UZUM',
  'OTHER',
];

interface PaymentFilters {
  page: number;
  limit: number;
  status?: PaymentStatus;
  search?: string;
}

interface PaymentFormState {
  studentId: string;
  amount: string;
  description: string;
  dueDate: string;
  method: PaymentMethod;
}

const INITIAL_FORM: PaymentFormState = {
  studentId: '',
  amount: '',
  description: '',
  dueDate: '',
  method: 'CASH',
};

export function formatStudentName(student: Student | undefined): string {
  if (!student?.user) return '—';
  const { firstName, lastName } = student.user;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
}

export function formatPaymentStatus(status: PaymentStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatPaymentMethod(method: PaymentMethod): string {
  return method.charAt(0) + method.slice(1).toLowerCase();
}

export function PaymentsPage() {
  const { t } = useI18n();
  usePageTitle(t('payments.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null);

  // Form state
  const [form, setForm] = useState<PaymentFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof PaymentFormState, string>>
  >({});

  // Build query params
  const params = useMemo<PaymentFilters>(
    () => ({
      page,
      limit: 20,
      status: (status as PaymentStatus) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, status, debouncedSearch],
  );

  // Data fetching
  const payments = useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => paymentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = payments.data as Paginated<Payment> | undefined;
  const paymentList = useMemo(() => data?.items || [], [data]);
  const studentList = useMemo(() => {
    if (Array.isArray(students.data)) return students.data;
    return (students.data as Paginated<Student> | undefined)?.items || [];
  }, [students.data]);

  // Create payment mutation
  const create = useMutation({
    mutationFn: () =>
      paymentsApi.create({
        studentId: form.studentId,
        amount: parseFloat(form.amount) || 0,
        description: form.description.trim() || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        method: form.method,
      }),
    onSuccess: () => {
      push('success', t('payments.created'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
      if (form.studentId) {
        qc.invalidateQueries({ queryKey: queryKeys.students.detail(form.studentId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Update status mutation
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      paymentsApi.update(id, { status }),
    onSuccess: () => {
      push('success', t('payments.updated'));
      qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PaymentFormState, string>> = {};

    if (!form.studentId) {
      errors.studentId = 'payments.validation.studentRequired';
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
      errors.amount = 'payments.validation.amountPositive';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // Form handlers
  const handleFormChange = useCallback(
    (field: keyof PaymentFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleStatusFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatus(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleUpdateStatus = useCallback(
    (paymentId: string, newStatus: PaymentStatus) => {
      updateStatus.mutate({ id: paymentId, status: newStatus });
    },
    [updateStatus],
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

  const { refetch: refetchPayments } = payments;
  const handleRetry = useCallback(() => {
    void refetchPayments();
  }, [refetchPayments]);

  const hasActiveFilters = Boolean(status || search);
  const totalPayments = data?.total || 0;

  // Early return for loading state
  if (payments.isLoading && !data) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('payments.title')}
            subtitle={t('payments.subtitle')}
          />
          <div className="glass-card p-8">
            <GlassPageLoader label={t('payments.loading')} />
          </div>
        </div>
      </div>
    );
  }

  // Early return for error state
  if (payments.isError) {
    return (
      <div style={{ display: "contents" }}>
        <div className="page-container space-y-4">
          <GlassPageHeader
            title={t('payments.title')}
            subtitle={t('payments.subtitle')}
          />
          <div className="glass-card p-8">
            <GlassErrorState
              title={t('payments.loadError')}
              message={getErrorMessage(payments.error as Error)}
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
          title={t('payments.title')}
          subtitle={t('payments.subtitle')}
          actions={
            <GlassButton
              type="button"
              variant="primary"
              onClick={handleOpenModal}
            >
              {t('payments.add')}
            </GlassButton>
          }
        />

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <GlassInput
                placeholder={t('payments.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('payments.searchPlaceholder')}
                type="search"
              />
              <GlassSelect
                value={status}
                onChange={handleStatusFilterChange}
                aria-label={t('payments.filterByStatus')}
              >
                <option value="">{t('payments.allStatuses')}</option>
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`payments.status.${status}`)}
                  </option>
                ))}
              </GlassSelect>
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-muted)' }}>
              {totalPayments} {totalPayments === 1 ? t('payments.countOne') : t('payments.countMany')}
            </div>
          </div>
        </div>

        {/* Payments table */}
        <div className="glass-card">
          {paymentList.length === 0 ? (
            <GlassEmptyState
              title={hasActiveFilters ? t('payments.emptyFiltered') : t('payments.empty')}
              message={
                hasActiveFilters
                  ? t('payments.emptyFilteredHint')
                  : t('payments.emptyHint')
              }
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <table className="glass-table">
                  <thead>
                    <tr>
                      <th>{t('common.date')}</th>
                      <th>{t('payments.form.student')}</th>
                      <th>{t('payments.col.description')}</th>
                      <th>{t('payments.form.method')}</th>
                      <th>{t('payments.col.status')}</th>
                      <th style={{ textAlign: 'right' }}>{t('payments.col.amount')}</th>
                      <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentList.map((payment) => {
                      const isUpdatingStatus =
                        updateStatus.isPending &&
                        updateStatus.variables?.id === payment.id;

                      return (
                        <tr key={payment.id}>
                          <td className="whitespace-nowrap">
                            {formatDate(payment.createdAt)}
                          </td>
                          <td className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {formatStudentName(payment.student)}
                          </td>
                          <td
                            className="max-w-xs truncate"
                            title={payment.description || undefined}
                          >
                            {payment.description || '—'}
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--state-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                              {payment.method === 'CASH' ? (
                                <Banknote className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <CreditCard className="w-3 h-3 text-blue-500" />
                              )}
                              {t(`payments.method.${payment.method || 'CASH'}`)}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  payment.status === 'PAID'
                                    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
                                    : payment.status === 'PENDING'
                                    ? 'bg-amber-500'
                                    : payment.status === 'OVERDUE'
                                    ? 'bg-rose-500 animate-pulse'
                                    : 'bg-gray-400'
                                }`}
                              />
                              <GlassSelect
                                className="w-28 !py-1 text-xs"
                                value={payment.status}
                                onChange={(e) =>
                                  handleUpdateStatus(
                                    payment.id,
                                    e.target.value as PaymentStatus,
                                  )
                                }
                                aria-label={t('payments.updateStatusFor', {
                                  name: formatStudentName(payment.student),
                                })}
                                disabled={isUpdatingStatus}
                              >
                                {PAYMENT_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {t(`payments.status.${status}`)}
                                  </option>
                                ))}
                              </GlassSelect>
                              {isUpdatingStatus && (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {t('payments.saving')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-semibold text-[var(--text-primary)]">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td>
                            <div className="flex justify-end">
                              <GlassButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setReceiptTarget(payment)}
                                title={t('payments.receipt')}
                                aria-label={t('payments.receipt')}
                              >
                                <Receipt className="w-3.5 h-3.5 mr-1" />
                                <span>{t('payments.receipt')}</span>
                              </GlassButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

        {/* Record payment modal */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={t('payments.form.title')}
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('payments.form.student')} required error={formErrors.studentId ? t(formErrors.studentId) : undefined}>
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={
                    formErrors.studentId ? 'student-error' : undefined
                  }
                >
                  <option value="">{t('payments.form.selectStudent')}</option>
                  {studentList.map((student) => (
                    <option key={student.id} value={student.id}>
                      {formatStudentName(student)}
                    </option>
                  ))}
                </GlassSelect>
                {formErrors.studentId && (
                  <span
                    id="student-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {t(formErrors.studentId)}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('payments.form.amount')} required error={formErrors.amount ? t(formErrors.amount) : undefined}>
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={handleFormChange('amount')}
                  required
                  aria-invalid={Boolean(formErrors.amount)}
                  aria-describedby={
                    formErrors.amount ? 'amount-error' : undefined
                  }
                  placeholder="299.99"
                />
                {formErrors.amount && (
                  <span id="amount-error" className="mt-1 text-sm text-red-600">
                    {t(formErrors.amount)}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('payments.form.method')}>
                <GlassSelect
                  value={form.method}
                  onChange={handleFormChange('method')}
                  aria-label={t('payments.form.method')}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {t(`payments.method.${method}`)}
                    </option>
                  ))}
                </GlassSelect>
              </GlassField>

              <GlassField label={t('payments.form.dueDate')}>
                <GlassInput
                  type="date"
                  value={form.dueDate}
                  onChange={handleFormChange('dueDate')}
                />
              </GlassField>
            </div>

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
                disabled={create.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={create.isPending}
              >
                {create.isPending ? t('payments.saving') : t('payments.add')}
              </GlassButton>
            </div>
          </form>
        </GlassModal>

        {/* Official Payment Receipt Modal */}
        <GlassModal
          open={receiptTarget !== null}
          onClose={() => setReceiptTarget(null)}
          title={t('payments.receipt')}
          wide
        >
          {receiptTarget && (
            <div className="space-y-6 pt-1">
              <div
                id="medu-printable-receipt"
                className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] space-y-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b pb-4 border-[var(--border-subtle)]">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-black text-sm">
                        M
                      </div>
                      <h3 className="font-bold text-lg text-[var(--text-primary)]">M-EDU ACADEMY</h3>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Official Tuition & Educational Services Receipt</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-[var(--state-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                      RCP-{receiptTarget.id.slice(0, 8).toUpperCase()}
                    </span>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">{formatDate(receiptTarget.createdAt)}</p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('payments.form.student')}</span>
                    <p className="font-semibold text-[var(--text-primary)] mt-0.5">{formatStudentName(receiptTarget.student)}</p>
                    {receiptTarget.student?.user?.email && (
                      <p className="text-xs text-[var(--text-muted)]">{receiptTarget.student.user.email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('common.status')}</span>
                    <div className="mt-0.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        receiptTarget.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : receiptTarget.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : receiptTarget.status === 'OVERDUE'
                          ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                      }`}>
                        {formatPaymentStatus(receiptTarget.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Item description & Amount Box */}
                <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex justify-between items-center text-sm border-b pb-2 border-[var(--border-subtle)]">
                    <span className="font-medium text-[var(--text-secondary)]">{t('common.description')}</span>
                    <span className="font-medium text-[var(--text-secondary)]">{t('payments.col.amount')}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-[var(--text-primary)]">{receiptTarget.description || 'Course Tuition & Materials'}</span>
                    <span className="font-bold text-[var(--text-primary)]">{formatCurrency(receiptTarget.amount)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--border-subtle)]">
                    <div>
                      <span className="text-xs text-[var(--text-muted)]">{t('payments.form.method')}: </span>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{t(`payments.method.${receiptTarget.method || 'CASH'}`)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-[var(--text-muted)] mr-2">Total:</span>
                      <span className="text-lg font-black text-emerald-600">{formatCurrency(receiptTarget.amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Verification footer */}
                <div className="pt-2 flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Verified Digital Payment · M-EDU Education Management System</span>
                  </div>
                  <span className="font-mono">ID: {receiptTarget.id.slice(0, 12)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setReceiptTarget(null)}
                >
                  {t('common.close')}
                </GlassButton>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={() => window.print()}
                >
                  <Printer className="w-4 h-4 mr-1.5" />
                  Print Receipt
                </GlassButton>
              </div>
            </div>
          )}
        </GlassModal>

        {toastNode}
      </div>
    </div>
  );
}