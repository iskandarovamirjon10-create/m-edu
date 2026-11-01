/**
 * M-EDU FinancialAnalyticsPage — 
 *
 * Module Features:
 *  - Hero header with gradient finance tile + period chip + refresh
 *  - Ambient gradient orbs — suite-consistent
 *  - Premium segmented tabs with layoutId sliding indicator
 *  - KpiTile with CountUp + tone-aware gradient orb
 *  - Animated funnel-style bars (Inflow / Outflow / Margin)
 *  - Premium tables with squircle icons + tone-aware chips
 *  - What-if sliders with tone-aware accent fills
 *  - Forecast grid with CountUp + trend pill
 *  - Reconciliation with month/year picker + summary row
 *  - Shimmer skeleton (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - 100% logic preserved (queries, tabs, state, i18n, data shapes)
 */

import { toLocalISOString, formatCurrency } from '@/lib/format';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import {
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
  GlassSelect,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { analyticsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type {
  CashFlowData,
  FinancialAnomaly,
  ForecastResult,
  ReconciliationData,
} from '@/types/analytics';

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
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  finance: [
    'M12 2v20',
    'M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ],
  trend: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  trendDown: ['M22 17l-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  cash: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 7v10',
    'M9 9.5C9 8.1 10.3 7 12 7s3 1.1 3 2.5S13.7 12 12 12s-3 1.1-3 2.5S10.3 17 12 17s3-1.1 3-2.5',
  ],
  percent: [
    'M19 5 5 19',
    'M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    'M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  alert: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  forecast: ['M3 17l6-6 4 4 8-8', 'M15 7h6v6'],
  reconciliation: [
    'M20 6 9 17l-5-5',
    'M20 12l-9 5-9-5',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'indigo' | 'rose';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string; gradient: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.28)', border: 'rgba(37,99,235,0.20)', gradient: 'linear-gradient(90deg, #0284C7, #2563EB)' },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)',  gradient: 'linear-gradient(90deg, #30D158, #10B981)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)',  gradient: 'linear-gradient(90deg, #FFB340, #F59E0B)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)',  gradient: 'linear-gradient(90deg, #FF6961, #EF4444)' },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)', gradient: 'linear-gradient(90deg, #BF5AF2, #6366F1)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)', glow: 'rgba(2,132,199,0.28)', border: 'rgba(2,132,199,0.20)', gradient: 'linear-gradient(90deg, #64D2FF, #0284C7)' },
  gray:    { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)', gradient: 'linear-gradient(90deg, #A1A1A6, #64748B)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)', gradient: 'linear-gradient(90deg, #34D399, #10B981)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)', gradient: 'linear-gradient(90deg, #FBBF24, #F59E0B)' },
  indigo:  { fg: '#6366F1', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)',  gradient: 'linear-gradient(90deg, #818CF8, #6366F1)' },
  rose:    { fg: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  glow: 'rgba(244,63,94,0.28)',  border: 'rgba(244,63,94,0.20)',  gradient: 'linear-gradient(90deg, #FB7185, #F43F5E)' },
};

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

type TabId = 'overview' | 'cashflow' | 'anomalies' | 'whatif' | 'forecast' | 'reconciliation';

const TABS: { id: TabId; labelKey: string; icon: string[]; tone: Tone }[] = [
  { id: 'overview',       labelKey: 'analytics.tabOverview',       icon: I.activity,       tone: 'blue' },
  { id: 'cashflow',       labelKey: 'analytics.tabCashFlow',       icon: I.cash,           tone: 'emerald' },
  { id: 'anomalies',      labelKey: 'analytics.tabAnomalies',      icon: I.alert,          tone: 'rose' },
  { id: 'whatif',         labelKey: 'analytics.tabWhatIf',         icon: I.sparkles,       tone: 'purple' },
  { id: 'forecast',       labelKey: 'analytics.tabForecast',       icon: I.forecast,       tone: 'cyan' },
  { id: 'reconciliation', labelKey: 'analytics.tabReconciliation', icon: I.reconciliation, tone: 'indigo' },
];

function getDefaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return {
    startDate: toLocalISOString(start),
    endDate: toLocalISOString(end),
  };
}

function fmtCurrency(val: number | string | null | undefined) {
  return formatCurrency(val);
}

function fmtUZS(val: number) {
  return new Intl.NumberFormat('uz-UZ').format(val);
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AmbientOrbs() {
  return <AuroraMesh variant="corporate" />;
}

function CountUp({ value, duration = 1.1, suffix = '', decimals = 0, currency = false }: { value: number; duration?: number; suffix?: string; decimals?: number; currency?: boolean }) {
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

  if (currency) {
    return <span className="tabular-nums">{fmtCurrency(n)}</span>;
  }
  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString('uz-UZ');
  return <span className="tabular-nums">{shown}{suffix}</span>;
}

function KpiTile({
  label, value, stringValue, icon, tone = 'blue', secondary, percent, currency,
}: {
  label: string;
  value?: number;
  stringValue?: string;
  icon: string[];
  tone?: Tone;
  secondary?: string;
  percent?: boolean;
  currency?: boolean;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
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
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? (
            currency ? (
              <CountUp value={value} currency />
            ) : (
              <CountUp value={value} suffix={percent ? '%' : ''} decimals={percent ? 1 : 0} />
            )
          ) : (
            stringValue
          )}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#64748B]/80">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
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

function PremiumTabs({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  const { t } = useSafeI18n();
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-black/[0.04] bg-black/[0.04] p-1 dark:border-white/[0.06] dark:bg-white/[0.06]"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const c = TONES[tab.tone];
        return (
          <motion.button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            whileHover={reduced ? undefined : { y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="relative inline-flex items-center justify-center min-h-[44px] shrink-0 overflow-hidden rounded-xl px-3.5 py-2 text-[12.5px] font-bold tracking-tight outline-none transition-colors whitespace-nowrap"
            style={{ color: isActive ? c.fg : '#64748B' }}
            tabIndex={0}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}>
            {isActive && (
              <motion.span
                layoutId="finance-tab-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon paths={tab.icon} size={13} strokeWidth={2.4} />
              {t(tab.labelKey)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB: OVERVIEW — 3 KPI + animated bars
 * ═══════════════════════════════════════════════════════════════════════ */

function OverviewTab({ data, t }: { data: CashFlowData | undefined; t: (key: string) => string }) {
  const reduced = useReducedMotion();
  if (!data) return null;

  const inflow = data.inflows?.netCashInflow ?? 0;
  const outflow = data.outflows?.totalOutflow ?? 0;
  const margin = inflow > 0 ? ((inflow - outflow) / inflow) * 100 : 0;
  const maxVal = Math.max(inflow, outflow, 1);
  const inflowWidth = (inflow / maxVal) * 100;
  const outflowWidth = (outflow / maxVal) * 100;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <KpiTile label={t('analytics.inflow')} value={inflow} icon={I.arrowUp} tone="emerald" currency />
        <KpiTile label={t('analytics.outflow')} value={outflow} icon={I.arrowDown} tone="rose" currency />
        <KpiTile label={t('analytics.margin')} value={margin} icon={I.percent} tone={margin >= 0 ? 'blue' : 'amber'} percent />
      </motion.div>

      {/* Flow visualization */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-8"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />
        <div className="relative mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
            <Icon paths={I.activity} size={16} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('analytics.cashFlowBreakdown')}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
              Period: {data.period?.startDate?.slice(0, 10)} → {data.period?.endDate?.slice(0, 10)}
            </p>
          </div>
        </div>

        <div className="relative space-y-5">
          {/* Inflow bar */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
                style={{
                  background: TONES.emerald.bg,
                  color: TONES.emerald.fg,
                  border: `1px solid ${TONES.emerald.border}`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONES.emerald.fg }} />
                {t('analytics.inflow')}
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                {fmtUZS(inflow)}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-xl border border-black/[0.04] bg-black/[0.03] dark:border-white/[0.06] dark:bg-white/[0.04]">
              <motion.div
                className="h-full rounded-xl"
                style={{
                  background: TONES.emerald.gradient,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px -4px ${TONES.emerald.glow}`,
                }}
                initial={reduced ? { width: `${inflowWidth}%` } : { width: 0 }}
                animate={{ width: `${inflowWidth}%` }}
                transition={{ duration: 1, ease: EASE_APPLE, delay: 0.2 }}
              />
            </div>
          </div>

          {/* Outflow bar */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
                style={{
                  background: TONES.rose.bg,
                  color: TONES.rose.fg,
                  border: `1px solid ${TONES.rose.border}`,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: TONES.rose.fg }} />
                {t('analytics.outflow')}
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                {fmtUZS(outflow)}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-xl border border-black/[0.04] bg-black/[0.03] dark:border-white/[0.06] dark:bg-white/[0.04]">
              <motion.div
                className="h-full rounded-xl"
                style={{
                  background: TONES.rose.gradient,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px -4px ${TONES.rose.glow}`,
                }}
                initial={reduced ? { width: `${outflowWidth}%` } : { width: 0 }}
                animate={{ width: `${outflowWidth}%` }}
                transition={{ duration: 1, ease: EASE_APPLE, delay: 0.35 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB: CASHFLOW — premium table
 * ═══════════════════════════════════════════════════════════════════════ */

function CashFlowTab({ data, t }: { data: CashFlowData | undefined; t: (key: string) => string }) {
  if (!data) return null;

  const breakdownData = [
    { category: t('analytics.cashCollected'), amount: data.inflows?.cashCollected ?? 0, type: 'INFLOW' },
    { category: t('analytics.refunds'), amount: data.inflows?.refundsTotal ?? 0, type: 'OUTFLOW' },
    { category: t('analytics.generalExpenses'), amount: data.outflows?.expensesTotal ?? 0, type: 'OUTFLOW' },
    { category: t('analytics.payroll'), amount: data.outflows?.payrollTotal ?? 0, type: 'OUTFLOW' },
  ].filter((b) => b.amount !== 0).sort((a, b) => b.amount - a.amount);

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />
      <div className="relative flex items-center gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10B981]/10 text-[#10B981]">
          <Icon paths={I.cash} size={16} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('analytics.cashFlowBreakdown')}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
            {breakdownData.length} categories
          </p>
        </div>
      </div>

      {breakdownData.length === 0 ? (
        <div className="p-12 flex items-center justify-center">
          <GlassEmptyState title={t('analytics.noData')} />
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <GlassTable>
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('analytics.category')}</GlassTH>
                <GlassTH>{t('analytics.type')}</GlassTH>
                <GlassTH className="text-right">{t('analytics.amount')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {breakdownData.map((row, i) => {
                const isInflow = row.type === 'INFLOW';
                const tone = isInflow ? TONES.emerald : TONES.rose;
                return (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: i * 0.04 }}
                    className="transition-colors hover:bg-[#2563EB]/[0.03]"
                  >
                    <GlassTD>
                      <span className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {row.category}
                      </span>
                    </GlassTD>
                    <GlassTD>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
                        style={{
                          background: tone.bg,
                          color: tone.fg,
                          border: `1px solid ${tone.border}`,
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
                        {row.type}
                      </span>
                    </GlassTD>
                    <GlassTD className="text-right">
                      <span className="font-mono text-[13px] font-bold tabular-nums" style={{ color: tone.fg }}>
                        {fmtUZS(row.amount)}
                      </span>
                    </GlassTD>
                  </motion.tr>
                );
              })}
            </GlassTBody>
          </GlassTable>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB: ANOMALIES — premium cards
 * ═══════════════════════════════════════════════════════════════════════ */

function handleOpenAnomalySidecar(a: FinancialAnomaly) {
  const sidecarData: QuickLookData = {
    id: `${a.type}-${a.metric || Math.random()}`,
    type: 'payment',
    title: a.type ? a.type.replace(/_/g, ' ') : 'Moliyaviy anomaliya',
    subtitle: `${a.severity} daraja · ${a.metric || 'Moliyaviy ko\'rsatkich'}`,
    badge: {
      text: a.severity,
      tone: a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'rose' : 'amber',
    },
    avatar: {
      text: a.severity.slice(0, 2),
      color: '#EF4444',
    },
    metrics: [
      { label: 'Anomaliya turi', value: a.type },
      { label: 'Metrika', value: a.metric || '—' },
      { label: 'Xavf darajasi', value: a.severity },
    ],
    details: [
      { label: 'Turi', value: a.type },
      { label: 'Metrika', value: a.metric || '—' },
      { label: 'Tavsif', value: a.description || 'Izohsiz' },
      { label: 'Daraja', value: a.severity },
    ],
  };
  openSidecar(sidecarData);
}

function AnomaliesTab({ data, t }: { data: FinancialAnomaly[] | undefined; t: (key: string) => string }) {
  const items = Array.isArray(data) ? data : [];

  const getSeverityTone = (severity: string): Tone => {
    const s = severity?.toUpperCase() ?? '';
    if (s === 'HIGH' || s === 'REQUIRES REVIEW' || s === 'CRITICAL') return 'rose';
    if (s === 'MEDIUM' || s === 'UNUSUAL' || s === 'WARNING') return 'amber';
    return 'gray';
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />
      <div className="relative flex items-center gap-3 border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F43F5E]/10 text-[#F43F5E]">
          <Icon paths={I.alert} size={16} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('analytics.detectedAnomalies')}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
            {items.length} detected
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="p-12 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#10B981]/10 text-[#10B981]">
            <Icon paths={I.checkCircle} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('analytics.noAnomalies')}
          </p>
        </div>
      ) : (
        <div className="relative divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-[#ffffff08]">
          {items.map((a, i) => {
            const tone = getSeverityTone(a.severity);
            const c = TONES[tone];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: i * 0.04 }}
                className="flex flex-wrap items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[#F43F5E]/[0.03]"
              >
                <div
                  className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
                  style={{
                    background: c.gradient,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px ${c.glow}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                    }}
                  />
                  <Icon paths={I.alert} size={18} strokeWidth={2} className="relative" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold tracking-tight capitalize text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {a.type?.replace(/_/g, ' ').toLowerCase()}
                    </p>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
                      style={{
                        background: c.bg,
                        color: c.fg,
                        border: `1px solid ${c.border}`,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
                      {a.severity}
                    </span>
                  </div>
                  {a.description && (
                    <p className="mt-1 text-[12px] font-medium leading-snug text-[#64748B]">
                      {a.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAnomalySidecar(a)}
                  title="Split View Sidecar"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-emerald-600 dark:hover:bg-white/[0.08]"
                >
                  <span className="text-xs font-mono font-bold">◨</span>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB: WHAT-IF — premium sliders
 * ═══════════════════════════════════════════════════════════════════════ */

function WhatIfTab({
  t,
  priceIncrease, setPriceIncrease,
  studentVolume, setStudentVolume,
  payrollIncrease, setPayrollIncrease,
  loadingWhatIf, errWhatIf, eWhatIf, sim,
}: {
  t: (key: string) => string;
  priceIncrease: number; setPriceIncrease: (n: number) => void;
  studentVolume: number; setStudentVolume: (n: number) => void;
  payrollIncrease: number; setPayrollIncrease: (n: number) => void;
  loadingWhatIf: boolean;
  errWhatIf: boolean;
  eWhatIf: unknown;
  sim: any;
}) {
  const sliders = [
    { label: t('analytics.priceIncrease'), value: priceIncrease, onChange: setPriceIncrease, min: -20, max: 50, tone: 'emerald' as Tone },
    { label: t('analytics.studentVolume'), value: studentVolume, onChange: setStudentVolume, min: -50, max: 100, tone: 'blue' as Tone },
    { label: t('analytics.payrollIncrease'), value: payrollIncrease, onChange: setPayrollIncrease, min: -20, max: 50, tone: 'rose' as Tone },
  ];

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-8"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />
      <div className="relative mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6366F1]/10 text-[#6366F1]">
          <Icon paths={I.sparkles} size={16} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('analytics.whatIfSimulation')}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
            {t('finance.adjustVariables')}
          </p>
        </div>
      </div>

      <div className="relative mb-8 grid grid-cols-1 gap-5 md:grid-cols-3">
        {sliders.map((s) => {
          const c = TONES[s.tone];
          return (
            <div key={s.label} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[12.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {s.label}
                </label>
                <span
                  className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11.5px] font-bold tabular-nums"
                  style={{
                    background: c.bg,
                    color: c.fg,
                    border: `1px solid ${c.border}`,
                  }}
                >
                  {s.value > 0 ? '+' : ''}{s.value}%
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={1}
                  value={s.value}
                  onChange={(e) => s.onChange(Number(e.target.value))}
                  aria-label={s.label}
                  className="w-full appearance-none cursor-pointer h-1.5 rounded-lg outline-none"
                  style={{
                    background: `linear-gradient(to right, ${c.fg} 0%, ${c.fg} ${((s.value - s.min) / (s.max - s.min)) * 100}%, rgba(0,0,0,0.08) ${((s.value - s.min) / (s.max - s.min)) * 100}%, rgba(0,0,0,0.08) 100%)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {loadingWhatIf ? (
        <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 dark:border-[#ffffff15]">
          <GlassPageLoader label={t('analytics.simulating')} />
        </div>
      ) : errWhatIf ? (
        <GlassErrorState title={t('common.error')} message={getErrorMessage(eWhatIf as Error)} />
      ) : sim?.status === 'INSUFFICIENT_DATA' ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-500/[0.02] p-8 text-center dark:border-[#ffffff15] dark:bg-[#ffffff04]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B]">
            <Icon paths={I.info} size={22} strokeWidth={1.8} />
          </div>
          <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('analytics.insufficientData')}
          </p>
        </div>
      ) : sim && sim.status === 'SIMULATED' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiTile
            label={t('analytics.projectedRevenue')}
            value={sim.projectedRevenue}
            icon={I.trend}
            tone="emerald"
            currency
            secondary={`vs ${fmtUZS(sim.baseRevenue)}`}
          />
          <KpiTile
            label={t('analytics.projectedPayroll')}
            value={sim.projectedPayroll}
            icon={I.arrowDown}
            tone="rose"
            currency
            secondary={`vs ${fmtUZS(sim.basePayroll)}`}
          />
          <KpiTile
            label={t('analytics.projectedNetCashFlow')}
            value={sim.projectedNetCashFlow}
            icon={I.cash}
            tone={sim.projectedNetCashFlow >= sim.baseNetCashFlow ? 'emerald' : 'rose'}
            currency
            secondary={`Delta: ${fmtUZS(sim.difference)}`}
          />
        </div>
      ) : null}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB: FORECAST
 * ═══════════════════════════════════════════════════════════════════════ */

function ForecastView({ forecastDays, setForecastDays, t }: { forecastDays: number; setForecastDays: (n: number) => void; t: (key: string) => string }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['financial-forecast', forecastDays],
    queryFn: () => analyticsApi.forecast({ days: forecastDays }),
    staleTime: 60_000,
  });

  const forecast = data as ForecastResult | undefined;

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-12 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10" />
        <div className="space-y-4">
          <Shimmer className="h-8 w-48" radius="0.5rem" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Shimmer key={i} className="h-32" radius="1rem" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="glass-card p-8">
        <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />
      </div>
    );
  }

  if (!forecast || forecast.status === 'INSUFFICIENT_DATA') {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-12 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0284C7]/10 text-[#0284C7]">
            <Icon paths={I.forecast} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('analytics.insufficientData')}
          </p>
          <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#64748B]">
            {t('analytics.insufficientDataDesc')}
          </p>
        </div>
      </motion.div>
    );
  }

  const isCalc = forecast.status === 'CALCULATED';
  const net = isCalc ? forecast.projectedNetCashFlow : 0;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-8"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
        }}
      />
      <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7]/10 text-[#0284C7]">
            <Icon paths={I.forecast} size={16} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('analytics.financialForecast')}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
              {forecastDays} {t('common.days')} projection
            </p>
          </div>
        </div>
        <GlassSelect
          value={String(forecastDays)}
          onChange={(e) => setForecastDays(Number(e.target.value))}
          aria-label={t('analytics.financialForecast')}
          className="w-auto"
        >
          <option value="30">30 {t('common.days')}</option>
          <option value="60">60 {t('common.days')}</option>
          <option value="90">90 {t('common.days')}</option>
        </GlassSelect>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiTile
          label={t('analytics.totalExpectedRevenue')}
          value={isCalc ? forecast.projectedRevenue : 0}
          icon={I.trend}
          tone="emerald"
          currency
        />
        <KpiTile
          label={t('analytics.totalExpectedExpenses')}
          value={isCalc ? forecast.projectedExpenses + forecast.projectedPayroll : 0}
          icon={I.arrowDown}
          tone="rose"
          currency
        />
        <KpiTile
          label={t('analytics.projectedPayroll')}
          value={isCalc ? forecast.projectedPayroll : 0}
          icon={I.cash}
          tone="amber"
          currency
        />
        <KpiTile
          label={t('analytics.projectedNetCashFlow')}
          value={net}
          icon={I.wallet}
          tone={net >= 0 ? 'emerald' : 'rose'}
          currency
        />
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * TAB: RECONCILIATION
 * ═══════════════════════════════════════════════════════════════════════ */

function ReconciliationView({ t }: { t: (key: string) => string }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['financial-reconciliation', year, month],
    queryFn: () => analyticsApi.reconciliation({ year, month }),
    staleTime: 60_000,
  });

  const recon = data as ReconciliationData;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const net = recon?.cashFlow?.netCashFlow ?? 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Toolbar */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#6366F1]/10 text-[#6366F1]">
              <Icon paths={I.calendar} size={14} strokeWidth={2.2} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              {t('finance.period')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <GlassSelect
              value={String(month)}
              onChange={(e) => setMonth(Number(e.target.value))}
              aria-label={t('finance.period')}
              className="w-auto"
            >
              {monthNames.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </GlassSelect>
            <GlassSelect
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label={t('common.year')}
              className="w-auto"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </GlassSelect>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Shimmer key={i} className="h-[88px]" radius="1rem" />
            ))}
          </div>
          <Shimmer className="h-96 w-full" radius="1.75rem" />
        </div>
      ) : isError ? (
        <div className="glass-card p-8">
          <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />
        </div>
      ) : recon ? (
        <>
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <KpiTile label={t('finance.totalInvoiced')} value={recon.receivables?.totalInvoiced ?? 0} icon={I.trend} tone="blue" currency />
            <KpiTile label={t('finance.totalPaid')} value={recon.receivables?.totalPaid ?? 0} icon={I.checkCircle} tone="emerald" currency />
            <KpiTile label={t('finance.receivableDiff')} value={recon.receivables?.difference ?? 0} icon={I.alert} tone="amber" currency />
            <KpiTile
              label={t('finance.netCashFlow')}
              value={net}
              icon={I.wallet}
              tone={net >= 0 ? 'emerald' : 'rose'}
              currency
            />
          </motion.div>

          <motion.div
            variants={cardVariants}
            className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-16"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
              }}
            />
            <div className="relative overflow-x-auto">
              <GlassTable>
                <GlassTHead>
                  <GlassTR>
                    <GlassTH>{t('finance.category')}</GlassTH>
                    <GlassTH className="text-right">{t('finance.amountUsd')}</GlassTH>
                  </GlassTR>
                </GlassTHead>
                <GlassTBody>
                  {[
                    { label: t('finance.invoicesIssued'), val: recon.receivables?.totalInvoiced, isBold: false, tone: 'blue' as Tone },
                    { label: t('finance.paymentsReceived'), val: recon.receivables?.totalPaid, isBold: false, tone: 'emerald' as Tone },
                    { label: t('finance.refundsProcessed'), val: (recon.cashFlow?.outflows ?? 0) - (recon.expenses?.total ?? 0), isBold: false, tone: 'rose' as Tone },
                    { label: t('finance.generalExpenses'), val: recon.expenses?.general, isBold: false, tone: 'orange' as Tone },
                    { label: t('finance.payroll'), val: recon.expenses?.payroll, isBold: false, tone: 'amber' as Tone },
                    { label: t('finance.totalExpenses'), val: recon.expenses?.total, isBold: true, tone: 'rose' as Tone },
                  ].map((row, i) => {
                    const c = TONES[row.tone];
                    return (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: i * 0.04 }}
                        className="transition-colors hover:bg-[#6366F1]/[0.03]"
                      >
                        <GlassTD>
                          <span
                            className={`text-[13px] tracking-tight ${
                              row.isBold
                                ? 'font-bold text-[#1D1D1F] dark:text-[#F5F5F7]'
                                : 'font-semibold text-[#4A4A4F] dark:text-[#C7C7CC]'
                            }`}
                          >
                            {row.label}
                          </span>
                        </GlassTD>
                        <GlassTD className="text-right">
                          <span
                            className={`font-mono text-[13px] tabular-nums ${
                              row.isBold ? 'font-bold' : 'font-semibold'
                            }`}
                            style={{ color: row.isBold ? c.fg : undefined }}
                          >
                            {fmtCurrency(row.val ?? 0)}
                          </span>
                        </GlassTD>
                      </motion.tr>
                    );
                  })}
                  {/* Summary row */}
                  <motion.tr
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: 0.3 }}
                    style={{
                      background: net >= 0
                        ? 'rgba(16,185,129,0.06)'
                        : 'rgba(244,63,94,0.06)',
                    }}
                  >
                    <GlassTD>
                      <span className="text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {t('finance.netCashFlow')}
                      </span>
                    </GlassTD>
                    <GlassTD className="text-right">
                      <span
                        className="font-mono text-[15px] font-bold tabular-nums tracking-tight"
                        style={{ color: net >= 0 ? '#10B981' : '#F43F5E' }}
                      >
                        {fmtCurrency(net)}
                      </span>
                    </GlassTD>
                  </motion.tr>
                </GlassTBody>
              </GlassTable>
            </div>
          </motion.div>
        </>
      ) : null}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════════ */

export function FinancialAnalyticsPage() {
  const { playTick } = usePremiumSound();
  const { t } = useSafeI18n();
  usePageTitle(t('nav.financialAnalytics'));
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [range] = useState(getDefaultDateRange());
  const [priceIncrease, setPriceIncrease] = useState(0);
  const [studentVolume, setStudentVolume] = useState(0);
  const [payrollIncrease, setPayrollIncrease] = useState(0);
  const [forecastDays, setForecastDays] = useState(30);

  /* ── Queries (preserved) ──────────────────────────────────────────── */
  const { data: cashFlowData, isLoading: loadingCashFlow, isError: errCashFlow, error: eCashFlow } = useQuery({
    queryKey: ['financial-cashflow', range],
    queryFn: () => analyticsApi.cashFlow({ startDate: range.startDate, endDate: range.endDate }),
    staleTime: 30_000,
  });

  const { data: anomaliesData, isLoading: loadingAnomalies, isError: errAnomalies, error: eAnomalies } = useQuery({
    queryKey: ['financial-anomalies', range],
    queryFn: () => analyticsApi.anomalies({ startDate: range.startDate, endDate: range.endDate }),
    staleTime: 30_000,
  });

  const { data: whatIfData, isLoading: loadingWhatIf, isError: errWhatIf, error: eWhatIf } = useQuery({
    queryKey: ['financial-whatif', range, priceIncrease, studentVolume, payrollIncrease],
    queryFn: () => analyticsApi.whatIf({ startDate: range.startDate, endDate: range.endDate, priceIncrease, studentVolume, payrollIncrease }),
    staleTime: 30_000,
  });
  const sim = whatIfData;

  /* ── Derived hero chips ───────────────────────────────────────────── */
  const inflow = cashFlowData?.inflows?.netCashInflow ?? 0;
  const outflow = cashFlowData?.outflows?.totalOutflow ?? 0;
  const margin = inflow > 0 ? ((inflow - outflow) / inflow) * 100 : 0;

  const periodLabel = `${range.startDate.slice(0, 10)} → ${range.endDate.slice(0, 10)}`;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AmbientOrbs />

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="liquid-glass-surface relative overflow-hidden rounded-2xl p-6 sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
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
                background: 'linear-gradient(135deg, #10B981 0%, #2563EB 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(16,185,129,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.finance} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('finance.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                  <Icon paths={I.calendar} size={11} strokeWidth={2.5} />
                  {periodLabel}
                </span>
                {inflow > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]"
                    style={{
                      background: margin >= 0 ? 'rgba(16,185,129,0.10)' : 'rgba(244,63,94,0.10)',
                      color: margin >= 0 ? '#10B981' : '#F43F5E',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: margin >= 0 ? '#10B981' : '#F43F5E' }}
                    />
                    {margin.toFixed(1)}% margin
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('nav.financialAnalytics')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">
                {t('analytics.financialSubtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <PremiumTabs active={activeTab} onChange={(id) => { playTick(); setActiveTab(id); }} />
      </motion.div>

      {/* ============================================================
          TAB CONTENT
      ============================================================ */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SPRING.smooth}
          >
            {activeTab === 'overview' && (
              loadingCashFlow ? (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
                  </div>
                  <Shimmer className="h-64" radius="1.75rem" />
                </div>
              ) : errCashFlow ? (
                <div className="glass-card p-8">
                  <GlassErrorState title={t('common.error')} message={getErrorMessage(eCashFlow)} />
                </div>
              ) : (
                <OverviewTab data={cashFlowData} t={t} />
              )
            )}

            {activeTab === 'cashflow' && (
              loadingCashFlow ? (
                <div className="glass-card p-12 flex items-center justify-center">
                  <GlassPageLoader label={t('common.loading')} />
                </div>
              ) : errCashFlow ? (
                <div className="glass-card p-8">
                  <GlassErrorState title={t('common.error')} message={getErrorMessage(eCashFlow)} />
                </div>
              ) : (
                <CashFlowTab data={cashFlowData} t={t} />
              )
            )}

            {activeTab === 'anomalies' && (
              loadingAnomalies ? (
                <div className="glass-card p-12 flex items-center justify-center">
                  <GlassPageLoader label={t('common.loading')} />
                </div>
              ) : errAnomalies ? (
                <div className="glass-card p-8">
                  <GlassErrorState title={t('common.error')} message={getErrorMessage(eAnomalies)} />
                </div>
              ) : (
                <AnomaliesTab data={anomaliesData} t={t} />
              )
            )}

            {activeTab === 'whatif' && (
              <WhatIfTab
                t={t}
                priceIncrease={priceIncrease}
                setPriceIncrease={setPriceIncrease}
                studentVolume={studentVolume}
                setStudentVolume={setStudentVolume}
                payrollIncrease={payrollIncrease}
                setPayrollIncrease={setPayrollIncrease}
                loadingWhatIf={loadingWhatIf}
                errWhatIf={errWhatIf}
                eWhatIf={eWhatIf}
                sim={sim}
              />
            )}

            {activeTab === 'forecast' && (
              <ForecastView forecastDays={forecastDays} setForecastDays={setForecastDays} t={t} />
            )}

            {activeTab === 'reconciliation' && <ReconciliationView t={t} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default FinancialAnalyticsPage;