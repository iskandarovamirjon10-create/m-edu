/**
 * M-EDU Teacher Workload Page
 * Teacher workload tracking, lesson hour allocations, payroll simulations, and capacity metrics.
 */

import React, { useMemo, useRef, useEffect, useState, useCallback, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassBadge,
  GlassErrorState,
  GlassEmptyState,
  GlassCard,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request, { payrollApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ============================================================================
 * MOTION TOKENS (Apple Spring Physics)
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================== */

export type WorkloadStatus = 'UNDERUTILIZED' | 'BALANCED' | 'OVERLOADED';

export interface TeacherWorkload {
  teacherId: string;
  teacherName: string;
  groupsCount: number;
  studentsCount: number;
  hoursPerWeek: number;
  capacityHours: number;
  utilization: number; // 0..1+
  status: WorkloadStatus;
  retentionRate?: number;
  attendanceRate?: number;
  avgGrade?: number;
  hourlyRate?: number;
  baseSalary?: number;
  bonusSalary?: number;
  estimatedSalary?: number;
}

export interface TeacherWorkloadSummary {
  total: number;
  overloaded: number;
  balanced: number;
  underutilized: number;
  avgUtilization: number;
}

export type StatusTone = 'warning' | 'success' | 'error';

/* ============================================================================
 * STATUS PALETTE — Apple System Colors with Glow & Rings
 * ========================================================================== */

export const STATUS_PALETTE: Record<StatusTone, {
  fg: string;
  bg: string;
  glow: string;
  stroke: string;
  track: string;
}> = {
  warning: {
    fg: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    glow: 'rgba(245,158,11,0.35)',
    stroke: '#F59E0B',
    track: 'rgba(245,158,11,0.14)',
  },
  success: {
    fg: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    glow: 'rgba(16,185,129,0.35)',
    stroke: '#10B981',
    track: 'rgba(16,185,129,0.14)',
  },
  error: {
    fg: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    glow: 'rgba(239,68,68,0.35)',
    stroke: '#EF4444',
    track: 'rgba(239,68,68,0.14)',
  },
};

export const STATUS_TONE: Record<WorkloadStatus, StatusTone> = {
  UNDERUTILIZED: 'warning',
  BALANCED: 'success',
  OVERLOADED: 'error',
};

export const BADGE_VARIANT: Record<WorkloadStatus, 'warning' | 'success' | 'error'> = {
  UNDERUTILIZED: 'warning',
  BALANCED: 'success',
  OVERLOADED: 'error',
};

/* ============================================================================
 * PURE DOMAIN HELPERS (Exported for Unit Testing)
 * ========================================================================== */

export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '—';
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

export function nameHash(str: string): number {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const AVATAR_PALETTES = [
  ['#2563EB', '#1D4ED8'],
  ['#475569', '#334155'],
  ['#059669', '#047857'],
  ['#0D9488', '#0F766E'],
  ['#4F46E5', '#4338CA'],
  ['#7C3AED', '#6D28D9'],
  ['#0284C7', '#0369A1'],
];

export function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function getWorkloadStatus(hours: number, capacity: number): WorkloadStatus {
  if (capacity <= 0) return 'BALANCED';
  const util = hours / capacity;
  if (util > 1.05) return 'OVERLOADED';
  if (util < 0.70) return 'UNDERUTILIZED';
  return 'BALANCED';
}

export interface SalaryCalculationResult {
  baseSalary: number;
  hoursEarnings: number;
  retentionBonus: number;
  attendanceBonus: number;
  totalSalary: number;
  kpiBonusPercent: number;
  monthlyHours: number;
}

export function calculateTeacherSalary({
  hoursPerWeek,
  hourlyRate,
  retentionRate,
  attendanceRate,
  baseSalary = 2500000,
}: {
  hoursPerWeek: number;
  hourlyRate: number;
  retentionRate: number;
  attendanceRate: number;
  baseSalary?: number;
}): SalaryCalculationResult {
  const safeHours = Math.max(0, hoursPerWeek);
  const safeRate = Math.max(0, hourlyRate);
  const monthlyHours = Math.round(safeHours * 4.2);
  const hoursEarnings = Math.round(monthlyHours * safeRate);
  const retentionBonus = retentionRate >= 90 ? 500000 : 0;
  const attendanceBonus = attendanceRate >= 85 ? 400000 : 0;
  const totalSalary = baseSalary + hoursEarnings + retentionBonus + attendanceBonus;
  const kpiTotal = retentionBonus + attendanceBonus;
  const kpiBonusPercent = totalSalary > 0 ? Math.round((kpiTotal / totalSalary) * 100) : 0;

  return {
    baseSalary,
    hoursEarnings,
    retentionBonus,
    attendanceBonus,
    totalSalary,
    kpiBonusPercent,
    monthlyHours,
  };
}

/* ============================================================================
 * SVG ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 2.0;

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
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  wallet: [
    'M21 12V7H5a2 2 0 0 1 0-4h14v4',
    'M3 5v14a2 2 0 0 0 2 2h16v-5',
    'M18 12a2 2 0 0 0 0 4h4v-4Z',
  ],
  search: [
    'M21 21l-4.35-4.35',
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ],
  x: [
    'M18 6L6 18',
    'M6 6l12 12',
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
 * AMBIENT AURORA BACKDROP (Specular Depth)
 * ========================================================================== */

function AuroraBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-500/10 blur-[140px] dark:bg-sky-500/10" />
      <div className="absolute -right-32 top-1/4 h-[520px] w-[520px] rounded-full bg-violet-500/10 blur-[140px] dark:bg-violet-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[480px] w-[480px] rounded-full bg-emerald-500/08 blur-[140px] dark:bg-emerald-500/08" />
    </div>
  );
}

/* ============================================================================
 * ANIMATED COUNT-UP NUMBER
 * ========================================================================== */

function CountUp({
  value,
  duration = 1.0,
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

  const shown = decimals > 0
    ? n.toFixed(decimals)
    : Math.round(n).toLocaleString();

  return <span className="tabular-nums">{shown}{suffix}</span>;
}

/* ============================================================================
 * RADIAL UTILIZATION GAUGE (Apple Watch Style Mini Ring)
 * ========================================================================== */

function UtilizationRing({
  value,
  tone,
  size = 52,
  stroke = 5,
}: {
  value: number;
  tone: StatusTone;
  size?: number;
  stroke?: number;
}) {
  const c = STATUS_PALETTE[tone];
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, value));
  const arc = circ * clamped;
  const overflow = value > 1;

  return (
    <div
      className="relative flex shrink-0 items-center justify-center select-none"
      style={{ width: size, height: size }}
      aria-label={`Utilization: ${Math.round(value * 100)}%`}
      role="meter"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={150}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.track}
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - arc }}
          transition={{ duration: 1.2, ease: EASE_APPLE, delay: 0.1 }}
          style={overflow ? { filter: `drop-shadow(0 0 4px ${c.glow})` } : undefined}
        />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className="text-[11px] font-black tabular-nums tracking-tight"
          style={{ color: c.fg }}
        >
          {Math.round(value * 100)}<span className="text-[8px] font-bold opacity-75">%</span>
        </span>
      </div>
    </div>
  );
}

/* ============================================================================
 * STAT TILE WITH SPECULAR HIGHLIGHT
 * ========================================================================== */

function StatTile({
  label,
  value,
  icon,
  tone = 'blue',
  format,
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  format?: 'number' | 'percent' | 'string';
}) {
  const palette: Record<string, { fg: string; bg: string; glow: string }> = {
    blue:   { fg: '#2563EB', bg: 'rgba(37,99,235,0.12)', glow: 'rgba(37,99,235,0.25)' },
    green:  { fg: '#10B981', bg: 'rgba(16,185,129,0.12)', glow: 'rgba(16,185,129,0.25)' },
    orange: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.12)', glow: 'rgba(245,158,11,0.25)' },
    red:    { fg: '#EF4444', bg: 'rgba(239,68,68,0.12)',  glow: 'rgba(239,68,68,0.25)' },
    purple: { fg: '#6366F1', bg: 'rgba(99,102,241,0.12)', glow: 'rgba(99,102,241,0.25)' },
  };
  const c = palette[tone];

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="liquid-glass-surface group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 px-4 py-3 shadow-sm backdrop-blur-2xl"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />

      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.fg}33`,
          boxShadow: `0 4px 12px -4px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2.2} className="relative" />
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-black tracking-tighter leading-none text-slate-900 dark:text-slate-100">
          {typeof value === 'number' ? (
            format === 'percent'
              ? <CountUp value={value} suffix="%" />
              : <CountUp value={value} />
          ) : value}
        </div>
        <div className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400 truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * SHIMMER SKELETON BAR
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/70 dark:bg-white/[0.08] ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

/* ============================================================================
 * WORKLOAD ROW WITH SMART SALARY BREAKDOWN & WCAG TOUCH TARGETS
 * ========================================================================== */

function WorkloadRow({
  teacher,
  index,
  onSidecar,
}: {
  teacher: TeacherWorkload;
  index: number;
  onSidecar: (t: TeacherWorkload) => void;
}) {
  const { t } = useSafeI18n();
  const [expanded, setExpanded] = useState(false);
  const tone = STATUS_TONE[teacher.status];
  const c = STATUS_PALETTE[tone];

  const retention = teacher.retentionRate ?? 92;
  const attendance = teacher.attendanceRate ?? 88;
  const avgGrade = teacher.avgGrade ?? 86;
  const hourlyRate = teacher.hourlyRate ?? 120000;
  const baseSalary = teacher.baseSalary ?? 2500000;

  const salaryCalc = calculateTeacherSalary({
    hoursPerWeek: teacher.hoursPerWeek,
    hourlyRate,
    retentionRate: retention,
    attendanceRate: attendance,
    baseSalary,
  });

  const estimatedSalary = teacher.estimatedSalary ?? salaryCalc.totalSalary;

  return (
    <motion.li
      variants={rowVariants}
      custom={index}
      id={`teacher-workload-${teacher.teacherId}`}
      className="group relative flex flex-col px-4 py-4 transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${c.bg}, transparent 65%)` }}
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Avatar + Details */}
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={SPRING.snappy}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-white shadow-sm ring-2 ring-white/60 dark:ring-surface-800"
            style={{
              background: avatarGradient(teacher.teacherName),
              fontSize: '13px',
              letterSpacing: '0.02em',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/30 to-transparent"
            />
            <span className="relative">{getInitials(teacher.teacherName)}</span>
          </motion.div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-[14px] font-black tracking-tight text-slate-900 dark:text-slate-100">
                {teacher.teacherName}
              </h4>
              <GlassBadge variant={BADGE_VARIANT[teacher.status]}>
                {t(`teacherWorkload.${teacher.status.toLowerCase()}`, teacher.status)}
              </GlassBadge>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Icon paths={I.groups} size={12} strokeWidth={2.2} className="opacity-70" />
                <span className="tabular-nums">{teacher.groupsCount}</span>
                <span className="opacity-75">{t('nav.groups', 'Guruhlar')}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon paths={I.student} size={12} strokeWidth={2.2} className="opacity-70" />
                <span className="tabular-nums">{teacher.studentsCount}</span>
                <span className="opacity-75">{t('nav.students', "O'quvchilar")}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <Icon paths={I.clock} size={12} strokeWidth={2.2} className="opacity-70" />
                <span className="tabular-nums font-bold text-slate-800 dark:text-slate-200">
                  {teacher.hoursPerWeek}
                </span>
                <span className="opacity-75">/ {teacher.capacityHours}h</span>
              </span>

              {/* KPI Chips */}
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                🎯 {retention}% {t('teacherWorkload.retention', 'Saqlash')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                📋 {attendance}% {t('teacherWorkload.attendance', 'Davomat')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                ⭐ {avgGrade}% {t('teacherWorkload.avgGrade', 'Baho')}
              </span>
            </div>

            {/* Utilization progress bar */}
            <div
              className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, teacher.utilization * 100)}%` }}
                transition={{ duration: 1.2, ease: EASE_APPLE, delay: 0.1 + index * 0.03 }}
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${c.stroke}, ${c.fg})`,
                  boxShadow: `0 0 8px ${c.glow}`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right side: Ring + Sidecar + Salary button (>= 44x44px touch targets) */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Split-View Sidecar Button (>= 44x44px touch target) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSidecar(teacher);
            }}
            aria-label={t('common.sidecar', 'Split-view sidecar')}
            title="Split-View Sidecar [Enter / Space]"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-white/[0.08] transition-colors"
          >
            <span className="text-[13px] leading-none">◨</span>
          </button>

          {/* Salary Breakdown Toggle Button (>= 44x44px touch target) */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={t('teacherWorkload.salaryBreakdown', 'Smart maosh tafsiloti')}
            title={t('teacherWorkload.salaryBreakdown', 'Smart maosh tafsiloti')}
            className="min-h-[44px] px-3.5 flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/20"
          >
            <Icon paths={I.wallet} size={14} strokeWidth={2.2} />
            <span className="tabular-nums">{(estimatedSalary / 1000000).toFixed(1)}M</span>
            <Icon paths={expanded ? I.chevronUp : I.chevronDown} size={12} strokeWidth={2.4} />
          </button>

          {/* Apple Watch style radial utilization ring */}
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
            className="relative z-10 mt-3 overflow-hidden border-t border-black/[0.06] pt-3 dark:border-white/[0.08]"
          >
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-black/[0.03] p-3.5 text-xs dark:bg-white/[0.04] sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('teacherWorkload.baseSalary', 'Fiksa Oklad')}
                </span>
                <span className="tabular-nums font-bold text-slate-900 dark:text-white">
                  {(baseSalary ?? 0).toLocaleString()} so'm
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('teacherWorkload.lessonHours', 'Dars soatlari')} ({teacher.hoursPerWeek}h/h)
                </span>
                <span className="tabular-nums font-bold text-slate-900 dark:text-white">
                  {(salaryCalc.hoursEarnings ?? 0).toLocaleString()} so'm
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('teacherWorkload.kpiBonuses', 'KPI Bonuslari')}
                </span>
                <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                  +{((salaryCalc.retentionBonus ?? 0) + (salaryCalc.attendanceBonus ?? 0)).toLocaleString()} so'm
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('teacherWorkload.totalEstimated', 'Jami Hisoblangan')}
                </span>
                <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-300">
                  {(estimatedSalary ?? 0).toLocaleString()} so'm
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/* ============================================================================
 * MODEL LEGEND
 * ========================================================================== */

function ModelLegend() {
  const { t } = useSafeI18n();

  const items = [
    { key: 'capacity',    icon: I.gauge,     tone: 'blue' as const },
    { key: 'hoursWeek',   icon: I.clock,     tone: 'purple' as const },
    { key: 'utilization', icon: I.trend,     tone: 'green' as const },
    { key: 'thresholds',  icon: I.alert,     tone: 'orange' as const },
  ];

  const palette: Record<string, { fg: string; bg: string }> = {
    blue:   { fg: '#2563EB', bg: 'rgba(37,99,235,0.12)' },
    purple: { fg: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
    green:  { fg: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    orange: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  };

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
          <Icon paths={I.info} size={16} strokeWidth={2.2} className="relative" />
        </div>
        <div>
          <h3 className="text-[14px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {t('teacherWorkload.modelTitle', 'Yuklama hisoblash formulasi')}
          </h3>
          <p className="text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
            {t('teacherWorkload.modelSubtitle', "Haftalik dars soatlari va maksimal quvvat ko'rsatkichi")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => {
          const c = palette[item.tone];
          return (
            <div
              key={item.key}
              className="flex items-start gap-3 rounded-xl border border-black/[0.04] bg-black/[0.02] px-3 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]"
            >
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: c.bg, color: c.fg }}
              >
                <Icon paths={item.icon} size={13} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {t(`teacherWorkload.model.${item.key}`, item.key)}
                </p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
                  {t(`teacherWorkload.model.${item.key}Desc`, '')}
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
 * SMART PAYROLL & KPI CALCULATOR (Interactive Simulator)
 * ========================================================================== */

function SmartPayrollCalculator({ teachers }: { teachers: TeacherWorkload[] }) {
  const { t } = useSafeI18n();
  const selectId = useId();
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('custom');
  const [hoursPerWeek, setHoursPerWeek] = useState<number>(20);
  const [hourlyRate, setHourlyRate] = useState<number>(120000);
  const [retentionRate, setRetentionRate] = useState<number>(92);
  const [attendanceRate, setAttendanceRate] = useState<number>(88);

  const handleTeacherChange = async (id: string) => {
    setSelectedTeacherId(id);
    if (id !== 'custom') {
      const found = teachers.find((t) => t.teacherId === id);
      if (found) {
        setHoursPerWeek(found.hoursPerWeek || 20);
        setHourlyRate(found.hourlyRate || 120000);
        setRetentionRate(found.retentionRate || 92);
        setAttendanceRate(found.attendanceRate || 88);
      }
      try {
        const kpi = await payrollApi.getSmartKpi({ teacherId: id });
        if (kpi?.pillars) {
          if (kpi.pillars.retention?.rate !== undefined) setRetentionRate(kpi.pillars.retention.rate);
          if (kpi.pillars.attendance?.rate !== undefined) setAttendanceRate(kpi.pillars.attendance.rate);
          if (kpi.pillars.discipline?.hoursWorked) {
            setHoursPerWeek(Math.max(5, Math.round(kpi.pillars.discipline.hoursWorked / 4)));
          }
        }
      } catch {
        // Fall back to found metrics
      }
    }
  };

  const salary = calculateTeacherSalary({
    hoursPerWeek,
    hourlyRate,
    retentionRate,
    attendanceRate,
  });

  return (
    <GlassCard className="relative overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-950/15 via-slate-900/40 to-slate-950/60 p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative z-10 flex flex-col justify-between gap-4 border-b border-black/[0.06] pb-5 dark:border-white/[0.08] md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/20 text-2xl text-emerald-400 shadow-lg shadow-emerald-500/10">
            💎
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t('teacherWorkload.payrollTitle', 'Smart Payroll & KPI Kalkulyatori')}
              </h3>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                {t('teacherWorkload.autoCalc', 'Auto-calc')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('teacherWorkload.calcDesc', "O'qituvchi yuklamasi va KPI ko'rsatkichlariga asoslangan shaffof maosh hisobi")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('teacherWorkload.teacherLabel', "O'qituvchi:")}
          </label>
          <select
            id={selectId}
            value={selectedTeacherId}
            onChange={(e) => handleTeacherChange(e.target.value)}
            className="min-h-[44px] rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold text-slate-900 backdrop-blur-md outline-none focus:ring-2 focus:ring-emerald-500/50 dark:border-white/15 dark:bg-slate-800/80 dark:text-white"
          >
            <option value="custom">{t('teacherWorkload.customSim', '✨ Maxsus simulyator')}</option>
            {teachers.map((t) => (
              <option key={t.teacherId} value={t.teacherId}>
                {t.teacherName} ({t.hoursPerWeek}h/h)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Simulator Sliders + Summary */}
      <div className="relative z-10 mt-6 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
          {/* Slider 1: Hours */}
          <div className="rounded-2xl border border-black/5 bg-slate-50 dark:bg-slate-900/40 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
              <span>⏱️ {t('teacherWorkload.weeklyHours', 'Haftalik dars:')}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{hoursPerWeek} soat/hafta</span>
            </div>
            <input
              type="range"
              min="2"
              max="45"
              value={hoursPerWeek}
              aria-label={t('teacherWorkload.weeklyHours', 'Haftalik dars soatlari')}
              aria-valuemin={2}
              aria-valuemax={45}
              aria-valuenow={hoursPerWeek}
              onChange={(e) => {
                setSelectedTeacherId('custom');
                setHoursPerWeek(Number(e.target.value));
              }}
              className="w-full accent-emerald-500 cursor-pointer min-h-[32px]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>2 soat</span>
              <span>Oyiga ~{salary.monthlyHours} soat</span>
              <span>45 soat</span>
            </div>
          </div>

          {/* Slider 2: Rate */}
          <div className="rounded-2xl border border-black/5 bg-slate-50 dark:bg-slate-900/40 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
              <span>💵 {t('teacherWorkload.hourlyRate', 'Soatlik stavka:')}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{hourlyRate.toLocaleString()} so'm</span>
            </div>
            <input
              type="range"
              min="50000"
              max="300000"
              step="10000"
              value={hourlyRate}
              aria-label={t('teacherWorkload.hourlyRate', 'Soatlik stavka')}
              aria-valuemin={50000}
              aria-valuemax={300000}
              aria-valuenow={hourlyRate}
              onChange={(e) => {
                setSelectedTeacherId('custom');
                setHourlyRate(Number(e.target.value));
              }}
              className="w-full accent-emerald-500 cursor-pointer min-h-[32px]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>50k</span>
              <span>{t('teacherWorkload.rate', 'Stavka')}</span>
              <span>300k</span>
            </div>
          </div>

          {/* Slider 3: Retention */}
          <div className="rounded-2xl border border-black/5 bg-slate-50 dark:bg-slate-900/40 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
              <span>🎯 {t('teacherWorkload.retention', 'Retention (Saqlash):')}</span>
              <span className={`font-bold ${retentionRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {retentionRate}% {retentionRate >= 90 ? '🏆 Bonus!' : ''}
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="100"
              value={retentionRate}
              aria-label={t('teacherWorkload.retention', 'Retention ko‘rsatkichi')}
              aria-valuemin={60}
              aria-valuemax={100}
              aria-valuenow={retentionRate}
              onChange={(e) => {
                setSelectedTeacherId('custom');
                setRetentionRate(Number(e.target.value));
              }}
              className="w-full accent-emerald-500 cursor-pointer min-h-[32px]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>60%</span>
              <span>{t('teacherWorkload.threshold', 'Chegara')}: ≥90% (+500k)</span>
              <span>100%</span>
            </div>
          </div>

          {/* Slider 4: Attendance */}
          <div className="rounded-2xl border border-black/5 bg-slate-50 dark:bg-slate-900/40 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-200">
              <span>📋 {t('teacherWorkload.attendance', "Davomat ko'rsatkichi:")}</span>
              <span className={`font-bold ${attendanceRate >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                {attendanceRate}% {attendanceRate >= 85 ? '⭐ Bonus!' : ''}
              </span>
            </div>
            <input
              type="range"
              min="60"
              max="100"
              value={attendanceRate}
              aria-label={t('teacherWorkload.attendance', 'Davomat ko‘rsatkichi')}
              aria-valuemin={60}
              aria-valuemax={100}
              aria-valuenow={attendanceRate}
              onChange={(e) => {
                setSelectedTeacherId('custom');
                setAttendanceRate(Number(e.target.value));
              }}
              className="w-full accent-emerald-500 cursor-pointer min-h-[32px]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-slate-500 dark:text-slate-400">
              <span>60%</span>
              <span>{t('teacherWorkload.threshold', 'Chegara')}: ≥85% (+400k)</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Salary Result Breakdown Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/60 to-slate-950/90 p-5 shadow-xl lg:col-span-5">
          <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-emerald-400">
            <span>{t('teacherWorkload.salaryBreakdownTitle', 'Oylik Maosh Tarkibi')}</span>
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] text-emerald-300">
              {t('teacherWorkload.transparentFormula', 'Shaffof formula')}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                {t('teacherWorkload.baseSalary', 'Asosiy oklad (Fiksa):')}
              </span>
              <span className="font-semibold text-white">{(salary.baseSalary ?? 0).toLocaleString()} so'm</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {t('teacherWorkload.lessonHours', 'Dars soatlari')} ({salary.monthlyHours} soat):
              </span>
              <span className="font-semibold text-white">{(salary.hoursEarnings ?? 0).toLocaleString()} so'm</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${salary.retentionBonus > 0 ? 'bg-amber-400' : 'bg-slate-600'}`} />
                Retention Bonusi (≥90%):
              </span>
              <span className={`font-semibold ${salary.retentionBonus > 0 ? 'text-amber-300' : 'text-slate-500 line-through'}`}>
                {salary.retentionBonus > 0 ? `+${(salary.retentionBonus ?? 0).toLocaleString()} so'm` : "0 so'm"}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${salary.attendanceBonus > 0 ? 'bg-purple-400' : 'bg-slate-600'}`} />
                Davomat Bonusi (≥85%):
              </span>
              <span className={`font-semibold ${salary.attendanceBonus > 0 ? 'text-purple-300' : 'text-slate-500 line-through'}`}>
                {salary.attendanceBonus > 0 ? `+${(salary.attendanceBonus ?? 0).toLocaleString()} so'm` : "0 so'm"}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {t('teacherWorkload.totalEstimatedSalary', 'Jami Kutilayotgan Maosh')}
              </span>
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-white bg-clip-text text-2xl font-black tracking-tight text-transparent">
                {(salary.totalSalary ?? 0).toLocaleString()}
              </span>
              <span className="ml-1 text-xs font-semibold text-slate-400">so'm</span>
            </div>
            <div className="text-right">
              <span className="inline-block rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                +{salary.kpiBonusPercent}% KPI
              </span>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================================
 * MAIN COMPONENT: TeacherWorkloadPage
 * ========================================================================== */

export function TeacherWorkloadPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('teacherWorkload.title', "O'qituvchilar yuklamasi"));

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

  const [filterStatus, setFilterStatus] = useState<'ALL' | WorkloadStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTeachers = useMemo(() => {
    return teachers.filter((tw) => {
      if (filterStatus !== 'ALL' && tw.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        if (!tw.teacherName.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [teachers, filterStatus, searchQuery]);

  const { playTick } = usePremiumSound();

  const handleOpenTeacherWorkloadSidecar = useCallback(
    (tw: TeacherWorkload) => {
      const statusLabel =
        tw.status === 'BALANCED'
          ? t('teacherWorkload.balanced', 'Muvozanatda')
          : tw.status === 'OVERLOADED'
            ? t('teacherWorkload.overloaded', "Ortiqcha yuklama")
            : t('teacherWorkload.underutilized', 'Kam yuklama');
      const tone =
        tw.status === 'BALANCED' ? 'emerald' :
        tw.status === 'OVERLOADED' ? 'rose' : 'amber';

      const sidecarData: QuickLookData = {
        id: tw.teacherId,
        type: 'teacher',
        title: tw.teacherName,
        subtitle: `${statusLabel} · ${tw.hoursPerWeek} soat/hafta (${Math.round(tw.utilization * 100)}% bandlik)`,
        badge: {
          text: statusLabel,
          tone,
        },
        avatar: {
          text: getInitials(tw.teacherName),
          color: '#2563EB',
        },
        metrics: [
          { label: 'Yuklama', value: `${Math.round(tw.utilization * 100)}%` },
          { label: 'Haftalik soat', value: `${tw.hoursPerWeek} soat` },
          { label: 'Guruhlar', value: String(tw.groupsCount) },
          { label: "O'quvchilar", value: String(tw.studentsCount) },
        ],
        details: [
          { label: "O'qituvchi ID", value: tw.teacherId, copyable: true },
          { label: 'F.I.Sh.', value: tw.teacherName },
          { label: 'Maksimal quvvat', value: `${tw.capacityHours} soat` },
          { label: "O'rtacha baho", value: `${tw.avgGrade ?? 86} ball` },
          { label: 'Retention (Saqlash)', value: `${tw.retentionRate ?? 92}%` },
          { label: 'Davomat', value: `${tw.attendanceRate ?? 88}%` },
        ],
      };
      openSidecar(sidecarData);
    },
    [t],
  );

  useListKeyboardNavigation<TeacherWorkload>({
    items: filteredTeachers,
    getItemId: (tw) => tw.teacherId,
    rowIdPrefix: 'teacher-workload-',
    onSelect: (tw) => {
      playTick();
      handleOpenTeacherWorkloadSidecar(tw);
    },
    onQuickLook: (tw) => {
      playTick();
      handleOpenTeacherWorkloadSidecar(tw);
    },
  });

  const summary = summaryQuery.data;
  const avgUtilPercent = Math.round((summary?.avgUtilization ?? 0) * 100);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-6 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraBackdrop />

      {/* ═══ HERO HEADER ═══ */}
      <motion.div variants={cardVariants}>
        <div
          className="liquid-glass-surface relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/80 dark:bg-surface-900/80 p-6 sm:p-7 shadow-md backdrop-blur-2xl"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20 z-10"
          />

          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* Gradient workload tile */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -4 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
                boxShadow: '0 12px 28px -10px rgba(37,99,235,0.45), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/40 to-transparent"
              />
              <Icon paths={I.gauge} size={28} strokeWidth={2.2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Workload
                </span>
                {(summary?.overloaded ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-rose-600 dark:text-rose-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <motion.span
                        className="absolute inset-0 rounded-full bg-rose-500"
                        animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-rose-500" />
                    </span>
                    {summary?.overloaded ?? 0} {t('teacherWorkload.overloaded', 'Ortiqcha')}
                  </span>
                )}
                {(summary?.balanced ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {summary?.balanced ?? 0} {t('teacherWorkload.balanced', 'Muvozanatda')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
                {t('teacherWorkload.title', "O'qituvchilar yuklamasi")}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
                {t('teacherWorkload.subtitle', "Haftalik o'quv soatlari, quvvat tahlili va maosh ko'rsatkichlari")}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ STAT TILES ═══ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 md:grid-cols-5"
      >
        <StatTile
          label={t('nav.teachers', "O'qituvchilar")}
          value={summary?.total ?? 0}
          icon={I.users}
          tone="blue"
        />
        <StatTile
          label={t('teacherWorkload.overloaded', 'Ortiqcha')}
          value={summary?.overloaded ?? 0}
          icon={I.alert}
          tone="red"
        />
        <StatTile
          label={t('teacherWorkload.balanced', 'Muvozanatda')}
          value={summary?.balanced ?? 0}
          icon={I.checkCircle}
          tone="green"
        />
        <StatTile
          label={t('teacherWorkload.underutilized', 'Kam yuklama')}
          value={summary?.underutilized ?? 0}
          icon={I.pause}
          tone="orange"
        />
        <StatTile
          label={t('teacherWorkload.avgUtilization', "O'rtacha bandlik")}
          value={avgUtilPercent}
          icon={I.gauge}
          tone="purple"
          format="percent"
        />
      </motion.div>

      {/* ═══ SMART PAYROLL & KPI CALCULATOR ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING.smooth, delay: 0.1 }}
      >
        <SmartPayrollCalculator teachers={teachers} />
      </motion.div>

      {/* ═══ MODEL LEGEND ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING.smooth, delay: 0.12 }}
      >
        <ModelLegend />
      </motion.div>

      {/* ═══ WORKLOAD LIST ═══ */}
      <GlassCard className="overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="flex flex-col gap-3 border-b border-black/[0.06] p-4 dark:border-white/[0.08] sm:flex-row sm:items-center sm:justify-between">
          {/* Status Segmented Tabs */}
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label={t('teacherWorkload.filterStatus', 'Yuklama holati')}>
            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'ALL'}
              onClick={() => {
                playTick();
                setFilterStatus('ALL');
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterStatus === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span>{t('common.all', 'Barchasi')}</span>
              <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${
                filterStatus === 'ALL' ? 'bg-white/20 text-white' : 'bg-black/[0.06] dark:bg-white/10'
              }`}>
                {teachers.length}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'OVERLOADED'}
              onClick={() => {
                playTick();
                setFilterStatus('OVERLOADED');
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterStatus === 'OVERLOADED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span>{t('teacherWorkload.overloaded', 'Ortiqcha')}</span>
              <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${
                filterStatus === 'OVERLOADED' ? 'bg-white/20 text-white' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              }`}>
                {summary?.overloaded ?? 0}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'BALANCED'}
              onClick={() => {
                playTick();
                setFilterStatus('BALANCED');
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterStatus === 'BALANCED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>{t('teacherWorkload.balanced', 'Muvozanatda')}</span>
              <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${
                filterStatus === 'BALANCED' ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                {summary?.balanced ?? 0}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={filterStatus === 'UNDERUTILIZED'}
              onClick={() => {
                playTick();
                setFilterStatus('UNDERUTILIZED');
              }}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterStatus === 'UNDERUTILIZED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>{t('teacherWorkload.underutilized', 'Kam yuklama')}</span>
              <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${
                filterStatus === 'UNDERUTILIZED' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}>
                {summary?.underutilized ?? 0}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Icon paths={I.search} size={15} strokeWidth={2.2} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('teacherWorkload.searchPlaceholder', "O'qituvchi bo'yicha qidirish...")}
              className="min-h-[44px] w-full rounded-xl border border-black/10 bg-black/[0.02] pl-9 pr-9 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setSearchQuery('');
                }}
                className="min-h-[44px] min-w-[36px] absolute inset-y-0 right-0 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={t('common.clear', 'Tozalash')}
              >
                <Icon paths={I.x} size={14} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>

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
                  className="flex items-center gap-4 rounded-2xl border border-black/[0.06] p-4 dark:border-white/[0.08]"
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
                title={t('teacherWorkload.emptyTitle', "O'qituvchilar topilmadi")}
                message={t('teacherWorkload.emptyMessage', "Hozircha yuklama qayd qilingan o'qituvchilar mavjud emas")}
              />
            </motion.div>
          ) : filteredTeachers.length === 0 ? (
            <motion.div
              key="no-matches"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <GlassEmptyState
                title={t('common.noResults', 'Natija topilmadi')}
                message={t('teacherWorkload.noMatches', 'Tanlangan filtr yoki qidiruv bo‘yicha o‘qituvchilar topilmadi.')}
                action={{
                  label: t('common.resetFilters', 'Filtrlarni tozalash'),
                  onClick: () => {
                    playTick();
                    setFilterStatus('ALL');
                    setSearchQuery('');
                  },
                }}
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
              {filteredTeachers.map((teacher, idx) => (
                <WorkloadRow
                  key={teacher.teacherId}
                  teacher={teacher}
                  index={idx}
                  onSidecar={handleOpenTeacherWorkloadSidecar}
                />
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

export default TeacherWorkloadPage;
