import { useState, useRef, useEffect} from'react';
import { useQuery, useMutation, useQueryClient} from'@tanstack/react-query';
 import {
 GlassPageHeader,
 GlassPageLoader,
 GlassErrorState,
 GlassEmptyState,
 GlassModal,
 GlassField,
 GlassInput,
 GlassButton,
 ConfirmDialog,
 } from'@/components/ui';
import { useToasts} from'@/components/ui';
import { apiKeysApi} from'@/lib/api';
import { getErrorMessage} from'@/lib/errorMessages';
import { usePageTitle} from'@/hooks/usePageTitle';
import { useI18n} from'@/i18n/I18nProvider';

interface ApiKeyItem {
 id: string;
 name: string;
 keyPrefix: string;
 scopes: string[];
 isActive: boolean;
 lastUsedAt: string | null;
 expiresAt: string | null;
 rateLimit: number;
 usageCount: number;
 createdAt: string;
}

interface UsageStats {
 keys: ApiKeyItem[];
 totalUsage: number;
 activeCount: number;
 totalCount: number;
}

const ALL_SCOPES = [
'students:read','students:write',
'teachers:read','teachers:write',
'groups:read','groups:write',
'courses:read','courses:write',
'attendance:read','attendance:write',
'payments:read','payments:write',
'expenses:read','expenses:write',
'grades:read','grades:write',
'homework:read','homework:write',
'leads:read','leads:write',
'reports:read',
'analytics:read',
'settings:read','settings:write',
'users:read',
];

export function ApiKeysPage() {
 const { t} = useI18n();
 usePageTitle(t('apiKeys.title'));
 const queryClient = useQueryClient();
 const { push: toast} = useToasts();
 const [showCreate, setShowCreate] = useState(false);
 const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
 const [generatedKey, setGeneratedKey] = useState<string | null>(null);
 const [copied, setCopied] = useState(false);
 const copyTimerRef = useRef<number | null>(null);
 useEffect(() => () => { if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current); }, []);

 const [form, setForm] = useState({
 name:'',
 scopes: [] as string[],
 expiresAt:'',
 rateLimit: 1000,
});

 const { data: keys, isLoading, error} = useQuery<ApiKeyItem[]>({
 queryKey: ['api-keys'],
 queryFn: () => apiKeysApi.list() as Promise<ApiKeyItem[]>,
});

 const { data: stats} = useQuery<UsageStats>({
 queryKey: ['api-keys-usage'],
 queryFn: () => apiKeysApi.usageStats() as Promise<UsageStats>,
});

 const createMutation = useMutation({
 mutationFn: () => apiKeysApi.create({
 name: form.name,
 scopes: form.scopes,
 expiresAt: form.expiresAt || undefined,
 rateLimit: form.rateLimit,
}),
 onSuccess: (data: any) => {
 queryClient.invalidateQueries({ queryKey: ['api-keys']});
 queryClient.invalidateQueries({ queryKey: ['api-keys-usage']});
 setGeneratedKey(data.key);
 setShowCreate(false);
 setForm({ name:'', scopes: [], expiresAt:'', rateLimit: 1000});
 toast('success', t('apiKeys.created'));
},
 onError: (err: Error) => {
 toast('error', getErrorMessage(err));
},
});

 const revokeMutation = useMutation({
 mutationFn: (id: string) => apiKeysApi.revoke(id),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['api-keys']});
 queryClient.invalidateQueries({ queryKey: ['api-keys-usage']});
 toast('success', t('apiKeys.revoked'));
},
 onError: (err: Error) => {
 toast('error', getErrorMessage(err));
},
});

 const rotateMutation = useMutation({
 mutationFn: (id: string) => apiKeysApi.rotate(id),
 onSuccess: (data: any) => {
 queryClient.invalidateQueries({ queryKey: ['api-keys']});
 queryClient.invalidateQueries({ queryKey: ['api-keys-usage']});
 setGeneratedKey(data.key);
 toast('success', t('apiKeys.rotated'));
},
 onError: (err: Error) => {
 toast('error', getErrorMessage(err));
},
});

 const toggleScope = (scope: string) => {
 setForm(prev => ({
 ...prev,
 scopes: prev.scopes.includes(scope)
 ? prev.scopes.filter(s => s !== scope)
 : [...prev.scopes, scope],
}));
};

 const copyKey = () => {
 if (generatedKey) {
 navigator.clipboard.writeText(generatedKey);
 setCopied(true);
 if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
 copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
}
};

 const formatDate = (d: string | null) => {
 if (!d) return'—';
 return new Date(d).toLocaleDateString();
};

 if (isLoading) return <GlassPageLoader label={t('common.loading')} />;
 if (error) return <GlassErrorState message={getErrorMessage(error)} />;

 return (
 <div className="space-y-6">
 <GlassPageHeader
 title={t('apiKeys.title')}
 subtitle={t('apiKeys.subtitle')}
 action={
 <GlassButton
 onClick={() => setShowCreate(true)}
 variant="primary"
 >
 {t('apiKeys.generate')}
 </GlassButton>
}
 />

 {stats && (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
 <div className="glass-card p-4 rounded-xl">
 <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.totalKeys')}</p>
 <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{stats.totalCount}</p>
 </div>
 <div className="glass-card p-4 rounded-xl">
 <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.activeKeys')}</p>
 <p className="text-2xl font-black text-emerald-600 mt-1">{stats.activeCount}</p>
 </div>
 <div className="glass-card p-4 rounded-xl">
 <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.totalUsage')}</p>
 <p className="text-2xl font-black text-[var(--text-primary)] mt-1">{stats.totalUsage.toLocaleString()}</p>
 </div>
 </div>
 )}

 {!keys || keys.length === 0 ? (
 <GlassEmptyState
 title={t('apiKeys.emptyTitle')}
 message={t('apiKeys.emptyMessage')}
 />
 ) : (
 <div className="glass-card rounded-2xl overflow-hidden border border-black/5 ">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-black/5 ">
 <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.name')}</th>
 <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.prefix')}</th>
 <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.scopes')}</th>
 <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.status')}</th>
 <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.lastUsed')}</th>
 <th className="px-6 py-4 text-left text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.usage')}</th>
 <th className="px-6 py-4 text-right text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.actions')}</th>
 </tr>
 </thead>
 <tbody>
 {keys.map((key, idx) => (
 <tr
 key={key.id}
 className="border-b border-black/5 hover:bg-[var(--bg-card)] dark:hover:bg-[var(--bg-card)] transition-colors"
 style={{ animationDelay: `${idx * 40}ms`}}
 >
 <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">{key.name}</td>
 <td className="px-6 py-4">
 <code className="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 font-mono text-xs font-bold border border-brand-500/20">
 {key.keyPrefix}
 </code>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-wrap gap-1 max-w-xs">
 {key.scopes.slice(0, 3).map(s => (
 <span key={s} className="px-1.5 py-0.5 rounded text-[0.65rem] font-bold bg-[var(--state-hover)] text-[var(--text-secondary)]">{s}</span>
 ))}
 {key.scopes.length > 3 && (
 <span className="px-1.5 py-0.5 rounded text-[0.65rem] font-bold bg-[var(--state-hover)] text-[var(--text-muted)]">+{key.scopes.length - 3}</span>
 )}
 </div>
 </td>
 <td className="px-6 py-4">
 <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider ${key.isActive ?'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
 <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${key.isActive ?'bg-emerald-500' :'bg-red-500'}`} />
 {key.isActive ? (t('apiKeys.active')) : (t('apiKeys.revoked'))}
 </span>
 </td>
 <td className="px-6 py-4 text-[var(--text-muted)] text-xs">{formatDate(key.lastUsedAt)}</td>
 <td className="px-6 py-4 font-mono text-sm font-bold text-[var(--text-primary)]">{key.usageCount.toLocaleString()}</td>
 <td className="px-6 py-4 text-right">
 <div className="flex items-center justify-end gap-2">
 {key.isActive && (
 <>
 <GlassButton
 size="sm"
 variant="ghost"
 onClick={() => rotateMutation.mutate(key.id)}
 disabled={rotateMutation.isPending}
 loading={rotateMutation.isPending}
 className="border border-amber-500/20 text-amber-600"
 >
 {t('apiKeys.rotate')}
 </GlassButton>
 <GlassButton
 size="sm"
 variant="ghost"
 onClick={() => setRevokeTarget(key)}
 disabled={revokeMutation.isPending}
 className="border border-red-500/20 text-red-600"
 >
 {t('apiKeys.revoke')}
 </GlassButton>
 </>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {showCreate && (
 <GlassModal open={showCreate} title={t('apiKeys.generateTitle')} onClose={() => setShowCreate(false)}>
 <div className="space-y-4">
 <GlassField label={t('apiKeys.nameLabel')}>
 <GlassInput
 value={form.name}
 onChange={e => setForm(prev => ({ ...prev, name: e.target.value}))}
 placeholder={t('apiKeys.namePlaceholder')}
 />
 </GlassField>

 <GlassField label={t('apiKeys.rateLimitLabel')}>
 <GlassInput
 type="number"
 value={form.rateLimit}
 onChange={e => setForm(prev => ({ ...prev, rateLimit: Number(e.target.value)}))}
 />
 </GlassField>

 <GlassField label={t('apiKeys.expiryLabel')}>
 <GlassInput
 type="date"
 value={form.expiresAt}
 onChange={e => setForm(prev => ({ ...prev, expiresAt: e.target.value}))}
 />
 </GlassField>

 <div>
 <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('apiKeys.scopesLabel')}</label>
 <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-xl bg-[var(--bg-card)] border border-black/5 ">
 {ALL_SCOPES.map(scope => (
 <GlassButton
 key={scope}
 type="button"
 size="sm"
 variant={form.scopes.includes(scope) ?'primary' :'secondary'}
 onClick={() => toggleScope(scope)}
 className="px-2 py-1 text-[0.7rem] font-bold"
 >
 {scope}
 </GlassButton>
 ))}
 </div>
 </div>

 <div className="flex justify-end gap-3 pt-2">
 <GlassButton
 variant="secondary"
 onClick={() => setShowCreate(false)}
 >
 {t('common.cancel')}
 </GlassButton>
 <GlassButton
 variant="primary"
 onClick={() => createMutation.mutate()}
 disabled={!form.name || form.scopes.length === 0 || createMutation.isPending}
 loading={createMutation.isPending}
 >
 {createMutation.isPending ? (t('common.saving')) : (t('apiKeys.generate'))}
 </GlassButton>
 </div>
 </div>
 </GlassModal>
 )}

 {generatedKey && (
 <GlassModal open={!!generatedKey} title={t('apiKeys.keyGenerated')} onClose={() => setGeneratedKey(null)}>
 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 ">
 <p className="text-sm font-bold text-amber-800 mb-2">{t('apiKeys.copyWarning')}</p>
 </div>
 <div className="flex items-center gap-2 p-3 rounded-xl bg-[var(--bg-surface)] border border-black/5 font-mono text-sm break-all">
 <span className="flex-1 text-[var(--text-primary)]">{generatedKey}</span>
 <GlassButton
 size="sm"
 variant="primary"
 onClick={copyKey}
 >
 {copied ? (t('apiKeys.copied')) : (t('apiKeys.copy'))}
 </GlassButton>
 </div>
 <GlassButton
 variant="secondary"
 className="w-full"
 onClick={() => setGeneratedKey(null)}
 >
 {t('common.close')}
 </GlassButton>
 </div>
 </GlassModal>
 )}

 <ConfirmDialog
  open={revokeTarget !== null}
  onClose={() => setRevokeTarget(null)}
  onConfirm={() => {
   if (!revokeTarget) return;
   revokeMutation.mutate(revokeTarget.id);
   setRevokeTarget(null);
  }}
  description={t('apiKeys.revokeConfirm')}
  confirmLabel={t('apiKeys.revoke')}
  loading={revokeMutation.isPending}
 />
 </div>
 );
}

export default ApiKeysPage;
