/**
 * M-EDU SchedulePage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient calendar icon + entry count chip + primary CTA
 *  - Animated stat bar (Total entries, Active days, Groups covered, Rooms)
 *  - Day selector as premium segmented control with layoutId indicator
 *  - Group filter as squircle leading-icon select
 *  - Premium schedule rows with gradient day-tile + time chip + room chip
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Premium modal with icon-leading fields + validation
 *  - Full i18n preserved
 */

import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { scheduleApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassPageHeader,
  GlassCard,
  GlassPageLoader,
  GlassErrorState,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassButton,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Schedule, Group, DayOfWeek } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  calendarCheck: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  door: [
    'M3 21h18',
    'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16',
    'M14 12h.01',
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
  filter: [
    'M22 3H2l8 9.46V19l4 2v-8.54z',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  check: ['M20 6 9 17l-5-5'],
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
};

const DAY_TONES: Record<DayOfWeek, Tone> = {
  MONDAY: 'blue',
  TUESDAY: 'purple',
  WEDNESDAY: 'green',
  THURSDAY: 'orange',
  FRIDAY: 'red',
  SATURDAY: 'blue',
  SUNDAY: 'purple',
};

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

const DAYS: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function formatDay(d: DayOfWeek): string {
  return `schedule.day.${d}`;
}

interface ScheduleFilters {
  page: number;
  limit: number;
  groupId?: string;
  dayOfWeek?: string;
}

interface ScheduleFormState {
  groupId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string;
}

const INITIAL_FORM: ScheduleFormState = {
  groupId: '',
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00',
  room: '',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

/** Duration in minutes from "HH:MM" strings */
function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
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

function ScheduleSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[68px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-12 w-full" radius="1rem" />
      <Shimmer className="h-96 w-full" radius="1.5rem" />
    </div>
  );
}

/** Stat tile */
function StatTile({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
          {value}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Premium day tile — big day index with tone gradient */
function DayTile({ day, tone }: { day: DayOfWeek; tone: Tone }) {
  const c = TONES[tone];
  const idx = DAYS.indexOf(day) + 1;
  return (
    <div
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
      style={{
        background: `linear-gradient(135deg, ${c.fg} 0%, ${c.glow} 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 16px -6px ${c.glow}`,
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
      />
      <span className="relative text-[15px] font-bold tracking-tighter">{idx}</span>
    </div>
  );
}

/** Time chip: "09:00 — 10:00" + duration */
function TimeChip({ start, end }: { start: string; end: string }) {
  const mins = durationMinutes(start, end);
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#007AFF]/10 px-2.5 py-1 text-[12.5px] font-bold tabular-nums tracking-tight text-[#007AFF]">
        <Icon paths={I.clock} size={12} strokeWidth={2.2} />
        <span>{start}</span>
        <span className="opacity-40">→</span>
        <span>{end}</span>
      </div>
      {mins > 0 && (
        <span className="hidden text-[11px] font-bold uppercase tracking-wider text-[#86868B] sm:inline">
          {Math.floor(mins / 60) > 0 ? `${Math.floor(mins / 60)}h ` : ''}
          {mins % 60 > 0 ? `${mins % 60}m` : ''}
        </span>
      )}
    </div>
  );
}

/** Premium day selector (horizontal segmented control) */
function DaySelector({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (id: string) => void;
  t: (k: string) => string;
}) {
  const options = [{ id: '', label: t('schedule.allDays') }, ...DAYS.map((d) => ({ id: d, label: t(formatDay(d)) }))];

  return (
    <div
      className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      role="tablist"
      aria-label={t('schedule.dayOfWeek')}
      style={{ scrollbarWidth: 'none' }}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        const tone: Tone = opt.id ? DAY_TONES[opt.id as DayOfWeek] : 'blue';
        const c = TONES[tone];
        return (
          <motion.button
            key={opt.id || 'all'}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="relative shrink-0 overflow-hidden rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold tracking-tight outline-none transition-colors"
            style={{
              borderColor: active ? c.border : 'rgba(0,0,0,0.06)',
              background: active ? c.bg : '#ffffff80',
              color: active ? c.fg : '#86868B',
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`
                : 'inset 0 1px 0 rgba(255,255,255,0.6)',
            }}
          >
            {active && (
              <motion.span
                layoutId="day-active-glow"
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                  background:
                    'radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.55), transparent 70%)',
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {opt.id && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: active ? c.fg : '#C7C7CC' }}
                />
              )}
              {opt.label}
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING.snappy}
                  className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
                  style={{ background: c.fg, color: '#fff' }}
                >
                  <Icon paths={I.check} size={8} strokeWidth={3.5} />
                </motion.span>
              )}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Small squircle leading icon for inputs */
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

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function SchedulePage() {
  const { t } = useI18n();
  usePageTitle(t('nav.schedule'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [groupFilter, setGroupFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<ScheduleFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ScheduleFormState, string>>>({});

  const params = useMemo<ScheduleFilters>(
    () => ({
      page,
      limit: 20,
      groupId: groupFilter || undefined,
      dayOfWeek: dayFilter || undefined,
    }),
    [page, groupFilter, dayFilter],
  );

  const scheduleQ = useQuery({
    queryKey: ['schedule', params],
    queryFn: () => scheduleApi.list(params),
    placeholderData: (prev) => prev,
  });

  const data = scheduleQ.data as Paginated<Schedule> | undefined;
  const isLoading = scheduleQ.isLoading;
  const error = scheduleQ.error;

  const groupsQ = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  /* ── Mutations ─────────────────────────────────────────────────────── */
  const createMut = useMutation({
    mutationFn: (d: ScheduleFormState) =>
      scheduleApi.create({
        groupId: d.groupId,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.created'));
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: (d: ScheduleFormState & { id: string }) =>
      scheduleApi.update(d.id, {
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        room: d.room || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.updated'));
      closeModal();
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => scheduleApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      push('success', t('schedule.removed'));
    },
    onError: (e: unknown) => push('error', getErrorMessage(e)),
  });

  /* ── Modal handlers ────────────────────────────────────────────────── */
  const openCreate = useCallback(() => {
    setEditEntry(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((s: Schedule) => {
    setEditEntry(s);
    setForm({
      groupId: s.groupId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room ?? '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditEntry(null);
  }, []);

  const validate = (): boolean => {
    const errs: Partial<Record<keyof ScheduleFormState, string>> = {};
    if (!form.groupId) errs.groupId = t('common.required');
    if (!form.startTime) errs.startTime = t('common.required');
    if (!form.endTime) errs.endTime = t('common.required');
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editEntry) {
      updateMut.mutate({ ...form, id: editEntry.id });
    } else {
      createMut.mutate(form);
    }
  };

  const items = data?.items ?? [];
  const groups = (groupsQ.data as { items: Group[] } | undefined)?.items ?? [];

  /* ── Derived stats (from current page items) ───────────────────────── */
  const stats = useMemo(() => {
    const uniqueGroups = new Set(items.map((s) => s.groupId)).size;
    const uniqueDays = new Set(items.map((s) => s.dayOfWeek)).size;
    const uniqueRooms = new Set(items.map((s) => s.room).filter(Boolean)).size;
    return {
      total: data?.total ?? 0,
      uniqueGroups,
      uniqueDays,
      uniqueRooms,
    };
  }, [items, data?.total]);

  /* ── Loading ───────────────────────────────────────────────────────── */
  if (isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <GlassPageHeader
          title={t('nav.schedule')}
          subtitle={t('schedule.entriesCount', { count: 0 })}
        />
        <ScheduleSkeleton />
      </div>
    );
  }

  /* ── Error ─────────────────────────────────────────────────────────── */
  if (error && !data) {
    return (
      <div className="page-container space-y-5">
        <GlassPageHeader
          title={t('nav.schedule')}
          subtitle={t('nav.schedule')}
        />
        <div className="glass-card p-8">
          <GlassErrorState message={getErrorMessage(error)} />
        </div>
      </div>
    );
  }

  /* ── Render ────────────────────────────────────────────────────────── */
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
        <GlassCard className="overflow-hidden p-6 sm:p-7" interactive>
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* Gradient calendar icon */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(0,122,255,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
              />
              <Icon paths={I.calendarCheck} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('nav.schedule')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00000006] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B] dark:bg-[#ffffff08]">
                  <Icon paths={I.clock} size={11} strokeWidth={2.5} />
                  {stats.total} {t('schedule.col.time')}
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('nav.schedule')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('schedule.entriesCount', { count: stats.total })}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton variant="primary" size="sm" onClick={openCreate}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('schedule.addEntry')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ============================================================
          STATS
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatTile label={t('schedule.col.time')} value={stats.total} icon={I.calendarCheck} tone="blue" />
        <StatTile label={t('groups.title')} value={stats.uniqueGroups} icon={I.usersRound} tone="green" />
        <StatTile label={t('schedule.dayOfWeek')} value={stats.uniqueDays} icon={I.calendar} tone="orange" />
        <StatTile label={t('groups.col.room')} value={stats.uniqueRooms} icon={I.door} tone="purple" />
      </motion.div>

      {/* ============================================================
          FILTERS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <GlassCard className="p-4" interactive>
          <div className="flex flex-col gap-4">
            {/* Day selector */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Icon paths={I.filter} size={12} strokeWidth={2.2} className="text-[#86868B]" />
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('schedule.dayOfWeek')}
                </p>
              </div>
              <DaySelector
                value={dayFilter}
                onChange={(id) => {
                  setDayFilter(id);
                  setPage(1);
                }}
                t={t}
              />
            </div>

            {/* Group filter */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Icon paths={I.usersRound} size={12} strokeWidth={2.2} className="text-[#86868B]" />
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('exams.form.group')}
                </p>
              </div>
              <div className="relative max-w-sm">
                <FieldIcon icon={I.book} tone="green" />
                <GlassSelect
                  value={groupFilter}
                  onChange={(e) => {
                    setGroupFilter(e.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: '', label: t('students.allGroups') },
                    ...groups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                  placeholder={t('students.allGroups')}
                  className="pl-11"
                />
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ============================================================
          CONTENT
      ============================================================ */}
      {isLoading ? (
        <motion.div variants={cardVariants}>
          <GlassCard>
            <GlassPageLoader label={t('schedule.loading')} />
          </GlassCard>
        </motion.div>
      ) : items.length === 0 ? (
        <motion.div variants={cardVariants}>
          <GlassCard className="p-10" interactive>
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF]"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(0,122,255,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('schedule.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {t('schedule.emptyHint')}
              </p>
              <div className="mt-5">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <GlassButton variant="primary" size="sm" onClick={openCreate}>
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      {t('schedule.addEntry')}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      ) : (
        <motion.div variants={cardVariants}>
          <GlassCard padding="none" className="overflow-hidden" interactive>
            <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
              {items.map((s, idx) => {
                const tone = DAY_TONES[s.dayOfWeek];
                const gName = (s as Schedule & { group?: { name?: string } }).group?.name ?? '—';
                const isDeleting = deleteMut.isPending && deleteMut.variables === s.id;

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                    className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#007AFF]/[0.03]"
                  >
                    <DayTile day={s.dayOfWeek} tone={tone} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {t(formatDay(s.dayOfWeek))}
                        </p>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#00000006] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#86868B] dark:bg-[#ffffff08]">
                          <Icon paths={I.usersRound} size={9} strokeWidth={2.5} />
                          {gName}
                        </span>
                        {s.room && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#AF52DE]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#AF52DE]">
                            <Icon paths={I.door} size={9} strokeWidth={2.5} />
                            {s.room}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5">
                        <TimeChip start={s.startTime} end={s.endTime} />
                      </div>
                    </div>

                    <div className="flex gap-1.5">
                      <motion.button
                        type="button"
                        onClick={() => openEdit(s)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                        style={{
                          background: 'rgba(0,122,255,0.10)',
                          color: '#007AFF',
                          border: '1px solid rgba(0,122,255,0.2)',
                        }}
                      >
                        <Icon paths={I.edit} size={13} strokeWidth={2} />
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => setDeleteTarget(s.id)}
                        disabled={isDeleting}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label={t('schedule.remove')}
                        title={t('schedule.remove')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg outline-none disabled:opacity-50"
                        style={{
                          background: 'rgba(255,59,48,0.10)',
                          color: '#FF3B30',
                          border: '1px solid rgba(255,59,48,0.2)',
                        }}
                      >
                        {isDeleting ? (
                          <motion.span
                            className="h-3.5 w-3.5 rounded-full border-2 border-current/30 border-t-current"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                        ) : (
                          <Icon paths={I.trash} size={13} strokeWidth={2} />
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="border-t border-[#00000008] p-4 dark:border-[#ffffff08]">
                <div className="flex items-center justify-center gap-1">
                  <motion.button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00000008] bg-[#ffffff80] text-[#86868B] outline-none transition-colors hover:text-[#1D1D1F] disabled:opacity-40 dark:border-[#ffffff08] dark:bg-[#1c1c1e80] dark:hover:text-[#F5F5F7]"
                    aria-label="Previous page"
                  >
                    <Icon paths={I.arrowLeft} size={14} strokeWidth={2.2} />
                  </motion.button>

                  {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (data.totalPages <= 7) return true;
                      if (p === 1 || p === data.totalPages) return true;
                      if (Math.abs(p - page) <= 1) return true;
                      return false;
                    })
                    .map((p, i, arr) => {
                      const prev = arr[i - 1];
                      const gap = prev && p - prev > 1;
                      return (
                        <span key={p} className="flex items-center gap-1">
                          {gap && <span className="px-1 text-[#86868B]">…</span>}
                          <motion.button
                            type="button"
                            onClick={() => setPage(p)}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={SPRING.snappy}
                            className="relative flex h-9 min-w-9 items-center justify-center rounded-xl border px-2 text-[12.5px] font-semibold tabular-nums outline-none transition-colors"
                            style={
                              p === page
                                ? {
                                    borderColor: 'rgba(0,122,255,0.3)',
                                    background: 'rgba(0,122,255,0.10)',
                                    color: '#007AFF',
                                    boxShadow:
                                      'inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px rgba(0,122,255,0.4)',
                                  }
                                : {
                                    borderColor: 'rgba(0,0,0,0.08)',
                                    background: '#ffffff80',
                                    color: '#86868B',
                                  }
                            }
                          >
                            {p}
                          </motion.button>
                        </span>
                      );
                    })}

                  <motion.button
                    type="button"
                    onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#00000008] bg-[#ffffff80] text-[#86868B] outline-none transition-colors hover:text-[#1D1D1F] disabled:opacity-40 dark:border-[#ffffff08] dark:bg-[#1c1c1e80] dark:hover:text-[#F5F5F7]"
                    aria-label="Next page"
                  >
                    <Icon paths={I.arrowRight} size={14} strokeWidth={2.2} />
                  </motion.button>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ============================================================
          DELETE CONFIRM
      ============================================================ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMut.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('schedule.removeConfirm')}
        loading={deleteMut.isPending}
      />

      {/* ============================================================
          CREATE / EDIT MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editEntry ? t('schedule.editTitle') : t('schedule.newTitle')}
        wide
        footer={
          <>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton variant="secondary" size="sm" onClick={closeModal}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="primary"
                size="sm"
                type="submit"
                form="schedule-form"
                disabled={createMut.isPending || updateMut.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {createMut.isPending || updateMut.isPending ? (
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
                      {editEntry ? t('common.save') : t('common.create')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </>
        }
      >
        <div className="space-y-5">
          {/* Header hint */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editEntry
                ? 'Update the day, time, or room for this schedule entry.'
                : 'Create a new weekly schedule slot for a group.'}
            </p>
          </div>

          <form id="schedule-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <FieldIcon icon={I.book} tone="green" />
              <GlassSelect
                label={t('exams.form.group')}
                value={form.groupId}
                onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
                options={[
                  { value: '', label: t('schedule.selectGroup') },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
                placeholder={t('schedule.selectGroup')}
                error={formErrors.groupId}
                className="pl-11"
              />
            </div>

            {/* Day tiles picker */}
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                {t('schedule.dayOfWeek')}
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {DAYS.map((d) => {
                  const active = form.dayOfWeek === d;
                  const tone = DAY_TONES[d];
                  const c = TONES[tone];
                  const label = t(formatDay(d));
                  const short = label.length > 3 ? label.slice(0, 3) : label;
                  return (
                    <motion.button
                      key={d}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, dayOfWeek: d }))}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      transition={SPRING.snappy}
                      className="relative flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] font-bold tracking-tight outline-none transition-colors"
                      style={{
                        borderColor: active ? c.border : 'rgba(0,0,0,0.06)',
                        background: active ? c.bg : 'transparent',
                        color: active ? c.fg : '#86868B',
                        boxShadow: active
                          ? `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 14px -8px ${c.glow}`
                          : 'none',
                      }}
                    >
                      <span className="tabular-nums opacity-60 text-[9px]">
                        {String(DAYS.indexOf(d) + 1).padStart(2, '0')}
                      </span>
                      <span className="uppercase">{short}</span>
                      <AnimatePresence>
                        {active && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={SPRING.snappy}
                            className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full"
                            style={{ background: c.fg, color: '#fff' }}
                          >
                            <Icon paths={I.check} size={7} strokeWidth={3.5} />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
              {formErrors.dayOfWeek && (
                <span className="mt-1 text-xs" style={{ color: 'var(--state-error)' }}>
                  {formErrors.dayOfWeek}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <FieldIcon icon={I.clock} tone="blue" />
                <GlassInput
                  label={t('schedule.startTime')}
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  error={formErrors.startTime}
                  className="pl-11"
                />
              </div>
              <div className="relative">
                <FieldIcon icon={I.clock} tone="orange" />
                <GlassInput
                  label={t('schedule.endTime')}
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  error={formErrors.endTime}
                  className="pl-11"
                />
              </div>
            </div>

            <div className="relative">
              <FieldIcon icon={I.door} tone="purple" />
              <GlassInput
                label={t('groups.form.room')}
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
                placeholder={t('schedule.roomPlaceholder')}
                error={formErrors.room}
                className="pl-11"
              />
            </div>
          </form>
        </div>
      </GlassModal>
    </motion.div>
  );
}