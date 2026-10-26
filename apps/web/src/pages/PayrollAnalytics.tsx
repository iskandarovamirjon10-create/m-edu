/**
 * M-EDU PayrollAnalyticsPage — 
 *
 * Module Features:
 *  - Hero header with gradient analytics icon + live chip
 *  - Premium segmented tab control with layoutId indicator
 *  - Animated stat tiles with count-up + tone colors
 *  - Premium SVG charts (gradient area + animated path draw + dots)
 *  - Month-range selector as premium pill control
 *  - Premium tables with squircle leading icons
 *  - Custom SVG icons in SVG Icons
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n preserved
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassEmptyState,
  GlassErrorState,
  GlassTabs,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { analyticsApi } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { getErrorMessage } from '@/lib/errorMessages';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  chart: [
    'M3 3v18h18',
    'M7 15l3-4 4 3 4-6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  trending: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  trendingDown: ['M23 18l-9.5-9.5-5 5L1 6', 'M17 18h6v-6'],
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  cash: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 7v10',
    'M9 9.5C9 8.1 10.3 7 12 7s3 1.1 3 2.5S13.7 12 12 12s-3 1.1-3 2.5S10.3 17 12 17s3-1.1 3-2.5',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  percent: [
    'M19 5 5 19',
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  check: ['M20 6 9 17l-5-5'],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
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
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:   { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
};

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

export const TABS = ['summary', 'by-teacher', 'trend', 'ratio', 'efficiency'] as const;
export type Tab = (typeof TABS)[number];

const STATUS_TONE: Record<string, Tone> = {
  PAID: 'green',
  APPROVED: 'blue',
  REVIEWED: 'orange',
  CALCULATED: 'purple',
  DRAFT: 'purple',
  CANCELLED: 'red',
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RANGE_OPTIONS = [3, 6, 12] as const;

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('uz-UZ', {
    style: 'currency',
    currency: 'UZS',
    maximumFractionDigits: 0,
  }).format(v ?? 0);
}

function formatMonth(label: string, short = false): string {
  const parts = label.split('-');
  if (parts.length === 2) {
    const m = MONTHS_SHORT[parseInt(parts[1], 10) - 1] || label;
    return short ? m : `${m} ${parts[0]}`;
  }
  return label;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function AnalyticsSkeleton({ blocks = 4 }: { blocks?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: blocks }).map((_, i) => (
          <Shimmer key={i} className="h-[88px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-64 w-full" radius="1.5rem" />
      <Shimmer className="h-40 w-full" radius="1.5rem" />
    </div>
  );
}

/** Count-up hook-based component */
function CountUp({
  value,
  duration = 1.1,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString('uz-UZ');
  return (
    <span className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
}

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  format = 'number',
  secondary,
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: Tone;
  format?: 'number' | 'currency' | 'string';
  secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
        />
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="truncate text-[20px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? (
            format === 'currency' ? (
              <span className="tabular-nums">{formatCurrency(value)}</span>
            ) : (
              <CountUp value={value} />
            )
          ) : (
            value
          )}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#86868B]/80">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Premium range selector pills (3/6/12 months) */
function RangeSelector({
  value,
  onChange,
  t,
}: {
  value: number;
  onChange: (v: number) => void;
  t: (k: string) => string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
      role="radiogroup"
      aria-label={t('payrollAnalytics.months')}
    >
      {RANGE_OPTIONS.map((m) => {
        const active = value === m;
        return (
          <motion.button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="relative overflow-hidden rounded-xl px-3.5 py-1.5 text-[12.5px] font-bold tabular-nums tracking-tight outline-none transition-colors"
            style={{
              color: active ? '#007AFF' : '#86868B',
            }}
          >
            {active && (
              <motion.span
                layoutId="range-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(0,122,255,0.14) 0%, rgba(0,122,255,0.08) 100%)',
                  border: '1px solid rgba(0,122,255,0.3)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px rgba(0,122,255,0.4)',
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative">
              {m} {t('payrollAnalytics.months')}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Premium chart panel — gradient area + animated path */
function ChartPanel({
  points,
  color,
  gradientId,
  height = 200,
  width = 640,
  formatLabel,
  yFormat,
}: {
  points: { x: number; y: number; label: string; val: number }[];
  color: string;
  gradientId: string;
  height?: number;
  width?: number;
  formatLabel: (label: string) => string;
  yFormat?: (val: number) => string;
}) {
  if (points.length === 0) return null;

  const w = width;
  const h = height;

  // Build smooth path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX = p0.x + (p1.x - p0.x) / 2;
    pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  const areaD = `${pathD} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />
      <svg
        viewBox={`0 0 ${w} ${h + 28}`}
        className="relative w-full h-auto overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1="0"
            x2={w}
            y1={h * r}
            y2={h * r}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeDasharray="3 4"
          />
        ))}

        {/* Area */}
        <motion.path
          d={areaD}
          fill={`url(#${gradientId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />

        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />

        {/* Dots */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...SPRING.snappy, delay: 0.4 + i * 0.05 }}
            style={{ transformOrigin: `${p.x}px ${p.y}px` }}
          />
        ))}

        {/* Value labels above dots */}
        {yFormat &&
          points.map((p, i) => (
            <motion.text
              key={`val-${i}`}
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={color}
              initial={{ opacity: 0, y: p.y - 4 }}
              animate={{ opacity: 1, y: p.y - 12 }}
              transition={{ ...SPRING.smooth, delay: 0.5 + i * 0.05 }}
            >
              {yFormat(p.val)}
            </motion.text>
          ))}

        {/* X-axis labels */}
        {points.map((p, i) => (
          <text
            key={`lbl-${i}`}
            x={p.x}
            y={h + 20}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#86868B"
          >
            {formatLabel(p.label)}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Premium status chip row */
function StatusChips({ statuses }: { statuses: Record<string, number> }) {
  const entries = Object.entries(statuses || {});
  if (entries.length === 0) return <span className="text-[11px] text-[#86868B]">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([s, c]) => {
        const tone = STATUS_TONE[s] ?? 'purple';
        const cc = TONES[tone];
        return (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              background: cc.bg,
              color: cc.fg,
              border: `1px solid ${cc.border}`,
            }}
          >
            {s}
            <span className="tabular-nums opacity-70">·</span>
            <span className="tabular-nums">{c}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * TAB: SUMMARY
 * ========================================================================== */

function SummaryTab({ t }: { t: (k: string) => string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payroll-summary'],
    queryFn: () => analyticsApi.payrollSummary() as Promise<any>,
  });

  if (isLoading) return <AnalyticsSkeleton blocks={4} />;
  if (isError)
    return (
      <div className="p-8">
        <GlassErrorState
          title={t('common.error')}
          message={getErrorMessage(error)}
          onRetry={refetch}
        />
      </div>
    );

  if (data?.status === 'INSUFFICIENT_DATA') {
    return (
      <motion.div variants={cardVariants}>
        <div className="rounded-3xl border border-dashed border-[#00000015] p-10 text-center dark:border-[#ffffff15]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF]">
            <Icon paths={I.chart} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('payrollAnalytics.insufficientData')}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] font-medium text-[#86868B]">
            {data.message}
          </p>
        </div>
      </motion.div>
    );
  }

  const paidCount = data?.paidCount ?? 0;
  const totalCount = data?.totalCount ?? 0;
  const completionRate = totalCount ? Math.round((paidCount / totalCount) * 100) : 0;

  return (
    <motion.div variants={containerVariants} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label={t('payrollAnalytics.totalPayroll')}
          value={data?.totalPayroll ?? 0}
          icon={I.wallet}
          tone="blue"
          format="currency"
        />
        <KpiTile
          label={t('payrollAnalytics.paidPayroll')}
          value={data?.paidPayroll ?? 0}
          icon={I.cash}
          tone="green"
          format="currency"
        />
        <KpiTile
          label={t('payrollAnalytics.avgPerTeacher')}
          value={data?.averagePerTeacher ?? 0}
          icon={I.users}
          tone="purple"
          format="currency"
        />
        <KpiTile
          label={t('payrollAnalytics.totalLessons')}
          value={data?.totalLessons ?? 0}
          icon={I.book}
          tone="orange"
        />
      </div>

      {/* Completion panel */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {/* Teachers */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #AF52DE 0%, #FF2D55 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(175,82,222,0.5)',
              }}
            >
              <Icon paths={I.users} size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                {t('payrollAnalytics.teachersCount')}
              </p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tighter tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                <CountUp value={data?.teacherCount ?? 0} />
              </p>
            </div>
          </div>

          {/* Paid / total */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #34C759 0%, #32ADE6 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(52,199,89,0.5)',
              }}
            >
              <Icon paths={I.check} size={18} strokeWidth={2.4} />
            </div>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                {t('payrollAnalytics.paidCount')}
              </p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tighter tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                <CountUp value={paidCount} />
                <span className="ml-1 text-[15px] font-semibold text-[#86868B]">
                  / {totalCount}
                </span>
              </p>
            </div>
          </div>

          {/* Completion rate */}
          <div className="flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,122,255,0.5)',
              }}
            >
              <Icon paths={I.percent} size={18} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                {t('payrollAnalytics.completionRate')}
              </p>
              <p className="mt-0.5 text-[22px] font-bold tracking-tighter tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                <CountUp value={completionRate} suffix="%" />
              </p>
              {/* Progress bar */}
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #007AFF 0%, #34C759 100%)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: BY TEACHER
 * ========================================================================== */

function handleOpenTeacherPayrollAnalyticsSidecar(row: any) {
  const sidecarData: QuickLookData = {
    id: row.teacherId || row.name || 'teacher-analytics',
    type: 'teacher',
    title: row.name || 'O\'qituvchi',
    subtitle: `${row.totalLessons ?? 0} ta dars o'tildi · ${row.runs ?? 0} ta hisoblash`,
    badge: {
      text: 'FAOL',
      tone: 'emerald',
    },
    avatar: {
      text: (row.name || 'OQ').slice(0, 2).toUpperCase(),
      color: '#007AFF',
    },
    metrics: [
      { label: 'Jami to\'langan', value: formatCurrency(row.totalNet ?? 0) },
      { label: 'Brut summa', value: formatCurrency(row.totalGross ?? 0) },
      { label: 'O\'tilgan darslar', value: `${row.totalLessons ?? 0} ta` },
      { label: 'Hisoblashlar', value: `${row.runs ?? 0} ta` },
    ],
    details: [
      { label: 'O\'qituvchi', value: row.name || '—' },
      { label: 'Jami to\'lov', value: formatCurrency(row.totalNet ?? 0) },
      { label: 'Jami brut', value: formatCurrency(row.totalGross ?? 0) },
      { label: 'Darslar', value: `${row.totalLessons ?? 0} ta` },
    ],
  };
  openSidecar(sidecarData);
}

function ByTeacherTab({ t }: { t: (k: string) => string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payroll-by-teacher'],
    queryFn: () => analyticsApi.payrollByTeacher() as Promise<any>,
  });

  if (isLoading) return <AnalyticsSkeleton blocks={3} />;
  if (isError)
    return (
      <div className="p-8">
        <GlassErrorState
          title={t('common.error')}
          message={getErrorMessage(error)}
          onRetry={refetch}
        />
      </div>
    );

  if (data?.status === 'INSUFFICIENT_DATA') {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.insufficientData')}
        message={data.message}
      />
    );
  }

  if (!data?.teachers?.length) {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.noTeacherData')}
        message={t('payrollAnalytics.noTeacherDataHint')}
      />
    );
  }

  const fmt = formatCurrency;

  return (
    <motion.div variants={cardVariants}>
      <div
        className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
          {data.teachers.map((row: any, idx: number) => (
            <motion.div
              key={row.teacherId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
              className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#007AFF]/[0.03]"
            >
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,122,255,0.5)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                  }}
                />
                <Icon paths={I.users} size={18} strokeWidth={2} className="relative" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {row.name}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-[#86868B]">
                  <span className="inline-flex items-center gap-1">
                    <Icon paths={I.book} size={11} strokeWidth={2} className="opacity-60" />
                    {row.totalLessons} {t('payrollAnalytics.lessons')}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon paths={I.layers} size={11} strokeWidth={2} className="opacity-60" />
                    {row.runs} {t('payrollAnalytics.runs')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1">
                <div className="text-[15px] font-bold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {fmt(row.totalNet)}
                </div>
                <div className="text-[11px] font-medium tabular-nums text-[#86868B]">
                  {t('payrollAnalytics.totalGross')}: {fmt(row.totalGross)}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <StatusChips statuses={row.statuses} />
                <button
                  type="button"
                  onClick={() => handleOpenTeacherPayrollAnalyticsSidecar(row)}
                  title="Split View Sidecar"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-emerald-600 dark:hover:bg-white/[0.08]"
                >
                  <span className="text-xs font-mono font-bold">◨</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: TREND
 * ========================================================================== */

function TrendTab({ t }: { t: (k: string) => string }) {
  const [months, setMonths] = useState(6);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payroll-trend', months],
    queryFn: () => analyticsApi.payrollTrend({ months }) as Promise<any>,
  });

  if (isLoading) return <AnalyticsSkeleton blocks={2} />;
  if (isError)
    return (
      <div className="p-8">
        <GlassErrorState
          title={t('common.error')}
          message={getErrorMessage(error)}
          onRetry={refetch}
        />
      </div>
    );

  if (data?.status === 'INSUFFICIENT_DATA') {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.insufficientData')}
        message={data.message}
      />
    );
  }

  const trend = data?.trend ?? [];
  if (trend.length === 0) {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.noTrendData')}
        message={t('payrollAnalytics.noTrendDataHint')}
      />
    );
  }

  const maxVal = Math.max(1, ...trend.map((d: any) => d.total));
  const w = 640;
  const h = 200;

  const points = trend.map((d: any, i: number) => {
    const x = (i / (trend.length - 1 || 1)) * w;
    const y = h - (d.total / maxVal) * h * 0.85;
    return { x, y, label: d.month, val: d.total };
  });

  const fmt = formatCurrency;

  return (
    <motion.div variants={containerVariants} className="space-y-4">
      <motion.div variants={rowVariants} className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
            <Icon paths={I.trending} size={15} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('payrollAnalytics.tabTrend')}
            </p>
            <p className="text-[11px] font-medium text-[#86868B]">
              {trend.length} {t('payrollAnalytics.months')}
            </p>
          </div>
        </div>
        <RangeSelector value={months} onChange={setMonths} t={t} />
      </motion.div>

      <motion.div variants={cardVariants}>
        <ChartPanel
          points={points}
          color="#5474FC"
          gradientId="payroll-trend-grad"
          width={w}
          height={h}
          formatLabel={(l) => formatMonth(l, true)}
          yFormat={(v) => {
            if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
            return String(v);
          }}
        />
      </motion.div>

      <motion.div
        variants={cardVariants}
        className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
          {trend.map((d: any, idx: number) => (
            <motion.div
              key={d.month}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#5474FC]/[0.03]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5474FC]/10 text-[#5474FC]">
                <Icon paths={I.clock} size={14} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {formatMonth(d.month)}
                </p>
                <p className="text-[11px] font-medium text-[#86868B]">
                  {d.count} {t('payrollAnalytics.runCount')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-[13.5px] font-bold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {fmt(d.total)}
                </div>
                <div className="text-[11px] font-medium tabular-nums text-[#34C759]">
                  {t('payrollAnalytics.paid')}: {fmt(d.paid)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: RATIO
 * ========================================================================== */

function RatioTab({ t }: { t: (k: string) => string }) {
  const [months, setMonths] = useState(6);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payroll-ratio', months],
    queryFn: () => analyticsApi.payrollRatio({ months }) as Promise<any>,
  });

  if (isLoading) return <AnalyticsSkeleton blocks={2} />;
  if (isError)
    return (
      <div className="p-8">
        <GlassErrorState
          title={t('common.error')}
          message={getErrorMessage(error)}
          onRetry={refetch}
        />
      </div>
    );

  if (data?.status === 'INSUFFICIENT_DATA') {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.insufficientData')}
        message={data.message}
      />
    );
  }

  const monthsData = data?.months ?? [];
  if (monthsData.length === 0) {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.noRatioData')}
        message={t('payrollAnalytics.noRatioDataHint')}
      />
    );
  }

  const maxRatio = Math.max(1, ...monthsData.map((d: any) => d.ratio ?? 0));
  const w = 640;
  const h = 200;

  const validData = monthsData.filter((d: any) => d.ratio !== null);
  const points = validData.map((d: any, i: number) => {
    const x = (i / (validData.length - 1 || 1)) * w;
    const y = h - ((d.ratio ?? 0) / maxRatio) * h * 0.85;
    return { x, y, label: d.month, val: d.ratio ?? 0 };
  });

  const fmtCurrency = formatCurrency;

  return (
    <motion.div variants={containerVariants} className="space-y-4">
      <motion.div variants={rowVariants} className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#34C759]/10 text-[#34C759]">
            <Icon paths={I.percent} size={15} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('payrollAnalytics.ratio')}
            </p>
            <p className="text-[11px] font-medium text-[#86868B]">
              {t('payrollAnalytics.payroll')} / {t('payrollAnalytics.revenue')}
            </p>
          </div>
        </div>
        <RangeSelector value={months} onChange={setMonths} t={t} />
      </motion.div>

      {points.length > 0 && (
        <motion.div variants={cardVariants}>
          <ChartPanel
            points={points}
            color="#34C759"
            gradientId="payroll-ratio-grad"
            width={w}
            height={h}
            formatLabel={(l) => formatMonth(l, true)}
            yFormat={(v) => `${v.toFixed(0)}%`}
          />
        </motion.div>
      )}

      <motion.div
        variants={cardVariants}
        className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
          {monthsData.map((d: any, idx: number) => {
            const ratioTone: Tone =
              d.ratio === null
                ? 'purple'
                : d.ratio >= 70
                ? 'red'
                : d.ratio >= 50
                ? 'orange'
                : 'green';
            const cc = TONES[ratioTone];
            return (
              <motion.div
                key={d.month}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[#34C759]/[0.03]"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#34C759]/10 text-[#34C759]">
                  <Icon paths={I.percent} size={14} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {formatMonth(d.month)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-medium text-[#86868B] tabular-nums">
                    <span>
                      {t('payrollAnalytics.payroll')}: {fmtCurrency(d.payroll)}
                    </span>
                    <span>
                      {t('payrollAnalytics.revenue')}: {fmtCurrency(d.revenue)}
                    </span>
                  </div>
                </div>
                <div
                  className="shrink-0 rounded-xl px-2.5 py-1 text-[13px] font-bold tabular-nums tracking-tight"
                  style={{
                    background: cc.bg,
                    color: cc.fg,
                    border: `1px solid ${cc.border}`,
                  }}
                >
                  {d.ratio !== null ? `${d.ratio}%` : '—'}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: EFFICIENCY
 * ========================================================================== */

function EfficiencyTab({ t }: { t: (k: string) => string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['payroll-efficiency'],
    queryFn: () => analyticsApi.payrollEfficiency() as Promise<any>,
  });

  if (isLoading) return <AnalyticsSkeleton blocks={3} />;
  if (isError)
    return (
      <div className="p-8">
        <GlassErrorState
          title={t('common.error')}
          message={getErrorMessage(error)}
          onRetry={refetch}
        />
      </div>
    );

  if (data?.status === 'INSUFFICIENT_DATA') {
    return (
      <GlassEmptyState
        title={t('payrollAnalytics.insufficientData')}
        message={data.message}
      />
    );
  }

  const fmt = formatCurrency;
  const overall = data?.overallCostPerLesson ?? 0;

  return (
    <motion.div variants={containerVariants} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiTile
          label={t('payrollAnalytics.totalPayroll')}
          value={data?.totalPayroll ?? 0}
          icon={I.wallet}
          tone="blue"
          format="currency"
        />
        <KpiTile
          label={t('payrollAnalytics.totalLessons')}
          value={data?.totalLessons ?? 0}
          icon={I.book}
          tone="orange"
        />
        <KpiTile
          label={t('payrollAnalytics.overallCostPerLesson')}
          value={overall}
          icon={I.target}
          tone="purple"
          format="currency"
        />
      </div>

      {data?.teachers?.length > 0 && (
        <motion.div
          variants={cardVariants}
          className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
            {data.teachers.map((row: any, idx: number) => {
              const isOver = row.costPerLesson > overall;
              const tone: Tone = isOver ? 'red' : 'green';
              const cc = TONES[tone];
              const isTop3 = row.rank <= 3;
              return (
                <motion.div
                  key={row.teacherId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#AF52DE]/[0.03]"
                >
                  {/* Rank */}
                  <div
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold tabular-nums text-white"
                    style={{
                      background: isTop3
                        ? 'linear-gradient(135deg, #FF9500 0%, #FF2D55 100%)'
                        : 'linear-gradient(135deg, #86868B 0%, #48484A 100%)',
                      boxShadow: isTop3
                        ? 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(255,149,0,0.5)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 12px -6px rgba(0,0,0,0.25)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
                      }}
                    />
                    <span className="relative text-[14px]">
                      {isTop3 ? <Icon paths={I.award} size={18} strokeWidth={2.2} /> : row.rank}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {row.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] font-medium text-[#86868B]">
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.book} size={11} strokeWidth={2} className="opacity-60" />
                        {row.totalLessons} {t('payrollAnalytics.lessons')}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.wallet} size={11} strokeWidth={2} className="opacity-60" />
                        {fmt(row.totalNet)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="shrink-0 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold tabular-nums tracking-tight"
                    style={{
                      background: cc.bg,
                      color: cc.fg,
                      border: `1px solid ${cc.border}`,
                    }}
                    title={
                      isOver
                        ? 'Above average cost per lesson'
                        : 'Below average cost per lesson'
                    }
                  >
                    {fmt(row.costPerLesson)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function PayrollAnalyticsPage() {
  const { playTick } = usePremiumSound();
  const { t } = useSafeI18n();
  usePageTitle(t('payrollAnalytics.title'));
  const [activeTab, setActiveTab] = useState<Tab>('summary');

  const tabs = useMemo(
    () => [
      { id: 'summary', label: t('payrollAnalytics.tabSummary') },
      { id: 'by-teacher', label: t('payrollAnalytics.tabByTeacher') },
      { id: 'trend', label: t('payrollAnalytics.tabTrend') },
      { id: 'ratio', label: t('payrollAnalytics.tabRatio') },
      { id: 'efficiency', label: t('payrollAnalytics.tabEfficiency') },
    ],
    [t],
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" />
      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-6 backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(0,122,255,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.chart} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Analytics
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                  Live
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('payrollAnalytics.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('payrollAnalytics.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <GlassTabs
          tabs={tabs}
          active={activeTab}
          onChange={(id) => { playTick(); setActiveTab(id as Tab); }}
        />
      </motion.div>

      {/* ============================================================
          TAB CONTENT
      ============================================================ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={SPRING.smooth}
        >
          {activeTab === 'summary' && <SummaryTab t={t} />}
          {activeTab === 'by-teacher' && <ByTeacherTab t={t} />}
          {activeTab === 'trend' && <TrendTab t={t} />}
          {activeTab === 'ratio' && <RatioTab t={t} />}
          {activeTab === 'efficiency' && <EfficiencyTab t={t} />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export default PayrollAnalyticsPage;