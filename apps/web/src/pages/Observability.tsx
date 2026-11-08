import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { GlassPageHeader, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton } from '@/components/ui';
import { observabilityApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';

function AuroraMesh() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[10%] -left-[10%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-emerald-500/12 via-teal-500/8 to-transparent blur-[130px] dark:from-emerald-600/14 dark:via-teal-600/10" />
      <div className="absolute top-[25%] -right-[10%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-blue-500/12 via-indigo-500/8 to-transparent blur-[130px] dark:from-blue-600/14 dark:via-indigo-600/10" />
      <div className="absolute -bottom-[15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-cyan-500/10 via-purple-500/6 to-transparent blur-[120px] dark:from-cyan-600/12" />
    </div>
  );
}


export interface ServiceHealth {
  status?: string;
  responseTimeMs?: number;
}

export interface SystemHealthData {
  status?: string;
  uptime?: number;
  memory?: { heapUsed?: number; heapTotal?: number };
  services?: {
    postgres?: ServiceHealth;
    redis?: ServiceHealth;
    [key: string]: ServiceHealth | undefined;
  };
}

export interface SystemMetricsData {
  memory?: { total?: number; free?: number; used?: number };
  cpu?: { loadAverage?: { '1m'?: number; '5m'?: number; '15m'?: number } };
  nodeVersion?: string;
}

export interface QueueHealthData {
  name: string;
  waiting?: number;
  active?: number;
  completed?: number;
  failed?: number;
  delayed?: number;
  paused?: boolean;
}

export interface IntegrationData {
  name: string;
  status: string;
  latencyMs?: number;
  lastChecked?: string;
  error?: string | null;
}

export interface ApiMetricsData {
  p50?: number;
  p95?: number;
  p99?: number;
  totalRequests?: number;
  errorRate?: number;
  topEndpoints?: Array<{ path: string; count: number; avgLatency: number }>;
  avgResponseTimeMs?: number;
  requestsPerMinute?: number;
  p95ResponseTimeMs?: number;
  p99ResponseTimeMs?: number;
  endpointBreakdown?: Array<{ method: string; path: string; count: number; avgResponseTimeMs: number; errorCount: number }>;
}

export interface DbMetricsData {
  activeConnections?: number;
  cacheHitRatio?: number;
  totalQueries?: number;
  slowQueries?: number;
}

type Tab = 'health' | 'queues' | 'integrations' | 'api-metrics';

function StatusDot({ status }: { status: string }) {
  const isOk = status === 'ok' || status === 'connected' || status === 'healthy' || status === 'configured' || status === 'implemented';
  const isDown = status === 'down' || status === 'error';
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        isOk
          ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
          : isDown
          ? 'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)] animate-pulse'
          : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
      }`}
    />
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`liquid-glass-card liquid-glass-surface relative overflow-hidden rounded-2xl p-5 sm:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ${className}`}>
      <div className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5" aria-hidden />
      {children}
    </div>
  );
}

function MetricRow({ label, value}: { label: string; value: string | number}) {
 return (
 <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)] last:border-0">
 <span className="text-[0.8rem] font-medium text-[var(--text-muted)]">{label}</span>
 <span className="text-[0.85rem] font-bold text-[var(--text-primary)] font-mono">{value}</span>
 </div>
 );
}

export function ObservabilityPage() {
  const { t } = useSafeI18n();
 const [activeTab, setActiveTab] = useState<Tab>('health');
 const [autoRefresh, setAutoRefresh] = useState(false);

 const healthQuery = useQuery({
 queryKey: ['observability-health'],
 queryFn: () => observabilityApi.health(),
 refetchInterval: autoRefresh ? 30000 : false,
 retry: 1,
});

 const metricsQuery = useQuery({
 queryKey: ['observability-metrics'],
 queryFn: () => observabilityApi.metrics(),
 refetchInterval: autoRefresh ? 30000 : false,
 retry: 1,
});

 const queueQuery = useQuery({
 queryKey: ['observability-queues'],
 queryFn: () => observabilityApi.queues(),
 refetchInterval: autoRefresh ? 30000 : false,
 retry: 1,
 enabled: activeTab ==='queues',
});

 const integrationQuery = useQuery({
 queryKey: ['observability-integrations'],
 queryFn: () => observabilityApi.integrations(),
 refetchInterval: autoRefresh ? 30000 : false,
 retry: 1,
 enabled: activeTab ==='integrations',
});

 const apiMetricsQuery = useQuery({
 queryKey: ['observability-api-metrics'],
 queryFn: () => observabilityApi.apiMetrics(),
 refetchInterval: autoRefresh ? 30000 : false,
 retry: 1,
 enabled: activeTab ==='api-metrics',
});

 const dbQuery = useQuery({
  queryKey: ['observability-database'],
  queryFn: () => observabilityApi.database(),
  refetchInterval: autoRefresh ? 30000 : false,
  retry: 1,
 });

 const { playTick, playPop } = usePremiumSound();

 const handleOpenQueueSidecar = useCallback((q: any) => {
   playPop();
   const sidecarData: QuickLookData = {
     type: 'general',
     id: q.name,
     title: q.name,
     subtitle: `Navbat telemetriyasi · ${q.status}`,
     status: {
       label: String(q.status).toUpperCase(),
       tone: q.status === 'ok' || q.status === 'healthy' ? 'green' : 'amber',
     },
     metrics: [
       { label: 'Kutilmoqda', value: String(q.waiting ?? 0) },
       { label: 'Faol', value: String(q.active ?? 0) },
       { label: 'Bajarildi', value: String(q.completed ?? 0) },
       { label: 'Xato', value: String(q.failed ?? 0) },
     ],
     details: [
       { label: 'Navbat nomi', value: q.name },
       { label: 'Holati', value: q.status },
       { label: 'Kutilayotgan ishlar', value: String(q.waiting ?? 0) },
       { label: 'Ayni paytda faol', value: String(q.active ?? 0) },
       { label: 'Muvaffaqiyatli', value: String(q.completed ?? 0) },
       { label: 'Xatolar soni', value: String(q.failed ?? 0) },
       { label: 'Kechiktirilgan', value: String(q.delayed ?? 0) },
     ],
   };
   openSidecar(sidecarData);
 }, [playPop]);

 const handleOpenEndpointSidecar = useCallback((ep: any) => {
   playPop();
   const sidecarData: QuickLookData = {
     type: 'general',
     id: `${ep.method}-${ep.path}`,
     title: `${ep.method} ${ep.path}`,
     subtitle: `API Telemetriyasi · ${Math.round(ep.avgResponseTimeMs)}ms o'rtacha`,
     status: {
       label: `${Math.round(ep.avgResponseTimeMs)}ms`,
       tone: ep.errorCount > 0 ? 'red' : 'green',
     },
     metrics: [
       { label: 'Method', value: ep.method },
       { label: 'So\'rovlar soni', value: String(ep.count) },
       { label: 'O\'rtacha vaqt', value: `${Math.round(ep.avgResponseTimeMs)}ms` },
       { label: 'Xatolar', value: String(ep.errorCount) },
     ],
     details: [
       { label: 'HTTP Method', value: ep.method },
       { label: 'Endpoint Path', value: ep.path, copyable: true },
       { label: 'Jami so\'rovlar', value: String(ep.count) },
       { label: 'O\'rtacha javob vaqti', value: `${Math.round(ep.avgResponseTimeMs)} ms` },
       { label: 'Xatoliklar soni', value: String(ep.errorCount) },
     ],
   };
   openSidecar(sidecarData);
 }, [playPop]);

 const handleOpenIntegrationSidecar = useCallback((intg: any) => {
   playPop();
   const sidecarData: QuickLookData = {
     type: 'general',
     id: intg.name,
     title: intg.name,
     subtitle: `Integratsiya xizmati · ${intg.status}`,
     status: {
       label: String(intg.status).toUpperCase(),
       tone: intg.status === 'ok' || intg.status === 'connected' ? 'green' : 'amber',
     },
     metrics: [
       { label: 'Xizmat', value: intg.name },
       { label: 'Holat', value: intg.status },
       { label: 'Tafsilot', value: String(intg.details || '—') },
     ],
     details: [
       { label: 'Integratsiya nomi', value: intg.name },
       { label: 'Ulanish holati', value: intg.status },
       { label: 'Tafsilotlar', value: String(intg.details || '—') },
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
       setActiveTab('health');
     } else if (e.key === '2') {
       playTick();
       setActiveTab('queues');
     } else if (e.key === '3') {
       playTick();
       setActiveTab('integrations');
     } else if (e.key === '4') {
       playTick();
       setActiveTab('api-metrics');
     } else if (e.key === 'r' || e.key === 'R') {
       e.preventDefault();
       playTick();
       void healthQuery.refetch();
       void metricsQuery.refetch();
       void queueQuery.refetch();
       void integrationQuery.refetch();
       void apiMetricsQuery.refetch();
       void dbQuery.refetch();
     } else if (e.key === 'a' || e.key === 'A') {
       e.preventDefault();
       playTick();
       setAutoRefresh((prev) => !prev);
     }
   };
   window.addEventListener('keydown', handleKeyDown);
   return () => window.removeEventListener('keydown', handleKeyDown);
 }, [playTick, healthQuery, metricsQuery, queueQuery, integrationQuery, apiMetricsQuery, dbQuery]);

 const isLoading = healthQuery.isLoading || metricsQuery.isLoading;

 if (healthQuery.isError) {
 return (
 <div className="min-h-full bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassErrorState message={(healthQuery.error as Error)?.message ??'Failed to load health data'} onRetry={() => healthQuery.refetch()} />
 </div>
 );
}

 const tabs: Array<{ key: Tab; label: string; labelKey: string}> = [
 { key:'health', label:'System Health', labelKey:'obs.tabHealth'},
 { key:'queues', label:'Queue Health', labelKey:'obs.tabQueues'},
 { key:'integrations', label:'Integrations', labelKey:'obs.tabIntegrations'},
 { key:'api-metrics', label:'API Metrics', labelKey:'obs.tabApiMetrics'},
 ];

 const health = healthQuery.data as SystemHealthData | undefined;
 const metrics = metricsQuery.data as SystemMetricsData | undefined;
 const queues = (queueQuery.data as QueueHealthData[] | undefined) ?? [];
 const integrations = (integrationQuery.data as IntegrationData[] | undefined) ?? [];
 const apiMetrics = apiMetricsQuery.data as ApiMetricsData | undefined;
 const dbMetrics = dbQuery.data as DbMetricsData | undefined;

  return (
    <div className="relative min-h-full bg-transparent selection:bg-brand-500/30 pb-[max(6rem,env(safe-area-inset-bottom))]">
      <AuroraMesh />

 <div className="relative z-10 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <GlassPageHeader title={t('obs.title')} subtitle={t('obs.subtitle')} />
 <GlassButton
 type="button"
 variant={autoRefresh ?'primary' :'secondary'}
 size="sm"
 onClick={() => setAutoRefresh(!autoRefresh)}
 icon={<span className={`w-2 h-2 rounded-full ${autoRefresh ?'bg-emerald-400 animate-pulse' :'bg-gray-400'}`} />}
 >
 {autoRefresh ? (t('obs.autoRefreshOn') || 'Auto-refresh ON') : (t('obs.autoRefreshOff') || 'Auto-refresh OFF')}
 </GlassButton>
 </div>

 <div className="flex gap-1.5 p-1.5 rounded-2xl bg-[var(--bg-card)]/60 backdrop-blur-md border border-[var(--border-subtle)] w-fit overflow-x-auto max-w-full">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-[0.85rem] font-semibold transition-colors duration-200 whitespace-nowrap z-10 ${
                isActive
                  ? 'text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="obs-tab-pill"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-white/80 dark:bg-white/15 border border-black/5 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.06)] -z-10"
                />
              )}
              <StatusDot status={isActive ? 'ok' : 'unknown'} />
              <span>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><GlassPageLoader label={t('common.loading')} /></div>
      ) : (
 <>
 {activeTab ==='health' && (
 <div className="space-y-6">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 <GlassCard>
 <div className="relative z-10 flex flex-col gap-3">
 <div className="flex items-center justify-between">
 <h3 className="text-[0.95rem] font-bold text-[var(--text-primary)]">{t('obs.postgres')}</h3>
 <StatusDot status={health?.services?.postgres?.status ??'unknown'} />
 </div>
 <MetricRow label={t('obs.status')} value={health?.services?.postgres?.status ??'—'} />
 <MetricRow label={t('obs.responseTime')} value={health?.services?.postgres?.responseTimeMs !== undefined ? `${health.services.postgres.responseTimeMs}ms` :'—'} />
 {dbMetrics && (
 <>
 <MetricRow label={t('obs.activeConnections')} value={dbMetrics.activeConnections ?? '—'} />
 <MetricRow label={t('obs.cacheHitRatio')} value={`${dbMetrics.cacheHitRatio}%`} />
 </>
 )}
 </div>
 </GlassCard>

 <GlassCard>
 <div className="relative z-10 flex flex-col gap-3">
 <div className="flex items-center justify-between">
 <h3 className="text-[0.95rem] font-bold text-[var(--text-primary)]">Redis</h3>
 <StatusDot status={health?.services?.redis?.status ??'unknown'} />
 </div>
 <MetricRow label={t('obs.status')} value={health?.services?.redis?.status ??'—'} />
 <MetricRow label={t('obs.responseTime')} value={health?.services?.redis?.responseTimeMs !== undefined ? `${health.services.redis.responseTimeMs}ms` :'—'} />
 </div>
 </GlassCard>

 <GlassCard>
 <div className="relative z-10 flex flex-col gap-3">
 <div className="flex items-center justify-between">
 <h3 className="text-[0.95rem] font-bold text-[var(--text-primary)]">{t('obs.system')}</h3>
 <StatusDot status="ok"/>
 </div>
 <MetricRow label={t('obs.uptime')} value={health?.uptime !== undefined ? formatUptime(health.uptime) :'—'} />
 <MetricRow label={t('obs.memoryUsed')} value={health?.memory?.heapUsed !== undefined ? formatBytes(health.memory.heapUsed) :'—'} />
 <MetricRow label={t('obs.memoryTotal')} value={metrics?.memory?.total !== undefined ? formatBytes(metrics.memory.total) :'—'} />
 <MetricRow label={t('obs.cpuLoad')} value={metrics?.cpu?.loadAverage ? `${metrics.cpu.loadAverage['1m']}` :'—'} />
 <MetricRow label={t('obs.nodeVersion')} value={metrics?.nodeVersion ??'—'} />
 </div>
 </GlassCard>
 </div>
 </div>
 )}

 {activeTab ==='queues' && (
 <div className="space-y-6">
 {queueQuery.isLoading ? (
 <div className="flex justify-center py-16"><GlassPageLoader label={t('common.loading')} /></div>
 ) : queues.length === 0 ? (
 <GlassEmptyState title={t('obs.noQueues')} message={t('obs.noQueuesDesc')} />
 ) : (
 <GlassCard className="!p-0 overflow-hidden">
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] ">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{t('obs.queueStatus')}</h2>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]">
 <th className="px-6 py-3 text-left text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.queueName')}</th>
 <th className="px-6 py-3 text-left text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.status')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.waiting')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.active')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.completed')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.failed')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.delayed')}</th>
 <th className="px-6 py-3 text-right text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sidecar</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-white/5">
 {queues.map((q: any) => (
 <tr key={q.name} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <td className="px-6 py-4 text-[0.9rem] font-bold text-[var(--text-primary)] font-mono">{q.name}</td>
 <td className="px-6 py-4">
 <div className="flex items-center gap-2">
 <StatusDot status={q.status} />
 <span className="text-[0.8rem] font-medium text-[var(--text-secondary)] ">{q.status}</span>
 </div>
 </td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-[var(--text-secondary)]">{q.waiting}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-brand-600 ">{q.active}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-emerald-600 ">{q.completed}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-rose-600 ">{q.failed}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-amber-600 ">{q.delayed}</td>
 <td className="px-6 py-4 text-right">
   <button
     type="button"
     onClick={() => handleOpenQueueSidecar(q)}
     className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70 shadow-sm transition-all hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:text-cyan-400"
     title="macOS Split-View Sidecar (◨)"
   >
     <span>◨</span>
     <span className="hidden sm:inline">Sidecar</span>
   </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </GlassCard>
 )}
 </div>
 )}

 {activeTab ==='integrations' && (
 <div className="space-y-6">
 {integrationQuery.isLoading ? (
 <div className="flex justify-center py-16"><GlassPageLoader label={t('common.loading')} /></div>
 ) : integrations.length === 0 ? (
 <GlassEmptyState title={t('obs.noIntegrations')} message={t('obs.noIntegrationsDesc')} />
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {integrations.map((intg: any) => (
 <GlassCard key={intg.name}>
 <div className="relative z-10 flex flex-col gap-3">
 <div className="flex items-center justify-between">
 <h3 className="text-[0.95rem] font-bold text-[var(--text-primary)]">{intg.name}</h3>
 <div className="flex items-center gap-2">
   <button
     type="button"
     onClick={() => handleOpenIntegrationSidecar(intg)}
     className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70 shadow-sm transition-all hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:text-cyan-400"
     title="macOS Split-View Sidecar (◨)"
   >
     <span>◨</span>
     <span className="hidden sm:inline">Sidecar</span>
   </button>
   <StatusDot status={intg.status} />
 </div>
 </div>
 <MetricRow label={t('obs.status')} value={intg.status} />
 <MetricRow label={t('obs.details')} value={intg.details} />
 </div>
 </GlassCard>
 ))}
 </div>
 )}
 </div>
 )}

 {activeTab ==='api-metrics' && (
 <div className="space-y-6">
 {apiMetricsQuery.isLoading ? (
 <div className="flex justify-center py-16"><GlassPageLoader label={t('common.loading')} /></div>
 ) : !apiMetrics ? (
 <GlassEmptyState title={t('obs.noMetrics')} message={t('obs.noMetricsDesc')} />
 ) : (
 <>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
 <GlassCard>
 <div className="relative z-10 text-center">
 <p className="text-[1.75rem] font-black text-[var(--text-primary)]">{apiMetrics.totalRequests}</p>
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t('obs.totalRequests')}</p>
 </div>
 </GlassCard>
 <GlassCard>
 <div className="relative z-10 text-center">
 <p className="text-[1.75rem] font-black text-rose-500">{apiMetrics.errorRate}%</p>
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t('obs.errorRate')}</p>
 </div>
 </GlassCard>
 <GlassCard>
 <div className="relative z-10 text-center">
 <p className="text-[1.75rem] font-black text-[var(--text-primary)]">{apiMetrics.avgResponseTimeMs}ms</p>
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t('obs.avgResponseTime')}</p>
 </div>
 </GlassCard>
 <GlassCard>
 <div className="relative z-10 text-center">
 <p className="text-[1.75rem] font-black text-[var(--text-primary)]">{apiMetrics.requestsPerMinute}</p>
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">{t('obs.requestsPerMinute')}</p>
 </div>
 </GlassCard>
 </div>

 <GlassCard className="!p-0 overflow-hidden">
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center gap-4">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{t('obs.endpointBreakdown')}</h2>
 <div className="flex items-center gap-3 ml-auto">
 <span className="px-3 py-1 rounded-full bg-[var(--state-hover)] text-[0.7rem] font-bold text-[var(--text-muted)]">
 {t('obs.p95') || 'P95'}: {apiMetrics.p95ResponseTimeMs}ms
 </span>
 <span className="px-3 py-1 rounded-full bg-[var(--state-hover)] text-[0.7rem] font-bold text-[var(--text-muted)]">
 {t('obs.p99') || 'P99'}: {apiMetrics.p99ResponseTimeMs}ms
 </span>
 </div>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]">
 <th className="px-6 py-3 text-left text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.method')}</th>
 <th className="px-6 py-3 text-left text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.path')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.count')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.avgMs')}</th>
 <th className="px-6 py-3 text-center text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('obs.errors')}</th>
 <th className="px-6 py-3 text-right text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sidecar</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-white/5">
 {(apiMetrics.endpointBreakdown ?? []).slice(0, 20).map((ep: any, idx: number) => (
 <tr key={`${ep.method}-${ep.path}-${idx}`} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <td className="px-6 py-3 text-[0.8rem] font-bold text-[var(--text-primary)] font-mono">{ep.method}</td>
 <td className="px-6 py-3 text-[0.8rem] font-medium text-[var(--text-secondary)] font-mono truncate max-w-xs">{ep.path}</td>
 <td className="px-6 py-3 text-center text-[0.85rem] font-mono font-bold text-[var(--text-secondary)]">{ep.count}</td>
 <td className="px-6 py-3 text-center text-[0.85rem] font-mono font-bold text-[var(--text-secondary)]">{Math.round(ep.avgResponseTimeMs)}ms</td>
 <td className="px-6 py-3 text-center text-[0.85rem] font-mono font-bold text-rose-600 ">{ep.errorCount}</td>
 <td className="px-6 py-3 text-right">
   <button
     type="button"
     onClick={() => handleOpenEndpointSidecar(ep)}
     className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-black/[0.03] px-2 py-0.5 text-[11px] font-semibold text-black/70 shadow-sm transition-all hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80 dark:hover:text-cyan-400"
     title="macOS Split-View Sidecar (◨)"
   >
     <span>◨</span>
     <span className="hidden sm:inline">Sidecar</span>
   </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </GlassCard>
 </>
 )}
 </div>
 )}
 </>
 )}
 </div>
 </div>
 );
}

export default ObservabilityPage;
