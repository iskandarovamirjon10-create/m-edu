/**
 * M-EDU GroupFormPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient group tile + create/edit mode badge + live chips
 *  - Premium 2-column form with squircle leading icons per field
 *  - Info strip: teacher mini avatar, course chip, capacity bar
 *  - Draft-unsaved pill (visual feedback)
 *  - Premium create/edit toggle with tone-aware switch
 *  - Shimmer skeleton (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { groupsApi, coursesApi, teachersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassButton,
  useToasts,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
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
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
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
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  calendarEnd: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
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
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8', 'M7 3v5h8',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
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
 * TYPES + CONSTANTS
 * ========================================================================== */

interface GroupFormState {
  name: string;
  courseId: string;
  teacherId: string;
  capacity: string;
  room: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

const EMPTY_FORM: GroupFormState = {
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '',
  room: '',
  startDate: '',
  endDate: '',
  isActive: true,
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

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
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function formatTeacherOption(tm: Teacher): string {
  return tm.user ? `${tm.user.firstName} ${tm.user.lastName}` : tm.id.slice(0, 8);
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

function GroupFormSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <Shimmer className="h-[520px] w-full" radius="1.75rem" />
    </div>
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

/** Section header for form groups */
function FormSection({
  icon,
  tone = 'blue',
  title,
  subtitle,
}: {
  icon: string[];
  tone?: Tone;
  title: string;
  subtitle?: string;
}) {
  const c = TONES[tone];
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={14} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1D1D1F] dark:text-[#F5F5F7]">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[10.5px] font-medium text-[#86868B]">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/** Tone-aware active toggle (custom, no raw checkbox) */
function ActiveToggle({
  value,
  onChange,
  t,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  t: (k: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('enum.status.ACTIVE')}
      className="inline-flex items-center gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      {[true, false].map((val) => {
        const active = value === val;
        const tone: Tone = val ? 'emerald' : 'gray';
        const c = TONES[tone];
        return (
          <motion.button
            key={String(val)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(val)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="relative overflow-hidden rounded-xl px-3.5 py-1.5 text-[12px] font-bold tracking-tight outline-none transition-colors"
            style={{
              color: active ? c.fg : '#86868B',
            }}
          >
            {active && (
              <motion.span
                layoutId="active-toggle"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {active && (
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    style={{ background: c.fg, opacity: 0.6 }}
                    animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span
                  className="relative h-1.5 w-1.5 rounded-full"
                  style={{ background: active ? c.fg : '#B0B0B5' }}
                />
              </span>
              {val ? t('enum.status.ACTIVE') : t('enum.status.INACTIVE')}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function GroupFormPage() {
  const { t } = useI18n();
  usePageTitle(t('enum.badge.GROUP'));
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [form, setForm] = useState<GroupFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof GroupFormState, string>>
  >({});
  const [dirty, setDirty] = useState(false);
  const initializedRef = useRef(false);

  /* ── Queries ──────────────────────────────────────────────────────── */
  const existing = useQuery({
    queryKey: queryKeys.groups.detail(id || ''),
    queryFn: () => groupsApi.get(id!),
    enabled: isEdit,
    placeholderData: (previousData) => previousData,
  });

  const courses = useQuery({
    queryKey: queryKeys.courses.selectors(),
    queryFn: () => coursesApi.list({ limit: 100, isActive: true }),
    staleTime: 5 * 60 * 1000,
  });

  const teachers = useQuery({
    queryKey: queryKeys.teachers.selectors(),
    queryFn: () => teachersApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  /* ── Load existing group data when in edit mode ───────────────────── */
  useEffect(() => {
    if (isEdit && existing.data && !initializedRef.current) {
      const group = existing.data as Group;
      setForm({
        name: group.name || '',
        courseId: group.courseId || '',
        teacherId: group.teacherId || '',
        capacity: group.capacity != null ? String(group.capacity) : '',
        room: group.room || '',
        startDate: group.startDate ? group.startDate.slice(0, 10) : '',
        endDate: group.endDate ? group.endDate.slice(0, 10) : '',
        isActive: group.isActive,
      });
      initializedRef.current = true;
    }
  }, [isEdit, existing.data]);

  const courseList = useMemo(
    () => (courses.data as Paginated<Course> | undefined)?.items || [],
    [courses.data],
  );
  const teacherList = useMemo(
    () => (teachers.data as Paginated<Teacher> | undefined)?.items || [],
    [teachers.data],
  );

  /* ── Derived: selected teacher & course preview ───────────────────── */
  const selectedTeacher = useMemo(
    () => teacherList.find((tm) => tm.id === form.teacherId) || null,
    [teacherList, form.teacherId],
  );
  const selectedCourse = useMemo(
    () => courseList.find((c) => c.id === form.courseId) || null,
    [courseList, form.courseId],
  );

  const teacherName = selectedTeacher?.user
    ? `${selectedTeacher.user.firstName} ${selectedTeacher.user.lastName}`
    : '—';
  const teacherInitials = getInitials(teacherName);
  const teacherGradient = avatarGradient(teacherName);

  /* ── Setter ───────────────────────────────────────────────────────── */
  const set = useCallback(
    <K extends keyof GroupFormState>(key: K, value: GroupFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
      setDirty(true);
    },
    [],
  );

  /* ── Validators ───────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('groups.form.nameRequired');
    if (!form.courseId) errors.courseId = t('groups.form.courseRequired');
    if (
      form.capacity &&
      (parseInt(form.capacity, 10) < 1 || parseInt(form.capacity, 10) > 100)
    ) {
      errors.capacity = t('groupForm.capacityRange');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  /* ── Save mutation ────────────────────────────────────────────────── */
  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        courseId: form.courseId,
        teacherId: form.teacherId || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        room: form.room.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        isActive: form.isActive,
      };
      return isEdit ? groupsApi.update(id!, payload) : groupsApi.create(payload);
    },
    onSuccess: (res) => {
      push('success', isEdit ? t('groups.updated') : t('groups.created'));
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      setDirty(false);
      navigate(`/groups/${(res as Group).id}`, { replace: true });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const { refetch: refetchExisting } = existing;
  const handleRetry = useCallback(() => {
    void refetchExisting();
  }, [refetchExisting]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (isEdit && existing.isLoading && !existing.data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <GroupFormSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (isEdit && existing.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('groups.notFound')}
            message={getErrorMessage(existing.error as Error)}
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
            {/* Gradient group tile */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: isEdit
                  ? 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)'
                  : 'linear-gradient(135deg, #34C759 0%, #32ADE6 100%)',
                boxShadow: isEdit
                  ? '0 12px 28px -10px rgba(0,122,255,0.55), inset 0 2px 0 rgba(255,255,255,0.35)'
                  : '0 12px 28px -10px rgba(52,199,89,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
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
              <Icon
                paths={isEdit ? I.edit : I.plus}
                size={28}
                strokeWidth={2}
                className="relative"
              />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: isEdit
                      ? 'rgba(0,122,255,0.10)'
                      : 'rgba(52,199,89,0.10)',
                    color: isEdit ? '#007AFF' : '#34C759',
                  }}
                >
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {isEdit ? t('groupForm.editTitle') : t('groupForm.newTitle')}
                </span>
                {selectedCourse && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#AF52DE]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#AF52DE]">
                    <Icon paths={I.book} size={11} strokeWidth={2.5} />
                    {selectedCourse.name}
                  </span>
                )}
                <AnimatePresence>
                  {dirty && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={SPRING.snappy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9500]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF9500]"
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#FF9500]"
                          animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-[#FF9500]" />
                      </span>
                      {t('common.unsavedChanges') ?? 'Unsaved'}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {isEdit ? t('groupForm.editTitle') : t('groupForm.newTitle')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {isEdit
                  ? t('groupForm.editSubtitle')
                  : t('groupForm.createSubtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          MAIN FORM CARD
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-6"
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

        <form className="relative space-y-6" onSubmit={handleSubmit} noValidate>
          {/* ── Identity section ─────────────────────────────────────── */}
          <div>
            <FormSection
              icon={I.groups}
              tone="blue"
              title={t('groups.form.name')}
              subtitle={t('groups.pageSubtitle')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('common.name')}
                required
                error={formErrors.name}
              >
                <div className="relative">
                  <FieldIcon icon={I.groups} tone="blue" />
                  <GlassInput
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    required
                    aria-invalid={Boolean(formErrors.name)}
                    className="pl-11"
                    placeholder={t('groups.namePlaceholder')}
                  />
                </div>
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
                    onChange={(e) => set('courseId', e.target.value)}
                    required
                    aria-invalid={Boolean(formErrors.courseId)}
                    className="pl-11"
                  >
                    <option value="">{t('groups.selectCoursePlaceholder')}</option>
                    {courseList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </GlassSelect>
                </div>
              </GlassField>
            </div>
          </div>

          {/* ── Teacher & room section ───────────────────────────────── */}
          <div>
            <FormSection
              icon={I.user}
              tone="cyan"
              title={t('groups.form.teacher')}
              subtitle={t('groups.col.room')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('groups.form.teacher')}>
                <div className="relative">
                  <FieldIcon icon={I.user} tone="cyan" />
                  <GlassSelect
                    value={form.teacherId}
                    onChange={(e) => set('teacherId', e.target.value)}
                    className="pl-11"
                  >
                    <option value="">{t('groupForm.noTeacher')}</option>
                    {teacherList.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {formatTeacherOption(tm)}
                      </option>
                    ))}
                  </GlassSelect>
                </div>
                {selectedTeacher && (
                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#32ADE633] bg-[#32ADE6]/[0.06] px-2.5 py-1.5">
                    <div
                      className="relative flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{
                        background: teacherGradient,
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                      }}
                    >
                      <span className="relative">{teacherInitials}</span>
                    </div>
                    <span className="truncate text-[11.5px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {teacherName}
                    </span>
                  </div>
                )}
              </GlassField>

              <GlassField label={t('groups.form.room')}>
                <div className="relative">
                  <FieldIcon icon={I.door} tone="orange" />
                  <GlassInput
                    value={form.room}
                    onChange={(e) => set('room', e.target.value)}
                    className="pl-11"
                    placeholder={t('groups.roomPlaceholder')}
                  />
                </div>
              </GlassField>
            </div>
          </div>

          {/* ── Capacity section ─────────────────────────────────────── */}
          <div>
            <FormSection
              icon={I.users}
              tone="emerald"
              title={t('groups.form.capacity')}
              subtitle={t('groups.col.capacity')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField
                label={t('groups.form.capacity')}
                error={formErrors.capacity}
              >
                <div className="relative">
                  <FieldIcon icon={I.users} tone="emerald" />
                  <GlassInput
                    type="number"
                    min={1}
                    max={100}
                    value={form.capacity}
                    onChange={(e) => set('capacity', e.target.value)}
                    aria-invalid={Boolean(formErrors.capacity)}
                    className="pl-11"
                    placeholder="20"
                  />
                </div>
                {formErrors.capacity && (
                  <span
                    className="mt-1 text-sm"
                    style={{ color: 'var(--state-error)' }}
                  >
                    {formErrors.capacity}
                  </span>
                )}
              </GlassField>
              {isEdit && (
                <GlassField label={t('enum.status.ACTIVE')}>
                  <ActiveToggle
                    value={form.isActive}
                    onChange={(v) => set('isActive', v)}
                    t={t}
                  />
                </GlassField>
              )}
            </div>
          </div>

          {/* ── Schedule section ─────────────────────────────────────── */}
          <div>
            <FormSection
              icon={I.calendar}
              tone="green"
              title={t('groups.form.startDate')}
              subtitle={t('groupForm.endDate')}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassField label={t('groups.form.startDate')}>
                <div className="relative">
                  <FieldIcon icon={I.calendar} tone="green" />
                  <GlassInput
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    className="pl-11"
                  />
                </div>
              </GlassField>
              <GlassField label={t('groupForm.endDate')}>
                <div className="relative">
                  <FieldIcon icon={I.calendarEnd} tone="red" />
                  <GlassInput
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                    className="pl-11"
                  />
                </div>
              </GlassField>
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-5 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCancel}
                disabled={save.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.arrowLeft} size={14} strokeWidth={2.2} />
                  {t('common.cancel')}
                </span>
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={save.isPending}>
                <span className="inline-flex items-center gap-2">
                  {save.isPending ? (
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
                      <Icon
                        paths={isEdit ? I.save : I.plus}
                        size={14}
                        strokeWidth={2.4}
                      />
                      {isEdit
                        ? t('templates.saveChanges')
                        : t('groups.create')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}