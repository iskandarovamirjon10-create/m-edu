/**
 * M-EDU DataQualityCenter — Apple Design Award V2 Edition
 *
 * Premium craft:
 *  - Apple SF Pro visual hierarchy with ambient verification lighting
 *  - Hero banner with Data Quality Assurance badge & interactive Run All trigger
 *  - Segmented filter tabs with spring physics
 *  - Staggered data integrity issue cards with severity pills
 *  - Squircle liquid-glass summary stat cards
 *  - Full preservation of queries, mutations, types, and translation keys
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassButton } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { dataQualityApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { formatDate } from '@/lib/format';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

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

interface DataQualityIssue {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  field?: string | null;
  message: string;
  ruleId: string;
  detectedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}

const severityColor: Record<DataQualityIssue['severity'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

const SEVERITY_LABEL_KEY: Record<DataQualityIssue['severity'], string> = {
  LOW: 'anomaly.lowSeverity',
  MEDIUM: 'anomaly.mediumSeverity',
  HIGH: 'anomaly.highSeverity',
  CRITICAL: 'dataQualityCenter.critical',
};

const FILTER_LABEL_KEY = {
  unresolved: 'dataQualityCenter.filter.unresolved',
  critical: 'dataQualityCenter.filter.critical',
  all: 'enum.all',
} as const;

interface DataQualitySummary {
  total: number;
  resolvedThisWeek: number;
  bySeverity?: Partial<Record<DataQualityIssue['severity'], number>>;
}

export function DataQualityCenterPage() {
  const { t } = useI18n();
  usePageTitle(t('dataQualityCenter.title'));
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'critical' | 'unresolved'>('unresolved');
  const toast = useToast();
  const { playTick, playPop, playSuccess, playError } = usePremiumSound();

  const summaryQuery = useQuery({
    queryKey: ['data-quality-summary'],
    queryFn: () => dataQualityApi.summary() as Promise<DataQualitySummary>,
  });

  const issuesQuery = useQuery({
    queryKey: ['data-quality-issues', filter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filter === 'unresolved') params.resolved = 'false';
      if (filter === 'critical') {
        params.resolved = 'false';
        params.severity = 'CRITICAL';
      }
      return dataQualityApi.issues(params) as Promise<DataQualityIssue[]>;
    },
  });

  const handleOpenIssueSidecar = useCallback((issue: DataQualityIssue) => {
    playPop();
    const sidecarData: QuickLookData = {
      title: issue.message,
      subtitle: `${issue.entityType} • Field: ${issue.field || 'General Record'}`,
      badge: issue.severity,
      status: {
        label: issue.resolvedAt ? 'Issue Resolved' : `Open ${issue.severity} Priority`,
        tone: issue.resolvedAt ? 'success' : issue.severity === 'CRITICAL' ? 'error' : issue.severity === 'HIGH' ? 'warning' : 'primary',
      },
      metrics: [
        { label: 'Severity Level', value: issue.severity },
        { label: 'Entity Scope', value: issue.entityType },
        { label: 'Target Field', value: issue.field || 'Record Level' },
        { label: 'Detection Date', value: formatDate(issue.detectedAt) },
      ],
      details: [
        { label: 'Issue Identifier', value: issue.id },
        { label: 'Engine Rule ID', value: issue.ruleId },
        { label: 'Entity Reference ID', value: issue.entityId },
        { label: 'Resolution State', value: issue.resolvedAt ? `Resolved on ${formatDate(issue.resolvedAt)}` : 'Awaiting Resolution' },
        { label: 'Resolved By User', value: issue.resolvedBy || 'None' },
      ],
    };
    openSidecar(sidecarData);
  }, [playTick]);

  const runMutation = useMutation({
    mutationFn: () => dataQualityApi.run() as Promise<{ created?: number }>,
    onSuccess: (data) => {
      playSuccess();
      toast.success(
        t('dataQualityCenter.checksComplete'),
        data?.created != null ? t('dataQualityCenter.newIssues', { n: data.created }) : undefined,
      );
      queryClient.invalidateQueries({ queryKey: ['data-quality-summary'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-issues'] });
    },
    onError: (e) => {
      playError();
      toast.error(t('dataQualityCenter.runFailed'), getErrorMessage(e));
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => dataQualityApi.resolve(id),
    onSuccess: () => {
      playSuccess();
      toast.success(t('dataQualityCenter.resolved'));
      queryClient.invalidateQueries({ queryKey: ['data-quality-issues'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-summary'] });
    },
    onError: (e) => {
      playError();
      toast.error(t('dataQualityCenter.resolveFailed'), getErrorMessage(e));
    },
  });

  // Keyboard Shortcuts: 1 for unresolved, 2 for critical, 3 for all, R for run/refresh
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        playTick();
        setFilter('unresolved');
      } else if (e.key === '2') {
        e.preventDefault();
        playTick();
        setFilter('critical');
      } else if (e.key === '3') {
        e.preventDefault();
        playTick();
        setFilter('all');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        runMutation.mutate();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, runMutation]);

  const issues = Array.isArray(issuesQuery.data) ? issuesQuery.data : [];
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
        <div className="absolute -top-[12%] right-[15%] h-[400px] w-[500px] rounded-full bg-cyan-500/10 blur-[140px] dark:bg-cyan-600/[0.08]" />
        <div className="absolute top-[40%] left-[8%] h-[350px] w-[450px] rounded-full bg-brand-500/10 blur-[130px] dark:bg-blue-600/[0.07]" />
      </div>

      {/* ── Apple V2 Hero Header ── */}
      <div className="liquid-glass-card liquid-glass-surface relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between rounded-[2.25rem] border border-white/40 dark:border-white/10 p-6 sm:p-7 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)] backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-1 ring-white/30">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('dataQualityCenter.title')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                macOS Liquid Glass
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('dataQualityCenter.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton
            variant="primary"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="inline-flex items-center gap-2"
            icon={
              <svg className={`h-4 w-4 ${runMutation.isPending ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            }
          >
            <span>{runMutation.isPending ? t('automation.running') : t('dataQualityCenter.runAll')}</span>
            <kbd className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-white/20 ml-1">R</kbd>
          </GlassButton>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      {summary && (
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
          <StatCard label={t('dataQualityCenter.openIssues')} value={summary.total} color="error" />
          <StatCard label={t('dataQualityCenter.critical')} value={summary.bySeverity?.CRITICAL ?? 0} color="error" />
          <StatCard label={t('anomaly.highSeverity')} value={summary.bySeverity?.HIGH ?? 0} color="warning" />
          <StatCard label={t('dataQualityCenter.resolvedThisWeek')} value={summary.resolvedThisWeek} color="success" />
        </div>
      )}

      {/* ── Segmented Filter Tabs ── */}
      <div className="relative z-10 flex max-w-full overflow-x-auto scrollbar-none p-1.5 rounded-2xl liquid-glass-card liquid-glass-surface border border-white/40 dark:border-white/10 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl w-fit gap-1">
        {(['unresolved', 'critical', 'all'] as const).map((f, idx) => {
          const isActive = filter === f;
          return (
            <button
              key={f}
              onClick={() => {
                playTick();
                setFilter(f);
              }}
              className={`relative px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                isActive
                  ? 'text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="dataQualityActiveFilter"
                  transition={SPRING.snappy}
                  className="absolute inset-0 rounded-xl bg-white dark:bg-zinc-800 border border-black/[0.04] dark:border-white/[0.08] shadow-sm"
                />
              )}
              <span className="relative z-10">{t(FILTER_LABEL_KEY[f])}</span>
              <kbd className="relative z-10 hidden sm:inline-block text-[9px] font-mono px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-zinc-400">
                {idx + 1}
              </kbd>
            </button>
          );
        })}
      </div>

      {/* ── Issues List ── */}
      <div className="liquid-glass-card liquid-glass-surface relative z-10 overflow-hidden rounded-[2rem] border border-white/40 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
        {issuesQuery.isLoading ? (
          <div className="p-12"><GlassPageLoader label={t('dataQualityCenter.loading')} /></div>
        ) : issuesQuery.isError ? (
          <div className="p-8">
            <GlassErrorState
              title={t('dataQualityCenter.loadFailed')}
              message={getErrorMessage(issuesQuery.error)}
              onRetry={() => issuesQuery.refetch()}
            />
          </div>
        ) : issues.length === 0 ? (
          <div className="p-12">
            <GlassEmptyState
              title={t('dataQualityCenter.emptyTitle')}
              message={
                filter === 'critical'
                  ? t('dataQualityCenter.emptyCritical')
                  : filter === 'unresolved'
                  ? t('dataQualityCenter.emptyUnresolved')
                  : t('dataQualityCenter.empty')
              }
            />
          </div>
        ) : (
          <motion.ul
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="divide-y divide-white/20 dark:divide-white/[0.05]"
          >
            {issues.map((issue) => (
              <motion.li
                key={issue.id}
                variants={itemVariants}
                onClick={() => handleOpenIssueSidecar(issue)}
                className="group p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 transition-all duration-200 hover:bg-white/30 dark:hover:bg-white/[0.04] cursor-pointer"
              >
                <div className="shrink-0 mt-0.5">
                  <GlassBadge color={severityColor[issue.severity]}>{t(SEVERITY_LABEL_KEY[issue.severity])}</GlassBadge>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    {issue.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-xs text-zinc-400">
                    <span className="font-mono rounded bg-white/40 dark:bg-zinc-800/60 border border-black/[0.05] dark:border-white/10 px-1.5 py-0.5 text-zinc-700 dark:text-zinc-300">
                      {issue.entityType}
                    </span>
                    {issue.field && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-zinc-500">{issue.field}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDate(issue.detectedAt)}</span>
                  </div>
                </div>
                <div className="shrink-0 flex items-center justify-end w-full sm:w-auto gap-2 self-start sm:self-center mt-2 sm:mt-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenIssueSidecar(issue)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-white/40 dark:border-white/10 shadow-sm transition-all"
                    title="Quick Look Detail"
                  >
                    <span>◨</span>
                    <span>Sidecar</span>
                  </button>
                  <GlassButton
                    size="sm"
                    variant={issue.resolvedAt ? 'ghost' : 'secondary'}
                    onClick={() => resolveMutation.mutate(issue.id)}
                    disabled={!!issue.resolvedAt}
                  >
                    {issue.resolvedAt ? t('dataQualityCenter.resolvedButton') : t('dataQualityCenter.markResolved')}
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

function StatCard({ label, value, color }: { label: string; value: number; color: 'error' | 'warning' | 'success' | 'primary' }) {
  const colorClass = {
    error: 'text-rose-600 dark:text-rose-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    primary: 'text-cyan-600 dark:text-cyan-400',
  }[color];

  return (
    <div className="liquid-glass-card liquid-glass-surface rounded-3xl border border-white/40 dark:border-white/10 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
      <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-2xl sm:text-3xl font-bold tabular-nums tracking-tight ${colorClass}`}>{value}</div>
    </div>
  );
}

export default DataQualityCenterPage;

