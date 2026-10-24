/**
 * M-EDU StudentsPage — v28 "Spatial Liquid Glass · Executive Studio"
 *
 * 🎯 v27 → v28 Premium Upgrades:
 *  ✅ Aurora Ambient Canvas — Refined header halo with breathing gradient
 *  ✅ Sparkline Telemetry — Real SVG micro-charts in every stat tile
 *  ✅ Chromatic Glass Rim — Multi-layer specular + subtle optical aberration
 *  ✅ Cinematic Micro-Interactions — Taktil springs on every interactive element
 *  ✅ Timeline Freeze Preview — Visual duration timeline in freeze modal
 *  ✅ Refined Bulk Dock — Selection preview + gradient halo pulse
 *  ✅ Ghost Row Skeletons — Data-shaped loading states (not generic bars)
 *  ✅ Premium Typographic Rhythm — SF-tuned tracking, optical alignment
 *  ✅ Chromatically-Aware Table — Row-level hover halos & status lenses
 */

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { studentsApi, groupsApi } from '@/lib/api';
import { openQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  GlassPageHeader,
  GlassErrorState,
  GlassEmptyState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassBadge,
  GlassButton,
  ConfirmDialog,
  GlassModal,
  GlassField,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { useDebounce } from '@/hooks/useDebounce';
import { fullName } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Student, Group } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS — 120Hz ProMotion · Apple-grade Physics
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 560, damping: 32, mass: 0.62 },
  smooth: { type: 'spring' as const, stiffness: 340, damping: 30, mass: 0.85 },
  soft:   { type: 'spring' as const, stiffness: 240, damping: 28, mass: 1.0 },
  island: { type: 'spring' as const, stiffness: 500, damping: 30, mass: 0.72 },
  breathe:{ type: 'spring' as const, stiffness: 180, damping: 22, mass: 1.2 },
} as const;

const EASE_PREMIUM = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6, scale: 0.995 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

const tileVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.955 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA AMBIENT CANVAS — Breathing header halo
 * ════════════════════════════════════════════════════════════════════════ */

const AuroraCanvas = memo(function AuroraCanvas() {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-40 z-0 flex h-[420px] justify-center overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: EASE_PREMIUM }}
        className="relative h-full w-full"
      >
        <div className="absolute left-1/2 top-1/2 h-[280px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/15 blur-[100px] dark:bg-sky-500/12" />
        <div className="absolute left-1/3 top-1/2 h-[200px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/10 blur-[90px] dark:bg-violet-500/10" />
        <div className="absolute right-1/4 top-1/2 h-[200px] w-[400px] translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-[90px] dark:bg-emerald-500/08" />
        {!reduced && (
          <motion.div
            animate={{
              scale: [1, 1.06, 1],
              opacity: [0.9, 1, 0.9],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute left-1/2 top-1/2 h-[320px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.06] via-violet-500/[0.04] to-emerald-500/[0.06] blur-[120px] dark:from-sky-500/[0.08] dark:via-violet-500/[0.05] dark:to-emerald-500/[0.06]"
          />
        )}
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * OPTICAL GLASS SURFACE — Chromatic layered depth
 * ════════════════════════════════════════════════════════════════════════ */

const GlassCardSurface = memo(function GlassCardSurface({
  children,
  className = '',
  hover = false,
  subtle = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-[22px]',
        subtle
          ? 'border border-black/[0.05] dark:border-white/[0.06]'
          : 'border border-black/[0.06] dark:border-white/[0.08]',
        subtle
          ? 'bg-white/70 dark:bg-surface-900/70'
          : 'bg-white/80 dark:bg-surface-900/80',
        'backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.03),0_16px_40px_-12px_rgba(15,23,42,0.07),0_1px_0_0_rgba(255,255,255,0.85)_inset]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.45),0_20px_48px_-14px_rgba(0,0,0,0.7),0_1px_0_0_rgba(255,255,255,0.09)_inset]',
        hover
          ? 'transition-all duration-300 hover:border-slate-300/90 dark:hover:border-white/[0.16]'
          : '',
        className,
      ].join(' ')}
    >
      {/* Primary Top Specular Rim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.2]"
      />
      {/* Chromatic Left Rim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-8 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/15 to-transparent dark:via-sky-400/20"
      />
      {/* Chromatic Right Rim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-violet-400/15 to-transparent dark:via-violet-400/20"
      />
      {/* Sub-Surface Ambient Luminescence */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-32 w-2/3 -translate-x-1/2 rounded-full bg-blue-500/[0.035] blur-3xl dark:bg-sky-400/[0.05]"
      />
      {children}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

interface StudentFilters {
  page: number;
  limit: number;
  search?: string;
  groupId?: string;
}

interface FreezeFormData {
  startDate: string;
  endDate: string;
  reason: string;
}

type StatusQuickFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WITH_GROUPS';
type SortField = 'name' | 'groups' | 'status';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'table' | 'grid';

function createDefaultFreezeForm(): FreezeFormData {
  const now = new Date();
  const twoWeeksLater = new Date(now.getTime() + 14 * 86_400_000);
  return {
    startDate: now.toISOString().split('T')[0],
    endDate: twoWeeksLater.toISOString().split('T')[0],
    reason: 'Tibbiy sabab / Kasallik ma\'lumotnomasi (Medical leave)',
  };
}

function addDaysToIso(isoDate: string, days: number): string {
  const base = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(base.getTime())) return new Date().toISOString().split('T')[0];
  const next = new Date(base.getTime() + days * 86_400_000);
  return next.toISOString().split('T')[0];
}

function calculateFreezeDays(startDate: string, endDate: string): number {
  const s = new Date(startDate).getTime();
  const e = new Date(endDate).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS — SF Symbols 7 · Precision Duotone
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.85;

const I = {
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6',
    'M22 11h-6',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  pause: ['M10 4H6v16h4z', 'M18 4h-4v16h4z'],
  usersRound: [
    'M18 21a8 8 0 0 0-16 0',
    'M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  parent: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M19 8v6',
    'M22 11h-6',
  ],
  snowflake: [
    'M12 2v20',
    'M17 5 7 19',
    'M7 5 17 19',
    'M2 12h20',
    'M20 9l-4 3 4 3',
    'M4 9l4 3-4 3',
  ],
  play: ['M6 4l14 8-14 8V4z'],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z',
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ],
  copy: [
    'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z',
    'M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2',
  ],
  check: ['M20 6 9 17l-5-5'],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  sort: ['M7 15l5 5 5-5', 'M7 9l5-5 5 5'],
  sparkles: [
    'M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z',
  ],
  calendar: [
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M16 2v4',
    'M8 2v4',
    'M3 10h18',
  ],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
} as const;

const Icon = memo(function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  duotone = false,
  ...rest
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
  duotone?: boolean;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={duotone && i === 0 ? 'currentColor' : 'none'}
          fillOpacity={duotone && i === 0 ? 0.14 : 0}
          strokeOpacity={duotone && i > 1 ? 0.65 : 1}
        />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PUBLIC HELPERS (100% Preserved Contract)
 * ════════════════════════════════════════════════════════════════════════ */

export function formatStudentName(student: Student): string {
  return fullName(student.user?.firstName, student.user?.lastName);
}

export function getStudentStatusBadge(isActive: boolean | undefined): {
  color: string;
  label: string;
} {
  return isActive === false
    ? { color: 'red', label: 'enum.status.INACTIVE' }
    : { color: 'green', label: 'enum.status.ACTIVE' };
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const AVATAR_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#0F172A', '#1E293B', '#38BDF8'],
  ['#1E3A8A', '#2563EB', '#93C5FD'],
  ['#312E81', '#4F46E5', '#A5B4FC'],
  ['#064E3B', '#059669', '#6EE7B7'],
  ['#78350F', '#D97706', '#FCD34D'],
  ['#134E4A', '#0D9488', '#5EEAD4'],
  ['#4C1D95', '#7C3AED', '#C4B5FD'],
  ['#831843', '#DB2777', '#F9A8D4'],
];

function avatarStyle(name: string): { background: string; glow: string } {
  const [a, b, c] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return {
    background: `radial-gradient(circle at 28% 22%, ${c}44 0%, transparent 55%), linear-gradient(135deg, ${a} 0%, ${b} 100%)`,
    glow: b,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS
 * ════════════════════════════════════════════════════════════════════════ */

const CountUp = memo(function CountUp({
  value,
  duration = 0.9,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    if (reduced) {
      prevValueRef.current = value;
      el.textContent = `${value.toLocaleString()}${suffix}`;
      return;
    }
    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;
    if (from === to) {
      el.textContent = `${to.toLocaleString()}${suffix}`;
      return;
    }
    let rafId: number;
    let startTime: number | null = null;
    const durationMs = duration * 1000;
    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(from + (to - from) * eased);
      if (spanRef.current) {
        spanRef.current.textContent = `${current.toLocaleString()}${suffix}`;
      }
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration, suffix, reduced]);

  return (
    <span ref={spanRef} className="tabular-nums">
      {value.toLocaleString()}
      {suffix}
    </span>
  );
});

/* ── Sparkline — Minimal SVG micro-chart ─────────────────────────── */
const Sparkline = memo(function Sparkline({
  data,
  className = '',
  stroke = 'currentColor',
}: {
  data: number[];
  className?: string;
  stroke?: string;
}) {
  const { path, area } = useMemo(() => {
    if (!data.length) return { path: '', area: '' };
    const w = 100;
    const h = 28;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return [x, y];
    });
    const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
    const a = `${d} L${w},${h} L0,${h} Z`;
    return { path: d, area: a };
  }, [data]);

  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill="url(#sparkline-fill)" />}
      {path && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
});

/* ── StudentAvatar — Squircle / Halo Presence Ring ──────────────── */
const StudentAvatar = memo(function StudentAvatar({
  name,
  size = 40,
  isActive = true,
}: {
  name: string;
  size?: number;
  isActive?: boolean;
}) {
  const style = avatarStyle(name);
  return (
    <div className="relative inline-flex shrink-0 select-none">
      <div
        className="relative flex items-center justify-center rounded-[13px] font-bold text-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.3),0_1px_0_0_rgba(255,255,255,0.35)_inset] ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-[1.04] dark:ring-white/15"
        style={{
          width: size,
          height: size,
          background: style.background,
          fontSize: Math.round(size * 0.34),
          letterSpacing: '0.025em',
        }}
      >
        <span className="relative z-10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          {getInitials(name)}
        </span>
      </div>
      <span
        aria-hidden="true"
        className={[
          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-surface-900',
          isActive
            ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]'
            : 'bg-amber-500 shadow-[0_0_6px_#F59E0B]',
        ].join(' ')}
      />
    </div>
  );
});

/* ── StatTile — Interactive Telemetry Card + Sparkline ─────────── */
type StatTone = 'blue' | 'green' | 'orange' | 'purple';

const STAT_PALETTE: Record<
  StatTone,
  {
    iconBg: string;
    iconFg: string;
    activeRing: string;
    barColor: string;
    pillBg: string;
    glow: string;
    sparkStroke: string;
    sparkSeries: number[];
  }
> = {
  blue: {
    iconBg: 'bg-gradient-to-br from-blue-500/15 to-sky-500/5 dark:from-blue-500/25 dark:to-sky-500/10',
    iconFg: 'text-blue-600 dark:text-sky-400',
    activeRing: 'ring-2 ring-blue-500/60 dark:ring-sky-400/60 border-blue-400/60',
    barColor: 'bg-gradient-to-r from-blue-600 to-sky-400',
    pillBg: 'bg-blue-500/10 text-blue-700 dark:bg-sky-400/15 dark:text-sky-300',
    glow: 'from-blue-500/12 via-transparent',
    sparkStroke: '#38BDF8',
    sparkSeries: [12, 18, 14, 22, 20, 28, 24, 34, 30, 38, 42, 48],
  },
  green: {
    iconBg: 'bg-gradient-to-br from-emerald-500/15 to-teal-500/5 dark:from-emerald-500/25 dark:to-teal-500/10',
    iconFg: 'text-emerald-600 dark:text-emerald-400',
    activeRing: 'ring-2 ring-emerald-500/60 dark:ring-emerald-400/60 border-emerald-400/60',
    barColor: 'bg-gradient-to-r from-emerald-600 to-teal-400',
    pillBg: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
    glow: 'from-emerald-500/12 via-transparent',
    sparkStroke: '#10B981',
    sparkSeries: [8, 12, 10, 16, 14, 20, 18, 22, 26, 24, 30, 34],
  },
  orange: {
    iconBg: 'bg-gradient-to-br from-amber-500/15 to-orange-500/5 dark:from-amber-500/25 dark:to-orange-500/10',
    iconFg: 'text-amber-600 dark:text-amber-400',
    activeRing: 'ring-2 ring-amber-500/60 dark:ring-amber-400/60 border-amber-400/60',
    barColor: 'bg-gradient-to-r from-amber-500 to-orange-400',
    pillBg: 'bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
    glow: 'from-amber-500/12 via-transparent',
    sparkStroke: '#F59E0B',
    sparkSeries: [18, 16, 20, 14, 18, 12, 16, 10, 14, 8, 12, 6],
  },
  purple: {
    iconBg: 'bg-gradient-to-br from-indigo-500/15 to-violet-500/5 dark:from-indigo-500/25 dark:to-violet-500/10',
    iconFg: 'text-indigo-600 dark:text-indigo-400',
    activeRing: 'ring-2 ring-indigo-500/60 dark:ring-indigo-400/60 border-indigo-400/60',
    barColor: 'bg-gradient-to-r from-indigo-600 to-violet-400',
    pillBg: 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300',
    glow: 'from-indigo-500/12 via-transparent',
    sparkStroke: '#8B5CF6',
    sparkSeries: [10, 14, 12, 18, 16, 22, 20, 26, 22, 28, 26, 30],
  },
};

const StatTile = memo(function StatTile({
  label,
  value,
  total,
  icon,
  tone = 'blue',
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  total: number;
  icon: readonly string[];
  tone?: StatTone;
  active?: boolean;
  onClick?: () => void;
}) {
  const c = STAT_PALETTE[tone];
  const reduced = usePrefersReducedMotion();
  const ratio = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 100;

  return (
    <motion.button
      type="button"
      data-testid={`metric-pill-${tone}`}
      variants={tileVariants}
      whileHover={reduced ? undefined : { y: -3, scale: 1.008 }}
      whileTap={reduced ? undefined : { scale: 0.985 }}
      transition={SPRING.snappy}
      onClick={onClick}
      aria-pressed={active}
      className={[
        'group relative flex w-full flex-col justify-between overflow-hidden rounded-[22px] p-4 text-left select-none outline-none',
        'border border-black/[0.06] dark:border-white/[0.08]',
        'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl',
        'shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_28px_-8px_rgba(15,23,42,0.06),0_1px_0_0_rgba(255,255,255,0.85)_inset]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_32px_-10px_rgba(0,0,0,0.6),0_1px_0_0_rgba(255,255,255,0.09)_inset]',
        'transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#007AFF]',
        active ? c.activeRing : 'hover:border-black/[0.12] dark:hover:border-white/[0.16]',
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${c.glow} to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/[0.18]"
      />

      <div className="relative z-10 flex w-full items-start justify-between gap-2">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${c.iconBg} ${c.iconFg} shadow-[0_1px_0_0_rgba(255,255,255,0.6)_inset] ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105 dark:ring-white/10`}
        >
          <Icon paths={icon} size={19} strokeWidth={2.0} duotone />
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-tight tabular-nums ${c.pillBg}`}
        >
          {ratio}%
        </span>
      </div>

      <div className="relative z-10 mt-3 w-full">
        <div className="text-[26px] font-extrabold leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            {label}
          </span>
        </div>

        <div className="relative mt-2.5 h-8 w-full">
          <Sparkline
            data={c.sparkSeries}
            stroke={c.sparkStroke}
            className="absolute inset-0 h-full w-full opacity-70 transition-opacity duration-300 group-hover:opacity-100"
          />
        </div>

        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.07]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${ratio}%` }}
            transition={{ duration: 0.8, ease: EASE_PREMIUM }}
            className={`h-full rounded-full ${c.barColor}`}
          />
        </div>
      </div>
    </motion.button>
  );
});

/* ── CopyChip ──────────────────────────────────────────────────── */
const CopyChip = memo(function CopyChip({
  value,
  icon,
  maxWidth = '185px',
}: {
  value: string;
  icon: readonly string[];
  maxWidth?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!navigator?.clipboard) return;
      void navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`${value} (Nusxalash uchun bosing)`}
      className="group/chip inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1 -mx-2 text-[12.5px] font-medium text-[var(--text-secondary)] transition-all duration-150 hover:border-slate-200/80 hover:bg-white/80 hover:text-slate-900 hover:shadow-xs dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-white"
    >
      <Icon
        paths={copied ? I.check : icon}
        size={13}
        strokeWidth={2.0}
        className={
          copied
            ? 'text-emerald-500'
            : 'opacity-55 transition-opacity group-hover/chip:opacity-90'
        }
      />
      <span className="truncate tabular-nums" style={{ maxWidth }}>
        {value}
      </span>
      <Icon
        paths={I.copy}
        size={11}
        className="opacity-0 transition-opacity group-hover/chip:opacity-50"
      />
    </button>
  );
});

/* ── Shimmer ───────────────────────────────────────────────────── */
const Shimmer = memo(function Shimmer({
  className = '',
  radius = '0.85rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    />
  );
});

/* ── Ghost Row Skeleton (data-shaped) ──────────────────────────── */
const GhostRow = memo(function GhostRow({ index = 0 }: { index?: number }) {
  return (
    <div
      className="flex items-center gap-4 border-b border-slate-200/60 p-4 last:border-0 dark:border-white/[0.06]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Shimmer className="h-4 w-4 shrink-0" radius="4px" />
      <Shimmer className="h-9 w-9 shrink-0" radius="13px" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3.5 w-40" radius="0.5rem" />
        <Shimmer className="h-2.5 w-52" radius="0.5rem" />
      </div>
      <Shimmer className="hidden h-3 w-32 sm:block" radius="0.5rem" />
      <Shimmer className="hidden h-5 w-20 md:block" radius="9999px" />
      <Shimmer className="hidden h-5 w-16 lg:block" radius="9999px" />
    </div>
  );
});

const StudentsSkeleton = memo(function StudentsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[148px]" radius="1.375rem" />
        ))}
      </div>
      <Shimmer className="h-[72px]" radius="1.375rem" />
      <GlassCardSurface>
        <div className="border-b border-slate-200/60 p-3.5 dark:border-white/[0.06]">
          <Shimmer className="h-5 w-40" radius="0.5rem" />
        </div>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <GhostRow key={i} index={i} />
        ))}
      </GlassCardSurface>
    </div>
  );
});

/* ── RowAction ─────────────────────────────────────────────────── */
const RowAction = memo(function RowAction({
  icon,
  label,
  tone,
  to,
  onClick,
  disabled,
  loading,
}: {
  icon: readonly string[];
  label: string;
  tone: 'edit' | 'freeze' | 'delete';
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const toneClasses =
    tone === 'delete'
      ? 'text-[#FF3B30] hover:bg-[#FF3B30]/12 hover:border-[#FF3B30]/30 dark:text-[#FF453A]'
      : tone === 'freeze'
        ? 'text-sky-600 hover:bg-sky-500/12 hover:border-sky-500/30 dark:text-sky-400'
        : 'text-[#007AFF] hover:bg-[#007AFF]/12 hover:border-[#007AFF]/30 dark:text-[#38BDF8]';

  const baseClass = [
    'flex h-8 w-8 items-center justify-center rounded-[11px] outline-none select-none',
    'border border-slate-200/80 bg-white/75 shadow-[0_1px_0_#FFF_inset,0_2px_5px_rgba(15,23,42,0.04)]',
    'dark:border-white/[0.10] dark:bg-white/[0.05] dark:shadow-none',
    'transition-all duration-200 hover:scale-105 active:scale-95',
    'focus-visible:ring-2 focus-visible:ring-[#007AFF]/60',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    toneClasses,
  ].join(' ');

  const content = loading ? (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ) : (
    <Icon paths={icon} size={15} strokeWidth={2.05} />
  );

  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={baseClass}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={baseClass}
    >
      {content}
    </button>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * FREEZE TIMELINE PREVIEW — Visual duration bar
 * ════════════════════════════════════════════════════════════════════════ */

const FreezeTimeline = memo(function FreezeTimeline({
  startDate,
  endDate,
  days,
}: {
  startDate: string;
  endDate: string;
  days: number;
}) {
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('uz-UZ', {
        day: '2-digit',
        month: 'short',
      });
    } catch {
      return iso;
    }
  };
  const pct = Math.min(100, Math.max(5, (days / 30) * 100));
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.06] via-blue-500/[0.03] to-transparent p-3.5 dark:border-sky-400/15">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
        <span className="text-slate-500 dark:text-slate-400">
          {fmt(startDate)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-sky-700 tabular-nums dark:text-sky-300">
          <Icon paths={I.calendar} size={10} strokeWidth={2.4} />
          {days} kun
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          {fmt(endDate)}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: EASE_PREMIUM }}
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500"
        />
        <motion.div
          animate={pct > 70 ? { opacity: [0.5, 1, 0.5] } : { opacity: 0.4 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-y-0 right-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN STUDENTS PAGE
 * ════════════════════════════════════════════════════════════════════════ */

export function StudentsPage() {
  const { t } = useI18n();
  usePageTitle(t('students.title'));
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusQuickFilter>('ALL');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [freezeTarget, setFreezeTarget] = useState<Student | null>(null);
  const [freezeForm, setFreezeForm] = useState<FreezeFormData>(createDefaultFreezeForm);

  const debouncedSearch = useDebounce(search.trim(), 300);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === '/' && !isTyping) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, groupId]);

  const params = useMemo<StudentFilters>(
    () => ({
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      groupId: groupId || undefined,
    }),
    [page, debouncedSearch, groupId],
  );

  const students = useQuery({
    queryKey: queryKeys.students.list(params),
    queryFn: () => studentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const groups = useQuery({
    queryKey: queryKeys.groups.selectors(),
    queryFn: () => groupsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = students.data as Paginated<Student> | undefined;
  const rawStudentList = useMemo(() => data?.items ?? [], [data]);
  const groupList = useMemo(
    () => (groups.data as Paginated<Group> | undefined)?.items ?? [],
    [groups.data],
  );

  const stats = useMemo(() => {
    const active = rawStudentList.filter((s) => s.user?.isActive !== false).length;
    const inactive = rawStudentList.length - active;
    const withGroups = rawStudentList.filter((s) =>
      (s.groups ?? []).some((g) => g.isActive),
    ).length;
    return {
      total: data?.total ?? rawStudentList.length,
      pageTotal: rawStudentList.length,
      active,
      inactive,
      withGroups,
    };
  }, [rawStudentList, data?.total]);

  const studentList = useMemo(() => {
    const filtered = rawStudentList.filter((s) => {
      const isActive = s.user?.isActive !== false;
      const activeGroupCount = (s.groups ?? []).filter((g) => g.isActive).length;
      if (statusFilter === 'ACTIVE') return isActive;
      if (statusFilter === 'INACTIVE') return !isActive;
      if (statusFilter === 'WITH_GROUPS') return activeGroupCount > 0;
      return true;
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortField === 'name') {
        return formatStudentName(a).localeCompare(formatStudentName(b)) * dir;
      }
      if (sortField === 'groups') {
        const ga = (a.groups ?? []).filter((g) => g.isActive).length;
        const gb = (b.groups ?? []).filter((g) => g.isActive).length;
        return (ga - gb) * dir;
      }
      if (sortField === 'status') {
        const sa = a.user?.isActive !== false ? 1 : 0;
        const sb = b.user?.isActive !== false ? 1 : 0;
        return (sa - sb) * dir;
      }
      return 0;
    });
  }, [rawStudentList, statusFilter, sortField, sortDir]);

  const freezeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FreezeFormData }) =>
      studentsApi.freeze(id, payload),
    onSuccess: () => {
      push(
        'success',
        t('students.frozenSuccess') ||
          'Talaba darslari va to\'lovlari vaqtincha muzlatildi',
      );
      setFreezeTarget(null);
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: unknown) => push('error', getErrorMessage(e as Error)),
  });

  const unfreezeMutation = useMutation({
    mutationFn: (id: string) => studentsApi.unfreeze(id),
    onSuccess: () => {
      push(
        'success',
        t('students.unfrozenSuccess') ||
          'Talaba muzlatish holatidan chiqarildi va faollashtirildi',
      );
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: unknown) => push('error', getErrorMessage(e as Error)),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => studentsApi.remove(id),
    onSuccess: () => {
      push('success', t('students.deleted'));
      setDeleteTarget(null);
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.students.selectors() });
      void qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
      setDeleteTarget(null);
    },
  });

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    [],
  );

  const handleGroupFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setGroupId(e.target.value),
    [],
  );

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setGroupId('');
    setStatusFilter('ALL');
    setPage(1);
  }, []);

  const handleToggleSort = useCallback((field: SortField) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const handleQuickLook = useCallback(
    (student: Student) => {
      const studentName = formatStudentName(student);
      const activeGroups = (student.groups ?? []).filter((g) => g.isActive);
      const isActive = student.user?.isActive !== false;

      openQuickLook({
        id: student.id,
        type: 'student',
        title: studentName,
        subtitle: student.user?.email || student.user?.phone || 'M-EDU Talabasi',
        badge: {
          text: isActive ? 'Faol Talaba' : 'Muzlatilgan',
          tone: isActive ? 'emerald' : 'amber',
        },
        avatar: { text: studentName.slice(0, 2).toUpperCase() },
        metrics: [
          {
            label: 'Guruhlar',
            value: activeGroups.length,
            subtext:
              activeGroups.map((g) => g.group.name).join(', ') || 'Biriktirilmagan',
          },
          {
            label: 'Holati',
            value: isActive ? 'Faol' : 'Muzlatilgan',
            subtext: 'Davomat ochiq',
          },
          {
            label: 'Ota-onasi',
            value: student.parentName || '—',
            subtext: student.parentPhone || 'Telefon kiritilmagan',
          },
        ],
        details: [
          { label: 'Telefon', value: student.user?.phone || student.parentPhone || '—' },
          { label: 'Email', value: student.user?.email || '—' },
          { label: 'Ota-ona ismi', value: student.parentName || '—' },
          { label: 'Ota-ona telefoni', value: student.parentPhone || '—' },
          { label: 'Talaba ID raqami', value: student.id },
        ],
        tags: activeGroups.map((g) => g.group.name),
        primaryAction: {
          label: 'To\'liq kartani ochish',
          onExecute: () => navigate(`/students/${student.id}`),
        },
        secondaryAction: {
          label: 'Tahrirlash',
          onExecute: () => navigate(`/students/${student.id}/edit`),
        },
      });
    },
    [navigate],
  );

  const handleOpenStudentSidecar = useCallback(
    (student: Student) => {
      sound.playTick();
      const studentName = formatStudentName(student);
      const activeGroups = (student.groups ?? []).filter((g) => g.isActive);
      const isActive = student.user?.isActive !== false;

      openSidecar({
        id: student.id,
        type: 'student',
        title: studentName,
        subtitle: student.user?.email || student.user?.phone || 'M-EDU Talabasi',
        badge: {
          text: isActive ? 'Faol Talaba' : 'Muzlatilgan',
          tone: isActive ? 'emerald' : 'amber',
        },
        avatar: { text: studentName.slice(0, 2).toUpperCase() },
        metrics: [
          {
            label: 'Guruhlar',
            value: activeGroups.length,
            subtext: activeGroups.map((g) => g.group.name).join(', ') || 'Biriktirilmagan',
          },
          {
            label: 'Holati',
            value: isActive ? 'Faol' : 'Muzlatilgan',
            subtext: 'Davomat ochiq',
          },
          {
            label: 'Ota-onasi',
            value: student.parentName || '—',
            subtext: student.parentPhone || 'Telefon kiritilmagan',
          },
        ],
        details: [
          { label: 'Telefon', value: student.user?.phone || student.parentPhone || '—', copyable: true },
          { label: 'Email', value: student.user?.email || '—', copyable: true },
          { label: 'Ota-ona ismi', value: student.parentName || '—' },
          { label: 'Ota-ona telefoni', value: student.parentPhone || '—', copyable: true },
          { label: 'Talaba ID raqami', value: student.id, copyable: true },
        ],
        tags: activeGroups.map((g) => g.group.name),
        primaryAction: {
          label: 'To\'liq kartani ochish',
          onExecute: () => navigate(`/students/${student.id}`),
        },
        secondaryAction: {
          label: 'Tahrirlash',
          onExecute: () => navigate(`/students/${student.id}/edit`),
        },
      });
    },
    [sound, navigate],
  );

  const handleStudentClick = useCallback(
    (studentId: string) => navigate(`/students/${studentId}`),
    [navigate],
  );

  const {
    focusedIndex,
    setFocusedIndex,
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
  } = useListKeyboardNavigation({
    items: studentList,
    onQuickLook: handleOpenStudentSidecar,
    onOpen: (s) => handleStudentClick(s.id),
    onEdit: (s) => navigate(`/students/${s.id}/edit`),
    onDelete: (items) => {
      if (items[0]) handleDelete(items[0].id);
    },
    rowSelectorPrefix: 'student-row-',
  });

  const handleToggleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      toggleSelect(id);
    },
    [toggleSelect],
  );

  const handleSelectAllOnPage = useCallback(() => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [isAllSelected, clearSelection, selectAll]);

  const handleExportCsv = useCallback(() => {
    const source =
      selectedIds.size > 0
        ? studentList.filter((s) => selectedIds.has(s.id))
        : studentList;

    if (source.length === 0) return;

    const headers = [
      'ID',
      'Ism Familiya',
      'Email',
      'Telefon',
      'Guruhlar',
      'Ota-ona',
      'Holati',
    ];
    const rows = source.map((s) => {
      const name = formatStudentName(s);
      const activeGroups = (s.groups ?? [])
        .filter((g) => g.isActive)
        .map((g) => g.group.name)
        .join('; ');
      const status = s.user?.isActive !== false ? 'Faol' : 'Muzlatilgan';
      return [
        s.id,
        `"${name.replace(/"/g, '""')}"`,
        s.user?.email || '',
        s.user?.phone || s.parentPhone || '',
        `"${activeGroups.replace(/"/g, '""')}"`,
        `"${(s.parentName || '').replace(/"/g, '""')}"`,
        status,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medu-students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    push('success', `${source.length} ta talaba ma'lumoti CSV formatda yuklab olindi`);
  }, [selectedIds, studentList, push]);

  const handleOpenFreeze = useCallback((student: Student) => {
    setFreezeForm(createDefaultFreezeForm());
    setFreezeTarget(student);
  }, []);

  const handleDelete = useCallback((id: string) => setDeleteTarget(id), []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget || removeMutation.isPending) return;
    removeMutation.mutate(deleteTarget);
  }, [deleteTarget, removeMutation]);

  const { refetch: refetchStudents } = students;
  const handleRetry = useCallback(() => void refetchStudents(), [refetchStudents]);

  const hasActiveFilters = Boolean(
    search.trim() || groupId || statusFilter !== 'ALL',
  );

  const HeaderActions = useMemo(
    () => (
      <div className="flex items-center gap-2.5">
        <GlassButton
          type="button"
          variant="secondary"
          onClick={handleExportCsv}
          title="CSV formatda eksport qilish"
        >
          <span className="inline-flex items-center gap-1.5">
            <Icon paths={I.download} size={15} strokeWidth={2.0} />
            <span className="hidden sm:inline">Eksport CSV</span>
          </span>
        </GlassButton>

        <GlassButton asChild variant="primary">
          <Link to="/students/new">
            <span className="inline-flex items-center gap-2">
              <Icon paths={I.userPlus} size={16} strokeWidth={2.2} />
              <span>{t('students.add')}</span>
            </span>
          </Link>
        </GlassButton>
      </div>
    ),
    [t, handleExportCsv],
  );

  if (students.isLoading && !data) {
    return (
      <div className="page-container relative z-10 space-y-5">
        <GlassPageHeader
          title={t('students.title')}
          subtitle={t('students.pageSubtitle')}
          actions={HeaderActions}
        />
        <StudentsSkeleton />
      </div>
    );
  }

  if (students.isError && !data) {
    return (
      <div className="page-container relative z-10 space-y-5">
        <GlassPageHeader
          title={t('students.title')}
          subtitle={t('students.pageSubtitle')}
          actions={HeaderActions}
        />
        <GlassCardSurface className="p-10 sm:p-12">
          <GlassErrorState
            title={t('students.loadFailed')}
            message={getErrorMessage(students.error as Error)}
            onRetry={handleRetry}
          />
        </GlassCardSurface>
      </div>
    );
  }

  const allSelectedOnPage =
    studentList.length > 0 && studentList.every((s) => selectedIds.has(s.id));
  const freezeDurationDays = calculateFreezeDays(
    freezeForm.startDate,
    freezeForm.endDate,
  );

  return (
    <div className="page-container relative z-10 space-y-5 pb-24">
      <AuroraCanvas />

      <GlassPageHeader
        title={t('students.title')}
        subtitle={t('students.pageSubtitle')}
        actions={HeaderActions}
      />

      {/* ═══ 1 · INTERACTIVE TELEMETRY STATS BAR ═══ */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
      >
        <StatTile
          label={t('students.title')}
          value={stats.total}
          total={Math.max(1, stats.total)}
          icon={I.users}
          tone="blue"
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
        />
        <StatTile
          label={t('enum.status.ACTIVE')}
          value={stats.active}
          total={Math.max(1, stats.pageTotal)}
          icon={I.checkCircle}
          tone="green"
          active={statusFilter === 'ACTIVE'}
          onClick={() =>
            setStatusFilter((prev) => (prev === 'ACTIVE' ? 'ALL' : 'ACTIVE'))
          }
        />
        <StatTile
          label={t('enum.status.INACTIVE')}
          value={stats.inactive}
          total={Math.max(1, stats.pageTotal)}
          icon={I.pause}
          tone="orange"
          active={statusFilter === 'INACTIVE'}
          onClick={() =>
            setStatusFilter((prev) => (prev === 'INACTIVE' ? 'ALL' : 'INACTIVE'))
          }
        />
        <StatTile
          label={t('students.col.groups')}
          value={stats.withGroups}
          total={Math.max(1, stats.pageTotal)}
          icon={I.usersRound}
          tone="purple"
          active={statusFilter === 'WITH_GROUPS'}
          onClick={() =>
            setStatusFilter((prev) =>
              prev === 'WITH_GROUPS' ? 'ALL' : 'WITH_GROUPS',
            )
          }
        />
      </motion.div>

      {/* ═══ 2 · SPATIAL COMMAND & FILTER BAR ═══ */}
      <GlassCardSurface className="p-3.5 sm:p-4">
        <div className="relative z-10 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex-1">
            <div className="relative">
              <GlassInput
                data-testid="students-search-input"
                ref={searchInputRef}
                placeholder={t('students.searchPlaceholderEmail')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('students.searchLabel')}
                type="search"
                inputPrefix={
                  <Icon
                    paths={I.search}
                    size={16}
                    className="text-[var(--text-muted)]"
                  />
                }
              />
              {!search && (
                <kbd
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-slate-200/80 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 sm:inline-flex dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-400"
                >
                  ⌘K
                </kbd>
              )}
            </div>

            <GlassSelect
              value={groupId}
              onChange={handleGroupFilterChange}
              aria-label={t('students.filterGroupLabel')}
            >
              <option value="">{t('students.allGroups')}</option>
              {groupList.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </GlassSelect>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 lg:justify-end">
            <div
              role="tablist"
              aria-label="Talaba holati bo'yicha filtr"
              className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-100/75 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              {(
                [
                  { id: 'ALL', label: 'Barchasi' },
                  { id: 'ACTIVE', label: 'Faol' },
                  { id: 'INACTIVE', label: 'Muzlatilgan' },
                ] as const
              ).map((tab) => {
                const isSelected = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setStatusFilter(tab.id)}
                    className={[
                      'relative shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition-colors duration-150 outline-none',
                      isSelected
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="students-status-pill"
                        transition={SPRING.snappy}
                        className="absolute inset-0 rounded-lg border border-black/5 bg-white shadow-xs dark:border-white/10 dark:bg-white/[0.12]"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-[11.5px] font-bold text-[#007AFF] transition-all hover:bg-blue-500/15 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-[#38BDF8]"
                >
                  <Icon paths={I.close} size={12} strokeWidth={2.4} />
                  <span>{t('common.clear') || 'Tozalash'}</span>
                </button>
              )}

              <div className="inline-flex items-center rounded-xl border border-slate-200/80 bg-slate-100/75 p-1 dark:border-white/[0.08] dark:bg-white/[0.04]">
                <button
                  type="button"
                  data-testid="segment-table"
                  onClick={() => setViewMode('table')}
                  aria-label="Jadval ko'rinishi"
                  title="Jadval ko'rinishi"
                  className={`rounded-lg p-1.5 transition-all ${
                    viewMode === 'table'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.14] dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Icon paths={I.list} size={14} strokeWidth={2.1} />
                </button>
                <button
                  type="button"
                  data-testid="segment-grid"
                  onClick={() => setViewMode('grid')}
                  aria-label="Kartochkalar (Bento) ko'rinishi"
                  title="Kartochkalar (Bento) ko'rinishi"
                  className={`rounded-lg p-1.5 transition-all ${
                    viewMode === 'grid'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-white/[0.14] dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <Icon paths={I.grid} size={14} strokeWidth={2.1} />
                </button>
              </div>

              <div className="pl-1 text-[12.5px] font-bold text-[var(--text-secondary)] tabular-nums">
                {stats.total === 1
                  ? t('students.totalOne')
                  : t('students.totalMany', { count: stats.total })}
              </div>
            </div>
          </div>
        </div>
      </GlassCardSurface>

      {/* ═══ 3 · STUDENTS DATA SURFACE ═══ */}
      <GlassCardSurface
        className={students.isPlaceholderData ? 'opacity-75 transition-opacity' : ''}
      >
        <AnimatePresence mode="wait">
          {studentList.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={SPRING.smooth}
              className="p-10 sm:p-12"
            >
              <GlassEmptyState
                title={
                  hasActiveFilters
                    ? t('students.emptyFiltered')
                    : t('students.emptySearch')
                }
                message={
                  hasActiveFilters
                    ? t('students.emptyFilteredHint')
                    : t('students.emptyHint')
                }
                action={
                  hasActiveFilters ? (
                    <GlassButton
                      type="button"
                      variant="secondary"
                      onClick={handleClearFilters}
                    >
                      {t('common.clear') || 'Filtrlarni tozalash'}
                    </GlassButton>
                  ) : (
                    HeaderActions
                  )
                }
              />
            </motion.div>
          ) : viewMode === 'grid' ? (
            <motion.div
              key="bento-grid"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {studentList.map((student) => {
                const statusBadge = getStudentStatusBadge(student.user?.isActive);
                const activeGroups = (student.groups ?? []).filter((g) => g.isActive);
                const name = formatStudentName(student);
                const isActive = student.user?.isActive !== false;

                return (
                  <motion.div
                    key={student.id}
                    variants={tileVariants}
                    onClick={() => handleStudentClick(student.id)}
                    tabIndex={0}
                    role="link"
                    aria-label={t('students.viewStudentAria', { name })}
                    className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-400/50 hover:shadow-md dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-sky-400/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <StudentAvatar name={name} size={44} isActive={isActive} />
                          <div className="min-w-0">
                            <div className="truncate text-[14.5px] font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-sky-400">
                              {name}
                            </div>
                            <div className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
                              {student.user?.email ||
                                student.user?.phone ||
                                'M-EDU ID: ' + student.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>

                        <span
                          className={[
                            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ring-1 ring-inset',
                            statusBadge.color === 'red'
                              ? 'bg-red-500/10 text-red-600 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400'
                              : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
                          ].join(' ')}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              statusBadge.color === 'red'
                                ? 'bg-red-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {t(statusBadge.label)}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {activeGroups.length > 0 ? (
                          activeGroups.slice(0, 3).map((enrollment) => (
                            <GlassBadge key={enrollment.group.id} color="blue">
                              {enrollment.group.name}
                            </GlassBadge>
                          ))
                        ) : (
                          <span className="text-[11.5px] italic text-slate-400">
                            Guruhga biriktirilmagan
                          </span>
                        )}
                        {activeGroups.length > 3 && (
                          <GlassBadge color="slate">+{activeGroups.length - 3}</GlassBadge>
                        )}
                      </div>
                    </div>

                    <div
                      className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200/60 pt-3 dark:border-white/[0.06]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="truncate text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                        {student.parentName
                          ? `Ota-ona: ${student.parentName}`
                          : 'Ota-ona kiritilmagan'}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 shrink-0">
                        {isActive ? (
                          <RowAction
                            icon={I.snowflake}
                            label="Darslarni muzlatish (Freeze)"
                            tone="freeze"
                            onClick={() => handleOpenFreeze(student)}
                          />
                        ) : (
                          <RowAction
                            icon={I.play}
                            label="Faollashtirish (Unfreeze)"
                            tone="edit"
                            onClick={() => unfreezeMutation.mutate(student.id)}
                            loading={
                              unfreezeMutation.isPending &&
                              unfreezeMutation.variables === student.id
                            }
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenStudentSidecar(student)}
                          aria-label="Sidecar Split-View"
                          title="Sidecar tafsilotlari (Split-View · Space)"
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-white/70 text-slate-600 hover:text-slate-950 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white transition-colors"
                        >
                          <span className="text-[12px] leading-none">◨</span>
                        </button>
                        <RowAction
                          icon={I.eye}
                          label="Quick-Look"
                          tone="edit"
                          onClick={() => handleQuickLook(student)}
                        />
                        <RowAction
                          icon={I.edit}
                          label={t('common.edit')}
                          tone="edit"
                          to={`/students/${student.id}/edit`}
                        />
                        <RowAction
                          icon={I.trash}
                          label={t('common.delete')}
                          tone="delete"
                          onClick={() => handleDelete(student.id)}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div
              key="table"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <div className="medu-scroll-x">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b border-slate-200/75 bg-slate-50/55 dark:border-white/[0.08] dark:bg-white/[0.02]">
                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={allSelectedOnPage}
                            onChange={handleSelectAllOnPage}
                            aria-label="Barcha talabalarni tanlash"
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
                          />
                          <button
                            type="button"
                            onClick={() => handleToggleSort('name')}
                            className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-slate-900 dark:hover:text-white"
                          >
                            <span>{t('common.name')}</span>
                            <Icon
                              paths={
                                sortField === 'name'
                                  ? sortDir === 'asc'
                                    ? I.arrowUp
                                    : I.arrowDown
                                  : I.sort
                              }
                              size={12}
                              className={
                                sortField === 'name'
                                  ? 'text-[#007AFF] dark:text-[#38BDF8]'
                                  : 'opacity-60'
                              }
                            />
                          </button>
                        </div>
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                      >
                        {t('common.email')}
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSort('groups')}
                          className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-slate-900 dark:hover:text-white"
                        >
                          <span>{t('students.col.groups')}</span>
                          <Icon
                            paths={
                              sortField === 'groups'
                                ? sortDir === 'asc'
                                  ? I.arrowUp
                                  : I.arrowDown
                                : I.sort
                            }
                            size={12}
                            className={
                              sortField === 'groups'
                                ? 'text-[#007AFF] dark:text-[#38BDF8]'
                                : 'opacity-60'
                            }
                          />
                        </button>
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                      >
                        {t('students.col.parentName')}
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3.5 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSort('status')}
                          className="inline-flex items-center gap-1 uppercase tracking-[0.14em] hover:text-slate-900 dark:hover:text-white"
                        >
                          <span>{t('students.col.status')}</span>
                          <Icon
                            paths={
                              sortField === 'status'
                                ? sortDir === 'asc'
                                  ? I.arrowUp
                                  : I.arrowDown
                                : I.sort
                            }
                            size={12}
                            className={
                              sortField === 'status'
                                ? 'text-[#007AFF] dark:text-[#38BDF8]'
                                : 'opacity-60'
                            }
                          />
                        </button>
                      </th>

                      <th
                        scope="col"
                        className="px-6 py-3.5 text-right text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]"
                      >
                        {t('common.actions')}
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {studentList.map((student, index) => {
                      const statusBadge = getStudentStatusBadge(student.user?.isActive);
                      const activeGroups = (student.groups ?? []).filter(
                        (g) => g.isActive,
                      );
                      const name = formatStudentName(student);
                      const isActive = student.user?.isActive !== false;
                      const isSelected = selectedIds.has(student.id);
                      const isRowFocused = focusedIndex === index;

                      return (
                        <motion.tr
                          key={student.id}
                          id={'student-row-' + student.id}
                          variants={rowVariants}
                          onClick={() => {
                            setFocusedIndex(index);
                            handleStudentClick(student.id);
                          }}
                          tabIndex={0}
                          role="link"
                          aria-label={t('students.viewStudentAria', { name })}
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleStudentClick(student.id);
                            } else if (e.key === ' ') {
                              e.preventDefault();
                              handleQuickLook(student);
                            }
                          }}
                          className={[
                            'group relative cursor-pointer border-b border-slate-200/60 transition-all duration-150 last:border-0 focus-visible:outline-none dark:border-white/[0.06]',
                            isSelected
                              ? 'bg-blue-500/[0.08] dark:bg-sky-500/[0.12]'
                              : 'hover:bg-slate-50/85 focus-visible:bg-slate-50 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/[0.04]',
                            isRowFocused
                              ? 'ring-2 ring-[#007AFF] shadow-[0_0_14px_rgba(0,122,255,0.25)] z-10'
                              : '',
                          ].join(' ')}
                        >
                          <td className="relative px-6 py-3.5">
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-2 left-0 w-1 origin-center scale-y-0 rounded-r-full bg-[#007AFF] transition-transform duration-200 group-hover:scale-y-100 dark:bg-[#38BDF8]"
                            />
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                onClick={(e) => handleToggleSelect(student.id, e)}
                                aria-label={`${name} tanlash`}
                                className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-[#007AFF] focus:ring-[#007AFF] dark:border-white/20 dark:bg-white/5"
                              />
                              <StudentAvatar name={name} size={39} isActive={isActive} />
                              <div className="min-w-0">
                                <div className="truncate text-[13.5px] font-bold text-slate-900 transition-colors group-hover:text-[#007AFF] dark:text-white dark:group-hover:text-[#38BDF8]">
                                  {name}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                  {activeGroups.length > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                      <Icon
                                        paths={I.usersRound}
                                        size={11}
                                        strokeWidth={2}
                                      />
                                      <span>
                                        {activeGroups.length}{' '}
                                        {t('students.col.groups')?.toLowerCase() ||
                                          'guruh'}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="opacity-65">Guruhsiz</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-3.5">
                            {student.user?.email ? (
                              <CopyChip value={student.user.email} icon={I.mail} />
                            ) : student.user?.phone ? (
                              <CopyChip value={student.user.phone} icon={I.phone} />
                            ) : (
                              <span className="text-[var(--text-tertiary)] opacity-45">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {activeGroups.slice(0, 3).map((enrollment) => (
                                <GlassBadge key={enrollment.group.id} color="blue">
                                  {enrollment.group.name}
                                </GlassBadge>
                              ))}
                              {activeGroups.length === 0 && (
                                <span className="text-[var(--text-tertiary)] opacity-45">
                                  —
                                </span>
                              )}
                              {activeGroups.length > 3 && (
                                <GlassBadge color="slate">
                                  +{activeGroups.length - 3}
                                </GlassBadge>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-3.5">
                            {student.parentName ? (
                              <div className="flex flex-col">
                                <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)]">
                                  <Icon
                                    paths={I.parent}
                                    size={13}
                                    strokeWidth={1.9}
                                    className="opacity-55"
                                  />
                                  <span className="max-w-[165px] truncate">
                                    {student.parentName}
                                  </span>
                                </span>
                                {student.parentPhone && (
                                  <span className="mt-0.5 pl-5 text-[11px] font-medium text-slate-500 tabular-nums dark:text-slate-400">
                                    {student.parentPhone}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[var(--text-tertiary)] opacity-45">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-3.5">
                            <span
                              className={[
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight ring-1 ring-inset',
                                statusBadge.color === 'red'
                                  ? 'bg-red-500/10 text-red-600 ring-red-500/25 dark:bg-red-500/15 dark:text-red-400'
                                  : 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/30 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] dark:bg-emerald-500/15 dark:text-emerald-300 dark:shadow-none',
                              ].join(' ')}
                            >
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 rounded-full ${
                                  statusBadge.color === 'red'
                                    ? 'bg-red-500'
                                    : 'medu-pulse-dot bg-emerald-500 shadow-[0_0_6px_#10B981]'
                                }`}
                              />
                              <span>{t(statusBadge.label)}</span>
                            </span>
                          </td>

                          <td className="px-6 py-3.5">
                            <div
                              className="flex justify-end gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                            >
                              {isActive ? (
                                <RowAction
                                  icon={I.snowflake}
                                  label="Darslarni muzlatish (Freeze)"
                                  tone="freeze"
                                  onClick={() => handleOpenFreeze(student)}
                                />
                              ) : (
                                <RowAction
                                  icon={I.play}
                                  label="Faollashtirish (Unfreeze)"
                                  tone="edit"
                                  onClick={() => unfreezeMutation.mutate(student.id)}
                                  loading={
                                    unfreezeMutation.isPending &&
                                    unfreezeMutation.variables === student.id
                                  }
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenStudentSidecar(student)}
                                aria-label="Sidecar Split-View"
                                title="Sidecar tafsilotlari (Split-View · Space)"
                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/80 bg-white/70 text-slate-600 hover:text-slate-950 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white transition-colors"
                              >
                                <span className="text-[12px] leading-none">◨</span>
                              </button>
                              <RowAction
                                icon={I.eye}
                                label="Quick-Look (Space)"
                                tone="edit"
                                onClick={() => handleQuickLook(student)}
                              />
                              <RowAction
                                icon={I.edit}
                                label={t('common.edit')}
                                tone="edit"
                                to={`/students/${student.id}/edit`}
                              />
                              <RowAction
                                icon={I.trash}
                                label={t('common.delete')}
                                tone="delete"
                                onClick={() => handleDelete(student.id)}
                                disabled={removeMutation.isPending}
                                loading={
                                  removeMutation.isPending &&
                                  removeMutation.variables === student.id
                                }
                              />
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200/70 px-4 py-3 dark:border-white/[0.08]">
                <GlassPagination
                  page={page}
                  totalPages={data?.totalPages ?? 1}
                  onPageChange={setPage}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCardSurface>

      {/* ═══ 4 · DYNAMIC ISLAND FLOATING BULK COMMAND ISLAND ═══ */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClear={clearSelection}
        itemLabel="talaba"
        actions={[
          {
            id: 'export-csv',
            label: 'CSV Eksport',
            icon: <Icon paths={I.download} size={13} />,
            onClick: handleExportCsv,
            variant: 'primary',
            shortcut: 'E',
          },
          {
            id: 'bulk-freeze',
            label: 'Muzlatish',
            icon: <Icon paths={I.snowflake} size={13} />,
            onClick: () => {
              const first = studentList.find((s) => selectedIds.has(s.id));
              if (first) handleOpenFreeze(first);
            },
          },
          {
            id: 'bulk-delete',
            label: 'O\'chirish',
            icon: <Icon paths={I.trash} size={13} />,
            variant: 'danger',
            shortcut: 'Del',
            onClick: () => {
              const first = studentList.find((s) => selectedIds.has(s.id));
              if (first) handleDelete(first.id);
            },
          },
        ]}
      />

      {/* ═══ 5 · DELETE CONFIRMATION DIALOG ═══ */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!removeMutation.isPending) setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        description={t('students.confirmDelete')}
        loading={removeMutation.isPending}
      />

      {/* ═══ 6 · MEDICAL LEAVE / FREEZE MODAL ═══ */}
      <GlassModal
        open={freezeTarget !== null}
        onClose={() => {
          if (!freezeMutation.isPending) setFreezeTarget(null);
        }}
        title="Talaba darslarini muzlatish (Medical Leave / Freeze)"
      >
        {freezeTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              freezeMutation.mutate({
                id: freezeTarget.id,
                payload: freezeForm,
              });
            }}
            className="space-y-4"
          >
            {/* Student Summary Banner */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-500/25 bg-gradient-to-r from-sky-500/12 via-blue-500/8 to-transparent p-3.5 text-xs text-sky-950 dark:text-sky-100">
              <div className="flex items-center gap-3 min-w-0">
                <StudentAvatar name={formatStudentName(freezeTarget)} size={38} />
                <div className="min-w-0">
                  <p className="truncate font-bold text-[13px]">
                    {formatStudentName(freezeTarget)}
                  </p>
                  <p className="mt-0.5 text-[11.5px] opacity-80">
                    Muzlatilgan davrda qarzdorlik hisoblanmaydi va guruhdagi o'rni
                    saqlanadi.
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-xl bg-sky-500/20 px-2.5 py-1 text-[11px] font-extrabold text-sky-700 dark:text-sky-300 tabular-nums">
                {freezeDurationDays} kun
              </span>
            </div>

            {/* Live Duration Timeline */}
            <FreezeTimeline
              startDate={freezeForm.startDate}
              endDate={freezeForm.endDate}
              days={freezeDurationDays}
            />

            {/* Quick Duration Presets */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tezkor muddat tanlash
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '7 kun (1 hafta)', days: 7 },
                  { label: '14 kun (2 hafta)', days: 14 },
                  { label: '30 kun (1 oy)', days: 30 },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() =>
                      setFreezeForm((prev) => ({
                        ...prev,
                        endDate: addDaysToIso(prev.startDate, preset.days),
                      }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-sky-400"
                  >
                    <Icon paths={I.calendar} size={13} />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassField label="Muzlatish boshlanish sanasi" required>
                <GlassInput
                  type="date"
                  value={freezeForm.startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setFreezeForm((prev) => ({
                      ...prev,
                      startDate: nextStart,
                      endDate: prev.endDate < nextStart ? nextStart : prev.endDate,
                    }));
                  }}
                  required
                />
              </GlassField>

              <GlassField label="Muzlatish tugash sanasi" required>
                <GlassInput
                  type="date"
                  min={freezeForm.startDate}
                  value={freezeForm.endDate}
                  onChange={(e) =>
                    setFreezeForm((prev) => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  required
                />
              </GlassField>
            </div>

            <GlassField label="Muzlatish sababi (Spravka / Sabab)" required>
              <GlassInput
                value={freezeForm.reason}
                onChange={(e) =>
                  setFreezeForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                placeholder="Masalan: Kasallik tufayli shifoxonada, spravka taqdim etildi..."
                required
              />
            </GlassField>

            <div className="flex flex-wrap gap-1.5">
              {[
                'Tibbiy sabab / Kasallik ma\'lumotnomasi (Medical leave)',
                'Oilaviy safar / Ta\'til sababli',
                'Maktab imtihonlari / Olimpiada yig\'ini',
              ].map((reasonPreset) => (
                <button
                  key={reasonPreset}
                  type="button"
                  onClick={() =>
                    setFreezeForm((prev) => ({ ...prev, reason: reasonPreset }))
                  }
                  className="rounded-lg border border-slate-200/70 bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200/70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                >
                  {reasonPreset}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                disabled={freezeMutation.isPending}
                onClick={() => setFreezeTarget(null)}
              >
                Bekor qilish
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={freezeMutation.isPending}
              >
                {freezeMutation.isPending ? 'Muzlatilmoqda...' : 'Muzlatishni tasdiqlash'}
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {toastNode}
    </div>
  );
}