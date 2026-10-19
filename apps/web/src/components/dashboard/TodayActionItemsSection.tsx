/**
 * TodayActionItemsSection — consolidated operational action items:
 * follow-up calls, overdue collections and uncontacted leads.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { earlyWarningApi } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { cn, Icon, Shimmer } from '@/lib/design';

interface TodayActionItemsSectionProps {
  stats: DashboardStats;
}

type TaskType = 'ALL' | 'CALLS' | 'DEBT' | 'LEADS';
type TaskKind = 'CALL' | 'DEBT' | 'LEAD';

interface TaskItem {
  id: string;
  type: TaskKind;
  title: string;
  subtitle: string;
  phone?: string;
  href: string;
}

const TASK_META: Record<TaskKind, { badge: string; chip: string }> = {
  CALL: { badge: 'Qo\'ng\'iroq', chip: 'bg-apple-blue/10 text-apple-blue' },
  DEBT: { badge: 'Qarzdorlik', chip: 'bg-apple-red/10 text-apple-red' },
  LEAD: { badge: 'Yangi lidlar', chip: 'bg-apple-green/10 text-apple-green' },
};

const FILTERS: Array<{ key: TaskType; label: string }> = [
  { key: 'ALL', label: 'Barchasi' },
  { key: 'CALLS', label: 'Qo\'ng\'iroqlar' },
  { key: 'DEBT', label: 'To\'lovlar' },
  { key: 'LEADS', label: 'Lidlar' },
];

const FILTER_KIND: Record<Exclude<TaskType, 'ALL'>, TaskKind> = {
  CALLS: 'CALL',
  DEBT: 'DEBT',
  LEADS: 'LEAD',
};

interface PaymentWarningItem {
  id: string;
  entityName?: string;
  message?: string;
}

export function TodayActionItemsSection({ stats }: TodayActionItemsSectionProps) {
  const [filter, setFilter] = useState<TaskType>('ALL');

  const { data: warningsData, isLoading } = useQuery({
    queryKey: ['early-warning', 'payment-overdue'],
    queryFn: () => earlyWarningApi.list({ ruleId: 'payment-overdue', limit: 4 }),
    staleTime: 60_000,
  });

  const paymentWarnings: PaymentWarningItem[] =
    (warningsData as { items?: PaymentWarningItem[] } | undefined)?.items ||
    (Array.isArray(warningsData) ? (warningsData as PaymentWarningItem[]) : []);

  const items = useMemo<TaskItem[]>(() => {
    const list: TaskItem[] = [];

    for (const followUp of stats.upcomingFollowUps || []) {
      const leadName = followUp.lead
        ? `${followUp.lead.firstName || ''} ${followUp.lead.lastName || ''}`.trim() || 'Lid'
        : 'Lid';
      const phone = (followUp.lead as { phone?: string } | undefined)?.phone || undefined;
      const scheduledAt = followUp.scheduledAt ? new Date(followUp.scheduledAt) : null;
      const time = scheduledAt
        ? scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Rejalashtirilgan';
      list.push({
        id: `call-${followUp.id}`,
        type: 'CALL',
        title: `${leadName} bilan bog'lanish`,
        subtitle: followUp.note || `${time} da lid bilan suhbat`,
        phone,
        href: '/leads',
      });
    }

    for (const warning of paymentWarnings) {
      list.push({
        id: `debt-${warning.id}`,
        type: 'DEBT',
        title: `${warning.entityName || 'O\'quvchi'} to'lovi muddati o'tgan`,
        subtitle: warning.message || 'Muddati o\'tgan schyot mavjud',
        href: '/invoices?status=OVERDUE',
      });
    }

    if (!list.some((i) => i.type === 'DEBT') && Number(stats.totalOverdue) > 0) {
      list.push({
        id: 'debt-aggregate',
        type: 'DEBT',
        title: 'Muddati o\'tgan to\'lovlarni undirish',
        subtitle: `${formatCurrency(stats.totalOverdue)} muddati o'tgan qarz`,
        href: '/invoices?status=OVERDUE',
      });
    }

    const newLeads = stats.leadByStage?.find((s) => s.stage === 'NEW')?.count || 0;
    if (newLeads > 0) {
      list.push({
        id: 'new-leads-task',
        type: 'LEAD',
        title: `${newLeads} ta yangi arizani ko'rib chiqish`,
        subtitle: 'Yangi lidlarga birinchi javobni berish',
        href: '/leads',
      });
    }

    return list;
  }, [stats.upcomingFollowUps, stats.totalOverdue, stats.leadByStage, paymentWarnings]);

  const visible = useMemo(
    () => (filter === 'ALL' ? items : items.filter((i) => i.type === FILTER_KIND[filter])),
    [items, filter],
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            <Icon name="checkCircle" size={18} />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-primary">Bugungi vazifalar</h3>
            <p className="text-xs text-tertiary">To'lovlar, lidlar va hal qilinadigan amallar</p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Vazifa turi"
          className="flex items-center gap-0.5 rounded-lg border border-subtle bg-black/[0.04] p-0.5 dark:bg-white/[0.06]"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150',
                filter === f.key ? 'bg-card text-primary shadow-xs' : 'text-tertiary hover:text-primary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {isLoading ? (
          [0, 1, 2].map((i) => <Shimmer key={i} className="h-14 w-full" rounded="10px" />)
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-apple-green/10 text-apple-green">
              <Icon name="checkCircle" size={20} />
            </span>
            <h4 className="mt-3 text-sm font-medium text-primary">Barcha vazifalar bajarildi</h4>
            <p className="mt-1 max-w-xs text-xs text-tertiary">
              Kechiktirilgan yoki zudlik talab qiluvchi vazifalar yo'q.
            </p>
          </div>
        ) : (
          visible.slice(0, 6).map((item) => {
            const meta = TASK_META[item.type];
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-subtle bg-black/[0.02] p-3 transition-colors duration-150 hover:bg-black/[0.04] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={item.href}
                      className="truncate text-xs font-medium text-primary hover:text-brand-500"
                    >
                      {item.title}
                    </Link>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        meta.chip,
                      )}
                    >
                      {meta.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-tertiary">{item.subtitle}</p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.phone && (
                    <a
                      href={`tel:${item.phone}`}
                      aria-label={`${item.phone} raqamiga qo'ng'iroq qilish`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-subtle text-secondary transition-colors hover:text-primary dark:hover:bg-white/[0.08]"
                    >
                      <Icon name="phone" size={14} />
                    </a>
                  )}
                  <Link
                    to={item.href}
                    aria-label={`${item.title} sahifasiga o'tish`}
                    className="rounded-md p-1.5 text-tertiary transition-colors hover:bg-black/[0.05] hover:text-primary dark:hover:bg-white/[0.08]"
                  >
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3 text-xs">
        <span className="text-tertiary">Jami vazifalar: {visible.length} ta</span>
        <Link
          to="/leads"
          className="inline-flex items-center gap-1 font-medium text-brand-500 hover:text-brand-600"
        >
          Lidlar boshqaruvi
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

export default TodayActionItemsSection;
