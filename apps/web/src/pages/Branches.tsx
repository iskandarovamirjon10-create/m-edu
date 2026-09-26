import { useState} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
import { branchesApi, usersApi} from'@/lib/api';
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
 GlassField,
 GlassInput,
 GlassSelect,
 GlassButton,
 ConfirmDialog,
 useToasts,
} from'@/components/ui';
import { useI18n} from'../i18n/I18nProvider';
import { getErrorMessage} from'@/lib/errorMessages';
import type { Branch} from'@/lib/types';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useAuthState} from'@/auth/AuthContext';

interface BranchFormState {
 name: string;
 code: string;
 address: string;
 phone: string;
 email: string;
 timezone: string;
 currency: string;
}

const INITIAL_FORM: BranchFormState = {
 name:'',
 code:'',
 address:'',
 phone:'',
 email:'',
 timezone:'Asia/Tashkent',
 currency:'UZS',
};

const TIMEZONES = [
'Asia/Tashkent',
'Asia/Almaty',
'Asia/Novosibirsk',
'Europe/Moscow',
'UTC',
];

const CURRENCIES = ['UZS','USD','RUB','KZT','EUR'];

function getStatusConfig(isActive: boolean) {
 return isActive
 ? { bg:'bg-emerald-500/10', text:'text-emerald-600', label:'Active'}
 : { bg:'bg-[var(--state-hover)]', text:'text-[var(--text-secondary)]', label:'Inactive'};
}

export function BranchesPage() {
 const { t} = useI18n();
 usePageTitle(t('branches.title'));
 const { push, toastNode} = useToasts();
 const qc = useQueryClient();
 const { hasAnyRole} = useAuthState();
 const canManage = hasAnyRole('SUPER_ADMIN','ORG_ADMIN');

 const [modalOpen, setModalOpen] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState<BranchFormState>(INITIAL_FORM);
 const [managerModal, setManagerModal] = useState<string | null>(null);
 const [managerId, setManagerId] = useState('');
 const [statsModal, setStatsModal] = useState<Branch | null>(null);
 const [deactivateTarget, setDeactivateTarget] = useState<Branch | null>(null);

 const { data: branches = [], isLoading, error} = useQuery({
 queryKey: ['branches'],
 queryFn: () => branchesApi.list() as Promise<Branch[]>,
});

 const { data: users = []} = useQuery({
 queryKey: ['users-list-for-manager'],
 queryFn: () => usersApi.list({ limit: 200}) as Promise<{ items: { id: string; firstName: string; lastName: string; email: string}[]}>,
 enabled: managerModal !== null,
});

 const createMutation = useMutation({
 mutationFn: (data: BranchFormState) => branchesApi.create(data),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['branches']});
 setModalOpen(false);
 setForm(INITIAL_FORM);
 push({ type:'success', message: t('branches.created')});
},
 onError: (err: unknown) => push({ type:'error', message: getErrorMessage(err)}),
});

 const updateMutation = useMutation({
 mutationFn: ({ id, data}: { id: string; data: BranchFormState}) => branchesApi.update(id, data),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['branches']});
 setModalOpen(false);
 setEditingId(null);
 setForm(INITIAL_FORM);
 push({ type:'success', message: t('branches.updated')});
},
 onError: (err: unknown) => push({ type:'error', message: getErrorMessage(err)}),
});

 const deactivateMutation = useMutation({
 mutationFn: (id: string) => branchesApi.deactivate(id),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['branches']});
 push({ type:'success', message: t('branches.deactivated')});
},
 onError: (err: unknown) => push({ type:'error', message: getErrorMessage(err)}),
});

 const activateMutation = useMutation({
 mutationFn: (id: string) => branchesApi.activate(id),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['branches']});
 push({ type:'success', message: t('branches.activated')});
},
 onError: (err: unknown) => push({ type:'error', message: getErrorMessage(err)}),
});

 const managerMutation = useMutation({
 mutationFn: ({ id, managerId}: { id: string; managerId: string}) =>
 branchesApi.assignManager(id, managerId),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ['branches']});
 setManagerModal(null);
 setManagerId('');
 push({ type:'success', message: t('branches.managerAssigned')});
},
 onError: (err: unknown) => push({ type:'error', message: getErrorMessage(err)}),
});

 function openCreate() {
 setEditingId(null);
 setForm(INITIAL_FORM);
 setModalOpen(true);
}

 function openEdit(branch: Branch) {
 setEditingId(branch.id);
 setForm({
 name: branch.name,
 code: branch.code ||'',
 address: branch.address ||'',
 phone: branch.phone ||'',
 email: branch.email ||'',
 timezone: branch.timezone ||'Asia/Tashkent',
 currency: branch.currency ||'UZS',
});
 setModalOpen(true);
}

 function handleSubmit() {
 if (!form.name.trim()) return;
 if (editingId) {
 updateMutation.mutate({ id: editingId, data: form});
} else {
 createMutation.mutate(form);
}
}

 if (isLoading) return <GlassPageLoader label={t('common.loading')} />;
 if (error) return <GlassErrorState message={getErrorMessage(error)} onRetry={() => qc.invalidateQueries({ queryKey: ['branches']})} />;

 return (
 <div className="space-y-6">
 {toastNode}

 <ConfirmDialog
  open={deactivateTarget !== null}
  onClose={() => setDeactivateTarget(null)}
  onConfirm={() => {
   if (!deactivateTarget) return;
   deactivateMutation.mutate(deactivateTarget.id);
   setDeactivateTarget(null);
  }}
  description={t('branches.deactivateConfirm')}
  confirmLabel={t('branches.deactivate')}
  loading={deactivateMutation.isPending}
 />
 <GlassPageHeader
 title={t('branches.title')}
 subtitle={t('branches.subtitle')}
 action={canManage ? { label: t('branches.add'), onClick: openCreate} : undefined}
 />

 {branches.length === 0 ? (
 <GlassEmptyState title={t('branches.empty')} message={t('branches.emptyHint')} />
 ) : (
 <GlassTable>
 <GlassTHead>
 <GlassTR>
 <GlassTH>{t('common.name')}</GlassTH>
 <GlassTH>{t('branches.code')}</GlassTH>
 <GlassTH>{t('branches.address')}</GlassTH>
 <GlassTH>{t('branches.manager')}</GlassTH>
 <GlassTH>{t('branches.students')}</GlassTH>
 <GlassTH>{t('common.status')}</GlassTH>
 {canManage && <GlassTH>{t('common.actions')}</GlassTH>}
 </GlassTR>
 </GlassTHead>
 <GlassTBody>
 {branches.map((b) => {
 const status = getStatusConfig(b.isActive);
 return (
 <GlassTR key={b.id}>
 <GlassTD className="font-medium">{b.name}</GlassTD>
 <GlassTD>{b.code ||'—'}</GlassTD>
 <GlassTD className="max-w-[200px] truncate">{b.address ||'—'}</GlassTD>
 <GlassTD>
 {b.manager
 ? `${b.manager.firstName} ${b.manager.lastName}`
 :'—'}
 </GlassTD>
 <GlassTD>{b._count?.students ?? 0}</GlassTD>
 <GlassTD>
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
 {status.label}
 </span>
 </GlassTD>
 {canManage && (
 <GlassTD>
 <div className="flex items-center gap-2">
 <GlassButton
 size="sm"
 variant="ghost"
 onClick={() => openEdit(b)}
 >
 {t('common.edit')}
 </GlassButton>
 <GlassButton
 size="sm"
 variant="ghost"
 onClick={() => setManagerModal(b.id)}
 >
 {t('branches.assignManager')}
 </GlassButton>
 <GlassButton
 size="sm"
 variant="ghost"
 onClick={() => setStatsModal(b)}
 >
 {t('branches.stats')}
 </GlassButton>
 {b.isActive ? (
 <GlassButton
 size="sm"
 variant="ghost"
 className="text-red-600"
 onClick={() => setDeactivateTarget(b)}
 >
 {t('branches.deactivate')}
 </GlassButton>
 ) : (
 <GlassButton
 size="sm"
 variant="ghost"
 className="text-emerald-600"
 onClick={() => activateMutation.mutate(b.id)}
 >
 {t('branches.activate')}
 </GlassButton>
 )}
 </div>
 </GlassTD>
 )}
 </GlassTR>
 );
})}
 </GlassTBody>
 </GlassTable>
 )}

 <GlassModal
 open={modalOpen}
 onClose={() => { setModalOpen(false); setEditingId(null);}}
 title={editingId ? (t('branches.edit')) : (t('branches.create'))}
 footer={
 <div className="flex justify-end gap-3">
 <GlassButton variant="secondary"onClick={() => { setModalOpen(false); setEditingId(null);}}>
 {t('common.cancel')}
 </GlassButton>
 <GlassButton onClick={handleSubmit}>
 {editingId ? t('common.save') : t('common.create')}
 </GlassButton>
 </div>
}
 >
 <div className="space-y-4">
 <GlassField label={t('common.name')} required>
 <GlassInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value})} />
 </GlassField>
 <GlassField label={t('branches.code')}>
 <GlassInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value})} placeholder="e.g. MAIN"/>
 </GlassField>
 <GlassField label={t('branches.address')}>
 <GlassInput value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value})} />
 </GlassField>
 <div className="grid grid-cols-2 gap-4">
 <GlassField label={t('branches.phone')}>
 <GlassInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value})} />
 </GlassField>
 <GlassField label={t('branches.email')}>
 <GlassInput value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value})} />
 </GlassField>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <GlassField label={t('branches.timezone')}>
 <GlassSelect
 value={form.timezone}
 onChange={(e) => setForm({ ...form, timezone: e.target.value})}
 options={TIMEZONES.map((tz) => ({ value: tz, label: tz}))}
 />
 </GlassField>
 <GlassField label={t('branches.currency')}>
 <GlassSelect
 value={form.currency}
 onChange={(e) => setForm({ ...form, currency: e.target.value})}
 options={CURRENCIES.map((c) => ({ value: c, label: c}))}
 />
 </GlassField>
 </div>
 </div>
 </GlassModal>

 <GlassModal
 open={managerModal !== null}
 onClose={() => { setManagerModal(null); setManagerId('');}}
 title={t('branches.assignManager')}
 footer={
 <div className="flex justify-end gap-3">
 <GlassButton variant="secondary"onClick={() => { setManagerModal(null); setManagerId('');}}>
 {t('common.cancel')}
 </GlassButton>
 <GlassButton
 onClick={() => {
 if (managerModal && managerId) {
 managerMutation.mutate({ id: managerModal, managerId});
}
}}
 disabled={!managerId}
 >
 {t('common.save')}
 </GlassButton>
 </div>
}
 >
 <GlassField label={t('branches.selectManager')}>
 <GlassSelect
 value={managerId}
 onChange={(e) => setManagerId(e.target.value)}
 options={[
 { value:'', label:'—'},
 ...((users as any)?.items || []).map((u: any) => ({
 value: u.id,
 label: `${u.firstName} ${u.lastName}`,
})),
 ]}
 />
 </GlassField>
 </GlassModal>

 <GlassModal
 open={statsModal !== null}
 onClose={() => setStatsModal(null)}
 title={t('branches.statsTitle')}
 footer={null}
 >
 {statsModal && (
 <div className="grid grid-cols-2 gap-4">
 <div className="rounded-xl bg-[var(--bg-card)] p-4 text-center">
 <div className="text-2xl font-bold text-brand-600">{statsModal._count?.users ?? 0}</div>
 <div className="text-sm text-[var(--text-muted)]">{t('branches.users')}</div>
 </div>
 <div className="rounded-xl bg-[var(--bg-card)] p-4 text-center">
 <div className="text-2xl font-bold text-emerald-600">{statsModal._count?.students ?? 0}</div>
 <div className="text-sm text-[var(--text-muted)]">{t('branches.students')}</div>
 </div>
 <div className="rounded-xl bg-[var(--bg-card)] p-4 text-center">
 <div className="text-2xl font-bold text-indigo-600">{statsModal._count?.teachers ?? 0}</div>
 <div className="text-sm text-[var(--text-muted)]">{t('branches.teachers')}</div>
 </div>
 <div className="rounded-xl bg-[var(--bg-card)] p-4 text-center">
 <div className="text-2xl font-bold text-orange-600">{statsModal._count?.groups ?? 0}</div>
 <div className="text-sm text-[var(--text-muted)]">{t('branches.groups')}</div>
 </div>
 </div>
 )}
 </GlassModal>
 </div>
 );
}
