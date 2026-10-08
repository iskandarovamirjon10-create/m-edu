import { useState, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';
import type { MonthlyRevenue } from '@/lib/types';
import type { Period } from './RevenueChart';

const LazyRevenueChart = lazy(() => import('./RevenueChart'));

const PERIOD_OPTIONS: Period[] = ['7D', '30D', '90D', '1Y'];

interface RevenueSectionProps {
  initialData: MonthlyRevenue[];
}

export function RevenueSection({ initialData }: RevenueSectionProps) {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('1Y');

  const { data: revenueData, isFetching } = useQuery({
    queryKey: ['dashboard', 'revenue', period],
    queryFn: () => dashboardApi.revenue(period),
    staleTime: 30_000,
    initialData: period === '1Y' ? initialData : undefined,
  });

  const chartData = revenueData?.length ? revenueData : (period === '1Y' ? initialData : []);

  return (
    <div className="flex flex-col justify-between rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {t('dashboard.monthlyRevenue') || 'Revenue Overview'}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {t('dashboard.paymentCollection') || 'Cash collected and processed inflows'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector tabs */}
          <div
            className="inline-flex rounded-xl bg-[var(--bg-surface)] p-1 border border-[var(--border-subtle)]"
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
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold tracking-tight transition-all ${
                    active
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

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
