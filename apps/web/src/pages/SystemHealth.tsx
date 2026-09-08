import { useQuery } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, EmptyState, StatCard, GlassCard } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';

type ComponentStatus = 'ok' | 'warning' | 'error' | 'down' | 'unknown';

interface SystemComponent {
  name: string;
  status: ComponentStatus;
  responseTime?: number;
  details?: string;
}

interface SystemSummary {
  uptime: number;
  avgResponseTime: number;
  lastIncidentAt?: string;
  totalErrors: number;
}

interface RecentError {
  id: string;
  timestamp: string;
  endpoint: string;
  statusCode: number;
  message?: string;
}

// Map component names to display info
const COMPONENT_LABELS: Record<string, { label: string; description: string }> = {
  api: { label: 'API', description: 'HTTP endpoints /health check' },
  database: { label: 'Database', description: 'PostgreSQL / Prisma ORM' },
  storage: { label: 'Storage', description: 'File storage (S3-compatible)' },
  cache: { label: 'Cache', description: 'Redis in-memory cache' },
  backgroundJobs: { label: 'Background Jobs', description: 'Queue workers / schedulers' },
  notifications: { label: 'Notifications', description: 'Email / push delivery' },
};

const STATUS_BADGE_COLOR: Record<ComponentStatus, 'success' | 'warning' | 'error' | 'muted'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
  down: 'error',
  unknown: 'muted',
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ComponentStatusCard({ name, status, responseTime }: { name: string; status: ComponentStatus; responseTime?: number }) {
  const info = COMPONENT_LABELS[name] ?? { label: name, description: '' };

  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-sm text-[var(--text-primary)]">{info.label}</h4>
          <p className="text-xs text-muted mt-0.5">{info.description}</p>
        </div>
        <Badge color={STATUS_BADGE_COLOR[status]}>
          {status === 'unknown' ? 'Unknown' : status.toUpperCase()}
        </Badge>
      </div>
      {responseTime !== undefined && (
        <div className="text-xs text-muted">
          Response time: <span className="font-mono">{formatResponseTime(responseTime)}</span>
        </div>
      )}
    </div>
  );
}

export function SystemHealthPage() {
  usePageTitle('System Health');

  const summaryQuery = useQuery({
    queryKey: ['system-health-summary'],
    queryFn: () => request('/system-health/summary') as Promise<SystemSummary>,
    retry: 1,
  });

  const componentsQuery = useQuery({
    queryKey: ['system-health-components'],
    queryFn: () =>
      request('/system-health/components') as Promise<{
        components: SystemComponent[];
        recentErrors: RecentError[];
      }>,
    retry: 1,
  });

  const summary = summaryQuery.data;
  const { components = [], recentErrors = [] } = componentsQuery.data ?? {};

  const isLoading = summaryQuery.isLoading || componentsQuery.isLoading;

  // Ensure all required components are present with defaults
  const componentMap = new Map(components.map((c) => [c.name, c]));
  const displayComponents: SystemComponent[] = [
    { name: 'api', status: componentMap.get('api')?.status ?? 'unknown', responseTime: componentMap.get('api')?.responseTime },
    { name: 'database', status: componentMap.get('database')?.status ?? 'unknown' },
    { name: 'storage', status: componentMap.get('storage')?.status ?? 'unknown' },
    { name: 'cache', status: componentMap.get('cache')?.status ?? 'unknown' },
    { name: 'backgroundJobs', status: componentMap.get('backgroundJobs')?.status ?? 'unknown' },
    { name: 'notifications', status: componentMap.get('notifications')?.status ?? 'unknown' },
  ];

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="System Health"
          subtitle="Operational health dashboard — deterministic, rule-based monitoring (no AI)"
        />

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Uptime"
            value={summary?.uptime ? formatUptime(summary.uptime) : '—'}
          />
          <StatCard
            label="Avg response"
            value={summary?.avgResponseTime ? formatResponseTime(summary.avgResponseTime) : '—'}
          />
          <StatCard
            label="Total errors"
            value={summary?.totalErrors ?? 0}
          />
          <StatCard
            label="Last incident"
            value={summary?.lastIncidentAt
              ? new Date(summary.lastIncidentAt).toLocaleDateString()
              : 'None'
            }
          />
        </div>

        {/* Deterministic rules explanation */}
        <GlassCard className="p-4 space-y-2">
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">Monitoring approach</h3>
          <ul className="text-xs space-y-1 text-muted">
            <li>✓ <strong className="text-[var(--text-primary)]">Rule-based checks</strong> — health ping, disk/memory thresholds, job queue depth, delivery receipts</li>
            <li>✓ <strong className="text-[var(--text-primary)]">No anomaly detection</strong> — no ML models, no trained classifiers, no behavioral baselines</li>
            <li>✓ <strong className="text-[var(--text-primary)]">No AI/ML monitoring</strong> — purely deterministic thresholds and binary ok/warn/error states</li>
            <li>✓ <strong className="text-[var(--text-primary)]">Transparent rules</strong> — every status is derived from a fixed condition you can audit</li>
          </ul>
        </GlassCard>

        {/* Component status grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {displayComponents.map((component) => (
            <ComponentStatusCard
              key={component.name}
              name={component.name}
              status={component.status}
              responseTime={component.responseTime}
            />
          ))}
        </div>

        {/* Recent errors */}
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Recent errors</h3>
          </div>
          {isLoading ? (
            <div className="p-8"><PageLoader label="Loading system status…" /></div>
          ) : recentErrors.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No recent errors"
                message="No errors recorded in the recent window. All systems operating normally."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {recentErrors.map((error) => (
                <li key={error.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Badge color={error.statusCode >= 500 ? 'error' : 'warning'}>
                      {error.statusCode}
                    </Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{error.endpoint}</span>
                      {error.message && (
                        <>
                          <span>·</span>
                          <span className="truncate">{error.message}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(error.timestamp).toLocaleString()}</span>
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
