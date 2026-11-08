/**
 * M-EDU Assessment Page
 * Quizzes, tests, question bank, and student grading evaluation.
 */

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type FormEvent,
  type SVGProps,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { assessmentApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { openSidecar } from '@/stores/ui.store';

/* ============================================================================
 * MOTION TOKENS ( Physics)
 * ========================================================================== */

const SPRING_PHYSICS = {
  snappy: { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.9 },
  gentle: { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================== */

export interface Quiz {
  id: string;
  title: string;
  timeLimitMin: number;
  passScore: number;
  isPublished: boolean;
  _count?: { questions?: number; attempts?: number };
}

export interface Question {
  id: string;
  text: string;
  type: string;
  difficulty: string;
  points: number;
  subject?: { id: string; name: string; code: string } | null;
}

export type TabKey = 'quizzes' | 'questions';
export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

/* ============================================================================
 * PURE EXPORTED HELPERS (Zero Dependencies, Fully Testable)
 * ========================================================================== */

export const TONE_STYLES: Record<Tone, { fg: string; bg: string; border: string; glow: string; dot: string }> = {
  blue: {
    fg: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/[0.08] dark:bg-blue-500/[0.14]',
    border: 'border-blue-500/25 dark:border-blue-400/30',
    glow: 'rgba(59,130,246,0.3)',
    dot: 'bg-blue-500',
  },
  green: {
    fg: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14]',
    border: 'border-emerald-500/25 dark:border-emerald-400/30',
    glow: 'rgba(16,185,129,0.3)',
    dot: 'bg-emerald-500',
  },
  orange: {
    fg: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/[0.08] dark:bg-amber-500/[0.14]',
    border: 'border-amber-500/25 dark:border-amber-400/30',
    glow: 'rgba(245,158,11,0.3)',
    dot: 'bg-amber-500',
  },
  red: {
    fg: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/[0.08] dark:bg-rose-500/[0.14]',
    border: 'border-rose-500/25 dark:border-rose-400/30',
    glow: 'rgba(244,63,94,0.3)',
    dot: 'bg-rose-500',
  },
  purple: {
    fg: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/[0.08] dark:bg-indigo-500/[0.14]',
    border: 'border-indigo-500/25 dark:border-indigo-400/30',
    glow: 'rgba(99,102,241,0.3)',
    dot: 'bg-indigo-500',
  },
  slate: {
    fg: 'text-neutral-600 dark:text-neutral-400',
    bg: 'bg-neutral-500/[0.08] dark:bg-neutral-500/[0.14]',
    border: 'border-neutral-500/25 dark:border-neutral-400/30',
    glow: 'rgba(115,115,115,0.2)',
    dot: 'bg-neutral-400',
  },
};

export function difficultyTone(d: string | null | undefined): Tone {
  const s = (d || '').toUpperCase();
  if (s === 'EASY' || s === 'BEGINNER') return 'green';
  if (s === 'MEDIUM' || s === 'INTERMEDIATE') return 'blue';
  if (s === 'HARD' || s === 'ADVANCED') return 'orange';
  if (s === 'EXPERT' || s === 'VERY_HARD') return 'red';
  return 'slate';
}

export function passScoreTone(score: number): Tone {
  if (score >= 80) return 'red';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'blue';
  return 'green';
}

export function textHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const QUIZ_PALETTES: Tone[] = ['blue', 'purple', 'green', 'orange', 'red'];
export function quizTone(title: string): Tone {
  return QUIZ_PALETTES[textHash(title) % QUIZ_PALETTES.length];
}

export function truncateText(str: string | null | undefined, max = 160): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trim() + '…' : str;
}

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const ICONS = {
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
  plus: ['M12 5v14', 'M5 12h14'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  award: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  barChart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
  tag: [
    'M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z',
    'M7 7h.01',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  graduationCap: [
    'M22 10 12 5 2 10l10 5 10-5z',
    'M6 12v5c3 3 9 3 12 0v-5',
  ],
  search: [
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ],
  eye: [
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = 1.8,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
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
 * AURORA MESH BACKGROUND (Atmospheric Canvas)
 * ========================================================================== */

function AuroraMesh() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-indigo-500/12 via-purple-500/8 to-transparent blur-[120px] dark:from-indigo-600/16 dark:via-purple-600/10" />
      <div className="absolute -right-[10%] top-[25%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-blue-500/12 via-teal-500/8 to-transparent blur-[120px] dark:from-blue-600/16 dark:via-teal-600/10" />
      <div className="absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-violet-500/10 via-pink-500/6 to-transparent blur-[110px] dark:from-violet-600/14" />
    </div>
  );
}

/* ============================================================================
 * COUNT UP COMPONENT
 * ========================================================================== */

function CountUp({
  value,
  duration = 0.85,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return (
    <span className="tabular-nums font-semibold">
      {Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function AssessmentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-36 w-full rounded-3xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-12 w-64 rounded-xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-20 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export default function AssessmentPage() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const { playTick, playPop, playSuccess } = usePremiumSound();

  const [tab, setTab] = useState<TabKey>('quizzes');
  const [filterPublishedOnly, setFilterPublishedOnly] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Form State
  const [quizTitle, setQuizTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [passScore, setPassScore] = useState(70);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<{ title?: string }>({});

  /* ── Queries ── */
  const {
    data: quizzesData,
    isLoading: loadingQuizzes,
    isError: quizError,
    refetch: refetchQuizzes,
  } = useQuery({
    queryKey: ['quizzes'],
    queryFn: () => assessmentApi.quizzes(),
    enabled: tab === 'quizzes',
  });

  const {
    data: questionsData,
    isLoading: loadingQuestions,
    isError: questionError,
    refetch: refetchQuestions,
  } = useQuery({
    queryKey: ['questions'],
    queryFn: () => assessmentApi.questions(),
    enabled: tab === 'questions',
  });

  const quizzes: Quiz[] = useMemo(
    () => (Array.isArray(quizzesData) ? quizzesData : (quizzesData as { items?: unknown[] })?.items ?? []),
    [quizzesData]
  );

  const questions: Question[] = useMemo(
    () => (Array.isArray(questionsData) ? questionsData : (questionsData as { items?: unknown[] })?.items ?? []),
    [questionsData]
  );

  /* ── Filtered Collections ── */
  const filteredQuizzes = useMemo(() => {
    let list = quizzes;
    if (filterPublishedOnly !== null) {
      list = list.filter((q) => q.isPublished === filterPublishedOnly);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((item) => item.title.toLowerCase().includes(q));
    }
    return list;
  }, [quizzes, filterPublishedOnly, searchQuery]);

  const filteredQuestions = useMemo(() => {
    let list = questions;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.text.toLowerCase().includes(q) ||
          item.subject?.name?.toLowerCase().includes(q) ||
          item.subject?.code?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [questions, searchQuery]);

  /* ── Aggregated Stats ── */
  const stats = useMemo(() => {
    const totalQuizzes = quizzes.length;
    const published = quizzes.filter((q) => q.isPublished).length;
    const drafts = totalQuizzes - published;
    const totalQuestions = questions.length;
    const totalAttempts = quizzes.reduce((sum, q) => sum + (q._count?.attempts || 0), 0);
    return { totalQuizzes, published, drafts, totalQuestions, totalAttempts };
  }, [quizzes, questions]);

  /* ── Open Sidecar Detail Inspector ── */
  const handleInspectQuiz = useCallback(
    (quiz: Quiz) => {
      playPop();
      const questionCount = quiz._count?.questions || 0;
      const attemptCount = quiz._count?.attempts || 0;

      openSidecar({
        id: quiz.id,
        type: 'general',
        title: quiz.title,
        subtitle: `${quiz.timeLimitMin} ${t('assessment.minutes', { count: quiz.timeLimitMin })} • Pass: ${quiz.passScore}%`,
        badge: {
          text: quiz.isPublished
            ? t('assessment.status.published')
            : t('assessment.status.draft'),
          tone: quiz.isPublished ? 'emerald' : 'amber',
        },
        avatar: {
          text: quiz.title.slice(0, 2).toUpperCase(),
          color: quiz.isPublished ? '#10B981' : '#F59E0B',
        },
        metrics: [
          {
            label: t('assessment.form.timeLimit'),
            value: `${quiz.timeLimitMin} min`,
          },
          {
            label: t('assessment.form.passScore'),
            value: `${quiz.passScore}%`,
          },
          {
            label: t('assessment.badge.questions', { count: questionCount }),
            value: questionCount,
          },
          {
            label: t('assessment.stat.totalAttempts'),
            value: attemptCount,
          },
        ],
        details: [
          {
            label: 'Quiz ID',
            value: quiz.id,
            copyable: true,
          },
          {
            label: 'Status',
            value: quiz.isPublished ? 'Published' : 'Draft',
          },
        ],
        actions: [
          {
            label: t('common.close') || 'Close',
            variant: 'secondary',
            onClick: () => {},
          },
        ],
      });
    },
    [t, playPop]
  );

  const handleInspectQuestion = useCallback(
    (q: Question) => {
      playPop();
      const dTone = difficultyTone(q.difficulty);
      const toneMap: Record<Tone, 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate'> = {
        blue: 'blue',
        green: 'emerald',
        orange: 'amber',
        red: 'rose',
        purple: 'purple',
        slate: 'slate',
      };

      openSidecar({
        id: q.id,
        type: 'general',
        title: truncateText(q.text, 60),
        subtitle: q.subject ? `${q.subject.name} (${q.subject.code})` : undefined,
        badge: {
          text: q.difficulty || 'Normal',
          tone: toneMap[dTone] || 'blue',
        },
        avatar: {
          text: (q.subject?.code || 'Q').slice(0, 2).toUpperCase(),
          color: '#6366F1',
        },
        metrics: [
          {
            label: 'Points',
            value: q.points,
          },
          {
            label: 'Difficulty',
            value: q.difficulty || 'Normal',
          },
        ],
        details: [
          {
            label: t('assessment.tab.questions'),
            value: q.text,
            copyable: true,
          },
          {
            label: 'Type',
            value: q.type || 'N/A',
          },
          {
            label: 'Subject',
            value: q.subject?.name || 'Unassigned',
          },
        ],
        actions: [
          {
            label: t('common.close') || 'Close',
            variant: 'secondary',
            onClick: () => {},
          },
        ],
      });
    },
    [t, playPop]
  );

  /* ── Keyboard Shortcuts (J / K, C, Enter, Esc) ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      if (isInput) return;

      const currentListLength =
        tab === 'quizzes' ? filteredQuizzes.length : filteredQuestions.length;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev + 1 < currentListLength ? prev + 1 : 0));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : currentListLength - 1));
      } else if (e.key === 'c' || e.key === 'C') {
        if (tab === 'quizzes') {
          e.preventDefault();
          playPop();
          setIsQuizModalOpen(true);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (tab === 'quizzes' && filteredQuizzes[focusedIndex]) {
          handleInspectQuiz(filteredQuizzes[focusedIndex]);
        } else if (tab === 'questions' && filteredQuestions[focusedIndex]) {
          handleInspectQuestion(filteredQuestions[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    tab,
    filteredQuizzes,
    filteredQuestions,
    focusedIndex,
    handleInspectQuiz,
    handleInspectQuestion,
    playTick,
    playPop,
  ]);

  /* ── Mutations ── */
  const createQuizMutation = useMutation({
    mutationFn: (data: { title: string; timeLimitMin: number; passScore: number }) =>
      assessmentApi.createQuiz(data),
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      setIsQuizModalOpen(false);
      setQuizTitle('');
      setTimeLimit(30);
      setPassScore(70);
      setFormErrors({});
    },
  });

  const validateQuiz = useCallback(() => {
    const errors: { title?: string } = {};
    if (!quizTitle.trim()) {
      errors.title = t('assessment.validation.titleRequired');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [quizTitle, t]);

  const handleCreateQuiz = (e: FormEvent) => {
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

  /* ── Loading & Error States ── */
  const isLoading =
    (tab === 'quizzes' && loadingQuizzes) ||
    (tab === 'questions' && loadingQuestions);

  if (isLoading && !quizzes.length && !questions.length) {
    return (
      <div className="relative min-h-full px-4 py-8 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-7xl">
          <AssessmentSkeleton />
        </div>
      </div>
    );
  }

  const isError =
    (tab === 'quizzes' && quizError) ||
    (tab === 'questions' && questionError);

  if (isError) {
    return (
      <div className="relative min-h-full px-4 py-12 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-2xl">
          <div className="liquid-glass-card flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30">
              <Icon paths={ICONS.alertTriangle} size={26} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t('assessment.loadErrorTitle')}
              </h2>
              <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                {t('assessment.loadErrorHint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playTick();
                if (tab === 'quizzes') void refetchQuizzes();
                else void refetchQuestions();
              }}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Icon paths={ICONS.refresh} size={16} strokeWidth={2.2} />
              {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full px-4 py-6 sm:px-6 lg:px-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

      <motion.div
        variants={containerVariants}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* ====================================================================
         * 1. HERO HEADER
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-8"
        >
          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600/15 text-indigo-600 shadow-inner ring-1 ring-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-400">
                <Icon paths={ICONS.fileCheck} size={28} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t('assessment.badge.published', { count: stats.published })}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-500/20 dark:text-neutral-300">
                    {t('assessment.badge.quizzes', { count: stats.totalQuizzes })}
                  </span>
                  {stats.totalQuestions > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-500/25 dark:text-indigo-400">
                      {t('assessment.badge.questions', { count: stats.totalQuestions })}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  {t('assessment.heroTitle')}
                </h1>
                <p className="max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('assessment.heroSubtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setIsQuizModalOpen(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50"
              >
                <Icon paths={ICONS.plus} size={18} strokeWidth={2.4} />
                <span>{t('assessment.create')}</span>
                <kbd className="hidden rounded bg-indigo-800/60 px-1.5 py-0.5 text-[10px] font-mono sm:inline-block">
                  C
                </kbd>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 2. INTERACTIVE COUNT-UP KPI TILES
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
        >
          {/* Total Quizzes Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setFilterPublishedOnly(null);
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              filterPublishedOnly === null && 'ring-2 ring-indigo-500/40 bg-indigo-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('assessment.stat.totalQuizzes')}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Icon paths={ICONS.fileCheck} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={stats.totalQuizzes} />
            </div>
          </button>

          {/* Published Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setFilterPublishedOnly(true);
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              filterPublishedOnly === true && 'ring-2 ring-emerald-500/50 bg-emerald-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('assessment.stat.published')}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon paths={ICONS.checkCircle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              <CountUp value={stats.published} />
            </div>
          </button>

          {/* Question Bank Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setTab('questions');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              tab === 'questions' && 'ring-2 ring-purple-500/50 bg-purple-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('assessment.stat.questionBank')}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Icon paths={ICONS.helpCircle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={stats.totalQuestions} />
            </div>
          </button>

          {/* Total Attempts Tile */}
          <div className="liquid-glass-card flex min-h-[44px] flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('assessment.stat.totalAttempts')}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Icon paths={ICONS.barChart} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              <CountUp value={stats.totalAttempts} />
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 3. CONTROL BAR (Tabs, Search, and Status Filter)
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Liquid Glass Pill Tabs */}
          <div
            className="flex items-center rounded-2xl bg-neutral-200/50 p-1 dark:bg-white/[0.05] overflow-x-auto max-w-full no-scrollbar"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'quizzes'}
              onClick={() => {
                playTick();
                setTab('quizzes');
                setFocusedIndex(0);
              }}
              className={cn(
                'relative flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all',
                tab === 'quizzes'
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              {tab === 'quizzes' && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
                  transition={SPRING_PHYSICS.snappy}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon paths={ICONS.fileCheck} size={15} />
                <span>{t('assessment.tab.quizzes')}</span>
                <span className="ml-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                  {quizzes.length}
                </span>
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={tab === 'questions'}
              onClick={() => {
                playTick();
                setTab('questions');
                setFocusedIndex(0);
              }}
              className={cn(
                'relative flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all',
                tab === 'questions'
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              {tab === 'questions' && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
                  transition={SPRING_PHYSICS.snappy}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon paths={ICONS.helpCircle} size={15} />
                <span>{t('assessment.tab.questions')}</span>
                <span className="ml-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                  {questions.length}
                </span>
              </span>
            </button>
          </div>

          {/* Search Input Box */}
          <div className="relative w-full sm:w-auto sm:min-w-[240px] flex-1 sm:max-w-xs">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
              <Icon paths={ICONS.search} size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedIndex(0);
              }}
              placeholder={`${t('common.search') || 'Search'}...`}
              className="min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white/60 pl-9 pr-3 text-xs font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        </motion.div>

        {/* ====================================================================
         * 4. MAIN CONTENT CONTAINER (Desktop Table + Mobile Tactile Cards)
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card overflow-hidden">
          <AnimatePresence mode="wait">
            {tab === 'quizzes' ? (
              filteredQuizzes.length === 0 ? (
                <motion.div
                  key="empty-quizzes"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center p-12 text-center"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/25">
                    <Icon paths={ICONS.fileCheck} size={24} />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                    {t('assessment.emptyQuizzesTitle')}
                  </h3>
                  <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                    {t('assessment.emptyQuizzesHint')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playPop();
                      setIsQuizModalOpen(true);
                    }}
                    className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                  >
                    <Icon paths={ICONS.plus} size={15} />
                    {t('assessment.create')}
                  </button>
                </motion.div>
              ) : (
                <div key="quizzes-content">
                  {/* Desktop Table View */}
                  <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-black/[0.06] text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:border-white/[0.06] dark:text-neutral-400">
                          <th className="py-3 px-5">Quiz Title</th>
                          <th className="py-3 px-5">Status</th>
                          <th className="py-3 px-5">Time Limit</th>
                          <th className="py-3 px-5">Pass Score</th>
                          <th className="py-3 px-5">Questions</th>
                          <th className="py-3 px-5">Attempts</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                        {filteredQuizzes.map((quiz, idx) => {
                          const isFocused = focusedIndex === idx;
                          const pTone = passScoreTone(quiz.passScore);
                          const pStyle = TONE_STYLES[pTone];

                          return (
                            <tr
                              key={quiz.id}
                              onClick={() => handleInspectQuiz(quiz)}
                              className={cn(
                                'group cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                                isFocused && 'bg-indigo-500/[0.06] dark:bg-indigo-500/[0.1]'
                              )}
                            >
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                    <Icon paths={ICONS.fileCheck} size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                                      {quiz.title}
                                    </div>
                                    <div className="text-[11px] text-neutral-400">
                                      ID: {quiz.id.slice(0, 8)}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-5">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                                    quiz.isPublished
                                      ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400'
                                      : 'bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'h-1.5 w-1.5 rounded-full',
                                      quiz.isPublished ? 'bg-emerald-500' : 'bg-amber-500'
                                    )}
                                  />
                                  {quiz.isPublished
                                    ? t('assessment.status.published')
                                    : t('assessment.status.draft')}
                                </span>
                              </td>

                              <td className="py-4 px-5">
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                  <Icon paths={ICONS.clock} size={14} className="text-neutral-400" />
                                  {quiz.timeLimitMin} min
                                </span>
                              </td>

                              <td className="py-4 px-5">
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border',
                                    pStyle.bg,
                                    pStyle.fg,
                                    pStyle.border
                                  )}
                                >
                                  <Icon paths={ICONS.target} size={13} />
                                  {quiz.passScore}%
                                </span>
                              </td>

                              <td className="py-4 px-5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {quiz._count?.questions || 0}
                              </td>

                              <td className="py-4 px-5 text-xs font-medium text-neutral-700 dark:text-neutral-300">
                                {quiz._count?.attempts || 0}
                              </td>

                              <td className="py-4 px-5 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInspectQuiz(quiz);
                                  }}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-indigo-600 hover:bg-indigo-500/10 transition-colors"
                                  title="Inspect details"
                                >
                                  <Icon paths={ICONS.eye} size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Tactile Squircle Cards */}
                  <div className="divide-y divide-black/[0.04] dark:divide-white/[0.04] lg:hidden">
                    {filteredQuizzes.map((quiz) => {
                      const pTone = passScoreTone(quiz.passScore);
                      const pStyle = TONE_STYLES[pTone];

                      return (
                        <div
                          key={quiz.id}
                          onClick={() => handleInspectQuiz(quiz)}
                          className="flex min-h-[44px] flex-col gap-3 p-4 transition-colors active:bg-black/[0.03] dark:active:bg-white/[0.03]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                <Icon paths={ICONS.fileCheck} size={20} />
                              </div>
                              <div>
                                <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                                  {quiz.title}
                                </h3>
                                <p className="text-[11px] text-neutral-400">
                                  {quiz.timeLimitMin} min • Pass: {quiz.passScore}%
                                </p>
                              </div>
                            </div>

                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                quiz.isPublished
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              )}
                            >
                              {quiz.isPublished ? 'Published' : 'Draft'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                            <span className="rounded-md bg-neutral-200/50 px-2 py-1 font-medium text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-300">
                              {quiz._count?.questions || 0} questions
                            </span>
                            <span className="rounded-md bg-neutral-200/50 px-2 py-1 font-medium text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-300">
                              {quiz._count?.attempts || 0} attempts
                            </span>
                            <span
                              className={cn(
                                'rounded-md px-2 py-1 font-semibold border',
                                pStyle.bg,
                                pStyle.fg,
                                pStyle.border
                              )}
                            >
                              {quiz.passScore}% required
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            ) : filteredQuestions.length === 0 ? (
              <motion.div
                key="empty-questions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/25">
                  <Icon paths={ICONS.helpCircle} size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {t('assessment.emptyQuestionsTitle')}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  {t('assessment.emptyQuestionsHint')}
                </p>
              </motion.div>
            ) : (
              <div
                key="questions-content"
                className="divide-y divide-black/[0.04] dark:divide-white/[0.04]"
              >
                {filteredQuestions.map((question, idx) => {
                  const isFocused = focusedIndex === idx;
                  const dTone = difficultyTone(question.difficulty);
                  const dStyle = TONE_STYLES[dTone];

                  return (
                    <div
                      key={question.id}
                      onClick={() => handleInspectQuestion(question)}
                      className={cn(
                        'group flex min-h-[44px] cursor-pointer flex-col gap-2.5 p-4 sm:p-5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]',
                        isFocused && 'bg-purple-500/[0.06] dark:bg-purple-500/[0.1]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <Icon paths={ICONS.helpCircle} size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold leading-snug text-neutral-900 dark:text-white">
                              {question.text}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {question.subject && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                                  <Icon paths={ICONS.graduationCap} size={12} />
                                  {question.subject.code || question.subject.name}
                                </span>
                              )}
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold',
                                  dStyle.bg,
                                  dStyle.fg,
                                  dStyle.border
                                )}
                              >
                                <Icon paths={ICONS.zap} size={12} />
                                {question.difficulty || 'Normal'}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-neutral-200/60 px-2 py-0.5 text-[11px] font-semibold text-neutral-700 dark:bg-white/[0.06] dark:text-neutral-300">
                                <Icon paths={ICONS.tag} size={12} />
                                {question.type || 'Standard'}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                <Icon paths={ICONS.award} size={12} />
                                {question.points} pts
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectQuestion(question);
                          }}
                          className="hidden sm:inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:text-purple-600 hover:bg-purple-500/10 transition-colors"
                          title="Inspect question"
                        >
                          <Icon paths={ICONS.eye} size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* ====================================================================
       * 5. CREATE QUIZ MODAL (Glass Overlay)
       * ================================================================== */}
      <AnimatePresence>
        {isQuizModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] grid place-items-center p-4 backdrop-blur-md bg-black/40"
            onClick={handleCloseModal}
            role="presentation"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={SPRING_PHYSICS.snappy}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={t('assessment.createAria')}
              className="liquid-glass-card relative w-full max-w-lg overflow-hidden p-6 sm:p-8"
            >
              <div className="flex items-center justify-between pb-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Icon paths={ICONS.plus} size={20} strokeWidth={2.4} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {t('assessment.create')}
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t('assessment.createHint')}
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleCreateQuiz} className="mt-5 space-y-4" noValidate>
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                    {t('assessment.form.title')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={quizTitle}
                    onChange={(e) => {
                      setQuizTitle(e.target.value);
                      setFormErrors({});
                    }}
                    placeholder={t('assessment.form.titlePlaceholder')}
                    aria-invalid={Boolean(formErrors.title)}
                    className="min-h-[44px] w-full rounded-xl border border-black/[0.1] bg-white/70 px-3.5 py-2 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
                  />
                  {formErrors.title && (
                    <p className="mt-1.5 text-xs text-rose-500 font-medium">{formErrors.title}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                      {t('assessment.form.timeLimit')} (min)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(Number(e.target.value))}
                      className="min-h-[44px] w-full rounded-xl border border-black/[0.1] bg-white/70 px-3.5 py-2 text-sm tabular-nums text-neutral-900 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                      {t('assessment.form.passScore')} (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={passScore}
                      onChange={(e) => setPassScore(Number(e.target.value))}
                      className="min-h-[44px] w-full rounded-xl border border-black/[0.1] bg-white/70 px-3.5 py-2 text-sm tabular-nums text-neutral-900 outline-none transition-all focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={createQuizMutation.isPending}
                    className="min-h-[44px] rounded-xl border border-black/[0.08] bg-neutral-100/60 px-5 py-2.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-200/60 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-neutral-300 dark:hover:bg-white/[0.08]"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createQuizMutation.isPending}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-indigo-700 disabled:opacity-50 active:scale-95"
                  >
                    {createQuizMutation.isPending ? (
                      <>
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>{t('common.saving')}</span>
                      </>
                    ) : (
                      <>
                        <Icon paths={ICONS.plus} size={15} strokeWidth={2.4} />
                        <span>{t('assessment.create')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
