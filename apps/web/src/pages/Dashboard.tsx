import { useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { GlassErrorState } from '@/components/ui';
import { getErrorMessage } from '@/lib/errorMessages';
import type { DashboardStats } from '@/lib/types';

import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { KPIGrid } from '@/components/dashboard/KPIGrid';
import { RevenueSection } from '@/components/dashboard/RevenueSection';
import { AttendanceSection } from '@/components/dashboard/AttendanceSection';
import { RecentPayments } from '@/components/dashboard/RecentPayments';
import { FollowUpsSection } from '@/components/dashboard/FollowUpsSection';
import { FinancialSummaryCard } from '@/components/dashboard/FinancialSummaryCard';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';

/**
 * Pure calculation helper exported for unit tests and regression checks.
 */
export function calculatePaidShare(stats: DashboardStats): number {
  const paid = Number(stats.totalPaid) || 0;
  const pending = Number(stats.totalPending) || 0;
  const overdue = Number(stats.totalOverdue) || 0;
  const total = paid + pending + overdue;
  if (!total) return 0;
  return Math.round((paid / total) * 100);
}

export function DashboardPage() {
  const { t } = useI18n();
  usePageTitle(t('dashboard.title') || 'Dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();

  const role = user?.role?.toUpperCase();

  // Role-based landing. MUST be a hook (not an early return above other
  // hooks): an `if (role...) return <Navigate/>` before useEffect/useQuery
  // violated the Rules of Hooks and threw "rendered fewer hooks" whenever
  // the role changed while mounted (cross-tab sign-in / account switch).
  useEffect(() => {
    if (role === 'PARENT') navigate('/parent-portal', { replace: true });
    else if (role === 'TEACHER') navigate('/attendance', { replace: true });
    else if (role === 'STUDENT') navigate('/schedule', { replace: true });
  }, [role, navigate]);

  // Keyboard shortcut: ⌘N / Ctrl+N to create student (safe inside inputs)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        /INPUT|TEXTAREA|SELECT/.test(target?.tagName || '') || target?.isContentEditable;
      if (inInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        navigate('/students/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    staleTime: 30_000,
  });

  const stats = data as DashboardStats | undefined;

  const paidShare = useMemo(() => (stats ? calculatePaidShare(stats) : 0), [stats]);

  const revenueTrend = useMemo(
    () => (stats?.monthlyRevenue ?? []).map((item) => Number(item.total) || 0),
    [stats?.monthlyRevenue],
  );

  if (isLoading && !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-card)] p-8 shadow-[var(--shadow-sm)]">
          <GlassErrorState
            title={t('dashboard.loadFailed') || 'Unable to load dashboard'}
            message={getErrorMessage(error as Error)}
            onRetry={() => void refetch()}
          />
        </div>
      </div>
    );
  }

  return (
    <main
      id="dashboard-main"
      className="mx-auto max-w-7xl space-y-6 px-4 pb-14 pt-2 sm:px-6 lg:px-8"
      aria-label="Academy Dashboard"
    >
      {/* 1. Dashboard Header: Greeting + Status + Quick Primary Actions */}
      <DashboardHeader
        userName={user?.firstName}
        orgName={user?.organization?.name}
      />

      {/* 2. Key Performance Indicators Grid (Active Students, Attendance, Revenue, Conversion) */}
      <KPIGrid
        stats={stats}
        paidShare={paidShare}
        revenueTrend={revenueTrend}
      />

      {/* 3. Analytics Section: Revenue Trend (Real Period data) + Activity Rings */}
      <section
        aria-label="Analytics and Performance"
        className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]"
      >
        <RevenueSection initialData={stats.monthlyRevenue ?? []} />
        <AttendanceSection
          stats={stats.attendanceStats ?? []}
          overallRate={stats.attendanceRate}
        />
      </section>

      {/* 4. Feeds: Recent Transactions + Actionable Follow-ups */}
      <section
        aria-label="Recent Activity and Follow-ups"
        className="grid grid-cols-1 gap-6 xl:grid-cols-2"
      >
        <RecentPayments payments={stats.recentPayments ?? []} />
        <FollowUpsSection followUps={stats.upcomingFollowUps ?? []} />
      </section>

      {/* 5. Summary Strip: Financial Health and Collection Rate */}
      <FinancialSummaryCard
        totalPaid={Number(stats.totalPaid) || 0}
        totalPending={Number(stats.totalPending) || 0}
        totalOverdue={Number(stats.totalOverdue) || 0}
        paidShare={paidShare}
      />
    </main>
  );
}

export default DashboardPage;
