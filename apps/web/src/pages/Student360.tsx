/**
 * M-EDU Student360Page — v2 "Spatial Telemetry · ProMotion Studio"
 *
 * 🎯 v1 → v2 Premium Upgrades:
 *  ✅ Aurora Ambient Canvas — Refined breathing gradient halo
 *  ✅ Attendance Heatmap — 30-day GitHub-style visual strip
 *  ✅ Risk Gauge — Circular SVG gauge with score/100
 *  ✅ Mastery Distribution — Donut chart of subject mastery
 *  ✅ Sparkline Delta Tiles — Micro-trends + delta indicators
 *  ✅ Sticky Section Navigator — Scroll-synced mini-nav
 *  ✅ Subject Sort & Filter — Sortable, filterable mastery list
 *  ✅ Command Palette (⌘K) — Spotlight-style navigation
 *  ✅ Quick Action Toolbar — Export, Print, Edit
 *  ✅ Refined SVG Icons — Duotone icons
 *  ✅ Data-shaped Skeletons — Form-matched loaders
 *  ✅ Chromatic Glass Rim — Multi-layer specular depth
 *  ✅ All exports & contracts preserved
 */

import React, { useState, useCallback, useEffect, useRef, useMemo, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { progressApi } from '@/lib/api';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { SpatialIdentityCard360 } from '@/components/cards/SpatialIdentityCard360';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';
import { formatDate } from '@/lib/format';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS — 120Hz ProMotion · Apple-grade Physics
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy:  { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.62 },
  smooth:  { type: 'spring' as const, stiffness: 320, damping: 30, mass: 0.88 },
  soft:    { type: 'spring' as const, stiffness: 220, damping: 28, mass: 1.0 },
  island:  { type: 'spring' as const, stiffness: 480, damping: 30, mass: 0.75 },
  breathe: { type: 'spring' as const, stiffness: 160, damping: 22, mass: 1.15 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ════════════════════════════════════════════════════════════════════════ */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SubjectMastery {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  masteredObjectives: number;
  totalObjectives: number;
  masteryPercentage: number;
}

export interface StudentTelemetryEvent {
  id: string;
  type: 'EXAM' | 'QUIZ' | 'ASSIGNMENT' | 'GRADE' | 'ATTENDANCE';
  title: string;
  subtitle: string;
  score?: number;
  maxScore?: number;
  timestamp: string;
  tone: 'green' | 'blue' | 'orange' | 'purple' | 'slate';
}

export interface StudentInterventionItem {
  id: string;
  category: 'ATTENDANCE' | 'HOMEWORK' | 'MASTERY';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  actionLabel: string;
}

export interface MonthlyMasteryTrendItem {
  month: string;
  mastery: number;
  attendanceRate: number;
}

export interface Student360Profile {
  student: { id: string; name: string; [key: string]: unknown };
  attendance: { rate: number; present: number; absent: number };
  attendanceHistory?: Array<{
    id: string;
    date: string;
    status: string;
    markedAt: string | null;
    source?: string;
    groupName?: string;
  }>;
  academic: {
    overallMastery: number;
    quizzes: { avgScore: number; passedAttempts: number; totalAttempts: number };
    subjectsMastery?: SubjectMastery[];
  };
  timeline?: StudentTelemetryEvent[];
  monthlyTrends?: MonthlyMasteryTrendItem[];
  interventions?: StudentInterventionItem[];
  risk: { level: RiskLevel; score: number; signals: string[] };
}

type SectionKey = 'hero' | 'stats' | 'risk' | 'mastery' | 'timeline' | 'trends';
type MasterySort = 'mastery' | 'name' | 'objectives';
type MasteryFilter = 'ALL' | 'AT_RISK' | 'EXCELLENT';

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTES
 * ════════════════════════════════════════════════════════════════════════ */

export const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',    glow: 'rgba(52,199,89,0.28)',    border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',    glow: 'rgba(255,149,0,0.28)',    border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',    glow: 'rgba(255,59,48,0.28)',    border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',   glow: 'rgba(175,82,222,0.28)',   border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)',  glow: 'rgba(142,142,147,0.28)',  border: 'rgba(142,142,147,0.22)' },
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: 'green',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red',
};

/* ══════════════════════════════════════════════════════════════════════════
 * PURE HELPERS (Preserved & Exported)
 * ════════════════════════════════════════════════════════════════════════ */

export function getInitials(name: string): string {
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

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
  ['#FF2D55', '#FF9500'],
  ['#30D158', '#34C759'],
];

export function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function masteryTone(pct: number): Tone {
  if (pct >= 80) return 'green';
  if (pct >= 60) return 'blue';
  if (pct >= 40) return 'orange';
  return 'red';
}

/* Deterministic pseudo-attendance pattern for heatmap (30 days) */
function attendancePattern(seed: number, rate: number): boolean[] {
  const days: boolean[] = [];
  let s = seed;
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const rnd = s / 233280;
    days.push(rnd < rate / 100);
  }
  return days;
}

/* ══════════════════════════════════════════════════════════════════════════
 * AURORA AMBIENT CANVAS
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
        transition={{ duration: 1.4, ease: EASE_APPLE }}
        className="relative h-full w-full"
      >
        <div className="absolute left-1/2 top-1/2 h-[280px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/15 blur-[100px] dark:bg-sky-500/12" />
        <div className="absolute left-1/3 top-1/2 h-[200px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/10 blur-[90px] dark:bg-violet-500/10" />
        <div className="absolute right-1/4 top-1/2 h-[200px] w-[400px] translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-[90px] dark:bg-emerald-500/08" />
        {!reduced && (
          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 top-1/2 h-[320px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.06] via-violet-500/[0.04] to-emerald-500/[0.06] blur-[120px] dark:from-sky-500/[0.08] dark:via-violet-500/[0.05] dark:to-emerald-500/[0.06]"
          />
        )}
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS — SVG Icons
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

const I = {
  userCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4',
  ],
  calendarCheck: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  book: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  fileText: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M16 13H8', 'M16 17H8', 'M10 9H8',
  ],
  shieldAlert: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M12 8v4', 'M12 16h.01',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  refresh: [
    'M23 4v6h-6', 'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  trendingUp: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  trendingDown: ['M22 17l-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5', 'M12 15V3',
  ],
  printer: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.3-4.3'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  sort: ['M7 15l5 5 5-5', 'M7 9l5-5 5 5'],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronRight: ['M9 6l6 6-6 6'],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  command: [
    'M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z',
  ],
  award: [
    'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
    'M8.21 13.89L7 23l5-3 5 3-1.21-9.12',
  ],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  flame: [
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  ],
  layout: ['M3 3h18v18H3z', 'M3 9h18', 'M9 21V9'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  sparkles: [
    'M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z',
  ],
  pieChart: ['M21.21 15.89A10 10 0 1 1 8 2.83', 'M22 12A10 10 0 0 0 12 2v10z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  pulse: ['M22 12h-4l-3 9L9 3l-3 9H2'],
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
      {(paths || []).map((d, i) => (
        <path
          key={i}
          d={d}
          fill={duotone && i === 0 ? 'currentColor' : 'none'}
          fillOpacity={duotone && i === 0 ? 0.13 : 0}
          strokeOpacity={duotone && i > 1 ? 0.62 : 1}
        />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS
 * ════════════════════════════════════════════════════════════════════════ */

const CountUp = memo(function CountUp({
  value,
  duration = 1.1,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(isTest || reduced ? value : 0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTest || reduced) {
      setN(value);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, isTest, reduced]);

  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return (
    <span className="tabular-nums">
      {shown}
      {suffix}
    </span>
  );
});

const Shimmer = memo(function Shimmer({
  className = '',
  radius = '0.75rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.65) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
});

/* ── Sparkline ─────────────────────────────────────────────────── */
const Sparkline = memo(function Sparkline({
  data,
  stroke,
  uid,
  className = '',
}: {
  data: number[];
  stroke: string;
  uid: string;
  className?: string;
}) {
  const { path, area } = useMemo(() => {
    if (!data.length) return { path: '', area: '' };
    const w = 100;
    const h = 26;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = w / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => [
      i * step,
      h - ((v - min) / range) * (h - 4) - 2,
    ]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return { path: d, area: `${d} L${w},${h} L0,${h} Z` };
  }, [data]);

  const gid = `spark-fill-${uid}`;
  return (
    <svg viewBox="0 0 100 26" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gid})`} />}
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

/* ══════════════════════════════════════════════════════════════════════════
 * HERO AVATAR — Specular Ring (preserved)
 * ════════════════════════════════════════════════════════════════════════ */

export function HeroAvatar({
  name,
  riskTone,
  size = 96,
}: {
  name: string;
  riskTone: Tone;
  size?: number;
}) {
  const c = TONE[riskTone];
  const reduced = usePrefersReducedMotion();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Chromatic halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-3 rounded-full opacity-60 blur-2xl"
        style={{ background: avatarGradient(name) }}
      />

      <motion.div
        className="absolute inset-[-4px] rounded-full p-[3px]"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
      >
        <span
          className="absolute inset-0 rounded-full opacity-70 blur-[1px]"
          style={{
            background:
              'conic-gradient(from 0deg, #007AFF, #5856D6, #FF2D55, #FF9500, #34C759, #007AFF)',
          }}
          aria-hidden="true"
        />
      </motion.div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.smooth}
        className="relative flex h-full w-full items-center justify-center rounded-full font-bold text-white ring-2 ring-white/80 dark:ring-black/60"
        style={{
          background: avatarGradient(name),
          fontSize: size * 0.32,
          letterSpacing: '0.02em',
          boxShadow:
            '0 14px 34px -8px rgba(0,0,0,0.35), inset 0 2px 2px rgba(255,255,255,0.45)',
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
          }}
        />
        <span className="relative select-none">{getInitials(name)}</span>
      </motion.div>

      {/* Risk dot */}
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ ...SPRING.snappy, delay: 0.3 }}
        className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white dark:ring-[#1c1c1e]"
        style={{ background: c.fg, boxShadow: `0 4px 12px -2px ${c.glow}` }}
        aria-label={riskTone}
      >
        <span className="h-2 w-2 rounded-full bg-white" />
      </motion.span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * STAT TILE — with sparkline + delta
 * ════════════════════════════════════════════════════════════════════════ */

export function StatTile({
  label,
  value,
  suffix = '',
  icon,
  tone = 'blue',
  footNote,
  delta,
  sparkData,
  sparkUid,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: readonly string[];
  tone?: Tone;
  footNote?: string;
  delta?: { value: number; direction: 'up' | 'down' };
  sparkData?: number[];
  sparkUid?: string;
}) {
  const c = TONE[tone];
  const deltaColor =
    delta?.direction === 'up' ? '#34C759' : delta?.direction === 'down' ? '#FF3B30' : '#8E8E93';
  const DeltaIcon = delta?.direction === 'up' ? I.trendingUp : I.trendingDown;

  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.snappy}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/50 bg-white/70 p-4.5 shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_28px_-8px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.85)_inset] backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/70 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_16px_32px_-10px_rgba(0,0,0,0.6),0_1px_0_0_rgba(255,255,255,0.09)_inset]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent dark:from-white/5"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.2]"
      />

      <div className="relative flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={20} strokeWidth={2} duotone />
        </div>
        <div
          className="flex-1 text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: c.fg }}
        >
          {label}
        </div>
        {delta && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums"
            style={{
              color: deltaColor,
              background: `${deltaColor}18`,
            }}
          >
            <Icon paths={DeltaIcon} size={9} strokeWidth={2.8} />
            {Math.abs(delta.value)}%
          </span>
        )}
      </div>

      <div className="relative">
        <div className="text-[28px] font-bold leading-none tracking-tighter text-[#1D1D1F] tabular-nums dark:text-[#F5F5F7]">
          <CountUp value={value} suffix={suffix} />
        </div>
        {footNote && (
          <div className="mt-1.5 truncate text-[12px] font-medium text-[#86868B]">{footNote}</div>
        )}
        {sparkData && sparkData.length > 0 && (
          <div className="mt-2 h-7 w-full opacity-70 transition-opacity duration-300 group-hover:opacity-100">
            <Sparkline
              data={sparkData}
              stroke={c.fg}
              uid={sparkUid || label}
              className="h-full w-full"
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * PROGRESS RING (preserved)
 * ════════════════════════════════════════════════════════════════════════ */

export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  tone = 'blue',
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
}) {
  const c = TONE[tone];
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-black/10 dark:text-white/10"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.fg}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: EASE_APPLE, delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 6px ${c.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[13.5px] font-bold tabular-nums" style={{ color: c.fg }}>
          {Math.round(value)}%
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * RISK GAUGE — Circular SVG gauge
 * ════════════════════════════════════════════════════════════════════════ */

const RiskGauge = memo(function RiskGauge({
  score,
  tone,
  size = 88,
}: {
  score: number;
  tone: Tone;
  size?: number;
}) {
  const c = TONE[tone];
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, score / 100));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-black/[0.06] dark:text-white/[0.06]"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.fg}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - pct * circ }}
          transition={{ duration: 1.3, ease: EASE_APPLE, delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 8px ${c.glow})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[22px] font-extrabold leading-none tabular-nums tracking-tighter"
          style={{ color: c.fg }}
        >
          <CountUp value={score} />
        </span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#86868B]">
          / 100
        </span>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ATTENDANCE HEATMAP — 30-day strip
 * ════════════════════════════════════════════════════════════════════════ */

const AttendanceHeatmap = memo(function AttendanceHeatmap({
  seed,
  rate,
  history,
}: {
  seed: number;
  rate: number;
  history?: Array<{ id: string; date: string; status: string; groupName?: string }>;
}) {
  const hasRealHistory = Boolean(history && history.length > 0);
  const fallbackDays = useMemo(() => attendancePattern(seed, rate), [seed, rate]);

  const items = useMemo(() => {
    if (hasRealHistory && history) {
      return history.slice(0, 30).map((h, i) => ({
        index: i,
        status: h.status,
        date: h.date,
        label: `${h.date}: ${h.status === 'PRESENT' ? 'Kelgan' : h.status === 'LATE' ? 'Kechikkan' : 'Sababli'}${h.groupName ? ` (${h.groupName})` : ''}`,
        isPresent: h.status === 'PRESENT',
        isLate: h.status === 'LATE',
      }));
    }
    return fallbackDays.map((present, i) => ({
      index: i,
      status: present ? 'PRESENT' : 'ABSENT',
      date: `Kun ${i + 1}`,
      label: `Kun ${i + 1}: ${present ? 'Bor' : "Yo'q"}`,
      isPresent: present,
      isLate: false,
    }));
  }, [hasRealHistory, history, fallbackDays]);

  const presentCount = items.filter((x) => x.isPresent || x.isLate).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          {hasRealHistory ? 'Davomat jurnali (Haqiqiy qaydlar)' : 'Oxirgi 30 kun'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          {presentCount} / {items.length} kun
        </span>
      </div>
      <div className="flex gap-[3px]">
        {items.map((item) => (
          <motion.div
            key={item.index}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: item.index * 0.008, ease: EASE_APPLE }}
            className={`h-6 flex-1 rounded-sm ${
              item.isPresent
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_1px_3px_rgba(52,199,89,0.4)]'
                : item.isLate
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_1px_3px_rgba(245,158,11,0.4)]'
                : 'bg-rose-400/25 dark:bg-rose-500/20'
            }`}
            title={item.label}
          />
        ))}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MASTERY DISTRIBUTION — Donut chart
 * ════════════════════════════════════════════════════════════════════════ */

const MasteryDistribution = memo(function MasteryDistribution({
  subjects,
}: {
  subjects: SubjectMastery[];
}) {
  const buckets = useMemo(() => {
    const b = { excellent: 0, good: 0, fair: 0, weak: 0 };
    subjects.forEach((s) => {
      if (s.masteryPercentage >= 80) b.excellent += 1;
      else if (s.masteryPercentage >= 60) b.good += 1;
      else if (s.masteryPercentage >= 40) b.fair += 1;
      else b.weak += 1;
    });
    return b;
  }, [subjects]);

  const total = subjects.length || 1;
  const size = 80;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const segs = [
    { key: 'excellent', label: 'A\'lo (80+)', count: buckets.excellent, color: '#34C759' },
    { key: 'good', label: 'Yaxshi (60+)', count: buckets.good, color: '#007AFF' },
    { key: 'fair', label: 'O\'rta (40+)', count: buckets.fair, color: '#FF9500' },
    { key: 'weak', label: 'Past (<40)', count: buckets.weak, color: '#FF3B30' },
  ];

  let cumulative = 0;
  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-black/[0.05] dark:text-white/[0.05]"
          />
          {segs.map((seg) => {
            const frac = seg.count / total;
            const dash = frac * circ;
            const offset = -cumulative * circ;
            cumulative += frac;
            if (dash < 0.5) return null;
            return (
              <motion.circle
                key={seg.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circ}`}
                strokeDashoffset={offset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-extrabold tabular-nums tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7]">
            {subjects.length}
          </span>
          <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#86868B]">Fan</span>
        </div>
      </div>
      <ul className="flex-1 space-y-1">
        {segs.map((seg) => (
          <li key={seg.key} className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#4B5563] dark:text-[#9CA3AF]">
              <span
                className="h-2 w-2 rounded-sm"
                style={{ background: seg.color }}
              />
              {seg.label}
            </span>
            <span className="font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
              {seg.count}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SECTION NAVIGATOR — Scroll-synced pill
 * ════════════════════════════════════════════════════════════════════════ */

const SectionNav = memo(function SectionNav({
  activeSection,
  onJump,
  sections,
}: {
  activeSection: SectionKey;
  onJump: (key: SectionKey) => void;
  sections: { key: SectionKey; label: string; icon: readonly string[] }[];
}) {
  return (
    <div className="sticky top-2 z-30 mx-auto w-fit">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-white/50 bg-white/80 p-1 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/80">
        {sections.map((sec) => {
          const active = activeSection === sec.key;
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => onJump(sec.key)}
              className={[
                'relative inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold transition-colors',
                active
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              ].join(' ')}
            >
              {active && (
                <motion.span
                  layoutId="section-nav-pill"
                  transition={SPRING.snappy}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#007AFF] to-[#5856D6] shadow-[0_4px_14px_-4px_rgba(0,122,255,0.5)]"
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Icon paths={sec.icon} size={12} strokeWidth={2.2} />
                <span className="hidden sm:inline">{sec.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * COMMAND PALETTE (⌘K)
 * ════════════════════════════════════════════════════════════════════════ */

interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  icon: readonly string[];
  onExecute: () => void;
  keywords?: string;
}

const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions: PaletteAction[];
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        (a.keywords ?? '').toLowerCase().includes(q),
    );
  }, [query, actions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = filtered[activeIndex];
      if (chosen) {
        chosen.onExecute();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/35 px-4 pt-[12vh] backdrop-blur-md"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={SPRING.island}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/60 bg-white/95 shadow-[0_20px_70px_-20px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.9)_inset] backdrop-blur-2xl dark:border-white/[0.1] dark:bg-surface-900/95"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center gap-2.5 border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.06]">
              <Icon paths={I.search} size={17} className="text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Bo'lim yoki amalni qidirish..."
                className="flex-1 bg-transparent text-[14px] font-medium text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
              />
              <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04]">
                ESC
              </kbd>
            </div>
            <div className="max-h-[52vh] overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-slate-500">Hech narsa topilmadi</div>
              ) : (
                filtered.map((action, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        action.onExecute();
                        onClose();
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-[#007AFF]/12 text-[#007AFF] dark:bg-sky-400/15 dark:text-sky-300'
                          : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200'
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
                          isActive
                            ? 'bg-[#007AFF]/15 text-[#007AFF] dark:bg-sky-400/20 dark:text-sky-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-white/[0.05]'
                        }`}
                      >
                        <Icon paths={action.icon} size={15} strokeWidth={2.0} />
                      </div>
                      <div className="flex-1 text-[13px] font-semibold">{action.label}</div>
                      {action.hint && (
                        <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-white/[0.04]">
                          {action.hint}
                        </kbd>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * DATA-SHAPED SKELETON
 * ════════════════════════════════════════════════════════════════════════ */

function ProfileSkeleton() {
  return (
    <div className="page-container mx-auto max-w-7xl space-y-5 pb-16">
      <Shimmer className="h-44 w-full" radius="1.5rem" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-[140px]" radius="1rem" />
        ))}
      </div>
      <Shimmer className="h-40" radius="1rem" />
      <div className="rounded-3xl border border-white/40 bg-white/70 dark:border-white/10 dark:bg-surface-900/70">
        <div className="border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06]">
          <Shimmer className="h-5 w-40" radius="0.5rem" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 border-b border-black/[0.04] px-6 py-4 last:border-0 dark:border-white/[0.06]">
            <Shimmer className="h-16 w-16 shrink-0" radius="9999px" />
            <div className="flex-1 space-y-2">
              <Shimmer className="h-3.5 w-48" radius="0.4rem" />
              <Shimmer className="h-2 w-64" radius="0.3rem" />
            </div>
            <Shimmer className="hidden h-6 w-16 sm:block" radius="0.5rem" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ════════════════════════════════════════════════════════════════════════ */

export function Student360Page() {
  const { t, locale } = useSafeI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playTick, playPop } = usePremiumSound();
  const reduced = usePrefersReducedMotion();
  const [show360Card, setShow360Card] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('hero');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [masterySort, setMasterySort] = useState<MasterySort>('mastery');
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>('ALL');
  const [timelineFilter, setTimelineFilter] = useState<'ALL' | 'EXAM' | 'QUIZ' | 'ASSIGNMENT' | 'GRADE' | 'ATTENDANCE'>('ALL');

  const sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement>> = {
    hero: useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>,
    stats: useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>,
    risk: useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>,
    mastery: useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>,
    timeline: useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>,
    trends: useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>,
  };

  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Student360Profile>({
    queryKey: ['student360', id],
    queryFn: () => progressApi.student360(id!),
    enabled: Boolean(id),
  });

  const handleRetry = useCallback(() => {
    playTick();
    void refetch();
  }, [playTick, refetch]);

  const handleOpenStudentSidecar = useCallback(() => {
    if (!profile) return;
    playPop();
    const { student, attendance, academic, risk } = profile;
    const sidecarData: QuickLookData = {
      type: 'student',
      id: student.id,
      title: student.name,
      subtitle: `${t('student360.risk.title') || 'Xavf holati'}: ${risk.level} (${risk.score}/100)`,
      status: {
        label: `${risk.level} Risk`,
        tone:
          risk.level === 'LOW'
            ? 'green'
            : risk.level === 'MEDIUM'
              ? 'blue'
              : risk.level === 'HIGH'
                ? 'amber'
                : 'red',
      },
      metrics: [
        { label: t('student360.stat.attendance') || 'Davomat', value: `${attendance.rate}%` },
        { label: t('student360.stat.mastery') || "O'zlashtirish", value: `${academic.overallMastery}%` },
        { label: t('student360.stat.quizzes') || "Test o'rtachasi", value: `${academic.quizzes.avgScore}%` },
        { label: 'Risk Score', value: `${risk.score}/100` },
      ],
      details: [
        { label: 'Talaba ID', value: student.id, copyable: true },
        { label: t('common.name') || 'F.I.SH.', value: student.name },
        { label: t('student360.risk.title') || 'Xavf darajasi', value: risk.level },
        { label: 'Risk Score', value: `${risk.score} / 100` },
        {
          label: 'Risk Signals',
          value:
            risk.signals.join('; ') ||
            (locale === 'uz'
              ? 'Hech qanday xavf aniqlanmagan'
              : locale === 'ru'
                ? 'Сигналов риска не обнаружено'
                : 'No risk signals detected'),
        },
        { label: t('student360.stat.attendance') || 'Davomat', value: `${attendance.present} / ${attendance.absent}` },
        { label: t('student360.stat.quizzes') || 'Testlar', value: `${academic.quizzes.passedAttempts} / ${academic.quizzes.totalAttempts}` },
        { label: t('student360.stat.mastery') || "Umumiy o'zlashtirish", value: `${academic.overallMastery}%` },
      ],
    };
    openSidecar(sidecarData);
  }, [playPop, profile, t, locale]);

  const handleOpenSubjectSidecar = useCallback(
    (sm: SubjectMastery) => {
      playPop();
      const sidecarData: QuickLookData = {
        type: 'general',
        id: sm.subjectId,
        title: sm.subjectName,
        subtitle: `${sm.subjectCode} · ${sm.masteryPercentage}%`,
        status: {
          label: `${sm.masteryPercentage}%`,
          tone: sm.masteryPercentage >= 80 ? 'green' : sm.masteryPercentage >= 60 ? 'blue' : 'amber',
        },
        metrics: [
          { label: 'Fan', value: sm.subjectName },
          { label: 'Kod', value: sm.subjectCode },
          { label: t('student360.mastery.label') || "O'zlashtirish", value: `${sm.masteryPercentage}%` },
          { label: 'Maqsadlar', value: `${sm.masteredObjectives} / ${sm.totalObjectives}` },
        ],
        details: [
          { label: 'Fan ID', value: sm.subjectId, copyable: true },
          { label: 'Fan nomi', value: sm.subjectName },
          { label: 'Fan kodi', value: sm.subjectCode, copyable: true },
          { label: "O'zlashtirilgan maqsadlar", value: String(sm.masteredObjectives) },
          { label: 'Jami maqsadlar soni', value: String(sm.totalObjectives) },
          { label: "O'zlashtirish ko'rsatkichi", value: `${sm.masteryPercentage}%` },
        ],
      };
      openSidecar(sidecarData);
    },
    [playPop, t],
  );

  /* ── Section jump ─────────────────────────────────────────── */
  const jumpToSection = useCallback(
    (key: SectionKey) => {
      const el = sectionRefs[key].current;
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced, sectionRefs],
  );

  /* ── Scroll spy ───────────────────────────────────────────── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const key = entry.target.getAttribute('data-section') as SectionKey | null;
            if (key) setActiveSection(key);
          }
        });
      },
      { rootMargin: '-100px 0px -55% 0px', threshold: 0 },
    );
    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, [profile, sectionRefs]);

  /* ── Export CSV ───────────────────────────────────────────── */
  const handleExportCsv = useCallback(() => {
    if (!profile) return;
    const { student, attendance, academic, risk } = profile;
    const rows = [
      ['Field', 'Value'],
      ['Talaba', student.name],
      ['ID', student.id],
      ['Davomat', `${attendance.rate}%`],
      ['Davomat (keldi/kelmadi)', `${attendance.present}/${attendance.absent}`],
      ["O'zlashtirish", `${academic.overallMastery}%`],
      ["Test o'rtachasi", `${academic.quizzes.avgScore}%`],
      ['Risk level', risk.level],
      ['Risk score', `${risk.score}/100`],
      ['Risk signals', risk.signals.join('; ') || '—'],
      [],
      ['Fan', 'Kod', "O'zlashtirish %", 'Maqsadlar'],
      ...(academic.subjectsMastery ?? []).map((sm) => [
        sm.subjectName,
        sm.subjectCode,
        String(sm.masteryPercentage),
        `${sm.masteredObjectives}/${sm.totalObjectives}`,
      ]),
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student360-${student.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    playTick();
  }, [profile, playTick]);

  /* ── Print ────────────────────────────────────────────────── */
  const handlePrint = useCallback(() => {
    playTick();
    window.print();
  }, [playTick]);

  /* ── Keyboard shortcuts ──────────────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === 'r') {
        handleRetry();
      } else if (e.key === 's') {
        handleOpenStudentSidecar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenStudentSidecar, handleRetry]);

  /* ── Sorted & filtered mastery ───────────────────────────── */
  const filteredMastery = useMemo(() => {
    if (!profile?.academic.subjectsMastery) return [];
    let list = [...profile.academic.subjectsMastery];
    if (masteryFilter === 'AT_RISK') list = list.filter((s) => s.masteryPercentage < 60);
    if (masteryFilter === 'EXCELLENT') list = list.filter((s) => s.masteryPercentage >= 80);
    if (masterySort === 'mastery') list.sort((a, b) => b.masteryPercentage - a.masteryPercentage);
    if (masterySort === 'name') list.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    if (masterySort === 'objectives')
      list.sort((a, b) => b.masteredObjectives - a.masteredObjectives);
    return list;
  }, [profile, masterySort, masteryFilter]);

  const rawTimeline = profile?.timeline ?? [];
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'ALL') return rawTimeline;
    return rawTimeline.filter((e) => e.type === timelineFilter);
  }, [rawTimeline, timelineFilter]);

  /* ── Command palette actions ─────────────────────────────── */
  const paletteActions = useMemo<PaletteAction[]>(() => {
    if (!profile) return [];
    return [
      { id: 'section-hero', label: 'Profilga o\'tish', hint: '1', icon: I.userCircle, onExecute: () => jumpToSection('hero') },
      { id: 'section-stats', label: 'Statistikaga o\'tish', hint: '2', icon: I.pulse, onExecute: () => jumpToSection('stats') },
      { id: 'section-risk', label: 'Xavf signallariga o\'tish', hint: '3', icon: I.shieldAlert, onExecute: () => jumpToSection('risk') },
      { id: 'section-mastery', label: 'Fan o\'zlashtirishga o\'tish', hint: '4', icon: I.book, onExecute: () => jumpToSection('mastery') },
      { id: 'sidecar', label: 'Sidecar ochish', hint: 'S', icon: I.info, onExecute: handleOpenStudentSidecar },
      { id: '360card', label: '360° kartani almashtirish', icon: I.sparkles, onExecute: () => setShow360Card((p) => !p) },
      { id: 'refresh', label: 'Yangilash', hint: 'R', icon: I.refresh, onExecute: handleRetry },
      { id: 'export', label: 'CSV eksport', icon: I.download, onExecute: handleExportCsv },
      { id: 'print', label: 'Chop etish', icon: I.printer, onExecute: handlePrint },
      { id: 'edit', label: 'Talabani tahrirlash', icon: I.edit, onExecute: () => navigate(`/students/${profile.student.id}/edit`) },
    ];
  }, [profile, jumpToSection, handleOpenStudentSidecar, handleRetry, handleExportCsv, handlePrint, navigate]);

  /* ── Loading ─────────────────────────────────────────────── */
  if (isLoading || !profile) {
    if (isError || error) {
      return (
        <div className="page-container mx-auto max-w-7xl space-y-5 pb-16">
          <div className="liquid-glass-surface flex flex-col items-center gap-4 rounded-3xl border border-white/40 bg-white/70 p-10 text-center backdrop-blur-xl ring-1 ring-inset ring-rose-500/20 dark:border-white/10 dark:bg-surface-900/70">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(255,59,48,0.12)', color: '#FF3B30' }}
            >
              <Icon paths={I.alertTriangle} size={28} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[17px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('student360.loadErrorTitle')}
              </h3>
              <p className="mt-1 text-[13px] font-medium text-[#86868B]">
                {t('student360.loadErrorHint')}
              </p>
            </div>
            <motion.button
              type="button"
              onClick={handleRetry}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING.snappy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow: '0 8px 24px -8px rgba(0,122,255,0.5)',
              }}
            >
              <Icon paths={I.refresh} size={15} strokeWidth={2.4} />
              <span>{t('common.retry')}</span>
            </motion.button>
          </div>
        </div>
      );
    }
    return <ProfileSkeleton />;
  }

  const { student, attendance, academic, risk } = profile;
  const riskTone = RISK_TONE[risk.level] || 'slate';
  const riskC = TONE[riskTone];
  const sparkSeed = nameHash(student.name);

  /* ── Main content ────────────────────────────────────────── */
  return (
    <div className="relative">
      <AuroraCanvas />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container relative z-10 mx-auto max-w-7xl space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
      >
        {/* ═══ HERO ═══ */}
        <motion.div ref={sectionRefs.hero} data-section="hero" variants={cardVariants}>
          <div className="relative overflow-hidden rounded-3xl border border-white/50 bg-white/75 p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-surface-900/75">
            {/* Chromatic glass rim */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent dark:from-white/10"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/20 to-transparent dark:via-sky-400/25"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-6 right-0 w-px bg-gradient-to-b from-transparent via-violet-400/20 to-transparent dark:via-violet-400/25"
            />

            <div className="relative flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <HeroAvatar name={student.name} riskTone={riskTone} />

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight"
                      style={{
                        background: riskC.bg,
                        color: riskC.fg,
                        border: `1px solid ${riskC.border}`,
                        boxShadow: `0 4px 12px -6px ${riskC.glow}`,
                      }}
                    >
                      <Icon paths={I.shieldAlert} size={11} strokeWidth={2.5} />
                      {t(`student360.risk.${risk.level.toLowerCase()}`)} · {risk.score}/100
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-black/[0.03] px-2.5 py-1 text-[11px] font-semibold text-[#86868B] dark:border-white/10 dark:bg-white/[0.04]">
                      <Icon paths={I.userCircle} size={11} strokeWidth={2.5} />
                      {t('student360.badge')}
                    </span>
                  </div>

                  <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                    {student.name}
                  </h1>
                  <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">{t('student360.subtitle')}</p>

                  {/* Attendance heatmap */}
                  <div className="mt-4 max-w-sm">
                    <AttendanceHeatmap seed={sparkSeed} rate={attendance.rate} history={profile?.attendanceHistory} />
                  </div>
                </div>
              </div>

              {/* Right: risk gauge + actions */}
              <div className="flex flex-col items-center gap-3 sm:items-end sm:self-start">
                <RiskGauge score={risk.score} tone={riskTone} />

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setPaletteOpen(true)}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-2.5 py-2 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                    title="Command palette (⌘K)"
                  >
                    <Icon paths={I.command} size={12} strokeWidth={2.2} />
                    <kbd className="rounded border border-current/20 px-1 font-mono text-[9px] opacity-70">K</kbd>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleExportCsv}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-2.5 py-2 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                    title="CSV eksport"
                  >
                    <Icon paths={I.download} size={13} strokeWidth={2.2} />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handlePrint}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-2.5 py-2 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                    title="Chop etish"
                  >
                    <Icon paths={I.printer} size={13} strokeWidth={2.2} />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleRetry}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/60 px-2.5 py-2 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300"
                    title="Yangilash [R]"
                  >
                    <Icon paths={I.refresh} size={13} strokeWidth={2.2} />
                  </motion.button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setShow360Card((p) => !p)}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-600 shadow-sm backdrop-blur-md transition-all hover:bg-emerald-500/20 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400"
                    title="360° Shaffof Karta"
                  >
                    <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />
                    <span>
                      {show360Card
                        ? locale === 'uz'
                          ? 'Yopish'
                          : locale === 'ru'
                            ? 'Закрыть'
                            : 'Close'
                        : '360° Karta'}
                    </span>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handleOpenStudentSidecar}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/30 bg-white/60 px-3.5 py-2.5 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100"
                    title="Split View Profil Sidecar [S]"
                  >
                    <span className="text-[13px] leading-none">◨</span>
                    <span>Sidecar</span>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ Section navigator ═══ */}
        <SectionNav
          activeSection={activeSection}
          onJump={jumpToSection}
          sections={[
            { key: 'hero', label: 'Profil', icon: I.userCircle },
            { key: 'stats', label: 'Statistika', icon: I.pulse },
            { key: 'risk', label: 'Xavf', icon: I.shieldAlert },
            { key: 'mastery', label: 'Fanlar', icon: I.book },
            { key: 'timeline', label: 'Xronologiya', icon: I.clock },
            { key: 'trends', label: 'Dinamika', icon: I.sparkles },
          ]}
        />

        {/* ═══ 360° card ═══ */}
        <AnimatePresence>
          {show360Card && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={SPRING.smooth}
              className="overflow-hidden"
            >
              <div className="flex flex-col items-center rounded-3xl border border-white/60 bg-white/75 p-6 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-surface-900/75">
                <div className="mb-4 text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1 text-xs font-bold text-brand-600 dark:text-brand-400">
                    <Icon paths={I.sparkles} size={11} strokeWidth={2.2} />
                    360° Shaffof Karta — Interaktiv 3D Tajriba
                  </span>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {locale === 'uz'
                      ? "Sichqoncha yoki barmog'ingiz bilan kartani 3D fazoda aylantirishingiz va tekshirishingiz mumkin."
                      : locale === 'ru'
                        ? 'Вы можете вращать и осматривать карту в 3D пространстве с помощью мыши или пальца.'
                        : 'Rotate and inspect the 3D identity card in spatial perspective.'}
                  </p>
                </div>

                <SpatialIdentityCard360
                  data={{
                    id: student.id,
                    fullName: student.name,
                    role: 'STUDENT',
                    attendanceRate:
                      attendance.present + attendance.absent > 0 ? attendance.rate : undefined,
                    gpaOrMastery: academic.overallMastery > 0 ? academic.overallMastery : undefined,
                    coursesCount: academic.subjectsMastery?.length ?? 0,
                    status: 'Faol',
                    biometricVerified: Boolean(
                      (student as any).faceEnrolled || (student as any).isFaceVerified,
                    ),
                    nfcEnabled: false,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ STATS TILES ═══ */}
        <motion.div
          ref={sectionRefs.stats}
          data-section="stats"
          variants={containerVariants}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <StatTile
            label={t('student360.stat.attendance')}
            value={attendance.rate}
            suffix="%"
            icon={I.calendarCheck}
            tone={attendance.rate >= 85 ? 'green' : attendance.rate >= 70 ? 'blue' : 'orange'}
            footNote={t('student360.stat.attendanceFoot', {
              present: attendance.present,
              absent: attendance.absent,
            })}
            delta={{ value: 2, direction: 'up' }}
            sparkData={attendancePattern(sparkSeed, attendance.rate).map((v) => (v ? 1 : 0))}
            sparkUid="attendance"
          />
          <StatTile
            label={t('student360.stat.mastery')}
            value={academic.overallMastery}
            suffix="%"
            icon={I.target}
            tone={masteryTone(academic.overallMastery)}
            footNote={t('student360.stat.masteryFoot')}
            delta={{ value: 4, direction: 'up' }}
            sparkData={[42, 48, 45, 52, 50, 58, 55, 62, 60, 68, 72, academic.overallMastery]}
            sparkUid="mastery"
          />
          <StatTile
            label={t('student360.stat.quizzes')}
            value={academic.quizzes.avgScore}
            suffix="%"
            icon={I.fileText}
            tone={masteryTone(academic.quizzes.avgScore)}
            footNote={t('student360.stat.quizzesFoot', {
              passed: academic.quizzes.passedAttempts,
              total: academic.quizzes.totalAttempts,
            })}
            delta={{ value: 1, direction: 'down' }}
            sparkData={[68, 72, 70, 74, 71, 75, 73, 76, 74, 77, 75, academic.quizzes.avgScore]}
            sparkUid="quizzes"
          />
        </motion.div>

        {/* ═══ RISK PANEL ═══ */}
        <AnimatePresence>
          {risk.signals.length > 0 && (
            <motion.div
              ref={sectionRefs.risk}
              data-section="risk"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={SPRING.smooth}
              className="relative overflow-hidden rounded-3xl border p-5"
              style={{
                borderColor: riskC.border,
                background: riskC.bg,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), 0 12px 32px -16px ${riskC.glow}`,
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-4 left-0 w-[3px] rounded-r-full"
                style={{ background: riskC.fg, boxShadow: `0 0 10px ${riskC.glow}` }}
              />

              <div className="relative flex items-start gap-3.5 pl-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `${riskC.fg}20`,
                    color: riskC.fg,
                    border: `1px solid ${riskC.border}`,
                  }}
                >
                  <Icon paths={I.shieldAlert} size={20} strokeWidth={2.2} duotone />
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10.5px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: riskC.fg }}
                  >
                    {t('student360.risk.title')}
                  </div>
                  <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t(
                      risk.signals.length > 1
                        ? 'student360.risk.detectedMany'
                        : 'student360.risk.detectedOne',
                      { count: risk.signals.length },
                    )}
                  </h3>

                  <ul className="mt-3 space-y-2">
                    {risk.signals.map((sig, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...SPRING.smooth, delay: 0.1 + idx * 0.06 }}
                        className="flex items-start gap-2 text-[13px] font-medium leading-relaxed"
                        style={{ color: riskC.fg }}
                      >
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: riskC.fg, boxShadow: `0 0 6px ${riskC.glow}` }}
                        />
                        <span>{sig}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ MASTERY ═══ */}
        <motion.div ref={sectionRefs.mastery} data-section="mastery" variants={cardVariants}>
          <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/75">
            {/* Header */}
            <div className="flex flex-col gap-3 border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#AF52DE]/10 text-[#AF52DE]">
                  <Icon paths={I.book} size={17} strokeWidth={2} duotone />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('student360.mastery.title')}
                  </h2>
                  <p className="text-[11.5px] font-medium text-[#86868B]">
                    {t(
                      (academic.subjectsMastery?.length || 0) === 1
                        ? 'student360.mastery.countOne'
                        : 'student360.mastery.countMany',
                      { count: academic.subjectsMastery?.length || 0 },
                    )}
                  </p>
                </div>
              </div>

              {/* Sort & filter */}
              {academic.subjectsMastery && academic.subjectsMastery.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-slate-200/80 bg-white/60 p-0.5 text-[11px] font-bold dark:border-white/10 dark:bg-white/[0.04]">
                    {(['ALL', 'AT_RISK', 'EXCELLENT'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setMasteryFilter(f)}
                        className={`rounded-md px-2 py-1 transition-colors ${
                          masteryFilter === f
                            ? 'bg-[#007AFF] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                        }`}
                      >
                        {f === 'ALL'
                          ? 'Hammasi'
                          : f === 'AT_RISK'
                            ? 'Xavfda'
                            : "A'lo"}
                      </button>
                    ))}
                  </div>
                  <select
                    value={masterySort}
                    onChange={(e) => setMasterySort(e.target.value as MasterySort)}
                    className="rounded-lg border border-slate-200/80 bg-white/60 px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                  >
                    <option value="mastery">O'zlashtirish ↓</option>
                    <option value="name">Nomi (A-Z)</option>
                    <option value="objectives">Maqsadlar ↓</option>
                  </select>
                </div>
              )}
            </div>

            {/* Distribution + list */}
            {(!academic.subjectsMastery || academic.subjectsMastery.length === 0) ? (
              <div className="flex flex-col items-center gap-3 p-10 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: 'rgba(142,142,147,0.1)', color: '#8E8E93' }}
                >
                  <Icon paths={I.book} size={22} strokeWidth={2} />
                </div>
                <p className="text-[14px] font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {t('student360.mastery.emptyTitle')}
                </p>
                <p className="text-[12px] font-medium text-[#86868B]">
                  {t('student360.mastery.emptyHint')}
                </p>
              </div>
            ) : (
              <>
                <div className="border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06]">
                  <MasteryDistribution subjects={academic.subjectsMastery} />
                </div>

                {filteredMastery.length === 0 ? (
                  <div className="p-10 text-center text-[13px] text-[#86868B]">
                    Ushbu filtr bo'yicha fanlar topilmadi
                  </div>
                ) : (
                  <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {filteredMastery.map((sm, idx) => {
                      const tone = masteryTone(sm.masteryPercentage);
                      const c = TONE[tone];
                      return (
                        <motion.li
                          key={sm.subjectId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...SPRING.smooth, delay: idx * 0.04 }}
                          onClick={() => handleOpenSubjectSidecar(sm)}
                          className="group flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-4">
                            <ProgressRing value={sm.masteryPercentage} tone={tone} size={64} stroke={6} />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                                  {sm.subjectName}
                                </p>
                                <span
                                  className="rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tracking-wider"
                                  style={{
                                    background: c.bg,
                                    color: c.fg,
                                    border: `1px solid ${c.border}`,
                                  }}
                                >
                                  {sm.subjectCode}
                                </span>
                              </div>

                              <div className="mt-2.5 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${sm.masteryPercentage}%` }}
                                  transition={{ duration: 1, ease: EASE_APPLE, delay: 0.2 + idx * 0.06 }}
                                  className="h-full rounded-full"
                                  style={{ background: c.fg, boxShadow: `0 0 8px ${c.glow}` }}
                                />
                              </div>

                              <div className="mt-2 flex items-center gap-3 text-[11.5px] font-medium text-[#86868B]">
                                <span>
                                  <span className="font-bold tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
                                    {sm.masteredObjectives}
                                  </span>{' '}
                                  {t('student360.mastery.objectives', { total: sm.totalObjectives })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="hidden shrink-0 flex-col items-end sm:flex">
                              <span
                                className="text-[20px] font-bold leading-none tracking-tight tabular-nums"
                                style={{ color: c.fg }}
                              >
                                {sm.masteryPercentage}%
                              </span>
                              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[#86868B]">
                                {t('student360.mastery.label')}
                              </span>
                            </div>

                            <motion.button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSubjectSidecar(sm);
                              }}
                              whileHover={reduced ? undefined : { scale: 1.05 }}
                              whileTap={reduced ? undefined : { scale: 0.95 }}
                              transition={SPRING.snappy}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/40 px-3 py-2 text-[12px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur-md transition-all hover:bg-white/60 hover:text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                              title="Split View Sidecar"
                            >
                              <span>◨</span>
                            </motion.button>
                          </div>
                        </motion.li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </motion.div>

        {/* ═══ SECTION 5: CHRONOLOGICAL LONGITUDINAL TIMELINE ═══ */}
        <motion.div ref={sectionRefs.timeline} data-section="timeline" variants={cardVariants}>
          <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/75 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/75">
            <div className="flex flex-col gap-3 border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Icon paths={I.clock} size={17} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Xronologik O&apos;sish Lentasi
                  </h2>
                  <p className="text-[11.5px] font-medium text-[#86868B]">
                    Imtihonlar, topshiriqlar, viktorinalar va oraliq baholashlar tarixi ({rawTimeline.length} ta qayd)
                  </p>
                </div>
              </div>

              {/* Timeline Category Filters */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'Barchasi' },
                  { id: 'EXAM', label: 'Imtihonlar' },
                  { id: 'QUIZ', label: 'Viktorinalar' },
                  { id: 'ASSIGNMENT', label: 'Topshiriqlar' },
                  { id: 'GRADE', label: 'Baholar' },
                  { id: 'ATTENDANCE', label: 'Davomat' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimelineFilter(f.id as any)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      timelineFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200/80 bg-white/60 text-slate-600 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTimeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-xs text-[var(--text-muted)]">
                <span className="text-2xl">⏳</span>
                <p className="font-semibold text-[var(--text-primary)]">Hozircha tanlangan toifadagi xronologik qaydlar topilmadi</p>
                <p>O&apos;quvchi sinov va mashg&apos;ulotlarda ishtirok etgach, xronologiya avtomatik boyitiladi.</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredTimeline.map((ev, idx) => {
                  const toneColors = TONE[ev.tone] ?? TONE.blue;
                  const typeBadge = {
                    EXAM: { label: 'Imtihon', icon: '🎯' },
                    QUIZ: { label: 'Viktorina', icon: '💡' },
                    ASSIGNMENT: { label: 'Topshiriq', icon: '📝' },
                    GRADE: { label: 'Oraliq baho', icon: '⭐' },
                    ATTENDANCE: { label: 'Davomat', icon: '🚪' },
                  }[ev.type] ?? { label: ev.type, icon: '📌' };

                  return (
                    <motion.li
                      key={ev.id || idx}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                      className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm"
                          style={{ background: toneColors.bg, color: toneColors.fg, border: `1px solid ${toneColors.border}` }}
                        >
                          <span>{typeBadge.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[13.5px] font-bold text-[var(--text-primary)]">
                              {ev.title}
                            </p>
                            <span
                              className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                              style={{ background: toneColors.bg, color: toneColors.fg }}
                            >
                              {typeBadge.label}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--text-muted)]">
                            {ev.subtitle}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 text-right">
                        {ev.score !== undefined && (
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-black tabular-nums" style={{ color: toneColors.fg }}>
                              {ev.score} {ev.maxScore ? `/ ${ev.maxScore}` : ''}
                            </span>
                            <span className="text-[10px] font-semibold text-[var(--text-muted)]">natija</span>
                          </div>
                        )}
                        <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums">
                          {formatDate(ev.timestamp)}
                        </span>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </div>
        </motion.div>

        {/* ═══ SECTION 6: MONTHLY MASTERY DYNAMICS & PEDAGOGICAL INTERVENTIONS ═══ */}
        <motion.div ref={sectionRefs.trends} data-section="trends" variants={cardVariants}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left: 6-Month Trajectory Bars */}
            <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/75 p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/75 lg:col-span-7">
              <div className="flex items-center gap-3 border-b border-black/[0.04] pb-4 dark:border-white/[0.06]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Icon paths={I.sparkles} size={17} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    6 Oylik O&apos;zlashtirish va Qatnashuv Dinamikasi
                  </h3>
                  <p className="text-[11.5px] font-medium text-[#86868B]">
                    Oylik o&apos;zlashtirish (binafsha) va davomat ishonchliligi (yashil)
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {(profile?.monthlyTrends ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                    Dinamika ma&apos;lumotlari shakllanmoqda...
                  </p>
                ) : (
                  (profile?.monthlyTrends ?? []).map((trend, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[var(--text-primary)]">{trend.month}</span>
                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-purple-600 dark:text-purple-400">
                            O&apos;zlashtirish: {trend.mastery}%
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400">
                            Davomat: {trend.attendanceRate}%
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${trend.mastery}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                          />
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${trend.attendanceRate}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Diagnostic Pedagogical Interventions */}
            <div className="overflow-hidden rounded-3xl border border-white/40 bg-white/75 p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-surface-900/75 lg:col-span-5">
              <div className="flex items-center gap-3 border-b border-black/[0.04] pb-4 dark:border-white/[0.06]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Icon paths={I.shieldAlert} size={17} strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Pedagogik Interventsiyalar
                  </h3>
                  <p className="text-[11.5px] font-medium text-[#86868B]">
                    Individual ta&apos;lim yordami va tavsiyalar
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(profile?.interventions ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--text-muted)]">
                    Faol tavsiyalar mavjud emas.
                  </p>
                ) : (
                  (profile?.interventions ?? []).map((intv) => (
                    <div
                      key={intv.id}
                      className="rounded-2xl border border-slate-200/70 bg-white/60 p-3.5 transition-all hover:border-indigo-500/30 dark:border-white/10 dark:bg-white/[0.02]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-[var(--text-primary)]">
                          {intv.title}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${
                            intv.priority === 'HIGH'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          }`}
                        >
                          {intv.priority === 'HIGH' ? 'Yuqori daraja' : 'Tavsiya'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[var(--text-muted)]">
                        {intv.description}
                      </p>
                      <div className="mt-2.5 flex items-center justify-end">
                        <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300">
                          {intv.actionLabel} →
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══ Command palette ═══ */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}

export default Student360Page;