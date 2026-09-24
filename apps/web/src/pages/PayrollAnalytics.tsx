import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassEmptyState,
 GlassErrorState,
 GlassStatCard,
 GlassTabs,
 GlassTable,
 GlassTHead,
 GlassTH,
 GlassTBody,
 GlassTR,
 GlassTD,
 GlassBadge,
} from'@/components/ui';
import { analyticsApi} from'@/lib/api';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';
import { getErrorMessage} from'@/lib/errorMessages';

export const TABS = ['summary','by-teacher','trend','ratio','efficiency'] as const;
export type Tab = (typeof TABS)[number];

const STATUS_BADGE: Record<string,'success' |'warning' |'error' |'muted' |'primary'> = {
 PAID:'success',
 APPROVED:'primary',
 REVIEWED:'warning',
 CALCULATED:'muted',
 DRAFT:'muted',
 CANCELLED:'error',
};

function SummaryTab({ t}: { t: (k: string) => string}) {
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['payroll-summary'],
 queryFn: () => analyticsApi.payrollSummary() as Promise<any>,
});

 if (isLoading) return <div className="p-8"><GlassPageLoader label={t('common.loading')} /></div>;
 if (isError) return <div className="p-8"><GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={refetch} /></div>;
 if (data?.status ==='INSUFFICIENT_DATA') return <GlassEmptyState title={t('payrollAnalytics.insufficientData')} message={data.message} />;

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
 <GlassStatCard label={t('payrollAnalytics.totalPayroll')} value={new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(data?.totalPayroll ?? 0)} />
 <GlassStatCard label={t('payrollAnalytics.paidPayroll')} value={new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(data?.paidPayroll ?? 0)} />
 <GlassStatCard label={t('payrollAnalytics.avgPerTeacher')} value={new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(data?.averagePerTeacher ?? 0)} />
 <GlassStatCard label={t('payrollAnalytics.totalLessons')} value={data?.totalLessons ?? 0} />
 </div>
 <div className="glass-card p-4">
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 <div>
 <p className="text-sm text-[var(--text-muted)]">{t('payrollAnalytics.teachersCount')}</p>
 <p className="text-lg font-bold text-[var(--text-primary)]">{data?.teacherCount ?? 0}</p>
 </div>
 <div>
 <p className="text-sm text-[var(--text-muted)]">{t('payrollAnalytics.paidCount')}</p>
 <p className="text-lg font-bold text-[var(--text-primary)]">{data?.paidCount ?? 0} / {data?.totalCount ?? 0}</p>
 </div>
 <div>
 <p className="text-sm text-[var(--text-muted)]">{t('payrollAnalytics.completionRate')}</p>
 <p className="text-lg font-bold text-[var(--text-primary)]">{data?.totalCount ? Math.round(((data?.paidCount ?? 0) / data.totalCount) * 100) : 0}%</p>
 </div>
 </div>
 </div>
 </div>
 );
}

function ByTeacherTab({ t}: { t: (k: string) => string}) {
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['payroll-by-teacher'],
 queryFn: () => analyticsApi.payrollByTeacher() as Promise<any>,
});

 if (isLoading) return <div className="p-8"><GlassPageLoader label={t('common.loading')} /></div>;
 if (isError) return <div className="p-8"><GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={refetch} /></div>;
 if (data?.status ==='INSUFFICIENT_DATA') return <GlassEmptyState title={t('payrollAnalytics.insufficientData')} message={data.message} />;
 if (!data?.teachers?.length) return <GlassEmptyState title={t('payrollAnalytics.noTeacherData')} message={t('payrollAnalytics.noTeacherDataHint')} />;

 const fmt = (v: number) => new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(v);

 return (
 <GlassTable>
 <GlassTHead>
 <GlassTH>{t('payrollAnalytics.teacher')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.lessons')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.totalNet')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.totalGross')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.runs')}</GlassTH>
 <GlassTH>{t('common.status')}</GlassTH>
 </GlassTHead>
 <GlassTBody>
 {data.teachers.map((t_row: any) => (
 <GlassTR key={t_row.teacherId}>
 <GlassTD className="font-medium">{t_row.name}</GlassTD>
 <GlassTD>{t_row.totalLessons}</GlassTD>
 <GlassTD>{fmt(t_row.totalNet)}</GlassTD>
 <GlassTD>{fmt(t_row.totalGross)}</GlassTD>
 <GlassTD>{t_row.runs}</GlassTD>
 <GlassTD>
 <div className="flex gap-1 flex-wrap">
 {Object.entries(t_row.statuses).map(([s, c]) => (
 <GlassBadge key={s} color={STATUS_BADGE[s] ??'muted'}>{s}: {c as number}</GlassBadge>
 ))}
 </div>
 </GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 );
}

function TrendTab({ t}: { t: (k: string) => string}) {
 const [months, setMonths] = useState(6);
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['payroll-trend', months],
 queryFn: () => analyticsApi.payrollTrend({ months}) as Promise<any>,
});

 if (isLoading) return <div className="p-8"><GlassPageLoader label={t('common.loading')} /></div>;
 if (isError) return <div className="p-8"><GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={refetch} /></div>;
 if (data?.status ==='INSUFFICIENT_DATA') return <GlassEmptyState title={t('payrollAnalytics.insufficientData')} message={data.message} />;

 const trend = data?.trend ?? [];
 if (trend.length === 0) return <GlassEmptyState title={t('payrollAnalytics.noTrendData')} message={t('payrollAnalytics.noTrendDataHint')} />;

 const maxVal = Math.max(1, ...trend.map((d: any) => d.total));
 const w = 600;
 const h = 180;

 const points = trend.map((d: any, i: number) => {
 const x = (i / (trend.length - 1 || 1)) * w;
 const y = h - (d.total / maxVal) * h * 0.9;
 return { x, y, label: d.month, val: d.total};
});

 let pathD = `M ${points[0].x} ${points[0].y}`;
 for (let i = 0; i < points.length - 1; i++) {
 const p0 = points[i];
 const p1 = points[i + 1];
 const cpX = p0.x + (p1.x - p0.x) / 2;
 pathD += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
}
 const areaD = `${pathD} L ${w} ${h} L 0 ${h} Z`;

 const fmt = (v: number) => new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(v);
 const fmtMonth = (label: string) => {
 const parts = label.split('-');
 if (parts.length === 2) {
 const monthsArr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 return `${monthsArr[parseInt(parts[1], 10) - 1]} ${parts[0]}`;
}
 return label;
};

 return (
 <div className="space-y-4">
 <div className="flex gap-2">
 {[3, 6, 12].map((m) => (
 <button
 key={m}
 onClick={() => setMonths(m)}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${months === m ?'bg-brand-500/15 text-brand-600 border border-brand-500/20' :'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--bg-card)]'}`}
 >
 {m} {t('payrollAnalytics.months')}
 </button>
 ))}
 </div>
 <div className="glass-card p-6">
 <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
 <defs>
 <linearGradient id="payroll-trend-grad"x1="0"y1="0"x2="0"y2="1">
 <stop offset="0%"stopColor="#5474FC"stopOpacity="0.3"/>
 <stop offset="100%"stopColor="#5474FC"stopOpacity="0.02"/>
 </linearGradient>
 </defs>
 <path d={areaD} fill="url(#payroll-trend-grad)"/>
 <path d={pathD} fill="none"stroke="#5474FC"strokeWidth="2.5"strokeLinecap="round"/>
 {points.map((p: any, i: number) => (
 <circle key={i} cx={p.x} cy={p.y} r="4"fill="#5474FC"stroke="white"strokeWidth="2"/>
 ))}
 {points.map((p: any, i: number) => (
 <text key={`label-${i}`} x={p.x} y={h + 16} textAnchor="middle"fontSize="10"fill="var(--text-muted)">
 {fmtMonth(p.label)}
 </text>
 ))}
 </svg>
 </div>
 <div className="glass-card p-4">
 <GlassTable>
 <GlassTHead>
 <GlassTH>{t('payrollAnalytics.month')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.total')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.paid')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.runCount')}</GlassTH>
 </GlassTHead>
 <GlassTBody>
 {trend.map((d: any) => (
 <GlassTR key={d.month}>
 <GlassTD>{fmtMonth(d.month)}</GlassTD>
 <GlassTD>{fmt(d.total)}</GlassTD>
 <GlassTD>{fmt(d.paid)}</GlassTD>
 <GlassTD>{d.count}</GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 );
}

function RatioTab({ t}: { t: (k: string) => string}) {
 const [months, setMonths] = useState(6);
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['payroll-ratio', months],
 queryFn: () => analyticsApi.payrollRatio({ months}) as Promise<any>,
});

 if (isLoading) return <div className="p-8"><GlassPageLoader label={t('common.loading')} /></div>;
 if (isError) return <div className="p-8"><GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={refetch} /></div>;
 if (data?.status ==='INSUFFICIENT_DATA') return <GlassEmptyState title={t('payrollAnalytics.insufficientData')} message={data.message} />;

 const monthsData = data?.months ?? [];
 if (monthsData.length === 0) return <GlassEmptyState title={t('payrollAnalytics.noRatioData')} message={t('payrollAnalytics.noRatioDataHint')} />;

 const maxRatio = Math.max(1, ...monthsData.map((d: any) => d.ratio ?? 0));
 const w = 600;
 const h = 180;

 const validData = monthsData.filter((d: any) => d.ratio !== null);
 const points = validData.map((d: any, i: number) => {
 const x = (i / (validData.length - 1 || 1)) * w;
 const y = h - ((d.ratio ?? 0) / maxRatio) * h * 0.9;
 return { x, y, label: d.month, ratio: d.ratio, payroll: d.payroll, revenue: d.revenue};
});

 const fmtMonth = (label: string) => {
 const parts = label.split('-');
 if (parts.length === 2) {
 const monthsArr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
 return monthsArr[parseInt(parts[1], 10) - 1] || label;
}
 return label;
};

 const fmtCurrency = (v: number) => new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(v);

 return (
 <div className="space-y-4">
 <div className="flex gap-2">
 {[3, 6, 12].map((m) => (
 <button
 key={m}
 onClick={() => setMonths(m)}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${months === m ?'bg-brand-500/15 text-brand-600 border border-brand-500/20' :'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--bg-card)]'}`}
 >
 {m} {t('payrollAnalytics.months')}
 </button>
 ))}
 </div>
 {points.length > 0 && (
 <div className="glass-card p-6">
 <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto overflow-visible">
 <defs>
 <linearGradient id="payroll-ratio-grad"x1="0"y1="0"x2="0"y2="1">
 <stop offset="0%"stopColor="#10b981"stopOpacity="0.3"/>
 <stop offset="100%"stopColor="#10b981"stopOpacity="0.02"/>
 </linearGradient>
 </defs>
 {points.length > 1 && (() => {
 let path = `M ${points[0].x} ${points[0].y}`;
 for (let i = 0; i < points.length - 1; i++) {
 const cpX = points[i].x + (points[i + 1].x - points[i].x) / 2;
 path += ` C ${cpX} ${points[i].y}, ${cpX} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`;
}
 const area = `${path} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
 return (
 <>
 <path d={area} fill="url(#payroll-ratio-grad)"/>
 <path d={path} fill="none"stroke="#10b981"strokeWidth="2.5"strokeLinecap="round"/>
 </>
 );
})()}
 {points.map((p: any, i: number) => (
 <circle key={i} cx={p.x} cy={p.y} r="4"fill="#10b981"stroke="white"strokeWidth="2"/>
 ))}
 {points.map((p: any, i: number) => (
 <text key={`label-${i}`} x={p.x} y={h + 16} textAnchor="middle"fontSize="10"fill="var(--text-muted)">
 {fmtMonth(p.label)}
 </text>
 ))}
 </svg>
 </div>
 )}
 <div className="glass-card p-4">
 <GlassTable>
 <GlassTHead>
 <GlassTH>{t('payrollAnalytics.month')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.payroll')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.revenue')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.ratio')}</GlassTH>
 </GlassTHead>
 <GlassTBody>
 {monthsData.map((d: any) => (
 <GlassTR key={d.month}>
 <GlassTD>{fmtMonth(d.month)}</GlassTD>
 <GlassTD>{fmtCurrency(d.payroll)}</GlassTD>
 <GlassTD>{fmtCurrency(d.revenue)}</GlassTD>
 <GlassTD>{d.ratio !== null ? `${d.ratio}%` :'—'}</GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 );
}

function EfficiencyTab({ t}: { t: (k: string) => string}) {
 const { data, isLoading, isError, error, refetch} = useQuery({
 queryKey: ['payroll-efficiency'],
 queryFn: () => analyticsApi.payrollEfficiency() as Promise<any>,
});

 if (isLoading) return <div className="p-8"><GlassPageLoader label={t('common.loading')} /></div>;
 if (isError) return <div className="p-8"><GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={refetch} /></div>;
 if (data?.status ==='INSUFFICIENT_DATA') return <GlassEmptyState title={t('payrollAnalytics.insufficientData')} message={data.message} />;

 const fmt = (v: number) => new Intl.NumberFormat('uz-UZ', { style:'currency', currency:'UZS', maximumFractionDigits: 0}).format(v);

 return (
 <div className="space-y-4">
 <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
 <GlassStatCard label={t('payrollAnalytics.totalPayroll')} value={fmt(data?.totalPayroll ?? 0)} />
 <GlassStatCard label={t('payrollAnalytics.totalLessons')} value={data?.totalLessons ?? 0} />
 <GlassStatCard label={t('payrollAnalytics.overallCostPerLesson')} value={fmt(data?.overallCostPerLesson ?? 0)} />
 </div>
 {data?.teachers?.length > 0 && (
 <GlassTable>
 <GlassTHead>
 <GlassTH>#</GlassTH>
 <GlassTH>{t('payrollAnalytics.teacher')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.lessons')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.totalNet')}</GlassTH>
 <GlassTH>{t('payrollAnalytics.costPerLesson')}</GlassTH>
 </GlassTHead>
 <GlassTBody>
 {data.teachers.map((t_row: any) => (
 <GlassTR key={t_row.teacherId}>
 <GlassTD className="font-mono text-sm text-[var(--text-muted)]">{t_row.rank}</GlassTD>
 <GlassTD className="font-medium">{t_row.name}</GlassTD>
 <GlassTD>{t_row.totalLessons}</GlassTD>
 <GlassTD>{fmt(t_row.totalNet)}</GlassTD>
 <GlassTD>
 <span className={t_row.costPerLesson > data.overallCostPerLesson ?'text-[var(--state-error)]' :'text-[var(--state-success)]'}>
 {fmt(t_row.costPerLesson)}
 </span>
 </GlassTD>
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 )}
 </div>
 );
}

export function PayrollAnalyticsPage() {
 const { t} = useI18n();
 usePageTitle(t('payrollAnalytics.title'));
 const [activeTab, setActiveTab] = useState<Tab>('summary');

 const tabs = [
 { id:'summary', label: t('payrollAnalytics.tabSummary')},
 { id:'by-teacher', label: t('payrollAnalytics.tabByTeacher')},
 { id:'trend', label: t('payrollAnalytics.tabTrend')},
 { id:'ratio', label: t('payrollAnalytics.tabRatio')},
 { id:'efficiency', label: t('payrollAnalytics.tabEfficiency')},
 ];

 return (
 <div style={{ display: "contents" }}>
 <div className="orb orb-cyan-1"/>
 <div className="orb orb-indigo-1"/>
 <div className="page-container space-y-4">
 <GlassPageHeader
 title={t('payrollAnalytics.title')}
 subtitle={t('payrollAnalytics.subtitle')}
 />

 <GlassTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as Tab)} />

 {activeTab ==='summary' && <SummaryTab t={t} />}
 {activeTab ==='by-teacher' && <ByTeacherTab t={t} />}
 {activeTab ==='trend' && <TrendTab t={t} />}
 {activeTab ==='ratio' && <RatioTab t={t} />}
 {activeTab ==='efficiency' && <EfficiencyTab t={t} />}
 </div>
 </div>
 );
}

export default PayrollAnalyticsPage;
