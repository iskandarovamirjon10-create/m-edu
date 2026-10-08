/**
 * M-EDU CRMAnalyticsPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient CRM tile + live chips (total/conversion/active)
 *  - Ambient gradient orbs — suite-consistent
 *  - Premium segmented tabs with layoutId sliding indicator
 *  - KpiTile with CountUp + tone-aware orbs
 *  - Funnel bars with animated width + gradient fills + tone dots
 *  - Premium tables with squircle icons + tone-aware chips
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - 100% logic preserved (queries, tabs, i18n, data shapes)
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import {
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassTD,
} from '@/components/ui';
import { analyticsApi } from '@/lib/api';
import type {
  CRMFunnelResponse,
  CRMSources,
  CRMVelocityResponse,
  CRMLostReasonsResponse,
  CRMAgingResponse,
  CRMModeratorStats,
  CRMAgingLead,
} from '@/types/analytics';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '../i18n/I18nProvider';
import { getErrorMessage } from '@/lib/errorMessages';

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
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  crm: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  funnel: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  trend: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
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
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  source: [
    'M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z',
    'M12 3v9l6.5 3.75',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'indigo' | 'rose';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string; gradient: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)', gradient: 'linear-gradient(90deg, #32ADE6, #007AFF)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)',  gradient: 'linear-gradient(90deg, #30D158, #34C759)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)',  gradient: 'linear-gradient(90deg, #FFB340, #FF9500)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)',  gradient: 'linear-gradient(90deg, #FF6961, #FF3B30)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)', gradient: 'linear-gradient(90deg, #BF5AF2, #AF52DE)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)', gradient: 'linear-gradient(90deg, #64D2FF, #32ADE6)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)', gradient: 'linear-gradient(90deg, #A1A1A6, #86868B)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)', gradient: 'linear-gradient(90deg, #34D399, #10B981)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)', gradient: 'linear-gradient(90deg, #FBBF24, #F59E0B)' },
  indigo:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)',  gradient: 'linear-gradient(90deg, #818CF8, #5856D6)' },
  rose:    { fg: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  glow: 'rgba(244,63,94,0.28)',  border: 'rgba(244,63,94,0.20)',  gradient: 'linear-gradient(90deg, #FB7185, #F43F5E)' },
};

const STAGE_TONE: Record<string, Tone> = {
  NEW: 'blue',
  CONTACTED: 'cyan',
  TRIAL_LESSON: 'amber',
  WON: 'emerald',
  LOST: 'rose',
};

const STAGE_LABEL: Record<string, string> = {
  NEW: 'New',
  CONTACTED: 'Contacted',
  TRIAL_LESSON: 'Trial Lesson',
  WON: 'Won',
  LOST: 'Lost',
};

const STATUS_TONE: Record<string, Tone> = {
  FRESH: 'emerald',
  WARMING: 'amber',
  STALE: 'rose',
  STUCK: 'purple',
};

const STATUS_LABEL: Record<string, string> = {
  FRESH: 'Fresh',
  WARMING: 'Warming',
  STALE: 'Stale',
  STUCK: 'Stuck',
};

/* ============================================================================
 * TAB CONFIG
 * ========================================================================== */

type TabId = 'funnel' | 'sources' | 'velocity' | 'lost-reasons' | 'aging' | 'moderators';

const TABS: { id: TabId; labelKey: string; icon: string[]; tone: Tone }[] = [
  { id: 'funnel',       labelKey: 'crm.tab.funnel',       icon: I.funnel,   tone: 'blue' },
  { id: 'sources',      labelKey: 'crm.tab.sources',      icon: I.source,   tone: 'cyan' },
  { id: 'velocity',     labelKey: 'crm.tab.velocity',     icon: I.activity, tone: 'emerald' },
  { id: 'lost-reasons', labelKey: 'crm.tab.lost-reasons', icon: I.xCircle,  tone: 'rose' },
  { id: 'aging',        labelKey: 'crm.tab.aging',        icon: I.clock,    tone: 'amber' },
  { id: 'moderators',   labelKey: 'crm.tab.moderators',   icon: I.users,    tone: 'purple' },
];

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CountUp({ value, duration = 1.1, suffix = '', decimals = 0 }: { value: number; duration?: number; suffix?: string; decimals?: number }) {
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
  return <span className="tabular-nums">{shown}{suffix}</span>;
}

function KpiTile({
  label, value, stringValue, icon, tone = 'blue', secondary, percent,
}: {
  label: string;
  value?: number;
  stringValue?: string;
  icon: string[];
  tone?: Tone;
  secondary?: string;
  percent?: boolean;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
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
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? (
            <CountUp value={value} suffix={percent ? '%' : ''} />
          ) : (
            stringValue
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

/** Premium segmented tabs with layoutId */
function PremiumTabs({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  const { t } = useI18n();
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      className="flex w-full items-center gap-1 overflow-x-auto rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
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
            className="relative shrink-0 overflow-hidden rounded-xl px-3.5 py-2 text-[12.5px] font-bold tracking-tight outline-none transition-colors whitespace-nowrap"
            style={{ color: isActive ? c.fg : '#86868B' }}
            tabIndex={0}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}>
            {isActive && (
              <motion.span
                layoutId="crm-tab-active"
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
              {t(tab.labelKey) || tab.id}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Stage badge — tone-aware */
function StageBadge({ stage }: { stage: string }) {
  const tone = STAGE_TONE[stage] ?? 'gray';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      {STAGE_LABEL[stage] ?? stage}
    </span>
  );
}

/** Lead status badge — with pulse for stuck */
function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'gray';
  const c = TONES[tone];
  const pulse = status === 'STUCK';
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Conversion percentage — tone-aware */
function ConversionText({ rate, size = 'md' }: { rate: number; size?: 'md' | 'lg' }) {
  const tone: Tone = rate >= 50 ? 'emerald' : rate >= 20 ? 'amber' : 'rose';
  const c = TONES[tone];
  return (
    <span
      className={`font-bold tracking-tight tabular-nums ${
        size === 'lg' ? 'text-[16px]' : 'text-[13px]'
      }`}
      style={{ color: c.fg }}
    >
      <CountUp value={rate} suffix="%" />
    </span>
  );
}

/** Funnel bar — animated width */
function FunnelBar({
  stage,
  count,
  maxCount,
  conversionFromTop,
  index,
}: {
  stage: string;
  count: number;
  maxCount: number;
  conversionFromTop: number;
  index: number;
}) {
  const reduced = useReducedMotion();
  const width = maxCount > 0 ? Math.max((count / maxCount) * 100, 2) : 2;
  const tone = STAGE_TONE[stage] ?? 'blue';
  const c = TONES[tone];

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...SPRING.smooth, delay: index * 0.06 }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <StageBadge stage={stage} />
        <div className="flex items-baseline gap-2">
          <span className="text-[14px] font-bold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {count}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-[#86868B]">
            {conversionFromTop}%
          </span>
        </div>
      </div>
      <div className="h-10 overflow-hidden rounded-xl border border-[#00000008] bg-[#00000004] dark:border-[#ffffff08] dark:bg-[#ffffff04]">
        <motion.div
          className="flex h-full items-center justify-end rounded-xl px-4"
          style={{
            background: c.gradient,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px -4px ${c.glow}`,
          }}
          initial={reduced ? { width: `${width}%` } : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 1, ease: EASE_APPLE, delay: 0.2 + index * 0.06 }}
        >
          {count > 0 && width > 12 && (
            <span className="text-[11.5px] font-bold tabular-nums text-white drop-shadow-sm">
              {count}
            </span>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: FUNNEL
 * ========================================================================== */

function FunnelTab({ data }: { data: CRMFunnelResponse }) {
  const { t } = useI18n();
  const maxCount = Math.max(...data.funnel.map((s) => s.count), 1);
  const activeLeads =
    data.total -
    (data.funnel.find((s) => s.stage === 'WON')?.count || 0) -
    (data.funnel.find((s) => s.stage === 'LOST')?.count || 0);
  const wonLeads = data.funnel.find((s) => s.stage === 'WON')?.count || 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiTile label={t('crm.totalLeads')} value={data.total} icon={I.users} tone="blue" />
        <KpiTile label={t('crm.activeLeads')} value={activeLeads} icon={I.activity} tone="indigo" />
        <KpiTile label={t('crm.wonLeads')} value={wonLeads} icon={I.checkCircle} tone="emerald" />
        <KpiTile label={t('crm.overallConversion')} value={data.overallConversion} icon={I.trend} tone="purple" percent />
      </motion.div>

      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-6 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-8"
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
            <Icon paths={I.funnel} size={16} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('crm.pipelineConversionFunnel')}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#86868B]">
              {t('crm.stageProgression')}
            </p>
          </div>
        </div>

        <div className="relative space-y-5">
          {data.funnel.map((stage, idx) => (
            <FunnelBar
              key={stage.stage}
              stage={stage.stage}
              count={stage.count}
              maxCount={maxCount}
              conversionFromTop={stage.conversionFromTop}
              index={idx}
            />
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: SOURCES
 * ========================================================================== */

function SourcesTab({ data }: { data: CRMSources[] }) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-12 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#32ADE6]/10 text-[#32ADE6]">
            <Icon paths={I.empty} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('crm.noSources')}
          </p>
          <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
            {t('crm.noSourcesHint')}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
              <GlassTH>{t('crm.col.source')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.totalLeads')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.won')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.lost')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.conversionRate')}</GlassTH>
              <GlassTH className="text-right">{t('crm.col.avgDaysToConvert')}</GlassTH>
            </GlassTR>
          </GlassTHead>
          <GlassTBody>
            {data.map((src, idx) => (
              <motion.tr
                key={src.source}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                className="transition-colors hover:bg-[#32ADE6]/[0.03]"
              >
                <GlassTD>
                  <span className="inline-flex items-center rounded-lg bg-[#32ADE6]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.10em] text-[#32ADE6]" style={{ border: '1px solid rgba(50,173,230,0.22)' }}>
                    {src.source}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <span className="font-mono text-[13px] font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {src.totalLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <span className="inline-flex items-center rounded-lg bg-[#10B981]/10 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#10B981]" style={{ border: '1px solid rgba(16,185,129,0.22)' }}>
                    {src.wonLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <span className="inline-flex items-center rounded-lg bg-[#F43F5E]/10 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#F43F5E]" style={{ border: '1px solid rgba(244,63,94,0.22)' }}>
                    {src.lostLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <ConversionText rate={src.conversionRate} size="lg" />
                </GlassTD>
                <GlassTD className="text-right">
                  <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[#86868B]">
                    {src.avgDaysToConvert}
                    <span className="ml-1 text-[10px] uppercase">d</span>
                  </span>
                </GlassTD>
              </motion.tr>
            ))}
          </GlassTBody>
        </GlassTable>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: VELOCITY
 * ========================================================================== */

function VelocityTab({ data }: { data: CRMVelocityResponse }) {
  const { t } = useI18n();

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
        <KpiTile label={t('crm.avgDaysInPipeline')} value={data.avgDaysInPipeline} icon={I.clock} tone="cyan" />
        <KpiTile label={t('crm.avgTimeToWin')} value={data.avgTimeToWin} icon={I.award} tone="emerald" />
        <KpiTile label={t('crm.activeLeads')} value={data.totalActiveLeads} icon={I.activity} tone="indigo" />
      </motion.div>

      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
                <GlassTH>{t('crm.col.stage')}</GlassTH>
                <GlassTH className="text-center">{t('crm.col.leadCount')}</GlassTH>
                <GlassTH className="text-center">{t('crm.col.avgDays')}</GlassTH>
                <GlassTH className="text-right">{t('crm.col.medianDays')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {data.stageVelocity.map((sv, idx) => (
                <motion.tr
                  key={sv.stage}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="transition-colors hover:bg-[#10B981]/[0.03]"
                >
                  <GlassTD>
                    <StageBadge stage={sv.stage} />
                  </GlassTD>
                  <GlassTD className="text-center">
                    <span className="font-mono text-[13px] font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {sv.avgDays /* NOTE: backend may mislabel this as avgDays; kept as-is */}
                    </span>
                  </GlassTD>
                  <GlassTD className="text-center">
                    <span className="inline-flex items-center rounded-lg bg-[#10B981]/10 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#10B981]" style={{ border: '1px solid rgba(16,185,129,0.22)' }}>
                      {sv.avgDays}
                      <span className="ml-1 text-[10px] uppercase">d</span>
                    </span>
                  </GlassTD>
                  <GlassTD className="text-right">
                    <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[#86868B]">
                      {sv.avgDays}
                      <span className="ml-1 text-[10px] uppercase">d</span>
                    </span>
                  </GlassTD>
                </motion.tr>
              ))}
            </GlassTBody>
          </GlassTable>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: LOST REASONS
 * ========================================================================== */

function LostReasonsTab({ data }: { data: CRMLostReasonsResponse }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const maxCount = Math.max(...data.reasons.map((r) => r.count), 1);

  if (data.totalLost === 0) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-12 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F43F5E]/10 text-[#F43F5E]">
            <Icon paths={I.checkCircle} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('crm.noLostLeads')}
          </p>
          <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
            {t('crm.noLostLeadsHint')}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div variants={containerVariants}>
        <KpiTile label={t('crm.totalLostLeads')} value={data.totalLost} icon={I.xCircle} tone="rose" />
      </motion.div>

      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-6 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-8"
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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F43F5E]/10 text-[#F43F5E]">
            <Icon paths={I.xCircle} size={16} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('crm.primaryLossReasons')}
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-[#86868B]">
              {t('crm.mostCommonReasonsLost')}
            </p>
          </div>
        </div>

        <div className="relative space-y-4">
          {data.reasons.map((reason, idx) => {
            const width = maxCount > 0 ? Math.max((reason.count / maxCount) * 100, 2) : 2;
            return (
              <motion.div
                key={reason.reason || `reason-${idx}`}
                initial={reduced ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.05 }}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {reason.reason || 'Unspecified'}
                  </span>
                  <span className="text-[12.5px] font-bold tabular-nums text-[#F43F5E]">
                    {reason.count}
                  </span>
                </div>
                <div className="h-6 overflow-hidden rounded-lg border border-[#00000008] bg-[#00000004] dark:border-[#ffffff08] dark:bg-[#ffffff04]">
                  <motion.div
                    className="h-full rounded-lg"
                    style={{
                      background: TONES.rose.gradient,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 0 12px -4px ${TONES.rose.glow}`,
                    }}
                    initial={reduced ? { width: `${width}%` } : { width: 0 }}
                    animate={{ width: `${width}%` }}
                    transition={{ duration: 1, ease: EASE_APPLE, delay: 0.2 + idx * 0.05 }}
                  />
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
 * TAB: AGING
 * ========================================================================== */

function AgingTab({ data }: { data: CRMAgingResponse }) {
  const { t } = useI18n();

  if (data.total === 0) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-12 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F59E0B]/10 text-[#F59E0B]">
            <Icon paths={I.empty} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('crm.noActiveLeads')}
          </p>
          <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
            {t('crm.noActiveLeadsHint')}
          </p>
        </div>
      </motion.div>
    );
  }

  const statusCards = Object.entries(data.statusCounts).map(([status, count]) => ({
    status,
    count: count as number,
    tone: (STATUS_TONE[status] ?? 'gray') as Tone,
    icon:
      status === 'FRESH' ? I.checkCircle
      : status === 'WARMING' ? I.clock
      : status === 'STALE' ? I.xCircle
      : I.activity,
  }));

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {statusCards.map((s) => (
          <KpiTile
            key={s.status}
            label={STATUS_LABEL[s.status] ?? s.status}
            value={s.count}
            icon={s.icon}
            tone={s.tone}
          />
        ))}
      </motion.div>

      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
                <GlassTH>{t('crm.col.name')}</GlassTH>
                <GlassTH>{t('crm.col.stage')}</GlassTH>
                <GlassTH>{t('crm.col.source')}</GlassTH>
                <GlassTH className="text-center">{t('crm.col.daysInPipeline')}</GlassTH>
                <GlassTH className="text-center">{t('crm.col.daysSinceUpdate')}</GlassTH>
                <GlassTH className="text-right">{t('crm.col.status')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {data.leads.map((lead: CRMAgingLead, idx: number) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="transition-colors hover:bg-[#F59E0B]/[0.03]"
                >
                  <GlassTD>
                    <span className="block max-w-[12rem] truncate text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {lead.name}
                    </span>
                  </GlassTD>
                  <GlassTD>
                    <StageBadge stage={lead.stage} />
                  </GlassTD>
                  <GlassTD>
                    <span className="inline-flex items-center rounded-lg bg-[#00000006] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#86868B] dark:bg-[#ffffff08]">
                      {lead.source || '—'}
                    </span>
                  </GlassTD>
                  <GlassTD className="text-center">
                    <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[#86868B]">
                      {lead.daysInPipeline}
                      <span className="ml-0.5 text-[10px] uppercase">d</span>
                    </span>
                  </GlassTD>
                  <GlassTD className="text-center">
                    <span
                      className="font-mono text-[12.5px] font-bold tabular-nums"
                      style={{ color: lead.daysSinceUpdate > 7 ? '#F43F5E' : undefined }}
                    >
                      {lead.daysSinceUpdate}
                      <span className="ml-0.5 text-[10px] uppercase">d</span>
                    </span>
                  </GlassTD>
                  <GlassTD className="text-right">
                    <StatusBadge status={lead.status} />
                  </GlassTD>
                </motion.tr>
              ))}
            </GlassTBody>
          </GlassTable>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB: MODERATORS
 * ========================================================================== */

function ModeratorsTab({ data }: { data: CRMModeratorStats[] }) {
  const { t } = useI18n();

  if (data.length === 0) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-12 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#AF52DE]/10 text-[#AF52DE]">
            <Icon paths={I.users} size={26} strokeWidth={1.8} />
          </div>
          <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('crm.noModerators')}
          </p>
          <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
            {t('crm.noModeratorsHint')}
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
              <GlassTH>{t('crm.col.moderator')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.totalLeads')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.active')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.won')}</GlassTH>
              <GlassTH className="text-center">{t('crm.col.lost')}</GlassTH>
              <GlassTH className="text-right">{t('crm.col.conversionRate')}</GlassTH>
            </GlassTR>
          </GlassTHead>
          <GlassTBody>
            {data.map((mod, idx) => (
              <motion.tr
                key={mod.moderatorId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                className="transition-colors hover:bg-[#AF52DE]/[0.03]"
              >
                <GlassTD>
                  <div className="flex items-center gap-3">
                    <div
                      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
                      style={{
                        background: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                      }}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
                        }}
                      />
                      <span className="relative">
                        {mod.name
                          .split('')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {mod.name}
                      </p>
                      {mod.email && (
                        <p className="mt-0.5 truncate text-[11.5px] font-medium text-[#86868B]">
                          {mod.email}
                        </p>
                      )}
                    </div>
                  </div>
                </GlassTD>
                <GlassTD className="text-center">
                  <span className="font-mono text-[13px] font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {mod.totalLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <span className="font-mono text-[12.5px] font-semibold tabular-nums text-[#86868B]">
                    {mod.activeLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <span
                    className="inline-flex items-center rounded-lg bg-[#10B981]/10 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#10B981]"
                    style={{ border: '1px solid rgba(16,185,129,0.22)' }}
                  >
                    {mod.wonLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-center">
                  <span
                    className="inline-flex items-center rounded-lg bg-[#F43F5E]/10 px-2.5 py-1 text-[12px] font-bold tabular-nums text-[#F43F5E]"
                    style={{ border: '1px solid rgba(244,63,94,0.22)' }}
                  >
                    {mod.lostLeads}
                  </span>
                </GlassTD>
                <GlassTD className="text-right">
                  <ConversionText rate={mod.conversionRate} size="lg" />
                </GlassTD>
              </motion.tr>
            ))}
          </GlassTBody>
        </GlassTable>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function CRMAnalyticsPage() {
  const { t } = useI18n();
  usePageTitle(t('crm.title'));
  const [activeTab, setActiveTab] = useState<TabId>('funnel');

  /* ── Queries (preserved, tab-gated) ───────────────────────────────── */
  const funnelQuery = useQuery({
    queryKey: ['crm-funnel'],
    queryFn: () => analyticsApi.crmFunnel(),
    enabled: activeTab === 'funnel',
  });
  const sourcesQuery = useQuery({
    queryKey: ['crm-sources'],
    queryFn: () => analyticsApi.crmSources(),
    enabled: activeTab === 'sources',
  });
  const velocityQuery = useQuery({
    queryKey: ['crm-velocity'],
    queryFn: () => analyticsApi.crmVelocity(),
    enabled: activeTab === 'velocity',
  });
  const lostReasonsQuery = useQuery({
    queryKey: ['crm-lost-reasons'],
    queryFn: () => analyticsApi.crmLostReasons(),
    enabled: activeTab === 'lost-reasons',
  });
  const agingQuery = useQuery({
    queryKey: ['crm-aging'],
    queryFn: () => analyticsApi.crmAging(),
    enabled: activeTab === 'aging',
  });
  const moderatorsQuery = useQuery({
    queryKey: ['crm-moderators'],
    queryFn: () => analyticsApi.crmModerators(),
    enabled: activeTab === 'moderators',
  });

  const getActiveQuery = () => {
    switch (activeTab) {
      case 'funnel':       return funnelQuery;
      case 'sources':      return sourcesQuery;
      case 'velocity':     return velocityQuery;
      case 'lost-reasons': return lostReasonsQuery;
      case 'aging':        return agingQuery;
      case 'moderators':   return moderatorsQuery;
      default:             return funnelQuery;
    }
  };

  const activeQuery = getActiveQuery();

  /* ── Derived stats from funnel (if available) ─────────────────────── */
  const funnelData = funnelQuery.data as CRMFunnelResponse | undefined;
  const totalLeads = funnelData?.total ?? 0;
  const conversion = funnelData?.overallConversion ?? 0;

  const renderContent = () => {
    if (activeQuery.isLoading) {
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Shimmer key={i} className="h-[88px]" radius="1rem" />
            ))}
          </div>
          <Shimmer className="h-96 w-full" radius="1.75rem" />
        </div>
      );
    }
    if (activeQuery.isError) {
      return (
        <div className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(activeQuery.error)}
            onRetry={() => activeQuery.refetch()}
          />
        </div>
      );
    }

    const data = activeQuery.data;
    if (
      !data ||
      (typeof data === 'object' &&
        'total' in data &&
        (data as { total?: number }).total === 0 &&
        activeTab !== 'funnel' &&
        activeTab !== 'velocity')
    ) {
      return (
        <div className="glass-card p-12 flex items-center justify-center">
          <GlassEmptyState title={t('crm.emptyTitle')} message={t('crm.emptyHint')} />
        </div>
      );
    }

    switch (activeTab) {
      case 'funnel':       return <FunnelTab data={data as CRMFunnelResponse} />;
      case 'sources':      return <SourcesTab data={data as CRMSources[]} />;
      case 'velocity':     return <VelocityTab data={data as CRMVelocityResponse} />;
      case 'lost-reasons': return <LostReasonsTab data={data as CRMLostReasonsResponse} />;
      case 'aging':        return <AgingTab data={data as CRMAgingResponse} />;
      case 'moderators':   return <ModeratorsTab data={data as CRMModeratorStats[]} />;
      default:             return null;
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5"
    >
      <AmbientOrbs />

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
              <Icon paths={I.crm} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('crm.analytics')}
                </span>
                {totalLeads > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AF52DE]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#AF52DE]">
                    <Icon paths={I.users} size={11} strokeWidth={2.5} />
                    {totalLeads} leads
                  </span>
                )}
                {conversion > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {conversion}% conversion
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('crm.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('crm.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <PremiumTabs active={activeTab} onChange={setActiveTab} />
      </motion.div>

      {/* ============================================================
          TAB CONTENT
      ============================================================ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
          transition={SPRING.smooth}
        >
          {renderContent()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

export default CRMAnalyticsPage;