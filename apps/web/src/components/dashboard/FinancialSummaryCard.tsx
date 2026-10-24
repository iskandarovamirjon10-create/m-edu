import { formatCurrency } from '@/lib/format';
import { useI18n } from '@/i18n/I18nProvider';

interface FinancialSummaryCardProps {
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  paidShare: number;
}

export function FinancialSummaryCard({
  totalPaid,
  totalPending,
  totalOverdue,
  paidShare,
}: FinancialSummaryCardProps) {
  const { t } = useI18n();

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/75 backdrop-blur-3xl backdrop-saturate-[200%] p-5 sm:p-6 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)] dark:border-white/[0.12] dark:bg-[#161618]/75 dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent dark:before:via-white/20">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Left: Indicator & Paid Info */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-apple-green/10 text-apple-green ring-1 ring-apple-green/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-tertiary">
              {t('dashboard.collectionRate') || 'Collection Efficiency'}
            </p>
            <p className="text-base font-bold text-primary">
              {formatCurrency(totalPaid)}{' '}
              <span className="text-xs font-medium text-tertiary">
                {t('dashboard.paid') || 'settled'}
              </span>
            </p>
          </div>
        </div>

        {/* Center: Progress Bar */}
        <div className="w-full flex-1 md:max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-medium text-secondary">
              {t('dashboard.collectionRate') || 'Collection progress'}
            </span>
            <span className="font-bold text-primary tabular-nums">
              {paidShare}%
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08] p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-apple-blue to-apple-green shadow-xs transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, paidShare))}%` }}
            />
          </div>
        </div>

        {/* Right: Overdue & Pending Pills */}
        <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-black/[0.05] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.03] p-3 sm:w-auto sm:justify-start sm:gap-6 backdrop-blur-md">
          <div className="min-w-0 flex-1 sm:flex-initial">
            <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary">
              {t('dashboard.overdue') || 'Overdue'}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-apple-red tabular-nums" title={formatCurrency(totalOverdue)}>
              {formatCurrency(totalOverdue)}
            </p>
          </div>

          <div className="h-7 w-px shrink-0 bg-black/[0.08] dark:bg-white/[0.1]" />

          <div className="min-w-0 flex-1 sm:flex-initial">
            <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary">
              {t('dashboard.pending') || 'Pending'}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-apple-orange tabular-nums" title={formatCurrency(totalPending)}>
              {formatCurrency(totalPending)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
