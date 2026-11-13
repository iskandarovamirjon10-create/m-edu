/**
 * ============================================================================
 * DailyPulseStrip v1.0 — "Bugun" operations ribbon (Apple Studio Liquid Glass)
 * ============================================================================
 * New capability:
 *  The dashboard API already returns today-scoped telemetry (lessons scheduled,
 *  today's attendance mix, collected revenue, open follow-ups) but the
 *  workspace never surfaced it in one place. This ribbon turns that data into
 *  a single glanceable "operating pulse" with one-tap deep links.
 *
 * Craft:
 *  - Refractive glass ribbon: specular hairline + ambient caustic blooms
 *  - Animated counters and an animated attendance composition bar
 *  - Staggered entrance, reduced-motion safe, keyboard/link native
 *  - Responsive 1 → 2 → 4 columns without horizontal scroll down to 320px
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn, CountUp, Icon, usePrefersReducedMotion, type IconName } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';
import type { DashboardStats } from '@/lib/types';

type PulseSource = Pick<
  DashboardStats,
  | 'todayRevenue'
  | 'todayPaymentsCount'
  | 'todayLessonsCount'
  | 'todayAttendanceStats'
  | 'upcomingFollowUps'
  | 'leadByStage'
>;

export interface DailyPulse {
  lessonsToday: number;
  revenueToday: number;
  paymentsToday: number;
  /** Attendance records marked today (present + late + absent + excused). */
  marked: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  inClass: number;
  attendanceRate: number | null;
  /** Open follow-ups scheduled later today. */
  tasksDue: number;
  /** Open follow-ups whose scheduled time already passed. */
  tasksOverdue: number;
  newLeads: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const TIME_FORMATTER = new Intl.DateTimeFormat('uz-UZ', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Pure derivation of the daily pulse — exported for unit tests.
 * Attendance rate mirrors the KPI card contract: in-class / all marked records.
 */
export function computeDailyPulse(
  stats: PulseSource | undefined,
  now: Date = new Date(),
): DailyPulse {
  const attendance = new Map<string, number>();
  for (const item of stats?.todayAttendanceStats ?? []) {
    attendance.set(
      item.status,
      (attendance.get(item.status) || 0) + (Number(item.count) || 0),
    );
  }

  const present = attendance.get('PRESENT') || 0;
  const late = attendance.get('LATE') || 0;
  const absent = attendance.get('ABSENT') || 0;
  const excused = attendance.get('EXCUSED') || 0;
  const marked = present + late + absent + excused;
  const inClass = present + late;

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const endOfToday = startOfToday + DAY_MS;

  let tasksDue = 0;
  let tasksOverdue = 0;
  for (const followUp of stats?.upcomingFollowUps ?? []) {
    const scheduled = followUp.scheduledAt
      ? new Date(followUp.scheduledAt).getTime()
      : Number.NaN;

    if (Number.isNaN(scheduled)) {
      tasksDue += 1;
    } else if (scheduled < startOfToday) {
      tasksOverdue += 1;
    } else if (scheduled < endOfToday) {
      tasksDue += 1;
    }
  }

  const newLeads =
    (stats?.leadByStage ?? []).find((stage) => stage.stage === 'NEW')?.count || 0;

  return {
    lessonsToday: Number(stats?.todayLessonsCount) || 0,
    revenueToday: Math.max(0, Number(stats?.todayRevenue) || 0),
    paymentsToday: Math.max(0, Number(stats?.todayPaymentsCount) || 0),
    marked,
    present,
    late,
    absent,
    excused,
    inClass,
    attendanceRate: marked > 0 ? Math.round((inClass / marked) * 100) : null,
    tasksDue,
    tasksOverdue,
    newLeads: Number(newLeads) || 0,
  };
}

interface TileConfig {
  key: string;
  to: string;
  icon: IconName;
  accent: string;
  label: string;
  value: ReactNode;
  caption: string;
  showAttendanceBar?: boolean;
  delay: number;
}

const PANEL_SURFACE = cn(
  'lgx lgx--clear relative isolate overflow-hidden rounded-[2rem] p-3.5 sm:p-5 w-full min-w-0 max-w-full',
);

export interface DailyPulseStripProps {
  stats: DashboardStats;
  /** React Query `dataUpdatedAt` — rendered as "updated at hh:mm". */
  updatedAt?: number;
}

export function DailyPulseStrip({ stats, updatedAt }: DailyPulseStripProps) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const cardRef = useDashboardGlassCard<HTMLElement>({ dispersion: 3 });
  const pulse = computeDailyPulse(stats);

  const openTasks = pulse.tasksDue + pulse.tasksOverdue;
  const updatedLabel = updatedAt ? TIME_FORMATTER.format(new Date(updatedAt)) : null;

  const segments = [
    { key: 'present', count: pulse.present, color: '#34C759' },
    { key: 'late', count: pulse.late, color: '#FF9F0A' },
    { key: 'absent', count: pulse.absent, color: '#FF453A' },
    { key: 'excused', count: pulse.excused, color: '#0A84FF' },
  ].filter((segment) => segment.count > 0);

  const tiles: TileConfig[] = [
    {
      key: 'lessons',
      to: '/schedule',
      icon: 'calendar',
      accent: '#0A84FF',
      label: t('dashboard.todayLessons', "Bugungi darslar"),
      value: <CountUp value={pulse.lessonsToday} />,
      caption:
        pulse.lessonsToday > 0
          ? t('dashboard.lessonsPlanned', 'Rejalashtirilgan mashg‘ulotlar')
          : t('dashboard.noLessonsToday', 'Bugun dars rejalashtirilmagan'),
      delay: 0,
    },
    {
      key: 'attendance',
      to: '/attendance',
      icon: 'checkCircle',
      accent: '#34C759',
      label: t('dashboard.todayAttendance', 'Bugungi davomat'),
      value:
        pulse.attendanceRate !== null ? (
          <CountUp value={pulse.attendanceRate} suffix="%" />
        ) : (
          <span className="text-[19px] font-bold text-[var(--text-muted,#8E8E93)]">—</span>
        ),
      caption:
        pulse.marked > 0
          ? `${pulse.inClass}/${pulse.marked} ${t('attendance.present', 'kelgan')} · ${pulse.absent} ${t('attendance.absent', "yo'q")}`
          : t('dashboard.attendancePending', 'Davomat kutilmoqda'),
      showAttendanceBar: true,
      delay: 0.05,
    },
    {
      key: 'revenue',
      to: '/payments',
      icon: 'creditCard',
      accent: '#5E5CE6',
      label: t('dashboard.todayRevenue', 'Bugungi tushum'),
      value: <CountUp value={pulse.revenueToday} suffix=" UZS" />,
      caption:
        pulse.paymentsToday > 0
          ? `${pulse.paymentsToday} ${t('dashboard.paymentsCountSuffix', "ta to'lov")}`
          : t('dashboard.noPaymentsRecorded', "To'lov qayd etilmagan"),
      delay: 0.1,
    },
    {
      key: 'tasks',
      to: '/leads',
      icon: 'clipboard',
      accent: '#FF9F0A',
      label: t('dashboard.todayTasks', 'Ochiq vazifalar'),
      value: <CountUp value={openTasks} />,
      caption:
        openTasks > 0
          ? `${pulse.tasksOverdue} ${t('dashboard.overdue', "muddati o'tgan")} · ${pulse.newLeads} ${t('dashboard.newLeads', 'yangi lid')}`
          : t('dashboard.allTasksDone', 'Barchasi bajarilgan'),
      delay: 0.15,
    },
  ];

  return (
    <section
      ref={cardRef}
      aria-label={t('dashboard.dailyPulseSection', 'Bugungi puls')}
      className={PANEL_SURFACE}
    >
      <DashboardGlassLayers />

      {/* Neutral light pooling in the glass, not a coloured wash. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.30),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.10),transparent_70%)]" />
        <div className="absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.20),transparent_70%)] blur-3xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)]" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#34C759] opacity-60 motion-safe:animate-[pulseBeacon_2.4s_ease-in-out_infinite]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#34C759]" />
          </span>
          <h2 className="truncate text-[13px] font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
            {t('dashboard.dailyPulse', 'Bugungi puls')}
          </h2>
          <span className="hidden shrink-0 items-center rounded-full border border-[#34C759]/25 bg-[#34C759]/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.09em] text-[#1E9E4A] dark:border-[#30D158]/30 dark:bg-[#30D158]/15 dark:text-[#30D158] sm:inline-flex">
            {t('dashboard.liveNow', 'Real vaqtda')}
          </span>
        </div>

        {updatedLabel && (
          <p className="shrink-0 text-[10.5px] font-semibold tabular-nums text-[var(--text-muted,#8E8E93)]">
            {t('dashboard.updatedAt', 'Yangilangan')} · {updatedLabel}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            to={tile.to}
            style={{ animationDelay: `${60 + tile.delay * 1000}ms` }}
            className={cn(
              'group relative flex min-h-[104px] flex-col justify-between overflow-hidden rounded-[1.35rem] p-3.5',
              'border border-black/[0.05] bg-white/60',
              'shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]',
              'transition-[transform,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              'hover:-translate-y-0.5 hover:border-black/[0.09] hover:bg-white/85',
              'hover:shadow-[0_16px_34px_-16px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.95)]',
              'active:translate-y-0 active:scale-[0.99]',
              'motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
              'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(10,132,255,0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#161618]',
              'dark:border-white/[0.08] dark:bg-white/[0.045]',
              'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
              'dark:hover:border-white/[0.14] dark:hover:bg-white/[0.085]',
              'motion-safe:animate-[pulseTileIn_460ms_cubic-bezier(0.22,1,0.36,1)_both]',
            )}
          >
            {/* Hover caustic wash */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(120% 100% at 100% 0%, ${tile.accent}1F 0%, transparent 62%)`,
              }}
            />

            <div className="relative z-10 flex items-start justify-between gap-2">
              <span
                aria-hidden="true"
                className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] transition-transform duration-300 ease-out group-hover:-rotate-2 group-hover:scale-[1.08] motion-reduce:group-hover:scale-100"
                style={{
                  background: `linear-gradient(135deg, ${tile.accent}2E 0%, ${tile.accent}0F 100%)`,
                  color: tile.accent,
                  border: `1px solid ${tile.accent}3D`,
                  boxShadow: `inset 0 1.5px 1px rgba(255,255,255,0.78), 0 6px 14px -6px ${tile.accent}66`,
                }}
              >
                <Icon name={tile.icon} size={17} strokeWidth={2.1} />
              </span>

              <Icon
                name="arrowRight"
                size={14}
                className="mt-1 text-[var(--text-muted,#8E8E93)] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
              />
            </div>

            <div className="relative z-10 mt-2 min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--text-secondary,#6E6E73)] dark:text-[var(--text-secondary,#A1A1A6)]">
                {tile.label}
              </p>
              <p className="mt-1 truncate text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-[var(--text-primary,#1D1D1F)] dark:text-white sm:text-[23px]">
                {tile.value}
              </p>

              {tile.showAttendanceBar && pulse.marked > 0 && (
                <div
                  className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.1]"
                  role="img"
                  aria-label={segments
                    .map((segment) => `${segment.count}`)
                    .join(' / ')}
                >
                  {segments.map((segment) => {
                    const width = (segment.count / pulse.marked) * 100;
                    return (
                      <motion.span
                        key={segment.key}
                        initial={reduced ? false : { width: 0 }}
                        animate={{ width: `${width}%` }}
                        transition={{
                          duration: reduced ? 0 : 0.8,
                          delay: reduced ? 0 : 0.25,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        style={{ backgroundColor: segment.color }}
                        className="h-full"
                      />
                    );
                  })}
                </div>
              )}

              <p className="mt-1.5 truncate text-[10.5px] font-medium text-[var(--text-muted,#8E8E93)]">
                {tile.caption}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <style>{`
        @keyframes pulseTileIn {
          from { opacity: 0; transform: translateY(8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes pulseBeacon {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.45; transform: scale(1.3); }
        }
      `}</style>
    </section>
  );
}

export default DailyPulseStrip;
