import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton, GlassStatCard } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import request from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

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

const SEVERITY_LABEL_KEY: Record<EarlyWarning['severity'], string> = {
  LOW: 'anomaly.lowSeverity',
  MEDIUM: 'anomaly.mediumSeverity',
  HIGH: 'anomaly.highSeverity',
  CRITICAL: 'earlyWarning.critical',
};

interface EarlyWarningSummary {
  open: number;
  critical: number;
  high: number;
  resolvedThisWeek: number;
  total: number;
}

export function EarlyWarningPage() {
  const { t } = useI18n();
  usePageTitle(t('earlyWarning.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();

  const summaryQuery = useQuery({
    queryKey: ['early-warning-summary'],
    queryFn: () => request('/early-warning/summary') as Promise<EarlyWarningSummary>,
  });

  const warningsQuery = useQuery({
    queryKey: ['early-warnings'],
    queryFn: () => request('/early-warning') as Promise<{ items: EarlyWarning[]; total: number }>,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => request(`/early-warning/${id}/resolve`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      push('success', t('earlyWarning.resolved'));
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const scanMutation = useMutation({
    mutationFn: () => request('/early-warning/scan', { method: 'POST' }) as Promise<{ created?: number }>,
    onSuccess: (data) => {
      push('success', t('earlyWarning.scanComplete', { n: data?.created ?? 0 }));
      queryClient.invalidateQueries({ queryKey: ['early-warnings'] });
      queryClient.invalidateQueries({ queryKey: ['early-warning-summary'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const warnings: EarlyWarning[] = warningsQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('earlyWarning.title')}
          subtitle={t('earlyWarning.subtitle')}
        />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassStatCard label={t('earlyWarning.open')} value={summary?.open ?? 0} />
          <GlassStatCard label={t('earlyWarning.critical')} value={summary?.critical ?? 0} />
          <GlassStatCard label={t('anomaly.highSeverity')} value={summary?.high ?? 0} />
          <GlassStatCard label={t('earlyWarning.resolvedThisWeek')} value={summary?.resolvedThisWeek ?? 0} />
          <GlassStatCard label={t('earlyWarning.totalDetected')} value={summary?.total ?? 0} />
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('earlyWarning.rulesTitle')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('earlyWarning.rule.paymentOverdue')}</strong> — {t('earlyWarning.rule.paymentOverdueDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('earlyWarning.rule.attendance')}</strong> {t('earlyWarning.rule.attendanceDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('earlyWarning.rule.absences')}</strong> — {t('earlyWarning.rule.absencesDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('earlyWarning.rule.leadStale')}</strong> — {t('earlyWarning.rule.leadStaleDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('earlyWarning.rule.gradeDrop')}</strong> — {t('earlyWarning.rule.gradeDropDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('earlyWarning.rule.scheduleConflict')}</strong> — {t('earlyWarning.rule.scheduleConflictDesc')}</li>
          </ul>
        </div>

        <div className="flex justify-end">
          <GlassButton
            variant="primary"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? t('anomaly.loading') : t('earlyWarning.runScan')}
          </GlassButton>
        </div>

        <div className="glass-card overflow-hidden">
          {warningsQuery.isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('earlyWarning.loading')} /></div>
          ) : warningsQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('earlyWarning.loadFailed')}
                message={getErrorMessage(warningsQuery.error)}
                onRetry={() => warningsQuery.refetch()}
              />
            </div>
          ) : warnings.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('earlyWarning.emptyTitle')}
                message={t('earlyWarning.emptyMessage')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {warnings.map((w) => (
                <li key={w.id} className="px-4 py-3 flex items-start gap-3">
                  <GlassBadge color={SEVERITY_COLOR[w.severity]}>{t(SEVERITY_LABEL_KEY[w.severity])}</GlassBadge>
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
                    {t('earlyWarning.markResolved')}
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
