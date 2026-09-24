import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { paymentsApi, studentsApi } from '@/lib/api';
import {
  PageHeader,
  PageLoader,
  ErrorState,
  EmptyState,
  Pagination,
  TextInput,
  Select,
  Field,
  Modal,
  GlassButton,
  useToasts,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Payment, Student, PaymentStatus, PaymentMethod } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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
    queryKey: ['payments', params],
    queryFn: () => paymentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const students = useQuery({
    queryKey: ['students-payments'],
    queryFn: () => studentsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const data = payments.data as Paginated<Payment> | undefined;
  const paymentList = useMemo(() => data?.items || [], [data]);
  const studentList = useMemo(
    () => (students.data as Paginated<Student> | undefined)?.items || [],
    [students.data],
  );

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
      qc.invalidateQueries({ queryKey: ['payments'] });
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
      qc.invalidateQueries({ queryKey: ['payments'] });
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
          <PageHeader
            title={t('payments.title')}
            subtitle={t('payments.subtitle')}
          />
          <div className="glass-card p-8">
            <PageLoader label={t('payments.loading')} />
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
          <PageHeader
            title={t('payments.title')}
            subtitle={t('payments.subtitle')}
          />
          <div className="glass-card p-8">
            <ErrorState
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
        <PageHeader
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
              <TextInput
                placeholder={t('payments.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('payments.searchPlaceholder')}
                type="search"
              />
              <Select
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
              </Select>
            </div>
            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-muted)' }}>
              {totalPayments} {totalPayments === 1 ? t('payments.countOne') : t('payments.countMany')}
            </div>
          </div>
        </div>

        {/* Payments table */}
        <div className="glass-card">
          {paymentList.length === 0 ? (
            <EmptyState
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
                      <th>{t('payments.col.status')}</th>
                      <th style={{ textAlign: 'right' }}>{t('payments.col.amount')}</th>
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
                            <div className="flex items-center gap-2">
                              <Select
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
                              </Select>
                              {isUpdatingStatus && (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {t('payments.saving')}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }} className="font-semibold">
                            {formatCurrency(payment.amount)}
                          </td>
                        </tr>
                      );
                    })}
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

        {/* Record payment modal */}
        <Modal
          open={modalOpen}
          onClose={handleCloseModal}
          title={t('payments.form.title')}
          wide
        >
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t('payments.form.student')} required error={formErrors.studentId ? t(formErrors.studentId) : undefined}>
                <Select
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
                </Select>
                {formErrors.studentId && (
                  <span
                    id="student-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {t(formErrors.studentId)}
                  </span>
                )}
              </Field>

              <Field label={t('payments.form.amount')} required error={formErrors.amount ? t(formErrors.amount) : undefined}>
                <TextInput
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
              </Field>

              <Field label={t('payments.form.method')}>
                <Select
                  value={form.method}
                  onChange={handleFormChange('method')}
                  aria-label={t('payments.form.method')}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {t(`payments.method.${method}`)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('payments.form.dueDate')}>
                <TextInput
                  type="date"
                  value={form.dueDate}
                  onChange={handleFormChange('dueDate')}
                />
              </Field>
            </div>

            <Field label={t('common.description')}>
              <TextInput
                value={form.description}
                onChange={handleFormChange('description')}
                placeholder={t('common.optionalDescription')}
              />
            </Field>

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
        </Modal>

        {toastNode}
      </div>
    </div>
  );
}