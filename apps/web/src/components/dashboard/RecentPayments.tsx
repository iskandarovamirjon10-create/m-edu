import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GlassEmptyState } from '@/components/ui';
import { formatCurrency, formatDate } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

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
  const sound = usePremiumSound();

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-apple-green/10 dark:bg-apple-green/15 px-2 py-0.5 text-[11px] font-semibold text-apple-green">
            <span className="h-1.5 w-1.5 rounded-full bg-apple-green" />
            {t('payments.status.PAID') || 'Paid'}
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-apple-orange/10 dark:bg-apple-orange/15 px-2 py-0.5 text-[11px] font-semibold text-apple-orange">
            <span className="h-1.5 w-1.5 rounded-full bg-apple-orange" />
            {t('payments.status.PENDING') || 'Pending'}
          </span>
        );
      case 'FAILED':
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-apple-red/10 dark:bg-apple-red/15 px-2 py-0.5 text-[11px] font-semibold text-apple-red">
            <span className="h-1.5 w-1.5 rounded-full bg-apple-red" />
            {t(`payments.status.${status}`) || status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold text-secondary">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="relative overflow-hidden flex flex-col justify-between rounded-[2rem] border border-white/60 bg-white/75 backdrop-blur-3xl backdrop-saturate-[200%] p-5 sm:p-6 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)] dark:border-white/[0.12] dark:bg-[#161618]/75 dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent dark:before:via-white/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-primary">
            {t('dashboard.recentPayments') || 'Recent Transactions'}
          </h2>
          <p className="text-xs text-secondary">
            {t('dashboard.paymentCollection') || 'Latest tuition & fee payments'}
          </p>
        </div>

        <Link
          to="/payments"
          className="items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline inline-flex"
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
          <div className="divide-y divide-black/[0.04] dark:divide-white/[0.06] overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02]">
            {payments.slice(0, 6).map((payment) => {
              const studentName = getStudentName(payment, t('dashboard.student') || 'Student');
              const studentId = payment.studentId;

              return (
                <motion.div
                  key={payment.id}
                  whileHover={{ scale: 1.008, x: 2 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  onClick={() => {
                    sound.playPop?.();
                    navigate(studentId ? `/students/${studentId}` : '/payments');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      sound.playPop?.();
                      navigate(studentId ? `/students/${studentId}` : '/payments');
                    }
                  }}
                  className="group flex cursor-pointer items-center justify-between gap-3 p-3 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {/* Left: Avatar + Student Name + Date */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-apple-blue/10 dark:bg-apple-blue/20 text-xs font-bold text-apple-blue ring-1 ring-apple-blue/20">
                      {getInitials(studentName)}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-primary group-hover:text-apple-blue transition-colors">
                        {studentName}
                      </p>
                      <p className="truncate text-[11px] text-tertiary">
                        {formatDate(payment.createdAt)}
                        {payment.method ? ` · ${payment.method}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Right: Amount + Status Badge + Arrow */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-bold text-primary tabular-nums">
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
                      className="hidden sm:block text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-apple-blue"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
