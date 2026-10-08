import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { notificationsApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { Notification } from '@/lib/types';

function BellIcon({ unread }: { unread: boolean }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />

      {unread && (
        <>
          <circle
            cx="17"
            cy="7"
            r="2.5"
            fill="currentColor"
            stroke="none"
          />
          <circle
            cx="17"
            cy="7"
            r="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity=".35"
            className="animate-pulse-glow"
          />
        </>
      )}
    </svg>
  );
}

function NotificationIcon() {
  return (
    <svg
      className="h-7 w-7"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function EmptyNotifications() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{
          background: 'rgba(148,234,239,.1)',
          color: 'var(--primary)',
        }}
      >
        <NotificationIcon />
      </div>

      <p
        className="text-[15px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        All caught up
      </p>

      <p
        className="mt-1.5 text-[13px]"
        style={{ color: 'var(--text-muted)' }}
      >
        New notifications will appear here
      </p>
    </div>
  );
}

function getAccent(title: string) {
  const normalized = title.toLowerCase();

  if (
    normalized.includes('payment') ||
    normalized.includes('paid') ||
    normalized.includes('invoice')
  ) {
    return {
      color: 'var(--state-success)',
      background: 'rgba(94,230,168,.08)',
    };
  }

  if (
    normalized.includes('attendance') ||
    normalized.includes('absent') ||
    normalized.includes('present')
  ) {
    return {
      color: 'var(--primary)',
      background: 'rgba(84,115,252,.08)',
    };
  }

  if (
    normalized.includes('error') ||
    normalized.includes('failed') ||
    normalized.includes('alert')
  ) {
    return {
      color: 'var(--state-error)',
      background: 'rgba(240,112,112,.08)',
    };
  }

  if (
    normalized.includes('warning') ||
    normalized.includes('reminder')
  ) {
    return {
      color: 'var(--state-warning)',
      background: 'rgba(245,184,106,.08)',
    };
  }

  return {
    color: 'var(--text-secondary)',
    background: 'rgba(148,234,239,.06)',
  };
}

function NotificationItem({
  notification,
  onRead,
  pending,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  pending: boolean;
}) {
  const { t } = useSafeI18n();

  const unread = !notification.isRead;
  const accent = getAccent(notification.title);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (unread) onRead(notification.id);
      }}
      className="group relative flex w-full border-b px-4 py-3.5 text-left transition duration-200 last:border-b-0 hover:translate-x-0.5 disabled:cursor-wait disabled:opacity-60"
      style={{
        borderColor: 'var(--border-subtle)',
        background: unread ? accent.background : 'transparent',
      }}
    >
      {unread && (
        <span
          className="absolute left-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: accent.color }}
          aria-label={t('a11y.unread')}
        />
      )}

      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pl-3">
        <div className="min-w-0">
          <p
            className="truncate text-sm font-semibold"
            style={{
              color: unread
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
            }}
          >
            {notification.title}
          </p>

          <p
            className="mt-1 line-clamp-2 text-[13px] leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {notification.message}
          </p>
        </div>

        <time
          className="shrink-0 pt-0.5 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
        >
          {timeAgo(notification.createdAt)}
        </time>
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(135deg, rgba(148,234,239,.06), transparent 65%)',
        }}
      />
    </button>
  );
}

interface NotificationResponse {
  items: Notification[];
  unread: number;
  total: number;
}

export function NotificationsMenu() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 20 }),
    staleTime: 15_000,
    refetchInterval: open ? 30_000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications'],
      });
    },
    onError: (reason) => {
      setError(getErrorMessage(reason));
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications'],
      });
    },
    onError: (reason) => {
      setError(getErrorMessage(reason));
    },
  });

  const close = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [close, open]);

  const data = notifications.data as NotificationResponse | undefined;
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const hasMore = (data?.total ?? 0) > items.length;

  const toggle = () => {
    setError(null);
    setOpen((value) => !value);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={
          open
            ? 'Close notifications'
            : `Notifications${unread ? `, ${unread} unread` : ''}`
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative rounded-xl p-2 transition duration-200 hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-brand-500/60"
        style={{
          color: open ? 'var(--primary)' : 'var(--text-secondary)',
          background: open
            ? 'rgba(84,115,252,.1)'
            : 'transparent',
        }}
      >
        <BellIcon unread={unread > 0} />

        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{
              background: 'var(--state-error)',
              boxShadow: '0 2px 8px rgba(240,112,112,.4)',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-1.5rem)] origin-top-right animate-glass-dropdown"
          role="dialog"
          aria-label={t('a11y.notifications')}
        >
          <div
            className="relative overflow-hidden rounded-[var(--radius-xl)] border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-glass)',
              backdropFilter: 'blur(28px) saturate(1.7)',
              WebkitBackdropFilter: 'blur(28px) saturate(1.7)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(145deg, rgba(255,255,255,.24), transparent 42%)',
              }}
            />

            <div
              className="relative z-10 flex items-center justify-between border-b px-5 py-4"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <h2
                  className="text-[15px] font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Notifications
                </h2>

                {unread > 0 && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{
                      color: 'var(--primary)',
                      background: 'rgba(84,115,252,.12)',
                    }}
                  >
                    {unread}
                  </span>
                )}
              </div>

              {unread > 0 && (
                <button
                  type="button"
                  disabled={markAllRead.isPending}
                  onClick={() => markAllRead.mutate()}
                  className="text-[13px] font-semibold transition hover:opacity-70 disabled:opacity-50"
                  style={{ color: 'var(--primary)' }}
                >
                  {markAllRead.isPending
                    ? 'Marking…'
                    : 'Mark all read'}
                </button>
              )}
            </div>

            {error && (
              <div
                className="relative z-10 border-b px-4 py-2.5 text-[13px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--state-error)',
                  background: 'rgba(240,112,112,.06)',
                }}
                role="alert"
              >
                {error}
              </div>
            )}

            {notifications.isLoading && (
              <div className="relative z-10 space-y-3 px-4 py-6">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="skeleton-shimmer h-16 rounded-2xl"
                    style={{ animationDelay: `${item * 120}ms` }}
                  />
                ))}
              </div>
            )}

            {!notifications.isLoading && items.length === 0 && (
              <EmptyNotifications />
            )}

            {!notifications.isLoading && items.length > 0 && (
              <ul
                className="relative z-10 max-h-80 overflow-y-auto"
                aria-label={t('notifications.list')}
              >
                {items.map((notification) => (
                  <li key={notification.id}>
                    <NotificationItem
                      notification={notification}
                      onRead={(id) => markRead.mutate(id)}
                      pending={markRead.isPending}
                    />
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <div
                className="relative z-10 border-t px-4 py-2.5 text-center text-[12px]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                Showing {items.length} of {data?.total} notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsMenu;
