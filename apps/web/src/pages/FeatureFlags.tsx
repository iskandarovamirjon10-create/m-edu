import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassButton, GlassSwitch, GlassModal, GlassField, GlassInput, GlassSelect } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { featureFlagsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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
    <li className="px-4 py-3 flex items-center gap-3 hover:bg-[rgba(148,234,239,0.04)] transition-colors">
      <GlassSwitch
        checked={flag.enabled}
        onChange={onToggle}
        disabled={isUpdating}
        aria-label={t('featureFlags.toggleAria', { name: flag.name })}
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">{flag.name}</h4>
        <p className="text-xs text-muted">{flag.description || flag.key}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(148,234,239,0.12)] text-[var(--m-vivid)] font-mono">{flag.type}</span>
          <span className="text-[10px] text-muted">{flag.rolloutPercentage ? t('featureFlags.rolloutPercent', { n: flag.rolloutPercentage }) : t('featureFlags.fullRollout')}</span>
        </div>
      </div>
      <GlassBadge color={flag.enabled ? 'success' : 'muted'}>{flag.enabled ? t('common.on') : t('common.off')}</GlassBadge>
      <GlassButton size="sm" variant="ghost" onClick={onEdit} disabled={isUpdating}>
        {t('common.edit')}
      </GlassButton>
    </li>
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

  // Toggle by flag KEY — matches the backend contract (PUT /feature-flags/:key
  // with body { enabled }), and the previous implementation sent the row id to
  // a key-addressed endpoint (404 on every toggle for uuid-keyed flags).
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

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('featureFlags.title')}
          subtitle={t('featureFlags.subtitle')}
        />

        <div className="glass-card">
          <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">{t('featureFlags.activeFlags')}</h3>
            <GlassButton size="sm" variant="primary" onClick={openCreate}>
              {t('featureFlags.newFlag')}
            </GlassButton>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {flagsQuery.isLoading ? (
              <div className="p-8"><GlassPageLoader label={t('featureFlags.loading')} /></div>
            ) : flagsQuery.isError ? (
              <div className="p-8">
                <GlassErrorState
                  title={t('featureFlags.loadError')}
                  message={getErrorMessage(flagsQuery.error)}
                  onRetry={() => flagsQuery.refetch()}
                />
              </div>
            ) : flags.length === 0 ? (
              <div className="p-8">
                <GlassEmptyState
                  title={t('featureFlags.empty')}
                  message={t('featureFlags.emptyHint')}
                />
              </div>
            ) : (
              flags.map((flag) => (
                <FeatureFlagRow
                  key={flag.id}
                  flag={flag}
                  isUpdating={toggleMutation.isPending || createMutation.isPending}
                  onToggle={() => toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })}
                  onEdit={() => openEdit(flag)}
                />
              ))
            )}
          </div>
        </div>
      </div>

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
          <p className="text-xs text-muted">
            {t('featureFlags.createHint')}
          </p>
          {formError && (
            <p className="text-sm text-[var(--state-error)]" role="alert">{formError}</p>
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
    </div>
  );
}
