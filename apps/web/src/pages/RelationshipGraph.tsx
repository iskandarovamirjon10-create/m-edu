import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PageHeader,
  PageLoader,
  EmptyState,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  usePageTitle('Relationship Graph');

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
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Relationship Graph"
          subtitle="Explore connections between students, teachers, groups, courses, and payments"
        />

        <div className="glass-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted">Entity type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)] px-3 py-2 text-sm"
              >
                {['STUDENT', 'TEACHER', 'GROUP', 'COURSE', 'LEAD', 'PAYMENT', 'EMPLOYEE'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-xs text-muted">Entity ID</label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="Paste the entity UUID or ID"
                className="rounded-xl border border-[var(--border-medium)] bg-[var(--bg-glass)] px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Relationship types</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">STUDENT</strong> → ENROLLED_IN (group) · ASSIGNED_TO (teacher) · MADE (payment)</li>
            <li>• <strong className="text-[var(--text-primary)]">TEACHER</strong> → TEACHES (group) · CREATED (course) · ASSIGNED_TO (group)</li>
            <li>• <strong className="text-[var(--text-primary)]">GROUP</strong> → BELONGS_TO (course) · HAS_STUDENT (student)</li>
            <li>• <strong className="text-[var(--text-primary)]">COURSE</strong> → HAS_GROUP (group) · CREATED_BY (teacher)</li>
            <li>• <strong className="text-[var(--text-primary)]">LEAD</strong> → CONVERTED_TO (student) · ASSIGNED_TO (user)</li>
            <li>• <strong className="text-[var(--text-primary)]">PAYMENT</strong> → MADE_BY (student) · FOR (group)</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {!entityId ? (
            <div className="p-8">
              <EmptyState
                title="Enter an entity ID"
                message="Select a type and paste an entity ID above to explore its relationships."
              />
            </div>
          ) : graphQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading graph…" /></div>
          ) : !graph || graph.nodes.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No relationships found"
                message="This entity has no connections in the system."
              />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Nodes list */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                  Entities ({graph.nodes.length})
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
                  Connections ({graph.edges.length})
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
