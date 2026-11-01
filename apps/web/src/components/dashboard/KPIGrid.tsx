/**
 * ============================================================================
 * KPIGrid v3.0 — Strategic Executive Metric Grid (Hyper-Refractive Liquid Glass)
 * ============================================================================
 * Displays non-redundant macro-level organizational health:
 * 1. Active Students & Group Capacity
 * 2. Monthly Revenue & Collection Velocity
 * 3. Overdue Balance & Receivables Risk
 * 4. Marketing Leads & Sales Conversion Rate
 */

import { Icon } from '@/lib/design';
import { useI18n } from '@/i18n/I18nProvider';
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
  const { t } = useI18n();

  // 1. Students & Capacity
  const activeStudents = stats.activeStudents || stats.totalStudents || 0;
  const totalStudents = stats.totalStudents || 0;
  const activeGroups = stats.activeGroups || 0;

  // 2. Monthly Revenue & Collections
  const lastRevenueItem = (stats.monthlyRevenue ?? [])[
    stats.monthlyRevenue && stats.monthlyRevenue.length > 0
      ? stats.monthlyRevenue.length - 1
      : 0
  ];
  const monthlyRevenueValue = lastRevenueItem
    ? Number(lastRevenueItem.total) || 0
    : revenueTrend && revenueTrend.length > 0
      ? revenueTrend[revenueTrend.length - 1]
      : Math.max(0, Number(stats.todayRevenue) || 0);

  const mom = monthOverMonth(revenueTrend);
  const totalPending = Math.max(0, Number(stats.totalPending) || 0);
  const paidLabel =
    typeof paidShare === 'number'
      ? `${Math.round(paidShare)}% ${t('dashboard.collectedShare', "yig'ildi")}`
      : null;

  // 3. Overdue Debt Risk
  const totalOverdue = Math.max(0, Number(stats.totalOverdue) || 0);

  // 4. Marketing Leads & Sales Conversion
  const totalLeads = Number(stats.totalLeads) || 0;
  const wonLeads = Number(stats.wonLeads) || 0;
  const newLeadsThisMonth = Number(stats.newLeadsThisMonth) || 0;
  const conversionRate =
    Number(stats.conversionRate) ||
    (totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0);

  return (
    <section aria-label={t('dashboard.kpiSection', "Asosiy strategik ko'rsatkichlar")}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1: Active Students & Groups */}
        <KPICard
          title={t('dashboard.activeStudents', "Faol o'quvchilar")}
          value={activeStudents}
          formattedValue={activeStudents.toLocaleString()}
          description={`${t('common.total', 'Jami')}: ${totalStudents} · ${activeGroups} ${t('dashboard.groupsSuffix', 'ta faol guruh')}`}
          trend={{
            label: `${stats.totalTeachers || 0} ${t('dashboard.teachersCountSuffix', "o'qituvchi")}`,
            isPositive: true,
          }}
          accentColor="#5E5CE6"
          href="/students"
          icon={<Icon name="users" size={18} />}
          delay={0}
        />

        {/* Metric 2: Monthly Inflow & Collection Rate */}
        <KPICard
          title={t('dashboard.monthlyRevenue', 'Oylik tushum')}
          value={monthlyRevenueValue}
          formattedValue={`${monthlyRevenueValue.toLocaleString()} UZS`}
          description={
            paidLabel
              ? `${paidLabel} · ${t('dashboard.pending', 'Kutilmoqda')}: ${totalPending.toLocaleString()} UZS`
              : `${t('dashboard.pending', 'Kutilmoqda')}: ${totalPending.toLocaleString()} UZS`
          }
          trend={
            mom !== null
              ? {
                  label: `${mom >= 0 ? '+' : ''}${mom}% ${t('dashboard.monthSuffix', 'oy')}`,
                  isPositive: mom > 0,
                  isNeutral: mom === 0,
                }
              : { label: t('dashboard.stable', 'Barqaror'), isPositive: true }
          }
          accentColor="#34C759"
          href="/payments"
          icon={<Icon name="creditCard" size={18} />}
          delay={0.06}
        />

        {/* Metric 3: Overdue Receivables Risk */}
        <KPICard
          title={t('dashboard.overdueBalance', "Muddati o'tgan qarzdorlik")}
          value={totalOverdue}
          formattedValue={`${totalOverdue.toLocaleString()} UZS`}
          description={
            totalOverdue > 0
              ? t('dashboard.overdueWarning', 'Shoshilinch undirish choralari zarur')
              : t('dashboard.noDebt', "Barcha to'lovlar o'z vaqtida amalga oshirilgan")
          }
          trend={
            totalOverdue > 0
              ? { label: t('dashboard.overdue', "Muddati o'tgan"), isPositive: false }
              : { label: t('dashboard.cleanDebt', 'Qarz yo‘q'), isPositive: true }
          }
          accentColor="#FF9F0A"
          href="/invoices?status=OVERDUE"
          icon={<Icon name="alert" size={18} />}
          delay={0.12}
        />

        {/* Metric 4: Leads & Conversion Pipeline */}
        <KPICard
          title={t('dashboard.leadsConversion', 'Lidlar va konversiya')}
          value={conversionRate}
          formattedValue={`${conversionRate}%`}
          description={`${wonLeads}/${totalLeads} ${t('dashboard.wonSuffix', 'yutildi')} · ${newLeadsThisMonth} ${t('dashboard.newLeadsSuffix', 'ta yangi lid')}`}
          trend={
            conversionRate >= 30
              ? { label: t('dashboard.highGrowth', "Yuqori o'sish"), isPositive: true }
              : { label: t('dashboard.normalGrowth', 'Normal'), isNeutral: true }
          }
          accentColor="#0A84FF"
          href="/leads"
          icon={<Icon name="target" size={18} />}
          delay={0.18}
        />
      </div>
    </section>
  );
}

export default KPIGrid;
