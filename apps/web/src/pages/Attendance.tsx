'use client';

/**
 * ============================================================================
 * M-EDU Attendance Page — v3.0 "Chromatic Liquid Glass · Biometric & Ledger Studio"
 * ============================================================================
 *
 * v2 → v3.0 Senior Architecture & Liquid Glass Upgrades:
 *  • [fix] Preserved existing `note` during `handleBatchMarkStatus` instead of
 *          wiping teacher comments with `note: ''`; skipped redundant updates.
 *  • [fix] Reordered Record Modal fields (Group -> Student) so selecting a group
 *          never wipes out an already-selected student.
 *  • [fix] Removed unnecessary debounce on discrete `<select>` and `<input type="date">`
 *          controls for zero-latency KPI tile and date-pill filtering.
 *  • [fix] Fixed `FloatingActionIsland` prop compatibility (`onClear` + `onClearSelection`)
 *          and resolved `'E'` / `'P'` keyboard shortcut collision when rows are selected.
 *  • [fix] Added async `URL.revokeObjectURL` cleanup for Safari/WebKit CSV downloads.
 *  • [feat] Added Biometric / Source filter (`FACE_ID`, `QR`, `MANUAL`, `SYSTEM`)
 *           and multi-criteria sorting (`Date`, `Student A-Z`, `Status`).
 *  • [feat] Added 1-Click Quick Note Preset Chips in Record & Edit modals.
 *  • [feat] Added Bulk "Late" & "Excused" actions alongside Bulk "Present".
 *  • [feat] Upgraded Bento Grid touch targets to full >=40px ergonomic glass buttons.
 * ============================================================================
 */

import React, {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, LayoutGroup, type Variants } from 'framer-motion';
import { attendanceApi, studentsApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  GlassButton,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useDebounce } from '@/hooks/useDebounce';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { formatDate, toLocalISOString } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type {
  Paginated,
  Attendance,
  Student,
  Group,
  AttendanceStatus,
  AttendanceAnalytics,
} from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useAttendanceSocket } from '@/hooks/useAttendanceSocket';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { OfficialAttendanceRegisterModal } from '@/components/attendance/OfficialAttendanceRegisterModal';
import { AttendanceWaveChart } from '@/components/dashboard/AttendanceWaveChart';
import { AttendanceHeatmap } from '@/components/dashboard/AttendanceHeatmap';
import { AttendanceRiskSection } from '@/components/dashboard/AttendanceRiskSection';
import { AttendanceTrafficFlowHeatmap } from '@/components/camera/AttendanceTrafficFlowHeatmap';
import { RushHourBatchAttendanceProcessor } from '@/components/camera/RushHourBatchAttendanceProcessor';

/* ============================================================================
 * iOS 27 SPRING PHYSICS & LIQUID GLASS TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 360, damping: 31, mass: 0.82 },
  soft: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
  liquid: { type: 'spring' as const, stiffness: 420, damping: 35, mass: 0.78 },
  gel: { type: 'spring' as const, stiffness: 740, damping: 25, mass: 0.34 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.992 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING.smooth,
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const LIQUID_SURFACE = cn(
  'relative isolate overflow-hidden',
  'border border-white/75 bg-white/[0.78] backdrop-blur-3xl backdrop-saturate-[205%]',
  'shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.92),inset_0_-1px_0_0_rgba(0,122,255,0.1),0_16px_44px_-12px_rgba(15,23,42,0.08)]',
  'dark:border-white/[0.12] dark:bg-surface-900/[0.80]',
  'dark:shadow-[inset_0_1.5px_0_0_rgba(255,255,255,0.2),inset_0_-1px_0_0_rgba(10,132,255,0.16),0_20px_52px_-12px_rgba(0,0,0,0.65)]',
);

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-8' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute top-0 z-10', inset)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/30" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-[#007AFF]/30 to-transparent dark:via-[#38BDF8]/25" />
    </div>
  );
});

/* ============================================================================
 * SVG VECTOR ICON SYSTEM
 * ========================================================================== */

const ICON_STROKE = 1.85;

const I: Record<string, string[]> = {
  calendarCheck: [
    'M8 2v3.5',
    'M16 2v3.5',
    'M3.5 9.5h17',
    'M18.5 4h-13A2.5 2.5 0 0 0 3 6.5v12A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-12A2.5 2.5 0 0 0 18.5 4z',
    'M9 14.5l2.2 2.2 4.3-4.4',
  ],
  calendar: [
    'M8 2v3.5',
    'M16 2v3.5',
    'M3.5 9.5h17',
    'M18.5 4h-13A2.5 2.5 0 0 0 3 6.5v12A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-12A2.5 2.5 0 0 0 18.5 4z',
  ],
  check: ['M20 6.5 9 17.5l-5-5'],
  checkCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M8.5 12.5l2.5 2.5 5-5.5',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6.5V12l3.8 2.2',
  ],
  shield: [
    'M12 21.5s7.5-3.8 7.5-9.8V5.2L12 2.5 4.5 5.2v6.5c0 6 7.5 9.8 7.5 9.8z',
    'M9.5 12l1.8 1.8 3.4-3.6',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4.5A2.5 2.5 0 0 0 2 6.5v13A2.5 2.5 0 0 0 4.5 22h13a2.5 2.5 0 0 0 2.5-2.5V13',
    'M18.4 2.6a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.4-9.4z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v13.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19.5V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  filter: ['M21 4H3l7.2 8.6v5.9l3.6 1.8v-7.7L21 4z'],
  sort: ['M7 15l5 5 5-5', 'M7 9l5-5 5 5'],
  sparkles: [
    'M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z',
    'M19 3v3',
    'M20.5 4.5h-3',
    'M5 17.5v2.5',
    'M6.25 18.75h-2.5',
  ],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  book: [
    'M12 6.5v14',
    'M3 18a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H3z',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1.5a7.5 7.5 0 0 0-16 0V21',
  ],
  note: [
    'M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8L14 2z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h5',
  ],
  layers: [
    'M12 2.5 2 7.5l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12.2l10 5 10-5',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4.5',
    'M12 17.2h.01',
  ],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  sidebarRight: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M15 3v18',
  ],
  list: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3.5 6h.01',
    'M3.5 12h.01',
    'M3.5 18h.01',
  ],
  grid: [
    'M4 4h6.5v6.5H4z',
    'M13.5 4H20v6.5h-6.5z',
    'M4 13.5h6.5V20H4z',
    'M13.5 13.5H20V20h-6.5z',
  ],
  refresh: [
    'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5',
    'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16',
    'M16 16h5v5',
  ],
  download: [
    'M12 3v12',
    'M7 11l5 5 5-5',
    'M4 20h16',
  ],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  cycle: [
    'M17 2.1l4 4-4 4',
    'M3 12.2v-2a4 4 0 0 1 4-4h12.8',
    'M7 21.9l-4-4 4-4',
    'M21 11.8v2a4 4 0 0 1-4 4H4.2',
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
      {(paths || []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * APPLE LIQUID GLASS COLOR TOKENS
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';
type SortOption = 'date-desc' | 'name-asc' | 'status-asc';

const TONES: Record<
  Tone,
  { fg: string; bg: string; glow: string; border: string; gradient: string }
> = {
  blue: {
    fg: '#007AFF',
    bg: 'rgba(0, 122, 255, 0.11)',
    glow: 'rgba(0, 122, 255, 0.30)',
    border: 'rgba(0, 122, 255, 0.24)',
    gradient: 'linear-gradient(135deg, #007AFF 0%, #2563EB 100%)',
  },
  green: {
    fg: '#10B981',
    bg: 'rgba(16, 185, 129, 0.11)',
    glow: 'rgba(16, 185, 129, 0.30)',
    border: 'rgba(16, 185, 129, 0.24)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  emerald: {
    fg: '#10B981',
    bg: 'rgba(16, 185, 129, 0.11)',
    glow: 'rgba(16, 185, 129, 0.30)',
    border: 'rgba(16, 185, 129, 0.24)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #0D9488 100%)',
  },
  orange: {
    fg: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    glow: 'rgba(245, 158, 11, 0.30)',
    border: 'rgba(245, 158, 11, 0.25)',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  },
  red: {
    fg: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.11)',
    glow: 'rgba(239, 68, 68, 0.30)',
    border: 'rgba(239, 68, 68, 0.24)',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #E11D48 100%)',
  },
  purple: {
    fg: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.11)',
    glow: 'rgba(99, 102, 241, 0.30)',
    border: 'rgba(99, 102, 241, 0.24)',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
  },
  cyan: {
    fg: '#0284C7',
    bg: 'rgba(2, 132, 199, 0.11)',
    glow: 'rgba(2, 132, 199, 0.30)',
    border: 'rgba(2, 132, 199, 0.24)',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
  },
  gray: {
    fg: '#64748B',
    bg: 'rgba(100, 116, 139, 0.11)',
    glow: 'rgba(100, 116, 139, 0.22)',
    border: 'rgba(100, 116, 139, 0.22)',
    gradient: 'linear-gradient(135deg, #64748B 0%, #475569 100%)',
  },
};

/* ============================================================================
 * CONSTANTS & DOMAIN MAPPINGS
 * ========================================================================== */

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

const QUICK_NOTE_PRESETS = [
  'Sababli ariza',
  'Shifokor ko‘rigi',
  'Transport kechikishi',
  'Olimpiada / Tadbir',
  'Ota-ona ogohlantirdi',
] as const;

const STATUS_CYCLE_ORDER: Record<AttendanceStatus, AttendanceStatus> = {
  PRESENT: 'LATE',
  LATE: 'ABSENT',
  ABSENT: 'EXCUSED',
  EXCUSED: 'PRESENT',
};

const STATUS_TONE: Record<AttendanceStatus, Tone> = {
  PRESENT: 'emerald',
  ABSENT: 'red',
  LATE: 'orange',
  EXCUSED: 'blue',
};

const STATUS_ICON: Record<AttendanceStatus, string[]> = {
  PRESENT: I.checkCircle,
  ABSENT: I.xCircle,
  LATE: I.clock,
  EXCUSED: I.shield,
};

const STATUS_PULSE: Record<AttendanceStatus, boolean> = {
  PRESENT: true,
  ABSENT: true,
  LATE: false,
  EXCUSED: false,
};

const SOURCE_TONE: Record<string, Tone> = {
  FACE_ID: 'purple',
  FACE: 'purple',
  FACE_KIOSK: 'purple',
  TURNSTILE: 'purple',
  MANUAL: 'blue',
  QR: 'cyan',
  IMPORT: 'gray',
  SYSTEM: 'gray',
};

const SOURCE_ICON: Record<string, string[]> = {
  FACE_ID: [
    'M12 11a2 2 0 0 1 2 2v3',
    'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  FACE: [
    'M12 11a2 2 0 0 1 2 2v3',
    'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  FACE_KIOSK: [
    'M12 11a2 2 0 0 1 2 2v3',
    'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  TURNSTILE: [
    'M12 11a2 2 0 0 1 2 2v3',
    'M8 13a4 4 0 0 1 8 0v5',
    'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 10 10',
  ],
  MANUAL: I.edit,
  QR: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M19 19h2v2h-2z'],
  IMPORT: I.download,
  SYSTEM: [
    'M12 2v3',
    'M12 19v3',
    'M4.9 4.9l2.1 2.1',
    'M17 17l2.1 2.1',
    'M2 12h3',
    'M19 12h3',
    'M4.9 19.1l2.1-2.1',
    'M17 7l2.1-2.1',
  ],
};

interface AttendanceFilters {
  page: number;
  limit: number;
  groupId?: string;
  date?: string;
  status?: AttendanceStatus;
}

interface AttendanceFormState {
  studentId: string;
  groupId: string;
  date: string;
  status: AttendanceStatus;
  note: string;
}

function createInitialForm(groupId = '', dateStr = ''): AttendanceFormState {
  return {
    studentId: '',
    groupId,
    date: dateStr || toLocalISOString(),
    status: 'PRESENT',
    note: '',
  };
}

/* ============================================================================
 * HELPERS (Unicode-Safe)
 * ========================================================================== */

function getInitials(name: string): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned) return '—';
  return (
    cleaned
      .split(/\s+/)
      .map((p) => Array.from(p)[0] ?? '')
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
  ['#5856D6', '#AF52DE'],
  ['#10B981', '#0284C7'],
  ['#F59E0B', '#EF4444'],
  ['#6366F1', '#4F46E5'],
  ['#0EA5E9', '#2563EB'],
  ['#14B8A6', '#059669'],
  ['#EC4899', '#8B5CF6'],
] as const;

function avatarGradient(name: string): string {
  const palette =
    AVATAR_PALETTES[Math.abs(nameHash(name || '')) % AVATAR_PALETTES.length] ||
    AVATAR_PALETTES[0];
  const [a, b] = palette;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function fullStudentName(a: Attendance | null | undefined): string {
  if (!a?.student) return '—';
  const user = a.student.user;
  const fallbackName = (a.student as { name?: string }).name || '—';
  if (!user) return fallbackName;
  const { firstName, lastName } = user;
  return [firstName, lastName].filter(Boolean).join(' ') || fallbackName;
}

function isScheduleError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('jadval') ||
    lower.includes('schedule') ||
    lower.includes('rejalashtirilmagan') ||
    lower.includes('расписан')
  );
}

function getYesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalISOString(d);
}

/* ============================================================================
 * LIQUID GLASS SUB-COMPONENTS
 * ========================================================================== */

function Shimmer({
  className = '',
  radius = '0.75rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-200/60 dark:bg-white/[0.06]',
        className,
      )}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function AttendanceSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-32 w-full" radius="1.5rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Shimmer key={i} className="h-[96px]" radius="1.25rem" />
        ))}
      </div>
      <Shimmer className="h-16 w-full" radius="1.25rem" />
      <Shimmer className="h-96 w-full" radius="1.5rem" />
    </div>
  );
}

/** Smoothly interpolates from previous value to new value without resetting to 0 */
const CountUp = memo(function CountUp({
  value,
  duration = 0.85,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(safeTarget);
  const prevValueRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      setN(safeTarget);
      prevValueRef.current = safeTarget;
      return;
    }
    const from = prevValueRef.current;
    const to = safeTarget;
    if (from === to) {
      setN(to);
      return;
    }

    let raf = 0;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      const current = from + (to - from) * eased;
      setN(current);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevValueRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      prevValueRef.current = to;
    };
  }, [safeTarget, duration, reduced]);

  return (
    <span className="tabular-nums">
      {Math.round(n).toLocaleString('uz-UZ')}
      {suffix}
    </span>
  );
});

/** Apple iOS 27 Liquid Glass KPI Card with interactive status filter click */
const KpiTile = memo(function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  percent = false,
  secondary,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  percent?: boolean;
  secondary?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3, scale: 1.01 }}
      whileTap={onClick ? { scaleX: 1.03, scaleY: 0.96 } : undefined}
      transition={SPRING.smooth}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? active : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3.5 backdrop-blur-2xl transition-all',
        onClick && 'cursor-pointer select-none',
        active
          ? 'bg-white/95 ring-2 dark:bg-surface-900/95'
          : 'border-white/70 bg-white/75 shadow-card hover:bg-white/90 dark:border-white/[0.1] dark:bg-surface-900/75 dark:hover:bg-surface-900/90',
      )}
      style={
        active
          ? {
              borderColor: c.fg,
              boxShadow: `0 12px 28px -10px ${c.glow}, inset 0 1.5px 0 rgba(255,255,255,0.75)`,
            }
          : undefined
      }
    >
      <TopSpecular inset="inset-x-5" />

      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: c.glow }}
      />

      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
        style={{
          background: active ? c.gradient : c.bg,
          color: active ? '#FFFFFF' : c.fg,
          border: `1px solid ${active ? 'transparent' : c.border}`,
          boxShadow: active
            ? `0 6px 16px -4px ${c.glow}`
            : 'inset 0 1px 0 rgba(255,255,255,0.5)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent)',
          }}
        />
        <Icon paths={icon} size={19} strokeWidth={2.1} className="relative" />
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="text-[23px] font-bold leading-none tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} suffix={percent ? '%' : ''} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B] dark:text-slate-400">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#64748B]/80 dark:text-slate-400/80">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
});

/** Interactive Status Badge with 1-Click Cycling Support */
const StatusBadge = memo(function StatusBadge({
  status,
  label,
  onCycle,
  isUpdating = false,
}: {
  status: AttendanceStatus;
  label: string;
  onCycle?: () => void;
  isUpdating?: boolean;
}) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const tone = STATUS_TONE[status];
  const c = TONES[tone];
  const pulse = STATUS_PULSE[status] && !reduced;

  const content = (
    <>
      <span className="relative flex h-1.5 w-1.5">
        {pulse && !isUpdating && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.5, 1], opacity: [0.65, 0, 0.65] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span
          className={cn('relative h-1.5 w-1.5 rounded-full', isUpdating && 'animate-ping')}
          style={{ background: c.fg }}
        />
      </span>
      <span>{label}</span>
      {onCycle && (
        <Icon
          paths={I.cycle}
          size={10}
          strokeWidth={2.4}
          className="ml-0.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover/badge:translate-x-0 group-hover/badge:opacity-75"
        />
      )}
    </>
  );

  if (onCycle) {
    return (
      <motion.button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCycle();
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scaleX: 1.06, scaleY: 0.92 }}
        transition={SPRING.gel}
        disabled={isUpdating}
        title={t('attendance.cycleStatusTitle')}
        className="group/badge relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
        }}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {content}
    </span>
  );
});

/** Source Chip (FaceID, QR, Manual, System) */
const SourceChip = memo(function SourceChip({
  source,
  label,
}: {
  source: string;
  label: string;
}) {
  const key = (source || '').toUpperCase();
  const tone = SOURCE_TONE[key] ?? 'gray';
  const c = TONES[tone];
  const icon = SOURCE_ICON[key] ?? SOURCE_ICON.SYSTEM;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={icon} size={10} strokeWidth={2.2} />
      {label}
    </span>
  );
});

/** Squircle leading icon for inputs */
const FieldIcon = memo(function FieldIcon({
  icon,
  tone = 'blue',
}: {
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
      aria-hidden="true"
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
});

/** Status Segmented Control (Light & Dark Mode Adaptive Liquid Glass) */
function StatusSegmented({
  value,
  onChange,
  t,
}: {
  value: AttendanceStatus;
  onChange: (s: AttendanceStatus) => void;
  t: (k: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('attendance.selectStatus')}
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
    >
      {ATTENDANCE_STATUSES.map((s) => {
        const active = value === s;
        const c = TONES[STATUS_TONE[s]];
        return (
          <motion.button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s)}
            whileHover={{ y: -2 }}
            whileTap={{ scaleX: 1.04, scaleY: 0.94 }}
            transition={SPRING.gel}
            className={cn(
              'relative flex min-h-[56px] flex-col items-center gap-1.5 rounded-2xl border px-3 py-3 text-[11.5px] font-bold tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500',
              !active &&
                'border-black/[0.08] bg-white/60 text-[#64748B] hover:bg-white/90 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]',
            )}
            style={
              active
                ? {
                    borderColor: c.fg,
                    background: c.bg,
                    color: c.fg,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 20px -8px ${c.glow}`,
                  }
                : undefined
            }
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-xl transition-transform"
              style={{
                background: active ? c.gradient : 'rgba(100,116,139,0.12)',
                color: active ? '#FFFFFF' : '#64748B',
                boxShadow: active ? `0 4px 10px -2px ${c.glow}` : 'none',
              }}
            >
              <Icon paths={STATUS_ICON[s]} size={14} strokeWidth={2.3} />
            </span>
            <span className="uppercase tracking-[0.08em]">
              {t(`attendance.${s.toLowerCase()}`)}
            </span>
            <AnimatePresence>
              {active && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={SPRING.snappy}
                  className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ background: c.fg, color: '#fff' }}
                >
                  <Icon paths={I.check} size={9} strokeWidth={3.5} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Multi-segment iOS Storage-style Live Attendance Distribution Bar */
const TelemetryDistributionBar = memo(function TelemetryDistributionBar({
  present,
  late,
  excused,
  absent,
  t,
}: {
  present: number;
  late: number;
  excused: number;
  absent: number;
  t: (k: string) => string;
}) {
  const sum = present + late + excused + absent;
  if (sum <= 0) return null;

  const segments = [
    { key: 'present', label: t('attendance.present'), count: present, color: '#10B981' },
    { key: 'late', label: t('attendance.late'), count: late, color: '#F59E0B' },
    { key: 'excused', label: t('attendance.excused'), count: excused, color: '#007AFF' },
    { key: 'absent', label: t('attendance.absent'), count: absent, color: '#EF4444' },
  ].filter((s) => s.count > 0);

  return (
    <motion.div
      variants={cardVariants}
      className={cn(LIQUID_SURFACE, 'rounded-2xl px-4 py-3')}
    >
      <TopSpecular inset="inset-x-6" />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B] dark:text-slate-400">
          {t('executive.attendanceRate')} · {sum.toLocaleString('uz-UZ')}
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {segments.map((seg) => {
            const pct = Math.round((seg.count / sum) * 100);
            return (
              <div
                key={seg.key}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                <span className="text-[#64748B] dark:text-slate-400">{seg.label}:</span>
                <span className="font-bold tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-slate-200/70 p-0.5 dark:bg-white/[0.07]">
        {segments.map((seg) => {
          const widthPct = Math.max(2, (seg.count / sum) * 100);
          return (
            <motion.div
              key={seg.key}
              initial={{ width: 0 }}
              animate={{ width: `${widthPct}%` }}
              transition={SPRING.liquid}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                background: seg.color,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
              title={`${seg.label}: ${seg.count} (${Math.round(widthPct)}%)`}
            />
          );
        })}
      </div>
    </motion.div>
  );
});

/* ============================================================================
 * MAIN PAGE COMPONENT
 * ========================================================================== */

export function AttendancePage() {
  const { t, locale } = useSafeI18n();
  usePageTitle(t('attendance.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const sound = usePremiumSound();
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useAttendanceSocket();

  /* ── Filter, Sort & UI state ──────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics' | 'radar' | 'flow'>(
    'ledger',
  );
  const [page, setPage] = useState(1);
  const [groupId, setGroupId] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [cyclingId, setCyclingId] = useState<string | null>(null);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Modal state ──────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [form, setForm] = useState<AttendanceFormState>(() => createInitialForm());
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof AttendanceFormState, string>>
  >({});

  /* ── Edit / void state ────────────────────────────────────────────── */
  const [editTarget, setEditTarget] = useState<Attendance | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');
  const [voidTarget, setVoidTarget] = useState<Attendance | null>(null);

  const handleOpenRecordModal = useCallback(() => {
    soundRef.current?.playPop?.();
    setForm(createInitialForm(groupId || '', date || toLocalISOString()));
    setFormErrors({});
    setModalOpen(true);
  }, [groupId, date]);

  /* ── Query params (Zero-latency discrete filters) ─────────────────── */
  const params = useMemo<AttendanceFilters>(
    () => ({
      page,
      limit: 20,
      groupId: groupId || undefined,
      date: date || undefined,
      status: (status as AttendanceStatus) || undefined,
    }),
    [page, groupId, date, status],
  );

  /* ── Queries ──────────────────────────────────────────────────────── */
  const attendance = useQuery({
    queryKey: ['attendance', params],
    queryFn: () => attendanceApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const analyticsQuery = useQuery({
    queryKey: ['attendance-analytics', groupId, date],
    queryFn: () =>
      attendanceApi.analytics({
        groupId: groupId || undefined,
        date: date || undefined,
      }) as Promise<AttendanceAnalytics>,
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const data = attendance.data as Paginated<Attendance> | undefined;
  const groupList = useMemo(() => {
    if (Array.isArray(groups.data)) return groups.data;
    return (groups.data as Paginated<Group> | undefined)?.items || [];
  }, [groups.data]);

  const studentList = useMemo(() => {
    if (Array.isArray(students.data)) return students.data;
    return (students.data as Paginated<Student> | undefined)?.items || [];
  }, [students.data]);

  const selectedGroupDetails = useQuery({
    queryKey: ['attendance-form-group', form.groupId],
    queryFn: () => groupsApi.get(form.groupId),
    enabled: modalOpen && Boolean(form.groupId),
    staleTime: 30000,
  });

  const modalStudentList = useMemo(() => {
    if (!form.groupId) return studentList;
    const enrollments =
      (selectedGroupDetails.data as { enrollments?: Array<{ student?: Student }> } | undefined)
        ?.enrollments || [];
    if (enrollments.length === 0) return studentList;
    return enrollments
      .map((e) => e.student)
      .filter((s): s is Student => Boolean(s && s.id));
  }, [form.groupId, selectedGroupDetails.data, studentList]);

  useEffect(() => {
    if (!modalOpen || !form.groupId || !form.studentId) return;
    if (selectedGroupDetails.isLoading) return;
    const exists = modalStudentList.some((s) => s?.id === form.studentId);
    if (!exists && modalStudentList.length > 0) {
      setForm((prev) => ({ ...prev, studentId: '' }));
    }
  }, [modalOpen, form.groupId, form.studentId, modalStudentList, selectedGroupDetails.isLoading]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const statusCounts = useMemo(() => {
    const byStatus = analyticsQuery.data?.byStatus ?? [];
    const map: Record<string, number> = {};
    byStatus.forEach((s) => {
      const item = s as { status: string; count?: number; _count?: { status?: number } };
      map[item.status] = item.count ?? item._count?.status ?? 0;
    });
    return {
      present: map['PRESENT'] ?? 0,
      absent: map['ABSENT'] ?? 0,
      late: map['LATE'] ?? 0,
      excused: map['EXCUSED'] ?? 0,
    };
  }, [analyticsQuery.data]);

  /* ── Client-side instant search, source filtering & sorting ───────── */
  const rawItems = useMemo(() => data?.items || [], [data?.items]);
  const itemsList = useMemo(() => {
    let list = [...rawItems];
    const q = debouncedSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const sName = fullStudentName(a).toLowerCase();
        const gName = (a.group?.name || '').toLowerCase();
        const note = (a.note || '').toLowerCase();
        return sName.includes(q) || gName.includes(q) || note.includes(q);
      });
    }
    if (sourceFilter) {
      list = list.filter((a) => {
        const src = (a.source || 'SYSTEM').toUpperCase();
        if (sourceFilter === 'BIOMETRIC') {
          return src === 'FACE_ID' || src === 'FACE' || src === 'FACE_KIOSK' || src === 'TURNSTILE';
        }
        return src === sourceFilter;
      });
    }
    if (sortBy === 'date-desc') {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => fullStudentName(a).localeCompare(fullStudentName(b)));
    } else if (sortBy === 'status-asc') {
      list.sort((a, b) => a.status.localeCompare(b.status));
    }
    return list;
  }, [rawItems, debouncedSearchQuery, sourceFilter, sortBy]);

  /* ── Schedule-error helper ────────────────────────────────────────── */
  const pushScheduleAwareError = useCallback(
    (e: Error) => {
      const msg = getErrorMessage(e, locale);
      push('error', isScheduleError(msg) ? t('attendance.noSchedule') : msg);
    },
    [push, t, locale],
  );

  /* ── Cache invalidation helper ────────────────────────────────────── */
  const invalidateAttendanceCaches = useCallback(
    (studentId?: string) => {
      void qc.invalidateQueries({ queryKey: queryKeys.attendance.all() });
      void qc.invalidateQueries({ queryKey: ['attendance'] });
      void qc.invalidateQueries({ queryKey: ['attendance-analytics'] });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      if (studentId) {
        void qc.invalidateQueries({ queryKey: queryKeys.students.detail(studentId) });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      void attendance.refetch();
      void analyticsQuery.refetch();
    },
    [qc, attendance, analyticsQuery],
  );

  /* ── Create mutation ──────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () =>
      attendanceApi.create({
        groupId: form.groupId,
        date: form.date ? `${form.date}T12:00:00.000Z` : new Date().toISOString(),
        records: [
          {
            studentId: form.studentId,
            status: form.status,
            note: form.note.trim() || undefined,
          },
        ],
      }),
    onSuccess: () => {
      soundRef.current?.playPop?.();
      push('success', t('attendance.recordedSuccess'));
      const recordedStudentId = form.studentId;
      setModalOpen(false);
      setForm(createInitialForm(groupId, date));
      setFormErrors({});
      invalidateAttendanceCaches(recordedStudentId);
    },
    onError: pushScheduleAwareError,
  });

  /* ── Update mutation ──────────────────────────────────────────────── */
  const updateRecord = useMutation({
    mutationFn: (vars: { id: string; status: AttendanceStatus; note: string }) =>
      attendanceApi.update(vars.id, { status: vars.status, note: vars.note }),
    onSuccess: () => {
      push('success', t('attendance.recordUpdated'));
      setEditTarget(null);
      setCyclingId(null);
      invalidateAttendanceCaches();
    },
    onError: (err: Error) => {
      setCyclingId(null);
      pushScheduleAwareError(err);
    },
  });

  /* ── Void mutation ────────────────────────────────────────────────── */
  const voidRecord = useMutation({
    mutationFn: (id: string) => attendanceApi.remove(id),
    onSuccess: () => {
      push('success', t('attendance.recordVoided'));
      setVoidTarget(null);
      invalidateAttendanceCaches();
    },
    onError: pushScheduleAwareError,
  });

  /* ── Quick 1-Click Inline Status Cycle ────────────────────────────── */
  const mutateUpdate = updateRecord.mutate;
  const handleQuickCycleStatus = useCallback(
    (record: Attendance) => {
      if (updateRecord.isPending && cyclingId === record.id) return;
      soundRef.current?.playPop?.();
      const nextStatus = STATUS_CYCLE_ORDER[record.status] ?? 'PRESENT';
      setCyclingId(record.id);
      mutateUpdate({
        id: record.id,
        status: nextStatus,
        note: record.note || '',
      });
    },
    [mutateUpdate, updateRecord.isPending, cyclingId],
  );

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleFilterChange = useCallback(
    (setter: (value: string) => void) =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setter(e.target.value);
        setPage(1);
      },
    [],
  );

  const handleResetFilters = useCallback(() => {
    soundRef.current?.playPop?.();
    setGroupId('');
    setDate('');
    setStatus('');
    setSourceFilter('');
    setSortBy('date-desc');
    setSearchQuery('');
    setPage(1);
  }, []);

  const handleFormChange = useCallback(
    (field: keyof AttendanceFormState) =>
      (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const nextVal = e.target.value;
        setForm((prev) => ({
          ...prev,
          [field]: nextVal,
          ...(field === 'groupId' && prev.groupId !== nextVal ? { studentId: '' } : {}),
        }));
        setFormErrors((prev) => ({
          ...prev,
          [field]: undefined,
          ...(field === 'groupId' ? { studentId: undefined } : {}),
        }));
      },
    [],
  );

  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof AttendanceFormState, string>> = {};
    if (!form.groupId) errors.groupId = t('common.validation.selectGroup');
    if (!form.studentId) errors.studentId = t('common.validation.selectStudent');
    if (!form.date) errors.date = t('common.validation.selectDate');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (create.isPending) return;
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const openEdit = useCallback((record: Attendance) => {
    setEditTarget(record);
    setEditStatus(record.status);
    setEditNote(record.note || '');
  }, []);

  const handleEditSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!editTarget || updateRecord.isPending) return;
      updateRecord.mutate({ id: editTarget.id, status: editStatus, note: editNote.trim() });
    },
    [editTarget, editStatus, editNote, updateRecord],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(createInitialForm(groupId, date));
    setFormErrors({});
  }, [groupId, date]);

  const { refetch: refetchAttendance } = attendance;
  const handleRetry = useCallback(() => {
    soundRef.current?.playPop?.();
    void refetchAttendance();
    void analyticsQuery.refetch();
  }, [refetchAttendance, analyticsQuery]);

  const todayISO = useMemo(() => toLocalISOString(), []);
  const yesterdayISO = useMemo(() => getYesterdayISO(), []);

  const hasActiveFilters = Boolean(
    groupId || date || status || sourceFilter || sortBy !== 'date-desc' || searchQuery.trim(),
  );
  const totalRecords = data?.total || 0;
  const overallRate = analyticsQuery.data?.overall.rate ?? 0;
  const overallPresent = analyticsQuery.data?.overall.present ?? 0;
  const overallTotal = analyticsQuery.data?.overall.total ?? 0;

  /* ── Sidecar QuickLook Inspector ──────────────────────────────────── */
  const handleOpenAttendanceSidecar = useCallback(
    (record: Attendance) => {
      soundRef.current?.playPop?.();
      const sName = fullStudentName(record);
      const gName =
        record.group?.name ||
        groupList.find((g) => g.id === record.groupId)?.name ||
        t('attendance.defaultGroup');
      const quickLook: QuickLookData = {
        id: record.id,
        type: 'student',
        title: sName,
        subtitle: `${gName} · ${formatDate(record.date)}`,
        badge: {
          text: record.status,
          tone:
            record.status === 'PRESENT'
              ? 'emerald'
              : record.status === 'ABSENT'
                ? 'rose'
                : 'amber',
        },
        avatar: {
          text: getInitials(sName),
          color: record.status === 'PRESENT' ? '#10B981' : '#EF4444',
        },
        metrics: [
          {
            label: t('attendance.statusLabel'),
            value: t(`attendance.${record.status.toLowerCase()}`),
          },
          {
            label: t('attendance.dateLabel'),
            value: formatDate(record.date),
          },
          {
            label: t('attendance.sourceLabel'),
            value: record.source || 'Manual',
          },
        ],
        details: [
          { label: t('attendance.studentLabel'), value: sName, copyable: true },
          { label: t('attendance.defaultGroup'), value: gName },
          { label: t('attendance.dateLabel'), value: formatDate(record.date) },
          {
            label: t('attendance.statusLabel'),
            value: t(`attendance.${record.status.toLowerCase()}`),
          },
          { label: t('attendance.note'), value: record.note || t('attendance.noNote') },
        ],
        primaryAction: {
          label: t('common.edit'),
          onExecute: () => openEdit(record),
        },
      };
      openSidecar(quickLook);
    },
    [openEdit, groupList, t],
  );

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Attendance>({
    items: itemsList,
    getItemId: (a) => a.id,
    rowIdPrefix: 'attendance-row-',
    onSelect: (a) => handleOpenAttendanceSidecar(a),
    onQuickLook: (a) => handleOpenAttendanceSidecar(a),
    onEdit: (a) => openEdit(a),
  });

  const allVisibleSelected =
    itemsList.length > 0 && itemsList.every((item) => isSelected(item.id));

  const handleToggleSelectAllVisible = useCallback(() => {
    soundRef.current?.playPop?.();
    if (allVisibleSelected) {
      clearSelection();
    } else {
      itemsList.forEach((item) => {
        if (!isSelected(item.id)) toggleSelection(item.id);
      });
    }
  }, [allVisibleSelected, clearSelection, itemsList, isSelected, toggleSelection]);

  /* ── Non-Destructive Parallel Bulk Status Update ──────────────────── */
  const handleBatchMarkStatus = useCallback(
    async (targetStatus: AttendanceStatus) => {
      if (isBatchUpdating) return;
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;

      setIsBatchUpdating(true);
      soundRef.current?.playPop?.();
      try {
        // Preserve each record's existing note and skip records already in targetStatus
        const recordById = new Map(rawItems.map((r) => [r.id, r]));
        const actionableIds = ids.filter((id) => {
          const existing = recordById.get(id);
          return !existing || existing.status !== targetStatus;
        });

        const results = await Promise.allSettled(
          actionableIds.map((id) => {
            const existingNote = recordById.get(id)?.note ?? '';
            return attendanceApi.update(id, { status: targetStatus, note: existingNote });
          }),
        );

        const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
        const rejected = results.filter((r) => r.status === 'rejected').length;
        clearSelection();
        invalidateAttendanceCaches();

        if (fulfilled > 0 || actionableIds.length === 0) {
          push('success', t('attendance.batchMarkSuccess', { count: fulfilled || ids.length }));
        }
        if (rejected > 0) {
          push('error', `${rejected} ta davomat yozuvini yangilashda xatolik yuz berdi`);
        }
      } finally {
        setIsBatchUpdating(false);
      }
    },
    [isBatchUpdating, selectedIds, rawItems, clearSelection, invalidateAttendanceCaches, push, t],
  );

  const handleExportCSV = useCallback(
    (rowsToExport: Attendance[]) => {
      if (rowsToExport.length === 0) return;
      const headers = ['ID', 'Student', 'Group', 'Date', 'Status', 'Source', 'Note'];
      const rows = rowsToExport.map((a) =>
        [
          a.id,
          fullStudentName(a).replace(/"/g, '""'),
          (a.group?.name || '').replace(/"/g, '""'),
          a.date,
          a.status,
          a.source || '',
          (a.note || '').replace(/"/g, '""'),
        ]
          .map((val) => `"${val}"`)
          .join(','),
      );

      const bom = '\uFEFF';
      const csvText = bom + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      push('success', t('attendance.exportSuccess', { count: rowsToExport.length }));
    },
    [push, t],
  );

  const handleExportSelectedAttendanceCSV = useCallback(() => {
    const selectedRows = itemsList.filter((a) => isSelected(a.id));
    handleExportCSV(selectedRows);
    clearSelection();
  }, [itemsList, isSelected, handleExportCSV, clearSelection]);

  /* ── Global Keyboard Shortcuts (`/`, `N`, `E`, `V`, `I`, `G`, `P`, `C`) ─ */
  const hasAnyDialogOpen = Boolean(
    modalOpen || registerModalOpen || editTarget || voidTarget,
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hasAnyDialogOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable);
      if (isInput) return;

      const key = e.key.toLowerCase();
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === 'n') {
        e.preventDefault();
        handleOpenRecordModal();
      } else if (key === 'p' && selectedCount > 0) {
        e.preventDefault();
        void handleBatchMarkStatus('PRESENT');
      } else if (key === 'c' && selectedCount > 0) {
        e.preventDefault();
        handleExportSelectedAttendanceCSV();
      } else if (key === 'e') {
        e.preventDefault();
        if (selectedCount > 0) {
          handleExportSelectedAttendanceCSV();
        } else {
          soundRef.current?.playPop?.();
          window.dispatchEvent(new CustomEvent('medu:open-quick-attendance'));
        }
      } else if (key === 'v') {
        e.preventDefault();
        soundRef.current?.playPop?.();
        setRegisterModalOpen(true);
      } else if (key === 'g') {
        e.preventDefault();
        soundRef.current?.playPop?.();
        setViewMode((m) => (m === 'list' ? 'grid' : 'list'));
      } else if (key === 'i') {
        e.preventDefault();
        soundRef.current?.playPop?.();
        window.dispatchEvent(
          new CustomEvent('open-ai-copilot', {
            detail: { prompt: t('attendance.aiPrompt') },
          }),
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hasAnyDialogOpen,
    selectedCount,
    handleOpenRecordModal,
    handleBatchMarkStatus,
    handleExportSelectedAttendanceCSV,
    t,
  ]);

  /* ── Initial Loading State ────────────────────────────────────────── */
  if (attendance.isLoading && !data) {
    return (
      <div className="page-container max-w-7xl space-y-5 pb-24 sm:pb-8 2xl:max-w-[1600px] 3xl:max-w-[1800px]">
        <AttendanceSkeleton />
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
  if (attendance.isError) {
    return (
      <div className="page-container max-w-7xl space-y-5 pb-24 sm:pb-8 2xl:max-w-[1600px] 3xl:max-w-[1800px]">
        <div className="glass-card p-8">
          <GlassErrorState
            title={t('attendance.loadFailed')}
            message={getErrorMessage(attendance.error as Error, locale)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  /* ── Main Render ──────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container relative isolate max-w-7xl space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))] 2xl:max-w-[1600px] 3xl:max-w-[1800px]"
    >
      {toastNode}
      <AuroraMesh variant="corporate" opacity={0.65} />

      {/* ============================================================
          APPLE iOS 27 LIQUID GLASS HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className={cn(LIQUID_SURFACE, 'rounded-3xl p-6 sm:p-7')}>
          <TopSpecular inset="inset-x-10" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl dark:bg-emerald-500/10"
          />

          <div className="relative flex flex-col items-start gap-5 lg:flex-row lg:items-center">
            {/* Squircle Calendar Hero Tile */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05, rotate: -2 }}
              transition={SPRING.smooth}
              className="relative flex h-[3.75rem] w-[3.75rem] shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ring-1 ring-black/5 dark:ring-white/15"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #4F46E5 100%)',
                boxShadow:
                  '0 12px 28px -8px rgba(0, 122, 255, 0.55), inset 0 1.5px 0 rgba(255,255,255,0.5)',
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.42), transparent 55%)',
                }}
              />
              <Icon paths={I.calendarCheck} size={28} strokeWidth={2.1} className="relative" />
            </motion.div>

            {/* Title & Live Status Chips */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:text-emerald-400">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('attendance.badge')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-blue-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:text-blue-400">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {totalRecords}{' '}
                  {totalRecords === 1 ? t('attendance.countOne') : t('attendance.countMany')}
                </span>
                {overallTotal > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    {overallRate}% {t('executive.attendanceRate')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] sm:text-4xl dark:text-[#F5F5F7]">
                {t('attendance.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#64748B] dark:text-slate-400">
                {t('attendance.pageSubtitle')}
              </p>
            </div>

            {/* Action Cluster */}
            <div className="flex w-full flex-wrap items-center gap-2.5 lg:w-auto">
              {/* Live Refresh Button */}
              <motion.button
                type="button"
                onClick={handleRetry}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scaleX: 1.06, scaleY: 0.9 }}
                transition={SPRING.gel}
                title={t('attendance.refresh')}
                aria-label={t('attendance.refresh')}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white/70 text-[#64748B] transition-colors hover:text-[#1D1D1F] dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white"
              >
                <Icon
                  paths={I.refresh}
                  size={16}
                  strokeWidth={2.1}
                  className={attendance.isFetching ? 'animate-spin text-blue-500' : ''}
                />
              </motion.button>

              {/* Export Visible CSV Button */}
              {itemsList.length > 0 && (
                <motion.button
                  type="button"
                  onClick={() => handleExportCSV(itemsList)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] bg-white/70 px-3.5 text-[12.5px] font-semibold text-[#1D1D1F] transition-colors hover:bg-white dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-[#F5F5F7] dark:hover:bg-white/[0.08]"
                >
                  <Icon paths={I.download} size={14} strokeWidth={2.2} />
                  <span className="hidden sm:inline">CSV</span>
                </motion.button>
              )}

              {/* Fast-Tap Express Attendance Mode */}
              <motion.button
                type="button"
                onClick={() => {
                  soundRef.current?.playPop?.();
                  window.dispatchEvent(new CustomEvent('medu:open-quick-attendance'));
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scaleX: 1.05, scaleY: 0.92 }}
                transition={SPRING.gel}
                title={`${t('attendance.expressHint')} (E)`}
                aria-label={t('attendance.express')}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 text-xs font-bold text-indigo-700 shadow-xs transition-colors hover:bg-indigo-500/20 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
              >
                <span className="text-sm">⚡</span>
                <span className="hidden sm:inline">{t('attendance.express')}</span>
              </motion.button>

              {/* Official A4 Attendance Register Sheet Button */}
              <motion.button
                type="button"
                onClick={() => {
                  soundRef.current?.playPop?.();
                  setRegisterModalOpen(true);
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scaleX: 1.05, scaleY: 0.92 }}
                transition={SPRING.gel}
                title={`${t('attendance.registerSheetTitle')} (V)`}
                aria-label="Vedomost A4"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-bold text-violet-700 shadow-xs transition-colors hover:bg-violet-500/20 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300"
              >
                <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />
                <span className="hidden sm:inline">Vedomost</span>
              </motion.button>

              {/* AI Copilot Analysis */}
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scaleX: 1.05, scaleY: 0.92 }}
                transition={SPRING.gel}
              >
                <GlassButton
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('open-ai-copilot', {
                        detail: { prompt: t('attendance.aiPrompt') },
                      }),
                    );
                  }}
                  title={`${t('attendance.aiAnalysis')} (I)`}
                  aria-label={t('attendance.aiAnalysis')}
                  className="h-10 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 shadow-xs hover:bg-purple-500/20"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                    <Icon paths={I.sparkles} size={14} strokeWidth={2.2} />
                    <span className="hidden sm:inline">{t('attendance.aiAnalysis')}</span>
                  </span>
                </GlassButton>
              </motion.div>

              {/* Primary CTA: Record Attendance */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scaleX: 1.04, scaleY: 0.94 }}
                transition={SPRING.gel}
              >
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleOpenRecordModal}
                  aria-label={t('attendance.record')}
                  className="h-10 rounded-2xl px-4 text-xs font-bold shadow-sm sm:text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    <span>{t('attendance.record')}</span>
                    <kbd
                      aria-hidden="true"
                      className="hidden rounded border border-white/30 bg-white/15 px-1.5 py-0.5 font-mono text-[10px] xl:inline-block"
                    >
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
          ENTERPRISE ATTENDANCE TABS SWITCHER (Liquid Capsule Morph)
      ============================================================ */}
      <LayoutGroup id="attendance-main-tabs">
        <div
          role="tablist"
          aria-label={t('attendance.title')}
          className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/65 bg-white/75 p-1.5 shadow-xs backdrop-blur-2xl dark:border-white/[0.09] dark:bg-white/[0.04]"
        >
          {(
            [
              { id: 'ledger', emoji: '📋', label: t('attendance.tabs.ledger') },
              { id: 'analytics', emoji: '📈', label: t('attendance.tabs.analytics') },
              { id: 'radar', emoji: '🚨', label: t('attendance.tabs.radar') },
              { id: 'flow', emoji: '🚪', label: t('attendance.tabs.flow') },
            ] as const
          ).map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  soundRef.current?.playPop?.();
                  setActiveTab(tab.id);
                }}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-colors',
                  selected
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                )}
              >
                {selected && (
                  <motion.span
                    layoutId="attendanceMainTabPill"
                    transition={SPRING.snappy}
                    aria-hidden="true"
                    className="absolute inset-0 -z-10 rounded-xl border border-white/80 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(15,23,42,0.08)] dark:border-white/15 dark:bg-white/12"
                  />
                )}
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <AttendanceWaveChart overallRate={overallRate} />
          <AttendanceHeatmap overallRate={overallRate} />
        </div>
      )}

      {activeTab === 'radar' && (
        <div className="space-y-6">
          <AttendanceRiskSection />
        </div>
      )}

      {activeTab === 'flow' && (
        <div className="space-y-6">
          <AttendanceTrafficFlowHeatmap />
          <RushHourBatchAttendanceProcessor />
        </div>
      )}

      {activeTab === 'ledger' && (
        <>
          {/* ============================================================
              KPI STATS + INTERACTIVE STATUS FILTERING + DISTRIBUTION BAR
          ============================================================ */}
          {analyticsQuery.data && (
            <div className="space-y-3">
              <motion.div
                variants={containerVariants}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
              >
                <KpiTile
                  label={t('executive.attendanceRate')}
                  value={overallRate}
                  icon={I.calendarCheck}
                  tone={overallRate >= 80 ? 'emerald' : overallRate >= 60 ? 'orange' : 'red'}
                  percent
                  active={status === ''}
                  onClick={() => {
                    setStatus('');
                    setPage(1);
                  }}
                  secondary={t('attendance.trendPresent', {
                    present: overallPresent,
                    total: overallTotal,
                  })}
                />
                <KpiTile
                  label={t('attendance.present')}
                  value={statusCounts.present}
                  icon={I.checkCircle}
                  tone="emerald"
                  active={status === 'PRESENT'}
                  onClick={() => {
                    setStatus((prev) => (prev === 'PRESENT' ? '' : 'PRESENT'));
                    setPage(1);
                  }}
                />
                <KpiTile
                  label={t('attendance.absent')}
                  value={statusCounts.absent}
                  icon={I.xCircle}
                  tone="red"
                  active={status === 'ABSENT'}
                  onClick={() => {
                    setStatus((prev) => (prev === 'ABSENT' ? '' : 'ABSENT'));
                    setPage(1);
                  }}
                />
                <KpiTile
                  label={t('attendance.late')}
                  value={statusCounts.late}
                  icon={I.clock}
                  tone="orange"
                  active={status === 'LATE'}
                  onClick={() => {
                    setStatus((prev) => (prev === 'LATE' ? '' : 'LATE'));
                    setPage(1);
                  }}
                />
                <KpiTile
                  label={t('attendance.excused')}
                  value={statusCounts.excused}
                  icon={I.shield}
                  tone="blue"
                  active={status === 'EXCUSED'}
                  onClick={() => {
                    setStatus((prev) => (prev === 'EXCUSED' ? '' : 'EXCUSED'));
                    setPage(1);
                  }}
                />
              </motion.div>

              <TelemetryDistributionBar
                present={statusCounts.present}
                late={statusCounts.late}
                excused={statusCounts.excused}
                absent={statusCounts.absent}
                t={t}
              />
            </div>
          )}

          {/* ============================================================
              LIQUID GLASS FILTER, SOURCE & SORT COMMAND BAR
          ============================================================ */}
          <motion.div variants={cardVariants}>
            <div className={cn(LIQUID_SURFACE, 'space-y-3 rounded-2xl p-4')}>
              <TopSpecular inset="inset-x-8" />

              {/* Primary Filter Grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {/* Instant Student / Note Search */}
                <div className="relative lg:col-span-2">
                  <FieldIcon icon={I.search} tone="cyan" />
                  <GlassInput
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`${t('attendance.selectStudent')}... (/)`}
                    aria-label={t('attendance.selectStudent')}
                    className="pl-11 pr-8"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
                      aria-label="Qidiruvni tozalash"
                    >
                      <Icon paths={I.x} size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {/* Group Selector */}
                <div className="relative">
                  <FieldIcon icon={I.usersRound} tone="purple" />
                  <GlassSelect
                    value={groupId}
                    onChange={handleFilterChange(setGroupId)}
                    aria-label={t('students.filterGroupLabel')}
                    className="pl-11"
                  >
                    <option value="">{t('attendance.allGroups')}</option>
                    {groupList.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                {/* Date Input */}
                <div className="relative">
                  <FieldIcon icon={I.calendar} tone="blue" />
                  <GlassInput
                    type="date"
                    value={date}
                    onChange={handleFilterChange(setDate)}
                    aria-label={t('attendance.filterByDate')}
                    className="pl-11"
                  />
                </div>

                {/* Status Selector */}
                <div className="relative">
                  <FieldIcon icon={I.filter} tone="orange" />
                  <GlassSelect
                    value={status}
                    onChange={handleFilterChange(setStatus)}
                    aria-label={t('attendance.filterByStatus')}
                    className="pl-11"
                  >
                    <option value="">{t('attendance.allStatuses')}</option>
                    {ATTENDANCE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`attendance.${s.toLowerCase()}`)}
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                {/* Sort Selector */}
                <div className="relative">
                  <FieldIcon icon={I.sort} tone="emerald" />
                  <GlassSelect
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    aria-label="Saralash"
                    className="pl-11"
                  >
                    <option value="date-desc">Sana (Yangi ↓)</option>
                    <option value="name-asc">Talaba (A–Z)</option>
                    <option value="status-asc">Holat bo&apos;yicha</option>
                  </GlassSelect>
                </div>
              </div>

              {/* Secondary Utility Sub-bar: Quick Date Pills + Biometric Source Filter + Layout Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.04] pt-2.5 dark:border-white/[0.05]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Select All Checkbox Pill */}
                  {itemsList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleToggleSelectAllVisible}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors',
                        allVisibleSelected
                          ? 'border border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : 'bg-black/[0.03] text-[#64748B] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-slate-400',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-3.5 w-3.5 items-center justify-center rounded border',
                          allVisibleSelected
                            ? 'border-blue-500 bg-blue-500 text-white'
                            : 'border-slate-400/60',
                        )}
                      >
                        {allVisibleSelected && (
                          <Icon paths={I.check} size={9} strokeWidth={3.5} />
                        )}
                      </span>
                      <span>
                        {selectedCount > 0
                          ? `${selectedCount} tanlandi`
                          : 'Barchasini tanlash'}
                      </span>
                    </button>
                  )}

                  {/* Quick Date Presets */}
                  <button
                    type="button"
                    onClick={() => {
                      setDate(date === todayISO ? '' : todayISO);
                      setPage(1);
                    }}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                      date === todayISO
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-black/[0.03] text-[#64748B] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-slate-400',
                    )}
                  >
                    Bugun
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDate(date === yesterdayISO ? '' : yesterdayISO);
                      setPage(1);
                    }}
                    className={cn(
                      'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                      date === yesterdayISO
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-black/[0.03] text-[#64748B] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-slate-400',
                    )}
                  >
                    Kecha
                  </button>

                  {/* Quick Source / Biometric Filter Pills */}
                  {(
                    [
                      { id: 'BIOMETRIC', label: '🛡️ Face ID / Turniket' },
                      { id: 'QR', label: '📱 QR' },
                      { id: 'MANUAL', label: '✍️ Manual' },
                    ] as const
                  ).map((src) => {
                    const isSel = sourceFilter === src.id;
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => setSourceFilter((cur) => (cur === src.id ? '' : src.id))}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                          isSel
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-black/[0.03] text-[#64748B] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-slate-400',
                        )}
                      >
                        {src.label}
                      </button>
                    );
                  })}

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                    >
                      <Icon paths={I.x} size={11} strokeWidth={2.5} />
                      Filtrlarni tozalash
                    </button>
                  )}
                </div>

                {/* Segmented View Mode Toggle (List vs Bento Grid) */}
                <LayoutGroup id="attendance-view-switch">
                  <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-0.5 dark:bg-white/[0.06]">
                    {(['list', 'grid'] as const).map((mode) => {
                      const active = viewMode === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setViewMode(mode)}
                          title={mode === 'list' ? 'Ro‘yxat [G]' : 'Bento Grid [G]'}
                          className={cn(
                            'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors',
                            active
                              ? 'text-[#1D1D1F] dark:text-white'
                              : 'text-[#64748B] hover:text-[#1D1D1F] dark:text-slate-400',
                          )}
                        >
                          {active && (
                            <motion.span
                              layoutId="viewModePill"
                              transition={SPRING.snappy}
                              className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-surface-800"
                            />
                          )}
                          <Icon
                            paths={mode === 'list' ? I.list : I.grid}
                            size={13}
                            strokeWidth={2.2}
                            className="relative z-10"
                          />
                          <span className="relative z-10 uppercase tracking-wider">
                            {mode === 'list' ? 'List' : 'Bento'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              </div>
            </div>
          </motion.div>

          {/* ============================================================
              RECORDS CONTAINER (LIST OR BENTO GRID VIEW)
          ============================================================ */}
          <motion.div
            variants={cardVariants}
            className={cn(LIQUID_SURFACE, 'rounded-3xl')}
          >
            <TopSpecular inset="inset-x-10" />
            {itemsList.length === 0 ? (
              <div className="relative p-12">
                <div className="flex flex-col items-center text-center">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    style={{
                      boxShadow:
                        'inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 28px -12px rgba(37,99,235,0.45)',
                    }}
                  >
                    <Icon paths={I.empty} size={28} strokeWidth={1.8} />
                  </div>
                  <p className="mt-4 text-[16px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {hasActiveFilters
                      ? t('attendance.emptyFilteredTitle')
                      : t('attendance.emptyTitle')}
                  </p>
                  <p className="mt-1 max-w-sm text-[13px] font-medium text-[#64748B] dark:text-slate-400">
                    {hasActiveFilters
                      ? t('attendance.emptyFilteredHint')
                      : t('attendance.emptyMessage')}
                  </p>
                  <div className="mt-5 flex items-center gap-2">
                    {hasActiveFilters ? (
                      <GlassButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleResetFilters}
                      >
                        Filtrlarni tiklash
                      </GlassButton>
                    ) : (
                      <GlassButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleOpenRecordModal}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                          {t('attendance.record')}
                        </span>
                      </GlassButton>
                    )}
                  </div>
                </div>
              </div>
            ) : viewMode === 'list' ? (
              /* ── APPLE LIST VIEW ────────────────────────────────────── */
              <div className="relative divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                {itemsList.map((a, idx) => {
                  const name = fullStudentName(a);
                  const initials = getInitials(name);
                  const gradient = avatarGradient(name);
                  const selected = isSelected(a.id);
                  const focused = focusedIndex === idx;

                  return (
                    <motion.div
                      key={a.id}
                      id={`attendance-row-${a.id}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: Math.min(idx * 0.02, 0.3) }}
                      onClick={() => handleOpenAttendanceSidecar(a)}
                      className={cn(
                        'group flex cursor-pointer flex-col gap-3 px-4 py-3.5 transition-all sm:flex-row sm:items-center sm:justify-between sm:px-5',
                        selected
                          ? 'bg-blue-500/[0.08] dark:bg-blue-500/[0.14]'
                          : focused
                            ? 'bg-emerald-500/[0.06] dark:bg-emerald-500/[0.10]'
                            : 'hover:bg-slate-500/[0.035] dark:hover:bg-white/[0.025]',
                      )}
                    >
                      {/* Left: Selection Checkbox + Avatar + Student Info */}
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelection(a.id);
                          }}
                          className="-m-2 inline-flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          aria-label={t('attendance.selectRowAria', { name })}
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-lg border transition-all',
                              selected
                                ? 'scale-105 border-blue-500 bg-blue-500 text-white shadow-xs'
                                : 'border-slate-300 bg-transparent group-hover:border-blue-400 dark:border-white/20',
                            )}
                          >
                            {selected && <Icon paths={I.check} size={11} strokeWidth={3.5} />}
                          </span>
                        </button>

                        {/* Glossy Gradient Avatar */}
                        <div
                          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/60 transition-transform duration-200 group-hover:scale-105 sm:h-11 sm:w-11 dark:ring-slate-900/60"
                          style={{
                            background: gradient,
                            boxShadow:
                              'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -4px rgba(0,0,0,0.28)',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 rounded-full"
                            style={{
                              background:
                                'linear-gradient(180deg, rgba(255,255,255,0.38), transparent 55%)',
                            }}
                          />
                          <span className="relative">{initials}</span>
                        </div>

                        {/* Student Name + Metadata Chips */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {name}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[#64748B] dark:text-slate-400">
                            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                              <Icon
                                paths={I.calendar}
                                size={11}
                                strokeWidth={2.2}
                                className="opacity-65"
                              />
                              {formatDate(a.date)}
                            </span>
                            {a.group?.name && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#1D1D1F] dark:bg-white/[0.06] dark:text-slate-200">
                                <Icon
                                  paths={I.book}
                                  size={10}
                                  strokeWidth={2.2}
                                  className="opacity-70"
                                />
                                {a.group.name}
                              </span>
                            )}
                            <SourceChip
                              source={a.source || 'SYSTEM'}
                              label={a.source || 'SYSTEM'}
                            />
                            {a.note && (
                              <span
                                className="inline-flex max-w-[14rem] items-center gap-1 truncate italic text-slate-500 sm:max-w-[18rem] dark:text-slate-400"
                                title={a.note}
                              >
                                <Icon
                                  paths={I.note}
                                  size={10}
                                  strokeWidth={2}
                                  className="shrink-0 opacity-60"
                                />
                                {a.note}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Interactive 1-Click Status Badge + Action Buttons */}
                      <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-black/[0.04] pt-2 sm:w-auto sm:justify-end sm:border-0 sm:pt-0 dark:border-white/[0.04]">
                        <StatusBadge
                          status={a.status}
                          label={t(`attendance.${a.status.toLowerCase()}`)}
                          onCycle={() => handleQuickCycleStatus(a)}
                          isUpdating={cyclingId === a.id && updateRecord.isPending}
                        />

                        <div
                          className="flex shrink-0 items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <motion.button
                            type="button"
                            onClick={() => handleOpenAttendanceSidecar(a)}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scaleX: 1.06, scaleY: 0.9 }}
                            transition={SPRING.gel}
                            aria-label={t('attendance.dossier')}
                            title={t('attendance.sidecarTitle')}
                            className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
                            style={{
                              background: TONES.purple.bg,
                              color: TONES.purple.fg,
                              border: `1px solid ${TONES.purple.border}`,
                            }}
                          >
                            <Icon paths={I.sidebarRight} size={14} strokeWidth={2.1} />
                          </motion.button>

                          <motion.button
                            type="button"
                            onClick={() => openEdit(a)}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scaleX: 1.06, scaleY: 0.9 }}
                            transition={SPRING.gel}
                            aria-label={t('attendance.editAria', {
                              name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
                            })}
                            title={t('common.edit')}
                            className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                            style={{
                              background: TONES.blue.bg,
                              color: TONES.blue.fg,
                              border: `1px solid ${TONES.blue.border}`,
                            }}
                          >
                            <Icon paths={I.edit} size={14} strokeWidth={2.1} />
                          </motion.button>

                          <motion.button
                            type="button"
                            onClick={() => setVoidTarget(a)}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scaleX: 1.06, scaleY: 0.9 }}
                            transition={SPRING.gel}
                            aria-label={t('attendance.voidAria', {
                              name: a.student?.user?.firstName ?? t('attendance.selectStudent'),
                            })}
                            title={t('attendance.void')}
                            className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                            style={{
                              background: TONES.red.bg,
                              color: TONES.red.fg,
                              border: `1px solid ${TONES.red.border}`,
                            }}
                          >
                            <Icon paths={I.trash} size={14} strokeWidth={2.1} />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* ── APPLE BENTO GRID VIEW (Ergonomic Touch Targets) ────── */
              <div className="grid grid-cols-1 gap-3.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {itemsList.map((a, idx) => {
                  const name = fullStudentName(a);
                  const initials = getInitials(name);
                  const gradient = avatarGradient(name);
                  const selected = isSelected(a.id);
                  const focused = focusedIndex === idx;

                  return (
                    <motion.div
                      key={a.id}
                      id={`attendance-row-${a.id}`}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -3 }}
                      transition={{ ...SPRING.smooth, delay: Math.min(idx * 0.025, 0.25) }}
                      onClick={() => handleOpenAttendanceSidecar(a)}
                      className={cn(
                        'group relative flex cursor-pointer flex-col justify-between rounded-2xl border p-4 transition-all',
                        selected
                          ? 'border-blue-500 bg-blue-500/[0.08] dark:bg-blue-500/[0.14]'
                          : focused
                            ? 'border-emerald-500/50 bg-emerald-500/[0.06] ring-2 ring-emerald-500/30 dark:bg-emerald-500/[0.10]'
                            : 'border-black/[0.06] bg-white/65 shadow-xs hover:bg-white/95 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(a.id);
                            }}
                            className="-m-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={t('attendance.selectRowAria', { name })}
                          >
                            <span
                              className={cn(
                                'flex h-[18px] w-[18px] items-center justify-center rounded-md border',
                                selected
                                  ? 'border-blue-500 bg-blue-500 text-white'
                                  : 'border-slate-300 dark:border-white/20',
                              )}
                            >
                              {selected && <Icon paths={I.check} size={10} strokeWidth={3.5} />}
                            </span>
                          </button>

                          <div
                            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                            style={{ background: gradient }}
                          >
                            {initials}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                              {name}
                            </p>
                            <p className="truncate text-[11.5px] font-medium text-[#64748B] dark:text-slate-400">
                              {a.group?.name || t('attendance.defaultGroup')}
                            </p>
                          </div>
                        </div>

                        <StatusBadge
                          status={a.status}
                          label={t(`attendance.${a.status.toLowerCase()}`)}
                          onCycle={() => handleQuickCycleStatus(a)}
                          isUpdating={cyclingId === a.id && updateRecord.isPending}
                        />
                      </div>

                      {a.note && (
                        <p className="mt-3 line-clamp-2 rounded-xl bg-black/[0.03] px-3 py-2 text-[11.5px] italic text-[#64748B] dark:bg-white/[0.04] dark:text-slate-300">
                          &ldquo;{a.note}&rdquo;
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between border-t border-black/[0.05] pt-3 dark:border-white/[0.06]">
                        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#64748B]">
                          <span>{formatDate(a.date)}</span>
                          <SourceChip
                            source={a.source || 'SYSTEM'}
                            label={a.source || 'SYSTEM'}
                          />
                        </div>

                        <div
                          className="flex items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenAttendanceSidecar(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-500/10 dark:text-indigo-400"
                            title={t('attendance.sidecarTitle')}
                            aria-label={t('attendance.dossier')}
                          >
                            <Icon paths={I.sidebarRight} size={14} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400"
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Icon paths={I.edit} size={14} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setVoidTarget(a)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-500/10"
                            title={t('attendance.void')}
                            aria-label={t('attendance.void')}
                          >
                            <Icon paths={I.trash} size={14} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Pagination Footer */}
            {data && data.totalPages > 1 && (
              <div className="relative border-t border-slate-200/80 px-4 py-3 dark:border-white/[0.06]">
                <GlassPagination
                  page={page}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </motion.div>
        </>
      )}

      <OfficialAttendanceRegisterModal
        open={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
      />

      {/* ============================================================
          RECORD ATTENDANCE MODAL (Group First -> Student + Note Presets)
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('attendance.record')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Hint Banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('attendance.recordHint')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 1. Group First — so filtering students never wipes a chosen student */}
            <GlassField
              label={t('attendance.selectGroup')}
              required
              error={formErrors.groupId}
            >
              <div className="relative">
                <FieldIcon icon={I.usersRound} tone="green" />
                <GlassSelect
                  value={form.groupId}
                  onChange={handleFormChange('groupId')}
                  required
                  aria-invalid={Boolean(formErrors.groupId)}
                  aria-describedby={formErrors.groupId ? 'group-error' : undefined}
                  className="pl-11"
                >
                  <option value="">{t('attendance.groupPlaceholder')}</option>
                  {groupList.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            {/* 2. Student Second */}
            <GlassField
              label={t('attendance.selectStudent')}
              required
              error={formErrors.studentId}
            >
              <div className="relative">
                <FieldIcon icon={I.user} tone="purple" />
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={formErrors.studentId ? 'student-error' : undefined}
                  className="pl-11"
                >
                  <option value="">{t('attendance.studentPlaceholder')}</option>
                  {modalStudentList
                    .filter((s): s is Student => Boolean(s && s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.user?.firstName || (s as { name?: string }).name || "O'quvchi"}{' '}
                        {s.user?.lastName || ''}
                      </option>
                    ))}
                </GlassSelect>
              </div>
            </GlassField>

            <div className="sm:col-span-2">
              <GlassField
                label={t('attendance.selectDate')}
                required
                error={formErrors.date}
              >
                <div className="relative">
                  <FieldIcon icon={I.calendar} tone="blue" />
                  <GlassInput
                    type="date"
                    value={form.date}
                    onChange={handleFormChange('date')}
                    required
                    aria-invalid={Boolean(formErrors.date)}
                    aria-describedby={formErrors.date ? 'date-error' : undefined}
                    className="pl-11"
                  />
                </div>
              </GlassField>
            </div>
          </div>

          {/* Upgraded Segmented Status Selector */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              {t('common.status')} *
            </p>
            <StatusSegmented
              value={form.status}
              onChange={(s) => setForm((prev) => ({ ...prev, status: s }))}
              t={t}
            />
          </div>

          <GlassField label={t('attendance.note')}>
            <div className="relative">
              <FieldIcon icon={I.note} tone="gray" />
              <GlassInput
                value={form.note}
                onChange={handleFormChange('note')}
                placeholder={t('attendance.notePlaceholder')}
                className="pl-11"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, note: preset }))}
                  className="rounded-lg border border-black/[0.08] bg-white/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600 transition hover:border-blue-500/40 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
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
                    {t('attendance.recordSubmit')}
                  </>
                )}
              </span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          EDIT RECORD MODAL (With Quick Note Presets)
      ============================================================ */}
      <GlassModal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title={t('attendance.editTitle')}
        wide
      >
        <form className="space-y-5" onSubmit={handleEditSubmit} noValidate>
          {editTarget && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3.5">
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{
                  background: avatarGradient(fullStudentName(editTarget)),
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                }}
              >
                <span className="relative">{getInitials(fullStudentName(editTarget))}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {fullStudentName(editTarget)}
                </p>
                <p className="text-[11.5px] font-medium text-[#64748B] dark:text-slate-400">
                  {formatDate(editTarget.date)}
                  {editTarget.group?.name ? ` · ${editTarget.group.name}` : ''}
                </p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
              {t('common.status')}
            </p>
            <StatusSegmented value={editStatus} onChange={setEditStatus} t={t} />
          </div>

          <GlassField label={t('attendance.note')}>
            <div className="relative">
              <FieldIcon icon={I.note} tone="gray" />
              <GlassInput
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder={t('attendance.notePlaceholder')}
                className="pl-11"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEditNote(preset)}
                  className="rounded-lg border border-black/[0.08] bg-white/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600 transition hover:border-blue-500/40 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setEditTarget(null)}
              disabled={updateRecord.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={updateRecord.isPending}>
              <span className="inline-flex items-center gap-2">
                {updateRecord.isPending ? (
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
                    {t('common.save')}
                  </>
                )}
              </span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          VOID CONFIRMATION MODAL
      ============================================================ */}
      <GlassModal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title={t('attendance.voidTitle')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3.5 rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-500">
              <Icon paths={I.warning} size={18} strokeWidth={2.1} />
            </div>
            <p className="text-[12.5px] font-semibold leading-snug text-red-500">
              {t('attendance.voidConfirmBefore')}{' '}
              <strong className="text-[#1D1D1F] dark:text-[#F5F5F7]">
                {voidTarget
                  ? fullStudentName(voidTarget) !== '—'
                    ? fullStudentName(voidTarget)
                    : t('attendance.thisStudent')
                  : t('attendance.thisStudent')}
              </strong>{' '}
              {t('attendance.voidConfirmAfter', {
                date: voidTarget ? formatDate(voidTarget.date) : '',
              })}
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={() => setVoidTarget(null)}
              disabled={voidRecord.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton
              type="button"
              variant="danger"
              onClick={() => voidTarget && voidRecord.mutate(voidTarget.id)}
              disabled={voidRecord.isPending}
            >
              <span className="inline-flex items-center gap-2">
                {voidRecord.isPending ? (
                  <>
                    <motion.span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                    {t('attendance.voiding')}
                  </>
                ) : (
                  <>
                    <Icon paths={I.trash} size={14} strokeWidth={2.5} />
                    {t('attendance.voidRecord')}
                  </>
                )}
              </span>
            </GlassButton>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          FLOATING ACTION ISLAND (BULK OPERATIONS — LEDGER TAB ONLY)
      ============================================================ */}
      {activeTab === 'ledger' && (
        <FloatingActionIsland
          selectedCount={selectedCount}
          onClear={clearSelection}
          onClearSelection={clearSelection}
          entityName={t('attendance.title')}
          actions={[
            {
              label: isBatchUpdating ? t('common.saving') : t('attendance.bulkMarkPresent'),
              icon: <Icon paths={I.check} size={13} strokeWidth={2.5} />,
              onClick: () => void handleBatchMarkStatus('PRESENT'),
              variant: 'primary',
              shortcut: 'P',
              shortcutBadge: 'p',
            },
            {
              label: t('attendance.late'),
              icon: <Icon paths={I.clock} size={13} strokeWidth={2.3} />,
              onClick: () => void handleBatchMarkStatus('LATE'),
              variant: 'default',
            },
            {
              label: t('attendance.excused'),
              icon: <Icon paths={I.shield} size={13} strokeWidth={2.3} />,
              onClick: () => void handleBatchMarkStatus('EXCUSED'),
              variant: 'default',
            },
            {
              label: t('attendance.bulkExportCsv'),
              icon: <Icon paths={I.download} size={13} strokeWidth={2.3} />,
              onClick: handleExportSelectedAttendanceCSV,
              shortcut: 'C',
              shortcutBadge: 'c',
            },
          ]}
        />
      )}
    </motion.div>
  );
}

export default AttendancePage;