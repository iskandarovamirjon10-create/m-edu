import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type TranslateFn } from '@/i18n/I18nProvider';

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

const ACTION_LABEL_KEYS: Record<string, string> = {
  LOGIN: 'enum.action.LOGIN',
  CREATE: 'enum.action.CREATE',
  UPDATE: 'enum.action.UPDATE',
  DELETE: 'enum.action.DELETE',
  EXPORT: 'enum.action.EXPORT',
  IMPORT: 'enum.action.IMPORT',
};

const FILTER_LABEL_KEYS = {
  all: 'enum.all',
  created: 'whatChanged.filterCreated',
  updated: 'whatChanged.filterUpdated',
  deleted: 'whatChanged.filterDeleted',
} as const;

function actionLabel(action: string, t: TranslateFn): string {
  const key = ACTION_LABEL_KEYS[action];
  return key ? t(key) : action;
}

export function WhatChangedPage() {
  const { t } = useI18n();
  usePageTitle(t('whatChanged.title'));
  const [filter, setFilter] = useState<'all' | 'created' | 'updated' | 'deleted'>('all');

  // Fetch the real audit feed. The previous query sent `tookMs=50`, an
  // unknown query param that the AuditQueryDto rejected (400) — the page
  // silently rendered "No changes" forever.
  const auditQuery = useQuery({
    queryKey: ['what-changed'],
    queryFn: async () => {
      const res = await fetch('/api/audit?limit=50', { credentials: 'include' });
      if (!res.ok) throw new Error(t('whatChanged.loadFailed'));
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
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('whatChanged.title')}
          subtitle={t('whatChanged.subtitle')}
        />

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('whatChanged.howItWorks')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('whatChanged.sourceOfTruth')}</strong> — {t('whatChanged.sourceOfTruthDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('whatChanged.fieldsChanged')}</strong> — {t('whatChanged.fieldsChangedDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('whatChanged.actorTracking')}</strong> — {t('whatChanged.actorTrackingDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('whatChanged.noAiSummary')}</strong> — {t('whatChanged.noAiSummaryDesc')}</li>
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
              {t(FILTER_LABEL_KEYS[f])}
            </GlassButton>
          ))}
        </div>

        <div className="glass-card overflow-hidden">
          {auditQuery.isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('whatChanged.loading')} /></div>
          ) : auditQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('whatChanged.loadFailed')}
                message={
                  auditQuery.error instanceof Error
                    ? auditQuery.error.message
                    : t('whatChanged.unknownError')
                }
                onRetry={() => auditQuery.refetch()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('whatChanged.emptyTitle')}
                message={t('whatChanged.emptyMessage')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((e) => (
                <li key={e.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <GlassBadge
                      color={
                        e.action === 'CREATE' ? 'success' :
                        e.action === 'DELETE' ? 'error' :
                        'primary'
                      }
                    >
                      {actionLabel(e.action, t)}
                    </GlassBadge>
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
                                {t('whatChanged.changedFields')}{' '}
                                <strong className="text-[var(--text-primary)]">{e.changedFields.join(', ')}</strong>
                              </>
                            )}
                            {e.previousValue != null && e.newValue != null && (
                              <span>
                                {' '}{t('whatChanged.fromTo', {
                                  from: JSON.stringify(e.previousValue).substring(0, 40),
                                  to: JSON.stringify(e.newValue).substring(0, 40),
                                })}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            {e.description || t('whatChanged.noDescription')}
                            {' · '}
                            {e.actorName ?? t('whatChanged.systemActor')} · {new Date(e.createdAt).toLocaleString()}
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
