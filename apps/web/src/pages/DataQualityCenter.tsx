import { formatDate } from '../lib/format';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { dataQualityApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

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

const SEVERITY_LABEL_KEY: Record<DataQualityIssue['severity'], string> = {
  LOW: 'anomaly.lowSeverity',
  MEDIUM: 'anomaly.mediumSeverity',
  HIGH: 'anomaly.highSeverity',
  CRITICAL: 'dataQualityCenter.critical',
};

const FILTER_LABEL_KEY = {
  unresolved: 'dataQualityCenter.filter.unresolved',
  critical: 'dataQualityCenter.filter.critical',
  all: 'enum.all',
} as const;

interface DataQualitySummary {
  total: number;
  resolvedThisWeek: number;
  bySeverity?: Partial<Record<DataQualityIssue['severity'], number>>;
}

export function DataQualityCenterPage() {
  const { t } = useI18n();
  usePageTitle(t('dataQualityCenter.title'));
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'critical' | 'unresolved'>('unresolved');

  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ['data-quality-summary'],
    queryFn: () => dataQualityApi.summary() as Promise<DataQualitySummary>,
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
      toast.success(
        t('dataQualityCenter.checksComplete'),
        data?.created != null ? t('dataQualityCenter.newIssues', { n: data.created }) : undefined,
      );
      queryClient.invalidateQueries({ queryKey: ['data-quality-summary'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-issues'] });
    },
    onError: (e) => toast.error(t('dataQualityCenter.runFailed'), getErrorMessage(e)),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => dataQualityApi.resolve(id),
    onSuccess: () => {
      toast.success(t('dataQualityCenter.resolved'));
      queryClient.invalidateQueries({ queryKey: ['data-quality-issues'] });
      queryClient.invalidateQueries({ queryKey: ['data-quality-summary'] });
    },
    onError: (e) => toast.error(t('dataQualityCenter.resolveFailed'), getErrorMessage(e)),
  });

  const issues = Array.isArray(issuesQuery.data) ? issuesQuery.data : [];
  const summary = summaryQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <div className="flex items-start justify-between">
          <PageHeader
            title={t('dataQualityCenter.title')}
            subtitle={t('dataQualityCenter.subtitle')}
          />
          <GlassButton
            variant="primary"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? t('automation.running') : t('dataQualityCenter.runAll')}
          </GlassButton>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label={t('dataQualityCenter.openIssues')} value={summary.total} color="error" />
            <StatCard label={t('dataQualityCenter.critical')} value={summary.bySeverity?.CRITICAL ?? 0} color="error" />
            <StatCard label={t('anomaly.highSeverity')} value={summary.bySeverity?.HIGH ?? 0} color="warning" />
            <StatCard label={t('dataQualityCenter.resolvedThisWeek')} value={summary.resolvedThisWeek} color="success" />
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
              {t(FILTER_LABEL_KEY[f])}
            </GlassButton>
          ))}
        </div>

        {/* Issues list */}
        <div className="glass-card overflow-hidden">
          {issuesQuery.isLoading ? (
            <div className="p-8"><PageLoader label={t('dataQualityCenter.loading')} /></div>
          ) : issuesQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title={t('dataQualityCenter.loadFailed')}
                message={getErrorMessage(issuesQuery.error)}
                onRetry={() => issuesQuery.refetch()}
              />
            </div>
          ) : issues.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title={t('dataQualityCenter.emptyTitle')}
                message={
                  filter === 'critical'
                    ? t('dataQualityCenter.emptyCritical')
                    : filter === 'unresolved'
                    ? t('dataQualityCenter.emptyUnresolved')
                    : t('dataQualityCenter.empty')
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {issues.map((issue) => (
                <li key={issue.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Badge color={severityColor[issue.severity]}>{t(SEVERITY_LABEL_KEY[issue.severity])}</Badge>
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
                      <span>{formatDate(issue.detectedAt)}</span>
                    </div>
                  </div>
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveMutation.mutate(issue.id)}
                    disabled={!!issue.resolvedAt}
                  >
                    {issue.resolvedAt ? t('dataQualityCenter.resolvedButton') : t('dataQualityCenter.markResolved')}
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
