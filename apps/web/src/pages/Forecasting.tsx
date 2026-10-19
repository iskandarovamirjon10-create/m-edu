/**
 * M-EDU ForecastingPage — Apple Design Award Edition
 *
 * Predictive Analytics & Enrollment Forecasting with fluid spring motion,
 * multi-layer glass cards, interactive chart visualizations, and Apple HIG typography.
 */

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GlassPageHeader,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { useEffect } from 'react';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';
import { forecastingApi } from '@/lib/api';

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

interface ForecastPoint {
  period: string; // YYYY-MM
  value: number;
  lowerBound: number;
  upperBound: number;
  method: 'MOVING_AVG' | 'LINEAR' | 'SEASONAL_NAIVE';
}

interface ForecastSeries {
  metric: string;
  description: string;
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  confidence: number; // 0..1
}

interface ForecastSummary {
  series: number;
  projectedRevenue: number;
  projectedEnrollments: number;
}

interface ForecastListResponse {
  items: ForecastSeries[];
}

const METHOD_COLOR: Record<ForecastPoint['method'], 'slate' | 'blue' | 'green'> = {
  MOVING_AVG: 'slate',
  LINEAR: 'blue',
  SEASONAL_NAIVE: 'green',
};

function handleOpenForecastSidecar(s: ForecastSeries) {
  const lastPoint = s.forecast[s.forecast.length - 1] || s.history[s.history.length - 1];
  const sidecarData: QuickLookData = {
    id: 'forecast-' + s.metric,
    type: 'general',
    title: s.metric,
    subtitle: s.description || 'Bashorat modeli',
    badge: {
      text: `${Math.round(s.confidence * 100)}% Ishonch`,
      tone: s.confidence >= 0.8 ? 'emerald' : s.confidence >= 0.6 ? 'blue' : 'amber',
    },
    avatar: {
      text: s.metric.slice(0, 2).toUpperCase(),
      color: '#6366F1',
    },
    metrics: [
      { label: 'Ishonchlilik', value: `${Math.round(s.confidence * 100)}%` },
      { label: 'Oxirgi prognoz', value: lastPoint ? lastPoint.value.toLocaleString() : '—' },
      { label: 'Quyi chegara', value: lastPoint ? lastPoint.lowerBound.toLocaleString() : '—' },
      { label: 'Yuqori chegara', value: lastPoint ? lastPoint.upperBound.toLocaleString() : '—' },
    ],
    details: [
      { label: 'Metrika', value: s.metric },
      { label: 'Model tavsifi', value: s.description || 'Izohsiz' },
      { label: 'Tarixiy nuqtalar', value: `${s.history.length} ta davr` },
      { label: 'Prognoz nuqtalari', value: `${s.forecast.length} ta davr` },
    ],
  };
  openSidecar(sidecarData);
}

export function ForecastingPage() {
  const { t } = useI18n();
  const { playPop } = usePremiumSound();
  usePageTitle(t('forecasting.pageTitle') || 'Predictive Forecasting');

  const summaryQuery = useQuery({
    queryKey: ['forecast-summary'],
    queryFn: () => forecastingApi.summary() as Promise<ForecastSummary>,
  });

  const seriesQuery = useQuery({
    queryKey: ['forecast'],
    queryFn: () => forecastingApi.list() as Promise<ForecastListResponse>,
  });

  const series: ForecastSeries[] = seriesQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        playPop();
        seriesQuery.refetch();
        summaryQuery.refetch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPop, seriesQuery, summaryQuery]);

  return (
    <div className="relative min-h-screen px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      {/* Ambient specular glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 right-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[100px] dark:bg-cyan-500/15"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-1/3 left-10 h-96 w-96 rounded-full bg-indigo-500/10 blur-[100px] dark:bg-indigo-500/15"
      />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <GlassPageHeader
          title={t('forecasting.pageTitle') || 'Predictive Forecasting'}
          subtitle={t('forecasting.subtitle') || 'Machine learning-driven trend extrapolation & capacity projections'}
        />

        {/* Top KPI Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="liquid-glass-surface group relative overflow-hidden rounded-[1.75rem] p-6 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('forecasting.seriesTracked') || 'Active Metrics'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">
              {summary?.series ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.05 }}
            className="liquid-glass-surface group relative overflow-hidden rounded-[1.75rem] p-6 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('forecasting.projectedRevenue') || 'Projected Revenue'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              ${(summary?.projectedRevenue ?? 0).toLocaleString()}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.1 }}
            className="liquid-glass-surface group relative overflow-hidden rounded-[1.75rem] p-6 transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('forecasting.projectedEnrollments') || 'Projected Students'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-brand-600 dark:text-brand-400">
              {summary?.projectedEnrollments ?? 0}
            </div>
          </motion.div>
        </div>

        {/* Forecasting Methods Guide */}
        <div className="liquid-glass-surface relative overflow-hidden rounded-[1.75rem] p-6">
          <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            {t('forecasting.methodsTitle') || 'Forecasting Models'}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2.5 text-[12.5px] leading-relaxed text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-white/40 p-3 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
              <strong className="text-[var(--text-primary)]">{t('forecasting.method.movingAvg') || 'Moving Average'}</strong>: {t('forecasting.method.movingAvgDesc') || 'Weighted recent period baseline'}
            </div>
            <div className="rounded-xl bg-white/40 p-3 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
              <strong className="text-[var(--text-primary)]">{t('forecasting.method.linearTrend') || 'Linear Trend'}</strong>: {t('forecasting.method.linearTrendDesc') || 'Ordinary least squares projection'}
            </div>
            <div className="rounded-xl bg-white/40 p-3 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
              <strong className="text-[var(--text-primary)]">{t('forecasting.method.seasonalNaive') || 'Seasonal Pattern'}</strong>: {t('forecasting.method.seasonalNaiveDesc') || 'Cycle-aware historical repetition'}
            </div>
          </div>
        </div>

        {/* Series Visualization Feed */}
        <div className="space-y-4">
          {seriesQuery.isLoading ? (
            <div className="rounded-2xl bg-white/55 p-12 ring-1 ring-inset ring-white/60 backdrop-blur-md dark:bg-white/[0.035] dark:ring-white/[0.08]">
              <GlassPageLoader label={t('forecasting.loading') || 'Calculating statistical confidence bounds…'} />
            </div>
          ) : seriesQuery.isError ? (
            <div className="rounded-2xl bg-white/55 p-8 ring-1 ring-inset ring-white/60 backdrop-blur-md dark:bg-white/[0.035] dark:ring-white/[0.08]">
              <GlassErrorState
                message={getErrorMessage(seriesQuery.error)}
                onRetry={() => seriesQuery.refetch()}
              />
            </div>
          ) : series.length === 0 ? (
            <div className="rounded-2xl bg-white/55 p-12 ring-1 ring-inset ring-white/60 backdrop-blur-md dark:bg-white/[0.035] dark:ring-white/[0.08]">
              <GlassEmptyState
                title={t('forecasting.emptyTitle') || 'No Forecast Series Available'}
                message={t('forecasting.emptyMessage') || 'Additional historical data points are required to generate forecasts.'}
              />
            </div>
          ) : (
            series.map((s) => {
              const allPoints = [...s.history, ...s.forecast];
              const maxVal = Math.max(...allPoints.map((x) => x.upperBound), 1);

              return (
                <motion.div
                  key={s.metric}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={SPRING.smooth}
                  className="liquid-glass-card group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:shadow-xl"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                        {s.metric}
                      </h3>
                      <p className="mt-0.5 text-[12.5px] font-medium text-[var(--text-muted)]">
                        {s.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { playPop(); handleOpenForecastSidecar(s); }}
                        title="Split View Sidecar"
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-indigo-600 dark:hover:bg-white/[0.08]"
                      >
                        <span className="text-xs font-mono font-bold">◨</span>
                      </button>
                      <span className="rounded-xl bg-white/60 px-3 py-1 text-[11px] font-bold text-[var(--text-secondary)] ring-1 ring-inset ring-white/60 dark:bg-white/[0.04] dark:ring-white/[0.08]">
                        {t('forecasting.confidence', { n: Math.round(s.confidence * 100) }) || `Confidence: ${Math.round(s.confidence * 100)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Chart Visualization */}
                  <div className="mt-6 flex h-36 items-end gap-1.5 rounded-2xl bg-white/40 p-4 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
                    {allPoints.map((p, i) => {
                      const h = Math.max((p.value / maxVal) * 100, 4);
                      const isForecast = i >= s.history.length;

                      return (
                        <div
                          key={p.period}
                          className="group/bar relative flex flex-1 flex-col items-center justify-end h-full min-w-[10px]"
                          title={`${p.period}: ${p.value.toLocaleString()} (${p.lowerBound}–${p.upperBound})`}
                        >
                          {/* Tooltip on hover */}
                          <div className="pointer-events-none absolute -top-8 z-20 whitespace-nowrap rounded-lg bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover/bar:opacity-100">
                            {p.period}: {p.value}
                          </div>

                          <div
                            className={`w-full rounded-full transition-all duration-500 ${
                              isForecast
                                ? 'bg-gradient-to-t from-blue-600 to-indigo-500 shadow-sm'
                                : 'bg-gradient-to-t from-emerald-600 to-teal-400'
                            }`}
                            style={{ height: `${h}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Forecast Points Chips */}
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="mr-1 font-bold text-[var(--text-muted)] uppercase tracking-wider text-[10px]">
                      Predictions:
                    </span>
                    {s.forecast.map((p) => (
                      <GlassBadge key={p.period} color={METHOD_COLOR[p.method]}>
                        {p.period}: {p.value.toLocaleString()}
                      </GlassBadge>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default ForecastingPage;
