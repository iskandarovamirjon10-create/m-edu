/**
 * M-EDU TeachersPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Per-teacher gradient avatars derived from name hash (stable, beautiful)
 *  - Animated stats bar with count-up numbers
 *  - Stagger entrance for table rows (Apple spring physics)
 *  - Cursor-tracked specular on every GlassCard
 *  - Shimmer skeleton (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Magnetic buttons, refined hover micro-interactions
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { teachersApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassCard,
  GlassBadge,
  GlassErrorState,
  GlassEmptyState,
  GlassTable,
  GlassTHead,
  GlassTBody,
  GlassTR,
  GlassTH,
  GlassPagination,
  GlassInput,
  GlassModal,
  GlassField,
  GlassTextArea,
  useToasts,
  GlassButton,
  ConfirmDialog,
} from '@/components/ui';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Teacher } from '@/lib/types';
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
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface TeacherFilters {
  page: number;
  limit: number;
  search?: string;
}

interface TeacherFormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  specializations: string;
  hourlyRate: string;
  bio: string;
  experience: string;
}

const INITIAL_FORM: TeacherFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  specializations: '',
  hourlyRate: '',
  bio: '',
  experience: '',
};

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
  wallet: [
    'M20 12V8H6a2 2 0 0 1 0-4h12v4',
    'M4 6v12c0 1.1.9 2 2 2h14v-4',
    'M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
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
  phone: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
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
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
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
 * HELPERS
 * ========================================================================== */

function formatTeacherName(teacher: Teacher): string {
  return fullName(teacher.user?.firstName, teacher.user?.lastName);
}

function getTeacherStatusBadge(isActive: boolean | undefined): {
  variant: 'success' | 'error';
  label: string;
} {
  return isActive === false
    ? { variant: 'error', label: 'enum.status.INACTIVE' }
    : { variant: 'success', label: 'enum.status.ACTIVE' };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
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

/** Deterministic hash so each name always gets the same gradient */
function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'], // blue → indigo
  ['#AF52DE', '#FF2D55'], // purple → pink
  ['#34C759', '#32ADE6'], // green → teal
  ['#FF9500', '#FF2D55'], // orange → pink
  ['#5856D6', '#AF52DE'], // indigo → purple
  ['#32ADE6', '#007AFF'], // teal → blue
  ['#FF2D55', '#FF9500'], // pink → orange
  ['#30D158', '#34C759'], // light green → green
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

/** Animated count-up number */
function CountUp({
  value, duration = 1.1, suffix = '',
}: { value: number; duration?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
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

/** Teacher avatar with gradient derived from name */
function TeacherAvatar({ name, size = 44 }: { name: string; size?: number }) {
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
      {/* Top specular */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
        }}
      />
      <span className="relative">{getInitials(name)}</span>
    </motion.div>
  );
}

/** Stats tile with premium icon + count-up */
function StatTile({
  label, value, icon, tone = 'blue',
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: 'blue' | 'green' | 'orange' | 'purple';
}) {
  const palette: Record<string, { fg: string; bg: string; glow: string }> = {
    blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)' },
    green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)' },
    orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)' },
    purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)' },
  };
  const c = palette[tone];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="flex items-center gap-3 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)' }}
    >
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.fg}22`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={16} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <div className="text-[20px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[#86868B] truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Shimmer skeleton bar */
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

/** Premium loading skeleton */
function TeachersSkeleton() {
  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[68px]" radius="1rem" />
        ))}
      </div>
      {/* Search bar */}
      <Shimmer className="h-14" radius="1rem" />
      {/* Table rows */}
      <div
        className="overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#00000008] dark:border-[#ffffff08] p-4 last:border-0">
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

/** Icon-only action button with tooltip-ish hover */
function RowAction({
  icon, label, tone, onClick, disabled,
}: {
  icon: string[];
  label: string;
  tone: 'edit' | 'delete';
  onClick: () => void;
  disabled?: boolean;
}) {
  const colors =
    tone === 'edit'
      ? { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', hoverBg: 'rgba(0,122,255,0.18)' }
      : { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)', hoverBg: 'rgba(255,59,48,0.18)' };

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
      className="flex h-8 w-8 items-center justify-center rounded-[10px] outline-none disabled:opacity-50"
      style={{
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.fg}22`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
      onMouseEnter={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = colors.hoverBg; }}
      onMouseLeave={(e: React.MouseEvent) => { (e.currentTarget as HTMLElement).style.background = colors.bg; }}
    >
      <Icon paths={icon} size={15} strokeWidth={2} />
    </motion.button>
  );
}

/* ============================================================================
 * PAGE
 * ========================================================================== */

export function TeachersPage() {
  const { t } = useI18n();
  usePageTitle(t('teachers.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  // Filter state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<TeacherFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof TeacherFormState, string>>
  >({});

  // Build query params
  const params = useMemo<TeacherFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch],
  );

  // Data fetching
  const teachers = useQuery({
    queryKey: queryKeys.teachers.list(params),
    queryFn: () => teachersApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = teachers.data as Paginated<Teacher> | undefined;
  const teacherList = useMemo(() => data?.items || [], [data]);

  // Derived stats
  const stats = useMemo(() => {
    const active = teacherList.filter((t) => t.user?.isActive !== false).length;
    const inactive = teacherList.length - active;
    const rates = teacherList
      .map((t) => Number(t.hourlyRate) || 0)
      .filter((n) => n > 0);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return { total: data?.total ?? teacherList.length, active, inactive, avgRate };
  }, [teacherList, data?.total]);

  // Create / update mutation
  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        specializations: form.specializations
          ? form.specializations.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        bio: form.bio.trim() || undefined,
        experience: form.experience ? parseInt(form.experience, 10) : undefined,
      };
      return editingId
        ? teachersApi.update(editingId, payload)
        : teachersApi.create(payload);
    },
    onSuccess: () => {
      push('success', editingId ? t('teachers.updated') : t('teachers.created'));
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      qc.invalidateQueries({ queryKey: queryKeys.teachers.selectors() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => teachersApi.remove(id),
    onSuccess: () => {
      push('success', t('teachers.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
      qc.invalidateQueries({ queryKey: queryKeys.teachers.selectors() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  // Validation
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof TeacherFormState, string>> = {};
    if (!form.firstName.trim()) errors.firstName = t('teachers.form.firstNameRequired');
    if (!form.lastName.trim()) errors.lastName = t('teachers.form.lastNameRequired');
    if (form.email && !validateEmail(form.email)) errors.email = t('common.emailInvalid');
    if (form.hourlyRate && parseFloat(form.hourlyRate) < 0)
      errors.hourlyRate = t('teachers.form.hourlyRateNumber');
    if (form.experience && parseInt(form.experience, 10) < 0)
      errors.experience = t('teachers.form.experienceNumber');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleFormChange = useCallback(
    (field: keyof TeacherFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
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
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleEdit = useCallback((teacher: Teacher) => {
    setEditingId(teacher.id);
    setForm({
      firstName: teacher.user?.firstName || '',
      lastName: teacher.user?.lastName || '',
      email: teacher.user?.email || '',
      phone: teacher.user?.phone || '',
      specializations: (teacher.specializations || []).join(', '),
      hourlyRate: teacher.hourlyRate != null ? String(teacher.hourlyRate) : '',
      bio: teacher.bio || '',
      experience: teacher.experience != null ? String(teacher.experience) : '',
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

  const { refetch: refetchTeachers } = teachers;
  const handleRetry = useCallback(() => { void refetchTeachers(); }, [refetchTeachers]);

  const hasActiveFilter = Boolean(search);

  /* ------------------------------------------------------------------------
     LOADING
  ------------------------------------------------------------------------ */
  if (teachers.isLoading && !data) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="page-container">
          <GlassPageHeader title={t('teachers.title')} subtitle={t('teachers.subtitle')} />
          <TeachersSkeleton />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------
     ERROR
  ------------------------------------------------------------------------ */
  if (teachers.isError) {
    return (
      <div style={{ display: 'contents' }}>
        <div className="page-container">
          <GlassPageHeader title={t('teachers.title')} subtitle={t('teachers.subtitle')} />
          <GlassCard className="p-8">
            <GlassErrorState
              title={t('teachers.loadError')}
              message={getErrorMessage(teachers.error as Error)}
              onRetry={handleRetry}
            />
          </GlassCard>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------
     MAIN
  ------------------------------------------------------------------------ */
  return (
    <div style={{ display: 'contents' }}>
      <div className="page-container">
        <GlassPageHeader
          title={t('teachers.title')}
          subtitle={t('teachers.subtitle')}
          actions={
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton type="button" variant="primary" onClick={handleOpenModal}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.userPlus} size={16} strokeWidth={2} />
                  {t('teachers.add')}
                </span>
              </GlassButton>
            </motion.div>
          }
        />

        {/* ============================================================
            STATS BAR — animated tiles
        ============================================================ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.smooth, delay: 0.05 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatTile label="Total" value={stats.total} icon={I.users} tone="blue" />
          <StatTile label={t('enum.status.ACTIVE')} value={stats.active} icon={I.checkCircle} tone="green" />
          <StatTile label={t('enum.status.INACTIVE')} value={stats.inactive} icon={I.pause} tone="orange" />
          <StatTile label="Avg Rate" value={formatCurrency(stats.avgRate)} icon={I.wallet} tone="purple" />
        </motion.div>

        {/* ============================================================
            FILTERS — magnetic search
        ============================================================ */}
        <GlassCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative sm:flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#86868B]">
                <Icon paths={I.search} size={18} />
              </span>
              <GlassInput
                placeholder={t('teachers.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('teachers.searchLabel')}
                type="search"
                style={{ paddingLeft: '2.75rem' }}
              />
              {search && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest text-[#86868B]"
                >
                  <CountUp value={stats.total} /> {t('teachers.countOther', { count: stats.total }).replace(/[0-9]+/, '').trim() || 'items'}
                </motion.span>
              )}
            </div>

            <div className="text-sm sm:ml-4 sm:shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {stats.total === 1
                ? t('teachers.countOne')
                : t('teachers.countOther', { count: stats.total })}
            </div>
          </div>
        </GlassCard>

        {/* ============================================================
            TABLE
        ============================================================ */}
        <GlassCard className="overflow-hidden">
          <AnimatePresence mode="wait">
            {teacherList.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={SPRING.smooth}
              >
                <GlassEmptyState
                  title={hasActiveFilter ? t('teachers.emptyFiltered') : t('teachers.empty')}
                  message={hasActiveFilter ? t('teachers.emptyFilteredHint') : t('teachers.emptyHint')}
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
                <div className="glass-table-wrap">
                  <GlassTable>
                    <GlassTHead>
                      <GlassTR>
                        <GlassTH>{t('common.name')}</GlassTH>
                        <GlassTH>{t('common.email')}</GlassTH>
                        <GlassTH>{t('teachers.col.specializations')}</GlassTH>
                        <GlassTH>{t('teachers.col.hourlyRate')}</GlassTH>
                        <GlassTH>{t('teachers.col.status')}</GlassTH>
                        <GlassTH>{t('common.actions')}</GlassTH>
                      </GlassTR>
                    </GlassTHead>
                    <GlassTBody>
                      {teacherList.map((teacher, idx) => {
                        const statusBadge = getTeacherStatusBadge(teacher.user?.isActive);
                        const specializations = teacher.specializations || [];
                        const name = formatTeacherName(teacher);

                        return (
                          <motion.tr
                            key={teacher.id}
                            variants={rowVariants}
                            className="group transition-colors hover:bg-[#007AFF]/[0.04]"
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              transitionDelay: `${idx * 12}ms`,
                            }}
                          >
                            {/* NAME + avatar */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className="flex items-center gap-3">
                                <TeacherAvatar name={name} />
                                <div className="min-w-0">
                                  <div className="truncate text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                    {name}
                                  </div>
                                  {teacher.experience != null && (
                                    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#86868B]">
                                      <Icon paths={I.award} size={11} strokeWidth={2} />
                                      {teacher.experience} {teacher.experience === 1 ? 'year' : 'years'}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* EMAIL */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {teacher.user?.email ? (
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#86868B]">
                                  <Icon paths={I.mail} size={13} strokeWidth={2} className="opacity-60" />
                                  <span className="truncate max-w-[180px]">{teacher.user.email}</span>
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            {/* SPECIALIZATIONS */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className="flex flex-wrap gap-1">
                                {specializations.slice(0, 3).map((s) => (
                                  <GlassBadge key={s} variant="primary">{s}</GlassBadge>
                                ))}
                                {specializations.length === 0 && (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                                {specializations.length > 3 && (
                                  <GlassBadge variant="muted">+{specializations.length - 3}</GlassBadge>
                                )}
                              </div>
                            </td>

                            {/* HOURLY RATE */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              {teacher.hourlyRate ? (
                                <span className="text-[13px] font-bold tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(teacher.hourlyRate)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>

                            {/* STATUS */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <GlassBadge variant={statusBadge.variant}>
                                {t(statusBadge.label)}
                              </GlassBadge>
                            </td>

                            {/* ACTIONS */}
                            <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <div className="flex justify-end gap-2">
                                <RowAction
                                  icon={I.edit}
                                  label={t('common.edit')}
                                  tone="edit"
                                  onClick={() => handleEdit(teacher)}
                                />
                                <RowAction
                                  icon={I.trash}
                                  label={t('common.delete')}
                                  tone="delete"
                                  onClick={() => handleDelete(teacher.id)}
                                />
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </GlassTBody>
                  </GlassTable>
                </div>

                <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <GlassPagination
                    page={page}
                    totalPages={data?.totalPages ?? 1}
                    onPageChange={setPage}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>

        {/* ============================================================
            MODAL
        ============================================================ */}
        <GlassModal
          open={modalOpen}
          onClose={handleCloseModal}
          title={editingId ? t('teachers.editTitle') : t('teachers.add')}
          wide
        >
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Header hint */}
            <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF22] bg-[#007AFF]/[0.06] px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
                <Icon paths={I.sparkles} size={18} strokeWidth={2} />
              </div>
              <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
                {editingId
                  ? 'Update the teacher profile. Changes are reflected immediately.'
                  : 'Fill in the details below. Only name is required.'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('teachers.form.firstName')} required error={formErrors.firstName}>
                <GlassInput
                  value={form.firstName}
                  onChange={handleFormChange('firstName')}
                  required
                  aria-invalid={Boolean(formErrors.firstName)}
                  aria-describedby={formErrors.firstName ? 'firstname-error' : undefined}
                  placeholder="John"
                  disabled={create.isPending}
                />
                {formErrors.firstName && (
                  <span id="firstname-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.firstName}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('teachers.form.lastName')} required error={formErrors.lastName}>
                <GlassInput
                  value={form.lastName}
                  onChange={handleFormChange('lastName')}
                  required
                  aria-invalid={Boolean(formErrors.lastName)}
                  aria-describedby={formErrors.lastName ? 'lastname-error' : undefined}
                  placeholder="Doe"
                  disabled={create.isPending}
                />
                {formErrors.lastName && (
                  <span id="lastname-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.lastName}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('common.email')} error={formErrors.email}>
                <GlassInput
                  type="email"
                  value={form.email}
                  onChange={handleFormChange('email')}
                  aria-invalid={Boolean(formErrors.email)}
                  aria-describedby={formErrors.email ? 'email-error' : undefined}
                  placeholder="john@example.com"
                  disabled={create.isPending}
                />
                {formErrors.email && (
                  <span id="email-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.email}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('teachers.form.phone')}>
                <GlassInput
                  type="tel"
                  value={form.phone}
                  onChange={handleFormChange('phone')}
                  placeholder="+998 90 123 4567"
                  disabled={create.isPending}
                />
              </GlassField>

              <GlassField label={t('teachers.form.specializations')} hint={t('teachers.form.specializationsHint')}>
                <GlassInput
                  value={form.specializations}
                  onChange={handleFormChange('specializations')}
                  placeholder={t('teachers.specializationsPlaceholder')}
                  disabled={create.isPending}
                />
              </GlassField>

              <GlassField label={t('teachers.form.hourlyRate')} error={formErrors.hourlyRate}>
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourlyRate}
                  onChange={handleFormChange('hourlyRate')}
                  aria-invalid={Boolean(formErrors.hourlyRate)}
                  aria-describedby={formErrors.hourlyRate ? 'rate-error' : undefined}
                  placeholder="25.00"
                  disabled={create.isPending}
                />
                {formErrors.hourlyRate && (
                  <span id="rate-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.hourlyRate}
                  </span>
                )}
              </GlassField>

              <GlassField label={t('teachers.form.experience')} error={formErrors.experience}>
                <GlassInput
                  type="number"
                  min="0"
                  value={form.experience}
                  onChange={handleFormChange('experience')}
                  aria-invalid={Boolean(formErrors.experience)}
                  aria-describedby={formErrors.experience ? 'experience-error' : undefined}
                  placeholder="5"
                  disabled={create.isPending}
                />
                {formErrors.experience && (
                  <span id="experience-error" className="mt-1 text-sm" style={{ color: 'var(--state-error)' }}>
                    {formErrors.experience}
                  </span>
                )}
              </GlassField>
            </div>

            <GlassField label={t('teachers.form.bio')}>
              <GlassTextArea
                rows={3}
                value={form.bio}
                onChange={handleFormChange('bio')}
                placeholder={t('teachers.bioPlaceholder')}
                disabled={create.isPending}
              />
            </GlassField>

            {/* Action row with premium styling */}
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
                  {create.isPending ? (
                    <span className="inline-flex items-center gap-2">
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving')}
                    </span>
                  ) : editingId ? (
                    t('teachers.update')
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                      {t('teachers.create')}
                    </span>
                  )}
                </GlassButton>
              </motion.div>
            </div>
          </form>
        </GlassModal>

        <ConfirmDialog
          open={deleteTarget !== null}
          onClose={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
          description={t('teachers.deleteConfirm')}
          loading={remove.isPending}
        />

        {toastNode}
      </div>
    </div>
  );
}
