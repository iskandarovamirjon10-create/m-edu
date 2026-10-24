/**
 * AiDebtorsCard — Interactive Liquid Glass Overdue Payments & Debtors Widget.
 *
 * Responsibilities:
 *   - Visualizes real debtor data from `finance.debtors` tool.
 *   - Displays total debtors count, outstanding balance formatted in UZS.
 *   - Lists top overdue invoices with student names and remaining debts.
 *   - Direct deep-link navigation to `/payments`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, AlertTriangle, ArrowUpRight, AlertCircle, User } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiDebtorsData } from '@/types/ai';

export interface AiDebtorsCardProps {
  data?: AiDebtorsData | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

function formatUzs(amount: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.max(0, amount)) + ' UZS';
}

function formatDueDate(dueDate: string | Date | undefined): string {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return String(dueDate);
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function tr(t: (k: string) => string, key: string, fallback: string): string {
  try {
    const val = t(key);
    return !val || val === key ? fallback : val;
  } catch {
    return fallback;
  }
}

export const AiDebtorsCard = memo(function AiDebtorsCard({
  data,
  loading = false,
  error,
  className,
}: AiDebtorsCardProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Qarzdorlik ma'lumotlari yuklanmoqda"
        className={cn(
          'w-full max-w-md animate-pulse rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black/10 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data || !Array.isArray(data.debtors) || data.debtors.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.debtors.empty', "Qarzdorliklar mavjud emas (barcha hisoblar yopilgan)")}
      </div>
    );
  }

  const { total = 0, outstanding = 0, debtors = [] } = data;

  return (
    <div
      role="region"
      aria-label="AI Qarzdorlik hisoboti"
      data-testid="ai-debtors-card"
      className={cn(
        'relative overflow-hidden w-full max-w-md rounded-2xl border p-4.5',
        'border-black/[0.08] dark:border-white/10',
        'bg-white/85 text-[var(--text-primary)] backdrop-blur-2xl dark:bg-[#1C1C1E]/85',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_32px_-12px_rgba(0,0,0,0.12)]',
        'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-12px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {/* Specular edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF9500]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF9500]/15 to-[#FF9500]/5 text-[#FF9500] border border-[#FF9500]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#FF9500]/20">
            <CreditCard className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.debtors.title', 'Qarzdorliklar Tahlili')}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {tr(t, 'ai.widget.debtors.count', 'Qarzdorlar soni')}:{' '}
              <strong className="text-[var(--text-primary)]">{total}</strong>
            </span>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="flex flex-col items-end">
          <span className="text-[14px] font-bold tabular-nums tracking-tight text-[#FF3B30]">
            {formatUzs(outstanding)}
          </span>
          <span className="text-[10px] font-medium text-[var(--text-muted)]">
            {tr(t, 'ai.widget.debtors.totalDebt', 'Umumiy qarz')}
          </span>
        </div>
      </div>

      {/* Debtors List (Top 5) */}
      <div className="my-2 flex flex-col divide-y divide-black/[0.04] dark:divide-white/[0.06]">
        {debtors.slice(0, 5).map((debtor) => {
          const remaining = Math.max(0, debtor.total - debtor.paidAmount);
          return (
            <div
              key={debtor.id}
              className="flex items-center justify-between py-2 text-xs first:pt-1 last:pb-1 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[var(--text-secondary)] dark:bg-white/[0.06]">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-semibold text-[var(--text-primary)]">
                    {debtor.student || 'Nomaʼlum talaba'}
                  </span>
                  {debtor.dueDate && (
                    <span className="text-[10.5px] font-medium text-[var(--text-muted)]">
                      {tr(t, 'ai.widget.debtors.due', 'Muddat')}: {formatDueDate(debtor.dueDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="font-bold tabular-nums text-[#FF3B30]">
                  {formatUzs(remaining)}
                </span>
                <AlertTriangle className="h-3 w-3 text-[#FF9500]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Link */}
      <div className="mt-1 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/payments"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.debtors.viewAll', 'Toʻlovlar boʻlimiga oʻtish')}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
