/**
 * FinancialAnalyticsPage — Ultra Premium Apple-Style Financial Dashboard
 * Features fluid data visualizations, deep frosted glass modules,
 * interactive what-if sliders, and high-end semantic data grids.
 */
import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import { analyticsApi} from'@/lib/api';
 import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassBadge,
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

type TabId ='overview' |'cashflow' |'anomalies' |'whatif' |'forecast' |'reconciliation';

function getDefaultDateRange() {
 const now = new Date();
 const start = new Date(now.getFullYear(), now.getMonth(), 1);
 const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
 return {
 startDate: start.toISOString().split('T')[0],
 endDate: end.toISOString().split('T')[0],
 };
}

function fmtCurrency(val: number) {
 return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 0}).format(val);
}

// Premium Local Stat Card
function FinanceStatCard({ label, value, highlightColor, isCurrency = false, icon, trend}: { label: string; value: string | number; highlightColor: string; isCurrency?: boolean; icon?: React.ReactNode; trend?: { direction:'up' |'down'; value: string}}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card flex flex-col justify-between h-full">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-[40px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />
 
 <div className="relative z-10 flex items-start justify-between mb-4">
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest leading-snug w-2/3">
 {label}
 </p>
 {icon && (
 <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-[var(--state-hover)] text-[var(--text-muted)]`}>
 {icon}
 </div>
 )}
 </div>
 
 <div className="relative z-10 flex items-end justify-between">
 <p className={`text-[1.85rem] font-black tracking-tight leading-none ${isCurrency ?'text-emerald-600' :'text-[var(--text-primary)]'}`}>
 {value}
 </p>
 {trend && (
 <span className={`flex items-center gap-1 text-[0.75rem] font-bold px-2 py-1 rounded-md ${trend.direction ==='up' ?'bg-emerald-500/10 text-emerald-600' :'bg-rose-500/10 text-rose-600'}`}>
 {trend.direction ==='up' ?'↑' :'↓'} {trend.value}
 </span>
 )}
 </div>
 </div>
 );
}

/* ── TABS ─────────────────────────────────────────────────────────────────── */

import { CashFlowData, FinancialAnomaly, ForecastResult, ReconciliationData } from '@/types/analytics';
function OverviewTab({ data, t}: { data: CashFlowData | undefined; t: (key: string) => string}) {
  if (!data) return null;
  const inflow = data.inflows?.netCashInflow ?? 0;
  const outflow = data.outflows?.totalOutflow ?? 0;
  const margin = inflow > 0 ? ((inflow - outflow) / inflow) * 100 : 0;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <h3 className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            {t('analytics.inflow')}
          </h3>
          <p className="text-4xl font-light text-[var(--text-primary)]">
            {new Intl.NumberFormat('uz-UZ').format(inflow)}
          </p>
        </div>
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <h3 className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            {t('analytics.outflow')}
          </h3>
          <p className="text-4xl font-light text-[var(--text-primary)]">
            {new Intl.NumberFormat('uz-UZ').format(outflow)}
          </p>
        </div>
        <div className="glass-card p-6 rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <h3 className="text-[var(--text-secondary)] font-medium mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
            {t('analytics.margin')}
          </h3>
          <p className="text-4xl font-light text-[var(--text-primary)]">
            {margin.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function CashFlowTab({ data, t}: { data: CashFlowData | undefined; t: (key: string) => string}) {
  if (!data) return null;

  const breakdownData = [
    { category: t('analytics.cashCollected') || 'Cash Collected', amount: data.inflows?.cashCollected ?? 0, type: 'INFLOW' },
    { category: t('analytics.refunds') || 'Refunds', amount: data.inflows?.refundsTotal ?? 0, type: 'OUTFLOW' },
    { category: t('analytics.generalExpenses') || 'Expenses', amount: data.outflows?.expensesTotal ?? 0, type: 'OUTFLOW' },
    { category: t('analytics.payroll') || 'Payroll', amount: data.outflows?.payrollTotal ?? 0, type: 'OUTFLOW' },
  ].filter((b) => b.amount !== 0).sort((a, b) => b.amount - a.amount);

  return (
    <div className="glass-card rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 border-b border-[var(--border-color)]">
        <h3 className="text-2xl font-light">{t('analytics.cashFlowBreakdown')}</h3>
      </div>
      {breakdownData.length === 0 ? (
        <GlassEmptyState title={t('analytics.noData')} icon="âŠ–" />
      ) : (
        <div className="overflow-x-auto">
          <GlassTable>
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('analytics.category')}</GlassTH>
                <GlassTH>{t('analytics.type')}</GlassTH>
                <GlassTH className="text-right">{t('analytics.amount')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {breakdownData.map((row, i) => (
                <GlassTR key={i} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
                  <GlassTD className="font-medium text-[var(--text-primary)]">{row.category}</GlassTD>
                  <GlassTD>
                    <GlassBadge variant={row.type === 'INFLOW' ? 'success' : 'error'}>
                      {row.type}
                    </GlassBadge>
                  </GlassTD>
                  <GlassTD className="text-right tabular-nums">
                    {new Intl.NumberFormat('uz-UZ').format(row.amount)}
                  </GlassTD>
                </GlassTR>
              ))}
            </GlassTBody>
          </GlassTable>
        </div>
      )}
    </div>
  );
}

function AnomaliesTab({ data, t}: { data: FinancialAnomaly[] | undefined; t: (key: string) => string}) {
  if (!data) return null;

  return (
    <div className="glass-card rounded-[2.5rem] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-8 border-b border-[var(--border-color)]">
        <h3 className="text-2xl font-light">{t('analytics.detectedAnomalies')}</h3>
      </div>
      {(!data || data.length === 0) ? (
        <GlassEmptyState title={t('analytics.noAnomalies')} icon="âœ¨" />
      ) : (
        <div className="overflow-x-auto">
          <GlassTable>
            <GlassTHead>
              <GlassTR>
                <GlassTH>{t('analytics.type')}</GlassTH>
                <GlassTH>{t('analytics.severity')}</GlassTH>
                <GlassTH>{t('analytics.description')}</GlassTH>
              </GlassTR>
            </GlassTHead>
            <GlassTBody>
              {(Array.isArray(data) ? data : []).map((a: FinancialAnomaly, i: number) => (
                <GlassTR key={i} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
                  <GlassTD className="font-bold text-[var(--text-primary)] capitalize">{a.type?.replace(/_/g, ' ').toLowerCase()}</GlassTD>
                  <GlassTD>
                    <GlassBadge variant={a.severity === 'HIGH' || a.severity === 'REQUIRES REVIEW' ? 'error' : a.severity === 'MEDIUM' || a.severity === 'UNUSUAL' ? 'warning' : 'muted'}>
                      {a.severity}
                    </GlassBadge>
                  </GlassTD>
                  <GlassTD>
<p className="text-sm font-medium text-[var(--text-primary)]">{a.type?.replace(/_/g, ' ').toLowerCase()}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{a.description}</p>
                  </GlassTD>
                </GlassTR>
              ))}
            </GlassTBody>
          </GlassTable>
        </div>
      )}
    </div>
  );
}

export function FinancialAnalyticsPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.financialAnalytics'));
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [range] = useState(getDefaultDateRange());
  const [priceIncrease, setPriceIncrease] = useState(0);
  const [studentVolume, setStudentVolume] = useState(0);
  const [payrollIncrease, setPayrollIncrease] = useState(0);
  const [forecastDays, setForecastDays] = useState(30);

  const { data: cashFlowData, isLoading: loadingCashFlow, isError: errCashFlow, error: eCashFlow } = useQuery({
    queryKey: ['financial-cashflow', range],
    queryFn: () => analyticsApi.cashFlow({ startDate: range.startDate, endDate: range.endDate }),
    staleTime: 30_000,
  });

  const { data: anomaliesData, isLoading: loadingAnomalies, isError: errAnomalies, error: eAnomalies } = useQuery({
    queryKey: ['financial-anomalies', range],
    queryFn: () => analyticsApi.anomalies({ startDate: range.startDate, endDate: range.endDate }),
    staleTime: 30_000,
  });

  const { data: whatIfData, isLoading: loadingWhatIf, isError: errWhatIf, error: eWhatIf } = useQuery({
    queryKey: ['financial-whatif', range, priceIncrease, studentVolume, payrollIncrease],
    queryFn: () => analyticsApi.whatIf({ startDate: range.startDate, endDate: range.endDate, priceIncrease, studentVolume, payrollIncrease }),
    staleTime: 30_000,
  });
  const sim = whatIfData;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <GlassPageHeader
        title={t('nav.financialAnalytics')}
        subtitle={t('analytics.financialSubtitle')}
      />

      <div className="flex space-x-2 p-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl overflow-x-auto no-scrollbar glass-card">
        {[
          { id: 'overview', label: t('analytics.tabOverview') },
          { id: 'cashflow', label: t('analytics.tabCashFlow') },
          { id: 'anomalies', label: t('analytics.tabAnomalies') },
          { id: 'whatif', label: t('analytics.tabWhatIf') },
          { id: 'forecast', label: t('analytics.tabForecast') },
          { id: 'reconciliation', label: t('analytics.tabReconciliation') },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabId)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-300 ${
              activeTab === tab.id 
                ? 'bg-[var(--accent-color)] text-white shadow-md shadow-[var(--accent-color)]/20' 
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'overview' && (
          loadingCashFlow ? <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card"><GlassPageLoader label={t('common.loading')} /></div> :
          errCashFlow ? <div className="p-12 rounded-[2.5rem] glass-card"><GlassErrorState title={t('common.error')} message={getErrorMessage(eCashFlow)} /></div> :
          <OverviewTab data={cashFlowData} t={t} />
        )}
        
        {activeTab === 'cashflow' && (
          loadingCashFlow ? <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card"><GlassPageLoader label={t('common.loading')} /></div> :
          errCashFlow ? <div className="p-12 rounded-[2.5rem] glass-card"><GlassErrorState title={t('common.error')} message={getErrorMessage(eCashFlow)} /></div> :
          <CashFlowTab data={cashFlowData} t={t} />
        )}
        
        {activeTab === 'anomalies' && (
          loadingAnomalies ? <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card"><GlassPageLoader label={t('common.loading')} /></div> :
          errAnomalies ? <div className="p-12 rounded-[2.5rem] glass-card"><GlassErrorState title={t('common.error')} message={getErrorMessage(eAnomalies)} /></div> :
          <AnomaliesTab data={anomaliesData} t={t} />
        )}
        
        {activeTab === 'whatif' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-8 rounded-[2.5rem]">
              <h3 className="text-2xl font-light mb-8">{t('analytics.whatIfSimulation')}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">{t('analytics.priceIncrease')}</label>
                    <span className="text-sm font-bold bg-[var(--bg-secondary)] px-3 py-1 rounded-full">{priceIncrease}%</span>
                  </div>
                  <input 
                    type="range" min="-20" max="50" step="1" 
                    value={priceIncrease} onChange={e => setPriceIncrease(Number(e.target.value))}
                    className="w-full accent-[var(--accent-color)] h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">{t('analytics.studentVolume')}</label>
                    <span className="text-sm font-bold bg-[var(--bg-secondary)] px-3 py-1 rounded-full">{studentVolume}%</span>
                  </div>
                  <input 
                    type="range" min="-50" max="100" step="1" 
                    value={studentVolume} onChange={e => setStudentVolume(Number(e.target.value))}
                    className="w-full accent-[var(--accent-color)] h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-[var(--text-secondary)]">{t('analytics.payrollIncrease')}</label>
                    <span className="text-sm font-bold bg-[var(--bg-secondary)] px-3 py-1 rounded-full">{payrollIncrease}%</span>
                  </div>
                  <input 
                    type="range" min="-20" max="50" step="1" 
                    value={payrollIncrease} onChange={e => setPayrollIncrease(Number(e.target.value))}
                    className="w-full accent-[var(--accent-color)] h-1.5 bg-[var(--border-color)] rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>

              {loadingWhatIf ? (
                <div className="h-40 flex items-center justify-center"><GlassPageLoader label={t('analytics.simulating')} /></div>
              ) : errWhatIf ? (
                <GlassErrorState title={t('common.error')} message={getErrorMessage(eWhatIf)} />
              ) : sim?.status === 'INSUFFICIENT_DATA' ? (
                <div className="text-center p-8 text-[var(--text-secondary)] bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)]">{t('analytics.insufficientData')}</div>
) : sim && sim.status === 'SIMULATED' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)]">
                  <div>
                    <div className="text-sm text-[var(--text-secondary)] mb-1">{t('analytics.projectedRevenue')}</div>
                    <div className="text-3xl font-light">{new Intl.NumberFormat('uz-UZ').format(sim.projectedRevenue)}</div>
                    <div className="text-xs mt-2 text-emerald-500 font-medium">vs {new Intl.NumberFormat('uz-UZ').format(sim.baseRevenue)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--text-secondary)] mb-1">{t('analytics.projectedPayroll') || 'Projected Payroll'}</div>
                    <div className="text-3xl font-light">{new Intl.NumberFormat('uz-UZ').format(sim.projectedPayroll)}</div>
                    <div className="text-xs mt-2 text-rose-500 font-medium">vs {new Intl.NumberFormat('uz-UZ').format(sim.basePayroll)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-[var(--text-secondary)] mb-1">{t('analytics.projectedNetCashFlow') || 'Projected Net Cash Flow'}</div>
                    <div className={`text-3xl font-light ${sim.projectedNetCashFlow > sim.baseNetCashFlow ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {new Intl.NumberFormat('uz-UZ').format(sim.projectedNetCashFlow)}
                    </div>
                    <div className="text-xs mt-2 font-medium opacity-70">Delta: {new Intl.NumberFormat('uz-UZ').format(sim.difference)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'forecast' && <ForecastView forecastDays={forecastDays} setForecastDays={setForecastDays} t={t} />}
        {activeTab === 'reconciliation' && <ReconciliationView t={t} />}
      </div>
    </div>
  );
}

function ForecastView({ forecastDays, setForecastDays, t }: { forecastDays: number; setForecastDays: (n: number) => void; t: (key: string) => string}) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['financial-forecast', forecastDays],
    queryFn: () => analyticsApi.forecast({ days: forecastDays }),
    staleTime: 60_000,
  });

  const forecast = data as ForecastResult | undefined;

  if (isLoading) return <div className="p-16 flex items-center justify-center rounded-[2.5rem] glass-card"><GlassPageLoader label={t('common.loading')} /></div>;
  if (isError) return <div className="p-12 rounded-[2.5rem] glass-card"><GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} /></div>;

  if (!forecast || forecast.status === 'INSUFFICIENT_DATA') {
    return (
      <div className="glass-card p-12 rounded-[2.5rem] text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--bg-card)] flex items-center justify-center text-2xl border border-[var(--border-color)] shadow-sm">
          ðŸ“ˆ
        </div>
        <h3 className="text-xl font-medium mb-2">{t('analytics.insufficientData')}</h3>
        <p className="text-[var(--text-secondary)]">{t('analytics.insufficientDataDesc')}</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 rounded-[2.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
 <h3 className="text-2xl font-light">{t('analytics.financialForecast')}</h3>
 <GlassSelect
 value={String(forecastDays)}
 onChange={e => setForecastDays(Number(e.target.value))}
 aria-label={t('analytics.financialForecast')}
 className="w-auto"
 >
 <option value="30">30 {t('common.days')}</option>
 <option value="60">60 {t('common.days')}</option>
 <option value="90">90 {t('common.days')}</option>
 </GlassSelect>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] flex flex-col justify-center items-center text-center">
          <div className="text-sm text-[var(--text-secondary)] mb-2">{t('analytics.totalExpectedRevenue')}</div>
          <div className="text-4xl font-light text-emerald-500">{new Intl.NumberFormat('uz-UZ').format(forecast.status === 'CALCULATED' ? forecast.projectedRevenue : 0)}</div>
        </div>
        <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] flex flex-col justify-center items-center text-center">
          <div className="text-sm text-[var(--text-secondary)] mb-2">{t('analytics.totalExpectedExpenses')}</div>
          <div className="text-4xl font-light text-rose-500">{new Intl.NumberFormat('uz-UZ').format(forecast.status === 'CALCULATED' ? forecast.projectedExpenses + forecast.projectedPayroll : 0)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] flex flex-col justify-center items-center text-center">
          <div className="text-sm text-[var(--text-secondary)] mb-2">{t('analytics.projectedPayroll') || 'Projected Payroll'}</div>
          <div className="text-3xl font-light text-amber-500">{new Intl.NumberFormat('uz-UZ').format(forecast.status === 'CALCULATED' ? forecast.projectedPayroll : 0)}</div>
        </div>
        <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-[var(--border-color)] flex flex-col justify-center items-center text-center">
          <div className="text-sm text-[var(--text-secondary)] mb-2">{t('analytics.projectedNetCashFlow') || 'Projected Net Cash Flow'}</div>
          <div className={`text-3xl font-light ${(forecast.status === 'CALCULATED' ? forecast.projectedNetCashFlow : 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {new Intl.NumberFormat('uz-UZ').format(forecast.status === 'CALCULATED' ? forecast.projectedNetCashFlow : 0)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReconciliationView({ t }: { t: (key: string) => string}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['financial-reconciliation', year, month],
    queryFn: () => analyticsApi.reconciliation({ year, month }),
    staleTime: 60_000,
  });

  const recon = data as ReconciliationData;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 
 {/* Toolbar */}
 <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[1.5rem] glass-card">
 <label className="text-[0.8rem] font-bold uppercase tracking-widest text-[var(--text-muted)] pl-2">
 {t('finance.period')}
 </label>
 <div className="flex items-center gap-3">
 <GlassSelect
 value={String(month)}
 onChange={(e) => setMonth(Number(e.target.value))}
 aria-label={t('finance.period')}
 className="w-auto"
 >
 {monthNames.map((m, i) => (
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
 </div>
 </div>

 {isLoading ? (
 <div className="h-32 flex items-center justify-center rounded-[2.5rem] glass-card">
 <GlassPageLoader label={t('common.loading')} />
 </div>
 ) : isError ? (
 <div className="p-12 rounded-[2.5rem] glass-card">
 <GlassErrorState title={t('common.error')} message={getErrorMessage(error)} onRetry={() => refetch()} />
 </div>
 ) : recon ? (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <FinanceStatCard label={t('finance.totalInvoiced')} value={fmtCurrency(recon.receivables?.totalInvoiced ?? 0)} highlightColor="bg-brand-500"/>
 <FinanceStatCard label={t('finance.totalPaid')} value={fmtCurrency(recon.receivables?.totalPaid ?? 0)} highlightColor="bg-emerald-500"/>
 <FinanceStatCard label={t('finance.receivableDiff')} value={fmtCurrency(recon.receivables?.difference ?? 0)} highlightColor="bg-amber-500"/>
 <FinanceStatCard 
 label={t('finance.netCashFlow')} 
 value={fmtCurrency(recon.cashFlow?.netCashFlow ?? 0)} 
 highlightColor={(recon.cashFlow?.netCashFlow ?? 0) >= 0 ?'bg-emerald-500' :'bg-rose-500'}
 trend={(recon.cashFlow?.netCashFlow ?? 0) >= 0 ? { value: t('finance.positive'), direction:'up'} : { value: t('finance.negative'), direction:'down'}}
 isCurrency
 />
 </div>

 <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
 <GlassTable>
 <GlassTHead>
 <GlassTR>
<GlassTH>{t('finance.category')}</GlassTH>
  <GlassTH className="text-right">{t('finance.amountUsd')}</GlassTH>
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {[
 { label: t('finance.invoicesIssued'), val: recon.receivables?.totalInvoiced, isBold: false},
 { label: t('finance.paymentsReceived'), val: recon.receivables?.totalPaid, isBold: false},
 { label: t('finance.refundsProcessed'), val: (recon.cashFlow?.outflows ?? 0) - (recon.expenses?.total ?? 0), isBold: false},
 { label: t('finance.generalExpenses'), val: recon.expenses?.general, isBold: false},
 { label: t('finance.payroll'), val: recon.expenses?.payroll, isBold: false},
 { label: t('finance.totalExpenses'), val: recon.expenses?.total, isBold: true},
 ].map((row, i) => (
 <GlassTR key={i} className="hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <GlassTD className={`${row.isBold ?'font-black text-[var(--text-primary)]' :'font-bold text-[var(--text-secondary)]'}`}>
 {row.label}
 </GlassTD>
 <GlassTD className={`text-right font-mono ${row.isBold ?'font-black text-[var(--text-primary)]' :'font-semibold text-[var(--text-muted)]'}`}>
 {fmtCurrency(row.val ?? 0)}
 </GlassTD>
 </GlassTR>
 ))}
 {/* Summary Row */}
 <GlassTR className="bg-[var(--bg-card)] ">
 <GlassTD className="font-black text-[1.1rem] text-[var(--text-primary)]">
 {t('finance.netCashFlow')}
 </GlassTD>
 <GlassTD className={`text-right font-mono font-black text-[1.2rem] ${(recon.cashFlow?.netCashFlow ?? 0) >= 0 ?'text-emerald-600' :'text-rose-600'}`}>
 {fmtCurrency(recon.cashFlow?.netCashFlow ?? 0)}
 </GlassTD>
 </GlassTR>
 </GlassTBody>
 </GlassTable>
 </div>
 </div>
 </div>
 ) : null}
 </div>
 );
}export default FinancialAnalyticsPage;
