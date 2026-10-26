/**
 * M-EDU ExecutiveDashboardPage — 
 *
 * Module Features:
 *  - Hero header with gradient executive tile + live chips + refresh button
 *  - Ambient gradient orbs (blue + purple drift) — consistent with suite
 *  - Premium KPI tiles with count-up + trend pills
 *  - Premium revenue vs expenses chart with animated path + hover tooltip
 *  - Premium metric cards with squircle icons
 *  - Premium alerts list with tone-aware severity badges
 *  - Premium branch comparison table
 *  - Shimmer skeleton (not pulse)
 *  - Custom SVG icons in SVG Icons
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n preserved
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { analyticsApi } from '@/lib/api';
import { GlassErrorState } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
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
 * TYPES
 * ========================================================================== */

interface ExecutiveSummary {
  revenue: { current: number; previous: number; trend: number | null };
  expenses: { current: number; previous: number; trend: number | null };
  netCashFlow: { current: number; previous: number; trend: number | null };
  studentGrowth: { total: number; newThisMonth: number; churnRate: number | null };
  attendanceRate: { overall: number | null; trend: number | null };
  teacherUtilization: { average: number | null; topPerformers: null };
  crmConversion: { leadsThisMonth: number; converted: number; rate: number | null };
  topAlerts: Array<{ type: string; message: string; severity: string }>;
  branchComparison: Array<{
    branchId: string;
    name: string;
    revenue: number;
    students: number;
    attendance: number;
  }> | null;
}

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
  trendingUp: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
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
  flow: [
    'M7 17l9.2-9.2',
    'M17 17V7.8',
    'M7.8 7.8H17',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  alert: [
    'M12 9v4', 'M12 17h.01',
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  ],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  bell: [
    'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9',
    'M13.73 21a2 2 0 0 1-3.46 0',
  ],
  building: [
    'M3 21h18',
    'M5 21V7l8-4v18',
    'M19 21V11l-6-4',
    'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  percent: [
    'M19 5 5 19',
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'rose';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.28)', border: 'rgba(37,99,235,0.20)' },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)' },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)', glow: 'rgba(2,132,199,0.28)', border: 'rgba(2,132,199,0.20)' },
  gray:    { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  rose:    { fg: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  glow: 'rgba(244,63,94,0.28)',  border: 'rgba(244,63,94,0.20)' },
};

const SEVERITY_TONE: Record<string, Tone> = {
  critical: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'blue',
  warning: 'amber',
  info: 'gray',
};

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function CountUp({
  value, duration = 1.1, prefix = '', suffix = '',
}: { value: number; duration?: number; prefix?: string; suffix?: string }) {
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

  const shown = Math.round(n).toLocaleString();
  return <span className="tabular-nums">{prefix}{shown}{suffix}</span>;
}

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

function ExecutiveSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-24" radius="1.5rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Shimmer className="h-72" radius="1.75rem" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Shimmer key={i} className="h-20" radius="1.5rem" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Trend pill — tone-aware */
function TrendPill({ direction, label }: { direction: 'up' | 'down' | 'neutral'; label: string }) {
  const tone: Tone = direction === 'up' ? 'emerald' : direction === 'down' ? 'red' : 'gray';
  const c = TONES[tone];
  const icon = direction === 'up' ? I.trendingUp : direction === 'down' ? I.trendingDown : I.info;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={icon} size={10} strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** KPI Tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  trend,
}: {
  label: string;
  value: string | number;
  icon: string[];
  tone?: Tone;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
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
      <div className="relative flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={16} strokeWidth={2.2} />
        </div>
        <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
          {label}
        </p>
      </div>
      <div className="relative">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        {trend && (
          <div className="mt-2">
            <TrendPill direction={trend.direction} label={trend.value} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Premium chart panel */
function RevenueExpenseChart({
  data,
}: {
  data: { month: string; revenue: number; expenses: number }[];
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { t } = useSafeI18n();

  if (!data || data.length === 0) return null;

  const allValues = data.flatMap((d) => [d.revenue, d.expenses]);
  const maxVal = Math.max(1, ...allValues);
  const w = 560;
  const h = 220;
  const pad = { top: 24, right: 20, bottom: 40, left: 70 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const toX = (i: number) => pad.left + i * xStep;
  const toY = (v: number) => pad.top + chartH - (v / maxVal) * chartH;

  const revenuePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.revenue)}`)
    .join('');
  const expensePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.expenses)}`)
    .join('');

  const revenueFill = [
    ...data.map((d, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(d.revenue)}`),
    `L${toX(data.length - 1)},${pad.top + chartH}`,
    `L${toX(0)},${pad.top + chartH}`,
    'Z',
  ].join('');

  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => (maxVal / ticks) * i);

  return (
    <motion.div
      variants={cardVariants}
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-3xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />

      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
            <Icon paths={I.chart} size={15} strokeWidth={2.2} />
          </div>
          <h3 className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('executive.revenueVsExpenses')}
          </h3>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="relative w-full h-auto"
        onMouseLeave={() => setHoverIdx(null)}
        role="img"
        aria-label={t('executive.revenueVsExpenses')}
      >
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              y1={toY(tick)}
              x2={w - pad.right}
              y2={toY(tick)}
              stroke="rgba(100,116,139,0.14)"
              strokeDasharray="3 4"
              strokeWidth="0.5"
            />
            <text
              x={pad.left - 8}
              y={toY(tick) + 4}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="#64748B"
            >
              {formatCurrency(tick)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <g key={i}>
            <line
              x1={toX(i)}
              y1={pad.top + chartH}
              x2={toX(i)}
              y2={pad.top + chartH + 4}
              stroke="#64748B"
              strokeWidth="1"
            />
            <text
              x={toX(i)}
              y={pad.top + chartH + 18}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#64748B"
            >
              {d.month}
            </text>
          </g>
        ))}

        {/* Revenue area fill */}
        <motion.path
          d={revenueFill}
          fill="url(#revGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        {/* Revenue line */}
        <motion.path
          d={revenuePath}
          fill="none"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: EASE_APPLE }}
        />

        {/* Expense line */}
        <motion.path
          d={expensePath}
          fill="none"
          stroke="#f43f5e"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: EASE_APPLE, delay: 0.2 }}
        />

        {/* Points + hover zones */}
        {data.map((d, i) => (
          <g key={`pts-${i}`}>
            <circle
              cx={toX(i)}
              cy={toY(d.revenue)}
              r={hoverIdx === i ? 5 : 3.5}
              fill="#10b981"
              stroke="white"
              strokeWidth="2"
              style={{ transition: 'r 0.2s' }}
            />
            <circle
              cx={toX(i)}
              cy={toY(d.expenses)}
              r={hoverIdx === i ? 5 : 3.5}
              fill="#f43f5e"
              stroke="white"
              strokeWidth="2"
              style={{ transition: 'r 0.2s' }}
            />
            <rect
              x={toX(i) - xStep / 2}
              y={pad.top}
              width={xStep}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
            />
          </g>
        ))}

        {/* Tooltip */}
        {hoverIdx !== null && (
          <g>
            <line
              x1={toX(hoverIdx)}
              y1={pad.top}
              x2={toX(hoverIdx)}
              y2={pad.top + chartH}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            <rect
              x={toX(hoverIdx) - 70}
              y={pad.top - 10}
              width="140"
              height="58"
              rx="10"
              fill="rgba(255,255,255,0.98)"
              stroke="rgba(0,0,0,0.08)"
              strokeWidth="1"
              style={{ filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.12))' }}
            />
            <text x={toX(hoverIdx)} y={pad.top + 8} textAnchor="middle" fontSize="10" fill="#10b981" fontWeight="700">
              {t('executive.rev')} {formatCurrency(data[hoverIdx].revenue)}
            </text>
            <text x={toX(hoverIdx)} y={pad.top + 22} textAnchor="middle" fontSize="10" fill="#f43f5e" fontWeight="700">
              {t('executive.exp')} {formatCurrency(data[hoverIdx].expenses)}
            </text>
            <text x={toX(hoverIdx)} y={pad.top + 38} textAnchor="middle" fontSize="10" fill="#64748B" fontWeight="600">
              {data[hoverIdx].month}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      <div className="relative mt-3 flex items-center gap-6 text-[11.5px] font-semibold text-[#64748B]">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" style={{ boxShadow: '0 0 8px rgba(16,185,129,0.6)' }} />
          {t('executive.revenue')}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" style={{ boxShadow: '0 0 8px rgba(244,63,94,0.6)' }} />
          {t('executive.expenses')}
        </span>
      </div>
    </motion.div>
  );
}

/** Metric card */
function MetricCard({
  label, value, sub, icon, tone = 'blue',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.12] transition-opacity group-hover:opacity-25"
        style={{ background: c.fg }}
      />
      <div className="relative flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
            {label}
          </p>
          <p className="mt-0.5 text-[20px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
            {value}
          </p>
        </div>
      </div>
      {sub && (
        <p className="relative mt-2 text-[11px] font-medium text-[#64748B]">
          {sub}
        </p>
      )}
    </motion.div>
  );
}

/** Severity badge — tone-aware */
function SeverityBadge({ severity }: { severity: string }) {
  const key = severity.toLowerCase();
  const tone = SEVERITY_TONE[key] ?? 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      {severity}
    </span>
  );
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

export function ExecutiveDashboardPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('executive.title'));

  const { data, isLoading, error, refetch, isFetching } = useQuery<ExecutiveSummary>({
    queryKey: ['executive-summary'],
    queryFn: () => analyticsApi.executiveSummary() as Promise<ExecutiveSummary>,
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return [
      { month: 'Current', revenue: data.revenue.current, expenses: data.expenses.current },
      { month: 'Previous', revenue: data.revenue.previous, expenses: data.expenses.previous },
    ];
  }, [data]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
        <ExecutiveSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('common.error')}
            message={error instanceof Error ? error.message : t('common.error')}
            onRetry={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  /* ── Empty ────────────────────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="page-container space-y-5">
        <div className="rounded-2xl border border-dashed border-black/15 bg-white/80 p-12 text-center backdrop-blur-xl dark:border-white/15 dark:bg-surface-900/80 shadow-card">
          <p className="text-[13.5px] font-medium text-[var(--text-secondary)]">{t('executive.empty')}</p>
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-7"
        >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(37,99,235,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('executive.title')}
                </span>
                {data.topAlerts.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F59E0B]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#F59E0B]">
                    <span className="relative flex h-1.5 w-1.5">
                      <motion.span
                        className="absolute inset-0 rounded-full bg-[#F59E0B]"
                        animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />
                    </span>
                    {data.topAlerts.length} alerts
                  </span>
                )}
                {data.branchComparison && data.branchComparison.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6366F1]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6366F1]">
                    <Icon paths={I.building} size={11} strokeWidth={2.5} />
                    {data.branchComparison.length} branches
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('executive.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">
                {t('executive.subtitle')}
              </p>
            </div>

            <motion.button
              type="button"
              onClick={() => void refetch()}
              disabled={isFetching}
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={SPRING.snappy}
              aria-label={t('common.refresh')}
              title="Refresh"
              className="flex h-10 w-10 items-center justify-center rounded-xl outline-none disabled:opacity-60"
              style={{
                background: 'rgba(37,99,235,0.10)',
                color: '#2563EB',
                border: '1px solid rgba(37,99,235,0.2)',
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e: any) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}>
              <motion.span
                animate={isFetching ? { rotate: 360 } : { rotate: 0 }}
                transition={isFetching ? { duration: 1, repeat: Infinity, ease: 'linear' } : { duration: 0.2 }}
              >
                <Icon paths={I.refresh} size={16} strokeWidth={2.2} />
              </motion.span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI ROW
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiTile
          label={t('executive.revenue')}
          value={formatCurrency(data.revenue.current)}
          icon={I.wallet}
          tone="emerald"
          trend={
            data.revenue.trend !== null
              ? {
                  value: `${Math.abs(data.revenue.trend)}% vs last`,
                  direction: data.revenue.trend >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <KpiTile
          label={t('executive.expenses')}
          value={formatCurrency(data.expenses.current)}
          icon={I.cash}
          tone="rose"
          trend={
            data.expenses.trend !== null
              ? {
                  value: `${Math.abs(data.expenses.trend)}% vs last`,
                  direction: data.expenses.trend <= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <KpiTile
          label={t('executive.netCashFlow')}
          value={formatCurrency(data.netCashFlow.current)}
          icon={I.flow}
          tone="blue"
          trend={
            data.netCashFlow.trend !== null
              ? {
                  value: `${Math.abs(data.netCashFlow.trend)}% vs last`,
                  direction: data.netCashFlow.current >= 0 ? 'up' : 'down',
                }
              : undefined
          }
        />
        <KpiTile
          label={t('executive.students')}
          value={data.studentGrowth.total}
          icon={I.users}
          tone="purple"
          trend={{
            value: `+${data.studentGrowth.newThisMonth} this month`,
            direction: data.studentGrowth.newThisMonth > 0 ? 'up' : 'neutral',
          }}
        />
      </motion.div>

      {/* ============================================================
          CHART + METRICS
      ============================================================ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RevenueExpenseChart data={chartData} />
        <motion.div variants={containerVariants} className="space-y-3.5">
          <MetricCard
            label={t('executive.attendanceRate')}
            value={data.attendanceRate.overall !== null ? `${data.attendanceRate.overall}%` : '—'}
            sub={t('executive.last30Days')}
            icon={I.calendar}
            tone="emerald"
          />
          <MetricCard
            label={t('executive.teacherUtilization')}
            value={
              data.teacherUtilization.average !== null
                ? `${data.teacherUtilization.average}%`
                : '—'
            }
            sub={t('executive.activeGroupsPerTeacher')}
            icon={I.award}
            tone="orange"
          />
          <MetricCard
            label={t('executive.crmConversion')}
            value={data.crmConversion.rate !== null ? `${data.crmConversion.rate}%` : '—'}
            sub={`${data.crmConversion.converted} ${t('executive.convertedOf')} ${data.crmConversion.leadsThisMonth} ${t('executive.leads')}`}
            icon={I.target}
            tone="purple"
          />
        </motion.div>
      </div>

      {/* ============================================================
          ALERTS
      ============================================================ */}
      {data.topAlerts.length > 0 && (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
        >
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF9500]/10 text-[#FF9500]">
                <Icon paths={I.bell} size={15} strokeWidth={2.2} />
              </div>
              <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                {t('executive.topAlerts')}
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9500]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF9500]">
              <Icon paths={I.layers} size={11} strokeWidth={2.5} />
              {data.topAlerts.length}
            </span>
          </div>

          <div className="relative space-y-2.5">
            {data.topAlerts.map((alert, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                className="flex items-start gap-3 rounded-xl border border-black/[0.05] bg-black/[0.02] px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <SeverityBadge severity={alert.severity} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                    {alert.message}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                    {alert.type}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ============================================================
          BRANCH COMPARISON
      ============================================================ */}
      {data.branchComparison && data.branchComparison.length > 0 && (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
        >
          <div className="relative mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
                <Icon paths={I.building} size={15} strokeWidth={2.2} />
              </div>
              <h3 className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                {t('executive.branchComparison')}
              </h3>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-black/[0.05] dark:border-white/[0.06]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.05]">
                    <th className="px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                      {t('executive.branch')}
                    </th>
                    <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                      {t('executive.revenue')}
                    </th>
                    <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                      {t('executive.students')}
                    </th>
                    <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                      {t('executive.attendanceRate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.branchComparison.map((branch, idx) => (
                    <motion.tr
                      key={branch.branchId}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                      className="border-b border-slate-200/80 dark:border-slate-800 transition-colors hover:bg-[#2563EB]/[0.03] last:border-0 dark:border-[#ffffff08]"
                    >
                      <td className="px-4 py-3 text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {branch.name}
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {formatCurrency(branch.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-[12.5px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {branch.students}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#10B981]/10 px-2 py-0.5 text-[11.5px] font-bold tabular-nums text-[#10B981]">
                          <Icon paths={I.percent} size={10} strokeWidth={2.4} />
                          {branch.attendance}%
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default ExecutiveDashboardPage;