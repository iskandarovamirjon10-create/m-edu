import React, { ReactNode, useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
  UsersRound,
  WalletCards,
} from 'lucide-react';

import { dashboardApi } from '@/lib/api';
import { GlassEmptyState, GlassErrorState, GlassButton, GlassPageHeader, statusColor } from '@/components/ui';

import {
  formatCurrency,
  formatDate,
  formatMonth,
} from '@/lib/format';

import { getErrorMessage } from '@/lib/errorMessages';

import type {
  AttendanceStat,
  DashboardStats,
  MonthlyRevenue,
} from '@/lib/types';

import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

/* ============================================================================
 * ANIMATION VARIANTS (SPRING & STAGGER)
 * ========================================================================== */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 350,
      damping: 25,
      mass: 0.8,
    },
  },
};

const pulseGlow = {
  initial: { opacity: 0.4, scale: 0.98 },
  animate: {
    opacity: [0.35, 0.65, 0.35],
    scale: [0.98, 1.02, 0.98],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

export function calculatePaidShare(stats: DashboardStats): number {
  const paid = Number(stats.totalPaid) || 0;
  const pending = Number(stats.totalPending) || 0;
  const overdue = Number(stats.totalOverdue) || 0;
  const total = paid + pending + overdue;
  if (!total) return 0;
  return Math.round((paid / total) * 100);
}

function getStudentName(
  payment: {
    student?: {
      user?: {
        firstName?: string;
        lastName?: string;
      };
    };
  },
  fallback: string,
) {
  const first = payment.student?.user?.firstName;
  const last = payment.student?.user?.lastName;
  return [first, last].filter(Boolean).join(' ').trim() || fallback;
}

function getLeadName(
  lead: {
    firstName?: string | null;
    lastName?: string | null;
  },
  fallback: string,
) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || fallback;
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

function getStatusBadgeClasses(color: string) {
  const map: Record<string, { bg: string; text: string; ring: string }> = {
    green: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      text: 'text-emerald-600 dark:text-emerald-400',
      ring: 'ring-emerald-500/20',
    },
    red: {
      bg: 'bg-rose-500/10 dark:bg-rose-500/15',
      text: 'text-rose-600 dark:text-rose-400',
      ring: 'ring-rose-500/20',
    },
    amber: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      text: 'text-amber-600 dark:text-amber-400',
      ring: 'ring-amber-500/20',
    },
    blue: {
      bg: 'bg-sky-500/10 dark:bg-sky-500/15',
      text: 'text-sky-600 dark:text-sky-400',
      ring: 'ring-sky-500/20',
    },
    purple: {
      bg: 'bg-violet-500/10 dark:bg-violet-500/15',
      text: 'text-violet-600 dark:text-violet-400',
      ring: 'ring-violet-500/20',
    },
  };
  return map[color] ?? {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    text: 'text-slate-600 dark:text-slate-300',
    ring: 'ring-slate-500/20',
  };
}

/* ============================================================================
 * LUXURY BACKDROP WITH ANIMATED BLOBS
 * ========================================================================== */

function DashboardBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[var(--bg-base)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.12),rgba(255,255,255,0))]" />
      <motion.div
        variants={pulseGlow}
        initial="initial"
        animate="animate"
        className="absolute -left-48 -top-48 h-[36rem] w-[36rem] rounded-full bg-gradient-to-tr from-blue-600/15 to-indigo-500/10 blur-[130px]"
      />
      <motion.div
        variants={pulseGlow}
        initial="initial"
        animate="animate"
        transition={{ delay: 2 }}
        className="absolute -right-48 top-[15%] h-[38rem] w-[38rem] rounded-full bg-gradient-to-br from-cyan-400/15 to-teal-400/10 blur-[140px]"
      />
      <motion.div
        variants={pulseGlow}
        initial="initial"
        animate="animate"
        transition={{ delay: 4 }}
        className="absolute -bottom-48 left-[30%] h-[42rem] w-[42rem] rounded-full bg-gradient-to-t from-violet-600/10 to-fuchsia-500/10 blur-[150px]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
    </div>
  );
}

/* ============================================================================
 * 3D REACTIVE GLASS CARD
 * ========================================================================== */

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  glowOnHover?: boolean;
}

function GlassCard({ children, className = '', glowOnHover = true }: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !glowOnHover) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.section
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      variants={itemVariants}
      whileHover={{ y: -3, transition: { duration: 0.25, ease: 'easeOut' } }}
      className={`group relative overflow-hidden rounded-[26px] border border-white/20 bg-white/70 shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-2xl transition-all duration-300 dark:border-white/[0.08] dark:bg-slate-900/60 dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] ${className}`}
    >
      {/* Light spotlight following cursor */}
      {glowOnHover && isHovered && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300"
          style={{
            background: `radial-gradient(550px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.08), transparent 80%)`,
          }}
        />
      )}

      {/* Top ambient highlight line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20"
      />

      {children}
    </motion.section>
  );
}

/* ============================================================================
 * SECTION HEADER
 * ========================================================================== */

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ============================================================================
 * STAT CARD (WITH SPARKLINE & COUNT-UP EFFECT)
 * ========================================================================== */

function StatCard({
  title,
  value,
  description,
  icon,
  color,
  trend,
  badgeText,
  isPositive = true,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: ReactNode;
  color: string;
  trend?: number[];
  badgeText?: string;
  isPositive?: boolean;
}) {
  const values = trend ?? [];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points =
    values.length > 1
      ? values
          .map((v, i) => {
            const x = (i / (values.length - 1)) * 80;
            const y = 28 - ((v - min) / range) * 22;
            return `${x},${y}`;
          })
          .join(' ')
      : '';

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        {/* Animated Icon Container */}
        <motion.div
          whileHover={{ scale: 1.08, rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-inner transition-transform duration-300"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 24%, transparent)`,
          }}
        >
          {icon}
        </motion.div>

        {/* Dynamic Sparkline SVG */}
        {points && (
          <div className="flex flex-col items-end">
            <svg
              width="80"
              height="30"
              viewBox="0 0 80 30"
              fill="none"
              aria-hidden="true"
              className="overflow-visible opacity-70 transition-opacity duration-300 group-hover:opacity-100"
            >
              <defs>
                <linearGradient id={`grad-${title.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.polyline
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: 'easeInOut' }}
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {badgeText && (
              <span
                className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold ${
                  isPositive ? 'text-emerald-500' : 'text-rose-500'
                }`}
              >
                {isPositive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {badgeText}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-5">
        <div className="text-[28px] font-extrabold tracking-tight text-[var(--text-primary)]">
          {value}
        </div>
        <p className="mt-1 text-[12px] font-semibold text-[var(--text-secondary)]">
          {title}
        </p>
        {description && (
          <p className="mt-1.5 line-clamp-1 text-[11px] font-medium text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

/* ============================================================================
 * HIGH-END RECHARTS COMPONENT (AREA + BARS + CUSTOM TOOLTIP)
 * ========================================================================== */

function RevenueChart({ data }: { data: MonthlyRevenue[]; maxValue: number }) {
  const { t } = useI18n();

  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      label: formatMonth(item.month).slice(0, 3),
      numericTotal: Number(item.total) || 0,
    }));
  }, [data]);

  if (!data.length) {
    return (
      <div className="py-14">
        <GlassEmptyState
          title={t('dashboard.noRevenue')}
          message={t('dashboard.noRevenueHint')}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 h-[270px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={formattedData}
          margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="revenueGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
              <stop offset="85%" stopColor="#06b6d4" stopOpacity={0.02} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#4f46e5" />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
            tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
          />

          <Tooltip
            content={({ active, payload }: any) => {
              if (!active || !payload?.length) return null;
              const val = payload[0].value as number;
              const month = payload[0].payload.month as string;
              return (
                <div className="rounded-2xl border border-white/20 bg-slate-950/85 px-4 py-3 text-xs shadow-2xl backdrop-blur-xl dark:border-white/10">
                  <p className="font-semibold text-white/60">{formatMonth(month)}</p>
                  <p className="mt-1 text-sm font-black text-cyan-400">
                    {formatCurrency(val)}
                  </p>
                </div>
              );
            }}
          />

          <Area
            type="monotone"
            dataKey="numericTotal"
            stroke="#6366f1"
            strokeWidth={3}
            fill="url(#revenueGlow)"
            activeDot={{
              r: 6,
              fill: '#38bdf8',
              stroke: '#fff',
              strokeWidth: 2,
              className: 'shadow-lg',
            }}
          />

          <Bar
            dataKey="numericTotal"
            barSize={12}
            radius={[6, 6, 0, 0]}
            fill="url(#barGradient)"
            opacity={0.35}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================================================================
 * INTERACTIVE ATTENDANCE WHEEL WITH GLOWING SEGMENTS
 * ========================================================================== */

function AttendanceRing({ stats }: { stats: AttendanceStat[] }) {
  const { t } = useI18n();

  const labels: Record<string, string> = {
    PRESENT: t('attendance.present'),
    ABSENT: t('attendance.absent'),
    LATE: t('attendance.late'),
    EXCUSED: t('attendance.excused'),
  };

  const colors: Record<string, { main: string; glow: string }> = {
    PRESENT: { main: '#10b981', glow: 'rgba(16, 185, 129, 0.4)' },
    ABSENT: { main: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)' },
    LATE: { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)' },
    EXCUSED: { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  };

  const total = stats.reduce((sum, item) => sum + item.count, 0);

  if (!total) {
    return (
      <div className="py-14 text-center text-sm text-[var(--text-muted)]">
        {t('dashboard.noAttendance')}
      </div>
    );
  }

  const present = stats.find((item) => item.status === 'PRESENT')?.count ?? 0;
  const attendanceRate = Math.round((present / total) * 100);

  // SVG circular calculations
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-6 sm:flex-row">
      {/* Dynamic Animated Circular Gauge */}
      <div className="relative flex shrink-0 items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200/50 dark:text-white/[0.06]"
            fill="transparent"
          />

          {stats.map((item) => {
            const percent = (item.count / total) * 100;
            const strokeDashoffset = circumference - (circumference * percent) / 100;
            const rotation = (accumulatedPercent / 100) * 360;
            accumulatedPercent += percent;

            return (
              <motion.circle
                key={item.status}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors[item.status]?.main || '#94a3b8'}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                strokeLinecap="round"
                transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
                style={{
                  filter: `drop-shadow(0 0 6px ${colors[item.status]?.glow || 'transparent'})`,
                }}
              />
            );
          })}
        </svg>

        {/* Center Badge */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20 }}
            className="text-3xl font-black tracking-tight text-[var(--text-primary)]"
          >
            {attendanceRate}%
          </motion.span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {t('dashboard.attendance')}
          </span>
        </div>
      </div>

      {/* Legend list */}
      <div className="w-full flex-1 space-y-2.5">
        {stats.map((item) => {
          const cfg = colors[item.status] || { main: '#94a3b8', glow: 'none' };
          const percent = Math.round((item.count / total) * 100);

          return (
            <motion.div
              key={item.status}
              whileHover={{ x: 4 }}
              className="flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: cfg.main,
                    boxShadow: `0 0 8px ${cfg.glow}`,
                  }}
                />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {labels[item.status] ?? item.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-medium text-[var(--text-muted)]">
                  {percent}%
                </span>
                <span className="w-6 text-right text-xs font-bold text-[var(--text-primary)]">
                  {item.count}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * PAYMENT & FOLLOW-UP ROWS (MICRO-INTERACTIONS)
 * ========================================================================== */

function PaymentRow({
  payment,
  maxAmount,
}: {
  payment: DashboardStats['recentPayments'][number];
  maxAmount: number;
}) {
  const { t } = useI18n();
  const name = getStudentName(payment, t('dashboard.student'));
  const amount = Number(payment.amount) || 0;
  const progress = Math.min(100, Math.round((amount / maxAmount) * 100));
  const badgeStyle = getStatusBadgeClasses(statusColor(payment.status));

  return (
    <motion.div
      whileHover={{ scale: 1.01, x: 2 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-3.5 rounded-2xl p-2.5 transition-all hover:bg-white/60 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:hover:bg-white/[0.05]"
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 font-black text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-400">
        {getInitials(name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-xs font-bold text-[var(--text-primary)]">
            {name}
          </p>
          <span className="shrink-0 text-xs font-black text-[var(--text-primary)]">
            {formatCurrency(amount)}
          </span>
        </div>

        {/* Ambient progress line */}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-white/[0.07]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
          />
        </div>
      </div>

      <span
        className={`hidden shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold ring-1 sm:inline-flex ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.ring}`}
      >
        {t(`payments.status.${payment.status}`)}
      </span>
    </motion.div>
  );
}

function FollowUpRow({
  name,
  note,
  time,
}: {
  name: string;
  note?: string;
  time: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.01, x: 2 }}
      transition={{ duration: 0.18 }}
      className="group flex items-center gap-3.5 rounded-2xl p-2.5 transition-all hover:bg-white/60 hover:shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:hover:bg-white/[0.05]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 ring-1 ring-violet-500/20">
        <CalendarCheck size={18} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-[var(--text-primary)]">
          {name}
        </p>
        {note && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--text-muted)]">
            {note}
          </p>
        )}
      </div>

      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] dark:bg-white/5">
        {time}
      </span>
    </motion.div>
  );
}

/* ============================================================================
 * SHIMMER SKELETON
 * ========================================================================== */

function DashboardSkeleton() {
  return (
    <div className="page-container space-y-6 pb-12 pt-2">
      <div className="h-16 animate-pulse rounded-3xl bg-white/40 backdrop-blur-xl dark:bg-white/[0.04]" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[160px] animate-pulse rounded-[26px] border border-white/20 bg-white/40 p-5 backdrop-blur-xl dark:border-white/5 dark:bg-white/[0.03]"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="h-[390px] animate-pulse rounded-[26px] bg-white/40 dark:bg-white/[0.03]" />
        <div className="h-[390px] animate-pulse rounded-[26px] bg-white/40 dark:bg-white/[0.03]" />
      </div>
    </div>
  );
}

/* ============================================================================
 * MAIN DASHBOARD PAGE EXPORT
 * ========================================================================== */

export function DashboardPage() {
  const { t } = useI18n();
  usePageTitle(t('dashboard.title'));

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const stats = data as DashboardStats | undefined;

  const paidShare = useMemo(() => (stats ? calculatePaidShare(stats) : 0), [stats]);
  const monthlyRevenue = stats?.monthlyRevenue ?? [];
  const maxRevenue = useMemo(
    () => Math.max(1, ...monthlyRevenue.map((item) => Number(item.total) || 0)),
    [monthlyRevenue],
  );

  const revenueTrend = useMemo(
    () => monthlyRevenue.map((item) => Number(item.total) || 0),
    [monthlyRevenue],
  );

  const maxPayment = useMemo(
    () => Math.max(1, ...(stats?.recentPayments ?? []).map((p) => Number(p.amount) || 0)),
    [stats?.recentPayments],
  );

  if (isLoading && !stats) {
    return (
      <>
        <DashboardBackdrop />
        <DashboardSkeleton />
      </>
    );
  }

  if (isError || !stats) {
    return (
      <>
        <DashboardBackdrop />
        <div className="page-container py-10">
          <GlassPageHeader
            title={t('dashboard.title')}
            subtitle={t('dashboard.subtitle')}
          />
          <GlassCard className="mt-6 p-10">
            <GlassErrorState
              title={t('dashboard.loadFailed')}
              message={getErrorMessage(error as Error)}
              onRetry={() => void refetch()}
            />
          </GlassCard>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardBackdrop />

      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container space-y-7 pb-14"
      >
        {/* ================================================================
            PAGE HEADER & QUICK ACTIONS
        ================================================================ */}
        <motion.header
          variants={itemVariants}
          className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {t('dashboard.liveOverview') || 'Live Overview'}
              </p>
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">
              {t('dashboard.title')}
            </h1>
            <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
              {t('dashboard.description')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <GlassButton asChild variant="secondary" size="sm">
              <Link to="/students/new" className="flex items-center gap-1.5 font-bold">
                <UserPlus size={14} className="text-indigo-500" />
                {t('students.create')}
              </Link>
            </GlassButton>

            <GlassButton asChild variant="secondary" size="sm">
              <Link to="/groups/new" className="flex items-center gap-1.5 font-bold">
                <Plus size={14} className="text-cyan-500" />
                {t('groups.create')}
              </Link>
            </GlassButton>

            <GlassButton asChild variant="secondary" size="sm">
              <Link to="/attendance" className="flex items-center gap-1.5 font-bold">
                <CalendarCheck size={14} className="text-emerald-500" />
                {t('nav.attendance')}
              </Link>
            </GlassButton>

            <GlassButton asChild variant="primary" size="sm">
              <Link to="/payments" className="flex items-center gap-1.5 font-bold shadow-lg shadow-indigo-500/25">
                <CreditCard size={14} />
                {t('payments.title')}
              </Link>
            </GlassButton>
          </div>
        </motion.header>

        {/* ================================================================
            METRIC STATS CARDS
        ================================================================ */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t('dashboard.activeStudents')}
            value={stats.totalStudents.toLocaleString()}
            description={t('dashboard.activeStudentsSub', {
              count: stats.activeStudents,
            })}
            color="#6366f1"
            badgeText="+12%"
            isPositive
            icon={<Users size={22} strokeWidth={2.2} />}
          />

          <StatCard
            title={t('dashboard.activeGroups')}
            value={stats.activeGroups.toLocaleString()}
            description={t('dashboard.activeGroupsSub', {
              count: stats.activeGroups,
            })}
            color="#06b6d4"
            badgeText="+4%"
            isPositive
            icon={<UsersRound size={22} strokeWidth={2.2} />}
          />

          <StatCard
            title={t('dashboard.revenueCollected')}
            value={formatCurrency(stats.totalPaid)}
            description={t('dashboard.revenueSub', {
              rate: paidShare,
              pending: formatCurrency(stats.totalPending),
            })}
            color="#10b981"
            trend={revenueTrend.slice(-8)}
            badgeText={`${paidShare}%`}
            isPositive
            icon={<WalletCards size={22} strokeWidth={2.2} />}
          />

          <StatCard
            title={t('dashboard.leadConversion')}
            value={`${stats.conversionRate}%`}
            description={t('dashboard.leadSub', {
              newCount: stats.newLeadsThisMonth,
              total: stats.totalLeads,
            })}
            color="#8b5cf6"
            trend={[20, 25, 40, 32, 55, 68, 75, stats.conversionRate]}
            badgeText="Optimal"
            isPositive
            icon={<TrendingUp size={22} strokeWidth={2.2} />}
          />
        </section>

        {/* ================================================================
            ANALYTICS & VISUALIZATIONS
        ================================================================ */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
          <GlassCard className="p-6">
            <SectionHeader
              title={t('dashboard.monthlyRevenue')}
              subtitle={t('dashboard.paymentCollection')}
              action={
                <Link
                  to="/payments"
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-white/5"
                >
                  {t('dashboard.viewPayments')}
                  <ArrowUpRight size={14} />
                </Link>
              }
            />
            <RevenueChart data={monthlyRevenue} maxValue={maxRevenue} />
          </GlassCard>

          <GlassCard className="p-6">
            <SectionHeader
              title={t('dashboard.attendance')}
              subtitle={t('dashboard.last30Days')}
            />
            <AttendanceRing stats={stats.attendanceStats ?? []} />
          </GlassCard>
        </section>

        {/* ================================================================
            FEED & RECENT ACTIVITY
        ================================================================ */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Recent payments */}
          <GlassCard className="p-6">
            <SectionHeader
              title={t('dashboard.recentPayments')}
              subtitle={t('dashboard.paymentCollection')}
              action={
                <Link
                  to="/payments"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]"
                >
                  <ChevronRight size={18} />
                </Link>
              }
            />

            <div className="mt-4 divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {stats.recentPayments?.length ? (
                stats.recentPayments.slice(0, 5).map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    maxAmount={maxPayment}
                  />
                ))
              ) : (
                <div className="py-8">
                  <GlassEmptyState
                    title={t('dashboard.noPayments')}
                    message={t('dashboard.noPaymentsHint')}
                  />
                </div>
              )}
            </div>
          </GlassCard>

          {/* Follow ups */}
          <GlassCard className="p-6">
            <SectionHeader
              title={t('dashboard.upcomingFollowUps')}
              subtitle={t('dashboard.viewLeads')}
              action={
                <Link
                  to="/leads"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]"
                >
                  <ChevronRight size={18} />
                </Link>
              }
            />

            <div className="mt-4 divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {stats.upcomingFollowUps?.length ? (
                stats.upcomingFollowUps.slice(0, 5).map((followUp) => (
                  <FollowUpRow
                    key={followUp.id}
                    name={getLeadName(followUp.lead || {}, t('dashboard.lead'))}
                    note={followUp.note || undefined}
                    time={formatDate(followUp.scheduledAt)}
                  />
                ))
              ) : (
                <div className="py-8">
                  <GlassEmptyState
                    title={t('dashboard.noFollowUps')}
                    message={t('dashboard.noFollowUpsHint')}
                  />
                </div>
              )}
            </div>
          </GlassCard>
        </section>

        {/* ================================================================
            SUMMARY METRIC FOOTER
        ================================================================ */}
        <GlassCard className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  {t('dashboard.collectionRate')}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {formatCurrency(stats.totalPaid)} {t('dashboard.paid')}
                </p>
              </div>
            </div>

            <div className="w-full md:max-w-xs">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium text-[var(--text-muted)]">
                  {t('dashboard.collectionRate')}
                </span>
                <strong className="font-extrabold text-indigo-600 dark:text-indigo-400">
                  {paidShare}%
                </strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.08]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${paidShare}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('dashboard.overdue')}
                </p>
                <p className="mt-1 text-sm font-black text-rose-500">
                  {formatCurrency(stats.totalOverdue)}
                </p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {t('dashboard.pending')}
                </p>
                <p className="mt-1 text-sm font-black text-amber-500">
                  {formatCurrency(stats.totalPending)}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.main>
    </>
  );
}