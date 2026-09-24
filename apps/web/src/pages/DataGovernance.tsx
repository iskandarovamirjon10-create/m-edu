import { useState} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
import { GlassPageHeader, GlassTabs, GlassButton, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassInput, GlassSelect, GlassSwitch } from'@/components/ui';
import { useToast} from'@/components/ui/GlassToast';
import { dataGovernanceApi} from'@/lib/api';
import { getErrorMessage} from'@/lib/errorMessages';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';
import type { DataGovernancePolicy, ExportLog, DataAccessLog, Paginated, RetentionCheckResult} from'@/types/governance';

type TabKey ='policies' |'exports' |'access' |'summary';

const DATA_TYPES = [
 { value:'STUDENT_RECORDS', label:'Student Records'},
 { value:'PAYMENT_RECORDS', label:'Payment Records'},
 { value:'AUDIT_LOGS', label:'Audit Logs'},
 { value:'FINANCIAL_REPORTS', label:'Financial Reports'},
 { value:'CRM_DATA', label:'CRM Data'},
];

const EXPORT_TYPES = [
 { value:'STUDENTS', label:'Students'},
 { value:'PAYMENTS', label:'Payments'},
 { value:'FINANCIAL', label:'Financial'},
 { value:'HR', label:'HR'},
 { value:'CRM', label:'CRM'},
 { value:'AUDIT', label:'Audit'},
 { value:'FULL_BACKUP', label:'Full Backup'},
];

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

function RetentionPoliciesTab() {
 const { t} = useI18n();
 usePageTitle(t('dg.title'));
 const toast = useToast();
 const queryClient = useQueryClient();
 const [editingType, setEditingType] = useState<string | null>(null);
 const [form, setForm] = useState({ retentionDays: 2555, archivalDays:'', deleteAfterDays:'', isActive: true});

 const policiesQuery = useQuery({
 queryKey: ['dg-policies'],
 queryFn: () => dataGovernanceApi.getRetentionPolicies(),
});

 const upsertMutation = useMutation({
 mutationFn: (data: { dataType: string; retentionDays: number; archivalDays: number | null; deleteAfterDays: number | null; isActive: boolean}) =>
 dataGovernanceApi.upsertRetentionPolicy(data),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['dg-policies']});
 toast.success(t('dg.policySaved'));
 setEditingType(null);
},
 onError: (err: Error) => toast.error(getErrorMessage(err)),
});

 const policies = policiesQuery.data ?? [];
 const policyMap = new Map(policies.map((p: DataGovernancePolicy) => [p.dataType, p]));

 if (policiesQuery.isLoading) return <GlassPageLoader />;
 if (policiesQuery.error) return <GlassErrorState message={getErrorMessage(policiesQuery.error as Error)} onRetry={() => policiesQuery.refetch()} />;

 return (
 <div className="space-y-4">
 {DATA_TYPES.map((dt) => {
 const existing = policyMap.get(dt.value);
 const isEditing = editingType === dt.value;
 return (
 <div key={dt.value} className="rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-card)] backdrop-blur-xl p-5">
 <div className="flex items-center justify-between mb-3">
 <div>
 <h3 className="text-sm font-bold text-[var(--text-primary)]">{dt.label}</h3>
 {existing && (
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 Retention: {existing.retentionDays}d
 {existing.archivalDays ? ` | Archive: ${existing.archivalDays}d` :''}
 {existing.deleteAfterDays ? ` | Delete: ${existing.deleteAfterDays}d` :''}
 {existing.lastRunAt ? ` | Last run: ${new Date(existing.lastRunAt).toLocaleDateString()}` :''}
 </p>
 )}
 </div>
 <div className="flex items-center gap-2">
 {existing && (
 <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${existing.isActive ?'bg-emerald-500/10 text-emerald-600' :'bg-[var(--state-hover)] text-[var(--text-muted)]'}`}>
 {existing.isActive ?'Active' :'Inactive'}
 </span>
 )}
 <GlassButton size="sm"onClick={() => {
 setEditingType(isEditing ? null : dt.value);
 if (existing) {
 setForm({
 retentionDays: existing.retentionDays,
 archivalDays: existing.archivalDays?.toString() ??'',
 deleteAfterDays: existing.deleteAfterDays?.toString() ??'',
 isActive: existing.isActive,
});
} else {
 setForm({ retentionDays: 2555, archivalDays:'', deleteAfterDays:'', isActive: true});
}
}}>
 {isEditing ? t('common.cancel') : existing ? t('common.edit') : t('common.create')}
 </GlassButton>
 </div>
 </div>
 {isEditing && (
 <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]/50 ">
 <GlassInput label={t('dg.retentionDays')}type="number"value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: +e.target.value})} />
 <GlassInput label={t('dg.archiveAfter')}type="number"value={form.archivalDays} placeholder={t('common.optional')} onChange={(e) => setForm({ ...form, archivalDays: e.target.value})} />
 <GlassInput label={t('dg.deleteAfter')}type="number"value={form.deleteAfterDays} placeholder={t('common.optional')} onChange={(e) => setForm({ ...form, deleteAfterDays: e.target.value})} />
 <div className="flex items-end gap-2">
 <GlassSwitch
 checked={form.isActive}
 onChange={(checked) => setForm({ ...form, isActive: checked})}
 aria-label={t('dg.active')}
 />
 <span className="text-sm">{t('dg.active')}</span>
 <GlassButton size="sm"onClick={() => upsertMutation.mutate({
 dataType: dt.value,
 retentionDays: form.retentionDays,
 archivalDays: form.archivalDays ? +form.archivalDays : null,
 deleteAfterDays: form.deleteAfterDays ? +form.deleteAfterDays : null,
 isActive: form.isActive,
})} disabled={upsertMutation.isPending}>
 {upsertMutation.isPending ? t('common.saving') : t('common.save')}
 </GlassButton>
 </div>
 </div>
 )}
 </div>
 );
})}
 </div>
 );
}

function ExportLogTab() {
 const { t} = useI18n();
 const [page, setPage] = useState(1);
 const [exportTypeFilter, setExportTypeFilter] = useState('');
 const [statusFilter, setStatusFilter] = useState('');

 const exportLogQuery = useQuery({
 queryKey: ['dg-export-log', page, exportTypeFilter, statusFilter],
 queryFn: () => dataGovernanceApi.exportLogs({ page, limit: 20, exportType: exportTypeFilter || undefined, status: statusFilter || undefined}),
});

 const data = exportLogQuery.data as Paginated<ExportLog> | undefined;
 const items = data?.items ?? [];

 if (exportLogQuery.isLoading) return <GlassPageLoader />;
 if (exportLogQuery.error) return <GlassErrorState message={getErrorMessage(exportLogQuery.error as Error)} onRetry={() => exportLogQuery.refetch()} />;

 return (
 <div className="space-y-4">
 <div className="flex flex-wrap gap-3">
 <GlassSelect value={exportTypeFilter} onChange={(e) => { setExportTypeFilter(e.target.value); setPage(1);}} aria-label={t('dg.allTypes')}>
 <option value="">{t('dg.allTypes')}</option>
  {EXPORT_TYPES.map((et) => <option key={et.value} value={et.value}>{et.label}</option>)}
  </GlassSelect>
  <GlassSelect value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1);}} aria-label={t('dg.allStatus')}>
  <option value="">{t('dg.allStatus')}</option>
  <option value="PENDING">{t('dg.status.PENDING')}</option>
  <option value="PROCESSING">{t('dg.status.PROCESSING')}</option>
  <option value="COMPLETED">{t('dg.status.COMPLETED')}</option>
  <option value="FAILED">{t('dg.status.FAILED')}</option>
 </GlassSelect>
 </div>

 {items.length === 0 ? (
 <GlassEmptyState title={t('dg.noExports')} message={t('dg.noExportsHint')} />
 ) : (
 <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-card)] backdrop-blur-xl">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]/50 ">
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.type')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.format')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.records')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.user')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('common.status')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('common.date')}</th>
 </tr>
 </thead>
 <tbody>
 {items.map((item: { id: string; [key: string]: any }) => (
 <tr key={item.id} className="border-b border-[var(--border-subtle)]/50 last:border-0 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)]">
 <td className="px-4 py-3 font-medium">{item.exportType}</td>
 <td className="px-4 py-3">{item.format}</td>
 <td className="px-4 py-3">{item.recordCount.toLocaleString()}</td>
 <td className="px-4 py-3">{item.user ? `${item.user.firstName} ${item.user.lastName}` :'-'}</td>
 <td className="px-4 py-3">
 <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${
 item.status ==='COMPLETED' ?'bg-emerald-500/10 text-emerald-600' :
 item.status ==='FAILED' ?'bg-rose-500/10 text-rose-600' :
'bg-amber-500/10 text-amber-600'
}`}>{item.status}</span>
 </td>
 <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(item.createdAt).toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {data && data.totalPages > 1 && (
 <div className="flex items-center justify-center gap-2 mt-4">
 <GlassButton size="sm"onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</GlassButton>
 <span className="text-sm text-[var(--text-muted)]">{page} / {data.totalPages}</span>
 <GlassButton size="sm"onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>Next</GlassButton>
 </div>
 )}
 </div>
 );
}

function AccessAuditTab() {
 const { t} = useI18n();
 const [page, setPage] = useState(1);
 const [entityFilter, setEntityFilter] = useState('');
 const [actionFilter, setActionFilter] = useState('');

 const accessQuery = useQuery({
 queryKey: ['dg-access-audit', page, entityFilter, actionFilter],
 queryFn: () => dataGovernanceApi.getDataAccessAudit({ page, limit: 20, entityType: entityFilter || undefined, action: actionFilter || undefined}),
});

 const data = accessQuery.data as Paginated<DataAccessLog> | undefined;
 const items = data?.items ?? [];

 if (accessQuery.isLoading) return <GlassPageLoader />;
 if (accessQuery.error) return <GlassErrorState message={getErrorMessage(accessQuery.error as Error)} onRetry={() => accessQuery.refetch()} />;

 return (
 <div className="space-y-4">
 <div className="flex flex-wrap gap-3">
 <GlassSelect value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1);}} aria-label={t('dg.allEntities')}>
 <option value="">{t('dg.allEntities')}</option>
 <option value="STUDENT">{t('dg.entity.STUDENT')}</option>
 <option value="PAYMENT">{t('dg.entity.PAYMENT')}</option>
 <option value="EMPLOYEE">{t('dg.entity.EMPLOYEE')}</option>
 <option value="SALARY">{t('dg.entity.SALARY')}</option>
 <option value="INVOICE">{t('dg.entity.INVOICE')}</option>
 <option value="EXPENSE">{t('dg.entity.EXPENSE')}</option>
 <option value="FACE_ENROLLMENT">{t('dg.entity.FACE_ENROLLMENT')}</option>
 <option value="PARENT_ACCOUNT">{t('dg.entity.PARENT_ACCOUNT')}</option>
 </GlassSelect>
 <GlassSelect value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1);}} aria-label={t('dg.allActions')}>
 <option value="">{t('dg.allActions')}</option>
 <option value="CREATE">{t('dg.act.CREATE')}</option>
 <option value="UPDATE">{t('dg.act.UPDATE')}</option>
 <option value="DELETE">{t('dg.act.DELETE')}</option>
 <option value="EXPORT">{t('dg.act.EXPORT')}</option>
 <option value="LOGIN">{t('dg.act.LOGIN')}</option>
 </GlassSelect>
 </div>

 {items.length === 0 ? (
 <GlassEmptyState title={t('dg.noAccessLogs')} message={t('dg.noAccessLogsHint')} />
 ) : (
 <div className="overflow-x-auto rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-card)] backdrop-blur-xl">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]/50 ">
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.action')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.entity')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.entityId')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.user')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('dg.ip')}</th>
 <th className="px-4 py-3 text-left font-bold text-[var(--text-muted)]">{t('common.date')}</th>
 </tr>
 </thead>
 <tbody>
 {items.map((item: { id: string; [key: string]: any }) => (
 <tr key={item.id} className="border-b border-[var(--border-subtle)]/50 last:border-0 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)]">
 <td className="px-4 py-3">
 <span className={`px-2 py-0.5 rounded-full text-[0.7rem] font-bold ${
 item.action ==='DELETE' ?'bg-rose-500/10 text-rose-600' :
 item.action ==='CREATE' ?'bg-emerald-500/10 text-emerald-600' :
 item.action ==='EXPORT' ?'bg-amber-500/10 text-amber-600' :
'bg-blue-500/10 text-blue-600'
}`}>{item.action}</span>
 </td>
 <td className="px-4 py-3 font-medium">{item.resource}</td>
 <td className="px-4 py-3 font-mono text-xs">{item.resourceId ??'-'}</td>
 <td className="px-4 py-3">{item.userName ??'-'}</td>
 <td className="px-4 py-3 text-[var(--text-muted)]">{item.ipAddress ??'-'}</td>
 <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(item.timestamp).toLocaleString()}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}

 {data && data.totalPages > 1 && (
 <div className="flex items-center justify-center gap-2 mt-4">
 <GlassButton size="sm"onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</GlassButton>
 <span className="text-sm text-[var(--text-muted)]">{page} / {data.totalPages}</span>
 <GlassButton size="sm"onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>Next</GlassButton>
 </div>
 )}
 </div>
 );
}

function SummaryTab() {
 const { t} = useI18n();
 const toast = useToast();

 const statsQuery = useQuery({
 queryKey: ['dg-export-stats'],
 queryFn: () => dataGovernanceApi.getExportStats(),
});

 const policiesQuery = useQuery({
 queryKey: ['dg-policies'],
 queryFn: () => dataGovernanceApi.getRetentionPolicies(),
});

 const retentionMutation = useMutation({
 mutationFn: async () => (await dataGovernanceApi.runRetentionCheck()) as RetentionCheckResult,
 onSuccess: (data) => {
 toast.success(t('dg.retentionChecked', { count: data.policiesChecked}));
},
 onError: (err: Error) => toast.error(getErrorMessage(err)),
});

 const stats = statsQuery.data;
 const policies = policiesQuery.data ?? [];
 const activePolicies = policies.filter((p: DataGovernancePolicy) => p.isActive).length;
 const lastRun = policies.reduce((latest: Date | null, p: any) => {
 if (!p.lastRunAt) return latest;
 const d = new Date(p.lastRunAt);
 return !latest || d > latest ? d : latest;
}, null);

 if (statsQuery.isLoading) return <GlassPageLoader />;
 if (statsQuery.error) return <GlassErrorState message={getErrorMessage(statsQuery.error as Error)} onRetry={() => statsQuery.refetch()} />;

 return (
 <div className="space-y-6">
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
 <StatCard label={t('dg.totalExports')} value={stats?.totalExports ?? 0} color="bg-blue-500"/>
 <StatCard label={t('dg.last30Days')} value={stats?.last30Days ?? 0} color="bg-emerald-500"/>
 <StatCard label={t('dg.activePolicies')} value={activePolicies} color="bg-purple-500"/>
 <StatCard label={t('dg.totalPolicies')} value={policies.length} color="bg-amber-500"/>
 </div>

 <div className="rounded-2xl border border-[var(--border-subtle)]/60 bg-[var(--bg-card)] backdrop-blur-xl p-5">
 <div className="flex items-center justify-between mb-4">
 <div>
 <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('dg.retentionCheck')}</h3>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 {lastRun ? `${t('dg.lastRun')}: ${lastRun.toLocaleString()}` : t('dg.neverRun')}
 </p>
 </div>
 <GlassButton size="sm"onClick={() => retentionMutation.mutate()} disabled={retentionMutation.isPending}>
 {retentionMutation.isPending ? t('common.loading') : t('dg.runCheck')}
 </GlassButton>
 </div>

 {stats?.byType && stats.byType.length > 0 && (
 <div className="mt-4">
 <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">{t('dg.exportsByType')}</h4>
 <div className="space-y-2">            {stats.byType.map((item) => (
 <div key={item.type} className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]/50 last:border-0">
 <span className="text-sm font-medium">{item.type}</span>
 <span className="text-sm text-[var(--text-muted)]">{item.count}</span>
 </div>
 ))}
 </div>
 </div>
 )}

 {stats?.lastExport && (
 <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]/50 ">
 <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-2">{t('dg.lastExport')}</h4>
 <p className="text-sm">{stats.lastExport.exportType} ({stats.lastExport.format}) — {stats.lastExport.recordCount.toLocaleString()} records</p>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">{new Date(stats.lastExport.createdAt).toLocaleString()}</p>
 </div>
 )}
 </div>
 </div>
 );
}

export function DataGovernancePage() {
 const { t} = useI18n();
 const [activeTab, setActiveTab] = useState<TabKey>('summary');

 const tabs = [
 { id:'summary', label: t('dg.tabSummary')},
 { id:'policies', label: t('dg.tabPolicies')},
 { id:'exports', label: t('dg.tabExports')},
 { id:'access', label: t('dg.tabAccess')},
 ];

 return (
 <div>
 <GlassPageHeader title={t('dg.title')} subtitle={t('dg.subtitle')} />
 <GlassTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as TabKey)} className="mb-6"/>
 {activeTab ==='summary' && <SummaryTab />}
 {activeTab ==='policies' && <RetentionPoliciesTab />}
 {activeTab ==='exports' && <ExportLogTab />}
 {activeTab ==='access' && <AccessAuditTab />}
 </div>
 );
}

export default DataGovernancePage;
