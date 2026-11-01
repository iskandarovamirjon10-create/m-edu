/**
 * M-EDU V2 — Executive Command Center (`Dashboard.tsx`)
 * Flagship administration cockpit: real-time telemetry, AI executive briefings,
 * multi-dimensional KPIs, operational risk radar, and live biometric Face ID kiosk.
 */

import { useMemo, useEffect, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { dashboardApi } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { usePrefersReducedMotion, cn, Icon } from '@/lib/design';
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
import { DailyPulseStrip } from '@/components/dashboard/DailyPulseStrip';
import { QuickActionsRail } from '@/components/dashboard/QuickActionsRail';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { AiExecutiveBriefingCard } from '@/components/ai';
import { TodayActionItemsSection } from '@/components/dashboard/TodayActionItemsSection';
import { AttendanceRiskSection } from '@/components/dashboard/AttendanceRiskSection';
import { RecentActivitiesFeed } from '@/components/dashboard/RecentActivitiesFeed';
import { LiveFaceCamera } from '@/components/dashboard/LiveFaceCamera';
import { SystemTelemetryHUD } from '@/components/telemetry/SystemTelemetryHUD';
import { ThemeAccentStudio } from '@/components/theme/ThemeAccentStudio';
import { ExecutiveSnapshotAudit } from '@/components/audit/ExecutiveSnapshotAudit';
import { ExecutiveDayEndClosingHub } from '@/components/dashboard/ExecutiveDayEndClosingHub';
import { ExecutiveCashflowForecastRadar } from '@/components/payments/ExecutiveCashflowForecastRadar';
import { ParentNpsPulseStudio } from '@/components/parent/ParentNpsPulseStudio';

/* ─────────────────────────────────────────────────────────────────────────
 * 1. Strict Domain Types & Localization Contracts (Zero `any`)
 * ─────────────────────────────────────────────────────────────────────── */

export type DashboardTabId =
  | 'overview'
  | 'operations'
  | 'kiosk'
  | 'day_end'
  | 'cashflow'
  | 'parent_nps';
export type SupportedDashboardLocale = 'uz' | 'ru' | 'en';

interface DashboardTranslationBundle {
  readonly pageTitle: string;
  readonly loadFailedTitle: string;
  readonly tabOverview: string;
  readonly tabOperations: string;
  readonly tabKiosk: string;
  readonly lastUpdatedLabel: string;
  readonly syncingLabel: string;
  readonly shortcutRefreshHint: string;
  readonly shortcutNewStudentHint: string;
  readonly analyticsRegionLabel: string;
  readonly activityRegionLabel: string;
  readonly operationsRegionLabel: string;
  readonly kioskRegionLabel: string;
  readonly kioskTelemetryTitle: string;
  readonly kioskTelemetrySubtitle: string;
  readonly presentTodayLabel: string;
  readonly presentTodaySublabel: string;
  readonly lateTodayLabel: string;
  readonly lateTodaySublabel: string;
  readonly absentTodayLabel: string;
  readonly absentTodaySublabel: string;
  readonly liveAttendanceRateLabel: string;
  readonly quickLinksHeading: string;
  readonly linkFaceDatabase: string;
  readonly linkIpCameras: string;
  readonly linkAttendanceJournal: string;
  readonly operationalHealthBadge: string;
  readonly attentionRequiredBadge: string;
}

const DASHBOARD_I18N: Readonly<
  Record<SupportedDashboardLocale, DashboardTranslationBundle>
> = {
  uz: {
    pageTitle: 'Asosiy boshqaruv paneli',
    loadFailedTitle: "Boshqaruv panelini yuklab bo'lmadi",
    tabOverview: 'Asosiy Tahlil',
    tabOperations: 'Operatsion Radar & Xavflar',
    tabKiosk: 'Jonli Face ID Kiosk',
    lastUpdatedLabel: 'Oxirgi yangilanish:',
    syncingLabel: 'Yangilanmoqda...',
    shortcutRefreshHint: 'Yangilash (R)',
    shortcutNewStudentHint: "Yangi o'quvchi (N)",
    analyticsRegionLabel: 'Moliyaviy tushum va davomat dinamikasi',
    activityRegionLabel: "So'nggi to'lovlar va eslatmalar",
    operationsRegionLabel: 'Operatsion radar va xavflar monitoringi',
    kioskRegionLabel: 'Biometrik Face ID terminali va telemetriya',
    kioskTelemetryTitle: "Kiosk Telemetriyasi & Ko'rsatkichlar",
    kioskTelemetrySubtitle:
      'Bugungi avtomatlashtirilgan kirish-chiqish statistikasi',
    presentTodayLabel: 'Bugun kelganlar',
    presentTodaySublabel: "O'z vaqtida kelgan",
    lateTodayLabel: 'Kechikkanlar',
    lateTodaySublabel: 'Kechikish qayd etilgan',
    absentTodayLabel: 'Kelmaganlar',
    absentTodaySublabel: 'Dars qoldirganlar',
    liveAttendanceRateLabel: "Bugungi umumiy qatnashish ko'rsatkichi",
    quickLinksHeading: 'Tezkor havolalar',
    linkFaceDatabase: 'Face ID Bazasi va Model Boshqaruvi',
    linkIpCameras: 'IP Kameralar va RTSP Oqimlari',
    linkAttendanceJournal: "To'liq Davomat Jurnali",
    operationalHealthBadge: 'Tizim barqaror',
    attentionRequiredBadge: 'Diqqat talab etiladi',
  },
  ru: {
    pageTitle: 'Панель управления',
    loadFailedTitle: 'Не удалось загрузить панель управления',
    tabOverview: 'Основная аналитика',
    tabOperations: 'Операционный радар и риски',
    tabKiosk: 'Живой Face ID Киоск',
    lastUpdatedLabel: 'Последнее обновление:',
    syncingLabel: 'Синхронизация...',
    shortcutRefreshHint: 'Обновить (R)',
    shortcutNewStudentHint: 'Новый ученик (N)',
    analyticsRegionLabel: 'Динамика выручки и посещаемости',
    activityRegionLabel: 'Последние платежи и напоминания',
    operationsRegionLabel: 'Операционный радар и мониторинг рисков',
    kioskRegionLabel: 'Биометрический терминал Face ID и телеметрия',
    kioskTelemetryTitle: 'Телеметрия киоска и показатели',
    kioskTelemetrySubtitle:
      'Автоматизированная статистика входов за сегодня',
    presentTodayLabel: 'Присутствуют сегодня',
    presentTodaySublabel: 'Вовремя на занятиях',
    lateTodayLabel: 'Опоздавшие',
    lateTodaySublabel: 'Зафиксировано опоздание',
    absentTodayLabel: 'Отсутствующие',
    absentTodaySublabel: 'Пропустили занятие',
    liveAttendanceRateLabel: 'Общий индекс посещаемости за сегодня',
    quickLinksHeading: 'Быстрые переходы',
    linkFaceDatabase: 'База Face ID и управление моделями',
    linkIpCameras: 'IP-камеры и потоки RTSP',
    linkAttendanceJournal: 'Полный журнал посещаемости',
    operationalHealthBadge: 'Система стабильна',
    attentionRequiredBadge: 'Требуется внимание',
  },
  en: {
    pageTitle: 'Dashboard',
    loadFailedTitle: 'Unable to load dashboard',
    tabOverview: 'Executive Overview',
    tabOperations: 'Operations Radar & Risks',
    tabKiosk: 'Live Face ID Kiosk',
    lastUpdatedLabel: 'Last updated:',
    syncingLabel: 'Syncing...',
    shortcutRefreshHint: 'Refresh (R)',
    shortcutNewStudentHint: 'New Student (N)',
    analyticsRegionLabel: 'Analytics and Performance',
    activityRegionLabel: 'Recent Activity and Follow-ups',
    operationsRegionLabel: 'Operations Radar and Risk Monitoring',
    kioskRegionLabel: 'Biometric Face ID Terminal and Telemetry',
    kioskTelemetryTitle: 'Kiosk Telemetry & Metrics',
    kioskTelemetrySubtitle: "Today's automated check-in and gate statistics",
    presentTodayLabel: 'Present Today',
    presentTodaySublabel: 'Checked in on time',
    lateTodayLabel: 'Late Arrivals',
    lateTodaySublabel: 'Marked late at gate',
    absentTodayLabel: 'Absent Today',
    absentTodaySublabel: 'Recorded absent',
    liveAttendanceRateLabel: "Today's Real-Time Attendance Index",
    quickLinksHeading: 'Quick Navigation',
    linkFaceDatabase: 'Face ID Gallery & Model Management',
    linkIpCameras: 'IP Cameras & RTSP Streams',
    linkAttendanceJournal: 'Complete Attendance Register',
    operationalHealthBadge: 'All Systems Nominal',
    attentionRequiredBadge: 'Action Required',
  },
};

function resolveDashboardLocale(
  i18nContext: ReturnType<typeof useSafeI18n>,
): SupportedDashboardLocale {
  const rawLang =
    Reflect.get(i18nContext, 'lang') ?? Reflect.get(i18nContext, 'locale');
  if (typeof rawLang === 'string') {
    const lower = rawLang.toLowerCase();
    if (lower.startsWith('ru')) return 'ru';
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('uz')) return 'uz';
  }
  return 'uz';
}

/* ─────────────────────────────────────────────────────────────────────────
 * 2. Spring Physics & Staggered Reveal Variants
 * ─────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────
 * 3. Pure Financial & Telemetry Calculation Helpers
 * ─────────────────────────────────────────────────────────────────────── */

/**
 * Safely coerces Prisma Decimal strings, numbers, or nullish values into
 * finite non-negative numbers.
 */
function coerceFiniteAmount(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) return 0;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toString' in value &&
    typeof value.toString === 'function'
  ) {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Computes the percentage share of paid revenue relative to total billed
 * obligations (`totalPaid / (totalPaid + totalPending + totalOverdue)`).
 * Safely handles Prisma Decimal strings, zero-division, and edge cases.
 */
export function calculatePaidShare(stats: DashboardStats): number {
  const paid = coerceFiniteAmount(stats.totalPaid);
  const pending = coerceFiniteAmount(stats.totalPending);
  const overdue = coerceFiniteAmount(stats.totalOverdue);
  const total = paid + pending + overdue;
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((paid / total) * 100)));
}

function isValidDashboardTab(value: string | null): value is DashboardTabId {
  return (
    value === 'overview' ||
    value === 'operations' ||
    value === 'kiosk' ||
    value === 'day_end' ||
    value === 'cashflow' ||
    value === 'parent_nps'
  );
}

const DEDICATED_PORTAL_ROLES: ReadonlySet<string> = new Set([
  'PARENT',
  'TEACHER',
  'STUDENT',
]);

/* ─────────────────────────────────────────────────────────────────────────
 * 4. Main Flagship Executive Command Center Component
 * ─────────────────────────────────────────────────────────────────────── */

export function DashboardPage() {
  const i18nContext = useSafeI18n();
  const { t } = i18nContext;
  const locale = useMemo(
    () => resolveDashboardLocale(i18nContext),
    [i18nContext],
  );
  const dict = DASHBOARD_I18N[locale];

  usePageTitle(t('dashboard.title') || dict.pageTitle);

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();

  const tabParam = searchParams.get('tab');
  const initialTab: DashboardTabId = isValidDashboardTab(tabParam)
    ? tabParam
    : 'overview';
  const [activeTab, setActiveTab] = useState<DashboardTabId>(initialTab);

  // Keep activeTab synchronized if searchParams change externally (e.g. Back/Forward navigation)
  useEffect(() => {
    const currentUrlTab = searchParams.get('tab');
    const resolvedTab: DashboardTabId = isValidDashboardTab(currentUrlTab)
      ? currentUrlTab
      : 'overview';
    setActiveTab((prev) => (prev !== resolvedTab ? resolvedTab : prev));
  }, [searchParams]);

  const handleTabChange = useCallback(
    (tab: DashboardTabId) => {
      sound.playPop();
      setActiveTab(tab);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'overview') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: true },
      );
    },
    [sound, setSearchParams],
  );

  /* ── Role-Based Landing Redirects & Query Gate ────────────────── */
  const role = user?.role?.toUpperCase() ?? '';
  const isDedicatedRole = DEDICATED_PORTAL_ROLES.has(role);

  useEffect(() => {
    if (role === 'PARENT') {
      navigate('/parent-portal', { replace: true });
    } else if (role === 'TEACHER') {
      navigate('/attendance', { replace: true });
    } else if (role === 'STUDENT') {
      navigate('/schedule', { replace: true });
    }
  }, [role, navigate]);

  const {
    data,
    dataUpdatedAt,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
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

  const [isTelemetryHudOpen, setIsTelemetryHudOpen] = useState(false);
  const [isThemeStudioOpen, setIsThemeStudioOpen] = useState(false);
  const [isAuditSnapshotOpen, setIsAuditSnapshotOpen] = useState(false);

  /* ── Executive Keyboard Shortcuts (`R` Refresh, `N` / `⌘N` New Student) ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        /INPUT|TEXTAREA|SELECT/.test(target?.tagName || '') ||
        Boolean(target?.isContentEditable);
      if (inInput) return;

      const keyLower = e.key.toLowerCase();

      if (
        ((e.metaKey || e.ctrlKey) && keyLower === 'n') ||
        (!e.metaKey && !e.ctrlKey && !e.altKey && keyLower === 'n')
      ) {
        e.preventDefault();
        sound.playPop();
        navigate('/students/new');
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey && keyLower === 'r') {
        e.preventDefault();
        void handleManualRefresh();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, handleManualRefresh, sound]);

  const stats: DashboardStats | undefined = data;

  const paidShare = useMemo(
    () => (stats ? calculatePaidShare(stats) : 0),
    [stats],
  );

  const revenueTrend = useMemo(
    () =>
      (stats?.monthlyRevenue ?? []).map((item) =>
        coerceFiniteAmount(item.total),
      ),
    [stats?.monthlyRevenue],
  );

  const operationsAlertActive = useMemo(() => {
    if (!stats) return false;
    const followUpsCount = stats.upcomingFollowUps?.length ?? 0;
    const overdueAmount = coerceFiniteAmount(stats.totalOverdue);
    return followUpsCount > 0 || overdueAmount > 0;
  }, [stats]);

  const kioskTelemetry = useMemo(() => {
    const todayStats = stats?.todayAttendanceStats ?? [];
    const presentCount =
      todayStats.find((s) => s.status === 'PRESENT')?.count ?? 0;
    const lateCount = todayStats.find((s) => s.status === 'LATE')?.count ?? 0;
    const absentCount =
      todayStats.find((s) => s.status === 'ABSENT')?.count ?? 0;
    const excusedCount =
      todayStats.find((s) => s.status === 'EXCUSED')?.count ?? 0;
    const totalRecorded = presentCount + lateCount + absentCount + excusedCount;
    const rate =
      totalRecorded > 0
        ? Math.round(((presentCount + lateCount) / totalRecorded) * 100)
        : coerceFiniteAmount(stats?.attendanceRate);

    return {
      presentCount,
      lateCount,
      absentCount,
      totalRecorded,
      rate: Math.min(100, Math.max(0, rate)),
    };
  }, [stats?.todayAttendanceStats, stats?.attendanceRate]);

  const formattedUpdatedAt = useMemo(() => {
    if (!dataUpdatedAt) return '—';
    return new Date(dataUpdatedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [dataUpdatedAt]);

  /* ── Loading & Error States ───────────────────────────────────── */
  if (isLoading && !stats) {
    return (
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] px-3 sm:px-6 lg:px-8 py-4">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || (!stats && !isDedicatedRole)) {
    const safeError =
      error instanceof Error
        ? error
        : new Error(String(error ?? dict.loadFailedTitle));

    return (
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] px-3 sm:px-6 lg:px-8 py-8">
        <GlassSurface
          tone="frost"
          className="rounded-[2.25rem] p-8 border border-black/[0.08] dark:border-white/[0.14] bg-white/80 dark:bg-[#161618]/80 backdrop-blur-3xl shadow-2xl"
        >
          <GlassErrorState
            title={t('dashboard.loadFailed') || dict.loadFailedTitle}
            message={getErrorMessage(safeError)}
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
      aria-label={t('dashboard.title', dict.pageTitle)}
      variants={CONTAINER_VARIANTS}
      initial={reduced ? false : 'hidden'}
      animate="visible"
      className="w-full max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] min-w-0 mx-auto space-y-5 sm:space-y-6 px-3 sm:px-6 lg:px-8 pt-1 sm:pt-2 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      {/* Ambient Corporate Aurora Mesh */}
      <AuroraMesh variant="corporate" opacity={0.65} />

      {/* 1. Executive Header */}
      <motion.div
        variants={SECTION_VARIANTS}
        className="w-full min-w-0 max-w-full"
      >
        <DashboardHeader
          userName={user?.firstName}
          orgName={user?.organization?.name}
          stats={stats}
          onRefresh={handleManualRefresh}
          isRefreshing={isFetching}
        />
      </motion.div>

      {/* 2. Liquid Glass Segmented Tab Controller & Live Telemetry Bar */}
      <motion.div
        variants={SECTION_VARIANTS}
        className="w-full min-w-0 max-w-full flex flex-wrap items-center justify-between gap-3"
      >
        <div
          role="tablist"
          aria-label={t('dashboard.title', dict.pageTitle)}
          className="vision-card flex items-center gap-1.5 p-1.5 rounded-2xl sm:rounded-full border border-white/60 bg-white/70 backdrop-blur-2xl shadow-sm dark:border-white/10 dark:bg-white/[0.05] overflow-x-auto w-full sm:w-auto max-w-full no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => handleTabChange('overview')}
            className={cn(
              'inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all duration-200',
              activeTab === 'overview'
                ? 'jewel-pill jewel-blue shadow-md font-extrabold'
                : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
            )}
          >
            <Icon name="barChart" size={14} />
            <span>{t('dashboard.tabOverview', dict.tabOverview)}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'operations'}
            onClick={() => handleTabChange('operations')}
            className={cn(
              'inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all duration-200',
              activeTab === 'operations'
                ? 'jewel-pill jewel-amber shadow-md font-extrabold'
                : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
            )}
          >
            <Icon name="alert" size={14} />
            <span>{t('dashboard.tabOperations', dict.tabOperations)}</span>
            {operationsAlertActive && (
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'kiosk'}
            onClick={() => handleTabChange('kiosk')}
            className={cn(
              'inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all duration-200',
              activeTab === 'kiosk'
                ? 'jewel-pill jewel-emerald shadow-md font-extrabold'
                : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
            )}
          >
            <Icon name="video" size={14} />
            <span>{t('dashboard.tabKiosk', dict.tabKiosk)}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'day_end'}
            onClick={() => handleTabChange('day_end')}
            className={cn(
              'inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all duration-200',
              activeTab === 'day_end'
                ? 'jewel-pill jewel-indigo shadow-md font-extrabold'
                : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
            )}
          >
            <span className="text-sm">🌙</span>
            <span>Kun Yakuni (20:00)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cashflow'}
            onClick={() => handleTabChange('cashflow')}
            className={cn(
              'inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all duration-200',
              activeTab === 'cashflow'
                ? 'jewel-pill jewel-emerald shadow-md font-extrabold'
                : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
            )}
          >
            <span className="text-sm">💰</span>
            <span>90-Kunlik Kassa Radari</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'parent_nps'}
            onClick={() => handleTabChange('parent_nps')}
            className={cn(
              'inline-flex shrink-0 whitespace-nowrap items-center gap-2 rounded-full px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-bold transition-all duration-200',
              activeTab === 'parent_nps'
                ? 'jewel-pill jewel-rose shadow-md font-extrabold'
                : 'text-[var(--text-secondary,#86868B)] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:text-white',
            )}
          >
            <span className="text-sm">❤️</span>
            <span>Ota-onalar NPS</span>
          </button>
        </div>

        {/* Right Telemetry & Executive Keyboard Shortcut Pill */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Executive Diagnostic & Appearance Utility Pill Group */}
          <div className="flex items-center gap-1 rounded-full border border-black/[0.06] bg-white/60 p-1 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsTelemetryHudOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-sky-600 hover:bg-sky-500/15 dark:text-sky-400 dark:hover:bg-sky-500/20 transition-all"
              title="Jonli Uskunalar va RTT Telemetriyasi"
              aria-label="Telemetriya"
            >
              <Icon name="activity" size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsAuditSnapshotOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400 dark:hover:bg-emerald-500/20 transition-all"
              title="SHA-256 Auditorlik Snapshot"
              aria-label="Audit Snapshot"
            >
              <Icon name="shieldCheck" size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                sound.playTick();
                setIsThemeStudioOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-purple-600 hover:bg-purple-500/15 dark:text-purple-400 dark:hover:bg-purple-500/20 transition-all"
              title="Mavzu va Urg'u Palitrasi"
              aria-label="Mavzu Palitrasi"
            >
              <Icon name="sparkles" size={14} />
            </button>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/60 px-3 py-1 text-xs font-medium text-[var(--text-secondary,#86868B)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                isFetching
                  ? 'animate-pulse bg-amber-400'
                  : 'bg-emerald-500',
              )}
              aria-hidden="true"
            />
            <span>
              {isFetching ? dict.syncingLabel : dict.lastUpdatedLabel}{' '}
              <strong className="text-[var(--text-primary,#1D1D1F)] dark:text-white tabular-nums">
                {formattedUpdatedAt}
              </strong>
            </span>
          </div>

          <div
            className="hidden lg:inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/50 px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary,#86868B)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03]"
            title={`${dict.shortcutRefreshHint} · ${dict.shortcutNewStudentHint}`}
          >
            <kbd className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-primary,#1D1D1F)] dark:bg-white/10 dark:text-white">
              R
            </kbd>
            <span className="opacity-75">Sync</span>
            <span className="mx-0.5 opacity-30">·</span>
            <kbd className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-primary,#1D1D1F)] dark:bg-white/10 dark:text-white">
              N
            </kbd>
            <span className="opacity-75">+Student</span>
          </div>
        </div>
      </motion.div>

      {/* 3. Tab Viewports */}
      <AnimatePresence mode="wait" initial={false}>
        {activeTab === 'overview' && (
          <motion.div
            key="tab-overview"
            variants={CONTAINER_VARIANTS}
            initial={reduced ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="space-y-5 sm:space-y-6"
          >
            <motion.div variants={SECTION_VARIANTS}>
              <AiExecutiveBriefingCard />
            </motion.div>

            <motion.div variants={SECTION_VARIANTS}>
              <DailyPulseStrip stats={stats} updatedAt={dataUpdatedAt} />
            </motion.div>

            <motion.div variants={SECTION_VARIANTS}>
              <QuickActionsRail />
            </motion.div>

            <motion.div variants={SECTION_VARIANTS}>
              <KPIGrid
                stats={stats}
                paidShare={paidShare}
                revenueTrend={revenueTrend}
              />
            </motion.div>

            <motion.section
              variants={SECTION_VARIANTS}
              aria-label={dict.analyticsRegionLabel}
              className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]"
            >
              <RevenueSection initialData={stats.monthlyRevenue ?? []} />
              <AttendanceSection
                stats={stats.attendanceStats ?? []}
                overallRate={stats.attendanceRate}
              />
            </motion.section>

            <motion.section
              variants={SECTION_VARIANTS}
              aria-label={dict.activityRegionLabel}
              className="grid grid-cols-1 gap-6 xl:grid-cols-2"
            >
              <RecentPayments payments={stats.recentPayments ?? []} />
              <FollowUpsSection followUps={stats.upcomingFollowUps ?? []} />
            </motion.section>
          </motion.div>
        )}

        {activeTab === 'operations' && (
          <motion.div
            key="tab-operations"
            role="region"
            aria-label={dict.operationsRegionLabel}
            variants={SECTION_VARIANTS}
            initial={reduced ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <TodayActionItemsSection stats={stats} />
              <AttendanceRiskSection />
            </div>
            <div>
              <RecentActivitiesFeed />
            </div>
          </motion.div>
        )}

        {activeTab === 'kiosk' && (
          <motion.div
            key="tab-kiosk"
            role="region"
            aria-label={dict.kioskRegionLabel}
            variants={SECTION_VARIANTS}
            initial={reduced ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]"
          >
            <LiveFaceCamera />

            <div className="vision-card relative isolate overflow-hidden flex flex-col p-6 backdrop-blur-2xl">
              {/* Top Specular Highlight Border */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/25"
              />

              {/* Kiosk Card Header */}
              <div className="flex items-center justify-between gap-2.5 border-b border-black/[0.06] pb-3.5 dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 text-white shadow-md">
                    <Icon name="checkCircle" size={18} strokeWidth={2.2} />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-white">
                      {dict.kioskTelemetryTitle}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary,#86868B)]">
                      {dict.kioskTelemetrySubtitle}
                    </p>
                  </div>
                </div>

                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                    kioskTelemetry.rate >= 85
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {kioskTelemetry.rate}%
                </span>
              </div>

              {/* Biometric Gate Counter Grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-black/[0.05] bg-white/50 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <span className="text-xs font-semibold text-[var(--text-secondary,#86868B)]">
                    {dict.presentTodayLabel}
                  </span>
                  <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {kioskTelemetry.presentCount}
                  </p>
                  <span className="text-[10.5px] text-[var(--text-secondary,#86868B)]">
                    {dict.presentTodaySublabel}
                  </span>
                </div>

                <div className="rounded-2xl border border-black/[0.05] bg-white/50 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <span className="text-xs font-semibold text-[var(--text-secondary,#86868B)]">
                    {dict.lateTodayLabel}
                  </span>
                  <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {kioskTelemetry.lateCount}
                  </p>
                  <span className="text-[10.5px] text-[var(--text-secondary,#86868B)]">
                    {dict.lateTodaySublabel}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 rounded-2xl border border-black/[0.05] bg-white/50 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <span className="text-xs font-semibold text-[var(--text-secondary,#86868B)]">
                    {dict.absentTodayLabel}
                  </span>
                  <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {kioskTelemetry.absentCount}
                  </p>
                  <span className="text-[10.5px] text-[var(--text-secondary,#86868B)]">
                    {dict.absentTodaySublabel}
                  </span>
                </div>
              </div>

              {/* Live Attendance Rate Progress Bar */}
              <div className="mt-4 rounded-2xl border border-black/[0.05] bg-white/40 p-3.5 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-[var(--text-secondary,#86868B)]">
                    {dict.liveAttendanceRateLabel}
                  </span>
                  <span className="font-extrabold text-[var(--text-primary,#1D1D1F)] dark:text-white tabular-nums">
                    {kioskTelemetry.rate}%
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 transition-all duration-500"
                    style={{ width: `${kioskTelemetry.rate}%` }}
                  />
                </div>
              </div>

              {/* Quick Kiosk Navigation Links */}
              <div className="mt-6 flex-1 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary,#86868B)]">
                  {dict.quickLinksHeading}
                </h4>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      navigate('/face');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-black/[0.06] bg-white/60 hover:bg-white hover:border-black/[0.1] transition-all text-xs font-bold text-[var(--text-primary,#1D1D1F)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="user" size={15} />
                      <span>{dict.linkFaceDatabase}</span>
                    </span>
                    <Icon name="chevronRight" size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      navigate('/cameras');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-black/[0.06] bg-white/60 hover:bg-white hover:border-black/[0.1] transition-all text-xs font-bold text-[var(--text-primary,#1D1D1F)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="video" size={15} />
                      <span>{dict.linkIpCameras}</span>
                    </span>
                    <Icon name="chevronRight" size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sound.playTick();
                      navigate('/attendance');
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-black/[0.06] bg-white/60 hover:bg-white hover:border-black/[0.1] transition-all text-xs font-bold text-[var(--text-primary,#1D1D1F)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:text-white"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="checkCircle" size={15} />
                      <span>{dict.linkAttendanceJournal}</span>
                    </span>
                    <Icon name="chevronRight" size={14} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'day_end' && (
          <motion.div
            key="tab-day-end"
            variants={CONTAINER_VARIANTS}
            initial={reduced ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="space-y-5 sm:space-y-6"
          >
            <ExecutiveDayEndClosingHub />
          </motion.div>
        )}

        {activeTab === 'cashflow' && (
          <motion.div
            key="tab-cashflow"
            variants={CONTAINER_VARIANTS}
            initial={reduced ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="space-y-5 sm:space-y-6"
          >
            <ExecutiveCashflowForecastRadar />
          </motion.div>
        )}

        {activeTab === 'parent_nps' && (
          <motion.div
            key="tab-parent-nps"
            variants={CONTAINER_VARIANTS}
            initial={reduced ? false : 'hidden'}
            animate="visible"
            exit={{ opacity: 0 }}
            className="space-y-5 sm:space-y-6"
          >
            <ParentNpsPulseStudio />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live System Telemetry HUD */}
      <SystemTelemetryHUD
        isOpen={isTelemetryHudOpen}
        onClose={() => setIsTelemetryHudOpen(false)}
      />

      {/* Spatial Appearance & Accent Studio */}
      <ThemeAccentStudio
        isOpen={isThemeStudioOpen}
        onClose={() => setIsThemeStudioOpen(false)}
      />

      {/* Cryptographic Executive Audit Snapshot */}
      <ExecutiveSnapshotAudit
        isOpen={isAuditSnapshotOpen}
        onClose={() => setIsAuditSnapshotOpen(false)}
        orgName={user?.organization?.name}
      />
    </motion.div>
  );
}

export default DashboardPage;
