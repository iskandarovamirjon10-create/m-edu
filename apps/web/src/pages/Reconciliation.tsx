import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import { analyticsApi} from'@/lib/api';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassTabs,
 GlassBadge,
 GlassCard,
 GlassStatCard,
 GlassTable,
 GlassTHead,
 GlassTBody,
 GlassTR,
 GlassTH,
 GlassTD,
 GlassSelect,
} from'@/components/ui';
import { getErrorMessage} from'@/lib/errorMessages';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';

type TabId ='overview' |'discrepancies' |'studentBalances' |'history';

function getDefaultYearMonth() {
 const now = new Date();
 return { year: now.getFullYear(), month: now.getMonth() + 1};
}

function fmtCurrency(val: number) {
 return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0}).format(val);
}

function fmtDate(val: string | Date | null) {
 if (!val) return'—';
 return new Date(val).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric'});
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function OverviewTab({ t}: { t: (key: string) => string}) {
 const defaultYM = getDefaultYearMonth();
 const [year, setYear] = useState(defaultYM.year);
 const [month, setMonth] = useState(defaultYM.month);

 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['analytics','reconciliation','report', year, month],
 queryFn: () => analyticsApi.reconciliationReport({ year, month}),
 staleTime: 60_000,
});

 const report = data as any;

 if (isLoading) return <GlassPageLoader label={t('common.loading')} />;
 if (isError) return <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />;

 if (!report) {
 return <GlassEmptyState title={t('reconciliation.noData')} message={t('reconciliation.noDataDesc')} />;
}

 const s = report.summary || {};
 const dq = report.dataQuality || {};

 const comparisonRows = [
 { label: t('reconciliation.receivables'), invoiced: s.totalInvoiced, paid: s.totalPaid, difference: s.receivableDifference},
 { label: t('reconciliation.refunds'), invoiced: s.totalRefunded, paid: 0, difference: -s.totalRefunded},
 { label: t('reconciliation.expenses'), invoiced: s.totalExpenses, paid: 0, difference: -s.totalExpenses},
 { label: t('reconciliation.payroll'), invoiced: s.totalPayroll, paid: 0, difference: -s.totalPayroll},
 ];

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4 flex-wrap">
 <label className="text-sm font-medium text-[var(--text-secondary)]">{t('reconciliation.period')}</label>
 <GlassSelect
 value={String(month)}
 onChange={(e) => setMonth(Number(e.target.value))}
 aria-label={t('reconciliation.period')}
 className="w-auto"
 >
 {MONTH_NAMES.map((m, i) => (
 <option key={i} value={i + 1}>{m}</option>
 ))}
 </GlassSelect>
 <GlassSelect
 value={String(year)}
 onChange={(e) => setYear(Number(e.target.value))}
 aria-label={t('common.year')}
 className="w-auto"
 >
 {[year - 1, year, year + 1].map((y) => (
 <option key={y} value={y}>{y}</option>
 ))}
 </GlassSelect>
 {dq.isFullyReconciled ? (
 <GlassBadge variant="success"dot>{t('reconciliation.fullyReconciled')}</GlassBadge>
 ) : (
 <GlassBadge variant="warning"dot>{t('reconciliation.needsReview')}</GlassBadge>
 )}
 </div>

 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
 <GlassStatCard
 label={t('reconciliation.totalInvoiced')}
 value={fmtCurrency(s.totalInvoiced ?? 0)}
 icon={<svg className="w-5 h-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>}
 />
 <GlassStatCard
 label={t('reconciliation.totalPaid')}
 value={fmtCurrency(s.totalPaid ?? 0)}
 icon={<svg className="w-5 h-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"strokeLinecap="round"><path d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"/></svg>}
 />
 <GlassStatCard
 label={t('reconciliation.receivableDifference')}
 value={fmtCurrency(s.receivableDifference ?? 0)}
 trend={
 (s.receivableDifference ?? 0) === 0
 ? { value: t('reconciliation.fullyReconciled'), direction:'up' as const}
 : { value: t('reconciliation.needsReview'), direction:'down' as const}
}
 />
 <GlassStatCard
 label={t('reconciliation.netCashFlow')}
 value={fmtCurrency(s.netCashFlow ?? 0)}
 trend={
 (s.netCashFlow ?? 0) >= 0
 ? { value:'Positive', direction:'up' as const}
 : { value:'Negative', direction:'down' as const}
}
 />
 </div>

 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
 <GlassCard padding="md">
 <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t('reconciliation.totalRefunded')}</p>
 <p className="text-xl font-bold text-[var(--text-primary)]">{fmtCurrency(s.totalRefunded ?? 0)}</p>
 </GlassCard>
 <GlassCard padding="md">
 <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t('reconciliation.totalExpenses')}</p>
 <p className="text-xl font-bold text-[var(--text-primary)]">{fmtCurrency(s.totalExpenses ?? 0)}</p>
 </GlassCard>
 <GlassCard padding="md">
 <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t('reconciliation.payrollRatio')}</p>
 <p className="text-xl font-bold text-[var(--text-primary)]">{((s.payrollRevenueRatio ?? 0) * 100).toFixed(1)}%</p>
 </GlassCard>
 <GlassCard padding="md">
 <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">{t('reconciliation.costPerLesson')}</p>
 <p className="text-xl font-bold text-[var(--text-primary)]">{fmtCurrency(s.costPerLesson ?? 0)}</p>
 </GlassCard>
 </div>

 <GlassCard padding="lg">
 <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">{t('reconciliation.comparisonTable')}</h3>
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('reconciliation.type')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.invoiced')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.totalPaid')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.balance')}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {comparisonRows.map((row) => (
 <GlassTR key={row.label}>
 <GlassTD className="font-semibold">{row.label}</GlassTD>
 <GlassTD className="text-right">{fmtCurrency(row.invoiced ?? 0)}</GlassTD>
 <GlassTD className="text-right">{fmtCurrency(row.paid ?? 0)}</GlassTD>
 <GlassTD className={`text-right font-semibold ${(row.difference ?? 0) < 0 ?'text-rose-600' :'text-emerald-600'}`}>
 {fmtCurrency(row.difference ?? 0)}
 </GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </GlassCard>
 </div>
 );
}

function DiscrepanciesTab({ t}: { t: (key: string) => string}) {
 const defaultYM = getDefaultYearMonth();
 const [year, setYear] = useState(defaultYM.year);
 const [month, setMonth] = useState(defaultYM.month);

 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['analytics','reconciliation','discrepancies', year, month],
 queryFn: () => analyticsApi.reconciliationDiscrepancies({ year, month}),
 staleTime: 60_000,
});

 const result = data as any;

 const severityColor = (s: string) => {
 if (s ==='CRITICAL') return'error' as const;
 if (s ==='HIGH') return'warning' as const;
 if (s ==='MEDIUM') return'info' as const;
 return'muted' as const;
};

 const typeLabel = (t: string) => t.replace(/_/g,'');

 return (
 <div className="space-y-6">
 <div className="flex items-center gap-4 flex-wrap">
 <label className="text-sm font-medium text-[var(--text-secondary)]">{t('reconciliation.period')}</label>
 <GlassSelect
 value={String(month)}
 onChange={(e) => setMonth(Number(e.target.value))}
 aria-label={t('reconciliation.period')}
 className="w-auto"
 >
 {MONTH_NAMES.map((m, i) => (
 <option key={i} value={i + 1}>{m}</option>
 ))}
 </GlassSelect>
 <GlassSelect
 value={String(year)}
 onChange={(e) => setYear(Number(e.target.value))}
 aria-label={t('common.year')}
 className="w-auto"
 >
 {[year - 1, year, year + 1].map((y) => (
 <option key={y} value={y}>{y}</option>
 ))}
 </GlassSelect>
 {result && (
 <GlassBadge variant={result.totalDiscrepancies > 0 ?'warning' :'success'} dot>
 {result.totalDiscrepancies > 0
 ? t('reconciliation.discrepanciesFound').replace('{count}', String(result.totalDiscrepancies))
 : t('reconciliation.noDiscrepancies')}
 </GlassBadge>
 )}
 </div>

 {isLoading ? (
 <GlassPageLoader label={t('common.loading')} />
 ) : isError ? (
 <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />
 ) : !result || result.totalDiscrepancies === 0 ? (
 <GlassEmptyState
 title={t('reconciliation.noDiscrepancies')}
 message={t('reconciliation.noDiscrepanciesDesc')}
 icon={<svg className="w-6 h-6"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.5"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>}
 />
 ) : (
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('reconciliation.type')}</GlassTH>
 <GlassTH>{t('reconciliation.description')}</GlassTH>
 <GlassTH>{t('reconciliation.severity')}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {(result.discrepancies || []).map((d: any, i: number) => (
 <GlassTR key={i}>
 <GlassTD className="font-semibold whitespace-nowrap">{typeLabel(d.type)}</GlassTD>
 <GlassTD className="max-w-md">{d.description}</GlassTD>
 <GlassTD>
 <GlassBadge variant={severityColor(d.severity)} dot>{d.severity}</GlassBadge>
 </GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 )}
 </div>
 );
}

function StudentBalancesTab({ t}: { t: (key: string) => string}) {
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['analytics','reconciliation','student-balances'],
 queryFn: () => analyticsApi.studentBalances(),
 staleTime: 60_000,
});

 const result = data as any;

 if (isLoading) return <GlassPageLoader label={t('common.loading')} />;
 if (isError) return <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />;

 if (!result || !result.students?.length) {
 return <GlassEmptyState title={t('reconciliation.noData')} message={t('reconciliation.noDataDesc')} />;
}

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
 <GlassStatCard label={t('reconciliation.student')} value={String(result.summary.totalStudents)} />
 <GlassStatCard label={t('reconciliation.studentsWithDebt')} value={String(result.summary.studentsWithDebt)} />
 <GlassStatCard label={t('reconciliation.totalOutstanding')} value={fmtCurrency(result.summary.totalOutstanding)} />
 <GlassStatCard label="Avg. Outstanding"value={fmtCurrency(result.summary.avgOutstandingPerStudent)} />
 </div>

 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('reconciliation.student')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.invoiced')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.totalPaid')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.outstanding')}</GlassTH>
 <GlassTH className="text-right">{t('reconciliation.oldestDebt')}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {result.students.map((s: any) => (
 <GlassTR key={s.studentId}>
 <GlassTD className="font-semibold">{s.studentName}</GlassTD>
 <GlassTD className="text-right">{fmtCurrency(s.totalInvoiced)}</GlassTD>
 <GlassTD className="text-right">{fmtCurrency(s.totalPaid)}</GlassTD>
 <GlassTD className={`text-right font-semibold ${s.outstandingAmount > 0 ?'text-rose-600' :'text-emerald-600'}`}>
 {fmtCurrency(s.outstandingAmount)}
 </GlassTD>
 <GlassTD className="text-right text-[var(--text-muted)]">{fmtDate(s.oldestDebtDate)}</GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 );
}

function HistoryTab({ t}: { t: (key: string) => string}) {
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['analytics','reconciliation','history'],
 queryFn: () => analyticsApi.reconciliationHistory(),
 staleTime: 60_000,
});

 const result = data as any;

 if (isLoading) return <GlassPageLoader label={t('common.loading')} />;
 if (isError) return <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />;

 if (!result || !result.periods?.length) {
 return (
 <GlassEmptyState
 title={t('reconciliation.noHistory')}
 message={t('reconciliation.noHistoryDesc')}
 icon={<svg className="w-6 h-6"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.5"><path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>}
 />
 );
}

 const statusColor = (status: string) => {
 if (status ==='CLOSED') return'success' as const;
 if (status ==='RECONCILED') return'info' as const;
 if (status ==='REVIEW') return'warning' as const;
 return'muted' as const;
};

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
 <GlassStatCard label={t('reconciliation.period')} value={String(result.summary.totalPeriods)} />
 <GlassStatCard label={t('reconciliation.fullyReconciled')} value={String(result.summary.reconciledCount)} />
 <GlassStatCard label={t('reconciliation.historyStatus')} value={String(result.summary.closedCount)} />
 <GlassStatCard label={t('reconciliation.needsReview')} value={String(result.summary.openCount + result.summary.reviewCount)} />
 </div>

 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('reconciliation.period')}</GlassTH>
 <GlassTH>{t('reconciliation.historyStatus')}</GlassTH>
 <GlassTH>{t('reconciliation.closedAt')}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {result.periods.map((p: any, i: number) => (
 <GlassTR key={i}>
 <GlassTD className="font-semibold">{MONTH_NAMES[p.month - 1]} {p.year}</GlassTD>
 <GlassTD>
 <GlassBadge variant={statusColor(p.status)} dot>{p.status}</GlassBadge>
 </GlassTD>
 <GlassTD className="text-[var(--text-muted)]">{fmtDate(p.closedAt)}</GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 );
}

export function ReconciliationPage() {
 const { t} = useI18n();
 usePageTitle(t('reconciliation.title'));

 const [activeTab, setActiveTab] = useState<TabId>('overview');

 const tabs = [
 { id:'overview', label: t('reconciliation.tab.overview')},
 { id:'discrepancies', label: t('reconciliation.tab.discrepancies')},
 { id:'studentBalances', label: t('reconciliation.tab.studentBalances')},
 { id:'history', label: t('reconciliation.tab.history')},
 ];

 const renderTab = () => {
 switch (activeTab) {
 case'overview':
 return <OverviewTab t={t} />;
 case'discrepancies':
 return <DiscrepanciesTab t={t} />;
 case'studentBalances':
 return <StudentBalancesTab t={t} />;
 case'history':
 return <HistoryTab t={t} />;
 default:
 return null;
}
};

 return (
 <div className="min-h-screen bg-transparent">
 <div className="relative z-10 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 <GlassPageHeader
 title={t('reconciliation.title')}
 subtitle={t('reconciliation.subtitle')}
 />

 <GlassTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

 <div className="mt-2">
 {renderTab()}
 </div>
 </div>
 </div>
 );
}

export default ReconciliationPage;
