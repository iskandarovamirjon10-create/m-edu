/**
 * M-EDU StudentFormPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Live avatar preview (name → deterministic gradient, updates instantly)
 *  - Section completion indicators with checkmarks
 *  - Progress bar at top showing overall completion %
 *  - Sticky action bar (always visible, backdrop blur)
 *  - Cmd+S / Ctrl+S keyboard shortcut for save
 *  - Custom SVG icons in SF Symbols proportions (no lucide)
 *  - Shimmer skeleton for edit-mode loading
 *  - Section cards with 3D squircle icon headers
 *  - Spring entrance animations
 */

import {
  useState, useEffect, useCallback, useMemo, useRef,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { studentsApi } from '@/lib/api';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassField,
  GlassInput,
  GlassSelect,
  GlassTextArea,
  useToasts,
  GlassButton,
  GlassCard,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Student } from '@/lib/types';
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

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface StudentFormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  notes: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
}

const EMPTY_FORM: StudentFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  notes: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
};

const GENDERS = [
  { value: 'MALE', label: 'enum.gender.MALE' },
  { value: 'FEMALE', label: 'enum.gender.FEMALE' },
  { value: 'OTHER', label: 'enum.gender.OTHER' },
];

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/* ============================================================================
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  user: [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  userCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4',
  ],
  phone: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  mapPin: [
    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
    'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 13h6', 'M9 17h4',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
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

function getInitials(first: string, last: string): string {
  const a = first?.trim().charAt(0) || '';
  const b = last?.trim().charAt(0) || '';
  return (a + b).toUpperCase() || '—';
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

/** Live avatar preview — updates as user types */
function AvatarPreview({
  firstName, lastName, size = 96,
}: { firstName: string; lastName: string; size?: number }) {
  const fullName = `${firstName} ${lastName}`.trim() || 'New Student';
  const initials = getInitials(firstName, lastName);
  const hasName = Boolean(firstName || lastName);

  return (
    <div className="relative flex flex-col items-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.smooth}
        className="relative flex items-center justify-center rounded-full font-bold text-white ring-4 ring-white/60 dark:ring-black/40"
        style={{
          width: size,
          height: size,
          background: avatarGradient(fullName),
          fontSize: size * 0.32,
          letterSpacing: '0.02em',
          boxShadow:
            '0 12px 32px -8px rgba(0,0,0,0.3), ' +
            'inset 0 2px 0 rgba(255,255,255,0.4)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
          }}
        />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={initials}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.8 }}
            transition={{ duration: 0.25, ease: EASE_APPLE }}
            className="relative"
          >
            {initials}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      <motion.p
        key={fullName}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_APPLE }}
        className="mt-3 max-w-[200px] truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]"
      >
        {fullName}
      </motion.p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
        {hasName ? 'Preview' : 'Awaiting name'}
      </p>
    </div>
  );
}

/** Section wrapper with icon header + completion indicator */
function FormSection({
  title, icon, tone = 'blue', children, completed = false, badge,
}: {
  title: string;
  icon: string[];
  tone?: 'blue' | 'green' | 'orange' | 'purple';
  children: React.ReactNode;
  completed?: boolean;
  badge?: React.ReactNode;
}) {
  const { t } = useI18n();
  const palette: Record<string, { fg: string; bg: string; glow: string }> = {
    blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)' },
    green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)' },
    orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)' },
    purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)' },
  };
  const c = palette[tone];

  return (
    <GlassCard className="overflow-hidden p-0" interactive>
      {/* Section header */}
      <div
        className="flex items-center gap-3 border-b border-[#00000008] px-6 py-4 dark:border-[#ffffff08]"
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
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
          />
          <Icon paths={icon} size={16} strokeWidth={2} className="relative" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {title}
          </h2>
        </div>

        {badge}

        {/* Completion checkmark */}
        <AnimatePresence>
          {completed && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={SPRING.snappy}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#34C759]/15 text-[#34C759]"
              aria-label={t('common.sectionComplete')}
            >
              <Icon paths={I.check} size={14} strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-6">{children}</div>
    </GlassCard>
  );
}

/** Overall completion progress bar */
function ProgressBar({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' }) {
  const color = tone === 'green' ? '#34C759' : '#007AFF';
  const glow = tone === 'green' ? 'rgba(52,199,89,0.4)' : 'rgba(0,122,255,0.4)';

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0000000A] dark:bg-[#ffffff10]">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: EASE_APPLE }}
        className="h-full rounded-full"
        style={{
          background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, white))`,
          boxShadow: `0 0 10px ${glow}`,
        }}
      />
    </div>
  );
}

/** Premium password strength indicator */
function PasswordStrength({ value }: { value: string }) {
  const { t } = useI18n();
  if (!value) return null;

  const checks = {
    length: value.length >= 8,
    hasNumber: /\d/.test(value),
    hasLetter: /[a-zA-Z]/.test(value),
    hasSpecial: /[^a-zA-Z0-9]/.test(value),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const tone =
    score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';

  const palette: Record<string, { fg: string; label: string; bars: number }> = {
    weak:   { fg: '#FF3B30', label: t('studentForm.strength.weak'),   bars: 1 },
    fair:   { fg: '#FF9500', label: t('studentForm.strength.fair'),   bars: 2 },
    good:   { fg: '#FFCC00', label: t('studentForm.strength.good'),   bars: 3 },
    strong: { fg: '#34C759', label: t('studentForm.strength.strong'), bars: 4 },
  };
  const p = palette[tone];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: EASE_APPLE }}
      className="mt-2 space-y-1.5"
    >
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            initial={false}
            animate={{
              backgroundColor: i <= p.bars ? p.fg : 'var(--border-subtle)',
              scale: i <= p.bars ? 1 : 0.9,
            }}
            transition={{ duration: 0.25, ease: EASE_APPLE, delay: i * 0.04 }}
            className="h-1 flex-1 rounded-full"
            style={{ boxShadow: i <= p.bars ? `0 0 8px ${p.fg}66` : 'none' }}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold uppercase tracking-[0.14em]" style={{ color: p.fg }}>
          {p.label}
        </span>
        <span className="font-medium text-[#86868B]">
          {score}/4 {score === 4 ? t('studentForm.strength.great') : t('studentForm.strength.hint')}
        </span>
      </div>
    </motion.div>
  );
}

/** Shimmer skeleton */
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

function FormSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-32 w-full" radius="1.5rem" />
      <Shimmer className="h-72 w-full" radius="1.5rem" />
      <Shimmer className="h-40 w-full" radius="1.5rem" />
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function StudentFormPage() {
  const { t } = useI18n();
  usePageTitle(t('enum.badge.STUDENT'));
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);

  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof StudentFormState, string>>
  >({});

  const existing = useQuery({
    queryKey: queryKeys.students.detail(id || ''),
    queryFn: () => studentsApi.get(id!),
    enabled: isEdit,
    placeholderData: (previousData) => previousData,
  });

  /* ---------------------------------------------------------------
     Load existing data (edit mode)
  --------------------------------------------------------------- */
  useEffect(() => {
    if (isEdit && existing.data) {
      const student = existing.data as Student;
      setForm({
        firstName: student.user?.firstName || '',
        lastName: student.user?.lastName || '',
        email: student.user?.email || '',
        password: '',
        phone: student.user?.phone || '',
        dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : '',
        gender: student.gender || '',
        address: student.address || '',
        notes: student.notes || '',
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        parentEmail: student.parentEmail || '',
      });
    }
  }, [isEdit, existing.data]);

  /* ---------------------------------------------------------------
     Setters
  --------------------------------------------------------------- */
  const set = useCallback(
    <K extends keyof StudentFormState>(key: K, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  /* ---------------------------------------------------------------
     Validation
  --------------------------------------------------------------- */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof StudentFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = t('teachers.form.firstNameRequired');
    }
    if (!form.lastName.trim()) {
      errors.lastName = t('teachers.form.lastNameRequired');
    }
    if (!isEdit && form.email && !validateEmail(form.email)) {
      errors.email = t('common.emailInvalid');
    }
    if (form.parentEmail && !validateEmail(form.parentEmail)) {
      errors.parentEmail = t('common.emailInvalid');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, isEdit, t]);

  /* ---------------------------------------------------------------
     Save mutation
  --------------------------------------------------------------- */
  const save = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        parentName: form.parentName.trim() || undefined,
        parentPhone: form.parentPhone.trim() || undefined,
        parentEmail: form.parentEmail.trim() || undefined,
      };

      if (!isEdit) {
        payload.email = form.email.trim() || undefined;
        payload.password = form.password || undefined;
        return studentsApi.create(payload);
      }
      return studentsApi.update(id!, payload);
    },
    onSuccess: (res) => {
      push('success', isEdit ? t('studentForm.updated') : t('studentForm.created'));
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      qc.invalidateQueries({ queryKey: queryKeys.students.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.students.details() });
      navigate(`/students/${(res as Student).id}`, { replace: true });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      save.mutate();
    },
    [validateForm, save],
  );

  const handleCancel = useCallback(() => navigate(-1), [navigate]);

  /* ---------------------------------------------------------------
     Keyboard shortcut: Cmd+S / Ctrl+S
  --------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!save.isPending && validateForm()) save.mutate();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [save, validateForm]);

  const { refetch: refetchExisting } = existing;
  const handleRetry = useCallback(() => { void refetchExisting(); }, [refetchExisting]);

  /* ---------------------------------------------------------------
     Derived: completion %
  --------------------------------------------------------------- */
  const completion = useMemo(() => {
    const checks = [
      Boolean(form.firstName.trim()),
      Boolean(form.lastName.trim()),
      Boolean(form.phone.trim()),
      Boolean(form.dateOfBirth),
      Boolean(form.gender),
      Boolean(form.address.trim()),
      Boolean(form.notes.trim()),
      Boolean(form.parentName.trim()),
      Boolean(form.parentPhone.trim()),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const sections = useMemo(() => {
    const personal = Boolean(form.firstName.trim() && form.lastName.trim() && form.dateOfBirth && form.gender);
    const contact = Boolean(form.phone.trim() || form.address.trim());
    const parent = Boolean(form.parentName.trim() && form.parentPhone.trim());
    return { personal, contact, parent };
  }, [form]);

  const savedTone: 'blue' | 'green' = completion === 100 ? 'green' : 'blue';

  /* ---------------------------------------------------------------
     LOADING
  --------------------------------------------------------------- */
  if (isEdit && existing.isLoading && !existing.data) {
    return (
      <>
        <div className="page-container mx-auto max-w-3xl space-y-5">
          <GlassPageHeader
            title={t('studentForm.editTitle')}
            subtitle={t('studentForm.subtitle')}
          />
          <FormSkeleton />
        </div>
      </>
    );
  }

  /* ---------------------------------------------------------------
     ERROR
  --------------------------------------------------------------- */
  if (isEdit && existing.isError) {
    return (
      <>
        <div className="page-container mx-auto max-w-3xl space-y-5">
          <GlassPageHeader
            title={t('studentForm.editTitle')}
            subtitle={t('studentForm.subtitle')}
          />
          <div className="glass-card p-8">
            <GlassErrorState
              title={t('studentForm.loadFailed')}
              message={getErrorMessage(existing.error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </>
    );
  }

  /* ---------------------------------------------------------------
     MAIN
  --------------------------------------------------------------- */
  return (
    <>
      <div className="page-container mx-auto max-w-3xl space-y-5 pb-36 sm:pb-28">
        <GlassPageHeader
          title={isEdit ? t('studentForm.editTitle') : t('studentForm.addTitle')}
          subtitle={t('studentForm.subtitle')}
          actions={
            <div className="hidden items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B] sm:flex">
              <kbd
                className="inline-flex h-6 items-center rounded-md border border-[#00000015] bg-[#00000005] px-2 font-sans text-[10px] font-bold dark:border-[#ffffff20] dark:bg-[#ffffff10]"
              >
                ⌘S
              </kbd>
              to save
            </div>
          }
        />

        {/* ============================================================
            COMPLETION CARD with avatar preview
        ============================================================ */}
        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
          <GlassCard className="overflow-hidden p-6">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
              <AvatarPreview firstName={form.firstName} lastName={form.lastName} />

              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                      Form completion
                    </p>
                    <p className="mt-1 text-[24px] font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">
                      {completion}%
                    </p>
                  </div>
                  <motion.div
                    key={completion === 100 ? 'done' : 'pending'}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={SPRING.snappy}
                    className={[
                      'flex h-10 w-10 items-center justify-center rounded-full',
                      completion === 100
                        ? 'bg-[#34C759]/15 text-[#34C759]'
                        : 'bg-[#007AFF]/10 text-[#007AFF]',
                    ].join(' ')}
                  >
                    <Icon
                      paths={completion === 100 ? I.checkCircle : I.sparkles}
                      size={18}
                      strokeWidth={2}
                    />
                  </motion.div>
                </div>

                <ProgressBar value={completion} tone={savedTone} />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-[#86868B]">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: sections.personal ? '#34C759' : '#FF9500' }}
                    />
                    Personal
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: sections.contact ? '#34C759' : '#FF9500' }}
                    />
                    Contact
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: sections.parent ? '#34C759' : '#FF9500' }}
                    />
                    Parent
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* ============================================================
              PERSONAL
          ============================================================ */}
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.05 }}
          >
            <FormSection
              title={t('studentForm.sectionInfo')}
              icon={I.userCircle}
              tone="blue"
              completed={sections.personal}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('teachers.form.firstName')} required error={formErrors.firstName}>
                  <GlassInput
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    required
                    aria-invalid={Boolean(formErrors.firstName)}
                    aria-describedby={formErrors.firstName ? 'firstname-error' : undefined}
                    placeholder="John"
                    disabled={save.isPending}
                  />
                  {formErrors.firstName && (
                    <span id="firstname-error" className="mt-1 text-sm text-red-600">
                      {formErrors.firstName}
                    </span>
                  )}
                </GlassField>

                <GlassField label={t('teachers.form.lastName')} required error={formErrors.lastName}>
                  <GlassInput
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    required
                    aria-invalid={Boolean(formErrors.lastName)}
                    aria-describedby={formErrors.lastName ? 'lastname-error' : undefined}
                    placeholder="Doe"
                    disabled={save.isPending}
                  />
                  {formErrors.lastName && (
                    <span id="lastname-error" className="mt-1 text-sm text-red-600">
                      {formErrors.lastName}
                    </span>
                  )}
                </GlassField>

                <GlassField label={t('studentForm.dateOfBirth')}>
                  <GlassInput
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set('dateOfBirth', e.target.value)}
                    disabled={save.isPending}
                  />
                </GlassField>

                <GlassField label={t('studentForm.gender')}>
                  <GlassSelect
                    value={form.gender}
                    onChange={(e) => set('gender', e.target.value)}
                    aria-label={t('studentForm.selectGenderAria')}
                    disabled={save.isPending}
                  >
                    <option value="">—</option>
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {t(g.label)}
                      </option>
                    ))}
                  </GlassSelect>
                </GlassField>
              </div>

              <div className="mt-4">
                <GlassField label={t('common.notes')}>
                  <GlassTextArea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder={t('studentForm.notesPlaceholder')}
                    disabled={save.isPending}
                  />
                </GlassField>
              </div>
            </FormSection>
          </motion.div>

          {/* ============================================================
              CONTACT
          ============================================================ */}
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
          >
            <FormSection
              title={t('students.col.status') /* fallback title */}
              icon={I.phone}
              tone="green"
              completed={sections.contact}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <GlassField label={t('common.phone')}>
                  <GlassInput
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+998 90 123 4567"
                    disabled={save.isPending}
                  />
                </GlassField>

                <GlassField label={t('hr.form.address')}>
                  <GlassInput
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder={t('studentForm.addressPlaceholder')}
                    disabled={save.isPending}
                  />
                </GlassField>

                {!isEdit && (
                  <>
                    <GlassField
                      label={t('common.email')}
                      hint={t('studentForm.emailHint')}
                      error={formErrors.email}
                    >
                      <GlassInput
                        type="email"
                        value={form.email}
                        onChange={(e) => set('email', e.target.value)}
                        aria-invalid={Boolean(formErrors.email)}
                        aria-describedby={formErrors.email ? 'email-error' : undefined}
                        placeholder="john@example.com"
                        disabled={save.isPending}
                      />
                      {formErrors.email && (
                        <span id="email-error" className="mt-1 text-sm text-red-600">
                          {formErrors.email}
                        </span>
                      )}
                    </GlassField>

                    <GlassField label={t('auth.password')} hint={t('studentForm.passwordHint')}>
                      <GlassInput
                        type="password"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        autoComplete="new-password"
                        disabled={save.isPending}
                      />
                      <PasswordStrength value={form.password} />
                    </GlassField>
                  </>
                )}
              </div>
            </FormSection>
          </motion.div>

          {/* ============================================================
              PARENT / GUARDIAN
          ============================================================ */}
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.15 }}
          >
            <FormSection
              title={t('studentForm.parentSection')}
              icon={I.users}
              tone="purple"
              completed={sections.parent}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <GlassField label={t('studentForm.parentName')}>
                  <GlassInput
                    value={form.parentName}
                    onChange={(e) => set('parentName', e.target.value)}
                    placeholder="Jane Doe"
                    disabled={save.isPending}
                  />
                </GlassField>

                <GlassField label={t('studentForm.parentPhone')}>
                  <GlassInput
                    type="tel"
                    value={form.parentPhone}
                    onChange={(e) => set('parentPhone', e.target.value)}
                    placeholder="+998 90 123 4567"
                    disabled={save.isPending}
                  />
                </GlassField>

                <GlassField label={t('studentForm.parentEmail')} error={formErrors.parentEmail}>
                  <GlassInput
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => set('parentEmail', e.target.value)}
                    aria-invalid={Boolean(formErrors.parentEmail)}
                    aria-describedby={formErrors.parentEmail ? 'parent-email-error' : undefined}
                    placeholder="jane@example.com"
                    disabled={save.isPending}
                  />
                  {formErrors.parentEmail && (
                    <span id="parent-email-error" className="mt-1 text-sm text-red-600">
                      {formErrors.parentEmail}
                    </span>
                  )}
                </GlassField>
              </div>
            </FormSection>
          </motion.div>

          {/* ============================================================
              STICKY ACTION BAR
          ============================================================ */}
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING.smooth, delay: 0.25 }}
            className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-0 z-40 lg:pl-[290px]"
            style={{ pointerEvents: 'none' }}
          >
            <div className="mx-auto max-w-3xl px-3 sm:px-6 pb-2 sm:pb-4" style={{ pointerEvents: 'auto' }}>
              <div
                className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-white/90 px-4 py-3 shadow-2xl backdrop-blur-2xl dark:border-white/[0.08] dark:bg-surface-900/90"
              >
                <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]"
                  >
                    <Icon
                      paths={isEdit ? I.save : I.userCircle}
                      size={14}
                      strokeWidth={2}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
                      {isEdit ? t('studentForm.editTitle') : t('studentForm.addTitle')}
                    </p>
                    <p className="text-[10.5px] font-medium text-[#86868B] tabular-nums">
                      {completion}% complete
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 justify-end gap-2 sm:flex-initial">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <GlassButton
                      type="button"
                      variant="secondary"
                      onClick={handleCancel}
                      disabled={save.isPending}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.arrowLeft} size={15} strokeWidth={2} />
                        {t('common.cancel')}
                      </span>
                    </GlassButton>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <GlassButton
                      type="submit"
                      variant="primary"
                      disabled={save.isPending}
                    >
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
                          <Icon paths={I.save} size={15} strokeWidth={2} />
                          {isEdit ? t('templates.saveChanges') : t('studentForm.create')}
                        </span>
                      )}
                    </GlassButton>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        </form>

        {toastNode}
      </div>
    </>
  );
}