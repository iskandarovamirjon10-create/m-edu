/**
 * TodayActionItemsSection — consolidated operational action items:
 * follow-up calls, overdue collections and uncontacted leads.
 * Elevated with iOS 27 / Apple Vision Pro Liquid Glass and Tactile Sound.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { earlyWarningApi } from '@/lib/api';
import type { DashboardStats } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { cn, Icon, Shimmer } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';

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

const TASK_META: Record<TaskKind, { badge: string; jewelClass: string }> = {
  CALL: { badge: "Qo'ng'iroq", jewelClass: 'jewel-blue' },
  DEBT: { badge: 'Qarzdorlik', jewelClass: 'jewel-rose' },
  LEAD: { badge: 'Yangi lid', jewelClass: 'jewel-emerald' },
};

const FILTERS: Array<{ key: TaskType; label: string }> = [
  { key: 'ALL', label: 'Barchasi' },
  { key: 'CALLS', label: "Qo'ng'iroqlar" },
  { key: 'DEBT', label: "To'lovlar" },
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
  const sound = usePremiumSound();
  const cardRef = useDashboardGlassCard<HTMLDivElement>();

  const { data: warningsData, isLoading } = useQuery({
    queryKey: ['early-warning', 'payment-overdue'],
    queryFn: () => earlyWarningApi.list({ ruleId: 'payment-overdue', limit: 4 }),
    staleTime: 60_000,
  });

  const paymentWarnings = useMemo<PaymentWarningItem[]>(() => {
    if (Array.isArray(warningsData)) return warningsData as PaymentWarningItem[];
    return (warningsData as { items?: PaymentWarningItem[] } | undefined)?.items ?? [];
  }, [warningsData]);

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
        title: `${warning.entityName || "O'quvchi"} to'lovi muddati o'tgan`,
        subtitle: warning.message || "Muddati o'tgan schyot mavjud",
        href: '/invoices?status=OVERDUE',
      });
    }

    if (!list.some((i) => i.type === 'DEBT') && Number(stats.totalOverdue) > 0) {
      list.push({
        id: 'debt-aggregate',
        type: 'DEBT',
        title: "Muddati o'tgan to'lovlarni undirish",
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
    <div
      ref={cardRef}
      className="lgx lgx--clear relative isolate flex h-full flex-col rounded-[2rem] p-5 sm:p-6"
    >
      <DashboardGlassLayers />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] pb-3.5 dark:border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0A84FF] to-[#5E5CE6] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_10px_rgba(10,132,255,0.4)]">
            <Icon name="checkCircle" size={18} strokeWidth={2.2} />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
              Bugungi vazifalar
            </h3>
            <p className="text-xs text-[var(--text-secondary,#86868B)]">
              Qo'ng'iroqlar, to'lovlar va faol lidlar
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Vazifa turi"
          className="flex items-center gap-1 rounded-full border border-black/[0.06] bg-black/[0.03] p-1 dark:border-white/[0.08] dark:bg-white/[0.05]"
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  sound.playTick();
                  setFilter(f.key);
                }}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-200',
                  active
                    ? 'jewel-pill jewel-blue shadow-xs font-bold'
                    : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-2.5">
        {isLoading ? (
          [0, 1, 2].map((i) => <Shimmer key={i} className="h-14 w-full" rounded="12px" />)
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 shadow-[0_0_20px_rgba(52,199,89,0.25)] dark:text-emerald-400">
              <Icon name="checkCircle" size={24} />
            </span>
            <h4 className="mt-3 text-sm font-bold text-[var(--text-primary,#1D1D1F)] dark:text-white">
              Barcha vazifalar bajarildi
            </h4>
            <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary,#86868B)]">
              Kechiktirilgan yoki zudlik talab qiluvchi vazifalar mavjud emas.
            </p>
          </div>
        ) : (
          visible.slice(0, 6).map((item) => {
            const meta = TASK_META[item.type];
            return (
              <div
                key={item.id}
                className="group relative flex items-center justify-between gap-3 rounded-2xl border border-black/[0.05] bg-white/50 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/[0.1] hover:bg-white/80 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.15] dark:hover:bg-white/[0.06]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      to={item.href}
                      onClick={() => sound.playTick()}
                      className="truncate text-xs font-bold text-[var(--text-primary,#1D1D1F)] hover:text-sky-600 dark:text-white dark:hover:text-sky-400"
                    >
                      {item.title}
                    </Link>
                    <span
                      className={cn(
                        'jewel-pill text-[10px] uppercase font-bold py-0.5 px-2 tracking-wide',
                        meta.jewelClass,
                      )}
                    >
                      {meta.badge}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-secondary,#86868B)]">
                    {item.subtitle}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {item.phone && (
                    <a
                      href={`tel:${item.phone}`}
                      onClick={() => sound.playTick()}
                      aria-label={`${item.phone} raqamiga qo'ng'iroq qilish`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/[0.08] bg-white/70 text-sky-600 transition hover:bg-sky-50 active:scale-95 dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-sky-400 dark:hover:bg-white/15"
                    >
                      <Icon name="phone" size={14} />
                    </a>
                  )}
                  <Link
                    to={item.href}
                    onClick={() => sound.playTick()}
                    aria-label={`${item.title} sahifasiga o'tish`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-[var(--text-secondary,#86868B)] transition hover:border-black/[0.08] hover:bg-white/70 hover:text-[var(--text-primary,#1D1D1F)] active:scale-95 dark:hover:border-white/[0.12] dark:hover:bg-white/[0.08] dark:hover:text-white"
                  >
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-3 text-xs dark:border-white/[0.08]">
        <span className="text-[var(--text-secondary,#86868B)] font-medium">
          Jami vazifalar: <strong className="text-[var(--text-primary,#1D1D1F)] dark:text-white">{visible.length}</strong> ta
        </span>
        <Link
          to="/leads"
          onClick={() => sound.playTick()}
          className="inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Lidlar boshqaruvi
          <Icon name="chevronRight" size={14} />
        </Link>
      </div>
    </div>
  );
}

export default TodayActionItemsSection;
