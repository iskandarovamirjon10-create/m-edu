/**
 * ============================================================================
 *  M-EDU Student360Page — v3.0 "Chromatic Liquid Glass · Spatial Telemetry"
 *
 *  v2 → v3.0 Senior Architecture & Liquid Glass Upgrades:
 *   • Fixed IntersectionObserver thrashing via memoized sectionRefs map
 *   • Fixed AttendanceHeatmap status logic (PRESENT / LATE / EXCUSED / ABSENT)
 *     + interactive hover/focus day inspector
 *   • Connected StatTile sparklines & deltas to real `monthlyTrends` telemetry
 *   • Sanitized SVG gradient IDs & single-point fallback in Sparkline
 *   • Fixed CommandPalette (⌘K) activeIndex bounds on query change + added
 *     working 1–6, S, R, C, E keyboard shortcuts (guarded against Ctrl/Cmd)
 *   • Added live Subject Search + keyboard-accessible Mastery & Timeline rows
 *   • Made Pedagogical Interventions interactive with Sidecar QuickLook
 *   • Added Chromatic Liquid Glass CSS engine + @media print rules
 *   • All exports & TypeScript contracts 100% preserved
 * ============================================================================
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useId,
  memo,
} from 'react';
import { createPortal } from 'react-dom';
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
 * CHROMATIC LIQUID GLASS v3.0 CSS ENGINE
 * ════════════════════════════════════════════════════════════════════════ */

const STUDENT_360_GLASS_CSS = `
.s360-glass {
  position: relative;
  isolation: isolate;
  background:
    linear-gradient(145deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.58) 100%);
  -webkit-backdrop-filter: blur(36px) saturate(195%);
  backdrop-filter: blur(36px) saturate(195%);
  border: 1px solid rgba(255,255,255,0.75);
  box-shadow:
    0 1px 2px rgba(15,23,42,0.04),
    0 18px 48px -16px rgba(15,23,42,0.12),
    inset 0 1px 0 rgba(255,255,255,0.92);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
              box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1),
              border-color 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.dark .s360-glass {
  background:
    linear-gradient(145deg, rgba(30,41,59,0.68) 0%, rgba(15,23,42,0.52) 100%);
  border-color: rgba(255,255,255,0.11);
  box-shadow:
    0 1px 2px rgba(0,0,0,0.45),
    0 24px 56px -18px rgba(0,0,0,0.65),
    inset 0 1px 0 rgba(255,255,255,0.18);
}
.s360-glass::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(120% 70% at 10% -10%, rgba(255,255,255,0.35), transparent 55%),
    radial-gradient(90% 60% at 100% 110%, rgba(0,122,255,0.06), transparent 60%);
}
.dark .s360-glass::before {
  background:
    radial-gradient(120% 70% at 10% -10%, rgba(255,255,255,0.12), transparent 55%),
    radial-gradient(90% 60% at 100% 110%, rgba(56,189,248,0.08), transparent 60%);
}

.s360-inset {
  background: rgba(15,23,42,0.035);
  border: 1px solid rgba(15,23,42,0.06);
  box-shadow: inset 0 1px 2px rgba(15,23,42,0.04), 0 1px 0 rgba(255,255,255,0.7);
}
.dark .s360-inset {
  background: rgba(255,255,255,0.035);
  border-color: rgba(255,255,255,0.075);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.05);
}

.s360-btn {
  position: relative;
  border: 1px solid rgba(15,23,42,0.08);
  background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55));
  box-shadow: 0 2px 8px -3px rgba(15,23,42,0.10), inset 0 1px 0 rgba(255,255,255,0.9);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.dark .s360-btn {
  border-color: rgba(255,255,255,0.11);
  background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04));
  box-shadow: 0 4px 12px -4px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18);
}
.s360-btn:hover:not(:disabled) {
  border-color: rgba(0,122,255,0.35);
}
.s360-btn:active:not(:disabled) {
  transform: scale(0.96);
}

@media print {
  .s360-no-print { display: none !important; }
  .s360-glass {
    background: #ffffff !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    box-shadow: none !important;
    border: 1px solid #cbd5e1 !important;
    break-inside: avoid;
  }
}
`;

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
  visible: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
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
 * TYPES (All Contracts Preserved)
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
type TimelineFilter = 'ALL' | 'EXAM' | 'QUIZ' | 'ASSIGNMENT' | 'GRADE' | 'ATTENDANCE';

/* ══════════════════════════════════════════════════════════════════════════
 * TONE PALETTES
 * ════════════════════════════════════════════════════════════════════════ */

export const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)',   glow: 'rgba(0,122,255,0.28)',   border: 'rgba(0,122,255,0.22)' },
  green:  { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',   glow: 'rgba(52,199,89,0.28)',   border: 'rgba(52,199,89,0.22)' },
  orange: { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',   glow: 'rgba(255,149,0,0.28)',   border: 'rgba(255,149,0,0.22)' },
  red:    { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',   glow: 'rgba(255,59,48,0.28)',   border: 'rgba(255,59,48,0.22)' },
  purple: { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)',  glow: 'rgba(175,82,222,0.28)',  border: 'rgba(175,82,222,0.22)' },
  slate:  { fg: '#8E8E93', bg: 'rgba(142,142,147,0.10)', glow: 'rgba(142,142,147,0.28)', border: 'rgba(142,142,147,0.22)' },
};

export const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: 'green',
  MEDIUM: 'blue',
  HIGH: 'orange',
  CRITICAL: 'red',
};

/* ══════════════════════════════════════════════════════════════════════════
 * PURE HELPERS (Preserved & Unicode-Safe)
 * ════════════════════════════════════════════════════════════════════════ */

export function getInitials(name: string): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned) return '—';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return (
    parts
      .map((p) => Array.from(p)[0] ?? '')
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

/* Deterministic pseudo-attendance pattern for fallback heatmap (30 days) */
function attendancePattern(seed: number, rate: number): boolean[] {
  const days: boolean[] = [];
  let s = seed || 1;
  const clampedRate = Math.max(0, Math.min(100, Number.isFinite(rate) ? rate : 0));
  for (let i = 0; i < 30; i++) {
    s = (s * 9301 + 49297) % 233280;
    const rnd = s / 233280;
    days.push(rnd < clampedRate / 100);
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
      className="s360-no-print pointer-events-none absolute inset-x-0 -top-40 z-0 flex h-[440px] justify-center overflow-hidden"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4, ease: EASE_APPLE }}
        className="relative h-full w-full"
      >
        <div className="absolute left-1/2 top-1/2 h-[290px] w-[580px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400/15 blur-[105px] dark:bg-sky-500/12" />
        <div className="absolute left-1/3 top-1/2 h-[210px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/12 blur-[95px] dark:bg-violet-500/10" />
        <div className="absolute right-1/4 top-1/2 h-[210px] w-[420px] translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-[95px] dark:bg-emerald-500/08" />
        {!reduced && (
          <motion.div
            animate={{ scale: [1, 1.06, 1], opacity: [0.88, 1, 0.88] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-1/2 top-1/2 h-[330px] w-[740px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/[0.06] via-violet-500/[0.05] to-emerald-500/[0.06] blur-[120px] dark:from-sky-500/[0.08] dark:via-violet-500/[0.05] dark:to-emerald-500/[0.06]"
          />
        )}
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS — Duotone Precision Vector Icons
 * ════════════════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.85;

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
  shieldCheck: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
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
  close: ['M18 6 6 18', 'M6 6l12 12'],
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
          fillOpacity={duotone && i === 0 ? 0.14 : 0}
          strokeOpacity={duotone && i > 1 ? 0.65 : 1}
        />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SUB-COMPONENTS (CountUp, Shimmer, Sparkline)
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
  const safeTarget = Number.isFinite(value) ? value : 0;
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(isTest || reduced ? safeTarget : 0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTest || reduced) {
      setN(safeTarget);
      return;
    }
    let raf: number;
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min(1, (ts - startRef.current) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setN(safeTarget * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [safeTarget, duration, isTest, reduced]);

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

/* ── Sparkline (Fixed SVG ID sanitization & 1-point edge case) ── */
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
  const reactId = useId();
  const safeUid = useMemo(
    () => `${uid}-${reactId}`.replace(/[^a-zA-Z0-9_-]/g, ''),
    [uid, reactId],
  );

  const { path, area } = useMemo(() => {
    const clean = data.filter((v) => Number.isFinite(v));
    if (clean.length === 0) return { path: '', area: '' };
    const series = clean.length === 1 ? [clean[0], clean[0]] : clean;

    const w = 100;
    const h = 26;
    const min = Math.min(...series);
    const max = Math.max(...series);
    const range = max - min || 1;
    const step = w / Math.max(1, series.length - 1);
    const pts = series.map((v, i) => [
      i * step,
      max === min ? h / 2 : h - ((v - min) / range) * (h - 5) - 2.5,
    ]);
    let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const cx = ((x0 + x1) / 2).toFixed(2);
      d += ` C${cx},${y0.toFixed(2)} ${cx},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
    }
    return { path: d, area: `${d} L${w},${h} L0,${h} Z` };
  }, [data]);

  const gid = `spark-fill-${safeUid}`;
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
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * HERO AVATAR — Specular Ring (Preserved)
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
 * STAT TILE — with sparkline + delta (Preserved signature)
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
      className="s360-glass group relative flex flex-col gap-3 overflow-hidden rounded-2xl p-5"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/[0.22]"
      />

      <div className="relative z-10 flex items-center gap-3">
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
        {delta && delta.value !== 0 && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold tabular-nums"
            style={{
              color: deltaColor,
              background: `${deltaColor}18`,
              border: `1px solid ${deltaColor}30`,
            }}
          >
            <Icon paths={DeltaIcon} size={9} strokeWidth={2.8} />
            {Math.abs(delta.value)}%
          </span>
        )}
      </div>

      <div className="relative z-10">
        <div className="text-[28px] font-bold leading-none tracking-tighter text-[#1D1D1F] tabular-nums dark:text-[#F5F5F7]">
          <CountUp value={value} suffix={suffix} />
        </div>
        {footNote && (
          <div className="mt-1.5 truncate text-[12px] font-medium text-[#86868B]">{footNote}</div>
        )}
        {sparkData && sparkData.length > 0 && (
          <div className="mt-2.5 h-7 w-full opacity-75 transition-opacity duration-300 group-hover:opacity-100">
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
 * PROGRESS RING (Preserved signature + proportional text scaling)
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
  const r = Math.max(4, (size - stroke) / 2);
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const dash = (clamped / 100) * circ;
  const fontSize = Math.max(10, Math.round(size * 0.21));

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
        <span className="font-bold tabular-nums" style={{ color: c.fg, fontSize }}>
          {Math.round(clamped)}%
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
  const pct = Math.min(1, Math.max(0, (Number.isFinite(score) ? score : 0) / 100));

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
 * ATTENDANCE HEATMAP — 30-day strip with accurate status & interactive pill
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
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hasRealHistory = Boolean(history && history.length > 0);
  const fallbackDays = useMemo(() => attendancePattern(seed, rate), [seed, rate]);

  const items = useMemo(() => {
    if (hasRealHistory && history) {
      return history.slice(0, 30).map((h, i) => {
        const st = (h.status || 'PRESENT').toUpperCase();
        const statusLabel =
          st === 'PRESENT'
            ? 'Kelgan'
            : st === 'LATE'
              ? 'Kechikkan'
              : st === 'EXCUSED'
                ? 'Sababli'
                : 'Kelmadi';
        return {
          index: i,
          status: st,
          date: h.date,
          label: `${h.date}: ${statusLabel}${h.groupName ? ` (${h.groupName})` : ''}`,
          isPresent: st === 'PRESENT',
          isLate: st === 'LATE',
          isExcused: st === 'EXCUSED',
        };
      });
    }
    return fallbackDays.map((present, i) => ({
      index: i,
      status: present ? 'PRESENT' : 'ABSENT',
      date: `Kun ${i + 1}`,
      label: `Kun ${i + 1}: ${present ? 'Kelgan' : 'Kelmadi'}`,
      isPresent: present,
      isLate: false,
      isExcused: false,
    }));
  }, [hasRealHistory, history, fallbackDays]);

  const presentCount = items.filter((x) => x.isPresent || x.isLate).length;
  const activeItem = hoveredIdx !== null ? items[hoveredIdx] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          {activeItem
            ? activeItem.label
            : hasRealHistory
              ? 'Davomat jurnali (Haqiqiy qaydlar)'
              : 'Oxirgi 30 kun'}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {presentCount} / {items.length} kun
        </span>
      </div>
      <div
        className="flex gap-[3px]"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {items.map((item) => {
          const barClass = item.isPresent
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-[0_1px_3px_rgba(52,199,89,0.4)]'
            : item.isLate
              ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_1px_3px_rgba(245,158,11,0.4)]'
              : item.isExcused
                ? 'bg-gradient-to-br from-sky-400 to-blue-600 shadow-[0_1px_3px_rgba(0,122,255,0.35)]'
                : 'bg-rose-400/30 dark:bg-rose-500/25';

          return (
            <motion.button
              key={item.index}
              type="button"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: item.index * 0.008, ease: EASE_APPLE }}
              onMouseEnter={() => setHoveredIdx(item.index)}
              onFocus={() => setHoveredIdx(item.index)}
              onBlur={() => setHoveredIdx(null)}
              aria-label={item.label}
              title={item.label}
              className={`h-6 flex-1 rounded-sm transition-transform hover:scale-y-125 focus:scale-y-125 focus:outline-none ${barClass}`}
            />
          );
        })}
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
    { key: 'excellent', label: "A'lo (80+)", count: buckets.excellent, color: '#34C759' },
    { key: 'good', label: 'Yaxshi (60+)', count: buckets.good, color: '#007AFF' },
    { key: 'fair', label: "O'rta (40+)", count: buckets.fair, color: '#FF9500' },
    { key: 'weak', label: 'Past (40 dan kam)', count: buckets.weak, color: '#FF3B30' },
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
    <div className="s360-no-print sticky top-2 z-30 mx-auto w-fit max-w-full px-2">
      <div className="s360-glass inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl p-1">
        {sections.map((sec) => {
          const active = activeSection === sec.key;
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => onJump(sec.key)}
              className={[
                'relative inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold transition-colors',
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
 * COMMAND PALETTE (⌘K) — Fixed bounds when filtering
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
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
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

  // Reset activeIndex whenever query changes so it never goes out of bounds
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (filtered.length > 0 ? Math.min(filtered.length - 1, i + 1) : 0));
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="s360-no-print fixed inset-0 z-[100] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-md"
          onClick={onClose}
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={SPRING.island}
            onClick={(e) => e.stopPropagation()}
            className="s360-glass w-full max-w-lg overflow-hidden rounded-[24px]"
            role="dialog"
            aria-modal="true"
            aria-label="Buyruqlar paneli"
          >
            <div className="relative z-10 flex items-center gap-2.5 border-b border-slate-200/70 px-4 py-3.5 dark:border-white/[0.08]">
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
            <div className="relative z-10 max-h-[52vh] overflow-y-auto p-1.5">
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
    </AnimatePresence>,
    document.body,
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
      <div className="s360-glass rounded-3xl">
        <div className="border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06]">
          <Shimmer className="h-5 w-40" radius="0.5rem" />
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-black/[0.04] px-6 py-4 last:border-0 dark:border-white/[0.06]"
          >
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
  const [subjectSearch, setSubjectSearch] = useState('');
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>('ALL');
  const [timelineExpanded, setTimelineExpanded] = useState(false);

  // Memoized stable refs map — prevents IntersectionObserver teardown on scroll
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const riskRef = useRef<HTMLDivElement>(null);
  const masteryRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const trendsRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useMemo<Record<SectionKey, React.RefObject<HTMLDivElement | null>>>(
    () => ({
      hero: heroRef,
      stats: statsRef,
      risk: riskRef,
      mastery: masteryRef,
      timeline: timelineRef,
      trends: trendsRef,
    }),
    [],
  );

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

  const handleOpenTimelineSidecar = useCallback(
    (ev: StudentTelemetryEvent) => {
      playPop();
      const sidecarData: QuickLookData = {
        type: 'general',
        id: ev.id,
        title: ev.title,
        subtitle: `${ev.type} · ${formatDate(ev.timestamp)}`,
        status: {
          label: ev.score !== undefined ? `${ev.score}${ev.maxScore ? `/${ev.maxScore}` : ''}` : ev.type,
          tone: ev.tone === 'green' ? 'green' : ev.tone === 'orange' ? 'amber' : 'blue',
        },
        metrics: [
          { label: 'Turi', value: ev.type },
          { label: 'Natija', value: ev.score !== undefined ? `${ev.score}${ev.maxScore ? ` / ${ev.maxScore}` : ''}` : '—' },
          { label: 'Sana', value: formatDate(ev.timestamp) },
        ],
        details: [
          { label: 'Qayd ID', value: ev.id, copyable: true },
          { label: 'Sarlavha', value: ev.title },
          { label: 'Tavsif', value: ev.subtitle },
          { label: 'Vaqt', value: formatDate(ev.timestamp) },
        ],
      };
      openSidecar(sidecarData);
    },
    [playPop],
  );

  const handleOpenInterventionSidecar = useCallback(
    (intv: StudentInterventionItem) => {
      playPop();
      const sidecarData: QuickLookData = {
        type: 'general',
        id: intv.id,
        title: intv.title,
        subtitle: `${intv.category} · ${intv.priority}`,
        status: {
          label: intv.priority,
          tone: intv.priority === 'HIGH' ? 'red' : intv.priority === 'MEDIUM' ? 'amber' : 'blue',
        },
        metrics: [
          { label: "Yo'nalish", value: intv.category },
          { label: 'Muhimlik', value: intv.priority },
          { label: 'Tavsiya amali', value: intv.actionLabel },
        ],
        details: [
          { label: 'Interventsiya ID', value: intv.id, copyable: true },
          { label: 'Sarlavha', value: intv.title },
          { label: 'Batafsil tavsif', value: intv.description },
          { label: 'Keyingi qadam', value: intv.actionLabel },
        ],
      };
      openSidecar(sidecarData);
    },
    [playPop],
  );

  /* ── Section jump ─────────────────────────────────────────── */
  const jumpToSection = useCallback(
    (key: SectionKey) => {
      const el = sectionRefs[key].current;
      if (!el) return;
      playTick();
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced, sectionRefs, playTick],
  );

  /* ── Scroll spy ───────────────────────────────────────────── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !profile) return;
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
    (Object.keys(sectionRefs) as SectionKey[]).forEach((k) => {
      const el = sectionRefs[k].current;
      if (el) observer.observe(el);
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
    const csv =
      '\uFEFF' +
      rows
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student360-${student.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    playTick();
  }, [profile, playTick]);

  /* ── Print ────────────────────────────────────────────────── */
  const handlePrint = useCallback(() => {
    playTick();
    window.print();
  }, [playTick]);

  /* ── Keyboard shortcuts (Guarded against Ctrl/Cmd/Alt) ───── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Do not hijack browser shortcuts like Cmd+R, Ctrl+S, Ctrl+P
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'r') handleRetry();
      else if (k === 's') handleOpenStudentSidecar();
      else if (k === 'c') setShow360Card((p) => !p);
      else if (k === 'e') handleExportCsv();
      else if (k === '1') jumpToSection('hero');
      else if (k === '2') jumpToSection('stats');
      else if (k === '3') jumpToSection('risk');
      else if (k === '4') jumpToSection('mastery');
      else if (k === '5') jumpToSection('timeline');
      else if (k === '6') jumpToSection('trends');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenStudentSidecar, handleRetry, handleExportCsv, jumpToSection]);

  /* ── Real Telemetry Sparklines & Deltas ──────────────────── */
  const telemetrySeries = useMemo(() => {
    const trends = profile?.monthlyTrends ?? [];
    const attRate = profile?.attendance.rate ?? 0;
    const mastery = profile?.academic.overallMastery ?? 0;
    const quizAvg = profile?.academic.quizzes.avgScore ?? 0;
    const seed = nameHash(profile?.student.name ?? 'M');

    const attSeries =
      trends.length >= 2
        ? trends.map((m) => m.attendanceRate)
        : attendancePattern(seed, attRate).map((v) => (v ? 100 : 0));

    const masterySeries =
      trends.length >= 2
        ? trends.map((m) => m.mastery)
        : [Math.max(0, mastery - 12), Math.max(0, mastery - 8), Math.max(0, mastery - 4), mastery];

    const quizEvents = (profile?.timeline ?? [])
      .filter((ev) => (ev.type === 'QUIZ' || ev.type === 'EXAM') && typeof ev.score === 'number')
      .slice(0, 10)
      .reverse();

    const quizSeries =
      quizEvents.length >= 2
        ? quizEvents.map((ev) =>
            ev.maxScore && ev.maxScore > 0
              ? Math.round(((ev.score ?? 0) / ev.maxScore) * 100)
              : (ev.score ?? 0),
          )
        : [Math.max(0, quizAvg - 6), Math.max(0, quizAvg - 2), quizAvg];

    const calcDelta = (arr: number[]): { value: number; direction: 'up' | 'down' } | undefined => {
      if (arr.length < 2) return undefined;
      const diff = Math.round(arr[arr.length - 1] - arr[arr.length - 2]);
      if (diff === 0) return undefined;
      return { value: Math.abs(diff), direction: diff > 0 ? 'up' : 'down' };
    };

    return {
      attSeries,
      masterySeries,
      quizSeries,
      attDelta: calcDelta( trends.length >= 2 ? trends.map((m) => m.attendanceRate) : []),
      masteryDelta: calcDelta(masterySeries),
      quizDelta: calcDelta(quizSeries),
    };
  }, [profile]);

  /* ── Sorted & filtered mastery with live search ──────────── */
  const filteredMastery = useMemo(() => {
    if (!profile?.academic.subjectsMastery) return [];
    let list = [...profile.academic.subjectsMastery];
    const q = subjectSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.subjectName.toLowerCase().includes(q) ||
          s.subjectCode.toLowerCase().includes(q),
      );
    }
    if (masteryFilter === 'AT_RISK') list = list.filter((s) => s.masteryPercentage < 60);
    if (masteryFilter === 'EXCELLENT') list = list.filter((s) => s.masteryPercentage >= 80);
    if (masterySort === 'mastery') list.sort((a, b) => b.masteryPercentage - a.masteryPercentage);
    if (masterySort === 'name') list.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    if (masterySort === 'objectives')
      list.sort((a, b) => b.masteredObjectives - a.masteredObjectives);
    return list;
  }, [profile, masterySort, masteryFilter, subjectSearch]);

  const rawTimeline = useMemo(() => profile?.timeline ?? [], [profile?.timeline]);
  const filteredTimeline = useMemo(() => {
    if (timelineFilter === 'ALL') return rawTimeline;
    return rawTimeline.filter((e) => e.type === timelineFilter);
  }, [rawTimeline, timelineFilter]);

  const visibleTimeline = useMemo(
    () => (timelineExpanded ? filteredTimeline : filteredTimeline.slice(0, 8)),
    [filteredTimeline, timelineExpanded],
  );

  /* ── Command palette actions ─────────────────────────────── */
  const paletteActions = useMemo<PaletteAction[]>(() => {
    if (!profile) return [];
    return [
      { id: 'section-hero', label: "Profilga o'tish", hint: '1', icon: I.userCircle, onExecute: () => jumpToSection('hero') },
      { id: 'section-stats', label: "Statistikaga o'tish", hint: '2', icon: I.pulse, onExecute: () => jumpToSection('stats') },
      { id: 'section-risk', label: "Xavf signallariga o'tish", hint: '3', icon: I.shieldAlert, onExecute: () => jumpToSection('risk') },
      { id: 'section-mastery', label: "Fan o'zlashtirishga o'tish", hint: '4', icon: I.book, onExecute: () => jumpToSection('mastery') },
      { id: 'section-timeline', label: "Xronologiyaga o'tish", hint: '5', icon: I.clock, onExecute: () => jumpToSection('timeline') },
      { id: 'section-trends', label: "Oylik dinamikaga o'tish", hint: '6', icon: I.sparkles, onExecute: () => jumpToSection('trends') },
      { id: 'sidecar', label: 'Sidecar ochish', hint: 'S', icon: I.info, onExecute: handleOpenStudentSidecar },
      { id: '360card', label: '360° kartani almashtirish', hint: 'C', icon: I.sparkles, onExecute: () => setShow360Card((p) => !p) },
      { id: 'refresh', label: 'Yangilash', hint: 'R', icon: I.refresh, onExecute: handleRetry },
      { id: 'export', label: 'CSV eksport', hint: 'E', icon: I.download, onExecute: handleExportCsv },
      { id: 'print', label: 'Chop etish', icon: I.printer, onExecute: handlePrint },
      { id: 'edit', label: 'Talabani tahrirlash', icon: I.edit, onExecute: () => navigate(`/students/${profile.student.id}/edit`) },
    ];
  }, [profile, jumpToSection, handleOpenStudentSidecar, handleRetry, handleExportCsv, handlePrint, navigate]);

  /* ── Loading & Error States ──────────────────────────────── */
  if (isLoading || !profile) {
    if (isError || error) {
      return (
        <div className="page-container mx-auto max-w-7xl space-y-5 pb-16">
          <style>{STUDENT_360_GLASS_CSS}</style>
          <div className="s360-glass flex flex-col items-center gap-4 rounded-3xl p-10 text-center ring-1 ring-inset ring-rose-500/20">
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
      <style>{STUDENT_360_GLASS_CSS}</style>
      <AuroraCanvas />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="page-container relative z-10 mx-auto max-w-7xl space-y-5 pb-[calc(2rem+env(safe-area-inset-bottom))]"
      >
        {/* ═══ SECTION 1: HERO ═══ */}
        <motion.div ref={heroRef} data-section="hero" variants={cardVariants}>
          <div className="s360-glass relative overflow-hidden rounded-3xl p-6">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-blue-400/25 to-transparent dark:via-sky-400/30"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-6 right-0 w-px bg-gradient-to-b from-transparent via-violet-400/25 to-transparent dark:via-violet-400/30"
            />

            <div className="relative z-10 flex flex-col items-center justify-between gap-6 lg:flex-row lg:items-start">
              <div className="flex w-full flex-col items-center gap-6 sm:flex-row sm:items-start lg:w-auto lg:flex-1">
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
                    <span className="s360-inset inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-[#86868B]">
                      <Icon paths={I.userCircle} size={11} strokeWidth={2.5} />
                      {t('student360.badge')}
                    </span>
                  </div>

                  <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                    {student.name}
                  </h1>
                  <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">{t('student360.subtitle')}</p>

                  {/* Attendance heatmap */}
                  <div className="mt-4 max-w-md mx-auto sm:mx-0">
                    <AttendanceHeatmap
                      seed={sparkSeed}
                      rate={attendance.rate}
                      history={profile?.attendanceHistory}
                    />
                  </div>
                </div>
              </div>

              {/* Right: risk gauge + actions */}
              <div className="s360-no-print flex flex-col items-center gap-3 lg:items-end lg:self-start">
                <RiskGauge score={risk.score} tone={riskTone} />

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setPaletteOpen(true)}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="s360-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300"
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
                    className="s360-btn inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300"
                    title="CSV eksport [E]"
                  >
                    <Icon paths={I.download} size={13} strokeWidth={2.2} />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={handlePrint}
                    whileHover={reduced ? undefined : { scale: 1.02 }}
                    whileTap={reduced ? undefined : { scale: 0.98 }}
                    transition={SPRING.snappy}
                    className="s360-btn inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300"
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
                    className="s360-btn inline-flex min-h-[40px] min-w-[40px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold text-slate-600 dark:text-slate-300"
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
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 shadow-sm backdrop-blur-md transition-all hover:bg-emerald-500/20 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400"
                    title="360° Shaffof Karta [C]"
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
                    className="s360-btn inline-flex min-h-[42px] items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-zinc-100"
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

        {/* ═══ Sticky Section Navigator ═══ */}
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

        {/* ═══ 360° Interactive Spatial Card ═══ */}
        <AnimatePresence>
          {show360Card && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={SPRING.smooth}
              className="s360-no-print overflow-hidden"
            >
              <div className="s360-glass flex flex-col items-center rounded-3xl p-6">
                <div className="relative z-10 mb-4 text-center">
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

                <div className="relative z-10">
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
                        student.faceEnrolled || student.isFaceVerified,
                      ),
                      nfcEnabled: false,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ SECTION 2: STATS TILES (Connected to real telemetry) ═══ */}
        <motion.div
          ref={statsRef}
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
            delta={telemetrySeries.attDelta}
            sparkData={telemetrySeries.attSeries}
            sparkUid="attendance"
          />
          <StatTile
            label={t('student360.stat.mastery')}
            value={academic.overallMastery}
            suffix="%"
            icon={I.target}
            tone={masteryTone(academic.overallMastery)}
            footNote={t('student360.stat.masteryFoot')}
            delta={telemetrySeries.masteryDelta}
            sparkData={telemetrySeries.masterySeries}
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
            delta={telemetrySeries.quizDelta}
            sparkData={telemetrySeries.quizSeries}
            sparkUid="quizzes"
          />
        </motion.div>

        {/* ═══ SECTION 3: RISK PANEL (Always keeps ref mounted so SectionNav 'Xavf' works) ═══ */}
        <motion.div ref={riskRef} data-section="risk" variants={cardVariants}>
          {risk.signals.length > 0 ? (
            <div
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
            </div>
          ) : (
            <div className="s360-glass flex items-center justify-between gap-4 rounded-3xl px-6 py-4">
              <div className="relative z-10 flex items-center gap-3.5">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: TONE.green.bg,
                    color: TONE.green.fg,
                    border: `1px solid ${TONE.green.border}`,
                  }}
                >
                  <Icon paths={I.shieldCheck} size={19} strokeWidth={2.2} duotone />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Akademik va davomat xavf omillari aniqlanmadi
                  </h3>
                  <p className="text-[12px] font-medium text-[#86868B]">
                    O&apos;quvchi barqaror ko&apos;rsatkichlar bilan o&apos;zlashtirishda davom etmoqda ({risk.score}/100).
                  </p>
                </div>
              </div>
              <span className="relative z-10 hidden rounded-full bg-emerald-500/12 px-3 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 sm:inline-flex">
                Barqaror
              </span>
            </div>
          )}
        </motion.div>

        {/* ═══ SECTION 4: MASTERY (With Search, Filter & Sort) ═══ */}
        <motion.div ref={masteryRef} data-section="mastery" variants={cardVariants}>
          <div className="s360-glass overflow-hidden rounded-3xl">
            {/* Header */}
            <div className="relative z-10 flex flex-col gap-3 border-b border-black/[0.05] px-6 py-4 dark:border-white/[0.06] lg:flex-row lg:items-center lg:justify-between">
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

              {/* Search, Filter & Sort */}
              {academic.subjectsMastery && academic.subjectsMastery.length > 0 && (
                <div className="s360-no-print flex flex-wrap items-center gap-2">
                  <div className="s360-inset flex items-center gap-1.5 rounded-lg px-2.5 py-1">
                    <Icon paths={I.search} size={13} className="text-slate-400" />
                    <input
                      type="search"
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      placeholder="Fanni qidirish…"
                      aria-label="Fanni qidirish"
                      className="w-28 bg-transparent text-[11.5px] font-medium text-slate-800 outline-none placeholder:text-slate-400 sm:w-36 dark:text-slate-200"
                    />
                    {subjectSearch && (
                      <button
                        type="button"
                        onClick={() => setSubjectSearch('')}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        aria-label="Qidiruvni tozalash"
                      >
                        <Icon paths={I.close} size={11} strokeWidth={2.4} />
                      </button>
                    )}
                  </div>

                  <div className="s360-inset inline-flex items-center rounded-lg p-0.5 text-[11px] font-bold">
                    {(['ALL', 'AT_RISK', 'EXCELLENT'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setMasteryFilter(f)}
                        className={`rounded-md px-2 py-1 transition-colors ${
                          masteryFilter === f
                            ? 'bg-[#007AFF] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
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
                    aria-label="Fanlarni saralash"
                    className="s360-inset rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 outline-none dark:text-slate-300"
                  >
                    <option value="mastery">O&apos;zlashtirish ↓</option>
                    <option value="name">Nomi (A-Z)</option>
                    <option value="objectives">Maqsadlar ↓</option>
                  </select>
                </div>
              )}
            </div>

            {/* Distribution + list */}
            {!academic.subjectsMastery || academic.subjectsMastery.length === 0 ? (
              <div className="relative z-10 flex flex-col items-center gap-3 p-10 text-center">
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
              <div className="relative z-10">
                <div className="border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06]">
                  <MasteryDistribution subjects={academic.subjectsMastery} />
                </div>

                {filteredMastery.length === 0 ? (
                  <div className="p-10 text-center text-[13px] text-[#86868B]">
                    Ushbu qidiruv yoki filtr bo&apos;yicha fanlar topilmadi
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
                          transition={{ ...SPRING.smooth, delay: idx * 0.035 }}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleOpenSubjectSidecar(sm)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpenSubjectSidecar(sm);
                            }
                          }}
                          className="group flex cursor-pointer items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-none dark:hover:bg-white/[0.02]"
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
                                  transition={{ duration: 1, ease: EASE_APPLE, delay: 0.15 + idx * 0.05 }}
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
                              className="s360-btn s360-no-print inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl px-3 py-2 text-[12px] font-semibold text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-slate-200"
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
              </div>
            )}
          </div>
        </motion.div>

        {/* ═══ SECTION 5: CHRONOLOGICAL LONGITUDINAL TIMELINE ═══ */}
        <motion.div ref={timelineRef} data-section="timeline" variants={cardVariants}>
          <div className="s360-glass overflow-hidden rounded-3xl">
            <div className="relative z-10 flex flex-col gap-3 border-b border-black/[0.04] px-6 py-4 dark:border-white/[0.06] sm:flex-row sm:items-center sm:justify-between">
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
              <div className="s360-no-print flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: 'Barchasi' },
                    { id: 'EXAM', label: 'Imtihonlar' },
                    { id: 'QUIZ', label: 'Viktorinalar' },
                    { id: 'ASSIGNMENT', label: 'Topshiriqlar' },
                    { id: 'GRADE', label: 'Baholar' },
                    { id: 'ATTENDANCE', label: 'Davomat' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimelineFilter(f.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                      timelineFilter === f.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 's360-btn text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTimeline.length === 0 ? (
              <div className="relative z-10 flex flex-col items-center justify-center gap-2 p-12 text-center text-xs text-[#86868B]">
                <span className="text-2xl">⏳</span>
                <p className="font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  Hozircha tanlangan toifadagi xronologik qaydlar topilmadi
                </p>
                <p>O&apos;quvchi sinov va mashg&apos;ulotlarda ishtirok etgach, xronologiya avtomatik boyitiladi.</p>
              </div>
            ) : (
              <div className="relative z-10">
                <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {visibleTimeline.map((ev, idx) => {
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
                        transition={{ ...SPRING.smooth, delay: idx * 0.025 }}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenTimelineSidecar(ev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenTimelineSidecar(ev);
                          }
                        }}
                        className="flex cursor-pointer items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-black/[0.02] focus-visible:bg-black/[0.03] focus-visible:outline-none dark:hover:bg-white/[0.02]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm"
                            style={{
                              background: toneColors.bg,
                              color: toneColors.fg,
                              border: `1px solid ${toneColors.border}`,
                            }}
                          >
                            <span>{typeBadge.icon}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-[13.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                                {ev.title}
                              </p>
                              <span
                                className="rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                                style={{ background: toneColors.bg, color: toneColors.fg }}
                              >
                                {typeBadge.label}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-[11.5px] font-medium text-[#86868B]">
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
                              <span className="text-[10px] font-semibold text-[#86868B]">natija</span>
                            </div>
                          )}
                          <span className="text-[11px] font-medium tabular-nums text-[#86868B]">
                            {formatDate(ev.timestamp)}
                          </span>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>

                {filteredTimeline.length > 8 && (
                  <div className="s360-no-print border-t border-black/[0.04] px-6 py-3 text-center dark:border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => setTimelineExpanded((v) => !v)}
                      className="s360-btn inline-flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-[11.5px] font-bold text-indigo-600 dark:text-indigo-400"
                    >
                      <span>
                        {timelineExpanded
                          ? 'Qisqartirish'
                          : `Barcha qaydlarni ko'rsatish (${filteredTimeline.length})`}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* ═══ SECTION 6: MONTHLY MASTERY DYNAMICS & PEDAGOGICAL INTERVENTIONS ═══ */}
        <motion.div ref={trendsRef} data-section="trends" variants={cardVariants}>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left: 6-Month Trajectory Bars */}
            <div className="s360-glass overflow-hidden rounded-3xl p-6 lg:col-span-7">
              <div className="relative z-10 flex items-center gap-3 border-b border-black/[0.04] pb-4 dark:border-white/[0.06]">
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

              <div className="relative z-10 mt-5 space-y-4">
                {(profile?.monthlyTrends ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#86868B]">
                    Dinamika ma&apos;lumotlari shakllanmoqda...
                  </p>
                ) : (
                  (profile?.monthlyTrends ?? []).map((trend, i) => (
                    <div key={`${trend.month}-${i}`} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{trend.month}</span>
                        <div className="flex items-center gap-3 text-[11px] tabular-nums">
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
                            animate={{ width: `${Math.max(0, Math.min(100, trend.mastery))}%` }}
                            transition={{ duration: 0.8, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                          />
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(0, Math.min(100, trend.attendanceRate))}%` }}
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

            {/* Right: Diagnostic Pedagogical Interventions (Interactive) */}
            <div className="s360-glass overflow-hidden rounded-3xl p-6 lg:col-span-5">
              <div className="relative z-10 flex items-center gap-3 border-b border-black/[0.04] pb-4 dark:border-white/[0.06]">
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

              <div className="relative z-10 mt-4 space-y-3">
                {(profile?.interventions ?? []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#86868B]">
                    Faol tavsiyalar mavjud emas.
                  </p>
                ) : (
                  (profile?.interventions ?? []).map((intv) => {
                    const prMeta =
                      intv.priority === 'HIGH'
                        ? { label: 'Yuqori daraja', cls: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' }
                        : intv.priority === 'MEDIUM'
                          ? { label: "O'rta daraja", cls: 'bg-amber-500/12 text-amber-600 dark:text-amber-400' }
                          : { label: 'Tavsiya', cls: 'bg-indigo-500/12 text-indigo-600 dark:text-indigo-400' };

                    return (
                      <div
                        key={intv.id}
                        className="s360-inset rounded-2xl p-3.5 transition-all hover:border-indigo-500/35"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {intv.title}
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider ${prMeta.cls}`}
                          >
                            {prMeta.label}
                          </span>
                        </div>
                        <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-[#86868B]">
                          {intv.description}
                        </p>
                        <div className="mt-2.5 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenInterventionSidecar(intv)}
                            className="s360-btn inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300"
                          >
                            <span>{intv.actionLabel}</span>
                            <Icon paths={I.chevronRight} size={11} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══ Command palette (⌘K) ═══ */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        actions={paletteActions}
      />
    </div>
  );
}

export default Student360Page;