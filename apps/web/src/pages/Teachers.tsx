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
  FloatingActionIsland,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
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
  x: ['M18 6 6 18', 'M6 6l12 12'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
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

/** Ambient gradient orbs — GPU-friendly static atmospheric layer */
function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-20 z-0 h-[360px] overflow-hidden">
      <div
        className="absolute left-1/4 -top-10 h-[280px] w-[500px] -translate-x-1/2 rounded-full opacity-60 dark:opacity-40"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(88,86,214,0.18) 0%, rgba(0,122,255,0.08) 45%, transparent 70%)',
        }}
      />
      <div
        className="absolute right-1/4 -top-10 h-[260px] w-[460px] translate-x-1/2 rounded-full opacity-50 dark:opacity-30"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(175,82,222,0.15) 0%, rgba(52,199,89,0.06) 50%, transparent 70%)',
        }}
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
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card hover:shadow-card-hover transition-all"
    >
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2.2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[20px] font-bold tracking-tight text-[var(--text-primary)] font-display">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="mt-0.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
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

  const sound = usePremiumSound();

  const handleOpenTeacherSidecar = useCallback((teacher: Teacher) => {
    sound.playPop();
    const name = formatTeacherName(teacher);
    const data: QuickLookData = {
      id: teacher.id,
      type: 'teacher',
      title: name,
      subtitle: teacher.user?.email || teacher.user?.phone || "O'qituvchi",
      badge: {
        text: teacher.user?.isActive !== false ? "FAOL (ACTIVE)" : "NOFAOL",
        tone: teacher.user?.isActive !== false ? 'emerald' : 'slate',
      },
      avatar: {
        text: name.slice(0, 2).toUpperCase(),
        color: '#6366F1',
      },
      metrics: [
        {
          label: "Soatlik tarif",
          value: teacher.hourlyRate ? formatCurrency(teacher.hourlyRate) : "—",
          subtext: "1 akademik soat",
        },
        {
          label: "Tajriba",
          value: teacher.experience ? `${teacher.experience} yil` : "—",
          subtext: "Pedagogik tajriba",
        },
        {
          label: "Status",
          value: teacher.user?.isActive !== false ? "Aktiv" : "Nofaol",
        },
      ],
      details: [
        { label: "F.I.SH", value: name, copyable: true },
        { label: "Email", value: teacher.user?.email || "—", copyable: Boolean(teacher.user?.email) },
        { label: "Telefon", value: teacher.user?.phone || "—", copyable: Boolean(teacher.user?.phone) },
        { label: "Mutaxassislik", value: (teacher.specializations || []).join(', ') || "Umumiy", copyable: true },
        { label: "Tarjimai hol / Bio", value: teacher.bio || "Qo'shimcha ma'lumot mavjud emas." },
      ],
      tags: teacher.specializations || [],
      primaryAction: {
        label: "Tahrirlash",
        onExecute: () => handleEdit(teacher),
      },
    };
    openSidecar(data);
  }, [sound, handleEdit]);

  /* ── Filter & View State ─────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const filteredTeachers = useMemo(() => {
    let list = teacherList;
    if (statusFilter === 'ACTIVE') list = list.filter((t) => t.user?.isActive !== false);
    else if (statusFilter === 'INACTIVE') list = list.filter((t) => t.user?.isActive === false);
    return list;
  }, [teacherList, statusFilter]);

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Teacher>({
    items: filteredTeachers,
    getItemId: (t) => t.id,
    rowIdPrefix: 'teacher-row-',
    onSelect: (t) => handleOpenTeacherSidecar(t),
    onQuickLook: (t) => handleOpenTeacherSidecar(t),
    onEdit: (t) => handleEdit(t),
  });

  /* ── Bulk Actions ─────────────────────────────────────────────────── */
  const handleBatchToggleStatus = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        const item = teacherList.find((t) => t.id === id);
        if (item) {
          const nextActive = !item.user?.isActive;
          await teachersApi.update(id, { isActive: nextActive });
          count++;
        }
      } catch {
        // continue
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.teachers.all() });
    clearSelection();
    push('success', `${count} ta o'qituvchi holati yangilandi`);
  };

  const handleExportSelectedTeachersCSV = () => {
    const selectedRows = teacherList.filter((t) => isSelected(t.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Name,Email,Phone,Specializations,HourlyRate,Experience']
        .concat(
          selectedRows.map(
            (t) =>
              `"${t.id}","${formatTeacherName(t)}","${t.user?.email || ''}","${t.user?.phone || ''}","${(t.specializations || []).join(';')}","${t.hourlyRate || ''}","${t.experience || ''}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `teachers_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    clearSelection();
    push('success', `${selectedRows.length} ta o'qituvchi CSV formatida yuklandi`);
  };

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
        <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-5 sm:p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
          <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {/* Apple Gradient teachers tile */}
            <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5856D6] to-[#AF52DE] text-white shadow-[0_8px_20px_rgba(88,86,214,0.25)] ring-1 ring-white/20">
              <Icon paths={I.users} size={24} strokeWidth={2.2} className="relative" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5856D6]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#5856D6] border border-[#5856D6]/20">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.2} />
                  {t('teachers.faculty') || 'Ustozlar'}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] border border-black/[0.04] dark:border-white/[0.06] tabular-nums">
                  <Icon paths={I.layers} size={11} strokeWidth={2.2} />
                  {stats.total} {t('teachers.total') || 'jami'}
                </span>
                {stats.active > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#28A745] dark:text-[#34C759] border border-[#34C759]/20 tabular-nums">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] animate-pulse" />
                    {stats.active} {t('teachers.active') || 'faol'}
                  </span>
                )}
              </div>

              <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl font-display">
                {t('teachers.title')}
              </h1>
              <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                {t('teachers.subtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
            >
              <GlassButton type="button" variant="primary" onClick={handleOpenModal}>
                <span className="inline-flex items-center gap-2 font-medium">
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
      <motion.div
        variants={cardVariants}
        className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-sm"
      >
        <div className="relative flex-1 min-w-[240px]">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-tertiary)]">
            <Icon paths={I.search} size={15} strokeWidth={2.2} />
          </div>
          <input
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder={t('teachers.searchPlaceholder')}
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Status segmented control */}
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
              Nofaol <span className="ml-1 text-[10.5px] opacity-70">({stats.inactive})</span>
            </button>
          </div>

          {/* View switcher: list vs grid */}
          <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Ro'yxat ko'rinishi"
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
              onClick={() => setViewMode('grid')}
              aria-label="Kataklar (Grid) ko'rinishi"
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
          TEACHERS CONTENT (EMPTY / LIST / GRID)
      ============================================================ */}
      <AnimatePresence mode="wait">
        {teacherList.length === 0 ? (
          <motion.div
            key="empty"
            variants={cardVariants}
            className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card text-center"
          >
            <div className="flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5856D6]/10 text-[#5856D6]">
                <Icon paths={I.empty} size={24} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-bold tracking-tight text-[var(--text-primary)] font-display">
                {hasActiveFilter ? t('teachers.emptyFiltered') : t('teachers.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[13px] text-[var(--text-secondary)]">
                {hasActiveFilter
                  ? t('teachers.emptyFilteredHint')
                  : t('teachers.emptyHint')}
              </p>
              {!hasActiveFilter && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <GlassButton
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleOpenModal}
                    >
                      <span className="inline-flex items-center gap-2 font-medium">
                        <Icon paths={I.userPlus} size={14} strokeWidth={2.4} />
                        {t('teachers.add')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </motion.div>
        ) : filteredTeachers.length === 0 ? (
          <motion.div
            key="empty-filtered"
            variants={cardVariants}
            className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card text-center"
          >
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-tertiary)]">
                <Icon paths={I.search} size={20} strokeWidth={2} />
              </div>
              <p className="mt-3 text-[14px] font-bold text-[var(--text-primary)]">
                Mos keluvchi o'qituvchi topilmadi
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
                Qidiruv so'zini yoki status filtrini o'zgartirib ko'ring
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                }}
                className="mt-4 px-4 py-2 text-[12.5px] font-semibold rounded-xl bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-[var(--text-primary)] transition-colors"
              >
                Filtrlarni tozalash
              </button>
            </div>
          </motion.div>
        ) : viewMode === 'list' ? (
          <motion.div
            key="list"
            variants={cardVariants}
            className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card divide-y divide-black/[0.05] dark:divide-white/[0.05]"
          >
            {filteredTeachers.map((teacher, idx) => {
              const statusBadge = getTeacherStatusBadge(teacher.user?.isActive);
              const specializations = teacher.specializations || [];
              const name = formatTeacherName(teacher);
              const isActive = teacher.user?.isActive !== false;
              const isRowSelected = isSelected(teacher.id);
              const isRowFocused = focusedIndex === idx;

              return (
                <motion.div
                  key={teacher.id}
                  id={`teacher-row-${teacher.id}`}
                  variants={rowVariants}
                  onClick={() => handleOpenTeacherSidecar(teacher)}
                  className={`group cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 transition-all ${
                    isRowFocused
                      ? 'ring-2 ring-[#007AFF] bg-brand-500/[0.06]'
                      : isRowSelected
                      ? 'bg-brand-500/[0.04]'
                      : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Left: Selection + Avatar + Teacher Info */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Selection Checkbox */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(teacher.id);
                      }}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all mt-1 sm:mt-0 ${
                        isRowSelected
                          ? 'border-[#007AFF] bg-[#007AFF] text-white'
                          : 'border-black/20 dark:border-white/20 bg-white/50 dark:bg-surface-800/50 hover:border-black/40 dark:hover:border-white/40'
                      }`}
                      aria-label={`Tanlash ${name}`}
                    >
                      {isRowSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </button>

                    {/* Avatar */}
                    <div className="shrink-0">
                      <TeacherAvatar name={name} size={42} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13.5px] font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
                          {name}
                        </p>
                        {teacher.experience != null && teacher.experience > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9500]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FF9500] shrink-0 border border-[#FF9500]/20">
                            <Icon paths={I.award} size={9} strokeWidth={2.4} />
                            {teacher.experience}y
                          </span>
                        )}
                        <StatusBadge isActive={isActive} label={t(statusBadge.label)} />
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {teacher.user?.email && (
                          <EmailChip email={teacher.user.email} />
                        )}
                        {teacher.user?.phone && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-medium tabular-nums text-[var(--text-tertiary)]">
                            <Icon paths={I.phone} size={11} strokeWidth={2} className="opacity-60" />
                            {teacher.user.phone}
                          </span>
                        )}
                      </div>

                      {specializations.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {specializations.slice(0, 4).map((s) => (
                            <SpecChip key={s} spec={s} />
                          ))}
                          {specializations.length > 4 && (
                            <span className="inline-flex items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-[var(--text-tertiary)]">
                              +{specializations.length - 4}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Rate + Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0 shrink-0">
                    {/* Rate */}
                    {teacher.hourlyRate ? (
                      <div className="flex flex-col items-start sm:items-end shrink-0">
                        <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                          {t('teachers.col.hourlyRate')}
                        </span>
                        <span className="mt-0.5 text-[13.5px] sm:text-[14px] font-bold tabular-nums tracking-tight text-[#34C759] dark:text-[#30D158]">
                          {formatCurrency(teacher.hourlyRate)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[12px] font-medium text-[var(--text-tertiary)] shrink-0">—</span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Sidecar Inspector Toggle */}
                      <motion.button
                        type="button"
                        onClick={() => handleOpenTeacherSidecar(teacher)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label="Sidecar Dossier"
                        title="Sidecar tafsilotlari (Split-View · Space)"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-brand-500/40 transition-colors text-xs font-bold"
                      >
                        <span>◨</span>
                      </motion.button>

                      <motion.button
                        type="button"
                        onClick={() => handleEdit(teacher)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING.snappy}
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF] hover:border-[#007AFF]/30 transition-colors"
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
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30] hover:bg-[#FF3B30]/15 disabled:opacity-50 transition-colors"
                      >
                        <Icon paths={I.trash} size={13} strokeWidth={2} />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* GRID VIEW */
          <motion.div
            key="grid"
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredTeachers.map((teacher, idx) => {
              const statusBadge = getTeacherStatusBadge(teacher.user?.isActive);
              const specializations = teacher.specializations || [];
              const name = formatTeacherName(teacher);
              const isActive = teacher.user?.isActive !== false;
              const isRowSelected = isSelected(teacher.id);
              const isRowFocused = focusedIndex === idx;

              return (
                <motion.div
                  key={teacher.id}
                  id={`teacher-card-${teacher.id}`}
                  variants={rowVariants}
                  whileHover={{ y: -2 }}
                  transition={SPRING.smooth}
                  onClick={() => handleOpenTeacherSidecar(teacher)}
                  className={`group relative flex flex-col justify-between rounded-2xl border border-black/[0.06] bg-white/80 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card hover:shadow-card-hover transition-all cursor-pointer ${
                    isRowFocused
                      ? 'ring-2 ring-[#007AFF] bg-brand-500/[0.05]'
                      : isRowSelected
                      ? 'ring-2 ring-[#007AFF]/60 bg-brand-500/[0.03]'
                      : ''
                  }`}
                >
                  <div>
                    {/* Top: Checkbox, Avatar, Name, Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(teacher.id);
                          }}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                            isRowSelected
                              ? 'border-[#007AFF] bg-[#007AFF] text-white'
                              : 'border-black/20 dark:border-white/20 bg-white/60 dark:bg-surface-800/60 hover:border-black/40 dark:hover:border-white/40'
                          }`}
                          aria-label={`Tanlash ${name}`}
                        >
                          {isRowSelected && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                        <TeacherAvatar name={name} size={46} />
                        <div className="min-w-0">
                          <h3 className="truncate text-[14px] font-bold text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
                            {name}
                          </h3>
                          {teacher.user?.email && (
                            <span className="truncate text-[11.5px] text-[var(--text-tertiary)] block">
                              {teacher.user.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <StatusBadge isActive={isActive} label={t(statusBadge.label)} />
                    </div>

                    {/* Middle: Experience & Hourly Rate */}
                    <div className="mt-4 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04] pt-3">
                      <div className="flex items-center gap-1.5">
                        {teacher.experience != null && teacher.experience > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF9500]/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-[#FF9500] border border-[#FF9500]/20">
                            <Icon paths={I.award} size={10} strokeWidth={2.4} />
                            {teacher.experience} yillik tajriba
                          </span>
                        )}
                      </div>
                      {teacher.hourlyRate && (
                        <span className="text-[13px] font-bold tabular-nums text-[#34C759] dark:text-[#30D158]">
                          {formatCurrency(teacher.hourlyRate)}/soat
                        </span>
                      )}
                    </div>

                    {/* Specialization chips */}
                    {specializations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {specializations.slice(0, 3).map((s) => (
                          <SpecChip key={s} spec={s} />
                        ))}
                        {specializations.length > 3 && (
                          <span className="inline-flex items-center rounded-lg bg-black/[0.04] dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold text-[var(--text-tertiary)]">
                            +{specializations.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Actions */}
                  <div
                    className="mt-4 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04] pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      <motion.button
                        type="button"
                        onClick={() => handleOpenTeacherSidecar(teacher)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        title="Sidecar tafsilotlari (Split-View · Space)"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <span className="text-[13px] leading-none">◨</span>
                      </motion.button>
                      <motion.button
                        type="button"
                        onClick={() => handleEdit(teacher)}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        title={t('common.edit')}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[#007AFF]"
                      >
                        <Icon paths={I.edit} size={13} strokeWidth={2} />
                      </motion.button>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleDelete(teacher.id)}
                      disabled={remove.isPending && remove.variables === teacher.id}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      title={t('common.delete')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30] disabled:opacity-50"
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
          <div className="relative border-t border-black/[0.04] p-4 dark:border-white/[0.04]">
            <div className="flex justify-center">
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </div>
        )}

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

      {/* Floating Action Island for Bulk Teacher Operations */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={[
          {
            label: "Holatni o'zgartirish",
            icon: "🔄",
            onClick: handleBatchToggleStatus,
            variant: 'primary',
            shortcutBadge: 't',
          },
          {
            label: "Eksport (CSV)",
            icon: "📊",
            onClick: handleExportSelectedTeachersCSV,
            shortcutBadge: 'e',
          },
        ]}
      />
    </motion.div>
  );
}