import { fetchAllPaginated} from'@/lib/fetchAllPaginated';
/**
 * PayrollPage — Ultra Premium Apple-Style Financial Dashboard
 * Features fluid money formatting, deep frosted glass modules, macOS-style
 * action workflows (Review -> Approve -> Pay), and high-end squircle data grids.
 */
import { useState} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
import { payrollApi, teachersApi} from'@/lib/api';
import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassTable,
 GlassTHead,
 GlassTBody,
 GlassTR,
 GlassTH,
 GlassTD,
 GlassModal,
 GlassSelect,
 GlassInput,
 GlassTextArea,
 useToast,
 GlassField,
 GlassButton,
} from'@/components/ui';
import { formatCurrency} from'@/lib/format';
import { getErrorMessage} from'@/lib/errorMessages';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';
import type { PayrollRun, PayrollPeriodSummary} from'@/lib/types';

// Status/salary-type label keys — PAID/CANCELLED reuse payments.status.*.
const PAYROLL_STATUS_KEYS: Record<string, string> = {
 DRAFT:'payroll.status.DRAFT',
 CALCULATED:'payroll.status.CALCULATED',
 REVIEWED:'payroll.status.REVIEWED',
 APPROVED:'payroll.status.APPROVED',
 PAID:'payments.status.PAID',
 CANCELLED:'payments.status.CANCELLED',
};

const SALARY_TYPE_KEYS: Record<string, string> = {
 MONTHLY:'payroll.salaryType.MONTHLY',
 HOURLY:'payroll.salaryType.HOURLY',
 PER_LESSON:'payroll.salaryType.PER_LESSON',
};

function getPayrollStatusConfig(status: string) {
 switch (status) {
 case'DRAFT': return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', dot:'bg-gray-400'};
 case'CALCULATED': return { bg:'bg-indigo-500/10', text:'text-indigo-600', dot:'bg-indigo-500'};
 case'REVIEWED': return { bg:'bg-amber-500/10', text:'text-amber-600', dot:'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'};
 case'APPROVED': return { bg:'bg-blue-500/10', text:'text-blue-600', dot:'bg-blue-500'};
 case'PAID': return { bg:'bg-emerald-500/10', text:'text-emerald-600', dot:'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'};
 case'CANCELLED': return { bg:'bg-rose-500/10', text:'text-rose-600', dot:'bg-rose-500'};
 default: return { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', dot:'bg-gray-400'};
}
}

const CURRENT_PERIOD = (() => {
 const now = new Date();
 return { year: now.getFullYear(), month: now.getMonth() + 1};
})();

const MONTH_KEYS = [
 'payroll.month.1','payroll.month.2','payroll.month.3','payroll.month.4',
 'payroll.month.5','payroll.month.6','payroll.month.7','payroll.month.8',
 'payroll.month.9','payroll.month.10','payroll.month.11','payroll.month.12',
];

interface CalculateFormState {
 teacherId: string;
 baseAmount: string;
 bonus: string;
 otherDeduction: string;
 overtimeHours: string;
 absenceDays: string;
 lateCount: string;
 latePenaltyPerEvent: string;
 notes: string;
}

const EMPTY_FORM: CalculateFormState = {
 teacherId:'',
 baseAmount:'',
 bonus:'',
 otherDeduction:'',
 overtimeHours:'',
 absenceDays:'',
 lateCount:'',
 latePenaltyPerEvent:'',
 notes:'',
};

// Premium local stat card for financial metrics
function FinanceStatCard({ label, value, highlightColor, isCurrency = false}: { label: string; value: string | number; highlightColor: string; isCurrency?: boolean}) {
 return (
 <div className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 group transition-all duration-300 hover:-translate-y-1 glass-card ">
 <div className="absolute inset-0 rounded-[2rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />
 <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-[30px] opacity-10 transition-opacity group-hover:opacity-20 ${highlightColor}`} aria-hidden />
 
 <div className="relative z-10 flex flex-col h-full">
 <p className={`text-[1.75rem] font-black tracking-tight mb-1 ${isCurrency ?'text-emerald-600' :'text-[var(--text-primary)]'}`}>
 {value}
 </p>
 <p className="text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-wide">
 {label}
 </p>
 </div>
 </div>
 );
}

export function PayrollPage() {
 const { t} = useI18n();
 usePageTitle(t('payroll.title'));
 const { push, toastNode} = useToast();
 const queryClient = useQueryClient();

 const [year, setYear] = useState(CURRENT_PERIOD.year);
 const [month, setMonth] = useState(CURRENT_PERIOD.month);
 
 const [calculateOpen, setCalculateOpen] = useState(false);
 const [form, setForm] = useState<CalculateFormState>(EMPTY_FORM);
 const [cancelTarget, setCancelTarget] = useState<PayrollRun | null>(null);
 const [cancelReason, setCancelReason] = useState('');

 const summary = useQuery({
 queryKey: ['payroll-summary', year, month],
 queryFn: () => payrollApi.periodSummary({ year, month}) as Promise<PayrollPeriodSummary>,
});

 const runs = useQuery({
 queryKey: ['payroll-runs', year, month],
 queryFn: () => fetchAllPaginated(payrollApi.listRuns, { year, month}) as Promise<{ items: PayrollRun[]; total: number}>,
});

 const teachers = useQuery({
 queryKey: ['teachers-for-payroll'],
 queryFn: () => fetchAllPaginated(teachersApi.list) as Promise<{ items: Array<{ id: string; user: { firstName: string; lastName: string}}>}>,
});

 const invalidate = () => {
 queryClient.invalidateQueries({ queryKey: ['payroll-runs']});
 queryClient.invalidateQueries({ queryKey: ['payroll-summary']});
};

 const calculate = useMutation({
 mutationFn: (data: CalculateFormState) =>
 payrollApi.calculate({
 teacherId: data.teacherId,
 periodYear: year,
 periodMonth: month,
 baseAmount: data.baseAmount ? Number(data.baseAmount) : undefined,
 bonus: data.bonus ? Number(data.bonus) : undefined,
 otherDeduction: data.otherDeduction ? Number(data.otherDeduction) : undefined,
 overtimeHours: data.overtimeHours ? Number(data.overtimeHours) : undefined,
 absenceDays: data.absenceDays ? Number(data.absenceDays) : undefined,
 lateCount: data.lateCount ? Number(data.lateCount) : undefined,
 latePenaltyPerEvent: data.latePenaltyPerEvent ? Number(data.latePenaltyPerEvent) : undefined,
 notes: data.notes || undefined,
}),
 onSuccess: () => {
  push('success', t('payroll.calculated'));
  setCalculateOpen(false);
  setForm(EMPTY_FORM);
  invalidate();
},
 onError: (err) => push('error', getErrorMessage(err)),
});

 const transition = useMutation({
 mutationFn: ({ id, action}: { id: string; action:'review' |'approve' |'pay'}) => payrollApi[action](id),
 onSuccess: (_data, vars) => {
  push('success', vars.action === 'pay'
   ? t('payroll.toast.paid')
   : vars.action === 'review'
     ? t('payroll.toast.reviewed')
     : t('payroll.toast.approved'));
  invalidate();
},
 onError: (err) => push('error', getErrorMessage(err)),
});

 const cancel = useMutation({
 mutationFn: ({ id, reason}: { id: string; reason: string}) => payrollApi.cancel(id, reason),
 onSuccess: () => {
  push('success', t('payroll.cancelled'));
  setCancelTarget(null);
  setCancelReason('');
  invalidate();
},
 onError: (err) => push('error', getErrorMessage(err)),
});

 const s = summary.data;

 return (
 <div className="relative min-h-screen bg-transparent selection:bg-emerald-500/30">
 {/* Soft Apple-style Background Ambient Orbs (Financial Theme) */}
 <div className="fixed inset-0 pointer-events-none overflow-hidden"aria-hidden>
 <div className="absolute top-[0%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-400/5 blur-[120px]"/>
 <div className="absolute bottom-[20%] right-[-5%] w-[30%] h-[50%] rounded-full bg-cyan-400/5 blur-[100px]"/>
 </div>

 <div className="relative z-10 w-full max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500">
 
 {/* ── Header & Action ────────────────────────────────────────────── */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <GlassPageHeader
 title={t('payroll.title')}
 subtitle={t('payroll.pageSubtitle')}
 />
 <GlassButton
 type="button"
 variant="primary"
 onClick={() => setCalculateOpen(true)}
 className="w-full md:w-auto"
 >
 <svg className="w-4 h-4"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="2.5"><rect x="2"y="4"width="20"height="16"rx="2"ry="2"/><line x1="12"y1="16"x2="12"y2="8"/><line x1="8"y1="12"x2="16"y2="12"/></svg>
 {t('payroll.calculate')}
 </GlassButton>
 </div>

 {/* ── Toolbar (Period Selector) ──────────────────────────────────── */}
 <div className="flex items-center gap-3 p-4 rounded-[1.5rem] glass-card w-max">
 <div className="flex items-center gap-2">
 <span className="text-[0.75rem] font-bold text-[var(--text-muted)] uppercase tracking-widest pl-2">{t('payroll.period')}</span>
 <div className="w-32">
 <GlassSelect value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="h-[2.5rem]">
 {[CURRENT_PERIOD.year - 2, CURRENT_PERIOD.year - 1, CURRENT_PERIOD.year, CURRENT_PERIOD.year + 1].map((y) => (
 <option key={y} value={y}>{y}</option>
 ))}
 </GlassSelect>
 </div>
 <div className="w-40">
 <GlassSelect value={String(month)} onChange={(e) => setMonth(Number(e.target.value))} className="h-[2.5rem]">
 {MONTH_KEYS.map((mk, i) => (
 <option key={mk} value={i + 1}>{t(mk)}</option>
 ))}
 </GlassSelect>
 </div>
 </div>
 </div>

 {/* ── Content Area ───────────────────────────────────────────────── */}
 {summary.isLoading || runs.isLoading ? (
 <div className="p-16 flex justify-center bg-[var(--bg-card)] rounded-[2.5rem] border border-[var(--border-subtle)]/60 ">
 <GlassPageLoader label={t('payroll.loading')}/>
 </div>
 ) : summary.isError ? (
 <div className="p-12 bg-[var(--bg-card)] rounded-[2.5rem] border border-[var(--border-subtle)]/60 ">
 <GlassErrorState message={getErrorMessage(summary.error)} onRetry={() => summary.refetch()} />
 </div>
 ) : s ? (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
 
 {/* KPI Cards */}
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
 <FinanceStatCard label={t('payroll.totalNet')} value={formatCurrency(s.totalNet)} highlightColor="bg-emerald-500"isCurrency />
 <FinanceStatCard label={t('payroll.fullyPaid')} value={s.paid ?? 0} highlightColor="bg-brand-500"/>
 <FinanceStatCard label={t('payroll.pendingPayment')} value={s.unpaid ?? 0} highlightColor="bg-amber-500"/>
 <FinanceStatCard label={t('payroll.teachersEvaluated')} value={s.teachersCount ?? 0} highlightColor="bg-indigo-500"/>
 </div>

 {/* Payroll Runs Table */}
 <div className="rounded-[2.5rem] glass-card overflow-hidden relative">
 <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none ring-1 ring-inset ring-black/5 dark:ring-white/5"aria-hidden />

  <div className="px-6 py-5 border-b border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-between">
  <h2 className="text-[1.1rem] font-bold text-[var(--text-primary)]">{t('payroll.register')}</h2>
  <span className="px-3 py-1 rounded-full bg-brand-500/10 text-brand-600 text-[0.75rem] font-bold uppercase tracking-wider border border-brand-500/20">
  {t('payroll.runsCount', { count: runs.data?.items.length || 0})}
  </span>
  </div>

  {runs.data && runs.data.items.length > 0 ? (
  <div className="relative z-10 w-full overflow-x-auto custom-scrollbar">
  <GlassTable>
  <GlassTHead>
  <GlassTR>
  <GlassTH>{t('payroll.col.employee')}</GlassTH>
  <GlassTH>{t('payroll.col.type')}</GlassTH>
  <GlassTH>{t('payroll.col.gross')}</GlassTH>
  <GlassTH>{t('payroll.col.net')}</GlassTH>
  <GlassTH>{t('common.status')}</GlassTH>
  <GlassTH className="text-right">{t('payroll.col.workflow')}</GlassTH>
  </GlassTR>
  </GlassTHead>
 <GlassTBody>
 {runs.data.items.map((run, idx) => {
 const config = getPayrollStatusConfig(run.status);
 const teacherName = run.teacher?.user ? `${run.teacher.user.firstName} ${run.teacher.user.lastName}` : (run.teacherId ??'').slice(0, 8);
 
 return (
 <GlassTR key={run.id} className="group hover:bg-transparent dark:hover:bg-[var(--bg-card)] transition-colors"style={{ animationDelay: `${idx * 40}ms`}}>
 
 {/* Employee */}
 <GlassTD className="font-bold text-[var(--text-primary)]">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-full flex items-center justify-center text-[0.7rem] font-extrabold bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 text-[var(--text-secondary)] shadow-sm shrink-0">
 {teacherName.split('').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
 </div>
 <div className="flex flex-col">
 <span>{teacherName}</span>
 <span className="text-[0.7rem] font-bold text-[var(--text-muted)] uppercase tracking-widest">{run.periodYear}-{String(run.periodMonth).padStart(2,'0')}</span>
 </div>
 </div>
 </GlassTD>

  {/* Type */}
  <GlassTD>
  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[0.7rem] font-bold uppercase tracking-wider bg-[var(--state-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]/50 ">
   {t(SALARY_TYPE_KEYS[run.salaryType ?? ''] ?? `payroll.salaryType.${run.salaryType}`)}
  </span>
  </GlassTD>

 {/* Gross */}
 <GlassTD className="font-medium text-[var(--text-muted)]">
 {formatCurrency(Number(run.grossAmount))}
 </GlassTD>

 {/* Net */}
 <GlassTD>
 <span className="text-[1rem] font-extrabold text-emerald-600 ">
 {formatCurrency(Number(run.netAmount))}
 </span>
 </GlassTD>

  {/* Status */}
  <GlassTD>
  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider ${config.bg} ${config.text}`}>
  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`} />
  {t(PAYROLL_STATUS_KEYS[run.status] ?? `payroll.status.${run.status}`)}
  </span>
  </GlassTD>

  {/* Actions */}
  <GlassTD className="text-right">
  <div className="flex items-center justify-end gap-2 transition-opacity">
  
  {run.status ==='CALCULATED' && (
  <GlassButton type="button"variant="ghost"size="sm"disabled={transition.isPending} onClick={() => transition.mutate({ id: run.id, action:'review'})}>
  {t('payroll.approveReview')}
  </GlassButton>
  )}

  {run.status ==='REVIEWED' && (
  <GlassButton type="button"variant="ghost"size="sm"disabled={transition.isPending} onClick={() => transition.mutate({ id: run.id, action:'approve'})}>
  {t('payroll.finalApprove')}
  </GlassButton>
  )}

  {run.status ==='APPROVED' && (
  <GlassButton type="button"variant="success"size="sm"disabled={transition.isPending} onClick={() => transition.mutate({ id: run.id, action:'pay'})}>
  <svg className="w-3.5 h-3.5"viewBox="0 0 24 24"fill="none"stroke="currentColor"strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
  {t('payroll.markPaid')}
  </GlassButton>
  )}

  {!['PAID','CANCELLED'].includes(run.status) && (
  <GlassButton type="button"variant="ghost"size="sm"onClick={() => setCancelTarget(run)}>
  {t('common.cancel')}
  </GlassButton>
  )}

  </div>
  </GlassTD>
  </GlassTR>
  );
})}
  </GlassTBody>
  </GlassTable>
  </div>
  ) : (
  <div className="p-16 flex items-center justify-center">
  <GlassEmptyState title={t('payroll.emptyTitle')} message={t('payroll.emptyMessage', { month: t(MONTH_KEYS[month - 1]), year: String(year)})} action={{ label: t('payroll.calculate'), onClick: () => setCalculateOpen(true)}} />
  </div>
  )}
 </div>
 </div>
 ) : null}
 </div>

 {/* ── Calculate Modal ──────────────────────────────────────────────── */}
 <GlassModal open={calculateOpen} onClose={() => setCalculateOpen(false)} title={t('payroll.calculateTitle', { month: t(MONTH_KEYS[month - 1]), year: String(year)})} wide>
 <form onSubmit={(e) => { e.preventDefault(); if (!form.teacherId) { push('error', t('payroll.teacherRequired')); return;} calculate.mutate(form);}} className="space-y-6 pt-2 animate-in fade-in duration-300">
 
 <div className="bg-[var(--bg-card)] p-5 rounded-[1.5rem] border border-[var(--border-subtle)]/50 shadow-sm">
 <GlassField label={t('payroll.selectTeacher')}required>
 <GlassSelect value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value})}>
 <option value="">{t('payroll.chooseEmployee')}</option>
 {(teachers.data?.items ?? []).map((teacher) => (
 <option key={teacher.id} value={teacher.id}>{teacher.user.firstName} {teacher.user.lastName}</option>
 ))}
 </GlassSelect>
 </GlassField>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
 {/* Earnings */}
 <div className="space-y-5">
 <h3 className="text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-subtle)] pb-2">{t('payroll.earnings')}</h3>
 <GlassField label={t('payroll.form.baseAmount')}><GlassInput type="number"min="0"step="0.01"value={form.baseAmount} onChange={(e) => setForm({ ...form, baseAmount: e.target.value})} placeholder="0.00"/></GlassField>
 <GlassField label={t('payroll.form.bonus')}><GlassInput type="number"min="0"step="0.01"value={form.bonus} onChange={(e) => setForm({ ...form, bonus: e.target.value})} placeholder="0.00"/></GlassField>
 <GlassField label={t('payroll.form.overtimeHours')}><GlassInput type="number"min="0"step="0.5"value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: e.target.value})} placeholder="0"/></GlassField>
 </div>

 {/* Deductions */}
 <div className="space-y-5">
 <h3 className="text-[0.8rem] font-bold text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border-subtle)] pb-2">{t('payroll.deductions')}</h3>
 <GlassField label={t('payroll.form.absenceDays')}><GlassInput type="number"min="0"step="1"value={form.absenceDays} onChange={(e) => setForm({ ...form, absenceDays: e.target.value})} placeholder="0"/></GlassField>
 <div className="grid grid-cols-2 gap-3">
 <GlassField label={t('payroll.form.lateCount')}><GlassInput type="number"min="0"step="1"value={form.lateCount} onChange={(e) => setForm({ ...form, lateCount: e.target.value})} placeholder="0"/></GlassField>
 <GlassField label={t('payroll.form.penaltyPerEvent')}><GlassInput type="number"min="0"step="0.01"value={form.latePenaltyPerEvent} onChange={(e) => setForm({ ...form, latePenaltyPerEvent: e.target.value})} placeholder="0.00"/></GlassField>
 </div>
 <GlassField label={t('payroll.form.otherDeductions')}><GlassInput type="number"min="0"step="0.01"value={form.otherDeduction} onChange={(e) => setForm({ ...form, otherDeduction: e.target.value})} placeholder="0.00"/></GlassField>
 </div>
 </div>

 <GlassField label={t('payroll.form.notes')}hint={t('payroll.form.notesHint')}>
 <GlassTextArea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value})} placeholder={t('payroll.form.notesPlaceholder')}/>
 </GlassField>

 <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
 <GlassButton type="button"variant="secondary"onClick={() => setCalculateOpen(false)}>{t('common.cancel')}</GlassButton>
 <GlassButton type="submit"variant="primary"loading={calculate.isPending}disabled={calculate.isPending}>
 {calculate.isPending ? t('payroll.calculating') : t('payroll.runCalculation')}
 </GlassButton>
 </div>
 </form>
 </GlassModal>

 {/* ── Cancel Modal ─────────────────────────────────────────────────── */}
 <GlassModal open={cancelTarget !== null} onClose={() => setCancelTarget(null)} title={t('payroll.cancelTitle')}>
 <form onSubmit={(e) => { e.preventDefault(); if (cancelTarget) cancel.mutate({ id: cancelTarget.id, reason: cancelReason});}} className="space-y-4 pt-2">
 <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[0.85rem] font-semibold text-rose-700 mb-2">
 {t('payroll.cancelWarning')}
 </div>
 <GlassField label={t('payroll.cancelReasonLabel')}required>
 <GlassTextArea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder={t('payroll.cancelReasonPlaceholder')}autoFocus />
 </GlassField>
 <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
 <GlassButton type="button"variant="secondary"onClick={() => setCancelTarget(null)}>{t('common.close')}</GlassButton>
 <GlassButton type="submit"variant="danger"loading={cancel.isPending}disabled={cancel.isPending || !cancelReason.trim()}>
 {cancel.isPending ? t('payroll.cancelling') : t('payroll.confirmCancellation')}
 </GlassButton>
 </div>
 </form>
 </GlassModal>

 {toastNode}
 </div>
 );
}