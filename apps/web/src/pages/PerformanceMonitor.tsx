/**
 * M-EDU PerformanceMonitorPage — 
 *
 * Real-time Backend Engine Performance, N+1 Query Audit & Endpoint Latency Analyzer.
 */

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GlassPageHeader,
  GlassPageLoader,
  GlassEmptyState,
  GlassErrorState,
} from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { performanceApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErrorMessage } from '@/lib/errorMessages';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

type Tab = 'audit' | 'slow' | 'recommendations';

interface AuditSummary {
  nPlusOneIssues: Array<{ file: string; line: number; method: string; pattern: string; severity: string }>;
  unboundedQueries: Array<{ file: string; line: number; model: string; method: string; suggestion: string }>;
  indexSuggestions: Array<{ model: string; fields: string[]; reason: string; sql: string }>;
  slowEndpoints: Array<{ endpoint: string; method: string; avgDuration: number; callCount: number; lastCalled: string }>;
  cacheStats: { dashboardKeys: number; executiveKeys: number; analyticsKeys: number; studentCountKeys: number; hits: number; misses: number; hitRate: number };
  summary: { totalIssues: number; criticalCount: number; warningCount: number; infoCount: number };
}

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

function SeverityBadge({ severity }: { severity: string }) {
  const isHigh = severity === 'HIGH';
  const isMed = severity === 'MEDIUM';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider ${
        isHigh
          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/25'
          : isMed
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/25'
            : 'bg-blue-500/15 text-brand-600 dark:text-brand-400 ring-1 ring-inset ring-blue-500/25'
      }`}
    >
      {severity}
    </span>
  );
}

export function PerformanceMonitorPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('performance.title') || 'Performance & Telemetry');
  const [activeTab, setActiveTab] = useState<Tab>('audit');

  const auditQuery = useQuery({
    queryKey: ['performance-audit'],
    queryFn: () => performanceApi.audit() as Promise<AuditSummary>,
    refetchInterval: 60000,
    retry: 1,
  });

  const audit = auditQuery.data;
  const { playTick, playPop } = usePremiumSound();

  const handleOpenNPlusOneSidecar = useCallback((issue: AuditSummary['nPlusOneIssues'][number]) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: `${issue.file}:${issue.line}`,
      title: `${issue.method} (N+1 Hazard)`,
      subtitle: `${issue.file}:${issue.line}`,
      badge: {
        text: issue.severity,
        tone: issue.severity === 'HIGH' ? 'rose' : 'amber',
      },
      metrics: [
        { label: 'Daraja', value: issue.severity },
        { label: 'Fayl', value: issue.file },
        { label: 'Qator', value: String(issue.line) },
        { label: 'Metod', value: issue.method },
      ],
      details: [
        { label: 'Fayl yo\'li', value: `${issue.file}:${issue.line}`, copyable: true },
        { label: 'Metod', value: issue.method },
        { label: 'Xavfli pattern', value: issue.pattern },
        { label: 'Jiddiylik', value: issue.severity },
      ],
    };
    openSidecar(sidecarData);
  }, [playPop]);

  const handleOpenSlowEndpointSidecar = useCallback((ep: AuditSummary['slowEndpoints'][number]) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: `${ep.method}-${ep.endpoint}`,
      title: `${ep.method} ${ep.endpoint}`,
      subtitle: `Kechikish: ${ep.avgDuration}ms · ${ep.callCount} ta so'rov`,
      badge: {
        text: `${ep.avgDuration}ms`,
        tone: ep.avgDuration > 1000 ? 'rose' : ep.avgDuration > 500 ? 'amber' : 'emerald',
      },
      metrics: [
        { label: 'Method', value: ep.method },
        { label: 'O\'rtacha vaqt', value: `${ep.avgDuration}ms` },
        { label: 'So\'rovlar soni', value: String(ep.callCount) },
        { label: 'Oxirgi chaqiruv', value: new Date(ep.lastCalled).toLocaleTimeString() },
      ],
      details: [
        { label: 'HTTP Method', value: ep.method },
        { label: 'Endpoint', value: ep.endpoint, copyable: true },
        { label: 'O\'rtacha davomiylik', value: `${ep.avgDuration} ms` },
        { label: 'Jami chaqiruvlar', value: String(ep.callCount) },
        { label: 'Oxirgi chaqirilgan vaqt', value: new Date(ep.lastCalled).toLocaleString() },
      ],
    };
    openSidecar(sidecarData);
  }, [playPop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === '1') {
        playTick();
        setActiveTab('audit');
      } else if (e.key === '2') {
        playTick();
        setActiveTab('slow');
      } else if (e.key === '3') {
        playTick();
        setActiveTab('recommendations');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        void auditQuery.refetch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, auditQuery]);

  if (auditQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <GlassPageLoader label={t('performance.loading') || 'Analyzing query plans & telemetry…'} />
      </div>
    );
  }

  if (auditQuery.isError) {
    return (
      <div className="p-8">
        <GlassErrorState
          message={getErrorMessage(auditQuery.error)}
          onRetry={() => auditQuery.refetch()}
        />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'audit', label: t('performance.totalIssues') || 'Query Audit', count: audit?.summary.totalIssues },
    { key: 'slow', label: t('performance.slowEndpoints') || 'Slow Endpoints', count: audit?.slowEndpoints.length },
    { key: 'recommendations', label: t('performance.recommendationsTitle') || 'Optimization Playbook' },
  ];

  return (
    <div className="relative min-h-screen px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8">
      {/* Ambient background glows */}
      <AuroraMesh variant="corporate" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <GlassPageHeader
          title={t('performance.title') || 'Engine Performance & Telemetry'}
          subtitle={t('performance.recommendationsTitle') || 'Real-time database query telemetry and endpoint latencies'}
        />

        {/* Top KPI Metrics Strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING.smooth}
            className="group relative overflow-hidden rounded-[1.75rem] liquid-glass-card liquid-glass-surface p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('performance.totalIssues') || 'Total Issues'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-[var(--text-primary)]">
              {audit?.summary.totalIssues ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.05 }}
            className="group relative overflow-hidden rounded-[1.75rem] liquid-glass-card liquid-glass-surface p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('performance.critical') || 'Critical (N+1)'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-rose-500">
              {audit?.summary.criticalCount ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.1 }}
            className="group relative overflow-hidden rounded-[1.75rem] liquid-glass-card liquid-glass-surface p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('performance.warnings') || 'Unbounded'}
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-amber-500">
              {audit?.summary.warningCount ?? 0}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.15 }}
            className="group relative overflow-hidden rounded-[1.75rem] liquid-glass-card liquid-glass-surface p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Cache Hit Rate
            </div>
            <div className="mt-2 text-3xl font-black tracking-tight text-emerald-500">
              {Math.round((audit?.cacheStats.hitRate ?? 0) * 100)}%
            </div>
          </motion.div>
        </div>

        {/* Segmented Control Filter Tabs */}
        <div className="flex items-center">
          <div className="inline-flex items-center gap-1 rounded-2xl liquid-glass-surface p-1 shadow-sm">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    playTick();
                    setActiveTab(tab.key);
                  }}
                  className={`relative inline-flex items-center justify-center min-h-[44px] rounded-xl px-4 py-2.5 text-[12.5px] font-bold transition-colors ${
                    isActive
                      ? 'text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="perf-tab-pill"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md"
                      transition={SPRING.smooth}
                    />
                  )}
                  <span className="relative z-10">
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="ml-1.5 opacity-75">({tab.count})</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Audit */}
        {activeTab === 'audit' && audit && (
          <div className="space-y-6">
            {audit.nPlusOneIssues.length > 0 && (
              <div className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:ring-white/[0.08]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    N+1 Query Hazards
                  </h3>
                  <span className="rounded-full bg-rose-500/15 px-3 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {audit.nPlusOneIssues.length} found
                  </span>
                </div>
                <div className="divide-y divide-white/40 dark:divide-white/[0.04]">
                  {audit.nPlusOneIssues.map((issue, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-4 py-3.5">
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <SeverityBadge severity={issue.severity} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[13px] font-bold text-[var(--text-primary)]">
                            {issue.file}:{issue.line}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                            {issue.method} — {issue.pattern}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          playTick();
                          handleOpenNPlusOneSidecar(issue);
                        }}
                        className="inline-flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px] gap-1.5 rounded-xl border border-white/20 bg-white/40 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                        title="Split View Sidecar"
                      >
                        <span>◨</span>
                        <span>Sidecar</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {audit.unboundedQueries.length > 0 && (
              <div className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:ring-white/[0.08]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Unbounded Query Warnings
                  </h3>
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    {audit.unboundedQueries.length} detected
                  </span>
                </div>
                <div className="divide-y divide-white/40 dark:divide-white/[0.04]">
                  {audit.unboundedQueries.map((q, idx) => (
                    <div key={idx} className="flex items-start gap-3 py-3.5">
                      <span className="shrink-0 rounded-lg bg-amber-500/15 px-2 py-1 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                        {q.model}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] font-bold text-[var(--text-primary)]">
                          {q.file}:{q.line}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{q.suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {audit.indexSuggestions.length > 0 && (
              <div className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:ring-white/[0.08]">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Index Recommendations
                  </h3>
                  <span className="rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold text-brand-600 dark:text-brand-400">
                    {audit.indexSuggestions.length} suggestions
                  </span>
                </div>
                <div className="divide-y divide-white/40 dark:divide-white/[0.04]">
                  {audit.indexSuggestions.map((s, idx) => (
                    <div key={idx} className="py-4">
                      <p className="text-[14px] font-bold text-[var(--text-primary)]">
                        {s.model} ({s.fields.join(', ')})
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--text-muted)]">{s.reason}</p>
                      <code className="mt-2 block overflow-x-auto rounded-xl bg-black/5 dark:bg-white/[0.04] p-3 font-mono text-[11.5px] text-[var(--text-secondary)]">
                        {s.sql}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {audit.nPlusOneIssues.length === 0 &&
              audit.unboundedQueries.length === 0 &&
              audit.indexSuggestions.length === 0 && (
                <div className="liquid-glass-surface rounded-3xl p-16 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:ring-white/[0.08]">
                  <GlassEmptyState
                    title={t('performance.noIssues') || 'Engine Optimized'}
                    message={t('performance.noIssuesDesc') || 'No N+1 queries or memory hazards detected in the active telemetry cycle.'}
                  />
                </div>
              )}
          </div>
        )}

        {/* Tab 2: Slow Endpoints */}
        {activeTab === 'slow' && (
          <div className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:ring-white/[0.08]">
            {(!audit?.slowEndpoints || audit.slowEndpoints.length === 0) ? (
              <div className="p-16">
                <GlassEmptyState
                  title={t('performance.noSlowEndpoints') || 'Sub-Millisecond Response Times'}
                  message={t('performance.noSlowEndpointsDesc') || 'All monitored HTTP endpoints responded within target SLAs.'}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-white/40 dark:border-white/[0.06]">
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('performance.colMethod') || 'Method'}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('performance.colEndpoint') || 'Endpoint'}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('performance.colAvgTime') || 'Avg Latency'}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('performance.colCalls') || 'Hits'}
                      </th>
                      <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        {t('performance.colLastCalled') || 'Last Executed'}
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Sidecar
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/30 dark:divide-white/[0.03]">
                    {audit.slowEndpoints.map((ep, idx) => (
                      <tr
                        key={idx}
                        className="transition-colors hover:bg-white/40 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-mono font-bold">
                          <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[11px] text-brand-600 dark:text-brand-400">
                            {ep.method}
                          </span>
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 font-mono font-medium text-[var(--text-primary)]">
                          {ep.endpoint}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-mono font-bold ${
                              ep.avgDuration > 1000
                                ? 'text-rose-500'
                                : ep.avgDuration > 500
                                  ? 'text-amber-500'
                                  : 'text-emerald-500'
                            }`}
                          >
                            {ep.avgDuration}ms
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">
                          {ep.callCount}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[var(--text-muted)]">
                          {new Date(ep.lastCalled).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              playTick();
                              handleOpenSlowEndpointSidecar(ep);
                            }}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] gap-1.5 rounded-xl border border-white/20 bg-white/40 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-[var(--text-primary)] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                            title="Split View Sidecar"
                          >
                            <span>◨</span>
                            <span>Sidecar</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Recommendations */}
        {activeTab === 'recommendations' && (
          <div className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:ring-white/[0.08]">
            <h3 className="mb-4 text-base font-bold text-[var(--text-primary)]">
              {t('performance.recommendationsTitle') || 'Architectural Optimizations'}
            </h3>
            <div className="divide-y divide-white/40 dark:divide-white/[0.04]">
              {[
                { title: 'Add database indexes for hot-path queries', desc: 'See PERFORMANCE_INDEXES.md for recommended CREATE INDEX statements targeting StudentGroup, FollowUp, Invoice, and Attendance tables.', severity: 'HIGH' },
                { title: 'Cache dashboard stats with 60s TTL', desc: 'DashboardService.getStats runs 8+ parallel queries. Use MemoryCache to eliminate redundant DB round-trips during rapid navigation.', severity: 'HIGH' },
                { title: 'Cache executive summary with 30s TTL', desc: 'ExecutiveSummaryService aggregates multiple heavy analytics queries. A 30s TTL balances freshness with load reduction.', severity: 'MEDIUM' },
                { title: 'Cache CRM analytics data', desc: 'CRM funnel, sources, and velocity queries are read-heavy and rarely change within a minute. Cache with 60s TTL.', severity: 'MEDIUM' },
                { title: 'Replace multiple count queries with aggregate', desc: 'StudentsService.remove makes 6 parallel count queries in Promise.all. Consider a single aggregate query for better performance at scale.', severity: 'LOW' },
                { title: 'Inline student data in payment creation', desc: 'PaymentsService.create fetches student data separately after the transaction for notification. Consider inlining this into the transaction.', severity: 'LOW' },
                { title: 'Monitor slow endpoints via MetricsInterceptor', desc: 'Requests exceeding 500ms are automatically logged. Review the Slow Endpoints tab periodically.', severity: 'INFO' },
              ].map((rec, idx) => (
                <div key={idx} className="flex items-start gap-4 py-4">
                  <SeverityBadge severity={rec.severity} />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{rec.title}</h4>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{rec.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PerformanceMonitorPage;
