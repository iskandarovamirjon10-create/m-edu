/**
 * M-EDU GroupDetailPage —  & Glass Edition 
 *
 * Module Features:
 *  - Liquid glass styling
 *  - Hierarchical Breadcrumbs navigation + accessible back CTA (WCAG 2.2 AA SC 2.5.8 >= 44x44px)
 *  - Tactile spring physics (Framer Motion) with micro-elevation and sound triggers
 *  - Animated KPI tiles (Members, Capacity, Schedules, Duration) with instant test bypass
 *  - Trilingual resilient localization via `useSafeI18n` with safe fallbacks
 *  - Preserved & exported pure helper signatures for unit-testing
 *  - Sidecar Split View drawer integration with shortcut bindings ([S] Sidecar, [R] Refresh)
 *  - AI Copilot contextual deep prompts for group performance, attendance, and lesson planning
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassButton,
  GlassModal,
} from '@/components/ui';
import { SmartClassroomSeatingStudio } from '@/components/groups/SmartClassroomSeatingStudio';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { fullName, formatDate, formatTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Group, GroupSchedule } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

export const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.06 },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

export const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM SVG ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.8;

export const I: Record<string, string[]> = {
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  groups: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  usersRound: [
    'M18 21a8 8 0 0 0-16 0',
    'M10 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  door: [
    'M3 21h18',
    'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16',
    'M14 12h.01',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  calendarEnd: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  ],
};

export function Icon({
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
 * TONES & THEME COLOR TOKENS
 * ========================================================================== */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

export const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.08)', glow: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.2)' },
  green:   { fg: '#059669', bg: 'rgba(5,150,105,0.08)',  glow: 'rgba(5,150,105,0.12)',  border: 'rgba(5,150,105,0.2)' },
  orange:  { fg: '#D97706', bg: 'rgba(217,119,6,0.08)',  glow: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.2)' },
  red:     { fg: '#DC2626', bg: 'rgba(220,38,38,0.08)',  glow: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.2)' },
  purple:  { fg: '#4F46E5', bg: 'rgba(79,70,229,0.08)', glow: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.2)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.08)', glow: 'rgba(2,132,199,0.12)', border: 'rgba(2,132,199,0.2)' },
  gray:    { fg: '#475569', bg: 'rgba(71,85,105,0.08)', glow: 'rgba(71,85,105,0.12)', border: 'rgba(71,85,105,0.2)' },
  emerald: { fg: '#059669', bg: 'rgba(5,150,105,0.08)', glow: 'rgba(5,150,105,0.12)', border: 'rgba(5,150,105,0.2)' },
};

export const DAY_TONES: Record<string, Tone> = {
  MONDAY: 'blue',
  TUESDAY: 'purple',
  WEDNESDAY: 'emerald',
  THURSDAY: 'cyan',
  FRIDAY: 'blue',
  SATURDAY: 'purple',
  SUNDAY: 'gray',
};

export const DAYS: string[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/* ============================================================================
 * EXPORTED PURE HELPERS
 * ========================================================================== */

export interface GroupMember {
  student: {
    id: string;
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
  };
  isActive: boolean;
  joinedAt?: string;
}

export function formatDayOfWeek(day: string): string {
  return `schedule.day.${day.toUpperCase()}`;
}

export function formatCapacity(current: number, max?: number | null): string {
  if (!max) return String(current);
  return `${current} / ${max}`;
}

export function capacityRatio(current: number, max?: number | null): number {
  if (!max || max <= 0) return 0;
  return Math.min(1, Math.max(0, current / max));
}

export function formatScheduleTime(time: string): string {
  return formatTime(time);
}

export function getScheduleRoom(schedule: GroupSchedule, groupRoom?: string | null): string {
  return schedule.room || groupRoom || '—';
}

export function getInitials(name: string): string {
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

export function nameHash(str: string): number {
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
  ['#1E293B', '#0F172A'],
];

export function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function durationDays(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

/* ============================================================================
 * SUB-COMPONENTS (Apple Glass Surface)
 * ========================================================================== */

export function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/60 dark:bg-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function GroupDetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="group-detail-skeleton">
      <Shimmer className="h-32 w-full" radius="1.25rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-24 w-full" radius="1rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Shimmer className="h-80 w-full" radius="1.25rem" />
        <div className="lg:col-span-2">
          <Shimmer className="h-80 w-full" radius="1.25rem" />
        </div>
      </div>
      <Shimmer className="h-64 w-full" radius="1.25rem" />
    </div>
  );
}

export function CountUp({
  value,
  duration = 0.9,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  // Test environment bypass
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const [n, setN] = useState(() => (isTest ? value : 0));
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTest) {
      setN(value);
      return;
    }
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
  }, [value, duration, isTest]);

  return (
    <span className="tabular-nums">
      {Math.round(n).toLocaleString('uz-UZ')}
      {suffix}
    </span>
  );
}

/** Apple Glass Pro KPI Tile */
export function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  secondary,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] bg-white/75 dark:bg-surface-900/75 p-4 backdrop-blur-2xl shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.36)]"
    >
      {/* Specular meniscus reflection */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent"
      />

      <div className="flex items-center gap-3.5">
        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
          }}
        >
          <Icon paths={icon} size={19} strokeWidth={2} className="relative" />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none">
            <CountUp value={value} />
          </div>
          <div className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {label}
          </div>
          {secondary && (
            <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              {secondary}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Status Badge */
export function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  const tone: Tone = isActive ? 'emerald' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {label}
    </span>
  );
}

/** Specular Section Panel */
export function SectionPanel({
  icon,
  tone = 'blue',
  title,
  subtitle,
  right,
  children,
}: {
  icon: string[];
  tone?: Tone;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const c = TONES[tone];
  return (
    <motion.section
      variants={cardVariants}
      className="relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/75 dark:bg-surface-900/75 backdrop-blur-2xl shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.36)]"
    >
      {/* Top meniscus highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] dark:border-white/[0.08] px-5 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
            }}
          >
            <Icon paths={icon} size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {right}
      </div>
      <div className="relative">{children}</div>
    </motion.section>
  );
}

/** Info Row */
export function InfoRow({
  icon,
  tone = 'blue',
  label,
  value,
}: {
  icon: string[];
  tone?: Tone;
  label: string;
  value: React.ReactNode;
}) {
  const c = TONES[tone];
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <span className="inline-flex items-center gap-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: c.bg, color: c.fg }}
        >
          <Icon paths={icon} size={13} strokeWidth={2.2} />
        </span>
        {label}
      </span>
      <span className="text-right text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

/** Capacity Bar */
export function CapacityBar({ current, capacity }: { current: number; capacity?: number | null }) {
  const ratio = capacityRatio(current, capacity);
  const tone: Tone = ratio >= 0.9 ? 'red' : ratio >= 0.7 ? 'orange' : 'emerald';
  const c = TONES[tone];
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
        {formatCapacity(current, capacity)}
      </span>
      {capacity ? (
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.1]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: c.fg }}
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Day Tile */
export function DayTile({ day }: { day: string }) {
  const tone = DAY_TONES[day] ?? 'blue';
  const c = TONES[tone];
  const idx = DAYS.indexOf(day) + 1;
  return (
    <div
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold tracking-tight tabular-nums text-xs"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {idx > 0 ? String(idx).padStart(2, '0') : '—'}
    </div>
  );
}

/** Time Chip */
export function TimeChip({ start, end }: { start: string; end: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs font-medium tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
      <Icon paths={I.clock} size={12} strokeWidth={2.2} />
      <span>{formatScheduleTime(start)}</span>
      <span className="opacity-40">→</span>
      <span>{formatScheduleTime(end)}</span>
    </div>
  );
}

/** Room Chip */
export function RoomChip({ name }: { name: string }) {
  const c = TONES.purple;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.door} size={11} strokeWidth={2.2} />
      {name}
    </span>
  );
}

/** Email Chip */
export function EmailChip({ email }: { email: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.08] px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      <Icon paths={I.mail} size={11} strokeWidth={2} />
      <span className="truncate max-w-[14rem]">{email}</span>
    </span>
  );
}

/* ============================================================================
 * MAIN COMPONENT: GroupDetailPage
 * ========================================================================== */

export function GroupDetailPage() {
  const { t } = useSafeI18n();
  const navigate = useNavigate();
  usePageTitle(t('groups.detailsTitle', "Guruh ma'lumotlari"));
  const { id } = useParams<{ id: string }>();

  const group = useQuery({
    queryKey: queryKeys.groups.detail(id!),
    queryFn: () => groupsApi.get(id!),
    enabled: !!id,
    placeholderData: (previousData) => previousData,
  });

  const groupData = group.data as Group | undefined;

  const members = useMemo(
    () =>
      (groupData?.enrollments || []).filter(
        (enrollment) => enrollment.isActive,
      ) as GroupMember[],
    [groupData],
  );

  const schedules = useMemo(() => groupData?.schedules || [], [groupData]);

  /* ── Derived statistics ────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const totalMembers = members.length;
    const capacity = groupData?.capacity ?? 0;
    const scheduleCount = schedules.length;
    const days = durationDays(groupData?.startDate, groupData?.endDate);
    return { totalMembers, capacity, scheduleCount, days };
  }, [members, schedules, groupData]);

  const { refetch: refetchGroup } = group;
  const handleRetry = useCallback(() => {
    void refetchGroup();
  }, [refetchGroup]);

  const { playTick, playPop } = usePremiumSound();
  const [seatingModalOpen, setSeatingModalOpen] = useState(false);

  const teacherName = groupData?.teacher
    ? fullName(
        groupData.teacher.user?.firstName,
        groupData.teacher.user?.lastName,
      )
    : '—';
  const teacherInitials = getInitials(teacherName);
  const teacherGradient = avatarGradient(teacherName);

  const handleOpenGroupSidecar = useCallback(() => {
    if (!groupData) return;
    playPop();
    const sidecarData: QuickLookData = {
      type: 'group',
      id: groupData.id,
      title: groupData.name,
      subtitle: `${groupData.course?.name || t('enum.badge.COURSE', 'Kurs')} · ${groupData.room || t('groupDetail.noRoom', 'Xona belgilanmagan')}`,
      status: {
        label: groupData.isActive ? t('enum.status.ACTIVE', 'Faol guruh') : t('enum.status.INACTIVE', 'Nofaol'),
        tone: groupData.isActive ? 'green' : 'amber',
      },
      metrics: [
        { label: t('groupDetail.members', "O'quvchilar"), value: `${stats.totalMembers} / ${stats.capacity || '∞'}` },
        { label: t('nav.schedule', 'Dars jadvali'), value: `${stats.scheduleCount} ta slot` },
        { label: t('groupDetail.duration', 'Davomiylik'), value: stats.days ? `${stats.days} kun` : '—' },
        { label: t('groups.form.teacher', "O'qituvchi"), value: teacherName },
      ],
      details: [
        { label: 'Guruh ID', value: groupData.id, copyable: true },
        { label: 'Guruh nomi', value: groupData.name },
        { label: 'Kurs / Fan', value: groupData.course?.name || '—' },
        { label: "O'qituvchi", value: teacherName },
        { label: 'Dars xonasi', value: groupData.room || '—' },
        { label: "O'quvchilar soni", value: `${stats.totalMembers} nafar` },
        { label: "Maksimal sig'im", value: groupData.capacity ? `${groupData.capacity} nafar` : 'Cheklanmagan' },
        { label: 'Boshlanish sanasi', value: formatDate(groupData.startDate) },
        { label: 'Tugash sanasi', value: formatDate(groupData.endDate) },
        { label: 'Holati', value: groupData.isActive ? 'Faol' : 'Nofaol' },
      ],
    };
    openSidecar(sidecarData);
  }, [groupData, playPop, stats, teacherName, t]);

  const handleOpenMemberSidecar = useCallback((member: GroupMember) => {
    playPop();
    const name = fullName(member.student.user?.firstName, member.student.user?.lastName);
    const sidecarData: QuickLookData = {
      type: 'student',
      id: member.student.id,
      title: name,
      subtitle: member.student.user?.email || member.student.user?.phone || t('groupDetail.member', "Guruh a'zosi"),
      status: {
        label: member.isActive ? t('enum.status.ACTIVE', "Faol o'quvchi") : t('enum.status.INACTIVE', 'Nofaol'),
        tone: member.isActive ? 'green' : 'slate',
      },
      metrics: [
        { label: "F.I.SH.", value: name },
        { label: 'Guruh', value: groupData?.name || '—' },
        { label: "Qo'shilgan sana", value: formatDate(member.joinedAt) },
      ],
      details: [
        { label: 'Talaba ID', value: member.student.id, copyable: true },
        { label: 'F.I.SH.', value: name },
        { label: 'Elektron pochta', value: member.student.user?.email || '—', copyable: Boolean(member.student.user?.email) },
        { label: 'Telefon', value: member.student.user?.phone || '—', copyable: Boolean(member.student.user?.phone) },
        { label: "Guruhga qo'shilgan sana", value: formatDate(member.joinedAt) },
        { label: 'Holati', value: member.isActive ? "Faol o'quvchi" : 'Nofaol' },
      ],
    };
    openSidecar(sidecarData);
  }, [groupData, playPop, t]);

  // Global keyboard shortcuts: [S] Sidecar, [R] Refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        playTick();
        handleOpenGroupSidecar();
      } else if (e.key === 'r' || e.key === 'R') {
        playTick();
        void refetchGroup();
      } else if (e.key === 'i' || e.key === 'I') {
        playTick();
        window.dispatchEvent(
          new CustomEvent('open-ai-copilot', {
            detail: {
              prompt: `"${groupData.name}" guruhi bo'yicha tahlil ber: o'quvchilar soni (${stats.totalMembers} nafar, sig'imi ${stats.capacity || 'cheklanmagan'}), o'qituvchi (${teacherName}), dars xonasi (${groupData.room || 'belgilanmagan'}) va dars jadvali.`,
            },
          }),
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenGroupSidecar, playTick, refetchGroup]);

  /* ── Loading Skeleton ──────────────────────────────────────────────── */
  if (group.isLoading && !groupData) {
    return (
      <div className="page-container space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="h-10 w-48 rounded-xl bg-slate-200/50 dark:bg-white/[0.05] animate-pulse" />
        <GroupDetailSkeleton />
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
  if (group.isError || !groupData) {
    return (
      <div className="page-container space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-white/80 dark:bg-surface-900/80 p-8 backdrop-blur-2xl shadow-xl text-center">
          <GlassErrorState
            title={t('groups.notFound', 'Guruh topilmadi')}
            message={getErrorMessage(group.error as Error)}
            onRetry={handleRetry}
          />
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/groups')}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.04] dark:bg-white/[0.06] px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-all"
            >
              <Icon paths={I.chevronLeft} size={14} />
              <span>{t('groups.backToList', "Guruhlar ro'yxatiga qaytish")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isActive = groupData.isActive;

  /* ── Main Render ─────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-6 pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />
      {/* ============================================================
          BREADCRUMBS & TOP NAV (WCAG 2.2 AA SC 2.5.8 >= 44x44px)
      ============================================================ */}
      <motion.nav
        variants={cardVariants}
        aria-label="Breadcrumb"
        className="flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Link
            to="/groups"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-surface-900/70 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-surface-800 transition-all shadow-sm"
            aria-label={t('groups.backToList', "Guruhlar ro'yxatiga qaytish")}
          >
            <Icon paths={I.chevronLeft} size={16} strokeWidth={2.2} />
          </Link>

          <Link
            to="/groups"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t('nav.groups', 'Guruhlar')}
          </Link>
          <Icon paths={I.chevronRight} size={12} strokeWidth={2.5} className="opacity-40" />
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[12rem] sm:max-w-md">
            {groupData.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            title="Yangilash [R]"
            aria-label="Yangilash [R]"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-surface-900/70 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-surface-800 transition-all shadow-sm active:scale-95"
          >
            <Icon paths={I.refresh} size={15} strokeWidth={2} />
          </button>
        </div>
      </motion.nav>

      {/* ============================================================
          HERO HEADER (Apple Glass Liquid Glass Surface)
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className="relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/75 dark:bg-surface-900/75 p-5 sm:p-7 backdrop-blur-2xl shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          {/* Top specular meniscus reflection */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 dark:via-white/25 to-transparent"
          />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Group icon + title */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center min-w-0 flex-1">
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-white/30">
                <Icon paths={I.groups} size={28} strokeWidth={2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Icon paths={I.sparkles} size={12} strokeWidth={2.2} />
                    {t('enum.badge.GROUP', 'Guruh')}
                  </span>
                  <StatusBadge
                    isActive={isActive}
                    label={t(isActive ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE', isActive ? 'Faol' : 'Nofaol')}
                  />
                  {groupData.course?.name && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      <Icon paths={I.book} size={12} strokeWidth={2.2} />
                      {groupData.course.name}
                    </span>
                  )}
                  {groupData.room && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      <Icon paths={I.door} size={12} strokeWidth={2.2} />
                      {groupData.room}
                    </span>
                  )}
                </div>

                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl break-words">
                  {groupData.name}
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {groupData.course?.name || t('enum.badge.COURSE', 'Kurs')} ·{' '}
                  {groupData.room || t('groupDetail.noRoom', 'Xona belgilanmagan')}
                </p>
              </div>
            </div>

            {/* Quick Actions (Apple Pro Glass Segmented Icon Toolbar + 1 Primary CTA) */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-4 border-t border-black/[0.06] dark:border-white/[0.08] lg:pt-0 lg:border-t-0">
              {/* Pro Glass Segmented Capsule */}
              <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-xl border border-black/[0.06] dark:border-white/10 shadow-sm">
                {/* 1. Davomat */}
                <Link
                  to={`/attendance?groupId=${groupData.id}`}
                  className="group relative h-10 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-sky-500"
                  title={`${t('nav.attendance', 'Davomat')} (D)`}
                  aria-label={t('nav.attendance', 'Davomat')}
                >
                  <Icon paths={I.checkCircle} size={15} strokeWidth={2.2} />
                  <span className="text-xs font-semibold hidden md:inline">{t('nav.attendance', 'Davomat')}</span>
                  <span className="sr-only">{t('nav.attendance', 'Davomat')}</span>
                </Link>

                {/* 2. Baholar */}
                <Link
                  to={`/grades?groupId=${groupData.id}`}
                  className="group relative h-10 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
                  title={`${t('nav.grades', 'Baholar')} (G)`}
                  aria-label={t('nav.grades', 'Baholar')}
                >
                  <Icon paths={I.book} size={15} strokeWidth={2.2} />
                  <span className="text-xs font-semibold hidden md:inline">{t('nav.grades', 'Baholar')}</span>
                  <span className="sr-only">{t('nav.grades', 'Baholar')}</span>
                </Link>

                {/* 3. Vazifalar */}
                <Link
                  to={`/homework?groupId=${groupData.id}`}
                  className="group relative h-10 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-amber-500"
                  title={`${t('nav.homework', 'Vazifalar')} (H)`}
                  aria-label={t('nav.homework', 'Vazifalar')}
                >
                  <Icon paths={I.layers} size={15} strokeWidth={2.2} />
                  <span className="text-xs font-semibold hidden md:inline">{t('nav.homework', 'Vazifalar')}</span>
                  <span className="sr-only">{t('nav.homework', 'Vazifalar')}</span>
                </Link>

                {/* 4. Partalar Xaritasi */}
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    setSeatingModalOpen(true);
                  }}
                  className="group relative h-10 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500"
                  title="Partalar Xaritasi (P)"
                  aria-label="Partalar Xaritasi"
                >
                  <span className="text-sm">🪑</span>
                  <span className="text-xs font-semibold hidden md:inline">Partalar</span>
                  <span className="sr-only">Partalar Xaritasi</span>
                </button>

                {/* 5. Split View Sidecar */}
                <button
                  type="button"
                  onClick={handleOpenGroupSidecar}
                  className="group relative h-10 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="Split View Sidecar [S]"
                  aria-label="Split View Sidecar [S]"
                >
                  <span className="text-sm">◨</span>
                  <span className="text-xs font-semibold hidden md:inline">Sidecar</span>
                  <span className="sr-only">Split View Sidecar [S]</span>
                </button>

                {/* 6. AI Tahlil */}
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    window.dispatchEvent(
                      new CustomEvent('open-ai-copilot', {
                        detail: {
                          prompt: `"${groupData.name}" guruhi bo'yicha tahlil ber: o'quvchilar soni (${stats.totalMembers} nafar, sig'imi ${stats.capacity || 'cheklanmagan'}), o'qituvchi (${teacherName}), dars xonasi (${groupData.room || 'belgilanmagan'}) va dars jadvali.`,
                        },
                      }),
                    );
                  }}
                  className="group relative h-10 min-h-[44px] px-3 inline-flex items-center gap-1.5 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500"
                  title={`${t('aiAnalysis', 'AI Tahlil')} (I)`}
                  aria-label={t('aiAnalysis', 'AI Tahlil')}
                >
                  <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                  <span className="text-xs font-semibold hidden md:inline">AI</span>
                  <span className="sr-only">{t('aiAnalysis', 'AI Tahlil')}</span>
                </button>
              </div>

              {/* 1 Primary Solid Gradient CTA */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton asChild variant="primary" className="min-h-[44px] px-4 font-bold shadow-md shadow-blue-500/20">
                  <Link to={`/groups/${groupData.id}/edit`}>
                    <span className="inline-flex items-center gap-2 font-semibold text-xs">
                      <Icon paths={I.edit} size={15} strokeWidth={2} />
                      <span>{t('groupForm.editTitle', 'Tahrirlash')}</span>
                      <kbd className="hidden sm:inline-block rounded bg-white/20 px-1 py-0.2 text-[10px] text-white/90">E</kbd>
                    </span>
                  </Link>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI STATS GRID
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile
          label={t('groupDetail.membersCount', "A'zolar")}
          value={stats.totalMembers}
          icon={I.usersRound}
          tone="blue"
        />
        <KpiTile
          label={t('groups.form.capacity', "Maksimal sig'im")}
          value={stats.capacity}
          icon={I.users}
          tone="emerald"
        />
        <KpiTile
          label={t('nav.schedule', 'Dars jadvali')}
          value={stats.scheduleCount}
          icon={I.calendar}
          tone="purple"
        />
        <KpiTile
          label={t('groupForm.endDate', 'Davomiyligi')}
          value={stats.days ?? 0}
          icon={I.clock}
          tone="orange"
          secondary={stats.days != null ? `${stats.days} kun` : undefined}
        />
      </motion.div>

      {/* ============================================================
          DETAILS & MEMBERS DUAL COLUMN
      ============================================================ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Details & AI Copilot Hub */}
        <motion.div variants={cardVariants} className="lg:col-span-1 space-y-6">
          <SectionPanel
            icon={I.layers}
            tone="blue"
            title={t('groupDetail.details', "Guruh ma'lumotlari")}
          >
            <div className="p-3.5 space-y-1">
              <InfoRow
                icon={I.user}
                tone="cyan"
                label={t('groups.form.teacher', "O'qituvchi")}
                value={
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="relative flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-white/50 dark:ring-slate-900/50"
                      style={{ background: teacherGradient }}
                    >
                      <span>{teacherInitials}</span>
                    </span>
                    <span className="truncate max-w-[8rem] sm:max-w-[10rem]">{teacherName}</span>
                  </span>
                }
              />
              <InfoRow
                icon={I.users}
                tone="emerald"
                label={t('groups.form.capacity', "Guruh sig'imi")}
                value={
                  <CapacityBar
                    current={members.length}
                    capacity={groupData.capacity}
                  />
                }
              />
              <InfoRow
                icon={I.calendar}
                tone="green"
                label={t('groups.form.startDate', 'Boshlanish sanasi')}
                value={formatDate(groupData.startDate)}
              />
              <InfoRow
                icon={I.calendarEnd}
                tone="red"
                label={t('groupForm.endDate', 'Tugash sanasi')}
                value={formatDate(groupData.endDate)}
              />
              <InfoRow
                icon={I.checkCircle}
                tone={isActive ? 'emerald' : 'gray'}
                label={t('groups.col.status', 'Holati')}
                value={
                  <StatusBadge
                    isActive={isActive}
                    label={t(isActive ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE', isActive ? 'Faol' : 'Nofaol')}
                  />
                }
              />
            </div>
          </SectionPanel>

          {/* AI Copilot Context Hub */}
          <SectionPanel
            icon={I.sparkles}
            tone="purple"
            title={t('aiAnalysis', 'AI Guruh Tahlili')}
            subtitle={t('copilot.groupSubtitle', 'Aqlli assistent va dars rejalashtirish')}
            right={
              <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Copilot
              </span>
            }
          >
            <div className="p-3.5 space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  window.dispatchEvent(
                    new CustomEvent('open-ai-copilot', {
                      detail: {
                        prompt: `"${groupData.name}" guruhining dars qatnashuv ko'rsatkichlari, eng ko'p dars qoldiruvchi talabalari va guruh davomati monitoringini ko'rsat.`,
                      },
                    }),
                  );
                }}
                className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:border-purple-500/40 hover:bg-purple-500/[0.05] transition-all text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Icon paths={I.calendar} size={13} strokeWidth={2.2} />
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t('copilot.groupAttendance', 'Guruh davomati & monitoring')}
                  </span>
                </div>
                <Icon paths={I.arrowRight} size={13} strokeWidth={2.5} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playPop();
                  window.dispatchEvent(
                    new CustomEvent('open-ai-copilot', {
                      detail: {
                        prompt: `"${groupData.name}" guruhi (${groupData.course?.name || 'Fan'}) uchun 45 daqiqalik namunaviy dars rejasi, vaqt taqsimoti va interaktiv mashqlar tuzib ber.`,
                      },
                    }),
                  );
                }}
                className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:border-purple-500/40 hover:bg-purple-500/[0.05] transition-all text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Icon paths={I.book} size={13} strokeWidth={2.2} />
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t('group.lessonPlan45', '45 daqiqalik dars rejasi')}
                  </span>
                </div>
                <Icon paths={I.arrowRight} size={13} strokeWidth={2.5} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  playPop();
                  window.dispatchEvent(
                    new CustomEvent('open-ai-copilot', {
                      detail: {
                        prompt: `"${groupData.name}" guruhidagi ${members.length} nafar o'quvchining o'zlashtirish va faollik darajasi, orqada qolayotganlar bo'yicha tavsiyalar ber.`,
                      },
                    }),
                  );
                }}
                className="w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.03] hover:border-purple-500/40 hover:bg-purple-500/[0.05] transition-all text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon paths={I.users} size={13} strokeWidth={2.2} />
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {t('copilot.riskAssessment', "O'quvchilar xavf tahlili")}
                  </span>
                </div>
                <Icon paths={I.arrowRight} size={13} strokeWidth={2.5} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </SectionPanel>
        </motion.div>

        {/* Right Column: Members List */}
        <motion.div variants={cardVariants} className="lg:col-span-2">
          <SectionPanel
            icon={I.usersRound}
            tone="purple"
            title={t('groupDetail.membersList', "Guruh a'zolari")}
            subtitle={
              groupData.capacity
                ? `${members.length} / ${groupData.capacity}`
                : undefined
            }
            right={
              members.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <Icon paths={I.layers} size={12} strokeWidth={2.5} />
                  {members.length}
                </span>
              ) : null
            }
          >
            {members.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Icon paths={I.empty} size={24} strokeWidth={1.8} />
                </div>
                <p className="mt-3 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200">
                  {t('groupDetail.noMembers', "Guruhda hali o'quvchilar yo'q")}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('groupDetail.noMembersHint', "O'quvchilarni guruhga qo'shish uchun tahrirlash sahifasiga o'ting.")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
                {members.map((member, idx) => {
                  const name = fullName(
                    member.student.user?.firstName,
                    member.student.user?.lastName,
                  );
                  const initials = getInitials(name);
                  const gradient = avatarGradient(name);
                  return (
                    <motion.div
                      key={member.student.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.02 }}
                      className="flex flex-wrap items-center gap-3.5 px-5 sm:px-6 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    >
                      <div
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-2 ring-white/60 dark:ring-surface-900/60"
                        style={{ background: gradient }}
                      >
                        <span>{initials}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/students/${member.student.id}`}
                          className="truncate text-xs sm:text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          {name}
                        </Link>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {member.student?.user?.email && (
                            <EmailChip email={member.student?.user?.email || ""} />
                          )}
                          {member.joinedAt && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                              <Icon paths={I.clock} size={11} strokeWidth={2.2} className="opacity-60" />
                              {formatDate(member.joinedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenMemberSidecar(member)}
                          className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-white/60 dark:bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/[0.08] shadow-sm transition-all"
                          title="Split View Sidecar"
                          aria-label={`Sidecar: ${name}`}
                        >
                          <span>◨</span>
                          <span>Sidecar</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </SectionPanel>
        </motion.div>
      </div>

      {/* ============================================================
          SCHEDULE SECTION
      ============================================================ */}
      {schedules.length > 0 && (
        <motion.div variants={cardVariants}>
          <SectionPanel
            icon={I.calendar}
            tone="green"
            title={t('nav.schedule', 'Dars jadvali')}
            subtitle={`${schedules.length} ta dars sloti`}
            right={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Icon paths={I.layers} size={12} strokeWidth={2.5} />
                {schedules.length}
              </span>
            }
          >
            <div className="divide-y divide-black/[0.06] dark:divide-white/[0.06]">
              {schedules.map((schedule, idx) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.02 }}
                  className="flex flex-wrap items-center gap-3.5 px-5 sm:px-6 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  <DayTile day={schedule.dayOfWeek} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      {t(formatDayOfWeek(schedule.dayOfWeek), schedule.dayOfWeek)}
                    </p>
                    <div className="mt-1">
                      <TimeChip start={schedule.startTime} end={schedule.endTime} />
                    </div>
                  </div>
                  <RoomChip name={getScheduleRoom(schedule, groupData.room)} />
                </motion.div>
              ))}
            </div>
          </SectionPanel>
        </motion.div>
      )}
      {/* Smart Classroom Seating Studio Modal */}
      <GlassModal
        open={seatingModalOpen}
        onClose={() => setSeatingModalOpen(false)}
        size="xl"
        title={`Partalar Xaritasi & Sinf Xoreografi · ${groupData.name}`}
      >
        <SmartClassroomSeatingStudio
          group={groupData}
          onClose={() => setSeatingModalOpen(false)}
        />
      </GlassModal>

    </motion.div>
  );
}

export default GroupDetailPage;
