/**
 * M-EDU Forecasting Page
 * Predictive enrollment modeling, revenue forecasting, and retention projection.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type SVGProps,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar } from '@/stores/ui.store';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { forecastingApi } from '@/lib/api';
import { usePrefersReducedMotion, cn } from '@/lib/design';

/* ============================================================================
 * MOTION TOKENS ( Physics)
 * ========================================================================== */

const SPRING_PHYSICS = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },
  gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================== */

export interface ForecastPoint {
  period: string; // YYYY-MM
  value: number;
  lowerBound: number;
  upperBound: number;
  method: 'MOVING_AVG' | 'LINEAR' | 'SEASONAL_NAIVE';
}

export interface ForecastSeries {
  metric: string;
  description: string;
  history: ForecastPoint[];
  forecast: ForecastPoint[];
  confidence: number; // 0..1
}

export interface ForecastSummary {
  series: number;
  projectedRevenue: number;
  projectedEnrollments: number;
}

export interface ForecastListResponse {
  items: ForecastSeries[];
}

/* ============================================================================
 * PURE EXPORTED HELPERS (Zero Dependencies, Fully Testable)
 * ========================================================================== */

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% Confidence`;
}

export function getConfidenceBadgeTone(confidence: number): 'emerald' | 'blue' | 'amber' | 'rose' {
  if (confidence >= 0.85) return 'emerald';
  if (confidence >= 0.7) return 'blue';
  if (confidence >= 0.5) return 'amber';
  return 'rose';
}

export const METHOD_STYLE: Record<ForecastPoint['method'], { bg: string; text: string; border: string }> = {
  MOVING_AVG: { bg: 'bg-neutral-500/10', text: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-500/20' },
  LINEAR: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  SEASONAL_NAIVE: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
};

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const ICONS = {
  trendingUp: [
    'M23 6l-9.5 9.5-5-5L1 18',
    'M17 6h6v6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
  search: [
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ],
  barChart: [
    'M12 20V10',
    'M18 20V4',
    'M6 20v-4',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.8,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * AURORA MESH BACKGROUND (Atmospheric Canvas)
 * ========================================================================== */

function AuroraMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-cyan-500/12 via-blue-500/8 to-transparent blur-[120px] dark:from-cyan-600/16 dark:via-blue-600/10" />
      <div className="absolute -right-[10%] top-[30%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-indigo-500/12 via-purple-500/8 to-transparent blur-[120px] dark:from-indigo-600/16 dark:via-purple-600/10" />
      <div className="absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-emerald-500/10 via-teal-500/6 to-transparent blur-[110px] dark:from-emerald-600/14" />
    </div>
  );
}

/* ============================================================================
 * COUNT UP COMPONENT
 * ========================================================================== */

function CountUp({
  value,
  duration = 0.85,
  suffix = '',
  isCurrency = false,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  isCurrency?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums font-semibold">
      {isCurrency ? `$${Math.round(display).toLocaleString()}` : Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function ForecastingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-36 w-full rounded-3xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-28 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-64 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function ForecastingPage() {
  const { t } = useSafeI18n();
  const { playTick, playPop } = usePremiumSound();
  usePageTitle(t('forecasting.pageTitle') || 'Predictive Forecasting');

  const reduced = usePrefersReducedMotion();
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  /* ── Queries ── */
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

  /* ── Filtered Series ── */
  const filteredSeries = useMemo(() => {
    let list = series;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.metric.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [series, searchQuery]);

  /* ── Open Sidecar Detail Inspector ── */
  const handleOpenForecastSidecar = useCallback(
    (s: ForecastSeries) => {
      playPop();
      const lastPoint = s.forecast[s.forecast.length - 1] || s.history[s.history.length - 1];
      const tone = getConfidenceBadgeTone(s.confidence);

      openSidecar({
        id: 'forecast-' + s.metric,
        type: 'general',
        title: s.metric,
        subtitle: s.description || 'Predictive Extrapolation Model',
        badge: {
          text: formatConfidence(s.confidence),
          tone,
        },
        avatar: {
          text: s.metric.slice(0, 2).toUpperCase(),
          color: '#6366F1',
        },
        metrics: [
          {
            label: 'Confidence',
            value: `${Math.round(s.confidence * 100)}%`,
          },
          {
            label: 'Projected Value',
            value: lastPoint ? lastPoint.value.toLocaleString() : '—',
          },
          {
            label: 'Lower Bound',
            value: lastPoint ? lastPoint.lowerBound.toLocaleString() : '—',
          },
          {
            label: 'Upper Bound',
            value: lastPoint ? lastPoint.upperBound.toLocaleString() : '—',
          },
        ],
        details: [
          {
            label: 'Metric Key',
            value: s.metric,
          },
          {
            label: 'Model Details',
            value: s.description || 'Standard regression extrapolation',
          },
          {
            label: 'Historical Data Points',
            value: `${s.history.length} periods`,
          },
          {
            label: 'Forecast Data Points',
            value: `${s.forecast.length} periods`,
          },
        ],
        actions: [
          {
            label: t('common.close') || 'Close',
            variant: 'secondary',
            onClick: () => {},
          },
        ],
      });
    },
    [t, playPop]
  );

  /* ── Keyboard Shortcuts (J / K, R to refresh, Enter to inspect) ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      if (isInput) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev + 1 < filteredSeries.length ? prev + 1 : 0));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredSeries.length - 1));
      } else if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        seriesQuery.refetch();
        summaryQuery.refetch();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSeries[focusedIndex]) {
          handleOpenForecastSidecar(filteredSeries[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSeries, focusedIndex, handleOpenForecastSidecar, playTick, playPop, seriesQuery, summaryQuery]);

  /* ── Loading State ── */
  if (seriesQuery.isLoading && !series.length) {
    return (
      <div className="relative min-h-full px-4 py-8 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-7xl">
          <ForecastingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-4 py-6 sm:px-6 lg:px-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* ====================================================================
         * 1. HERO HEADER
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-cyan-600/15 text-cyan-600 shadow-inner ring-1 ring-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-400">
                <Icon paths={ICONS.trendingUp} size={28} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-600 ring-1 ring-cyan-500/25 dark:text-cyan-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    {summary?.series ?? series.length} Models Active
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-500/20 dark:text-neutral-300">
                    Confidence Bounds Computed
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  {t('forecasting.pageTitle') || 'Predictive Forecasting'}
                </h1>
                <p className="max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('forecasting.subtitle') ||
                    'Machine learning-driven trend extrapolation, seasonal naive modeling, and capacity projections.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  void seriesQuery.refetch();
                  void summaryQuery.refetch();
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-black/[0.08] bg-white/50 px-4 py-2 text-xs font-semibold text-neutral-700 shadow-sm transition-all hover:bg-white/80 active:scale-95 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-neutral-300"
              >
                <Icon paths={ICONS.refresh} size={15} />
                <span>{t('common.refresh') || 'Refresh'}</span>
                <kbd className="hidden rounded bg-neutral-200/70 px-1.5 py-0.5 text-[10px] font-mono sm:inline-block dark:bg-neutral-800">
                  R
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 2. INTERACTIVE COUNT-UP KPI TILES
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {/* Active Series Tile */}
          <div className="liquid-glass-card flex min-h-[44px] flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('forecasting.seriesTracked') || 'Active Metrics'}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Icon paths={ICONS.barChart} size={18} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={summary?.series ?? 0} />
            </div>
          </div>

          {/* Projected Revenue Tile */}
          <div className="liquid-glass-card flex min-h-[44px] flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('forecasting.projectedRevenue') || 'Projected Revenue'}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon paths={ICONS.wallet} size={18} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              <CountUp value={summary?.projectedRevenue ?? 0} isCurrency />
            </div>
          </div>

          {/* Projected Students Tile */}
          <div className="liquid-glass-card flex min-h-[44px] flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('forecasting.projectedEnrollments') || 'Projected Students'}
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Icon paths={ICONS.users} size={18} />
              </div>
            </div>
            <div className="mt-4 text-3xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
              <CountUp value={summary?.projectedEnrollments ?? 0} />
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 3. FORECASTING METHODS INTELLIGENCE CARD
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card p-6">
          <div className="flex items-center gap-2 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Icon paths={ICONS.sparkles} size={15} />
            </div>
            <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              {t('forecasting.methodsTitle') || 'Forecasting Models & Extrapolation Mechanics'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('forecasting.method.movingAvg') || 'Moving Average'}
              </strong>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                {t('forecasting.method.movingAvgDesc') || 'Weighted recent period baseline with rolling inertia filters.'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('forecasting.method.linearTrend') || 'Linear Trend'}
              </strong>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                {t('forecasting.method.linearTrendDesc') || 'Ordinary least squares projection across chronological windows.'}
              </p>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('forecasting.method.seasonalNaive') || 'Seasonal Pattern'}
              </strong>
              <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                {t('forecasting.method.seasonalNaiveDesc') || 'Cycle-aware historical repetition calibrated for academic semesters.'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 4. SERIES VISUALIZATION FEED
         * ================================================================== */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="relative max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
              <Icon paths={ICONS.search} size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder={`${t('common.search') || 'Search models'}...`}
              className="min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white/60 pl-9 pr-3 text-xs font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>

          <AnimatePresence mode="wait">
            {filteredSeries.length === 0 ? (
              <motion.div
                key="empty-series"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="liquid-glass-card flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500 ring-1 ring-cyan-500/25">
                  <Icon paths={ICONS.barChart} size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {t('forecasting.emptyTitle') || 'No Forecast Series Available'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  {t('forecasting.emptyMessage') || 'Additional historical data points are required to generate forecasts.'}
                </p>
              </motion.div>
            ) : (
              filteredSeries.map((s, idx) => {
                const isFocused = focusedIndex === idx;
                const allPoints = [...s.history, ...s.forecast];
                const maxVal = Math.max(...allPoints.map((x) => x.upperBound), 1);
                const tone = getConfidenceBadgeTone(s.confidence);

                return (
                  <motion.div
                    key={s.metric}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={SPRING_PHYSICS.smooth}
                    onClick={() => handleOpenForecastSidecar(s)}
                    className={cn(
                      'liquid-glass-card group relative min-h-[44px] cursor-pointer overflow-hidden p-6 transition-all hover:shadow-xl',
                      isFocused && 'ring-2 ring-cyan-500/50 bg-cyan-500/[0.04]'
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-base font-bold tracking-tight text-neutral-900 dark:text-white">
                          {s.metric}
                        </h3>
                        <p className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          {s.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded-xl px-3 py-1 text-xs font-bold ring-1',
                            tone === 'emerald'
                              ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400'
                              : 'bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:text-blue-400'
                          )}
                        >
                          {formatConfidence(s.confidence)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenForecastSidecar(s);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-cyan-600 hover:bg-cyan-500/10 transition-colors"
                          title="Inspect details"
                        >
                          <Icon paths={ICONS.eye} size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Chart Visualization */}
                    <div className="mt-6 flex h-36 items-end gap-1.5 rounded-2xl border border-black/[0.06] bg-white/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.02]">
                      {allPoints.map((p, i) => {
                        const h = Math.max((p.value / maxVal) * 100, 4);
                        const isForecast = i >= s.history.length;

                        return (
                          <div
                            key={p.period}
                            className="group/bar relative flex flex-1 flex-col items-center justify-end h-full min-w-[10px]"
                            title={`${p.period}: ${p.value.toLocaleString()} (${p.lowerBound}–${p.upperBound})`}
                          >
                            <div className="pointer-events-none absolute -top-8 z-20 whitespace-nowrap rounded-lg bg-black/80 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover/bar:opacity-100">
                              {p.period}: {p.value}
                            </div>

                            <div
                              className={cn(
                                'w-full rounded-full transition-all duration-500',
                                isForecast
                                  ? 'bg-gradient-to-t from-cyan-600 to-blue-500 shadow-sm'
                                  : 'bg-gradient-to-t from-emerald-600 to-teal-400'
                              )}
                              style={{ height: `${h}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Forecast Points Chips */}
                    <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                        Predictions:
                      </span>
                      {s.forecast.map((p) => {
                        const style = METHOD_STYLE[p.method];
                        return (
                          <span
                            key={p.period}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                              style.bg,
                              style.text,
                              style.border
                            )}
                          >
                            {p.period}: {p.value.toLocaleString()}
                          </span>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default ForecastingPage;
