import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  BellOff,
  CheckCheck,
  CreditCard,
  CalendarCheck,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Clock,
  ArrowUpRight,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { notificationsApi } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import type { Notification } from '@/lib/types';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Spring Dynamics & Tokens                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

const SPRING_APPLE = {
  type: 'spring',
  stiffness: 420,
  damping: 30,
  mass: 0.85,
} as const;

interface CategoryConfig {
  icon: LucideIcon;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

function getNotificationCategory(title: string, message?: string): CategoryConfig {
  const text = `${title} ${message || ''}`.toLowerCase();

  if (text.includes('payment') || text.includes('to\'lov') || text.includes('to\'lov') || text.includes('kassa') || text.includes('invoice') || text.includes('haq')) {
    return {
      icon: CreditCard,
      badgeBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
      badgeBorder: 'border-emerald-500/25',
    };
  }

  if (text.includes('attendance') || text.includes('davomat') || text.includes('dars') || text.includes('absent') || text.includes('late')) {
    return {
      icon: CalendarCheck,
      badgeBg: 'bg-[#2563EB]/10 dark:bg-[#0A84FF]/20',
      badgeText: 'text-[#2563EB] dark:text-[#0A84FF]',
      badgeBorder: 'border-[#2563EB]/25 dark:border-[#0A84FF]/30',
    };
  }

  if (text.includes('error') || text.includes('failed') || text.includes('xato') || text.includes('buzilish') || text.includes('xavf')) {
    return {
      icon: ShieldAlert,
      badgeBg: 'bg-[#EF4444]/10 dark:bg-[#FF453A]/20',
      badgeText: 'text-[#EF4444] dark:text-[#FF453A]',
      badgeBorder: 'border-[#EF4444]/25 dark:border-[#FF453A]/30',
    };
  }

  if (text.includes('warning') || text.includes('reminder') || text.includes('ogohlantirish') || text.includes('muddati') || text.includes('qarzdor')) {
    return {
      icon: AlertTriangle,
      badgeBg: 'bg-amber-500/10 dark:bg-amber-500/20',
      badgeText: 'text-amber-600 dark:text-amber-400',
      badgeBorder: 'border-amber-500/25 dark:border-amber-500/30',
    };
  }

  return {
    icon: Sparkles,
    badgeBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    badgeText: 'text-indigo-600 dark:text-indigo-400',
    badgeBorder: 'border-indigo-500/25 dark:border-indigo-500/30',
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Notification Item                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

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
  const category = useMemo(
    () => getNotificationCategory(notification.title, notification.message),
    [notification.title, notification.message]
  );
  const Icon = category.icon;

  return (
    <motion.button
      type="button"
      layout
      disabled={pending}
      onClick={() => {
        if (unread) onRead(notification.id);
      }}
      className={[
        'group relative flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-all duration-150',
        'border-b border-black/[0.05] dark:border-white/[0.06] last:border-b-0',
        unread
          ? 'bg-[#2563EB]/[0.035] dark:bg-[#0A84FF]/[0.06] hover:bg-[#2563EB]/[0.06] dark:hover:bg-[#0A84FF]/[0.09]'
          : 'bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
        'disabled:cursor-wait disabled:opacity-60',
      ].join(' ')}
    >
      {/* Category Icon Squircle */}
      <div
        className={[
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border transition-transform duration-200 group-hover:scale-105',
          category.badgeBg,
          category.badgeText,
          category.badgeBorder,
        ].join(' ')}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Text Body */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={[
              'truncate text-[13px] tracking-tight',
              unread
                ? 'font-semibold text-slate-900 dark:text-white'
                : 'font-medium text-slate-700 dark:text-slate-300',
            ].join(' ')}
          >
            {notification.title}
          </p>

          <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
            <Clock className="h-3 w-3 opacity-60" />
            {timeAgo(notification.createdAt)}
          </span>
        </div>

        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-slate-700 dark:text-slate-300">
          {notification.message}
        </p>
      </div>

      {/* Unread Indicator Dot */}
      {unread && (
        <span
          className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"
          aria-label={t('a11y.unread') || 'Unread'}
        />
      )}
    </motion.button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Empty State                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function EmptyNotifications({ filter }: { filter: 'all' | 'unread' }) {
  const { t } = useSafeI18n();

  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] text-slate-400 dark:text-slate-500 shadow-inner">
        <BellOff className="h-6 w-6 stroke-[1.5]" />
      </div>

      <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
        {filter === 'unread'
          ? (t('notifications.allCaughtUp') || "Barcha bildirishnomalar o'qilgan")
          : (t('notifications.empty') || "Bildirishnomalar yo'q")}
      </p>

      <p className="mt-1 max-w-[220px] text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
        {filter === 'unread'
          ? (t('notifications.allCaughtUpHint') || "Yangi o'qilmagan xabarlar yo'q.")
          : (t('notifications.emptyHint') || 'Yangi bildirishnomalar kelganda shu yerda ko\'rinadi.')}
      </p>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main NotificationsMenu                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

interface NotificationResponse {
  items: Notification[];
  unread: number;
  total: number;
}

export function NotificationsMenu() {
  const { t } = useSafeI18n();
  const queryClient = useQueryClient();
  const { playPop, playTick, playSuccess } = usePremiumSound();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list({ limit: 30 }),
    staleTime: 15_000,
    refetchInterval: open ? 30_000 : false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onMutate: () => {
      playTick();
    },
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
    onMutate: () => {
      playSuccess();
    },
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
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
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
  const allItems = data?.items ?? [];
  const unreadCount = data?.unread ?? 0;

  const displayedItems = useMemo(() => {
    if (filter === 'unread') {
      return allItems.filter((item) => !item.isRead);
    }
    return allItems;
  }, [allItems, filter]);

  const toggle = () => {
    setError(null);
    playPop();
    setOpen((prev) => !prev);
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Bell Trigger Button */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={
          open
            ? (t('common.close') || 'Close')
            : `${t('nav.notifications') || 'Notifications'}${unreadCount ? `, ${unreadCount} unread` : ''}`
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          'relative flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 outline-none',
          open
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
            : 'text-slate-600 dark:text-slate-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-white',
          'focus-visible:ring-2 focus-visible:ring-blue-500/60',
        ].join(' ')}
      >
        <Bell className="h-5 w-5 stroke-[1.8]" />

        {/* Unread Pill Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm tabular-nums ring-2 ring-white dark:ring-[#121623]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Popover Card */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={SPRING_APPLE}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 z-50 mt-2 w-[380px] max-w-[calc(100vw-1.5rem)]"
            role="dialog"
            aria-label={t('nav.notifications') || 'Notifications'}
          >
            <div
              className={[
                'relative overflow-hidden rounded-[1.5rem] border',
                'border-black/[0.08] dark:border-white/[0.12]',
                'bg-white/95 dark:bg-[#131622]/95',
                'shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_0_0_0.5px_rgba(0,0,0,0.04),0_24px_64px_-16px_rgba(0,0,0,0.28)]',
                'dark:shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_0_0_0.5px_rgba(255,255,255,0.05),0_28px_72px_-16px_rgba(0,0,0,0.75)]',
                'backdrop-blur-md backdrop-saturate-150',
              ].join(' ')}
            >
              {/* Apple Specular Top Sheen */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/20 to-transparent dark:from-white/[0.06]"
              />

              {/* Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                    {t('nav.notifications') || 'Bildirishnomalar'}
                  </h2>

                  {unreadCount > 0 && (
                    <span className="flex h-5 items-center justify-center rounded-full bg-[#2563EB]/15 px-2 text-[10px] font-bold text-[#2563EB] tabular-nums">
                      {unreadCount} {t('notifications.unread') || 'yangi'}
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    disabled={markAllRead.isPending}
                    onClick={() => markAllRead.mutate()}
                    className="group flex items-center gap-1.5 text-[12px] font-semibold text-[#2563EB] transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {markAllRead.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                    )}
                    <span>{t('notifications.markAllRead') || 'Barchasini o\'qish'}</span>
                  </button>
                )}
              </div>

              {/* Filter Tabs (Segmented Controller) */}
              <div className="relative z-10 flex border-b border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2">
                <div className="flex w-full rounded-xl bg-black/[0.04] dark:bg-white/[0.07] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      playTick();
                      setFilter('all');
                    }}
                    className={[
                      'relative flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all duration-150',
                      filter === 'all'
                        ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                    ].join(' ')}
                  >
                    {t('common.all') || 'Barchasi'} ({allItems.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playTick();
                      setFilter('unread');
                    }}
                    className={[
                      'relative flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all duration-150',
                      filter === 'unread'
                        ? 'bg-white dark:bg-[#2C2C2E] text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white',
                    ].join(' ')}
                  >
                    {t('notifications.unread') || 'O\'qilmagan'} ({unreadCount})
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  className="relative z-10 border-b border-[#EF4444]/20 bg-[#EF4444]/10 px-4 py-2.5 text-[12px] font-medium text-[#EF4444]"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {/* Loading Skeleton */}
              {notifications.isLoading && (
                <div className="relative z-10 space-y-2.5 p-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl p-2 animate-pulse"
                    >
                      <div className="h-9 w-9 rounded-[11px] bg-slate-200 dark:bg-white/10" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-white/10" />
                        <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-white/5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error State */}
              {!notifications.isLoading && notifications.isError && allItems.length === 0 && (
                <div className="px-4 py-10 text-center text-xs text-slate-400">
                  {t('notifications.loadError') || 'Bildirishnomalarni yuklab bo\'lmadi.'}
                </div>
              )}

              {/* Empty State */}
              {!notifications.isLoading && displayedItems.length === 0 && (
                <EmptyNotifications filter={filter} />
              )}

              {/* Items List */}
              {!notifications.isLoading && displayedItems.length > 0 && (
                <ul
                  className="relative z-10 max-h-[360px] overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.05]"
                  aria-label={t('notifications.list') || 'Bildirishnomalar ro\'yxati'}
                >
                  {displayedItems.map((notification) => (
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

              {/* Footer Bar */}
              <div className="relative z-10 flex items-center justify-between border-t border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] px-4 py-2.5">
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  {displayedItems.length} {displayedItems.length === 1 ? 'xabar' : 'xabarlar'}
                </span>

                <Link
                  to="/notifications"
                  onClick={close}
                  className="group flex items-center gap-1 text-[11px] font-semibold text-[#2563EB] transition-colors hover:underline"
                >
                  <span>{t('common.viewAll') || 'To\'liq sahifada ochish'}</span>
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationsMenu;
