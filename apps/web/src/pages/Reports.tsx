/**
 * ReportsPage — Production-Grade Analytics & Dynamic Report Generator
 * Real-time querying over live educational & financial dimensions.
 */
import { useState} from'react';
import { useQuery} from'@tanstack/react-query';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassCard,
 GlassStatCard,
 GlassTable,
 GlassTHead,
 GlassTBody,
 GlassTR,
 GlassTH,
 GlassTD,
 GlassButton,
 GlassSelect,
 GlassInput,
 GlassBadge,
 useToast,
} from'@/components/ui';
import { reportsApi} from'@/lib/api';
import { usePageTitle} from'@/hooks/usePageTitle';
import { getErrorMessage} from'@/lib/errorMessages';
import { useI18n} from'@/i18n/I18nProvider';

interface ReportColumn {
 key: string;
 label: string;
}

interface RunReportResponse {
 status:'READY' |'EMPTY' |'INSUFFICIENT_DATA';
 reason?: string;
 type: string;
 columns: ReportColumn[];
 selectedColumns: string[];
 rows: Array<Record<string, unknown>>;
 totalRows: number;
 page: number;
 pageSize: number;
 totalPages: number;
 generatedAt: string;
}

// label fields hold i18n KEYS (t() applied at render).
const REPORT_DIMENSIONS = [
 { value:'STUDENTS', label:'reports.dim.STUDENTS'},
 { value:'ATTENDANCE', label:'reports.dim.ATTENDANCE'},
 { value:'PAYMENTS', label:'reports.dim.PAYMENTS'},
 { value:'INVOICES', label:'reports.dim.INVOICES'},
 { value:'FINANCE', label:'reports.dim.FINANCE'},
 { value:'TEACHERS', label:'reports.dim.TEACHERS'},
 { value:'GROUPS', label:'reports.dim.GROUPS'},
 { value:'EXPENSES', label:'reports.dim.EXPENSES'},
 { value:'PAYROLL', label:'reports.dim.PAYROLL'},
 { value:'LEADS', label:'reports.dim.LEADS'},
];

const REPORT_STATUS_KEYS: Record<string, string> = {
 READY:'reports.status.READY',
 EMPTY:'reports.status.EMPTY',
 INSUFFICIENT_DATA:'reports.status.INSUFFICIENT_DATA',
};

export function ReportsPage() {
 const { t} = useI18n();
 usePageTitle(t('nav.reports'));
 const toast = useToast();

 const [dimension, setDimension] = useState('STUDENTS');
 const [dateFrom, setDateFrom] = useState(() => {
 const d = new Date();
 d.setMonth(d.getMonth() - 1);
 return d.toISOString().split('T')[0];
});
 const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

 const reportQuery = useQuery({
 queryKey: ['reports', dimension, dateFrom, dateTo],
 queryFn: async () => {
 const res = await reportsApi.run({
 type: dimension,
 dateFrom: dateFrom || undefined,
 dateTo: dateTo || undefined,
 page: 1,
 pageSize: 50,
});
 return res as RunReportResponse;
},
});

 const exportData = async (format:'csv' | 'json' | 'pdf' | 'xlsx') => {
   try {
     await reportsApi.export(dimension, format, {
       dateFrom: dateFrom || undefined,
       dateTo: dateTo || undefined,
     });
     toast.push({ message: t('reports.exported', { filename: format }), type: 'success' });
   } catch (err: any) {
     toast.push({ message: getErrorMessage(err) || t('reports.exportFailed'), type: 'error' });
   }
 };

 const reportData = reportQuery.data;

 return (
 <div className="space-y-6 animate-in fade-in duration-300">
 <GlassPageHeader
 title={t('reports.title')}
 subtitle={t('reports.subtitle')}
 />

 {/* Filter and Configuration Bar */}
 <GlassCard className="p-4 sm:p-6">
 <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
 <div>
 <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
 {t('reports.dimensionLabel')}
 </label>
 <GlassSelect
 value={dimension}
 onChange={(e) => setDimension(e.target.value)}
 className="w-full"
 >
 {REPORT_DIMENSIONS.map((dim) => (
 <option key={dim.value} value={dim.value}>
 {t(dim.label)}
 </option>
 ))}
 </GlassSelect>
 </div>

  <div>
  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
  {t('reports.fromDate')}
  </label>
  <GlassInput
  type="date"
  value={dateFrom}
  onChange={(e) => setDateFrom(e.target.value)}
  className="w-full"
  />
  </div>

  <div>
  <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
  {t('reports.toDate')}
  </label>
  <GlassInput
  type="date"
  value={dateTo}
  onChange={(e) => setDateTo(e.target.value)}
  className="w-full"
  />
  </div>
 </div>

 <div className="flex items-center gap-2.5">
 <GlassButton
 variant="secondary"
 onClick={() => reportQuery.refetch()}
 disabled={reportQuery.isFetching}
 >
 {t('reports.refresh')}
 </GlassButton>
 <GlassButton
 variant="secondary"
 onClick={() => exportData('csv')}
 disabled={!reportData?.rows?.length}
 >
 {t('reports.exportCsv')}
 </GlassButton>
 <GlassButton
 variant="primary"
 onClick={() => exportData('xlsx')}
 disabled={!reportData?.rows?.length}
 >
 {t('reports.exportXlsx', 'Export XLSX')}
 </GlassButton>
 </div>
 </div>
 </GlassCard>

 {/* Summary KPI Cards */}
 {reportData && (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <GlassStatCard
 label={t('reports.totalRows')}
 value={reportData.totalRows ?? reportData.rows?.length ?? 0}
 />
 <GlassStatCard
 label={t('reports.reportStatus')}
 value={t(REPORT_STATUS_KEYS[reportData.status] ?? `reports.status.${reportData.status}`)}
 />
 <GlassStatCard
 label={t('reports.dimension')}
 value={t(`reports.dim.${reportData.type}`)}
 />
 <GlassStatCard
 label={t('reports.generated')}
 value={
 reportData.generatedAt
 ? new Date(reportData.generatedAt).toLocaleTimeString()
 : t('reports.live')
 }
 />
 </div>
 )}

 {/* Report Data Preview Table */}
 {reportQuery.isLoading ? (
 <div className="h-64 flex items-center justify-center">
 <GlassPageLoader label={t('reports.loading')}/>
 </div>
 ) : reportQuery.isError ? (
 <GlassErrorState
 title={t('reports.loadError')}
 message={getErrorMessage(reportQuery.error)}
 onRetry={() => reportQuery.refetch()}
 />
 ) : !reportData || reportData.rows.length === 0 ? (
 <GlassEmptyState
 title={t('reports.emptyTitle')}
 message={t('reports.emptyMessage')}
 />
 ) : (
 <GlassCard className="overflow-hidden p-0">
 <div className="overflow-x-auto">
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 {reportData.columns.map((col) => (
 <GlassTH key={col.key}>{col.label}</GlassTH>
 ))}
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {reportData.rows.map((row, idx) => (
 <GlassTR key={idx}>
 {reportData.columns.map((col) => {
 const val = row[col.key];
 return (
 <GlassTD key={col.key}>
 {typeof val ==='boolean' ? (
 <GlassBadge variant={val ?'success' :'muted'}>
 {val ? t('common.yes') : t('common.no')}
 </GlassBadge>
 ) : val === null || val === undefined ? (
 <span className="text-[var(--text-muted)] text-xs italic">—</span>
 ) : typeof val ==='object' ? (
 JSON.stringify(val)
 ) : (
 String(val)
 )}
 </GlassTD>
 );
})}
 </GlassTR>
 ))}
 </GlassTBody>
 </GlassTable>
 </div>
 </GlassCard>
 )}
 </div>
 );
}

export default ReportsPage;

