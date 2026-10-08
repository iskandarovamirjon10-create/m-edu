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
import {
  GlassErrorState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassButton,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
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

const GROUP_PALETTES: Tone[] = ['blue', 'purple', 'emerald', 'orange', 'cyan', 'red', 'green', 'gray'];

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
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-96 w-full" radius="1.75rem" />
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

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
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
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Status badge with tone-aware pulse */
function StatusBadge({ isActive, label }: { isActive: boolean; label: string }) {
  const tone: Tone = isActive ? 'emerald' : 'gray';
  const c = TONES[tone];
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
        {isActive && (
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

/** Capacity bar */
function CapacityBar({ group }: { group: Group }) {
  const cap = group.capacity ?? 0;
  const ratio = capacityRatio(group);
  const tone: Tone = ratio >= 0.9 ? 'red' : ratio >= 0.7 ? 'orange' : 'emerald';
  const c = TONES[tone];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] font-semibold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
        {formatCapacity(group)}
      </span>
      {cap > 0 && (
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
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
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={I.book} size={10} strokeWidth={2.2} />
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

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (groups.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
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
            {/* Gradient groups tile */}
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
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.groups} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Groups
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00000006] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B] dark:bg-[#ffffff08]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} total
                </span>
                {stats.active > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {stats.active} active
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('groups.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('groups.pageSubtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton type="button" variant="primary" onClick={handleOpenModal}>
                <span className="inline-flex items-center gap-2">
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
          <KpiTile label={t('groups.title')} value={stats.total} icon={I.groups} tone="blue" />
          <KpiTile label={t('enum.status.ACTIVE')} value={stats.active} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('groups.col.capacity')} value={stats.totalCapacity} icon={I.users} tone="purple" />
          <KpiTile label={t('groups.col.room')} value={stats.rooms} icon={I.door} tone="orange" />
        </motion.div>
      )}

      {/* ============================================================
          GROUPS LIST
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

        {groupList.length === 0 ? (
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
                {t('groups.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {t('groups.emptyMessage')}
              </p>
              <div className="mt-5">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <GlassButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleOpenModal}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      {t('groups.create')}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
            {groupList.map((group, idx) => {
              const tone = groupTone(group.name);
              const c = TONES[tone];
              const isDeleting = remove.isPending && remove.variables === group.id;
              const teacherName = formatTeacherName(group.teacher);
              const teacherInitials = getInitials(teacherName);
              const teacherGradient = avatarGradient(teacherName);
              const active = group.isActive !== false;

              return (
                <motion.div
                  key={group.id}
                  role="link"
                  tabIndex={0}
                  aria-label={t('groups.viewAria', { name: group.name })}
                  onClick={() => handleGroupClick(group.id)}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleGroupClick(group.id);
                    }
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="group flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#007AFF]/[0.03]"
                >
                  {/* Gradient group tile */}
                  <div
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{
                      background: `linear-gradient(135deg, ${c.fg} 0%, ${c.glow} 100%)`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px ${c.glow}`,
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
                    <Icon paths={I.groups} size={20} strokeWidth={2} className="relative" />
                  </div>

                  {/* Name + chips */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {group.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {group.course?.name && <CourseChip name={group.course.name} />}
                      {group.room && <RoomChip name={group.room} />}
                      {group.startDate && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium tabular-nums text-[#86868B]">
                          <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                          {new Date(group.startDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Teacher */}
                  <div className="hidden flex-col items-end sm:flex">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                      {t('groups.col.teacher')}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <div
                        className="relative flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white/50 dark:ring-black/30"
                        style={{
                          background: teacherGradient,
                        }}
                      >
                        <span className="relative">{teacherInitials}</span>
                      </div>
                      <span className="text-[12px] font-semibold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {teacherName}
                      </span>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="hidden flex-col items-end md:flex">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                      {t('groups.col.capacity')}
                    </span>
                    <div className="mt-0.5">
                      <CapacityBar group={group} />
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge
                    isActive={active}
                    label={t(active ? 'enum.status.ACTIVE' : 'enum.status.INACTIVE')}
                  />

                  {/* Actions */}
                  <div
                    className="flex gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                    >
                      <Link
                        to={`/groups/${group.id}/edit`}
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
                      </Link>
                    </motion.div>
                    <motion.button
                      type="button"
                      onClick={() => handleDelete(group.id)}
                      disabled={isDeleting}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('common.delete')}
                      title={t('common.delete')}
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
                    <span
                      className="hidden items-center text-[#86868B]/60 transition-transform group-hover:translate-x-0.5 sm:flex"
                      aria-hidden
                    >
                      <Icon paths={I.arrowRight} size={14} strokeWidth={2.2} />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

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
          <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              Create a new group. Name and course are required.
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

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
                disabled={create.isPending}
              >
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
