import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassTable, GlassTHead, GlassTBody, GlassTR, GlassTH, GlassTD, GlassPagination, GlassInput, GlassSelect } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n, type Locale } from '@/i18n/I18nProvider';
import { auditApi } from '@/lib/api';

import type { Paginated, SystemAuditEvent, AuditAction } from '@/lib/types';

/**
 * Global Audit Timeline — rule-based, deterministic (NO AI).
 * Uses the AuditLog model via the backend audit endpoint.
 */

// Reuse enum.action.* for exact-match actions; everything else uses audit.action.*.
const ENUM_ACTION_SET = new Set<AuditAction>([
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'EXPORT',
  'IMPORT',
]);

function actionKey(action: string): string {
  return ENUM_ACTION_SET.has(action as AuditAction)
    ? `enum.action.${action}`
    : `audit.action.${action}`;
}

const EVENT_TYPE_FILTERS = [
  { value: '', label: 'enum.allActions' },
  { value: 'LOGIN', label: 'enum.action.LOGIN' },
  { value: 'CREATE', label: 'enum.action.CREATE' },
  { value: 'UPDATE', label: 'enum.action.UPDATE' },
  { value: 'DELETE', label: 'enum.action.DELETE' },
  { value: 'EXPORT', label: 'enum.action.EXPORT' },
  { value: 'IMPORT', label: 'enum.action.IMPORT' },
];

const DATE_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uz: 'uz-UZ',
};

export function AuditTimelinePage() {
  const { t, locale } = useI18n();
  usePageTitle(t('auditTimeline.title'));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [limit] = useState(20);

  const params = useMemo(() => ({
    page,
    limit,
    action: action || undefined,
    search: search || undefined,
  }), [page, limit, action, search]);

  const auditQuery = useQuery({
    queryKey: ['audit-timeline', params],
    queryFn: () => auditApi.list(params) as Promise<Paginated<SystemAuditEvent>>,
    placeholderData: (prev) => prev,
  });

  const data = auditQuery.data;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setAction(e.target.value);
    setPage(1);
  }, []);

  const statusColor = (action: string) => {
    if (action === 'CREATE') return 'success';
    if (action === 'UPDATE') return 'warning';
    if (action === 'DELETE') return 'error';
    if (action === 'LOGIN') return 'primary';
    return 'muted';
  };

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-cyan-2" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('auditTimeline.title')}
          subtitle={t('auditTimeline.pageSubtitle')}
        />

        {/* Filters */}
        <div className="glass-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
              <GlassInput
                placeholder={t('auditTimeline.searchPlaceholder')}
                aria-label={t('auditTimeline.searchAria')}
                value={search}
                onChange={handleSearchChange}
                type="search"
              />
              <GlassSelect
                value={action}
                onChange={handleActionChange}
                aria-label={t('common.filterByAction')}
              >
                {EVENT_TYPE_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{t(f.label)}</option>
                ))}
              </GlassSelect>
            </div>
            <div className="text-sm text-muted sm:ml-4 sm:shrink-0">
              {data ? t('auditTimeline.count', { count: data.total }) : '—'}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {auditQuery.isLoading && !data ? (
            <div className="p-8"><GlassPageLoader label={t('auditTimeline.loading')} /></div>
          ) : auditQuery.isError ? (
            <div className="p-8"><GlassErrorState title={t('auditTimeline.loadError')} message={auditQuery.error instanceof Error ? auditQuery.error.message : t('common.unknownError')} /></div>
          ) : (!data || data.items.length === 0) ? (
            <GlassEmptyState
              title={search || action ? t('auditTimeline.emptyFilteredTitle') : t('auditTimeline.emptyTitle')}
              message={search || action ? t('common.adjustFilters') : t('auditTimeline.emptyMessage')}
            />
          ) : (
            <>
              <div className="glass-table-wrap">
                <GlassTable>
                  <GlassTHead>
                    <GlassTR>
                      <GlassTH>{t('audit.col.time')}</GlassTH>
                      <GlassTH>{t('audit.col.action')}</GlassTH>
                      <GlassTH>{t('auditTimeline.col.resource')}</GlassTH>
                      <GlassTH>{t('audit.col.actor')}</GlassTH>
                      <GlassTH>{t('auditTimeline.col.details')}</GlassTH>
                    </GlassTR>
                  </GlassTHead>
                  <GlassTBody>
                    {data.items.map((item) => (
                      <GlassTR key={item.id} className="group hover:bg-[rgba(148,234,239,0.06)] transition-colors">
                        <GlassTD className="whitespace-nowrap font-mono text-xs text-muted">
                          {new Date(item.createdAt).toLocaleString(DATE_LOCALES[locale], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </GlassTD>
                        <GlassTD>
                          <GlassBadge color={statusColor(item.action)}>
                            {t(actionKey(item.action || ''))}
                          </GlassBadge>
                        </GlassTD>
                        <GlassTD className="text-xs text-muted font-medium">
                          {item.entityType}
                          {item.entityId ? ` · ${String(item.entityId).slice(0, 8)}` : ''}
                        </GlassTD>
                        <GlassTD className="whitespace-nowrap text-sm">
                          {item.actorName || t('common.system')}
                        </GlassTD>
                        <GlassTD className="max-w-xs truncate text-xs text-muted" title={item.description}>
                          {item.description}
                        </GlassTD>
                      </GlassTR>
                    ))}
                  </GlassTBody>
                </GlassTable>
              </div>
              <div className="border-t border-subtle px-4 py-3">
                <GlassPagination
                  page={page}
                  totalPages={data.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>

        {/* Note: this page uses the existing AuditLog model (line 1440 of schema.prisma).
            It is fully rule-based: every event comes from the database, no LLM / AI / prediction. */}
      </div>
    </div>
  );
}
