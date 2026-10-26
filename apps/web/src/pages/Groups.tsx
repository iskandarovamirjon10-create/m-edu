/**
 * ============================================================================
 * M-EDU GroupsPage — v3.0 "Spatial Command Center" ()
 * ============================================================================
 *
 * Engineering & Comfort Upgrades in v3.0:
 *  - Tri-Mode Spatial Views: List, Bento Grid, and Room Utilization Matrix
 *  - Global Power-User Shortcuts: [/] or [⌘K] Search, [N] New Group, [1/2/3] Views
 *  - Multi-Dimensional Filtering & Sorting (Course, Teacher, Status, Capacity, Date)
 *  - Overall Center Utilization Telemetry Bar + Animated CountUp KPIs
 *  - Smart Create Modal: Quick Capacity Presets (12/15/18/20/24) & Room Suggestions
 *  - Memory-safe UTF-8 BOM CSV Exporter & Parallel Promise.allSettled Batch Delete
 *  - Unified DRY Inspector Payload Builder for macOS Quick-Look & Sidecar
 *  - Full i18n, a11y, and E2E data-testid compatibility preserved
 * ============================================================================
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
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
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
 * CUSTOM ICONS (SVG Icons)
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
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
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
    'M10 11v6',
    'M14 11v6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  building: [
    'M3 21h18',
    'M5 21V7l8-4v18',
    'M19 21V11l-6-4',
    'M9 9v.01',
    'M9 12v.01',
    'M9 15v.01',
    'M9 18v.01',
  ],
  eye: [
    'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  x: ['M18 6 6 18', 'M6 6l12 12'],
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
  sort: [
    'M3 6h18',
    'M7 12h10',
    'M10 18h4',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
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
 * TONES (Apple HIG Calibrated System)
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.08)',   glow: 'rgba(0,122,255,0.14)',   border: 'rgba(0,122,255,0.22)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.08)',   glow: 'rgba(52,199,89,0.14)',   border: 'rgba(52,199,89,0.22)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.08)',   glow: 'rgba(255,149,0,0.14)',   border: 'rgba(255,149,0,0.22)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.08)',   glow: 'rgba(255,59,48,0.14)',   border: 'rgba(255,59,48,0.22)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.08)',  glow: 'rgba(175,82,222,0.14)',  border: 'rgba(175,82,222,0.22)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.08)',  glow: 'rgba(50,173,230,0.14)',  border: 'rgba(50,173,230,0.22)' },
  gray:    { fg: '#8E8E93', bg: 'rgba(142,142,147,0.08)', glow: 'rgba(142,142,147,0.14)', border: 'rgba(142,142,147,0.22)' },
  emerald: { fg: '#34C759', bg: 'rgba(52,199,89,0.08)',   glow: 'rgba(52,199,89,0.14)',   border: 'rgba(52,199,89,0.22)' },
};

const GROUP_PALETTES: Tone[] = ['blue', 'purple', 'emerald', 'orange', 'cyan', 'gray'];
const CAPACITY_PRESETS = ['12', '15', '18', '20', '24'] as const;

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
}

type ViewMode = 'list' | 'grid' | 'rooms';
type SortMode = 'NAME_ASC' | 'CAPACITY_DESC' | 'START_DESC' | 'ENROLLED_DESC';
type CapacityFilter = 'ALL' | 'AVAILABLE' | 'NEAR_FULL' | 'FULL';

const INITIAL_FORM: GroupFormState = {
  name: '',
  courseId: '',
  teacherId: '',
  capacity: '18',
  room: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function formatTeacherName(teacher: Teacher | null | undefined): string {
  if (!teacher) return '—';
  return fullName(teacher.user?.firstName, teacher.user?.lastName);
}

function getEnrolledCount(group: Group): number {
  return group._count?.enrollments ?? 0;
}

function formatCapacity(group: Group): string {
  const current = getEnrolledCount(group);
  return group.capacity ? `${current} / ${group.capacity}` : String(current);
}

function capacityRatio(group: Group): number {
  const current = getEnrolledCount(group);
  if (!group.capacity || group.capacity <= 0) return 0;
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
  ['#2563EB', '#1D4ED8'],
  ['#475569', '#334155'],
  ['#059669', '#047857'],
  ['#0D9488', '#0F766E'],
  ['#4F46E5', '#4338CA'],
  ['#7C3AED', '#6D28D9'],
];

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function groupTone(name: string): Tone {
  return GROUP_PALETTES[nameHash(name) % GROUP_PALETTES.length];
}

/** Unified DRY payload builder for QuickLook & Sidecar */
function buildGroupInspectorPayload(
  group: Group,
  navigate: ReturnType<typeof useNavigate>,
) {
  const teacherName = formatTeacherName(group.teacher);
  const capacityStr = formatCapacity(group);
  const ratioPct = Math.round(capacityRatio(group) * 100);
  const isActive = group.isActive !== false;

  return {
    id: group.id,
    type: 'group' as const,
    title: group.name,
    subtitle: group.course?.name || 'O‘quv guruhi',
    badge: {
      text: isActive ? 'Faol' : 'Nofaol',
      tone: (isActive ? 'emerald' : 'slate') as 'emerald' | 'slate',
    },
    avatar: {
      text: group.name.slice(0, 2).toUpperCase(),
      color: isActive ? '#34C759' : '#8E8E93',
    },
    metrics: [
      {
        label: "O'quvchilar",
        value: capacityStr,
        subtext: group.capacity ? `To'lganlik: ${ratioPct}%` : 'Cheklovsiz sig‘im',
      },
      {
        label: "O'qituvchi",
        value: teacherName,
        subtext: 'Asosiy murabbiy',
      },
      {
        label: 'Xona',
        value: group.room || '—',
        subtext: 'Auditoriya',
      },
      {
        label: 'Boshlanish',
        value: group.startDate ? new Date(group.startDate).toLocaleDateString('uz-UZ') : '—',
        subtext: 'Start sanasi',
      },
    ],
    details: [
      { label: 'Guruh nomi', value: group.name },
      { label: 'Kurs yo‘nalishi', value: group.course?.name || '—' },
      { label: "Mas'ul o'qituvchi", value: teacherName },
      { label: 'Biriktirilgan xona', value: group.room || 'Belgilanmagan' },
      { label: "Talabalar sig'imi", value: capacityStr },
      {
        label: 'Boshlanish sanasi',
        value: group.startDate ? new Date(group.startDate).toLocaleDateString('uz-UZ') : '—',
      },
      { label: 'Guruh ID', value: group.id, copyable: true },
    ],
    tags: [
      group.course?.name || 'Kurs',
      group.room ? `Xona: ${group.room}` : '',
      group.capacity ? `${ratioPct}% band` : '',
    ].filter(Boolean),
    primaryAction: {
      label: "Batafsil guruhga o'tish",
      onExecute: () => navigate(`/groups/${group.id}`),
    },
    secondaryAction: {
      label: 'Tahrirlash',
      onExecute: () => navigate(`/groups/${group.id}/edit`),
    },
  };
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
      <Shimmer className="h-32 w-full" radius="1.25rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[92px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-14 w-full" radius="1rem" />
      <Shimmer className="h-96 w-full" radius="1.25rem" />
    </div>
  );
}

function CountUp({
  value,
  duration = 1.0,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
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

  return (
    <span className="tabular-nums">
      {Math.round(n).toLocaleString('uz-UZ')}
      {suffix}
    </span>
  );
}

/** Apple Pro KPI tile with subtitle telemetry */
function KpiTile({
  label,
  value,
  subtext,
  icon,
  tone = 'blue',
  suffix = '',
  'data-testid': testId,
}: {
  label: string;
  value: number;
  subtext?: string;
  icon: string[];
  tone?: Tone;
  suffix?: string;
  'data-testid'?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      data-testid={testId}
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/85 dark:bg-surface-900/85 px-4 py-3.5 backdrop-blur-xl shadow-card hover:shadow-card-hover transition-all"
    >
      {/* Top specular highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/15"
      />
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-105"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-2xl font-extrabold tracking-tight tabular-nums leading-none text-[var(--text-primary)] dark:text-white">
          <CountUp value={value} suffix={suffix} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-[var(--text-secondary)] dark:text-zinc-400">
            {label}
          </span>
          {subtext && (
            <span className="shrink-0 font-mono text-[10px] font-semibold text-[var(--text-tertiary)]">
              {subtext}
            </span>
          )}
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
      className="relative inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight"
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

/** Capacity bar with micro-percentage indicator */
function CapacityBar({ group, showPercent = false }: { group: Group; showPercent?: boolean }) {
  const cap = group.capacity ?? 0;
  const ratio = capacityRatio(group);
  const pct = Math.round(ratio * 100);
  const tone: Tone = ratio >= 0.95 ? 'red' : ratio >= 0.75 ? 'orange' : 'emerald';
  const c = TONES[tone];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] font-bold tabular-nums tracking-tight text-[var(--text-primary)] dark:text-white">
        {formatCapacity(group)}
      </span>
      {cap > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.10]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: c.fg }}
              initial={{ width: 0 }}
              animate={{ width: `${ratio * 100}%` }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          {showPercent && (
            <span
              className="font-mono text-[10px] font-bold tabular-nums"
              style={{ color: c.fg }}
            >
              {pct}%
            </span>
          )}
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
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-tight"
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
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em]"
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
      aria-hidden="true"
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

  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ── Modal & Confirmation State ───────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  /* ── Create Form State ────────────────────────────────────────────── */
  const [form, setForm] = useState<GroupFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof GroupFormState, string>>
  >({});

  /* ── Graduate & Promote State ─────────────────────────────────────── */
  const [graduateTarget, setGraduateTarget] = useState<Group | null>(null);
  const [graduateForm, setGraduateForm] = useState({
    targetGroupId: '',
    completionNote:
      "Guruh bitirildi va talabalar keyingi bosqichga muvaffaqiyatli o'tkazildi",
  });

  /* ── Search, Filter, Sort & View State ────────────────────────────── */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [teacherFilter, setTeacherFilter] = useState<string>('ALL');
  const [capacityFilter, setCapacityFilter] = useState<CapacityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortMode>('NAME_ASC');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

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

  /* ── Derived Telemetry & Existing Rooms ───────────────────────────── */
  const stats = useMemo(() => {
    const total = groupList.length;
    const active = groupList.filter((g) => g.isActive !== false).length;
    const totalCapacity = groupList.reduce((s, g) => s + (g.capacity ?? 0), 0);
    const totalEnrolled = groupList.reduce((s, g) => s + getEnrolledCount(g), 0);
    const utilizationPct =
      totalCapacity > 0 ? Math.min(100, Math.round((totalEnrolled / totalCapacity) * 100)) : 0;
    const uniqueRooms = Array.from(
      new Set(groupList.map((g) => g.room?.trim()).filter(Boolean) as string[]),
    ).sort();
    const nearFullCount = groupList.filter((g) => capacityRatio(g) >= 0.85).length;

    return {
      total,
      active,
      totalCapacity,
      totalEnrolled,
      utilizationPct,
      rooms: uniqueRooms.length,
      uniqueRooms,
      nearFullCount,
    };
  }, [groupList]);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const graduateMutation = useMutation({
    mutationFn: () => {
      if (!graduateTarget) return Promise.reject(new Error('No group target'));
      return groupsApi.graduate(graduateTarget.id, {
        targetGroupId: graduateForm.targetGroupId || undefined,
        completionNote: graduateForm.completionNote,
      });
    },
    onSuccess: (res: { graduatedCount?: number } | undefined) => {
      sound.playSuccess();
      push(
        'success',
        `Guruh bitirildi! ${res?.graduatedCount || ''} ta talaba keyingi bosqichga o'tkazildi`,
      );
      setGraduateTarget(null);
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const create = useMutation({
    mutationFn: () =>
      groupsApi.create({
        name: form.name.trim(),
        courseId: form.courseId,
        teacherId: form.teacherId || undefined,
        capacity: form.capacity ? parseInt(form.capacity, 10) : undefined,
        room: form.room.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      }),
    onSuccess: () => {
      sound.playSuccess();
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

  const remove = useMutation({
    mutationFn: (id: string) => groupsApi.remove(id),
    onSuccess: () => {
      sound.playTick();
      push('success', t('groups.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.groups.details() });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Form Validation & Handlers ───────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof GroupFormState, string>> = {};
    if (!form.name.trim()) errors.name = t('groups.form.nameRequired');
    if (!form.courseId) errors.courseId = t('groups.form.courseRequired');
    if (form.capacity && parseInt(form.capacity, 10) < 1) {
      errors.capacity = t('groups.form.capacityMin');
    }
    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      errors.endDate = t('groups.form.invalidDateRange', "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

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
    sound.playPop();
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, [sound]);

  const handleGroupClick = useCallback(
    (groupId: string) => {
      navigate(`/groups/${groupId}`);
    },
    [navigate],
  );

  const handleOpenGroupSidecar = useCallback(
    (group: Group) => {
      sound.playTick();
      openSidecar(buildGroupInspectorPayload(group, navigate));
    },
    [sound, navigate],
  );

  const handleQuickLook = useCallback(
    (group: Group) => {
      openQuickLook(buildGroupInspectorPayload(group, navigate));
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

  const resetAllFilters = useCallback(() => {
    sound.playTick();
    setSearch('');
    setStatusFilter('ALL');
    setCourseFilter('ALL');
    setTeacherFilter('ALL');
    setCapacityFilter('ALL');
    setSortBy('NAME_ASC');
  }, [sound]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    statusFilter !== 'ALL' ||
    courseFilter !== 'ALL' ||
    teacherFilter !== 'ALL' ||
    capacityFilter !== 'ALL';

  /* ── Filtered & Sorted Groups ─────────────────────────────────────── */
  const filteredGroups = useMemo(() => {
    let list = [...groupList];

    if (statusFilter === 'ACTIVE') list = list.filter((g) => g.isActive !== false);
    else if (statusFilter === 'INACTIVE') list = list.filter((g) => g.isActive === false);

    if (courseFilter !== 'ALL') list = list.filter((g) => g.courseId === courseFilter);
    if (teacherFilter !== 'ALL') list = list.filter((g) => g.teacherId === teacherFilter);

    if (capacityFilter === 'AVAILABLE') {
      list = list.filter((g) => !g.capacity || capacityRatio(g) < 0.8);
    } else if (capacityFilter === 'NEAR_FULL') {
      list = list.filter((g) => g.capacity && capacityRatio(g) >= 0.8 && capacityRatio(g) < 1);
    } else if (capacityFilter === 'FULL') {
      list = list.filter((g) => g.capacity && capacityRatio(g) >= 1);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.course?.name || '').toLowerCase().includes(q) ||
          (g.room || '').toLowerCase().includes(q) ||
          formatTeacherName(g.teacher).toLowerCase().includes(q),
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'CAPACITY_DESC') return capacityRatio(b) - capacityRatio(a);
      if (sortBy === 'ENROLLED_DESC') return getEnrolledCount(b) - getEnrolledCount(a);
      if (sortBy === 'START_DESC') {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0;
        const db = b.startDate ? new Date(b.startDate).getTime() : 0;
        return db - da;
      }
      return a.name.localeCompare(b.name, 'uz');
    });

    return list;
  }, [groupList, statusFilter, courseFilter, teacherFilter, capacityFilter, search, sortBy]);

  /* ── Room Utilization Matrix Grouping ─────────────────────────────── */
  const roomsMatrix = useMemo(() => {
    const map = new Map<string, Group[]>();
    for (const g of filteredGroups) {
      const key = g.room?.trim() || 'Xona biriktirilmagan';
      const arr = map.get(key) || [];
      arr.push(g);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Xona biriktirilmagan') return 1;
      if (b === 'Xona biriktirilmagan') return -1;
      return a.localeCompare(b, 'uz');
    });
  }, [filteredGroups]);

  /* ── Fast Keyboard-First Navigation ─────────────────────────── */
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

  /* ── Global Comfort Shortcuts (/, Cmd+K, N, 1-2-3) ────────────────── */
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inEditable =
        /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (inEditable || modalOpen || graduateTarget !== null || deleteTarget !== null) return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleOpenModal();
      } else if (e.key === '1') {
        setViewMode('list');
      } else if (e.key === '2') {
        setViewMode('grid');
      } else if (e.key === '3') {
        setViewMode('rooms');
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [modalOpen, graduateTarget, deleteTarget, handleOpenModal]);

  /* ── Memory-Safe UTF-8 BOM CSV Exporter ───────────────────────────── */
  const exportGroupsToCSV = useCallback(
    (rowsToExport: Group[]) => {
      if (rowsToExport.length === 0) return;

      const escapeCsvCell = (val: unknown): string => {
        const str = String(val ?? '').replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'ID',
        'Guruh nomi',
        'Kurs',
        "O'qituvchi",
        'Xona',
        "O'quvchilar soni",
        "Sig'im",
        'Holati',
        'Boshlanish sanasi',
      ];

      const lines = [
        headers.map(escapeCsvCell).join(','),
        ...rowsToExport.map((g) =>
          [
            g.id,
            g.name,
            g.course?.name || '',
            formatTeacherName(g.teacher),
            g.room || '',
            getEnrolledCount(g),
            g.capacity || '',
            g.isActive !== false ? 'Faol' : 'Nofaol',
            g.startDate ? new Date(g.startDate).toLocaleDateString('uz-UZ') : '',
          ]
            .map(escapeCsvCell)
            .join(','),
        ),
      ];

      const csvBlob = new Blob(['\uFEFF' + lines.join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `m-edu-groups-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      sound.playSuccess();
      push('success', `${rowsToExport.length} ta guruh CSV formatida yuklandi`);
    },
    [push, sound],
  );

  const handleExportSelectedGroupsCSV = useCallback(() => {
    const selectedRows = filteredGroups.filter((g) => isSelected(g.id));
    exportGroupsToCSV(selectedRows);
  }, [filteredGroups, isSelected, exportGroupsToCSV]);

  /* ── Parallel Batch Delete with Confirmation ──────────────────────── */
  const executeBatchDeleteGroups = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleting(true);

    const results = await Promise.allSettled(
      Array.from(selectedIds).map((id) => groupsApi.remove(id)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;

    setIsBatchDeleting(false);
    setBatchDeleteConfirmOpen(false);
    qc.invalidateQueries({ queryKey: queryKeys.groups.all() });
    qc.invalidateQueries({ queryKey: queryKeys.groups.selectors() });
    clearSelection();

    if (succeeded > 0) {
      sound.playTick();
      push('success', `${succeeded} ta guruh muvaffaqiyatli o'chirildi`);
    } else {
      push('error', "Guruhlarni o'chirishda xatolik yuz berdi");
    }
  }, [selectedIds, qc, clearSelection, sound, push]);

  /* ── Loading State ────────────────────────────────────────────────── */
  if (groups.isLoading && !data) {
    return (
      <div className="page-container space-y-5">
        <GroupsSkeleton />
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
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
          HERO HEADER WITH CENTER UTILIZATION TELEMETRY
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 p-5 sm:p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-card">
          {/* Specular Top Hairline & Ambient Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/25"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#007AFF]/10 blur-3xl dark:bg-[#007AFF]/15"
          />

          <div className="relative flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
              {/* Apple Icon Squircle */}
              <div className="relative flex h-13 w-13 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#0051D5] text-white shadow-[0_8px_22px_rgba(0,122,255,0.28)] ring-1 ring-white/25">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0)_55%)]"
                />
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

                  {stats.totalCapacity > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-600 dark:text-purple-400 tabular-nums border border-purple-500/20">
                      Bandlik: {stats.utilizationPct}% ({stats.totalEnrolled}/{stats.totalCapacity})
                    </span>
                  )}
                </div>

                <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl font-display">
                  {t('groups.title')}
                </h1>
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  {t('groups.pageSubtitle')}
                </p>
              </div>
            </div>

            {/* Right Actions: Quick CSV + Create CTA */}
            <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
              {filteredGroups.length > 0 && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => exportGroupsToCSV(filteredGroups)}
                  title="Joriy ro'yxatni CSV (Excel) formatida yuklab olish"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-white/70 dark:bg-white/[0.05] px-3.5 text-[12.5px] font-semibold text-[var(--text-primary)] hover:bg-white dark:hover:bg-white/[0.09] transition-all"
                >
                  <Icon paths={I.download} size={14} strokeWidth={2.2} />
                  <span className="hidden sm:inline">CSV Eksport</span>
                </motion.button>
              )}

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
                  onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    <span>{t('groups.create')}</span>
                    <kbd className="hidden sm:inline-block ml-1 rounded bg-white/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
                      N
                    </kbd>
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI STATS BAR
      ============================================================ */}
      {groupList.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile
            data-testid="groups-metric-blue"
            label={t('groups.title')}
            value={stats.total}
            subtext={`${stats.active} faol`}
            icon={I.groups}
            tone="blue"
          />
          <KpiTile
            data-testid="groups-metric-green"
            label={t('enum.status.ACTIVE')}
            value={stats.active}
            subtext={
              stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% ulush` : undefined
            }
            icon={I.checkCircle}
            tone="emerald"
          />
          <KpiTile
            label={t('groups.col.capacity')}
            value={stats.totalCapacity}
            subtext={`${stats.totalEnrolled} o'quvchi (${stats.utilizationPct}%)`}
            icon={I.users}
            tone="purple"
          />
          <KpiTile
            label={t('groups.col.room')}
            value={stats.rooms}
            subtext={stats.nearFullCount > 0 ? `${stats.nearFullCount} ta to'lish arafasida` : 'Auditoriyalar'}
            icon={I.door}
            tone="orange"
          />
        </motion.div>
      )}

      {/* ============================================================
          APPLE SPOTLIGHT FILTER, SORT & VIEW MATRIX TOOLBAR
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white/85 p-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Left: Spotlight Search with Keyboard Shortcut Badge */}
          <div className="relative flex-1 min-w-[240px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[var(--text-tertiary)]">
              <Icon paths={I.search} size={15} strokeWidth={2.2} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              data-testid="groups-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Guruh nomi, kurs, xona yoki o'qituvchi bo'yicha qidirish..."
              className="w-full h-10 pl-10 pr-16 text-[13px] font-medium rounded-xl border border-black/[0.06] bg-white/90 dark:bg-surface-800/90 dark:border-white/[0.08] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 focus:border-[#007AFF] transition-all"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-2.5 gap-1">
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Tozalash"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Icon paths={I.x} size={13} strokeWidth={2.5} />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden sm:inline-flex items-center rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.03] dark:bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-tertiary)]">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Right: Segmented Status + View Switcher */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
            {/* Apple Sliding Pill Segmented Control for Status */}
            <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
              {(
                [
                  { key: 'ALL', label: 'Hammasi', count: stats.total, testId: undefined },
                  {
                    key: 'ACTIVE',
                    label: 'Faol',
                    count: stats.active,
                    testId: 'groups-status-ACTIVE',
                  },
                  {
                    key: 'INACTIVE',
                    label: 'Nofaol',
                    count: stats.total - stats.active,
                    testId: undefined,
                  },
                ] as const
              ).map((tab) => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    data-testid={tab.testId}
                    onClick={() => {
                      sound.playTick();
                      setStatusFilter(tab.key);
                    }}
                    className={`relative px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-colors ${
                      active
                        ? tab.key === 'ACTIVE'
                          ? 'text-[#28A745] dark:text-[#34C759]'
                          : 'text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="groupsStatusPill"
                        transition={SPRING.snappy}
                        className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-surface-800"
                      />
                    )}
                    <span className="relative z-10">
                      {tab.label}{' '}
                      <span className="ml-0.5 font-mono text-[10.5px] opacity-70">
                        ({tab.count})
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tri-Mode View Switcher: List | Grid | Rooms Matrix */}
            <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06] border border-black/[0.04] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => {
                  sound.playTick();
                  setViewMode('list');
                }}
                aria-label="Ro'yxat ko'rinishi"
                title="Ro'yxat ko'rinishi (1)"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-[#007AFF] shadow-xs dark:bg-surface-800'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon paths={I.list} size={15} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                data-testid="groups-view-grid"
                onClick={() => {
                  sound.playTick();
                  setViewMode('grid');
                }}
                aria-label="Kataklar (Grid) ko'rinishi"
                title="Kataklar ko'rinishi (2)"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#007AFF] shadow-xs dark:bg-surface-800'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon paths={I.grid} size={15} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                data-testid="groups-view-rooms"
                onClick={() => {
                  sound.playTick();
                  setViewMode('rooms');
                }}
                aria-label="Xonalar kesimida ko'rish"
                title="Xonalar matritsasi (3)"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'rooms'
                    ? 'bg-white text-[#007AFF] shadow-xs dark:bg-surface-800'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon paths={I.door} size={15} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Precision Filter Bar: Course, Teacher, Capacity, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.04] dark:border-white/[0.05] pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Course dropdown */}
            {courseList.length > 0 && (
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="h-8.5 px-2.5 text-[12px] font-semibold rounded-xl border border-black/[0.06] bg-white/80 dark:bg-surface-800/80 dark:border-white/[0.08] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 cursor-pointer transition-all"
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

            {/* Teacher dropdown */}
            {teacherList.length > 0 && (
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="h-8.5 px-2.5 text-[12px] font-semibold rounded-xl border border-black/[0.06] bg-white/80 dark:bg-surface-800/80 dark:border-white/[0.08] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 cursor-pointer transition-all"
                aria-label="O'qituvchi bo'yicha saralash"
              >
                <option value="ALL">Barcha o&apos;qituvchilar</option>
                {teacherList.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {formatTeacherName(teacher)}
                  </option>
                ))}
              </select>
            )}

            {/* Capacity filter */}
            <select
              value={capacityFilter}
              onChange={(e) => setCapacityFilter(e.target.value as CapacityFilter)}
              className="h-8.5 px-2.5 text-[12px] font-semibold rounded-xl border border-black/[0.06] bg-white/80 dark:bg-surface-800/80 dark:border-white/[0.08] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 cursor-pointer transition-all"
              aria-label="Sig'im holati bo'yicha saralash"
            >
              <option value="ALL">Sig&apos;im: Barchasi</option>
              <option value="AVAILABLE">Bo&apos;sh joy bor (&lt;80%)</option>
              <option value="NEAR_FULL">To&apos;lish arafasida (80–99%)</option>
              <option value="FULL">To&apos;lgan (100%)</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex h-8.5 items-center gap-1 rounded-xl bg-[#FF3B30]/10 px-2.5 text-[11.5px] font-semibold text-[#FF3B30] hover:bg-[#FF3B30]/15 transition-colors"
              >
                <Icon paths={I.x} size={12} strokeWidth={2.5} />
                <span>Tozalash</span>
              </button>
            )}
          </div>

          {/* Right: Sort Selector & Result Count */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-[11.5px] font-medium text-[var(--text-tertiary)] tabular-nums">
              Ko&apos;rsatilmoqda: <strong className="text-[var(--text-primary)]">{filteredGroups.length}</strong> ta
            </span>

            <div className="relative inline-flex items-center">
              <Icon
                paths={I.sort}
                size={13}
                strokeWidth={2.2}
                className="pointer-events-none absolute left-2.5 text-[var(--text-tertiary)]"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                aria-label="Tartiblash turi"
                className="h-8.5 pl-7 pr-2.5 text-[12px] font-semibold rounded-xl border border-black/[0.06] bg-white/80 dark:bg-surface-800/80 dark:border-white/[0.08] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/40 cursor-pointer transition-all"
              >
                <option value="NAME_ASC">Tartib: A → Z</option>
                <option value="ENROLLED_DESC">O&apos;quvchi soni (ko&apos;p)</option>
                <option value="CAPACITY_DESC">Bandlik foizi (yuqori)</option>
                <option value="START_DESC">Yangi ochilganlar</option>
              </select>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          GROUPS CONTENT (EMPTY / LIST / GRID / ROOMS MATRIX)
      ============================================================ */}
      {groupList.length === 0 ? (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 p-10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-card text-center"
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
                  onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                >
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
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 p-10 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-card text-center"
        >
          <div className="flex flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-tertiary)]">
              <Icon paths={I.search} size={20} strokeWidth={2} />
            </div>
            <p className="mt-3 text-[14px] font-bold text-[var(--text-primary)]">
              Mos keluvchi guruh topilmadi
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">
              Qidiruv so&apos;zini yoki tanlangan filtrlarni o&apos;zgartirib ko&apos;ring
            </p>
            <button
              type="button"
              onClick={resetAllFilters}
              className="mt-4 px-4 py-2 text-[12.5px] font-semibold rounded-xl bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-[var(--text-primary)] transition-colors"
            >
              Filtrlarni tozalash
            </button>
          </div>
        </motion.div>
      ) : viewMode === 'list' ? (
        /* ── 1. LIST VIEW ───────────────────────────────────────────── */
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-card divide-y divide-black/[0.05] dark:divide-white/[0.05]"
        >
          {/* Header Row with Select All + Keyboard Hints */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/[0.05] dark:border-white/[0.05] text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                aria-label="Barcha guruhlarni tanlash"
                checked={
                  filteredGroups.length > 0 && selectedCount === filteredGroups.length
                }
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

            <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] normal-case tracking-normal text-[var(--text-tertiary)]">
              <kbd className="rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5">
                Space
              </kbd>
              <span>Quick-Look</span>
              <span>·</span>
              <kbd className="rounded border border-black/10 dark:border-white/10 px-1.5 py-0.5">
                ↵
              </kbd>
              <span>Ochish</span>
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
                transition={{ ...SPRING.smooth, delay: Math.min(idx * 0.015, 0.25) }}
                className={`group flex cursor-pointer flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 transition-all ${
                  isRowFocused
                    ? 'ring-2 ring-inset ring-[#007AFF] bg-brand-500/[0.06]'
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
                    aria-label={isRowSelected ? 'Tanlovni bekor qilish' : 'Tanlash'}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
                  />

                  <div
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105"
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
                          <Icon
                            paths={I.calendar}
                            size={10}
                            strokeWidth={2.2}
                            className="opacity-60"
                          />
                          {new Date(group.startDate).toLocaleDateString('uz-UZ')}
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

                  <div className="hidden flex-col items-end md:flex min-w-[140px]">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {t('groups.col.capacity')}
                    </span>
                    <div className="mt-0.5">
                      <CapacityBar group={group} showPercent />
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
                      title="Sidecar tafsilotlari (Split-View)"
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
                          completionNote:
                            "Guruh bitirildi va talabalar keyingi bosqichga muvaffaqiyatli o'tkazildi",
                        });
                      }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label="Bosqichdan o'tkazish (Graduate & Promote)"
                      title="Guruhni bitirish & Talabalarni keyingi bosqichga o'tkazish"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#34C759]/20 bg-[#34C759]/10 text-[#28A745] dark:text-[#34C759] hover:bg-[#34C759]/15 transition-colors"
                    >
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

                  <span
                    className="hidden items-center text-[var(--text-tertiary)] transition-transform group-hover:translate-x-0.5 sm:flex"
                    aria-hidden="true"
                  >
                    <Icon paths={I.arrowRight} size={14} strokeWidth={2.2} />
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      ) : viewMode === 'grid' ? (
        /* ── 2. BENTO GRID VIEW ─────────────────────────────────────── */
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
                whileHover={{ y: -3 }}
                transition={{ ...SPRING.smooth, delay: Math.min(idx * 0.02, 0.25) }}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-card hover:shadow-card-hover transition-all cursor-pointer ${
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
                        aria-label={isRowSelected ? 'Tanlovni bekor qilish' : 'Tanlash'}
                      >
                        {isRowSelected && (
                          <svg
                            className="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
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
                          {group.startDate
                            ? new Date(group.startDate).toLocaleDateString('uz-UZ')
                            : "Boshlanish sanasi yo'q"}
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
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                      {t('groups.col.capacity')}:
                    </span>
                    <CapacityBar group={group} showPercent />
                  </div>
                </div>

                {/* Card Footer: Actions */}
                <div
                  className="mt-4 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.04] pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5">
                    <motion.button
                      type="button"
                      onClick={() => handleOpenGroupSidecar(group)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      title="Sidecar tafsilotlari (Split-View)"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      <span className="text-[13px] leading-none">◨</span>
                    </motion.button>

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

                    <motion.button
                      type="button"
                      onClick={() => {
                        setGraduateTarget(group);
                        setGraduateForm({
                          targetGroupId: '',
                          completionNote:
                            "Guruh bitirildi va talabalar keyingi bosqichga muvaffaqiyatli o'tkazildi",
                        });
                      }}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      title="Guruhni bitirish & Talabalarni keyingi bosqichga o'tkazish"
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#34C759]/20 bg-[#34C759]/10 text-[#28A745] dark:text-[#34C759] hover:bg-[#34C759]/15 transition-colors"
                    >
                      <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />
                    </motion.button>

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
      ) : (
        /* ── 3. ROOM UTILIZATION MATRIX VIEW ────────────────────────── */
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4"
        >
          {roomsMatrix.map(([roomName, roomGroups]) => {
            const roomStudents = roomGroups.reduce((s, g) => s + getEnrolledCount(g), 0);
            const roomCapacity = roomGroups.reduce((s, g) => s + (g.capacity ?? 0), 0);
            const isUnassigned = roomName === 'Xona biriktirilmagan';

            return (
              <motion.div
                key={roomName}
                variants={cardVariants}
                className="flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white/85 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/85 shadow-card"
              >
                {/* Room Header */}
                <div className="flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{
                        background: isUnassigned ? TONES.gray.bg : TONES.purple.bg,
                        color: isUnassigned ? TONES.gray.fg : TONES.purple.fg,
                        border: `1px solid ${isUnassigned ? TONES.gray.border : TONES.purple.border}`,
                      }}
                    >
                      <Icon paths={I.door} size={16} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[var(--text-primary)]">
                        {isUnassigned ? roomName : `Xona: ${roomName}`}
                      </h3>
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)]">
                        {roomGroups.length} ta guruh · {roomStudents}
                        {roomCapacity > 0 ? ` / ${roomCapacity}` : ''} o&apos;quvchi
                      </p>
                    </div>
                  </div>

                  <span className="rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--text-secondary)]">
                    {roomGroups.length} guruh
                  </span>
                </div>

                {/* Groups inside this Room */}
                <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {roomGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => handleGroupClick(group.id)}
                      className="group flex cursor-pointer items-center justify-between gap-3 px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-bold text-[var(--text-primary)] group-hover:text-[#007AFF] transition-colors">
                            {group.name}
                          </span>
                          {group.course?.name && <CourseChip name={group.course.name} />}
                        </div>
                        <p className="mt-0.5 text-[11.5px] font-medium text-[var(--text-secondary)]">
                          O&apos;qituvchi: {formatTeacherName(group.teacher)}
                        </p>
                      </div>

                      <div
                        className="flex items-center gap-2.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CapacityBar group={group} />
                        <button
                          type="button"
                          onClick={() => handleQuickLook(group)}
                          title="Tezkor ko'rish"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#007AFF]/20 bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/15 transition-colors"
                        >
                          <Icon paths={I.eye} size={12} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Fast Floating Action Island */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        entityName="guruh"
        actions={[
          {
            label: 'CSV Eksport',
            shortcut: 'C',
            icon: <Icon paths={I.download} size={13} strokeWidth={2.2} />,
            variant: 'primary',
            onClick: handleExportSelectedGroupsCSV,
          },
          {
            label: "O'chirish",
            shortcut: 'D',
            icon: <Icon paths={I.trash} size={13} strokeWidth={2} />,
            variant: 'destructive',
            onClick: () => setBatchDeleteConfirmOpen(true),
          },
        ]}
      />

      {/* ============================================================
          CREATE MODAL WITH SMART CAPACITY & ROOM PRESETS
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
              {/* Quick Room Suggestions */}
              {stats.uniqueRooms.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10.5px] font-medium text-[var(--text-tertiary)] mr-1">
                    Mavjud xonalar:
                  </span>
                  {stats.uniqueRooms.slice(0, 5).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, room: r }))}
                      className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold transition-colors ${
                        form.room === r
                          ? 'bg-[#007AFF] text-white'
                          : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
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
              {/* Quick Capacity Presets */}
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-[10.5px] font-medium text-[var(--text-tertiary)] mr-1">
                  Tezkor:
                </span>
                {CAPACITY_PRESETS.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, capacity: cap }))
                    }
                    className={`rounded-md px-2 py-0.5 font-mono text-[10.5px] font-bold transition-colors ${
                      form.capacity === cap
                        ? 'bg-emerald-500 text-white'
                        : 'bg-black/[0.04] dark:bg-white/[0.06] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {cap}
                  </button>
                ))}
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

            <GlassField label={t('groups.form.endDate', 'Tugash sanasi')} error={formErrors.endDate}>
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="cyan" />
                <GlassInput
                  type="date"
                  value={form.endDate}
                  onChange={handleFormChange('endDate')}
                  aria-invalid={Boolean(formErrors.endDate)}
                  aria-describedby={formErrors.endDate ? 'endDate-error' : undefined}
                  className="pl-11"
                />
              </div>
              {formErrors.endDate && (
                <span
                  id="endDate-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {formErrors.endDate}
                </span>
              )}
            </GlassField>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
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

      {/* ============================================================
          GRADUATE & PROMOTE MODAL
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
                «{graduateTarget.name}» guruhi ({getEnrolledCount(graduateTarget)} nafar talaba)ni yangi bosqichga o&apos;tkazish
              </p>
              <p className="mt-1 text-[11px] opacity-80">
                Guruh yakunlanadi, faol talabalarga bitirganlik maqomi beriladi va tanlangan yangi guruhga (masalan: Elementary dan Pre-Intermediate ga) ommaviy o&apos;tkaziladi.
              </p>
            </div>

            <GlassField label="Keyingi bosqich guruhi (ixtiyoriy)">
              <GlassSelect
                value={graduateForm.targetGroupId}
                onChange={(e) =>
                  setGraduateForm({ ...graduateForm, targetGroupId: e.target.value })
                }
              >
                <option value="">Yangi guruhga o&apos;tkazmasdan faqat bitirish...</option>
                {groupList
                  .filter((g) => g.id !== graduateTarget.id && g.isActive !== false)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.course?.name ? `(${g.course.name})` : ''} — {formatCapacity(g)}
                    </option>
                  ))}
              </GlassSelect>
            </GlassField>

            <GlassField label="Bitiruv xulosasi / Izoh">
              <GlassInput
                value={graduateForm.completionNote}
                onChange={(e) =>
                  setGraduateForm({ ...graduateForm, completionNote: e.target.value })
                }
                placeholder="Guruh dasturni muvaffaqiyatli tugatdi..."
              />
            </GlassField>

            <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setGraduateTarget(null)}
              >
                {t('common.cancel')}
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={graduateMutation.isPending}
              >
                {graduateMutation.isPending ? "O'tkazilmoqda..." : "Bitirish va O'tkazish"}
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {/* Single Delete Confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={t('groups.confirmDelete')}
        loading={remove.isPending}
      />

      {/* Batch Delete Confirm */}
      <ConfirmDialog
        open={batchDeleteConfirmOpen}
        onClose={() => setBatchDeleteConfirmOpen(false)}
        onConfirm={executeBatchDeleteGroups}
        description={`Tanlangan ${selectedCount} ta guruhni haqiqatan ham o'chirib tashlamoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.`}
        loading={isBatchDeleting}
      />
    </motion.div>
  );
}