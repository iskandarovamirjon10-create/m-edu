/**
 * M-EDU FeatureFlagsPage — Apple Design Award V2 Edition
 *
 * Premium craftsmanship:
 *  - Apple SF Pro visual hierarchy with ambient configuration lighting
 *  - Hero banner with Feature Switches badge & live flag counts
 *  - Tactile spring switches with instant optimistic feedback
 *  - Framer-motion spring transitions (staggered flags feed)
 *  - Liquid glass modal with squircle form inputs
 *  - Full preservation of toggle contracts, key mutations, and i18n
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassButton, GlassSwitch, GlassModal, GlassField, GlassInput, GlassSelect } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { featureFlagsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 360, damping: 28 },
  },
};

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  type: string;
  enabled: boolean;
  rolloutPercentage?: number | null;
}

const FLAG_TYPES = [
  { value: 'BOOLEAN', labelKey: 'featureFlags.type.boolean' },
  { value: 'STRING', labelKey: 'featureFlags.type.string' },
  { value: 'NUMBER', labelKey: 'featureFlags.type.number' },
  { value: 'JSON', labelKey: 'featureFlags.type.json' },
];

function FeatureFlagRow({ flag, onToggle, onEdit, isUpdating }: { flag: FeatureFlag; onToggle: () => void; onEdit: () => void; isUpdating: boolean }) {
  const { t } = useI18n();

  return (
    <motion.li
      variants={itemVariants}
      className="p-4 sm:p-5 flex items-center gap-4 transition-colors duration-200 hover:bg-black/[0.015] dark:hover:bg-white/[0.015]"
    >
      <GlassSwitch
        checked={flag.enabled}
        onChange={onToggle}
        disabled={isUpdating}
        aria-label={t('featureFlags.toggleAria', { name: flag.name })}
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{flag.name}</h4>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{flag.description || flag.key}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono border border-purple-500/20 font-semibold">{flag.type}</span>
          <span className="text-[11px] text-zinc-400">{flag.rolloutPercentage ? t('featureFlags.rolloutPercent', { n: flag.rolloutPercentage }) : t('featureFlags.fullRollout')}</span>
        </div>
      </div>
      <GlassBadge color={flag.enabled ? 'success' : 'muted'}>{flag.enabled ? t('common.on') : t('common.off')}</GlassBadge>
      <GlassButton size="sm" variant="ghost" onClick={onEdit} disabled={isUpdating}>
        {t('common.edit')}
      </GlassButton>
    </motion.li>
  );
}

export function FeatureFlagsPage() {
  const { t } = useI18n();
  usePageTitle(t('featureFlags.title'));
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState({ key: '', name: '', description: '', type: 'BOOLEAN' });
  const [formError, setFormError] = useState<string | null>(null);

  const flagsQuery = useQuery({
    queryKey: ['feature-flags'],
    queryFn: () => featureFlagsApi.list() as Promise<{ items: FeatureFlag[]; total: number }>,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      featureFlagsApi.update(key, { enabled }),
    onSuccess: (_data, variables) => {
      toast.success(variables.enabled ? t('featureFlags.enabledToast') : t('featureFlags.disabledToast'));
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e) => toast.error(t('featureFlags.updateError'), getErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      editingKey
        ? featureFlagsApi.update(editingKey, {
            name: data.name,
            description: data.description,
            type: data.type,
          })
        : featureFlagsApi.create(data),
    onSuccess: () => {
      toast.success(editingKey ? t('featureFlags.updated') : t('featureFlags.createdToast'));
      setCreateOpen(false);
      setEditingKey(null);
      setForm({ key: '', name: '', description: '', type: 'BOOLEAN' });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  interface FeatureFlagsList { items: FeatureFlag[]; total: number }
  const flags: FeatureFlag[] = ((flagsQuery.data as FeatureFlagsList | undefined)?.items) ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const keyPattern = /^[a-z0-9][a-z0-9._-]*$/i;
    if (!form.name.trim() || (!editingKey && !form.key.trim())) {
      setFormError(t('featureFlags.validation.required'));
      return;
    }
    if (!editingKey && !keyPattern.test(form.key.trim())) {
      setFormError(t('featureFlags.validation.keyPattern'));
      return;
    }
    setFormError(null);
    createMutation.mutate({
      ...form,
      key: form.key.trim(),
      name: form.name.trim(),
    });
  };

  const closeForm = () => {
    setCreateOpen(false);
    setEditingKey(null);
    setFormError(null);
  };

  const openCreate = () => {
    setEditingKey(null);
    setForm({ key: '', name: '', description: '', type: 'BOOLEAN' });
    setFormError(null);
    setCreateOpen(true);
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditingKey(flag.key);
    setForm({
      key: flag.key,
      name: flag.name,
      description: flag.description || '',
      type: flag.type,
    });
    setFormError(null);
    setCreateOpen(true);
  };

  const activeCount = flags.filter(f => f.enabled).length;
  const inactiveCount = flags.length - activeCount;

  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING.smooth}
      className="relative min-h-screen bg-transparent p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Ambient background lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-[12%] right-[15%] h-[400px] w-[500px] rounded-full bg-purple-500/10 blur-[140px] dark:bg-purple-600/[0.08]" />
        <div className="absolute top-[40%] left-[8%] h-[350px] w-[450px] rounded-full bg-indigo-500/10 blur-[130px] dark:bg-indigo-600/[0.07]" />
      </div>

      {/* ── Apple V2 Hero Header ── */}
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                {t('featureFlags.title')}
              </h1>
              <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                v2 Apple
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {t('featureFlags.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GlassButton size="md" variant="primary" onClick={openCreate} icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          }>
            {t('featureFlags.newFlag')}
          </GlassButton>
        </div>
      </div>

      {/* ── Summary KPI Strip ── */}
      <div className="relative z-10 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t('common.total') || 'Jami flaglar'}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
            {flags.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t('common.on') || 'Yoqilgan'}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{t('common.off') || 'O\'chirilgan'}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-zinc-400 tabular-nums">
            {inactiveCount}
          </p>
        </div>
      </div>

      {/* ── Feature Flags Feed ── */}
      <div className="relative z-10 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-900/70">
        <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 dark:border-white/[0.08] flex items-center justify-between">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{t('featureFlags.activeFlags')}</h3>
          <span className="text-xs text-zinc-400">{flags.length} total flags configured</span>
        </div>
        <div>
          {flagsQuery.isLoading ? (
            <div className="p-12"><GlassPageLoader label={t('featureFlags.loading')} /></div>
          ) : flagsQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('featureFlags.loadError')}
                message={getErrorMessage(flagsQuery.error)}
                onRetry={() => flagsQuery.refetch()}
              />
            </div>
          ) : flags.length === 0 ? (
            <div className="p-12">
              <GlassEmptyState
                title={t('featureFlags.empty')}
                message={t('featureFlags.emptyHint')}
              />
            </div>
          ) : (
            <motion.ul
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-white/[0.05]"
            >
              {flags.map((flag) => (
                <FeatureFlagRow
                  key={flag.id}
                  flag={flag}
                  isUpdating={toggleMutation.isPending || createMutation.isPending}
                  onToggle={() => toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })}
                  onEdit={() => openEdit(flag)}
                />
              ))}
            </motion.ul>
          )}
        </div>
      </div>

      {/* ── Flag Create / Edit Modal ── */}
      <GlassModal
        open={createOpen}
        onClose={closeForm}
        title={editingKey ? t('featureFlags.editTitle') : t('featureFlags.createTitle')}
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <GlassField label={t('featureFlags.form.key')} required={!editingKey}>
            <GlassInput
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder={t('featureFlags.form.keyPlaceholder')}
              disabled={createMutation.isPending || Boolean(editingKey)}
              readOnly={Boolean(editingKey)}
              autoFocus={!editingKey}
            />
          </GlassField>
          <GlassField label={t('featureFlags.form.name')} required>
            <GlassInput
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('featureFlags.form.namePlaceholder')}
              disabled={createMutation.isPending}
            />
          </GlassField>
          <GlassField label={t('featureFlags.form.description')}>
            <GlassInput
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder={t('featureFlags.form.descriptionPlaceholder')}
              disabled={createMutation.isPending}
            />
          </GlassField>
          <GlassField label={t('featureFlags.form.type')}>
            <GlassSelect
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={createMutation.isPending}
            >
              {FLAG_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>{t(ft.labelKey)}</option>
              ))}
            </GlassSelect>
          </GlassField>
          <p className="text-xs text-zinc-400">
            {t('featureFlags.createHint')}
          </p>
          {formError && (
            <p className="text-sm text-rose-500 font-medium" role="alert">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={closeForm}
              disabled={createMutation.isPending}
            >
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending
                ? editingKey
                  ? t('users.updating')
                  : t('featureFlags.creating')
                : editingKey
                  ? t('common.save')
                  : t('featureFlags.create')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </motion.main>
  );
}

export default FeatureFlagsPage;

