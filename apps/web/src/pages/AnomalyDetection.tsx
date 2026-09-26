/**
 * AnomalyDetectionPage — Ultra Premium Apple-Style Radar Dashboard
 * Features fluid typography, deep frosted glass modules, glowing 
 * semantic severity badges, and staggered list animations.
 */
import { useQuery} from'@tanstack/react-query';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassEmptyState,
 GlassErrorState,
} from'@/components/ui';
import { analyticsApi} from'@/lib/api';
import { usePageTitle} from'@/hooks/usePageTitle';
import { getErrorMessage} from'@/lib/errorMessages';
import { useI18n} from'@/i18n/I18nProvider';

interface Anomaly {
 type: string;
 severity:'HIGH' |'MEDIUM' |'LOW';
 title: string;
 description: string;
 metric: string;
 observed: number;
 baseline: number | null;
 period: string;
 recommendation: string;
 insufficientData?: boolean;
}

// Premium Apple-style configuration for Anomaly Severities
function getSeverityConfig(severity: Anomaly['severity']) {
 switch (severity) {
 case'HIGH': return { bg:'bg-rose-500/10', text:'text-rose-600', border:'border-rose-500/20', dot:'bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.8)]'};
 case'MEDIUM': return { bg:'bg-amber-500/10', text:'text-amber-600', border:'border-amber-500/20', dot:'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'};
 case'LOW':
 default: return { bg:'bg-blue-500/10', text:'text-blue-600', border:'border-blue-500/20', dot:'bg-blue-500'};
}
}

function formatType(type: string): string {
 return type
 .replace(/_/g,'')
 .toLowerCase()
 .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Premium Local Stat Card
function AnomalyStatCard({ label, value, highlightColor}: { label: string; value: string | number; highlightColor: string}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card flex flex-col justify-between h-full">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />
 
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest relative z-10 mb-2 truncate">
 {label}
 </p>
 <p className="text-[2rem] font-black tracking-tight leading-none text-[var(--text-primary)] relative z-10">
 {value}
 </p>
 </div>
 );
}

export function AnomalyDetectionPage() {
 const { t} = useI18n();
 usePageTitle(t('anomaly.title'));

 const anomaliesQuery = useQuery({
 queryKey: ['anomalies-detect-all'],
 queryFn: () => analyticsApi.detectAllAnomalies() as Promise<Anomaly[]>,
});

 const anomalies: Anomaly[] = anomaliesQuery.data ?? [];
 const highCount = anomalies.filter((a) => a.severity ==='HIGH').length;
 const mediumCount = anomalies.filter((a) => a.severity ==='MEDIUM').length;
 const lowCount = anomalies.filter((a) => a.severity ==='LOW').length;
 const insufficientDataCount = anomalies.filter((a) => a.insufficientData).length;

 if (anomaliesQuery.isLoading && !anomaliesQuery.data) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('anomaly.title')} subtitle="Scanning system patterns…"/>
 <div className="mt-8 rounded-[2.5rem] p-16 flex items-center justify-center glass-card">
 <GlassPageLoader label={t('anomaly.loading')} />
 </div>
 </div>
 );
}

 if (anomaliesQuery.isError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('anomaly.title')} subtitle="Connection error"/>
 <div className="mt-8 rounded-[2.5rem] p-12 glass-card">
 <GlassErrorState message={getErrorMessage(anomaliesQuery.error)} onRetry={() => anomaliesQuery.refetch()} />
 </div>
 </div>
 );
}

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 
 {/* Soft Apple-style Background Ambient Orbs (Radar Theme) */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden="true">
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-rose-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-amber-400/5 blur-[130px]"/>
 </div>

 <div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 
 {/* ── Header ─────────────────────────────────────────────────────── */}
 <GlassPageHeader
 title={t('anomaly.title')}
 subtitle={t('anomaly.subtitle')}
 />

 {/* ── KPI Summary Cards ──────────────────────────────────────────── */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
 <AnomalyStatCard label={t('anomaly.totalDetected')} value={anomalies.length} highlightColor="bg-brand-500"/>
 <AnomalyStatCard label={t('anomaly.highSeverity')} value={highCount} highlightColor="bg-rose-500"/>
 <AnomalyStatCard label={t('anomaly.mediumSeverity')} value={mediumCount} highlightColor="bg-amber-500"/>
 <AnomalyStatCard label={t('anomaly.lowSeverity')} value={lowCount} highlightColor="bg-blue-500"/>
 <AnomalyStatCard label={t('anomaly.insufficientData')} value={insufficientDataCount} highlightColor="bg-[var(--bg-surface)]0"/>
 </div>

 {/* ── Monitored Detectors Banner ─────────────────────────────────── */}
 <div className="rounded-[2rem] bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)]/60 p-6 sm:p-8 shadow-[0_4px_16px_rgba(0,0,0,0.02)] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
 <h3 className="text-[1.05rem] font-bold text-[var(--text-primary)] flex items-center gap-2 mb-5">
 <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
 </div>
 {t('anomaly.detectorsTitle')}
 </h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { title: t('anomaly.detector.revenueDrop'), desc: t('anomaly.detector.revenueDropDesc')},
 { title: t('anomaly.detector.expenseSpike'), desc: t('anomaly.detector.expenseSpikeDesc')},
 { title: t('anomaly.detector.refundAnomaly'), desc: t('anomaly.detector.refundAnomalyDesc')},
 { title: t('anomaly.detector.debtIncrease'), desc: t('anomaly.detector.debtIncreaseDesc')},
 { title: t('anomaly.detector.cashFlowNegative'), desc: t('anomaly.detector.cashFlowNegativeDesc')},
 { title: t('anomaly.detector.payrollExceedsRevenue'), desc: t('anomaly.detector.payrollExceedsRevenueDesc')},
 { title: t('anomaly.detector.latePayment'), desc: t('anomaly.detector.latePaymentDesc')},
 { title: t('anomaly.detector.enrollmentDrop'), desc: t('anomaly.detector.enrollmentDropDesc')},
 ].map((detector, i) => (
 <div key={i} className="flex flex-col bg-[var(--bg-card)] rounded-xl px-4 py-3 border border-[var(--border-subtle)]/50 hover:border-indigo-500/30 transition-colors">
 <span className="text-[0.7rem] font-black text-[var(--text-primary)] mb-0.5 tracking-wider uppercase">{detector.title}</span>
 <span className="text-[0.75rem] font-medium text-[var(--text-muted)] leading-tight">{detector.desc}</span>
 </div>
 ))}
 </div>
 </div>

 {/* ── Active Anomalies List ──────────────────────────────────────── */}
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative min-h-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden="true"/>
 
 <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
 <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)] flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12"y1="9"x2="12"y2="13"/><line x1="12"y1="17"x2="12.01"y2="17"/></svg>
 </div>
 Detected Anomalies
 </h2>
 <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 text-[0.75rem] font-bold uppercase tracking-wider border border-rose-500/20">
 {anomalies.length} Flagged
 </span>
 </div>

 <div className="relative z-10 w-full">
 {anomalies.length === 0 ? (
 <div className="p-16 flex items-center justify-center">
 <GlassEmptyState 
 title={t('anomaly.noAnomalies')} 
 message={t('anomaly.noAnomaliesDesc')} 
 />
 </div>
 ) : (
 <div className="divide-y divide-gray-100 dark:divide-white/5">
 {anomalies.map((a, idx) => {
 const sConfig = getSeverityConfig(a.severity);
 return (
 <div key={`${a.type}-${a.period}-${idx}`} className="group flex flex-col md:flex-row md:items-start justify-between gap-4 px-6 py-6 transition-colors hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)]"style={{ animationDelay: `${idx * 40}ms`}}>
 
 <div className="flex items-start gap-4 flex-1 min-w-0">
 {/* Severity Badge */}
 <span className={`inline-flex items-center px-2 py-1 rounded-[8px] text-[0.65rem] font-black uppercase tracking-wider border shrink-0 mt-0.5 ${sConfig.bg} ${sConfig.text} ${sConfig.border}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sConfig.dot}`} />
 {a.severity}
 </span>

 <div className="flex-1 min-w-0">
 {/* Title & Description */}
 <h4 className="text-[1.05rem] font-bold text-[var(--text-primary)] truncate mb-1">
 {a.title}
 </h4>
 <p className="text-[0.85rem] font-medium text-[var(--text-muted)] leading-relaxed max-w-3xl">
 {a.description}
 </p>

 {/* Meta Badges */}
 <div className="flex flex-wrap items-center gap-2 mt-3">
 <span className="inline-flex items-center px-2.5 py-1 rounded-[6px] bg-brand-500/10 text-brand-600 font-mono text-[0.7rem] font-bold border border-brand-500/20">
 {formatType(a.type)}
 </span>
 <span className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
 <span className="w-1 h-1 rounded-full bg-gray-300 "/>
 {a.metric}
 </span>
 <span className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-1.5">
 <span className="w-1 h-1 rounded-full bg-gray-300 "/>
 Period: {a.period}
 </span>
 {a.insufficientData && (
 <span className="text-[0.7rem] font-bold text-amber-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
 <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"/>
 {t('anomaly.insufficientDataBadge')}
 </span>
 )}
 </div>

 {/* Recommendation Box */}
 {a.recommendation && (
 <div className="mt-4 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-2 max-w-2xl">
 <svg className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><circle cx="12"cy="12"r="10"/><line x1="12"y1="16"x2="12"y2="12"/><line x1="12"y1="8"x2="12.01"y2="8"/></svg>
 <span className="text-[0.8rem] font-medium text-indigo-700 leading-snug">
 {a.recommendation}
 </span>
 </div>
 )}
 </div>
 </div>

 {/* Right Panel: Data Comparison */}
 {!a.insufficientData && (
 <div className="shrink-0 pl-16 md:pl-0 flex flex-col items-end gap-1 min-w-[120px]">
 <div className="flex flex-col items-end">
 <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('anomaly.observed')}</span>
 <span className="text-[1.1rem] font-black font-mono text-[var(--text-primary)] leading-none mt-0.5">
 {a.observed.toLocaleString()}
 </span>
 </div>
 {a.baseline !== null && (
 <div className="flex flex-col items-end mt-2">
 <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">{t('anomaly.baseline')}</span>
 <span className="text-[0.9rem] font-bold font-mono text-[var(--text-muted)] leading-none mt-0.5">
 {a.baseline.toLocaleString()}
 </span>
 </div>
 )}
 </div>
 )}

 </div>
 );
})}
 </div>
 )}
 </div>
 </div>

 </div>
 </div>
 );
}

export default AnomalyDetectionPage;