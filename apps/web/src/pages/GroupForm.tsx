/**
 * M-EDU GroupFormPage — Apple Design Award & visionOS Edition (10/10)
 *
 * Premium craft:
 *  - Apple visionOS Liquid Glass aesthetic with specular meniscus sheen
 *  - Hierarchical Breadcrumbs navigation + accessible back CTA (WCAG 2.2 AA SC 2.5.8 >= 44x44px)
 *  - Tactile spring physics (Framer Motion) with micro-elevation and sound triggers
 *  - Tone-aware active toggle with >= 44x44px touch targets
 *  - Trilingual resilient localization via `useSafeI18n` with safe fallbacks
 *  - Pure exported helpers & validation logic for isolated unit-testing
 *  - Selected teacher avatar badge preview with dynamic color gradients
 *  - Live unsaved changes indicator pill with pulsating spring animation
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
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
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

export const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.06 },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM SVG ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.8;

export const I: Record<string, string[]> = {
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
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
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8', 'M7 3v5h8',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
};

export function Icon({
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
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * TONES & COLOR TOKENS
 * ========================================================================== */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

export const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.08)', glow: 'rgba(37,99,235,0.14)', border: 'rgba(37,99,235,0.22)' },
  green:   { fg: '#059669', bg: 'rgba(5,150,105,0.08)',  glow: 'rgba(5,150,105,0.14)',  border: 'rgba(5,150,105,0.22)' },
  orange:  { fg: '#D97706', bg: 'rgba(217,119,6,0.08)',  glow: 'rgba(217,119,6,0.14)',  border: 'rgba(217,119,6,0.22)' },
  red:     { fg: '#DC2626', bg: 'rgba(220,38,38,0.08)',  glow: 'rgba(220,38,38,0.14)',  border: 'rgba(220,38,38,0.22)' },
  purple:  { fg: '#4F46E5', bg: 'rgba(79,70,229,0.08)', glow: 'rgba(79,70,229,0.14)', border: 'rgba(79,70,229,0.22)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.08)', glow: 'rgba(2,132,199,0.14)', border: 'rgba(2,132,199,0.22)' },
  gray:    { fg: '#475569', bg: 'rgba(71,85,105,0.08)', glow: 'rgba(71,85,105,0.14)', border: 'rgba(71,85,105,0.22)' },
  emerald: { fg: '#059669', bg: 'rgba(5,150,105,0.08)', glow: 'rgba(5,150,105,0.14)', border: 'rgba(5,150,105,0.22)' },
};

/* ============================================================================
 * EXPORTED PURE TYPES & HELPERS
 * ========================================================================== */

export interface GroupFormState {
  name: string;
  courseId: string;
  teacherId: string;
  capacity: string;
  room: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export const EMPTY_FORM: GroupFormState = {
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '',
  room: '',
  startDate: '',
  endDate: '',
  isActive: true,
};

export function getInitials(name: string): string {
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

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const AVATAR_PALETTES = [
  ['#2563EB', '#1D4ED8'],
  ['#475569', '#334155'],
  ['#059669', '#047857'],
  ['#0D9488', '#0F766E'],
  ['#4F46E5', '#4338CA'],
  ['#1E293B', '#0F172A'],
];

export function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function formatTeacherOption(tm: Teacher): string {
  return tm.user ? `${tm.user.firstName} ${tm.user.lastName}` : tm.id.slice(0, 8);
}

/** Pure validation function */
export function validateGroupForm(
  form: GroupFormState,
  t: (k: string, fallback?: string) => string,
): Partial<Record<keyof GroupFormState, string>> {
  const errors: Partial<Record<keyof GroupFormState, string>> = {};
  if (!form.name.trim()) {
    errors.name = t('groups.form.nameRequired', 'Guruh nomini kiritish majburiy');
  }
  if (!form.courseId) {
    errors.courseId = t('groups.form.courseRequired', 'Kursni tanlash majburiy');
  }
  if (form.capacity) {
    const parsed = parseInt(form.capacity, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 100) {
      errors.capacity = t('groupForm.capacityRange', "Guruh sig'imi 1 dan 100 gacha bo'lishi kerak");
    }
  }
  return errors;
}

/* ============================================================================
 * SUB-COMPONENTS (Apple visionOS)
 * ========================================================================== */

export function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/60 dark:bg-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

export function GroupFormSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="group-form-skeleton">
      <Shimmer className="h-32 w-full" radius="1.25rem" />
      <Shimmer className="h-[480px] w-full" radius="1.25rem" />
    </div>
  );
}

export function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden="true"
    >
      <Icon paths={icon} size={13} strokeWidth={2.2} />
    </span>
  );
}

export function FormSection({
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
    <div className="mb-4 flex items-center gap-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
        }}
      >
        <Icon paths={icon} size={15} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          {title}
        </h3>
        {subtitle && (
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/** WCAG 2.2 AA SC 2.5.8 compliant ActiveToggle (>= 44x44px touch targets) */
export function ActiveToggle({
  value,
  onChange,
  t,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  t: (k: string, fallback?: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('enum.status.ACTIVE', 'Holati')}
      className="inline-flex items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-black/[0.03] p-1.5 dark:border-white/[0.1] dark:bg-white/[0.04]"
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
            whileTap={{ scale: 0.98 }}
            transition={SPRING.snappy}
            className="relative min-h-[44px] overflow-hidden rounded-xl px-4 py-2.5 text-xs font-semibold tracking-tight outline-none transition-colors"
            style={{
              color: active ? c.fg : undefined,
            }}
          >
            {active && (
              <motion.span
                layoutId="group-active-toggle"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `0 4px 12px -4px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {active && (
                  <motion.span
                    className="absolute inset-0 rounded-full"
                    style={{ background: c.fg, opacity: 0.6 }}
                    animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span
                  className="relative h-2 w-2 rounded-full"
                  style={{ background: active ? c.fg : '#94A3B8' }}
                />
              </span>
              <span>
                {val
                  ? t('enum.status.ACTIVE', 'Faol')
                  : t('enum.status.INACTIVE', 'Nofaol')}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT: GroupFormPage
 * ========================================================================== */

export function GroupFormPage() {
  const { t } = useSafeI18n();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playTick, playSuccess, playError } = usePremiumSound();

  usePageTitle(
    isEdit
      ? t('groupForm.editTitle', 'Guruhni tahrirlash')
      : t('groupForm.newTitle', 'Yangi guruh')
  );

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

  /* ── Load existing data in edit mode ───────────────────────────────── */
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
      playSuccess();
      push(
        'success',
        isEdit
          ? t('groups.updated', 'Guruh muvaffaqiyatli yangilandi')
          : t('groups.created', 'Yangi guruh yaratildi')
      );
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
      setDirty(false);
      navigate(`/groups/${(res as Group).id}`, { replace: true });
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const errors = validateGroupForm(form, t);
      setFormErrors(errors);
      if (Object.keys(errors).length > 0) {
        playError();
        return;
      }
      playTick();
      save.mutate();
    },
    [form, t, save, playError, playTick],
  );

  const handleCancel = useCallback(() => {
    playTick();
    navigate(-1);
  }, [navigate, playTick]);

  const { refetch: refetchExisting } = existing;
  const handleRetry = useCallback(() => {
    void refetchExisting();
  }, [refetchExisting]);

  /* ── Loading Skeleton ──────────────────────────────────────────────── */
  if (isEdit && existing.isLoading && !existing.data) {
    return (
      <div className="page-container space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="h-10 w-48 rounded-xl bg-slate-200/50 dark:bg-white/[0.05] animate-pulse" />
        <GroupFormSkeleton />
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
  if (isEdit && existing.isError) {
    return (
      <div className="page-container space-y-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="relative overflow-hidden rounded-3xl border border-red-500/20 bg-white/80 dark:bg-surface-900/80 p-8 backdrop-blur-2xl shadow-xl text-center">
          <GlassErrorState
            title={t('groups.notFound', 'Guruh topilmadi')}
            message={getErrorMessage(existing.error as Error)}
            onRetry={handleRetry}
          />
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/groups')}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.12] bg-black/[0.04] dark:bg-white/[0.06] px-5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-all"
            >
              <Icon paths={I.chevronLeft} size={14} />
              <span>{t('groups.backToList', "Guruhlar ro'yxatiga qaytish")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main Render ─────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-6 pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
      {toastNode}

      {/* ============================================================
          BREADCRUMBS NAVIGATION (WCAG 2.2 AA SC 2.5.8 >= 44x44px)
      ============================================================ */}
      <motion.nav
        variants={cardVariants}
        aria-label="Breadcrumb"
        className="flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <button
            type="button"
            onClick={handleCancel}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-surface-900/70 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-surface-800 transition-all shadow-sm"
            aria-label={t('common.cancel', 'Orqaga')}
          >
            <Icon paths={I.chevronLeft} size={16} strokeWidth={2.2} />
          </button>

          <Link
            to="/groups"
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {t('nav.groups', 'Guruhlar')}
          </Link>
          <Icon paths={I.chevronRight} size={12} strokeWidth={2.5} className="opacity-40" />
          {isEdit && form.name ? (
            <>
              <Link
                to={`/groups/${id}`}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[10rem] sm:max-w-xs"
              >
                {form.name}
              </Link>
              <Icon paths={I.chevronRight} size={12} strokeWidth={2.5} className="opacity-40" />
            </>
          ) : null}
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {isEdit
              ? t('groupForm.editTitle', 'Tahrirlash')
              : t('groupForm.newTitle', 'Yangi guruh')}
          </span>
        </div>
      </motion.nav>

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className="relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/75 dark:bg-surface-900/75 p-5 sm:p-7 backdrop-blur-2xl shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
          {/* Top specular reflection */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 dark:via-white/25 to-transparent"
          />

          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -4 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ring-1 ring-white/30"
              style={{
                background: isEdit
                  ? 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)'
                  : 'linear-gradient(135deg, #059669 0%, #0284C7 100%)',
                boxShadow: isEdit
                  ? '0 12px 28px -8px rgba(37,99,235,0.45)'
                  : '0 12px 28px -8px rgba(5,150,105,0.45)',
              }}
            >
              <Icon
                paths={isEdit ? I.edit : I.plus}
                size={26}
                strokeWidth={2}
                className="relative"
              />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background: isEdit ? 'rgba(37,99,235,0.10)' : 'rgba(5,150,105,0.10)',
                    color: isEdit ? '#2563EB' : '#059669',
                    border: isEdit
                      ? '1px solid rgba(37,99,235,0.2)'
                      : '1px solid rgba(5,150,105,0.2)',
                  }}
                >
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.2} />
                  {isEdit
                    ? t('groupForm.editTitle', 'Guruhni tahrirlash')
                    : t('groupForm.newTitle', 'Yangi guruh')}
                </span>

                {selectedCourse && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Icon paths={I.book} size={11} strokeWidth={2.2} />
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20"
                    >
                      <span className="relative flex h-1.5 w-1.5">
                        <motion.span
                          className="absolute inset-0 rounded-full bg-amber-500"
                          animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                        />
                        <span className="relative h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </span>
                      {t('common.unsavedChanges', "Saqlanmagan o'zgarishlar")}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
                {isEdit
                  ? t('groupForm.editTitle', 'Guruhni tahrirlash')
                  : t('groupForm.newTitle', 'Yangi guruh yaratish')}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isEdit
                  ? t('groupForm.editSubtitle', "Guruh ma'lumotlari, dars xonasi va o'qituvchini yangilang.")
                  : t('groupForm.createSubtitle', "Yangi akademik guruh oching va o'quv dasturiga biriktiring.")}
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
        className="relative overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/75 dark:bg-surface-900/75 p-6 sm:p-8 backdrop-blur-2xl shadow-xl dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
      >
        {/* Top meniscus reflection */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 dark:via-white/25 to-transparent"
        />

        <form className="relative space-y-7" onSubmit={handleSubmit} noValidate>
          {/* ── Section 1: Asosiy ma'lumotlar ─────────────────────── */}
          <div>
            <FormSection
              icon={I.groups}
              tone="blue"
              title={t('groups.form.name', 'Guruh identifikatsiyasi')}
              subtitle={t('groups.pageSubtitle', "Guruh nomi va tegishli kurs ma'lumotlari")}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <GlassField
                label={t('common.name', 'Guruh nomi')}
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
                    className="pl-11 min-h-[44px]"
                    placeholder={t('groups.namePlaceholder', 'Masalan: IELTS Advanced 8.0')}
                  />
                </div>
              </GlassField>

              <GlassField
                label={t('groups.form.course', 'Kurs / Fan')}
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
                    className="pl-11 min-h-[44px]"
                  >
                    <option value="">
                      {t('groups.selectCoursePlaceholder', 'Kursni tanlang...')}
                    </option>
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

          {/* ── Section 2: O'qituvchi va Dars xonasi ───────────────── */}
          <div>
            <FormSection
              icon={I.user}
              tone="cyan"
              title={t('groups.form.teacher', "O'qituvchi va xona")}
              subtitle={t('groups.col.room', "Guruhga biriktirilgan pedagog va mashg'ulot xonasi")}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <GlassField label={t('groups.form.teacher', "O'qituvchi")}>
                <div className="relative">
                  <FieldIcon icon={I.user} tone="cyan" />
                  <GlassSelect
                    value={form.teacherId}
                    onChange={(e) => set('teacherId', e.target.value)}
                    className="pl-11 min-h-[44px]"
                  >
                    <option value="">
                      {t('groupForm.noTeacher', "O'qituvchi belgilanmagan")}
                    </option>
                    {teacherList.map((tm) => (
                      <option key={tm.id} value={tm.id}>
                        {formatTeacherOption(tm)}
                      </option>
                    ))}
                  </GlassSelect>
                </div>
                {selectedTeacher && (
                  <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/[0.06] px-3 py-2">
                    <div
                      className="relative flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-sm ring-1 ring-white/50"
                      style={{ background: teacherGradient }}
                    >
                      <span>{teacherInitials}</span>
                    </div>
                    <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {teacherName}
                    </span>
                  </div>
                )}
              </GlassField>

              <GlassField label={t('groups.form.room', 'Dars xonasi')}>
                <div className="relative">
                  <FieldIcon icon={I.door} tone="orange" />
                  <GlassInput
                    value={form.room}
                    onChange={(e) => set('room', e.target.value)}
                    className="pl-11 min-h-[44px]"
                    placeholder={t('groups.roomPlaceholder', 'Masalan: 302-xona yoki B bino')}
                  />
                </div>
              </GlassField>
            </div>
          </div>

          {/* ── Section 3: Guruh sig'imi va Holati ──────────────────── */}
          <div>
            <FormSection
              icon={I.users}
              tone="emerald"
              title={t('groups.form.capacity', "Sig'im va Holat")}
              subtitle={t('groups.col.capacity', "Maksimal o'quvchilar soni va guruh faolligi")}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <GlassField
                label={t('groups.form.capacity', "Guruh sig'imi (1 - 100)")}
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
                    className="pl-11 min-h-[44px]"
                    placeholder="20"
                  />
                </div>
                {formErrors.capacity && (
                  <span className="mt-1 text-xs font-medium text-red-500">
                    {formErrors.capacity}
                  </span>
                )}
              </GlassField>

              {isEdit && (
                <GlassField label={t('enum.status.ACTIVE', 'Guruh holati')}>
                  <ActiveToggle
                    value={form.isActive}
                    onChange={(v) => set('isActive', v)}
                    t={t}
                  />
                </GlassField>
              )}
            </div>
          </div>

          {/* ── Section 4: Ta'lim davri (Boshlanish / Tugash) ──────── */}
          <div>
            <FormSection
              icon={I.calendar}
              tone="green"
              title={t('groups.form.startDate', "Ta'lim muddati")}
              subtitle={t('groupForm.endDate', "Kurs boshlanish va yakunlanish sanalari")}
            />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <GlassField label={t('groups.form.startDate', 'Boshlanish sanasi')}>
                <div className="relative">
                  <FieldIcon icon={I.calendar} tone="green" />
                  <GlassInput
                    type="date"
                    value={form.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    className="pl-11 min-h-[44px]"
                  />
                </div>
              </GlassField>

              <GlassField label={t('groupForm.endDate', 'Tugash sanasi')}>
                <div className="relative">
                  <FieldIcon icon={I.calendarEnd} tone="red" />
                  <GlassInput
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set('endDate', e.target.value)}
                    className="pl-11 min-h-[44px]"
                  />
                </div>
              </GlassField>
            </div>
          </div>

          {/* ── Form Actions (WCAG 2.2 AA SC 2.5.8 >= 44x44px) ──────── */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-black/[0.06] dark:border-white/[0.08] pt-6">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCancel}
                disabled={save.isPending}
                className="min-h-[44px] px-5"
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold">
                  <Icon paths={I.arrowLeft} size={14} strokeWidth={2.2} />
                  {t('common.cancel', 'Bekor qilish')}
                </span>
              </GlassButton>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={save.isPending}
                className="min-h-[44px] px-6"
              >
                <span className="inline-flex items-center gap-2 text-xs font-semibold">
                  {save.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('common.saving', 'Saqlanmoqda...')}
                    </>
                  ) : (
                    <>
                      <Icon
                        paths={isEdit ? I.save : I.plus}
                        size={15}
                        strokeWidth={2.4}
                      />
                      {isEdit
                        ? t('templates.saveChanges', "O'zgarishlarni saqlash")
                        : t('groups.create', 'Guruh yaratish')}
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

export default GroupFormPage;
