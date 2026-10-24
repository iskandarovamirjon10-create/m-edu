import { useState, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion, LayoutGroup } from 'framer-motion';
import { cn } from '@/lib/design';
import { dashboardApi } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import type { MonthlyRevenue } from '@/lib/types';
import type { Period } from './RevenueChart';

const LazyRevenueChart = lazy(() => import('./RevenueChart'));

const PERIOD_OPTIONS: Period[] = ['7D', '30D', '90D', '1Y'];

interface RevenueSectionProps {
  initialData: MonthlyRevenue[];
}

export function RevenueSection({ initialData }: RevenueSectionProps) {
  const { t } = useI18n();
  const sound = usePremiumSound();
  const [period, setPeriod] = useState<Period>('1Y');

  const { data: revenueData, isFetching } = useQuery({
    queryKey: ['dashboard', 'revenue', period],
    queryFn: () => dashboardApi.revenue(period),
    staleTime: 30_000,
    initialData: period === '1Y' ? initialData : undefined,
  });

  const chartData = revenueData?.length ? revenueData : (period === '1Y' ? initialData : []);

  return (
    <div className="relative overflow-hidden flex flex-col justify-between rounded-[2rem] border border-white/60 bg-white/75 backdrop-blur-3xl backdrop-saturate-[200%] p-5 sm:p-6 shadow-[0_20px_50px_-16px_rgba(0,0,0,0.08),inset_0_1.5px_1.5px_rgba(255,255,255,0.9)] dark:border-white/[0.12] dark:bg-[#161618]/75 dark:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.18)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent dark:before:via-white/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-primary">
            {t('dashboard.monthlyRevenue') || 'Revenue Overview'}
          </h2>
          <p className="text-xs text-secondary">
            {t('dashboard.paymentCollection') || 'Cash collected and processed inflows'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector tabs with macOS Segmented Control feel */}
          <LayoutGroup id="revenue-period-control">
            <div
              className="relative inline-flex items-center rounded-2xl bg-black/[0.04] p-1 border border-black/[0.05] dark:bg-white/[0.06] dark:border-white/[0.08] backdrop-blur-md"
              role="tablist"
              aria-label="Revenue chart period"
            >
              {PERIOD_OPTIONS.map((p) => {
                const active = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      sound.playTick?.();
                      setPeriod(p);
                    }}
                    className={cn(
                      'relative z-10 rounded-xl px-2.5 py-1 text-xs font-semibold tracking-tight transition-colors duration-200',
                      active
                        ? 'text-primary'
                        : 'text-tertiary hover:text-primary'
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="revenue-period-active"
                        className="absolute inset-0 rounded-xl bg-card shadow-xs border border-black/[0.04] dark:border-white/[0.08]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10">{p}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>

          <Link
            to="/payments"
            className="hidden items-center gap-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:underline sm:inline-flex"
          >
            <span>{t('dashboard.viewPayments') || 'View all'}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7" /><path d="M7 7h10v10" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="relative mt-2 min-h-[280px]">
        {isFetching && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-full bg-[var(--bg-card)]/80 px-2 py-0.5 text-[10px] text-[var(--text-muted)] shadow backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-ping" />
            <span>Updating...</span>
          </div>
        )}

        <Suspense
          fallback={
            <div className="flex h-[280px] w-full items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-[var(--primary)]/20 border-t-[var(--primary)] animate-spin" />
            </div>
          }
        >
          <LazyRevenueChart data={chartData} period={period} />
        </Suspense>
      </div>
    </div>
  );
}
