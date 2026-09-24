/**
 * FollowUpAutomationPage — Ultra Premium Apple-Style Automation Dashboard
 * Features fluid typography, deep frosted glass modules, iOS-style toggles,
 * glowing semantic badges, and staggered list animations.
 */
import { useState} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
import { leadsApi} from'@/lib/api';
 import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassInput,
 GlassSelect,
 useToasts,
 GlassModal,
 GlassField,
 GlassButton,
 GlassSwitch,
 ConfirmDialog, GlassTabs } from '@/components/ui';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';

const TRIGGER_TYPES = ['NO_ACTIVITY','STAGE_STALE'];
const ACTION_TYPES = ['CREATE_FOLLOW_UP','SEND_NOTIFICATION','BOTH'];
const STAGE_OPTIONS = ['NEW','CONTACTED','TRIAL_LESSON','WON','LOST'];
const CHANNEL_OPTIONS = ['IN_APP','SMS','TELEGRAM'];

interface RuleFormState {
 name: string;
 triggerType: string;
 triggerDays: number;
 targetStage: string;
 actionType: string;
 channel: string;
 message: string;
}

interface FollowUpRule {
 id: string;
 name: string;
 triggerType: string;
 triggerDays: number;
 targetStage?: string | null;
 actionType: string;
 channel?: string | null;
 message?: string | null;
 isActive: boolean;
}

interface FollowUpItem {
 id: string;
 isCompleted?: boolean;
 scheduledAt: string;
 note?: string | null;
 lead?: { firstName?: string; lastName?: string } | null;
}

interface FollowUpsResponse {
 items?: FollowUpItem[];
}

interface FollowUpStats {
 today: number;
 overdue: number;
 upcoming: number;
 completionRate: number;
}

const INITIAL_FORM: RuleFormState = {
 name:'',
 triggerType:'NO_ACTIVITY',
 triggerDays: 7,
 targetStage:'',
 actionType:'CREATE_FOLLOW_UP',
 channel:'IN_APP',
 message:'',
};

function formatType(type: string) {
 return type.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

// Custom iOS-style Segmented Control for Tabs
// Premium Local Stat Card
function AutomationStatCard({ label, value, highlightColor}: { label: string; value: string | number; highlightColor: string}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card flex flex-col justify-between h-full">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />
 
 <p className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest relative z-10 mb-4">
 {label}
 </p>
 <p className="text-[2rem] font-black tracking-tight leading-none text-[var(--text-primary)] relative z-10">
 {value}
 </p>
 </div>
 );
}

export function FollowUpAutomationPage() {
 const { t} = useI18n();
 usePageTitle(t('followUp.title'));
 const { push: toast, toastNode} = useToasts();
 const queryClient = useQueryClient();

 const enumT = (ns: string, v: string) => {
   const key = `${ns}.${v}`;
   const label = t(key);
   return label === key ? formatType(v) : label;
 };

 const [activeTab, setActiveTab] = useState('rules');
 const tabs: {id: string, label: string}[] = [{id: "rules", label: t("followUp.tabs.rules")}, {id: "queue", label: t("followUp.tabs.queue")}];
 const [showModal, setShowModal] = useState(false);
 const [editingRule, setEditingRule] = useState<FollowUpRule | null>(null);
 const [deleteTarget, setDeleteTarget] = useState<FollowUpRule | null>(null);
 const [form, setForm] = useState<RuleFormState>(INITIAL_FORM);

 const { data: rules, isLoading: rulesLoading, error: rulesError} = useQuery({
 queryKey: ['follow-up-rules'],
 queryFn: () => leadsApi.getFollowUpRules() as Promise<FollowUpRule[]>,
});

 const { data: followUps, isLoading: followUpsLoading, error: followUpsError} = useQuery({
 queryKey: ['follow-ups'],
 queryFn: () => leadsApi.getFollowUps({}) as Promise<FollowUpsResponse>,
});

 const { data: stats, isLoading: statsLoading, error: statsError} = useQuery({
 queryKey: ['follow-up-stats'],
 queryFn: () => leadsApi.getFollowUpStats() as Promise<FollowUpStats>,
});

 const createMutation = useMutation({
 mutationFn: (data: RuleFormState) => leadsApi.createFollowUpRule(data),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['follow-up-rules']});
 toast('success', t('automation.rule.created'));
 setShowModal(false);
 setForm(INITIAL_FORM);
},
 onError: () => toast('error', t('followUp.createFailed')),
});

 const updateMutation = useMutation({
 mutationFn: ({ id, data}: { id: string; data: Partial<RuleFormState>}) => leadsApi.updateFollowUpRule(id, data),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['follow-up-rules']});
 toast('success', t('automation.rule.updated'));
 setShowModal(false);
 setEditingRule(null);
 setForm(INITIAL_FORM);
},
 onError: () => toast('error', t('followUp.updateFailed')),
});

 const deleteMutation = useMutation({
 mutationFn: (id: string) => leadsApi.deleteFollowUpRule(id),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['follow-up-rules']});
 toast('success', t('automation.rule.deleted'));
},
 onError: () => toast('error', t('followUp.deleteFailed')),
});

 const toggleMutation = useMutation({
 mutationFn: ({ id, isActive}: { id: string; isActive: boolean}) => leadsApi.updateFollowUpRule(id, { isActive}),
 onSuccess: () => queryClient.invalidateQueries({ queryKey: ['follow-up-rules']}),
 // Silent failure previously: the toggle appeared to succeed and reverted
 // on the next refetch with no message.
 onError: () => toast('error', t('followUp.toggleFailed')),
});

 const evaluateMutation = useMutation({
 mutationFn: () => leadsApi.evaluateFollowUpRules() as Promise<{ evaluated: number; created: number }>,
 onSuccess: (data) => {
 queryClient.invalidateQueries({ queryKey: ['follow-up-rules']});
 queryClient.invalidateQueries({ queryKey: ['follow-ups']});
 queryClient.invalidateQueries({ queryKey: ['follow-up-stats']});
 toast('success', t('followUp.engineEvaluated', { evaluated: data.evaluated, created: data.created }));
},
 onError: () => toast('error', t('followUp.evaluateFailed')),
});

 const completeMutation = useMutation({
 mutationFn: (id: string) => leadsApi.completeFollowUp(id),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['follow-ups']});
 queryClient.invalidateQueries({ queryKey: ['follow-up-stats']});
 toast('success', t('followUp.completed'));
},
 onError: () => toast('error', t('followUp.completeFailed')),
});

 const handleOpenCreate = () => {
 setEditingRule(null);
 setForm(INITIAL_FORM);
 setShowModal(true);
};

 const handleOpenEdit = (rule: FollowUpRule) => {
 setEditingRule(rule);
 setForm({
 name: rule.name,
 triggerType: rule.triggerType,
 triggerDays: rule.triggerDays,
 targetStage: rule.targetStage ||'',
 actionType: rule.actionType,
 channel: rule.channel ||'IN_APP',
 message: rule.message ||'',
});
 setShowModal(true);
};

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (editingRule) {
 updateMutation.mutate({ id: editingRule.id, data: form});
} else {
 createMutation.mutate(form);
}
};

 const todayFollowUps = followUps?.items?.filter((f) => {
 const now = new Date();
 const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
 const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
 return !f.isCompleted && new Date(f.scheduledAt) >= start && new Date(f.scheduledAt) <= end;
}) || [];

 const overdueFollowUps = followUps?.items?.filter((f) => {
 const now = new Date();
 const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
 return !f.isCompleted && new Date(f.scheduledAt) < start;
}) || [];

 const upcomingFollowUps = followUps?.items?.filter((f) => {
 const now = new Date();
 const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
 return !f.isCompleted && new Date(f.scheduledAt) > end;
}) || [];

 if (rulesLoading || followUpsLoading || statsLoading) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('followUp.tab.rules')}subtitle={t('followUp.loadingSubtitle')}/>
 <div className="mt-8 rounded-[2.5rem] p-16 flex items-center justify-center glass-card">
 <GlassPageLoader label={t('followUp.loading')}/>
 </div>
 </div>
 );
}

 if (rulesError || followUpsError || statsError) {
 return (
 <div className="min-h-screen bg-transparent p-4 sm:p-6 lg:p-8">
 <GlassPageHeader title={t('followUp.tab.rules')}subtitle={t('followUp.connectionError')}/>
 <div className="mt-8 rounded-[2.5rem] p-12 glass-card">
 <GlassErrorState message={t('followUp.loadError')}onRetry={() => queryClient.invalidateQueries({ queryKey: ['follow-up-rules']})} />
 </div>
 </div>
 );
}

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-brand-500/30">
 
 {/* Soft Apple-style Ambient Orbs */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-amber-400/5 blur-[100px]"/>
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
  description={t('followUp.deleteConfirm')}
  loading={deleteMutation.isPending}
 />

 {/* ── Header & Action ────────────────────────────────────────────── */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <GlassPageHeader
 title={t('followUp.title')}
 subtitle={t('followUp.subtitle')}
 />
 <GlassButton
 type="button"
 variant="secondary"
 className="w-full md:w-auto"
 onClick={() => evaluateMutation.mutate()}
 disabled={evaluateMutation.isPending}
 loading={evaluateMutation.isPending}
 icon={!evaluateMutation.isPending ? <svg className="w-4 h-4 text-brand-500"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"strokeLinecap="round"strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> : undefined}
 >
 {evaluateMutation.isPending ? t('followUp.engineRunning') : t('followUp.runEngine')}
 </GlassButton>
 </div>

 {/* ── Toolbar & Tabs ─────────────────────────────────────────────── */}
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-[1.5rem] glass-card">
 <GlassTabs 
 active={activeTab} 
 onChange={setActiveTab} 
 tabs={tabs.map(tab => ({ ...tab, count: tab.id === 'rules' ? rules?.length ?? 0 : todayFollowUps.length + overdueFollowUps.length }))} 
 />
 
 {activeTab ==='rules' && (
 <GlassButton
 type="button"
 variant="primary"
 className="w-full sm:w-auto"
 onClick={handleOpenCreate}
 icon={<svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><line x1="12"y1="5"x2="12"y2="19"/><line x1="5"y1="12"x2="19"y2="12"/></svg>}
 >
 {t('automation.newRule')}
 </GlassButton>
 )}
 </div>

 {/* ── Content Area ───────────────────────────────────────────────── */}
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative min-h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />

 {/* TAB: RULES */}
 {activeTab ==='rules' && (
 <div className="relative z-10 w-full">
 {!rules || rules.length === 0 ? (
 <div className="p-16 flex items-center justify-center">
 <GlassEmptyState title={t('automation.rule.empty')}message={t('followUp.emptyHint')}action={{ label: t('automation.rule.create'), onClick: handleOpenCreate}} />
 </div>
 ) : (
 <ul className="divide-y divide-gray-100 dark:divide-white/5">
 {rules.map((rule, idx) => (
 <li key={rule.id} className="group p-6 hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"style={{ animationDelay: `${idx * 40}ms`}}>
 
 <div className="flex-1 min-w-0">
 <div className="flex flex-wrap items-center gap-2.5 mb-2">
 <h4 className="text-[1.1rem] font-bold text-[var(--text-primary)] mr-2">{rule.name}</h4>
 <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider border bg-brand-500/10 text-brand-600 border-brand-500/20">
 {enumT('followUp.trigger', rule.triggerType)}
 </span>
 {rule.targetStage && (
 <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider border bg-indigo-500/10 text-indigo-600 border-indigo-500/20">
 {t('followUp.targetLabel')} {enumT('followUp.stage', rule.targetStage)}
 </span>
 )}
 </div>
 <p className="text-[0.85rem] font-medium text-[var(--text-muted)]">
 {t('followUp.triggerLabel')} <span className="font-bold text-[var(--text-primary)]">{rule.triggerDays} {t('common.days')}</span> 
 <span className="mx-2 opacity-50">•</span> 
 {t('followUp.actionLabel')} <span className="font-bold text-[var(--text-primary)]">{enumT('followUp.action', rule.actionType)}</span>
 {rule.channel && <><span className="mx-2 opacity-50">•</span> {t('followUp.channelLabel')} <span className="font-bold text-[var(--text-primary)]">{enumT('followUp.channel', rule.channel)}</span></>}
 </p>
 </div>

 <div className="flex items-center gap-4 shrink-0">
 <GlassSwitch
 checked={rule.isActive}
 onChange={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive})}
 aria-label={t('followUp.toggleStatus')}
 />

 <div className="w-px h-8 bg-gray-200 mx-2"/>

 <GlassButton type="button"variant="secondary"size="sm"onClick={() => handleOpenEdit(rule)}>
 {t('common.edit')}
 </GlassButton>
 <GlassButton variant="danger" size="sm" onClick={() => setDeleteTarget(rule)}>
 {t('common.delete')}
 </GlassButton>
 </div>
 </li>
 ))}
 </ul>
 )}
 </div>
 )}

 {/* TAB: FOLLOW-UPS */}
 {activeTab ==='follow-ups' && (
 <div className="relative z-10 w-full p-6 sm:p-8 space-y-8">
 <FollowUpSection title={t('followUp.section.overdue')}items={overdueFollowUps} onComplete={(id) => completeMutation.mutate(id)} isOverdue />
 <FollowUpSection title={t('followUp.section.today')}items={todayFollowUps} onComplete={(id) => completeMutation.mutate(id)} isToday />
 <FollowUpSection title={t('followUp.section.upcoming')}items={upcomingFollowUps} onComplete={(id) => completeMutation.mutate(id)} />
 
 {todayFollowUps.length === 0 && overdueFollowUps.length === 0 && upcomingFollowUps.length === 0 && (
 <div className="py-12 flex items-center justify-center">
 <GlassEmptyState title={t('followUp.inboxZero')}message={t('followUp.inboxZeroHint')}/>
 </div>
 )}
 </div>
 )}

 {/* TAB: STATS */}
 {activeTab ==='stats' && (
 <div className="relative z-10 w-full p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
 <AutomationStatCard label={t('followUp.stat.today')}value={stats?.today ?? 0} highlightColor="bg-brand-500"/>
 <AutomationStatCard label={t('followUp.stat.overdue')}value={stats?.overdue ?? 0} highlightColor="bg-rose-500"/>
 <AutomationStatCard label={t('followUp.stat.upcoming')}value={stats?.upcoming ?? 0} highlightColor="bg-indigo-500"/>
 <AutomationStatCard label={t('followUp.stat.completionRate')}value={`${stats?.completionRate ?? 0}%`} highlightColor="bg-emerald-500"/>
 </div>
 )}
 </div>

 </div>

 {/* ── Rule Modal ─────────────────────────────────────────────────── */}
 <GlassModal open={showModal} onClose={() => { setShowModal(false); setEditingRule(null); setForm(INITIAL_FORM);}} title={editingRule ? t('followUp.configureRule') : t('followUp.newAutomationRule')} wide>
 <form onSubmit={handleSubmit} className="space-y-6 pt-2 animate-in fade-in duration-300"noValidate>
 
 <GlassField label={t('automation.rule.name')}required>
 <GlassInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value})} placeholder={t('followUp.namePlaceholder')}autoFocus />
 </GlassField>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
 <GlassField label={t('followUp.triggerEvent')}required>
 <GlassSelect value={form.triggerType} onChange={(e) => setForm({ ...form, triggerType: e.target.value})}>
 {TRIGGER_TYPES.map((v) => <option key={v} value={v}>{t(`followUp.trigger.${v}`)}</option>)}
 </GlassSelect>
 </GlassField>
 
 <GlassField label={t('followUp.timeThreshold')}required>
 <GlassInput type="number"min="1"value={form.triggerDays} onChange={(e) => setForm({ ...form, triggerDays: parseInt(e.target.value) || 1})} />
 </GlassField>
 </div>

 {form.triggerType ==='STAGE_STALE' && (
 <div className="p-4 rounded-[1.25rem] bg-indigo-500/10 border border-indigo-500/20">
 <GlassField label={t('followUp.targetStage')}required>
 <GlassSelect value={form.targetStage} onChange={(e) => setForm({ ...form, targetStage: e.target.value})}>
 <option value="">{t('followUp.selectStage')}</option>
 {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{t(`followUp.stage.${s}`)}</option>)}
 </GlassSelect>
 </GlassField>
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-[var(--border-subtle)]">
 <GlassField label={t('followUp.executionAction')}required>
 <GlassSelect value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value})}>
 {ACTION_TYPES.map((a) => <option key={a} value={a}>{t(`followUp.action.${a}`)}</option>)}
 </GlassSelect>
 </GlassField>

 {form.actionType !=='CREATE_FOLLOW_UP' && (
 <GlassField label={t('followUp.deliveryChannel')}required>
 <GlassSelect value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value})}>
 {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{t(`followUp.channel.${c}`)}</option>)}
 </GlassSelect>
 </GlassField>
 )}
 </div>

 <GlassField label={t('followUp.messageLabel')}>
 <GlassInput value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value})} placeholder={t('followUp.messagePlaceholder')}/>
 </GlassField>

 <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
 <GlassButton type="button"variant="secondary"onClick={() => { setShowModal(false); setEditingRule(null); setForm(INITIAL_FORM);}}>
 {t('common.cancel')}
 </GlassButton>
 <GlassButton type="submit"variant="primary"disabled={!form.name}>
 {editingRule ? t('automation.rule.update') : t('followUp.saveRule')}
 </GlassButton>
 </div>
 </form>
 </GlassModal>

 </div>
 );
}

// ── Follow Up List Section Component ──
function FollowUpSection({ title, items, onComplete, isOverdue, isToday}: { title: string; items: FollowUpItem[]; onComplete: (id: string) => void; isOverdue?: boolean; isToday?: boolean}) {
 const { t} = useI18n();
 if (items.length === 0) return null;
 return (
 <div className="animate-in fade-in duration-500">
 <h3 className={`text-[0.75rem] font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${isOverdue ?'text-rose-500' : isToday ?'text-brand-500' :'text-[var(--text-muted)]'}`}>
 {isOverdue && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"/>}
 {title}
 <span className="px-2 py-0.5 rounded-md bg-[var(--state-hover)] text-[var(--text-muted)] text-[0.65rem] ml-1">{items.length}</span>
 </h3>
 <div className="space-y-3">
 {items.map((fu, idx) => (
 <div key={fu.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-subtle)] dark:hover:border-white/10 transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1">
 <div className="w-8 h-8 rounded-full flex items-center justify-center text-[0.6rem] font-extrabold bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-[var(--text-secondary)] shrink-0">
 {fu.lead?.firstName?.[0]}{fu.lead?.lastName?.[0]}
 </div>
 <p className="font-bold text-[0.95rem] text-[var(--text-primary)] truncate">
 {fu.lead?.firstName} {fu.lead?.lastName}
 </p>
 <span className="px-2 py-0.5 rounded-md bg-[var(--state-hover)] text-[var(--text-muted)] text-[0.7rem] font-bold font-mono">
 {new Date(fu.scheduledAt).toLocaleDateString()}
 </span>
 </div>
 <p className="text-[0.85rem] text-[var(--text-secondary)] leading-relaxed ml-11">
 {fu.note || t('followUp.actionRequired')}
 </p>
 </div>
 <GlassButton
 type="button"
 variant="ghost"
 size="sm"
 className="shrink-0 self-start sm:self-center text-emerald-600"
 onClick={() => onComplete(fu.id)}
 icon={<svg className="w-3.5 h-3.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
 >
 {t('followUp.markDone')}
 </GlassButton>
 </div>
 ))}
 </div>
 </div>
 );
}

export default FollowUpAutomationPage;

