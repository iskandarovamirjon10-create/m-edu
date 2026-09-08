import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader,
  Badge,
  PageLoader,
  EmptyState,
  ErrorState,
  GlassButton,
} from '@/components/ui';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useToast } from '@/components/ui/GlassToast';
import { notificationsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';

interface AppNotification {
  id: string;
  kind: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const KIND_COLOR: Record<AppNotification['kind'], 'muted' | 'success' | 'warning' | 'error'> = {
  INFO: 'muted',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export function NotificationsCenterPage() {
  usePageTitle('Notifications');
  const queryClient = useQueryClient();
  const { push } = useToast();

  const listQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list() as Promise<{ items: AppNotification[]; unread: number }>,
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      push('success', 'All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (e) => push('error', getErrorMessage(e)),
  });

  const items: AppNotification[] = (listQuery.data as any)?.items ?? [];
  const unread = (listQuery.data as any)?.unread ?? 0;

  return (
    <div className="orb-container">
      <div className="orb orb-cyan-1" />
      <div className="orb orb-indigo-1" />
      <div className="page-container space-y-4">
        <PageHeader
          title="Notifications"
          subtitle="System, workflow, and rule-based alerts"
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </div>
          <GlassButton
            size="sm"
            variant="ghost"
            onClick={() => markAllMutation.mutate()}
            disabled={unread === 0 || markAllMutation.isPending}
          >
            Mark all as read
          </GlassButton>
        </div>

        <div className="glass-card p-4 space-y-2">
          <h3 className="font-semibold text-[var(--text-primary)]">Notification sources</h3>
          <ul className="text-sm space-y-1.5 text-muted">
            <li>• <strong className="text-[var(--text-primary)]">Workflow engine</strong> — rule match triggers a notification</li>
            <li>• <strong className="text-[var(--text-primary)]">Early warning</strong> — payment overdue, attendance threshold, etc.</li>
            <li>• <strong className="text-[var(--text-primary)]">Data quality</strong> — new issue, issue resolved</li>
            <li>• <strong className="text-[var(--text-primary)]">Audit anomalies</strong> — security center pushes critical events</li>
            <li>• <strong className="text-[var(--text-primary)]">System</strong> — backup, version, scheduled job results</li>
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          {listQuery.isLoading ? (
            <div className="p-8"><PageLoader label="Loading notifications…" /></div>
          ) : listQuery.isError ? (
            <div className="p-8">
              <ErrorState
                title="Failed to load notifications"
                message={getErrorMessage(listQuery.error)}
                onRetry={() => listQuery.refetch()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No notifications"
                message="You're all caught up. New events will appear here."
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
                  <Badge color={KIND_COLOR[n.kind]}>{n.kind}</Badge>
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
                          <a href={n.link} className="text-brand-500 hover:underline">Open</a>
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
                      Mark read
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
