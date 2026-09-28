import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassErrorState, GlassEmptyState, GlassButton, GlassStatCard } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { securityApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

interface SecurityAlert {
  id: string;
  type: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  title: string;
  message: string;
  actorName?: string;
  ipAddress?: string;
  detectedAt: string;
}

interface SecuritySummary {
  riskScore?: number;
  detectedThisWeek?: number;
  resolvedThisWeek?: number;
  bySeverity?: Partial<Record<SecurityAlert['severity'], number>>;
}

interface SecurityAlertsResponse {
  items: SecurityAlert[];
  total: number;
}

const SEVERITY_COLOR: Record<SecurityAlert['severity'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  INFO: 'muted',
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

const SEVERITY_LABEL_KEYS: Record<SecurityAlert['severity'], string> = {
  INFO: 'security.severity.INFO',
  LOW: 'security.severity.LOW',
  MEDIUM: 'security.severity.MEDIUM',
  HIGH: 'security.severity.HIGH',
  CRITICAL: 'security.severity.CRITICAL',
};

const FILTER_LABEL_KEYS: Record<'all' | 'new' | 'critical', string> = {
  all: 'security.filter.all',
  new: 'security.filter.new',
  critical: 'security.filter.critical',
};

export function SecurityCenterPage() {
  const { t } = useI18n();
  usePageTitle(t('security.title'));
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'new' | 'critical'>('new');

  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ['security-summary'],
    queryFn: () => securityApi.summary() as Promise<SecuritySummary>,
  });

  const alertsQuery = useQuery({
    queryKey: ['security-alerts', filter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filter === 'new') params.status = 'NEW';
      if (filter === 'critical') {
        params.severity = 'CRITICAL';
        params.status = 'NEW';
      }
      return securityApi.alerts(params) as Promise<SecurityAlertsResponse>;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => securityApi.resolve(id),
    onSuccess: () => {
      toast.success(t('security.resolvedToast'));
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-summary'] });
    },
    onError: (e) => toast.error(t('security.resolveError'), getErrorMessage(e)),
  });

  const alerts: SecurityAlert[] = (alertsQuery.data as SecurityAlertsResponse | undefined)?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('security.title')}
          subtitle={t('security.subtitle')}
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassStatCard label={t('security.riskScore')} value={`${summary?.riskScore ?? 0}/100`} />
          <GlassStatCard label={t('security.alertsThisWeek')} value={summary?.detectedThisWeek ?? 0} />
          <GlassStatCard label={t('security.critical')} value={summary?.bySeverity?.CRITICAL ?? 0} />
          <GlassStatCard label={t('security.resolvedThisWeek')} value={summary?.resolvedThisWeek ?? 0} />
        </div>

        {/* Security feature toggles (read-only display, since UI-only) */}
        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('security.protection.title')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.rateLimiting')}</strong> — {t('security.protection.rateLimitingDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.jwt')}</strong> — {t('security.protection.jwtDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.oauth')}</strong> — {t('security.protection.oauthDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.rbac')}</strong> — {t('security.protection.rbacDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.tenantIsolation')}</strong> — {t('security.protection.tenantIsolationDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.prisma')}</strong> — {t('security.protection.prismaDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.validation')}</strong> — {t('security.protection.validationDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.csrf')}</strong> — {t('security.protection.csrfDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.helmet')}</strong> — {t('security.protection.helmetDesc')}</li>
            <li>✓ <strong className="text-[var(--text-primary)]">{t('security.protection.passwordHashing')}</strong> — {t('security.protection.passwordHashingDesc')}</li>
          </ul>
        </div>

        {/* Filter tabs */}
        <div className="glass-card p-3 flex gap-2">
          {(['new', 'critical', 'all'] as const).map((f) => (
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

        {/* Alerts list */}
        <div className="glass-card overflow-hidden">
          {alertsQuery.isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('security.loading')} /></div>
          ) : alertsQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('security.loadError')}
                message={getErrorMessage(alertsQuery.error)}
                onRetry={() => alertsQuery.refetch()}
              />
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('security.empty')}
                message={t('security.emptyHint')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {alerts.map((alert) => (
                <li key={alert.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <GlassBadge color={SEVERITY_COLOR[alert.severity]}>{t(SEVERITY_LABEL_KEYS[alert.severity])}</GlassBadge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-[var(--text-primary)]">{alert.title}</h4>
                    <p className="text-xs text-muted mt-0.5">{alert.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span className="font-mono">{alert.type}</span>
                      {alert.actorName && (
                        <>
                          <span>·</span>
                          <span>{alert.actorName}</span>
                        </>
                      )}
                      {alert.ipAddress && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{alert.ipAddress}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{new Date(alert.detectedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <GlassButton
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveMutation.mutate(alert.id)}
                    disabled={alert.status === 'RESOLVED'}
                  >
                    {alert.status === 'RESOLVED' ? t('security.resolved') : t('security.markResolved')}
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
