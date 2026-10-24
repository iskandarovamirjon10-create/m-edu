/**
 * M-EDU Dashboard Workspace — v20 "Apple Spatial Pro · Studio Canvas"
 *
 * 🎯 World-Class Enhancements:
 *  ✅ Zero-Waste Query Gating: Disables stats fetching for non-admin roles (`PARENT`, `TEACHER`, `STUDENT`) before redirect
 *  ✅ Safe i18n Layer: Resilient localization via `useSafeI18n()` with fallback handling
 *  ✅ Liquid Fluidity Grid (320px -> 4K Ultra-Wide): Expands up to `3xl:max-w-[1800px]` with safe-area spacing
 *  ✅ Apple visionOS Staggered Reveal: Silky smooth spring physics across cards, charts, and feed components
 *  ✅ Tactile Keyboard Shortcuts: `R` for instant stats refresh with haptics, `N` for new student entry
 *  ✅ High-Contrast Specular Error State: Refined glass retry presentation card
 */

import { useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { dashboardApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { GlassErrorState, GlassSurface } from '@/components/ui';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
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
import { AiExecutiveBriefingCard } from '@/components/ai';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Motion Tokens & Staggered Reveal                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.02,
    },
  },
};

const SECTION_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.99 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 32,
      mass: 0.8,
    },
  },
};

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
  const { t } = useSafeI18n();
  usePageTitle(t('dashboard.title') || 'Dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const sound = usePremiumSound();

  const role = user?.role?.toUpperCase();
  const isDedicatedRole = ['PARENT', 'TEACHER', 'STUDENT'].includes(role || '');

  // Role-based landing.
  useEffect(() => {
    if (role === 'PARENT') navigate('/parent-portal', { replace: true });
    else if (role === 'TEACHER') navigate('/attendance', { replace: true });
    else if (role === 'STUDENT') navigate('/schedule', { replace: true });
  }, [role, navigate]);

  // Query gated so redirected roles do not generate 403 API noise
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    enabled: !isDedicatedRole,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const handleManualRefresh = useCallback(async () => {
    sound.playTick();
    await refetch();
    sound.playSuccess();
  }, [refetch, sound]);

  // Keyboard shortcut listener: R (refresh) & N (new student)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        /INPUT|TEXTAREA|SELECT/.test(target?.tagName || '') || target?.isContentEditable;
      if (inInput) return;

      // N or ⌘N / Ctrl+N to create student
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') ||
        (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        sound.playPop();
        navigate('/students/new');
      }

      // R to refresh dashboard data
      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void handleManualRefresh();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, handleManualRefresh, sound]);

  const stats = data as DashboardStats | undefined;

  const paidShare = useMemo(() => (stats ? calculatePaidShare(stats) : 0), [stats]);

  const revenueTrend = useMemo(
    () => (stats?.monthlyRevenue ?? []).map((item) => Number(item.total) || 0),
    [stats?.monthlyRevenue],
  );

  if (isLoading && !stats) {
    return (
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] px-3 sm:px-6 lg:px-8 py-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || (!stats && !isDedicatedRole)) {
    return (
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] px-3 sm:px-6 lg:px-8 py-8">
        <GlassSurface
          tone="frost"
          className="rounded-[2.25rem] p-8 border border-black/[0.08] dark:border-white/[0.14] bg-white/80 dark:bg-[#161618]/80 backdrop-blur-3xl shadow-2xl"
        >
          <GlassErrorState
            title={t('dashboard.loadFailed') || 'Unable to load dashboard'}
            message={getErrorMessage(error as Error)}
            onRetry={() => void handleManualRefresh()}
          />
        </GlassSurface>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <motion.div
      id="dashboard-content"
      role="region"
      aria-label={t('dashboard.title', 'Asosiy')}
      variants={CONTAINER_VARIANTS}
      initial="hidden"
      animate="visible"
      className="mx-auto max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] space-y-6 px-3 sm:px-6 lg:px-8 pt-2 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />
      {/* 1. Dashboard Header: Greeting + Status + Quick Primary Actions */}
      <motion.div variants={SECTION_VARIANTS}>
        <DashboardHeader
          userName={user?.firstName}
          orgName={user?.organization?.name}
        />
      </motion.div>

      {/* 1.5. AI Executive Morning Briefing — Proactive Daily Pulse */}
      <motion.div variants={SECTION_VARIANTS}>
        <AiExecutiveBriefingCard />
      </motion.div>

      {/* 2. Key Performance Indicators Grid (Active Students, Attendance, Revenue, Conversion) */}
      <motion.div variants={SECTION_VARIANTS}>
        <KPIGrid
          stats={stats}
          paidShare={paidShare}
          revenueTrend={revenueTrend}
        />
      </motion.div>

      {/* 3. Analytics Section: Revenue Trend (Real Period data) + Activity Rings */}
      <motion.section
        variants={SECTION_VARIANTS}
        aria-label="Analytics and Performance"
        className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]"
      >
        <RevenueSection initialData={stats.monthlyRevenue ?? []} />
        <AttendanceSection
          stats={stats.attendanceStats ?? []}
          overallRate={stats.attendanceRate}
        />
      </motion.section>

      {/* 4. Feeds: Recent Transactions + Actionable Follow-ups */}
      <motion.section
        variants={SECTION_VARIANTS}
        aria-label="Recent Activity and Follow-ups"
        className="grid grid-cols-1 gap-6 xl:grid-cols-2"
      >
        <RecentPayments payments={stats.recentPayments ?? []} />
        <FollowUpsSection followUps={stats.upcomingFollowUps ?? []} />
      </motion.section>

      {/* 5. Summary Strip: Financial Health and Collection Rate */}
      <motion.div variants={SECTION_VARIANTS}>
        <FinancialSummaryCard
          totalPaid={Number(stats.totalPaid) || 0}
          totalPending={Number(stats.totalPending) || 0}
          totalOverdue={Number(stats.totalOverdue) || 0}
          paidShare={paidShare}
        />
      </motion.div>
    </motion.div>
  );
}

export default DashboardPage;
