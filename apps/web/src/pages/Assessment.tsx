/**
 * M-EDU AssessmentPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero with animated exam icon + status chips
 *  - Stats bar (Quizzes, Published, Questions, Attempts) with CountUp
 *  - Tab switcher with animated pill (layoutId)
 *  - Quiz cards with time/pass score/question count/attempts
 *  - Question bank with difficulty tone coding
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + stagger
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { assessmentApi } from '../lib/api';

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
  hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
  exit:   { opacity: 0, x: 20, filter: 'blur(6px)', transition: { duration: 0.22 } },
};

/* ============================================================================
 * REDUCED MOTION
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ============================================================================
 * TYPES
 * ========================================================================== */

interface Quiz {
  id: string;
  title: string;
  timeLimitMin: number;
  passScore: number;
  isPublished: boolean;
  _count?: { questions?: number; attempts?: number };
}

interface Question {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  points: number;
  subject?: { id: string; name: string; code: string } | null;
}

type TabKey = 'quizzes' | 'questions';
type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',  glow: 'rgba(0,122,255,0.28)',  border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

function difficultyTone(d: string): Tone {
  const s = d?.toUpperCase() || '';
  if (s === 'EASY' || s === 'BEGINNER') return 'green';
  if (s === 'MEDIUM' || s === 'INTERMEDIATE') return 'blue';
  if (s === 'HARD' || s === 'ADVANCED') return 'orange';
  if (s === 'EXPERT' || s === 'VERY_HARD') return 'red';
  return 'slate';
}

function passScoreTone(score: number): Tone {
  if (score >= 80) return 'red';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'blue';
  return 'green';
}

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  clipboard: [
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2',
    'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
  ],
  fileCheck: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 15l2 2 4-4',
  ],
  helpCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
    'M12 17h.01',
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
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5-10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  pencil: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  barChart: [
    'M12 20V10',
    'M18 20V4',
    'M6 20v-4',
  ],
  tag: [
    'M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
    'M7 7h.01',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  graduationCap: [
    'M22 10 12 5 2 10l10 5 10-5z',
    'M6 12v5c3 3 9 3 12 0v-5',
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

function textHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const QUIZ_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red'];

function quizTone(title: string): Tone {
  return QUIZ_PALETTES[textHash(title) % QUIZ_PALETTES.length];
}

function truncateText(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trim() + '…' : str;
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

/* ============================================================================
 * SHIMMER
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
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function AssessmentSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-40 w-full" radius="2rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[68px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-14" radius="1rem" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => <Shimmer key={i} className="h-20" radius="1rem" />)}
      </div>
    </div>
  );
}

/* ============================================================================
 * STAT TILE
 * ========================================================================== */

function StatTile({
  label, value, icon, tone = 'blue',
}: { label: string; value: number; icon: string[]; tone?: Tone }) {
  const c = TONE[tone];

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
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
        <Icon paths={icon} size={18} strokeWidth={2} />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B] truncate">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * TAB SWITCHER
 * ========================================================================== */

function TabSwitcher({
  value, onChange, options,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  options: { key: TabKey; label: string; icon: string[]; count: number; tone: Tone }[];
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const c = TONE[opt.tone];

        return (
          <motion.button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            whileHover={reduced ? undefined : { scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING.snappy}
            className="relative flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold outline-none transition-colors"
            style={{
              color: active ? c.fg : '#86868B',
            }}
          >
            {active && (
              <motion.span
                layoutId="tabPill"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
                  border: `1px solid ${c.border}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-2">
              <Icon paths={opt.icon} size={13} strokeWidth={2.2} />
              {opt.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                style={{
                  background: active ? `${c.fg}25` : 'rgba(142,142,147,0.15)',
                  color: active ? c.fg : '#86868B',
                }}
              >
                {opt.count}
              </span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * QUIZ CARD
 * ========================================================================== */

function QuizCard({ quiz }: { quiz: Quiz }) {
  const tone = quizTone(quiz.title);
  const c = TONE[tone];
  const pTone = passScoreTone(quiz.passScore);
  const pc = TONE[pTone];
  const statusTone: Tone = quiz.isPublished ? 'green' : 'orange';
  const sc = TONE[statusTone];

  const questionCount = quiz._count?.questions || 0;
  const attemptCount = quiz._count?.attempts || 0;

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      className="group relative flex flex-col gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-4 transition-all hover:border-[#007AFF]/25 hover:bg-[#007AFF]/[0.02] dark:border-[#ffffff08] dark:bg-[#ffffff04]"
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
        style={{ background: c.fg, boxShadow: `0 0 8px ${c.glow}` }}
      />

      {/* Header */}
      <div className="flex items-start gap-3 pl-2">
        {/* Icon tile */}
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{
            background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg}CC 100%)`,
            boxShadow: `0 6px 16px -6px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
          />
          <Icon paths={I.fileCheck} size={20} strokeWidth={2} className="relative" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              {quiz.title}
            </h3>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
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
              {quiz.isPublished ? 'Published' : 'Draft'}
            </span>
          </div>

          {/* Meta chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* Time limit */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums"
              style={{
                background: 'rgba(0,122,255,0.08)',
                color: '#007AFF',
              }}
            >
              <Icon paths={I.clock} size={9} strokeWidth={2.5} />
              {quiz.timeLimitMin} min
            </span>

            {/* Pass score */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums"
              style={{
                background: pc.bg,
                color: pc.fg,
                border: `1px solid ${pc.border}`,
              }}
            >
              <Icon paths={I.target} size={9} strokeWidth={2.5} />
              Pass {quiz.passScore}%
            </span>

            {/* Questions */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums"
              style={{
                background: 'rgba(175,82,222,0.08)',
                color: '#AF52DE',
              }}
            >
              <Icon paths={I.helpCircle} size={9} strokeWidth={2.5} />
              {questionCount} {questionCount === 1 ? 'question' : 'questions'}
            </span>

            {/* Attempts */}
            {attemptCount > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums"
                style={{
                  background: 'rgba(52,199,89,0.08)',
                  color: '#34C759',
                }}
              >
                <Icon paths={I.users} size={9} strokeWidth={2.5} />
                {attemptCount} {attemptCount === 1 ? 'attempt' : 'attempts'}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * QUESTION CARD
 * ========================================================================== */

function QuestionCard({ question }: { question: Question }) {
  const dTone = difficultyTone(question.difficulty);
  const dc = TONE[dTone];

  return (
    <motion.div
      layout
      variants={rowVariants}
      whileHover={{ y: -2 }}
      transition={SPRING.snappy}
      className="group relative flex flex-col gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-4 transition-all hover:border-[#007AFF]/25 hover:bg-[#007AFF]/[0.02] dark:border-[#ffffff08] dark:bg-[#ffffff04]"
    >
      {/* Left accent bar */}
      <span
        aria-hidden
        className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full"
        style={{ background: dc.fg, boxShadow: `0 0 8px ${dc.glow}` }}
      />

      <div className="flex items-start gap-3 pl-2">
        {/* Difficulty icon tile */}
        <div
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{
            background: `linear-gradient(135deg, ${dc.fg} 0%, ${dc.fg}CC 100%)`,
            boxShadow: `0 4px 12px -4px ${dc.glow}, inset 0 1px 0 rgba(255,255,255,0.35)`,
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }}
          />
          <Icon paths={I.helpCircle} size={18} strokeWidth={2.2} className="relative" />
        </div>

        <div className="min-w-0 flex-1">
          {/* Question prompt */}
          <p className="text-[13.5px] font-semibold leading-relaxed tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {truncateText(question.text, 160)}
          </p>

          {/* Meta chips */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {/* Subject */}
            {question.subject && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                style={{
                  background: 'rgba(0,122,255,0.08)',
                  color: '#007AFF',
                }}
              >
                <Icon paths={I.graduationCap} size={9} strokeWidth={2.5} />
                {question.subject.code || question.subject.name}
              </span>
            )}

            {/* Type */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
              style={{
                background: 'rgba(142,142,147,0.10)',
                color: '#8E8E93',
              }}
            >
              <Icon paths={I.tag} size={9} strokeWidth={2.5} />
              {question.type?.replace('_', ' ') || 'N/A'}
            </span>

            {/* Difficulty */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider"
              style={{
                background: dc.bg,
                color: dc.fg,
                border: `1px solid ${dc.border}`,
              }}
            >
              <Icon paths={I.zap} size={9} strokeWidth={2.5} />
              {question.difficulty || 'N/A'}
            </span>

            {/* Points */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums"
              style={{
                background: 'rgba(255,149,0,0.10)',
                color: '#FF9500',
              }}
            >
              <Icon paths={I.award} size={9} strokeWidth={2.5} />
              {question.points} {question.points === 1 ? 'pt' : 'pts'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export default function AssessmentPage() {
  const queryClient = useQueryClient();
  const reduced = usePrefersReducedMotion();

  const [tab, setTab] = useState<TabKey>('quizzes');
  const [quizTitle, setQuizTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [passScore, setPassScore] = useState(70);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<{ title?: string }>({});

  /* ---------------- Data ---------------- */
  const {
    data: quizzesData, isLoading: loadingQuizzes, isError: quizError, refetch: refetchQuizzes,
  } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => assessmentApi.quizzes(),
    enabled: tab === 'quizzes',
  });

  const {
    data: questionsData, isLoading: loadingQuestions, isError: questionError, refetch: refetchQuestions,
  } = useQuery({
    queryKey: ['questions'],
    queryFn: () => assessmentApi.questions(),
    enabled: tab === 'questions',
  });

  const quizzes: Quiz[] = useMemo(
    () => (Array.isArray(quizzesData) ? quizzesData : (quizzesData as any)?.items ?? []),
    [quizzesData],
  );

  const questions: Question[] = useMemo(
    () => (Array.isArray(questionsData) ? questionsData : (questionsData as any)?.items ?? []),
    [questionsData],
  );

  /* ---------------- Derived stats ---------------- */
  const stats = useMemo(() => {
    const totalQuizzes = quizzes.length;
    const published = quizzes.filter((q) => q.isPublished).length;
    const totalQuestions = questions.length;
    const totalAttempts = quizzes.reduce((sum, q) => sum + (q._count?.attempts || 0), 0);
    return { totalQuizzes, published, totalQuestions, totalAttempts };
  }, [quizzes, questions]);

  /* ---------------- Mutations ---------------- */
  const createQuizMutation = useMutation({
    mutationFn: (data: any) => assessmentApi.createQuiz(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      setIsQuizModalOpen(false);
      setQuizTitle('');
      setTimeLimit(30);
      setPassScore(70);
      setFormErrors({});
    },
  });

  /* ---------------- Handlers ---------------- */
  const validateQuiz = useCallback(() => {
    const errors: { title?: string } = {};
    if (!quizTitle.trim()) errors.title = 'Title is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [quizTitle]);

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateQuiz()) return;
    createQuizMutation.mutate({
      title: quizTitle.trim(),
      timeLimitMin: Number(timeLimit),
      passScore: Number(passScore),
    });
  };

  const handleCloseModal = useCallback(() => {
    setIsQuizModalOpen(false);
    setQuizTitle('');
    setTimeLimit(30);
    setPassScore(70);
    setFormErrors({});
  }, []);

  /* ---------------- Loading ---------------- */
  const isLoading = (tab === 'quizzes' && loadingQuizzes) || (tab === 'questions' && loadingQuestions);

  if (isLoading && !quizzes.length && !questions.length) {
    return (
      <div className="page-container space-y-5">
        <AssessmentSkeleton />
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  const isError = (tab === 'quizzes' && quizError) || (tab === 'questions' && questionError);
  if (isError) {
    return (
      <div className="page-container space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING.smooth}
          className="flex flex-col items-center gap-4 rounded-3xl border p-10 text-center"
          style={{
            borderColor: 'rgba(255,59,48,0.2)',
            background: 'rgba(255,59,48,0.04)',
          }}
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}
          >
            <Icon paths={I.alertTriangle} size={26} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
              Failed to load assessment data
            </h3>
            <p className="mt-1 text-[13px] font-medium text-[#86868B]">
              Something went wrong. Please try again.
            </p>
          </div>
          <motion.button
            type="button"
            onClick={() => {
              if (tab === 'quizzes') void refetchQuizzes();
              else void refetchQuestions();
            }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING.snappy}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
              boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
            }}
          >
            <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
            Try again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  /* ---------------- Main ---------------- */
  const tabOptions = [
    { key: 'quizzes' as TabKey,   label: 'Quizzes & Tests', icon: I.fileCheck,  count: quizzes.length,   tone: 'blue'   as Tone },
    { key: 'questions' as TabKey, label: 'Question Bank',    icon: I.helpCircle, count: questions.length, tone: 'purple' as Tone },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
      {/* HERO */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            background: 'linear-gradient(145deg, rgba(255,255,255,0.85), rgba(255,255,255,0.65))',
            backdropFilter: 'blur(30px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 60px -20px rgba(15,23,42,0.14)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)' }}
          />

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            {/* Animated icon */}
            <div className="relative" style={{ width: 88, height: 88 }}>
              <motion.div
                className="absolute inset-[-4px] rounded-full p-[3px]"
                animate={reduced ? {} : { rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF9500, #34C759, #007AFF)',
                  }}
                  aria-hidden
                />
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={SPRING.smooth}
                className="relative flex h-full w-full items-center justify-center rounded-full text-white ring-2 ring-white/70 dark:ring-black/50"
                style={{
                  background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                  boxShadow: '0 12px 32px -8px rgba(0,122,255,0.5), inset 0 2px 0 rgba(255,255,255,0.4)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
                />
                <Icon paths={I.fileCheck} size={34} strokeWidth={2} className="relative" />
              </motion.div>
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
                  {stats.published} Published
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00000008] bg-[#00000004] px-2.5 py-1 text-[11px] font-semibold text-[#86868B] dark:border-[#ffffff10] dark:bg-[#ffffff06]">
                  <Icon paths={I.layers} size={10} strokeWidth={2.5} />
                  {stats.totalQuizzes} Quizzes
                </span>
                {stats.totalQuestions > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      background: TONE.purple.bg,
                      color: TONE.purple.fg,
                      border: `1px solid ${TONE.purple.border}`,
                    }}
                  >
                    <Icon paths={I.helpCircle} size={10} strokeWidth={2.5} />
                    {stats.totalQuestions} Questions
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                Testing Engine
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                Create quizzes, manage the question bank, and track attempts
              </p>
            </div>

            {/* Actions */}
            {tab === 'quizzes' && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <button
                    type="button"
                    onClick={() => setIsQuizModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none"
                    style={{
                      background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                      boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                    }}
                  >
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    Create Quiz
                  </button>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* STATS */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total Quizzes" value={stats.totalQuizzes} icon={I.fileCheck} tone="blue" />
        <StatTile label="Published" value={stats.published} icon={I.checkCircle} tone="green" />
        <StatTile label="Question Bank" value={stats.totalQuestions} icon={I.helpCircle} tone="purple" />
        <StatTile label="Total Attempts" value={stats.totalAttempts} icon={I.barChart} tone="orange" />
      </motion.div>

      {/* TAB SWITCHER */}
      <motion.div variants={cardVariants}>
        <TabSwitcher
          value={tab}
          onChange={setTab}
          options={tabOptions}
        />
      </motion.div>

      {/* CONTENT */}
      <motion.div variants={cardVariants}>
        <div
          className="overflow-hidden rounded-3xl border"
          style={{
            borderColor: 'rgba(255,255,255,0.5)',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(30px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 20px 60px -20px rgba(15,23,42,0.14)',
          }}
        >
          <div className="flex items-center gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{
                background: tab === 'quizzes' ? TONE.blue.bg : TONE.purple.bg,
                color: tab === 'quizzes' ? TONE.blue.fg : TONE.purple.fg,
              }}
            >
              <Icon paths={tab === 'quizzes' ? I.fileCheck : I.helpCircle} size={15} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {tab === 'quizzes' ? 'Quizzes & Tests' : 'Question Bank'}
              </h2>
              <p className="text-[11px] font-medium text-[#86868B]">
                {tab === 'quizzes'
                  ? `${quizzes.length} ${quizzes.length === 1 ? 'quiz' : 'quizzes'}`
                  : `${questions.length} ${questions.length === 1 ? 'question' : 'questions'}`}
              </p>
            </div>
          </div>

          <div className="p-3">
            <AnimatePresence mode="wait" initial={false}>
              {tab === 'quizzes' ? (
                quizzes.length === 0 ? (
                  <motion.div
                    key="empty-quizzes"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SPRING.smooth}
                    className="flex flex-col items-center gap-3 px-6 py-12 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#007AFF]/10 text-[#007AFF]">
                      <Icon paths={I.fileCheck} size={26} strokeWidth={2} />
                    </div>
                    <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      No quizzes yet
                    </p>
                    <p className="max-w-sm text-[12px] font-medium text-[#86868B]">
                      Create your first quiz to start assessing students
                    </p>
                    <motion.button
                      type="button"
                      onClick={() => setIsQuizModalOpen(true)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING.snappy}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold text-white outline-none"
                      style={{
                        background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                        boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
                      }}
                    >
                      <Icon paths={I.plus} size={13} strokeWidth={2.5} />
                      Create Quiz
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="quiz-list"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SPRING.smooth}
                    className="space-y-2"
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {quizzes.map((q) => (
                        <QuizCard key={q.id} quiz={q} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )
              ) : (
                questions.length === 0 ? (
                  <motion.div
                    key="empty-questions"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SPRING.smooth}
                    className="flex flex-col items-center gap-3 px-6 py-12 text-center"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#AF52DE]/10 text-[#AF52DE]">
                      <Icon paths={I.helpCircle} size={26} strokeWidth={2} />
                    </div>
                    <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                      Question bank is empty
                    </p>
                    <p className="max-w-sm text-[12px] font-medium text-[#86868B]">
                      Questions will appear here once they're added
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="question-list"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={SPRING.smooth}
                    className="space-y-2"
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {questions.map((q) => (
                        <QuestionCard key={q.id} question={q} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* CREATE QUIZ MODAL */}
      <AnimatePresence>
        {isQuizModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] grid place-items-center p-4"
            style={{
              background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={SPRING.smooth}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border p-6"
              style={{
                borderColor: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(40px) saturate(1.8)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 32px 80px -20px rgba(15,23,42,0.35)',
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Create quiz"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)' }}
              />

              {/* Header hint */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
                  <Icon paths={I.sparkles} size={18} strokeWidth={2} />
                </div>
                <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Create a new quiz. You can add questions and set passing rules after saving.
                </p>
              </div>

              <form onSubmit={handleCreateQuiz} className="mt-5 space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    Quiz Title <span className="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quizTitle}
                    onChange={(e) => {
                      setQuizTitle(e.target.value);
                      setFormErrors({});
                    }}
                    placeholder="e.g. Algebra Mid-Term Quiz"
                    aria-invalid={Boolean(formErrors.title)}
                    className="w-full rounded-xl border bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium text-[#1D1D1F] outline-none transition-all placeholder:text-[#86868B] focus:border-[#007AFF]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                    style={{
                      borderColor: formErrors.title ? '#FF3B30' : 'rgba(0,0,0,0.10)',
                    }}
                  />
                  {formErrors.title && (
                    <p className="mt-1 text-[11.5px] font-medium text-[#FF3B30]">{formErrors.title}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                      Time Limit (min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#00000010] bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium tabular-nums text-[#1D1D1F] outline-none transition-all focus:border-[#007AFF]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:border-[#ffffff10] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                      Pass Score (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={passScore}
                      onChange={(e) => setPassScore(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#00000010] bg-white/80 px-3.5 py-2.5 text-[13.5px] font-medium tabular-nums text-[#1D1D1F] outline-none transition-all focus:border-[#007AFF]/40 focus:shadow-[0_0_0_4px_rgba(0,122,255,0.1)] dark:border-[#ffffff10] dark:bg-[#1c1c1e80] dark:text-[#F5F5F7]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <motion.button
                    type="button"
                    onClick={handleCloseModal}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING.snappy}
                    disabled={createQuizMutation.isPending}
                    className="rounded-xl border border-[#00000010] bg-[#00000004] px-4 py-2.5 text-[13px] font-semibold text-[#1D1D1F] outline-none transition-colors hover:bg-[#00000008] disabled:opacity-50 dark:border-[#ffffff10] dark:bg-[#ffffff06] dark:text-[#F5F5F7]"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING.snappy}
                    disabled={createQuizMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none disabled:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                      boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                    }}
                  >
                    {createQuizMutation.isPending ? (
                      <>
                        <motion.span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        Create Quiz
                      </>
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}