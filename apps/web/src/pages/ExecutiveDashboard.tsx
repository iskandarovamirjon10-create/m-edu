import { useMemo, useState, useRef} from'react';
import { useQuery} from'@tanstack/react-query';
import { analyticsApi} from'@/lib/api';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassStatCard,
} from'@/components/ui';
import { formatCurrency} from'@/lib/format';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'../i18n/I18nProvider';

interface ExecutiveSummary {
 revenue: { current: number; previous: number; trend: number | null};
 expenses: { current: number; previous: number; trend: number | null};
 netCashFlow: { current: number; previous: number; trend: number | null};
 studentGrowth: { total: number; newThisMonth: number; churnRate: number | null};
 attendanceRate: { overall: number | null; trend: number | null};
 teacherUtilization: { average: number | null; topPerformers: null};
 crmConversion: { leadsThisMonth: number; converted: number; rate: number | null};
 topAlerts: Array<{ type: string; message: string; severity: string}>;
 branchComparison: Array<{
 branchId: string;
 name: string;
 revenue: number;
 students: number;
 attendance: number;
}> | null;
}


function SeverityBadge({ severity}: { severity: string}) {
 const s = severity.toLowerCase();
 const map: Record<string, string> = {
 critical:'bg-rose-500/15 text-rose-600 ring-1 ring-rose-500/20',
 high:'bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/20',
 medium:'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20',
 low:'bg-blue-500/15 text-blue-600 ring-1 ring-blue-500/20',
 info:'bg-[var(--bg-surface)]0/15 text-[var(--text-secondary)] ring-1 ring-gray-500/20',
 warning:'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/20',
};
 return (
 <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[s] || map.info}`}>
 {severity}
 </span>
 );
}

function RevenueExpenseChart({ data}: { data: { month: string; revenue: number; expenses: number}[]}) {
 const [hoverIdx, setHoverIdx] = useState<number | null>(null);
 const svgRef = useRef<SVGSVGElement>(null);
 const { t } = useI18n();

 if (!data || data.length === 0) return null;

 const allValues = data.flatMap((d) => [d.revenue, d.expenses]);
 const maxVal = Math.max(1, ...allValues);
 const w = 560;
 const h = 200;
 const pad = { top: 20, right: 20, bottom: 40, left: 60};
 const chartW = w - pad.left - pad.right;
 const chartH = h - pad.top - pad.bottom;

 const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
 const toX = (i: number) => pad.left + i * xStep;
 const toY = (v: number) => pad.top + chartH - (v / maxVal) * chartH;

 const revenuePath = data.map((d, i) => `${i === 0 ?'M' :'L'}${toX(i)},${toY(d.revenue)}`).join('');
 const expensePath = data.map((d, i) => `${i === 0 ?'M' :'L'}${toX(i)},${toY(d.expenses)}`).join('');

 const revenueFill = [...data.map((d, i) => `${i === 0 ?'M' :'L'}${toX(i)},${toY(d.revenue)}`),
 `L${toX(data.length - 1)},${pad.top + chartH}`, `L${toX(0)},${pad.top + chartH}`,'Z'].join('');

 const ticks = 5;
 const yTicks = Array.from({ length: ticks + 1}, (_, i) => (maxVal / ticks) * i);

 return (
 <div className="relative overflow-hidden rounded-3xl bg-[var(--bg-card)] border border-[var(--border-glass)] p-6">
 <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]"style={{ background:'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(148,234,239,0.04) 100%)'}} />
 <h3 className="relative z-10 text-sm font-semibold text-[var(--text-secondary)] mb-4">{t('executive.revenueVsExpenses')}</h3>
 <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-auto relative z-10"onMouseLeave={() => setHoverIdx(null)}
   role="img" aria-label={t('executive.revenueVsExpenses')}>
 {yTicks.map((tick, i) => (
 <g key={i}>
 <line x1={pad.left} y1={toY(tick)} x2={w - pad.right} y2={toY(tick)} stroke="var(--border-subtle)"strokeDasharray="4 4"strokeWidth="0.5"/>
 <text x={pad.left - 8} y={toY(tick) + 4} textAnchor="end"fontSize="10"fill="var(--text-muted)">{formatCurrency(tick)}</text>
 </g>
 ))}
 {data.map((d, i) => (
 <g key={i}>
 <line x1={toX(i)} y1={pad.top + chartH} x2={toX(i)} y2={pad.top + chartH + 4} stroke="var(--text-muted)"strokeWidth="1"/>
 <text x={toX(i)} y={pad.top + chartH + 16} textAnchor="middle"fontSize="10"fill="var(--text-muted)">{d.month}</text>
 </g>
 ))}
 <path d={revenueFill} fill="url(#revGrad)"opacity="0.3"/>
 <path d={revenuePath} fill="none"stroke="#10b981"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"/>
 <path d={expensePath} fill="none"stroke="#f43f5e"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"/>
 {data.map((d, i) => (
 <g key={`pts-${i}`}>
 <circle cx={toX(i)} cy={toY(d.revenue)} r={hoverIdx === i ? 5 : 3} fill="#10b981"stroke="white"strokeWidth="2"className="transition-all"/>
 <circle cx={toX(i)} cy={toY(d.expenses)} r={hoverIdx === i ? 5 : 3} fill="#f43f5e"stroke="white"strokeWidth="2"className="transition-all"/>
 <rect x={toX(i) - xStep / 2} y={pad.top} width={xStep} height={chartH} fill="transparent"
 onMouseEnter={() => setHoverIdx(i)} />
 </g>
 ))}
 {hoverIdx !== null && (
 <g>
 <line x1={toX(hoverIdx)} y1={pad.top} x2={toX(hoverIdx)} y2={pad.top + chartH} stroke="var(--text-muted)"strokeWidth="1"strokeDasharray="4 4"/>
 <rect x={toX(hoverIdx) - 60} y={pad.top - 8} width="120"height="52"rx="8"fill="var(--bg-card)"stroke="var(--border-glass)"strokeWidth="1"/>
 <text x={toX(hoverIdx)} y={pad.top + 10} textAnchor="middle"fontSize="10"fill="#10b981"fontWeight="600">
 {t('executive.rev')} {formatCurrency(data[hoverIdx].revenue)}
 </text>
 <text x={toX(hoverIdx)} y={pad.top + 24} textAnchor="middle"fontSize="10"fill="#f43f5e"fontWeight="600">
 {t('executive.exp')} {formatCurrency(data[hoverIdx].expenses)}
 </text>
 <text x={toX(hoverIdx)} y={pad.top + 38} textAnchor="middle"fontSize="10"fill="var(--text-muted)"fontWeight="500">
 {data[hoverIdx].month}
 </text>
 </g>
 )}
 <defs>
 <linearGradient id="revGrad"x1="0"y1="0"x2="0"y2="1">
 <stop offset="0%"stopColor="#10b981"stopOpacity="0.6"/>
 <stop offset="100%"stopColor="#10b981"stopOpacity="0"/>
 </linearGradient>
 </defs>
 </svg>
 <div className="relative z-10 flex items-center gap-6 mt-3 text-xs font-medium text-[var(--text-muted)]">
 <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"/>{t('executive.revenue')}</span>
 <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-500"/>{t('executive.expenses')}</span>
 </div>
 </div>
 );
}


function MetricCard({ label, value, sub}: { label: string; value: string | number; sub?: string}) {
 return (
 <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] p-5 transition-all hover:shadow-[var(--shadow-md)]">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
 <p className="text-2xl font-bold text-[var(--text-primary)] mt-2">{value}</p>
 {sub && <p className="text-xs text-[var(--text-muted)] mt-1">{sub}</p>}
 </div>
 );
}

export function ExecutiveDashboardPage() {
 const { t} = useI18n();
 usePageTitle(t('executive.title'));

 const { data, isLoading, error} = useQuery<ExecutiveSummary>({
 queryKey: ['executive-summary'],
 queryFn: () => analyticsApi.executiveSummary() as Promise<ExecutiveSummary>,
 staleTime: 60_000,
});

 const chartData = useMemo(() => {
 if (!data) return [];
 return [
 { month:'Current', revenue: data.revenue.current, expenses: data.expenses.current},
 { month:'Previous', revenue: data.revenue.previous, expenses: data.expenses.previous},
 ];
}, [data]);

 if (isLoading) {
 return (
 <div>
 <GlassPageHeader title={t('executive.title')} subtitle={t('executive.subtitle')} />
 <GlassPageLoader label={t('common.loading')} />
 </div>
 );
}

 if (error) {
 return (
 <div>
 <GlassPageHeader title={t('executive.title')} subtitle={t('executive.subtitle')} />
 <GlassErrorState
 title={t('common.error')}
 message={error instanceof Error ? error.message : t('common.error')}
 />
 </div>
 );
}

 if (!data) {
 return (
 <div>
 <GlassPageHeader title={t('executive.title')} subtitle={t('executive.subtitle')} />
 <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-glass)] p-12 text-center">
 <p className="text-[var(--text-muted)]">{t('executive.empty')}</p>
 </div>
 </div>
 );
}

 return (
 <div className="space-y-7">
 <GlassPageHeader title={t('executive.title')} subtitle={t('executive.subtitle')} />

 {/* Row 1: KPI Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
 <GlassStatCard
 label={t('executive.revenue')}
 value={formatCurrency(data.revenue.current)}
 icon={
 <svg className="h-5 w-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
 </svg>
}
 trend={data.revenue.trend !== null ? { value: `${Math.abs(data.revenue.trend)}% vs last month`, direction: data.revenue.trend >= 0 ?'up' :'down'} : undefined}
 />
 <GlassStatCard
 label={t('executive.expenses')}
 value={formatCurrency(data.expenses.current)}
 icon={
 <svg className="h-5 w-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M2 15h20M6.5 10.5h0M10 13.5h0M13.5 7.5h0M17 10.5h0"/>
 </svg>
}
 trend={data.expenses.trend !== null ? { value: `${Math.abs(data.expenses.trend)}% vs last month`, direction: data.expenses.trend <= 0 ?'up' :'down'} : undefined}
 />
 <GlassStatCard
 label={t('executive.netCashFlow')}
 value={formatCurrency(data.netCashFlow.current)}
 icon={
 <svg className="h-5 w-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M7 17l9.2-9.2M17 17V7.8H7.8"/>
 </svg>
}
 trend={data.netCashFlow.trend !== null ? { value: `${Math.abs(data.netCashFlow.trend)}% vs last month`, direction: data.netCashFlow.current >= 0 ?'up' :'down'} : undefined}
 />
 <GlassStatCard
 label={t('executive.students')}
 value={data.studentGrowth.total}
 icon={
 <svg className="h-5 w-5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="1.6"strokeLinecap="round"strokeLinejoin="round">
 <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm11 8v6m-3-3h6"/>
 </svg>
}
 trend={{ value: `+${data.studentGrowth.newThisMonth} this month`, direction: data.studentGrowth.newThisMonth > 0 ?'up' :'neutral'}}
 />
 </div>

 {/* Row 2: Chart + Key Metrics */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
 <RevenueExpenseChart data={chartData} />
 <div className="space-y-5">
 <MetricCard
 label={t('executive.attendanceRate')}
 value={data.attendanceRate.overall !== null ? `${data.attendanceRate.overall}%` :'—'}
 sub={t('executive.last30Days')}
 />
 <MetricCard
 label={t('executive.teacherUtilization')}
 value={data.teacherUtilization.average !== null ? `${data.teacherUtilization.average}%` :'—'}
 sub={t('executive.activeGroupsPerTeacher')}
 />
 <MetricCard
 label={t('executive.crmConversion')}
 value={data.crmConversion.rate !== null ? `${data.crmConversion.rate}%` :'—'}
 sub={`${data.crmConversion.converted} ${t('executive.convertedOf')} ${data.crmConversion.leadsThisMonth} ${t('executive.leads')}`}
 />
 </div>
 </div>

 {/* Row 3: Alerts / Anomalies */}
 {data.topAlerts.length > 0 && (
 <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-glass)] p-6">
 <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]"style={{ background:'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(148,234,239,0.04) 100%)'}} />
 <h3 className="relative z-10 text-sm font-semibold text-[var(--text-secondary)] mb-4">{t('executive.topAlerts')}</h3>
 <div className="relative z-10 space-y-3">
 {data.topAlerts.map((alert, idx) => (
 <div key={idx} className="flex items-start gap-3 rounded-2xl bg-[var(--bg-card)] border border-white/10 p-4">
 <SeverityBadge severity={alert.severity} />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-medium text-[var(--text-primary)] truncate">{alert.message}</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">{alert.type}</p>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Row 4: Branch Comparison */}
 {data.branchComparison && data.branchComparison.length > 0 && (
 <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-glass)] p-6">
 <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]"style={{ background:'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(148,234,239,0.04) 100%)'}} />
 <h3 className="relative z-10 text-sm font-semibold text-[var(--text-secondary)] mb-4">{t('executive.branchComparison')}</h3>
 <div className="relative z-10 overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]">
 <th className="text-left py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('executive.branch')}</th>
 <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('executive.revenue')}</th>
 <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('executive.students')}</th>
 <th className="text-right py-3 px-4 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t('executive.attendanceRate')}</th>
 </tr>
 </thead>
 <tbody>
 {data.branchComparison.map((branch) => (
 <tr key={branch.branchId} className="border-b border-[var(--border-subtle)]/50 hover:bg-[var(--bg-card)] dark:hover:bg-black/10 transition-colors">
 <td className="py-3 px-4 font-medium text-[var(--text-primary)]">{branch.name}</td>
 <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{formatCurrency(branch.revenue)}</td>
 <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{branch.students}</td>
 <td className="py-3 px-4 text-right text-[var(--text-secondary)]">{branch.attendance}%</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </div>
 );
}

export default ExecutiveDashboardPage;
