/**
 * M-EDU System Health Page
 * System infrastructure monitoring, database connectivity, cache status, and service health checks.
 */

import { useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassStatCard } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
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
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

type ComponentStatus = 'ok' | 'warning' | 'error' | 'down' | 'unknown';

interface SystemComponent {
  name: string;
  status: ComponentStatus;
  responseTime?: number;
  details?: string;
}

interface SystemSummary {
  uptime: number;
  avgResponseTime: number;
  lastIncidentAt?: string;
  totalErrors: number;
}

interface RecentError {
  id: string;
  timestamp: string;
  endpoint: string;
  statusCode: number;
  message?: string;
}

const COMPONENT_LABELS: Record<string, { labelKey: string; descriptionKey: string }> = {
  api: { labelKey: 'systemHealth.component.api', descriptionKey: 'systemHealth.component.apiDesc' },
  database: { labelKey: 'systemHealth.component.database', descriptionKey: 'systemHealth.component.databaseDesc' },
  storage: { labelKey: 'systemHealth.component.storage', descriptionKey: 'systemHealth.component.storageDesc' },
  cache: { labelKey: 'systemHealth.component.cache', descriptionKey: 'systemHealth.component.cacheDesc' },
  backgroundJobs: { labelKey: 'systemHealth.component.backgroundJobs', descriptionKey: 'systemHealth.component.backgroundJobsDesc' },
  notifications: { labelKey: 'systemHealth.component.notifications', descriptionKey: 'systemHealth.component.notificationsDesc' },
};

const STATUS_BADGE_COLOR: Record<ComponentStatus, 'success' | 'warning' | 'error' | 'muted'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
  down: 'error',
  unknown: 'muted',
};

const STATUS_LABEL_KEYS: Record<ComponentStatus, string> = {
  ok: 'systemHealth.status.ok',
  warning: 'systemHealth.status.warning',
  error: 'systemHealth.status.error',
  down: 'systemHealth.status.down',
  unknown: 'common.unknown',
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ComponentStatusCard({
  name,
  status,
  responseTime,
  onOpenSidecar,
}: {
  name: string;
  status: ComponentStatus;
  responseTime?: number;
  onOpenSidecar: () => void;
}) {
  const { t } = useSafeI18n();
  const info = COMPONENT_LABELS[name] ?? { labelKey: '', descriptionKey: '' };
  const isHealthy = status === 'ok';

  return (
    <motion.div
      variants={cardVariants}
      className="liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between gap-3 group transition-all duration-300 hover:border-black/10 dark:hover:border-white/15"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'}`} />
            <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{info.labelKey ? t(info.labelKey) : name}</h4>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{info.descriptionKey ? t(info.descriptionKey) : ''}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenSidecar}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] gap-1 rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold text-black/70 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:text-emerald-400"
            title="macOS Split-View Sidecar (◨)"
          >
            <span>◨</span>
            <span className="hidden sm:inline">Sidecar</span>
          </button>
          <GlassBadge color={STATUS_BADGE_COLOR[status]}>
            {t(STATUS_LABEL_KEYS[status])}
          </GlassBadge>
        </div>
      </div>
      {responseTime !== undefined && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
          <span>{t('systemHealth.responseTime')}</span>
          <span className="font-mono font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">{formatResponseTime(responseTime)}</span>
        </div>
      )}
    </motion.div>
  );
}

export function SystemHealthPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('systemHealth.title'));
  const { playTick, playPop } = usePremiumSound();

  const summaryQuery = useQuery({
    queryKey: ['system-health-summary'],
    queryFn: () => request('/system-health/summary') as Promise<SystemSummary>,
    retry: 1,
  });

  const componentsQuery = useQuery({
    queryKey: ['system-health-components'],
    queryFn: () =>
      request('/system-health/components') as Promise<{
        components: SystemComponent[];
        recentErrors: RecentError[];
      }>,
    retry: 1,
  });

  const summary = summaryQuery.data;
  const { components = [], recentErrors = [] } = componentsQuery.data ?? {};

  const isLoading = summaryQuery.isLoading || componentsQuery.isLoading;
  const isError = summaryQuery.isError || componentsQuery.isError;
  const error = summaryQuery.error ?? componentsQuery.error;
  const refetch = useCallback(() => {
    if (summaryQuery.isError) summaryQuery.refetch();
    if (componentsQuery.isError) componentsQuery.refetch();
    if (!summaryQuery.isError && !componentsQuery.isError) {
      void summaryQuery.refetch();
      void componentsQuery.refetch();
    }
  }, [summaryQuery, componentsQuery]);

  const handleOpenComponentSidecar = useCallback((component: SystemComponent) => {
    playPop();
    const info = COMPONENT_LABELS[component.name] ?? { labelKey: '', descriptionKey: '' };
    const label = info.labelKey ? t(info.labelKey) : component.name;
    const sidecarData: QuickLookData = {
      type: 'general',
      id: component.name,
      title: label,
      subtitle: `Tizim komponenti · ${component.status}`,
      badge: {
        text: component.status.toUpperCase(),
        tone: component.status === 'ok' ? 'emerald' : component.status === 'warning' ? 'amber' : 'rose',
      },
      metrics: [
        { label: 'Holati', value: component.status },
        { label: 'Javob vaqti', value: component.responseTime !== undefined ? formatResponseTime(component.responseTime) : '—' },
        { label: 'Komponent', value: component.name },
      ],
      details: [
        { label: 'Komponent nomi', value: label },
        { label: 'Tizim kaliti', value: component.name },
        { label: 'Holat kodi', value: component.status },
        { label: 'Tavsif', value: info.descriptionKey ? t(info.descriptionKey) : '—' },
        { label: 'Javob vaqti', value: component.responseTime !== undefined ? `${component.responseTime} ms` : 'N/A' },
      ],
    };
    openSidecar(sidecarData);
  }, [playPop, t]);

  const handleOpenErrorSidecar = useCallback((err: RecentError) => {
    playPop();
    const sidecarData: QuickLookData = {
      type: 'general',
      id: err.id,
      title: `${err.statusCode} · ${err.endpoint}`,
      subtitle: `Tizim xatoligi · ${new Date(err.timestamp).toLocaleTimeString()}`,
      badge: {
        text: String(err.statusCode),
        tone: err.statusCode >= 500 ? 'rose' : 'amber',
      },
      metrics: [
        { label: 'Status Code', value: String(err.statusCode) },
        { label: 'Endpoint', value: err.endpoint },
        { label: 'Vaqt', value: new Date(err.timestamp).toLocaleTimeString() },
      ],
      details: [
        { label: 'Xatolik ID', value: err.id, copyable: true },
        { label: 'Endpoint', value: err.endpoint, copyable: true },
        { label: 'HTTP Status', value: String(err.statusCode) },
        { label: 'Xabar', value: err.message || '—' },
        { label: 'Sana va vaqt', value: new Date(err.timestamp).toLocaleString() },
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
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        playTick();
        refetch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playTick, refetch]);

  const componentMap = new Map(components.map((c) => [c.name, c]));
  const displayComponents: SystemComponent[] = [
    { name: 'api', status: componentMap.get('api')?.status ?? 'unknown', responseTime: componentMap.get('api')?.responseTime },
    { name: 'database', status: componentMap.get('database')?.status ?? 'unknown' },
    { name: 'storage', status: componentMap.get('storage')?.status ?? 'unknown' },
    { name: 'cache', status: componentMap.get('cache')?.status ?? 'unknown' },
    { name: 'backgroundJobs', status: componentMap.get('backgroundJobs')?.status ?? 'unknown' },
    { name: 'notifications', status: componentMap.get('notifications')?.status ?? 'unknown' },
  ];

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative min-h-screen bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      {/* Ambient background lighting */}
      <AuroraMesh variant="corporate" />

      {/* ── Apple V2 Hero Header ── */}
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {t('systemHealth.title')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                v2 Apple
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('systemHealth.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <GlassStatCard
          label={t('systemHealth.uptime')}
          value={summary?.uptime ? formatUptime(summary.uptime) : '—'}
          trend={{ value: 'Operational', direction: 'up' }}
        />
        <GlassStatCard
          label={t('systemHealth.avgResponse')}
          value={summary?.avgResponseTime ? formatResponseTime(summary.avgResponseTime) : '—'}
        />
        <GlassStatCard
          label={t('systemHealth.totalErrors')}
          value={summary?.totalErrors ?? 0}
        />
        <GlassStatCard
          label={t('systemHealth.lastIncident')}
          value={summary?.lastIncidentAt
            ? new Date(summary.lastIncidentAt).toLocaleDateString()
            : t('systemHealth.noIncident')
          }
        />
      </div>

      {/* ── Approach Architecture Card ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl liquid-glass-surface p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          {t('systemHealth.approachTitle')}
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600 dark:text-slate-400">
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span><strong className="text-slate-900 dark:text-slate-200">{t('systemHealth.ruleBased')}</strong> — {t('systemHealth.ruleBasedDesc')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span><strong className="text-slate-900 dark:text-slate-200">{t('systemHealth.noAnomaly')}</strong> — {t('systemHealth.noAnomalyDesc')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span><strong className="text-slate-900 dark:text-slate-200">{t('systemHealth.noAiMl')}</strong> — {t('systemHealth.noAiMlDesc')}</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-emerald-500 font-bold">✓</span>
            <span><strong className="text-slate-900 dark:text-slate-200">{t('systemHealth.transparentRules')}</strong> — {t('systemHealth.transparentRulesDesc')}</span>
          </li>
        </ul>
      </div>

      {/* ── Component Status Grid ── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4"
      >
        {displayComponents.map((component) => (
          <ComponentStatusCard
            key={component.name}
            name={component.name}
            status={component.status}
            responseTime={component.responseTime}
            onOpenSidecar={() => handleOpenComponentSidecar(component)}
          />
        ))}
      </motion.div>

      {/* ── Recent Errors Feed ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl liquid-glass-surface shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 dark:border-white/[0.08] flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{t('systemHealth.recentErrors')}</h3>
          <span className="text-xs text-slate-400 font-mono">{recentErrors.length} captured</span>
        </div>
        {isLoading ? (
          <div className="p-12"><GlassPageLoader label={t('systemHealth.loading')} /></div>
        ) : isError ? (
          <div className="p-8">
            <GlassErrorState
              message={getErrorMessage(error)}
              onRetry={refetch}
            />
          </div>
        ) : recentErrors.length === 0 ? (
          <div className="p-12">
            <GlassEmptyState
              title={t('systemHealth.noErrors')}
              message={t('systemHealth.noErrorsHint')}
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-white/[0.05]">
            {recentErrors.map((err) => (
              <li key={err.id} className="px-6 py-3.5 flex items-start justify-between gap-3 transition-colors duration-200 hover:bg-black/[0.015] dark:hover:bg-white/[0.015]">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="shrink-0 mt-0.5">
                    <GlassBadge color={err.statusCode >= 500 ? 'error' : 'warning'}>
                      {err.statusCode}
                    </GlassBadge>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{err.endpoint}</span>
                      {err.message && (
                        <>
                          <span>·</span>
                          <span className="truncate">{err.message}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(err.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenErrorSidecar(err)}
                  className="inline-flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px] gap-1 rounded-xl border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs font-semibold text-black/70 shadow-sm transition-all hover:border-emerald-400 hover:bg-emerald-50/50 hover:text-emerald-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:text-emerald-400"
                  title="macOS Split-View Sidecar (◨)"
                >
                  <span>◨</span>
                  <span className="hidden sm:inline">Sidecar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.main>
  );
}

export default SystemHealthPage;

