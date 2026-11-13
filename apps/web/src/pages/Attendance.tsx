'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, LayoutGroup } from 'framer-motion';
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
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useDebounce } from '@/hooks/useDebounce';
import { cn, usePrefersReducedMotion } from '@/lib/design';
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
import { useOptionalAuthState } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';
import { OfficialAttendanceRegisterModal } from '@/components/attendance/OfficialAttendanceRegisterModal';
import { AttendanceWaveChart } from '@/components/dashboard/AttendanceWaveChart';
import { AttendanceHeatmap } from '@/components/dashboard/AttendanceHeatmap';
import { AttendanceRiskSection } from '@/components/dashboard/AttendanceRiskSection';
import { AttendanceTrafficFlowHeatmap } from '@/components/camera/AttendanceTrafficFlowHeatmap';
import { RushHourBatchAttendanceProcessor } from '@/components/camera/RushHourBatchAttendanceProcessor';

/* ============================================================================
 * DESIGN TOKENS
 * One surface, one spring, four status colours. Nothing else.
 * ========================================================================== */

const SPRING = { type: 'spring' as const, stiffness: 420, damping: 36, mass: 0.8 };

/** The single glass material used for every card on the page. */
const SURFACE = cn(
  'rounded-[28px] border border-white/70 bg-white/70 backdrop-blur-2xl',
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9),0_12px_32px_-16px_rgba(15,23,42,0.18)]',
  'dark:border-white/10 dark:bg-white/[0.05]',
  'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_16px_40px_-18px_rgba(0,0,0,0.6)]',
);

const MUTED = 'text-slate-500 dark:text-slate-400';
const STRONG = 'text-slate-900 dark:text-white';

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70';

/* ============================================================================
 * ICONS (only what is actually used)
 * ========================================================================== */

const I = {
  calendar: [
    'M8 2v3.5',
    'M16 2v3.5',
    'M3.5 9.5h17',
    'M18.5 4h-13A2.5 2.5 0 0 0 3 6.5v12A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-12A2.5 2.5 0 0 0 18.5 4z',
  ],
  check: ['M20 6.5 9 17.5l-5-5'],
  checkCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M8.5 12.5l2.5 2.5 5-5.5'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6.5V12l3.8 2.2'],
  shield: [
    'M12 21.5s7.5-3.8 7.5-9.8V5.2L12 2.5 4.5 5.2v6.5c0 6 7.5 9.8 7.5 9.8z',
    'M9.5 12l1.8 1.8 3.4-3.6',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4.5A2.5 2.5 0 0 0 2 6.5v13A2.5 2.5 0 0 0 4.5 22h13a2.5 2.5 0 0 0 2.5-2.5V13',
    'M18.4 2.6a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.4-9.4z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v13.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19.5V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  user: ['M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M20 21v-1.5a7.5 7.5 0 0 0-16 0V21'],
  note: [
    'M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8L14 2z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h5',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4.5',
    'M12 17.2h.01',
  ],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  panel: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M15 3v18',
  ],
  refresh: [
    'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5',
    'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16',
    'M16 16h5v5',
  ],
  download: ['M12 3v12', 'M7 11l5 5 5-5', 'M4 20h16'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  sparkles: [
    'M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z',
    'M19 3v3',
    'M20.5 4.5h-3',
  ],
  bolt: ['M13 2 4 14h7l-1 8 9-12h-7l1-8z'],
  sheet: [
    'M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8L14 2z',
    'M14 2v6h6',
    'M9 14l2 2 4-4',
  ],
} as const;

const Icon = memo(function Icon({
  paths,
  size = 18,
  strokeWidth = 2,
  className,
}: {
  paths: readonly string[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
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
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
});

/* ============================================================================
 * DOMAIN CONSTANTS
 * ========================================================================== */

const STATUSES: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];

/** Static class names so Tailwind can see them. */
const STATUS_STYLE: Record<
  AttendanceStatus,
  { icon: readonly string[]; hex: string; solid: string; soft: string; text: string; ring: string }
> = {
  PRESENT: {
    icon: I.checkCircle,
    hex: '#10B981',
    solid: 'bg-emerald-500',
    soft: 'bg-emerald-500/12',
    text: 'text-emerald-600 dark:text-emerald-400',
    ring: 'ring-emerald-500/50',
  },
  LATE: {
    icon: I.clock,
    hex: '#F59E0B',
    solid: 'bg-amber-500',
    soft: 'bg-amber-500/12',
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500/50',
  },
  ABSENT: {
    icon: I.xCircle,
    hex: '#EF4444',
    solid: 'bg-red-500',
    soft: 'bg-red-500/12',
    text: 'text-red-600 dark:text-red-400',
    ring: 'ring-red-500/50',
  },
  EXCUSED: {
    icon: I.shield,
    hex: '#007AFF',
    solid: 'bg-blue-500',
    soft: 'bg-blue-500/12',
    text: 'text-blue-600 dark:text-blue-400',
    ring: 'ring-blue-500/50',
  },
};

const QUICK_NOTES = [
  'Sababli ariza',
  'Shifokor ko‘rigi',
  'Transport kechikishi',
  'Olimpiada / Tadbir',
  'Ota-ona ogohlantirdi',
] as const;

const SOURCE_LABEL: Record<string, string> = {
  FACE_ID: 'Face ID',
  FACE: 'Face ID',
  FACE_KIOSK: 'Kiosk',
  TURNSTILE: 'Turniket',
  QR: 'QR',
  MANUAL: 'Qo‘lda',
  IMPORT: 'Import',
  SYSTEM: 'Tizim',
};

const SOURCE_FILTERS = [
  { id: 'BIOMETRIC', label: 'Face ID / Turniket' },
  { id: 'QR', label: 'QR' },
  { id: 'MANUAL', label: 'Qo‘lda' },
] as const;

type SortOption = 'date-desc' | 'name-asc' | 'status-asc';
type TabId = 'ledger' | 'analytics' | 'radar' | 'flow';

/** Mirrors `@Roles(...)` on `DELETE /attendance/:id`. */
const VOID_ROLES = new Set(['SUPER_ADMIN', 'ORG_ADMIN', 'MANAGER']);

interface AttendanceFilters {
  page: number;
  limit: number;
  groupId?: string;
  date?: string;
  status?: AttendanceStatus;
  search?: string;
  source?: string;
  sort?: string;
}

interface FormState {
  studentId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
}

const createForm = (groupId = '', date = ''): FormState => ({
  studentId: '',
  groupId,
  date: date || toLocalISOString(),
  status: 'PRESENT',
  note: '',
});

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function getInitials(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return parts
    .slice(0, 2)
    .map((p) => Array.from(p)[0] ?? '')
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  ['#007AFF', '#5856D6'],
  ['#5856D6', '#AF52DE'],
  ['#10B981', '#0284C7'],
  ['#F59E0B', '#EF4444'],
  ['#0EA5E9', '#2563EB'],
  ['#14B8A6', '#059669'],
] as const;

function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const [a, b] = AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function fullStudentName(a: Attendance | null | undefined): string {
  if (!a?.student) return '—';
  const fallback = (a.student as { name?: string }).name || '—';
  const user = a.student.user;
  if (!user) return fallback;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || fallback;
}

function isScheduleError(msg: string): boolean {
  const l = msg.toLowerCase();
  return (
    l.includes('jadval') ||
    l.includes('schedule') ||
    l.includes('rejalashtirilmagan') ||
    l.includes('расписан')
  );
}

/** Shifts a YYYY-MM-DD string by whole days in local time (no UTC drift). */
function shiftLocalISO(iso: string, delta: number): string {
  const base = iso ? new Date(`${iso}T12:00:00`) : new Date();
  if (Number.isNaN(base.getTime())) return toLocalISOString();
  base.setDate(base.getDate() + delta);
  return toLocalISOString(base);
}

function toggleNote(current: string, preset: string): string {
  const parts = current
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  return (parts.includes(preset) ? parts.filter((p) => p !== preset) : [...parts, preset]).join(
    ' · ',
  );
}

/** Largest-remainder method: integer percentages that always sum to 100. */
function apportion(counts: number[]): number[] {
  const total = counts.reduce((a, c) => a + Math.max(0, c), 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (Math.max(0, c) / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, f) => a + f, 0);
  exact
    .map((e, i) => ({ i, r: e - floors[i] }))
    .sort((a, b) => b.r - a.r)
    .forEach(({ i }) => {
      if (left > 0) {
        floors[i] += 1;
        left -= 1;
      }
    });
  return floors;
}

/* ============================================================================
 * SMALL BUILDING BLOCKS
 * ========================================================================== */

/** Round icon button with a guaranteed 44px touch target. */
const IconButton = memo(function IconButton({
  icon,
  label,
  onClick,
  tone = 'neutral',
  spinning = false,
  size = 'md',
}: {
  icon: readonly string[];
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'blue' | 'red' | 'violet';
  spinning?: boolean;
  size?: 'sm' | 'md';
}) {
  const tones = {
    neutral: 'text-slate-600 hover:bg-black/[0.06] dark:text-slate-300 dark:hover:bg-white/10',
    blue: 'text-blue-600 hover:bg-blue-500/10 dark:text-blue-400',
    red: 'text-red-500 hover:bg-red-500/10',
    violet: 'text-violet-600 hover:bg-violet-500/10 dark:text-violet-300',
  } as const;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center rounded-full transition active:scale-90',
        size === 'md' ? 'h-11 w-11' : 'h-10 w-10',
        tones[tone],
        FOCUS,
      )}
    >
      <Icon paths={icon} size={size === 'md' ? 19 : 18} className={spinning ? 'animate-spin' : ''} />
    </button>
  );
});

/** Tappable KPI tile. Doubles as a status filter. */
const KpiTile = memo(function KpiTile({
  status,
  label,
  value,
  pct,
  active,
  onClick,
}: {
  status: AttendanceStatus;
  label: string;
  value: number;
  pct: number;
  active: boolean;
  onClick: () => void;
}) {
  const s = STATUS_STYLE[status];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        SURFACE,
        'flex min-h-[112px] flex-col justify-between p-4 text-left transition active:scale-[0.98] sm:p-5',
        active ? `ring-2 ${s.ring}` : 'hover:bg-white/90 dark:hover:bg-white/[0.08]',
        FOCUS,
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
            active ? `${s.solid} text-white` : `${s.soft} ${s.text}`,
          )}
        >
          <Icon paths={s.icon} size={20} />
        </span>
        <span className={cn('text-[13px] font-medium tabular-nums', MUTED)}>{pct}%</span>
      </div>
      <div className="mt-4">
        <div className={cn('text-3xl font-semibold leading-none tracking-tight tabular-nums', STRONG)}>
          {value.toLocaleString('uz-UZ')}
        </div>
        <div className={cn('mt-1.5 truncate text-[13px] font-medium', MUTED)}>{label}</div>
      </div>
    </button>
  );
});

/**
 * Inline status switcher — one tap to set any status.
 * Mobile: four labelled segments across the full width.
 * Desktop: four compact icon segments.
 */
const StatusSwitch = memo(function StatusSwitch({
  value,
  onChange,
  disabled,
  t,
}: {
  value: AttendanceStatus;
  onChange: (s: AttendanceStatus) => void;
  disabled?: boolean;
  t: (k: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('attendance.selectStatus')}
      className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-black/[0.05] p-1 dark:bg-white/[0.07] lg:w-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {STATUSES.map((st) => {
        const s = STATUS_STYLE[st];
        const active = value === st;
        const text = t(`attendance.${st.toLowerCase()}`);
        return (
          <button
            key={st}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={text}
            title={text}
            disabled={disabled}
            onClick={() => !active && onChange(st)}
            className={cn(
              'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1.5 text-xs font-semibold transition active:scale-95 disabled:opacity-60 lg:h-9 lg:w-10 lg:px-0',
              active
                ? `${s.solid} text-white shadow-sm`
                : 'text-slate-500 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-white/10',
              FOCUS,
            )}
          >
            <Icon paths={s.icon} size={16} />
            <span className="truncate lg:sr-only">{text}</span>
          </button>
        );
      })}
    </div>
  );
});

/** Larger status picker used inside modals. */
function StatusPicker({
  value,
  onChange,
  t,
}: {
  value: AttendanceStatus;
  onChange: (s: AttendanceStatus) => void;
  t: (k: string) => string;
}) {
  return (
    <div role="radiogroup" aria-label={t('attendance.selectStatus')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STATUSES.map((st) => {
        const s = STATUS_STYLE[st];
        const active = value === st;
        return (
          <button
            key={st}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(st)}
            className={cn(
              'flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition active:scale-[0.97]',
              active
                ? `border-transparent ${s.solid} text-white shadow-md`
                : 'border-black/[0.08] bg-white/60 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
              FOCUS,
            )}
          >
            <Icon paths={s.icon} size={18} />
            {t(`attendance.${st.toLowerCase()}`)}
          </button>
        );
      })}
    </div>
  );
}

/** Note input + quick preset chips (shared by create and edit). */
function NoteField({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
  const active = value
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <GlassField label={t('attendance.note')}>
      <div className="relative">
        <Icon paths={I.note} size={16} className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)} />
        <GlassInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('attendance.notePlaceholder')}
          className="pl-10"
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {QUICK_NOTES.map((preset) => {
          const on = active.includes(preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(toggleNote(value, preset))}
              className={cn(
                'min-h-[36px] rounded-full border px-3.5 text-xs font-medium transition active:scale-95',
                on
                  ? 'border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  : 'border-black/[0.08] bg-white/60 text-slate-600 hover:border-blue-500/40 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
                FOCUS,
              )}
            >
              {on ? '✓ ' : '+ '}
              {preset}
            </button>
          );
        })}
      </div>
    </GlassField>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
  );
}

function PageSkeleton() {
  const bar = 'animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/[0.06]';
  return (
    <div className="space-y-4" aria-busy="true">
      <div className={cn(bar, 'h-24')} />
      <div className={cn(bar, 'h-12')} />
      <div className={cn(bar, 'h-36')} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(bar, 'h-28')} />
        ))}
      </div>
      <div className={cn(bar, 'h-80')} />
    </div>
  );
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

const PAGE_CLASS =
  'page-container relative mx-auto w-full max-w-7xl space-y-4 pb-[max(7rem,env(safe-area-inset-bottom))] sm:space-y-5 2xl:max-w-[1600px]';

export function AttendancePage() {
  const { t, locale } = useSafeI18n();
  usePageTitle(t('attendance.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const authState = useOptionalAuthState();
  const reduced = usePrefersReducedMotion();
  const canVoid = authState?.user ? VOID_ROLES.has(authState.user.role) : true;

  const sound = usePremiumSound();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  const pop = useCallback(() => soundRef.current?.playPop?.(), []);

  useAttendanceSocket();

  /* ── UI state ─────────────────────────────────────────────────────── */
  const [tab, setTab] = useState<TabId>('ledger');
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<AttendanceStatus | ''>('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [optimistic, setOptimistic] = useState<Record<string, AttendanceStatus>>({});
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const selectedCache = useRef<Map<string, Attendance>>(new Map());

  const [modalOpen, setModalOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => createForm());
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [editTarget, setEditTarget] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');
  const [voidTarget, setVoidTarget] = useState<Attendance | null>(null);

  const openRecordModal = useCallback(() => {
    pop();
    setForm(createForm(groupId, date));
    setFormErrors({});
    setModalOpen(true);
  }, [groupId, date, pop]);

  /* ── Queries ──────────────────────────────────────────────────────── */
  const params = useMemo<AttendanceFilters>(
    () => ({
      page,
      limit: 20,
      groupId: groupId || undefined,
      date: date || undefined,
      status: status || undefined,
      search: debouncedSearch.trim() || undefined,
      source: sourceFilter || undefined,
      sort: sortBy === 'status-asc' ? 'status' : sortBy,
    }),
    [page, groupId, date, status, debouncedSearch, sourceFilter, sortBy],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sourceFilter, sortBy]);

  const attendance = useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.list(params),
    placeholderData: (prev) => prev,
  });

  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics', groupId, date],
    queryFn: () =>
      attendanceApi.analytics({
        groupId: groupId || undefined,
        date: date || undefined,
      }) as Promise<AttendanceAnalytics>,
    placeholderData: (prev) => prev,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 500 }),
    staleTime: 5 * 60 * 1000,
  });

  const data = attendance.data as Paginated<Attendance> | undefined;

  const groupList = useMemo(() => {
    if (Array.isArray(groups.data)) return groups.data as Group[];
    return (groups.data as Paginated<Group> | undefined)?.items || [];
  }, [groups.data]);

  const studentList = useMemo(() => {
    if (Array.isArray(students.data)) return students.data as Student[];
    return (students.data as Paginated<Student> | undefined)?.items || [];
  }, [students.data]);

  const groupDetails = useQuery({
    queryKey: ['attendance-form-group', form.groupId],
    queryFn: () => groupsApi.get(form.groupId),
    enabled: modalOpen && Boolean(form.groupId),
    staleTime: 30000,
  });

  const modalStudents = useMemo(() => {
    if (!form.groupId) return studentList;
    const enrollments =
      (groupDetails.data as { enrollments?: Array<{ student?: Student }> } | undefined)
        ?.enrollments || [];
    if (enrollments.length === 0) return studentList;
    return enrollments.map((e) => e.student).filter((s): s is Student => Boolean(s?.id));
  }, [form.groupId, groupDetails.data, studentList]);

  // Drop a chosen student that doesn't belong to the newly chosen group.
  useEffect(() => {
    if (!modalOpen || !form.groupId || !form.studentId || groupDetails.isLoading) return;
    if (modalStudents.length > 0 && !modalStudents.some((s) => s.id === form.studentId)) {
      setForm((p) => ({ ...p, studentId: '' }));
    }
  }, [modalOpen, form.groupId, form.studentId, modalStudents, groupDetails.isLoading]);

  /* ── Derived data ─────────────────────────────────────────────────── */
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    (analyticsQuery.data?.byStatus ?? []).forEach((row) => {
      const r = row as { status: string; count?: number; _count?: { status?: number } };
      map[r.status] = r.count ?? r._count?.status ?? 0;
    });
    return {
      PRESENT: map.PRESENT ?? 0,
      LATE: map.LATE ?? 0,
      ABSENT: map.ABSENT ?? 0,
      EXCUSED: map.EXCUSED ?? 0,
    } as Record<AttendanceStatus, number>;
  }, [analyticsQuery.data]);

  const percents = useMemo(() => {
    const list = apportion(STATUSES.map((s) => counts[s]));
    return Object.fromEntries(STATUSES.map((s, i) => [s, list[i]])) as Record<
      AttendanceStatus,
      number
    >;
  }, [counts]);

  const countsTotal = STATUSES.reduce((a, s) => a + counts[s], 0);

  const items = useMemo(
    () =>
      (data?.items || []).map((item) => {
        const opt = optimistic[item.id];
        return opt && opt !== item.status ? { ...item, status: opt } : item;
      }),
    [data?.items, optimistic],
  );

  useEffect(() => {
    items.forEach((item) => {
      if (selectedCache.current.has(item.id)) selectedCache.current.set(item.id, item);
    });
  }, [items]);

  const overallRate = analyticsQuery.data?.overall.rate ?? 0;
  const overallPresent = analyticsQuery.data?.overall.present ?? 0;
  const overallTotal = analyticsQuery.data?.overall.total ?? 0;
  const totalRecords = data?.total || 0;

  const todayISO = toLocalISOString();
  const yesterdayISO = shiftLocalISO(todayISO, -1);
  const hasFilters = Boolean(
    groupId || date || status || sourceFilter || searchQuery.trim() || sortBy !== 'date-desc',
  );

  /* ── Mutations ────────────────────────────────────────────────────── */
  const pushError = useCallback(
    (e: Error) => {
      const msg = getErrorMessage(e, locale);
      push('error', isScheduleError(msg) ? t('attendance.noSchedule') : msg);
    },
    [push, t, locale],
  );

  const invalidate = useCallback(
    (studentId?: string) => {
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      void qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      if (studentId) void qc.invalidateQueries({ queryKey: queryKeys.students.detail(studentId) });
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    [qc],
  );

  const create = useMutation({
    mutationFn: () =>
      attendanceApi.create({
        groupId: form.groupId,
        date: `${form.date || toLocalISOString()}T12:00:00.000Z`,
        records: [
          { studentId: form.studentId, status: form.status, note: form.note.trim() || undefined },
        ],
      }),
    onSuccess: () => {
      pop();
      push('success', t('attendance.recordedSuccess'));
      const sid = form.studentId;
      setModalOpen(false);
      setForm(createForm(groupId, date));
      setFormErrors({});
      invalidate(sid);
    },
    onError: pushError,
  });

  const updateRecord = useMutation({
    mutationFn: (v: { id: string; status: AttendanceStatus; note: string }) =>
      attendanceApi.update(v.id, { status: v.status, note: v.note }),
    onMutate: (v) => {
      setPendingIds((p) => ({ ...p, [v.id]: true }));
      setOptimistic((p) => ({ ...p, [v.id]: v.status }));
    },
    onSuccess: (_d, v) => {
      push('success', t('attendance.recordUpdated'));
      setEditTarget((cur) => (cur?.id === v.id ? null : cur));
      invalidate();
    },
    onError: (err: Error, v) => {
      setOptimistic((p) => {
        const n = { ...p };
        delete n[v.id];
        return n;
      });
      pushError(err);
    },
    onSettled: (_d, _e, v) => {
      setPendingIds((p) => {
        const n = { ...p };
        delete n[v.id];
        return n;
      });
    },
  });

  // Drop optimistic overrides once the server snapshot has caught up.
  useEffect(() => {
    const server = data?.items;
    if (!server) return;
    setOptimistic((prev) => {
      if (!Object.keys(prev).length) return prev;
      let changed = false;
      const next = { ...prev };
      server.forEach((it) => {
        if (next[it.id] === it.status && !pendingIds[it.id]) {
          delete next[it.id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [data?.items, pendingIds]);

  const voidRecord = useMutation({
    mutationFn: (id: string) => attendanceApi.remove(id),
    onSuccess: (_r, id) => {
      selectedCache.current.delete(id);
      push('success', t('attendance.recordVoided'));
      setVoidTarget(null);
      invalidate();
    },
    onError: pushError,
  });

  const mutateUpdate = updateRecord.mutate;
  const setRowStatus = useCallback(
    (record: Attendance, next: AttendanceStatus) => {
      if (pendingIds[record.id] || record.status === next) return;
      pop();
      mutateUpdate({ id: record.id, status: next, note: record.note || '' });
    },
    [mutateUpdate, pendingIds, pop],
  );

  /* ── Form handlers ────────────────────────────────────────────────── */
  const handleFormChange = useCallback(
    (field: 'studentId' | 'groupId' | 'date') =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const v = e.target.value;
        setForm((p) => ({
          ...p,
          [field]: v,
          ...(field === 'groupId' && p.groupId !== v ? { studentId: '' } : {}),
        }));
        setFormErrors((p) => ({
          ...p,
          [field]: undefined,
          ...(field === 'groupId' ? { studentId: undefined } : {}),
        }));
      },
    [],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (create.isPending) return;
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.groupId) errors.groupId = t('common.validation.selectGroup');
    if (!form.studentId) errors.studentId = t('common.validation.selectStudent');
    if (!form.date) errors.date = t('common.validation.selectDate');
    setFormErrors(errors);
    if (Object.keys(errors).length === 0) create.mutate();
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setForm(createForm(groupId, date));
    setFormErrors({});
  }, [groupId, date]);

  const openEdit = useCallback((record: Attendance) => {
    setEditTarget(record);
    setEditStatus(record.status);
    setEditNote(record.note || '');
  }, []);

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editTarget || updateRecord.isPending) return;
    updateRecord.mutate({ id: editTarget.id, status: editStatus, note: editNote.trim() });
  };

  /* ── Filter handlers ──────────────────────────────────────────────── */
  const toggleStatusFilter = useCallback((s: AttendanceStatus) => {
    setStatus((prev) => (prev === s ? '' : s));
    setPage(1);
  }, []);

  const stepDate = useCallback(
    (delta: number) => {
      pop();
      setDate((prev) => shiftLocalISO(prev || toLocalISOString(), delta));
      setPage(1);
    },
    [pop],
  );

  const resetFilters = useCallback(() => {
    pop();
    setGroupId('');
    setDate('');
    setStatus('');
    setSourceFilter('');
    setSortBy('date-desc');
    setSearchQuery('');
    setPage(1);
  }, [pop]);

  const { refetch: refetchAttendance } = attendance;
  const { refetch: refetchAnalytics } = analyticsQuery;
  const handleRetry = useCallback(() => {
    pop();
    void refetchAttendance();
    void refetchAnalytics();
  }, [refetchAttendance, refetchAnalytics, pop]);

  /* ── Sidecar ──────────────────────────────────────────────────────── */
  const openRecordSidecar = useCallback(
    (record: Attendance) => {
      pop();
      const name = fullStudentName(record);
      const group =
        record.group?.name ||
        groupList.find((g) => g.id === record.groupId)?.name ||
        t('attendance.defaultGroup');
      const statusText = t(`attendance.${record.status.toLowerCase()}`);
      const quickLook: QuickLookData = {
        id: record.id,
        type: 'student',
        title: name,
        subtitle: `${group} · ${formatDate(record.date)}`,
        badge: {
          text: record.status,
          tone:
            record.status === 'PRESENT' ? 'emerald' : record.status === 'ABSENT' ? 'rose' : 'amber',
        },
        avatar: {
          text: getInitials(name),
          color: STATUS_STYLE[record.status].hex,
        },
        metrics: [
          { label: t('attendance.statusLabel'), value: statusText },
          { label: t('attendance.dateLabel'), value: formatDate(record.date) },
          { label: t('attendance.sourceLabel'), value: record.source || 'Manual' },
        ],
        details: [
          { label: t('attendance.studentLabel'), value: name, copyable: true },
          { label: t('attendance.defaultGroup'), value: group },
          { label: t('attendance.dateLabel'), value: formatDate(record.date) },
          { label: t('attendance.statusLabel'), value: statusText },
          { label: t('attendance.note'), value: record.note || t('attendance.noNote') },
        ],
        primaryAction: { label: t('common.edit'), onExecute: () => openEdit(record) },
      };
      openSidecar(quickLook);
    },
    [openEdit, groupList, t, pop],
  );

  /* ── Selection ────────────────────────────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection: rawToggle,
    clearSelection: rawClear,
  } = useListKeyboardNavigation<Attendance>({
    items,
    getItemId: (a) => a.id,
    rowIdPrefix: 'attendance-row-',
    onSelect: (a) => openRecordSidecar(a),
    onQuickLook: (a) => openRecordSidecar(a),
    onEdit: (a) => openEdit(a),
  });

  const toggleSelection = useCallback(
    (record: Attendance) => {
      if (selectedCache.current.has(record.id)) selectedCache.current.delete(record.id);
      else selectedCache.current.set(record.id, record);
      rawToggle(record.id);
    },
    [rawToggle],
  );

  const clearSelection = useCallback(() => {
    selectedCache.current.clear();
    rawClear();
  }, [rawClear]);

  const allSelected = items.length > 0 && items.every((i) => isSelected(i.id));

  const toggleSelectAll = useCallback(() => {
    pop();
    if (allSelected) {
      clearSelection();
      return;
    }
    items.forEach((item) => {
      if (!isSelected(item.id)) {
        selectedCache.current.set(item.id, item);
        rawToggle(item.id);
      }
    });
  }, [allSelected, clearSelection, items, isSelected, rawToggle, pop]);

  /* ── Bulk update ──────────────────────────────────────────────────── */
  const batchMark = useCallback(
    async (target: AttendanceStatus) => {
      if (isBatchUpdating) return;
      const ids = Array.from(selectedIds);
      if (!ids.length) return;

      setIsBatchUpdating(true);
      pop();
      try {
        const byId = new Map<string, Attendance>(selectedCache.current);
        items.forEach((r) => byId.set(r.id, r));
        const actionable = ids.filter((id) => byId.get(id)?.status !== target);

        setOptimistic((p) => {
          const n = { ...p };
          actionable.forEach((id) => (n[id] = target));
          return n;
        });

        const results = await Promise.allSettled(
          actionable.map((id) =>
            attendanceApi.update(id, { status: target, note: byId.get(id)?.note ?? '' }),
          ),
        );

        const ok = results.filter((r) => r.status === 'fulfilled').length;
        const failedIds = results.flatMap((r, i) =>
          r.status === 'rejected' && actionable[i] ? [actionable[i]] : [],
        );
        if (failedIds.length) {
          setOptimistic((p) => {
            const n = { ...p };
            failedIds.forEach((id) => delete n[id]);
            return n;
          });
        }
        clearSelection();
        invalidate();

        if (ok > 0 || actionable.length === 0) {
          push('success', t('attendance.batchMarkSuccess', { count: ok || ids.length }));
        }
        if (failedIds.length) {
          push('error', `${failedIds.length} ta davomat yozuvini yangilashda xatolik yuz berdi`);
        }
      } finally {
        setIsBatchUpdating(false);
      }
    },
    [isBatchUpdating, selectedIds, items, clearSelection, invalidate, push, t, pop],
  );

  /* ── CSV export ───────────────────────────────────────────────────── */
  const exportCSV = useCallback(
    (rows: Attendance[]) => {
      if (!rows.length) return;
      const cell = (v: unknown) => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formulas
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = ['ID', 'Student', 'Group', 'Date', 'Status', 'Source', 'Note'].join(',');
      const body = rows.map((a) =>
        [a.id, fullStudentName(a), a.group?.name, a.date, a.status, a.source, a.note]
          .map(cell)
          .join(','),
      );
      const blob = new Blob(['\uFEFF' + [header, ...body].join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_export_${toLocalISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      push('success', t('attendance.exportSuccess', { count: rows.length }));
    },
    [push, t],
  );

  const exportSelected = useCallback(() => {
    const byId = new Map<string, Attendance>(selectedCache.current);
    items.forEach((r) => {
      if (isSelected(r.id)) byId.set(r.id, r);
    });
    exportCSV(
      Array.from(selectedIds)
        .map((id) => byId.get(id))
        .filter((r): r is Attendance => Boolean(r)),
    );
    clearSelection();
  }, [items, isSelected, selectedIds, exportCSV, clearSelection]);

  const openExpress = useCallback(() => {
    pop();
    window.dispatchEvent(new CustomEvent('medu:open-quick-attendance'));
  }, [pop]);

  const openCopilot = useCallback(() => {
    pop();
    window.dispatchEvent(
      new CustomEvent('open-ai-copilot', { detail: { prompt: t('attendance.aiPrompt') } }),
    );
  }, [t, pop]);

  /* ── Keyboard shortcuts: / N P C 1-4 ──────────────────────────────── */
  const anyDialogOpen = Boolean(modalOpen || registerOpen || editTarget || voidTarget);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (anyDialogOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.tagName === 'SELECT' ||
        el?.isContentEditable
      )
        return;

      if (focusedIndex !== null && focusedIndex >= 0 && focusedIndex < items.length) {
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx >= 0) {
          e.preventDefault();
          setRowStatus(items[focusedIndex], STATUSES[idx]);
          return;
        }
      }

      const k = e.key.toLowerCase();
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (k === 'n') {
        e.preventDefault();
        openRecordModal();
      } else if (k === 'p' && selectedCount > 0) {
        e.preventDefault();
        void batchMark('PRESENT');
      } else if (k === 'c' && selectedCount > 0) {
        e.preventDefault();
        exportSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    anyDialogOpen,
    focusedIndex,
    items,
    selectedCount,
    setRowStatus,
    openRecordModal,
    batchMark,
    exportSelected,
  ]);

  /* ── Loading / error ──────────────────────────────────────────────── */
  if (attendance.isLoading && !data) {
    return (
      <div className={PAGE_CLASS}>
        <PageSkeleton />
      </div>
    );
  }

  if (attendance.isError) {
    return (
      <div className={PAGE_CLASS}>
        <div className={cn(SURFACE, 'p-8')}>
          <GlassErrorState
            title={t('attendance.loadFailed')}
            message={getErrorMessage(attendance.error as Error, locale)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'ledger', label: t('attendance.tabs.ledger') },
    { id: 'analytics', label: t('attendance.tabs.analytics') },
    { id: 'radar', label: t('attendance.tabs.radar') },
    { id: 'flow', label: t('attendance.tabs.flow') },
  ];

  const rateColor =
    overallRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : overallRate >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className={PAGE_CLASS}>
      {toastNode}

      {/* ── Header: large title + actions ─────────────────────────── */}
      <header className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={cn('text-[32px] font-bold leading-tight tracking-tight sm:text-4xl', STRONG)}>
            {t('attendance.title')}
          </h1>
          <p className={cn('mt-1 text-sm sm:text-[15px]', MUTED)}>
            {t('attendance.pageSubtitle')}
            {totalRecords > 0 && (
              <span className="tabular-nums"> · {totalRecords.toLocaleString('uz-UZ')}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className={cn(SURFACE, 'flex items-center rounded-full p-0.5')}>
            <IconButton
              icon={I.refresh}
              label={t('attendance.refresh')}
              onClick={handleRetry}
              spinning={attendance.isFetching}
            />
            {items.length > 0 && (
              <IconButton icon={I.download} label="CSV" onClick={() => exportCSV(items)} />
            )}
            <IconButton
              icon={I.sheet}
              label={t('attendance.registerSheetTitle')}
              onClick={() => {
                pop();
                setRegisterOpen(true);
              }}
              tone="violet"
            />
            <IconButton
              icon={I.sparkles}
              label={t('attendance.aiAnalysis')}
              onClick={openCopilot}
              tone="violet"
            />
            <IconButton icon={I.bolt} label={t('attendance.express')} onClick={openExpress} tone="blue" />
          </div>

          <GlassButton
            type="button"
            variant="primary"
            onClick={openRecordModal}
            aria-label={t('attendance.record')}
            data-action="primary"
            className="h-11 min-h-[44px] flex-1 rounded-full px-5 text-sm font-semibold sm:flex-none"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <Icon paths={I.plus} size={17} strokeWidth={2.5} />
              <span>{t('attendance.record')}</span>
            </span>
          </GlassButton>
        </div>
      </header>

      {/* ── Tabs: iOS segmented control ───────────────────────────── */}
      <LayoutGroup id="attendance-tabs">
        <div
          role="tablist"
          aria-label={t('attendance.title')}
          className="grid grid-cols-4 gap-1 rounded-2xl bg-black/[0.05] p-1 dark:bg-white/[0.07]"
        >
          {tabs.map((tb) => {
            const selected = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  pop();
                  setTab(tb.id);
                }}
                className={cn(
                  'relative flex h-11 min-w-0 items-center justify-center rounded-xl px-2 text-[13px] font-semibold transition-colors sm:text-sm',
                  selected ? STRONG : cn(MUTED, 'hover:text-slate-900 dark:hover:text-white'),
                  FOCUS,
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="attendance-tab-pill"
                    transition={reduced ? { duration: 0 } : SPRING}
                    aria-hidden="true"
                    className="absolute inset-0 rounded-xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.12)] dark:bg-white/15"
                  />
                )}
                <span className="relative truncate">{tb.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {tab === 'analytics' && (
        <div className="space-y-5">
          <AttendanceWaveChart overallRate={overallRate} />
          <AttendanceHeatmap overallRate={overallRate} />
        </div>
      )}

      {tab === 'radar' && <AttendanceRiskSection />}

      {tab === 'flow' && (
        <div className="space-y-5">
          <AttendanceTrafficFlowHeatmap />
          <RushHourBatchAttendanceProcessor />
        </div>
      )}

      {tab === 'ledger' && (
        <>
          {/* ── Overview: rate + distribution + status tiles ─────── */}
          {analyticsQuery.data && (
            <section className="space-y-3" aria-label={t('executive.attendanceRate')}>
              <div className={cn(SURFACE, 'p-5 sm:p-6')}>
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                  <div>
                    <div className={cn('text-[13px] font-medium', MUTED)}>
                      {t('executive.attendanceRate')}
                    </div>
                    <div className={cn('mt-1 text-5xl font-bold leading-none tracking-tight tabular-nums', rateColor)}>
                      {overallRate}%
                    </div>
                  </div>
                  <div className={cn('pb-1 text-sm tabular-nums', MUTED)}>
                    {t('attendance.trendPresent', { present: overallPresent, total: overallTotal })}
                  </div>
                </div>

                {countsTotal > 0 && (
                  <div
                    className="mt-5 flex h-3 w-full gap-[3px] overflow-hidden rounded-full"
                    role="img"
                    aria-label={STATUSES.map(
                      (s) => `${t(`attendance.${s.toLowerCase()}`)}: ${percents[s]}%`,
                    ).join(', ')}
                  >
                    {STATUSES.filter((s) => counts[s] > 0).map((s) => (
                      <span
                        key={s}
                        className={cn(
                          'h-full rounded-full transition-[width,opacity] duration-500 first:rounded-l-full',
                          status && status !== s ? 'opacity-30' : 'opacity-100',
                        )}
                        style={{ width: `${(counts[s] / countsTotal) * 100}%`, background: STATUS_STYLE[s].hex }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {STATUSES.map((s) => (
                  <KpiTile
                    key={s}
                    status={s}
                    label={t(`attendance.${s.toLowerCase()}`)}
                    value={counts[s]}
                    pct={percents[s]}
                    active={status === s}
                    onClick={() => {
                      pop();
                      toggleStatusFilter(s);
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Filters ──────────────────────────────────────────── */}
          <section className={cn(SURFACE, 'space-y-3 p-4 sm:p-5')}>
            <div className="relative">
              <Icon
                paths={I.search}
                size={17}
                className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)}
              />
              <GlassInput
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`${t('attendance.selectStudent')}…`}
                aria-label={t('attendance.selectStudent')}
                className="pl-10 pr-11"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Qidiruvni tozalash"
                  className={cn(
                    'absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
                    FOCUS,
                  )}
                >
                  <Icon paths={I.x} size={15} strokeWidth={2.5} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="relative">
                <Icon paths={I.users} size={16} className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)} />
                <GlassSelect
                  value={groupId}
                  onChange={(e) => {
                    setGroupId(e.target.value);
                    setPage(1);
                  }}
                  aria-label={t('students.filterGroupLabel')}
                  className="pl-10"
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
                <Icon paths={I.calendar} size={16} className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)} />
                <GlassInput
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(1);
                  }}
                  aria-label={t('attendance.filterByDate')}
                  className="pl-10"
                />
              </div>

              <GlassSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Saralash"
              >
                <option value="date-desc">Sana: yangilari birinchi</option>
                <option value="name-asc">Talaba: A–Z</option>
                <option value="status-asc">Holat bo‘yicha</option>
              </GlassSelect>
            </div>

            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 no-scrollbar">
              <div className="flex shrink-0 items-center rounded-full bg-black/[0.05] p-0.5 dark:bg-white/[0.07]">
                <button
                  type="button"
                  onClick={() => stepDate(-1)}
                  aria-label="Oldingi kun"
                  className={cn('flex h-9 w-9 items-center justify-center rounded-full', MUTED, 'hover:bg-white/70 dark:hover:bg-white/10', FOCUS)}
                >
                  <Icon paths={I.chevronLeft} size={16} strokeWidth={2.4} />
                </button>
                {[
                  { label: 'Kecha', value: yesterdayISO },
                  { label: 'Bugun', value: todayISO },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setDate(date === p.value ? '' : p.value);
                      setPage(1);
                    }}
                    className={cn(
                      'h-9 rounded-full px-3.5 text-[13px] font-semibold transition',
                      date === p.value ? 'bg-blue-600 text-white shadow-sm' : MUTED,
                      FOCUS,
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => stepDate(1)}
                  aria-label="Keyingi kun"
                  className={cn('flex h-9 w-9 items-center justify-center rounded-full', MUTED, 'hover:bg-white/70 dark:hover:bg-white/10', FOCUS)}
                >
                  <Icon paths={I.chevronRight} size={16} strokeWidth={2.4} />
                </button>
              </div>

              {SOURCE_FILTERS.map((src) => {
                const on = sourceFilter === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSourceFilter((cur) => (cur === src.id ? '' : src.id))}
                    aria-pressed={on}
                    className={cn(
                      'h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold transition active:scale-95',
                      on
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : cn('bg-black/[0.05] hover:bg-black/[0.08] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]', MUTED),
                      FOCUS,
                    )}
                  >
                    {src.label}
                  </button>
                );
              })}

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className={cn(
                    'ml-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-red-500/10 px-4 text-[13px] font-semibold text-red-600 transition hover:bg-red-500/20 active:scale-95 dark:text-red-400',
                    FOCUS,
                  )}
                >
                  <Icon paths={I.x} size={13} strokeWidth={2.6} />
                  Tozalash
                </button>
              )}
            </div>
          </section>

          {/* ── Records ──────────────────────────────────────────── */}
          <section className={cn(SURFACE, 'overflow-hidden')}>
            {items.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-2.5 dark:border-white/[0.08] sm:px-5">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className={cn(
                    'inline-flex min-h-[44px] items-center gap-2.5 rounded-xl pr-3 text-[13px] font-semibold',
                    allSelected ? 'text-blue-600 dark:text-blue-400' : MUTED,
                    FOCUS,
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border transition',
                      allSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-white/25',
                    )}
                  >
                    {allSelected && <Icon paths={I.check} size={12} strokeWidth={3.5} />}
                  </span>
                  {selectedCount > 0 ? `${selectedCount} ta tanlandi` : 'Barchasini tanlash'}
                </button>
                <span className={cn('text-[13px] tabular-nums', MUTED)}>
                  {items.length} / {totalRecords.toLocaleString('uz-UZ')}
                </span>
              </div>
            )}

            {items.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Icon paths={I.empty} size={28} strokeWidth={1.8} />
                </div>
                <p className={cn('mt-5 text-lg font-semibold tracking-tight', STRONG)}>
                  {hasFilters ? t('attendance.emptyFilteredTitle') : t('attendance.emptyTitle')}
                </p>
                <p className={cn('mt-1.5 max-w-sm text-sm', MUTED)}>
                  {hasFilters ? t('attendance.emptyFilteredHint') : t('attendance.emptyMessage')}
                </p>
                <div className="mt-6">
                  {hasFilters ? (
                    <GlassButton type="button" variant="secondary" onClick={resetFilters}>
                      Filtrlarni tiklash
                    </GlassButton>
                  ) : (
                    <GlassButton type="button" variant="primary" onClick={openRecordModal}>
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                        {t('attendance.record')}
                      </span>
                    </GlassButton>
                  )}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.06] dark:divide-white/[0.07]">
                {items.map((a, idx) => {
                  const name = fullStudentName(a);
                  const selected = isSelected(a.id);
                  const focused = focusedIndex === idx;
                  const pending = Boolean(pendingIds[a.id]);
                  const sourceKey = (a.source || 'SYSTEM').toUpperCase();

                  return (
                    <li
                      key={a.id}
                      id={`attendance-row-${a.id}`}
                      onClick={() => openRecordSidecar(a)}
                      className={cn(
                        'grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4 transition-colors sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-x-6',
                        selected
                          ? 'bg-blue-500/[0.08] dark:bg-blue-500/[0.14]'
                          : focused
                            ? 'bg-slate-500/[0.06] dark:bg-white/[0.06]'
                            : 'hover:bg-slate-500/[0.04] dark:hover:bg-white/[0.04]',
                      )}
                    >
                      {/* Identity */}
                      <div className="flex min-w-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(a);
                          }}
                          aria-label={t('attendance.selectRowAria', { name })}
                          aria-pressed={selected}
                          className={cn('-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full', FOCUS)}
                        >
                          <span
                            className={cn(
                              'flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] transition',
                              selected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-white/25',
                            )}
                          >
                            {selected && <Icon paths={I.check} size={12} strokeWidth={3.5} />}
                          </span>
                        </button>

                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
                          style={{ background: avatarGradient(name) }}
                          aria-hidden="true"
                        >
                          {getInitials(name)}
                        </div>

                        <div className="min-w-0">
                          <p className={cn('truncate text-[15px] font-semibold tracking-tight', STRONG)}>
                            {name}
                          </p>
                          <p className={cn('mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px]', MUTED)}>
                            <span className="tabular-nums">{formatDate(a.date)}</span>
                            {a.group?.name && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="max-w-[10rem] truncate">{a.group.name}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{SOURCE_LABEL[sourceKey] ?? a.source}</span>
                          </p>
                          {a.note && (
                            <p className={cn('mt-0.5 truncate text-[13px] italic', MUTED)} title={a.note}>
                              {a.note}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center lg:order-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconButton
                          size="sm"
                          icon={I.edit}
                          label={t('attendance.editAria', {
                            name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
                          })}
                          onClick={() => openEdit(a)}
                          tone="blue"
                        />
                        {canVoid && (
                          <IconButton
                            size="sm"
                            icon={I.trash}
                            label={t('attendance.voidAria', {
                              name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
                            })}
                            onClick={() => setVoidTarget(a)}
                            tone="red"
                          />
                        )}
                      </div>

                      {/* Status */}
                      <div className="col-span-2 lg:order-2 lg:col-span-1">
                        <StatusSwitch
                          value={a.status}
                          onChange={(s) => setRowStatus(a, s)}
                          disabled={pending}
                          t={t}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {data && data.totalPages > 1 && (
              <div className="border-t border-black/[0.06] px-4 py-3 dark:border-white/[0.08]">
                <GlassPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
              </div>
            )}
          </section>
        </>
      )}

      <OfficialAttendanceRegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        groupId={groupId || undefined}
      />

      {/* ── Create ───────────────────────────────────────────────── */}
      <GlassModal open={modalOpen} onClose={closeModal} title={t('attendance.record')} wide>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField
              label={t('attendance.selectGroup')}
              required
              error={formErrors.groupId}
              htmlFor="attendance-group-select"
            >
              <div className="relative">
                <Icon paths={I.users} size={16} className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)} />
                <GlassSelect
                  id="attendance-group-select"
                  value={form.groupId}
                  onChange={handleFormChange('groupId')}
                  required
                  aria-invalid={Boolean(formErrors.groupId)}
                  className="pl-10"
                >
                  <option value="">{t('attendance.groupPlaceholder')}</option>
                  {groupList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <GlassField label={t('attendance.selectStudent')} required error={formErrors.studentId}>
              <div className="relative">
                <Icon paths={I.user} size={16} className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)} />
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  className="pl-10"
                >
                  <option value="">{t('attendance.studentPlaceholder')}</option>
                  {modalStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.user?.firstName || (s as { name?: string }).name || 'O‘quvchi'} ${s.user?.lastName || ''}`.trim()}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <div className="sm:col-span-2">
              <GlassField label={t('attendance.selectDate')} required error={formErrors.date}>
                <div className="relative">
                  <Icon paths={I.calendar} size={16} className={cn('pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2', MUTED)} />
                  <GlassInput
                    type="date"
                    value={form.date}
                    onChange={handleFormChange('date')}
                    required
                    aria-invalid={Boolean(formErrors.date)}
                    className="pl-10"
                  />
                </div>
              </GlassField>
            </div>
          </div>

          <div>
            <p className={cn('mb-2 text-[13px] font-semibold', MUTED)}>{t('common.status')}</p>
            <StatusPicker value={form.status} onChange={(s) => setForm((p) => ({ ...p, status: s }))} t={t} />
          </div>

          <NoteField value={form.note} onChange={(v) => setForm((p) => ({ ...p, note: v }))} t={t} />

          <div className="flex flex-col-reverse gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08] sm:flex-row sm:justify-end">
            <GlassButton type="button" variant="secondary" onClick={closeModal} disabled={create.isPending}>
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={create.isPending}>
              <span className="inline-flex items-center justify-center gap-2">
                {create.isPending ? <Spinner /> : <Icon paths={I.check} size={15} strokeWidth={2.5} />}
                {create.isPending ? t('common.saving') : t('attendance.recordSubmit')}
              </span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ── Edit ─────────────────────────────────────────────────── */}
      <GlassModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={t('attendance.editTitle')}
        wide
      >
        <form className="space-y-5" onSubmit={handleEditSubmit} noValidate>
          {editTarget && (
            <div className="flex items-center gap-3.5 rounded-2xl bg-black/[0.04] p-3.5 dark:bg-white/[0.06]">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ background: avatarGradient(fullStudentName(editTarget)) }}
                aria-hidden="true"
              >
                {getInitials(fullStudentName(editTarget))}
              </div>
              <div className="min-w-0">
                <p className={cn('truncate text-[15px] font-semibold', STRONG)}>
                  {fullStudentName(editTarget)}
                </p>
                <p className={cn('truncate text-[13px]', MUTED)}>
                  {formatDate(editTarget.date)}
                  {editTarget.group?.name ? ` · ${editTarget.group.name}` : ''}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className={cn('mb-2 text-[13px] font-semibold', MUTED)}>{t('common.status')}</p>
            <StatusPicker value={editStatus} onChange={setEditStatus} t={t} />
          </div>

          <NoteField value={editNote} onChange={setEditNote} t={t} />

          <div className="flex flex-col-reverse gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08] sm:flex-row sm:justify-end">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setEditTarget(null)}
              disabled={updateRecord.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={updateRecord.isPending}>
              <span className="inline-flex items-center justify-center gap-2">
                {updateRecord.isPending ? <Spinner /> : <Icon paths={I.check} size={15} strokeWidth={2.5} />}
                {updateRecord.isPending ? t('common.saving') : t('common.save')}
              </span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ── Void ─────────────────────────────────────────────────── */}
      <GlassModal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title={t('attendance.voidTitle')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3.5 rounded-2xl bg-red-500/[0.08] p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-500">
              <Icon paths={I.warning} size={20} />
            </span>
            <p className={cn('text-sm leading-relaxed', STRONG)}>
              {t('attendance.voidConfirmBefore')}{' '}
              <strong>
                {voidTarget && fullStudentName(voidTarget) !== '—'
                  ? fullStudentName(voidTarget)
                  : t('attendance.thisStudent')}
              </strong>{' '}
              {t('attendance.voidConfirmAfter', {
                date: voidTarget ? formatDate(voidTarget.date) : '',
              })}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.08] sm:flex-row sm:justify-end">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setVoidTarget(null)}
              disabled={voidRecord.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="danger"
              onClick={() => voidTarget && voidRecord.mutate(voidTarget.id)}
              disabled={voidRecord.isPending}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {voidRecord.isPending ? <Spinner /> : <Icon paths={I.trash} size={15} strokeWidth={2.5} />}
                {voidRecord.isPending ? t('attendance.voiding') : t('attendance.voidRecord')}
              </span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ── Bulk actions ─────────────────────────────────────────── */}
      {tab === 'ledger' && (
        <FloatingActionIsland
          selectedCount={selectedCount}
          onClear={clearSelection}
          onClearSelection={clearSelection}
          entityName={t('attendance.title')}
          actions={[
            {
              label: isBatchUpdating ? t('common.saving') : t('attendance.bulkMarkPresent'),
              icon: <Icon paths={I.check} size={14} strokeWidth={2.5} />,
              onClick: () => void batchMark('PRESENT'),
              variant: 'primary',
              shortcut: 'P',
              shortcutBadge: 'p',
            },
            {
              label: t('attendance.late'),
              icon: <Icon paths={I.clock} size={14} />,
              onClick: () => void batchMark('LATE'),
              variant: 'default',
            },
            {
              label: t('attendance.excused'),
              icon: <Icon paths={I.shield} size={14} />,
              onClick: () => void batchMark('EXCUSED'),
              variant: 'default',
            },
            {
              label: t('attendance.bulkExportCsv'),
              icon: <Icon paths={I.download} size={14} />,
              onClick: exportSelected,
              shortcut: 'C',
              shortcutBadge: 'c',
            },
          ]}
        />
      )}
    </div>
  );
}

export default AttendancePage;