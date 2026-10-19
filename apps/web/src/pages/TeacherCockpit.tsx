/**
 * M-EDU TeacherCockpitPage — v20 "Time Stream · Editorial"
 *
 * 🎯 v19 → v20 Complete Rearchitecture:
 *  ✅ Vertical Time Stream — Time as hero. No split-pane, no horizontal scroll.
 *  ✅ Inline Expansion — Click a lesson, it expands in-place (layout animation).
 *  ✅ Token Grid Attendance — Avatars + tap-to-cycle status (K→Q→KCH→S→K).
 *  ✅ Radial Attendance Dial — SVG ring in expanded lesson.
 *  ✅ Editorial Display Times — 32px display numerals, tabular-nums.
 *  ✅ NOW Ribbon — Live indicator highlights the lesson happening right now.
 *  ✅ Scroll-to-Now FAB — Floating pill for long days.
 *  ✅ Day Summary Strip — Compact totals bar at top.
 *  ✅ Preserved — ALL queries, mutations, i18n, attendance draft logic intact.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/auth/AuthContext';
import { lessonsApi, attendanceApi, assignmentsApi } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { useToasts } from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 30, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },
  layout: { type: 'spring' as const, stiffness: 260, damping: 28, mass: 1.0 },
  pulse:  { type: 'spring' as const, stiffness: 400, damping: 26, mass: 0.6 },
} as const;

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

type AttendanceStatusType = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'slate' | 'amber' | 'rose';

interface AttendanceDraftItem {
  status: AttendanceStatusType;
  note?: string;
}

interface EnrolledStudent {
  id: string;
  studentId: string;
  student: {
    id: string;
    user?: { firstName: string; lastName: string; phone?: string | null };
  };
}

interface LessonDetail {
  id: string;
  groupId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'PLANNED' | 'CONDUCTED' | 'CANCELLED';
  room?: string | null;
  notes?: string | null;
  Group?: {
    id: string;
    name: string;
    room?: string | null;
    course?: { id: string; name?: string; title?: string } | null;
    enrollments?: EnrolledStudent[];
  };
  attendances?: Array<{
    id: string;
    studentId: string;
    status: AttendanceStatusType;
    note?: string | null;
  }>;
  Assignment?: Array<{
    id: string;
    title: string;
    dueDate: string;
    _count?: { AssignmentSubmission: number };
  }>;
}

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTE
 * ════════════════════════════════════════════════════════════════════════ */

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string; ring: string }> = {
  blue:   { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)',  glow: 'rgba(37,99,235,0.32)',  border: 'rgba(37,99,235,0.24)',  ring: 'rgba(37,99,235,0.45)'  },
  green:  { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.32)', border: 'rgba(16,185,129,0.24)', ring: 'rgba(16,185,129,0.45)' },
  orange: { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.32)', border: 'rgba(245,158,11,0.24)', ring: 'rgba(245,158,11,0.45)' },
  red:    { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.32)',  border: 'rgba(239,68,68,0.24)',  ring: 'rgba(239,68,68,0.45)'  },
  purple: { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.32)', border: 'rgba(99,102,241,0.24)', ring: 'rgba(99,102,241,0.45)' },
  cyan:   { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)',  glow: 'rgba(2,132,199,0.32)',  border: 'rgba(2,132,199,0.24)',  ring: 'rgba(2,132,199,0.45)'  },
  slate:  { fg: '#64748B', bg: 'rgba(100,116,139,0.10)',glow: 'rgba(100,116,139,0.24)',border: 'rgba(100,116,139,0.20)',ring: 'rgba(100,116,139,0.35)'},
  amber:  { fg: '#D97706', bg: 'rgba(217,119,6,0.10)',  glow: 'rgba(217,119,6,0.32)',  border: 'rgba(217,119,6,0.24)',  ring: 'rgba(217,119,6,0.45)'  },
  rose:   { fg: '#E11D48', bg: 'rgba(225,29,72,0.10)',  glow: 'rgba(225,29,72,0.32)',  border: 'rgba(225,29,72,0.24)',  ring: 'rgba(225,29,72,0.45)'  },
};

const ATTENDANCE_TONE: Record<AttendanceStatusType, Tone> = {
  PRESENT: 'green',
  ABSENT: 'rose',
  LATE: 'amber',
  EXCUSED: 'cyan',
};

const ATTENDANCE_KEY: Record<AttendanceStatusType, string> = {
  PRESENT: 'K',
  ABSENT: 'Q',
  LATE: 'KCH',
  EXCUSED: 'S',
};

const ATTENDANCE_ORDER: AttendanceStatusType[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];

function nextStatus(current: AttendanceStatusType): AttendanceStatusType {
  const idx = ATTENDANCE_ORDER.indexOf(current);
  return ATTENDANCE_ORDER[(idx + 1) % ATTENDANCE_ORDER.length];
}

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

const I = {
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronUp: ['M18 15l-6-6-6 6'],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  play: ['M6 4l14 8-14 8V4z'],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  phone: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
  ],
  door: ['M3 21h18', 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16', 'M14 12h.01'],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
  ],
  homework: [
    'M9 11l3 3L22 4',
    'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  ],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  flame: ['M12 2s4 5 4 9a4 4 0 0 1-8 0c0-2 2-4 2-4s-1 3 0 4 3-1 3-3c0-3-1-6-1-6z', 'M12 22a6 6 0 0 0 6-6c0-3-2-5-2-5'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  sparkle: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
  ],
} as const;

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: readonly string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(iso: string, locale: string): { main: string; sub: string; isToday: boolean } {
  try {
    const d = new Date(iso);
    const today = getTodayIso();
    const isToday = iso === today;
    const loc = locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US';
    const weekday = d.toLocaleDateString(loc, { weekday: 'long' });
    const date = d.toLocaleDateString(loc, { day: 'numeric', month: 'long' });
    return { main: date, sub: weekday, isToday };
  } catch {
    return { main: iso, sub: '', isToday: false };
  }
}

function getInitials(firstName?: string, lastName?: string): string {
  const a = firstName?.trim().charAt(0) || '';
  const b = lastName?.trim().charAt(0) || '';
  return (a + b).toUpperCase() || 'O';
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const AVATAR_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#1E3A8A', '#2563EB', '#93C5FD'],
  ['#312E81', '#4F46E5', '#A5B4FC'],
  ['#064E3B', '#059669', '#6EE7B7'],
  ['#78350F', '#D97706', '#FCD34D'],
  ['#134E4A', '#0D9488', '#5EEAD4'],
  ['#4C1D95', '#7C3AED', '#C4B5FD'],
  ['#831843', '#DB2777', '#F9A8D4'],
];

function avatarBg(name: string): string {
  const [a, b, c] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `radial-gradient(circle at 28% 22%, ${c}55 0%, transparent 55%), linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/* ══════════════════════════════════════════════════════════════════════════
 * HOOKS
 * ════════════════════════════════════════════════════════════════════════ */

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

function useNowTicker(intervalMs = 60_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA BACKDROP
 * ════════════════════════════════════════════════════════════════════════ */

function AuroraBackdrop() {
  const reduced = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-[#04060C] dark:via-[#0A0F1A] dark:to-[#080A14]" />
      <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-blue-400/10 blur-[140px] dark:bg-sky-500/10" />
      <div className="absolute -right-32 top-1/3 h-[520px] w-[520px] rounded-full bg-violet-400/10 blur-[140px] dark:bg-violet-500/10" />
      <div className="absolute -bottom-32 left-1/3 h-[460px] w-[460px] rounded-full bg-emerald-400/08 blur-[140px] dark:bg-emerald-500/08" />
      {!reduced && (
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-1/2 top-1/2 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.03] via-violet-500/[0.02] to-emerald-500/[0.03] blur-[160px]"
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * RADIAL DIAL — attendance percentage
 * ════════════════════════════════════════════════════════════════════════ */

function RadialDial({ percent, present, total, size = 88 }: {
  percent: number; present: number; total: number; size?: number;
}) {
  const stroke = 8;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * circ;
  const tone: Tone = percent >= 85 ? 'green' : percent >= 60 ? 'amber' : 'rose';
  const c = TONES[tone];

  return (
    <div className="relative shrink-0 select-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
          className="stroke-slate-200/70 dark:stroke-white/[0.06]"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={c.fg} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[18px] font-black leading-none tabular-nums" style={{ color: c.fg }}>
          {percent}
          <span className="text-[10px] opacity-70">%</span>
        </span>
        <span className="mt-0.5 text-[8.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] tabular-nums">
          {present}/{total}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * STUDENT TOKEN — avatar + status ring, tap to cycle
 * ════════════════════════════════════════════════════════════════════════ */

function StudentToken({
  firstName, lastName, phone, status, onCycle,
}: {
  firstName: string; lastName: string; phone?: string | null;
  status: AttendanceStatusType; onCycle: () => void;
}) {
  const c = TONES[ATTENDANCE_TONE[status]];
  const reduced = useReducedMotion();
  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <motion.button
      type="button"
      onClick={onCycle}
      whileTap={reduced ? undefined : { scale: 0.94 }}
      transition={SPRING.pulse}
      aria-label={`${fullName} — ${status}. Bosish orqali o'zgartiring.`}
      title={`${fullName} · ${status}`}
      className="group relative flex flex-col items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/70 p-2 outline-none transition-all hover:bg-white hover:shadow-sm focus-visible:ring-2 focus-visible:ring-[#007AFF] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
    >
      <div className="relative">
        <div
          className="flex items-center justify-center rounded-[14px] font-bold text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.35)]"
          style={{
            width: 44, height: 44,
            background: avatarBg(fullName),
            fontSize: 14,
            letterSpacing: '0.02em',
            boxShadow: `0 0 0 2.5px ${c.ring}, 0 2px 8px -2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        >
          {getInitials(firstName, lastName)}
        </div>
        <motion.span
          key={status}
          initial={reduced ? false : { scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING.pulse}
          className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[8px] font-black text-white ring-2 ring-white dark:ring-surface-900 tabular-nums"
          style={{ background: c.fg, boxShadow: `0 0 6px ${c.glow}` }}
        >
          {ATTENDANCE_KEY[status]}
        </motion.span>
      </div>
      <span className="mt-0.5 line-clamp-1 max-w-[72px] text-center text-[9.5px] font-bold text-[var(--text-primary)]">
        {firstName}
      </span>
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Qo'ng'iroq: ${phone}`}
          className="text-[9px] text-[#2563EB] hover:underline dark:text-[#38BDF8] tabular-nums"
        >
          {phone.slice(-4)}
        </a>
      )}
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SKELETON
 * ════════════════════════════════════════════════════════════════════════ */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * LESSON STREAM ITEM — collapsed + expanded
 * ════════════════════════════════════════════════════════════════════════ */

function LessonStreamItem({
  lesson, isExpanded, isNow, isPast, detail, isDetailLoading,
  attendanceDraft, onToggle, onCycle, onMarkAllPresent, onSidecar,
  onStartLesson, onSaveAttendance, onCompleteLesson,
  startPending, savePending, completePending,
  lessonNotes, onNotesChange,
  homeworkTitle, onHomeworkTitleChange,
  homeworkDescription, onHomeworkDescriptionChange,
  homeworkDueDate, onHomeworkDueDateChange,
  showHomeworkForm, onToggleHomeworkForm, onSaveHomework,
  homeworkPending,
}: {
  lesson: LessonDetail;
  isExpanded: boolean;
  isNow: boolean;
  isPast: boolean;
  detail: LessonDetail | null | undefined;
  isDetailLoading: boolean;
  attendanceDraft: Record<string, AttendanceDraftItem>;
  onToggle: () => void;
  onCycle: (studentId: string) => void;
  onMarkAllPresent: () => void;
  onSidecar: (l: LessonDetail) => void;
  onStartLesson: () => void;
  onSaveAttendance: () => void;
  onCompleteLesson: () => void;
  startPending: boolean;
  savePending: boolean;
  completePending: boolean;
  lessonNotes: string;
  onNotesChange: (v: string) => void;
  homeworkTitle: string;
  onHomeworkTitleChange: (v: string) => void;
  homeworkDescription: string;
  onHomeworkDescriptionChange: (v: string) => void;
  homeworkDueDate: string;
  onHomeworkDueDateChange: (v: string) => void;
  showHomeworkForm: boolean;
  onToggleHomeworkForm: () => void;
  onSaveHomework: () => void;
  homeworkPending: boolean;
}) {
  const reduced = useReducedMotion();
  const statusTone: Tone =
    lesson.status === 'CONDUCTED' ? 'green' :
    lesson.status === 'CANCELLED' ? 'rose' : 'amber';
  const c = TONES[statusTone];

  const enrollments = detail?.Group?.enrollments || [];
  const totalStudents = enrollments.length;
  const values = Object.values(attendanceDraft);
  const presentCount = values.filter((v) => v.status === 'PRESENT').length;
  const absentCount = values.filter((v) => v.status === 'ABSENT').length;
  const lateCount = values.filter((v) => v.status === 'LATE').length;
  const excusedCount = values.filter((v) => v.status === 'EXCUSED').length;
  const attendancePercent = totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0;

  return (
    <motion.div layout transition={SPRING.layout} className="relative">
      {/* Time column */}
      <div className="absolute -left-[88px] top-1 w-[72px] text-right select-none">
        <div
          className={[
            'text-[24px] font-black leading-none tabular-nums tracking-[-0.03em] transition-colors',
            isNow
              ? 'text-[#007AFF] dark:text-[#38BDF8]'
              : isPast
                ? 'text-[var(--text-muted)] opacity-60'
                : 'text-[var(--text-primary)]',
          ].join(' ')}
          style={{ fontFeatureSettings: '"tnum"' }}
        >
          {lesson.startTime || '—'}
        </div>
        <div className="mt-1 text-[10px] font-bold tabular-nums text-[var(--text-muted)] opacity-70">
          {lesson.endTime || '—'}
        </div>
        {isNow && (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#007AFF]/15 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#007AFF] dark:text-[#38BDF8]"
          >
            <span className="h-1 w-1 rounded-full bg-[#007AFF] dark:bg-[#38BDF8]" />
            NOW
          </motion.div>
        )}
      </div>

      {/* Timeline node */}
      <div className="absolute -left-[24px] top-3 z-10 flex items-center justify-center">
        <span
          className={[
            'relative flex h-4 w-4 items-center justify-center rounded-full ring-[3px] ring-white transition-all dark:ring-surface-900',
            isNow ? 'animate-pulse' : '',
          ].join(' ')}
          style={{
            background: c.fg,
            boxShadow: isNow ? `0 0 12px ${c.fg}, 0 0 0 3px ${c.ring}` : `0 0 6px ${c.glow}`,
          }}
        >
          {lesson.status === 'CONDUCTED' && (
            <Icon paths={I.check} size={8} strokeWidth={3.5} className="text-white" />
          )}
        </span>
      </div>

      {/* Card */}
      <motion.div
        layout
        className={[
          'liquid-glass-surface relative overflow-hidden rounded-2xl transition-all',
          isExpanded
            ? 'border-[#2563EB]/30 shadow-[0_8px_32px_-12px_rgba(37,99,235,0.25)] dark:border-[#38BDF8]/30'
            : '',
        ].join(' ')}
      >
        {/* Collapsed header (clickable) */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="group flex w-full items-start gap-3 p-4 text-left outline-none"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]"
                style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: c.fg }} />
                {lesson.status === 'CONDUCTED' ? "O'tildi" : lesson.status === 'CANCELLED' ? 'Bekor' : 'Reja'}
              </span>
              {lesson.room && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)]">
                  <Icon paths={I.door} size={9} strokeWidth={2.2} />
                  {lesson.room}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 line-clamp-1 text-[14.5px] font-black tracking-tight text-[var(--text-primary)] group-hover:text-[#2563EB] dark:group-hover:text-[#38BDF8]">
              {lesson.Group?.name || 'Guruh'}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-[var(--text-muted)]">
              {lesson.Group?.course?.name || lesson.Group?.course?.title || 'Kurs'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isExpanded && detail && totalStudents > 0 && (
              <div className="hidden items-center gap-1.5 sm:flex">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[9.5px] font-black text-emerald-700 tabular-nums dark:text-emerald-300">
                  <Icon paths={I.checkCircle} size={9} strokeWidth={2.6} />
                  {presentCount}
                </span>
                {absentCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/12 px-1.5 py-0.5 text-[9.5px] font-black text-rose-700 tabular-nums dark:text-rose-300">
                    <Icon paths={I.xCircle} size={9} strokeWidth={2.6} />
                    {absentCount}
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSidecar(lesson); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-slate-100/80 hover:text-[#007AFF] dark:hover:bg-white/[0.08]"
              title="Split-View Sidecar (Enter / Space)"
            >
              <span className="text-[12px] leading-none">◨</span>
            </button>
            <motion.span
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={SPRING.snappy}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors group-hover:bg-slate-100/80 group-hover:text-[var(--text-primary)] dark:group-hover:bg-white/[0.08]"
            >
              <Icon paths={I.chevronDown} size={14} strokeWidth={2.4} />
            </motion.span>
          </div>
        </button>

        {/* Expanded content */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
              transition={SPRING.layout}
              className="overflow-hidden"
            >
              <div className="border-t border-slate-200/70 dark:border-white/[0.06]">
                {isDetailLoading || !detail ? (
                  <div className="space-y-2 p-4">
                    <Shimmer className="h-14 w-full" radius="0.75rem" />
                    <Shimmer className="h-14 w-full" radius="0.75rem" />
                    <Shimmer className="h-14 w-full" radius="0.75rem" />
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {/* Action bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      {detail.status === 'PLANNED' && (
                        <motion.button
                          type="button"
                          disabled={startPending}
                          onClick={onStartLesson}
                          whileTap={reduced ? undefined : { scale: 0.97 }}
                          transition={SPRING.snappy}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#007AFF] px-3 py-2 text-[11px] font-black text-white shadow-[0_4px_14px_-4px_rgba(0,122,255,0.5)] transition-colors hover:bg-[#0071E3] disabled:opacity-50"
                        >
                          <Icon paths={I.play} size={11} strokeWidth={2.6} />
                          {startPending ? 'Boshlanmoqda' : 'Darsni boshlash'}
                        </motion.button>
                      )}
                      <motion.button
                        type="button"
                        disabled={savePending || completePending}
                        onClick={onSaveAttendance}
                        whileTap={reduced ? undefined : { scale: 0.97 }}
                        transition={SPRING.snappy}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 text-[11px] font-black text-[var(--text-primary)] transition-colors hover:bg-slate-100/80 disabled:opacity-50 dark:border-white/[0.10] dark:bg-white/[0.05] dark:hover:bg-white/[0.10]"
                      >
                        {savePending ? 'Saqlanmoqda' : 'Davomatni saqlash'}
                      </motion.button>
                      <motion.button
                        type="button"
                        disabled={completePending}
                        onClick={onCompleteLesson}
                        whileTap={reduced ? undefined : { scale: 0.97 }}
                        transition={SPRING.snappy}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white shadow-[0_4px_14px_-4px_rgba(16,185,129,0.5)] transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Icon paths={I.checkCircle} size={11} strokeWidth={2.6} />
                        {completePending ? 'Yakunlanmoqda' : 'Yakunlash'}
                      </motion.button>
                    </div>

                    {/* Stats row: dial + counts */}
                    {totalStudents > 0 && (
                      <div className="flex items-center gap-4 rounded-xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                        <RadialDial
                          percent={attendancePercent}
                          present={presentCount}
                          total={totalStudents}
                          size={76}
                        />
                        <div className="flex flex-1 flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/12 px-2 py-1 text-[10px] font-black text-emerald-700 tabular-nums dark:text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Keldi: {presentCount}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/12 px-2 py-1 text-[10px] font-black text-rose-700 tabular-nums dark:text-rose-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Qoldi: {absentCount}
                          </span>
                          {lateCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/12 px-2 py-1 text-[10px] font-black text-amber-700 tabular-nums dark:text-amber-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Kech: {lateCount}
                            </span>
                          )}
                          {excusedCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/12 px-2 py-1 text-[10px] font-black text-cyan-700 tabular-nums dark:text-cyan-300">
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                              Sababli: {excusedCount}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Student token grid */}
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-baseline gap-1.5">
                          <h4 className="text-[12px] font-black uppercase tracking-[0.1em] text-[var(--text-primary)]">
                            O'quvchilar
                          </h4>
                          <span className="rounded-full bg-[#2563EB]/12 px-1.5 py-0.5 text-[9.5px] font-black text-[#2563EB] tabular-nums dark:text-[#38BDF8]">
                            {totalStudents}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={onMarkAllPresent}
                          className="text-[10px] font-black uppercase tracking-wider text-emerald-600 transition-colors hover:text-emerald-700 dark:text-emerald-400"
                        >
                          ✓ Hammasi keldi
                        </button>
                      </div>

                      {/* Status legend */}
                      <p className="mb-2 text-[9.5px] font-medium text-[var(--text-muted)]">
                        Teginish → <span className="font-black" style={{ color: TONES.green.fg }}>Keldi</span>
                        {' → '}<span className="font-black" style={{ color: TONES.rose.fg }}>Qoldi</span>
                        {' → '}<span className="font-black" style={{ color: TONES.amber.fg }}>Kechikdi</span>
                        {' → '}<span className="font-black" style={{ color: TONES.cyan.fg }}>Sababli</span>
                        {' → Keldi'}
                      </p>

                      {totalStudents === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300/80 py-6 text-center dark:border-white/[0.10]">
                          <p className="text-[11px] font-medium text-[var(--text-muted)]">
                            Guruhda faol o'quvchilar topilmadi
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-1.5">
                          {enrollments.map((enr) => {
                            const sid = enr.student?.id || enr.studentId;
                            const fn = enr.student?.user?.firstName || 'O\'quvchi';
                            const ln = enr.student?.user?.lastName || '';
                            const phone = enr.student?.user?.phone;
                            const draft = attendanceDraft[sid] || { status: 'PRESENT' as const };
                            return (
                              <StudentToken
                                key={sid}
                                firstName={fn}
                                lastName={ln}
                                phone={phone}
                                status={draft.status}
                                onCycle={() => onCycle(sid)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                        <Icon paths={I.note} size={10} strokeWidth={2.4} />
                        Dars mavzusi va izohlar
                      </label>
                      <textarea
                        rows={2}
                        value={lessonNotes}
                        onChange={(e) => onNotesChange(e.target.value)}
                        placeholder="Bugun o'tilgan mavzular, izohlar..."
                        className="w-full resize-none rounded-xl border border-slate-200/80 bg-white/70 p-2.5 text-[12px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] placeholder:opacity-60 outline-none transition-all focus:border-[#2563EB]/40 focus:bg-white focus:ring-2 focus:ring-[#2563EB]/15 dark:border-white/[0.08] dark:bg-white/[0.04] dark:focus:bg-white/[0.06]"
                      />
                    </div>

                    {/* Homework */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                          <Icon paths={I.homework} size={10} strokeWidth={2.4} />
                          Uy vazifasi
                        </label>
                        <button
                          type="button"
                          onClick={onToggleHomeworkForm}
                          className="text-[10px] font-black uppercase tracking-wider text-[#2563EB] transition-colors hover:text-[#0071E3] dark:text-[#38BDF8]"
                        >
                          {showHomeworkForm ? 'Yopish' : '+ Yangi'}
                        </button>
                      </div>

                      {detail.Assignment && detail.Assignment.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {detail.Assignment.map((asg) => (
                            <div
                              key={asg.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/70 bg-white/60 px-2.5 py-1.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-bold text-[var(--text-primary)]">
                                  {asg.title}
                                </p>
                                <p className="text-[9px] font-medium text-[var(--text-muted)] tabular-nums">
                                  Muddat: {asg.dueDate ? asg.dueDate.split('T')[0] : '—'}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-[#2563EB]/12 px-1.5 py-0.5 text-[8.5px] font-black text-[#2563EB] tabular-nums dark:text-[#38BDF8]">
                                {asg._count?.AssignmentSubmission || 0}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <AnimatePresence initial={false}>
                        {showHomeworkForm && (
                          <motion.div
                            initial={reduced ? false : { height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={reduced ? undefined : { height: 0, opacity: 0 }}
                            transition={SPRING.smooth}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 rounded-xl border border-slate-200/70 bg-white/60 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
                              <input
                                type="text"
                                value={homeworkTitle}
                                onChange={(e) => onHomeworkTitleChange(e.target.value)}
                                placeholder="Masalan: 12-18 mashqlar, 4-mavzu"
                                className="w-full rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] font-medium outline-none focus:border-[#2563EB]/40 focus:ring-2 focus:ring-[#2563EB]/15 dark:border-white/[0.08] dark:bg-surface-900/80 dark:text-white"
                              />
                              <textarea
                                rows={2}
                                value={homeworkDescription}
                                onChange={(e) => onHomeworkDescriptionChange(e.target.value)}
                                placeholder="O'quvchilar uchun ko'rsatmalar..."
                                className="w-full resize-none rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] font-medium outline-none focus:border-[#2563EB]/40 focus:ring-2 focus:ring-[#2563EB]/15 dark:border-white/[0.08] dark:bg-surface-900/80 dark:text-white"
                              />
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                  Muddat
                                </label>
                                <input
                                  type="date"
                                  value={homeworkDueDate}
                                  onChange={(e) => onHomeworkDueDateChange(e.target.value)}
                                  className="rounded-lg border border-black/[0.06] bg-white/80 px-2 py-1 text-[11px] outline-none dark:border-white/[0.08] dark:bg-surface-900/80 dark:text-white"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={!homeworkTitle.trim() || homeworkPending}
                                onClick={onSaveHomework}
                                className="w-full rounded-lg bg-[#007AFF] py-1.5 text-[11px] font-black text-white transition-colors hover:bg-[#0071E3] disabled:opacity-50"
                              >
                                {homeworkPending ? 'Saqlanmoqda...' : 'Uy vazifasini biriktirish'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function TeacherCockpitPage() {
  const { t, locale } = useI18n();
  usePageTitle(t('teacherCockpit.title', "O'qituvchi boshqaruvi"));
  const { user } = useAuth();
  const { push, toastNode } = useToasts();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();
  useNowTicker(60_000); // refresh every minute

  const [selectedDate, setSelectedDate] = useState<string>(getTodayIso);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceDraftItem>>({});
  const [lessonNotes, setLessonNotes] = useState<string>('');
  const [showHomeworkForm, setShowHomeworkForm] = useState<boolean>(false);
  const [homeworkTitle, setHomeworkTitle] = useState<string>('');
  const [homeworkDescription, setHomeworkDescription] = useState<string>('');
  const [homeworkDueDate, setHomeworkDueDate] = useState<string>(() => shiftIsoDate(getTodayIso(), 2));

  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    hasAutoSelectedRef.current = false;
  }, [selectedDate]);

  /* ═══ Queries ═══ */
  const lessonsQuery = useQuery({
    queryKey: ['teacher-cockpit-lessons', user?.id, selectedDate],
    queryFn: async () => {
      const res = await lessonsApi.list({ teacherId: user?.id, date: selectedDate, limit: 50 });
      return Array.isArray(res) ? res : res?.items || [];
    },
    enabled: Boolean(user?.id),
  });

  const lessons: LessonDetail[] = useMemo(() => lessonsQuery.data || [], [lessonsQuery.data]);

  /* Sort by start time */
  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [lessons],
  );

  /* Auto-select on first load per date */
  useEffect(() => {
    if (hasAutoSelectedRef.current) return;
    if (sortedLessons.length === 0) return;
    hasAutoSelectedRef.current = true;
    const now = nowMinutes();
    const ongoing = sortedLessons.find((l) => {
      const s = timeToMinutes(l.startTime);
      const e = timeToMinutes(l.endTime);
      return s <= now && now <= e;
    });
    const next = sortedLessons.find((l) => timeToMinutes(l.startTime) > now);
    const pick = ongoing || next || sortedLessons[0];
    if (pick) setActiveLessonId(pick.id);
  }, [sortedLessons]);

  const activeLessonQuery = useQuery({
    queryKey: ['teacher-cockpit-lesson-detail', activeLessonId],
    queryFn: async () => {
      if (!activeLessonId) return null;
      return (await lessonsApi.get(activeLessonId)) as LessonDetail;
    },
    enabled: Boolean(activeLessonId),
  });

  const activeDetail = activeLessonQuery.data;

  /* Sync draft on active change */
  useEffect(() => {
    if (!activeDetail) return;
    setLessonNotes(activeDetail.notes || '');
    const enrollments = activeDetail.Group?.enrollments || [];
    const recordedMap = new Map<string, { status: AttendanceStatusType; note?: string | null }>();
    for (const att of activeDetail.attendances || []) {
      recordedMap.set(att.studentId, { status: att.status, note: att.note });
    }
    const nextDraft: Record<string, AttendanceDraftItem> = {};
    for (const enr of enrollments) {
      const sid = enr.student?.id || enr.studentId;
      if (!sid) continue;
      const rec = recordedMap.get(sid);
      nextDraft[sid] = { status: rec ? rec.status : 'PRESENT', note: rec?.note || '' };
    }
    setAttendanceDraft(nextDraft);
  }, [activeDetail]);

  /* ═══ Mutations ═══ */
  const startLessonMutation = useMutation({
    mutationFn: async () => {
      if (!activeLessonId) return;
      return lessonsApi.updateStatus(activeLessonId, 'CONDUCTED');
    },
    onSuccess: () => {
      push({
        type: 'success',
        title: t('teacherCockpit.startLesson', 'Darsni boshlash'),
        message: "Dars rasman boshlandi va 'O'tildi' holatiga o'tkazildi.",
      });
      queryClient.invalidateQueries({ queryKey: ['teacher-cockpit-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-cockpit-lesson-detail', activeLessonId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
    onError: (err: any) => {
      push({ type: 'error', title: 'Xatolik', message: err?.message || "Dars holatini o'zgartirib bo'lmadi" });
    },
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: async () => {
      if (!activeDetail || !activeLessonId) return;
      const records = Object.entries(attendanceDraft).map(([studentId, item]) => ({
        studentId,
        status: item.status,
        note: item.note?.trim() || undefined,
      }));
      const dateStr = activeDetail.date ? activeDetail.date.split('T')[0] : selectedDate;
      return attendanceApi.create({
        groupId: activeDetail.groupId,
        lessonId: activeDetail.id,
        date: dateStr,
        records,
      });
    },
    onSuccess: () => {
      push({
        type: 'success',
        title: t('teacherCockpit.saveAttendance', 'Davomatni saqlash'),
        message: t('teacherCockpit.attendanceSaved', 'Davomat muvaffaqiyatli saqlandi'),
      });
      queryClient.invalidateQueries({ queryKey: ['teacher-cockpit-lesson-detail', activeLessonId] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
    onError: (err: any) => {
      push({ type: 'error', title: 'Xatolik', message: err?.message || 'Davomatni saqlashda xatolik' });
    },
  });

  const createHomeworkMutation = useMutation({
    mutationFn: async () => {
      if (!activeDetail || !homeworkTitle.trim()) return;
      return assignmentsApi.create({
        groupId: activeDetail.groupId,
        lessonId: activeDetail.id,
        title: homeworkTitle.trim(),
        description: homeworkDescription.trim() || undefined,
        dueDate: new Date(homeworkDueDate).toISOString(),
      });
    },
    onSuccess: () => {
      push({
        type: 'success',
        title: t('teacherCockpit.saveHomework', 'Uy vazifasini biriktirish'),
        message: 'Uy vazifasi guruhga biriktirildi.',
      });
      setHomeworkTitle('');
      setHomeworkDescription('');
      setShowHomeworkForm(false);
      queryClient.invalidateQueries({ queryKey: ['teacher-cockpit-lesson-detail', activeLessonId] });
    },
    onError: (err: any) => {
      push({ type: 'error', title: 'Xatolik', message: err?.message || 'Uy vazifasini biriktirib bo\'lmadi' });
    },
  });

  const completeLessonMutation = useMutation({
    mutationFn: async () => {
      if (!activeDetail || !activeLessonId) return;
      const records = Object.entries(attendanceDraft).map(([studentId, item]) => ({
        studentId,
        status: item.status,
        note: item.note?.trim() || undefined,
      }));
      const dateStr = activeDetail.date ? activeDetail.date.split('T')[0] : selectedDate;
      await attendanceApi.create({
        groupId: activeDetail.groupId,
        lessonId: activeDetail.id,
        date: dateStr,
        records,
      });
      if (lessonNotes.trim() !== (activeDetail.notes || '').trim()) {
        await lessonsApi.updateContent(activeDetail.id, {
          notes: lessonNotes.trim(),
          room: activeDetail.room || undefined,
        });
      }
      if (activeDetail.status !== 'CONDUCTED') {
        await lessonsApi.updateStatus(activeDetail.id, 'CONDUCTED');
      }
    },
    onSuccess: () => {
      push({
        type: 'success',
        title: t('teacherCockpit.lessonCompleted', 'Darsni yakunlash'),
        message: 'Dars to\'liq yakunlandi va tizimda qayd etildi!',
      });
      queryClient.invalidateQueries({ queryKey: ['teacher-cockpit-lessons'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-cockpit-lesson-detail', activeLessonId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] });
    },
    onError: (err: any) => {
      push({ type: 'error', title: 'Xatolik', message: err?.message || 'Darsni yakunlashda xatolik' });
    },
  });

  /* ═══ Handlers ═══ */
  const handleMarkAllPresent = useCallback(() => {
    setAttendanceDraft((prev) => {
      const updated: Record<string, AttendanceDraftItem> = {};
      for (const [id, val] of Object.entries(prev)) updated[id] = { ...val, status: 'PRESENT' };
      return updated;
    });
  }, []);

  const handleCycleStatus = useCallback((studentId: string) => {
    setAttendanceDraft((prev) => {
      const cur = prev[studentId]?.status || 'PRESENT';
      return {
        ...prev,
        [studentId]: { ...(prev[studentId] || { note: '' }), status: nextStatus(cur) },
      };
    });
  }, []);

  const handleToggleLesson = useCallback(
    (id: string) => {
      setActiveLessonId((prev) => (prev === id ? null : id));
    },
    [],
  );

  const { playTick } = usePremiumSound();

  const handleOpenLessonSidecar = useCallback((l: LessonDetail) => {
    const groupName = l.Group?.name || 'Dars guruhi';
    const courseName = l.Group?.course?.name || l.Group?.course?.title || 'Umumiy kurs';
    const dateStr = l.date ? l.date.split('T')[0] : selectedDate;
    const statusLabel = l.status === 'CONDUCTED' ? "O'tildi" : l.status === 'CANCELLED' ? 'Bekor qilingan' : 'Rejalashtirilgan';
    const tone = l.status === 'CONDUCTED' ? 'emerald' : l.status === 'CANCELLED' ? 'rose' : 'amber';
    const sidecarData: QuickLookData = {
      id: l.id,
      type: 'group',
      title: groupName,
      subtitle: `${courseName} · ${l.startTime} → ${l.endTime}`,
      badge: {
        text: statusLabel,
        tone,
      },
      avatar: {
        text: groupName.slice(0, 2).toUpperCase(),
        color: '#007AFF',
      },
      metrics: [
        { label: 'Boshlanish', value: l.startTime || '—' },
        { label: 'Tugash', value: l.endTime || '—' },
        { label: 'Xona', value: l.room || 'Belgilanmagan' },
        { label: 'Holat', value: statusLabel },
      ],
      details: [
        { label: 'Dars ID', value: l.id, copyable: true },
        { label: 'Sana', value: dateStr },
        { label: 'Guruh', value: groupName },
        { label: 'Kurs', value: courseName },
        { label: 'Izohlar', value: l.notes || 'Mavjud emas' },
      ],
      primaryAction: {
        label: 'Darsni kengaytirish',
        onExecute: () => {
          setActiveLessonId(l.id);
        },
      },
    };
    openSidecar(sidecarData);
  }, [selectedDate]);

  useListKeyboardNavigation<LessonDetail>({
    items: sortedLessons,
    getItemId: (l) => l.id,
    rowIdPrefix: 'lesson-',
    onSelect: (l) => { playTick(); handleOpenLessonSidecar(l); },
    onQuickLook: (l) => { playTick(); handleOpenLessonSidecar(l); },
  });

  /* ═══ Day summary ═══ */
  const daySummary = useMemo(() => {
    const totalLessons = sortedLessons.length;
    const conducted = sortedLessons.filter((l) => l.status === 'CONDUCTED').length;
    const planned = sortedLessons.filter((l) => l.status === 'PLANNED').length;
    return { totalLessons, conducted, planned };
  }, [sortedLessons]);

  const dateInfo = formatDisplayDate(selectedDate, locale);

  /* Scroll to now helper */
  const scrollToNow = useCallback(() => {
    const now = nowMinutes();
    const ongoing = sortedLessons.find((l) => {
      const s = timeToMinutes(l.startTime);
      const e = timeToMinutes(l.endTime);
      return s <= now && now <= e;
    });
    const next = sortedLessons.find((l) => timeToMinutes(l.startTime) > now);
    const target = ongoing || next || sortedLessons[0];
    if (target) {
      setActiveLessonId(target.id);
      requestAnimationFrame(() => {
        document.getElementById(`lesson-${target.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }, [sortedLessons]);

  const showScrollFab = sortedLessons.length > 3;

  /* ═══ Render ═══ */
  return (
    <div className="relative min-h-screen pb-24">
      <AuroraBackdrop />
      {toastNode}

      <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6 sm:pt-6">
        {/* ═══ HEADER — date as hero ═══ */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.smooth}
          className="mb-6 flex items-start justify-between gap-3"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
              <span>M-EDU</span>
              <span className="opacity-40">·</span>
              <span className="text-[#2563EB] dark:text-[#38BDF8]">O'qituvchi</span>
            </div>
            <h1 className="mt-1.5 text-[32px] font-black leading-[1] tracking-[-0.03em] text-[var(--text-primary)] sm:text-[40px]">
              {dateInfo.main}
            </h1>
            <p className="mt-1 text-[12px] font-semibold text-[var(--text-muted)]">
              {dateInfo.sub}
              {dateInfo.isToday && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Bugun
                </span>
              )}
              {user?.firstName && (
                <>
                  <span className="mx-1.5 opacity-40">·</span>
                  <span>{user.firstName} {user.lastName || ''}</span>
                </>
              )}
            </p>
          </div>

          {/* Date stepper */}
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-black/[0.06] bg-white/80 p-0.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 8px -4px rgba(15,23,42,0.06)' }}
          >
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftIsoDate(d, -1))}
              aria-label="Oldingi kun"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-slate-100/80 hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]"
            >
              <Icon paths={I.chevronLeft} size={14} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getTodayIso())}
              className="px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-[var(--text-primary)]"
            >
              Bugun
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftIsoDate(d, 1))}
              aria-label="Keyingi kun"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-slate-100/80 hover:text-[var(--text-primary)] dark:hover:bg-white/[0.08]"
            >
              <Icon paths={I.chevronRight} size={14} strokeWidth={2.6} />
            </button>
          </div>
        </motion.header>

        {/* ═══ DAY SUMMARY STRIP ═══ */}
        {sortedLessons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="mb-6 grid grid-cols-3 gap-2"
          >
            <div className="rounded-xl border border-black/[0.06] bg-white/80 p-2.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
              <div className="text-[20px] font-black leading-none tabular-nums text-[var(--text-primary)]">
                {daySummary.totalLessons}
              </div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">
                Darslar
              </div>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-2.5 backdrop-blur-xl">
              <div className="text-[20px] font-black leading-none tabular-nums text-emerald-700 dark:text-emerald-300">
                {daySummary.conducted}
              </div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-700/80 dark:text-emerald-300/80">
                O'tildi
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2.5 backdrop-blur-xl">
              <div className="text-[20px] font-black leading-none tabular-nums text-amber-700 dark:text-amber-300">
                {daySummary.planned}
              </div>
              <div className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-700/80 dark:text-amber-300/80">
                Rejalashtirilgan
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ TIMELINE STREAM ═══ */}
        {lessonsQuery.isLoading ? (
          <div className="relative pl-16">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Shimmer key={i} className="h-[100px] w-full" radius="1rem" />
              ))}
            </div>
          </div>
        ) : sortedLessons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300/80 bg-white/60 p-10 text-center backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.03]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-500/[0.08] text-[var(--text-muted)]">
              <Icon paths={I.calendar} size={24} strokeWidth={2} />
            </div>
            <p className="mt-3 text-[14px] font-bold text-[var(--text-primary)]">
              {t('teacherCockpit.noLessons', 'Bu kunga darslar rejalashtirilmagan')}
            </p>
            <p className="mt-1 text-[11.5px] font-medium text-[var(--text-muted)]">
              Boshqa kunni tanlang yoki yangi dars qo'shing
            </p>
          </div>
        ) : (
          <div className="relative pl-16">
            {/* Vertical rail */}
            <div
              aria-hidden="true"
              className="absolute left-[64px] top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-slate-300/70 to-transparent dark:via-white/[0.10]"
            />

            <div className="space-y-3">
              {sortedLessons.map((lesson) => {
                const s = timeToMinutes(lesson.startTime);
                const e = timeToMinutes(lesson.endTime);
                const n = nowMinutes();
                const isNow = s <= n && n <= e && selectedDate === getTodayIso();
                const isPast = e < n || (selectedDate < getTodayIso());
                const isExpanded = activeLessonId === lesson.id;
                return (
                  <div key={lesson.id} id={`lesson-${lesson.id}`}>
                    <LessonStreamItem
                      lesson={lesson}
                      onSidecar={handleOpenLessonSidecar}
                      isExpanded={isExpanded}
                      isNow={isNow}
                      isPast={isPast}
                      detail={isExpanded ? activeDetail : lesson}
                      isDetailLoading={isExpanded ? activeLessonQuery.isLoading : false}
                      attendanceDraft={attendanceDraft}
                      onToggle={() => handleToggleLesson(lesson.id)}
                      onCycle={handleCycleStatus}
                      onMarkAllPresent={handleMarkAllPresent}
                      onStartLesson={() => startLessonMutation.mutate()}
                      onSaveAttendance={() => saveAttendanceMutation.mutate()}
                      onCompleteLesson={() => completeLessonMutation.mutate()}
                      startPending={startLessonMutation.isPending}
                      savePending={saveAttendanceMutation.isPending}
                      completePending={completeLessonMutation.isPending}
                      lessonNotes={lessonNotes}
                      onNotesChange={setLessonNotes}
                      homeworkTitle={homeworkTitle}
                      onHomeworkTitleChange={setHomeworkTitle}
                      homeworkDescription={homeworkDescription}
                      onHomeworkDescriptionChange={setHomeworkDescription}
                      homeworkDueDate={homeworkDueDate}
                      onHomeworkDueDateChange={setHomeworkDueDate}
                      showHomeworkForm={showHomeworkForm}
                      onToggleHomeworkForm={() => setShowHomeworkForm((v) => !v)}
                      onSaveHomework={() => createHomeworkMutation.mutate()}
                      homeworkPending={createHomeworkMutation.isPending}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══ SCROLL-TO-NOW FAB ═══ */}
      {showScrollFab && (
        <motion.button
          type="button"
          onClick={scrollToNow}
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SPRING.smooth}
          whileHover={reduced ? undefined : { scale: 1.06 }}
          whileTap={reduced ? undefined : { scale: 0.94 }}
          aria-label="Hozirgi darsga o'tish"
          className="fixed bottom-6 right-4 z-40 flex items-center gap-2 rounded-full bg-[#007AFF] px-4 py-3 text-[11px] font-black uppercase tracking-wider text-white shadow-[0_12px_32px_-8px_rgba(0,122,255,0.6),0_1px_0_rgba(255,255,255,0.25)_inset] transition-colors hover:bg-[#0071E3] sm:bottom-8 sm:right-8"
        >
          <motion.span
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Icon paths={I.arrowDown} size={14} strokeWidth={2.6} />
          </motion.span>
          <span className="hidden sm:inline">Hozir</span>
        </motion.button>
      )}
    </div>
  );
}

export default TeacherCockpitPage;