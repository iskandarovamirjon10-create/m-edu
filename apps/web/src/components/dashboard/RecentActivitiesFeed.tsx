/**
 * RecentActivitiesFeed — the latest audit events for the organisation.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { Icon, Shimmer, type IconName } from '@/lib/design';

interface RawAuditItem {
  id: string;
  action?: string;
  entityType?: string;
  createdAt?: string;
  ipAddress?: string;
  user?: { firstName?: string; lastName?: string };
}

interface Activity {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  icon: IconName;
  tone: string;
}

function toActivity(item: RawAuditItem): Activity {
  const entity = item.entityType || 'Tizim';
  const action = item.action || 'AMAL';
  const entityKey = entity.toLowerCase();
  const userName = item.user
    ? `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim()
    : item.ipAddress || 'Tizim foydalanuvchisi';

  let icon: IconName = 'users';
  let tone = 'bg-apple-blue/10 text-apple-blue';
  if (item.action === 'CREATE') {
    icon = 'book';
    tone = 'bg-apple-green/10 text-apple-green';
  } else if (item.action === 'PAYMENT' || entityKey.includes('payment')) {
    icon = 'creditCard';
    tone = 'bg-apple-purple/10 text-apple-purple';
  } else if (entityKey.includes('face') || entityKey.includes('attend')) {
    icon = 'user';
    tone = 'bg-apple-teal/10 text-apple-teal';
  }

  return {
    id: item.id,
    title: `${entity} (${action})`,
    subtitle: userName,
    time: item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
    icon,
    tone,
  };
}

export function RecentActivitiesFeed() {
  const { data, isLoading } = useQuery({
    queryKey: ['audit', 'recent-feed'],
    queryFn: () => auditApi.list({ limit: 5 }),
    staleTime: 30_000,
  });

  const rawItems: RawAuditItem[] =
    (data as { items?: RawAuditItem[] } | undefined)?.items ||
    (Array.isArray(data) ? (data as RawAuditItem[]) : []);
  const activities = rawItems.map(toActivity);

  return (
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            <Icon name="clock" size={18} />
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-primary">So'nggi faolliklar</h3>
        </div>
        <Link
          to="/audit"
          className="rounded-lg border border-subtle bg-black/[0.02] px-2.5 py-1 text-xs font-medium text-secondary transition-colors hover:text-primary dark:bg-white/[0.04]"
        >
          Barchasini ko'rish
        </Link>
      </div>

      <div className="flex-1 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="py-2.5">
              <Shimmer className="h-8 w-full" rounded="8px" />
            </div>
          ))
        ) : activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${act.tone}`}>
                  <Icon name={act.icon} size={15} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-primary">{act.title}</div>
                  <div className="truncate text-xs text-tertiary">{act.subtitle}</div>
                </div>
              </div>
              <div className="shrink-0 font-mono text-[11px] tabular-nums text-tertiary">{act.time}</div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-7 text-center">
            <span className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.04] text-tertiary dark:bg-white/[0.06]">
              <Icon name="clock" size={18} />
            </span>
            <span className="text-xs font-medium text-primary">Hozircha faolliklar mavjud emas</span>
            <span className="mt-0.5 text-xs text-tertiary">Tizim amallari shu yerda aks etadi</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentActivitiesFeed;
