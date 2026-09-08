import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  EmptyState,
  ErrorState,
  GlassButton,
  GlassStatCard,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';

interface EarlyWarning {
  id: string;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  entityType: string;
  entityId: string;
  detectedAt: string;
  resolved: boolean;
}

const SEVERITY_COLOR: Record<EarlyWarning['severity'], 'muted' | 'primary' | 'warning' | 'error'> = {
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

export function EarlyWarningPage() {
  usePageTitle('Early Warning System');
  const queryClient = useQueryClient();
  const { push } = useToast();

  const summaryQuery = useQuery({
    queryKey: ['early-warning-summary'],
    queryFn: () => request('/early-warning/summary') as Promise<Record<string, any>>,
  });

  const warningsQuery = useQuery({
    queryKey: ['early-warnings'],
    queryFn: () => request('/early-warning') as Promise<{ items: EarlyWarning[]; total: number }>,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => request(`/early-warning/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      push('success', 'Warning resolved');
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const scanMutation = useMutation({
    mutationFn: () => request('/early-warning/scan', { method: 'POST' }) as Promise<{ created?: number }>,
    onSuccess: (data) => {
      push('success', `Scan complete: ${data?.created ?? 0} new warnings`);
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const warnings: EarlyWarning[] = (warningsQuery.data as any)?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Early Warning System"
          subtitle="Rule-based, deterministic monitoring — no AI predictions"
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassStatCard label="Open" value={summary?.open ?? 0} />
          <GlassStatCard label="Critical" value={summary?.critical ?? 0} />
          <GlassStatCard label="High" value={summary?.high ?? 0} />
          <GlassStatCard label="Resolved this week" value={summary?.resolvedThisWeek ?? 0} />
          <GlassStatCard label="Total detected" value={summary?.total ?? 0} />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Monitored rules (deterministic)</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Payment overdue &gt; 7 days</strong> — student flagged on first unpaid invoice past grace</li>
            <li>• <strong className="text-[var(--text-primary)]">Attendance &lt; 70%</strong> in last 14 days — threshold-based, no prediction</li>
            <li>• <strong className="text-[var(--text-primary)]">3+ consecutive absences</strong> — exact run-length, not a model</li>
            <li>• <strong className="text-[var(--text-primary)]">Lead stale &gt; 14 days</strong> — last activity outside the SLA window</li>
            <li>• <strong className="text-[var(--text-primary)]">Grade average drop &gt; 15 points</strong> — comparing current vs. previous term, exact delta</li>
            <li>• <strong className="text-[var(--text-primary)]">Schedule conflict</strong> — overlapping bookings on a resource</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <GlassButton
            variant="primary"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? 'Scanning…' : 'Run scan now'}
          </GlassButton>
        </div>

        <div className="glass-card overflow-hidden">
          {warningsQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading warnings…" /></div>
          ) : warningsQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load warnings"
                message={getErrorMessage(warningsQuery.error)}
                onRetry={() => warningsQuery.refetch()}
              />
            </div>
          ) : warnings.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No active warnings"
                message="All monitored rules are within their thresholds."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {warnings.map((w) => (
                <li key={w.id} className="px-4 py-3 flex items-start gap-3">
                  <Badge color={SEVERITY_COLOR[w.severity]}>{w.severity}</Badge>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-[var(--text-primary)]">{w.title}</h4>
                    <p className="text-xs text-muted mt-0.5">{w.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span className="font-mono">{w.rule}</span>
                      <span>·</span>
                      <span>{w.entityType}</span>
                      <span>·</span>
                      <span>{new Date(w.detectedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveMutation.mutate(w.id)}
                    disabled={resolveMutation.isPending}
                  >
                    Mark resolved
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
