/**
 * ============================================================================
 * FinancialSummaryCard v2.0 — Liquid Glass collection efficiency (composed bar)
 * ============================================================================
 * Upgrade:
 *  - Replaces the flat paid/pending pill strip with an animated, weighted
 *    composition bar (paid → pending → overdue) plus a responsive legend.
 *  - Animated counters for the collection rate and every amount.
 *  - Keeps the existing props contract (no page-level changes required).
 *
 * Craft:
 *  - Specular hairline, ambient caustic bloom, 3D jewel icon orb
 *  - Spring-width segments, reduced-motion safe, fully labelled for a11y
 *  - Responsive stack (1 column → 3 columns) down to 320px
 */

import { motion } from 'framer-motion';
import { cn, CountUp, Icon, usePrefersReducedMotion } from '@/lib/design';
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
  const reduced = usePrefersReducedMotion();

  const paid = Math.max(0, Number(totalPaid) || 0);
  const pending = Math.max(0, Number(totalPending) || 0);
  const overdue = Math.max(0, Number(totalOverdue) || 0);
  const total = paid + pending + overdue;
  const rate = Math.min(100, Math.max(0, Math.round(Number(paidShare) || 0)));

  const share = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  const segments = [
    {
      key: 'paid',
      value: paid,
      percent: share(paid),
      gradient: 'linear-gradient(90deg, #34C759 0%, #30D158 100%)',
      dot: '#34C759',
      label: t('dashboard.paid', "To'langan"),
      tone: 'text-[#1E9E4A] dark:text-[#30D158]',
    },
    {
      key: 'pending',
      value: pending,
      percent: share(pending),
      gradient: 'linear-gradient(90deg, #FF9F0A 0%, #FFB340 100%)',
      dot: '#FF9F0A',
      label: t('dashboard.pending', 'Kutilmoqda'),
      tone: 'text-[#C77700] dark:text-[#FFB340]',
    },
    {
      key: 'overdue',
      value: overdue,
      percent: share(overdue),
      gradient: 'linear-gradient(90deg, #FF453A 0%, #FF6961 100%)',
      dot: '#FF453A',
      label: t('dashboard.overdue', "Muddati o'tgan"),
      tone: 'text-[#D70015] dark:text-[#FF6961]',
    },
  ];

  const barLabel = `${t('dashboard.totalBilled', 'Jami hisoblangan')}: ${formatCurrency(total)} — ${segments
    .map((segment) => `${segment.label} ${Math.round(segment.percent)}%`)
    .join(', ')}`;

  return (
    <section
      aria-label={t('dashboard.financialHealth', "Moliyaviy salomatlik")}
      className={cn(
        'relative isolate overflow-hidden rounded-[2rem] p-5 sm:p-6',
        'border border-white/60 bg-white/75 backdrop-blur-3xl backdrop-saturate-[200%]',
        'shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)]',
        'dark:border-white/[0.12] dark:bg-[#161618]/75',
        'dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)]',
      )}
    >
      {/* Ambient caustic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-16 -z-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.18),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(52,199,89,0.2),transparent_70%)]"
      />

      {/* Top specular hairline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <span
            aria-hidden="true"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] text-[#1E9E4A] dark:text-[#30D158]"
            style={{
              background: 'linear-gradient(135deg, rgba(52,199,89,0.22) 0%, rgba(52,199,89,0.08) 100%)',
              border: '1px solid rgba(52,199,89,0.28)',
              boxShadow:
                'inset 0 1.5px 1px rgba(255,255,255,0.8), 0 8px 18px -8px rgba(52,199,89,0.55)',
            }}
          >
            <Icon name="checkCircle" size={20} strokeWidth={2.2} />
          </span>

          <div className="min-w-0">
            <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.09em] text-[var(--text-muted,#8E8E93)]">
              {t('dashboard.financialHealth', "Moliyaviy salomatlik")}
            </p>
            <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-secondary,#515154)] dark:text-[var(--text-secondary,#A1A1A6)]">
              {t('dashboard.totalCollected', "Jami yig'ilgan")}:{' '}
              <span className="font-bold tabular-nums text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                <CountUp value={paid} suffix=" UZS" />
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0">
          <p className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-[var(--text-primary,#1D1D1F)] dark:text-white">
            <CountUp value={rate} suffix="%" />
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--text-muted,#8E8E93)]">
            {t('dashboard.collectionRate', "Yig'ilim darajasi")}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 text-[10.5px] font-semibold">
          <span className="text-[var(--text-muted,#8E8E93)]">
            {t('dashboard.totalBilled', 'Jami hisoblangan')}
          </span>
          <span className="tabular-nums text-[var(--text-secondary,#515154)] dark:text-[var(--text-secondary,#A1A1A6)]">
            <CountUp value={total} suffix=" UZS" />
          </span>
        </div>

        <div
          role="img"
          aria-label={barLabel}
          className="mt-2 flex h-3 w-full gap-[3px] overflow-hidden rounded-full bg-black/[0.055] p-[2px] dark:bg-white/[0.07]"
        >
          {total > 0 ? (
            segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <motion.span
                  key={segment.key}
                  initial={reduced ? false : { width: 0, opacity: 0.4 }}
                  animate={{ width: `${segment.percent}%`, opacity: 1 }}
                  transition={{
                    duration: reduced ? 0 : 0.9,
                    delay: reduced ? 0 : 0.12,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  style={{
                    background: segment.gradient,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 8px -2px ${segment.dot}66`,
                  }}
                  className="h-full rounded-full"
                />
              ))
          ) : (
            <span className="h-full w-full rounded-full bg-black/[0.08] dark:bg-white/[0.1]" />
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {segments.map((segment) => (
            <div
              key={segment.key}
              className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.05] bg-black/[0.02] px-2.5 py-2 dark:border-white/[0.07] dark:bg-white/[0.03]"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.dot }}
                />
                <span className="truncate text-[10.5px] font-semibold text-[var(--text-muted,#8E8E93)]">
                  {segment.label}
                </span>
              </span>
              <span
                className={cn('shrink-0 text-[11px] font-bold tabular-nums', segment.tone)}
                title={formatCurrency(segment.value)}
              >
                <CountUp value={segment.value} suffix=" UZS" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
