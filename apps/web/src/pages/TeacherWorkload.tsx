/**
 * M-EDU TeacherWorkloadPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Per-teacher deterministic gradient avatars (name hash → palette)
 *  - Radial utilization gauge per row (Apple Watch ring mini)
 *  - Status-aware accent glow (green/amber/red) with intensity by load
 *  - Animated stat tiles with count-up numbers
 *  - Cursor-tracked specular on every GlassCard
 *  - Shimmer skeleton (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Stagger entrance with spring physics
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassBadge,
  GlassErrorState,
  GlassEmptyState,
  GlassCard,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

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
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.1 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  groupsCount: number;
  studentsCount: number;
  hoursPerWeek: number;
  capacityHours: number;
  utilization: number; // 0..1
  status: 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';
}

interface TeacherWorkloadSummary {
  total: number;
  overloaded: number;
  balanced: number;
  underutilized: number;
  avgUtilization: number;
}

/* ============================================================================
 * STATUS PALETTE — Apple System Colors with glow
 * ========================================================================== */

type StatusTone = 'warning' | 'success' | 'error';

const STATUS_PALETTE: Record<StatusTone, {
  fg: string;
  bg: string;
  glow: string;
  stroke: string;
  track: string;
}> = {
  warning: {
    fg: '#FF9500',
    bg: 'rgba(255,149,0,0.12)',
    glow: 'rgba(255,149,0,0.35)',
    stroke: '#FF9500',
    track: 'rgba(255,149,0,0.14)',
  },
  success: {
    fg: '#34C759',
    bg: 'rgba(52,199,89,0.12)',
    glow: 'rgba(52,199,89,0.35)',
    stroke: '#34C759',
    track: 'rgba(52,199,89,0.14)',
  },
  error: {
    fg: '#FF3B30',
    bg: 'rgba(255,59,48,0.12)',
    glow: 'rgba(255,59,48,0.35)',
    stroke: '#FF3B30',
    track: 'rgba(255,59,48,0.14)',
  },
};

const STATUS_TONE: Record<TeacherWorkload['status'], StatusTone> = {
  UNDERUTILIZED: 'warning',
  BALANCED: 'success',
  OVERLOADED: 'error',
};

const BADGE_VARIANT: Record<TeacherWorkload['status'], 'warning' | 'success' | 'error'> = {
  UNDERUTILIZED: 'warning',
  BALANCED: 'success',
  OVERLOADED: 'error',
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  alert: [
    'M12 9v4', 'M12 17h.01',
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  pause: [
    'M10 4H6v16h4z',
    'M18 4h-4v16h4z',
  ],
  gauge: [
    'M12 14l4-4',
    'M20.5 14.5A9 9 0 1 0 3.5 14.5',
    'M12 14h.01',
  ],
  groups: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  student: [
    'M22 9 12 4 2 9l10 5z',
    'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  sparkle: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
  ],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  trend: [
    'M22 7l-8.5 8.5-5-5L2 17',
    'M16 7h6v6',
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
 * HELPERS
 * ========================================================================== */

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

/** Animated count-up number */
function CountUp({
  value, duration = 1.1, suffix = '', decimals = 0,
}: { value: number; duration?: number; suffix?: string; decimals?: number }) {
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

  const shown = decimals > 0
    ? n.toFixed(decimals)
    : Math.round(n).toLocaleString();

  return <span className="tabular-nums">{shown}{suffix}</span>;
}

/** Radial mini gauge — Apple Watch style utilization ring */
function UtilizationRing({
  value, tone, size = 52, stroke = 5,
}: {
  value: number; tone: StatusTone; size?: number; stroke?: number;
}) {
  const c = STATUS_PALETTE[tone];
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  const arc = circ * clamped;

  // If over 100%, show a subtle overflow indicator via ring glow
  const overflow = value > 1;

  return (
    <div className="relative flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <filter id={`ring-glow-${tone}-${size}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.track} strokeWidth={stroke}
        />

        {/* Progress arc */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.stroke} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - arc }}
          transition={{ duration: 1.4, ease: EASE_APPLE, delay: 0.2 }}
          filter={`url(#ring-glow-${tone}-${size})`}
          style={overflow ? { filter: `url(#ring-glow-${tone}-${size}) drop-shadow(0 0 6px ${c.glow})` } : undefined}
        />
      </svg>

      {/* Center percentage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[11px] font-bold tabular-nums tracking-tight"
          style={{ color: c.fg }}
        >
          {Math.round(value * 100)}<span className="text-[8px] font-semibold opacity-70">%</span>
        </span>
      </div>
    </div>
  );
}

/** Premium stat tile with count-up */
function StatTile({
  label, value, icon, tone = 'blue', format,
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  format?: 'number' | 'percent' | 'string';
}) {
  const palette: Record<string, { fg: string; bg: string; glow: string }> = {
    blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)' },
    green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)' },
    orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)' },
    red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)' },
    purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)' },
  };
  const c = palette[tone];

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), ' +
          '0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Top specular */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />

      {/* Icon squircle */}
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: `linear-gradient(145deg, ${c.bg}, ${c.bg.replace('0.10', '0.04')})`,
          color: c.fg,
          border: `1px solid ${c.fg}22`,
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
            format === 'percent'
              ? <CountUp value={value} suffix="%" />
              : <CountUp value={value} />
          ) : value}
        </div>
        <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B] truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Shimmer skeleton bar */
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

/** Premium workload row */
function WorkloadRow({ teacher, index }: { teacher: TeacherWorkload; index: number }) {
  const { t } = useI18n();
  const tone = STATUS_TONE[teacher.status];
  const c = STATUS_PALETTE[tone];

  return (
    <motion.li
      variants={rowVariants}
      custom={index}
      className="group relative flex items-center gap-4 px-4 py-4 transition-colors"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      {/* Hover tint — subtle, tone-aware */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${c.bg}, transparent 60%)` }}
      />

      {/* Avatar */}
      <motion.div
        whileHover={{ scale: 1.06 }}
        transition={SPRING.snappy}
        className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
        style={{
          background: avatarGradient(teacher.teacherName),
          fontSize: '13px',
          letterSpacing: '0.02em',
          boxShadow: '0 6px 18px -6px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
        />
        <span className="relative">{getInitials(teacher.teacherName)}</span>
      </motion.div>

      {/* Name + meta */}
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {teacher.teacherName}
          </h4>
          <GlassBadge variant={BADGE_VARIANT[teacher.status]}>
            {t(`teacherWorkload.${teacher.status.toLowerCase()}`)}
          </GlassBadge>
        </div>

        {/* Meta chips */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-medium text-[#86868B]">
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.groups} size={12} strokeWidth={2} className="opacity-60" />
            <span className="tabular-nums">{teacher.groupsCount}</span>
            <span className="opacity-70">groups</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.student} size={12} strokeWidth={2} className="opacity-60" />
            <span className="tabular-nums">{teacher.studentsCount}</span>
            <span className="opacity-70">students</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.clock} size={12} strokeWidth={2} className="opacity-60" />
            <span className="tabular-nums">{teacher.hoursPerWeek}</span>
            <span className="opacity-70">/ {teacher.capacityHours}h</span>
          </span>
        </div>

        {/* Progress bar — tone aware */}
        <div
          className="mt-2.5 h-1.5 w-full max-w-md overflow-hidden rounded-full"
          style={{ background: 'var(--bg-glass)' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, teacher.utilization * 100)}%` }}
            transition={{ duration: 1.2, ease: EASE_APPLE, delay: 0.15 + index * 0.04 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${c.stroke}, color-mix(in srgb, ${c.stroke} 70%, white))`,
              boxShadow: `0 0 10px ${c.glow}`,
            }}
          />
        </div>
      </div>

      {/* Radial ring on the right */}
      <div className="relative z-10">
        <UtilizationRing value={teacher.utilization} tone={tone} />
      </div>
    </motion.li>
  );
}

/** Model legend — redesigned */
function ModelLegend() {
  const { t } = useI18n();

  const items = [
    { key: 'capacity',    icon: I.gauge,     tone: 'blue' as const },
    { key: 'hoursWeek',   icon: I.clock,     tone: 'purple' as const },
    { key: 'utilization', icon: I.trend,     tone: 'green' as const },
    { key: 'thresholds',  icon: I.alert,     tone: 'orange' as const },
  ];

  const palette: Record<string, { fg: string; bg: string }> = {
    blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)' },
    purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)' },
    green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)' },
    orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)' },
  };

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)',
            }}
          />
          <Icon paths={I.info} size={16} strokeWidth={2} className="relative" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {t('teacherWorkload.modelTitle')}
          </h3>
          <p className="text-[11.5px] font-medium text-[#86868B]">
            {t('teacherWorkload.modelSubtitle') || 'How utilization is calculated'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => {
          const c = palette[item.tone];
          return (
            <div
              key={item.key}
              className="flex items-start gap-3 rounded-xl border border-[#00000008] bg-[#00000003] px-3 py-2.5 dark:border-[#ffffff08] dark:bg-[#ffffff04]"
            >
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: c.bg, color: c.fg }}
              >
                <Icon paths={item.icon} size={13} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t(`teacherWorkload.model.${item.key}`)}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[#86868B]">
                  {t(`teacherWorkload.model.${item.key}Desc`)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

export function TeacherWorkloadPage() {
  const { t } = useI18n();
  usePageTitle(t('teacherWorkload.title'));

  const summaryQuery = useQuery({
    queryKey: ['teacher-workload-summary'],
    queryFn: () => request('/teacher-workload/summary') as Promise<TeacherWorkloadSummary>,
  });

  const teachersQuery = useQuery({
    queryKey: ['teacher-workload'],
    queryFn: () => request('/teacher-workload') as Promise<{ items: TeacherWorkload[]; total: number }>,
  });

  const teachers: TeacherWorkload[] = useMemo(
    () => teachersQuery.data?.items ?? [],
    [teachersQuery.data],
  );
  const summary = summaryQuery.data;

  const avgUtilPercent = Math.round((summary?.avgUtilization ?? 0) * 100);

  return (
    <div style={{ display: 'contents' }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />

      <div className="page-container space-y-5">
        <GlassPageHeader
          title={t('teacherWorkload.title')}
          subtitle={t('teacherWorkload.subtitle')}
        />

        {/* ============================================================
            STATS — animated tiles with count-up
        ============================================================ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 md:grid-cols-5"
        >
          <StatTile
            label={t('nav.teachers')}
            value={summary?.total ?? 0}
            icon={I.users}
            tone="blue"
          />
          <StatTile
            label={t('teacherWorkload.overloaded')}
            value={summary?.overloaded ?? 0}
            icon={I.alert}
            tone="red"
          />
          <StatTile
            label={t('teacherWorkload.balanced')}
            value={summary?.balanced ?? 0}
            icon={I.checkCircle}
            tone="green"
          />
          <StatTile
            label={t('teacherWorkload.underutilized')}
            value={summary?.underutilized ?? 0}
            icon={I.pause}
            tone="orange"
          />
          <StatTile
            label={t('teacherWorkload.avgUtilization')}
            value={avgUtilPercent}
            icon={I.gauge}
            tone="purple"
            format="percent"
          />
        </motion.div>

        {/* ============================================================
            MODEL LEGEND
        ============================================================ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.smooth, delay: 0.15 }}
        >
          <ModelLegend />
        </motion.div>

        {/* ============================================================
            WORKLOAD LIST
        ============================================================ */}
        <GlassCard className="overflow-hidden">
          <AnimatePresence mode="wait">
            {teachersQuery.isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 p-4"
              >
                {/* Skeleton rows */}
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-2xl border border-[#00000008] p-4 dark:border-[#ffffff08]"
                  >
                    <Shimmer className="h-12 w-12" radius="9999px" />
                    <div className="flex-1 space-y-2">
                      <Shimmer className="h-4 w-40" radius="0.5rem" />
                      <Shimmer className="h-3 w-64" radius="0.5rem" />
                      <Shimmer className="h-1.5 w-72" radius="9999px" />
                    </div>
                    <Shimmer className="h-14 w-14" radius="9999px" />
                  </div>
                ))}
              </motion.div>
            ) : teachersQuery.isError ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-8"
              >
                <GlassErrorState
                  message={getErrorMessage(teachersQuery.error)}
                  onRetry={() => teachersQuery.refetch()}
                />
              </motion.div>
            ) : teachers.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-8"
              >
                <GlassEmptyState
                  title={t('teacherWorkload.emptyTitle')}
                  message={t('teacherWorkload.emptyMessage')}
                />
              </motion.div>
            ) : (
              <motion.ul
                key="list"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="m-0 list-none p-0"
              >
                {teachers.map((teacher, idx) => (
                  <WorkloadRow key={teacher.teacherId} teacher={teacher} index={idx} />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </div>
  );
}