import { useMemo } from 'react';
import { KPICard } from './KPICard';
import { formatCurrency } from '@/lib/format';
import type { DashboardStats } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

interface KPIGridProps {
  stats: DashboardStats;
  paidShare: number;
  revenueTrend?: number[];
}

export function KPIGrid({ stats, paidShare, revenueTrend }: KPIGridProps) {
  const { t } = useI18n();

  const activePercent = useMemo(() => {
    if (!stats.totalStudents) return 0;
    return Math.round((stats.activeStudents / stats.totalStudents) * 100);
  }, [stats.activeStudents, stats.totalStudents]);

  return (
    <section aria-label="Key Performance Indicators" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Active Students */}
      <KPICard
        title={t('dashboard.activeStudents') || 'Active Students'}
        value={stats.activeStudents}
        description={
          t('dashboard.activeStudentsSub', { count: stats.totalStudents }) ||
          `Total enrolled: ${stats.totalStudents}`
        }
        accentColor="var(--primary)"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
        trend={{
          label: `${activePercent}% ${t('dashboard.active') || 'active'}`,
          isPositive: activePercent >= 50,
          isNeutral: activePercent === 0,
        }}
      />

      {/* 2. Attendance Rate */}
      <KPICard
        title={t('dashboard.attendance') || 'Attendance (30D)'}
        value={stats.attendanceRate}
        formattedValue={`${stats.attendanceRate}%`}
        description={
          t('dashboard.activeGroupsSub', { count: stats.activeGroups }) ||
          `${stats.activeGroups} active learning groups`
        }
        accentColor="var(--success)"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M3 10h18" /><path d="m9 16 2 2 4-4" />
          </svg>
        }
        trend={{
          label: `${stats.activeGroups} ${t('nav.groups') || 'groups'}`,
          isPositive: stats.attendanceRate >= 80,
          isNeutral: stats.attendanceRate === 0,
        }}
      />

      {/* 3. Revenue Collected */}
      <KPICard
        title={t('dashboard.revenueCollected') || 'Revenue Collected'}
        value={Number(stats.totalPaid) || 0}
        formattedValue={formatCurrency(stats.totalPaid)}
        description={`${t('dashboard.pending') || 'Pending'}: ${formatCurrency(stats.totalPending)}`}
        accentColor="var(--info)"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
        }
        sparkline={revenueTrend && revenueTrend.length > 1 ? revenueTrend : undefined}
        trend={{
          label: `${paidShare}% ${t('dashboard.paid') || 'collected'}`,
          isPositive: paidShare >= 60,
          isNeutral: paidShare === 0,
        }}
      />

      {/* 4. Lead Conversion */}
      <KPICard
        title={t('dashboard.leadConversion') || 'Lead Conversion'}
        value={stats.conversionRate}
        formattedValue={`${stats.conversionRate}%`}
        description={
          t('dashboard.leadSub', {
            newCount: stats.newLeadsThisMonth,
            total: stats.totalLeads,
          }) || `${stats.newLeadsThisMonth} new leads this month`
        }
        accentColor="var(--warning)"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
        }
        trend={{
          label: `${stats.wonLeads}/${stats.totalLeads} won`,
          isPositive: stats.conversionRate >= 20,
          isNeutral: stats.conversionRate === 0,
        }}
      />
    </section>
  );
}
