/**
 * M-EDU TeacherWorkloadPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient workload tile + live chips (Total/Overloaded/Balanced)
 *  - Ambient gradient orbs (blue + purple drift) — consistent with suite
 *  - Per-teacher deterministic gradient avatars (name hash → palette)
 *  - Radial utilization gauge per row (Apple Watch ring mini)
 *  - Status-aware accent glow (green/amber/red) with intensity by load
 *  - Animated stat tiles with count-up numbers
 *  - Shimmer skeleton (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Stagger entrance with spring physics
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
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

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
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
  retentionRate?: number;
  attendanceRate?: number;
  avgGrade?: number;
  hourlyRate?: number;
  baseSalary?: number;
  bonusSalary?: number;
  estimatedSalary?: number;
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

const I: Record<string, string[]> = {
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
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
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
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  wallet: [
    'M21 12V7H5a2 2 0 0 1 0-4h14v4',
    'M3 5v14a2 2 0 0 0 2 2h16v-5',
    'M18 12a2 2 0 0 0 0 4h4v-4Z',
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

/** Ambient gradient orbs — consistent with suite */
function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

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

        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.track} strokeWidth={stroke}
        />

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
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />

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

/** Premium workload row with KPI metrics & Smart Salary breakdown */
function WorkloadRow({ teacher, index }: { teacher: TeacherWorkload; index: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const tone = STATUS_TONE[teacher.status];
  const c = STATUS_PALETTE[tone];

  const retention = teacher.retentionRate ?? 92;
  const attendance = teacher.attendanceRate ?? 88;
  const avgGrade = teacher.avgGrade ?? 86;
  const hourlyRate = teacher.hourlyRate ?? 120000;
  const baseSalary = teacher.baseSalary ?? 2500000;
  const bonusSalary = teacher.bonusSalary ?? 900000;
  const estimatedSalary =
    teacher.estimatedSalary ??
    (baseSalary + Math.round(teacher.hoursPerWeek * 4.2 * hourlyRate) + bonusSalary);

  return (
    <motion.li
      variants={rowVariants}
      custom={index}
      className="group relative flex flex-col px-4 py-4 transition-colors"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${c.bg}, transparent 60%)` }}
      />

      <div className="relative z-10 flex items-center gap-4">
        {/* Avatar */}
        <motion.div
          whileHover={{ scale: 1.06 }}
          transition={SPRING.snappy}
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
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
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {teacher.teacherName}
            </h4>
            <GlassBadge variant={BADGE_VARIANT[teacher.status]}>
              {t(`teacherWorkload.${teacher.status.toLowerCase()}`)}
            </GlassBadge>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-medium text-[#86868B]">
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.groups} size={12} strokeWidth={2} className="opacity-60" />
              <span className="tabular-nums">{teacher.groupsCount}</span>
              <span className="opacity-70">{t('nav.groups') || 'groups'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.student} size={12} strokeWidth={2} className="opacity-60" />
              <span className="tabular-nums">{teacher.studentsCount}</span>
              <span className="opacity-70">{t('nav.students') || 'students'}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.clock} size={12} strokeWidth={2} className="opacity-60" />
              <span className="tabular-nums">{teacher.hoursPerWeek}</span>
              <span className="opacity-70">/ {teacher.capacityHours}h</span>
            </span>

            {/* KPI Badges */}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-500 dark:text-emerald-400">
              🎯 {retention}% Retention
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-blue-500 dark:text-blue-400">
              📋 {attendance}% Davomat
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-purple-500 dark:text-purple-400">
              ⭐ {avgGrade}% Baholar
            </span>
          </div>

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

        {/* Right side: Ring + Salary preview button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 transition-all hover:bg-emerald-500/20 dark:text-emerald-400"
            title="Smart maosh tafsiloti"
          >
            <Icon paths={I.wallet} size={14} />
            <span className="tabular-nums">{(estimatedSalary / 1000000).toFixed(1)}M</span>
            <Icon paths={expanded ? I.chevronUp : I.chevronDown} size={12} />
          </button>

          <UtilizationRing value={teacher.utilization} tone={tone} />
        </div>
      </div>

      {/* Expanded Smart Salary Breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={SPRING.smooth}
            className="relative z-10 mt-3 overflow-hidden border-t border-[#00000010] pt-3 dark:border-white/10"
          >
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-black/[0.03] p-3.5 text-xs dark:bg-white/[0.04] sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                  Fiksa Oklad
                </span>
                <span className="tabular-nums font-bold text-[#1D1D1F] dark:text-white">
                  {baseSalary.toLocaleString()} so’m
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                  Dars soatlari ({teacher.hoursPerWeek}h/h)
                </span>
                <span className="tabular-nums font-bold text-[#1D1D1F] dark:text-white">
                  {Math.round(teacher.hoursPerWeek * 4.2 * hourlyRate).toLocaleString()} so’m
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                  KPI Bonuslari
                </span>
                <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  +{bonusSalary.toLocaleString()} so’m
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                  Jami Hisoblangan
                </span>
                <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-300">
                  {estimatedSalary.toLocaleString()} so’m
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/** Model legend */
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

import { useSafeI18n } from '@/i18n/I18nProvider';

function SmartPayrollCalculator({ teachers }: { teachers: TeacherWorkload[] }) {
  const { t } = useSafeI18n();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('custom');
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(20);
  const [hourlyRate, setHourlyRate] = useState<number>(120000);
  const [retentionRate, setRetentionRate] = useState<number>(92);
  const [attendanceRate, setAttendanceRate] = useState<number>(88);

  const handleTeacherChange = (id: string) => {
    setSelectedTeacherId(id);
    if (id !== 'custom') {
      const found = teachers.find((t) => t.teacherId === id);
      if (found) {
        setHoursPerWeek(found.hoursPerWeek || 20);
        setHourlyRate(found.hourlyRate || 120000);
        setRetentionRate(found.retentionRate || 92);
        setAttendanceRate(found.attendanceRate || 88);
      }
    }
  };

  const baseSalary = 2500000;
  const hoursEarnings = Math.round(hoursPerWeek * 4.2 * hourlyRate);
  const retentionBonus = retentionRate >= 90 ? 500000 : 0;
  const attendanceBonus = attendanceRate >= 85 ? 400000 : 0;
  const totalSalary = baseSalary + hoursEarnings + retentionBonus + attendanceBonus;

  return (
    <GlassCard className="relative overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-950/15 via-slate-900/40 to-slate-950/60 p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-4 border-b border-[#00000010] pb-5 dark:border-white/10 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-2xl text-emerald-400 shadow-lg shadow-emerald-500/10">
            💎
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-[#1D1D1F] dark:text-white">
                Smart Payroll & KPI Kalkulyatori
              </h3>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                {t('workload.autoCalc') || 'Auto-calc'}
              </span>
            </div>
            <p className="text-xs text-[#86868B]">
              {t('workload.calcDesc') || 'Transparent salary calculation based on teacher hours and KPI'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-[#86868B]">{t('workload.teacher') || 'Teacher:'}</label>
          <select
            value={selectedTeacherId}
            onChange={(e) => handleTeacherChange(e.target.value)}
            className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] backdrop-blur-md outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-white/15 dark:bg-slate-800/80 dark:text-white"
          >
            <option value="custom">{t('workload.customSim') || '✨ Custom simulator'}</option>
            {teachers.map((t) => (
              <option key={t.teacherId} value={t.teacherId}>
                {t.teacherName} ({t.hoursPerWeek}h/h)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative z-10 mt-6 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#1D1D1F] dark:text-slate-300">
              <span>⏱️ Haftalik dars:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{hoursPerWeek} soat/hafta</span>
            </div>
            <input
              type="range"
              min="2"
              max="45"
              value={hoursPerWeek}
              onChange={(e) => { setSelectedTeacherId('custom'); setHoursPerWeek(Number(e.target.value)); }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#86868B]">
              <span>2 soat</span>
              <span>Oyiga ~{Math.round(hoursPerWeek * 4.2)} soat</span>
              <span>45 soat</span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#1D1D1F] dark:text-slate-300">
              <span>💵 Soatlik stavka:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{hourlyRate.toLocaleString()} so’m</span>
            </div>
            <input
              type="range"
              min="50000"
              max="300000"
              step="10000"
              value={hourlyRate}
              onChange={(e) => { setSelectedTeacherId('custom'); setHourlyRate(Number(e.target.value)); }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#86868B]">
              <span>50k so’m</span>
              <span>Stavka</span>
              <span>300k so’m</span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#1D1D1F] dark:text-slate-300">
              <span>🎯 Retention (Saqlash):</span>
              <span className={`font-bold ${retentionRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {retentionRate}% {retentionRate >= 90 ? '🏆 Bonus bor!' : ''}
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="100"
              value={retentionRate}
              onChange={(e) => { setSelectedTeacherId('custom'); setRetentionRate(Number(e.target.value)); }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#86868B]">
              <span>60%</span>
              <span>Chegara: ≥90% (+500k)</span>
              <span>100%</span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[#1D1D1F] dark:text-slate-300">
              <span>📋 Davomat ko’rsatkichi:</span>
              <span className={`font-bold ${attendanceRate >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {attendanceRate}% {attendanceRate >= 85 ? '⭐ Bonus bor!' : ''}
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="100"
              value={attendanceRate}
              onChange={(e) => { setSelectedTeacherId('custom'); setAttendanceRate(Number(e.target.value)); }}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[#86868B]">
              <span>60%</span>
              <span>Chegara: ≥85% (+400k)</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-slate-950/90 p-5 shadow-xl lg:col-span-5">
          <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-emerald-400">
            <span>Oylik Maosh Tarkibi</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-300">Shaffof formula</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                Asosiy oklad (Fiksa):
              </span>
              <span className="font-semibold text-white">{baseSalary.toLocaleString()} so’m</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Dars soatlari ({Math.round(hoursPerWeek * 4.2)} soat):
              </span>
              <span className="font-semibold text-white">{hoursEarnings.toLocaleString()} so’m</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${retentionBonus > 0 ? 'bg-amber-400' : 'bg-slate-600'}`} />
                Retention Bonusi (≥90%):
              </span>
              <span className={`font-semibold ${retentionBonus > 0 ? 'text-amber-300' : 'text-slate-500 line-through'}`}>
                {retentionBonus > 0 ? `+${retentionBonus.toLocaleString()} so’m` : '0 so’m'}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${attendanceBonus > 0 ? 'bg-purple-400' : 'bg-slate-600'}`} />
                Davomat Bonusi (≥85%):
              </span>
              <span className={`font-semibold ${attendanceBonus > 0 ? 'text-purple-300' : 'text-slate-500 line-through'}`}>
                {attendanceBonus > 0 ? `+${attendanceBonus.toLocaleString()} so’m` : '0 so’m'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Jami Kutilayotgan Maosh
              </span>
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-white bg-clip-text text-2xl font-black tracking-tight text-transparent">
                {totalSalary.toLocaleString()}
              </span>
              <span className="ml-1 text-xs font-semibold text-slate-400">so’m</span>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                +{Math.round(((retentionBonus + attendanceBonus) / (totalSalary || 1)) * 100)}% KPI
              </span>
            </div>
          </div>
        </div>
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
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* Gradient workload tile */}
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
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.gauge} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Workload
                </span>
                {(summary?.overloaded ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B30]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF3B30]">
                    <span className="relative flex h-1.5 w-1.5">
                      <motion.span
                        className="absolute inset-0 rounded-full bg-[#FF3B30]"
                        animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#FF3B30]" />
                    </span>
                    {summary?.overloaded ?? 0} {t('teacherWorkload.overloaded')}
                  </span>
                )}
                {(summary?.balanced ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                    {summary?.balanced ?? 0} {t('teacherWorkload.balanced')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('teacherWorkload.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('teacherWorkload.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          STATS
      ============================================================ */}
      <motion.div
        variants={containerVariants}
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
          SMART PAYROLL & KPI CALCULATOR
      ============================================================ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING.smooth, delay: 0.12 }}
      >
        <SmartPayrollCalculator teachers={teachers} />
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
    </motion.div>
  );
}
