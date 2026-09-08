import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton, GlassSwitch, GlassModal, Field, TextInput, Select } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { featureFlagsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'STRING', label: 'String' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'JSON', label: 'JSON' },
];

function FeatureFlagRow({ flag, onToggle, isUpdating }: { flag: FeatureFlag; onToggle: () => void; isUpdating: boolean }) {
  return (
    <li className="px-4 py-3 flex items-center gap-3 hover:bg-[rgba(148,234,239,0.04)] transition-colors">
      <GlassSwitch
        checked={flag.enabled}
        onChange={onToggle}
        disabled={isUpdating}
        aria-label={`Toggle ${flag.name}`}
      />
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm text-[var(--text-primary)] truncate">{flag.name}</h4>
        <p className="text-xs text-muted">{flag.description || flag.key}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(148,234,239,0.12)] text-[var(--m-vivid)] font-mono">{flag.type}</span>
          <span className="text-[10px] text-muted">{flag.rolloutPercentage ? `${flag.rolloutPercentage}% rollout` : 'full rollout'}</span>
        </div>
      </div>
      <Badge color={flag.enabled ? 'success' : 'muted'}>{flag.enabled ? 'On' : 'Off'}</Badge>
    </li>
  );
}

export function FeatureFlagsPage() {
  usePageTitle('Feature Flags');
  const queryClient = useQueryClient();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
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
      toast.success(variables.enabled ? 'Flag enabled' : 'Flag disabled');
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e) => toast.error('Could not update flag', getErrorMessage(e)),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => featureFlagsApi.create(data),
    onSuccess: () => {
      toast.success('Flag created');
      setCreateOpen(false);
      setForm({ key: '', name: '', description: '', type: 'BOOLEAN' });
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
    onError: (e) => setFormError(getErrorMessage(e)),
  });

  const flags: FeatureFlag[] = (flagsQuery.data as any)?.items ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const keyPattern = /^[a-z0-9][a-z0-9._-]*$/i;
    if (!form.key.trim() || !form.name.trim()) {
      setFormError('Key and name are required.');
      return;
    }
    if (!keyPattern.test(form.key.trim())) {
      setFormError('Key may only contain letters, numbers, dots, dashes and underscores.');
      return;
    }
    setFormError(null);
    createMutation.mutate({ ...form, key: form.key.trim(), name: form.name.trim() });
  };

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Feature Flags"
          subtitle="Enable or disable platform capabilities without deploying code"
        />

        <div className="glass-card">
          <div className="px-4 py-3 border-b border-subtle flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Active flags</h3>
            <GlassButton size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
              New flag
            </GlassButton>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {flagsQuery.isLoading ? (
              <div className="p-8"><PageLoader label="Loading feature flags…" /></div>
            ) : flagsQuery.isError ? (
              <div className="p-8">
                <ErrorState
                  title="Failed to load flags"
                  message={getErrorMessage(flagsQuery.error)}
                  onRetry={() => flagsQuery.refetch()}
                />
              </div>
            ) : flags.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No feature flags yet"
                  message="Create your first flag to control platform capabilities per rollout."
                />
              </div>
            ) : (
              flags.map((flag) => (
                <FeatureFlagRow
                  key={flag.id}
                  flag={flag}
                  isUpdating={toggleMutation.isPending}
                  onToggle={() => toggleMutation.mutate({ key: flag.key, enabled: !flag.enabled })}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <GlassModal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setFormError(null); }}
        title="New feature flag"
      >
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <Field label="Key" required>
            <TextInput
              value={form.key}
              onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
              placeholder="e.g. new-dashboard"
              disabled={createMutation.isPending}
              autoFocus
            />
          </Field>
          <Field label="Name" required>
            <TextInput
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Human-readable name"
              disabled={createMutation.isPending}
            />
          </Field>
          <Field label="Description">
            <TextInput
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="What does this flag control?"
              disabled={createMutation.isPending}
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              disabled={createMutation.isPending}
            >
              {FLAG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted">
            New flags start disabled and are visible to all organizations.
          </p>
          {formError && (
            <p className="text-sm text-[var(--state-error)]" role="alert">{formError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => { setCreateOpen(false); setFormError(null); }}
              disabled={createMutation.isPending}
            >
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create flag'}
            </GlassButton>
          </div>
        </form>
      </GlassModal>
    </div>
  );
}
