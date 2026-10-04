/**
 * M-EDU CoursesPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero section with animated icon + stats inline
 *  - Stats bar (Total, Active, Avg Price, Levels) with CountUp
 *  - Segmented filter (All / Active / by Level) + search
 *  - Premium course cards with gradient icon tiles
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Tone-aware colors + spring physics
 *  - Premium modal with section headers + validation inline
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  GlassPageHeader,
  GlassCard,
  GlassErrorState,
  GlassEmptyState,
  GlassModal,
  GlassField,
  GlassInput,
  GlassTextArea,
  GlassBadge,
  GlassButton,
  useToasts,
  ConfirmDialog,
} from '@/components/ui';
import { coursesApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Course, CourseLevel } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';

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
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

const COURSE_LEVELS: CourseLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

type LevelFilter = 'ALL' | 'ACTIVE' | CourseLevel;

interface CourseFormState {
  name: string;
  description: string;
  price: string;
  duration: string;
  level: CourseLevel | '';
}

const INITIAL_FORM: CourseFormState = {
  name: '',
  description: '',
  price: '',
  duration: '',
  level: '',
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  bookOpen: [
    'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z',
    'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
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
  search: [
    'M21 21l-4.35-4.35',
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  creditCard: [
    'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',
    'M1 10h22',
    'M6 15h2',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  trendingUp: [
    'M22 7 13.5 15.5 8.5 10.5 2 17',
    'M16 7h6v6',
  ],
  graduationCap: [
    'M22 10 12 5 2 10l10 5 10-5z',
    'M6 12v5c3 3 9 3 12 0v-5',
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
 * TONE PALETTES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)' },
};

const LEVEL_TONE: Record<CourseLevel, Tone> = {
  BEGINNER:     'green',
  INTERMEDIATE: 'blue',
  ADVANCED:     'orange',
  EXPERT:       'purple',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

export function formatCourseLevel(level: string | null | undefined): string {
  if (!level) return '—';
  return level
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatDuration(months: number): string {
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export function getCourseStatusBadge(isActive: boolean): { variant: 'success' | 'muted'; label: string } {
  return isActive
    ? { variant: 'success', label: 'Active' }
    : { variant: 'muted', label: 'Inactive' };
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

const COURSE_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

function courseGradient(name: string): string {
  const [a, b] = COURSE_PALETTES[nameHash(name) % COURSE_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * SUB-COMPONENTS
 * ========================================================================== */

function CountUp({
  value, duration = 0.9, suffix = '', prefix = '', decimals = 0,
}: {
  value: number; duration?: number; suffix?: string; prefix?: string; decimals?: number;
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

  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return <span className="tabular-nums">{prefix}{shown}{suffix}</span>;
}

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CoursesSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="2rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[68px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-16" radius="1rem" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <Shimmer key={i} className="h-16" radius="1rem" />)}
      </div>
    </div>
  );
}

function StatTile({
  label, value, icon, tone = 'blue',
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONE[tone];

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B] truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

function SegmentedFilter({
  value, onChange, options, counts,
}: {
  value: LevelFilter;
  onChange: (v: LevelFilter) => void;
  options: { key: LevelFilter; label: string; icon: string[]; tone: Tone }[];
  counts: Record<LevelFilter, number>;
}) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const c = TONE[opt.tone];
        const count = counts[opt.key] ?? 0;

        return (
          <motion.button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING.snappy}
            className="relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold outline-none transition-colors"
            style={{
              color: active ? c.fg : '#86868B',
              background: active ? c.bg : 'transparent',
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px -4px ${c.glow}`
                : undefined,
            }}
          >
            <Icon paths={opt.icon} size={12} strokeWidth={2.2} />
            <span className="tracking-tight">{opt.label}</span>
            {count > 0 && (
              <span
                className="ml-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums"
                style={{
                  background: active ? `${c.fg}25` : 'rgba(142,142,147,0.15)',
                  color: active ? c.fg : '#86868B',
                }}
              >
                {count}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

function CourseRow({
  course, onEdit, onDelete,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (id: string) => void;
}) {
  const level = course.level as CourseLevel | null | undefined;
  const tone: Tone = level ? LEVEL_TONE[level] : 'slate';
  const c = TONE[tone];

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      className="group relative flex flex-col gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-3.5 transition-all hover:border-[#007AFF]/25 hover:bg-[#007AFF]/[0.02] dark:border-[#ffffff08] dark:bg-[#ffffff04] sm:flex-row sm:items-center"
    >
      {/* Course avatar/icon */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
        style={{
          background: courseGradient(course.name),
          boxShadow: '0 6px 16px -6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
        />
        <span className="relative text-[13px] tracking-tight">{getInitials(course.name)}</span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {course.name}
          </h3>
          <GlassBadge variant={course.isActive ? 'success' : 'muted'}>
            {course.isActive ? 'Active' : 'Inactive'}
          </GlassBadge>
        </div>

        {course.description && (
          <p className="mt-1 line-clamp-1 text-[12px] font-medium text-[#86868B]">
            {course.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-medium text-[#86868B]">
          {/* Level chip */}
          {level && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.fg}33`,
              }}
            >
              <Icon paths={I.award} size={9} strokeWidth={2.5} />
              {formatCourseLevel(level)}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Icon paths={I.clock} size={11} strokeWidth={2} className="opacity-70" />
            {course.duration} {course.duration === 1 ? 'month' : 'months'}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[#34C759]">
            <Icon paths={I.creditCard} size={11} strokeWidth={2.2} />
            {formatCurrency(course.price)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1.5 sm:opacity-70 sm:group-hover:opacity-100 sm:transition-opacity">
        <motion.button
          type="button"
          onClick={() => onEdit(course)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          aria-label="Edit"
          title="Edit course"
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
          style={{
            background: 'rgba(0,122,255,0.10)',
            color: '#007AFF',
            border: '1px solid rgba(0,122,255,0.22)',
          }}
        >
          <Icon paths={I.edit} size={13} strokeWidth={2} />
        </motion.button>
        <motion.button
          type="button"
          onClick={() => onDelete(course.id)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          aria-label="Delete"
          title="Delete course"
          className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
          style={{
            background: 'rgba(255,59,48,0.10)',
            color: '#FF3B30',
            border: '1px solid rgba(255,59,48,0.22)',
          }}
        >
          <Icon paths={I.trash} size={13} strokeWidth={2} />
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function CoursesPage() {
  const { t } = useI18n();
  usePageTitle(t('courses.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Filter + search
  const [filter, setFilter] = useState<LevelFilter>('ALL');
  const [search, setSearch] = useState('');

  // Form state
  const [form, setForm] = useState<CourseFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof CourseFormState, string>>
  >({});

  const courses = useQuery({
    queryKey: queryKeys.courses.all(),
    queryFn: () => coursesApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const data = courses.data as Paginated<Course> | undefined;
  const courseList = useMemo(() => data?.items || [], [data]);

  /* ---------------------------------------------------------------
     STATS
  --------------------------------------------------------------- */
  const stats = useMemo(() => {
    const total = courseList.length;
    const active = courseList.filter((c) => c.isActive).length;
    const totalPrice = courseList.reduce((sum, c) => sum + (Number(c.price) || 0), 0);
    const avgPrice = total > 0 ? totalPrice / total : 0;
    const levels = new Set(courseList.map((c) => c.level).filter(Boolean)).size;
    return { total, active, avgPrice, levels };
  }, [courseList]);

  /* ---------------------------------------------------------------
     FILTER COUNTS + FILTERED
  --------------------------------------------------------------- */
  const counts = useMemo<Record<LevelFilter, number>>(() => {
    const base: Record<LevelFilter, number> = {
      ALL: courseList.length,
      ACTIVE: courseList.filter((c) => c.isActive).length,
      BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0, EXPERT: 0,
    };
    for (const c of courseList) {
      if (c.level && c.level in base) base[c.level as CourseLevel]++;
    }
    return base;
  }, [courseList]);

  const filtered = useMemo(() => {
    let list = courseList;
    if (filter === 'ACTIVE') list = list.filter((c) => c.isActive);
    else if (filter !== 'ALL') list = list.filter((c) => c.level === filter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [courseList, filter, search]);

  const filterOptions = useMemo(
    () => [
      { key: 'ALL' as LevelFilter,         label: t('common.all'),          icon: I.layers,        tone: 'blue'   as Tone },
      { key: 'ACTIVE' as LevelFilter,      label: t('common.active'),       icon: I.checkCircle,   tone: 'green'  as Tone },
      { key: 'BEGINNER' as LevelFilter,    label: 'Beginner',               icon: I.graduationCap, tone: 'green'  as Tone },
      { key: 'INTERMEDIATE' as LevelFilter, label: 'Intermediate',          icon: I.book,          tone: 'blue'   as Tone },
      { key: 'ADVANCED' as LevelFilter,    label: 'Advanced',               icon: I.zap,           tone: 'orange' as Tone },
      { key: 'EXPERT' as LevelFilter,      label: 'Expert',                 icon: I.award,         tone: 'purple' as Tone },
    ],
    [t],
  );

  /* ---------------------------------------------------------------
     MUTATIONS
  --------------------------------------------------------------- */
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price) || 0,
        duration: parseInt(form.duration, 10) || 1,
        level: (form.level as CourseLevel) || undefined,
      };
      return editingId ? coursesApi.update(editingId, payload) : coursesApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('courses.updated') : t('courses.createSuccess'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.courses.selectors() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => coursesApi.remove(id),
    onSuccess: () => {
      push('success', t('courses.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.courses.all() });
      qc.invalidateQueries({ queryKey: queryKeys.courses.selectors() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ---------------------------------------------------------------
     FORM HANDLERS
  --------------------------------------------------------------- */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof CourseFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('courses.validation.nameRequired');
    if (!form.price || parseFloat(form.price) < 0) errors.price = t('courses.validation.priceInvalid');
    if (!form.duration || parseInt(form.duration, 10) < 1) errors.duration = t('courses.validation.durationMin');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleFormChange = useCallback(
    (field: keyof CourseFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const { refetch: refetchCourses } = courses;
  const handleRetry = useCallback(() => { void refetchCourses(); }, [refetchCourses]);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((course: Course) => {
    setEditingId(course.id);
    setForm({
      name: course.name,
      description: course.description || '',
      price: String(course.price),
      duration: String(course.duration),
      level: (course.level as CourseLevel) || '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => setDeleteTarget(id), []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  /* ---------------------------------------------------------------
     LOADING
  --------------------------------------------------------------- */
  if (courses.isLoading && !data) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="page-container space-y-5">
          <GlassPageHeader title={t('courses.title')} subtitle={t('courses.pageSubtitle')} />
          <CoursesSkeleton />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------
     ERROR
  --------------------------------------------------------------- */
  if (courses.isError) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="page-container space-y-5">
          <GlassPageHeader title={t('courses.title')} subtitle={t('courses.pageSubtitle')} />
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('courses.loadFailed')}
              message={getErrorMessage(courses.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------
     MAIN
  --------------------------------------------------------------- */
  return (
    <div style={{ display: 'contents' }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container space-y-5"
      >
        <GlassPageHeader
          title={t('courses.title')}
          subtitle={t('courses.pageSubtitle')}
        />

        {/* HERO */}
        <motion.div variants={cardVariants}>
          <GlassCard className="overflow-hidden p-6 sm:p-7" interactive>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Animated icon */}
              <div className="relative" style={{ width: 88, height: 88 }}>
                <motion.div
                  className="absolute inset-[-4px] rounded-full p-[3px]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                >
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #34C759, #007AFF)',
                    }}
                    aria-hidden
                  />
                </motion.div>

                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING.smooth}
                  className="relative flex h-full w-full items-center justify-center rounded-full text-white ring-2 ring-white/70 dark:ring-black/50"
                  style={{
                    background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                    boxShadow:
                      '0 12px 32px -8px rgba(0,122,255,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-full"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                    }}
                  />
                  <Icon paths={I.graduationCap} size={34} strokeWidth={2} className="relative" />
                </motion.div>
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <GlassBadge color="success">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                      {stats.active} Active
                    </span>
                  </GlassBadge>
                  <GlassBadge color="muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                      {stats.total} Total
                    </span>
                  </GlassBadge>
                  <GlassBadge color="purple">
                    <span className="inline-flex items-center gap-1">
                      <Icon paths={I.award} size={10} strokeWidth={2.5} />
                      {stats.levels} Levels
                    </span>
                  </GlassBadge>
                </div>

                <h2 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                  {t('courses.title')}
                </h2>
                <p className="mt-1 max-w-2xl text-[13.5px] font-medium text-[#86868B]">
                  {t('courses.pageSubtitle')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <GlassButton type="button" variant="primary" onClick={handleOpenModal}>
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                      {t('courses.add')}
                    </span>
                  </GlassButton>
                </motion.div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* STATS */}
        <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label={t('courses.title')} value={stats.total} icon={I.bookOpen} tone="blue" />
          <StatTile label={t('common.active')} value={stats.active} icon={I.checkCircle} tone="green" />
          <StatTile
            label="Avg Price"
            value={formatCurrency(stats.avgPrice)}
            icon={I.trendingUp}
            tone="orange"
          />
          <StatTile label="Levels" value={stats.levels} icon={I.award} tone="purple" />
        </motion.div>

        {/* TOOLBAR: filter + search */}
        <motion.div variants={cardVariants} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedFilter
            value={filter}
            onChange={setFilter}
            options={filterOptions}
            counts={counts}
          />

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#86868B]">
              <Icon paths={I.search} size={14} strokeWidth={2.2} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('courses.searchPlaceholder') || 'Search courses…'}
              className="input-base h-10 w-full pl-9 pr-9 text-[13px]"
            />
            {search && (
              <motion.button
                type="button"
                onClick={() => setSearch('')}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#86868B] outline-none hover:bg-[#00000008] dark:hover:bg-[#ffffff08]"
                aria-label="Clear search"
              >
                <Icon paths={I.x} size={12} strokeWidth={2.5} />
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* LIST */}
        <motion.div variants={cardVariants}>
          <GlassCard className="overflow-hidden p-0" interactive>
            <div className="flex items-center gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
                <Icon paths={I.bookOpen} size={15} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('courses.title')}
                </h2>
                <p className="text-[11px] font-medium text-[#86868B]">
                  {filtered.length} {filtered.length === 1 ? 'course' : 'courses'}
                </p>
              </div>
              {search && (
                <GlassBadge color="muted">
                  <span className="inline-flex items-center gap-1">
                    <Icon paths={I.search} size={10} strokeWidth={2.5} />
                    {filtered.length} found
                  </span>
                </GlassBadge>
              )}
            </div>

            <div className="p-3">
              {courseList.length === 0 ? (
                <div className="p-4">
                  <GlassEmptyState
                    title={t('courses.empty')}
                    message={t('courses.emptyMessage')}
                  />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4">
                  <div className="rounded-2xl border border-dashed border-[#00000015] p-6 text-center dark:border-[#ffffff15]">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
                      <Icon paths={I.search} size={20} strokeWidth={2} />
                    </div>
                    <p className="mt-3 text-[13.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      No courses match your filters
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-[12px] font-medium text-[#86868B]">
                      Try clearing the search or switching the level filter.
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                      {search && (
                        <GlassButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSearch('')}
                        >
                          Clear search
                        </GlassButton>
                      )}
                      <GlassButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => { setFilter('ALL'); setSearch(''); }}
                      >
                        Show all
                      </GlassButton>
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div layout className="space-y-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {filtered.map((course) => (
                      <CourseRow
                        key={course.id}
                        course={course}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* ADD / EDIT MODAL */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('courses.editTitle') : t('courses.add')}
          wide
        >
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Header hint */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
                <Icon paths={I.sparkles} size={18} strokeWidth={2} />
              </div>
              <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
                {editingId
                  ? 'Update course details. Changes apply immediately to new enrollments.'
                  : 'Create a new course with pricing, duration, and level. Students can enroll right away.'}
              </p>
            </div>

            {/* Section: Basic info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Icon paths={I.bookOpen} size={13} strokeWidth={2} className="text-[#86868B]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  Basic Information
                </p>
              </div>

              <GlassField label={t('courses.form.name')} required error={formErrors.name}>
                <GlassInput
                  value={form.name}
                  onChange={handleFormChange('name')}
                  required
                  aria-invalid={Boolean(formErrors.name)}
                  placeholder={t('courses.namePlaceholder')}
                />
              </GlassField>

              <GlassField label={t('courses.form.description')}>
                <GlassTextArea
                  rows={3}
                  value={form.description}
                  onChange={handleFormChange('description')}
                  placeholder={t('courses.descriptionPlaceholder')}
                />
              </GlassField>
            </div>

            {/* Section: Pricing & duration */}
            <div className="space-y-3 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
              <div className="flex items-center gap-2">
                <Icon paths={I.creditCard} size={13} strokeWidth={2} className="text-[#86868B]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  Pricing & Duration
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <GlassField label={t('courses.form.price')} required error={formErrors.price}>
                  <GlassInput
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price}
                    onChange={handleFormChange('price')}
                    required
                    aria-invalid={Boolean(formErrors.price)}
                    placeholder="299.99"
                  />
                </GlassField>
                <GlassField label={t('courses.form.durationLabel')} required error={formErrors.duration}>
                  <GlassInput
                    type="number"
                    min="1"
                    value={form.duration}
                    onChange={handleFormChange('duration')}
                    required
                    aria-invalid={Boolean(formErrors.duration)}
                    placeholder="6"
                  />
                </GlassField>
              </div>
            </div>

            {/* Section: Level */}
            <div className="space-y-3 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
              <div className="flex items-center gap-2">
                <Icon paths={I.award} size={13} strokeWidth={2} className="text-[#86868B]" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  Course Level
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {COURSE_LEVELS.map((level) => {
                  const active = form.level === level;
                  const c = TONE[LEVEL_TONE[level]];
                  return (
                    <motion.button
                      key={level}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, level }))}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING.snappy}
                      className="flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[11px] font-bold uppercase tracking-wider outline-none"
                      style={{
                        background: active ? c.bg : 'transparent',
                        borderColor: active ? `${c.fg}44` : 'rgba(0,0,0,0.06)',
                        color: active ? c.fg : '#86868B',
                        boxShadow: active
                          ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`
                          : undefined,
                      }}
                    >
                      <Icon paths={I.award} size={14} strokeWidth={2.2} />
                      {formatCourseLevel(level)}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  disabled={save.isPending}
                >
                  {t('common.cancel')}
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton type="submit" variant="primary" disabled={save.isPending}>
                  {save.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Icon
                        paths={editingId ? I.check : I.plus}
                        size={15}
                        strokeWidth={2.5}
                      />
                      {editingId ? t('courses.form.update') : t('courses.form.create')}
                    </span>
                  )}
                </GlassButton>
              </motion.div>
            </div>
          </form>
        </GlassModal>

        {/* DELETE CONFIRM */}
        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('courses.deleteConfirm')}
          loading={remove.isPending}
        />

        {toastNode}
      </motion.div>
    </div>
  );
}