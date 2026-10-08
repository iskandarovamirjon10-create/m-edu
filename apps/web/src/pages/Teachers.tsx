/**
 * M-EDU TeachersPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient teachers tile + live chips (Total/Active/Inactive)
 *  - Ambient gradient orbs (blue + purple drift) — consistent with suite
 *  - Animated stats bar with count-up numbers
 *  - Per-teacher deterministic gradient avatars (name hash → palette)
 *  - Premium card rows (avatar + email chip + specialization chips + rate)
 *  - Squircle FieldIcons in modal (no bare labels)
 *  - Shimmer skeleton (not pulse)
 *  - Custom SVG icons in SF Symbols proportions
 *  - Stagger entrance with spring physics
 */

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { teachersApi } from '@/lib/api';
import {
  GlassErrorState,
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
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.06 } },
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

const I: Record<string, string[]> = {
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
  check: ['M20 6 9 17l-5-5'],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
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
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
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
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
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

const SPECIALIZATION_TONES: Tone[] = ['blue', 'purple', 'emerald', 'orange', 'cyan', 'red', 'green', 'gray'];

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

function specializationTone(spec: string): Tone {
  return SPECIALIZATION_TONES[nameHash(spec) % SPECIALIZATION_TONES.length];
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

/** Ambient gradient orbs — consistent with suite */
function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          filter: 'blur(70px)',
        }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          filter: 'blur(80px)',
        }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

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

/** Premium stat tile with count-up */
function StatTile({
  label, value, icon, tone = 'blue',
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
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
        <div className="text-[20px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Squircle leading icon */
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

function TeachersSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[68px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] dark:border-[#ffffff10] dark:bg-[#1c1c1e80]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#00000008] p-4 last:border-0 dark:border-[#ffffff08]">
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

/** Specialization chip — tone-aware */
function SpecChip({ spec }: { spec: string }) {
  const tone = specializationTone(spec);
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {spec}
    </span>
  );
}

/** Email chip */
function EmailChip({ email }: { email: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#86868B]">
      <Icon paths={I.mail} size={11} strokeWidth={2} className="opacity-60" />
      <span className="truncate max-w-[14rem]">{email}</span>
    </span>
  );
}

/** Status badge with pulse */
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

/* ============================================================================
 * PAGE
 * ========================================================================== */

export function TeachersPage() {
  const { t } = useI18n();
  usePageTitle(t('teachers.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<TeacherFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof TeacherFormState, string>>
  >({});

  /* ── Query ────────────────────────────────────────────────────────── */
  const params = useMemo<TeacherFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
    }),
    [page, debouncedSearch],
  );

  const teachers = useQuery({
    queryKey: queryKeys.teachers.list(params),
    queryFn: () => teachersApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = teachers.data as Paginated<Teacher> | undefined;
  const teacherList = useMemo(() => data?.items || [], [data]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const active = teacherList.filter((t) => t.user?.isActive !== false).length;
    const inactive = teacherList.length - active;
    const rates = teacherList
      .map((t) => Number(t.hourlyRate) || 0)
      .filter((n) => n > 0);
    const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    return { total: data?.total ?? teacherList.length, active, inactive, avgRate };
  }, [teacherList, data?.total]);

  /* ── Mutations ────────────────────────────────────────────────────── */
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

  /* ── Validators ───────────────────────────────────────────────────── */
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

  /* ── Handlers ─────────────────────────────────────────────────────── */
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
  const handleRetry = useCallback(() => {
    void refetchTeachers();
  }, [refetchTeachers]);

  const hasActiveFilter = Boolean(search);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (teachers.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <TeachersSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (teachers.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('teachers.loadError')}
            message={getErrorMessage(teachers.error as Error)}
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
      className="relative page-container space-y-5"
    >
      <AmbientOrbs />
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
            {/* Gradient teachers tile */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(88,86,214,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
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
              <Icon paths={I.users} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5856D6]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5856D6]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('teachers.faculty') || 'Faculty'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} {t('teachers.total') || 'total'}
                </span>
                {stats.active > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759]" />
                    {stats.active} {t('teachers.active') || 'active'}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('teachers.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('teachers.subtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton type="button" variant="primary" onClick={handleOpenModal}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.userPlus} size={15} strokeWidth={2.4} />
                  {t('teachers.add')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          STATS BAR
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <StatTile label={t('teachers.title')} value={stats.total} icon={I.users} tone="blue" />
        <StatTile label={t('enum.status.ACTIVE')} value={stats.active} icon={I.checkCircle} tone="emerald" />
        <StatTile label={t('enum.status.INACTIVE')} value={stats.inactive} icon={I.pause} tone="orange" />
        <StatTile label={t('teachers.col.hourlyRate')} value={formatCurrency(stats.avgRate)} icon={I.wallet} tone="purple" />
      </motion.div>

      {/* ============================================================
          FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <FieldIcon icon={I.search} tone="blue" />
              <GlassInput
                placeholder={t('teachers.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('teachers.searchLabel')}
                type="search"
                className="pl-11"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          TEACHERS LIST
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

        <AnimatePresence mode="wait">
          {teacherList.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.smooth}
              className="relative p-10"
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#5856D6]/10 text-[#5856D6]"
                  style={{
                    boxShadow:
                      'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(88,86,214,0.4)',
                  }}
                >
                  <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                </div>
                <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {hasActiveFilter ? t('teachers.emptyFiltered') : t('teachers.empty')}
                </p>
                <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                  {hasActiveFilter
                    ? t('teachers.emptyFilteredHint')
                    : t('teachers.emptyHint')}
                </p>
                {!hasActiveFilter && (
                  <div className="mt-5">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <GlassButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleOpenModal}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.userPlus} size={14} strokeWidth={2.4} />
                          {t('teachers.add')}
                        </span>
                      </GlassButton>
                    </motion.div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]"
            >
              {teacherList.map((teacher) => {
                const statusBadge = getTeacherStatusBadge(teacher.user?.isActive);
                const specializations = teacher.specializations || [];
                const name = formatTeacherName(teacher);
                const isActive = teacher.user?.isActive !== false;

                return (
                  <motion.div
                    key={teacher.id}
                    variants={rowVariants}
                    className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#007AFF]/[0.03]"
                  >
                    {/* Avatar + name */}
                    <TeacherAvatar name={name} size={44} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {name}
                        </p>
                        {teacher.experience != null && teacher.experience > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9500]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FF9500]">
                            <Icon paths={I.award} size={9} strokeWidth={2.4} />
                            {teacher.experience}y
                          </span>
                        )}
                        <StatusBadge isActive={isActive} label={t(statusBadge.label)} />
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {teacher.user?.email && (
                          <EmailChip email={teacher.user.email} />
                        )}
                        {teacher.user?.phone && (
                          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium tabular-nums text-[#86868B]">
                            <Icon paths={I.phone} size={11} strokeWidth={2} className="opacity-60" />
                            {teacher.user.phone}
                          </span>
                        )}
                      </div>

                      {specializations.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {specializations.slice(0, 4).map((s) => (
                            <SpecChip key={s} spec={s} />
                          ))}
                          {specializations.length > 4 && (
                            <span className="inline-flex items-center rounded-lg bg-[#00000006] px-2 py-0.5 text-[10.5px] font-bold text-[#86868B] dark:bg-[#ffffff08]">
                              +{specializations.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Rate */}
                    {teacher.hourlyRate ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                          {t('teachers.col.hourlyRate')}
                        </span>
                        <span className="mt-0.5 text-[14px] font-bold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {formatCurrency(teacher.hourlyRate)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-[#86868B]">—</span>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      <motion.button
                        type="button"
                        onClick={() => handleEdit(teacher)}
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
                        onClick={() => handleDelete(teacher.id)}
                        disabled={remove.isPending && remove.variables === teacher.id}
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
                        <Icon paths={I.trash} size={13} strokeWidth={2} />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pagination */}
        {teacherList.length > 0 && (data?.totalPages ?? 1) > 1 && (
          <div className="relative border-t border-[#00000008] p-4 dark:border-[#ffffff08]">
            <div className="flex justify-center">
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}
      </motion.div>

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
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#5856D633] bg-[#5856D6]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5856D6]/15 text-[#5856D6]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingId
                ? (t('teachers.form.editHint') || 'Update the teacher profile. Changes are reflected immediately.')
                : (t('teachers.form.addHint') || 'Fill in the details below. First and last name are required.')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField
              label={t('teachers.form.firstName')}
              required
              error={formErrors.firstName}
            >
              <div className="relative">
                <FieldIcon icon={I.user} tone="blue" />
                <GlassInput
                  value={form.firstName}
                  onChange={handleFormChange('firstName')}
                  required
                  aria-invalid={Boolean(formErrors.firstName)}
                  aria-describedby={formErrors.firstName ? 'firstname-error' : undefined}
                  placeholder="John"
                  disabled={create.isPending}
                  className="pl-11"
                />
              </div>
              {formErrors.firstName && (
                <span
                  id="firstname-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.firstName}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('teachers.form.lastName')}
              required
              error={formErrors.lastName}
            >
              <div className="relative">
                <FieldIcon icon={I.user} tone="blue" />
                <GlassInput
                  value={form.lastName}
                  onChange={handleFormChange('lastName')}
                  required
                  aria-invalid={Boolean(formErrors.lastName)}
                  aria-describedby={formErrors.lastName ? 'lastname-error' : undefined}
                  placeholder="Doe"
                  disabled={create.isPending}
                  className="pl-11"
                />
              </div>
              {formErrors.lastName && (
                <span
                  id="lastname-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.lastName}
                </span>
              )}
            </GlassField>

            <GlassField label={t('common.email')} error={formErrors.email}>
              <div className="relative">
                <FieldIcon icon={I.mail} tone="purple" />
                <GlassInput
                  type="email"
                  value={form.email}
                  onChange={handleFormChange('email')}
                  aria-invalid={Boolean(formErrors.email)}
                  aria-describedby={formErrors.email ? 'email-error' : undefined}
                  placeholder="john@example.com"
                  disabled={create.isPending}
                  className="pl-11"
                />
              </div>
              {formErrors.email && (
                <span
                  id="email-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.email}
                </span>
              )}
            </GlassField>

            <GlassField label={t('teachers.form.phone')}>
              <div className="relative">
                <FieldIcon icon={I.phone} tone="emerald" />
                <GlassInput
                  type="tel"
                  value={form.phone}
                  onChange={handleFormChange('phone')}
                  placeholder="+998 90 123 4567"
                  disabled={create.isPending}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField
              label={t('teachers.form.specializations')}
              hint={t('teachers.form.specializationsHint')}
            >
              <div className="relative">
                <FieldIcon icon={I.book} tone="orange" />
                <GlassInput
                  value={form.specializations}
                  onChange={handleFormChange('specializations')}
                  placeholder={t('teachers.specializationsPlaceholder')}
                  disabled={create.isPending}
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField
              label={t('teachers.form.hourlyRate')}
              error={formErrors.hourlyRate}
            >
              <div className="relative">
                <FieldIcon icon={I.wallet} tone="green" />
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
                  className="pl-11"
                />
              </div>
              {formErrors.hourlyRate && (
                <span
                  id="rate-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.hourlyRate}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('teachers.form.experience')}
              error={formErrors.experience}
            >
              <div className="relative">
                <FieldIcon icon={I.award} tone="orange" />
                <GlassInput
                  type="number"
                  min="0"
                  value={form.experience}
                  onChange={handleFormChange('experience')}
                  aria-invalid={Boolean(formErrors.experience)}
                  aria-describedby={formErrors.experience ? 'experience-error' : undefined}
                  placeholder="5"
                  disabled={create.isPending}
                  className="pl-11"
                />
              </div>
              {formErrors.experience && (
                <span
                  id="experience-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.experience}
                </span>
              )}
            </GlassField>
          </div>

          <GlassField label={t('teachers.form.bio')}>
            <div className="relative">
              <span
                className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
                style={{ background: TONES.gray.bg, color: TONES.gray.fg }}
                aria-hidden
              >
                <Icon paths={I.note} size={12} strokeWidth={2.2} />
              </span>
              <GlassTextArea
                rows={3}
                value={form.bio}
                onChange={handleFormChange('bio')}
                placeholder={t('teachers.bioPlaceholder')}
                disabled={create.isPending}
                className="pl-11"
              />
            </div>
          </GlassField>

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
                  ) : editingId ? (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {t('teachers.update')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      {t('teachers.create')}
                    </>
                  )}
                </span>
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
    </motion.div>
  );
}