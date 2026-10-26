/**
 * M-EDU Academic Risk Page
 * Student academic performance monitoring, risk factor evaluation, and early interventions.
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type SVGProps,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
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

export interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  evidence: string;
}

export interface AcademicRisk {
  studentId: string;
  studentName: string;
  riskScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: RiskFactor[];
  recommendation: string;
}

export interface AcademicRiskSummary {
  high: number;
  medium: number;
  low: number;
  avgScore: number;
}

export type FilterLevel = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

/* ============================================================================
 * PURE EXPORTED HELPERS (Zero Dependencies, Fully Testable)
 * ========================================================================== */

export function getRiskLevelTone(level: string | null | undefined): {
  tone: 'red' | 'orange' | 'green' | 'slate';
  badgeStyle: string;
  dotStyle: string;
} {
  const norm = (level || '').toUpperCase();
  if (norm === 'HIGH') {
    return {
      tone: 'red',
      badgeStyle: 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400',
      dotStyle: 'bg-rose-500',
    };
  }
  if (norm === 'MEDIUM') {
    return {
      tone: 'orange',
      badgeStyle: 'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400',
      dotStyle: 'bg-amber-500',
    };
  }
  if (norm === 'LOW') {
    return {
      tone: 'green',
      badgeStyle: 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400',
      dotStyle: 'bg-emerald-500',
    };
  }
  return {
    tone: 'slate',
    badgeStyle: 'bg-neutral-500/10 text-neutral-600 ring-neutral-500/30 dark:text-neutral-400',
    dotStyle: 'bg-neutral-400',
  };
}

export function formatRiskScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '0';
  return Math.round(score).toString();
}

export function calculateTotalAtRisk(high = 0, medium = 0): number {
  return high + medium;
}

/* ============================================================================
 * SVG ICONS
 * ========================================================================== */

const ICONS = {
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4',
    'M12 16h.01',
  ],
  radar: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M12 2v2',
  ],
  trendingDown: [
    'M23 18l-9.5-9.5-5 5L1 6',
    'M17 18h6v-6',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
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
  user: [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  search: [
    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  ],
  calendar: [
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M16 2v4',
    'M8 2v4',
    'M3 10h18',
  ],
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M16 13H8',
    'M16 17H8',
    'M10 9H8',
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
      <div className="absolute -left-[10%] -top-[15%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-rose-500/12 via-orange-500/8 to-transparent blur-[120px] dark:from-rose-600/16 dark:via-orange-600/10" />
      <div className="absolute -right-[10%] top-[30%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-amber-500/12 via-indigo-500/8 to-transparent blur-[120px] dark:from-amber-600/16 dark:via-indigo-600/10" />
      <div className="absolute bottom-[-15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-cyan-500/10 via-blue-500/6 to-transparent blur-[110px] dark:from-cyan-600/14" />
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

function AcademicRiskSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true">
      <div className="h-36 w-full rounded-3xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
      <div className="h-28 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-44 rounded-2xl bg-neutral-200/60 dark:bg-white/[0.04]"
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function AcademicRiskPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('academicRisk.title') || 'Academic Risk Radar');

  const reduced = usePrefersReducedMotion();
  const { playTick, playPop } = usePremiumSound();

  const [activeFilter, setActiveFilter] = useState<FilterLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  /* ── Queries ── */
  const summaryQuery = useQuery({
    queryKey: ['academic-risk-summary'],
    queryFn: () => request('/academic-risk/summary') as Promise<AcademicRiskSummary>,
  });

  const studentsQuery = useQuery({
    queryKey: ['academic-risk'],
    queryFn: () => request('/academic-risk') as Promise<{ items: AcademicRisk[]; total: number }>,
  });

  const allStudents: AcademicRisk[] = studentsQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  /* ── Filtered & Searched Students ── */
  const filteredStudents = useMemo(() => {
    let list = allStudents;
    if (activeFilter !== 'ALL') {
      list = list.filter((s) => s.level === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.recommendation.toLowerCase().includes(q) ||
          s.factors.some((f) => f.name.toLowerCase().includes(q) || f.evidence.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allStudents, activeFilter, searchQuery]);

  const counts = useMemo(
    () => ({
      ALL: allStudents.length,
      HIGH: allStudents.filter((s) => s.level === 'HIGH').length,
      MEDIUM: allStudents.filter((s) => s.level === 'MEDIUM').length,
      LOW: allStudents.filter((s) => s.level === 'LOW').length,
    }),
    [allStudents]
  );

  /* ── Open Sidecar Detail Inspector ── */
  const handleInspectStudent = useCallback(
    (student: AcademicRisk) => {
      playPop();
      const levelTone = getRiskLevelTone(student.level);
      const toneMap: Record<string, 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate'> = {
        red: 'rose',
        orange: 'amber',
        green: 'emerald',
        slate: 'slate',
      };

      openSidecar({
        id: student.studentId,
        type: 'student',
        title: student.studentName,
        subtitle: `Risk Score: ${student.riskScore}/100 • Status: ${student.level}`,
        badge: {
          text: `${student.level} RISK`,
          tone: toneMap[levelTone.tone] || 'rose',
        },
        avatar: {
          text: student.studentName.slice(0, 2).toUpperCase(),
          color: student.level === 'HIGH' ? '#F43F5E' : student.level === 'MEDIUM' ? '#F59E0B' : '#10B981',
        },
        metrics: [
          {
            label: 'Risk Score',
            value: `${student.riskScore} / 100`,
          },
          {
            label: 'Severity Level',
            value: student.level,
          },
        ],
        details: [
          {
            label: 'Intervention Plan',
            value: student.recommendation,
          },
          ...student.factors.map((f) => ({
            label: `${f.name} (w${f.weight})`,
            value: `${f.evidence} • Score: ${f.score}`,
          })),
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

  /* ── Keyboard Shortcuts (J / K, 1-4 for filters, Enter to inspect) ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT';

      if (isInput) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev + 1 < filteredStudents.length ? prev + 1 : 0));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        playTick();
        setFocusedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredStudents.length - 1));
      } else if (e.key === '1') {
        playTick();
        setActiveFilter('ALL');
      } else if (e.key === '2') {
        playTick();
        setActiveFilter('HIGH');
      } else if (e.key === '3') {
        playTick();
        setActiveFilter('MEDIUM');
      } else if (e.key === '4') {
        playTick();
        setActiveFilter('LOW');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredStudents[focusedIndex]) {
          handleInspectStudent(filteredStudents[focusedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredStudents, focusedIndex, handleInspectStudent, playTick]);

  /* ── Loading & Error States ── */
  const isLoading = studentsQuery.isLoading && !allStudents.length;
  if (isLoading) {
    return (
      <div className="relative min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-7xl">
          <AcademicRiskSkeleton />
        </div>
      </div>
    );
  }

  if (studentsQuery.isError) {
    return (
      <div className="relative min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <AuroraMesh />
        <div className="mx-auto max-w-2xl">
          <div className="liquid-glass-card flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500 ring-1 ring-rose-500/30">
              <Icon paths={ICONS.alertTriangle} size={26} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t('academicRisk.loadErrorTitle') || 'Unable to Load Risk Intelligence'}
              </h2>
              <p className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
                {getErrorMessage(studentsQuery.error)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                playTick();
                void studentsQuery.refetch();
                void summaryQuery.refetch();
              }}
              className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
            >
              <Icon paths={ICONS.refresh} size={16} strokeWidth={2.2} />
              {t('common.retry') || 'Retry'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalAtRisk = calculateTotalAtRisk(summary?.high, summary?.medium);

  return (
    <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8 pb-[max(6rem,env(safe-area-inset-bottom))]">
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
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600/15 text-rose-600 shadow-inner ring-1 ring-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400">
                <Icon paths={ICONS.radar} size={28} strokeWidth={2} />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-500/25 dark:text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {totalAtRisk} {t('academicRisk.atRisk') || 'Students Need Intervention'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-neutral-500/10 px-2.5 py-0.5 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-500/20 dark:text-neutral-300">
                    {allStudents.length} Monitored
                  </span>
                </div>

                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
                  {t('academicRisk.title') || 'Academic Risk Radar'}
                </h1>
                <p className="max-w-2xl text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('academicRisk.subtitle') ||
                    'Predictive early warning indicators, multi-factor trajectory modeling, and real-time intervention intelligence.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  playTick();
                  void studentsQuery.refetch();
                  void summaryQuery.refetch();
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-black/[0.08] bg-white/50 px-4 py-2 text-xs font-semibold text-neutral-700 shadow-sm transition-all hover:bg-white/80 active:scale-95 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-neutral-300"
              >
                <Icon paths={ICONS.refresh} size={15} />
                <span>{t('common.refresh') || 'Refresh'}</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 2. INTERACTIVE COUNT-UP KPI TILES
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 sm:gap-4"
        >
          {/* Total At Risk Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('ALL');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'ALL' && 'ring-2 ring-rose-500/40 bg-rose-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('academicRisk.atRisk') || 'Total At Risk'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Icon paths={ICONS.shieldAlert} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              <CountUp value={totalAtRisk} />
            </div>
          </button>

          {/* High Severity Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('HIGH');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'HIGH' && 'ring-2 ring-rose-500/50 bg-rose-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('anomaly.highSeverity') || 'High Severity'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Icon paths={ICONS.alertTriangle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-rose-500">
              <CountUp value={summary?.high ?? 0} />
            </div>
          </button>

          {/* Medium Risk Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('MEDIUM');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'MEDIUM' && 'ring-2 ring-amber-500/50 bg-amber-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('anomaly.mediumSeverity') || 'Medium Risk'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Icon paths={ICONS.trendingDown} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-amber-500">
              <CountUp value={summary?.medium ?? 0} />
            </div>
          </button>

          {/* Low Risk Tile */}
          <button
            type="button"
            onClick={() => {
              playTick();
              setActiveFilter('LOW');
            }}
            className={cn(
              'liquid-glass-card group flex min-h-[44px] flex-col justify-between p-4 text-left transition-all',
              activeFilter === 'LOW' && 'ring-2 ring-emerald-500/50 bg-emerald-500/5'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('anomaly.lowSeverity') || 'Low Risk'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Icon paths={ICONS.checkCircle} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-500">
              <CountUp value={summary?.low ?? 0} />
            </div>
          </button>

          {/* Avg Score Tile */}
          <div className="liquid-glass-card col-span-2 sm:col-span-1 flex min-h-[44px] flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {t('academicRisk.avgScore') || 'Avg Score'}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Icon paths={ICONS.sparkles} size={16} />
              </div>
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
              <CountUp value={summary?.avgScore ?? 0} />
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 3. METHODOLOGY INTELLIGENCE STRIP
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card p-5 sm:p-6"
        >
          <div className="flex items-center gap-2 pb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Icon paths={ICONS.radar} size={15} />
            </div>
            <h3 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              {t('academicRisk.factorsTitle') || 'Algorithm & Risk Factors'}
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('academicRisk.factor.gradeTrend') || 'Grade Trend'}:
              </strong>{' '}
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('academicRisk.factor.gradeTrendDesc') || 'Weighted exam & quiz decline over last 4 periods'}
              </span>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('academicRisk.factor.attendanceRate') || 'Attendance'}:
              </strong>{' '}
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('academicRisk.factor.attendanceRateDesc') || '30-day rolling presence & unexcused absences'}
              </span>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/40 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <strong className="text-xs font-bold text-neutral-900 dark:text-white">
                {t('academicRisk.factor.homework') || 'Homework'}:
              </strong>{' '}
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                {t('academicRisk.factor.homeworkDesc') || 'Submission rate vs missing assignments'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ====================================================================
         * 4. CONTROL BAR (Segmented Control + Search)
         * ================================================================== */}
        <motion.div
          variants={itemVariants}
          className="liquid-glass-card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Segmented Filter Control */}
          <div
            className="flex items-center rounded-2xl bg-neutral-200/50 p-1 dark:bg-white/[0.05]"
            role="tablist"
          >
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as FilterLevel[]).map((level) => {
              const isActive = activeFilter === level;
              return (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    playTick();
                    setActiveFilter(level);
                    setFocusedIndex(0);
                  }}
                  className={cn(
                    'relative flex min-h-[44px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all',
                    isActive
                      ? 'text-neutral-900 dark:text-white'
                      : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeFilterPill"
                      className="absolute inset-0 rounded-xl bg-white shadow-sm dark:bg-neutral-800"
                      transition={SPRING_PHYSICS.snappy}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <span>{level === 'ALL' ? t('common.all') || 'All' : level}</span>
                    <span className="rounded-full bg-neutral-400/15 px-1.5 py-0.2 text-[10px] tabular-nums">
                      {counts[level]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
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
              placeholder={`${t('common.search') || 'Search students'}...`}
              className="min-h-[44px] w-full rounded-xl border border-black/[0.08] bg-white/60 pl-9 pr-3 text-xs font-medium text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-rose-500/50 focus:ring-2 focus:ring-rose-500/20 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        </motion.div>

        {/* ====================================================================
         * 5. STUDENT RISK CARDS GRID
         * ================================================================== */}
        <motion.div variants={itemVariants} className="liquid-glass-card p-5 sm:p-6">
          <AnimatePresence mode="wait">
            {filteredStudents.length === 0 ? (
              <motion.div
                key="empty-students"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-12 text-center"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25">
                  <Icon paths={ICONS.checkCircle} size={24} />
                </div>
                <h3 className="mt-4 text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {t('academicRisk.emptyTitle') || 'No Students At Risk'}
                </h3>
                <p className="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
                  {t('academicRisk.emptyMessage') ||
                    'All student learning trajectories are healthy and on track.'}
                </p>
              </motion.div>
            ) : (
              <div
                key="student-grid"
                className="grid grid-cols-1 gap-4 lg:grid-cols-2"
              >
                {filteredStudents.map((s, idx) => {
                  const isFocused = focusedIndex === idx;
                  const levelTone = getRiskLevelTone(s.level);

                  return (
                    <motion.div
                      key={s.studentId}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={SPRING_PHYSICS.smooth}
                      onClick={() => handleInspectStudent(s)}
                      className={cn(
                        'group flex min-h-[44px] cursor-pointer flex-col justify-between rounded-2xl border border-black/[0.08] bg-white/50 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03]',
                        isFocused && 'ring-2 ring-rose-500/50 bg-rose-500/[0.04]'
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-neutral-200 to-neutral-300 font-bold text-neutral-700 shadow-sm dark:from-neutral-800 dark:to-neutral-700 dark:text-neutral-200">
                              {s.studentName.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
                                {s.studentName}
                              </h4>
                              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                                ID: {s.studentId.slice(0, 8)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200">
                              {s.riskScore}
                            </span>
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1',
                                levelTone.badgeStyle
                              )}
                            >
                              <span
                                className={cn('h-1.5 w-1.5 rounded-full', levelTone.dotStyle)}
                              />
                              {s.level}
                            </span>
                          </div>
                        </div>

                        <p className="mt-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400 line-clamp-2">
                          {s.recommendation}
                        </p>
                      </div>

                      {/* Factors Mini-Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.04]">
                        {s.factors.map((f) => (
                          <div
                            key={f.name}
                            className="rounded-xl bg-white/60 p-2.5 text-[11px] dark:bg-white/[0.02]"
                          >
                            <div className="flex items-center justify-between font-semibold text-neutral-800 dark:text-neutral-200">
                              <span className="truncate">{f.name}</span>
                              <span className="font-mono opacity-60">w{f.weight}</span>
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-neutral-500 dark:text-neutral-400">
                              {f.evidence}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default AcademicRiskPage;
