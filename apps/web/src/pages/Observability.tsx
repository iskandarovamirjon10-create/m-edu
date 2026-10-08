import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import { GlassPageHeader, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton} from'@/components/ui';
import { observabilityApi} from'@/lib/api';
import { useI18n} from'@/i18n/I18nProvider';

type Tab ='health' |'queues' |'integrations' |'api-metrics';

function StatusDot({ status}: { status: string}) {
 const isOk = status ==='ok' || status ==='connected' || status ==='healthy' || status ==='configured' || status ==='implemented';
 const isDown = status ==='down' || status ==='error';
 return (
 <span
 className={`inline-block w-2.5 h-2.5 rounded-full ${
 isOk
 ?'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
 : isDown
 ?'bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)] animate-pulse'
 :'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
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

function GlassCard({ children, className =''}: { children: React.ReactNode; className?: string}) {
 return (
 <div className={`relative overflow-hidden rounded-[2rem] p-5 sm:p-6 glass-card ${className}`}>
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
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
 const { t} = useI18n();
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

 const isLoading = healthQuery.isLoading || metricsQuery.isLoading;

 if (healthQuery.isError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
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

 const health = healthQuery.data as any;
 const metrics = metricsQuery.data as any;
 const queues = (queueQuery.data as any[]) ?? [];
 const integrations = (integrationQuery.data as any[]) ?? [];
 const apiMetrics = apiMetricsQuery.data as any;
 const dbMetrics = dbQuery.data as any;

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 <div className="absolute top-[0%] left-[10%] w-[40%] h-[40%] rounded-full bg-brand-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-cyan-400/5 blur-[100px]"/>
 </div>

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

 <div className="flex gap-2 overflow-x-auto pb-2">
 {tabs.map((tab) => (
 <button
 key={tab.key}
 type="button"
 onClick={() => setActiveTab(tab.key)}
 className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[0.85rem] font-bold whitespace-nowrap transition-all duration-300 border ${
 activeTab === tab.key
 ?'bg-brand-500/15 text-brand-600 border-brand-500/30 shadow-[0_0_16px_rgba(84,115,252,0.15)]'
 :'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)]/60 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)]'
}`}
 >
 <StatusDot status={activeTab === tab.key ?'ok' :'unknown'} />
 {t(tab.labelKey)}
 </button>
 ))}
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
 <MetricRow label={t('obs.activeConnections')} value={dbMetrics.activeConnections} />
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
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-blue-600 ">{q.active}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-emerald-600 ">{q.completed}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-rose-600 ">{q.failed}</td>
 <td className="px-6 py-4 text-center text-[0.85rem] font-mono font-bold text-amber-600 ">{q.delayed}</td>
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
 <StatusDot status={intg.status} />
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
