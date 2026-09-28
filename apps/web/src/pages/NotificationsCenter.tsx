import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GlassPageHeader, GlassBadge, GlassPageLoader, GlassEmptyState, GlassErrorState, GlassButton } from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { notificationsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import { getErrorMessage } from '@/lib/errorMessages';
import { useI18n } from '@/i18n/I18nProvider';

interface AppNotification {
  id: string;
  kind: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsListResponse {
  items: AppNotification[];
  unread: number;
}

const KIND_COLOR: Record<AppNotification['kind'], 'muted' | 'success' | 'warning' | 'error'> = {
  INFO: 'muted',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export function NotificationsCenterPage() {
  const { t } = useI18n();
  usePageTitle(t('notifications.title'));
  const queryClient = useQueryClient();
  const { push } = useToast();

  const listQuery = useQuery({
    queryKey: queryKeys.notifications.all(),
    queryFn: () => notificationsApi.list() as Promise<{ items: AppNotification[]; unread: number }>,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      push('success', t('notifications.allReadToast'));
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const items: AppNotification[] = (listQuery.data as NotificationsListResponse | undefined)?.items ?? [];
  const unread = (listQuery.data as NotificationsListResponse | undefined)?.unread ?? 0;

  return (
    <div style={{ display: "contents" }}>
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <GlassPageHeader
          title={t('notifications.title')}
          subtitle={t('notifications.subtitle')}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            {unread > 0 ? t('notifications.unreadCount', { n: unread }) : t('notifications.allCaughtUp')}
          </div>
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={() => markAllMutation.mutate()}
            disabled={unread === 0 || markAllMutation.isPending}
          >
            {t('notifications.markAllRead')}
          </GlassButton>
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">{t('notifications.sourcesTitle')}</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">{t('notifications.sourceWorkflow')}</strong> — {t('notifications.sourceWorkflowDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('notifications.sourceEarlyWarning')}</strong> — {t('notifications.sourceEarlyWarningDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('notifications.sourceDataQuality')}</strong> — {t('notifications.sourceDataQualityDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('notifications.sourceAudit')}</strong> — {t('notifications.sourceAuditDesc')}</li>
            <li>• <strong className="text-[var(--text-primary)]">{t('notifications.sourceSystem')}</strong> — {t('notifications.sourceSystemDesc')}</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {listQuery.isLoading ? (
            <div className="p-8"><GlassPageLoader label={t('notifications.loading')} /></div>
          ) : listQuery.isError ? (
            <div className="p-8">
              <GlassErrorState
                title={t('notifications.loadError')}
                message={getErrorMessage(listQuery.error)}
                onRetry={() => listQuery.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <GlassEmptyState
                title={t('notifications.empty')}
                message={t('notifications.emptyHint')}
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={[
                    'px-4 py-3 flex items-start gap-3',
                    !n.read ? 'bg-brand-500/5' : '',
                  ].join(' ')}
                >
                  <GlassBadge color={KIND_COLOR[n.kind]}>{n.kind}</GlassBadge>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-[var(--text-primary)]">
                      {!n.read && <span className="inline-block h-2 w-2 rounded-full bg-brand-500 mr-2 align-middle" />}
                      {n.title}
                    </h4>
                    <p className="text-xs text-muted mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      <span>{new Date(n.createdAt).toLocaleString()}</span>
                      {n.link && (
                        <>
                          <span>·</span>
                          <a href={n.link} className="text-brand-500 hover:underline">{t('notifications.open')}</a>
                        </>
                      )}
                    </div>
                  </div>
                  {!n.read && (
                    <GlassButton
                      size="sm"
                      variant="ghost"
                      onClick={() => markOneMutation.mutate(n.id)}
                      disabled={markOneMutation.isPending}
                    >
                      {t('notifications.markRead')}
                    </GlassButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
