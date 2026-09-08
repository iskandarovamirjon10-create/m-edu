import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader, Badge, PageLoader, ErrorState, EmptyState, GlassButton, GlassStatCard } from '@/components/ui';
import { useToast } from '@/components/ui/GlassToast';
import { securityApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';

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

const SEVERITY_COLOR: Record<SecurityAlert['severity'], 'success' | 'warning' | 'error' | 'primary' | 'muted'> = {
  INFO: 'muted',
  LOW: 'muted',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
};

export function SecurityCenterPage() {
  usePageTitle('Security Center');
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'new' | 'critical'>('new');

  const toast = useToast();

  const summaryQuery = useQuery({
    queryKey: ['security-summary'],
    queryFn: () => securityApi.summary() as Promise<Record<string, any>>,
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
      return securityApi.alerts(params) as Promise<{ items: SecurityAlert[]; total: number }>;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => securityApi.resolve(id),
    onSuccess: () => {
      toast.success('Alert resolved');
      queryClient.invalidateQueries({ queryKey: ['security-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['security-summary'] });
    },
    onError: (e) => toast.error('Could not resolve alert', getErrorMessage(e)),
  });

  const alerts: SecurityAlert[] = (alertsQuery.data as any)?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Security Center"
          subtitle="Login attempts, suspicious activity, brute-force protection, audit anomalies"
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassStatCard label="Risk score" value={`${summary?.riskScore ?? 0}/100`} />
          <GlassStatCard label="Alerts this week" value={summary?.detectedThisWeek ?? 0} />
          <GlassStatCard label="Critical" value={summary?.bySeverity?.CRITICAL ?? 0} />
          <GlassStatCard label="Resolved this week" value={summary?.resolvedThisWeek ?? 0} />
        </div>

        {/* Security feature toggles (read-only display, since UI-only) */}
        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Active protections</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>✓ <strong className="text-[var(--text-primary)]">Rate limiting</strong> — 100 req/min per user (auth endpoints tighter)</li>
            <li>✓ <strong className="text-[var(--text-primary)]">JWT authentication</strong> — short-lived tokens, server-side verification</li>
            <li>✓ <strong className="text-[var(--text-primary)]">Google OAuth 2.0</strong> — standard OAuth flow with PKCE</li>
            <li>✓ <strong className="text-[var(--text-primary)]">RBAC</strong> — 6-role permission system with role guards</li>
            <li>✓ <strong className="text-[var(--text-primary)]">Tenant isolation</strong> — every query scoped to organizationId</li>
            <li>✓ <strong className="text-[var(--text-primary)]">Prisma ORM</strong> — parameterised queries (SQL injection-safe)</li>
            <li>✓ <strong className="text-[var(--text-primary)]">class-validator</strong> — strict DTO validation, rejects unknown fields</li>
            <li>✓ <strong className="text-[var(--text-primary)]">CSRF / CORS</strong> — restricted origins, credentials only for same-origin</li>
            <li>✓ <strong className="text-[var(--text-primary)]">Helmet</strong> — secure HTTP headers (HSTS, X-Content-Type-Options, etc.)</li>
            <li>✓ <strong className="text-[var(--text-primary)]">Password hashing</strong> — bcrypt, configurable cost factor</li>
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
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </GlassButton>
          ))}
        </div>

        {/* Alerts list */}
        <div className="glass-card overflow-hidden">
          {alertsQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading security alerts…" /></div>
          ) : alertsQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load security alerts"
                message={getErrorMessage(alertsQuery.error)}
                onRetry={() => alertsQuery.refetch()}
              />
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No security alerts"
                message="No suspicious activity detected. Your account is secure."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {alerts.map((alert) => (
                <li key={alert.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    <Badge color={SEVERITY_COLOR[alert.severity]}>{alert.severity}</Badge>
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
                    {alert.status === 'RESOLVED' ? 'Resolved' : 'Mark resolved'}
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
