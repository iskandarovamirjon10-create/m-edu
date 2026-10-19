/**
 * M-EDU EarlyWarningPage — Apple Design Award V2 Edition
 *
 * Premium craft:
 *  - Apple SF Pro visual hierarchy with ambient operational warning glow
 *  - Hero banner with Early Warning Radar badge & one-click Scan Trigger
 *  - 5-column squircle KPI summary bar
 *  - Framer-motion spring transitions (staggered warning notifications)
 *  - Full preservation of API requests, mutations, types, and translation keys
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassBadge, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton, GlassStatCard } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

interface EarlyWarning {
  id: string;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  detectedAt: string;
  resolved: boolean;
}

const SEVERITY_COLOR: Record<EarlyWarning['severity'], 'muted' | 'primary' | 'warning' | 'error'> = {
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

const SEVERITY_LABEL_KEY: Record<EarlyWarning['severity'], string> = {
  LOW: 'anomaly.lowSeverity',
  MEDIUM: 'anomaly.mediumSeverity',
  HIGH: 'anomaly.highSeverity',
  CRITICAL: 'earlyWarning.critical',
};

interface EarlyWarningSummary {
  open: number;
  critical: number;
  high: number;
  resolvedThisWeek: number;
  total: number;
}

export function EarlyWarningPage() {
  const { t } = useI18n();
  usePageTitle(t('earlyWarning.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();

  const summaryQuery = useQuery({
    queryKey: ['early-warning-summary'],
    queryFn: () => request('/early-warning/summary') as Promise<EarlyWarningSummary>,
  });

  const warningsQuery = useQuery({
    queryKey: ['early-warnings'],
    queryFn: () => request('/early-warning') as Promise<{ items: EarlyWarning[]; total: number }>,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => request(`/early-warning/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      push('success', t('earlyWarning.resolved'));
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const scanMutation = useMutation({
    mutationFn: () => request('/early-warning/scan', { method: 'POST' }) as Promise<{ created?: number }>,
    onSuccess: (data) => {
      push('success', t('earlyWarning.scanComplete', { n: data?.created ?? 0 }));
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const warnings: EarlyWarning[] = warningsQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative min-h-screen bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Ambient background lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-[12%] right-[15%] h-[400px] w-[500px] rounded-full bg-amber-500/10 blur-[140px] dark:bg-amber-600/[0.08]" />
        <div className="absolute top-[40%] left-[8%] h-[350px] w-[450px] rounded-full bg-rose-500/10 blur-[130px] dark:bg-rose-600/[0.07]" />
      </div>

      {/* ── Apple V2 Hero Header ── */}
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 text-white shadow-lg shadow-amber-500/25">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('earlyWarning.title')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                v2 Apple
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('earlyWarning.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="primary"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            icon={
              <svg className={`h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            }
          >
            {scanMutation.isPending ? t('anomaly.loading') : t('earlyWarning.runScan')}
          </GlassButton>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-3.5 sm:gap-4">
        <GlassStatCard label={t('earlyWarning.open')} value={summary?.open ?? 0} />
        <GlassStatCard label={t('earlyWarning.critical')} value={summary?.critical ?? 0} />
        <GlassStatCard label={t('anomaly.highSeverity')} value={summary?.high ?? 0} />
        <GlassStatCard label={t('earlyWarning.resolvedThisWeek')} value={summary?.resolvedThisWeek ?? 0} />
        <GlassStatCard label={t('earlyWarning.totalDetected')} value={summary?.total ?? 0} />
      </div>

      {/* ── Rule Definitions Card ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70 space-y-3">
        <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          {t('earlyWarning.rulesTitle')}
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-zinc-600 dark:text-zinc-400">
          <li className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <strong className="text-zinc-900 dark:text-zinc-200">{t('earlyWarning.rule.paymentOverdue')}</strong>
            <p className="mt-0.5 text-zinc-400">{t('earlyWarning.rule.paymentOverdueDesc')}</p>
          </li>
          <li className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <strong className="text-zinc-900 dark:text-zinc-200">{t('earlyWarning.rule.attendance')}</strong>
            <p className="mt-0.5 text-zinc-400">{t('earlyWarning.rule.attendanceDesc')}</p>
          </li>
          <li className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <strong className="text-zinc-900 dark:text-zinc-200">{t('earlyWarning.rule.absences')}</strong>
            <p className="mt-0.5 text-zinc-400">{t('earlyWarning.rule.absencesDesc')}</p>
          </li>
          <li className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <strong className="text-zinc-900 dark:text-zinc-200">{t('earlyWarning.rule.leadStale')}</strong>
            <p className="mt-0.5 text-zinc-400">{t('earlyWarning.rule.leadStaleDesc')}</p>
          </li>
          <li className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <strong className="text-zinc-900 dark:text-zinc-200">{t('earlyWarning.rule.gradeDrop')}</strong>
            <p className="mt-0.5 text-zinc-400">{t('earlyWarning.rule.gradeDropDesc')}</p>
          </li>
          <li className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 dark:bg-white/[0.02] border border-black/[0.03] dark:border-white/[0.04]">
            <strong className="text-zinc-900 dark:text-zinc-200">{t('earlyWarning.rule.scheduleConflict')}</strong>
            <p className="mt-0.5 text-zinc-400">{t('earlyWarning.rule.scheduleConflictDesc')}</p>
          </li>
        </ul>
      </div>

      {/* ── Warnings Feed ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70">
        {warningsQuery.isLoading ? (
          <div className="p-12"><GlassPageLoader label={t('earlyWarning.loading')} /></div>
        ) : warningsQuery.isError ? (
          <div className="p-8">
            <GlassErrorState
              title={t('earlyWarning.loadFailed')}
              message={getErrorMessage(warningsQuery.error)}
              onRetry={() => warningsQuery.refetch()}
            />
          </div>
        ) : warnings.length === 0 ? (
          <div className="p-12">
            <GlassEmptyState
              title={t('earlyWarning.emptyTitle')}
              message={t('earlyWarning.emptyMessage')}
            />
          </div>
        ) : (
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-white/[0.05]"
          >
            {warnings.map((w) => (
              <motion.li
                key={w.id}
                variants={itemVariants}
                className="p-4 sm:p-5 flex items-start gap-4 transition-colors duration-200 hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
              >
                <div className="shrink-0 mt-0.5">
                  <GlassBadge color={SEVERITY_COLOR[w.severity]}>{t(SEVERITY_LABEL_KEY[w.severity])}</GlassBadge>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{w.title}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{w.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-zinc-400">
                    <span className="font-mono rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">{w.rule}</span>
                    <span>·</span>
                    <span className="font-medium text-zinc-600 dark:text-zinc-300">{w.entityType}</span>
                    <span>·</span>
                    <span>{new Date(w.detectedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="shrink-0 self-center">
                  <GlassButton
                    size="sm"
                    variant="secondary"
                    onClick={() => resolveMutation.mutate(w.id)}
                    disabled={resolveMutation.isPending}
                  >
                    {t('earlyWarning.markResolved')}
                  </GlassButton>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </motion.main>
  );
}

export default EarlyWarningPage;

