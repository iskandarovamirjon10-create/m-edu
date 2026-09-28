/**
 * InvoicesPage — Ultra Premium Apple-Style Financial Dashboard
 * Features fluid typography, deep frosted glass modules, macOS-style
 * segmented controls, and high-end squircle data grids for billing.
 */
import { formatDate } from '../lib/format';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, studentsApi } from '@/lib/api';
import { GlassPageHeader, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassModal, GlassInput, GlassTextArea, GlassSelect, GlassField, GlassButton, useToast, GlassTabs } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import type { Invoice, InvoicePayment, InvoiceRefund } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys.factory';
import { Printer } from 'lucide-react';

// Shared invoice/payment status label keys (PAID/OVERDUE/… reuse payments.*).
const INVOICE_STATUS_KEYS: Record<string, string> = {
  DRAFT: 'invoices.status.DRAFT',
  ISSUED: 'invoices.status.ISSUED',
  PARTIALLY_PAID: 'invoices.status.PARTIALLY_PAID',
  REFUNDED: 'invoices.status.REFUNDED',
  PENDING: 'payments.status.PENDING',
  PAID: 'payments.status.PAID',
  OVERDUE: 'payments.status.OVERDUE',
  CANCELLED: 'payments.status.CANCELLED',
  SUCCEEDED: 'payments.status.PAID',
};

function invoiceStatusKey(status: string): string {
  return INVOICE_STATUS_KEYS[status] ?? status;
}

// Premium Apple-style configuration for invoice statuses
function getInvoiceStatusConfig(status: string) {
  switch (status) {
    case 'PAID':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' };
    case 'PARTIALLY_PAID':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/20', dot: 'bg-amber-500' };
    case 'OVERDUE':
      return { bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-500/20', dot: 'bg-rose-500 animate-pulse' };
    case 'ISSUED':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600', border: 'border-blue-500/20', dot: 'bg-blue-500' };
    case 'REFUNDED':
      return { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/20', dot: 'bg-purple-500' };
    case 'DRAFT':
    case 'CANCELLED':
    default:
      return { bg: 'bg-[var(--state-hover)]', text: 'text-[var(--text-secondary)]', border: 'border-[var(--border-subtle)]/50', dot: 'bg-gray-400' };
  }
}

interface PaymentFormState {
  amount: string;
  method: string;
  reference: string;
  description: string;
}

interface RefundFormState {
  paymentId: string;
  amount: string;
  reason: string;
}

const EMPTY_PAYMENT: PaymentFormState = { amount: '', method: 'CASH', reference: '', description: '' };
const EMPTY_REFUND: RefundFormState = { paymentId: '', amount: '', reason: '' };

const FILTER_TABS = ['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

export function InvoicesPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.invoices'));
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT);
  const [refundForm, setRefundForm] = useState<RefundFormState>(EMPTY_REFUND);
  const [issueTarget, setIssueTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [createForm, setCreateForm] = useState<any>({ description: '', unitPrice: '' });
  const [createErrors, setCreateErrors] = useState<any>({});

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
  };

  const invoiceDetail = useQuery({
    queryKey: ['invoice-detail', refundTarget?.id],
    queryFn: () => (refundTarget ? (invoicesApi.get(refundTarget.id) as Promise<any>) : null),
    enabled: !!refundTarget,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 100 }),
  });

  const createInvoice = useMutation({
    mutationFn: (data: any) => invoicesApi.create(data),
    onSuccess: () => {
      push('success', t('invoices.createSuccess'));
      setCreateOpen(false);
      invalidateAll();
    },
    onError: (err: any) => setCreateErrors({ _error: getErrorMessage(err) }),
  });

  const processRefund = useMutation({
    mutationFn: (id: string) => invoicesApi.processRefund(id),
    onSuccess: () => {
      push('success', 'Refund processed');
      setRefundTarget(null);
      invalidateAll();
    },
  });

  const rejectRefund = useMutation({
    mutationFn: (data: { id: string; reason: string }) => invoicesApi.rejectRefund(data.id, data.reason),
    onSuccess: () => {
      push('success', 'Refund rejected');
      setRejectTarget(null);
      invalidateAll();
    },
  });

  const requestRefund = useMutation({
    mutationFn: (data: any) => invoicesApi.requestRefund(data),
    onSuccess: () => {
      push('success', 'Refund requested');
      setRefundTarget(null);
      invalidateAll();
    },
  });

  const issue = useMutation({
    mutationFn: (id: string) => invoicesApi.issue(id),
    onSuccess: () => {
      push('success', 'Invoice issued');
      setIssueTarget(null);
      invalidateAll();
    },
  });

  const invoices = useQuery({
    queryKey: queryKeys.invoices.list({ status: statusFilter || undefined, limit: 100 }),
    queryFn: () => invoicesApi.list({ status: statusFilter || undefined, limit: 100 }) as Promise<any>,
  });

  const remaining = (inv: Invoice) => {
    if (typeof (inv as any).remaining === 'number') return (inv as any).remaining;
    const total = Number(inv.total) || 0;
    const paid = Number((inv as any).paidAmount) || 0;
    const refunded = Number((inv as any).refundedAmount) || 0;
    return Math.max(0, total - paid + refunded);
  };

  const recordPayment = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: PaymentFormState }) =>
      invoicesApi.recordPayment(invoiceId, data),
    onSuccess: () => {
      push('success', t('invoices.paymentSuccess'));
      setPayTarget(null);
      setPaymentForm(EMPTY_PAYMENT);
      invalidateAll();
    },
    onError: (error: any) => {
      push('error', getErrorMessage(error));
    },
  });

  if (invoices.isLoading) {
    return <GlassPageLoader />;
  }

  if (invoices.isError) {
    return <GlassErrorState message="Error loading invoices" onRetry={() => invoices.refetch()} />;
  }

  return (
    <div className="space-y-6 pb-24">
      <GlassPageHeader
        title={t('nav.invoices')}
        description={t('invoices.subtitle')}
        action={{
          label: t('invoices.createDraft'),
          onClick: () => setCreateOpen(true),
        }}
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[2rem] glass-card">
        <GlassTabs
          active={statusFilter}
          onChange={setStatusFilter}
          tabs={FILTER_TABS.map((opt) => ({
            id: opt,
            label: opt === '' ? t('invoices.allTab') : t(invoiceStatusKey(opt)),
          }))}
        />
      </div>

      <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
        <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-hidden />

        {invoices.data && (invoices.data as any).items?.length > 0 ? (
          <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
            <GlassTable>
              <GlassTHead>
                <GlassTR>
                  <GlassTH>{t('invoices.col.details')}</GlassTH>
                  <GlassTH>{t('invoices.col.student')}</GlassTH>
                  <GlassTH>{t('common.status')}</GlassTH>
                  <GlassTH className="text-right">{t('invoices.col.totalPaid')}</GlassTH>
                  <GlassTH className="text-right">{t('invoices.col.balanceDue')}</GlassTH>
                  <GlassTH className="text-right">{t('common.actions')}</GlassTH>
                </GlassTR>
              </GlassTHead>
              <GlassTBody>
                {(invoices.data as any).items.map((inv: any) => {
                  const statusConfig = getInvoiceStatusConfig(inv.status);
                  const studentName = inv.student?.user
                    ? `${inv.student.user.firstName} ${inv.student.user.lastName}`
                    : inv.studentId?.slice(0, 8);
                  const bal = remaining(inv);
                  return (
                    <GlassTR key={inv.id}>
                      <GlassTD>
                        <div className="font-medium text-[var(--text-primary)]">
                          {inv.number || inv.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {inv.issueDate}
                        </div>
                      </GlassTD>
                      <GlassTD>{studentName}</GlassTD>
                      <GlassTD>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                          {t(invoiceStatusKey(inv.status))}
                        </span>
                      </GlassTD>
                      <GlassTD className="text-right font-medium">{formatCurrency(Number(inv.paidAmount || 0))}</GlassTD>
                      <GlassTD className="text-right font-medium text-rose-500">{formatCurrency(bal)}</GlassTD>
                      <GlassTD className="text-right">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          {inv.status === 'DRAFT' && (
                            <GlassButton type="button" variant="primary" size="sm" onClick={() => setIssueTarget(inv)}>
                              {t('invoices.confirmIssue')}
                            </GlassButton>
                          )}
                          {inv.status !== 'DRAFT' && bal > 0 && (
                            <GlassButton type="button" variant="secondary" size="sm" onClick={() => setPayTarget(inv)}>
                              {t('invoices.recordPayment')}
                            </GlassButton>
                          )}
                          {Number(inv.paidAmount || 0) > 0 && (
                            <GlassButton type="button" variant="ghost" size="sm" onClick={() => setRefundTarget(inv)}>
                              {t('invoices.recordRefund')}
                            </GlassButton>
                          )}
                          <GlassButton type="button" variant="ghost" size="sm" onClick={() => setPreviewTarget(inv)} title="Preview / Print">
                            <Printer className="w-3.5 h-3.5 mr-1" />
                            <span>{t('invoices.preview') || 'Preview'}</span>
                          </GlassButton>
                        </div>
                      </GlassTD>
                    </GlassTR>
                  );
                })}
              </GlassTBody>
            </GlassTable>
          </div>
        ) : (
          <div className="p-16 flex items-center justify-center">
            <GlassEmptyState
              title={t('invoices.emptyTitle')}
              message={statusFilter ? t('invoices.emptyFiltered') : t('invoices.emptyHint')}
              action={{ label: t('invoices.createDraft'), onClick: () => setCreateOpen(true) }}
            />
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {/* Record Payment Modal */}
      <GlassModal open={payTarget !== null} onClose={() => setPayTarget(null)} title={t('invoices.recordPayment')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!payTarget) return;
            const amount = Number(paymentForm.amount);
            if (!amount || amount <= 0) {
              push('error', t('invoices.amountPositive'));
              return;
            }
            if (amount > remaining(payTarget)) {
              push('error', t('invoices.amountExceeds'));
              return;
            }
            recordPayment.mutate({ invoiceId: payTarget.id, data: paymentForm });
          }}
          className="space-y-6 pt-2 animate-in fade-in duration-300"
          noValidate
        >
          <div className="flex items-center justify-between p-4 rounded-[1.25rem] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <div>
              <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">{t('invoices.invoiceLabel')}</p>
              <p className="text-[1rem] font-bold font-mono text-[var(--text-primary)]">{payTarget?.number}</p>
            </div>
            <div className="text-right">
              <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">{t('invoices.col.balanceDue')}</p>
              <p className="text-[1.25rem] font-black text-rose-600 ">{payTarget ? formatCurrency(remaining(payTarget)) : ''}</p>
            </div>
          </div>

          <GlassField label={t('invoices.paymentAmount')} required>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[1.1rem] font-bold text-emerald-600 ">$</span>
              <GlassInput
                type="number"
                min="0.01"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="pl-8 font-mono text-[1.05rem] font-bold text-emerald-600 "
                autoFocus
              />
            </div>
          </GlassField>

          <div className="grid grid-cols-2 gap-5">
            <GlassField label={t('invoices.paymentMethod')}>
              <GlassSelect value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                <option value="CASH">{t('payments.method.CASH')}</option>
                <option value="CARD">{t('payments.method.CARD')}</option>
                <option value="BANK_TRANSFER">{t('payments.method.BANK_TRANSFER')}</option>
                <option value="PAYME">{t('payments.method.PAYME')}</option>
                <option value="CLICK">{t('payments.method.CLICK')}</option>
                <option value="UZUM">{t('payments.method.UZUM')}</option>
                <option value="OTHER">{t('payments.method.OTHER')}</option>
              </GlassSelect>
            </GlassField>
            <GlassField label={t('invoices.referenceId')} hint={t('invoices.referenceHint')}>
              <GlassInput value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} placeholder={t('invoices.referencePlaceholder')} />
            </GlassField>
          </div>

          <GlassField label={t('invoices.notesLabel')} hint={t('invoices.notesHint')}>
            <GlassTextArea rows={2} value={paymentForm.description} onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })} placeholder={t('invoices.notesPlaceholder')} />
          </GlassField>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <GlassButton type="button" variant="secondary" onClick={() => setPayTarget(null)}>{t('common.cancel')}</GlassButton>
            <GlassButton type="submit" variant="primary" loading={recordPayment.isPending} disabled={recordPayment.isPending}>
              {recordPayment.isPending ? t('invoices.processing') : t('invoices.confirmPayment')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Issue Confirmation Modal */}
      <GlassModal open={issueTarget !== null} onClose={() => setIssueTarget(null)} title={t('invoices.issueTitle')}>
        <div className="pt-2 animate-in fade-in duration-300">
          <div className="p-4 rounded-[1.25rem] bg-blue-500/10 border border-blue-500/20 text-[0.85rem] font-medium text-blue-700 ">
            {t('invoices.issueBody', { number: issueTarget?.number ?? '' })}
          </div>
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <GlassButton type="button" variant="secondary" onClick={() => setIssueTarget(null)}>{t('common.cancel')}</GlassButton>
            <GlassButton type="button" variant="primary" loading={issue.isPending} disabled={issue.isPending} onClick={() => issueTarget && issue.mutate(issueTarget.id)}>
              {issue.isPending ? t('invoices.issuing') : t('invoices.confirmIssue')}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Refund Modal */}
      <GlassModal open={refundTarget !== null} onClose={() => { setRefundTarget(null); setRefundForm(EMPTY_REFUND); }} title={t('invoices.refundTitle')} wide>
        {invoiceDetail.isLoading ? (
          <div className="py-8"><GlassPageLoader label={t('invoices.loadingDetails')} /></div>
        ) : invoiceDetail.isError ? (
          <GlassErrorState message={getErrorMessage(invoiceDetail.error)} onRetry={() => invoiceDetail.refetch()} />
        ) : invoiceDetail.data ? (
          <div className="space-y-6 pt-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between p-4 rounded-[1.25rem] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div>
                <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">{t('invoices.invoiceLabel')}</p>
                <p className="text-[1rem] font-bold font-mono text-[var(--text-primary)]">{(invoiceDetail.data as any).number}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-0.5">{t('invoices.refundable')}</p>
                <p className="text-[1.25rem] font-black text-rose-600 ">
                  {formatCurrency(Math.max(0, Number((invoiceDetail.data as any).paidAmount || 0) - Number((invoiceDetail.data as any).refundedAmount ?? 0)))}
                </p>
              </div>
            </div>

            {/* Payments selection */}
            <GlassField label={t('invoices.paymentLabel')} required hint={t('invoices.paymentSelectHint')}>
              {(invoiceDetail.data as any).payments && (invoiceDetail.data as any).payments.length > 0 ? (
                <div className="space-y-2">
                  {(invoiceDetail.data as any).payments.map((p: InvoicePayment) => (
                    <label key={p.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-all ${refundForm.paymentId === p.id ? 'border-rose-500 bg-rose-500/10' : 'border-[var(--border-subtle)] hover:bg-[var(--state-hover)]'}`}>
                      <span className="flex items-center gap-3 min-w-0">
                        <input
                          type="radio"
                          name="refund-payment"
                          value={p.id}
                          checked={refundForm.paymentId === p.id}
                          onChange={() => setRefundForm({ ...refundForm, paymentId: p.id, amount: '' })}
                          className="accent-rose-500 shrink-0"
                        />
                        <span className="text-[0.85rem] font-bold text-[var(--text-primary)] truncate">
                          {formatCurrency(Number(p.amount))} · {t(`payments.method.${p.method ?? 'CARD'}`)} {p.receiptNumber ? `· ${p.receiptNumber}` : ''}
                        </span>
                      </span>
                      <span className={`text-[0.65rem] font-black uppercase tracking-wider shrink-0 ${p.status === 'SUCCEEDED' || p.status === 'PAID' ? 'text-emerald-600' : 'text-[var(--text-muted)]'}`}>
                        {t(invoiceStatusKey(p.status))}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-[0.85rem] text-[var(--text-muted)]">{t('invoices.noPayments')}</p>
              )}
            </GlassField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <GlassField label={t('invoices.refundAmount')} required>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[1.1rem] font-bold text-rose-600">$</span>
                  <GlassInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                    className="pl-8 font-mono text-[1.05rem] font-bold text-rose-600 "
                    placeholder="0.00"
                    autoFocus={(invoiceDetail.data as any).payments?.length === 0 ? false : undefined}
                  />
                </div>
              </GlassField>
              <GlassField label={t('invoices.reason')} hint={t('invoices.reasonHint')}>
                <GlassInput value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} placeholder={t('invoices.reasonPlaceholder')} />
              </GlassField>
            </div>

            {/* Pending / processed refunds */}
            {(invoiceDetail.data as any).refunds && (invoiceDetail.data as any).refunds.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('invoices.refundHistory')}</p>
                {(invoiceDetail.data as any).refunds.map((r: InvoiceRefund) => (
                  <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-[0.95rem] text-[var(--text-primary)] font-mono">{formatCurrency(Number(r.amount))}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[0.6rem] font-black uppercase tracking-wider border ${r.status === 'PROCESSED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : r.status === 'REQUESTED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-[var(--state-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]'}`}>
                          {t(`invoices.refundStatus.${r.status}`)}
                        </span>
                      </div>
                      {r.reason && <p className="text-[0.8rem] text-[var(--text-muted)] mt-1 truncate">{r.reason}</p>}
                      <p className="text-[0.7rem] text-[var(--text-muted)] mt-0.5">
                        {t('invoices.requested', { date: r.requestedAt ? formatDate(r.requestedAt) : '' })}
                        {r.processedAt ? t('invoices.processed', { date: formatDate(r.processedAt) }) : ''}
                      </p>
                    </div>
                    {r.status === 'REQUESTED' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <GlassButton type="button" variant="primary" size="sm" onClick={() => processRefund.mutate(r.id)} disabled={processRefund.isPending} loading={processRefund.isPending}>
                          {t('invoices.process')}
                        </GlassButton>
                        <GlassButton type="button" variant="ghost" size="sm" onClick={() => { setRejectTarget(r); setRejectReason(''); }}>
                          {t('invoices.reject')}
                        </GlassButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => { setRefundTarget(null); setRefundForm(EMPTY_REFUND); }}
              >
                {t('common.close')}
              </GlassButton>
              <GlassButton
                type="button"
                variant="danger"
                disabled={!refundForm.paymentId || !Number(refundForm.amount) || Number(refundForm.amount) <= 0 || requestRefund.isPending}
                loading={requestRefund.isPending}
                onClick={() => requestRefund.mutate({ ...refundForm, amount: Number(refundForm.amount) })}
              >
                {requestRefund.isPending ? t('invoices.requesting') : t('invoices.requestRefund')}
              </GlassButton>
            </div>
          </div>
        ) : null}
      </GlassModal>

      {/* Reject Refund Modal */}
      <GlassModal open={rejectTarget !== null} onClose={() => setRejectTarget(null)} title={t('invoices.rejectRefundTitle')}>
        <div className="space-y-5 pt-2 animate-in fade-in duration-300">
          <div className="p-4 rounded-[1.25rem] bg-amber-500/10 border border-amber-500/20 text-[0.85rem] font-medium text-amber-700 ">
            {t('invoices.rejectBody', { amount: rejectTarget ? formatCurrency(Number(rejectTarget.amount)) : '' })}
          </div>
          <GlassField label={t('invoices.reason')} hint={t('common.optional')}>
            <GlassTextArea rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('invoices.rejectReasonPlaceholder')} />
          </GlassField>
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <GlassButton type="button" variant="secondary" onClick={() => setRejectTarget(null)}>{t('common.cancel')}</GlassButton>
            <GlassButton
              type="button"
              variant="danger"
              disabled={rejectRefund.isPending}
              loading={rejectRefund.isPending}
              onClick={() => rejectTarget && rejectRefund.mutate({ id: rejectTarget.id, reason: rejectReason })}
            >
              {rejectRefund.isPending ? t('invoices.rejecting') : t('invoices.confirmReject')}
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* Create Invoice Modal */}
      <GlassModal open={createOpen} onClose={() => setCreateOpen(false)} title={t('invoices.createTitle')} wide>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!createForm.studentId || !createForm.number || !Number(createForm.unitPrice)) {
              push('error', t('invoices.createValidation'));
              return;
            }
            const newCreateErrors: { dueDate?: string } = {};
            if (createForm.dueDate && new Date(createForm.dueDate) < new Date(new Date().toDateString())) {
              newCreateErrors.dueDate = t('payments.validation.dueDatePast');
            }
            setCreateErrors(newCreateErrors);
            if (Object.keys(newCreateErrors).length === 0) {
              createInvoice.mutate(createForm);
            }
          }}
          className="space-y-6 pt-2 animate-in fade-in duration-300"
          noValidate
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <GlassField label={t('payments.form.student')} required>
                <GlassSelect value={createForm.studentId} onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })} autoFocus>
                  <option value="">{t('payments.form.selectStudent')}</option>
                  {(((students.data as any)?.items) ?? []).map((st: any) => (
                    <option key={st.id} value={st.id}>{st.user?.firstName} {st.user?.lastName}</option>
                  ))}
                </GlassSelect>
              </GlassField>
            </div>

            <GlassField label={t('invoices.numberLabel')} required>
              <GlassInput value={createForm.number} onChange={(e) => setCreateForm({ ...createForm, number: e.target.value })} placeholder="INV-2026-000123" className="font-mono text-sm" />
            </GlassField>

            <GlassField label={t('payments.form.dueDate')} error={createErrors.dueDate}>
              <GlassInput type="date" value={createForm.dueDate} onChange={(e) => { setCreateForm({ ...createForm, dueDate: e.target.value }); setCreateErrors({}); }} className={`cursor-pointer ${createErrors.dueDate ? 'border-rose-500' : ''}`} />
              {createErrors.dueDate && <span className="text-[0.75rem] font-bold text-rose-500 mt-1">{createErrors.dueDate}</span>}
            </GlassField>

            <div className="md:col-span-2">
              <GlassField label={t('common.description')} required>
                <GlassInput value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder={t('invoices.descriptionPlaceholder')} />
              </GlassField>
            </div>

            <div className="md:col-span-2">
              <GlassField label={t('invoices.total')} required>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[1.1rem] font-bold text-[var(--text-muted)]">$</span>
                  <GlassInput type="number" min="0.01" step="0.01" value={createForm.unitPrice} onChange={(e) => setCreateForm({ ...createForm, unitPrice: e.target.value })} placeholder="0.00" className="pl-8 font-mono text-[1.05rem] font-bold" />
                </div>
              </GlassField>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
            <GlassButton type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={createInvoice.isPending}>
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" loading={createInvoice.isPending} disabled={createInvoice.isPending}>
              {createInvoice.isPending ? t('invoices.creating') : t('invoices.createDraft')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* Invoice Preview & Print Modal */}
      <GlassModal
        open={previewTarget !== null}
        onClose={() => setPreviewTarget(null)}
        title={t('invoices.preview') || 'Invoice Preview'}
        wide
      >
        {previewTarget && (
          <div className="space-y-6 pt-2">
            <div
              id="medu-printable-invoice"
              className="p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] space-y-6"
            >
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b pb-6 border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-black text-base shadow-sm">
                      M
                    </div>
                    <div>
                      <h2 className="font-extrabold text-xl text-[var(--text-primary)] tracking-tight">M-EDU ACADEMY</h2>
                      <p className="text-xs text-[var(--text-muted)]">Official Tuition & Billing Document</p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] uppercase">INVOICE</h1>
                  <p className="font-mono text-sm font-semibold text-[var(--text-secondary)] mt-0.5">#{previewTarget.number || previewTarget.id.slice(0, 8)}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-2 rounded-full text-xs font-bold ${getInvoiceStatusConfig(previewTarget.status).bg} ${getInvoiceStatusConfig(previewTarget.status).text}`}>
                    {t(invoiceStatusKey(previewTarget.status))}
                  </span>
                </div>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Billed To</p>
                  <p className="font-bold text-[var(--text-primary)] mt-1">
                    {previewTarget.student?.user
                      ? `${previewTarget.student.user.firstName} ${previewTarget.student.user.lastName}`
                      : previewTarget.studentId || '—'}
                  </p>
                  {previewTarget.student?.user?.email && (
                    <p className="text-xs text-[var(--text-muted)]">{previewTarget.student.user.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Issue Date</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">
                    {previewTarget.issueDate ? formatDate(previewTarget.issueDate) : formatDate(previewTarget.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Due Date</p>
                  <p className="font-medium text-[var(--text-primary)] mt-1">
                    {previewTarget.dueDate ? formatDate(previewTarget.dueDate) : 'On Receipt'}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--state-hover)] text-xs font-bold uppercase text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="py-3 px-4 text-left">Description</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    <tr>
                      <td className="py-3 px-4 text-[var(--text-primary)]">
                        {previewTarget.notes || (previewTarget as any).description || 'Educational Tuition & Course Services'}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-[var(--text-primary)]">
                        {formatCurrency(Number(previewTarget.total || previewTarget.subtotal || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="w-72 space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Subtotal</span>
                    <span className="font-medium text-[var(--text-primary)]">
                      {formatCurrency(Number(previewTarget.subtotal || previewTarget.total || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-secondary)]">Paid Amount</span>
                    <span className="font-medium text-emerald-600">
                      {formatCurrency(Number(previewTarget.paidAmount || 0))}
                    </span>
                  </div>
                  {Number(previewTarget.refundedAmount || 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)]">Refunded</span>
                      <span className="font-medium text-rose-500">
                        {formatCurrency(Number(previewTarget.refundedAmount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-base font-bold">
                    <span className="text-[var(--text-primary)]">Balance Due</span>
                    <span className="text-rose-600 font-black">
                      {formatCurrency(remaining(previewTarget))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer Notes */}
              <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs text-[var(--text-muted)]">
                <div>
                  <p className="font-semibold text-[var(--text-secondary)]">Payment Instructions</p>
                  <p>Please include invoice number #{previewTarget.number || previewTarget.id.slice(0, 8)} on all transfers.</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-[var(--text-secondary)]">M-EDU Learning Systems</p>
                  <p>Thank you for choosing M-EDU Education.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <GlassButton type="button" variant="secondary" onClick={() => setPreviewTarget(null)}>
                {t('common.close')}
              </GlassButton>
              <GlassButton type="button" variant="primary" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-1.5" />
                Print Invoice
              </GlassButton>
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
}

export default InvoicesPage;