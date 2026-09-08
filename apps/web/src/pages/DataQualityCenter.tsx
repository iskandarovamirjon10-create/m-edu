import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { dataQualityApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';

interface DataQualityIssue {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  category: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  field?: string | null;
  message: string;
  ruleId: string;
  detectedAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
}

const severityColor: Record<DataQualityIssue['severity'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

export function DataQualityCenterPage() {
  usePageTitle('Data Quality Center');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'critical' | 'unresolved'>('unresolved');

  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ['data-quality-summary'],
    queryFn: () => dataQualityApi.summary() as Promise<Record<string, any>>,
  });

  const issuesQuery = useQuery({
    queryKey: ['data-quality-issues', filter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filter === 'unresolved') params.resolved = 'false';
      if (filter === 'critical') {
        params.resolved = 'false';
        params.severity = 'CRITICAL';
      }
      return dataQualityApi.issues(params) as Promise<DataQualityIssue[]>;
    },
  });

  const runMutation = useMutation({
    mutationFn: () => dataQualityApi.run() as Promise<{ created?: number }>,
    onSuccess: (data) => {
      toast.success('Checks complete', data?.created != null ? `${data.created} new issue(s) detected` : undefined);
      queryClient.invalidateQueries({ queryKey: ['data-quality-summary'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-issues'] });
    },
    onError: (e) => toast.error('Could not run checks', getErrorMessage(e)),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => dataQualityApi.resolve(id),
    onSuccess: () => {
      toast.success('Issue resolved');
      queryClient.invalidateQueries({ queryKey: ['data-quality-issues'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-summary'] });
    },
    onError: (e) => toast.error('Could not resolve issue', getErrorMessage(e)),
  });

  const issues = Array.isArray(issuesQuery.data) ? issuesQuery.data : [];
  const summary = summaryQuery.data;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <div className="flex items-start justify-between">
          <PageHeader
            title="Data Quality Center"
            subtitle="Rule-based, deterministic checks — every issue has a reason. No AI inference."
          />
          <GlassButton
            variant="primary"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? 'Running…' : 'Run all checks'}
          </GlassButton>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Open issues" value={summary.total} color="error" />
            <StatCard label="Critical" value={summary.bySeverity?.CRITICAL ?? 0} color="error" />
            <StatCard label="High" value={summary.bySeverity?.HIGH ?? 0} color="warning" />
            <StatCard label="Resolved this week" value={summary.resolvedThisWeek} color="success" />
          </div>
        )}

        {/* Filter tabs */}
        <div className="glass-card p-3 flex gap-2">
          {(['unresolved', 'critical', 'all'] as const).map((f) => (
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

        {/* Issues list */}
        <div className="glass-card overflow-hidden">
          {issuesQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading data quality issues…" /></div>
          ) : issuesQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load data quality issues"
                message={getErrorMessage(issuesQuery.error)}
                onRetry={() => issuesQuery.refetch()}
              />
            </div>
          ) : issues.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No data quality issues"
                message={
                  filter === 'critical'
                    ? 'No critical issues detected. Your data is healthy.'
                    : filter === 'unresolved'
                    ? 'Everything looks clean — no unresolved issues.'
                    : 'No issues found.'
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {issues.map((issue) => (
                <li key={issue.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Badge color={severityColor[issue.severity]}>{issue.severity}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)]">{issue.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span className="font-mono">{issue.entityType}</span>
                      {issue.field && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{issue.field}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(issue.detectedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveMutation.mutate(issue.id)}
                    disabled={!!issue.resolvedAt}
                  >
                    {issue.resolvedAt ? 'Resolved' : 'Mark resolved'}
                  </GlassButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: 'error' | 'warning' | 'success' | 'primary' }) {
  const colorClass = {
    error: 'text-red-600',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    primary: 'text-[var(--m-vivid)]',
  }[color];
  return (
    <div className="glass-card p-4">
      <div className="text-xs text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}
