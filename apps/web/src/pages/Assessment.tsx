/**
 * M-EDU AssessmentPage — Liquid Glass Edition
 *
 *  - Multi-layer liquid glass panels (specular edge + chromatic hint + inner ring)
 *  - Calm motion (no blur, no glow, no bounce)
 *  - Consolidated KPI strip (was 4 separate glow tiles)
 *  - Refined pill tabs — neutral glass, no scale-bounce
 *  - Cleaner quiz / question rows — no gradient tiles, no glow accents
 *  - Preserves 100% API contracts, TanStack Query, i18n keys
 */

import React, {
  useState, useCallback, useMemo, useEffect, useRef, useSyncExternalStore,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { assessmentApi } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

/* ═══════════════════════════════════════════════════════════════════
 * REDUCED MOTION — singleton
 * ═══════════════════════════════════════════════════════════════════ */

type RMListener = () => void;
const rmSubs = new Set<RMListener>();
let rmMq: MediaQueryList | null = null;
let rmValue = false;

function getRMSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  if (!rmMq) {
    if (typeof window.matchMedia !== 'function') return false;
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmValue = rmMq.matches;
  }
  return rmValue;
}

function subscribeRM(cb: RMListener): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  if (!rmMq) rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => {
    rmValue = e.matches;
    for (const s of rmSubs) s();
  };
  rmSubs.add(cb);
  if (rmSubs.size === 1) rmMq.addEventListener('change', handler);
  return () => {
    rmSubs.delete(cb);
    if (rmSubs.size === 0 && rmMq) rmMq.removeEventListener('change', handler);
  };
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeRM, getRMSnapshot, () => false);
}

/* ═══════════════════════════════════════════════════════════════════
 * MOTION TOKENS — sokin
 * ═══════════════════════════════════════════════════════════════════ */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPRING_GLASS = { type: 'spring' as const, stiffness: 320, damping: 34, mass: 0.85 };

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/* ═══════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
 * TONE PALETTE — no glow
 * ═══════════════════════════════════════════════════════════════════ */

const TONE: Record<Tone, { fg: string; bg: string; border: string; dot: string }> = {
  blue:   { fg: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/[0.08]',   border: 'border-blue-500/15',   dot: 'bg-blue-500' },
  green:  { fg: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/[0.08]', border: 'border-emerald-500/15', dot: 'bg-emerald-500' },
  orange: { fg: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/[0.08]',   border: 'border-amber-500/15',   dot: 'bg-amber-500' },
  red:    { fg: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-500/[0.08]',   border: 'border-rose-500/15',   dot: 'bg-rose-500' },
  purple: { fg: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/[0.08]', border: 'border-indigo-500/15', dot: 'bg-indigo-500' },
  slate:  { fg: 'text-neutral-500 dark:text-neutral-400', bg: 'bg-neutral-500/[0.08]', border: 'border-neutral-500/15', dot: 'bg-neutral-400' },
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

/* ═══════════════════════════════════════════════════════════════════
 * ICONS — SF Symbols proportions
 * ═══════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.75;

const I = {
  clipboard: ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z'],
  fileCheck: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6', 'M9 15l2 2 4-4'],
  helpCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3', 'M12 17h.01'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  layers: ['M12 2 2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  award: ['M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M8.2 13.9 7 22l5-3 5 3-1.2-8.1'],
  barChart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
  tag: ['M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z', 'M7 7h.01'],
  sparkles: ['M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M20.49 15a9 9 0 0 1-14.85 3.36L1 14'],
  alertTriangle: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z', 'M12 9v4', 'M12 17h.01'],
  graduationCap: ['M22 10 12 5 2 10l10 5 10-5z', 'M6 12v5c3 3 9 3 12 0v-5'],
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

/* ═══════════════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
 * COUNT UP — refined easing
 * ═══════════════════════════════════════════════════════════════════ */

function CountUp({ value, duration = 0.9, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { setN(value); return; }
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
  }, [value, duration, reduced]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString()}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════════
 * LIQUID GLASS PANEL
 * ═══════════════════════════════════════════════════════════════════ */

function GlassPanel({
  children, className = '',
}: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[20px] ${className}`}
      style={{
        boxShadow:
          '0 24px 60px -32px rgba(0,0,0,0.16), 0 4px 12px -6px rgba(0,0,0,0.05)',
      }}
    >
      <div className="absolute inset-0 bg-white/72 backdrop-blur-[40px] backdrop-saturate-150 dark:bg-neutral-950/60" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/20" />
      <div className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-black/[0.05] dark:ring-white/[0.06]" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SHIMMER — soft
 * ═══════════════════════════════════════════════════════════════════ */

function Shimmer({ className = '', radius = '12px' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-black/[0.04] dark:bg-white/[0.04] ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/[0.06]"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function AssessmentSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-32 w-full" radius="20px" />
      <Shimmer className="h-[88px]" radius="20px" />
      <Shimmer className="h-12 w-56" radius="12px" />
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-20" radius="16px" />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * HERO — simplified, no glowing icon tile
 * ═══════════════════════════════════════════════════════════════════ */

function Hero({
  publishedCount, quizzesCount, questionsCount,
  onCreate, showCreate,
}: {
  publishedCount: number;
  quizzesCount: number;
  questionsCount: number;
  onCreate: () => void;
  showCreate: boolean;
}) {
  const { t } = useI18n();
  return (
    <GlassPanel>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        {/* Icon tile — small, mono, no glow */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/[0.08] text-indigo-600 dark:text-indigo-400">
          <Icon paths={I.fileCheck} size={18} strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">
              <span className="h-1 w-1 rounded-full bg-emerald-500" aria-hidden />
              {t('assessment.badge.published', { count: publishedCount })}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-black/[0.035] px-2 py-0.5 text-[10.5px] font-medium text-black/55 dark:bg-white/[0.05] dark:text-white/55">
              {t('assessment.badge.quizzes', { count: quizzesCount })}
            </span>
            {questionsCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-indigo-700 dark:text-indigo-300">
                {t('assessment.badge.questions', { count: questionsCount })}
              </span>
            )}
          </div>

          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-black/90 dark:text-white/90 sm:text-[28px]">
            {t('assessment.heroTitle')}
          </h1>
          <p className="mt-1 text-[13px] text-black/50 dark:text-white/50">
            {t('assessment.heroSubtitle')}
          </p>
        </div>

        {showCreate && (
          <motion.button
            type="button"
            onClick={onCreate}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            transition={SPRING_GLASS}
            className="inline-flex items-center gap-1.5 self-start rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
          >
            <Icon paths={I.plus} size={14} strokeWidth={2.4} />
            {t('assessment.create')}
          </motion.button>
        )}
      </div>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * KPI STRIP — single glass, hairline dividers
 * ═══════════════════════════════════════════════════════════════════ */

function KpiCell({
  label, value, icon,
}: { label: string; value: number; icon: string[] }) {
  return (
    <div className="relative flex items-start gap-3 p-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/[0.03] text-black/45 dark:bg-white/[0.04] dark:text-white/45">
        <Icon paths={icon} size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-black/40 dark:text-white/40">
          {label}
        </div>
        <div className="mt-0.5 text-[20px] font-semibold leading-none tracking-tight text-black/90 dark:text-white/90">
          <CountUp value={value} />
        </div>
      </div>
    </div>
  );
}

function KpiStrip({
  items,
}: { items: { label: string; value: number; icon: string[] }[] }) {
  return (
    <GlassPanel>
      <div className="grid grid-cols-2 sm:grid-cols-4">
        {items.map((item, i) => (
          <div key={i} className="relative">
            {i > 0 && (
              <span
                className="pointer-events-none absolute left-0 top-4 bottom-4 hidden w-px bg-black/[0.05] sm:block dark:bg-white/[0.05]"
                aria-hidden
              />
            )}
            <KpiCell {...item} />
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * TAB SWITCHER — neutral glass pill, no bounce
 * ═══════════════════════════════════════════════════════════════════ */

function TabSwitcher({
  value, onChange, options,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
  options: { key: TabKey; label: string; icon: string[]; count: number; tone: Tone }[];
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className="inline-flex flex-wrap gap-0.5 rounded-xl border border-black/[0.06] bg-black/[0.02] p-1 dark:border-white/[0.06] dark:bg-white/[0.02]"
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.key;
        const tone = TONE[opt.tone];

        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.key)}
            className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
              active
                ? 'text-black/90 dark:text-white/90'
                : 'text-black/55 hover:text-black/75 dark:text-white/55 dark:hover:text-white/75'
            }`}
          >
            {active && !reduced && (
              <motion.span
                layoutId="tabPill"
                className="absolute inset-0 rounded-lg bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(0,0,0,0.06)] dark:bg-white/[0.08] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                transition={SPRING_GLASS}
              />
            )}
            {active && reduced && (
              <span className="absolute inset-0 rounded-lg bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(0,0,0,0.06)] dark:bg-white/[0.08]" />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon paths={opt.icon} size={12} strokeWidth={2.2} />
              {opt.label}
              <span
                className={`rounded px-1 py-px text-[10px] font-medium tabular-nums ${
                  active ? tone.fg : 'text-black/40 dark:text-white/40'
                }`}
              >
                {opt.count}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * CHIP
 * ═══════════════════════════════════════════════════════════════════ */

function Chip({
  icon, children, tone = 'slate',
}: { icon?: string[]; children: React.ReactNode; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium ${t.bg} ${t.fg} ${t.border}`}>
      {icon && <Icon paths={icon} size={9} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * QUIZ ROW — clean, no gradient tile
 * ═══════════════════════════════════════════════════════════════════ */

function QuizRow({ quiz }: { quiz: Quiz }) {
  const { t } = useI18n();
  const tone = quizTone(quiz.title);
  const tc = TONE[tone];
  const pTone = passScoreTone(quiz.passScore);
  const questionCount = quiz._count?.questions || 0;
  const attemptCount = quiz._count?.attempts || 0;

  return (
    <div className="group relative px-5 py-4 transition-colors hover:bg-black/[0.015] sm:px-6 dark:hover:bg-white/[0.02]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tc.dot}`} aria-hidden />
            <h3 className="truncate text-[14px] font-semibold tracking-tight text-black/90 dark:text-white/90">
              {quiz.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                quiz.isPublished
                  ? 'bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/[0.08] text-amber-700 dark:text-amber-300'
              }`}
            >
              {quiz.isPublished ? t('assessment.status.published') : t('assessment.status.draft')}
            </span>
          </div>

          {/* Meta chips */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip icon={I.clock} tone="blue">
              {t('assessment.minutes', { count: quiz.timeLimitMin })}
            </Chip>
            <Chip icon={I.target} tone={pTone}>
              {t('assessment.passScore', { score: quiz.passScore })}
            </Chip>
            <Chip icon={I.helpCircle} tone="purple">
              {t(questionCount === 1 ? 'assessment.questionCountOne' : 'assessment.questionCountMany', { count: questionCount })}
            </Chip>
            {attemptCount > 0 && (
              <Chip icon={I.users} tone="green">
                {t(attemptCount === 1 ? 'assessment.attemptCountOne' : 'assessment.attemptCountMany', { count: attemptCount })}
              </Chip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * QUESTION ROW
 * ═══════════════════════════════════════════════════════════════════ */

function QuestionRow({ question }: { question: Question }) {
  const { t } = useI18n();
  const dTone = difficultyTone(question.difficulty);

  const typeRaw = question.type || '';
  const typeKey = `assessment.type.${typeRaw.toUpperCase()}`;
  const typeTranslated = t(typeKey);
  const typeLabel = typeRaw
    ? (typeTranslated === typeKey ? typeRaw.replace('_', ' ') : typeTranslated)
    : t('assessment.na');

  const diffRaw = question.difficulty || '';
  const diffKey = `assessment.difficulty.${diffRaw.toUpperCase()}`;
  const diffTranslated = t(diffKey);
  const difficultyLabel = diffRaw
    ? (diffTranslated === diffKey ? diffRaw : diffTranslated)
    : t('assessment.na');

  return (
    <div className="group relative px-5 py-4 transition-colors hover:bg-black/[0.015] sm:px-6 dark:hover:bg-white/[0.02]">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE[dTone].dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium leading-relaxed text-black/90 dark:text-white/90">
            {truncateText(question.text, 180)}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {question.subject && (
              <Chip icon={I.graduationCap} tone="blue">
                {question.subject.code || question.subject.name}
              </Chip>
            )}
            <Chip icon={I.tag}>{typeLabel}</Chip>
            <Chip icon={I.zap} tone={dTone}>{difficultyLabel}</Chip>
            <Chip icon={I.award} tone="orange">
              {t(question.points === 1 ? 'assessment.pointsOne' : 'assessment.pointsMany', { count: question.points })}
            </Chip>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * EMPTY STATE
 * ═══════════════════════════════════════════════════════════════════ */

function EmptyState({
  icon, title, hint, tone, action,
}: {
  icon: string[]; title: string; hint: string; tone: Tone;
  action?: { label: string; onClick: () => void };
}) {
  const t = TONE[tone];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center gap-2 px-6 py-14 text-center"
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.bg} ${t.fg}`}>
        <Icon paths={icon} size={18} strokeWidth={2} />
      </div>
      <p className="mt-1 text-[14px] font-medium text-black/85 dark:text-white/85">{title}</p>
      <p className="max-w-sm text-[12.5px] text-black/50 dark:text-white/50">{hint}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        >
          <Icon paths={I.plus} size={13} strokeWidth={2.4} />
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN PAGE
 * ═══════════════════════════════════════════════════════════════════ */

export default function AssessmentPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const reduced = useReducedMotion();

  const [tab, setTab] = useState<TabKey>('quizzes');
  const [quizTitle, setQuizTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [passScore, setPassScore] = useState(70);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<{ title?: string }>({});

  /* ── Data ── */
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

  /* ── Stats ── */
  const stats = useMemo(() => {
    const totalQuizzes = quizzes.length;
    const published = quizzes.filter((q) => q.isPublished).length;
    const totalQuestions = questions.length;
    const totalAttempts = quizzes.reduce((sum, q) => sum + (q._count?.attempts || 0), 0);
    return { totalQuizzes, published, totalQuestions, totalAttempts };
  }, [quizzes, questions]);

  /* ── Mutation ── */
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

  /* ── Handlers ── */
  const validateQuiz = useCallback(() => {
    const errors: { title?: string } = {};
    if (!quizTitle.trim()) errors.title = t('assessment.validation.titleRequired');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [quizTitle, t]);

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

  /* ── Loading ── */
  const isLoading = (tab === 'quizzes' && loadingQuizzes) || (tab === 'questions' && loadingQuestions);
  if (isLoading && !quizzes.length && !questions.length) {
    return (
      <div className="page-container space-y-5">
        <AssessmentSkeleton />
      </div>
    );
  }

  /* ── Error ── */
  const isError = (tab === 'quizzes' && quizError) || (tab === 'questions' && questionError);
  if (isError) {
    return (
      <div className="page-container">
        <GlassPanel>
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/[0.08] text-rose-600 dark:text-rose-400">
              <Icon paths={I.alertTriangle} size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-black/90 dark:text-white/90">
                {t('assessment.loadErrorTitle')}
              </h3>
              <p className="mt-1 text-[12.5px] text-black/50 dark:text-white/50">
                {t('assessment.loadErrorHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => (tab === 'quizzes' ? void refetchQuizzes() : void refetchQuestions())}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Icon paths={I.refresh} size={13} strokeWidth={2.4} />
              {t('common.retry')}
            </button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  /* ── Tabs ── */
  const tabOptions = [
    { key: 'quizzes' as TabKey,   label: t('assessment.tab.quizzes'),   icon: I.fileCheck,  count: quizzes.length,   tone: 'blue'   as Tone },
    { key: 'questions' as TabKey, label: t('assessment.tab.questions'), icon: I.helpCircle, count: questions.length, tone: 'purple' as Tone },
  ];

  /* ── Render ── */
  return (
    <motion.div
      variants={containerVariants}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      className="page-container space-y-5"
    >
      {/* HERO */}
      <motion.div variants={itemVariants}>
        <Hero
          publishedCount={stats.published}
          quizzesCount={stats.totalQuizzes}
          questionsCount={stats.totalQuestions}
          onCreate={() => setIsQuizModalOpen(true)}
          showCreate={tab === 'quizzes'}
        />
      </motion.div>

      {/* KPI STRIP */}
      <motion.div variants={itemVariants}>
        <KpiStrip
          items={[
            { label: t('assessment.stat.totalQuizzes'),   value: stats.totalQuizzes,    icon: I.fileCheck },
            { label: t('assessment.stat.published'),      value: stats.published,       icon: I.checkCircle },
            { label: t('assessment.stat.questionBank'),   value: stats.totalQuestions,  icon: I.helpCircle },
            { label: t('assessment.stat.totalAttempts'),  value: stats.totalAttempts,   icon: I.barChart },
          ]}
        />
      </motion.div>

      {/* TAB SWITCHER */}
      <motion.div variants={itemVariants}>
        <TabSwitcher value={tab} onChange={setTab} options={tabOptions} />
      </motion.div>

      {/* CONTENT */}
      <motion.div variants={itemVariants}>
        <GlassPanel>
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-black/[0.05] px-5 py-3.5 dark:border-white/[0.05]">
            <div className={`flex h-6 w-6 items-center justify-center rounded-md ${
              tab === 'quizzes'
                ? 'bg-blue-500/[0.08] text-blue-600 dark:text-blue-400'
                : 'bg-indigo-500/[0.08] text-indigo-600 dark:text-indigo-400'
            }`}>
              <Icon paths={tab === 'quizzes' ? I.fileCheck : I.helpCircle} size={12} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-semibold tracking-tight text-black/85 dark:text-white/85">
                {tab === 'quizzes' ? t('assessment.tab.quizzes') : t('assessment.tab.questions')}
              </h2>
              <p className="text-[11px] text-black/45 dark:text-white/45">
                {tab === 'quizzes'
                  ? t(quizzes.length === 1 ? 'assessment.quizCountOne' : 'assessment.quizCountMany', { count: quizzes.length })
                  : t(questions.length === 1 ? 'assessment.questionCountOne' : 'assessment.questionCountMany', { count: questions.length })}
              </p>
            </div>
          </div>

          {/* List */}
          <div>
            <AnimatePresence mode="wait" initial={false}>
              {tab === 'quizzes' ? (
                quizzes.length === 0 ? (
                  <EmptyState
                    key="empty-quizzes"
                    icon={I.fileCheck}
                    title={t('assessment.emptyQuizzesTitle')}
                    hint={t('assessment.emptyQuizzesHint')}
                    tone="blue"
                    action={{ label: t('assessment.create'), onClick: () => setIsQuizModalOpen(true) }}
                  />
                ) : (
                  <motion.ul
                    key="quiz-list"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="divide-y divide-black/[0.05] dark:divide-white/[0.05]"
                  >
                    {quizzes.map((q) => (
                      <li key={q.id}><QuizRow quiz={q} /></li>
                    ))}
                  </motion.ul>
                )
              ) : questions.length === 0 ? (
                <EmptyState
                  key="empty-questions"
                  icon={I.helpCircle}
                  title={t('assessment.emptyQuestionsTitle')}
                  hint={t('assessment.emptyQuestionsHint')}
                  tone="purple"
                />
              ) : (
                <motion.ul
                  key="question-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="divide-y divide-black/[0.05] dark:divide-white/[0.05]"
                >
                  {questions.map((q) => (
                    <li key={q.id}><QuestionRow question={q} /></li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </GlassPanel>
      </motion.div>

      {/* CREATE QUIZ MODAL */}
      <AnimatePresence>
        {isQuizModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] grid place-items-center p-4"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            onClick={handleCloseModal}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={SPRING_GLASS}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={t('assessment.createAria')}
              className="relative w-full max-w-md overflow-hidden rounded-[20px]"
              style={{
                boxShadow: '0 24px 60px -24px rgba(0,0,0,0.35)',
              }}
            >
              <div className="absolute inset-0 bg-white/95 backdrop-blur-[40px] backdrop-saturate-150 dark:bg-neutral-950/92" />
              <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/20" />
              <div className="pointer-events-none absolute inset-0 rounded-[20px] ring-1 ring-inset ring-black/[0.06] dark:ring-white/[0.08]" />

              <div className="relative z-10 p-5">
                {/* Hint */}
                <div className="flex items-start gap-2.5 rounded-xl bg-indigo-500/[0.06] px-3 py-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/[0.12] text-indigo-600 dark:text-indigo-400">
                    <Icon paths={I.sparkles} size={12} strokeWidth={2.4} />
                  </div>
                  <p className="text-[11.5px] leading-snug text-black/70 dark:text-white/70">
                    {t('assessment.createHint')}
                  </p>
                </div>

                <form onSubmit={handleCreateQuiz} className="mt-5 space-y-4" noValidate>
                  <div>
                    <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-black/50 dark:text-white/50">
                      {t('assessment.form.title')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={quizTitle}
                      onChange={(e) => { setQuizTitle(e.target.value); setFormErrors({}); }}
                      placeholder={t('assessment.form.titlePlaceholder')}
                      aria-invalid={Boolean(formErrors.title)}
                      className="w-full rounded-lg border border-black/[0.08] bg-white/60 px-3 py-2 text-[13px] text-black/90 outline-none transition-all placeholder:text-black/35 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/35"
                      style={formErrors.title ? { borderColor: 'rgba(244,63,94,0.6)' } : undefined}
                    />
                    {formErrors.title && (
                      <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{formErrors.title}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-black/50 dark:text-white/50">
                        {t('assessment.form.timeLimit')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(Number(e.target.value))}
                        className="w-full rounded-lg border border-black/[0.08] bg-white/60 px-3 py-2 text-[13px] tabular-nums text-black/90 outline-none transition-all focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10.5px] font-medium uppercase tracking-[0.08em] text-black/50 dark:text-white/50">
                        {t('assessment.form.passScore')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={passScore}
                        onChange={(e) => setPassScore(Number(e.target.value))}
                        className="w-full rounded-lg border border-black/[0.08] bg-white/60 px-3 py-2 text-[13px] tabular-nums text-black/90 outline-none transition-all focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/15 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/90"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      disabled={createQuizMutation.isPending}
                      className="rounded-lg border border-black/[0.08] bg-white/40 px-3.5 py-2 text-[12.5px] font-medium text-black/75 transition-colors hover:bg-white/70 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white/75 dark:hover:bg-white/[0.06]"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={createQuizMutation.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {createQuizMutation.isPending ? (
                        <>
                          <motion.span
                            className="inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                          {t('common.saving')}
                        </>
                      ) : (
                        <>
                          <Icon paths={I.plus} size={12} strokeWidth={2.4} />
                          {t('assessment.create')}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}