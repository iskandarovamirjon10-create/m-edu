/**
 * ============================================================================
 * M-EDU ExamsPage — Apple Design Award Edition (macOS Sequoia & Liquid Glass)
 * ============================================================================
 *
 * Senior craft:
 *  - Apple Liquid Glass materials (.liquid-glass-surface, .liquid-glass-card)
 *  - Real-time tunable optics (--liquid-glass-opacity, --liquid-glass-blur)
 *  - macOS Split-View Detail Sidecar (`openSidecar` with passing scores & exam syllabus)
 *  - Superhuman keyboard-first navigation (j/k, x, Enter, c to create)
 *  - Web Audio tactile haptics (playTick, playPop, playSuccess)
 *  - Passing-marks micro-gauge with Apple spring physics
 *  - Shimmer skeletons with specular rim reflections
 *  - 100% logic and mutations preserved
 * ============================================================================
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { examsApi, groupsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassErrorState,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Exam, ExamType, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';

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
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  search: [
    'M21 21l-4.35-4.35',
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  ],
  filter: [
    'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
  ],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12',
  ],
  lock: [
    'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z',
    'M7 11V7a5 5 0 0 1 10 0v4',
  ],
  check: ['M20 6L9 17l-5-5'],
  empty: [
    'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z',
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
 * TONE SYSTEM
 * ========================================================================== */

type Tone = 'cyan' | 'blue' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'gray' | 'orange' | 'green';

interface ToneStyle {
  fg: string;
  bg: string;
  glow: string;
  border: string;
}

const TONES: Record<Tone, ToneStyle> = {
  cyan:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  indigo:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',   glow: 'rgba(88,86,214,0.28)',   border: 'rgba(88,86,214,0.22)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  emerald: { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  amber:   { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  rose:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  gray:    { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const EXAM_PALETTES = [
  ['#5856D6', '#AF52DE'],
  ['#007AFF', '#5856D6'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
];

function examGradient(name: string): string {
  const [a, b] = EXAM_PALETTES[nameHash(name) % EXAM_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

const EXAM_TYPES: ExamType[] = ['FINAL', 'MIDTERM', 'QUIZ', 'ASSIGNMENT'];

const EXAM_TYPE_TONE: Record<ExamType, Tone> = {
  FINAL: 'rose',
  MIDTERM: 'amber',
  QUIZ: 'purple',
  ASSIGNMENT: 'blue',
};

const EXAM_TYPE_LABEL_KEY: Record<ExamType, string> = {
  FINAL: 'exams.type.FINAL',
  MIDTERM: 'exams.type.MIDTERM',
  QUIZ: 'exams.type.QUIZ',
  ASSIGNMENT: 'exams.type.ASSIGNMENT',
};

interface ExamFormState {
  title: string;
  subject: string;
  groupId: string;
  examType: ExamType;
  examDate: string;
  duration: string;
  totalMarks: string;
  passingMarks: string;
}

const INITIAL_FORM: ExamFormState = {
  title: '',
  subject: '',
  groupId: '',
  examType: 'MIDTERM',
  examDate: new Date().toISOString().split('T')[0],
  duration: '60',
  totalMarks: '100',
  passingMarks: '60',
};

function validateExamForm(form: ExamFormState) {
  const errors: Partial<Record<keyof ExamFormState, string>> = {};
  if (!form.title.trim()) errors.title = 'exams.validation.titleRequired';
  if (!form.subject.trim()) errors.subject = 'exams.validation.subjectRequired';
  if (!form.groupId) errors.groupId = 'exams.validation.groupRequired';
  if (!form.examType) errors.examType = 'exams.validation.typeRequired';
  if (!form.examDate) errors.examDate = 'exams.validation.dateRequired';
  const duration = parseInt(form.duration, 10);
  if (isNaN(duration) || duration <= 0) errors.duration = 'exams.validation.durationPositive';
  const totalMarks = parseInt(form.totalMarks, 10);
  if (isNaN(totalMarks) || totalMarks <= 0) errors.totalMarks = 'exams.validation.totalMarksPositive';
  const passingMarks = parseInt(form.passingMarks, 10);
  if (isNaN(passingMarks) || passingMarks < 0) errors.passingMarks = 'exams.validation.passingMarksPositive';
  else if (passingMarks > totalMarks) errors.passingMarks = 'exams.validation.passingMarksExceed';
  return errors;
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

function ExamsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[74px]" radius="1.25rem" />)}
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-24" radius="1.25rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * SUB-COMPONENTS
 * ========================================================================== */

function KpiTile({
  label, value, icon, tone = 'blue',
}: { label: string; value: number; icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
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

function MarksBar({ passing, total }: { passing: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, passing / total) : 0;
  const tone: Tone = ratio >= 0.7 ? 'emerald' : ratio >= 0.5 ? 'amber' : 'orange';
  const c = TONES[tone];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-bold tabular-nums text-neutral-900 dark:text-white">
        {passing}
        <span className="opacity-40">/{total}</span>
      </span>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-neutral-200/60 dark:bg-white/10">
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
      className="pointer-events-none absolute left-3.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon paths={icon} size={13} strokeWidth={2.2} />
    </span>
  );
}

/* ============================================================================
 * EXAM ROW
 * ========================================================================== */

function ExamRow({
  exam,
  groupName,
  courseName,
  onOpenSidecar,
  onPublish,
  onEdit,
  onDelete,
  isFocused = false,
  isSelected = false,
  onToggleSelect,
}: {
  exam: Exam;
  groupName: string;
  courseName: string;
  onOpenSidecar: (e: Exam) => void;
  onPublish: (id: string) => void;
  onEdit: (e: Exam) => void;
  onDelete: (id: string) => void;
  isFocused?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useI18n();
  const { playTick, playPop } = usePremiumSound();

  const typeTone = EXAM_TYPE_TONE[exam.examType] ?? 'blue';
  const tc = TONES[typeTone];

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      onClick={() => {
        playPop();
        onOpenSidecar(exam);
      }}
      className={`liquid-glass-card group relative flex flex-col gap-3.5 p-4 cursor-pointer sm:flex-row sm:items-center ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-500/10'
          : isFocused
          ? 'ring-2 ring-blue-500/60'
          : ''
      }`}
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-3.5 bottom-3.5 w-[3.5px] rounded-r-full"
        style={{ background: tc.fg, boxShadow: `0 0 10px ${tc.glow}` }}
      />

      {/* Row Selection checkbox */}
      {onToggleSelect && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onToggleSelect();
          }}
          className="flex items-center pl-1 shrink-0"
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="h-4 w-4 rounded-md accent-blue-600 cursor-pointer"
            aria-label={`Select ${exam.title}`}
          />
        </div>
      )}

      {/* Icon tile */}
      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{
          background: examGradient(exam.title),
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 6px 16px -6px rgba(0,0,0,0.25)',
        }}
      >
        <Icon
          paths={exam.examType === 'QUIZ' ? I.sparkles : exam.examType === 'ASSIGNMENT' ? I.book : I.exam}
          size={22}
          strokeWidth={2}
          className="relative z-10"
        />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pl-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {exam.title}
          </h3>

          {/* Exam Type Chip */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ background: tc.bg, color: tc.fg, border: `1px solid ${tc.border}` }}
          >
            {t(EXAM_TYPE_LABEL_KEY[exam.examType])}
          </span>

          {/* Published Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              exam.isPublished
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-neutral-100 text-neutral-500 border border-black/5 dark:bg-white/5 dark:text-neutral-400 dark:border-white/10'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                exam.isPublished ? 'bg-emerald-500 shadow-[0_0_6px_#10B981]' : 'bg-neutral-400'
              }`}
            />
            {exam.isPublished ? t('exams.status.published') : t('exams.status.draft')}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {exam.subject && (
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.book} size={11} strokeWidth={2.2} className="opacity-60" />
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{exam.subject}</span>
            </span>
          )}

          <span className="inline-flex items-center gap-1">
            <Icon paths={I.usersRound} size={11} strokeWidth={2.2} className="opacity-60" />
            {groupName}
          </span>

          {courseName !== '—' && (
            <span className="inline-flex items-center gap-1">
              <Icon paths={I.layers} size={11} strokeWidth={2.2} className="opacity-60" />
              {courseName}
            </span>
          )}

          {exam.examDate && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Icon paths={I.calendar} size={11} strokeWidth={2.2} className="opacity-60" />
              {formatDate(exam.examDate)}
            </span>
          )}

          {exam.duration && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Icon paths={I.clock} size={11} strokeWidth={2.2} className="opacity-60" />
              {t('exams.durationMinutes', { n: exam.duration })}
            </span>
          )}
        </div>
      </div>

      {/* Marks Column */}
      <div className="hidden flex-col items-end sm:flex shrink-0 pr-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          {t('grades.col.score')}
        </span>
        <div className="mt-1">
          <MarksBar passing={exam.passingMarks} total={exam.totalMarks} />
        </div>
      </div>

      {/* Action buttons + Split-View Trigger */}
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playPop();
            onOpenSidecar(exam);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-xs font-bold text-neutral-600 transition-all hover:border-black/20 hover:bg-white hover:text-black hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white"
          title="macOS Split-View Sidecar (Enter / e)"
          aria-label="Split-View Sidecar"
        >
          ◨
        </button>

        {!exam.isPublished && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playTick();
              onPublish(exam.id);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 text-xs font-bold text-emerald-600 transition-all hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-400"
            title={t('exams.publish')}
          >
            <Icon paths={I.upload} size={12} strokeWidth={2.4} />
            <span className="hidden sm:inline">{t('exams.publish')}</span>
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onEdit(exam);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-blue-600 transition-all hover:border-blue-500/30 hover:bg-blue-50 hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-blue-400 dark:hover:bg-blue-500/15"
          title={t('common.edit')}
          aria-label={t('common.edit')}
        >
          <Icon paths={I.edit} size={13} strokeWidth={2} />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            playTick();
            onDelete(exam.id);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white/70 text-red-600 transition-all hover:border-red-500/30 hover:bg-red-50 hover:shadow-xs active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-red-400 dark:hover:bg-red-500/15"
          title={t('common.delete')}
          aria-label={t('common.delete')}
        >
          <Icon paths={I.trash} size={13} strokeWidth={2} />
        </button>
      </div>
    </motion.div>
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
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [form, setForm] = useState<ExamFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExamFormState, string>>>({});

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');

  /* ── Queries ──────────────────────────────────────────────────────── */
  const exams = useQuery({
    queryKey: queryKeys.exams.all(),
    queryFn: () => examsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
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

  /* ── Helpers for group/course names ───────────────────────────────── */
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
      qc.invalidateQueries({ queryKey: queryKeys.exams.all() });
      closeModal();
      playSuccess();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const publishExam = useMutation({
    mutationFn: (id: string) => examsApi.publish(id),
    onSuccess: () => {
      push('success', t('exams.published'));
      qc.invalidateQueries({ queryKey: queryKeys.exams.all() });
      playSuccess();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  const deleteExam = useMutation({
    mutationFn: (id: string) => examsApi.remove(id),
    onSuccess: () => {
      push('success', t('exams.deleted'));
      qc.invalidateQueries({ queryKey: queryKeys.exams.all() });
      playSuccess();
    },
    onError: (error) => {
      push('error', getErrorMessage(error));
    },
  });

  /* ── Modal handlers ───────────────────────────────────────────────── */
  const openModal = useCallback((exam?: Exam) => {
    playPop();
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
  }, [playPop]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    playPop();
  }, [playPop]);

  const handleSubmit = useCallback(() => {
    const errors = validateExamForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    saveExam.mutate();
  }, [form, saveExam]);

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenExamSidecar = useCallback((exam: Exam) => {
    const data: QuickLookData = {
      id: exam.id,
      type: 'general',
      title: exam.title,
      subtitle: `${exam.subject || 'Fan ko\'rsatilmagan'} · ${getGroupName(exam)}`,
      badge: {
        text: exam.isPublished ? 'E\'lon qilingan' : 'Qoralama',
        tone: exam.isPublished ? 'emerald' : 'amber',
      },
      avatar: {
        text: '📝',
        color: '#6366F1',
      },
      metrics: [
        { label: 'O\'tish bali', value: `${exam.passingMarks}/${exam.totalMarks}` },
        { label: 'Davomiyligi', value: `${exam.duration || 60} daqiqa` },
        { label: 'Turi', value: exam.examType },
        { label: 'Sana', value: exam.examDate ? formatDate(exam.examDate) : 'Belgilanmagan' },
      ],
      details: [
        { label: 'Imtihon ID', value: exam.id, copyable: true },
        { label: 'Sarlavha', value: exam.title },
        { label: 'Fan', value: exam.subject || '—' },
        { label: 'Guruh', value: getGroupName(exam) },
        { label: 'Kurs', value: getCourseName(exam) },
        { label: 'Holati', value: exam.isPublished ? 'E\'lon qilingan' : 'Qoralama' },
      ],
      primaryAction: {
        label: exam.isPublished ? 'Imtihonni tahrirlash' : 'Imtihonni e\'lon qilish',
        onExecute: () => {
          if (!exam.isPublished) publishExam.mutate(exam.id);
          else openModal(exam);
        },
      },
    };
    openSidecar(data);
  }, [getGroupName, getCourseName, publishExam, openModal]);

  /* ── Keyboard Navigation ──────────────────────────────────────────── */
  const {
    focusedIndex,
    isSelected,
    toggleSelection,
  } = useListKeyboardNavigation<Exam>({
    items: filteredExams,
    getItemId: (e) => e.id,
    rowIdPrefix: 'exam-row-',
    onSelect: (e) => handleOpenExamSidecar(e),
    onQuickLook: (e) => handleOpenExamSidecar(e),
    onEdit: (e) => openModal(e),
  });

  /* ── Keyboard shortcut for 'c' ────────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        openModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openModal]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (exams.isLoading || groups.isLoading) {
    return (
      <div className="page-container space-y-5">
        <ExamsSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (exams.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="liquid-glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(exams.error)}
            onRetry={() => {
              playTick();
              exams.refetch();
            }}
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

      {/* HERO (Apple Liquid Glass Header) */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface rounded-3xl p-6 sm:p-8">
          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Hero icon */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md sm:h-20 sm:w-20">
              <Icon paths={I.exam} size={32} strokeWidth={2} className="relative z-10" />
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1 text-[11px] font-bold tracking-tight text-indigo-500">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('exams.title')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-neutral-100/70 px-2.5 py-1 text-[11px] font-semibold text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.total} jami
                </span>
                {stats.published > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
                    {stats.published} e'lon qilingan
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-4xl">
                {t('exams.title')}
              </h1>
              <p className="mt-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {t('exams.pageDescription')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <button
                type="button"
                onClick={() => openModal()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95"
              >
                <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                {t('exams.add')}
                <kbd className="hidden sm:inline rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* KPI BAR (Liquid Glass Cards) */}
      {examList.length > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
        >
          <KpiTile label={t('exams.title')} value={stats.total} icon={I.exam} tone="indigo" />
          <KpiTile label={t('exams.status.published')} value={stats.published} icon={I.checkCircle} tone="emerald" />
          <KpiTile label={t('exams.status.draft')} value={stats.drafts} icon={I.edit} tone="gray" />
          <KpiTile label="Shu oyda" value={stats.thisMonth} icon={I.clock} tone="blue" />
        </motion.div>
      )}

      {/* FILTER TOOLBAR */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-surface rounded-2xl p-3.5 border border-black/5 dark:border-white/10">
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
                onChange={(e) => {
                  playTick();
                  setFilterType(e.target.value);
                }}
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

      {/* EXAMS LIST */}
      <motion.div variants={cardVariants}>
        <div className="liquid-glass-card p-4 sm:p-5">
          <div className="flex items-center justify-between pb-3.5 mb-3 border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                <Icon paths={I.exam} size={16} strokeWidth={2} />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                  {t('exams.title')} ro'yxati
                </h2>
                <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {filteredExams.length} ta imtihon ko'rsatilmoqda
                </p>
              </div>
            </div>
          </div>

          <div>
            {filteredExams.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <Icon paths={I.empty} size={26} strokeWidth={1.8} />
                </div>
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {searchQuery || filterType ? t('exams.emptySearch') : t('exams.empty')}
                </p>
                <p className="max-w-sm text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {searchQuery || filterType
                    ? t('certificates.emptySearchHint')
                    : t('exams.emptyMessage')}
                </p>
                {!searchQuery && !filterType && (
                  <button
                    type="button"
                    onClick={() => openModal()}
                    className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                  >
                    <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                    {t('exams.add')}
                  </button>
                )}
              </div>
            ) : (
              <motion.div layout className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                  {filteredExams.map((exam, idx) => (
                    <ExamRow
                      key={exam.id}
                      exam={exam}
                      groupName={getGroupName(exam)}
                      courseName={getCourseName(exam)}
                      onOpenSidecar={handleOpenExamSidecar}
                      onPublish={(id) => publishExam.mutate(id)}
                      onEdit={(e) => openModal(e)}
                      onDelete={(id) => setDeleteTarget(id)}
                      isFocused={focusedIndex === idx}
                      isSelected={isSelected(exam.id)}
                      onToggleSelect={() => toggleSelection(exam.id)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* CREATE / EDIT MODAL */}
      <GlassModal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? t('exams.editTitle') : t('exams.add')}
        wide
      >
        <div className="space-y-4">
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-xs font-semibold leading-snug">
              {editingId
                ? t('exams.editLockedHint')
                : 'Imtihon ma\'lumotlarini kiriting. Nomi, fan, guruh va turi majburiy.'}
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
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
              <Icon paths={I.lock} size={14} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-xs font-semibold leading-snug text-amber-700 dark:text-amber-400">
                {t('exams.editLockedHint')}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-xl border border-black/5 bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-700 transition-colors hover:bg-neutral-200 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saveExam.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-70"
            >
              {saveExam.isPending ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </GlassModal>
    </motion.div>
  );
}

export default ExamsPage;