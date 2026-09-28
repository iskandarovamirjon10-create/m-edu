import { useQuery } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassStatCard, GlassCard } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

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
const COMPONENT_LABELS: Record<string, { labelKey: string; descriptionKey: string }> = {
  api: { labelKey: 'systemHealth.component.api', descriptionKey: 'systemHealth.component.apiDesc' },
  database: { labelKey: 'systemHealth.component.database', descriptionKey: 'systemHealth.component.databaseDesc' },
  storage: { labelKey: 'systemHealth.component.storage', descriptionKey: 'systemHealth.component.storageDesc' },
  cache: { labelKey: 'systemHealth.component.cache', descriptionKey: 'systemHealth.component.cacheDesc' },
  backgroundJobs: { labelKey: 'systemHealth.component.backgroundJobs', descriptionKey: 'systemHealth.component.backgroundJobsDesc' },
  notifications: { labelKey: 'systemHealth.component.notifications', descriptionKey: 'systemHealth.component.notificationsDesc' },
};

const STATUS_BADGE_COLOR: Record<ComponentStatus, 'success' | 'warning' | 'error' | 'muted'> = {
  ok: 'success',
  warning: 'warning',
  error: 'error',
  down: 'error',
  unknown: 'muted',
};

const STATUS_LABEL_KEYS: Record<ComponentStatus, string> = {
  ok: 'systemHealth.status.ok',
  warning: 'systemHealth.status.warning',
  error: 'systemHealth.status.error',
  down: 'systemHealth.status.down',
  unknown: 'common.unknown',
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
  const { t } = useI18n();
  const info = COMPONENT_LABELS[name] ?? { labelKey: '', descriptionKey: '' };

  return (
    <div className="glass-card p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-sm text-[var(--text-primary)]">{info.labelKey ? t(info.labelKey) : name}</h4>
          <p className="text-xs text-muted mt-0.5">{info.descriptionKey ? t(info.descriptionKey) : ''}</p>
        </div>
        <GlassBadge color={STATUS_BADGE_COLOR[status]}>
          {t(STATUS_LABEL_KEYS[status])}
        </GlassBadge>
      </div>
      {responseTime !== undefined && (
        <div className="text-xs text-muted">
          {t('systemHealth.responseTime')} <span className="font-mono">{formatResponseTime(responseTime)}</span>
        </div>
      )}
    </div>
  );
}

export function SystemHealthPage() {
  const { t } = useI18n();
  usePageTitle(t('systemHealth.title'));

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
  const isError = summaryQuery.isError || componentsQuery.isError;
  const error = summaryQuery.error ?? componentsQuery.error;
  const refetch = () => {
    if (summaryQuery.isError) summaryQuery.refetch();
    if (componentsQuery.isError) componentsQuery.refetch();
  };

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
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('systemHealth.title')}
          subtitle={t('systemHealth.subtitle')}
        />

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassStatCard
            label={t('systemHealth.uptime')}
            value={summary?.uptime ? formatUptime(summary.uptime) : '—'}
          />
          <GlassStatCard
            label={t('systemHealth.avgResponse')}
            value={summary?.avgResponseTime ? formatResponseTime(summary.avgResponseTime) : '—'}
          />
          <GlassStatCard
            label={t('systemHealth.totalErrors')}
            value={summary?.totalErrors ?? 0}
          />
          <GlassStatCard
            label={t('systemHealth.lastIncident')}
            value={summary?.lastIncidentAt
              ? new Date(summary.lastIncidentAt).toLocaleDateString()
              : t('systemHealth.noIncident')
            }
          />
        </div>

        {/* Deterministic rules explanation */}
        <GlassCard className="p-4 space-y-2">
          <h3 className="font-semibold text-sm text-[var(--text-primary)]">{t('systemHealth.approachTitle')}</h3>
          <ul className="text-xs space-y-1 text-muted">
            <li>✓ <strong className="text-[var(--text-primary)]">{t('systemHealth.ruleBased')}</strong> — {t('systemHealth.ruleBasedDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('systemHealth.noAnomaly')}</strong> — {t('systemHealth.noAnomalyDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('systemHealth.noAiMl')}</strong> — {t('systemHealth.noAiMlDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('systemHealth.transparentRules')}</strong> — {t('systemHealth.transparentRulesDesc')}</li>
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
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">{t('systemHealth.recentErrors')}</h3>
          </div>
          {isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('systemHealth.loading')} /></div>
          ) : isError ? (
            <div className="p-8">
              <GlassErrorState
                message={getErrorMessage(error)}
                onRetry={refetch}
              />
            </div>
          ) : recentErrors.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('systemHealth.noErrors')}
                message={t('systemHealth.noErrorsHint')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {recentErrors.map((error) => (
                <li key={error.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <GlassBadge color={error.statusCode >= 500 ? 'error' : 'warning'}>
                      {error.statusCode}
                    </GlassBadge>
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
