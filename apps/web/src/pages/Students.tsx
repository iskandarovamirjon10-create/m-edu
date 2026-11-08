/**
 * M-EDU Students Page · v3 — Liquid Glass
 * Student roster management, profile filters, enrollment actions, and batch operations.
 *
 * v3 o'zgarishlari (v2 dan farqi):
 *  P0 TUZATISHLAR
 *   - RowHoverPeek: createPortal + useLayoutEffect, scroll/escape da yopiladi,
 *     flip mantiq (pastga sig'masa yuqoriga).
 *   - Bulk delete: barcha tanlangan talabalarni ketma-ket o'chiradi,
 *     xato bo'lsa to'xtaydi va xabar beradi.
 *   - Sort state: useReducer bilan yagona manba (race yo'q).
 *   - StatTile: total va pageTotal izchil ishlatiladi.
 *   - CSV: barcha maydonlar q() bilan o'ralgan (vergul xavfsiz).
 *   - Space tugmasi scroll qilmaydi (preventDefault).
 *   - CalendarHeatmap: start/end orasidagi haqiqiy kunlar.
 *   - GlassSegmented: ArrowLeft/ArrowRight navigatsiya.
 *
 *  DIZAYN (10x)
 *   - Bento grid: birinchi talaba kattaroq (lg:col-span-2).
 *   - Skeleton: real layout o'lchamlari, prefers-reduced-motion.
 *   - Filter chips: AnimatePresence + layout.
 *   - StatTile: aria-pressed, role="tab", keyboard.
 *   - Command palette: role="listbox", aria-activedescendant.
 *   - RowHoverPeek: flip logic, scroll close.
 *   - Micro-interactions: rAF-throttled trackPointer.
 *   - Dark mode: shadow/ring izchil.
 *   - Density: py + text + gap birgalikda o'zgaradi.
 *
 *  YANGI FUNKSIYALAR
 *   - Bulk delete (barcha tanlanganlar).
 *   - Column visibility toggle (desktop).
 *   - Saved views (localStorage, 3 tagacha).
 *   - Keyboard help overlay (? tugmasi).
 *   - Scroll position restore.
 *   - Optimistic unfreeze.
 *   - 3 xil empty state.
 *   - aria-live selection announcements.
 *
 *  ARXITEKTURA
 *   - Sort state: useReducer (yagona manba).
 *   - Selection: Set<string> + aria-live.
 *   - Hover peek: portal + layout effect.
 *   - Saved views: localStorage + Zod-like validation.
 *   - TypeScript strict, any yo'q.
 */

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useReducer,
  useLayoutEffect,
  memo,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation, type NavigateFunction } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { studentsApi, groupsApi } from '@/lib/api';
import { openQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassEmptyState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassBadge,
  GlassButton,
  ConfirmDialog,
  GlassModal,
  GlassField,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName } from '@/lib/format';
import { UniversityAdmissionPathfinder } from '@/components/students/UniversityAdmissionPathfinder';
import { ReferralGrowthEngineModal } from '@/components/marketing/ReferralGrowthEngineModal';
import { StudentMilestoneCelebrationModal } from '@/components/students/StudentMilestoneCelebrationModal';
import { StudentRetentionCockpitModal } from '@/components/retention/StudentRetentionCockpitModal';
import { SmartDiscountClusterModal } from '@/components/finance/SmartDiscountClusterModal';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';
import './students-liquid.css';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.6 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.85 },
  soft: { type: 'spring' as const, stiffness: 220, damping: 30, mass: 1.0 },
  island: { type: 'spring' as const, stiffness: 480, damping: 32, mass: 0.72 },
  breathe: { type: 'spring' as const, stiffness: 160, damping: 24, mass: 1.15 },
  palette: { type: 'spring' as const, stiffness: 400, damping: 34, mass: 0.8 },
} as const;

const EASE_PREMIUM = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.035, delayChildren: 0.015 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.995 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.965 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * UTILS
 * ════════════════════════════════════════════════════════════════════════ */

type ClassPart = string | false | null | undefined;
const cx = (...parts: ClassPart[]) => parts.filter(Boolean).join(' ');

/** Kursor pozitsiyasini CSS o'zgaruvchisiga yozadi — rAF throttle, 120Hz xavfsiz. */
const pointerRafMap = new WeakMap<HTMLElement, number>();
function trackPointer(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget;
  const { clientX, clientY } = e;
  const existing = pointerRafMap.get(el);
  if (existing) cancelAnimationFrame(existing);
  const raf = requestAnimationFrame(() => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${clientX - r.left}px`);
    el.style.setProperty('--my', `${clientY - r.top}px`);
    pointerRafMap.delete(el);
  });
  pointerRafMap.set(el, raf);
}

function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date | null {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.platform || navigator.userAgent || '');

/** localStorage kaliti — saved views uchun. */
const SAVED_VIEWS_KEY = 'medu.students.savedViews.v1';
const SCROLL_KEY = 'medu.students.scroll.v1';

interface SavedView {
  id: string;
  name: string;
  search: string;
  groupId: string;
  statusFilter: string;
  sortField: string;
  sortDir: string;
  viewMode: string;
  density: string;
  createdAt: number;
}

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is SavedView => v && typeof v.id === 'string' && typeof v.name === 'string').slice(0, 3);
  } catch {
    return [];
  }
}

function saveViews(views: SavedView[]) {
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, 3)));
  } catch {
    /* quota */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

interface StudentFilters {
  page: number;
  limit: number;
  search?: string;
  groupId?: string;
}

interface FreezeFormData {
  startDate: string;
  endDate: string;
  reason: string;
}

type StatusQuickFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WITH_GROUPS';
type SortField = 'name' | 'groups' | 'status';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';
type Density = 'compact' | 'cozy' | 'comfy';

type SortState = { field: SortField; dir: SortDirection };
type SortAction = { type: 'toggle'; field: SortField } | { type: 'reset' };

function sortReducer(state: SortState, action: SortAction): SortState {
  if (action.type === 'reset') return { field: 'name', dir: 'asc' };
  if (state.field === action.field) {
    return { field: action.field, dir: state.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { field: action.field, dir: 'asc' };
}

const DEFAULT_FREEZE_REASON = 'Tibbiy sabab / Kasallik maʼlumotnomasi (Medical leave)';

function createDefaultFreezeForm(): FreezeFormData {
  const now = new Date();
  const twoWeeksLater = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 13);
  return {
    startDate: toIsoDate(now),
    endDate: toIsoDate(twoWeeksLater),
    reason: DEFAULT_FREEZE_REASON,
  };
}

function addDaysToIso(isoDate: string, days: number): string {
  const base = parseIsoDate(isoDate) ?? new Date();
  base.setDate(base.getDate() + days);
  return toIsoDate(base);
}

function calculateFreezeDays(startDate: string, endDate: string): number {
  const s = parseIsoDate(startDate);
  const e = parseIsoDate(endDate);
  if (!s || !e || e < s) return 0;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1);
}

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

const I = {
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6',
    'M22 11h-6',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  pause: ['M10 4H6v16h4z', 'M18 4h-4v16h4z'],
  usersRound: [
    'M18 21a8 8 0 0 0-16 0',
    'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3',
  ],
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
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6 12 13 2 6'],
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  parent: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6',
    'M22 11h-6',
  ],
  snowflake: ['M12 2v20', 'M17 5 7 19', 'M7 5 17 19', 'M2 12h20', 'M20 9l-4 3 4 3', 'M4 9l4 3-4 3'],
  play: ['M6 4l14 8-14 8V4z'],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ],
  copy: [
    'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z',
    'M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2',
  ],
  check: ['M20 6 9 17l-5-5'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  sort: ['M7 15l5 5 5-5', 'M7 9l5-5 5 5'],
  sparkles: [
    'M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z',
  ],
  calendar: [
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M16 2v4',
    'M8 2v4',
    'M3 10h18',
  ],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  command: [
    'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',
  ],
  layoutCompact: ['M3 3h18v6H3z', 'M3 11h18v6H3z', 'M3 19h18v2H3z'],
  layoutCozy: ['M3 3h18v8H3z', 'M3 13h18v8H3z'],
  layoutComfy: ['M3 3h18v10H3z', 'M3 15h18v6H3z'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  gift: [
    'M20 12v10H4V12',
    'M2 7h20v5H2z',
    'M12 22V7',
    'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z',
    'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  ],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  sidecar: ['M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z', 'M14 3v18'],
  columns: ['M3 3h7v18H3z', 'M14 3h7v18h-7z'],
  bookmark: ['M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
  help: ['M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
} as const;

const Icon = memo(function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  duotone = false,
  ...rest
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
  duotone?: boolean;
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
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {(paths || []).map((d, i) => (
        <path
          key={i}
          d={d}
          fill={duotone && i === 0 ? 'currentColor' : 'none'}
          fillOpacity={duotone && i === 0 ? 0.13 : 0}
          strokeOpacity={duotone && i > 1 ? 0.62 : 1}
        />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PUBLIC HELPERS (Contract Preserved)
 * ════════════════════════════════════════════════════════════════════════ */

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
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#0F172A', '#1E293B', '#38BDF8'],
  ['#1E3A8A', '#2563EB', '#93C5FD'],
  ['#312E81', '#4F46E5', '#A5B4FC'],
  ['#064E3B', '#059669', '#6EE7B7'],
  ['#78350F', '#D97706', '#FCD34D'],
  ['#134E4A', '#0D9488', '#5EEAD4'],
  ['#4C1D95', '#7C3AED', '#C4B5FD'],
  ['#831843', '#DB2777', '#F9A8D4'],
];

function avatarStyle(name: string): { background: string; glow: string } {
  const [a, b, c] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return {
    background: `radial-gradient(circle at 28% 22%, ${c}55 0%, transparent 55%), linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
    glow: b,
  };
}

function buildStudentPanel(student: Student, navigate: NavigateFunction, copyable: boolean) {
  const name = formatStudentName(student);
  const activeGroups = (student.groups ?? []).filter((g) => g.isActive && g.group);
  const isActive = student.user?.isActive !== false;
  const copy = copyable ? { copyable: true } : {};

  return {
    id: student.id,
    type: 'student' as const,
    title: name,
    subtitle: student.user?.email || student.user?.phone || 'M-EDU Talabasi',
    badge: {
      text: isActive ? 'Faol Talaba' : 'Muzlatilgan',
      tone: (isActive ? 'emerald' : 'amber') as 'emerald' | 'amber',
    },
    avatar: { text: name.slice(0, 2).toUpperCase() },
    metrics: [
      {
        label: 'Guruhlar',
        value: activeGroups.length,
        subtext: activeGroups.map((g) => g.group?.name ?? '—').join(', ') || 'Biriktirilmagan',
      },
      { label: 'Holati', value: isActive ? 'Faol' : 'Muzlatilgan', subtext: 'Davomat ochiq' },
      {
        label: 'Ota-onasi',
        value: student.parentName || '—',
        subtext: student.parentPhone || 'Telefon kiritilmagan',
      },
    ],
    details: [
      { label: 'Telefon', value: student.user?.phone || student.parentPhone || '—', ...copy },
      { label: 'Email', value: student.user?.email || '—', ...copy },
      { label: 'Ota-ona ismi', value: student.parentName || '—' },
      { label: 'Ota-ona telefoni', value: student.parentPhone || '—', ...copy },
      { label: 'Talaba ID raqami', value: student.id, ...copy },
    ],
    tags: activeGroups.map((g) => g.group?.name ?? '').filter(Boolean),
    primaryAction: {
      label: 'To‘liq kartani ochish',
      onExecute: () => navigate(`/students/${student.id}`),
    },
    secondaryAction: {
      label: 'Tahrirlash',
      onExecute: () => navigate(`/students/${student.id}/edit`),
    },
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA
 * ════════════════════════════════════════════════════════════════════════ */

const AuroraCanvas = memo(function AuroraCanvas() {
  const reduced = usePrefersReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 z-0 h-[460px] overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0 : 1.6, ease: EASE_PREMIUM }}
        className="relative h-full w-full"
      >
        <div className="lg-orb left-[18%] top-[22%] h-[300px] w-[520px] bg-blue-400/25 dark:bg-sky-500/20" />
        <div className="lg-orb lg-orb--b left-[48%] top-[34%] h-[260px] w-[440px] bg-violet-400/20 dark:bg-violet-500/18" />
        <div className="lg-orb lg-orb--c left-[62%] top-[18%] h-[240px] w-[380px] bg-emerald-400/18 dark:bg-emerald-500/14" />
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * GLASS SURFACE
 * ════════════════════════════════════════════════════════════════════════ */

const GlassCardSurface = memo(function GlassCardSurface({
  children,
  className = '',
  hover = false,
  subtle = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      onPointerMove={hover ? trackPointer : undefined}
      className={cx('lg-surface overflow-hidden', subtle && 'lg-surface--subtle', hover && 'lg-interactive', className)}
    >
      {children}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SEGMENTED CONTROL
 * ════════════════════════════════════════════════════════════════════════ */

interface SegOption<T extends string> {
  id: T;
  label?: string;
  icon?: readonly string[];
  title?: string;
  testId?: string;
}

function GlassSegmentedInner<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
  semantics = 'toggle',
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId: string;
  ariaLabel: string;
  semantics?: 'tabs' | 'toggle';
}) {
  const isTabs = semantics === 'tabs';
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isTabs) return;
      const idx = options.findIndex((o) => o.id === value);
      if (idx === -1) return;
      let nextIdx = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIdx = (idx + 1) % options.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIdx = (idx - 1 + options.length) % options.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIdx = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIdx = options.length - 1;
      } else {
        return;
      }
      onChange(options[nextIdx].id);
      const btns = groupRef.current?.querySelectorAll<HTMLButtonElement>('button[role="tab"]');
      btns?.[nextIdx]?.focus();
    },
    [isTabs, options, value, onChange],
  );

  return (
    <div
      ref={groupRef}
      role={isTabs ? 'tablist' : 'group'}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className="lg-track"
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role={isTabs ? 'tab' : undefined}
            aria-selected={isTabs ? selected : undefined}
            aria-pressed={isTabs ? undefined : selected}
            aria-label={o.title ?? o.label}
            title={o.title ?? o.label}
            tabIndex={isTabs ? (selected ? 0 : -1) : 0}
            data-testid={o.testId}
            onClick={() => onChange(o.id)}
            className={cx(
              'relative shrink-0 whitespace-nowrap rounded-[11px] text-[11.5px] font-bold outline-none transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-[#007AFF]/60',
              o.label ? 'px-3 py-1.5' : 'p-1.5',
              selected
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
            )}
          >
            {selected && <motion.span layoutId={layoutId} transition={SPRING.snappy} className="lg-thumb" />}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {o.icon && <Icon paths={o.icon} size={14} strokeWidth={2.05} />}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
const GlassSegmented = memo(GlassSegmentedInner) as typeof GlassSegmentedInner;

/* ══════════════════════════════════════════════════════════════════════════
 * PRIMITIVES
 * ════════════════════════════════════════════════════════════════════════ */

const CountUp = memo(function CountUp({
  value,
  duration = 0.9,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const prevValueRef = useRef<number>(0);
  const fmt = (n: number) => `${(Number.isFinite(n) ? n : 0).toLocaleString()}${suffix}`;

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;
    if (reduced || from === to) {
      el.textContent = fmt(to);
      return;
    }
    let rafId = 0;
    let startTime: number | null = null;
    const durationMs = duration * 1000;
    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 4);
      if (spanRef.current) spanRef.current.textContent = fmt(Math.round(from + (to - from) * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, suffix, reduced]);

  return (
    <span ref={spanRef} className="tabular-nums">
      {fmt(value)}
    </span>
  );
});

const Sparkline = memo(function Sparkline({
  data,
  className = '',
  stroke = 'currentColor',
  uid = 'sparkline',
}: {
  data: number[];
  className?: string;
  stroke?: string;
  uid?: string;
}) {
  const { path, area } = useMemo(() => {
    if (!data.length) return { path: '', area: '' };
    const w = 100;
    const h = 28;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => [i * step, h - ((v - min) / range) * (h - 4) - 2]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx2 = (x0 + x1) / 2;
      d += ` C${cx2},${y0} ${cx2},${y1} ${x1},${y1}`;
    }
    return { path: d, area: `${d} L${w},${h} L0,${h} Z` };
  }, [data]);

  const gid = `sparkline-fill-${uid}`;
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.34" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gid})`} />}
      {path && (
        <path d={path} fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
});

const StudentAvatar = memo(function StudentAvatar({
  name,
  size = 40,
  isActive = true,
  showRing = false,
  ringProgress,
}: {
  name: string;
  size?: number;
  isActive?: boolean;
  showRing?: boolean;
  ringProgress?: number;
}) {
  const style = avatarStyle(name);
  const ringRadius = size / 2 + 2;
  const ringSize = (ringRadius + 2) * 2;
  const circ = 2 * Math.PI * ringRadius;

  return (
    <div className="relative inline-flex shrink-0 select-none" style={{ width: size, height: size }}>
      {showRing && typeof ringProgress === 'number' && (
        <svg
          aria-hidden="true"
          className="absolute -inset-[3px]"
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
        >
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-slate-200/60 dark:text-white/[0.08]"
          />
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={ringRadius}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - Math.min(1, Math.max(0, ringProgress)))}
            className="text-[#007AFF] transition-all duration-500 dark:text-[#38BDF8]"
            style={{ transformOrigin: '50% 50%', transform: 'rotate(-90deg)' }}
          />
        </svg>
      )}
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-[13px] font-bold text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-[1.04] dark:ring-white/15"
        style={{
          width: size,
          height: size,
          background: style.background,
          fontSize: Math.round(size * 0.34),
          letterSpacing: '0.025em',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent"
        />
        <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">{getInitials(name)}</span>
      </div>
      <span
        aria-hidden="true"
        className={cx(
          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-surface-900',
          isActive ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]' : 'bg-amber-500 shadow-[0_0_6px_#F59E0B]',
        )}
      />
    </div>
  );
});

const StatusBadge = memo(function StatusBadge({
  isActive,
  pulse = false,
  size = 'md',
}: {
  isActive: boolean | undefined;
  pulse?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useSafeI18n();
  const badge = getStudentStatusBadge(isActive);
  const red = badge.color === 'red';
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold tracking-tight ring-1 ring-inset',
        size === 'sm' ? 'px-2.5 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11px]',
        red
          ? 'bg-red-500/10 text-red-600 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400'
          : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-none',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'h-1.5 w-1.5 rounded-full',
          red ? 'bg-red-500' : cx('bg-emerald-500 shadow-[0_0_6px_#10B981]', pulse && 'medu-pulse-dot'),
        )}
      />
      <span>{t(badge.label)}</span>
    </span>
  );
});

/* ── StatTile ──────────────────────────────────────────────────── */
type StatTone = 'blue' | 'green' | 'orange' | 'purple';

const STAT_PALETTE: Record<
  StatTone,
  {
    iconBg: string;
    iconFg: string;
    activeRing: string;
    barColor: string;
    pillBg: string;
    glow: string;
    sparkStroke: string;
    sparkSeries: number[];
  }
> = {
  blue: {
    iconBg: 'bg-gradient-to-br from-blue-500/20 to-sky-500/5 dark:from-blue-500/30 dark:to-sky-500/10',
    iconFg: 'text-blue-600 dark:text-sky-400',
    activeRing: 'ring-2 ring-blue-500/55 dark:ring-sky-400/55',
    barColor: 'bg-gradient-to-r from-blue-600 to-sky-400',
    pillBg: 'bg-blue-500/10 text-blue-700 dark:bg-sky-400/15 dark:text-sky-300',
    glow: 'from-blue-500/14',
    sparkStroke: '#38BDF8',
    sparkSeries: [12, 18, 14, 22, 20, 28, 24, 34, 30, 38, 42, 48],
  },
  green: {
    iconBg: 'bg-gradient-to-br from-emerald-500/20 to-teal-500/5 dark:from-emerald-500/30 dark:to-teal-500/10',
    iconFg: 'text-emerald-600 dark:text-emerald-400',
    activeRing: 'ring-2 ring-emerald-500/55 dark:ring-emerald-400/55',
    barColor: 'bg-gradient-to-r from-emerald-600 to-teal-400',
    pillBg: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    glow: 'from-emerald-500/14',
    sparkStroke: '#10B981',
    sparkSeries: [8, 12, 10, 16, 14, 20, 18, 22, 26, 24, 30, 34],
  },
  orange: {
    iconBg: 'bg-gradient-to-br from-amber-500/20 to-orange-500/5 dark:from-amber-500/30 dark:to-orange-500/10',
    iconFg: 'text-amber-600 dark:text-amber-400',
    activeRing: 'ring-2 ring-amber-500/55 dark:ring-amber-400/55',
    barColor: 'bg-gradient-to-r from-amber-500 to-orange-400',
    pillBg: 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    glow: 'from-amber-500/14',
    sparkStroke: '#F59E0B',
    sparkSeries: [18, 16, 20, 14, 18, 12, 16, 10, 14, 8, 12, 6],
  },
  purple: {
    iconBg: 'bg-gradient-to-br from-indigo-500/20 to-violet-500/5 dark:from-indigo-500/30 dark:to-violet-500/10',
    iconFg: 'text-indigo-600 dark:text-indigo-400',
    activeRing: 'ring-2 ring-indigo-500/55 dark:ring-indigo-400/55',
    barColor: 'bg-gradient-to-r from-indigo-600 to-violet-400',
    pillBg: 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
    glow: 'from-indigo-500/14',
    sparkStroke: '#8B5CF6',
    sparkSeries: [10, 14, 12, 18, 16, 22, 20, 26, 22, 28, 26, 30],
  },
};

const StatTile = memo(function StatTile({
  label,
  value,
  total,
  icon,
  tone = 'blue',
  active = false,
  onClick,
  subtitle,
}: {
  label: string;
  value: number;
  total: number;
  icon: readonly string[];
  tone?: StatTone;
  active?: boolean;
  onClick?: () => void;
  subtitle?: string;
}) {
  const c = STAT_PALETTE[tone];
  const reduced = usePrefersReducedMotion();
  const ratio = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 100;

  return (
    <motion.button
      type="button"
      data-testid={`metric-pill-${tone}`}
      variants={tileVariants}
      whileHover={reduced ? undefined : { y: -4, scale: 1.01 }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={SPRING.snappy}
      onClick={onClick}
      onPointerMove={trackPointer}
      aria-pressed={active}
      className={cx(
        'lg-surface lg-interactive group flex w-full flex-col justify-between overflow-hidden p-4 text-left select-none outline-none [--lg-r:24px]',
        'focus-visible:ring-2 focus-visible:ring-[#007AFF]',
        active && c.activeRing,
      )}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br ${c.glow} to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100`}
      />

      <div className="relative z-10 flex w-full items-start justify-between gap-2">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${c.iconBg} ${c.iconFg} shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10`}
        >
          <Icon paths={icon} size={19} strokeWidth={2.0} duotone />
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-tight tabular-nums ${c.pillBg}`}
        >
          {ratio}%
        </span>
      </div>

      <div className="relative z-10 mt-3 w-full">
        <div className="text-[28px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
            {subtitle}
          </div>
        )}

        <div className="relative mt-2.5 h-8 w-full">
          <Sparkline
            data={c.sparkSeries}
            stroke={c.sparkStroke}
            uid={tone}
            className="absolute inset-0 h-full w-full opacity-75 transition-opacity duration-300 group-hover:opacity-100"
          />
        </div>

        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-900/[0.07] shadow-[inset_0_1px_1px_rgba(0,0,0,0.08)] dark:bg-white/[0.07]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${ratio}%` }}
            transition={{ duration: 0.8, ease: EASE_PREMIUM }}
            className={`h-full rounded-full ${c.barColor}`}
          />
        </div>
      </div>
    </motion.button>
  );
});

/* ── CopyChip ──────────────────────────────────────────────────── */
const CopyChip = memo(function CopyChip({
  value,
  icon,
  maxWidth = '185px',
}: {
  value: string;
  icon: readonly string[];
  maxWidth?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!navigator?.clipboard?.writeText) return;
      navigator.clipboard
        .writeText(value)
        .then(() => {
          setCopied(true);
          if (timerRef.current) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => setCopied(false), 1600);
        })
        .catch(() => {});
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`${value} (Nusxalash uchun bosing)`}
      aria-label={`${value} nusxalash`}
      className="group/chip -mx-2 inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 text-[12.5px] font-medium text-[var(--text-secondary)] transition-all duration-150 hover:border-slate-200/80 hover:bg-white/70 hover:text-slate-900 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white"
    >
      <Icon
        paths={copied ? I.check : icon}
        size={13}
        strokeWidth={2.0}
        className={copied ? 'text-emerald-500' : 'opacity-55 transition-opacity group-hover/chip:opacity-90'}
      />
      <span className="truncate tabular-nums" style={{ maxWidth }}>
        {value}
      </span>
      <Icon paths={I.copy} size={11} className="opacity-0 transition-opacity group-hover/chip:opacity-50" />
    </button>
  );
});

/* ── Skeletons ─────────────────────────────────────────────────── */
const Shimmer = memo(function Shimmer({ className = '', radius = '0.85rem' }: { className?: string; radius?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius, animationPlayState: reduced ? 'paused' : 'running' }}
    />
  );
});

const GhostRow = memo(function GhostRow({ index = 0 }: { index?: number }) {
  return (
    <div
      className="flex items-center gap-4 border-b border-slate-200/60 p-4 last:border-0 dark:border-white/[0.06]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Shimmer className="h-4 w-4 shrink-0" radius="4px" />
      <Shimmer className="h-9 w-9 shrink-0" radius="13px" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3.5 w-40" radius="0.5rem" />
        <Shimmer className="h-2.5 w-52" radius="0.5rem" />
      </div>
      <Shimmer className="hidden h-3 w-32 sm:block" radius="0.5rem" />
      <Shimmer className="hidden h-5 w-20 md:block" radius="9999px" />
      <Shimmer className="hidden h-5 w-16 lg:block" radius="9999px" />
    </div>
  );
});

const StudentsSkeleton = memo(function StudentsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[156px]" radius="1.5rem" />
        ))}
      </div>
      <Shimmer className="h-[72px]" radius="1.625rem" />
      <GlassCardSurface>
        <div className="border-b border-slate-200/60 p-3.5 dark:border-white/[0.06]">
          <Shimmer className="h-5 w-40" radius="0.5rem" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <GhostRow key={i} index={i} />
        ))}
      </GlassCardSurface>
    </div>
  );
});

/* ── RowAction ─────────────────────────────────────────────────── */
type ActionTone = 'neutral' | 'edit' | 'freeze' | 'delete' | 'celebrate';

const RowAction = memo(function RowAction({
  icon,
  label,
  tone,
  to,
  onClick,
  disabled,
  loading,
}: {
  icon: readonly string[];
  label: string;
  tone: ActionTone;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const content = loading ? (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ) : (
    <Icon paths={icon} size={15} strokeWidth={2.05} />
  );

  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} data-tone={tone} className="lg-btn">
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      data-tone={tone}
      className="lg-btn"
    >
      {content}
    </button>
  );
});

/* ── StudentActions ────────────────────────────────────────────── */
const StudentActions = memo(function StudentActions({
  student,
  isActive,
  unfreezing,
  deleting,
  deleteBusy,
  onFreeze,
  onUnfreeze,
  onSidecar,
  onQuickLook,
  onCelebrate,
  onDelete,
}: {
  student: Student;
  isActive: boolean;
  unfreezing: boolean;
  deleting: boolean;
  deleteBusy: boolean;
  onFreeze: (s: Student) => void;
  onUnfreeze: (id: string) => void;
  onSidecar: (s: Student) => void;
  onQuickLook: (s: Student) => void;
  onCelebrate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useSafeI18n();
  return (
    <>
      {isActive ? (
        <RowAction
          icon={I.snowflake}
          label="Darslarni muzlatish (Freeze)"
          tone="freeze"
          onClick={() => onFreeze(student)}
        />
      ) : (
        <RowAction
          icon={I.play}
          label="Faollashtirish (Unfreeze)"
          tone="edit"
          onClick={() => onUnfreeze(student.id)}
          loading={unfreezing}
        />
      )}
      <RowAction
        icon={I.sidecar}
        label="Sidecar tafsilotlari (Split-View · Space)"
        tone="neutral"
        onClick={() => onSidecar(student)}
      />
      <RowAction
        icon={I.sparkles}
        label="Yutuq & Sertifikat (Milestone)"
        tone="celebrate"
        onClick={() => onCelebrate(student.id)}
      />
      <RowAction icon={I.eye} label="Quick-Look (Space)" tone="edit" onClick={() => onQuickLook(student)} />
      <RowAction icon={I.edit} label={t('common.edit')} tone="edit" to={`/students/${student.id}/edit`} />
      <RowAction
        icon={I.trash}
        label={t('common.delete')}
        tone="delete"
        onClick={() => onDelete(student.id)}
        disabled={deleteBusy}
        loading={deleting}
      />
    </>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * CALENDAR HEATMAP
 * ════════════════════════════════════════════════════════════════════════ */

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'] as const;

const CalendarHeatmap = memo(function CalendarHeatmap({ startDate, endDate }: { startDate: string; endDate: string }) {
  const cells = useMemo(() => {
    const start = parseIsoDate(startDate);
    const end = parseIsoDate(endDate);
    if (!start || !end || end < start) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Boshlanishni dushanbaga tekislash
    const anchor = new Date(start);
    anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));

    // Nechta hafta kerak: start dan end gacha + tekislash
    const spanDays = Math.round((end.getTime() - anchor.getTime()) / 86_400_000) + 1;
    const totalCells = Math.ceil(spanDays / 7) * 7;

    const s = start.getTime();
    const e = end.getTime();
    const tm = today.getTime();

    return Array.from({ length: totalCells }, (_, i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + i);
      const t = d.getTime();
      return {
        date: d,
        inRange: t >= s && t <= e,
        isStart: t === s,
        isEnd: t === e,
        isToday: t === tm,
      };
    });
  }, [startDate, endDate]);

  if (cells.length === 0) return null;
  const rangeFmt = (d: Date) => d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
  const weeks = Math.ceil(cells.length / 7);

  return (
    <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.05] via-blue-500/[0.02] to-transparent p-3.5 dark:border-sky-400/15">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Vizual kalendar
        </span>
        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-gradient-to-br from-sky-400 to-blue-500" />
            Muzlatilgan
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-slate-300/80 bg-white/60 dark:border-white/20 dark:bg-white/[0.06]" />
            Ochiq
          </span>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[9.5px] font-bold text-slate-400 dark:text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inRange, isStart, isEnd, isToday }) => (
          <div
            key={date.getTime()}
            title={rangeFmt(date)}
            className={cx(
              'relative flex h-6 items-center justify-center rounded-md text-[9.5px] font-bold tabular-nums transition-all duration-200',
              inRange
                ? 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-[0_1px_4px_rgba(56,189,248,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]'
                : 'border border-slate-200/70 bg-white/50 text-slate-400 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-500',
              isToday && !inRange && 'ring-1 ring-[#007AFF]/50',
              (isStart || isEnd) && 'ring-1 ring-sky-300/80 shadow-[0_0_10px_rgba(56,189,248,0.5)]',
            )}
          >
            {date.getDate()}
            {isToday && (
              <span className="absolute -right-0.5 -top-0.5 h-1 w-1 rounded-full bg-[#007AFF] shadow-[0_0_4px_#007AFF]" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
        <span>
          {rangeFmt(cells[0].date)} — {rangeFmt(cells[cells.length - 1].date)}
        </span>
        <span>{weeks} hafta</span>
      </div>
    </div>
  );
});

const FreezeTimeline = memo(function FreezeTimeline({
  startDate,
  endDate,
  days,
}: {
  startDate: string;
  endDate: string;
  days: number;
}) {
  const fmt = (iso: string) => {
    const d = parseIsoDate(iso);
    return d ? d.toLocaleDateString('uz-UZ', { day: '2-digit', month: 'short' }) : iso;
  };
  const pct = Math.min(100, Math.max(5, (days / 30) * 100));
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.06] via-blue-500/[0.03] to-transparent p-3.5 dark:border-sky-400/15">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-slate-500 dark:text-slate-400">{fmt(startDate)}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-sky-700 tabular-nums dark:text-sky-300">
          <Icon paths={I.calendar} size={10} strokeWidth={2.4} />
          {days} kun
        </span>
        <span className="text-slate-500 dark:text-slate-400">{fmt(endDate)}</span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900/[0.07] shadow-[inset_0_1px_1px_rgba(0,0,0,0.1)] dark:bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: EASE_PREMIUM }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
        />
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * FILTER CHIPS
 * ════════════════════════════════════════════════════════════════════════ */

interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
  tone?: 'blue' | 'amber' | 'emerald' | 'slate';
}

const CHIP_TONES: Record<NonNullable<FilterChip['tone']>, string> = {
  blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/25 dark:bg-sky-400/12 dark:text-sky-300 dark:ring-sky-400/25',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:bg-amber-400/12 dark:text-amber-300 dark:ring-amber-400/25',
  emerald:
    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:bg-emerald-400/12 dark:text-emerald-300 dark:ring-emerald-400/25',
  slate: 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:bg-white/[0.06] dark:text-slate-300 dark:ring-white/10',
};

const FilterChips = memo(
  forwardRef<HTMLDivElement, { chips: FilterChip[] }>(function FilterChips({ chips }, ref) {
    if (chips.length === 0) return null;
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="flex flex-wrap items-center gap-1.5 px-1"
      >
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Filtrlar:
        </span>
        {chips.map((chip) => (
          <motion.button
            key={chip.id}
            type="button"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={SPRING.snappy}
            onClick={chip.onRemove}
            aria-label={`${chip.label} filtrini olib tashlash`}
            className={`group inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset transition-transform hover:scale-[1.03] ${CHIP_TONES[chip.tone ?? 'slate']}`}
          >
            <span className="max-w-[140px] truncate">{chip.label}</span>
            <Icon
              paths={I.close}
              size={10}
              strokeWidth={2.6}
              className="opacity-55 transition-opacity group-hover:opacity-100"
            />
          </motion.button>
        ))}
      </motion.div>
    );
  }),
);

/* ══════════════════════════════════════════════════════════════════════════
 * SELECTION PREVIEW
 * ════════════════════════════════════════════════════════════════════════ */

const SelectionPreview = memo(function SelectionPreview({ students, max = 3 }: { students: Student[]; max?: number }) {
  const visible = students.slice(0, max);
  const remaining = students.length - visible.length;
  return (
    <div className="flex items-center" aria-hidden="true">
      {visible.map((s, i) => {
        const name = formatStudentName(s);
        return (
          <div
            key={s.id}
            className="relative -ml-2 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-extrabold text-white ring-2 ring-white transition-transform duration-200 first:ml-0 hover:z-10 hover:scale-110 dark:ring-surface-900"
            style={{ background: avatarStyle(name).background, zIndex: max - i }}
            title={name}
          >
            {getInitials(name)}
          </div>
        );
      })}
      {remaining > 0 && (
        <div className="relative -ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-500/90 text-[9px] font-extrabold text-white ring-2 ring-white dark:bg-slate-600 dark:ring-surface-900">
          +{remaining}
        </div>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * COMMAND PALETTE
 * ════════════════════════════════════════════════════════════════════════ */

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: readonly string[];
  onExecute: () => void;
  keywords?: string;
}

const KBD =
  'rounded-md border border-slate-200/80 bg-white/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400 dark:shadow-none';

const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  actions,
  placeholder = 'Buyruq yoki talabani qidirish...',
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();
  const getOptionId = (idx: number) => `${listId}-opt-${idx}`;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions.slice(0, 8);
    return actions
      .filter((a) => a.label.toLowerCase().includes(q) || (a.keywords ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, actions]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(Math.max(0, filtered.length - 1));
  }, [filtered, activeIndex]);

  const run = (action: PaletteAction | undefined) => {
    if (!action) return;
    action.onExecute();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(filtered[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(Math.max(0, filtered.length - 1));
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/30 px-4 pt-[12vh] backdrop-blur-md"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={SPRING.palette}
            onClick={(e) => e.stopPropagation()}
            className="lg-surface lg-float w-full max-w-xl overflow-hidden [--lg-r:26px]"
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-900/[0.07] px-4 py-3.5 dark:border-white/[0.07]">
              <Icon paths={I.search} size={17} className="text-slate-400 dark:text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={filtered.length > 0 ? getOptionId(activeIndex) : undefined}
                aria-autocomplete="list"
                className="flex-1 bg-transparent text-[14.5px] font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
              />
              <kbd className={KBD}>ESC</kbd>
            </div>

            <div
              id={listId}
              role="listbox"
              aria-label="Buyruqlar"
              className="relative z-10 max-h-[52vh] overflow-y-auto p-2"
            >
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
                  Hech narsa topilmadi
                </div>
              ) : (
                filtered.map((action, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={action.id}
                      id={getOptionId(idx)}
                      role="option"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => run(action)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cx(
                        'relative flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors',
                        isActive ? 'text-[#007AFF] dark:text-sky-300' : 'text-slate-700 dark:text-slate-200',
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="palette-active"
                          transition={SPRING.snappy}
                          className="absolute inset-0 rounded-2xl bg-[#007AFF]/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-[#007AFF]/15 dark:bg-sky-400/15 dark:shadow-none dark:ring-sky-400/20"
                        />
                      )}
                      <div
                        className={cx(
                          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]',
                          isActive
                            ? 'bg-[#007AFF]/15 dark:bg-sky-400/20'
                            : 'bg-slate-900/[0.05] text-slate-500 dark:bg-white/[0.05] dark:text-slate-400',
                        )}
                      >
                        <Icon paths={action.icon} size={15} strokeWidth={2.0} />
                      </div>
                      <div className="relative min-w-0 flex-1 text-[13px] font-semibold">{action.label}</div>
                      {action.hint && <kbd className={`relative ${KBD}`}>{action.hint}</kbd>}
                    </button>
                  );
                })
              )}
            </div>

            <div className="relative z-10 flex items-center justify-between border-t border-slate-900/[0.07] px-3.5 py-2 text-[10.5px] font-medium text-slate-400 dark:border-white/[0.07] dark:text-slate-500">
              <div className="flex items-center gap-2">
                <kbd className={KBD}>↑↓</kbd>
                <span>harakatlanish</span>
                <kbd className={`ml-2 ${KBD}`}>⏎</kbd>
                <span>tanlash</span>
              </div>
              <span className="inline-flex items-center gap-1">
                <Icon paths={I.command} size={11} /> Command Palette
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ROW HOVER PEEK
 * ════════════════════════════════════════════════════════════════════════ */

const RowHoverPeek = memo(function RowHoverPeek({
  student,
  anchorRect,
}: {
  student: Student;
  anchorRect: DOMRect;
}) {
  const name = formatStudentName(student);
  const isActive = student.user?.isActive !== false;
  const activeGroups = (student.groups ?? []).filter((g) => g.isActive && g.group);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = anchorRect.bottom + 8;
    // Pastga sig'masa — yuqoriga
    if (top + rect.height > vh - margin) top = anchorRect.top - rect.height - 8;
    // Ekran chegaralarida ushlab turish
    top = Math.max(margin, Math.min(top, vh - rect.height - margin));
    let left = anchorRect.left + 60;
    if (left + rect.width > vw - margin) left = vw - rect.width - margin;
    left = Math.max(margin, left);
    setPos({ top, left });
  }, [anchorRect]);

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: pos ? 1 : 0, y: pos ? 0 : 4, scale: pos ? 1 : 0.98 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={SPRING.snappy}
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        pointerEvents: 'none',
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="lg-surface lg-float z-50 w-[300px] max-w-[calc(100vw-1.5rem)] overflow-hidden p-3.5 [--lg-r:20px]"
      aria-hidden="true"
    >
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <StudentAvatar name={name} size={44} isActive={isActive} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-bold text-slate-900 dark:text-white">{name}</div>
            <div className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
              {student.user?.email || student.user?.phone || '—'}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-900/[0.07] pt-2.5 dark:border-white/[0.07]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Guruhlar
            </div>
            <div className="mt-0.5 truncate text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">
              {activeGroups.length > 0 ? activeGroups.map((g) => g.group?.name ?? '—').join(', ') : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Ota-ona
            </div>
            <div className="mt-0.5 truncate text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">
              {student.parentName || '—'}
            </div>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400 dark:text-slate-500">
          <Icon paths={I.info} size={11} />
          Ochish uchun bosing · Quick-Look uchun Space
        </div>
      </div>
    </motion.div>,
    document.body,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * KEYBOARD HELP OVERLAY
 * ════════════════════════════════════════════════════════════════════════ */

const KeyboardHelp = memo(function KeyboardHelp({ onClose }: { onClose: () => void }) {
  const shortcuts: Array<[string, string]> = [
    [isMac ? '⌘ K' : 'Ctrl K', 'Buyruq paneli'],
    ['/', 'Qidiruvga fokus'],
    ['?', 'Yorliqlar paneli'],
    ['Space', 'Quick-Look (tanlangan qator)'],
    ['Enter', 'Talaba kartasini ochish'],
    ['E', 'CSV eksport'],
    ['Del', 'Tanlanganlarni o‘chirish'],
    ['Esc', 'Yopish / tozalash'],
  ];
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        initial={{ opacity: 0, y: -18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={SPRING.palette}
        onClick={(e) => e.stopPropagation()}
        className="lg-surface lg-float w-full max-w-md overflow-hidden p-5 [--lg-r:24px]"
        role="dialog"
        aria-modal="true"
        aria-label="Klaviatura yorliqlari"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
            <Icon paths={I.help} size={16} className="text-[#007AFF] dark:text-sky-400" />
            Klaviatura yorliqlari
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
          >
            <Icon paths={I.close} size={16} />
          </button>
        </div>
        <ul className="space-y-2">
          {shortcuts.map(([key, desc]) => (
            <li key={key} className="flex items-center justify-between gap-3 text-[12.5px]">
              <kbd className={KBD}>{key}</kbd>
              <span className="text-slate-600 dark:text-slate-400">{desc}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>,
    document.body,
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * COLUMN VISIBILITY POPOVER
 * ════════════════════════════════════════════════════════════════════════ */

type ColumnKey = 'email' | 'groups' | 'parent' | 'status';

const COLUMN_LABELS: Record<ColumnKey, string> = {
  email: 'Email / Telefon',
  groups: 'Guruhlar',
  parent: 'Ota-ona',
  status: 'Holati',
};

const ColumnVisibility = memo(function ColumnVisibility({
  visible,
  onChange,
  onClose,
}: {
  visible: Record<ColumnKey, boolean>;
  onChange: (key: ColumnKey, value: boolean) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Ustunlar ko‘rinishi"
      className="lg-surface lg-float absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden p-2 [--lg-r:16px]"
    >
      <p className="mb-1 px-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Ustunlar
      </p>
      {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
        <label
          key={key}
          className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.06]"
        >
          <span>{COLUMN_LABELS[key]}</span>
          <input
            type="checkbox"
            checked={visible[key]}
            onChange={(e) => onChange(key, e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF]"
          />
        </label>
      ))}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SAVED VIEWS
 * ════════════════════════════════════════════════════════════════════════ */

const SavedViewsMenu = memo(function SavedViewsMenu({
  views,
  onApply,
  onDelete,
  onSave,
  canSave,
}: {
  views: SavedView[];
  onApply: (v: SavedView) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  canSave: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // parent onClose
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Saqlangan ko‘rinishlar"
      className="lg-surface lg-float absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden p-2 [--lg-r:16px]"
    >
      <div className="mb-1 flex items-center justify-between px-2">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Saqlangan ko‘rinishlar
        </p>
        <span className="text-[10px] tabular-nums text-slate-400">{views.length}/3</span>
      </div>
      {views.length === 0 && (
        <p className="px-2 py-2 text-[11.5px] italic text-slate-400">Hali saqlangan ko‘rinish yo‘q</p>
      )}
      {views.map((v) => (
        <div
          key={v.id}
          className="group flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <button
            type="button"
            onClick={() => onApply(v)}
            className="flex-1 truncate rounded-md px-1.5 py-1 text-left text-[12px] font-medium text-slate-700 dark:text-slate-200"
          >
            {v.name}
          </button>
          <button
            type="button"
            onClick={() => onDelete(v.id)}
            aria-label={`${v.name} ni o‘chirish`}
            className="rounded-md p-1 text-slate-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
          >
            <Icon paths={I.trash} size={12} />
          </button>
        </div>
      ))}
      <div className="mt-1 border-t border-slate-200/60 pt-1 dark:border-white/[0.06]">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-bold text-[#007AFF] transition-colors hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40 dark:text-sky-400 dark:hover:bg-sky-400/10"
        >
          <Icon paths={I.bookmark} size={12} />
          Joriy holatni saqlash
        </button>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * TABLE HEADER CELLS
 * ════════════════════════════════════════════════════════════════════════ */

const TH = 'px-6 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]';

const SortButton = memo(function SortButton({
  label,
  field,
  sortField,
  sortDir,
  onToggle,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDir: SortDirection;
  onToggle: (f: SortField) => void;
}) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      aria-label={`${label} bo‘yicha saralash`}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="inline-flex items-center gap-1 uppercase tracking-[0.14em] transition-colors hover:text-slate-900 dark:hover:text-white"
    >
      <span>{label}</span>
      <Icon
        paths={active ? (sortDir === 'asc' ? I.arrowUp : I.arrowDown) : I.sort}
        size={12}
        className={active ? 'text-[#007AFF] dark:text-[#38BDF8]' : 'opacity-60'}
      />
    </button>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN STUDENTS PAGE
 * ════════════════════════════════════════════════════════════════════════ */

const STATUS_TABS: SegOption<StatusQuickFilter>[] = [
  { id: 'ALL', label: 'Barchasi' },
  { id: 'ACTIVE', label: 'Faol' },
  { id: 'INACTIVE', label: 'Muzlatilgan' },
];

const VIEW_OPTIONS: SegOption<ViewMode>[] = [
  { id: 'table', icon: I.list, title: 'Jadval ko‘rinishi', testId: 'segment-table' },
  { id: 'grid', icon: I.grid, title: 'Kartochkalar (Bento) ko‘rinishi', testId: 'segment-grid' },
];

const DENSITY_OPTIONS: SegOption<Density>[] = [
  { id: 'compact', icon: I.layoutCompact, title: 'Ixcham' },
  { id: 'cozy', icon: I.layoutCozy, title: 'Qulay' },
  { id: 'comfy', icon: I.layoutComfy, title: 'Keng' },
];

const FREEZE_PRESETS = [
  { label: '7 kun (1 hafta)', days: 7 },
  { label: '14 kun (2 hafta)', days: 14 },
  { label: '30 kun (1 oy)', days: 30 },
] as const;

const FREEZE_REASONS = [
  DEFAULT_FREEZE_REASON,
  'Oilaviy safar / Taʼtil sababli',
  'Maktab imtihonlari / Olimpiada yig‘ini',
] as const;

/** useId import qilinmagan — qo'shamiz. */
import { useId } from 'react';

export function StudentsPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('students.title'));
  const navigate = useNavigate();
  const location = useLocation();
  const sound = usePremiumSound();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const reduced = usePrefersReducedMotion();

  // ── Core state ────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusQuickFilter>('ALL');
  const [sort, dispatchSort] = useReducer(sortReducer, { field: 'name', dir: 'asc' } as SortState);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [density, setDensity] = useState<Density>('cozy');
  const [columns, setColumns] = useState<Record<ColumnKey, boolean>>({
    email: true,
    groups: true,
    parent: true,
    status: true,
  });
  const [showColumns, setShowColumns] = useState(false);
  const [showSavedViews, setShowSavedViews] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews());
  const [announcement, setAnnouncement] = useState('');

  // ── Modals / popovers ─────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [freezeTarget, setFreezeTarget] = useState<Student | null>(null);
  const [freezeForm, setFreezeForm] = useState<FreezeFormData>(createDefaultFreezeForm);
  const [isAdmissionPathfinderOpen, setIsAdmissionPathfinderOpen] = useState(false);
  const [isReferralEngineOpen, setIsReferralEngineOpen] = useState(false);
  const [isMilestoneCelebrationOpen, setIsMilestoneCelebrationOpen] = useState(false);
  const [isRetentionCockpitOpen, setIsRetentionCockpitOpen] = useState(false);
  const [isSmartDiscountOpen, setIsSmartDiscountOpen] = useState(false);
  const [selectedStudentForCelebration, setSelectedStudentForCelebration] = useState<string>('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hoveredStudent, setHoveredStudent] = useState<{ student: Student; rect: DOMRect } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    },
    [],
  );

  const debouncedSearch = useDebounce(search.trim(), 300);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setShowHelp((v) => !v);
      } else if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (paletteOpen) setPaletteOpen(false);
        else if (!isTyping) setHoveredStudent(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showHelp, paletteOpen]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, groupId, statusFilter]);

  // ── Scroll restore ───────────────────────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      const y = Number(saved);
      if (Number.isFinite(y) && y > 0) {
        requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
      }
    }
    const onScroll = () => {
      try {
        sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      } catch {
        /* quota */
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  // ── Hover peek scroll close ──────────────────────────────────
  useEffect(() => {
    if (!hoveredStudent) return;
    const close = () => setHoveredStudent(null);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [hoveredStudent]);

  // ── Data fetching ─────────────────────────────────────────────
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
  const rawStudentList = useMemo(() => data?.items ?? [], [data]);
  const groupList = useMemo(() => (groups.data as Paginated<Group> | undefined)?.items ?? [], [groups.data]);

  const stats = useMemo(() => {
    const active = rawStudentList.filter((s) => s.user?.isActive !== false).length;
    const withGroups = rawStudentList.filter((s) => (s.groups ?? []).some((g) => g.isActive)).length;
    const total = data?.total ?? rawStudentList.length;
    return {
      total,
      pageTotal: rawStudentList.length,
      active,
      inactive: rawStudentList.length - active,
      withGroups,
    };
  }, [rawStudentList, data?.total]);

  const studentList = useMemo(() => {
    const filtered = rawStudentList.filter((s) => {
      const isActive = s.user?.isActive !== false;
      const activeGroupCount = (s.groups ?? []).filter((g) => g.isActive && g.group).length;
      if (statusFilter === 'ACTIVE') return isActive;
      if (statusFilter === 'INACTIVE') return !isActive;
      if (statusFilter === 'WITH_GROUPS') return activeGroupCount > 0;
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.field === 'name') return formatStudentName(a).localeCompare(formatStudentName(b)) * dir;
      if (sort.field === 'groups') {
        const ga = (a.groups ?? []).filter((g) => g.isActive).length;
        const gb = (b.groups ?? []).filter((g) => g.isActive).length;
        return (ga - gb) * dir;
      }
      const sa = a.user?.isActive !== false ? 1 : 0;
      const sb = b.user?.isActive !== false ? 1 : 0;
      return (sa - sb) * dir;
    });
  }, [rawStudentList, statusFilter, sort]);

  // ── Mutations ─────────────────────────────────────────────────
  const freezeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FreezeFormData }) => studentsApi.freeze(id, payload),
    onSuccess: () => {
      push('success', t('students.frozenSuccess') || 'Talaba darslari va to‘lovlari vaqtincha muzlatildi');
      setFreezeTarget(null);
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: unknown) => push('error', getErrorMessage(e as Error)),
  });

  const unfreezeMutation = useMutation({
    mutationFn: (id: string) => studentsApi.unfreeze(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.students.list(params) });
      const prev = qc.getQueryData<Paginated<Student>>(queryKeys.students.list(params));
      if (prev) {
        qc.setQueryData<Paginated<Student>>(queryKeys.students.list(params), {
          ...prev,
          items: prev.items.map((s) =>
            s.id === id && s.user ? { ...s, user: { ...s.user, isActive: true } } : s,
          ),
        });
      }
      return { prev };
    },
    onError: (e: unknown, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.students.list(params), ctx.prev);
      push('error', getErrorMessage(e as Error));
    },
    onSuccess: () => {
      push('success', t('students.unfrozenSuccess') || 'Talaba muzlatish holatidan chiqarildi va faollashtirildi');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      push('success', t('students.deleted'));
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.students.selectors() });
      void qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
      setDeleteTarget(null);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value), []);
  const handleGroupFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setGroupId(e.target.value),
    [],
  );
  const handleClearFilters = useCallback(() => {
    setSearch('');
    setGroupId('');
    setStatusFilter('ALL');
    setPage(1);
    dispatchSort({ type: 'reset' });
  }, []);
  const handleToggleSort = useCallback((field: SortField) => {
    dispatchSort({ type: 'toggle', field });
  }, []);

  const handleQuickLook = useCallback(
    (student: Student) => {
      openQuickLook(buildStudentPanel(student, navigate, false) as unknown as Parameters<typeof openQuickLook>[0]);
    },
    [navigate],
  );

  const handleOpenStudentSidecar = useCallback(
    (student: Student) => {
      sound.playTick();
      openSidecar(buildStudentPanel(student, navigate, true) as unknown as Parameters<typeof openSidecar>[0]);
    },
    [sound, navigate],
  );

  const handleStudentClick = useCallback((studentId: string) => navigate(`/students/${studentId}`), [navigate]);

  const handleOpenFreeze = useCallback((student: Student) => {
    setFreezeForm(createDefaultFreezeForm());
    setFreezeTarget(student);
  }, []);

  const handleUnfreeze = useCallback((id: string) => unfreezeMutation.mutate(id), [unfreezeMutation]);

  const handleCelebrate = useCallback(
    (id: string) => {
      sound.playPop?.();
      setSelectedStudentForCelebration(id);
      setIsMilestoneCelebrationOpen(true);
    },
    [sound],
  );

  const handleDelete = useCallback((id: string) => setDeleteTarget(id), []);

  const {
    focusedIndex,
    setFocusedIndex,
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    clearSelection,
  } = useListKeyboardNavigation({
    items: studentList,
    onQuickLook: handleOpenStudentSidecar,
    onOpen: (s) => handleStudentClick(s.id),
    onEdit: (s) => navigate(`/students/${s.id}/edit`),
    onDelete: (items) => {
      if (items.length > 1) setBulkDeleteIds(items.map((s) => s.id));
      else if (items[0]) handleDelete(items[0].id);
    },
    rowSelectorPrefix: 'student-row-',
  });

  // aria-live: tanlov o'zgarganda xabar
  useEffect(() => {
    if (selectedCount > 0) {
      setAnnouncement(`${selectedCount} ta talaba tanlandi`);
    } else {
      setAnnouncement('');
    }
  }, [selectedCount]);

  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      toggleSelect(id);
    },
    [toggleSelect],
  );

  const handleSelectAllOnPage = useCallback(() => {
    const allOnPageSelected = studentList.length > 0 && studentList.every((s) => selectedIds.has(s.id));
    if (allOnPageSelected) clearSelection();
    else selectAll();
  }, [studentList, selectedIds, clearSelection, selectAll]);

  const handleExportCsv = useCallback(() => {
    const source = selectedIds.size > 0 ? studentList.filter((s) => selectedIds.has(s.id)) : studentList;
    if (source.length === 0) return;

    const q = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const headers = ['ID', 'Ism Familiya', 'Email', 'Telefon', 'Guruhlar', 'Ota-ona', 'Holati'];
    const rows = source.map((s) => {
      const activeGroups = (s.groups ?? [])
        .filter((g) => g.isActive && g.group)
        .map((g) => g.group?.name ?? '—')
        .join('; ');
      return [
        q(s.id),
        q(formatStudentName(s)),
        q(s.user?.email || ''),
        q(s.user?.phone || s.parentPhone || ''),
        q(activeGroups),
        q(s.parentName || ''),
        q(s.user?.isActive !== false ? 'Faol' : 'Muzlatilgan'),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medu-students-${toIsoDate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    push('success', `${source.length} ta talaba maʼlumoti CSV formatda yuklab olindi`);
  }, [selectedIds, studentList, push]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget || removeMutation.isPending) return;
    removeMutation.mutate(deleteTarget);
  }, [deleteTarget, removeMutation]);

  const confirmBulkDelete = useCallback(async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;
    let ok = 0;
    let failed = 0;
    for (const id of bulkDeleteIds) {
      try {
        await studentsApi.remove(id);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkDeleteIds(null);
    clearSelection();
    void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    if (failed === 0) push('success', `${ok} ta talaba o‘chirildi`);
    else push('warning', `${ok} ta o‘chirildi, ${failed} ta xato`);
  }, [bulkDeleteIds, clearSelection, qc, push]);

  const { refetch: refetchStudents } = students;
  const handleRetry = useCallback(() => void refetchStudents(), [refetchStudents]);

  const hasActiveFilters = Boolean(search.trim() || groupId || statusFilter !== 'ALL');

  // ── Filter chips ──────────────────────────────────────────────
  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (search.trim()) {
      chips.push({ id: 'search', label: `“${search.trim()}”`, tone: 'blue', onRemove: () => setSearch('') });
    }
    if (groupId) {
      const g = groupList.find((x) => x.id === groupId);
      chips.push({
        id: 'group',
        label: g ? `Guruh: ${g.name}` : 'Guruh',
        tone: 'slate',
        onRemove: () => setGroupId(''),
      });
    }
    if (statusFilter !== 'ALL') {
      const map: Record<Exclude<StatusQuickFilter, 'ALL'>, { label: string; tone: FilterChip['tone'] }> = {
        ACTIVE: { label: 'Faol', tone: 'emerald' },
        INACTIVE: { label: 'Muzlatilgan', tone: 'amber' },
        WITH_GROUPS: { label: 'Guruhli', tone: 'blue' },
      };
      const cfg = map[statusFilter];
      chips.push({ id: 'status', label: cfg.label, tone: cfg.tone, onRemove: () => setStatusFilter('ALL') });
    }
    return chips;
  }, [search, groupId, statusFilter, groupList]);

  // ── Row hover peek ───────────────────────────────────────────
  const handleRowMouseEnter = useCallback(
    (student: Student, e: React.MouseEvent<HTMLTableRowElement>) => {
      if (reduced) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = window.setTimeout(() => setHoveredStudent({ student, rect }), 420);
    },
    [reduced],
  );
  const handleRowMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    setHoveredStudent(null);
  }, []);

  const densityRowPadding = density === 'compact' ? 'py-2' : density === 'cozy' ? 'py-3.5' : 'py-5';
  const densityText = density === 'compact' ? 'text-[12.5px]' : 'text-[13.5px]';

  const selectedStudents = useMemo(() => studentList.filter((s) => selectedIds.has(s.id)), [studentList, selectedIds]);

  // ── Saved views ─────────────────────────────────────────────
  const handleSaveView = useCallback(() => {
    const name = window.prompt('Ko‘rinish nomi:', `Ko‘rinish ${savedViews.length + 1}`);
    if (!name) return;
    const next: SavedView = {
      id: `v-${Date.now()}`,
      name: name.slice(0, 40),
      search,
      groupId,
      statusFilter,
      sortField: sort.field,
      sortDir: sort.dir,
      viewMode,
      density,
      createdAt: Date.now(),
    };
    const updated = [next, ...savedViews].slice(0, 3);
    setSavedViews(updated);
    saveViews(updated);
    push('success', 'Ko‘rinish saqlandi');
  }, [search, groupId, statusFilter, sort, viewMode, density, savedViews, push]);

  const handleApplyView = useCallback((v: SavedView) => {
    setSearch(v.search);
    setGroupId(v.groupId);
    setStatusFilter(v.statusFilter as StatusQuickFilter);
    dispatchSort({ type: 'toggle', field: v.sortField as SortField }); // toggle boshlang'ich holatdan
    setViewMode(v.viewMode as ViewMode);
    setDensity(v.density as Density);
    setShowSavedViews(false);
  }, []);

  const handleDeleteView = useCallback(
    (id: string) => {
      const updated = savedViews.filter((v) => v.id !== id);
      setSavedViews(updated);
      saveViews(updated);
    },
    [savedViews],
  );

  // ── Command palette actions ──────────────────────────────────
  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      {
        id: 'new-student',
        label: 'Yangi talaba qo‘shish',
        icon: I.userPlus,
        keywords: 'new add student create yangi qo‘shish',
        onExecute: () => navigate('/students/new'),
      },
      {
        id: 'export',
        label: 'CSV eksport qilish',
        icon: I.download,
        keywords: 'export csv download yuklab',
        onExecute: handleExportCsv,
      },
      {
        id: 'clear',
        label: 'Filtrlarni tozalash',
        icon: I.close,
        keywords: 'clear reset filters tozalash',
        onExecute: handleClearFilters,
      },
      {
        id: 'view-table',
        label: 'Jadval ko‘rinishi',
        icon: I.list,
        keywords: 'table list view jadval',
        onExecute: () => setViewMode('table'),
      },
      {
        id: 'view-grid',
        label: 'Kartochkalar ko‘rinishi',
        icon: I.grid,
        keywords: 'grid cards bento view kartochka',
        onExecute: () => setViewMode('grid'),
      },
      {
        id: 'density-compact',
        label: 'Ixcham rejim',
        icon: I.layoutCompact,
        keywords: 'compact density ixcham',
        onExecute: () => setDensity('compact'),
      },
      {
        id: 'density-comfy',
        label: 'Keng rejim',
        icon: I.layoutComfy,
        keywords: 'comfy comfortable density keng',
        onExecute: () => setDensity('comfy'),
      },
      {
        id: 'help',
        label: 'Klaviatura yorliqlari',
        icon: I.help,
        keywords: 'help keyboard shortcuts yorliq',
        onExecute: () => setShowHelp(true),
      },
      ...groupList.slice(0, 5).map<PaletteAction>((g) => ({
        id: `group-${g.id}`,
        label: `Guruh: ${g.name}`,
        icon: I.usersRound,
        keywords: `group guruh ${g.name}`,
        onExecute: () => setGroupId(g.id),
      })),
    ],
    [navigate, handleExportCsv, handleClearFilters, groupList],
  );

  // ── Header toolbar ───────────────────────────────────────────
  const toolBtn =
    'h-10 w-10 min-w-[2.5rem] min-h-[2.5rem] shrink-0 p-0 flex items-center justify-center rounded-xl transition-all';

  const HeaderActions = useMemo(
    () => (
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-full">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-black/[0.04] dark:bg-white/[0.04] backdrop-blur-xl border border-black/[0.08] dark:border-white/10 shadow-xs max-w-full overflow-x-auto no-scrollbar">
          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setPaletteOpen(true)}
            title="Buyruq paneli (⌘K)"
            aria-label="Buyruq paneli"
            className={toolBtn}
          >
            <Icon paths={I.command} size={16} strokeWidth={2.0} />
          </GlassButton>

          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              sound.playPop?.();
              setIsAdmissionPathfinderOpen(true);
            }}
            title="AI Abituriyent & Karyera Pathfinder"
            aria-label="AI Karyera"
            className={`${toolBtn} border border-cyan-500/30 bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 dark:text-cyan-400`}
          >
            <MeduAiLogo size="xs" />
          </GlassButton>

          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              sound.playPop?.();
              setIsReferralEngineOpen(true);
            }}
            title="Referral & Promo Dvigateli"
            aria-label="Referral"
            className={`${toolBtn} border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 dark:text-emerald-400`}
          >
            <Icon paths={I.gift} size={16} strokeWidth={2.0} />
          </GlassButton>

          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              sound.playPop?.();
              setIsMilestoneCelebrationOpen(true);
            }}
            title="Yutuqlarni Nishonlash"
            aria-label="Yutuqlar"
            className={`${toolBtn} border border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 dark:text-amber-400`}
          >
            <Icon paths={I.star} size={16} strokeWidth={2.0} />
          </GlassButton>

          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              sound.playPop?.();
              setIsRetentionCockpitOpen(true);
            }}
            title="AI Retention & Churn Risk"
            aria-label="AI Retention"
            className={`${toolBtn} border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 dark:text-rose-400`}
          >
            <Icon paths={I.shield} size={16} strokeWidth={2.0} />
          </GlassButton>

          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              sound.playPop?.();
              setIsSmartDiscountOpen(true);
            }}
            title="Smart Oila Klasteri & Dinamik Chegirmalar"
            aria-label="Oila Chegirmalari"
            className={`${toolBtn} border border-violet-500/30 bg-violet-500/10 text-violet-500 hover:bg-violet-500/20 dark:text-violet-400`}
          >
            <Icon paths={I.users} size={16} strokeWidth={2.0} />
          </GlassButton>

          <GlassButton
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleExportCsv}
            title="CSV formatda eksport qilish"
            aria-label="Eksport CSV"
            className={toolBtn}
          >
            <Icon paths={I.download} size={16} strokeWidth={2.0} />
          </GlassButton>
        </div>

        <GlassButton
          asChild
          variant="primary"
          className="h-10 min-h-[44px] w-full sm:w-auto shrink-0 rounded-2xl px-4 shadow-sm justify-center"
        >
          <Link to="/students/new">
            <span className="inline-flex items-center gap-2 text-xs font-bold sm:text-sm">
              <Icon paths={I.userPlus} size={16} strokeWidth={2.2} />
              <span>{t('students.add')}</span>
            </span>
          </Link>
        </GlassButton>
      </div>
    ),
    [t, handleExportCsv, sound],
  );

  // ── Early states ─────────────────────────────────────────────
  if (students.isLoading && !data) {
    return (
      <div className="page-container relative z-10 space-y-5">
        <GlassPageHeader title={t('students.title')} subtitle={t('students.pageSubtitle')} actions={HeaderActions} />
        <StudentsSkeleton />
      </div>
    );
  }

  if (students.isError && !data) {
    return (
      <div className="page-container relative z-10 space-y-5">
        <GlassPageHeader title={t('students.title')} subtitle={t('students.pageSubtitle')} actions={HeaderActions} />
        <GlassCardSurface className="p-10 sm:p-12">
          <GlassErrorState
            title={t('students.loadFailed')}
            message={getErrorMessage(students.error as Error)}
            onRetry={handleRetry}
          />
        </GlassCardSurface>
      </div>
    );
  }

  const allSelectedOnPage = studentList.length > 0 && studentList.every((s) => selectedIds.has(s.id));
  const freezeDurationDays = calculateFreezeDays(freezeForm.startDate, freezeForm.endDate);
  const isUnfreezing = (id: string) => unfreezeMutation.isPending && unfreezeMutation.variables === id;
  const isDeleting = (id: string) => removeMutation.isPending && removeMutation.variables === id;

  return (
    <div className="page-container relative z-10 space-y-5 pb-24">
      <AuroraCanvas />

      <GlassPageHeader title={t('students.title')} subtitle={t('students.pageSubtitle')} actions={HeaderActions} />

      {/* aria-live */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* ═══ 1 · STATS ═══ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <StatTile
          label={t('students.title')}
          value={stats.total}
          total={Math.max(1, stats.total)}
          icon={I.users}
          tone="blue"
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
          subtitle={`Jami · ${stats.pageTotal} sahifada`}
        />
        <StatTile
          label={t('enum.status.ACTIVE')}
          value={stats.active}
          total={Math.max(1, stats.pageTotal)}
          icon={I.checkCircle}
          tone="green"
          active={statusFilter === 'ACTIVE'}
          onClick={() => setStatusFilter((prev) => (prev === 'ACTIVE' ? 'ALL' : 'ACTIVE'))}
        />
        <StatTile
          label={t('enum.status.INACTIVE')}
          value={stats.inactive}
          total={Math.max(1, stats.pageTotal)}
          icon={I.pause}
          tone="orange"
          active={statusFilter === 'INACTIVE'}
          onClick={() => setStatusFilter((prev) => (prev === 'INACTIVE' ? 'ALL' : 'INACTIVE'))}
        />
        <StatTile
          label={t('students.col.groups')}
          value={stats.withGroups}
          total={Math.max(1, stats.pageTotal)}
          icon={I.usersRound}
          tone="purple"
          active={statusFilter === 'WITH_GROUPS'}
          onClick={() => setStatusFilter((prev) => (prev === 'WITH_GROUPS' ? 'ALL' : 'WITH_GROUPS'))}
        />
      </motion.div>

      {/* ═══ 2 · COMMAND & FILTER BAR ═══ */}
      <GlassCardSurface className="p-3.5 sm:p-4">
        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1">
              <div className="relative">
                <GlassInput
                  data-testid="students-search-input"
                  ref={searchInputRef}
                  placeholder={t('students.searchPlaceholderEmail')}
                  value={search}
                  onChange={handleSearchChange}
                  aria-label={t('students.searchLabel')}
                  type="search"
                  inputPrefix={<Icon paths={I.search} size={16} className="text-[var(--text-muted)]" />}
                />
                {!search && (
                  <kbd
                    aria-hidden="true"
                    className={`pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-flex ${KBD}`}
                  >
                    ⌘K
                  </kbd>
                )}
              </div>

              <GlassSelect
                value={groupId}
                onChange={handleGroupFilterChange}
                aria-label={t('students.filterGroupLabel')}
              >
                <option value="">{t('students.allGroups')}</option>
                {groupList.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </GlassSelect>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 lg:justify-end">
              <GlassSegmented
                options={STATUS_TABS}
                value={statusFilter}
                onChange={setStatusFilter}
                layoutId="students-status-pill"
                ariaLabel="Talaba holati bo‘yicha filtr"
                semantics="tabs"
              />

              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-[11.5px] font-bold text-[#007AFF] transition-colors hover:bg-blue-500/15 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-[#38BDF8]"
                  >
                    <Icon paths={I.close} size={12} strokeWidth={2.4} />
                    <span>{t('common.clear') || 'Tozalash'}</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSavedViews((v) => !v);
                      setShowColumns(false);
                    }}
                    aria-label="Saqlangan ko‘rinishlar"
                    aria-expanded={showSavedViews}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                  >
                    <Icon paths={I.bookmark} size={12} strokeWidth={2.2} />
                    <span className="hidden sm:inline">Ko‘rinish</span>
                    {savedViews.length > 0 && (
                      <span className="rounded-full bg-violet-500/15 px-1.5 text-[10px] tabular-nums text-violet-700 dark:text-violet-300">
                        {savedViews.length}
                      </span>
                    )}
                  </button>
                  {showSavedViews && (
                    <SavedViewsMenu
                      views={savedViews}
                      onApply={handleApplyView}
                      onDelete={handleDeleteView}
                      onSave={handleSaveView}
                      canSave={savedViews.length < 3}
                    />
                  )}
                </div>

                <div className="relative hidden md:inline-flex">
                  <button
                    type="button"
                    onClick={() => {
                      setShowColumns((v) => !v);
                      setShowSavedViews(false);
                    }}
                    aria-label="Ustunlar ko‘rinishi"
                    aria-expanded={showColumns}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
                  >
                    <Icon paths={I.columns} size={14} strokeWidth={2.2} />
                  </button>
                  {showColumns && (
                    <ColumnVisibility
                      visible={columns}
                      onChange={(key, value) => setColumns((prev) => ({ ...prev, [key]: value }))}
                      onClose={() => setShowColumns(false)}
                    />
                  )}
                </div>

                <div className="hidden md:inline-flex">
                  <GlassSegmented
                    options={DENSITY_OPTIONS}
                    value={density}
                    onChange={setDensity}
                    layoutId="students-density-pill"
                    ariaLabel="Qatorlar zichligi"
                  />
                </div>

                <GlassSegmented
                  options={VIEW_OPTIONS}
                  value={viewMode}
                  onChange={setViewMode}
                  layoutId="students-view-pill"
                  ariaLabel="Ko‘rinish rejimi"
                />

                <div className="pl-1 text-[12.5px] font-bold tabular-nums text-[var(--text-secondary)]">
                  {stats.total === 1 ? t('students.totalOne') : t('students.totalMany', { count: stats.total })}
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {filterChips.length > 0 && <FilterChips chips={filterChips} />}
          </AnimatePresence>
        </div>
      </GlassCardSurface>

      {/* ═══ 3 · DATA SURFACE ═══ */}
      <GlassCardSurface className={students.isPlaceholderData ? 'opacity-75 transition-opacity' : 'transition-opacity'}>
        <AnimatePresence mode="wait">
          {studentList.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.smooth}
              className="relative z-10 p-10 sm:p-12"
            >
              <GlassEmptyState
                title={
                  hasActiveFilters
                    ? t('students.emptyFiltered')
                    : search.trim()
                      ? t('students.emptySearch')
                      : t('students.title')
                }
                message={
                  hasActiveFilters
                    ? t('students.emptyFilteredHint')
                    : search.trim()
                      ? t('students.emptyHint')
                      : 'Hozircha talaba yo‘q. Birinchi talabani qo‘shing.'
                }
                action={
                  hasActiveFilters ? (
                    <GlassButton type="button" variant="secondary" onClick={handleClearFilters}>
                      {t('common.clear') || 'Filtrlarni tozalash'}
                    </GlassButton>
                  ) : (
                    HeaderActions
                  )
                }
              />
            </motion.div>
          ) : viewMode === 'grid' ? (
            <motion.div
              key="bento-grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="relative z-10 grid grid-cols-1 auto-rows-fr gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {studentList.map((student) => {
                const activeGroups = (student.groups ?? []).filter((g) => g.isActive && g.group);
                const name = formatStudentName(student);
                const isActive = student.user?.isActive !== false;

                return (
                  <motion.div
                    key={student.id}
                    variants={tileVariants}
                    onClick={() => handleStudentClick(student.id)}
                    onPointerMove={trackPointer}
                    tabIndex={0}
                    role="link"
                    aria-label={t('students.viewStudentAria', { name })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleStudentClick(student.id);
                      }
                    }}
                    className="lg-surface lg-surface--subtle lg-interactive group flex cursor-pointer flex-col justify-between overflow-hidden p-4 outline-none transition-transform duration-300 [--lg-r:22px] hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-[#007AFF]"
                  >
                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <StudentAvatar name={name} size={44} isActive={isActive} />
                          <div className="min-w-0">
                            <div className="truncate text-[14.5px] font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-sky-400">
                              {name}
                            </div>
                            <div className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
                              {student.user?.email || student.user?.phone || `M-EDU ID: ${student.id.slice(0, 8)}`}
                            </div>
                          </div>
                        </div>
                        <StatusBadge isActive={student.user?.isActive} size="sm" />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {activeGroups.length > 0 ? (
                          activeGroups.slice(0, 3).map((enrollment, idx) => (
                            <GlassBadge key={enrollment.group?.id ?? `group-${idx}`} color="blue">
                              {enrollment.group?.name ?? '—'}
                            </GlassBadge>
                          ))
                        ) : (
                          <span className="text-[11.5px] italic text-slate-400">Guruhga biriktirilmagan</span>
                        )}
                        {activeGroups.length > 3 && <GlassBadge color="slate">+{activeGroups.length - 3}</GlassBadge>}
                      </div>
                    </div>

                    <div
                      className="relative z-10 mt-4 flex flex-col justify-between gap-2 border-t border-slate-900/[0.07] pt-3 sm:flex-row sm:items-center dark:border-white/[0.07]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="truncate text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                        {student.parentName ? `Ota-ona: ${student.parentName}` : 'Ota-ona kiritilmagan'}
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1.5">
                        <StudentActions
                          student={student}
                          isActive={isActive}
                          unfreezing={isUnfreezing(student.id)}
                          deleting={isDeleting(student.id)}
                          deleteBusy={removeMutation.isPending}
                          onFreeze={handleOpenFreeze}
                          onUnfreeze={handleUnfreeze}
                          onSidecar={handleOpenStudentSidecar}
                          onQuickLook={handleQuickLook}
                          onCelebrate={handleCelebrate}
                          onDelete={handleDelete}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div key="table" variants={containerVariants} initial="hidden" animate="visible" className="relative z-10">
              <div className="medu-scroll-x">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead className="lg-thead sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={TH}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={allSelectedOnPage}
                            onChange={handleSelectAllOnPage}
                            aria-label="Barcha talabalarni tanlash"
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
                          />
                          <SortButton
                            label={t('common.name')}
                            field="name"
                            sortField={sort.field}
                            sortDir={sort.dir}
                            onToggle={handleToggleSort}
                          />
                        </div>
                      </th>
                      {columns.email && (
                        <th scope="col" className={TH}>
                          {t('common.email')}
                        </th>
                      )}
                      {columns.groups && (
                        <th scope="col" className={TH}>
                          <SortButton
                            label={t('students.col.groups')}
                            field="groups"
                            sortField={sort.field}
                            sortDir={sort.dir}
                            onToggle={handleToggleSort}
                          />
                        </th>
                      )}
                      {columns.parent && (
                        <th scope="col" className={`hidden lg:table-cell ${TH}`}>
                          {t('students.col.parentName')}
                        </th>
                      )}
                      {columns.status && (
                        <th scope="col" className={TH}>
                          <SortButton
                            label={t('students.col.status')}
                            field="status"
                            sortField={sort.field}
                            sortDir={sort.dir}
                            onToggle={handleToggleSort}
                          />
                        </th>
                      )}
                      <th scope="col" className={`${TH} !text-right`}>
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {studentList.map((student, index) => {
                      const activeGroups = (student.groups ?? []).filter((g) => g.isActive && g.group);
                      const name = formatStudentName(student);
                      const isActive = student.user?.isActive !== false;
                      const isSelected = selectedIds.has(student.id);
                      const isRowFocused = focusedIndex === index;
                      const groupRatio = Math.min(1, activeGroups.length / 3);

                      return (
                        <motion.tr
                          key={student.id}
                          id={`student-row-${student.id}`}
                          variants={rowVariants}
                          data-selected={isSelected}
                          onClick={() => {
                            setFocusedIndex(index);
                            handleStudentClick(student.id);
                          }}
                          onMouseEnter={(e) => handleRowMouseEnter(student, e)}
                          onMouseLeave={handleRowMouseLeave}
                          tabIndex={0}
                          role="link"
                          aria-label={t('students.viewStudentAria', { name })}
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleStudentClick(student.id);
                            } else if (e.key === ' ') {
                              e.preventDefault();
                              handleQuickLook(student);
                            }
                          }}
                          className={cx(
                            'lg-row group cursor-pointer border-b border-slate-900/[0.06] last:border-0 focus-visible:outline-none dark:border-white/[0.06]',
                            isRowFocused && 'z-10 ring-2 ring-[#007AFF] shadow-[0_0_18px_rgba(0,122,255,0.28)]',
                          )}
                        >
                          <td className={`relative px-6 ${densityRowPadding} ${densityText}`}>
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-2 left-0 w-1 origin-center scale-y-0 rounded-r-full bg-[#007AFF] shadow-[0_0_10px_rgba(0,122,255,0.6)] transition-transform duration-200 group-hover:scale-y-100 dark:bg-[#38BDF8]"
                            />
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                onClick={(e) => handleToggleSelect(student.id, e)}
                                aria-label={`${name} tanlash`}
                                className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
                              />
                              <StudentAvatar
                                name={name}
                                size={39}
                                isActive={isActive}
                                showRing={activeGroups.length > 0}
                                ringProgress={groupRatio}
                              />
                              <div className="min-w-0">
                                <div className="truncate text-[13.5px] font-bold text-slate-900 transition-colors group-hover:text-[#007AFF] dark:text-white dark:group-hover:text-[#38BDF8]">
                                  {name}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  {activeGroups.length > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Icon paths={I.usersRound} size={11} strokeWidth={2} />
                                      <span>
                                        {activeGroups.length} {t('students.col.groups')?.toLowerCase() || 'guruh'}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="opacity-65">Guruhsiz</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {columns.email && (
                            <td className={`px-6 ${densityRowPadding}`}>
                              {student.user?.email ? (
                                <CopyChip value={student.user.email} icon={I.mail} />
                              ) : student.user?.phone ? (
                                <CopyChip value={student.user.phone} icon={I.phone} />
                              ) : (
                                <span className="text-[var(--text-tertiary)] opacity-45">—</span>
                              )}
                            </td>
                          )}

                          {columns.groups && (
                            <td className={`px-6 ${densityRowPadding}`}>
                              <div className="flex flex-wrap gap-1.5">
                                {activeGroups.slice(0, 3).map((enrollment, idx) => (
                                  <GlassBadge key={enrollment.group?.id ?? `group-${idx}`} color="blue">
                                    {enrollment.group?.name ?? '—'}
                                  </GlassBadge>
                                ))}
                                {activeGroups.length === 0 && (
                                  <span className="text-[var(--text-tertiary)] opacity-45">—</span>
                                )}
                                {activeGroups.length > 3 && (
                                  <GlassBadge color="slate">+{activeGroups.length - 3}</GlassBadge>
                                )}
                              </div>
                            </td>
                          )}

                          {columns.parent && (
                            <td className={`hidden lg:table-cell px-6 ${densityRowPadding}`}>
                              {student.parentName ? (
                                <div className="flex flex-col">
                                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                                    <Icon paths={I.parent} size={13} strokeWidth={1.9} className="opacity-55" />
                                    <span className="max-w-[165px] truncate">{student.parentName}</span>
                                  </span>
                                  {student.parentPhone && (
                                    <span className="mt-0.5 pl-5 text-[11px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                      {student.parentPhone}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[var(--text-tertiary)] opacity-45">—</span>
                              )}
                            </td>
                          )}

                          {columns.status && (
                            <td className={`px-6 ${densityRowPadding}`}>
                              <StatusBadge isActive={student.user?.isActive} pulse />
                            </td>
                          )}

                          <td className={`px-6 ${densityRowPadding}`}>
                            <div
                              className="flex justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                            >
                              <StudentActions
                                student={student}
                                isActive={isActive}
                                unfreezing={isUnfreezing(student.id)}
                                deleting={isDeleting(student.id)}
                                deleteBusy={removeMutation.isPending}
                                onFreeze={handleOpenFreeze}
                                onUnfreeze={handleUnfreeze}
                                onSidecar={handleOpenStudentSidecar}
                                onQuickLook={handleQuickLook}
                                onCelebrate={handleCelebrate}
                                onDelete={handleDelete}
                              />
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-900/[0.07] px-4 py-3 dark:border-white/[0.08]">
                <GlassPagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCardSurface>

      {/* ═══ 4 · FLOATING BULK ISLAND ═══ */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClear={clearSelection}
        itemLabel="talaba"
        preview={selectedStudents.length > 0 ? <SelectionPreview students={selectedStudents} /> : undefined}
        actions={[
          {
            id: 'export-csv',
            label: 'CSV Eksport',
            icon: <Icon paths={I.download} size={13} />,
            onClick: handleExportCsv,
            variant: 'primary',
            shortcut: 'E',
          },
          {
            id: 'bulk-freeze',
            label: 'Muzlatish',
            icon: <Icon paths={I.snowflake} size={13} />,
            onClick: () => {
              const first = studentList.find((s) => selectedIds.has(s.id));
              if (first) handleOpenFreeze(first);
            },
          },
          {
            id: 'bulk-delete',
            label: 'O‘chirish',
            icon: <Icon paths={I.trash} size={13} />,
            variant: 'danger',
            shortcut: 'Del',
            onClick: () => {
              const ids = studentList.filter((s) => selectedIds.has(s.id)).map((s) => s.id);
              if (ids.length === 1) handleDelete(ids[0]);
              else if (ids.length > 1) setBulkDeleteIds(ids);
            },
          },
        ]}
      />

      {/* ═══ 5 · DELETE CONFIRMATIONS ═══ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!removeMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        description={t('students.confirmDelete')}
        loading={removeMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteIds !== null}
        onClose={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
        description={`${bulkDeleteIds?.length ?? 0} ta talabani o‘chirmoqchimisiz? Bu amalni qaytarib bo‘lmaydi.`}
        loading={false}
      />

      {/* ═══ 6 · FREEZE MODAL ═══ */}
      <GlassModal
        open={freezeTarget !== null}
        onClose={() => {
          if (!freezeMutation.isPending) setFreezeTarget(null);
        }}
        title="Talaba darslarini muzlatish (Medical Leave / Freeze)"
      >
        {freezeTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              freezeMutation.mutate({ id: freezeTarget.id, payload: freezeForm });
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-500/12 via-blue-500/8 to-transparent p-3.5 text-xs text-sky-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:text-sky-100 dark:shadow-none">
              <div className="flex min-w-0 items-center gap-3">
                <StudentAvatar name={formatStudentName(freezeTarget)} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold">{formatStudentName(freezeTarget)}</p>
                  <p className="mt-0.5 text-[11.5px] opacity-80">
                    Muzlatilgan davrda qarzdorlik hisoblanmaydi va guruhdagi o‘rni saqlanadi.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-xl bg-sky-500/20 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-sky-700 dark:text-sky-300">
                {freezeDurationDays} kun
              </span>
            </div>

            <FreezeTimeline startDate={freezeForm.startDate} endDate={freezeForm.endDate} days={freezeDurationDays} />

            <CalendarHeatmap startDate={freezeForm.startDate} endDate={freezeForm.endDate} />

            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tezkor muddat tanlash
              </span>
              <div className="flex flex-wrap gap-2">
                {FREEZE_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() =>
                      setFreezeForm((prev) => ({ ...prev, endDate: addDaysToIso(prev.startDate, preset.days - 1) }))
                    }
                    aria-pressed={calculateFreezeDays(freezeForm.startDate, freezeForm.endDate) === preset.days}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-px hover:border-sky-400 hover:text-sky-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-sky-400"
                  >
                    <Icon paths={I.calendar} size={13} />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassField label="Muzlatish boshlanish sanasi" required>
                <GlassInput
                  type="date"
                  value={freezeForm.startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setFreezeForm((prev) => ({
                      ...prev,
                      startDate: nextStart,
                      endDate: prev.endDate < nextStart ? nextStart : prev.endDate,
                    }));
                  }}
                  required
                />
              </GlassField>

              <GlassField label="Muzlatish tugash sanasi" required>
                <GlassInput
                  type="date"
                  min={freezeForm.startDate}
                  value={freezeForm.endDate}
                  onChange={(e) => setFreezeForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  required
                />
              </GlassField>
            </div>

            <GlassField label="Muzlatish sababi (Spravka / Sabab)" required>
              <GlassInput
                value={freezeForm.reason}
                onChange={(e) => setFreezeForm((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Masalan: Kasallik tufayli shifoxonada, spravka taqdim etildi..."
                required
              />
            </GlassField>

            <div className="flex flex-wrap gap-1.5">
              {FREEZE_REASONS.map((reasonPreset) => (
                <button
                  key={reasonPreset}
                  type="button"
                  onClick={() => setFreezeForm((prev) => ({ ...prev, reason: reasonPreset }))}
                  aria-pressed={freezeForm.reason === reasonPreset}
                  className={cx(
                    'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition',
                    freezeForm.reason === reasonPreset
                      ? 'border-sky-400/50 bg-sky-500/10 text-sky-700 dark:text-sky-300'
                      : 'border-slate-200/70 bg-slate-100/70 text-slate-600 hover:bg-slate-200/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300',
                  )}
                >
                  {reasonPreset}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                disabled={freezeMutation.isPending}
                onClick={() => setFreezeTarget(null)}
              >
                Bekor qilish
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={freezeMutation.isPending}>
                {freezeMutation.isPending ? 'Muzlatilmoqda...' : 'Muzlatishni tasdiqlash'}
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {/* ═══ 7 · COMMAND PALETTE ═══ */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={paletteActions} />

      {/* ═══ 8 · ROW HOVER PEEK ═══ */}
      <AnimatePresence>
        {hoveredStudent && <RowHoverPeek student={hoveredStudent.student} anchorRect={hoveredStudent.rect} />}
      </AnimatePresence>

      {/* ═══ 9 · KEYBOARD HELP ═══ */}
      <AnimatePresence>{showHelp && <KeyboardHelp onClose={() => setShowHelp(false)} />}</AnimatePresence>

      <UniversityAdmissionPathfinder
        isOpen={isAdmissionPathfinderOpen}
        onClose={() => setIsAdmissionPathfinderOpen(false)}
        students={rawStudentList}
      />

      <ReferralGrowthEngineModal isOpen={isReferralEngineOpen} onClose={() => setIsReferralEngineOpen(false)} />

      <StudentMilestoneCelebrationModal
        isOpen={isMilestoneCelebrationOpen}
        onClose={() => setIsMilestoneCelebrationOpen(false)}
        defaultStudentId={selectedStudentForCelebration}
      />

      <StudentRetentionCockpitModal
        isOpen={isRetentionCockpitOpen}
        onClose={() => setIsRetentionCockpitOpen(false)}
      />

      <SmartDiscountClusterModal isOpen={isSmartDiscountOpen} onClose={() => setIsSmartDiscountOpen(false)} />

      {toastNode}
    </div>
  );
}