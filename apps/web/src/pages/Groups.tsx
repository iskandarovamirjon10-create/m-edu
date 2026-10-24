/**
 * M-EDU GroupsPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient group tile + live stats chips + primary CTA
 *  - Animated KPI bar (Total, Active, Capacity, Rooms) with count-up
 *  - Premium rows: gradient group tile + course chip + teacher avatar + capacity bar
 *  - Status badge with tone-aware pulse
 *  - Premium create modal with squircle field icons
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { groupsApi, coursesApi, teachersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { openQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  GlassErrorState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassButton,
  FloatingActionIsland,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { getErrorMessage } from '@/lib/errorMessages';
import { fullName } from '@/lib/format';
import type { Paginated, Group, Course, Teacher } from '@/lib/types';
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
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  door: [
    'M3 21h18',
    'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16',
    'M14 12h.01',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
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
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  building: [
    'M3 21h18',
    'M5 21V7l8-4v18',
    'M19 21V11l-6-4',
    'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01',
  ],
  eye: [
    'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  x: [
    'M18 6 6 18',
    'M6 6l12 12',
  ],
  grid: [
    'M3 3h7v7H3z',
    'M14 3h7v7h-7z',
    'M14 14h7v7h-7z',
    'M3 14h7v7H3z',
  ],
  list: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3 6h.01',
    'M3 12h.01',
    'M3 18h.01',
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
 * TONES (Apple HIG Calibrated System)
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.08)',  glow: 'rgba(0,122,255,0.14)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.08)',  glow: 'rgba(52,199,89,0.14)', border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.08)',  glow: 'rgba(255,149,0,0.14)', border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.08)',  glow: 'rgba(255,59,48,0.14)', border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.08)', glow: 'rgba(175,82,222,0.14)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.08)', glow: 'rgba(50,173,230,0.14)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#8E8E93', bg: 'rgba(142,142,147,0.08)', glow: 'rgba(142,142,147,0.14)', border: 'rgba(142,142,147,0.20)' },
  emerald: { fg: '#34C759', bg: 'rgba(52,199,89,0.08)',  glow: 'rgba(52,199,89,0.14)', border: 'rgba(52,199,89,0.20)' },
};

const GROUP_PALETTES: Tone[] = ['blue', 'purple', 'emerald', 'orange', 'cyan', 'gray'];

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface GroupFormState {
  name: string;
  courseId: string;
  teacherId: string;
  capacity: string;
  room: string;
  startDate: string;
}

const INITIAL_FORM: GroupFormState = {
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '',
  room: '',
  startDate: '',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function formatTeacherName(teacher: Teacher | null | undefined): string {
  if (!teacher) return '—';
  return fullName(teacher.user?.firstName, teacher.user?.lastName);
}

function formatCapacity(group: Group): string {
  const current = group._count?.enrollments ?? 0;
  return group.capacity ? `${current} / ${group.capacity}` : String(current);
}

function capacityRatio(group: Group): number {
  const current = group._count?.enrollments ?? 0;
  if (!group.capacity) return 0;
  return Math.min(1, current / group.capacity);
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

function groupTone(name: string): Tone {
  return GROUP_PALETTES[nameHash(name) % GROUP_PALETTES.length];
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

function GroupsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="0.75rem" />)}
      </div>
      <Shimmer className="h-96 w-full" radius="1rem" />
    </div>
  );
}

function CountUp({
  value,
  duration = 1.1,
}: {
  value: number;
  duration?: number;
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

  return <span className="tabular-nums">{Math.round(n).toLocaleString('uz-UZ')}</span>;
}

/** Apple Pro KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  'data-testid': testId,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  'data-testid'?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      data-testid={testId}
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-surface-900/80 px-4 py-3.5 backdrop-blur-xl shadow-card hover:shadow-card-hover transition-all"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-2xl font-bold tracking-tight tabular-nums leading-none text-[var(--text-primary)] dark:text-white">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-xs font-medium text-[var(--text-secondary)] dark:text-zinc-400">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Status badge */
function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  const tone: Tone = isActive ? 'emerald' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-tight"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isActive && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-75"
            style={{ background: c.fg }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {label}
    </span>
  );
}

/** Capacity bar */
function CapacityBar({ group }: { group: Group }) {
  const cap = group.capacity ?? 0;
  const ratio = capacityRatio(group);
  const tone: Tone = ratio >= 0.9 ? 'red' : ratio >= 0.7 ? 'orange' : 'emerald';
  const c = TONES[tone];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] font-semibold tabular-nums tracking-tight text-[var(--text-primary)] dark:text-white">
        {formatCapacity(group)}
      </span>
      {cap > 0 && (
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.10]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: c.fg }}
            initial={{ width: 0 }}
            animate={{ width: `${ratio * 100}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          />
        </div>
      )}
    </div>
  );
}

/** Course chip */
function CourseChip({ name }: { name: string }) {
  const c = TONES.blue;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium tracking-tight"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.book} size={11} strokeWidth={2} />
      {name}
    </span>
  );
}

/** Room chip */
function RoomChip({ name }: { name: string }) {
  const c = TONES.purple;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
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

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function GroupsPage() {
  const { t } = useI18n();
  usePageTitle(t('groups.title'));
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  /* ── Modal state ──────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  /* ── Form state ───────────────────────────────────────────────────── */
  const [form, setForm] = useState<GroupFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof GroupFormState, string>>
  >({});

  const [graduateTarget, setGraduateTarget] = useState<Group | null>(null);
  const [graduateForm, setGraduateForm] = useState({
    targetGroupId: '',
    completionNote: 'Guruh bitirildi va talabalar keyingi bosqichga muvaffaqiyatli o\'tkazildi',
  });

  const graduateMutation = useMutation({
    mutationFn: () => {
      if (!graduateTarget) return Promise.reject(new Error('No group target'));
      return groupsApi.graduate(graduateTarget.id, {
        targetGroupId: graduateForm.targetGroupId || undefined,
        completionNote: graduateForm.completionNote,
      });
    },
    onSuccess: (res: any) => {
      push('success', `Guruh bitirildi! ${res?.graduatedCount || ''} ta talaba keyingi bosqichga o'tkazildi`);
      setGraduateTarget(null);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: any) => push('error', getErrorMessage(e)),
  });

  /* ── Queries ──────────────────────────────────────────────────────── */
  const groups = useQuery({
    queryKey: queryKeys.groups.all(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: queryKeys.courses.selectors(),
    queryFn: () => coursesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const teachers = useQuery({
    queryKey: queryKeys.teachers.selectors(),
    queryFn: () => teachersApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = groups.data as Paginated<Group> | undefined;
  const groupList = useMemo(() => data?.items || [], [data]);
  const courseList = useMemo(
    () => (courses.data as Paginated<Course> | undefined)?.items || [],
    [courses.data],
  );
  const teacherList = useMemo(
    () => (teachers.data as Paginated<Teacher> | undefined)?.items || [],
    [teachers.data],
  );

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = groupList.length;
    const active = groupList.filter((g) => g.isActive !== false).length;
    const totalCapacity = groupList.reduce((s, g) => s + (g.capacity ?? 0), 0);
    const rooms = new Set(groupList.map((g) => g.room).filter(Boolean)).size;
    return { total, active, totalCapacity, rooms };
  }, [groupList]);

  /* ── Create mutation ──────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () =>
      groupsApi.create({
        name: form.name.trim(),
        courseId: form.courseId,
        teacherId: form.teacherId || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        room: form.room.trim() || undefined,
        startDate: form.startDate || undefined,
      }),
    onSuccess: () => {
      push('success', t('groups.created'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Delete mutation ──────────────────────────────────────────────── */
  const remove = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => {
      push('success', t('groups.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Validators ───────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('groups.form.nameRequired');
    if (!form.courseId) errors.courseId = t('groups.form.courseRequired');
    if (form.capacity && parseInt(form.capacity, 10) < 1) {
      errors.capacity = t('groups.form.capacityMin');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleFormChange = useCallback(
    (field: keyof GroupFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleGroupClick = useCallback(
    (groupId: string) => {
      navigate(`/groups/${groupId}`);
    },
    [navigate],
  );

  const handleOpenGroupSidecar = useCallback(
    (group: Group) => {
      sound.playTick();
      const teacherName = formatTeacherName(group.teacher);
      const capacityStr = formatCapacity(group);
      openSidecar({
        id: group.id,
        type: 'group',
        title: group.name,
        subtitle: group.course?.name || 'Guruh',
        badge: {
          text: group.isActive !== false ? 'Faol' : 'Nofaol',
          tone: group.isActive !== false ? 'emerald' : 'slate',
        },
        avatar: {
          text: group.name.slice(0, 2).toUpperCase(),
          color: group.isActive !== false ? '#34C759' : '#8E8E93',
        },
        metrics: [
          {
            label: 'O\'quvchilar',
            value: formatCapacity(group),
            subtext: group.room ? `Xona: ${group.room}` : 'Xona belgilanmagan',
          },
          {
            label: 'O\'qituvchi',
            value: teacherName,
            subtext: 'Asosiy murabbiy',
          },
          {
            label: 'Boshlanish',
            value: group.startDate ? new Date(group.startDate).toLocaleDateString() : '—',
            subtext: 'Guruh start sanasi',
          },
        ],
        details: [
          { label: 'Guruh nomi', value: group.name },
          { label: 'Kurs', value: group.course?.name || '—' },
          { label: 'O\'qituvchi', value: teacherName },
          { label: 'Xona', value: group.room || '—' },
          { label: 'Sig\'im', value: capacityStr },
          { label: 'Boshlanish sanasi', value: group.startDate ? new Date(group.startDate).toLocaleDateString() : '—' },
          { label: 'Guruh ID', value: group.id, copyable: true },
        ],
        tags: [group.course?.name || 'Kurs', group.room ? `Xona ${group.room}` : ''].filter(Boolean),
        primaryAction: {
          label: 'Batafsil guruhga o\'tish',
          onExecute: () => navigate(`/groups/${group.id}`),
        },
        secondaryAction: {
          label: 'Tahrirlash',
          onExecute: () => navigate(`/groups/${group.id}/edit`),
        },
      });
    },
    [sound, navigate],
  );

  const handleQuickLook = useCallback(
    (group: Group) => {
      const teacherName = formatTeacherName(group.teacher);
      const capacityStr = formatCapacity(group);
      openQuickLook({
        id: group.id,
        type: 'group',
        title: group.name,
        subtitle: group.course?.name || 'Guruh',
        badge: {
          text: group.isActive !== false ? 'Faol' : 'Nofaol',
          tone: group.isActive !== false ? 'emerald' : 'slate',
        },
        avatar: {
          text: group.name.slice(0, 2).toUpperCase(),
        },
        metrics: [
          {
            label: 'O\'quvchilar',
            value: formatCapacity(group),
            subtext: group.room ? `Xona: ${group.room}` : 'Xona belgilanmagan',
          },
          {
            label: 'O\'qituvchi',
            value: teacherName,
            subtext: 'Asosiy murabbiy',
          },
          {
            label: 'Boshlanish',
            value: group.startDate ? new Date(group.startDate).toLocaleDateString() : '—',
            subtext: 'Guruh start sanasi',
          },
        ],
        details: [
          { label: 'Guruh nomi', value: group.name },
          { label: 'Kurs', value: group.course?.name || '—' },
          { label: 'O\'qituvchi', value: teacherName },
          { label: 'Xona', value: group.room || '—' },
          { label: 'Sig\'im', value: capacityStr },
          { label: 'Boshlanish sanasi', value: group.startDate ? new Date(group.startDate).toLocaleDateString() : '—' },
          { label: 'Guruh ID', value: group.id },
        ],
        tags: [group.course?.name || 'Kurs', group.room ? `Xona ${group.room}` : ''].filter(Boolean),
        primaryAction: {
          label: 'Batafsil guruhga o\'tish',
          onExecute: () => navigate(`/groups/${group.id}`),
        },
      });
    },
    [navigate],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchGroups } = groups;
  const handleRetry = useCallback(() => {
    void refetchGroups();
  }, [refetchGroups]);

  /* ── Search & Filter State ────────────────────────────────────────── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filteredGroups = useMemo(() => {
    let list = groupList;
    if (statusFilter === 'ACTIVE') list = list.filter((g) => g.isActive !== false);
    else if (statusFilter === 'INACTIVE') list = list.filter((g) => g.isActive === false);
    if (courseFilter !== 'ALL') list = list.filter((g) => g.courseId === courseFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.course?.name || '').toLowerCase().includes(q) ||
          (g.room || '').toLowerCase().includes(q) ||
          formatTeacherName(g.teacher).toLowerCase().includes(q)
      );
    }
    return list;
  }, [groupList, statusFilter, courseFilter, search]);

  /* ── Superhuman Keyboard-First Navigation ─────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Group>({
    items: filteredGroups,
    getItemId: (g) => g.id,
    rowIdPrefix: 'group-row-',
    onSelect: (g) => handleGroupClick(g.id),
    onQuickLook: (g) => handleOpenGroupSidecar(g),
    onEdit: (g) => navigate(`/groups/${g.id}/edit`),
  });

  /* ── Batch actions ────────────────────────────────────────────────── */
  const handleExportSelectedGroupsCSV = () => {
    const selectedRows = filteredGroups.filter((g) => isSelected(g.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Name,Course,Teacher,Room,Capacity']
        .concat(
          selectedRows.map(
            (g) =>
              `"${g.id}","${g.name}","${g.course?.name || ''}","${formatTeacherName(g.teacher)}","${g.room || ''}","${g.capacity || ''}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `groups_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    push('success', `${selectedRows.length} ta guruh CSV formatida yuklandi`);
  };

  const handleBatchDeleteGroups = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        await groupsApi.remove(id);
        count++;
      } catch {
        // continue
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
    clearSelection();
    push('success', `${count} ta guruh o'chirildi`);
  };

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (groups.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
        <GroupsSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (groups.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('groups.loadError')}
            message={getErrorMessage(groups.error as Error)}
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
        <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 sm:p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {/* Apple Icon squircle */}
            <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#0051D5] text-white shadow-[0_8px_20px_rgba(0,122,255,0.25)] ring-1 ring-white/20">
              <Icon paths={I.groups} size={24} strokeWidth={2.2} className="relative" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400 border border-brand-500/15">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.2} />
                  {t('groups.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] tabular-nums border border-black/[0.04] dark:border-white/[0.06]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.2} />
                  {stats.total} total
                </span>
                {stats.active > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#28A745] dark:text-[#34C759] tabular-nums border border-[#34C759]/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] animate-pulse" />
                    {stats.active} active
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl font-display">
                {t('groups.title')}
              </h1>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                {t('groups.pageSubtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                type="button"
                variant="primary"
                onClick={handleOpenModal}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2 font-medium">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('groups.create')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI STATS
      ============================================================ */}
      {groupList.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile data-testid="groups-metric-blue" label={t('groups.title')} value={stats.total} icon={I.groups} tone="blue" />
          <KpiTile data-testid="groups-metric-green" label={t('enum.status.ACTIVE')} value={stats.active} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('groups.col.capacity')} value={stats.totalCapacity} icon={I.users} tone="purple" />
          <KpiTile label={t('groups.col.room')} value={stats.rooms} icon={I.door} tone="orange" />
        </motion.div>
      )}

      {/* ============================================================
          APPLE SPOTLIGHT FILTER & TOOLBAR
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-sm"
      >
        {/* Left: Spotlight Search */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-tertiary)]">
            <Icon paths={I.search} size={15} strokeWidth={2.2} />
          </div>
          <input
            type="text"
            data-testid="groups-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Guruh nomi, kurs, xona yoki o'qituvchi bo'yicha qidirish..."
            className="w-full h-10 pl-9 pr-9 text-[13px] font-medium rounded-xl border border-black/[0.06] bg-white/80 dark:bg-surface-800/80 dark:border-white/[0.08] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Tozalash"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Icon paths={I.x} size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Right: Filters & View Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Course dropdown */}
          {courseList.length > 0 && (
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="h-10 px-3 text-[12.5px] font-medium rounded-xl border border-black/[0.06] bg-white/80 dark:bg-surface-800/80 dark:border-white/[0.08] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 cursor-pointer transition-all"
              aria-label="Kurs bo'yicha saralash"
            >
              <option value="ALL">Barcha kurslar</option>
              {courseList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Apple Segmented Control for Status */}
          <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-[var(--text-primary)] shadow-sm dark:bg-surface-800 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Hammasi <span className="ml-1 text-[10.5px] opacity-70">({stats.total})</span>
            </button>
            <button
              type="button"
              data-testid="groups-status-ACTIVE"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                statusFilter === 'ACTIVE'
                  ? 'bg-white text-[#28A745] dark:text-[#34C759] shadow-sm dark:bg-surface-800 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Faol <span className="ml-1 text-[10.5px] opacity-70">({stats.active})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
                statusFilter === 'INACTIVE'
                  ? 'bg-white text-[var(--text-primary)] shadow-sm dark:bg-surface-800 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Nofaol <span className="ml-1 text-[10.5px] opacity-70">({stats.total - stats.active})</span>
            </button>
          </div>

          {/* View Switcher: List vs Grid */}
          <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Ro'yxat ko'rinishi"
              title="Ro'yxat ko'rinishi"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-[#007AFF] shadow-sm dark:bg-surface-800'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon paths={I.list} size={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              data-testid="groups-view-grid"
              onClick={() => setViewMode('grid')}
              aria-label="Kataklar (Grid) ko'rinishi"
              title="Kataklar ko'rinishi"
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-[#007AFF] shadow-sm dark:bg-surface-800'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon paths={I.grid} size={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          GROUPS CONTENT (EMPTY / LIST / GRID)
      ============================================================ */}
      {groupList.length === 0 ? (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card text-center"
        >
          <div className="flex flex-col items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Icon paths={I.empty} size={24} strokeWidth={1.8} />
            </div>
            <p className="mt-4 text-[15px] font-bold tracking-tight text-[var(--text-primary)] font-display">
              {t('groups.empty')}
            </p>
            <p className="mt-1 max-w-sm text-[13px] text-[var(--text-secondary)]">
              {t('groups.emptyMessage')}
            </p>
            <div className="mt-5">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleOpenModal}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                    {t('groups.create')}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </motion.div>
      ) : filteredGroups.length === 0 ? (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card text-center"
        >
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-tertiary)]">
              <Icon paths={I.search} size={20} strokeWidth={2} />
            </div>
            <p className="mt-3 text-[14px] font-bold text-[var(--text-primary)]">
              Mos keluvchi guruh topilmadi
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
              Qidiruv so'zini yoki tanlangan filtrlarni o'zgartirib ko'ring
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setCourseFilter('ALL');
              }}
              className="mt-4 px-4 py-2 text-[12.5px] font-semibold rounded-xl bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-[var(--text-primary)] transition-colors"
            >
              Filtrlarni tozalash
            </button>
          </div>
        </motion.div>
      ) : viewMode === 'list' ? (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card divide-y divide-black/[0.05] dark:divide-white/[0.05]"
        >
          {/* Header row with Select All */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05] text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label="Barcha guruhlarni tanlash"
                checked={filteredGroups.length > 0 && selectedCount === filteredGroups.length}
                onChange={() => {
                  if (selectedCount === filteredGroups.length) {
                    clearSelection();
                  } else {
                    filteredGroups.forEach((g) => {
                      if (!isSelected(g.id)) toggleSelection(g.id);
                    });
                  }
                }}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
              />
              <span>{t('groups.title')}</span>
            </div>
          </div>
          {filteredGroups.map((group, idx) => {
            const tone = groupTone(group.name);
            const c = TONES[tone];
            const teacherName = formatTeacherName(group.teacher);
            const teacherInitials = getInitials(teacherName);
            const teacherGradient = avatarGradient(teacherName);
            const active = group.isActive !== false;
            const isDeleting = remove.isPending && remove.variables === group.id;
            const isRowSelected = isSelected(group.id);
            const isRowFocused = focusedIndex === idx;

            return (
              <motion.div
                key={group.id}
                id={`group-row-${group.id}`}
                role="link"
                tabIndex={0}
                aria-label={t('groups.viewAria', { name: group.name })}
                onClick={() => handleGroupClick(group.id)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    handleQuickLook(group);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGroupClick(group.id);
                  }
                }}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.015 }}
                className={`group flex cursor-pointer flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 transition-all ${
                  isRowFocused
                    ? 'ring-2 ring-[#007AFF] bg-brand-500/[0.06]'
                    : isRowSelected
                    ? 'bg-brand-500/[0.04]'
                    : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                }`}
              >
                {/* Left: Selection + Icon Squircle + Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isRowSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelection(group.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={isRowSelected ? "Tanlovni bekor qilish" : "Tanlash"}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
                  />

                  <div
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: c.bg,
                      color: c.fg,
                      border: `1px solid ${c.border}`,
                    }}
                  >
                    <Icon paths={I.groups} size={18} strokeWidth={2.2} className="relative" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
                      {group.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {group.course?.name && <CourseChip name={group.course.name} />}
                      {group.room && <RoomChip name={group.room} />}
                      {group.startDate && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-[var(--text-tertiary)]">
                          <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                          {new Date(group.startDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Columns: Teacher + Capacity */}
                <div className="hidden items-center gap-5 sm:flex shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {t('groups.col.teacher')}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <div
                        className="relative flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold text-white ring-1 ring-white/50 dark:ring-black/50"
                        style={{ background: teacherGradient }}
                      >
                        {teacherInitials}
                      </div>
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {teacherName}
                      </span>
                    </div>
                  </div>

                  <div className="hidden flex-col items-end md:flex">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {t('groups.col.capacity')}
                    </span>
                    <div className="mt-0.5">
                      <CapacityBar group={group} />
                    </div>
                  </div>
                </div>

                {/* Right: Status & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0 shrink-0">
                  <StatusBadge
                    isActive={active}
                    label={t(active ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE')}
                  />

                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                  >
                    {/* Sidecar Split-View trigger */}
                    <motion.button
                      type="button"
                      onClick={() => handleOpenGroupSidecar(group)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      aria-label="Sidecar tafsilotlarini ochish"
                      title="Sidecar tafsilotlari (Split-View · Space)"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-brand-500/40 transition-colors"
                    >
                      <span className="text-[13px] leading-none">◨</span>
                    </motion.button>

                    {/* Quick Look */}
                    <motion.button
                      type="button"
                      onClick={() => handleQuickLook(group)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label="Quick Look (Space)"
                      title="Tezkor ko'rish (Space)"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 transition-colors"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleQuickLook(group);
                        }
                      }}
                    >
                      <Icon paths={I.eye} size={13} strokeWidth={2.2} />
                    </motion.button>

                    {/* Graduate */}
                    <motion.button
                      type="button"
                      onClick={() => {
                        setGraduateTarget(group);
                        setGraduateForm({
                          targetGroupId: '',
                          completionNote: 'Guruh bitirildi va talabalar keyingi bosqichga muvaffaqiyatli o\'tkazildi',
                        });
                      }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label="Bosqichdan o'tkazish (Graduate & Promote)"
                      title="Guruhni bitirish & Talabalarni keyingi bosqichga o'tkazish"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#34C759]/20 bg-[#34C759]/10 text-[#28A745] dark:text-[#34C759] hover:bg-[#34C759]/15 transition-colors"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
                      <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />
                    </motion.button>

                    {/* Edit */}
                    <motion.div
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                    >
                      <Link
                        to={`/groups/${group.id}/edit`}
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-[#007AFF]/30 transition-colors"
                      >
                        <Icon paths={I.edit} size={13} strokeWidth={2} />
                      </Link>
                    </motion.div>

                    {/* Delete */}
                    <motion.button
                      type="button"
                      onClick={() => handleDelete(group.id)}
                      disabled={isDeleting}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/15 disabled:opacity-50 transition-colors"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
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

                  <span
                    className="hidden items-center text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 sm:flex"
                    aria-hidden
                  >
                    <Icon paths={I.arrowRight} size={14} strokeWidth={2.2} />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : (
        /* GRID VIEW */
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filteredGroups.map((group, idx) => {
            const tone = groupTone(group.name);
            const c = TONES[tone];
            const teacherName = formatTeacherName(group.teacher);
            const teacherInitials = getInitials(teacherName);
            const teacherGradient = avatarGradient(teacherName);
            const active = group.isActive !== false;
            const isDeleting = remove.isPending && remove.variables === group.id;
            const isRowSelected = isSelected(group.id);
            const isRowFocused = focusedIndex === idx;

            return (
              <motion.div
                key={group.id}
                id={`group-card-${group.id}`}
                role="link"
                tabIndex={0}
                onClick={() => handleGroupClick(group.id)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === ' ') {
                    e.preventDefault();
                    handleQuickLook(group);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    handleGroupClick(group.id);
                  }
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.02 }}
                className={`group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white/80 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer ${
                  isRowFocused
                    ? 'ring-2 ring-[#007AFF] bg-brand-500/[0.05]'
                    : isRowSelected
                    ? 'ring-2 ring-[#007AFF]/60 bg-brand-500/[0.03]'
                    : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(group.id);
                        }}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                          isRowSelected
                            ? 'border-[#007AFF] bg-[#007AFF] text-white'
                            : 'border-black/20 dark:border-white/20 bg-white/60 dark:bg-surface-800/60 hover:border-black/40 dark:hover:border-white/40'
                        }`}
                        aria-label={isRowSelected ? "Tanlovni bekor qilish" : "Tanlash"}
                      >
                        {isRowSelected && (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      <div
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: c.bg,
                          color: c.fg,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        <Icon paths={I.groups} size={18} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-[14px] font-bold text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
                          {group.name}
                        </h3>
                        <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
                          {group.startDate ? new Date(group.startDate).toLocaleDateString() : 'Boshlanish sanasi yo\'q'}
                        </span>
                      </div>
                    </div>
                    <StatusBadge
                      isActive={active}
                      label={t(active ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE')}
                    />
                  </div>

                  {/* Chips */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    {group.course?.name && <CourseChip name={group.course.name} />}
                    {group.room && <RoomChip name={group.room} />}
                  </div>

                  {/* Teacher info */}
                  <div className="mt-4 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04] pt-3">
                    <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                      {t('groups.col.teacher')}:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="relative flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold text-white ring-1 ring-white/50 dark:ring-black/50"
                        style={{ background: teacherGradient }}
                      >
                        {teacherInitials}
                      </div>
                      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                        {teacherName}
                      </span>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="mt-3">
                    <CapacityBar group={group} />
                  </div>
                </div>

                {/* Card Footer: Actions */}
                <div
                  className="mt-4 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04] pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    {/* Sidecar pill */}
                    <motion.button
                      type="button"
                      onClick={() => handleOpenGroupSidecar(group)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      title="Sidecar tafsilotlari (Split-View · Space)"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <span className="text-[13px] leading-none">◨</span>
                    </motion.button>
                    {/* Quick look */}
                    <motion.button
                      type="button"
                      onClick={() => handleQuickLook(group)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      title="Tezkor ko'rish (Space)"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#007AFF]/20 bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 transition-colors"
                    >
                      <Icon paths={I.eye} size={13} strokeWidth={2.2} />
                    </motion.button>
                    {/* Graduate */}
                    <motion.button
                      type="button"
                      onClick={() => {
                        setGraduateTarget(group);
                        setGraduateForm({
                          targetGroupId: '',
                          completionNote: 'Guruh bitirildi va talabalar keyingi bosqichga muvaffaqiyatli o\'tkazildi',
                        });
                      }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      title="Guruhni bitirish & Talabalarni keyingi bosqichga o'tkazish"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#34C759]/20 bg-[#34C759]/10 text-[#28A745] dark:text-[#34C759] hover:bg-[#34C759]/15 transition-colors"
                    >
                      <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />
                    </motion.button>
                    {/* Edit */}
                    <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
                      <Link
                        to={`/groups/${group.id}/edit`}
                        title={t('common.edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] transition-colors"
                      >
                        <Icon paths={I.edit} size={13} strokeWidth={2} />
                      </Link>
                    </motion.div>
                  </div>

                  {/* Delete */}
                  <motion.button
                    type="button"
                    onClick={() => handleDelete(group.id)}
                    disabled={isDeleting}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    title={t('common.delete')}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/15 disabled:opacity-50 transition-colors"
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
        </motion.div>
      )}

      {/* Superhuman Floating Action Island */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        entityName="guruh"
        actions={[
          {
            label: 'CSV Eksport',
            shortcut: 'C',
            icon: <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />,
            variant: 'primary',
            onClick: handleExportSelectedGroupsCSV,
          },
          {
            label: "O'chirish",
            shortcut: 'D',
            icon: <Icon paths={I.trash} size={13} strokeWidth={2} />,
            variant: 'destructive',
            onClick: handleBatchDeleteGroups,
          },
        ]}
      />

      {/* ============================================================
          CREATE MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('groups.create')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#2563EB33] bg-[#2563EB]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/15 text-[#2563EB]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('groups.createDesc')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('groups.form.name')} required error={formErrors.name}>
              <div className="relative">
                <FieldIcon icon={I.groups} tone="blue" />
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                  placeholder={t('groups.namePlaceholder')}
                  className="pl-11"
                />
              </div>
              {formErrors.name && (
                <span
                  id="name-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.name}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('groups.form.course')}
              required
              error={formErrors.courseId}
            >
              <div className="relative">
                <FieldIcon icon={I.book} tone="purple" />
                <GlassSelect
                  value={form.courseId}
                  onChange={handleFormChange('courseId')}
                  required
                  aria-invalid={Boolean(formErrors.courseId)}
                  aria-describedby={formErrors.courseId ? 'course-error' : undefined}
                  className="pl-11"
                >
                  <option value="">{t('groups.selectCoursePlaceholder')}</option>
                  {courseList.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </GlassSelect>
              </div>
              {formErrors.courseId && (
                <span
                  id="course-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.courseId}
                </span>
              )}
            </GlassField>

            <GlassField label={t('groups.form.teacher')}>
              <div className="relative">
                <FieldIcon icon={I.user} tone="cyan" />
                <GlassSelect
                  value={form.teacherId}
                  onChange={handleFormChange('teacherId')}
                  aria-label={t('groups.selectTeacherAria')}
                  className="pl-11"
                >
                  <option value="">—</option>
                  {teacherList.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {formatTeacherName(teacher)}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <GlassField label={t('groups.form.room')}>
              <div className="relative">
                <FieldIcon icon={I.door} tone="orange" />
                <GlassInput
                  value={form.room}
                  onChange={handleFormChange('room')}
                  placeholder={t('groups.roomPlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('groups.form.capacity')} error={formErrors.capacity}>
              <div className="relative">
                <FieldIcon icon={I.users} tone="emerald" />
                <GlassInput
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={handleFormChange('capacity')}
                  aria-invalid={Boolean(formErrors.capacity)}
                  aria-describedby={formErrors.capacity ? 'capacity-error' : undefined}
                  placeholder="20"
                  className="pl-11"
                />
              </div>
              {formErrors.capacity && (
                <span
                  id="capacity-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.capacity}
                </span>
              )}
            </GlassField>

            <GlassField label={t('groups.form.startDate')}>
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="green" />
                <GlassInput
                  type="date"
                  value={form.startDate}
                  onChange={handleFormChange('startDate')}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
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
                      {t('groups.create')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          GRADUATE & PROMOTE MODAL (Bosqichdan bosqichga o'tkazish)
      ============================================================ */}
      <GlassModal
        open={graduateTarget !== null}
        onClose={() => setGraduateTarget(null)}
        title="Guruhni bitirish & Keyingi bosqichga o'tkazish"
      >
        {graduateTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              graduateMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-200">
              <p className="font-semibold">
                «{graduateTarget.name}» guruhi talabalarini yangi bosqichga o'tkazish
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                Guruh yakunlanadi, faol talabalarga bitirganlik maqomi beriladi va tanlangan yangi guruhga (masalan: Elementary dan Pre-Intermediate ga) ommaviy o'tkaziladi.
              </p>
            </div>

            <GlassField label="Keyingi bosqich guruhi (ixtiyoriy)">
              <GlassSelect
                value={graduateForm.targetGroupId}
                onChange={(e) => setGraduateForm({ ...graduateForm, targetGroupId: e.target.value })}
              >
                <option value="">Yangi guruhga o'tkazmasdan faqat bitirish...</option>
                {groupList
                  .filter((g) => g.id !== graduateTarget.id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.course?.name ? `(${g.course.name})` : ''}
                    </option>
                  ))}
              </GlassSelect>
            </GlassField>

            <GlassField label="Bitiruv xulosasi / Izoh">
              <GlassInput
                value={graduateForm.completionNote}
                onChange={(e) => setGraduateForm({ ...graduateForm, completionNote: e.target.value })}
                placeholder="Guruh dasturni muvaffaqiyatli tugatdi..."
              />
            </GlassField>

            <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
              <GlassButton type="button" variant="secondary" onClick={() => setGraduateTarget(null)}>
                {t('common.cancel')}
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={graduateMutation.isPending}>
                {graduateMutation.isPending ? 'O\'tkazilmoqda...' : 'Bitirish va O\'tkazish'}
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('groups.confirmDelete')}
        loading={remove.isPending}
      />
    </motion.div>
  );
}
