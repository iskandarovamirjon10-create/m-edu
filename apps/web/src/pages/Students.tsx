/**
 * M-EDU StudentsPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Per-student deterministic gradient avatars (name hash → palette)
 *  - Animated stats bar (Total / Active / Inactive / With Groups)
 *  - Stagger entrance for table rows (Apple spring physics)
 *  - Shimmer skeleton (not pulse)
 *  - Icon-only row actions (edit / delete)
 *  - Custom SVG icons in SF Symbols proportions (no lucide)
 *  - Magnetic button interactions
 *  - Status-aware badges with tone glow
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { studentsApi, groupsApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassBadge,
  GlassButton,
  ConfirmDialog,
  useToasts,
} from '@/components/ui';

import { useDebounce } from '@/hooks/useDebounce';
import { fullName } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
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
  visible: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.05 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface StudentFilters {
  page: number;
  limit: number;
  search?: string;
  groupId?: string;
}

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  plus: ['M12 5v14', 'M5 12h14'],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6', 'M22 11h-6',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  pause: [
    'M10 4H6v16h4z',
    'M18 4h-4v16h4z',
  ],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
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
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  parent: [
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M19 8v6', 'M22 11h-6',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
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
 * HELPERS (exported — preserved public API)
 * ========================================================================== */

export function formatStudentName(student: Student): string {
  return fullName(student.user?.firstName, student.user?.lastName);
}

export function getStudentStatusBadge(isActive: boolean | undefined): {
  color: string;
  label: string;
} {
  return isActive === false
    ? { color: 'red', label: 'enum.status.INACTIVE' }
    : { color: 'green', label: 'enum.status.ACTIVE' };
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

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function CountUp({
  value, duration = 1.1, suffix = '',
}: { value: number; duration?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{n.toLocaleString()}{suffix}</span>;
}

function StudentAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...SPRING.snappy, delay: 0.05 }}
      whileHover={{ scale: 1.06 }}
      className="relative flex shrink-0 items-center justify-center rounded-full font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
      style={{
        width: size,
        height: size,
        background: avatarGradient(name),
        fontSize: size * 0.32,
        letterSpacing: '0.02em',
        boxShadow: '0 6px 18px -6px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
      />
      <span className="relative">{getInitials(name)}</span>
    </motion.div>
  );
}

function StatTile({
  label, value, icon, tone = 'blue',
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
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

function StudentsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[68px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div
        className="overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[#00000008] p-4 last:border-0 dark:border-[#ffffff08]"
          >
            <Shimmer className="h-11 w-11" radius="9999px" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-40" radius="0.5rem" />
              <Shimmer className="h-3 w-56" radius="0.5rem" />
            </div>
            <Shimmer className="hidden h-6 w-20 sm:block" radius="9999px" />
            <Shimmer className="hidden h-6 w-16 md:block" radius="9999px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RowAction({
  icon, label, tone, to, onClick, disabled,
}: {
  icon: string[];
  label: string;
  tone: 'edit' | 'delete';
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const colors =
    tone === 'edit'
      ? { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', hoverBg: 'rgba(0,122,255,0.18)' }
      : { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)', hoverBg: 'rgba(255,59,48,0.18)' };

  const content = (
    <Icon paths={icon} size={15} strokeWidth={2} />
  );

  const className =
    'flex h-8 w-8 items-center justify-center rounded-[10px] outline-none disabled:opacity-50';
  const style: React.CSSProperties = {
    background: colors.bg,
    color: colors.fg,
    border: `1px solid ${colors.fg}22`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
  };

  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = colors.hoverBg;
  };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    (e.currentTarget as HTMLElement).style.background = colors.bg;
  };

  if (to) {
    return (
      <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={SPRING.snappy}>
        <Link
          to={to}
          aria-label={label}
          title={label}
          className={className}
          style={style}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
        >
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={SPRING.snappy}
      aria-label={label}
      title={label}
      className={className}
      style={style}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {content}
    </motion.button>
  );
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

export function StudentsPage() {
  const { t } = useI18n();
  usePageTitle(t('students.title'));
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  // Query params
  const params = useMemo<StudentFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      groupId: groupId || undefined,
    }),
    [page, debouncedSearch, groupId],
  );

  const students = useQuery({
    queryKey: queryKeys.students.list(params),
    queryFn: () => studentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = students.data as Paginated<Student> | undefined;
  const studentList = useMemo(() => data?.items || [], [data]);
  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items || [],
    [groups.data],
  );

  // Derived stats
  const stats = useMemo(() => {
    const active = studentList.filter((s) => s.user?.isActive !== false).length;
    const inactive = studentList.length - active;
    const withGroups = studentList.filter(
      (s) => (s.groups || []).some((g) => g.isActive),
    ).length;
    return { total: data?.total ?? studentList.length, active, inactive, withGroups };
  }, [studentList, data?.total]);

  // Handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleGroupFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setGroupId(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleStudentClick = useCallback(
    (studentId: string) => {
      navigate(`/students/${studentId}`);
    },
    [navigate],
  );

  const remove = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      push('success', t('students.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const handleDelete = useCallback((id: string) => setDeleteTarget(id), []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const { refetch: refetchStudents } = students;
  const handleRetry = useCallback(() => { void refetchStudents(); }, [refetchStudents]);

  const hasActiveFilters = Boolean(search || groupId);

  /* ------------------------------------------------------------------------
     LOADING
  ------------------------------------------------------------------------ */
  if (students.isLoading && !data) {
    return (
      <>
        <div className="page-container space-y-5">
          <GlassPageHeader
            title={t('students.title')}
            subtitle={t('students.pageSubtitle')}
            actions={
              <GlassButton asChild variant="primary">
                <Link to="/students/new">
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.userPlus} size={16} strokeWidth={2} />
                    {t('students.add')}
                  </span>
                </Link>
              </GlassButton>
            }
          />
          <StudentsSkeleton />
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------------
     ERROR
  ------------------------------------------------------------------------ */
  if (students.isError) {
    return (
      <>
        <div className="page-container space-y-5">
          <GlassPageHeader
            title={t('students.title')}
            subtitle={t('students.pageSubtitle')}
            actions={
              <GlassButton asChild variant="primary">
                <Link to="/students/new">
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.userPlus} size={16} strokeWidth={2} />
                    {t('students.add')}
                  </span>
                </Link>
              </GlassButton>
            }
          />
          <div className="glass-card p-8">
            <GlassErrorState
              title={t('students.loadFailed')}
              message={getErrorMessage(students.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </>
    );
  }

  /* ------------------------------------------------------------------------
     MAIN
  ------------------------------------------------------------------------ */
  return (
    <>
      <div className="page-container space-y-5">
        <GlassPageHeader
          title={t('students.title')}
          subtitle={t('students.pageSubtitle')}
          actions={
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton asChild variant="primary">
                <Link to="/students/new">
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.userPlus} size={16} strokeWidth={2} />
                    {t('students.add')}
                  </span>
                </Link>
              </GlassButton>
            </motion.div>
          }
        />

        {/* ============================================================
            STATS BAR
        ============================================================ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatTile label={t('students.title')} value={stats.total} icon={I.users} tone="blue" />
          <StatTile label={t('enum.status.ACTIVE')} value={stats.active} icon={I.checkCircle} tone="green" />
          <StatTile label={t('enum.status.INACTIVE')} value={stats.inactive} icon={I.pause} tone="orange" />
          <StatTile label={t('students.col.groups')} value={stats.withGroups} icon={I.usersRound} tone="purple" />
        </motion.div>

        {/* ============================================================
            FILTERS
        ============================================================ */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:flex-1 sm:grid-cols-2">
              <GlassInput
                placeholder={t('students.searchPlaceholderEmail')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('students.searchLabel')}
                type="search"
                inputPrefix={<Icon paths={I.search} size={16} className="text-[var(--text-muted)]" />}
              />
              <GlassSelect
                value={groupId}
                onChange={handleGroupFilterChange}
                aria-label={t('students.filterGroupLabel')}
              >
                <option value="">{t('students.allGroups')}</option>
                {groupList.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </GlassSelect>
            </div>
            <div
              className="text-sm sm:ml-4 sm:shrink-0"
              style={{ color: 'var(--text-primary)' }}
            >
              {stats.total === 1
                ? t('students.totalOne')
                : t('students.totalMany', { count: stats.total })}
            </div>
          </div>
        </div>

        {/* ============================================================
            TABLE
        ============================================================ */}
        <div className="glass-card overflow-hidden">
          <AnimatePresence mode="wait">
            {studentList.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING.smooth}
              >
                <GlassEmptyState
                  title={hasActiveFilters ? t('students.emptyFiltered') : t('students.emptySearch')}
                  message={
                    hasActiveFilters
                      ? t('students.emptyFilteredHint')
                      : t('students.emptyHint')
                  }
                  action={
                    <GlassButton asChild variant="primary">
                      <Link to="/students/new">
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.userPlus} size={16} strokeWidth={2} />
                          {t('students.add')}
                        </span>
                      </Link>
                    </GlassButton>
                  }
                />
              </motion.div>
            ) : (
              <motion.div
                key="table"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="contents"
              >
                <div className="overflow-x-auto">
                  <GlassTable>
                    <GlassTHead>
                      <GlassTR>
                        <GlassTH>{t('common.name')}</GlassTH>
                        <GlassTH>{t('common.email')}</GlassTH>
                        <GlassTH>{t('students.col.groups')}</GlassTH>
                        <GlassTH>{t('students.col.parentName')}</GlassTH>
                        <GlassTH>{t('students.col.status')}</GlassTH>
                        <GlassTH>{t('common.actions')}</GlassTH>
                      </GlassTR>
                    </GlassTHead>
                    <GlassTBody>
                      {studentList.map((student, idx) => {
                        const statusBadge = getStudentStatusBadge(student.user?.isActive);
                        const activeGroups = (student.groups || []).filter(
                          (g) => g.isActive,
                        );
                        const name = formatStudentName(student);

                        return (
                          <motion.tr
                            key={student.id}
                            variants={rowVariants}
                            onClick={() => handleStudentClick(student.id)}
                            className="group cursor-pointer transition-colors hover:bg-[#007AFF]/[0.04]"
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              transitionDelay: `${idx * 10}ms`,
                            }}
                            tabIndex={0}
                            role="link"
                            aria-label={t('students.viewStudentAria', { name })}
                            onKeyDown={(e: React.KeyboardEvent) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleStudentClick(student.id);
                              }
                            }}
                          >
                            {/* NAME */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className="flex items-center gap-3">
                                <StudentAvatar name={name} />
                                <div className="min-w-0">
                                  <div
                                    className="truncate text-[14px] font-semibold tracking-tight"
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {name}
                                  </div>
                                  {activeGroups.length > 0 && (
                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#86868B]">
                                      <Icon paths={I.usersRound} size={11} strokeWidth={2} />
                                      {activeGroups.length} {activeGroups.length === 1 ? 'group' : 'groups'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* EMAIL */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {student.user?.email ? (
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#86868B]">
                                  <Icon paths={I.mail} size={13} strokeWidth={2} className="opacity-60" />
                                  <span className="truncate max-w-[180px]">{student.user.email}</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            {/* GROUPS */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className="flex flex-wrap gap-1">
                                {activeGroups.slice(0, 3).map((enrollment) => (
                                  <GlassBadge key={enrollment.group.id} color="blue">
                                    {enrollment.group.name}
                                  </GlassBadge>
                                ))}
                                {activeGroups.length === 0 && (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                                {activeGroups.length > 3 && (
                                  <GlassBadge color="slate">+{activeGroups.length - 3}</GlassBadge>
                                )}
                              </div>
                            </td>

                            {/* PARENT */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {student.parentName ? (
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                                  <Icon paths={I.parent} size={13} strokeWidth={2} className="opacity-50" />
                                  <span className="truncate max-w-[160px]">{student.parentName}</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            {/* STATUS */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <GlassBadge color={statusBadge.color}>
                                {t(statusBadge.label)}
                              </GlassBadge>
                            </td>

                            {/* ACTIONS */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div
                                className="flex justify-end gap-2"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                              >
                                <RowAction
                                  icon={I.edit}
                                  label={t('common.edit')}
                                  tone="edit"
                                  to={`/students/${student.id}/edit`}
                                />
                                <RowAction
                                  icon={I.trash}
                                  label={t('common.delete')}
                                  tone="delete"
                                  onClick={() => handleDelete(student.id)}
                                  disabled={remove.isPending && remove.variables === student.id}
                                />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </GlassTBody>
                  </GlassTable>
                </div>

                <div
                  className="px-4 py-3"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                  <GlassPagination
                    page={page}
                    totalPages={data?.totalPages ?? 1}
                    onPageChange={setPage}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('students.confirmDelete')}
          loading={remove.isPending}
        />

        {toastNode}
      </div>
    </>
  );
}
