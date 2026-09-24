import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  PageLoader,
  ErrorState,
  EmptyState,
  GlassInput,
  GlassSelect,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  subLabel?: string;
  href?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootType: string;
  rootId: string;
}

export function RelationshipGraphPage() {
  const { t } = useI18n();
  usePageTitle(t('relationshipGraph.title'));

  const [entityType, setEntityType] = useState('STUDENT');
  const [entityId, setEntityId] = useState('');

  const graphQuery = useQuery({
    queryKey: ['relationship-graph', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return null;
      const res = await fetch(
        `/api/relationships/graph?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
      );
      if (!res.ok) return null;
      return res.json() as Promise<GraphData>;
    },
    enabled: !!entityId,
  });

  const graph = graphQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title={t('relationshipGraph.title')}
          subtitle={t('relationshipGraph.subtitle')}
        />

 <div className="glass-card p-4">
 <div className="flex flex-wrap items-end gap-3">
 <GlassSelect
 label={t('communication.entityType')}
 value={entityType}
 onChange={(e) => setEntityType(e.target.value)}
 className="w-auto"
 >
 {['STUDENT', 'TEACHER', 'GROUP', 'COURSE', 'LEAD', 'PAYMENT', 'EMPLOYEE'].map((type) => (
 <option key={type} value={type}>{t(`enum.badge.${type}`)}</option>
 ))}
 </GlassSelect>
 <div className="flex-1 min-w-[200px]">
 <GlassInput
 label={t('dg.entityId')}
 type="text"
 value={entityId}
 onChange={(e) => setEntityId(e.target.value)}
 placeholder={t('relationshipGraph.idPlaceholder')}
 />
 </div>
 </div>
 </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('relationshipGraph.typesTitle')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('enum.badge.STUDENT')}</strong> {t('relationshipGraph.rel.student')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('enum.badge.TEACHER')}</strong> {t('relationshipGraph.rel.teacher')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('enum.badge.GROUP')}</strong> {t('relationshipGraph.rel.group')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('enum.badge.COURSE')}</strong> {t('relationshipGraph.rel.course')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('enum.badge.LEAD')}</strong> {t('relationshipGraph.rel.lead')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('enum.badge.PAYMENT')}</strong> {t('relationshipGraph.rel.payment')}</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {!entityId ? (
            <div className="p-8">
              <EmptyState
                title={t('relationshipGraph.emptyTitle')}
                message={t('relationshipGraph.emptyMessage')}
              />
            </div>
          ) : graphQuery.isLoading ? (
            <div className="p-8"><PageLoader label={t('relationshipGraph.loading')} /></div>
          ) : graphQuery.isError ? (
            <div className="p-8">
              <ErrorState
                message={getErrorMessage(graphQuery.error)}
                onRetry={() => graphQuery.refetch()}
              />
            </div>
          ) : !graph || graph.nodes.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={t('relationshipGraph.noResultsTitle')}
                message={t('relationshipGraph.noResultsMessage')}
              />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Nodes list */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  {t('relationshipGraph.entities', { n: graph.nodes.length })}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {graph.nodes.map((n) => (
                    <a
                      key={n.id}
                      href={n.href ?? '#'}
                      className="flex items-center gap-2 rounded-xl border border-[var(--border-medium)] px-3 py-2 hover:border-brand-500 transition-colors"
                    >
                      <span className="shrink-0 rounded-md bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-mono text-brand-500">
                        {n.type}
                      </span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{n.label}</span>
                      {n.subLabel && (
                        <span className="text-xs text-muted truncate">{n.subLabel}</span>
                      )}
                    </a>
                  ))}
                </div>
              </div>

              {/* Edges list */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  {t('relationshipGraph.connections', { n: graph.edges.length })}
                </h4>
                <div className="space-y-1">
                  {graph.edges.map((e, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg bg-[var(--bg-glass)] px-3 py-1.5 text-xs"
                    >
                      <span className="font-mono text-muted">{e.from}</span>
                      <span className="text-brand-500">─[{e.type}: {e.label}]→</span>
                      <span className="font-mono text-muted">{e.to}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
