import { Link, useNavigate } from 'react-router-dom';
import { GlassEmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

interface RecentPaymentsProps {
  payments: DashboardStats['recentPayments'];
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

function getStudentName(
  payment: DashboardStats['recentPayments'][number],
  fallback: string,
) {
  const first = payment.student?.user?.firstName;
  const last = payment.student?.user?.lastName;
  return [first, last].filter(Boolean).join(' ').trim() || fallback;
}

export function RecentPayments({ payments }: RecentPaymentsProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            {t('payments.status.PAID') || 'Paid'}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
            {t('payments.status.PENDING') || 'Pending'}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--danger-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--danger)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
            {t(`payments.status.${status}`) || status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-[var(--neutral-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {t('dashboard.recentPayments') || 'Recent Transactions'}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {t('dashboard.paymentCollection') || 'Latest tuition & fee payments'}
          </p>
        </div>

        <Link
          to="/payments"
          className="items-center gap-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:underline inline-flex"
        >
          <span>{t('dashboard.viewPayments') || 'View all'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" /><path d="M7 7h10v10" />
          </svg>
        </Link>
      </div>

      <div className="mt-4 flex-1">
        {!payments?.length ? (
          <div className="py-8">
            <GlassEmptyState
              title={t('dashboard.noPayments') || 'No payments recorded'}
              message={t('dashboard.noPaymentsHint') || 'Payments will appear here once recorded.'}
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            {payments.slice(0, 6).map((payment) => {
              const studentName = getStudentName(payment, t('dashboard.student') || 'Student');
              const studentId = payment.studentId;

              return (
                <div
                  key={payment.id}
                  onClick={() => navigate(studentId ? `/students/${studentId}` : '/payments')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(studentId ? `/students/${studentId}` : '/payments');
                    }
                  }}
                  className="group flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-[var(--bg-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                >
                  {/* Left: Avatar + Student Name + Date */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-xs font-bold text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
                      {getInitials(studentName)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)]">
                        {studentName}
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {formatDate(payment.createdAt)}
                        {payment.method ? ` · ${payment.method}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Amount + Status Badge + Arrow */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-[var(--text-primary)] tabular-nums">
                        {formatCurrency(payment.amount)}
                      </p>
                      <div className="mt-0.5">{statusBadge(payment.status)}</div>
                    </div>

                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="hidden sm:block text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
