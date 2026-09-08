import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  EmptyState,
  ErrorState,
  GlassButton,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';

interface ChangeEvent {
  id: string;
  createdAt: string;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityLabel?: string | null;
  entityId?: string | null;
  description?: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  changedFields?: string[] | null;
}

export function WhatChangedPage() {
  usePageTitle('What Changed?');
  const [filter, setFilter] = useState<'all' | 'created' | 'updated' | 'deleted'>('all');

  // Fetch the real audit feed. The previous query sent `tookMs=50`, an
  // unknown query param that the AuditQueryDto rejected (400) — the page
  // silently rendered "No changes" forever.
  const auditQuery = useQuery({
    queryKey: ['what-changed'],
    queryFn: async () => {
      const res = await fetch('/api/audit?limit=50', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load changes');
      return res.json() as Promise<{ items: ChangeEvent[]; total: number }>;
    },
  });

  const events: ChangeEvent[] = auditQuery.data?.items ?? [];

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter((e) =>
      filter === 'created' ? e.action === 'CREATE' :
      filter === 'updated' ? e.action === 'UPDATE' :
      filter === 'deleted' ? e.action === 'DELETE' : true,
    );
  }, [events, filter]);

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="What Changed?"
          subtitle="Audit-driven change tracking — every meaningful action recorded"
        />

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">How it works</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Source of truth</strong> — AuditLog table records before/after JSON for UPDATE actions</li>
            <li>• <strong className="text-[var(--text-primary)]">Fields changed</strong> — only fields that actually changed are shown (not full payload)</li>
            <li>• <strong className="text-[var(--text-primary)]">Actor tracking</strong> — every entry names the user who made the change</li>
            <li>• <strong className="text-[var(--text-primary)]">No AI summary</strong> — changes are shown verbatim, not paraphrased by a model</li>
          </ul>
        </div>

        <div className="flex gap-2">
          {(['all', 'created', 'updated', 'deleted'] as const).map((f) => (
            <GlassButton
              key={f}
              size="sm"
              variant={filter === f ? 'primary' : 'ghost'}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </GlassButton>
          ))}
        </div>

        <div className="glass-card overflow-hidden">
          {auditQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading changes…" /></div>
          ) : auditQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load changes"
                message={
                  auditQuery.error instanceof Error
                    ? auditQuery.error.message
                    : 'Unknown error'
                }
                onRetry={() => auditQuery.refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No changes"
                message="No audit events match the current filter."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Badge
                      color={
                        e.action === 'CREATE' ? 'success' :
                        e.action === 'DELETE' ? 'error' :
                        'primary'
                      }
                    >
                      {e.action}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm text-[var(--text-primary)]">
                        {e.entityType}
                        {(e.entityLabel || e.entityId) && (
                          <span className="text-muted">
                            {' '}· {e.entityLabel ?? String(e.entityId).slice(0, 8)}
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-muted mt-0.5">
                        {e.action === 'UPDATE' && (e.changedFields?.length || e.previousValue || e.newValue) ? (
                          <>
                            {e.changedFields && e.changedFields.length > 0 && (
                              <>
                                Changed fields:{' '}
                                <strong className="text-[var(--text-primary)]">{e.changedFields.join(', ')}</strong>
                              </>
                            )}
                            {e.previousValue != null && e.newValue != null && (
                              <span>
                                {' '}· from “{JSON.stringify(e.previousValue).substring(0, 40)}” to “{JSON.stringify(e.newValue).substring(0, 40)}”
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {e.description || 'No description'}
                            {' · '}
                            {e.actorName ?? 'system'} · {new Date(e.createdAt).toLocaleString()}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
