/**
 * M-EDU AttendancePage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient calendar-check tile + live stats chips + CTA
 *  - Animated KPI bar (Rate %, Present, Absent, Late, Excused) with count-up
 *  - Premium filter toolbar with squircle leading icons
 *  - Premium rows: gradient avatar + date + group chip + source chip + status
 *  - Inline status badge with tone-aware pulse
 *  - Premium Record / Edit / Void modals with icon-leading fields
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + debounce + schedule-error handling preserved
 */
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { attendanceApi, studentsApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  GlassButton,
  useToasts,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toLocalISOString } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type {
  Paginated,
  Attendance,
  Student,
  Group,
  AttendanceStatus,
  AttendanceAnalytics,
} from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';

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
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  calendarCheck: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
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
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6', 'M14 11v6',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
  ],
  fingerprint: [
    'M12 11a2 2 0 0 1 2 2v3', 'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  spark: [
    'M12 2v6', 'M12 16v6', 'M4.9 4.9l4.2 4.2', 'M14.9 14.9l4.2 4.2',
    'M2 12h6', 'M16 12h6', 'M4.9 19.1l4.2-4.2', 'M14.9 9.1l4.2-4.2',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
};

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const STATUS_TONE: Record<AttendanceStatus, Tone> = {
  PRESENT: 'emerald',
  ABSENT: 'red',
  LATE: 'orange',
  EXCUSED: 'blue',
};

const STATUS_ICON: Record<AttendanceStatus, string[]> = {
  PRESENT: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  ABSENT: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  LATE: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  EXCUSED: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
};

const STATUS_PULSE: Record<AttendanceStatus, boolean> = {
  PRESENT: true,
  ABSENT: true,
  LATE: false,
  EXCUSED: false,
};

const SOURCE_TONE: Record<string, Tone> = {
  FACE_ID: 'purple',
  FACE: 'purple',
  MANUAL: 'blue',
  QR: 'cyan',
  IMPORT: 'gray',
  SYSTEM: 'gray',
};

const SOURCE_ICON: Record<string, string[]> = {
  FACE_ID: ['M12 11a2 2 0 0 1 2 2v3', 'M8 13a4 4 0 0 1 8 0v5', 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10'],
  FACE: ['M12 11a2 2 0 0 1 2 2v3', 'M8 13a4 4 0 0 1 8 0v5', 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10'],
  MANUAL: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  QR: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M19 19h2v2h-2z'],
  IMPORT: ['M12 3v12', 'M19 10l-7 7-7-7', 'M21 21H3'],
  SYSTEM: ['M12 2v3', 'M12 19v3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M2 12h3', 'M19 12h3', 'M4.9 19.1l2.1-2.1', 'M17 7l2.1-2.1'],
};

interface AttendanceFilters {
  page: number;
  limit: number;
  groupId?: string;
  date?: string;
  status?: AttendanceStatus;
}

interface AttendanceFormState {
  studentId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
}

const INITIAL_FORM: AttendanceFormState = {
  studentId: '',
  groupId: '',
  date: toLocalISOString(),
  status: 'PRESENT',
  note: '',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

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

function fullStudentName(a: Attendance | null | undefined): string {
  if (!a?.student?.user) return '—';
  const { firstName, lastName } = a.student.user;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
}

function isScheduleError(msg: string): boolean {
  return (
    msg.includes('jadval') ||
    msg.includes('schedule') ||
    msg.includes('rejalashtirilmagan') ||
    msg.includes('расписан')
  );
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

function AttendanceSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-12 w-full" radius="1rem" />
      <Shimmer className="h-96 w-full" radius="1.75rem" />
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

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  percent = false,
  secondary,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  percent?: boolean;
  secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} suffix={percent ? '%' : ''} />
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

/** Premium status badge with pulse */
function StatusBadge({ status, label }: { status: AttendanceStatus; label: string }) {
  const tone = STATUS_TONE[status];
  const c = TONES[tone];
  const pulse = STATUS_PULSE[status];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
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
      {label}
    </span>
  );
}

/** Premium source chip */
function SourceChip({ source, label }: { source: string; label: string }) {
  const key = (source || '').toUpperCase();
  const tone = SOURCE_TONE[key] ?? 'gray';
  const c = TONES[tone];
  const icon = SOURCE_ICON[key] ?? SOURCE_ICON.SYSTEM;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={icon} size={10} strokeWidth={2.2} />
      {label}
    </span>
  );
}

/** Squircle leading icon for inputs */
function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
}

/** Tone-aware status segmented control (used in Edit modal) */
function StatusSegmented({
  value,
  onChange,
  t,
}: {
  value: AttendanceStatus;
  onChange: (s: AttendanceStatus) => void;
  t: (k: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('attendance.selectStatus')}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {ATTENDANCE_STATUSES.map((s) => {
        const active = value === s;
        const c = TONES[STATUS_TONE[s]];
        return (
          <motion.button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-[11.5px] font-bold tracking-tight outline-none transition-colors"
            style={{
              borderColor: active ? c.border : 'rgba(0,0,0,0.06)',
              background: active ? c.bg : 'transparent',
              color: active ? c.fg : '#86868B',
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`
                : 'none',
            }}
            tabIndex={0}
            onKeyDown={(e: any) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                background: active ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.03)',
                color: active ? c.fg : '#86868B',
              }}
            >
              <Icon paths={STATUS_ICON[s]} size={14} strokeWidth={2.2} />
            </span>
            <span className="uppercase tracking-[0.06em]">
              {t(`attendance.${s.toLowerCase()}`)}
            </span>
            <AnimatePresence>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING.snappy}
                  className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full"
                  style={{ background: c.fg, color: '#fff' }}
                >
                  <Icon paths={I.check} size={8} strokeWidth={3.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function AttendancePage() {
  const { t } = useI18n();
  usePageTitle(t('attendance.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  useAttendanceSocket();

  /* ── Filter state ─────────────────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');

  /* ── Debounce filters ─────────────────────────────────────────────── */
  const debouncedGroupId = useDebounce(groupId);
  const debouncedDate = useDebounce(date);
  const debouncedStatus = useDebounce(status);

  /* ── Modal state ──────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<AttendanceFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof AttendanceFormState, string>>
  >({});

  /* ── Edit / void state ────────────────────────────────────────────── */
  const [editTarget, setEditTarget] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');
  const [voidTarget, setVoidTarget] = useState<Attendance | null>(null);

  /* ── Query params ─────────────────────────────────────────────────── */
  const params = useMemo<AttendanceFilters>(
    () => ({
      page,
      limit: 20,
      groupId: debouncedGroupId || undefined,
      date: debouncedDate || undefined,
      status: (debouncedStatus as AttendanceStatus) || undefined,
    }),
    [page, debouncedGroupId, debouncedDate, debouncedStatus],
  );

  /* ── Queries ──────────────────────────────────────────────────────── */
  const attendance = useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics', debouncedGroupId, debouncedDate],
    queryFn: () =>
      attendanceApi.analytics({
        groupId: debouncedGroupId || undefined,
        date: debouncedDate || undefined,
      }) as Promise<AttendanceAnalytics>,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const data = attendance.data as Paginated<Attendance> | undefined;
  const groupList = useMemo(() => {
    if (Array.isArray(groups.data)) return groups.data;
    return (groups.data as Paginated<Group> | undefined)?.items || [];
  }, [groups.data]);
  const studentList = useMemo(() => {
    if (Array.isArray(students.data)) return students.data;
    return (students.data as Paginated<Student> | undefined)?.items || [];
  }, [students.data]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const statusCounts = useMemo(() => {
    const byStatus = analyticsQuery.data?.byStatus ?? [];
    const map: Record<string, number> = {};
    byStatus.forEach((s) => {
      map[s.status] = s.count;
    });
    return {
      present: map['PRESENT'] ?? 0,
      absent: map['ABSENT'] ?? 0,
      late: map['LATE'] ?? 0,
      excused: map['EXCUSED'] ?? 0,
    };
  }, [analyticsQuery.data]);

  /* ── Schedule-error helper ────────────────────────────────────────── */
  const pushScheduleAwareError = useCallback(
    (e: Error) => {
      const msg = getErrorMessage(e);
      push('error', isScheduleError(msg) ? t('attendance.noSchedule') : msg);
    },
    [push, t],
  );

  /* ── Create mutation ──────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () =>
      attendanceApi.create({
        groupId: form.groupId,
        date: form.date ? `${form.date}T12:00:00.000Z` : new Date().toISOString(),
        records: [
          { studentId: form.studentId, status: form.status, note: form.note || undefined },
        ],
      }),
    onSuccess: () => {
      push('success', t('attendance.recordedSuccess'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      if (form.studentId) {
        qc.invalidateQueries({ queryKey: queryKeys.students.detail(form.studentId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      void attendance.refetch();
      void analyticsQuery.refetch();
    },
    onError: pushScheduleAwareError,
  });

  /* ── Update mutation ──────────────────────────────────────────────── */
  const updateRecord = useMutation({
    mutationFn: (vars: { id: string; status: AttendanceStatus; note: string }) =>
      attendanceApi.update(vars.id, { status: vars.status, note: vars.note }),
    onSuccess: () => {
      push('success', t('attendance.recordUpdated'));
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void attendance.refetch();
      void analyticsQuery.refetch();
    },
    onError: pushScheduleAwareError,
  });

  /* ── Void mutation ────────────────────────────────────────────────── */
  const voidRecord = useMutation({
    mutationFn: (id: string) => attendanceApi.remove(id),
    onSuccess: () => {
      push('success', t('attendance.recordVoided'));
      setVoidTarget(null);
      qc.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void attendance.refetch();
      void analyticsQuery.refetch();
    },
    onError: pushScheduleAwareError,
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleFilterChange = useCallback(
    (setter: (value: string) => void) =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setter(e.target.value);
        setPage(1);
      },
    [],
  );

  const handleFormChange = useCallback(
    (field: keyof AttendanceFormState) =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof AttendanceFormState, string>> = {};
    if (!form.studentId) errors.studentId = t('common.validation.selectStudent');
    if (!form.groupId) errors.groupId = t('common.validation.selectGroup');
    if (!form.date) errors.date = t('common.validation.selectDate');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const openEdit = useCallback((record: Attendance) => {
    setEditTarget(record);
    setEditStatus(record.status);
    setEditNote(record.note || '');
  }, []);

  const handleEditSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editTarget) return;
      updateRecord.mutate({ id: editTarget.id, status: editStatus, note: editNote });
    },
    [editTarget, editStatus, editNote, updateRecord],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const { refetch: refetchAttendance } = attendance;
  const handleRetry = useCallback(() => {
    void refetchAttendance();
  }, [refetchAttendance]);

  const hasActiveFilters = Boolean(groupId || date || status);
  const totalRecords = data?.total || 0;
  const overallRate = analyticsQuery.data?.overall.rate ?? 0;
  const overallPresent = analyticsQuery.data?.overall.present ?? 0;
  const overallTotal = analyticsQuery.data?.overall.total ?? 0;

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (attendance.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <AttendanceSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (attendance.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('attendance.loadFailed')}
            message={getErrorMessage(attendance.error as Error)}
            onRetry={handleRetry}
          />
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
      className="page-container space-y-5"
    >
      {toastNode}

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
            {/* Gradient calendar-check tile */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(52,199,89,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
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
              <Icon paths={I.calendarCheck} size={28} strokeWidth={2.2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Attendance
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {totalRecords} {totalRecords === 1 ? t('attendance.countOne') : t('attendance.countMany')}
                </span>
                {overallTotal > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {overallRate}% {t('executive.attendanceRate')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('attendance.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('attendance.pageSubtitle')}
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
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('open-ai-copilot', {
                        detail: {
                          prompt: "Bugungi markaz davomati, darsga kelmaganlar va sababsiz qoldirgan o'quvchilar tahlilini ko'rsat.",
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
                    AI Tahlil
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
                  variant="primary"
                  onClick={() => setModalOpen(true)}
                  aria-label={t('attendance.record')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    {t('attendance.record')}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI STATS
      ============================================================ */}
      {analyticsQuery.data && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile
            label={t('executive.attendanceRate')}
            value={overallRate}
            icon={I.calendarCheck}
            tone={overallRate >= 80 ? 'emerald' : overallRate >= 60 ? 'orange' : 'red'}
            percent
            secondary={t('attendance.trendPresent', {
              present: overallPresent,
              total: overallTotal,
            })}
          />
          <KpiTile
            label={t('attendance.present')}
            value={statusCounts.present}
            icon={I.checkCircle}
            tone="emerald"
          />
          <KpiTile
            label={t('attendance.absent')}
            value={statusCounts.absent}
            icon={I.xCircle}
            tone="red"
          />
          <KpiTile
            label={t('attendance.late')}
            value={statusCounts.late}
            icon={I.clock}
            tone="orange"
          />
        </motion.div>
      )}

      {/* ============================================================
          FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <FieldIcon icon={I.usersRound} tone="purple" />
              <GlassSelect
                value={groupId}
                onChange={handleFilterChange(setGroupId)}
                aria-label={t('students.filterGroupLabel')}
                className="pl-11"
              >
                <option value="">{t('attendance.allGroups')}</option>
                {groupList.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </GlassSelect>
            </div>
            <div className="relative">
              <FieldIcon icon={I.calendar} tone="blue" />
              <GlassInput
                type="date"
                value={date}
                onChange={handleFilterChange(setDate)}
                aria-label={t('attendance.filterByDate')}
                className="pl-11"
              />
            </div>
            <div className="relative">
              <FieldIcon icon={I.filter} tone="orange" />
              <GlassSelect
                value={status}
                onChange={handleFilterChange(setStatus)}
                aria-label={t('attendance.filterByStatus')}
                className="pl-11"
              >
                <option value="">{t('attendance.allStatuses')}</option>
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`attendance.${s.toLowerCase()}`)}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          RECORDS LIST
      ============================================================ */}
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
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />

        {!data || data.items.length === 0 ? (
          <div className="relative p-10">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF]"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(0,122,255,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {hasActiveFilters
                  ? t('attendance.emptyFilteredTitle')
                  : t('attendance.emptyTitle')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {hasActiveFilters
                  ? t('attendance.emptyFilteredHint')
                  : t('attendance.emptyMessage')}
              </p>
              {!hasActiveFilters && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setModalOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('attendance.record')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
              {data.items.map((a, idx) => {
                const name = fullStudentName(a);
                const initials = getInitials(name);
                const gradient = avatarGradient(name);
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                    className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#34C759]/[0.03]"
                  >
                    {/* Avatar */}
                    <div
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
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

                    {/* Student + meta */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                          {formatDate(a.date)}
                        </span>
                        {a.group?.name && (
                          <span className="inline-flex items-center gap-1">
                            <Icon paths={I.book} size={10} strokeWidth={2.2} className="opacity-60" />
                            {a.group.name}
                          </span>
                        )}
                        <SourceChip source={a.source || 'SYSTEM'} label={a.source || 'SYSTEM'} />
                        {a.note && (
                          <span
                            className="max-w-[16rem] truncate"
                            title={a.note}
                          >
                            {a.note}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <StatusBadge
                      status={a.status}
                      label={t(`attendance.${a.status.toLowerCase()}`)}
                    />

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <motion.button
                        type="button"
                        onClick={() => openEdit(a)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label={t('attendance.editAria', {
                          name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
                        })}
                        title={t('common.edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                        style={{
                          background: 'rgba(0,122,255,0.10)',
                          color: '#007AFF',
                          border: '1px solid rgba(0,122,255,0.2)',
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}>
                        <Icon paths={I.edit} size={13} strokeWidth={2} />
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setVoidTarget(a)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label={t('attendance.voidAria', {
                          name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
                        })}
                        title={t('attendance.void')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                        style={{
                          background: 'rgba(255,59,48,0.10)',
                          color: '#FF3B30',
                          border: '1px solid rgba(255,59,48,0.2)',
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.currentTarget.click();
                          }
                        }}>
                        <Icon paths={I.trash} size={13} strokeWidth={2} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="relative border-t border-[#00000008] px-4 py-3 dark:border-[#ffffff08]">
              <GlassPagination
                page={page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </motion.div>

      {/* ============================================================
          RECORD MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('attendance.record')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#34C75933] bg-[#34C759]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#34C759]/15 text-[#34C759]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              Record an attendance entry. Group must have a schedule for the selected date.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField
              label={t('attendance.selectStudent')}
              required
              error={formErrors.studentId}
            >
              <div className="relative">
                <FieldIcon icon={I.user} tone="purple" />
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={formErrors.studentId ? 'student-error' : undefined}
                  className="pl-11"
                >
                  <option value="">{t('attendance.studentPlaceholder')}</option>
                  {studentList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user?.firstName} {s.user?.lastName}
                    </option>
                  ))}
                </GlassSelect>
              </div>
              {formErrors.studentId && (
                <span
                  id="student-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.studentId}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('attendance.selectGroup')}
              required
              error={formErrors.groupId}
            >
              <div className="relative">
                <FieldIcon icon={I.usersRound} tone="green" />
                <GlassSelect
                  value={form.groupId}
                  onChange={handleFormChange('groupId')}
                  required
                  aria-invalid={Boolean(formErrors.groupId)}
                  aria-describedby={formErrors.groupId ? 'group-error' : undefined}
                  className="pl-11"
                >
                  <option value="">{t('attendance.groupPlaceholder')}</option>
                  {groupList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </GlassSelect>
              </div>
              {formErrors.groupId && (
                <span
                  id="group-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.groupId}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('attendance.selectDate')}
              required
              error={formErrors.date}
            >
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="blue" />
                <GlassInput
                  type="date"
                  value={form.date}
                  onChange={handleFormChange('date')}
                  required
                  aria-invalid={Boolean(formErrors.date)}
                  aria-describedby={formErrors.date ? 'date-error' : undefined}
                  className="pl-11"
                />
              </div>
              {formErrors.date && (
                <span
                  id="date-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.date}
                </span>
              )}
            </GlassField>

            <GlassField label={t('common.status')} required>
              <div className="relative">
                <FieldIcon icon={I.shield} tone="orange" />
                <GlassSelect
                  value={form.status}
                  onChange={handleFormChange('status')}
                  aria-label={t('attendance.selectStatus')}
                  className="pl-11"
                >
                  {ATTENDANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`attendance.${s.toLowerCase()}`)}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>
          </div>

          <GlassField label={t('attendance.note')}>
            <div className="relative">
              <FieldIcon icon={I.note} tone="gray" />
              <GlassInput
                value={form.note}
                onChange={handleFormChange('note')}
                placeholder={t('attendance.notePlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
                disabled={create.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={create.isPending}>
                <span className="inline-flex items-center gap-2">
                  {create.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {t('attendance.recordSubmit')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          EDIT MODAL
      ============================================================ */}
      <GlassModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={t('attendance.editTitle')}
        wide
      >
        <form className="space-y-5" onSubmit={handleEditSubmit} noValidate>
          {/* Student summary */}
          {editTarget && (
            <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{
                  background: avatarGradient(fullStudentName(editTarget)),
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                }}
              >
                <span className="relative">{getInitials(fullStudentName(editTarget))}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {fullStudentName(editTarget)}
                </p>
                <p className="text-[11px] font-medium text-[#86868B]">
                  {formatDate(editTarget.date)}
                  {editTarget.group?.name ? ` · ${editTarget.group.name}` : ''}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
              {t('common.status')}
            </p>
            <StatusSegmented
              value={editStatus}
              onChange={setEditStatus}
              t={t}
            />
          </div>

          <GlassField label={t('attendance.note')}>
            <div className="relative">
              <FieldIcon icon={I.note} tone="gray" />
              <GlassInput
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder={t('attendance.notePlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setEditTarget(null)}
                disabled={updateRecord.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={updateRecord.isPending}>
                <span className="inline-flex items-center gap-2">
                  {updateRecord.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {t('common.save')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          VOID CONFIRM MODAL
      ============================================================ */}
      <GlassModal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title={t('attendance.voidTitle')}
      >
        <div className="space-y-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF3B30]/15 text-[#FF3B30]">
              <Icon paths={I.warning} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-semibold leading-snug text-[#FF3B30]">
              {t('attendance.voidConfirmBefore')}{' '}
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                {voidTarget?.student?.user
                  ? `${voidTarget.student.user.firstName} ${voidTarget.student.user.lastName}`
                  : t('attendance.thisStudent')}
              </strong>{' '}
              {t('attendance.voidConfirmAfter', {
                date: voidTarget ? formatDate(voidTarget.date) : '',
              })}
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setVoidTarget(null)}
                disabled={voidRecord.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="danger"
                onClick={() => voidTarget && voidRecord.mutate(voidTarget.id)}
                disabled={voidRecord.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2">
                  {voidRecord.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('attendance.voiding')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.trash} size={14} strokeWidth={2.5} />
                      {t('attendance.voidRecord')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>
    </motion.div>
  );
}