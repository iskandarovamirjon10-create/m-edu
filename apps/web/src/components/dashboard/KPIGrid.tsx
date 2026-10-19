/**
 * ============================================================================
 * KPIGrid v2.1 — Executive metric grid (Hyper-Refractive Liquid Glass)
 * ============================================================================
 */

import { Icon } from '@/lib/design';
import type { DashboardStats } from '@/lib/types';
import { KPICard } from './KPICard';

interface KPIGridProps {
  stats: DashboardStats;
  /** Collection rate (paid / total billed), already computed by the page. */
  paidShare?: number;
  /** Monthly revenue series used for the month-over-month trend chip. */
  revenueTrend?: number[];
}

function monthOverMonth(trend?: number[]): number | null {
  const values = (trend ?? []).map(Number).filter((n) => Number.isFinite(n));
  if (values.length < 2) return null;
  const prev = values[values.length - 2];
  const last = values[values.length - 1];
  if (!prev) return null;
  return Math.round(((last - prev) / prev) * 100);
}

export function KPIGrid({ stats, paidShare, revenueTrend }: KPIGridProps) {
  const todayRevenue = Number(stats.todayRevenue ?? 0);
  const todayPaymentsCount = Number(stats.todayPaymentsCount ?? 0);

  const todayMap = new Map<string, number>();
  for (const item of stats.todayAttendanceStats || []) {
    todayMap.set(item.status, (todayMap.get(item.status) || 0) + (Number(item.count) || 0));
  }
  const todayInClass = (todayMap.get('PRESENT') || 0) + (todayMap.get('LATE') || 0);
  const todayAbsent = todayMap.get('ABSENT') || 0;
  const todayTotal = todayInClass + todayAbsent + (todayMap.get('EXCUSED') || 0);
  const todayRate = todayTotal > 0 ? Math.round((todayInClass / todayTotal) * 100) : null;

  const totalOverdue = Math.max(0, Number(stats.totalOverdue) || 0);
  const totalPending = Math.max(0, Number(stats.totalPending) || 0);
  const activeStudents = stats.activeStudents || stats.totalStudents || 0;

  const mom = monthOverMonth(revenueTrend);
  const paidLabel = typeof paidShare === 'number' ? `${Math.round(paidShare)}% yig'ildi` : null;

  return (
    <section aria-label="Asosiy boshqaruv ko'rsatkichlari">
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          title="Bugungi tushum"
          value={todayRevenue}
          formattedValue={`${todayRevenue.toLocaleString()} UZS`}
          description={todayPaymentsCount > 0 ? `${todayPaymentsCount} ta to'lov` : 'To\'lov qayd etilmagan'}
          trend={
            mom !== null
              ? { label: `${mom >= 0 ? '+' : ''}${mom}% oy`, isPositive: mom > 0, isNeutral: mom === 0 }
              : { label: 'Bugun', isPositive: true }
          }
          accentColor="#34C759"
          href="/payments"
          icon={<Icon name="creditCard" size={18} />}
        />
        <KPICard
          title="Bugungi davomat"
          value={todayRate ?? 0}
          formattedValue={todayRate !== null ? `${todayRate}%` : 'Kutilmoqda'}
          description={
            todayTotal > 0
              ? `${todayInClass}/${todayTotal} kelgan · ${todayAbsent} yo'q`
              : stats.todayLessonsCount
                ? `${stats.todayLessonsCount} ta dars rejalashtirilgan`
                : 'Davomat kutilmoqda'
          }
          trend={
            todayRate === null
              ? { label: 'Dars vaqti', isNeutral: true }
              : todayRate >= 85
                ? { label: 'A\'lo', isPositive: true }
                : todayRate >= 70
                  ? { label: 'O\'rtacha', isNeutral: true }
                  : { label: 'Past', isPositive: false }
          }
          accentColor="#0A84FF"
          href="/attendance"
          icon={<Icon name="checkCircle" size={18} />}
          delay={0.06}
        />
        <KPICard
          title="Muddati o'tgan qarzdorlik"
          value={totalOverdue}
          formattedValue={`${totalOverdue.toLocaleString()} UZS`}
          description={
            paidLabel
              ? `Kutilmoqda: ${totalPending.toLocaleString()} · ${paidLabel}`
              : `Kutilmoqda: ${totalPending.toLocaleString()} UZS`
          }
          trend={
            totalOverdue > 0
              ? { label: 'Muddati o\'tgan', isPositive: false }
              : { label: 'Qarz yo\'q', isPositive: true }
          }
          accentColor="#FF9F0A"
          href="/invoices?status=OVERDUE"
          icon={<Icon name="alert" size={18} />}
          delay={0.12}
        />
        <KPICard
          title="Faol o'quvchilar"
          value={activeStudents}
          formattedValue={activeStudents.toLocaleString()}
          description={`Jami: ${stats.totalStudents || 0} · ${stats.activeGroups || 0} ta guruh`}
          trend={{ label: 'Faol', isPositive: true }}
          accentColor="#5E5CE6"
          href="/students"
          icon={<Icon name="users" size={18} />}
          delay={0.18}
        />
      </div>
    </section>
  );
}

export default KPIGrid;