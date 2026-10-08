/**
 * M-EDU ExamsPage — Apple Design Award Edition
 *
 * ✅ FIXED: GlassField o'rniga GlassInput/GlassSelect direct label+error props
 * (original API pattern).
 *
 * Premium craft:
 *  - Hero header with gradient exam tile + live chips
 *  - Ambient gradient orbs
 *  - Animated KPI bar (Total, Published, Drafts, This month)
 *  - Premium filter toolbar with squircle leading icons
 *  - Exam rows: gradient type tile + type chip + subject chip + marks bar
 *  - Tone-aware status badge with pulse
 *  - Premium modal with squircle FieldIcons + edit-locked hint
 *  - Shimmer skeleton (not pulse)
 *  - 100% logic preserved
 */

import { formatDate } from '../lib/format';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { examsApi, groupsApi } from '@/lib/api';
import {
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassButton,
  GlassErrorState,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Exam, ExamType, Group } from '@/lib/types';
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

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  exam: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 15l2 2 4-4',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  usersRound: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  check: ['M20 6 9 17l-5-5'],
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
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  lock: [
    'M5 11h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'indigo';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  indigo:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)' },
};

const EXAM_TYPE_TONE: Record<ExamType, Tone> = {
  MIDTERM: 'blue',
  FINAL: 'orange',
  QUIZ: 'emerald',
  ASSIGNMENT: 'cyan',
};

const EXAM_TYPE_LABEL_KEY: Record<ExamType, string> = {
  MIDTERM: 'exams.type.MIDTERM',
  FINAL: 'exams.type.FINAL',
  QUIZ: 'exams.type.QUIZ',
  ASSIGNMENT: 'exams.type.ASSIGNMENT',
};

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface ExamFormState {
  title: string;
  subject: string;
  groupId: string;
  examType: ExamType | '';
  examDate: string;
  duration: string;
  totalMarks: string;
  passingMarks: string;
}

const INITIAL_FORM: ExamFormState = {
  title: '',
  subject: '',
  groupId: '',
  examType: '',
  examDate: '',
  duration: '60',
  totalMarks: '100',
  passingMarks: '60',
};

const EXAM_TYPES: ExamType[] = ['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT'];

function validateExamForm(form: ExamFormState): Partial<Record<keyof ExamFormState, string>> {
  const errors: Partial<Record<keyof ExamFormState, string>> = {};

  if (!form.title.trim()) errors.title = 'homework.titleRequired';
  if (!form.subject.trim()) errors.subject = 'exams.subjectRequired';
  if (!form.groupId) errors.groupId = 'exams.groupRequired';
  if (!form.examType) errors.examType = 'exams.form.typeRequired';
  if (!form.examDate) errors.examDate = 'exams.form.dateRequired';
  if (!form.duration || isNaN(parseInt(form.duration)) || parseInt(form.duration) <= 0) {
    errors.duration = 'exams.durationInvalid';
  }
  if (!form.totalMarks || isNaN(parseInt(form.totalMarks)) || parseInt(form.totalMarks) <= 0) {
    errors.totalMarks = 'exams.totalMarksInvalid';
  }
  if (!form.passingMarks || isNaN(parseInt(form.passingMarks)) || parseInt(form.passingMarks) < 0) {
    errors.passingMarks = 'exams.passingMarksInvalid';
  }
  if (parseInt(form.passingMarks) > parseInt(form.totalMarks)) {
    errors.passingMarks = 'exams.passingMarksExceed';
  }

  return errors;
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const EXAM_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
];

function examGradient(title: string): string {
  const [a, b] = EXAM_PALETTES[nameHash(title) % EXAM_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }) {
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

  return <span className="tabular-nums">{n.toLocaleString()}</span>;
}

function KpiTile({
  label, value, icon, tone = 'blue',
}: {
  label: string; value: number; icon: string[]; tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
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
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

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

function ExamsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] dark:border-[#ffffff10] dark:bg-[#1c1c1e80]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-[#00000008] p-4 last:border-0 dark:border-[#ffffff08]">
            <Shimmer className="h-12 w-12" radius="0.75rem" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-4 w-48" radius="0.5rem" />
              <Shimmer className="h-3 w-32" radius="0.5rem" />
            </div>
            <Shimmer className="hidden h-6 w-24 sm:block" radius="9999px" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamTypeTile({ title, examType }: { title: string; examType: ExamType }) {
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
      style={{
        background: examGradient(title),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,0,0,0.25)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
      />
      <Icon
        paths={examType === 'QUIZ' ? I.sparkles : examType === 'ASSIGNMENT' ? I.book : I.exam}
        size={20}
        strokeWidth={2}
        className="relative"
      />
    </div>
  );
}

function ExamTypeChip({ type, label }: { type: ExamType; label: string }) {
  const tone = EXAM_TYPE_TONE[type] ?? 'blue';
  const c = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ published, label }: { published: boolean; label: string }) {
  const tone: Tone = published ? 'emerald' : 'gray';
  const c = TONES[tone];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {published && (
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

function MarksBar({ passing, total }: { passing: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, passing / total) : 0;
  const tone: Tone = ratio >= 0.7 ? 'emerald' : ratio >= 0.5 ? 'amber' : 'orange';
  const c = TONES[tone];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12.5px] font-semibold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
        {passing}
        <span className="opacity-40">/{total}</span>
      </span>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: c.fg }}
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ duration: 0.9, ease: EASE_APPLE, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

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

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function ExamsPage() {
  const { t } = useI18n();
  usePageTitle(t('exams.title'));
  const { push, toastNode } = useToast();
  const qc = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<ExamFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExamFormState, string>>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  /* ── Queries ──────────────────────────────────────────────────────── */
  const exams = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsApi.list({ limit: 100 }),
  });

  const data = exams.data as Paginated<Exam> | undefined;
  const examList = useMemo(() => data?.items || [], [data]);

  const groupData = groups.data as Paginated<Group> | undefined;
  const groupList = useMemo(() => groupData?.items || [], [groupData]);

  const filteredExams = useMemo(() => {
    let filtered = examList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (exam) =>
          exam.title.toLowerCase().includes(q) ||
          (exam.subject ?? '').toLowerCase().includes(q),
      );
    }

    if (filterType) {
      filtered = filtered.filter((exam) => exam.examType === filterType);
    }

    return filtered;
  }, [examList, searchQuery, filterType]);

  /* ── Derived stats ────────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const total = examList.length;
    const published = examList.filter((e) => e.isPublished).length;
    const drafts = total - published;
    const now = new Date();
    const thisMonth = examList.filter((e) => {
      if (!e.examDate) return false;
      const d = new Date(e.examDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total, published, drafts, thisMonth };
  }, [examList]);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const saveExam = useMutation({
    mutationFn: () => {
      const common = {
        title: form.title.trim(),
        examDate: form.examDate,
        duration: parseInt(form.duration, 10),
        totalMarks: parseInt(form.totalMarks, 10),
        passingMarks: parseInt(form.passingMarks, 10),
        examType: form.examType as ExamType,
      };

      if (editingId) {
        return examsApi.update(editingId, common);
      }
      return examsApi.create({
        ...common,
        groupId: form.groupId,
        subject: form.subject.trim(),
      });
    },
    onSuccess: () => {
      push('success', editingId ? t('exams.updated') : t('exams.created'));
      qc.invalidateQueries({ queryKey: ['exams'] });
      closeModal();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const publishExam = useMutation({
    mutationFn: (id: string) => examsApi.publish(id),
    onSuccess: () => {
      push('success', t('exams.published'));
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const deleteExam = useMutation({
    mutationFn: (id: string) => examsApi.remove(id),
    onSuccess: () => {
      push('success', t('exams.deleted'));
      qc.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const openModal = useCallback((exam?: Exam) => {
    if (exam) {
      setEditingId(exam.id);
      setForm({
        title: exam.title,
        subject: exam.subject || '',
        groupId: exam.groupId || '',
        examType: exam.examType,
        examDate: (exam.examDate || '').split('T')[0],
        duration: exam.duration?.toString() || '60',
        totalMarks: exam.totalMarks.toString(),
        passingMarks: exam.passingMarks.toString(),
      });
    } else {
      setEditingId(null);
      setForm(INITIAL_FORM);
    }
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleSubmit = useCallback(() => {
    const errors = validateExamForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveExam.mutate();
  }, [form, saveExam]);

  const getGroupName = useCallback(
    (exam: Exam) => {
      if (exam.group?.name) return exam.group.name;
      if (exam.groupId) {
        const group = groupList.find((g) => g.id === exam.groupId);
        return group?.name || t('common.unknown');
      }
      return '—';
    },
    [groupList, t],
  );

  const getCourseName = useCallback((exam: Exam) => {
    if (exam.group?.course?.name) return exam.group.course.name;
    return '—';
  }, []);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (exams.isLoading || groups.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <ExamsSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (exams.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(exams.error)}
            onRetry={() => exams.refetch()}
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

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteExam.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        description={t('exams.deleteConfirm')}
        loading={deleteExam.isPending}
      />

      {/* HERO HEADER */}
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
              background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
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
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.exam} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5856D6]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5856D6]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Exams
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} total
                </span>
                {stats.published > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                    {stats.published} published
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('exams.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('exams.pageDescription')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton variant="primary" onClick={() => openModal()}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('exams.add')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* KPI BAR */}
      {examList.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile label={t('exams.title')} value={stats.total} icon={I.exam} tone="indigo" />
          <KpiTile label={t('exams.status.published')} value={stats.published} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('exams.status.draft')} value={stats.drafts} icon={I.edit} tone="gray" />
          <KpiTile label="This month" value={stats.thisMonth} icon={I.clock} tone="blue" />
        </motion.div>
      )}

      {/* FILTER TOOLBAR */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <FieldIcon icon={I.search} tone="blue" />
              <GlassInput
                placeholder={t('exams.searchInputPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11"
              />
            </div>
            <div className="relative sm:w-56">
              <FieldIcon icon={I.filter} tone="orange" />
              <GlassSelect
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                options={[
                  { value: '', label: t('enum.allTypes') },
                  ...EXAM_TYPES.map((type) => ({ value: type, label: t(`exams.type.${type}`) })),
                ]}
                placeholder={t('enum.allTypes')}
                className="pl-11"
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* EXAMS LIST */}
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
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />

        {filteredExams.length === 0 ? (
          <div className="relative p-10">
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
                {searchQuery || filterType ? t('exams.emptySearch') : t('exams.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {searchQuery || filterType
                  ? t('certificates.emptySearchHint')
                  : t('exams.emptyMessage')}
              </p>
              {!searchQuery && !filterType && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton variant="primary" size="sm" onClick={() => openModal()}>
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('exams.add')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
            {filteredExams.map((exam, idx) => (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#5856D6]/[0.03]"
              >
                <ExamTypeTile title={exam.title} examType={exam.examType} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                      {exam.title}
                    </p>
                    <ExamTypeChip type={exam.examType} label={t(EXAM_TYPE_LABEL_KEY[exam.examType])} />
                    <StatusBadge
                      published={exam.isPublished}
                      label={exam.isPublished ? t('exams.status.published') : t('exams.status.draft')}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                    {exam.subject && (
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.book} size={10} strokeWidth={2.2} className="opacity-60" />
                        {exam.subject}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Icon paths={I.usersRound} size={10} strokeWidth={2.2} className="opacity-60" />
                      {getGroupName(exam)}
                    </span>
                    {getCourseName(exam) !== '—' && (
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.layers} size={10} strokeWidth={2.2} className="opacity-60" />
                        {getCourseName(exam)}
                      </span>
                    )}
                    {exam.examDate && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                        {formatDate(exam.examDate)}
                      </span>
                    )}
                    {exam.duration && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.clock} size={10} strokeWidth={2.2} className="opacity-60" />
                        {t('exams.durationMinutes', { n: exam.duration })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden flex-col items-end lg:flex">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('grades.col.score')}
                  </span>
                  <div className="mt-0.5">
                    <MarksBar passing={exam.passingMarks} total={exam.totalMarks} />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {!exam.isPublished && (
                    <motion.button
                      type="button"
                      onClick={() => publishExam.mutate(exam.id)}
                      disabled={publishExam.isPending}
                      whileHover={{ scale: 1.06, y: -1 }}
                      whileTap={{ scale: 0.94 }}
                      transition={SPRING.snappy}
                      aria-label={t('exams.publish')}
                      title={t('exams.publish')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold tracking-tight outline-none disabled:opacity-50"
                      style={{
                        background: 'rgba(16,185,129,0.10)',
                        color: '#10B981',
                        border: '1px solid rgba(16,185,129,0.22)',
                      }}
                    >
                      <Icon paths={I.upload} size={12} strokeWidth={2.4} />
                      <span className="hidden sm:inline">{t('exams.publish')}</span>
                    </motion.button>
                  )}
                  <motion.button
                    type="button"
                    onClick={() => openModal(exam)}
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
                    onClick={() => setDeleteTarget(exam.id)}
                    disabled={deleteExam.isPending && deleteExam.variables === exam.id}
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
            ))}
          </div>
        )}
      </motion.div>

      {/* CREATE / EDIT MODAL */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('exams.editTitle') : t('exams.add')}
        wide
      >
        <div className="space-y-5">
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#5856D633] bg-[#5856D6]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5856D6]/15 text-[#5856D6]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {editingId
                ? t('exams.editLockedHint')
                : 'Enter exam details. Title, subject, group, and type are required.'}
            </p>
          </div>

          {/* Title */}
          <div className="relative">
            <FieldIcon icon={I.exam} tone="indigo" />
            <GlassInput
              label={t('exams.field.title')}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('exams.titlePlaceholder')}
              error={formErrors.title ? t(formErrors.title) : undefined}
              className="pl-11"
            />
          </div>

          {!editingId && (
            <>
              <div className="relative">
                <FieldIcon icon={I.book} tone="blue" />
                <GlassInput
                  label={t('exams.field.subject')}
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder={t('exams.subjectPlaceholder')}
                  error={formErrors.subject ? t(formErrors.subject) : undefined}
                  className="pl-11"
                />
              </div>

              <div className="relative">
                <FieldIcon icon={I.usersRound} tone="cyan" />
                <GlassSelect
                  label={t('exams.field.group')}
                  value={form.groupId}
                  onChange={(e) => setForm({ ...form, groupId: e.target.value })}
                  options={[
                    { value: '', label: t('exams.groupPlaceholder') },
                    ...groupList.map((group) => ({ value: group.id, label: group.name })),
                  ]}
                  placeholder={t('exams.groupPlaceholder')}
                  error={formErrors.groupId ? t(formErrors.groupId) : undefined}
                  className="pl-11"
                />
              </div>
            </>
          )}

          {/* Exam type */}
          <div className="relative">
            <FieldIcon icon={I.layers} tone="purple" />
            <GlassSelect
              label={t('exams.field.examType')}
              value={form.examType}
              onChange={(e) => setForm({ ...form, examType: e.target.value as ExamType })}
              options={[
                { value: '', label: t('exams.form.selectType') },
                ...EXAM_TYPES.map((type) => ({ value: type, label: t(`exams.type.${type}`) })),
              ]}
              placeholder={t('exams.form.selectType')}
              error={formErrors.examType ? t(formErrors.examType) : undefined}
              className="pl-11"
            />
          </div>

          {/* Date */}
          <div className="relative">
            <FieldIcon icon={I.calendar} tone="orange" />
            <GlassInput
              label={t('exams.field.date')}
              type="date"
              value={form.examDate}
              onChange={(e) => setForm({ ...form, examDate: e.target.value })}
              error={formErrors.examDate ? t(formErrors.examDate) : undefined}
              className="pl-11"
            />
          </div>

          {/* Duration / Marks row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <FieldIcon icon={I.clock} tone="blue" />
              <GlassInput
                label={t('exams.field.duration')}
                type="number"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="60"
                min="1"
                error={formErrors.duration ? t(formErrors.duration) : undefined}
                className="pl-11"
              />
            </div>

            <div className="relative">
              <FieldIcon icon={I.target} tone="emerald" />
              <GlassInput
                label={t('exams.field.totalMarks')}
                type="number"
                value={form.totalMarks}
                onChange={(e) => setForm({ ...form, totalMarks: e.target.value })}
                placeholder="100"
                min="0"
                error={formErrors.totalMarks ? t(formErrors.totalMarks) : undefined}
                className="pl-11"
              />
            </div>

            <div className="relative">
              <FieldIcon icon={I.checkCircle} tone="green" />
              <GlassInput
                label={t('exams.field.passingMarks')}
                type="number"
                value={form.passingMarks}
                onChange={(e) => setForm({ ...form, passingMarks: e.target.value })}
                placeholder="60"
                min="0"
                error={formErrors.passingMarks ? t(formErrors.passingMarks) : undefined}
                className="pl-11"
              />
            </div>
          </div>

          {editingId && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#FF950033] bg-[#FF9500]/[0.06] px-4 py-3">
              <Icon paths={I.lock} size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-[#FF9500]" />
              <p className="text-[11.5px] font-medium leading-snug text-[#8A5A00] dark:text-[#FCD34D]">
                {t('exams.editLockedHint')}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton variant="secondary" onClick={closeModal}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                variant="primary"
                onClick={handleSubmit}
                disabled={saveExam.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {saveExam.isPending ? (
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
            </motion.div>
          </div>
        </div>
      </GlassModal>
    </motion.div>
  );
}