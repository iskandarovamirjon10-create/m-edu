/**
 * M-EDU Assignments Page
 * Homework assignments, student submissions, grading status, and deadline management.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { assignmentsApi, groupsApi } from '@/lib/api';
import { useSafeI18n, type TranslateFn } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

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
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
  exit:   { opacity: 0, x: 20, transition: { duration: 0.22 } },
};

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  maxScore: number;
  status: string;
  group?: { id: string; name: string } | null;
  _count?: { submissions?: number };
}

interface Group {
  id: string;
  name: string;
}

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

/* ============================================================================
 * DUE DATE LOGIC
 * ========================================================================== */

interface DueInfo {
  tone: Tone;
  label: string;
  daysLeft: number;
  isOverdue: boolean;
  isDueToday: boolean;
  hoursLeft?: number;
}

function getDueInfo(dueDateStr: string, t: TranslateFn): DueInfo {
  const now = Date.now();
  const due = new Date(dueDateStr).getTime();
  const diff = due - now;
  const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor(diff / (1000 * 60 * 60));

  if (diff < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      tone: 'red',
      label: overdueDays === 0 ? t('assignments.due.overdueToday') : t('assignments.due.overdueDays', { days: overdueDays }),
      daysLeft,
      isOverdue: true,
      isDueToday: false,
    };
  }

  if (hoursLeft <= 12) {
    return {
      tone: 'red',
      label: hoursLeft <= 1 ? t('assignments.due.lessThanHour') : t('assignments.due.hoursLeft', { hours: hoursLeft }),
      daysLeft: 0,
      isOverdue: false,
      isDueToday: true,
      hoursLeft,
    };
  }

  if (daysLeft === 0) {
    return {
      tone: 'orange',
      label: t('assignments.due.today'),
      daysLeft: 0,
      isOverdue: false,
      isDueToday: true,
    };
  }

  if (daysLeft === 1) {
    return {
      tone: 'orange',
      label: t('assignments.due.tomorrow'),
      daysLeft: 1,
      isOverdue: false,
      isDueToday: false,
    };
  }

  if (daysLeft <= 3) {
    return {
      tone: 'purple',
      label: t('assignments.due.daysLeft', { days: daysLeft }),
      daysLeft,
      isOverdue: false,
      isDueToday: false,
    };
  }

  return {
    tone: 'blue',
    label: t('assignments.due.daysLeft', { days: daysLeft }),
    daysLeft,
    isOverdue: false,
    isDueToday: false,
  };
}

/* ============================================================================
 * CUSTOM ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  pencil: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  calendar: [
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M16 2v4', 'M8 2v4', 'M3 10h18',
  ],
  clock: [
    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
    'M12 6v6l4 2',
  ],
  award: [
    'M12 15l-2 5 4-2 4 2-2-5',
    'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  search: [
    'M21 21l-4.35-4.35',
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ],
  x: [
    'M18 6L6 18',
    'M6 6l12 12',
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

function codeHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const ASSIGNMENT_PALETTES: Tone[] = ['green', 'blue', 'purple', 'orange', 'red'];

function assignmentTone(title: string): Tone {
  return ASSIGNMENT_PALETTES[codeHash(title) % ASSIGNMENT_PALETTES.length];
}

/* ============================================================================
 * COUNT UP
 * ========================================================================== */

function CountUp({
  value, duration = 0.9, suffix = '',
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
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString()}{suffix}</span>;
}

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-neutral-200/50 dark:bg-white/5 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function AssignmentsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[74px]" radius="1.25rem" />)}
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-28" radius="1.25rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * STAT TILE (Liquid Glass Substrate)
 * ========================================================================== */

function StatTile({
  label, value, icon, tone = 'blue',
}: { label: string; value: number; icon: string[]; tone?: Tone }) {
  const c = TONE[tone];
  const { playTick } = usePremiumSound();

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2 }}
      onMouseEnter={playTick}
      transition={SPRING.smooth}
      className="liquid-glass-card group relative flex items-center gap-3.5 p-4"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <Icon paths={icon} size={20} strokeWidth={2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[24px] font-bold tracking-tight leading-none text-neutral-900 dark:text-white">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * ASSIGNMENT CARD (Liquid Glass & macOS Sidecar)
 * ========================================================================== */

function AssignmentCard({
  assignment,
  onOpenSidecar,
  isFocused = false,
  isSelected = false,
  onToggleSelect,
}: {
  assignment: Assignment;
  onOpenSidecar: (a: Assignment) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t, locale } = useSafeI18n();
  const { playTick, playPop } = usePremiumSound();
  const tone = assignmentTone(assignment.title);
  const c = TONE[tone];
  const due = getDueInfo(assignment.dueDate, t);
  const dc = TONE[due.tone];

  const submissionCount = assignment._count?.submissions || 0;
  const statusTone: Tone = assignment.status?.toUpperCase() === 'ACTIVE' ? 'green'
    : assignment.status?.toUpperCase() === 'DRAFT' ? 'orange'
    : assignment.status?.toUpperCase() === 'CLOSED' ? 'slate'
    : 'blue';
  const sc = TONE[statusTone];
  const statusKey = `assignments.status.${(assignment.status || '').toUpperCase()}`;
  const statusLabel = t(statusKey);
  const statusText = statusLabel === statusKey ? assignment.status : statusLabel;

  const groupStudents = (assignment as any).group?.studentCount || (assignment as any).group?._count?.students || 0;
  const progress = groupStudents > 0 ? Math.min(100, Math.round((submissionCount / groupStudents) * 100)) : (submissionCount > 0 ? 100 : 0);

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      onClick={() => {
        playPop();
        onOpenSidecar(assignment);
      }}
      className={`liquid-glass-card group relative flex flex-col gap-3.5 p-4 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-500/10'
          : isFocused
          ? 'ring-2 ring-blue-500/60'
          : ''
      }`}
    >
      {/* Left accent bar — tone by due urgency */}
      <span
        aria-hidden
        className="absolute left-0 top-3.5 bottom-3.5 w-[3.5px] rounded-r-full"
        style={{ background: dc.fg, boxShadow: `0 0 10px ${dc.glow}` }}
      />

      <div className="flex items-start gap-3.5 pl-1">
        {/* Row Selection checkbox */}
        {onToggleSelect && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              playTick();
              onToggleSelect();
            }}
            className="flex items-center pt-3 shrink-0"
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              className="h-4 w-4 rounded-md accent-blue-600 cursor-pointer"
              aria-label={`Select ${assignment.title}`}
            />
          </div>
        )}

        {/* Icon tile */}
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}DD 100%)`,
            boxShadow: `0 6px 18px -4px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.4)`,
          }}
        >
          <Icon paths={I.pencil} size={22} strokeWidth={2} className="relative z-10" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-[15px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {assignment.title}
              </h3>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{
                  background: sc.bg,
                  color: sc.fg,
                  border: `1px solid ${sc.border}`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: sc.fg, boxShadow: `0 0 6px ${sc.glow}` }}
                />
                {statusText}
              </span>
            </div>

            {/* Split-View Sidecar Trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                playPop();
                onOpenSidecar(assignment);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-xs font-bold text-neutral-600 transition-all hover:border-black/20 hover:bg-white hover:text-black hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
              title="macOS Split-View Sidecar (Enter / e)"
              aria-label="Split-View Sidecar"
            >
              ◨
            </button>
          </div>

          {/* Meta chips row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Due date chip */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{
                background: dc.bg,
                color: dc.fg,
                border: `1px solid ${dc.border}`,
                boxShadow: due.tone === 'red' || due.tone === 'orange' ? `0 0 10px -2px ${dc.glow}` : undefined,
              }}
            >
              <Icon
                paths={due.isOverdue || due.isDueToday ? I.alertTriangle : I.clock}
                size={10}
                strokeWidth={2.5}
              />
              {due.label}
            </span>

            {/* Group chip */}
            {assignment.group && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                style={{
                  background: 'rgba(0,122,255,0.08)',
                  color: '#007AFF',
                }}
              >
                <Icon paths={I.users} size={10} strokeWidth={2.5} />
                {assignment.group.name}
              </span>
            )}

            {/* Max score */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums"
              style={{
                background: 'rgba(255,149,0,0.08)',
                color: '#FF9500',
              }}
            >
              <Icon paths={I.award} size={10} strokeWidth={2.5} />
              {t('assignments.maxScore', { score: assignment.maxScore })}
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                <span className="inline-flex items-center gap-1">
                  <Icon paths={I.calendar} size={10} strokeWidth={2.5} />
                  {new Date(assignment.dueDate).toLocaleDateString(
                    locale === 'uz' ? 'uz-UZ' : locale === 'ru' ? 'ru-RU' : 'en-US',
                    { month: 'short', day: 'numeric', year: 'numeric' },
                  )}
                </span>
                <span className="tabular-nums">
                  <span className="font-bold text-neutral-900 dark:text-white">{submissionCount}</span> {t('assignments.submitted')}
                </span>
              </div>

              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200/60 dark:bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export default function AssignmentsPage() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedGroupId, setSelectedGroupId] = useState(searchParams.get('groupId') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE'>('ALL');

  const [title, setTitle] = useState('');
  const [groupId, setGroupId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [maxScore, setMaxScore] = useState(100);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<{
    title?: string; groupId?: string; dueDate?: string;
  }>({});

  useEffect(() => {
    const gid = searchParams.get('groupId') || '';
    if (gid !== selectedGroupId) {
      setSelectedGroupId(gid);
    }
  }, [searchParams, selectedGroupId]);

  const handleGroupFilterChange = useCallback((gid: string) => {
    playTick();
    setSelectedGroupId(gid);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (gid) next.set('groupId', gid);
      else next.delete('groupId');
      return next;
    }, { replace: true });
  }, [setSearchParams, playTick]);

  /* ---------------- Data ---------------- */
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => assignmentsApi.list(),
    placeholderData: (prev) => prev,
  });

  const { data: groupsData } = useQuery({
    queryKey: ['groups', 'selectors'],
    queryFn: () => groupsApi.list(),
    staleTime: 5 * 60 * 1000,
  });

  const assignments: Assignment[] = useMemo(
    () => (Array.isArray(data) ? data : (data as any)?.items ?? []),
    [data],
  );

  const groups: Group[] = useMemo(
    () => (Array.isArray(groupsData) ? groupsData : (groupsData as any)?.items ?? []),
    [groupsData],
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (selectedGroupId && a.group?.id !== selectedGroupId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !(a.group?.name || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (statusFilter === 'OVERDUE') {
        if (!getDueInfo(a.dueDate, t).isOverdue) return false;
      } else if (statusFilter === 'ACTIVE') {
        const s = a.status?.toUpperCase();
        if (s !== 'ACTIVE' && s !== 'OPEN') return false;
      }
      return true;
    });
  }, [assignments, selectedGroupId, searchQuery, statusFilter, t]);

  /* ---------------- Derived stats ---------------- */
  const stats = useMemo(() => {
    const total = assignments.length;
    const overdue = assignments.filter((a) => getDueInfo(a.dueDate, t).isOverdue).length;
    const active = assignments.filter(
      (a) => a.status?.toUpperCase() === 'ACTIVE' || a.status?.toUpperCase() === 'OPEN',
    ).length;
    const submissions = assignments.reduce((sum, a) => sum + (a._count?.submissions || 0), 0);
    return { total, active, overdue, submissions };
  }, [assignments, t]);

  /* ---------------- macOS Split-View Detail Sidecar ---------------- */
  const handleOpenAssignmentSidecar = useCallback((assignment: Assignment) => {
    const due = getDueInfo(assignment.dueDate, t);
    const data: QuickLookData = {
      id: assignment.id,
      type: 'general',
      title: assignment.title,
      subtitle: assignment.group?.name ? `Guruh: ${assignment.group.name}` : 'Umumiy topshiriq',
      badge: {
        text: assignment.status,
        tone: assignment.status === 'ACTIVE' ? 'emerald' : 'amber',
      },
      avatar: {
        text: '📝',
        color: '#10B981',
      },
      metrics: [
        { label: 'Maks. ball', value: `${assignment.maxScore} ball` },
        { label: 'Topshirdi', value: `${assignment._count?.submissions || 0} ta` },
        { label: 'Guruh', value: assignment.group?.name || 'Biriktirilmagan' },
        { label: 'Muddati', value: due.label },
      ],
      details: [
        { label: 'Topshiriq ID', value: assignment.id, copyable: true },
        { label: 'Sarlavha', value: assignment.title },
        { label: 'Yakunlanish sanasi', value: new Date(assignment.dueDate).toLocaleString() },
        { label: 'Holati', value: assignment.status },
      ],
      primaryAction: {
        label: 'Topshiriqni tahrirlash',
        onExecute: () => {
          setIsModalOpen(true);
          setTitle(assignment.title);
          if (assignment.group?.id) setGroupId(assignment.group.id);
          setMaxScore(assignment.maxScore);
        },
      },
    };
    openSidecar(data);
  }, [t]);

  /* ---------------- Keyboard Navigation ---------------- */
  const {
    focusedIndex,
    isSelected,
    toggleSelection,
  } = useListKeyboardNavigation<Assignment>({
    items: filteredAssignments,
    getItemId: (a) => a.id,
    rowIdPrefix: 'assignment-row-',
    onSelect: (a) => handleOpenAssignmentSidecar(a),
    onQuickLook: (a) => handleOpenAssignmentSidecar(a),
    onEdit: (a) => {
      setIsModalOpen(true);
      setTitle(a.title);
      if (a.group?.id) setGroupId(a.group.id);
      setMaxScore(a.maxScore);
    },
  });

  /* ---------------- Keyboard shortcut for 'c' ---------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPop]);

  /* ---------------- Mutations ---------------- */
  const createMutation = useMutation({
    mutationFn: (payload: any) => assignmentsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      setIsModalOpen(false);
      setTitle('');
      setGroupId('');
      setDueDate('');
      setMaxScore(100);
      setFormErrors({});
      playSuccess();
    },
  });

  /* ---------------- Handlers ---------------- */
  const validate = useCallback(() => {
    const errors: { title?: string; groupId?: string; dueDate?: string } = {};
    if (!title.trim()) errors.title = t('assignments.validation.titleRequired');
    if (!groupId) errors.groupId = t('assignments.validation.groupRequired');
    if (!dueDate) errors.dueDate = t('assignments.validation.dueDateRequired');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [title, groupId, dueDate, t]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      title: title.trim(),
      groupId,
      dueDate: new Date(dueDate).toISOString(),
      maxScore: Number(maxScore),
    });
  };

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setTitle('');
    setGroupId('');
    setDueDate('');
    setMaxScore(100);
    setFormErrors({});
    playPop();
  }, [playPop]);

  /* ---------------- Loading ---------------- */
  if (isLoading && !assignments.length) {
    return (
      <div className="page-container space-y-5">
        <AssignmentsSkeleton />
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (isError) {
    return (
      <div className="page-container space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.smooth}
          className="liquid-glass-card flex flex-col items-center gap-4 p-10 text-center border-red-500/20"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
            <Icon paths={I.alertTriangle} size={28} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              {t('assignments.loadErrorTitle')}
            </h3>
            <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {(error as Error)?.message || t('common.error')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              playTick();
              void refetch();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
          >
            <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
            {t('common.retry')}
          </button>
        </motion.div>
      </div>
    );
  }

  /* ---------------- Main View ---------------- */
  return (
    <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
      <AuroraMesh variant="corporate" opacity={0.65} />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container relative z-10 space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
      >
      {/* HERO (Apple Liquid Glass Header) */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface rounded-3xl p-6 sm:p-8">
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Hero icon */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md sm:h-20 sm:w-20">
              <Icon paths={I.pencil} size={32} strokeWidth={2} className="relative z-10" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight"
                  style={{
                    background: TONE.green.bg,
                    color: TONE.green.fg,
                    border: `1px solid ${TONE.green.border}`,
                    boxShadow: `0 4px 12px -6px ${TONE.green.glow}`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: TONE.green.fg, boxShadow: `0 0 6px ${TONE.green.glow}` }}
                  />
                  {t('assignments.badge.active', { count: stats.active })}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-neutral-100/70 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {t('assignments.badge.total', { count: stats.total })}
                </span>
                {stats.overdue > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      background: TONE.red.bg,
                      color: TONE.red.fg,
                      border: `1px solid ${TONE.red.border}`,
                      boxShadow: `0 4px 12px -6px ${TONE.red.glow}`,
                    }}
                  >
                    <Icon paths={I.alertTriangle} size={10} strokeWidth={2.5} />
                    {t('assignments.badge.overdue', { count: stats.overdue })}
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                {t('assignments.heroTitle')}
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('assignments.heroSubtitle')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
              >
                <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                {t('assignments.create')}
                <kbd className="hidden sm:inline rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* STATS (Liquid Glass Cards) */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatTile label={t('assignments.stat.total')} value={stats.total} icon={I.layers} tone="blue" />
        <StatTile label={t('assignments.stat.active')} value={stats.active} icon={I.checkCircle} tone="green" />
        <StatTile label={t('assignments.stat.overdue')} value={stats.overdue} icon={I.alertTriangle} tone="red" />
        <StatTile label={t('assignments.stat.submissions')} value={stats.submissions} icon={I.award} tone="purple" />
      </motion.div>

      {/* KEYBOARD SHORTCUTS HINTS */}
      <div className="hidden sm:flex items-center justify-end gap-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          J / K
        </span>
        <span>Harakat</span>
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          ↵ / E
        </span>
        <span>Sidecar</span>
        <span className="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[10px] dark:border-white/10 dark:bg-white/5">
          X
        </span>
        <span>Tanlash</span>
      </div>

      {/* ASSIGNMENTS LIST */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-card p-4 sm:p-5">
          {/* Header & Filter Toolbar */}
          <div className="flex flex-col gap-3 pb-3.5 mb-3 border-b border-black/5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Icon paths={I.pencil} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  {t('assignments.listTitle')}
                </h2>
                <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {t(filteredAssignments.length === 1 ? 'assignments.countOne' : 'assignments.countMany', { count: filteredAssignments.length })}
                </p>
              </div>
            </div>

            {/* Status Segmented Tabs */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setStatusFilter('ALL');
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5'
                }`}
              >
                {t('common.all', 'Barchasi')} ({assignments.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setStatusFilter('ACTIVE');
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5'
                }`}
              >
                {t('assignments.badge.active', { count: stats.active })}
              </button>
              <button
                type="button"
                onClick={() => {
                  playTick();
                  setStatusFilter('OVERDUE');
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'OVERDUE'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5'
                }`}
              >
                {t('assignments.badge.overdue', { count: stats.overdue })}
              </button>
            </div>
          </div>

          {/* Search and Group Selector Filters */}
          <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-400">
                <Icon paths={I.search} size={14} strokeWidth={2.2} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('common.search', 'Topshiriq yoki guruh bo‘yicha qidirish...')}
                className="min-h-[40px] w-full rounded-xl border border-black/10 bg-black/[0.02] pl-8 pr-8 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:border-blue-500 focus:outline-none dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-100"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    playTick();
                    setSearchQuery('');
                  }}
                  className="min-h-[40px] min-w-[32px] absolute inset-y-0 right-0 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  aria-label={t('common.clear', 'Tozalash')}
                >
                  <Icon paths={I.x} size={13} strokeWidth={2.4} />
                </button>
              )}
            </div>

            {/* Group Selector Dropdown */}
            <div className="relative">
              <select
                value={selectedGroupId}
                onChange={(e) => handleGroupFilterChange(e.target.value)}
                className="min-h-[40px] w-full rounded-xl border border-black/10 bg-black/[0.02] px-3 text-xs font-semibold text-neutral-800 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-200 cursor-pointer"
                aria-label={t('nav.groups', 'Guruh bo‘yicha filtr')}
              >
                <option value="">{t('groups.allGroups', 'Barcha guruhlar')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id} className="dark:bg-surface-900">
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            {assignments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <Icon paths={I.pencil} size={26} strokeWidth={2} />
                </div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('assignments.emptyTitle')}
                </p>
                <p className="max-w-sm text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {t('assignments.emptyHint')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playPop();
                    setIsModalOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95"
                >
                  <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                  {t('assignments.create')}
                </button>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-500/10 text-neutral-500">
                  <Icon paths={I.search} size={22} strokeWidth={2} />
                </div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {t('common.noResults', 'Natija topilmadi')}
                </p>
                <p className="max-w-xs text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Tanlangan guruh yoki qidiruv bo‘yicha topshiriqlar mavjud emas.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playTick();
                    setSelectedGroupId('');
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setSearchParams({});
                  }}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 transition-colors"
                >
                  {t('common.resetFilters', 'Filtrlarni tozalash')}
                </button>
              </div>
            ) : (
              <motion.div layout className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredAssignments.map((a, idx) => (
                    <AssignmentCard
                      key={a.id}
                      assignment={a}
                      onOpenSidecar={handleOpenAssignmentSidecar}
                      isFocused={focusedIndex === idx}
                      isSelected={isSelected(a.id)}
                      onToggleSelect={() => toggleSelection(a.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* CREATE MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="fixed inset-0 bg-black/45 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={SPRING.smooth}
              onClick={(e) => e.stopPropagation()}
              className="liquid-glass-surface relative z-10 w-full max-w-lg overflow-hidden rounded-3xl p-6 shadow-2xl dark:text-white"
            >
              {/* Header hint */}
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-500">
                  <Icon paths={I.sparkles} size={18} strokeWidth={2} />
                </div>
                <p className="text-xs font-semibold leading-snug">
                  {t('assignments.createHint')}
                </p>
              </div>

              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {t('assignments.form.title')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setFormErrors((p) => ({ ...p, title: undefined }));
                    }}
                    placeholder={t('assignments.form.titlePlaceholder')}
                    aria-invalid={Boolean(formErrors.title)}
                    className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-xs font-medium text-red-500">{formErrors.title}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    {t('assignments.form.group')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                      <Icon paths={I.users} size={15} strokeWidth={2.2} />
                    </span>
                    <select
                      required
                      value={groupId}
                      onChange={(e) => {
                        setGroupId(e.target.value);
                        setFormErrors((p) => ({ ...p, groupId: undefined }));
                      }}
                      aria-invalid={Boolean(formErrors.groupId)}
                      className="w-full appearance-none rounded-2xl border border-black/10 bg-white/70 py-2.5 pl-10 pr-10 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <option value="">{t('assignments.form.chooseGroup')}</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id} className="dark:bg-zinc-900">
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {formErrors.groupId && (
                    <p className="mt-1 text-xs font-medium text-red-500">{formErrors.groupId}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {t('assignments.form.dueDate')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value);
                        setFormErrors((p) => ({ ...p, dueDate: undefined }));
                      }}
                      aria-invalid={Boolean(formErrors.dueDate)}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                    {formErrors.dueDate && (
                      <p className="mt-1 text-xs font-medium text-red-500">{formErrors.dueDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      {t('assignments.form.maxScore')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={maxScore}
                      onChange={(e) => setMaxScore(Number(e.target.value))}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={createMutation.isPending}
                    className="rounded-xl border border-black/5 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-70"
                  >
                    {createMutation.isPending ? (
                      <>
                        <motion.span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        {t('assignments.creating')}
                      </>
                    ) : (
                      <>
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('assignments.create')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  </div>
  );
}