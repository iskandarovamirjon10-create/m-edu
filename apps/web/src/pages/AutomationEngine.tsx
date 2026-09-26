import { fetchAllPaginated} from'@/lib/fetchAllPaginated';
import { useState} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
import { automationApi} from'@/lib/api';
 import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassInput,
 GlassSelect,
 GlassModal,
 GlassButton,
 GlassSwitch,
 ConfirmDialog,
 useToasts, GlassTabs } from '@/components/ui';

import { useI18n} from'@/i18n/I18nProvider';
import { AutomationRule, AutomationExecution, AutomationStats } from '@/types/automation';

const EVENT_TYPES = [
'STUDENT_ABSENT','REPEATED_LATENESS','INVOICE_OVERDUE','PAYMENT_RECEIVED',
'LEAD_INACTIVE','DOCUMENT_EXPIRED','MANUAL',
];

const ACTION_TYPES = ['IN_APP_NOTIFICATION','TELEGRAM','SMS','AUDIT_LOG','CRM_TASK'];
const TARGET_OPTIONS = ['ALL','ADMINS','MANAGERS','PARENTS'];

const STATUS_COLORS: Record<string, string> = {
 SUCCESS:'bg-emerald-500/10 text-emerald-600',
 FAILED:'bg-red-500/10 text-red-600',
 EXECUTING:'bg-blue-500/10 text-blue-600',
 PENDING:'bg-amber-500/10 text-amber-600',
 LOOP_DETECTED:'bg-purple-500/10 text-purple-600',
};

interface RuleForm {
 name: string;
 description: string;
 eventType: string;
 conditions: Array<{ field: string; operator: string; value: unknown}>;
 actions: Array<{ type: string; template?: string; target?: string; message?: string}>;
 cooldownMinutes: number;
 maxTriggersPerDay: number;
}

const INITIAL_FORM: RuleForm = {
 name:'',
 description:'',
 eventType:'STUDENT_ABSENT',
 conditions: [],
 actions: [{ type:'IN_APP_NOTIFICATION', template:'', target:'MANAGERS'}],
 cooldownMinutes: 60,
 maxTriggersPerDay: 50,
};

function formatType(type: string) {
 return type.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

function StatCard({ label, value, color}: { label: string; value: string | number; color: string}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card flex flex-col justify-between h-full">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${color}`} aria-hidden />
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest relative z-10 mb-4">{label}</p>
 <p className="text-[2rem] font-black tracking-tight leading-none text-[var(--text-primary)] relative z-10">{value}</p>
 </div>
 );
}

export function AutomationEnginePage() {
 const { t} = useI18n();
 const { push: toast, toastNode} = useToasts();
 const queryClient = useQueryClient();

 const [activeTab, setActiveTab] = useState('rules');
 const [showModal, setShowModal] = useState(false);
 const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
 const [form, setForm] = useState<RuleForm>(INITIAL_FORM);

 const { data: rules, isLoading: rulesLoading, error: rulesError } = useQuery({
   queryKey: ['automation-rules'],
   queryFn: () => automationApi.listRules() as Promise<AutomationRule[]>,
 });

 const { data: executions, isLoading: execLoading, error: execError} = useQuery({
 queryKey: ['automation-executions'],
 queryFn: async () => {
 const res = await fetchAllPaginated(automationApi.executions);
 return res.items as AutomationExecution[];
},
 enabled: activeTab ==='executions',
});

 const { data: stats, isLoading: statsLoading, error: statsError} = useQuery({
 queryKey: ['automation-stats'],
 queryFn: () => automationApi.stats() as Promise<AutomationStats>,
 enabled: activeTab ==='stats',
});

 const createMutation = useMutation({
 mutationFn: (data: RuleForm) => automationApi.createRule(data),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['automation-rules']});
 toast('success', t('automation.rule.created'));
 setShowModal(false);
 setForm(INITIAL_FORM);
},
 onError: () => toast('error'),
});

 const updateMutation = useMutation({
 mutationFn: ({ id, data}: { id: string; data: Partial<RuleForm>}) => automationApi.updateRule(id, data),
 onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
 toast('success', t('automation.rule.updated'));
 setShowModal(false);
 setEditingRule(null);
 setForm(INITIAL_FORM);
},
 onError: () => toast('error'),
});

 const deleteMutation = useMutation({
 mutationFn: (id: string) => automationApi.deleteRule(id),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['automation-rules']});
 toast('success', t('automation.rule.deleted'));
},
 onError: () => toast('error'),
});

 const toggleMutation = useMutation({
 mutationFn: ({ id}: { id: string; isActive: boolean}) => automationApi.toggleRule(id),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automation-rules']}),
 // A failed enable/disable previously produced no feedback at all — the
 // switch looked like it worked until the next refetch reverted it.
 onError: () => toast('error'),
});

 const evaluateAllMutation = useMutation({
 mutationFn: () => automationApi.evaluateAll(),
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
    queryClient.invalidateQueries({ queryKey: ['automation-executions'] });
    queryClient.invalidateQueries({ queryKey: ['automation-stats'] });
    toast('success', `Evaluated ${data?.evaluated ?? 0} rules. Triggered ${data?.triggered ?? 0}.`);
  },
 onError: () => toast('error'),
});

 const handleOpenCreate = () => {
 setEditingRule(null);
 setForm(INITIAL_FORM);
 setShowModal(true);
};

 const handleOpenEdit = (rule: AutomationRule) => {
 setEditingRule(rule);
 setForm({
 name: rule.name,
 description: rule.description ??'',
 eventType: rule.eventType,
 conditions: rule.conditions ?? [],
 actions: rule.actions ?? [],
 cooldownMinutes: rule.cooldownMinutes,
 maxTriggersPerDay: rule.maxTriggersPerDay,
});
 setShowModal(true);
};

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.name.trim()) return;
 if (editingRule) {
 updateMutation.mutate({ id: editingRule.id, data: form});
} else {
 createMutation.mutate(form);
}
};

 const addCondition = () => setForm((f) => ({ ...f, conditions: [...f.conditions, { field:'', operator:'gte', value:''}]}));
 const removeCondition = (i: number) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i)}));
 const updateCondition = (i: number, patch: Partial<{ field: string; operator: string; value: unknown}>) =>
 setForm((f) => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, ...patch} : c)}));

 const addAction = () => setForm((f) => ({ ...f, actions: [...f.actions, { type:'IN_APP_NOTIFICATION', target:'MANAGERS'}]}));
 const removeAction = (i: number) => setForm((f) => ({ ...f, actions: f.actions.filter((_, idx) => idx !== i)}));
 const updateAction = (i: number, patch: Partial<{ type: string; template?: string; target?: string; message?: string}>) =>
 setForm((f) => ({ ...f, actions: f.actions.map((a, idx) => idx === i ? { ...a, ...patch} : a)}));

 if (rulesLoading) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('automation.title')} subtitle={t('automation.subtitle')} />
 <div className="mt-8 rounded-[2.5rem] p-16 flex items-center justify-center glass-card">
 <GlassPageLoader label="Loading automation engine..."/>
 </div>
 </div>
 );
}

 if (rulesError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('automation.title')} subtitle="Connection error"/>
 <div className="mt-8 rounded-[2.5rem] p-12 glass-card">
 <GlassErrorState message="Failed to load automation data. Please try again."onRetry={() => queryClient.invalidateQueries({ queryKey: ['automation-rules']})} />
 </div>
 </div>
 );
}

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-emerald-400/5 blur-[100px]"/>
 </div>

 <div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 {toastNode}

 <ConfirmDialog
  open={deleteTarget !== null}
  onClose={() => setDeleteTarget(null)}
  onConfirm={() => {
   if (!deleteTarget) return;
   deleteMutation.mutate(deleteTarget.id);
   setDeleteTarget(null);
  }}
  description={t('automation.rule.deleteConfirm')}
  loading={deleteMutation.isPending}
 />

 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <GlassPageHeader title={t('automation.title')} subtitle={t('automation.subtitle')} />
 <div className="flex gap-3">
 <GlassButton
 type="button"
 variant="secondary"
 onClick={() => evaluateAllMutation.mutate()}
 disabled={evaluateAllMutation.isPending}
 loading={evaluateAllMutation.isPending}
 icon={!evaluateAllMutation.isPending ? <svg className="w-4 h-4 text-brand-500"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> : undefined}
 >
 {evaluateAllMutation.isPending ? t('automation.running') : t('automation.runNow')}
 </GlassButton>
 <GlassButton
 type="button"
 variant="primary"
 onClick={handleOpenCreate}
 icon={<svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>}
 >
 {t('automation.addRule')}
 </GlassButton>
 </div>
 </div>

 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-[1.5rem] glass-card">
 <GlassTabs active={activeTab} onChange={setActiveTab} tabs={[{ id: 'rules', label: String(t('automation.tab.rules')), count: rules?.length ?? 0 }, { id: 'executions', label: String(t('automation.tab.executions')), count: executions?.length ?? 0 }, { id: 'stats', label: String(t('automation.tab.stats')) }]} />
 </div>

 {activeTab ==='rules' && (
 <div className="space-y-4">
 {(!rules || rules.length === 0) ? (
 <div className="rounded-[2.5rem] p-12 glass-card">
 <GlassEmptyState title={t('automation.rule.empty')} description={t('automation.rule.emptyHint')} />
 </div>
 ) : (
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {rules.map((rule: AutomationRule) => (
 <div key={rule.id} className="relative group rounded-[2rem] p-6 glass-card transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className="relative z-10 space-y-3">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h3 className="text-[0.95rem] font-bold text-[var(--text-primary)] truncate">{rule.name}</h3>
 {rule.description && <p className="text-[0.8rem] text-[var(--text-muted)] mt-1 line-clamp-2">{rule.description}</p>}
 </div>
 <GlassSwitch
 checked={rule.isActive}
 onChange={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive})}
 aria-label={t('automation.rule.toggleAria', { name: rule.name})}
 />
 </div>
 <div className="flex flex-wrap gap-2">
 <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-bold bg-brand-500/10 text-brand-600 ">
 {formatType(rule.eventType)}
 </span>
 <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-bold bg-[var(--bg-surface)]0/10 text-[var(--text-secondary)] ">
 Runs: {rule.totalRuns}
 </span>
 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-bold ${rule.isActive ?'bg-emerald-500/10 text-emerald-600' :'bg-[var(--bg-surface)]0/10 text-[var(--text-muted)]'}`}>
 {rule.isActive ?'Active' :'Inactive'}
 </span>
 </div>
 <div className="flex gap-2 pt-2">
 <GlassButton variant="secondary" size="sm" className="flex-1" onClick={() => handleOpenEdit(rule)}>
 {t('common.edit')}
 </GlassButton>
 <GlassButton variant="danger" size="sm" className="flex-1" onClick={() => setDeleteTarget(rule)}>
 {t('common.delete')}
 </GlassButton>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}

 {activeTab ==='executions' && (
 <div className="rounded-[2.5rem] glass-card overflow-hidden">
 {execLoading ? (
 <div className="p-16 flex items-center justify-center"><GlassPageLoader label="Loading executions..."/></div>
 ) : execError ? (
 <div className="p-12"><GlassErrorState message="Failed to load executions"/></div>
 ) : !executions || executions.length === 0 ? (
 <div className="p-12"><GlassEmptyState title="No executions yet"description="Run the engine to see execution history."/></div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-[0.85rem]">
 <thead>
 <tr className="border-b border-[var(--border-subtle)]/60 ">
 <th className="text-left px-6 py-4 font-bold text-[var(--text-muted)] uppercase tracking-wider text-[0.7rem]">Rule</th>
 <th className="text-left px-6 py-4 font-bold text-[var(--text-muted)] uppercase tracking-wider text-[0.7rem]">Event</th>
 <th className="text-left px-6 py-4 font-bold text-[var(--text-muted)] uppercase tracking-wider text-[0.7rem]">Entity</th>
 <th className="text-left px-6 py-4 font-bold text-[var(--text-muted)] uppercase tracking-wider text-[0.7rem]">Status</th>
 <th className="text-left px-6 py-4 font-bold text-[var(--text-muted)] uppercase tracking-wider text-[0.7rem]">Triggered</th>
 </tr>
 </thead>
 <tbody>
 {executions.map((exec: AutomationExecution) => (
 <tr key={exec.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors">
 <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{exec.rule?.name ??'-'}</td>
 <td className="px-6 py-4">
 <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.7rem] font-bold bg-brand-500/10 text-brand-600 ">
 {formatType(exec.rule?.eventType ??'')}
 </span>
 </td>
 <td className="px-6 py-4 text-[var(--text-secondary)] ">{exec.entityType ??'-'} / {exec.entityId?.slice(0, 8) ??'-'}</td>
 <td className="px-6 py-4">
 <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[0.7rem] font-bold ${STATUS_COLORS[exec.status] ??'bg-[var(--bg-surface)]0/10 text-[var(--text-muted)]'}`}>
 {exec.status}
 </span>
 </td>
 <td className="px-6 py-4 text-[var(--text-muted)] text-[0.8rem]">
 {new Date(exec.startedAt).toLocaleString()}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 )}

 {activeTab ==='stats' && (
 <div className="space-y-6">
 {statsLoading ? (
 <div className="rounded-[2.5rem] p-16 flex items-center justify-center glass-card">
 <GlassPageLoader label="Loading statistics..."/>
 </div>
 ) : statsError ? (
 <div className="rounded-[2.5rem] p-12 glass-card">
 <GlassErrorState message="Failed to load statistics"/>
 </div>
 ) : stats ? (
 <>
 <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 <StatCard label={t('automation.stats.totalRules')} value={stats.totalRules} color="bg-brand-500"/>
 <StatCard label={t('automation.stats.activeRules')} value={stats.activeRules} color="bg-emerald-500"/>
 <StatCard label={t('automation.stats.totalExecutions')} value={stats.totalExecutions} color="bg-blue-500"/>
 <StatCard label={t('automation.stats.successRate')} value={`${stats.successRate}%`} color="bg-amber-500"/>
 </div>
 {stats.topRules && stats.topRules.length > 0 && (
 <div className="rounded-[2.5rem] p-6 glass-card">
 <h3 className="text-[0.9rem] font-bold text-[var(--text-primary)] mb-4">{t('automation.stats.topRules')}</h3>
 <div className="space-y-3">
 {stats.topRules.map((rule: any) => (
 <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-transparent ">
 <div className="flex items-center gap-3">
 <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.7rem] font-bold bg-brand-500/10 text-brand-600 ">{formatType(rule.eventType)}</span>
 <span className="text-[0.85rem] font-medium text-[var(--text-primary)]">{rule.name}</span>
 </div>
 <div className="flex items-center gap-4 text-[0.8rem]">
 <span className="text-[var(--text-muted)]">Runs: {rule.totalRuns}</span>
 <span className="text-emerald-600 ">OK: {rule.successCount}</span>
 <span className="text-red-600 ">Fail: {rule.failureCount}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </>
 ) : null}
 </div>
 )}

 {showModal && (
 <GlassModal open={showModal} onClose={() => { setShowModal(false); setEditingRule(null);}} title={editingRule ? t('automation.editRule') : t('automation.newRule')}>
 <form onSubmit={handleSubmit} className="space-y-5">
 <GlassInput label={t('automation.rule.name')} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value}))} placeholder={t('automation.rule.namePlaceholder')} required />
 <GlassInput label={t('automation.rule.description')} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value}))} placeholder={t('automation.rule.descriptionPlaceholder')}/>
 <GlassSelect label={t('automation.rule.eventType')} value={form.eventType} onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value}))} options={EVENT_TYPES.map((et) => ({ value: et, label: formatType(et)}))} />

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <label className="text-[0.8rem] font-bold text-[var(--text-secondary)]">{t('automation.rule.conditions')}</label>
 <GlassButton type="button"variant="ghost"size="sm"onClick={addCondition}>+ {t('common.add')}</GlassButton>
 </div>
 {form.conditions.map((cond, i) => (
 <div key={i} className="flex gap-2 items-end">
<GlassInput label=""value={cond.field} onChange={(e) => updateCondition(i, { field: e.target.value})} placeholder={t('automation.rule.fieldPlaceholder')}className="flex-1"/>
  <GlassSelect label=""value={cond.operator} onChange={(e) => updateCondition(i, { operator: e.target.value})} options={[{ value:'gte', label:'>='}, { value:'lte', label:'<='}, { value:'eq', label:'='}, { value:'gt', label:'>'}, { value:'lt', label:'<'}]} className="w-24"/>
 <GlassInput label=""value={String(cond.value)} onChange={(e) => updateCondition(i, { value: e.target.value})} placeholder={t('automation.rule.valuePlaceholder')}className="flex-1"/>
 <GlassButton type="button"variant="ghost"size="icon"onClick={() => removeCondition(i)} aria-label={t('common.delete')}className="shrink-0 text-red-500">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
 </GlassButton>
 </div>
 ))}
 </div>

 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <label className="text-[0.8rem] font-bold text-[var(--text-secondary)]">{t('automation.rule.actions')}</label>
 <GlassButton type="button"variant="ghost"size="sm"onClick={addAction}>+ {t('common.add')}</GlassButton>
 </div>
 {form.actions.map((action, i) => (
 <div key={i} className="space-y-2 p-3 rounded-xl bg-transparent ">
 <div className="flex gap-2 items-end">
 <GlassSelect label=""value={action.type} onChange={(e) => updateAction(i, { type: e.target.value})} options={ACTION_TYPES.map((at) => ({ value: at, label: formatType(at)}))} className="flex-1"/>
 <GlassSelect label=""value={action.target ??'MANAGERS'} onChange={(e) => updateAction(i, { target: e.target.value})} options={TARGET_OPTIONS.map((to) => ({ value: to, label: formatType(to)}))} className="flex-1"/>
 <GlassButton type="button"variant="ghost"size="icon"onClick={() => removeAction(i)} aria-label={t('common.delete')}className="shrink-0 text-red-500">
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
 </GlassButton>
 </div>
<GlassInput label=""value={action.template ??''} onChange={(e) => updateAction(i, { template: e.target.value})} placeholder={t('automation.rule.templatePlaceholder')}/>
  <GlassInput label=""value={action.message ??''} onChange={(e) => updateAction(i, { message: e.target.value})} placeholder={t('automation.rule.messagePlaceholder')}/>
 </div>
 ))}
 </div>

 <div className="grid grid-cols-2 gap-4">
 <GlassInput label={t('automation.rule.cooldown')} type="number"value={String(form.cooldownMinutes)} onChange={(e) => setForm((f) => ({ ...f, cooldownMinutes: parseInt(e.target.value) || 60}))} />
 <GlassInput label={t('automation.rule.maxTriggers')} type="number"value={String(form.maxTriggersPerDay)} onChange={(e) => setForm((f) => ({ ...f, maxTriggersPerDay: parseInt(e.target.value) || 50}))} />
 </div>

 <div className="flex gap-3 pt-2">
 <GlassButton type="button"variant="secondary"className="flex-1" onClick={() => { setShowModal(false); setEditingRule(null);}}>
 {t('common.cancel')}
 </GlassButton>
 <GlassButton type="submit"variant="primary"className="flex-1" disabled={createMutation.isPending || updateMutation.isPending} loading={createMutation.isPending || updateMutation.isPending}>
 {editingRule ? t('automation.rule.update') : t('automation.rule.create')}
 </GlassButton>
 </div>
 </form>
 </GlassModal>
 )}
 </div>
 </div>
 );
}

