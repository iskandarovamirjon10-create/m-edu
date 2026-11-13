/**
 * RecentActivitiesFeed — the latest audit events for the organisation.
 * Elevated with iOS 27 / Apple Vision Pro Liquid Glass and Tactile Sound.
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { Icon, Shimmer, type IconName } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';

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
  jewelClass: string;
}

function toActivity(item: RawAuditItem): Activity {
  const entity = item.entityType || 'Tizim';
  const action = item.action || 'AMAL';
  const entityKey = entity.toLowerCase();
  const userName = item.user
    ? `${item.user.firstName || ''} ${item.user.lastName || ''}`.trim()
    : item.ipAddress || 'Tizim foydalanuvchisi';

  let icon: IconName = 'users';
  let jewelClass = 'jewel-blue';
  if (item.action === 'CREATE') {
    icon = 'book';
    jewelClass = 'jewel-emerald';
  } else if (item.action === 'PAYMENT' || entityKey.includes('payment')) {
    icon = 'creditCard';
    jewelClass = 'jewel-purple';
  } else if (entityKey.includes('face') || entityKey.includes('attend')) {
    icon = 'user';
    jewelClass = 'jewel-blue';
  }

  return {
    id: item.id,
    title: `${entity} (${action})`,
    subtitle: userName,
    time: item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—',
    icon,
    jewelClass,
  };
}

export function RecentActivitiesFeed() {
  const sound = usePremiumSound();
  const cardRef = useDashboardGlassCard<HTMLDivElement>();
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
    <div
      ref={cardRef}
      className="lgx lgx--clear relative isolate flex h-full flex-col rounded-[2rem] p-5 sm:p-6"
    >
      <DashboardGlassLayers />

      <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] pb-3.5 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_10px_rgba(99,102,241,0.4)]">
            <Icon name="clock" size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
              So'nggi faolliklar
            </h3>
            <p className="text-xs text-[var(--text-secondary,#86868B)]">
              Real vaqtdagi audit va tizim amallari
            </p>
          </div>
        </div>
        <Link
          to="/audit"
          onClick={() => sound.playTick()}
          className="jewel-pill jewel-slate text-[11px] font-bold py-1 px-3 hover:text-sky-600 dark:hover:text-sky-400"
        >
          Barchasini ko'rish
        </Link>
      </div>

      <div className="mt-3.5 flex-1 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="py-2.5">
              <Shimmer className="h-10 w-full" rounded="10px" />
            </div>
          ))
        ) : activities.length > 0 ? (
          activities.map((act) => (
            <div key={act.id} className="group flex items-center justify-between gap-3 py-2.5 transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] px-1 rounded-xl">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`jewel-pill ${act.jewelClass} h-8 w-8 shrink-0 flex items-center justify-center p-0`}>
                  <Icon name={act.icon} size={15} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-[var(--text-primary,#1D1D1F)] dark:text-white">
                    {act.title}
                  </div>
                  <div className="truncate text-[11px] text-[var(--text-secondary,#86868B)]">
                    {act.subtitle}
                  </div>
                </div>
              </div>
              <div className="shrink-0 font-mono text-[11px] tabular-nums font-semibold text-[var(--text-secondary,#86868B)]">
                {act.time}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-7 text-center">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-black/[0.04] text-[var(--text-secondary,#86868B)] dark:bg-white/[0.06]">
              <Icon name="clock" size={20} />
            </span>
            <span className="text-xs font-bold text-[var(--text-primary,#1D1D1F)] dark:text-white">
              Hozircha faolliklar mavjud emas
            </span>
            <span className="mt-0.5 text-xs text-[var(--text-secondary,#86868B)]">
              Tizim amallari avtomatik ravishda bu yerda aks etadi
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentActivitiesFeed;
