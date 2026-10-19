/**
 * M-EDU AcademicRiskPage — Apple Design Award Edition
 *
 * Predictive Academic Risk Radar with fluid spring motion,
 * multi-layer glass cards, interactive severity segmented controls,
 * and Apple HIG typography.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GlassPageHeader,
  GlassBadge,
  GlassPageLoader,
  GlassErrorState,
  GlassEmptyState,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

/* ── Motion Tokens ────────────────────────────────────────────── */
const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

interface RiskFactor {
  name: string;
  weight: number;
  score: number;
  evidence: string;
}

interface AcademicRisk {
  studentId: string;
  studentName: string;
  riskScore: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: RiskFactor[];
  recommendation: string;
}

interface AcademicRiskSummary {
  high: number;
  medium: number;
  low: number;
  avgScore: number;
}

type FilterLevel = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

export function AcademicRiskPage() {
  const { t } = useI18n();
  usePageTitle(t('academicRisk.title') || 'Academic Risk Radar');

  const [activeFilter, setActiveFilter] = useState<FilterLevel>('ALL');

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

  const filteredStudents = useMemo(() => {
    if (activeFilter === 'ALL') return allStudents;
    return allStudents.filter((s) => s.level === activeFilter);
  }, [allStudents, activeFilter]);

  const counts = useMemo(
    () => ({
      ALL: allStudents.length,
      HIGH: allStudents.filter((s) => s.level === 'HIGH').length,
      MEDIUM: allStudents.filter((s) => s.level === 'MEDIUM').length,
      LOW: allStudents.filter((s) => s.level === 'LOW').length,
    }),
    [allStudents],
  );

  return (
    <div className="relative min-h-screen px-4 pb-16 pt-4 sm:px-6 lg:px-8">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-40 right-10 h-96 w-96 rounded-full bg-rose-500/10 blur-[100px] dark:bg-rose-500/15"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed top-1/3 left-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-[100px] dark:bg-cyan-500/15"
      />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        {/* Page Header */}
        <GlassPageHeader
          title={t('academicRisk.title') || 'Academic Risk Radar'}
          subtitle={t('academicRisk.subtitle') || 'Early warning indicators & intervention intelligence'}
        />

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="group relative overflow-hidden rounded-[1.75rem] bg-white/55 p-5 ring-1 ring-inset ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 dark:bg-white/[0.035] dark:ring-white/[0.08]"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('academicRisk.atRisk') || 'Total At Risk'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-rose-600 dark:text-rose-400">
              {(summary?.high ?? 0) + (summary?.medium ?? 0)}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.05 }}
            className="group relative overflow-hidden rounded-[1.75rem] bg-white/55 p-5 ring-1 ring-inset ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 dark:bg-white/[0.035] dark:ring-white/[0.08]"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('anomaly.highSeverity') || 'High Severity'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-rose-500">
              {summary?.high ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.1 }}
            className="group relative overflow-hidden rounded-[1.75rem] bg-white/55 p-5 ring-1 ring-inset ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 dark:bg-white/[0.035] dark:ring-white/[0.08]"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('anomaly.mediumSeverity') || 'Medium Risk'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-amber-500">
              {summary?.medium ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.15 }}
            className="group relative overflow-hidden rounded-[1.75rem] bg-white/55 p-5 ring-1 ring-inset ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 dark:bg-white/[0.035] dark:ring-white/[0.08]"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('anomaly.lowSeverity') || 'Low Risk'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-emerald-500">
              {summary?.low ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.2 }}
            className="group relative col-span-2 overflow-hidden rounded-[1.75rem] bg-white/55 p-5 ring-1 ring-inset ring-white/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 sm:col-span-1 dark:bg-white/[0.035] dark:ring-white/[0.08]"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('academicRisk.avgScore') || 'Avg Score'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">
              {Math.round(summary?.avgScore ?? 0)}
            </div>
          </motion.div>
        </div>

        {/* Methodology Card */}
        <div className="relative overflow-hidden rounded-[1.75rem] bg-white/50 p-6 ring-1 ring-inset ring-white/60 backdrop-blur-md dark:bg-white/[0.03] dark:ring-white/[0.06]">
          <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
            {t('academicRisk.factorsTitle') || 'Algorithm & Risk Factors'}
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2 text-[12.5px] leading-relaxed text-[var(--text-secondary)] sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-white/40 p-2.5 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
              <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.gradeTrend') || 'Grade Trend'}</strong>: {t('academicRisk.factor.gradeTrendDesc') || 'Weighted exam & quiz decline'}
            </div>
            <div className="rounded-xl bg-white/40 p-2.5 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
              <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.attendanceRate') || 'Attendance'}</strong>: {t('academicRisk.factor.attendanceRateDesc') || '30-day presence ratio'}
            </div>
            <div className="rounded-xl bg-white/40 p-2.5 ring-1 ring-inset ring-white/50 dark:bg-white/[0.02] dark:ring-white/[0.04]">
              <strong className="text-[var(--text-primary)]">{t('academicRisk.factor.homework') || 'Homework'}</strong>: {t('academicRisk.factor.homeworkDesc') || 'Completion vs missing'}
            </div>
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1 rounded-2xl bg-white/50 p-1 ring-1 ring-inset ring-white/60 backdrop-blur-md dark:bg-white/[0.04] dark:ring-white/[0.06]">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as FilterLevel[]).map((level) => {
              const isActive = activeFilter === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setActiveFilter(level)}
                  className={`relative rounded-xl px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="risk-filter-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md"
                      transition={SPRING.smooth}
                    />
                  )}
                  <span className="relative z-10">
                    {level === 'ALL' ? (t('common.all') || 'All') : level}{' '}
                    <span className="opacity-70">({counts[level]})</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Students List */}
        <div className="relative overflow-hidden rounded-2xl bg-white/55 p-6 ring-1 ring-inset ring-white/60 backdrop-blur-md dark:bg-white/[0.035] dark:ring-white/[0.08]">
          {studentsQuery.isLoading ? (
            <div className="p-12"><GlassPageLoader label={t('academicRisk.loading') || 'Analyzing risk models…'} /></div>
          ) : studentsQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                message={getErrorMessage(studentsQuery.error)}
                onRetry={() => studentsQuery.refetch()}
              />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12">
              <GlassEmptyState
                title={t('academicRisk.emptyTitle') || 'No Students At Risk'}
                message={t('academicRisk.emptyMessage') || 'All student trajectories are healthy and on track.'}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredStudents.map((s) => {
                  const isHigh = s.level === 'HIGH';
                  const isMed = s.level === 'MEDIUM';

                  return (
                    <motion.div
                      key={s.studentId}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={SPRING.smooth}
                      className="group relative overflow-hidden rounded-[1.5rem] bg-white/60 p-5 ring-1 ring-inset ring-white/70 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:bg-white/[0.04] dark:ring-white/[0.08]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                            {s.studentName}
                          </h4>
                          <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-secondary)]">
                            {s.recommendation}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[13px] font-bold text-[var(--text-primary)]">
                            {s.riskScore}
                          </span>
                          <GlassBadge color={isHigh ? 'red' : isMed ? 'orange' : 'green'}>
                            {s.level}
                          </GlassBadge>
                        </div>
                      </div>

                      {/* Factors grid */}
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {s.factors.map((f) => (
                          <div
                            key={f.name}
                            className="rounded-xl bg-white/50 p-2.5 text-[11.5px] ring-1 ring-inset ring-white/60 dark:bg-white/[0.03] dark:ring-white/[0.05]"
                          >
                            <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]">
                              <span className="truncate">{f.name}</span>
                              <span className="ml-1 opacity-60 font-mono">w{f.weight}</span>
                            </div>
                            <div className="mt-0.5 truncate text-[var(--text-muted)]">
                              {f.evidence}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AcademicRiskPage;
