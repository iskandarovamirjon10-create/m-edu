/**
 * M-EDU GroupDetailPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient group tile + status/schedule/capacity chips + edit CTA
 *  - Animated KPI bar (Members, Capacity, Schedules, Duration) with count-up
 *  - Premium info panel with squircle icon rows
 *  - Premium member list with gradient avatars + email chips + joined date
 *  - Premium schedule rows with day tile + time chip + room chip
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassButton,
} from '@/components/ui';
import { fullName, formatDate, formatTime } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Group, GroupSchedule } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

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
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
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
  sparkline: ['M3 17l6-6 4 4 8-8'],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  clockOutline: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.08)', glow: 'rgba(37,99,235,0.12)', border: 'rgba(37,99,235,0.18)' },
  green:   { fg: '#059669', bg: 'rgba(5,150,105,0.08)',  glow: 'rgba(5,150,105,0.12)',  border: 'rgba(5,150,105,0.18)' },
  orange:  { fg: '#D97706', bg: 'rgba(217,119,6,0.08)',  glow: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.18)' },
  red:     { fg: '#DC2626', bg: 'rgba(220,38,38,0.08)',  glow: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.18)' },
  purple:  { fg: '#4F46E5', bg: 'rgba(79,70,229,0.08)', glow: 'rgba(79,70,229,0.12)', border: 'rgba(79,70,229,0.18)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.08)', glow: 'rgba(2,132,199,0.12)', border: 'rgba(2,132,199,0.18)' },
  gray:    { fg: '#475569', bg: 'rgba(71,85,105,0.08)', glow: 'rgba(71,85,105,0.12)', border: 'rgba(71,85,105,0.18)' },
  emerald: { fg: '#059669', bg: 'rgba(5,150,105,0.08)', glow: 'rgba(5,150,105,0.12)', border: 'rgba(5,150,105,0.18)' },
};

const DAY_TONES: Record<string, Tone> = {
  MONDAY: 'blue',
  TUESDAY: 'purple',
  WEDNESDAY: 'emerald',
  THURSDAY: 'cyan',
  FRIDAY: 'blue',
  SATURDAY: 'purple',
  SUNDAY: 'gray',
};

const DAYS: string[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/* ============================================================================
 * TYPES + HELPERS
 * ========================================================================== */

interface GroupMember {
  student: {
    id: string;
    user?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  };
  isActive: boolean;
  joinedAt?: string;
}

function formatDayOfWeek(day: string): string {
  return `schedule.day.${day.toUpperCase()}`;
}

function formatCapacity(current: number, max?: number | null): string {
  if (!max) return String(current);
  return `${current} / ${max}`;
}

function capacityRatio(current: number, max?: number | null): number {
  if (!max) return 0;
  return Math.min(1, current / max);
}

function formatScheduleTime(time: string): string {
  return formatTime(time);
}

function getScheduleRoom(schedule: GroupSchedule, groupRoom?: string | null): string {
  return schedule.room || groupRoom || '—';
}

function getInitials(name: string): string {
  return (name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '—');
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES = [
  ['#2563EB', '#1D4ED8'],
  ['#475569', '#334155'],
  ['#059669', '#047857'],
  ['#0D9488', '#0F766E'],
  ['#4F46E5', '#4338CA'],
  ['#1E293B', '#0F172A'],
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function durationDays(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
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

function GroupDetailSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="0.75rem" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-72" radius="1rem" />
        <div className="lg:col-span-2"><Shimmer className="h-72" radius="1rem" /></div>
      </div>
      <Shimmer className="h-64 w-full" radius="1rem" />
    </div>
  );
}

function CountUp({
  value,
  duration = 1.1,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
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

  return (
    <span className="tabular-nums">
      {Math.round(n).toLocaleString('uz-UZ')}
      {suffix}
    </span>
  );
}

/** Apple Pro KPI tile */
function KpiTile({
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
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
        }}
      >
        <Icon paths={icon} size={17} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[20px] font-bold tracking-tight leading-none text-slate-900 dark:text-slate-100">
          <CountUp value={value} suffix={suffixFromSecondary(secondary)} />
        </div>
        <div className="mt-1 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function suffixFromSecondary(_?: string): string {
  return '';
}

/** Status badge */
function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  const tone: Tone = isActive ? 'emerald' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-[11px] font-medium"
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

/** Section panel */
function SectionPanel({
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
      className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: c.bg,
              color: c.fg,
              border: `1px solid ${c.border}`,
            }}
          >
            <Icon paths={icon} size={15} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
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

/** Info row */
function InfoRow({
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
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.02]">
      <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-slate-500 dark:text-slate-400">
        <span
          className="flex h-6 w-6 items-center justify-center rounded-md"
          style={{ background: c.bg, color: c.fg }}
        >
          <Icon paths={icon} size={12} strokeWidth={2.2} />
        </span>
        {label}
      </span>
      <span className="text-right text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        {value}
      </span>
    </div>
  );
}

/** Capacity bar */
function CapacityBar({ current, capacity }: { current: number; capacity?: number | null }) {
  const ratio = capacityRatio(current, capacity);
  const tone: Tone = ratio >= 0.9 ? 'red' : ratio >= 0.7 ? 'orange' : 'emerald';
  const c = TONES[tone];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] font-semibold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
        {formatCapacity(current, capacity)}
      </span>
      {capacity ? (
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: c.fg }}
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Day tile */
function DayTile({ day }: { day: string }) {
  const tone = DAY_TONES[day] ?? 'blue';
  const c = TONES[tone];
  const idx = DAYS.indexOf(day) + 1;
  return (
    <div
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative text-[13px] font-bold tracking-tight tabular-nums">
        {idx > 0 ? String(idx).padStart(2, '0') : '—'}
      </span>
    </div>
  );
}

/** Time chip */
function TimeChip({ start, end }: { start: string; end: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium tabular-nums tracking-tight text-blue-600 dark:text-blue-400">
      <Icon paths={I.clock} size={11} strokeWidth={2.2} />
      <span>{formatScheduleTime(start)}</span>
      <span className="opacity-40">→</span>
      <span>{formatScheduleTime(end)}</span>
    </div>
  );
}

/** Room chip */
function RoomChip({ name }: { name: string }) {
  const c = TONES.purple;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.door} size={10} strokeWidth={2.2} />
      {name}
    </span>
  );
}

/** Email chip */
function EmailChip({ email }: { email: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 tracking-tight"
    >
      <Icon paths={I.mail} size={10} strokeWidth={2} />
      <span className="truncate max-w-[14rem]">{email}</span>
    </span>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function GroupDetailPage() {
  const { t } = useI18n();
  usePageTitle(t('groups.detailsTitle'));
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

  /* ── Derived stats ────────────────────────────────────────────────── */
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

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (group.isLoading && !groupData) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
        <GroupDetailSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (group.isError || !groupData) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('groups.notFound')}
            message={getErrorMessage(group.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  const isActive = groupData.isActive;
  const teacherName = groupData.teacher
    ? fullName(
        groupData.teacher.user?.firstName,
        groupData.teacher.user?.lastName,
      )
    : '—';
  const teacherInitials = getInitials(teacherName);
  const teacherGradient = avatarGradient(teacherName);

  const { playTick, playPop } = usePremiumSound();

  const handleOpenGroupSidecar = useCallback(() => {
    if (!groupData) return;
    playPop();
    const sidecarData: QuickLookData = {
      type: 'group',
      id: groupData.id,
      title: groupData.name,
      subtitle: `${groupData.course?.name || 'Kurs'} · ${groupData.room || 'Xona belgilanmagan'}`,
      status: {
        label: groupData.isActive ? 'Faol guruh' : 'Nofaol',
        tone: groupData.isActive ? 'green' : 'amber',
      },
      metrics: [
        { label: 'O\'quvchilar', value: `${stats.totalMembers} / ${stats.capacity || 'Cheksiz'}` },
        { label: 'Dars jadvali', value: `${stats.scheduleCount} ta slot` },
        { label: 'Davomiylik', value: stats.days ? `${stats.days} kun` : '—' },
        { label: 'O\'qituvchi', value: teacherName },
      ],
      details: [
        { label: 'Guruh ID', value: groupData.id, copyable: true },
        { label: 'Guruh nomi', value: groupData.name },
        { label: 'Kurs / Fan', value: groupData.course?.name || '—' },
        { label: 'O\'qituvchi', value: teacherName },
        { label: 'Dars xonasi', value: groupData.room || '—' },
        { label: 'O\'quvchilar soni', value: `${stats.totalMembers} nafar` },
        { label: 'Maksimal sig\'im', value: groupData.capacity ? `${groupData.capacity} nafar` : 'Cheklanmagan' },
        { label: 'Boshlanish sanasi', value: formatDate(groupData.startDate) },
        { label: 'Tugash sanasi', value: formatDate(groupData.endDate) },
        { label: 'Holati', value: groupData.isActive ? 'Faol' : 'Nofaol' },
      ],
    };
    openSidecar(sidecarData);
  }, [groupData, playPop, stats, teacherName]);

  const handleOpenMemberSidecar = useCallback((member: GroupMember) => {
    playPop();
    const name = fullName(member.student.user?.firstName, member.student.user?.lastName);
    const sidecarData: QuickLookData = {
      type: 'student',
      id: member.student.id,
      title: name,
      subtitle: member.student.user?.email || (member.student.user as { phone?: string })?.phone || 'Guruh a\'zosi',
      status: {
        label: member.isActive ? 'Faol o\'quvchi' : 'Nofaol',
        tone: member.isActive ? 'green' : 'slate',
      },
      metrics: [
        { label: 'F.I.SH.', value: name },
        { label: 'Guruh', value: groupData?.name || '—' },
        { label: 'Qo\'shilgan sana', value: formatDate(member.joinedAt) },
      ],
      details: [
        { label: 'Talaba ID', value: member.student.id, copyable: true },
        { label: 'F.I.SH.', value: name },
        { label: 'Elektron pochta', value: member.student.user?.email || '—', copyable: Boolean(member.student.user?.email) },
        { label: 'Telefon', value: (member.student.user as { phone?: string })?.phone || '—', copyable: Boolean((member.student.user as { phone?: string })?.phone) },
        { label: 'Guruhga qo\'shilgan sana', value: formatDate(member.joinedAt) },
        { label: 'Holati', value: member.isActive ? 'Faol o\'quvchi' : 'Nofaol' },
      ],
    };
    openSidecar(sidecarData);
  }, [groupData, playPop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 's') {
        playTick();
        handleOpenGroupSidecar();
      } else if (e.key === 'r') {
        playTick();
        void refetchGroup();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenGroupSidecar, playTick, refetchGroup]);

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-5 sm:p-6 shadow-xl backdrop-blur-xl"
        >
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {/* Group icon tile */}
            <div
              className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm dark:bg-blue-500"
            >
              <Icon paths={I.groups} size={24} strokeWidth={2} className="relative" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.2} />
                  {t('enum.badge.GROUP')}
                </span>
                <StatusBadge
                  isActive={isActive}
                  label={t(isActive ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE')}
                />
                {groupData.course?.name && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    <Icon paths={I.book} size={11} strokeWidth={2.2} />
                    {groupData.course.name}
                  </span>
                )}
                {groupData.room && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    <Icon paths={I.door} size={11} strokeWidth={2.2} />
                    {groupData.room}
                  </span>
                )}
              </div>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {groupData.name}
              </h1>
              <p className="text-[13px] text-slate-500 dark:text-slate-400">
                {groupData.course?.name || t('enum.badge.COURSE')} ·{' '}
                {groupData.room || t('groupDetail.noRoom')}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={handleOpenGroupSidecar}
                  className="!border-blue-500/30 hover:!border-blue-500/50"
                >
                  <span className="inline-flex items-center gap-2 text-brand-600 dark:text-brand-400 font-medium">
                    <span>◨</span>
                    <span>Sidecar [S]</span>
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('open-ai-copilot', {
                        detail: {
                          prompt: `"${groupData.name}" guruhi bo'yicha tahlil ber: o'quvchilar soni (${stats.totalMembers} nafar, sig'imi ${stats.capacity}), o'qituvchi (${teacherName}), dars xonasi (${groupData.room || 'belgilanmagan'}) va dars jadvali.`,
                        },
                      }),
                    );
                  }}
                  className="!border-purple-500/30 hover:!border-purple-500/50"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
                  <span className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                    <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                    {t('aiAnalysis')}
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton asChild variant="primary">
                  <Link to={`/groups/${groupData.id}/edit`}>
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.edit} size={15} strokeWidth={2} />
                      {t('groupForm.editTitle')}
                    </span>
                  </Link>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI STATS
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile
          label={t('groupDetail.members', { count: stats.totalMembers })}
          value={stats.totalMembers}
          icon={I.usersRound}
          tone="blue"
        />
        <KpiTile
          label={t('groups.form.capacity')}
          value={stats.capacity}
          icon={I.users}
          tone="emerald"
        />
        <KpiTile
          label={t('nav.schedule')}
          value={stats.scheduleCount}
          icon={I.calendar}
          tone="purple"
        />
        <KpiTile
          label={t('groupForm.endDate')}
          value={stats.days ?? 0}
          icon={I.clockOutline}
          tone="orange"
          secondary={stats.days != null ? 'days' : undefined}
        />
      </motion.div>

      {/* ============================================================
          DETAILS + MEMBERS ROW
      ============================================================ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Details & AI Copilot */}
        <motion.div variants={cardVariants} className="lg:col-span-1 space-y-5">
          <SectionPanel
            icon={I.layers}
            tone="blue"
            title={t('groupDetail.details')}
          >
            <div className="p-3">
              <InfoRow
                icon={I.user}
                tone="cyan"
                label={t('groups.form.teacher')}
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="relative flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white/50 dark:ring-slate-900/50"
                      style={{ background: teacherGradient }}
                    >
                      <span className="relative">{teacherInitials}</span>
                    </span>
                    <span className="truncate max-w-[8rem]">{teacherName}</span>
                  </span>
                }
              />
              <InfoRow
                icon={I.users}
                tone="emerald"
                label={t('groups.form.capacity')}
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
                label={t('groups.form.startDate')}
                value={formatDate(groupData.startDate)}
              />
              <InfoRow
                icon={I.calendarEnd}
                tone="red"
                label={t('groupForm.endDate')}
                value={formatDate(groupData.endDate)}
              />
              <InfoRow
                icon={I.checkCircle}
                tone={isActive ? 'emerald' : 'gray'}
                label={t('groups.col.status')}
                value={
                  <StatusBadge
                    isActive={isActive}
                    label={t(isActive ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE')}
                  />
                }
              />
            </div>
          </SectionPanel>

          {/* AI Copilot Group Card */}
          <SectionPanel
            icon={I.sparkles}
            tone="purple"
            title="AI Guruh Tahlili"
            subtitle="Aqlli assistent va dars rejalashtirish"
            right={
              <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Copilot
              </span>
            }
          >
            <div className="p-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-ai-copilot', {
                      detail: {
                        prompt: `"${groupData.name}" guruhining dars qatnashuv ko'rsatkichlari, eng ko'p dars qoldiruvchi talabalari va guruh davomati monitoringini ko'rsat.`,
                      },
                    }),
                  );
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] hover:border-purple-500/30 hover:bg-purple-500/[0.05] transition-all text-left group"
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-[#2563EB]">
                    <Icon paths={I.calendar} size={12} strokeWidth={2.2} />
                  </span>
                  <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Guruh davomati & monitoring
                  </span>
                </div>
                <Icon paths={['M5 12h14', 'M12 5l7 7-7 7']} size={12} strokeWidth={2.5} className="text-[#64748B] group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-ai-copilot', {
                      detail: {
                        prompt: `"${groupData.name}" guruhi (${groupData.course?.name || 'Fan'}) uchun 45 daqiqalik namunaviy dars rejasi, vaqt taqsimoti va interaktiv mashqlar tuzib ber.`,
                      },
                    }),
                  );
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] hover:border-purple-500/30 hover:bg-purple-500/[0.05] transition-all text-left group"
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-500/10 text-[#6366F1]">
                    <Icon paths={I.book} size={12} strokeWidth={2.2} />
                  </span>
                  <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('group.lessonPlan45')}
                  </span>
                </div>
                <Icon paths={['M5 12h14', 'M12 5l7 7-7 7']} size={12} strokeWidth={2.5} className="text-[#64748B] group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('open-ai-copilot', {
                      detail: {
                        prompt: `"${groupData.name}" guruhidagi ${members.length} nafar o'quvchining o'zlashtirish va faollik darajasi, orqada qolayotganlar bo'yicha tavsiyalar ber.`,
                      },
                    }),
                  );
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-glass)] hover:border-purple-500/30 hover:bg-purple-500/[0.05] transition-all text-left group"
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-[#10B981]">
                    <Icon paths={I.users} size={12} strokeWidth={2.2} />
                  </span>
                  <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    O'quvchilar xavf tahlili
                  </span>
                </div>
                <Icon paths={['M5 12h14', 'M12 5l7 7-7 7']} size={12} strokeWidth={2.5} className="text-[#64748B] group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </SectionPanel>
        </motion.div>

        {/* Members */}
        <motion.div variants={cardVariants} className="lg:col-span-2">
          <SectionPanel
            icon={I.usersRound}
            tone="purple"
            title={t('groupDetail.members', { count: members.length })}
            subtitle={
              groupData.capacity
                ? `${members.length} / ${groupData.capacity}`
                : undefined
            }
            right={
              members.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6366F1]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6366F1]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {members.length}
                </span>
              ) : null
            }
          >
            {members.length === 0 ? (
              <div className="p-8">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6366F1]/10 text-[#6366F1]">
                    <Icon paths={I.empty} size={22} strokeWidth={1.8} />
                  </div>
                  <p className="mt-3 text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('groupDetail.noMembers')}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-[12px] font-medium text-[#64748B]">
                    {t('groupDetail.noMembersHint')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-[#ffffff08]">
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
                      transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                      className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#6366F1]/[0.03]"
                    >
                      <div
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ring-2 ring-white/50 dark:ring-slate-900/50"
                        style={{
                          background: gradient,
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,0,0,0.25)',
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
                        <span className="relative">{initials}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {name}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {member.student.user?.email && (
                            <EmailChip email={member.student.user.email} />
                          )}
                          {member.joinedAt && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-medium tabular-nums text-[#64748B]">
                              <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                              {formatDate(member.joinedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenMemberSidecar(member)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/40 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                          title="Split View Sidecar"
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
          SCHEDULE
      ============================================================ */}
      {schedules.length > 0 && (
        <motion.div variants={cardVariants}>
          <SectionPanel
            icon={I.calendar}
            tone="green"
            title={t('nav.schedule')}
            subtitle={`${schedules.length} slots`}
            right={
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                {schedules.length}
              </span>
            }
          >
            <div className="relative divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-[#ffffff08]">
              {schedules.map((schedule, idx) => (
                <motion.div
                  key={schedule.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#10B981]/[0.03]"
                >
                  <DayTile day={schedule.dayOfWeek} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {t(formatDayOfWeek(schedule.dayOfWeek))}
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
    </motion.div>
  );
}