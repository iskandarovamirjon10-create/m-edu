import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import {
  PageHeader,
  PageLoader,
  ErrorState,
  EmptyState,
  statusColor,
} from '@/components/ui';
import { formatCurrency, formatDate, formatMonth } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { DashboardStats, MonthlyRevenue, AttendanceStat } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
export function calculatePaidShare(stats: DashboardStats): number {
  const totalPaid = Number(stats.totalPaid) || 0;
  const totalPending = Number(stats.totalPending) || 0;
  const totalOverdue = Number(stats.totalOverdue) || 0;
  const total = totalPaid + totalPending + totalOverdue;
  if (total === 0) return 0;
  return Math.round((totalPaid / total) * 100);
}

function getMaxRevenue(monthlyRevenue: MonthlyRevenue[]): number {
  return Math.max(1, ...monthlyRevenue.map((m) => m.total));
}

function formatStudentName(
  payment: { student?: { user?: { firstName?: string; lastName?: string } } },
  fallback: string,
): string {
  const firstName = payment.student?.user?.firstName;
  const lastName = payment.student?.user?.lastName;
  return [firstName, lastName].filter(Boolean).join(' ') || fallback;
}

function formatLeadName(
  lead: { firstName?: string | null; lastName?: string | null },
  fallback: string,
): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || fallback;
}

function toGlassBadgeColor(color: string): string {
  const BADGE_COLOR_MAP: Record<string, string> = {
    green: 'success',
    red: 'error',
    amber: 'warning',
    blue: 'primary',
    slate: 'muted',
    purple: 'azure',
  };
  return BADGE_COLOR_MAP[color] || 'muted';
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Orb Backdrop                                                             */
/* ────────────────────────────────────────────────────────────────────────── */
function OrbBackdrop() {
  return null;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Mini Sparkline                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 28;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Revenue Area Chart                                                        */
/* ────────────────────────────────────────────────────────────────────────── */
function RevenueChart({ monthlyRevenue, maxRevenue }: { monthlyRevenue: MonthlyRevenue[]; maxRevenue: number }) {
  const { t } = useI18n();
  if (!monthlyRevenue || monthlyRevenue.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.noRevenue')}
        message={t('dashboard.noRevenueHint')}
      />
    );
  }

  const h = 160; // max bar height in px

  return (
    <div className="relative">
      <div
        className="flex items-end gap-2"
        style={{ height: `${h}px` }}
        role="img"
        aria-label={t('dashboard.revenueChartLabel')}
      >
        {monthlyRevenue.map((month) => {
          const barH = Math.max(4, (month.total / maxRevenue) * h);
          return (
            <div
              key={month.month}
              className="relative flex-1 group"
              title={`${formatMonth(month.month)}: ${formatCurrency(month.total)}`}
            >
              {/* Tooltip */}
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {formatMonth(month.month)}
                <br />
                <span style={{ color: 'var(--m-vivid)' }}>{formatCurrency(month.total)}</span>
              </div>
              {/* Bar */}
              <div
                className="w-full rounded-t-sm transition-all duration-300 group-hover:opacity-80"
                style={{
                  height: `${barH}px`,
                  background: 'linear-gradient(180deg, var(--m-vivid) 0%, rgba(84,115,252,0.5) 100%)',
                }}
              />
            </div>
          );
        })}
      </div>
      {/* X axis labels */}
      <div className="flex mt-2">
        {monthlyRevenue.map((month) => (
          <div key={month.month} className="flex-1 text-center">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {month.month.slice(0, 3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Attendance Ring                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
function AttendanceRing({ stats }: { stats: AttendanceStat[] }) {
  const { t } = useI18n();
  const statusLabels: Record<string, string> = {
    PRESENT: t('attendance.present'),
    ABSENT: t('attendance.absent'),
    LATE: t('attendance.late'),
    EXCUSED: t('attendance.excused'),
  };
  const total = stats.reduce((s, a) => s + a.count, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const colors: Record<string, string> = {
    PRESENT: 'var(--state-success)',
    ABSENT: 'var(--state-error)',
    LATE: 'var(--state-warning)',
  };
  const segments = stats.map((s) => {
    const pct = s.count / total;
    const start = cumulative;
    cumulative += pct;
    return { ...s, pct, start, color: colors[s.status] || 'var(--text-muted)' };
  });

  const cx = 40;
  const cy = 40;
  const r = 32;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-6">
      {/* SVG donut */}
      <div className="relative shrink-0">
        <svg width={80} height={80} viewBox="0 0 80 80">
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={8} />
          {/* Segments */}
          {segments.map((seg) => {
            const dash = seg.pct * circumference;
            const offset = (1 - seg.start) * circumference;
            return (
              <circle
                key={seg.status}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={8}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s ease' }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{total}</span>
          <span className="text-[9px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('dashboard.records')}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {stats.map((s) => (
          <div key={s.status} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: colors[s.status] || 'var(--text-muted)' }}
            />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {statusLabels[s.status] ?? s.status}
            </span>
            <span className="text-xs font-semibold ml-auto pl-4" style={{ color: 'var(--text-primary)' }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Activity Timeline Item                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
function TimelineItem({
  title,
  subtitle,
  badge,
  badgeColor,
  time,
  accentColor,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  time: string;
  accentColor?: string;
}) {
  return (
    <div className="group flex items-start gap-3 py-3">
      {/* Accent dot + line */}
      <div className="flex flex-col items-center gap-1 pt-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: accentColor || 'var(--m-vivid)' }}
        />
        <span
          className="w-px flex-1 min-h-4"
          style={{ background: 'var(--border-subtle)', minHeight: '16px' }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[0.8125rem] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {title}
          </p>
          {badge && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
              style={{
                background: 'rgba(84,115,252,0.10)',
                color: badgeColor || 'var(--m-vivid)',
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[0.75rem] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      <span className="text-[11px] shrink-0 mt-1.5" style={{ color: 'var(--text-muted)' }}>
        {time}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Payment Row                                                              */
/* ────────────────────────────────────────────────────────────────────────── */
function PaymentRow({
  payment,
  maxAmount,
}: {
  payment: DashboardStats['recentPayments'][0];
  maxAmount: number;
}) {
  const { t } = useI18n();
  const name = formatStudentName(payment, t('dashboard.student'));
  const barWidth = maxAmount > 0 ? Math.round((Number(payment.amount) / maxAmount) * 100) : 0;
  const variant = toGlassBadgeColor(statusColor(payment.status));

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      {/* Avatar initials */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(148,234,239,0.2) 0%, rgba(84,115,252,0.15) 100%)',
          color: 'var(--m-vivid)',
        }}
      >
        {name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[0.8125rem] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {name}
          </p>
          <span className="text-[0.8125rem] font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
            {formatCurrency(payment.amount)}
          </span>
        </div>
        {/* Mini progress bar */}
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'var(--border-subtle)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${barWidth}%`,
              background: 'linear-gradient(90deg, var(--m-vivid) 0%, var(--m-cyan) 100%)',
            }}
          />
        </div>
      </div>

      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
        style={{
          background: variant === 'success' ? 'rgba(94,230,168,0.10)' :
                      variant === 'error'   ? 'rgba(240,112,112,0.10)' :
                      variant === 'warning' ? 'rgba(245,184,106,0.10)' :
                      'rgba(84,115,252,0.10)',
          color: variant === 'success' ? 'var(--state-success)' :
                 variant === 'error'   ? 'var(--state-error)' :
                 variant === 'warning' ? 'var(--state-warning)' :
                 'var(--m-vivid)',
        }}
      >
        {t(`payments.status.${payment.status}`)}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Stat Card                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  sub,
  icon,
  sparkline,
  gradient,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  sparkline?: number[];
  gradient: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 group transition-all duration-300 hover:translate-y-px"
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
        border: '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Reflection */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.20) 0%, transparent 50%)',
          borderRadius: 'inherit',
        }}
      />
      {/* Subtle brand accent */}
      <div
        aria-hidden
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20"
        style={{ background: gradient, transform: 'translate(30%, -30%)' }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(84,115,252,0.10)',
              color: 'var(--m-vivid)',
            }}
          >
            {icon}
          </div>
          {sparkline && sparkline.length > 1 && <MiniSparkline values={sparkline} color="var(--m-vivid)" />}
        </div>
        <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
          {value}
        </p>
        <p className="text-[0.8125rem] font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </p>
        {sub && (
          <p className="text-[0.75rem] mt-1" style={{ color: 'var(--text-muted)' }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Dashboard Page                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
export function DashboardPage() {
  const { t } = useI18n();
  usePageTitle(t('dashboard.title'));

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    placeholderData: (previousData) => previousData,
    staleTime: 30 * 1000,
  });

  const stats = useMemo(() => data as DashboardStats | undefined, [data]);
  const paidShare = useMemo(() => (stats ? calculatePaidShare(stats) : 0), [stats]);
  const maxRevenue = useMemo(
    () => (stats?.monthlyRevenue ? getMaxRevenue(stats.monthlyRevenue) : 1),
    [stats],
  );

  // Sparkline data from monthly revenue totals
  const revenueSparkline = useMemo(
    () => stats?.monthlyRevenue?.map((m) => m.total) ?? [],
    [stats?.monthlyRevenue],
  );

  const handleRetry = useCallback(() => { void refetch(); }, [refetch]);

  const maxPayment = useMemo(
    () => Math.max(1, ...(stats?.recentPayments ?? []).map((p) => Number(p.amount))),
    [stats?.recentPayments],
  );

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading && !stats) {
    return (
      <>
        <OrbBackdrop />
        <div className="page-container space-y-4">
          <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
          <div
            className="rounded-2xl p-8 flex items-center justify-center"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <PageLoader label={t('dashboard.loading')} />
          </div>
        </div>
      </>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (isError || !stats) {
    return (
      <>
        <OrbBackdrop />
        <div className="page-container space-y-4">
          <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px)',
              border: '1px solid var(--border-glass)',
            }}
          >
            <ErrorState
              title={t('dashboard.loadFailed')}
              message={getErrorMessage(error as Error)}
              onRetry={handleRetry}
            />
          </div>
        </div>
      </>
    );
  }

  // ── Max payment amount for bar widths ──────────────────────────────────────
  return (
    <>
      <OrbBackdrop />
      <div className="page-container space-y-8">

        {/* Page header */}
        <PageHeader
          title={t('dashboard.title')}
          description={t('dashboard.description')}
        />

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.activeStudents')}
            value={stats.totalStudents.toLocaleString()}
            sub={t('dashboard.activeStudentsSub', { count: stats.activeStudents })}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" />
              </svg>
            }
            sparkline={revenueSparkline.slice(-8)}
            gradient="var(--m-cyan)"
          />
          <StatCard
            label={t('dashboard.activeGroups')}
            value={stats.activeGroups.toLocaleString()}
            sub={t('dashboard.activeGroupsSub', { count: stats.activeGroups })}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            }
            gradient="var(--m-vivid)"
          />
          <StatCard
            label={t('dashboard.revenueCollected')}
            value={formatCurrency(stats.totalPaid)}
            sub={t('dashboard.revenueSub', {
              rate: paidShare,
              pending: formatCurrency(stats.totalPending),
            })}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
            sparkline={revenueSparkline.slice(-8)}
            gradient="#2ea870"
          />
          <StatCard
            label={t('dashboard.leadConversion')}
            value={`${stats.conversionRate}%`}
            sub={t('dashboard.leadSub', {
              newCount: stats.newLeadsThisMonth,
              total: stats.totalLeads,
            })}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            }
            gradient="rgba(148,234,239,1)"
          />
        </div>

        {/* ── Main content grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Revenue chart — spans 2 columns */}
          <div
            className="lg:col-span-2 overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            {/* Reflection */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 50%)' }}
            />
            <div className="relative z-10 p-5">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {t('dashboard.monthlyRevenue')}
                  </h2>
                  <p className="text-[0.75rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {t('dashboard.paymentCollection')}
                  </p>
                </div>
                <Link
                  to="/payments"
                  className="text-[0.8125rem] font-medium transition-all hover:opacity-80 active:scale-95"
                  style={{ color: 'var(--m-vivid)' }}
                >
                  {t('dashboard.viewPayments')} →
                </Link>
              </div>
              <RevenueChart monthlyRevenue={stats.monthlyRevenue ?? []} maxRevenue={maxRevenue} />
            </div>
          </div>

          {/* Attendance donut — 1 column */}
          <div
            className="glass-card overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 50%)' }}
            />
            <div className="relative z-10 p-5">
              <div className="mb-5">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('dashboard.attendance')}
                </h2>
                <p className="text-[0.75rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboard.last30Days')}
                </p>
              </div>
              {stats.attendanceStats && stats.attendanceStats.length > 0 ? (
                <>
                  <AttendanceRing stats={stats.attendanceStats} />
                  {/* Collection rate bar */}
                  <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('dashboard.collectionRate')}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--m-vivid)' }}>
                        {paidShare}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: 'var(--border-subtle)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${paidShare}%`,
                          background: 'linear-gradient(90deg, var(--m-vivid) 0%, var(--m-cyan) 100%)',
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(stats.totalPaid)} {t('dashboard.paid')}
                      </span>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(stats.totalOverdue)} {t('dashboard.overdue')}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('dashboard.noAttendance')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Recent activity grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Recent Payments */}
          <div
            className="overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 50%)' }}
            />
            <div className="relative z-10">
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('dashboard.recentPayments')}
                </h2>
                <Link
                  to="/payments"
                  className="text-[0.8125rem] font-medium transition-all hover:opacity-80 active:scale-95"
                  style={{ color: 'var(--m-vivid)' }}
                >
                  {t('dashboard.viewAll')} →
                </Link>
              </div>
              {stats.recentPayments && stats.recentPayments.length > 0 ? (
                <div className="px-5 divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {stats.recentPayments.slice(0, 5).map((payment) => (
                    <PaymentRow key={payment.id} payment={payment} maxAmount={maxPayment} />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8">
                  <EmptyState
                    title={t('dashboard.noPayments')}
                    message={t('dashboard.noPaymentsHint')}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Follow-ups */}
          <div
            className="overflow-hidden"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(24px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
              border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, transparent 50%)' }}
            />
            <div className="relative z-10">
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('dashboard.upcomingFollowUps')}
                </h2>
                <Link
                  to="/leads"
                  className="text-[0.8125rem] font-medium transition-all hover:opacity-80 active:scale-95"
                  style={{ color: 'var(--m-vivid)' }}
                >
                  {t('dashboard.viewLeads')} →
                </Link>
              </div>
              {stats.upcomingFollowUps && stats.upcomingFollowUps.length > 0 ? (
                <div className="px-5">
                  {stats.upcomingFollowUps.slice(0, 5).map((followUp) => (
                    <TimelineItem
                      key={followUp.id}
                      title={formatLeadName(followUp.lead || {}, t('dashboard.lead'))}
                      subtitle={followUp.note || undefined}
                      badge={t('dashboard.scheduled')}
                      badgeColor="var(--m-vivid)"
                      time={formatDate(followUp.scheduledAt)}
                      accentColor="var(--m-cyan)"
                    />
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8">
                  <EmptyState
                    title={t('dashboard.noFollowUps')}
                    message={t('dashboard.noFollowUpsHint')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
