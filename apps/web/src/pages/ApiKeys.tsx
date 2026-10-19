/**
 * M-EDU ApiKeysPage — Apple Design Award Edition
 *
 * Microservices & External Integration Management with Cupertino Security Architecture.
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
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
  useToasts,
} from '@/components/ui';
import { apiKeysApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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
  'students:read', 'students:write',
  'teachers:read', 'teachers:write',
  'groups:read', 'groups:write',
  'courses:read', 'courses:write',
  'attendance:read', 'attendance:write',
  'payments:read', 'payments:write',
  'expenses:read', 'expenses:write',
  'grades:read', 'grades:write',
  'homework:read', 'homework:write',
  'leads:read', 'leads:write',
  'reports:read',
  'analytics:read',
  'settings:read', 'settings:write',
  'users:read',
];

export function ApiKeysPage() {
  const { t } = useI18n();
  usePageTitle(t('apiKeys.title'));
  const queryClient = useQueryClient();
  const { push: toast } = useToasts();
  const [showCreate, setShowCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyItem | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  const [form, setForm] = useState({
    name: '',
    scopes: [] as string[],
    expiresAt: '',
    rateLimit: 1000,
  });

  const { data: keys, isLoading, error } = useQuery<ApiKeyItem[]>({
    queryKey: ['api-keys'],
    queryFn: () => apiKeysApi.list() as Promise<ApiKeyItem[]>,
  });

  const { data: stats } = useQuery<UsageStats>({
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
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-usage'] });
      setGeneratedKey(data.key);
      setShowCreate(false);
      setForm({ name: '', scopes: [], expiresAt: '', rateLimit: 1000 });
      toast('success', t('apiKeys.created'));
    },
    onError: (err: any) => {
      toast('error', getErrorMessage(err));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-usage'] });
      setRevokeTarget(null);
      toast('success', t('apiKeys.revokedSuccess'));
    },
    onError: (err: any) => {
      toast('error', getErrorMessage(err));
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => apiKeysApi.rotate(id),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      queryClient.invalidateQueries({ queryKey: ['api-keys-usage'] });
      setGeneratedKey(data.key);
      toast('success', t('apiKeys.rotatedSuccess'));
    },
    onError: (err: any) => {
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
    if (!d) return '—';
    return new Date(d).toLocaleDateString();
  };

  if (isLoading) return <GlassPageLoader label={t('common.loading')} />;
  if (error) return <GlassErrorState message={getErrorMessage(error)} />;

  return (
    <div className="space-y-8">
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

      {/* KPI metric cards with Apple ambient glow */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="relative overflow-hidden rounded-2xl p-6 bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-white/60 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]"
          >
            <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-brand-500/10 blur-2xl" />
            <p className="text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.totalKeys')}</p>
            <p className="text-[2rem] font-black text-[var(--text-primary)] tracking-tight mt-1">{stats.totalCount}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28, delay: 0.05 }}
            className="relative overflow-hidden rounded-2xl p-6 bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-white/60 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]"
          >
            <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-emerald-500/15 blur-2xl" />
            <p className="text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.activeKeys')}</p>
            <p className="text-[2rem] font-black text-emerald-500 tracking-tight mt-1">{stats.activeCount}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28, delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl p-6 bg-white/60 dark:bg-white/[0.04] backdrop-blur-md border border-white/60 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.7)]"
          >
            <div className="pointer-events-none absolute -top-10 -right-10 w-28 h-28 rounded-full bg-purple-500/10 blur-2xl" />
            <p className="text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.totalUsage')}</p>
            <p className="text-[2rem] font-black text-[var(--text-primary)] tracking-tight mt-1">{stats.totalUsage.toLocaleString()}</p>
          </motion.div>
        </div>
      )}

      {/* Main Keys View */}
      {!keys || keys.length === 0 ? (
        <GlassEmptyState
          title={t('apiKeys.emptyTitle')}
          message={t('apiKeys.emptyMessage')}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          className="relative overflow-hidden rounded-[2.25rem] bg-white/60 dark:bg-white/[0.035] backdrop-blur-md backdrop-saturate-[1.8] border border-white/60 dark:border-white/10 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]/40">
                  <th className="px-6 py-4 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.name')}</th>
                  <th className="px-6 py-4 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.prefix')}</th>
                  <th className="px-6 py-4 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.scopes')}</th>
                  <th className="px-6 py-4 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.status')}</th>
                  <th className="px-6 py-4 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.lastUsed')}</th>
                  <th className="px-6 py-4 text-left text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('apiKeys.usage')}</th>
                  <th className="px-6 py-4 text-right text-[0.72rem] font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]/40">
                {keys.map((key) => (
                  <tr
                    key={key.id}
                    className="hover:bg-slate-50 dark:bg-slate-900/40 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">{key.name}</td>
                    <td className="px-6 py-4">
                      <code className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono text-xs font-bold border border-blue-500/20">
                        {key.keyPrefix}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {key.scopes.slice(0, 3).map(s => (
                          <span key={s} className="px-2 py-0.5 rounded-md text-[0.68rem] font-medium bg-[var(--state-hover)] text-[var(--text-secondary)]">
                            {s}
                          </span>
                        ))}
                        {key.scopes.length > 3 && (
                          <span className="px-2 py-0.5 rounded-md text-[0.68rem] font-medium bg-[var(--state-hover)] text-[var(--text-muted)]">
                            +{key.scopes.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.7rem] font-bold tracking-wide ${
                        key.isActive
                          ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                          : 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${key.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500'}`} />
                        {key.isActive ? t('apiKeys.active') : t('apiKeys.revoked')}
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
                              className="border border-amber-500/25 text-amber-600 hover:bg-amber-500/10"
                            >
                              {t('apiKeys.rotate')}
                            </GlassButton>
                            <GlassButton
                              size="sm"
                              variant="ghost"
                              onClick={() => setRevokeTarget(key)}
                              disabled={revokeMutation.isPending}
                              className="border border-rose-500/25 text-rose-600 hover:bg-rose-500/10"
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
        </motion.div>
      )}

      {/* Creation Modal */}
      {showCreate && (
        <GlassModal open={showCreate} title={t('apiKeys.generateTitle')} onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            <GlassField label={t('apiKeys.nameLabel')}>
              <GlassInput
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('apiKeys.namePlaceholder')}
              />
            </GlassField>

            <GlassField label={t('apiKeys.rateLimitLabel')}>
              <GlassInput
                type="number"
                value={form.rateLimit}
                onChange={e => setForm(prev => ({ ...prev, rateLimit: Number(e.target.value) }))}
              />
            </GlassField>

            <GlassField label={t('apiKeys.expiryLabel')}>
              <GlassInput
                type="date"
                value={form.expiresAt}
                onChange={e => setForm(prev => ({ ...prev, expiresAt: e.target.value }))}
              />
            </GlassField>

            <div>
              <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t('apiKeys.scopesLabel')}</label>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2.5 rounded-2xl bg-[var(--bg-card)]/50 border border-[var(--border-subtle)]">
                {ALL_SCOPES.map(scope => (
                  <GlassButton
                    key={scope}
                    type="button"
                    size="sm"
                    variant={form.scopes.includes(scope) ? 'primary' : 'secondary'}
                    onClick={() => toggleScope(scope)}
                    className="px-2.5 py-1 text-[0.72rem] font-medium"
                  >
                    {scope}
                  </GlassButton>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
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
                {createMutation.isPending ? t('common.saving') : t('apiKeys.generate')}
              </GlassButton>
            </div>
          </div>
        </GlassModal>
      )}

      {/* Secret Key Revealed Vault Modal */}
      <AnimatePresence>
        {generatedKey && (
          <GlassModal open={!!generatedKey} title={t('apiKeys.keyGenerated')} onClose={() => setGeneratedKey(null)}>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{t('apiKeys.copyWarning')}</p>
              </div>

              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 font-mono text-sm break-all">
                <span className="flex-1 text-[var(--text-primary)] font-bold">{generatedKey}</span>
                <GlassButton
                  size="sm"
                  variant="primary"
                  onClick={copyKey}
                  className="shrink-0"
                >
                  {copied ? (t('common.copied') || 'Copied!') : (t('common.copy') || 'Copy')}
                </GlassButton>
              </div>

              <div className="flex justify-end pt-2">
                <GlassButton
                  variant="secondary"
                  onClick={() => setGeneratedKey(null)}
                >
                  {t('common.done') || 'Done'}
                </GlassButton>
              </div>
            </div>
          </GlassModal>
        )}
      </AnimatePresence>

      {/* Revocation Confirm Dialog */}
      <ConfirmDialog
        open={!!revokeTarget}
        title={t('apiKeys.revokeTitle')}
        description={t('apiKeys.revokeConfirm', { name: revokeTarget?.name ?? '' })}
        confirmLabel={t('apiKeys.revoke')}
        tone="danger"
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
        }}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}

export default ApiKeysPage;
