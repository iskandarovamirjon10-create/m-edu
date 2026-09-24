import { useCallback, useEffect, useRef, useState} from'react';
import { useMutation, useQuery, useQueryClient} from'@tanstack/react-query';
import { notificationsApi} from'@/lib/api';
import { timeAgo} from'@/lib/format';
import { getErrorMessage} from'@/lib/errorMessages';
import { useSafeI18n} from'@/i18n/I18nProvider';
import type { Notification} from'@/lib/types';

/* ────────────────────────────────────────────────────────────────────────── */
/* Bell Icon */
/* ────────────────────────────────────────────────────────────────────────── */
function BellIcon({ unread}: { unread: boolean}) {
 return (
 <svg
 className="h-5 w-5"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.6"
 strokeLinecap="round"
 strokeLinejoin="round"
 aria-hidden="true"
 >
 <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
 <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
 {unread && (
 <>
 {/* Pulse ring when unread */}
 <circle cx="17"cy="7"r="2.5"fill="currentColor"stroke="none"opacity="1"/>
 <circle
 cx="17"cy="7"r="4"
 fill="none"
 stroke="currentColor"
 strokeWidth="1"
 opacity="0.4"
 className="animate-pulse-glow"
 />
 </>
 )}
 </svg>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Empty State */
/* ────────────────────────────────────────────────────────────────────────── */
function EmptyNotif() {
 return (
 <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
 {/* Subtle icon */}
 <div
 className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
 style={{
 background:'rgba(148,234,239,0.10)',
 backdropFilter:'blur(8px)',
}}
 >
 <svg
 className="h-7 w-7"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.5"
 strokeLinecap="round"
 strokeLinejoin="round"
 style={{ color:'var(--m-vivid)', opacity: 0.6}}
 aria-hidden="true"
 >
 <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
 <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
 </svg>
 </div>
 <p className="text-[0.9375rem] font-medium"style={{ color:'var(--text-primary)'}}>
 All caught up
 </p>
 <p
 className="mt-1.5 text-[0.8125rem]"
 style={{ color:'var(--text-muted)'}}
 >
 New notifications will appear here
 </p>
 </div>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* NotificationsDropdown */
/* ────────────────────────────────────────────────────────────────────────── */
function NotificationItem({
  n,
  onMarkRead,
  isPending,
}: {
  n: Notification;
  onMarkRead: (id: string) => void;
  isPending: boolean;
}) {
  const { t} = useSafeI18n();
  const isUnread = !n.isRead;

  // Get a subtle accent color based on notification title keywords
  const getAccentStyle = (title: string) => {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('payment') || titleLower.includes('paid') || titleLower.includes('invoice'))
  return { color:'var(--state-success)', bg:'rgba(94,230,168,0.08)'};
  if (titleLower.includes('attendance') || titleLower.includes('absent') || titleLower.includes('present'))
  return { color:'var(--m-vivid)', bg:'rgba(84,115,252,0.08)'};
  if (titleLower.includes('error') || titleLower.includes('failed') || titleLower.includes('alert'))
  return { color:'var(--state-error)', bg:'rgba(240,112,112,0.08)'};
  if (titleLower.includes('warning') || titleLower.includes('reminder'))
  return { color:'var(--state-warning)', bg:'rgba(245,184,106,0.08)'};
  return { color:'var(--text-secondary)', bg:'rgba(148,234,239,0.06)'};
};

 const accent = getAccentStyle(n.title);

 return (
 <button
 type="button"
 className={[
'group relative flex w-full flex-col gap-1 px-4 py-3.5',
'text-left transition-all duration-200',
'hover:translate-x-0.5',
'border-b',
'last:border-b-0',
 ].join('')}
 style={{
 borderColor:'var(--border-subtle)',
 background: isUnread ? accent.bg :'transparent',
}}
 onClick={() => {
 if (!n.isRead && !isPending) onMarkRead(n.id);
}}
 disabled={isPending}
 >
 {/* Unread indicator dot */}
 {isUnread && (
 <span
className="absolute left-2.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full"
  style={{ background: accent.color}}
  aria-label={t('a11y.unread')}
  />
 )}

 <div className="flex items-start justify-between gap-2 pl-3">
 <div className="min-w-0 flex-1">
 <p
 className="text-[0.875rem] font-medium leading-snug"
 style={{ color: isUnread ?'var(--text-primary)' :'var(--text-secondary)'}}
 >
 {n.title}
 </p>
 <p
 className="mt-1 text-[0.8125rem] leading-relaxed line-clamp-2"
 style={{ color:'var(--text-muted)'}}
 >
 {n.message}
 </p>
 </div>

 {/* Timestamp */}
 <span
 className="shrink-0 text-[11px] leading-none mt-0.5"
 style={{ color:'var(--text-muted)'}}
 >
 {timeAgo(n.createdAt)}
 </span>
 </div>

 {/* Subtle hover gradient */}
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-2xl"
 style={{
 background:'linear-gradient(135deg, rgba(148,234,239,0.05) 0%, transparent 60%)',
}}
 />
 </button>
 );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* NotificationsMenu */
/* ────────────────────────────────────────────────────────────────────────── */
export function NotificationsMenu() {
  const qc = useQueryClient();
  const { t} = useSafeI18n();
  const [open, setOpen] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const rootRef = useRef<HTMLDivElement>(null);

 const notifications = useQuery({
 queryKey: ['notifications'],
 queryFn: () => notificationsApi.list({ limit: 20}),
 enabled: true,
 refetchInterval: open ? 30_000 : false,
 staleTime: 15_000,
});

 const markRead = useMutation({
 mutationFn: (id: string) => notificationsApi.markRead(id),
 onSuccess: () => {
 void qc.invalidateQueries({ queryKey: ['notifications']});
},
 onError: (err) => setError(getErrorMessage(err)),
});

 const markAllRead = useMutation({
 mutationFn: () => notificationsApi.markAllRead(),
 onSuccess: () => {
 void qc.invalidateQueries({ queryKey: ['notifications']});
},
 onError: (err) => setError(getErrorMessage(err)),
});

 // Close on outside click / Escape
 useEffect(() => {
 if (!open) return;
 const onKey = (e: KeyboardEvent) => {
 if (e.key ==='Escape') setOpen(false);
};
 const onClickOutside = (e: MouseEvent) => {
 if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
 setOpen(false);
}
};
 document.addEventListener('keydown', onKey);
 document.addEventListener('mousedown', onClickOutside);
 return () => {
 document.removeEventListener('keydown', onKey);
 document.removeEventListener('mousedown', onClickOutside);
};
}, [open]);

 const data = notifications.data as
 | { items: Notification[]; unread: number; total: number}
 | undefined;
 const items = data?.items ?? [];
 const unread = data?.unread ?? 0;
 const hasMore = (data?.total ?? 0) > items.length;

 const handleToggle = useCallback(() => {
 setError(null);
 setOpen((prev) => !prev);
}, []);

 return (
 <div ref={rootRef} className="relative">
 {/* Bell button */}
 <button
 type="button"
 onClick={handleToggle}
 className={[
'relative rounded-xl p-2',
'transition-all duration-200 ease-out',
'hover:translate-y-px',
'focus-visible:outline-none',
 ].join('')}
 style={{
 color: open ?'var(--m-vivid)' :'var(--text-secondary)',
 background: open ?'rgba(84,115,252,0.10)' :'transparent',
}}
 aria-label={open ?'Close notifications' : `Notifications${unread ? `, ${unread} unread` :''}`}
 aria-expanded={open}
 aria-haspopup="true"
 >
 <BellIcon unread={unread > 0} />
 {unread > 0 && (
 <span
 className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
 style={{
 background:'linear-gradient(135deg, var(--state-error) 0%, #e05555 100%)',
 boxShadow:'0 2px 8px rgba(240,112,112,0.4)',
}}
 aria-label={`${unread} unread`}
 >
 {unread > 99 ?'99+' : unread}
 </span>
 )}
 </button>

 {/* Glass dropdown */}
 {open && (
 <div
 className="absolute right-0 z-50 mt-2 w-[360px]"
 role="dialog"
 aria-label={t('a11y.notifications')}
 style={{
 animation:'glass-dropdown-in 0.22s cubic-bezier(.25,.46,.45,.94) forwards',
}}
 >
 {/* Glass card */}
 <div
 className="overflow-hidden"
 style={{
 background:'var(--bg-card)',
 backdropFilter:'blur(28px) saturate(1.7)',
 WebkitBackdropFilter:'blur(28px) saturate(1.7)',
 border:'1px solid var(--border-glass)',
 borderRadius:'var(--radius-xl)',
 boxShadow:'var(--shadow-lg)',
}}
 >
 {/* Reflection sheen */}
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0"
 style={{
 background:
'linear-gradient(145deg, rgba(255,255,255,0.28) 0%, transparent 40%, rgba(148,234,239,0.03) 100%)',
 borderRadius:'inherit',
}}
 />

 {/* Header */}
 <div
 className="relative z-10 flex items-center justify-between px-5 py-4"
 style={{ borderBottom:'1px solid var(--border-subtle)'}}
 >
 <div className="flex items-center gap-2">
 <h2
 className="text-[0.9375rem] font-semibold"
 style={{ color:'var(--text-primary)'}}
 >
 Notifications
 </h2>
 {unread > 0 && (
 <span
 className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
 style={{
 background:'rgba(84,115,252,0.12)',
 color:'var(--m-vivid)',
 border:'1px solid rgba(84,115,252,0.22)',
}}
 >
 {unread}
 </span>
 )}
 </div>
 {unread > 0 && (
 <button
 type="button"
 className="text-[0.8125rem] font-medium transition-all duration-200 hover:opacity-80 active:scale-95"
 style={{ color:'var(--m-vivid)'}}
 onClick={() => markAllRead.mutate()}
 disabled={markAllRead.isPending}
 >
 {markAllRead.isPending ?'Marking…' :'Mark all read'}
 </button>
 )}
 </div>

 {/* Error */}
 {error && (
 <div
 className="relative z-10 px-4 py-2.5 text-[0.8125rem]"
 style={{
 color:'var(--state-error)',
 borderBottom:'1px solid var(--border-subtle)',
 background:'rgba(240,112,112,0.06)',
}}
 role="alert"
 >
 {error}
 </div>
 )}

 {/* Loading */}
 {notifications.isLoading && (
 <div className="relative z-10 flex flex-col gap-3 px-4 py-6">
 {[1, 2, 3].map((i) => (
 <div
 key={i}
 className="h-16 rounded-2xl"
 style={{
 background:'linear-gradient(90deg, var(--border-subtle) 25%, rgba(20,30,45,0.05) 50%, var(--border-subtle) 75%)',
 backgroundSize:'200% 100%',
 animation: `skeleton-shimmer 1.6s infinite`,
 animationDelay: `${i * 0.15}s`,
}}
 />
 ))}
 </div>
 )}

 {/* Empty */}
 {!notifications.isLoading && items.length === 0 && <EmptyNotif />}

 {/* Notification list */}
 {!notifications.isLoading && items.length > 0 && (
 <ul
 className="relative z-10 max-h-80 overflow-y-auto"
 style={{
 scrollbarWidth:'thin',
 scrollbarColor:'var(--border-medium) transparent',
}}
 >
 {items.map((n) => (
 <li key={n.id}>
 <NotificationItem
 n={n}
 onMarkRead={(id) => markRead.mutate(id)}
 isPending={markRead.isPending}
 />
 </li>
 ))}
 </ul>
 )}

 {/* Footer */}
 {hasMore && (
 <div
 className="relative z-10 border-t px-4 py-2.5 text-center text-[0.8125rem]"
 style={{
 borderColor:'var(--border-subtle)',
 color:'var(--text-muted)',
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
