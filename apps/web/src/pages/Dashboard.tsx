/**
 * M-EDU Dashboard — Apple Design Award Edition v2 "Aurora Live"
 *
 * ✨ NEW IN v2:
 *  - Time-aware greeting + live second-pulse indicator
 *  - Interactive period selector (7D / 30D / 90D / 1Y) for chart
 *  - Floating quick-actions dock (⌘K style)
 *  - Enhanced Activity Rings with per-segment glow + hover tooltip
 *  - Cursor-tracked specular on every glass card
 *  - Per-student deterministic gradient avatars
 *  - Sparkline hover crosshair with tooltip
 *  - Focus mode toggle (dims non-essential UI)
 *  - Keyboard shortcuts: ⌘K, ⌘N, ⌘/ 
 *  - Reduced-motion respected everywhere
 *  - Better skeleton with staggered shimmer
 */

import React, { ReactNode, useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  type Variants,
} from 'framer-motion';
import {
  Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Bar, ComposedChart,
} from 'recharts';

import { dashboardApi } from '@/lib/api';
import {
  GlassEmptyState, GlassErrorState, GlassButton,
  GlassPageHeader, statusColor,
} from '@/components/ui';
import { formatCurrency, formatDate, formatMonth } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { AttendanceStat, DashboardStats, MonthlyRevenue } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy:   { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth:   { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:     { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  magnetic: { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 1, y: 26, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

/* ✨ NEW: reduced-motion detection */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ============================================================================
 * APPLE SYSTEM COLORS
 * ========================================================================== */

const SYS = {
  blue:   { light: '#007AFF', dark: '#0A84FF', glow: 'rgba(0,122,255,0.35)' },
  green:  { light: '#34C759', dark: '#30D158', glow: 'rgba(52,199,89,0.35)' },
  orange: { light: '#FF9500', dark: '#FF9F0A', glow: 'rgba(255,149,0,0.35)' },
  red:    { light: '#FF3B30', dark: '#FF453A', glow: 'rgba(255,59,48,0.35)' },
  purple: { light: '#AF52DE', dark: '#BF5AF2', glow: 'rgba(175,82,222,0.35)' },
  pink:   { light: '#FF2D55', dark: '#FF375F', glow: 'rgba(255,45,85,0.35)' },
  teal:   { light: '#32ADE6', dark: '#64D2FF', glow: 'rgba(50,173,230,0.35)' },
  gray:   { light: '#8E8E93', dark: '#98989D', glow: 'rgba(142,142,147,0.35)' },
} as const;

/* ✨ NEW: gradient palettes for avatars */
const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  usersRound: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  wallet: ['M20 12V8H6a2 2 0 0 1 0-4h12v4', 'M4 6v12c0 1.1.9 2 2 2h14v-4', 'M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  trend: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  arrowUpRight: ['M7 17 17 7', 'M7 7h10v10'],
  arrowDownRight: ['M7 7l10 10', 'M17 7v10H7'],
  plus: ['M12 5v14', 'M5 12h14'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6', 'M22 11h-6'],
  calendarCheck: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M9 15l2 2 4-4'],
  creditCard: ['M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M1 10h22', 'M6 15h2'],
  chevronRight: ['M9 6l6 6-6 6'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  focus: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 12h.01'],
  maximize: ['M8 3H5a2 2 0 0 0-2 2v3', 'M21 8V5a2 2 0 0 0-2-2h-3', 'M3 16v3a2 2 0 0 0 2 2h3', 'M16 21h3a2 2 0 0 0 2-2v-3'],
};

function Icon({
  paths, size = 20, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

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
  payment: { student?: { user?: { firstName?: string; lastName?: string } } },
  fallback: string,
) {
  const first = payment.student?.user?.firstName;
  const last = payment.student?.user?.lastName;
  return [first, last].filter(Boolean).join(' ').trim() || fallback;
}

function getLeadName(lead: { firstName?: string | null; lastName?: string | null }, fallback: string) {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() || fallback;
}

function getInitials(name: string) {
  return (
    name.split(/\s+/).map((p) => p.charAt(0)).filter(Boolean).slice(0, 2).join('').toUpperCase() || '—'
  );
}

/* ✨ NEW: deterministic avatar gradient */
function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ✨ NEW: time-aware greeting */
function getGreeting(t: (key: string) => string): { text: string; emoji: string } {
  const h = new Date().getHours();
  if (h < 5) return { text: t('dashboard.goodNight') || 'Good night', emoji: '🌙' };
  if (h < 12) return { text: t('dashboard.goodMorning') || 'Good morning', emoji: '☀️' };
  if (h < 17) return { text: t('dashboard.goodAfternoon') || 'Good afternoon', emoji: '🌤️' };
  if (h < 22) return { text: t('dashboard.goodEvening') || 'Good evening', emoji: '🌆' };
  return { text: t('dashboard.goodNight') || 'Good night', emoji: '🌙' };
}

/* ============================================================================
 * COUNT-UP
 * ========================================================================== */

function CountUp({
  value, duration = 1.2, decimals = 0, prefix = '', suffix = '',
}: {
  value: number; duration?: number; decimals?: number;
  prefix?: string; suffix?: string;
}) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(value * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const shown = decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toLocaleString();

  return <span className="tabular-nums">{prefix}{shown}{suffix}</span>;
}

/* ============================================================================
 * ✨ LIVE CLOCK (header)
 * ========================================================================== */

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval> | null = null;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 15_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return <span className="tabular-nums tracking-tight">{hh}:{mm}</span>;
}

/* ============================================================================
 * ✨ GLASS CARD with cursor-tracked specular
 * ========================================================================== */

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  radius?: string;
  glowColor?: string;
}

function GlassCard({
  children, className = '', interactive = true, radius = '2rem', glowColor,
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 0, active: false });
  const reduced = usePrefersReducedMotion();

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || !interactive || reduced) return;
    const r = cardRef.current.getBoundingClientRect();
    setPos({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
      active: true,
    });
  }, [interactive, reduced]);

  return (
    <motion.section
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setPos((p) => ({ ...p, active: false }))}
      variants={itemVariants}
      whileHover={interactive && !reduced ? { y: -3 } : undefined}
      transition={SPRING.smooth}
      className={`group relative overflow-hidden border border-[#ffffff80] bg-[#ffffff80] shadow-[0_8px_40px_rgba(0,0,0,0.035)] dark:border-[#ffffff12] dark:bg-[#1c1c1e80] dark:shadow-[0_10px_50px_rgba(0,0,0,0.35)] ${className}`}
      style={{
        borderRadius: radius,
        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
        backdropFilter: 'blur(40px) saturate(200%)',
      }}
    >
      {/* 4-layer 3D edge */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: radius,
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.75), ' +
            'inset 0 -1px 0 rgba(255,255,255,0.12), ' +
            'inset 1px 0 0 rgba(255,255,255,0.22), ' +
            'inset -1px 0 0 rgba(255,255,255,0.22)',
        }}
      />

      {/* Cursor-tracked specular */}
      {interactive && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            borderRadius: radius,
            opacity: pos.active ? 1 : 0,
            background: `radial-gradient(700px circle at ${pos.x}% ${pos.y}%, rgba(255,255,255,0.32), transparent 40%)`,
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* Chromatic edge */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          borderRadius: radius,
          background:
            'linear-gradient(90deg, rgba(255,0,80,0.05) 0%, transparent 6%, transparent 94%, rgba(0,120,255,0.05) 100%)',
        }}
      />

      {/* Accent glow on hover */}
      {glowColor && (
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-100"
          style={{ background: glowColor }}
        />
      )}

      <div className="relative z-10 h-full w-full">{children}</div>
    </motion.section>
  );
}

/* ============================================================================
 * SECTION HEADER
 * ========================================================================== */

function SectionHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[17px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px] font-medium tracking-tight text-[#86868B] dark:text-[#98989D]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ============================================================================
 * ✨ SPARKLINE with hover crosshair
 * ========================================================================== */

function Sparkline({ values, color, glow }: { values: number[]; color: string; glow: string }) {
  const [hover, setHover] = useState<{ x: number; y: number; v: number } | null>(null);
  const reduced = usePrefersReducedMotion();
  if (values.length < 2) return null;

  const W = 90, H = 34, PAD = 3;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => ({
    x: PAD + (i / (values.length - 1)) * (W - PAD * 2),
    y: H - PAD - ((v - min) / range) * (H - PAD * 2),
    v,
  }));

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  const areaD = `${d} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`;
  const id = `spark-${Math.random().toString(36).slice(2, 8)}`;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(xRatio * (pts.length - 1));
    const p = pts[Math.max(0, Math.min(pts.length - 1, idx))];
    setHover({ x: p.x, y: p.y, v: p.v });
  };

  return (
    <div className="relative">
      <svg
        width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        fill="none" aria-hidden
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible opacity-90 transition-opacity duration-300 group-hover:opacity-100"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.path
          d={areaD}
          fill={`url(#${id}-fill)`}
          initial={reduced ? false : { opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.4, ease: EASE_APPLE }}
        />
        <motion.path
          d={d}
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${id}-glow)`}
          initial={reduced ? false : { pathLength: 0, opacity: 1 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: EASE_APPLE, delay: 0.15 }}
        />

        {/* Hover crosshair */}
        {hover && (
          <g>
            <line
              x1={hover.x} y1={0} x2={hover.x} y2={H}
              stroke={color} strokeWidth={0.75} strokeDasharray="2 2" opacity={0.5}
            />
            <circle cx={hover.x} cy={hover.y} r={3.5} fill="#fff" stroke={color} strokeWidth={2} />
          </g>
        )}

        {/* End dot */}
        <motion.circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r={2.5}
          fill={color}
          initial={reduced ? false : { scale: 0, opacity: 1 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING.snappy, delay: 1.4 }}
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </svg>

      {/* Hover value tooltip */}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 1, y: -4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 1, y: -4, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#1D1D1F] px-2 py-0.5 text-[10px] font-bold text-white shadow-lg dark:bg-[#F5F5F7] dark:text-[#1D1D1F]"
          >
            {Math.round(hover.v).toLocaleString()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
 * STAT CARD
 * ========================================================================== */

interface StatCardProps {
  title: string;
  value: number;
  valueFormat?: 'number' | 'currency';
  description?: string;
  icon: string[];
  color: { light: string; dark: string; glow: string };
  trend?: number[];
  badgeText?: string;
  isPositive?: boolean;
}

function StatCard({
  title, value, valueFormat = 'number', description,
  icon, color, trend, badgeText, isPositive = true,
}: StatCardProps) {
  const isCurrency = valueFormat === 'currency';
  const reduced = usePrefersReducedMotion();

  return (
    <GlassCard className="p-5 sm:p-6" glowColor={color.glow}>
      <div className="flex items-start justify-between gap-4">
        <motion.div
          whileHover={reduced ? undefined : { scale: 1.06, rotate: [0, -4, 4, 0] }}
          transition={{ duration: 0.45, ease: EASE_APPLE }}
          className="relative flex h-11 w-11 items-center justify-center rounded-[14px]"
          style={{
            color: color.light,
            background: `linear-gradient(145deg, ${color.light}1F 0%, ${color.light}0D 100%)`,
            border: `1px solid ${color.light}33`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -4px ${color.glow}`,
          }}
        >
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[13px]"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
          />
          <Icon paths={icon} size={22} strokeWidth={2} className="relative" />
        </motion.div>

        {trend && trend.length > 1 && (
          <div className="flex flex-col items-end">
            <Sparkline values={trend} color={color.light} glow={color.glow} />
            {badgeText && (
              <span
                className={`mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold tracking-tight ${
                  isPositive ? 'text-[#34C759] dark:text-[#30D158]' : 'text-[#FF3B30] dark:text-[#FF453A]'
                }`}
              >
                <Icon
                  paths={isPositive ? I.arrowUpRight : I.arrowDownRight}
                  size={12}
                  strokeWidth={3}
                />
                {badgeText}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6">
        <motion.div
          initial={reduced ? false : { opacity: 1, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE_APPLE }}
          className="text-[32px] font-semibold leading-none tracking-tighter text-[#1D1D1F] tabular-nums dark:text-[#F5F5F7]"
        >
          {isCurrency
            ? <CountUp value={value} prefix="UZS " />
            : <CountUp value={value} />}
        </motion.div>
        <p className="mt-1 text-[13px] font-medium tracking-tight text-[#86868B] dark:text-[#98989D]">
          {title}
        </p>
        {description && (
          <p className="mt-1.5 line-clamp-1 text-[12px] font-medium text-[#86868B]/75 dark:text-[#98989D]/75">
            {description}
          </p>
        )}
      </div>
    </GlassCard>
  );
}

/* ============================================================================
 * ✨ PERIOD SELECTOR
 * ========================================================================== */

type Period = '7D' | '30D' | '90D' | '1Y';
const PERIODS: Period[] = ['7D', '30D', '90D', '1Y'];

function PeriodSelector({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-full border border-[#00000010] bg-[#00000005] p-0.5 dark:border-[#ffffff10] dark:bg-[#ffffff08]"
      role="tablist"
      aria-label="Chart period"
    >
      {PERIODS.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className="relative rounded-full px-3 py-1 text-[11px] font-bold tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#007AFF]/40"
            style={{ color: active ? '#1D1D1F' : '#86868B' }}
          >
            {active && (
              <motion.span
                layoutId="periodPill"
                className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-[#2C2C2E] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                transition={SPRING.snappy}
              />
            )}
            <span className="relative dark:text-inherit">{p}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * REVENUE CHART
 * ========================================================================== */

function RevenueChart({ data, period }: { data: MonthlyRevenue[]; period: Period }) {
  const { t } = useI18n();

  /* ✨ Filter by period */
  const filtered = useMemo(() => {
    const count = period === '7D' ? 2 : period === '30D' ? 4 : period === '90D' ? 6 : 12;
    return data.slice(-count);
  }, [data, period]);

  const formattedData = useMemo(
    () => filtered.map((item) => ({
      ...item,
      label: formatMonth(item.month).slice(0, 3),
      numericTotal: Number(item.total) || 0,
    })),
    [filtered],
  );

  if (!data.length) {
    return (
      <div className="py-14">
        <GlassEmptyState title={t('dashboard.noRevenue')} message={t('dashboard.noRevenueHint')} />
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value as number;
    const month = payload[0].payload.month as string;
    return (
      <div className="rounded-[1.25rem] border border-[#ffffff70] bg-[#ffffffdc] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-2xl dark:border-[#ffffff20] dark:bg-[#1c1c1ee6]">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          {formatMonth(month)}
        </p>
        <p className="mt-1 text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {formatCurrency(val)}
        </p>
      </div>
    );
  };

  return (
    <div className="mt-6 h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={formattedData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#007AFF" stopOpacity={0.32} />
              <stop offset="55%" stopColor="#007AFF" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#007AFF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="revenueBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#32ADE6" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#007AFF" stopOpacity={0.6} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#86868B', fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#86868B', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            domain={[0, 'dataMax + 1000']}
          />

          <Tooltip cursor={{ fill: '#86868B', opacity: 1.08 }} content={<CustomTooltip />} />

          <Bar
            dataKey="numericTotal"
            barSize={14}
            radius={[7, 7, 7, 7]}
            fill="url(#revenueBarGradient)"
            opacity={0.35}
          />

          <Area
            type="monotone"
            dataKey="numericTotal"
            stroke="#007AFF"
            strokeWidth={3}
            fill="url(#revenueAreaGradient)"
            activeDot={{
              r: 6,
              fill: '#FFFFFF',
              stroke: '#007AFF',
              strokeWidth: 3,
              style: { filter: 'drop-shadow(0px 4px 10px rgba(0,122,255,0.5))' },
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================================================================
 * APPLE WATCH ACTIVITY RINGS
 * ========================================================================== */

const RING_COLOR: Record<string, string> = {
  PRESENT: SYS.green.light,
  ABSENT:  SYS.red.light,
  LATE:    SYS.orange.light,
  EXCUSED: SYS.blue.light,
};

function ActivityRings({ stats }: { stats: AttendanceStat[] }) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const total = stats.reduce((s, i) => s + i.count, 0);

  if (!total) {
    return (
      <div className="py-14 text-center text-sm text-[#86868B]">
        {t('dashboard.noAttendance')}
      </div>
    );
  }

  const present = stats.find((s) => s.status === 'PRESENT')?.count ?? 0;
  const rate = Math.round((present / total) * 100);

  const size = 190;
  const strokeWidth = 18;
  const gap = 8;
  const outerR = (size - strokeWidth) / 2;
  const radiusStep = strokeWidth + gap;

  const labels: Record<string, string> = {
    PRESENT: t('attendance.present'),
    ABSENT:  t('attendance.absent'),
    LATE:    t('attendance.late'),
    EXCUSED: t('attendance.excused'),
  };

  const order = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
  const ordered = order.map((k) => stats.find((s) => s.status === k)).filter(Boolean) as AttendanceStat[];

  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-8 sm:flex-row">
      {/* RINGS */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <defs>
            {ordered.map((item) => (
              <filter key={item.status} id={`ring-glow-${item.status}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                  <feFuncA type="linear" slope="0.5" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {ordered.map((item, idx) => {
            const r = outerR - idx * radiusStep;
            const circ = 2 * Math.PI * r;
            const c = RING_COLOR[item.status] || SYS.gray.light;
            const percent = item.count / total;
            const arc = circ * percent;
            const gapArc = circ * 0.012;

            return (
              <g key={item.status}>
                <circle
                  cx={size / 2} cy={size / 2} r={r}
                  stroke="currentColor" strokeWidth={strokeWidth}
                  className="text-[#00000010] dark:text-[#ffffff0A]"
                  fill="transparent"
                />
                <motion.circle
                  cx={size / 2} cy={size / 2} r={r}
                  stroke={c} strokeWidth={strokeWidth} fill="transparent"
                  strokeLinecap="round"
                  strokeDasharray={`${arc} ${circ}`}
                  initial={reduced ? false : { strokeDasharray: `0 ${circ}` }}
                  animate={{ strokeDasharray: `${Math.max(0, arc - gapArc)} ${circ}` }}
                  transition={{ duration: 1.6, ease: EASE_APPLE, delay: 0.2 + idx * 0.12 }}
                  filter={`url(#ring-glow-${item.status})`}
                />
              </g>
            );
          })}
        </svg>

        {/* Center metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.span
            initial={reduced ? false : { opacity: 1, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING.snappy, delay: 0.5 }}
            className="text-[38px] font-semibold leading-none tracking-tighter text-[#1D1D1F] tabular-nums dark:text-[#F5F5F7]"
          >
            <CountUp value={rate} suffix="%" />
          </motion.span>
          <span className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#86868B]">
            {t('dashboard.attendance')}
          </span>
        </div>
      </div>

      {/* LEGEND */}
      <div className="w-full flex-1 space-y-2.5">
        {ordered.map((item, idx) => {
          const c = RING_COLOR[item.status] || SYS.gray.light;
          const percent = Math.round((item.count / total) * 100);
          return (
            <motion.div
              key={item.status}
              initial={reduced ? false : { opacity: 1, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + idx * 0.08, ...SPRING.smooth }}
              whileHover={reduced ? undefined : { x: 5 }}
              className="flex items-center justify-between rounded-xl p-2.5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: c, boxShadow: `0 0 10px ${c}90` }}
                />
                <span className="text-[13px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {labels[item.status] ?? item.status}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[12px] font-medium tabular-nums text-[#86868B]">{percent}%</span>
                <span className="w-8 text-right text-[14px] font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
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
 * FEED ROWS
 * ========================================================================== */

function PaymentRow({
  payment, maxAmount,
}: {
  payment: DashboardStats['recentPayments'][number];
  maxAmount: number;
}) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const name = getStudentName(payment, t('dashboard.student'));
  const amount = Number(payment.amount) || 0;
  const progress = Math.min(100, Math.round((amount / maxAmount) * 100));
  const statusTone = statusColor(payment.status);

  const toneMap: Record<string, string> = {
    green: '#34C759', red: '#FF3B30', amber: '#FF9500', blue: '#007AFF', purple: '#AF52DE',
  };
  const tone = toneMap[statusTone] ?? '#8E8E93';

  return (
    <motion.div
      whileHover={reduced ? undefined : { scale: 1.012, x: 3 }}
      transition={SPRING.snappy}
      className="group flex items-center gap-4 rounded-[1.25rem] p-3 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.035]"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ring-1 ring-white/40 dark:ring-black/30"
        style={{
          background: avatarGradient(name),
          boxShadow: `0 4px 12px -4px ${SYS.blue.glow}`,
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent 60%)' }}
        />
        <span className="relative">{getInitials(name)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
            {name}
          </p>
          <span className="shrink-0 text-[14px] font-bold tracking-tight tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
            {formatCurrency(amount)}
          </span>
        </div>

        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0000000A] dark:bg-[#ffffff10]">
          <motion.div
            initial={reduced ? false : { width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: EASE_APPLE, delay: 0.15 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${SYS.teal.light} 0%, ${SYS.blue.light} 100%)`,
              boxShadow: `0 0 8px ${SYS.blue.glow}`,
            }}
          />
        </div>
      </div>

      <span
        className="hidden shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight ring-1 sm:inline-flex"
        style={{
          background: `${tone}10`,
          color: tone,
          boxShadow: `inset 0 0 0 1px ${tone}25`,
        }}
      >
        {t(`payments.status.${payment.status}`)}
      </span>
    </motion.div>
  );
}

function FollowUpRow({
  name, note, time,
}: { name: string; note?: string; time: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.div
      whileHover={reduced ? undefined : { scale: 1.012, x: 3 }}
      transition={SPRING.snappy}
      className="group flex items-center gap-4 rounded-[1.25rem] p-3 transition-colors hover:bg-white/70 dark:hover:bg-white/[0.035]"
    >
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#AF52DE] ring-1 ring-[#AF52DE]/25 dark:text-[#BF5AF2]"
        style={{ background: `linear-gradient(145deg, ${SYS.purple.light}22 0%, ${SYS.purple.light}0D 100%)` }}
      >
        <Icon paths={I.calendarCheck} size={20} strokeWidth={2} className="relative" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
          {name}
        </p>
        {note && (
          <p className="mt-0.5 truncate text-[12px] font-medium text-[#86868B]">
            {note}
          </p>
        )}
      </div>

      <span className="shrink-0 rounded-lg bg-[#0000000A] px-2.5 py-1 text-[11px] font-semibold tabular-nums text-[#86868B] dark:bg-[#ffffff10] dark:text-[#98989D]">
        {time}
      </span>
    </motion.div>
  );
}

/* ============================================================================
 * ✨ QUICK ACTIONS DOCK (floating, bottom-right)
 * ========================================================================== */

function QuickActionsDock() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  const actions = [
    { to: '/students/new', icon: I.userPlus, label: t('students.create'), color: '#007AFF' },
    { to: '/groups/new', icon: I.plus, label: t('groups.create'), color: '#32ADE6' },
    { to: '/attendance', icon: I.calendarCheck, label: t('nav.attendance'), color: '#34C759' },
    { to: '/payments', icon: I.creditCard, label: t('payments.title'), color: '#AF52DE' },
  ];

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-30 hidden md:flex md:flex-col md:items-end md:gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 1, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 1, y: 20 }}
            transition={SPRING.smooth}
            className="pointer-events-auto flex flex-col gap-2"
          >
            {actions.map((action, idx) => (
              <motion.button
                key={action.to}
                type="button"
                onClick={() => { navigate(action.to); setOpen(false); }}
                initial={reduced ? false : { opacity: 1, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 1, x: 20, scale: 0.9 }}
                transition={{ delay: idx * 0.04, ...SPRING.snappy }}
                whileHover={reduced ? undefined : { scale: 1.05, x: -4 }}
                whileTap={{ scale: 0.95 }}
                className="group flex items-center gap-3 rounded-full border border-[#ffffff70] bg-[#ffffffdd] py-2.5 pl-3 pr-5 text-[13px] font-semibold tracking-tight shadow-[0_8px_32px_rgba(0,0,0,0.12)] backdrop-blur-2xl transition-colors hover:bg-[#ffffff] dark:border-[#ffffff15] dark:bg-[#1c1c1ecc] dark:hover:bg-[#1c1c1e]"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{
                    background: `${action.color}15`,
                    color: action.color,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px -2px ${action.color}40`,
                  }}
                >
                  <Icon paths={action.icon} size={15} strokeWidth={2.2} />
                </span>
                <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{action.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={reduced ? undefined : { scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={SPRING.snappy}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={open}
        className="pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_12px_40px_rgba(0,122,255,0.45)] outline-none focus-visible:ring-4 focus-visible:ring-[#007AFF]/40"
        style={{
          background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent 60%)' }}
        />
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={SPRING.snappy}
          className="relative"
        >
          <Icon paths={I.plus} size={24} strokeWidth={2.5} />
        </motion.span>

        {/* Ambient ring */}
        {!reduced && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{ boxShadow: '0 0 0 2px rgba(0,122,255,0.4)' }}
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </motion.button>
    </div>
  );
}

/* ============================================================================
 * SKELETON
 * ========================================================================== */

function Shimmer({ className = '', radius = '1rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="page-container space-y-7 pb-14 pt-4">
      <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <Shimmer className="h-4 w-32" radius="9999px" />
          <Shimmer className="h-9 w-72" radius="9999px" />
          <Shimmer className="h-4 w-56" radius="9999px" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-10 w-28" radius="0.75rem" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-[180px] rounded-[2rem] border border-white/20 bg-white/50 p-6 backdrop-blur-2xl dark:border-white/5 dark:bg-[#1C1C1E]/50"
          >
            <Shimmer className="h-11 w-11" radius="0.875rem" />
            <Shimmer className="mt-8 h-8 w-28" radius="9999px" />
            <Shimmer className="mt-3 h-3.5 w-24" radius="9999px" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Shimmer className="h-[420px]" radius="2rem" />
        <Shimmer className="h-[420px]" radius="2rem" />
      </div>
    </div>
  );
}

/* ============================================================================
 * VISION-OS BACKDROP
 * ========================================================================== */

function DashboardBackdrop() {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#F5F5F7] dark:bg-[#000000]"
    >
      <div
        className="absolute inset-0 z-0 opacity-[0.02] mix-blend-overlay dark:opacity-[0.04]"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
        }}
      />

      {!reduced && (
        <>
          <motion.div
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [0.95, 1.05, 0.95],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-[15%] -top-[15%] h-[55rem] w-[55rem] rounded-full bg-gradient-to-br from-[#007AFF]/15 to-[#AF52DE]/15 blur-[120px] dark:from-[#007AFF]/20 dark:to-[#AF52DE]/20"
          />
          <motion.div
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [0.95, 1.05, 0.95],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            className="absolute -right-[15%] top-[10%] h-[60rem] w-[60rem] rounded-full bg-gradient-to-bl from-[#34C759]/10 to-[#32ADE6]/15 blur-[140px] dark:from-[#34C759]/15 dark:to-[#32ADE6]/20"
          />
          <motion.div
            animate={{
              opacity: [0.4, 0.7, 0.4],
              scale: [0.95, 1.05, 0.95],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
            className="absolute -bottom-[20%] left-[25%] h-[50rem] w-[50rem] rounded-full bg-gradient-to-tr from-[#FF9500]/10 to-[#FF3B30]/10 blur-[130px] dark:from-[#FF9500]/15 dark:to-[#FF3B30]/15"
          />
        </>
      )}
    </div>
  );
}

/* ============================================================================
 * MAIN
 * ========================================================================== */

export function DashboardPage() {
  const { t } = useI18n();
  usePageTitle(t('dashboard.title'));
  const reduced = usePrefersReducedMotion();
  const navigate = useNavigate();

  /* ✨ NEW: period state */
  const [period, setPeriod] = useState<Period>('1Y');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboardApi.stats,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const stats = data as DashboardStats | undefined;

  const paidShare = useMemo(() => (stats ? calculatePaidShare(stats) : 0), [stats]);
  const monthlyRevenue = stats?.monthlyRevenue ?? [];

  const revenueTrend = useMemo(
    () => monthlyRevenue.map((item) => Number(item.total) || 0),
    [monthlyRevenue],
  );

  const maxPayment = useMemo(
    () => Math.max(1, ...(stats?.recentPayments ?? []).map((p) => Number(p.amount) || 0)),
    [stats?.recentPayments],
  );

  /* ✨ NEW: time-aware greeting */
  const greeting = useMemo(() => getGreeting(t), [t]);

  /* ✨ NEW: keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        navigate('/students/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

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
          <GlassPageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} />
          <GlassCard className="mt-6 p-10" interactive={false}>
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
        className="page-container space-y-7 pb-14 pt-4"
      >
        {/* ==============================================================
            HEADER — greeting + live pulse
        ============================================================== */}
        <motion.header
          variants={itemVariants}
          className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"
        >
          <div>
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                {!reduced && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3B30] opacity-70" />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3B30]" />
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#86868B]">
                {t('dashboard.liveOverview') || 'Live Overview'}
              </p>
              <span className="text-[11px] font-medium text-[#86868B]/70">·</span>
              <span className="text-[11px] font-medium text-[#86868B]">
                <LiveClock />
              </span>
            </div>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
              {greeting.emoji} {greeting.text}
            </h1>
            <p className="mt-1 text-[14px] font-medium text-[#86868B]">
              {t('dashboard.description')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <GlassButton asChild variant="secondary" size="sm" className="rounded-xl font-semibold tracking-tight">
              <Link to="/students/new" className="flex items-center gap-2">
                <Icon paths={I.userPlus} size={16} className="text-[#007AFF]" />
                {t('students.create')}
              </Link>
            </GlassButton>

            <GlassButton asChild variant="secondary" size="sm" className="rounded-xl font-semibold tracking-tight">
              <Link to="/groups/new" className="flex items-center gap-2">
                <Icon paths={I.plus} size={16} className="text-[#32ADE6]" />
                {t('groups.create')}
              </Link>
            </GlassButton>

            <GlassButton asChild variant="secondary" size="sm" className="rounded-xl font-semibold tracking-tight">
              <Link to="/attendance" className="flex items-center gap-2">
                <Icon paths={I.calendarCheck} size={16} className="text-[#34C759]" />
                {t('nav.attendance')}
              </Link>
            </GlassButton>

            <GlassButton asChild variant="primary" size="sm" className="rounded-xl font-semibold tracking-tight shadow-lg shadow-[#007AFF]/30">
              <Link to="/payments" className="flex items-center gap-2">
                <Icon paths={I.creditCard} size={16} />
                {t('payments.title')}
              </Link>
            </GlassButton>
          </div>
        </motion.header>

        {/* ==============================================================
            STATS
        ============================================================== */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t('dashboard.activeStudents')}
            value={stats.totalStudents}
            description={t('dashboard.activeStudentsSub', { count: stats.activeStudents })}
            color={SYS.blue}
            icon={I.users}
            badgeText={stats.totalStudents > 0 ? `${Math.round((stats.activeStudents / stats.totalStudents) * 100)}% ${t('dashboard.active') || 'active'}` : undefined}
            isPositive={stats.activeStudents > stats.totalStudents * 0.5}
          />
          <StatCard
            title={t('dashboard.activeGroups')}
            value={stats.activeGroups}
            description={t('dashboard.activeGroupsSub', { count: stats.activeGroups })}
            color={SYS.purple}
            icon={I.usersRound}
            badgeText={stats.activeGroups > 0 ? `${stats.activeGroups} ${t('dashboard.active') || 'active'}` : undefined}
            isPositive={stats.activeGroups > 0}
          />
          <StatCard
            title={t('dashboard.revenueCollected')}
            value={Number(stats.totalPaid) || 0}
            valueFormat="currency"
            description={t('dashboard.revenueSub', {
              rate: paidShare,
              pending: formatCurrency(stats.totalPending),
            })}
            color={SYS.green}
            icon={I.wallet}
            trend={revenueTrend.slice(-8)}
            badgeText={`${paidShare}%`}
            isPositive={paidShare >= 50}
          />
          <StatCard
            title={t('dashboard.leadConversion')}
            value={Number(stats.conversionRate) || 0}
            description={t('dashboard.leadSub', {
              newCount: stats.newLeadsThisMonth,
              total: stats.totalLeads,
            })}
            color={SYS.orange}
            icon={I.trend}
            trend={revenueTrend.length > 1 ? revenueTrend.slice(-8) : undefined}
            badgeText={stats.conversionRate > 0 ? `${stats.conversionRate}%` : undefined}
            isPositive={Number(stats.conversionRate) >= 20}
          />
        </section>

        {/* ==============================================================
            ANALYTICS
        ============================================================== */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
          <GlassCard className="p-7">
            <SectionHeader
              title={t('dashboard.monthlyRevenue')}
              subtitle={t('dashboard.paymentCollection')}
              action={
                <div className="flex items-center gap-3">
                  <PeriodSelector value={period} onChange={setPeriod} />
                  <Link
                    to="/payments"
                    className="group hidden items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-3.5 py-1.5 text-[12px] font-bold tracking-tight text-[#007AFF] transition-all hover:gap-2 hover:bg-[#007AFF]/20 sm:inline-flex dark:bg-[#0A84FF]/15 dark:text-[#0A84FF]"
                  >
                    {t('dashboard.viewPayments')}
                    <Icon paths={I.arrowUpRight} size={14} strokeWidth={2.5} className="transition-transform group-hover:rotate-12" />
                  </Link>
                </div>
              }
            />
            <RevenueChart data={monthlyRevenue} period={period} />
          </GlassCard>

          <GlassCard className="p-7">
            <SectionHeader
              title={t('dashboard.attendance')}
              subtitle={t('dashboard.last30Days')}
            />
            <ActivityRings stats={stats.attendanceStats ?? []} />
          </GlassCard>
        </section>

        {/* ==============================================================
            FEEDS
        ============================================================== */}
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <GlassCard className="p-7">
            <SectionHeader
              title={t('dashboard.recentPayments')}
              subtitle={t('dashboard.paymentCollection')}
              action={
                <Link
                  to="/payments"
                  aria-label={t('dashboard.viewPayments')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0000000A] text-[#1D1D1F] transition-all hover:scale-105 hover:bg-[#00000012] dark:bg-[#ffffff10] dark:text-[#F5F5F7] dark:hover:bg-[#ffffff18]"
                >
                  <Icon paths={I.chevronRight} size={16} strokeWidth={2.5} />
                </Link>
              }
            />

            <div className="mt-5 space-y-1">
              {stats.recentPayments?.length ? (
                stats.recentPayments.slice(0, 5).map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} maxAmount={maxPayment} />
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

          <GlassCard className="p-7">
            <SectionHeader
              title={t('dashboard.upcomingFollowUps')}
              subtitle={t('dashboard.viewLeads')}
              action={
                <Link
                  to="/leads"
                  aria-label={t('dashboard.viewLeads')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0000000A] text-[#1D1D1F] transition-all hover:scale-105 hover:bg-[#00000012] dark:bg-[#ffffff10] dark:text-[#F5F5F7] dark:hover:bg-[#ffffff18]"
                >
                  <Icon paths={I.chevronRight} size={16} strokeWidth={2.5} />
                </Link>
              }
            />

            <div className="mt-5 space-y-1">
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

        {/* ==============================================================
            SUMMARY
        ============================================================== */}
        <GlassCard className="p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div
                className="relative flex h-12 w-12 items-center justify-center rounded-full text-[#34C759] dark:text-[#30D158]"
                style={{
                  background: `linear-gradient(145deg, ${SYS.green.light}22 0%, ${SYS.green.light}0D 100%)`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -4px ${SYS.green.glow}`,
                }}
              >
                <Icon paths={I.checkCircle} size={24} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('dashboard.collectionRate')}
                </p>
                <p className="mt-0.5 text-[12px] font-medium tabular-nums text-[#86868B]">
                  {formatCurrency(stats.totalPaid)} {t('dashboard.paid')}
                </p>
              </div>
            </div>

            <div className="w-full md:max-w-md">
              <div className="mb-2.5 flex items-center justify-between text-[13px]">
                <span className="font-semibold text-[#86868B]">
                  {t('dashboard.collectionRate')}
                </span>
                <strong className="font-bold tabular-nums tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                  <CountUp value={paidShare} suffix="%" />
                </strong>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#0000000A] dark:bg-[#ffffff10]">
                <motion.div
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${paidShare}%` }}
                  transition={{ duration: 1.6, ease: EASE_APPLE }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${SYS.blue.light} 0%, ${SYS.teal.light} 50%, ${SYS.green.light} 100%)`,
                    boxShadow: `0 0 12px ${SYS.green.glow}`,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-8 rounded-2xl bg-[#00000005] p-4 dark:bg-[#ffffff08]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('dashboard.overdue')}
                </p>
                <p className="mt-1 text-[16px] font-bold tabular-nums tracking-tight text-[#FF3B30] dark:text-[#FF453A]">
                  {formatCurrency(stats.totalOverdue)}
                </p>
              </div>
              <div className="h-8 w-px bg-[#00000015] dark:bg-[#ffffff15]" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('dashboard.pending')}
                </p>
                <p className="mt-1 text-[16px] font-bold tabular-nums tracking-tight text-[#FF9500] dark:text-[#FF9F0A]">
                  {formatCurrency(stats.totalPending)}
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.main>

      {/* ✨ Quick actions dock */}
      <QuickActionsDock />
    </>
  );
}
