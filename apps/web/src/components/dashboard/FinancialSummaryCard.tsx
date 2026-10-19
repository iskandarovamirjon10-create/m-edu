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
    <div className="relative overflow-hidden rounded-2xl border border-subtle/80 bg-card/85 backdrop-blur-xl p-5 shadow-card before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent dark:before:via-white/10 sm:p-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {/* Left: Indicator & Paid Info */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-apple-green/10 text-apple-green ring-1 ring-apple-green/20">
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

          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-gradient-to-r from-apple-blue to-apple-green transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(0, paidShare))}%` }}
            />
          </div>
        </div>

        {/* Right: Overdue & Pending Pills */}
        <div className="flex w-full items-center justify-between gap-4 rounded-xl border border-subtle bg-surface/70 p-3 sm:w-auto sm:justify-start sm:gap-6 backdrop-blur-sm">
          <div className="min-w-0 flex-1 sm:flex-initial">
            <p className="text-[10px] font-bold uppercase tracking-wider text-tertiary">
              {t('dashboard.overdue') || 'Overdue'}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-apple-red tabular-nums" title={formatCurrency(totalOverdue)}>
              {formatCurrency(totalOverdue)}
            </p>
          </div>

          <div className="h-7 w-px shrink-0 bg-subtle" />

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
