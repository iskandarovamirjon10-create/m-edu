import { useState, useEffect, useCallback} from'react';
import { useQuery} from'@tanstack/react-query';
import { GlassPageHeader, GlassPageLoader, GlassEmptyState, GlassErrorState} from'@/components/ui';
import { performanceApi} from'@/lib/api';
import { useI18n} from'@/i18n/I18nProvider';
import { usePageTitle} from'@/hooks/usePageTitle';
import { getErrorMessage} from'@/lib/errorMessages';

type Tab ='audit' |'slow' |'recommendations';

interface AuditSummary {
 nPlusOneIssues: Array<{ file: string; line: number; method: string; pattern: string; severity: string}>;
 unboundedQueries: Array<{ file: string; line: number; model: string; method: string; suggestion: string}>;
 indexSuggestions: Array<{ model: string; fields: string[]; reason: string; sql: string}>;
 slowEndpoints: Array<{ endpoint: string; method: string; avgDuration: number; callCount: number; lastCalled: string}>;
 cacheStats: { dashboardKeys: number; executiveKeys: number; analyticsKeys: number; studentCountKeys: number; hits: number; misses: number; hitRate: number};
 summary: { totalIssues: number; criticalCount: number; warningCount: number; infoCount: number};
}

function StatCard({ label, value, color}: { label: string; value: string | number; color: string}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card ">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${color}`} aria-hidden />
 <div className="relative z-10 flex flex-col h-full">
 <p className="text-[1.75rem] font-black text-[var(--text-primary)] tracking-tight mb-1">{value}</p>
 <p className="text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
 </div>
 </div>
 );
}

function SeverityBadge({ severity}: { severity: string}) {
 const config = {
 HIGH:'bg-rose-500/10 text-rose-600 border-rose-500/20',
 MEDIUM:'bg-amber-500/10 text-amber-600 border-amber-500/20',
 LOW:'bg-blue-500/10 text-blue-600 border-blue-500/20',
}[severity] ||'bg-[var(--state-hover)] text-[var(--text-muted)] border-[var(--border-subtle)]';

 return (
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wider border ${config}`}>
 {severity}
 </span>
 );
}

export function PerformanceMonitorPage() {
 const { t} = useI18n();
 usePageTitle(t('performance.title'));
 const [activeTab, setActiveTab] = useState<Tab>('audit');

 const auditQuery = useQuery({
 queryKey: ['performance-audit'],
 queryFn: () => performanceApi.audit() as Promise<AuditSummary>,
 refetchInterval: 60000,
 retry: 1,
});

 const audit = auditQuery.data;

 const refetch = useCallback(() => {
 auditQuery.refetch();
}, [auditQuery]);

 useEffect(() => {
 const interval = setInterval(refetch, 60000);
 return () => clearInterval(interval);
}, [refetch]);

 if (auditQuery.isLoading) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <div className="flex items-center justify-center min-h-[60vh]">
 <GlassPageLoader label="Running performance audit…"/>
 </div>
 </div>
 );
}

 if (auditQuery.isError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassErrorState message={getErrorMessage(auditQuery.error)} onRetry={() => auditQuery.refetch()} />
 </div>
 );
}

 const tabs: { key: Tab; label: string; count?: number}[] = [
 { key:'audit', label:'Audit Summary', count: audit?.summary.totalIssues},
 { key:'slow', label:'Slow Endpoints', count: audit?.slowEndpoints.length},
 { key:'recommendations', label:'Recommendations'},
 ];

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 <div className="absolute top-[0%] left-[10%] w-[40%] h-[40%] rounded-full bg-brand-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-cyan-400/5 blur-[100px]"/>
 </div>

 <div className="relative z-10 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
 <GlassPageHeader
 title="Performance Monitor"
 subtitle="Static analysis, request metrics, and cache statistics"
 />

 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
 <StatCard label="Total Issues"value={audit?.summary.totalIssues ?? 0} color="bg-brand-500"/>
 <StatCard label="Critical"value={audit?.summary.criticalCount ?? 0} color="bg-rose-500"/>
 <StatCard label="Warnings"value={audit?.summary.warningCount ?? 0} color="bg-amber-500"/>
 <StatCard label="Cache Hit Rate"value={`${audit?.cacheStats.hitRate ?? 0}%`} color="bg-emerald-500"/>
 </div>

 <div className="flex gap-2 overflow-x-auto pb-1">
 {tabs.map((tab) => (
 <button
 key={tab.key}
 onClick={() => setActiveTab(tab.key)}
 className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[0.85rem] font-bold transition-all duration-300 whitespace-nowrap ${
 activeTab === tab.key
 ?'bg-brand-500 text-white shadow-[0_4px_12px_rgba(84,115,252,0.4)]'
 :'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)] border border-[var(--border-subtle)]/60'
}`}
 >
 {tab.label}
 {tab.count !== undefined && (
 <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-black ${activeTab === tab.key ?'bg-[var(--bg-card)]' :'bg-[var(--state-hover)]'}`}>
 {tab.count}
 </span>
 )}
 </button>
 ))}
 </div>

 {activeTab ==='audit' && audit && (
 <div className="space-y-6">
 {audit.nPlusOneIssues.length > 0 && (
 <div className="rounded-[2rem] glass-card overflow-hidden">
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">N+1 Query Issues</h2>
 <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[0.75rem] font-bold uppercase tracking-wider border border-rose-500/20">
 {audit.nPlusOneIssues.length} found
 </span>
 </div>
 <ul className="divide-y divide-gray-100 dark:divide-white/5">
 {audit.nPlusOneIssues.map((issue, idx) => (
 <li key={idx} className="px-6 py-4 flex items-start gap-4 hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <SeverityBadge severity={issue.severity} />
 <div className="flex-1 min-w-0">
 <p className="text-[0.9rem] font-bold text-[var(--text-primary)] font-mono truncate">{issue.file}:{issue.line}</p>
 <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">{issue.method} — {issue.pattern}</p>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}

 {audit.unboundedQueries.length > 0 && (
 <div className="rounded-[2rem] glass-card overflow-hidden">
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">Unbounded Queries</h2>
 <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[0.75rem] font-bold uppercase tracking-wider border border-amber-500/20">
 {audit.unboundedQueries.length} found
 </span>
 </div>
 <ul className="divide-y divide-gray-100 dark:divide-white/5">
 {audit.unboundedQueries.map((q, idx) => (
 <li key={idx} className="px-6 py-4 flex items-start gap-4 hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <div className="shrink-0 w-14 h-10 rounded-xl flex items-center justify-center text-[0.8rem] font-black tracking-wider border bg-amber-500/10 text-amber-600 border-amber-500/20">
 {q.model}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[0.9rem] font-bold text-[var(--text-primary)] font-mono truncate">{q.file}:{q.line}</p>
 <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">{q.suggestion}</p>
 </div>
 </li>
 ))}
 </ul>
 </div>
 )}

 {audit.indexSuggestions.length > 0 && (
 <div className="rounded-[2rem] glass-card overflow-hidden">
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">Missing Index Suggestions</h2>
 <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[0.75rem] font-bold uppercase tracking-wider border border-blue-500/20">
 {audit.indexSuggestions.length} suggestions
 </span>
 </div>
 <ul className="divide-y divide-gray-100 dark:divide-white/5">
 {audit.indexSuggestions.map((s, idx) => (
 <li key={idx} className="px-6 py-4 hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <p className="text-[0.9rem] font-bold text-[var(--text-primary)]">{s.model}({s.fields.join(',')})</p>
 <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">{s.reason}</p>
 <code className="block mt-2 px-3 py-2 rounded-xl bg-[var(--bg-surface)] text-[0.75rem] font-mono text-[var(--text-secondary)] border border-[var(--border-subtle)] overflow-x-auto">
 {s.sql}
 </code>
 </li>
 ))}
 </ul>
 </div>
 )}

 {audit.nPlusOneIssues.length === 0 && audit.unboundedQueries.length === 0 && audit.indexSuggestions.length === 0 && (
 <div className="rounded-[2rem] bg-[var(--bg-card)] backdrop-blur-[30px] border border-[var(--border-subtle)]/60 p-16">
 <GlassEmptyState title="No issues found"message="The codebase looks clean from a static analysis perspective."/>
 </div>
 )}
 </div>
 )}

 {activeTab ==='slow' && (
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">Slow Endpoints</h2>
 <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 text-[0.75rem] font-bold uppercase tracking-wider border border-brand-500/20">
 {audit?.slowEndpoints.length ?? 0} endpoints
 </span>
 </div>
 <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
 {(!audit?.slowEndpoints || audit.slowEndpoints.length === 0) ? (
 <div className="p-16">
 <GlassEmptyState title="No slow endpoints"message="No requests have exceeded the 500ms threshold yet. Metrics are collected in real-time."/>
 </div>
 ) : (
 <table className="w-full text-left">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]">
 <th className="px-6 py-3 text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Method</th>
 <th className="px-6 py-3 text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Endpoint</th>
 <th className="px-6 py-3 text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Avg Time</th>
 <th className="px-6 py-3 text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Calls</th>
 <th className="px-6 py-3 text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Last Called</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-100 dark:divide-white/5">
 {audit.slowEndpoints.map((ep, idx) => (
 <tr key={idx} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <td className="px-6 py-4">
 <span className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 text-[0.75rem] font-bold">{ep.method}</span>
 </td>
 <td className="px-6 py-4 text-[0.9rem] font-mono font-bold text-[var(--text-primary)] truncate max-w-xs">{ep.endpoint}</td>
 <td className="px-6 py-4">
 <span className={`text-[0.9rem] font-bold ${ep.avgDuration > 1000 ?'text-rose-500' : ep.avgDuration > 500 ?'text-amber-500' :'text-emerald-500'}`}>
 {ep.avgDuration}ms
 </span>
 </td>
 <td className="px-6 py-4 text-[0.9rem] font-bold text-[var(--text-secondary)]">{ep.callCount}</td>
 <td className="px-6 py-4 text-[0.8rem] font-medium text-[var(--text-muted)]">{new Date(ep.lastCalled).toLocaleTimeString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 )}
 </div>
 </div>
 )}

 {activeTab ==='recommendations' && (
 <div className="space-y-6">
 <div className="rounded-[2rem] glass-card overflow-hidden">
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] ">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">Performance Improvement Recommendations</h2>
 </div>
 <ul className="divide-y divide-gray-100 dark:divide-white/5">
 {[
 { title:'Add database indexes for hot-path queries', desc:'See PERFORMANCE_INDEXES.md for recommended CREATE INDEX statements targeting StudentGroup, FollowUp, Invoice, and Attendance tables.', severity:'HIGH'},
 { title:'Cache dashboard stats with 60s TTL', desc:'DashboardService.getStats runs 8+ parallel queries. Use MemoryCache to eliminate redundant DB round-trips during rapid navigation.', severity:'HIGH'},
 { title:'Cache executive summary with 30s TTL', desc:'ExecutiveSummaryService aggregates multiple heavy analytics queries. A 30s TTL balances freshness with load reduction.', severity:'MEDIUM'},
 { title:'Cache CRM analytics data', desc:'CRM funnel, sources, and velocity queries are read-heavy and rarely change within a minute. Cache with 60s TTL.', severity:'MEDIUM'},
 { title:'Replace multiple count queries with aggregate', desc:'StudentsService.remove makes 6 parallel count queries in Promise.all. Consider a single aggregate query for better performance at scale.', severity:'LOW'},
 { title:'Inline student data in payment creation', desc:'PaymentsService.create fetches student data separately after the transaction for notification. Consider inlining this into the transaction.', severity:'LOW'},
 { title:'Monitor slow endpoints via MetricsInterceptor', desc:'Requests exceeding 500ms are automatically logged. Review the Slow Endpoints tab periodically.', severity:'INFO'},
 ].map((rec, idx) => (
 <li key={idx} className="px-6 py-4 flex items-start gap-4 hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <SeverityBadge severity={rec.severity} />
 <div className="flex-1 min-w-0">
 <p className="text-[0.95rem] font-bold text-[var(--text-primary)]">{rec.title}</p>
 <p className="text-[0.8rem] font-medium text-[var(--text-muted)] mt-0.5">{rec.desc}</p>
 </div>
 </li>
 ))}
 </ul>
 </div>

 <div className="rounded-[2rem] bg-[var(--bg-card)] backdrop-blur-[30px] border border-[var(--border-subtle)]/60 p-6 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
 </div>
 <h3 className="text-[1rem] font-bold text-[var(--text-primary)]">Cache Statistics</h3>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
 <div>
 <p className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Hits</p>
 <p className="text-[1.25rem] font-black text-emerald-500">{audit?.cacheStats.hits ?? 0}</p>
 </div>
 <div>
 <p className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Misses</p>
 <p className="text-[1.25rem] font-black text-amber-500">{audit?.cacheStats.misses ?? 0}</p>
 </div>
 <div>
 <p className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Hit Rate</p>
 <p className="text-[1.25rem] font-black text-brand-500">{audit?.cacheStats.hitRate ?? 0}%</p>
 </div>
 <div>
 <p className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">Cached Keys</p>
 <p className="text-[1.25rem] font-black text-[var(--text-primary)]">
 {(audit?.cacheStats.dashboardKeys ?? 0) + (audit?.cacheStats.executiveKeys ?? 0) + (audit?.cacheStats.analyticsKeys ?? 0) + (audit?.cacheStats.studentCountKeys ?? 0)}
 </p>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
