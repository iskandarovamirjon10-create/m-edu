/**
 * M-EDU LeadsPage —  & Liquid Glass CRM Edition 
 *
 * Module Features:
 *  - 100% Backend API, Query Keys, URL SearchParams & Trial Funnel compatibility preserved
 *  - Dual View Engine: Seamless Animated List View & 5-Stage Kanban Pipeline Board
 *  - Multi-segment Live CRM Pipeline Telemetry Bar (iOS Storage style)
 *  - Interactive KPI Cards (click any KPI card to filter pipeline stage)
 *  - 1-Click Copy-to-Clipboard for Phone & Email with haptic sound + toast feedback
 *  - Pure SVG vector geometry (zero raw emojis/unicode hacks, zero `any` types)
 *  - Upgraded Modals: Squircle FieldIcons, Quick Source Preset Chips, iOS Segmented Stage & Attendance Cards
 *  - Parallelized Bulk Operations (Promise.allSettled) + Master Select-All Toggle
 */

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, LayoutGroup, type Variants } from 'framer-motion';
import { leadsApi } from '@/lib/api';
import { openQuickLook, openSidecar } from '@/stores/ui.store';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  GlassErrorState,
  GlassEmptyState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  ConfirmDialog,
  GlassButton,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type { Paginated, Lead, LeadStage } from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { queryKeys } from '@/lib/query-keys.factory';
import { AuroraMesh } from '@/components/ui/AuroraMesh';

/* ============================================================================
 * APPLE SPRING PHYSICS & MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.85 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  liquid: { type: 'spring', stiffness: 400, damping: 35, mass: 0.8 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(4px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: SPRING.smooth,
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.995 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING.smooth,
  },
};

/* ============================================================================
 * SVG VECTOR ICON SYSTEM
 * ========================================================================== */

const ICON_STROKE = 1.85;

const I: Record<string, string[]> = {
  target: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  sparkles: [
    'M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9L12 3z',
    'M19 3v3',
    'M20.5 4.5h-3',
    'M5 17.5v2.5',
    'M6.25 18.75h-2.5',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M20 6.5 9 17.5l-5-5'],
  checkCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M8.5 12.5l2.5 2.5 5-5.5',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  filter: ['M21 4H3l7.2 8.6v5.9l3.6 1.8v-7.7L21 4z'],
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  mail: [
    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z',
    'M22 6l-10 7L2 6',
  ],
  calendar: [
    'M8 2v3.5',
    'M16 2v3.5',
    'M3.5 9.5h17',
    'M18.5 4h-13A2.5 2.5 0 0 0 3 6.5v12A2.5 2.5 0 0 0 5.5 21h13a2.5 2.5 0 0 0 2.5-2.5v-12A2.5 2.5 0 0 0 18.5 4z',
  ],
  eye: [
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  edit: [
    'M11 4H4.5A2.5 2.5 0 0 0 2 6.5v13A2.5 2.5 0 0 0 4.5 22h13a2.5 2.5 0 0 0 2.5-2.5V13',
    'M18.4 2.6a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.4-9.4z',
  ],
  trash: [
    'M3 6h18',
    'M19 6v13.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 19.5V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  sidebarRight: [
    'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    'M15 3v18',
  ],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 8v6',
    'M23 11h-6',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1.5a7.5 7.5 0 0 0-16 0V21',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  note: [
    'M14 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h11a2.5 2.5 0 0 0 2.5-2.5V8L14 2z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h5',
  ],
  book: [
    'M12 6.5v14',
    'M3 18a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1V17a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3H3z',
  ],
  compass: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
  ],
  trophy: [
    'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
    'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
    'M4 22h16',
    'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
    'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
    'M18 2H6v7a6 6 0 0 0 12 0V2z',
  ],
  list: [
    'M8 6h13',
    'M8 12h13',
    'M8 18h13',
    'M3.5 6h.01',
    'M3.5 12h.01',
    'M3.5 18h.01',
  ],
  kanban: [
    'M4 4h4v16H4z',
    'M10 4h4v11h-4z',
    'M16 4h4v14h-4z',
  ],
  refresh: [
    'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8',
    'M3 3v5h5',
    'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16',
    'M16 16h5v5',
  ],
  download: [
    'M12 3v12',
    'M7 11l5 5 5-5',
    'M4 20h16',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  chevronLeft: ['M15 18l-6-6 6-6'],
  chevronRight: ['M9 18l6-6-6-6'],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
};

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
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
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * APPLE LIQUID GLASS COLOR TOKENS & STAGE DESIGN SYSTEM
 * ========================================================================== */

type Tone = 'blue' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'purple' | 'cyan' | 'gray';

const TONES: Record<
  Tone,
  { fg: string; bg: string; glow: string; border: string; gradient: string }
> = {
  blue: {
    fg: '#007AFF',
    bg: 'rgba(0, 122, 255, 0.11)',
    glow: 'rgba(0, 122, 255, 0.30)',
    border: 'rgba(0, 122, 255, 0.24)',
    gradient: 'linear-gradient(135deg, #007AFF 0%, #2563EB 100%)',
  },
  indigo: {
    fg: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.11)',
    glow: 'rgba(99, 102, 241, 0.30)',
    border: 'rgba(99, 102, 241, 0.24)',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
  },
  amber: {
    fg: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.12)',
    glow: 'rgba(245, 158, 11, 0.30)',
    border: 'rgba(245, 158, 11, 0.25)',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  },
  emerald: {
    fg: '#10B981',
    bg: 'rgba(16, 185, 129, 0.11)',
    glow: 'rgba(16, 185, 129, 0.30)',
    border: 'rgba(16, 185, 129, 0.24)',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  rose: {
    fg: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.11)',
    glow: 'rgba(239, 68, 68, 0.30)',
    border: 'rgba(239, 68, 68, 0.24)',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #E11D48 100%)',
  },
  purple: {
    fg: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.11)',
    glow: 'rgba(139, 92, 246, 0.30)',
    border: 'rgba(139, 92, 246, 0.24)',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
  },
  cyan: {
    fg: '#0284C7',
    bg: 'rgba(2, 132, 199, 0.11)',
    glow: 'rgba(2, 132, 199, 0.30)',
    border: 'rgba(2, 132, 199, 0.24)',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)',
  },
  gray: {
    fg: '#64748B',
    bg: 'rgba(100, 116, 139, 0.11)',
    glow: 'rgba(100, 116, 139, 0.22)',
    border: 'rgba(100, 116, 139, 0.22)',
    gradient: 'linear-gradient(135deg, #64748B 0%, #475569 100%)',
  },
};

const LEAD_STAGES: LeadStage[] = ['NEW', 'CONTACTED', 'TRIAL_LESSON', 'WON', 'LOST'];

const STAGE_TONE: Record<LeadStage, Tone> = {
  NEW: 'blue',
  CONTACTED: 'indigo',
  TRIAL_LESSON: 'amber',
  WON: 'emerald',
  LOST: 'rose',
};

const STAGE_ICON: Record<LeadStage, string[]> = {
  NEW: I.sparkles,
  CONTACTED: I.phone,
  TRIAL_LESSON: I.calendar,
  WON: I.trophy,
  LOST: I.xCircle,
};

const STAGE_CONFIG: Record<
  LeadStage,
  { bg: string; text: string; ring: string; dot: string; hex: string }
> = {
  NEW: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-500/25',
    dot: 'bg-sky-500',
    hex: '#0EA5E9',
  },
  CONTACTED: {
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-500/25',
    dot: 'bg-indigo-500',
    hex: '#6366F1',
  },
  TRIAL_LESSON: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/25',
    dot: 'bg-amber-500',
    hex: '#F59E0B',
  },
  WON: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/25',
    dot: 'bg-emerald-500',
    hex: '#10B981',
  },
  LOST: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-500/25',
    dot: 'bg-rose-500',
    hex: '#F43F5E',
  },
};

const QUICK_SOURCES = ['Instagram', 'Telegram', 'Tavsiya', 'Web-sayt', 'Walk-in'];

function stageKey(stage: string): string {
  return `leads.stage.${stage}`;
}

const AVATAR_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#5856D6', '#AF52DE'],
  ['#10B981', '#0284C7'],
  ['#F59E0B', '#EF4444'],
  ['#6366F1', '#4F46E5'],
  ['#0EA5E9', '#2563EB'],
  ['#14B8A6', '#059669'],
  ['#EC4899', '#8B5CF6'],
];

function getAvatarGradientStyle(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const [a, b] = AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

function formatLeadName(lead: Lead): string {
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || '—';
}

function getInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'L'
  );
}

/* ============================================================================
 * TYPES & INITIAL STATES
 * ========================================================================== */

interface LeadFilters {
  page: number;
  limit: number;
  stage?: LeadStage;
  search?: string;
}

interface LeadFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  source: string;
  stage: LeadStage;
  notes: string;
}

interface TrialSchedulePayload {
  trialDate: string;
  subject: string;
  teacherName: string;
  notes: string;
}

interface TrialAttendancePayload {
  attended: boolean;
  feedback: string;
  nextAction: string;
}

interface TrialAnalyticsData {
  totalTrialScheduled: number;
  attended: number;
  convertedWon: number;
  conversionRate: number;
  pendingAttendance: number;
}

const INITIAL_FORM: LeadFormState = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  source: '',
  stage: 'NEW',
  notes: '',
};

/* ============================================================================
 * LIQUID GLASS SUB-COMPONENTS
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-slate-200/60 dark:bg-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function LeadSkeletonRow() {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-black/[0.05] bg-white/60 p-4 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex items-center gap-3.5">
        <Shimmer className="h-5 w-5" radius="0.375rem" />
        <Shimmer className="h-11 w-11" radius="1rem" />
        <div className="space-y-2">
          <Shimmer className="h-4 w-36" radius="0.375rem" />
          <Shimmer className="h-3 w-28" radius="0.375rem" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Shimmer className="h-8 w-24" radius="0.75rem" />
        <Shimmer className="h-9 w-20" radius="0.75rem" />
      </div>
    </div>
  );
}

function CountUp({
  value,
  duration = 0.95,
  suffix = '',
}: {
  value: number;
  duration?: number;
  suffix?: string;
}) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
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
  }, [value, duration]);

  return (
    <span className="tabular-nums">
      {Math.round(n).toLocaleString('uz-UZ')}
      {suffix}
    </span>
  );
}

/** Squircle leading icon for inputs */
function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
      aria-hidden="true"
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
}

/** Apple Liquid Glass KPI Card */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  suffix = '',
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
  suffix?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={SPRING.smooth}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group relative flex items-center gap-3.5 overflow-hidden rounded-2xl border p-3.5 backdrop-blur-xl transition-all ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${
        active
          ? 'bg-white/95 dark:bg-surface-900/95 ring-2'
          : 'border-slate-200/80 bg-slate-50/60 hover:bg-white/90 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:bg-white/[0.05]'
      }`}
      style={
        active
          ? {
              borderColor: c.fg,
              boxShadow: `0 10px 26px -10px ${c.glow}, inset 0 1px 0 rgba(255,255,255,0.6)`,
            }
          : undefined
      }
    >
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105"
        style={{
          background: active ? c.gradient : c.bg,
          color: active ? '#FFFFFF' : c.fg,
          border: `1px solid ${active ? 'transparent' : c.border}`,
          boxShadow: active ? `0 6px 14px -4px ${c.glow}` : 'inset 0 1px 0 rgba(255,255,255,0.45)',
        }}
      >
        <Icon paths={icon} size={18} strokeWidth={2.1} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-slate-900 dark:text-slate-100">
          <CountUp value={value} suffix={suffix} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** iOS Storage-style Live CRM Pipeline Telemetry Bar */
function PipelineTelemetryBar({
  leads,
  activeStage,
  onSelectStage,
  t,
}: {
  leads: Lead[];
  activeStage: string;
  onSelectStage: (st: string) => void;
  t: (k: string) => string;
}) {
  const counts = useMemo(() => {
    const map: Record<LeadStage, number> = {
      NEW: 0,
      CONTACTED: 0,
      TRIAL_LESSON: 0,
      WON: 0,
      LOST: 0,
    };
    leads.forEach((l) => {
      if (map[l.stage] !== undefined) map[l.stage]++;
    });
    return map;
  }, [leads]);

  const total = leads.length;
  if (total === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          CRM Pipeline Telemetry · {total}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {LEAD_STAGES.map((st) => {
            const count = counts[st];
            const isSelected = activeStage === st;
            const cfg = STAGE_CONFIG[st];
            return (
              <button
                key={st}
                type="button"
                onClick={() => onSelectStage(isSelected ? '' : st)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all ${
                  isSelected
                    ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`
                    : 'text-slate-600 hover:bg-black/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                <span>{t(stageKey(st))}:</span>
                <span className="font-bold tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/[0.07] p-0.5 gap-0.5">
        {LEAD_STAGES.filter((st) => counts[st] > 0).map((st) => {
          const pct = Math.max(3, (counts[st] / total) * 100);
          return (
            <motion.div
              key={st}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={SPRING.liquid}
              onClick={() => onSelectStage(activeStage === st ? '' : st)}
              className="h-full cursor-pointer first:rounded-l-full last:rounded-r-full transition-opacity hover:opacity-85"
              style={{
                background: STAGE_CONFIG[st].hex,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
              title={`${t(stageKey(st))}: ${counts[st]} (${Math.round(pct)}%)`}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Tone-aware  Stage Segmented Control (used inside Create/Edit Modal) */
function StageSegmented({
  value,
  onChange,
  t,
}: {
  value: LeadStage;
  onChange: (s: LeadStage) => void;
  t: (k: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={t('leads.col.stage') || 'Bosqich'}
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {LEAD_STAGES.map((st) => {
        const active = value === st;
        const c = TONES[STAGE_TONE[st]];
        return (
          <motion.button
            key={st}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(st)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="relative flex flex-col items-center gap-1.5 rounded-2xl border px-2.5 py-2.5 text-[11px] font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
            style={{
              borderColor: active ? c.fg : 'rgba(148,163,184,0.18)',
              background: active ? c.bg : 'rgba(255,255,255,0.35)',
              color: active ? c.fg : '#64748B',
              boxShadow: active
                ? `inset 0 1px 0 rgba(255,255,255,0.65), 0 8px 18px -8px ${c.glow}`
                : 'inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <span
              className="flex h-6 w-6 items-center justify-center rounded-lg"
              style={{
                background: active ? c.gradient : 'rgba(100,116,139,0.08)',
                color: active ? '#FFFFFF' : '#64748B',
              }}
            >
              <Icon paths={STAGE_ICON[st]} size={13} strokeWidth={2.2} />
            </span>
            <span className="truncate max-w-full uppercase tracking-[0.06em]">
              {t(stageKey(st))}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE COMPONENT
 * ========================================================================== */

export function LeadsPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('leads.title') || 'Leads');
  const sound = usePremiumSound();
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  /* ── Filter & View State ──────────────────────────────────────────── */
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState(
    () => searchParams.get('search') || searchParams.get('q') || '',
  );
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const debouncedSearch = useDebounce(search, 300);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /* ── Global `/` Shortcut to Focus Search ──────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (!isInput && e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ── Modal States ─────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [trialTarget, setTrialTarget] = useState<Lead | null>(null);
  const [trialForm, setTrialForm] = useState<TrialSchedulePayload>({
    trialDate: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    subject: 'General English / Matematika',
    teacherName: '',
    notes: 'Bepul sinov darsi belgilandi',
  });

  const [attendanceTarget, setAttendanceTarget] = useState<Lead | null>(null);
  const [attendanceForm, setAttendanceForm] = useState<TrialAttendancePayload>({
    attended: true,
    feedback: "O'quvchiga dars yoqdi, guruhga yozilishga tayyor",
    nextAction: "To'lov invoysini chiqarish",
  });

  /* ── Trial Analytics Query ────────────────────────────────────────── */
  const trialAnalytics = useQuery({
    queryKey: ['leads-trial-analytics'],
    queryFn: () => leadsApi.getTrialAnalytics() as Promise<TrialAnalyticsData>,
  });

  const scheduleTrialMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TrialSchedulePayload }) =>
      leadsApi.scheduleTrial(id, data),
    onSuccess: () => {
      sound.playPop();
      push('success', t('leads.trialScheduleSuccess'));
      setTrialTarget(null);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-trial-analytics'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  const markAttendanceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TrialAttendancePayload }) =>
      leadsApi.markTrialAttendance(id, data),
    onSuccess: () => {
      sound.playPop();
      push('success', t('leads.trialAttendanceSuccess'));
      setAttendanceTarget(null);
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-trial-analytics'] });
    },
    onError: (e: Error) => push('error', getErrorMessage(e)),
  });

  /* ── Form State ───────────────────────────────────────────────────── */
  const [form, setForm] = useState<LeadFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof LeadFormState, string>>>({});

  /* ── Build Query Params ───────────────────────────────────────────── */
  const params = useMemo<LeadFilters>(
    () => ({
      page,
      limit: 20,
      stage: (stage as LeadStage) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, stage, debouncedSearch],
  );

  /* ── Leads Query ──────────────────────────────────────────────────── */
  const leads = useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const data = leads.data as Paginated<Lead> | undefined;
  const leadList = useMemo(() => data?.items || [], [data]);
  const totalLeads = data?.total || 0;

  /* ── Derived KPIs ─────────────────────────────────────────────────── */
  const wonCount = useMemo(() => leadList.filter((l) => l.stage === 'WON').length, [leadList]);
  const newCount = useMemo(() => leadList.filter((l) => l.stage === 'NEW').length, [leadList]);
  const activeFunnelCount = useMemo(
    () => leadList.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length,
    [leadList],
  );

  /* ── Mutations ────────────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () => {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        source: form.source.trim() || undefined,
        notes: form.notes.trim() || undefined,
        stage: form.stage,
      };
      return editingId ? leadsApi.update(editingId, payload) : leadsApi.create(payload);
    },
    onSuccess: () => {
      sound.playPop();
      push(
        'success',
        editingId ? t('leads.updated') || 'Lead updated' : t('leads.created') || 'Lead created',
      );
      setModalOpen(false);
      setEditingId(null);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => leadsApi.remove(id),
    onSuccess: () => {
      push('success', t('leads.deleted') || 'Lead deleted');
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const updateStage = useMutation({
    mutationFn: ({ id, stage: nextStage }: { id: string; stage: LeadStage }) =>
      leadsApi.updateStage(id, nextStage),
    onSuccess: () => {
      sound.playPop();
      push('success', t('leads.stageUpdated') || 'Stage updated');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['leads-trial-analytics'] });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  const convert = useMutation({
    mutationFn: (id: string) => leadsApi.convert(id, {}),
    onSuccess: () => {
      sound.playPop();
      push('success', t('leads.converted') || 'Lead converted to student');
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
      qc.invalidateQueries({ queryKey: queryKeys.students.selectors() });
      qc.invalidateQueries({ queryKey: queryKeys.students.faces() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  /* ── Form Validation ──────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof LeadFormState, string>> = {};

    if (!form.firstName.trim()) {
      errors.firstName = t('leads.form.firstNameRequired') || 'First name is required';
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = t('leads.form.emailInvalid') || 'Invalid email format';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form, t]);

  /* ── Event Handlers ───────────────────────────────────────────────── */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleStageFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setStage(e.target.value);
    setPage(1);
  }, []);

  const handleResetFilters = useCallback(() => {
    sound.playPop();
    setStage('');
    setSearch('');
    setPage(1);
  }, [sound]);

  const handleUpdateStage = useCallback(
    (leadId: string, newStage: LeadStage) => {
      updateStage.mutate({ id: leadId, stage: newStage });
    },
    [updateStage],
  );

  const handleCopyText = useCallback(
    (text: string, label: string) => {
      if (!text) return;
      void navigator.clipboard?.writeText(text);
      sound.playTick();
      push('success', `${label} nusxalandi: ${text}`);
    },
    [sound, push],
  );

  const handleConvert = useCallback((leadId: string) => {
    setConvertTarget(leadId);
  }, []);

  const handleEdit = useCallback((lead: Lead) => {
    setEditingId(lead.id);
    setForm({
      firstName: lead.firstName,
      lastName: lead.lastName || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      stage: lead.stage,
      notes: lead.notes || '',
    });
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const handleOpenLeadSidecar = useCallback(
    (lead: Lead) => {
      sound.playTick();
      const fullNameStr = formatLeadName(lead);
      const stageName = t(stageKey(lead.stage));

      openSidecar({
        id: lead.id,
        type: 'lead',
        title: fullNameStr,
        subtitle: lead.source ? `Manba: ${lead.source}` : 'CRM Lid',
        badge: {
          text: stageName,
          tone:
            lead.stage === 'WON'
              ? 'emerald'
              : lead.stage === 'LOST'
              ? 'rose'
              : lead.stage === 'TRIAL_LESSON'
              ? 'purple'
              : 'blue',
        },
        avatar: {
          text: getInitials(fullNameStr),
          color: lead.stage === 'WON' ? '#10B981' : '#6366F1',
        },
        metrics: [
          {
            label: 'Bosqich',
            value: stageName,
            subtext: `Yaratilgan: ${formatDate(lead.createdAt)}`,
          },
          {
            label: 'Manba',
            value: lead.source || "To'g'ridan-to'g'ri",
            subtext: 'Kanal',
          },
          {
            label: 'Aloqa',
            value: lead.phone || '—',
            subtext: lead.email || "Email yo'q",
          },
        ],
        details: [
          { label: 'Telefon', value: lead.phone || '—', copyable: true },
          { label: 'Email', value: lead.email || '—', copyable: true },
          { label: 'Manba', value: lead.source || '—' },
          { label: 'Qaydlar', value: lead.notes || "Izoh yo'q" },
          { label: 'Sana', value: formatDate(lead.createdAt) },
          { label: 'Lid ID', value: lead.id, copyable: true },
        ],
        tags: lead.source ? [lead.source, stageName] : [stageName],
        primaryAction: {
          label: 'Tahrirlash',
          onExecute: () => handleEdit(lead),
        },
        secondaryAction:
          lead.stage !== 'WON' && lead.stage !== 'LOST'
            ? {
                label: 'Talabaga aylantirish',
                onExecute: () => handleConvert(lead.id),
              }
            : undefined,
      });
    },
    [sound, t, handleEdit, handleConvert],
  );

  const handleQuickLook = useCallback(
    (lead: Lead) => {
      const fullNameStr = formatLeadName(lead);
      const stageName = t(stageKey(lead.stage));

      openQuickLook({
        id: lead.id,
        type: 'lead',
        title: fullNameStr,
        subtitle: lead.source ? `Manba: ${lead.source}` : 'CRM Lid',
        badge: {
          text: stageName,
          tone:
            lead.stage === 'WON'
              ? 'emerald'
              : lead.stage === 'LOST'
              ? 'rose'
              : lead.stage === 'TRIAL_LESSON'
              ? 'purple'
              : 'blue',
        },
        avatar: {
          text: getInitials(fullNameStr),
        },
        metrics: [
          {
            label: 'Bosqich',
            value: stageName,
            subtext: `Yaratilgan: ${formatDate(lead.createdAt)}`,
          },
          {
            label: 'Manba',
            value: lead.source || "To'g'ridan-to'g'ri",
            subtext: 'Kanal',
          },
          {
            label: 'Aloqa',
            value: lead.phone || '—',
            subtext: lead.email || "Email yo'q",
          },
        ],
        details: [
          { label: 'Telefon', value: lead.phone || '—' },
          { label: 'Email', value: lead.email || '—' },
          { label: 'Manba', value: lead.source || '—' },
          { label: 'Qaydlar', value: lead.notes || "Izoh yo'q" },
          { label: 'Sana', value: formatDate(lead.createdAt) },
          { label: 'Lid ID', value: lead.id },
        ],
        tags: lead.source ? [lead.source, stageName] : [stageName],
        primaryAction: {
          label: 'Tahrirlash',
          onExecute: () => handleEdit(lead),
        },
        secondaryAction:
          lead.stage !== 'WON' && lead.stage !== 'LOST'
            ? {
                label: 'Talabaga aylantirish',
                onExecute: () => handleConvert(lead.id),
              }
            : undefined,
      });
    },
    [t, handleEdit, handleConvert],
  );

  const handleDelete = useCallback((id: string) => {
    setDeleteTarget(id);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget);
    setDeleteTarget(null);
  }, [deleteTarget, remove]);

  const confirmConvert = useCallback(() => {
    if (!convertTarget) return;
    convert.mutate(convertTarget);
    setConvertTarget(null);
  }, [convertTarget, convert]);

  /* ── Fast Keyboard-First Navigation ─────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Lead>({
    items: leadList,
    getItemId: (l) => l.id,
    rowIdPrefix: 'lead-row-',
    onSelect: (l) => handleEdit(l),
    onQuickLook: (l) => handleOpenLeadSidecar(l),
    onEdit: (l) => handleEdit(l),
  });

  const allVisibleSelected =
    leadList.length > 0 && leadList.every((item) => isSelected(item.id));

  const handleToggleSelectAllVisible = useCallback(() => {
    sound.playTick();
    if (allVisibleSelected) {
      clearSelection();
    } else {
      leadList.forEach((item) => {
        if (!isSelected(item.id)) toggleSelection(item.id);
      });
    }
  }, [allVisibleSelected, clearSelection, leadList, isSelected, toggleSelection, sound]);

  /* ── Parallelized Bulk Actions ────────────────────────────────────── */
  const handleBatchMarkAsWon = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(
      ids.map((id) => leadsApi.update(id, { stage: 'WON' })),
    );
    const count = results.filter((r) => r.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: queryKeys.leads.all() });
    qc.invalidateQueries({ queryKey: ['leads'] });
    clearSelection();
    push('success', t('leads.batchWonSuccess', { count }));
  };

  const handleExportCSV = useCallback(
    (rows: Lead[]) => {
      if (rows.length === 0) return;
      const headers = ['ID', 'Name', 'Phone', 'Email', 'Stage', 'Source', 'Notes'];
      const dataRows = rows.map((l) => [
        l.id,
        formatLeadName(l),
        l.phone || '',
        l.email || '',
        l.stage || '',
        l.source || '',
        l.notes || '',
      ]);
      const csvContent =
        '\uFEFF' +
        [
          headers.join(','),
          ...dataRows.map((r) =>
            r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
          ),
        ].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      push('success', t('leads.exportSuccess', { count: rows.length }));
    },
    [push, t],
  );

  const handleExportSelectedLeadsCSV = () => {
    const selectedRows = leadList.filter((l) => isSelected(l.id));
    handleExportCSV(selectedRows);
    clearSelection();
  };

  const handleBatchDeleteLeads = async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => leadsApi.remove(id)));
    const count = results.filter((r) => r.status === 'fulfilled').length;
    qc.invalidateQueries({ queryKey: queryKeys.leads.all() });
    qc.invalidateQueries({ queryKey: ['leads'] });
    clearSelection();
    push('success', t('leads.batchDeleteSuccess', { count }));
  };

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const hasActiveFilters = Boolean(stage || search);

  /* ============================================================================
   * RENDER
   * ========================================================================== */
  return (
    <motion.main
      className="relative mx-auto max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] space-y-5 px-4 pb-[max(6rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:px-8"
      aria-label="CRM Leads"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />
      {/* ── 1. Apple Liquid Glass Hero Header & Live KPI Strip ──────────── */}
      <motion.section
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white/80 p-5 sm:p-7 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
      >
        {/* Top Specular Highlight & Ambient Mesh */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/15 z-10" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-500/15"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl dark:bg-indigo-500/10"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start sm:items-center gap-4">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -3 }}
              transition={SPRING.smooth}
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ring-1 ring-black/5 dark:ring-white/15"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                boxShadow:
                  '0 12px 28px -8px rgba(0, 122, 255, 0.55), inset 0 1px 0 rgba(255,255,255,0.45)',
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.42), transparent 55%)',
                }}
              />
              <Icon paths={I.target} size={27} strokeWidth={2.1} className="relative" />
            </motion.div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-400">
                  <Icon paths={I.sparkles} size={10} strokeWidth={2.5} />
                  CRM Pipeline
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {wonCount} Won
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tighter text-slate-900 dark:text-slate-100 sm:text-3xl">
                {t('leads.title') || 'Leads & CRM'}
              </h1>
              <p className="mt-0.5 text-[13px] font-medium text-slate-500 dark:text-slate-400">
                {t('leads.pageSubtitle') || 'Student recruitment pipeline and lead qualification'}
              </p>
            </div>
          </div>

          {/* Header Actions Cluster */}
          <div className="flex flex-wrap items-center gap-2.5">
            <motion.button
              type="button"
              onClick={() => {
                sound.playPop();
                void leads.refetch();
                void trialAnalytics.refetch();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING.snappy}
              title="Yangilash"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white/70 text-slate-600 hover:text-slate-900 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white transition-colors"
            >
              <Icon
                paths={I.refresh}
                size={16}
                strokeWidth={2.1}
                className={leads.isFetching ? 'animate-spin text-blue-500' : ''}
              />
            </motion.button>

            {leadList.length > 0 && (
              <motion.button
                type="button"
                onClick={() => handleExportCSV(leadList)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] bg-white/70 px-3.5 text-[12.5px] font-semibold text-slate-800 hover:bg-white dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08] transition-colors"
              >
                <Icon paths={I.download} size={14} strokeWidth={2.2} />
                <span className="hidden sm:inline">CSV</span>
              </motion.button>
            )}

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                type="button"
                variant="primary"
                onClick={handleOpenModal}
                className="rounded-xl px-4 py-2 font-semibold"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('leads.add') || "Yangi lid qo'shish"}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>

        {/* Interactive KPI Cards Strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-3.5 border-t border-slate-200/70 dark:border-white/[0.06] pt-5">
          <KpiTile
            label={t('leads.totalLeads') || 'Jami lidlar'}
            value={totalLeads}
            icon={I.users}
            tone="blue"
            active={stage === ''}
            onClick={() => {
              setStage('');
              setPage(1);
            }}
          />
          <KpiTile
            label={t('leads.activeFunnel') || 'Faol voronka'}
            value={activeFunnelCount}
            icon={I.compass}
            tone="indigo"
            active={stage === 'CONTACTED' || stage === 'TRIAL_LESSON'}
            onClick={() => {
              setStage((prev) => (prev === 'CONTACTED' ? '' : 'CONTACTED'));
              setPage(1);
            }}
          />
          <KpiTile
            label={t('leads.newToday') || 'Yangi lidlar'}
            value={newCount}
            icon={I.sparkles}
            tone="cyan"
            active={stage === 'NEW'}
            onClick={() => {
              setStage((prev) => (prev === 'NEW' ? '' : 'NEW'));
              setPage(1);
            }}
          />
          <KpiTile
            label={t('leads.wonConverted') || 'Muvaffaqiyatli (Won)'}
            value={wonCount}
            icon={I.trophy}
            tone="emerald"
            active={stage === 'WON'}
            onClick={() => {
              setStage((prev) => (prev === 'WON' ? '' : 'WON'));
              setPage(1);
            }}
          />
        </div>

        {/* Multi-segment CRM Pipeline Telemetry Bar */}
        <PipelineTelemetryBar
          leads={leadList}
          activeStage={stage}
          onSelectStage={(next) => {
            setStage(next);
            setPage(1);
          }}
          t={t}
        />

        {/* Live Trial Lesson Conversion Analytics */}
        {trialAnalytics.data && trialAnalytics.data.totalTrialScheduled > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300">
                  <Icon paths={I.target} size={13} strokeWidth={2.3} />
                </span>
                {t('leads.trialFunnelTitle')}
              </span>
              <span className="rounded-lg bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-100">
                {t('leads.conversionRateLabel', { rate: trialAnalytics.data.conversionRate })}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-amber-500/15 bg-white/70 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('leads.trialScheduled')}:
                </span>
                <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t('leads.trialUnit', { count: trialAnalytics.data.totalTrialScheduled })}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-white/70 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('leads.trialAttended')}:
                </span>
                <p className="mt-0.5 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {t('leads.trialUnit', { count: trialAnalytics.data.attended })}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-white/70 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('leads.trialConverted')}:
                </span>
                <p className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {t('leads.trialUnit', { count: trialAnalytics.data.convertedWon })}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-white/70 p-2.5 dark:bg-black/30">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('leads.trialPendingAttendance')}:
                </span>
                <p className="mt-0.5 text-sm font-bold text-amber-600 dark:text-amber-400">
                  {t('leads.trialUnit', { count: trialAnalytics.data.pendingAttendance })}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* ── 2. Filter, Search & View Switcher Toolbar ───────────────────── */}
      <motion.section
        variants={cardVariants}
        className="rounded-2xl border border-black/[0.06] bg-white/80 p-4 shadow-sm backdrop-blur-2xl dark:border-white/[0.08] dark:bg-surface-900/80 space-y-3"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:flex-1">
            {/* Search Input with Squircle Icon */}
            <div className="relative">
              <FieldIcon icon={I.search} tone="blue" />
              <GlassInput
                ref={searchInputRef}
                placeholder={
                  t('leads.searchPlaceholder') ||
                  "Ism, telefon yoki email bo'yicha qidiruv... (/)"
                }
                value={search}
                onChange={handleSearchChange}
                aria-label={t('leads.searchPlaceholder') || 'Qidiruv'}
                type="search"
                className="pl-11 pr-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600 dark:hover:bg-white/10"
                  aria-label="Qidiruvni tozalash"
                >
                  <Icon paths={I.x} size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>

            {/* Stage Filter Select with Squircle Icon */}
            <div className="relative">
              <FieldIcon icon={I.filter} tone="indigo" />
              <GlassSelect
                value={stage}
                onChange={handleStageFilterChange}
                aria-label={t('leads.filterHint') || "Bosqich bo'yicha filtr"}
                className="pl-11"
              >
                <option value="">{t('leads.allStages') || 'Barcha bosqichlar'}</option>
                {LEAD_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {t(stageKey(s))}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 sm:shrink-0 sm:pl-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {totalLeads === 1
                ? t('leads.foundCountOne')
                : t('leads.foundCount', { count: totalLeads })}
            </span>

            {/* Segmented View Switcher: List vs Kanban Board */}
            <LayoutGroup id="leads-view-switcher">
              <div className="inline-flex items-center rounded-xl bg-black/[0.04] p-0.5 dark:bg-white/[0.06]">
                {(['list', 'kanban'] as const).map((mode) => {
                  const active = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        active
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="leadsViewPill"
                          transition={SPRING.snappy}
                          className="absolute inset-0 rounded-lg bg-white shadow-xs dark:bg-surface-800"
                        />
                      )}
                      <Icon
                        paths={mode === 'list' ? I.list : I.kanban}
                        size={13}
                        strokeWidth={2.2}
                        className="relative z-10"
                      />
                      <span className="relative z-10 uppercase tracking-wider">
                        {mode === 'list' ? 'List' : 'Kanban'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
        </div>

        {/* Quick Stage Filter Chips & Master Select-All Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
          <div className="flex flex-wrap items-center gap-1.5">
            {leadList.length > 0 && (
              <button
                type="button"
                onClick={handleToggleSelectAllVisible}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  allVisibleSelected
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    : 'bg-black/[0.03] text-slate-600 hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-slate-400'
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                    allVisibleSelected
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-slate-400/60'
                  }`}
                >
                  {allVisibleSelected && <Icon paths={I.check} size={9} strokeWidth={3.5} />}
                </span>
                <span>
                  {selectedCount > 0 ? `${selectedCount} tanlandi` : 'Barchasini tanlash'}
                </span>
              </button>
            )}

            {LEAD_STAGES.map((st) => {
              const active = stage === st;
              const cfg = STAGE_CONFIG[st];
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setStage(active ? '' : st);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                    active
                      ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}`
                      : 'bg-black/[0.03] text-slate-500 hover:bg-black/[0.06] dark:bg-white/[0.04] dark:text-slate-400'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                  {t(stageKey(st))}
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400 transition-colors"
              >
                <Icon paths={I.x} size={11} strokeWidth={2.5} />
                Tozalash
              </button>
            )}
          </div>
        </div>
      </motion.section>

      {/* ── 3. Leads List OR Kanban Pipeline Board ──────────────────────── */}
      <section className="space-y-3">
        {leads.isLoading && !data ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((idx) => (
              <LeadSkeletonRow key={idx} />
            ))}
          </div>
        ) : leads.isError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center backdrop-blur-md">
            <GlassErrorState
              title={t('leads.loadFailed') || "Lidlarni yuklab bo'lmadi"}
              message={getErrorMessage(leads.error as Error)}
              onRetry={() => leads.refetch()}
            />
          </div>
        ) : leadList.length === 0 ? (
          <div className="rounded-3xl border border-black/[0.06] bg-white/80 p-12 text-center backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card">
            <GlassEmptyState
              title={
                hasActiveFilters
                  ? t('leads.noMatching') || 'Lidlar topilmadi'
                  : t('leads.noLeads') || 'Hozircha lidlar mavjud emas'
              }
              message={
                hasActiveFilters
                  ? t('common.adjustFilters') || "Filtrlarni o'zgartirib ko'ring"
                  : t('leads.addHint') || 'Yangi lid kiritish uchun tugmani bosing'
              }
            />
          </div>
        ) : viewMode === 'list' ? (
          /* ── APPLE LIQUID GLASS LIST VIEW ───────────────────────── */
          <motion.div
            className="space-y-2.5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {leadList.map((lead, idx) => {
              const fullNameStr = formatLeadName(lead);
              const initials = getInitials(fullNameStr);
              const stageStyle = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.NEW;
              const isUpdatingStage =
                updateStage.isPending && updateStage.variables?.id === lead.id;
              const isConverting = convert.isPending && convert.variables === lead.id;
              const isRowSelected = isSelected(lead.id);
              const isRowFocused = focusedIndex === idx;

              return (
                <motion.article
                  key={lead.id}
                  id={`lead-row-${lead.id}`}
                  variants={rowVariants}
                  tabIndex={0}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === ' ') {
                      e.preventDefault();
                      handleQuickLook(lead);
                    }
                  }}
                  className={`group relative flex flex-col gap-4 rounded-2xl border p-4 shadow-card transition-all duration-200 focus-visible:outline-none sm:flex-row sm:items-center sm:justify-between ${
                    isRowFocused
                      ? 'ring-2 ring-[#007AFF] bg-[#007AFF]/[0.06] border-[#007AFF]/40'
                      : isRowSelected
                      ? 'bg-[#007AFF]/[0.04] border-[#007AFF]/30'
                      : 'border-black/[0.06] bg-white/85 hover:bg-white backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 dark:hover:bg-surface-800/85'
                  }`}
                >
                  {/* Left: Checkbox + Glossy Avatar + Contact Metadata */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(lead.id);
                      }}
                      className="h-9 w-9 min-h-[44px] min-w-[44px] -m-2 inline-flex items-center justify-center shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                      aria-label={
                        isRowSelected
                          ? t('leads.deselectRowAria', { name: fullNameStr })
                          : t('leads.selectRowAria', { name: fullNameStr })
                      }
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                          isRowSelected
                            ? 'border-blue-500 bg-blue-500 text-white scale-105'
                            : 'border-zinc-300 bg-white/50 hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800/50'
                        }`}
                      >
                        {isRowSelected && <Icon paths={I.check} size={11} strokeWidth={3.5} />}
                      </span>
                    </button>

                    {/* Glossy Squircle Avatar */}
                    <div
                      onClick={() => handleOpenLeadSidecar(lead)}
                      className="relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm ring-2 ring-white/60 dark:ring-zinc-800 transition-transform duration-200 group-hover:scale-105"
                      style={{
                        background: getAvatarGradientStyle(fullNameStr),
                        boxShadow:
                          'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 12px -4px rgba(0,0,0,0.28)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-2xl"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(255,255,255,0.38), transparent 55%)',
                        }}
                      />
                      <span className="relative">{initials}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          onClick={() => handleOpenLeadSidecar(lead)}
                          className="cursor-pointer truncate font-bold text-zinc-900 hover:text-blue-600 dark:text-zinc-50 dark:hover:text-blue-400 transition-colors"
                        >
                          {fullNameStr}
                        </h3>
                        {lead.source && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-black/[0.06] bg-zinc-100/80 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-600 dark:border-white/[0.08] dark:bg-zinc-800 dark:text-zinc-300">
                            <Icon paths={I.compass} size={10} strokeWidth={2.2} className="opacity-70" />
                            {lead.source}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {lead.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(lead.phone || '', 'Telefon');
                            }}
                            title="Nusxalash uchun bosing"
                            className="inline-flex items-center gap-1 rounded-md px-1 -mx-1 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Icon paths={I.phone} size={12} strokeWidth={2} className="opacity-75" />
                            <span className="tabular-nums font-medium">{lead.phone}</span>
                          </button>
                        )}
                        {lead.email && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyText(lead.email || '', 'Email');
                            }}
                            title="Nusxalash uchun bosing"
                            className="inline-flex items-center gap-1 rounded-md px-1 -mx-1 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <Icon paths={I.mail} size={12} strokeWidth={2} className="opacity-75" />
                            <span>{lead.email}</span>
                          </button>
                        )}
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Icon paths={I.calendar} size={11} strokeWidth={2} className="opacity-65" />
                          {formatDate(lead.createdAt)}
                        </span>
                        {lead.notes && (
                          <span
                            className="max-w-[14rem] truncate italic text-zinc-400 dark:text-zinc-500"
                            title={lead.notes}
                          >
                            "{lead.notes}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Stage Switcher Pill & Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-0 border-black/[0.05] dark:border-white/[0.06]">
                    {/* Stage Select Pill */}
                    <div className="relative">
                      <select
                        value={lead.stage}
                        disabled={isUpdatingStage}
                        onChange={(e) => handleUpdateStage(lead.id, e.target.value as LeadStage)}
                        className={`cursor-pointer appearance-none rounded-xl pl-3 pr-7 py-1.5 text-xs font-bold ring-1 transition-all ${stageStyle.bg} ${stageStyle.text} ${stageStyle.ring} focus:outline-none focus:ring-2`}
                        aria-label={t('leads.updateStageAria', { name: fullNameStr })}
                      >
                        {LEAD_STAGES.map((st) => (
                          <option
                            key={st}
                            value={st}
                            className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                          >
                            {t(stageKey(st))}
                          </option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-70">
                        <Icon paths={I.chevronDown} size={12} strokeWidth={2.5} />
                      </span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleQuickLook(lead)}
                        className="min-h-[44px] rounded-xl px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold focus-visible:ring-2 focus-visible:ring-blue-500"
                        title="Quick-Look (Space)"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon paths={I.eye} size={14} strokeWidth={2.1} />
                          <span className="hidden md:inline">{t('leads.quickLook')}</span>
                        </span>
                      </GlassButton>

                      <GlassButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(lead)}
                        className="min-h-[44px] rounded-xl px-2.5 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <Icon paths={I.edit} size={13.5} strokeWidth={2.1} />
                          <span>{t('common.edit')}</span>
                        </span>
                      </GlassButton>

                      {lead.stage !== 'WON' && lead.stage !== 'LOST' && (
                        <>
                          <GlassButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setTrialTarget(lead)}
                            className="min-h-[44px] rounded-xl px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-500"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Icon paths={I.calendar} size={13.5} strokeWidth={2.1} />
                              <span>{t('leads.trialLesson')}</span>
                            </span>
                          </GlassButton>

                          {lead.stage === 'TRIAL_LESSON' && (
                            <GlassButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setAttendanceTarget(lead)}
                              className="min-h-[44px] rounded-xl px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <Icon paths={I.checkCircle} size={13.5} strokeWidth={2.2} />
                                <span>{t('leads.attendance')}</span>
                              </span>
                            </GlassButton>
                          )}

                          <GlassButton
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleConvert(lead.id)}
                            disabled={isConverting}
                            className="min-h-[44px] rounded-xl px-3 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-blue-500"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Icon paths={I.userPlus} size={13.5} strokeWidth={2.2} />
                              <span>
                                {isConverting ? t('leads.converting') : t('leads.convert')}
                              </span>
                            </span>
                          </GlassButton>
                        </>
                      )}

                      {/* Sidecar Split-View Trigger (Pure SF Symbol `sidebar.right`) */}
                      <button
                        type="button"
                        onClick={() => handleOpenLeadSidecar(lead)}
                        aria-label={t('leads.sidecarAria')}
                        title={t('leads.sidecarTitle')}
                        className="h-9 w-9 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 hover:text-slate-950 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <Icon paths={I.sidebarRight} size={14} strokeWidth={2.1} />
                      </button>

                      <GlassButton
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(lead.id)}
                        disabled={remove.isPending && remove.variables === lead.id}
                        className="h-9 w-9 min-h-[44px] min-w-[44px] p-0 inline-flex items-center justify-center rounded-xl text-xs opacity-80 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={t('leads.deleted')}
                      >
                        <Icon paths={I.trash} size={14} strokeWidth={2.1} />
                      </GlassButton>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        ) : (
          /* ── APPLE KANBAN PIPELINE BOARD VIEW ───────────────────── */
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3 lg:grid-cols-5">
            {LEAD_STAGES.map((colStage) => {
              const colLeads = leadList.filter((l) => l.stage === colStage);
              const cfg = STAGE_CONFIG[colStage];
              const stageIndex = LEAD_STAGES.indexOf(colStage);

              return (
                <div
                  key={colStage}
                  className="flex flex-col rounded-2xl border border-black/[0.06] bg-white/60 p-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/60 min-h-[340px]"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 mb-2.5 border-b border-black/[0.05] dark:border-white/[0.06]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
                      <h3 className="truncate text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        {t(stageKey(colStage))}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${cfg.bg} ${cfg.text}`}
                    >
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="flex-1 space-y-2.5">
                    {colLeads.length === 0 ? (
                      <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06] text-[11px] font-medium text-slate-400">
                        Bo'sh
                      </div>
                    ) : (
                      colLeads.map((lead) => {
                        const fullNameStr = formatLeadName(lead);
                        const prevStage = stageIndex > 0 ? LEAD_STAGES[stageIndex - 1] : null;
                        const nextStage =
                          stageIndex < LEAD_STAGES.length - 1 ? LEAD_STAGES[stageIndex + 1] : null;

                        return (
                          <motion.div
                            key={lead.id}
                            layout
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ y: -2 }}
                            transition={SPRING.snappy}
                            onClick={() => handleOpenLeadSidecar(lead)}
                            className="group cursor-pointer rounded-xl border border-black/[0.06] bg-white/95 p-3 shadow-xs hover:shadow-md dark:border-white/[0.08] dark:bg-surface-800/90 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                                  style={{ background: getAvatarGradientStyle(fullNameStr) }}
                                >
                                  {getInitials(fullNameStr)}
                                </div>
                                <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {fullNameStr}
                                </p>
                              </div>
                            </div>

                            {lead.phone && (
                              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                <Icon paths={I.phone} size={10} strokeWidth={2.2} />
                                {lead.phone}
                              </p>
                            )}

                            {lead.source && (
                              <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                                {lead.source}
                              </span>
                            )}

                            {/* Quick Stage Shift Bar */}
                            <div
                              className="mt-3 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.06] pt-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1">
                                {prevStage && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStage(lead.id, prevStage)}
                                    title={`← ${t(stageKey(prevStage))}`}
                                    className="rounded-md p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                                  >
                                    <Icon paths={I.chevronLeft} size={12} strokeWidth={2.5} />
                                  </button>
                                )}
                                {nextStage && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStage(lead.id, nextStage)}
                                    title={`${t(stageKey(nextStage))} →`}
                                    className="rounded-md p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                                  >
                                    <Icon paths={I.chevronRight} size={12} strokeWidth={2.5} />
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(lead)}
                                  className="rounded-md p-1 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                                  title={t('common.edit')}
                                >
                                  <Icon paths={I.edit} size={12} strokeWidth={2.2} />
                                </button>
                                {lead.stage !== 'WON' && lead.stage !== 'LOST' && (
                                  <button
                                    type="button"
                                    onClick={() => handleConvert(lead.id)}
                                    className="rounded-md p-1 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                                    title={t('leads.convert')}
                                  >
                                    <Icon paths={I.userPlus} size={12} strokeWidth={2.2} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data && (data.totalPages ?? 1) > 1 && (
          <div className="pt-4">
            <GlassPagination
              page={page}
              totalPages={data.totalPages ?? 1}
              onPageChange={setPage}
            />
          </div>
        )}
      </section>

      {/* ── Fast Floating Action Island ────────────────────────────── */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        entityName={t('leads.entityName')}
        actions={[
          {
            label: t('leads.bulkMarkWon'),
            shortcut: 'W',
            icon: <Icon paths={I.check} size={14} strokeWidth={2.5} />,
            variant: 'primary',
            onClick: handleBatchMarkAsWon,
          },
          {
            label: t('leads.bulkExportCsv'),
            shortcut: 'C',
            icon: <Icon paths={I.download} size={14} strokeWidth={2.2} />,
            variant: 'default',
            onClick: handleExportSelectedLeadsCSV,
          },
          {
            label: t('leads.bulkDelete'),
            shortcut: 'D',
            icon: <Icon paths={I.trash} size={14} strokeWidth={2.2} />,
            variant: 'destructive',
            onClick: handleBatchDeleteLeads,
          },
        ]}
      />

      {/* ── 4. Add/Edit Lead Modal (Upgraded with Squircle Icons & Presets) ─ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={
          editingId
            ? t('leads.editTitle') || 'Lidni tahrirlash'
            : t('leads.add') || 'Yangi lid kiritish'
        }
        wide
      >
        <form className="space-y-4 pt-2" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField
              label={t('leads.form.firstName') || 'Ism'}
              required
              error={formErrors.firstName}
            >
              <div className="relative">
                <FieldIcon icon={I.user} tone="blue" />
                <GlassInput
                  value={form.firstName}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, firstName: e.target.value }));
                    setFormErrors((p) => ({ ...p, firstName: undefined }));
                  }}
                  required
                  aria-invalid={Boolean(formErrors.firstName)}
                  placeholder="Ali"
                  className="pl-11"
                />
              </div>
              {formErrors.firstName && (
                <span className="mt-1 block text-xs text-rose-500">{formErrors.firstName}</span>
              )}
            </GlassField>

            <GlassField label={t('leads.form.lastName') || 'Familiya'}>
              <div className="relative">
                <FieldIcon icon={I.user} tone="indigo" />
                <GlassInput
                  value={form.lastName}
                  onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                  placeholder="Valiyev"
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('common.phone') || 'Telefon'}>
              <div className="relative">
                <FieldIcon icon={I.phone} tone="emerald" />
                <GlassInput
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+998 90 123 4567"
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label={t('common.email') || 'Email'} error={formErrors.email}>
              <div className="relative">
                <FieldIcon icon={I.mail} tone="cyan" />
                <GlassInput
                  type="email"
                  value={form.email}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, email: e.target.value }));
                    setFormErrors((p) => ({ ...p, email: undefined }));
                  }}
                  aria-invalid={Boolean(formErrors.email)}
                  placeholder="ali@example.com"
                  className="pl-11"
                />
              </div>
              {formErrors.email && (
                <span className="mt-1 block text-xs text-rose-500">{formErrors.email}</span>
              )}
            </GlassField>

            <div className="sm:col-span-2">
              <GlassField label={t('leads.col.source') || 'Manba (Qayerdan bildi)'}>
                <div className="relative">
                  <FieldIcon icon={I.compass} tone="purple" />
                  <GlassInput
                    value={form.source}
                    onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                    placeholder="Telegram, Instagram, Reklama..."
                    className="pl-11"
                  />
                </div>
                {/* 1-Click Source Preset Chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {QUICK_SOURCES.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, source: src }))}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        form.source === src
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-black/[0.04] text-slate-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-slate-300'
                      }`}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </GlassField>
            </div>
          </div>

          {/*  Segmented Stage Selector */}
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              {t('leads.col.stage') || "Boshlang'ich bosqich"}
            </p>
            <StageSegmented
              value={form.stage}
              onChange={(s) => setForm((p) => ({ ...p, stage: s }))}
              t={t}
            />
          </div>

          <GlassField label={t('common.notes') || "Qo'shimcha izoh"}>
            <div className="relative">
              <FieldIcon icon={I.note} tone="gray" />
              <GlassInput
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Qiziqqan fani, qulay vaqtlari va h.k."
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
            <GlassButton
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
              disabled={create.isPending}
            >
              {t('common.cancel') || 'Bekor qilish'}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={create.isPending}>
              <span className="inline-flex items-center gap-2">
                {create.isPending ? (
                  <>
                    <motion.span
                      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    />
                    {t('common.saving') || 'Saqlanmoqda...'}
                  </>
                ) : (
                  <>
                    <Icon paths={I.check} size={14} strokeWidth={2.5} />
                    {editingId ? t('common.save') || 'Saqlash' : t('leads.add') || "Qo'shish"}
                  </>
                )}
              </span>
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ── 5. Confirmation Dialogs ──────────────────────────────────────── */}
      <ConfirmDialog
        open={convertTarget !== null}
        onClose={() => setConvertTarget(null)}
        onConfirm={confirmConvert}
        description={
          t('leads.convertConfirm') ||
          "Ushbu lidni talabalar safiga o'tkazishni tasdiqlaysizmi?"
        }
        confirmLabel={t('leads.convert') || 'Talabaga aylantirish'}
        tone="primary"
        loading={convert.isPending}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        description={
          t('leads.deleteConfirm') || "Lidni butunlay o'chirib tashlamoqchimisiz?"
        }
        confirmLabel={t('common.delete') || "O'chirish"}
        tone="danger"
        loading={remove.isPending}
      />

      {/* ── 6. Schedule Trial Lesson Modal ─────────────────────────────── */}
      <GlassModal
        open={trialTarget !== null}
        onClose={() => setTrialTarget(null)}
        title="Sinov darsini rejalashtirish (Trial Lesson)"
      >
        {trialTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scheduleTrialMutation.mutate({
                id: trialTarget.id,
                data: trialForm,
              });
            }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
                <Icon paths={I.calendar} size={18} strokeWidth={2.1} />
              </div>
              <div>
                <p className="font-bold">
                  {trialTarget.firstName} {trialTarget.lastName || ''} uchun bepul sinov darsi
                </p>
                <p className="mt-1 text-[11px] opacity-85">
                  Sinov darsi belgilangach, lid avtomatik tarzda «TRIAL_LESSON» bosqichiga
                  o'tkaziladi va CRM voronkasida qayd etiladi.
                </p>
              </div>
            </div>

            <GlassField label="Sinov darsi sanasi va vaqti" required>
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="amber" />
                <GlassInput
                  type="datetime-local"
                  value={trialForm.trialDate}
                  onChange={(e) => setTrialForm({ ...trialForm, trialDate: e.target.value })}
                  required
                  className="pl-11"
                />
              </div>
            </GlassField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <GlassField label="Fan / Kurs nomi" required>
                <div className="relative">
                  <FieldIcon icon={I.book} tone="blue" />
                  <GlassInput
                    value={trialForm.subject}
                    onChange={(e) => setTrialForm({ ...trialForm, subject: e.target.value })}
                    placeholder="Masalan: General English B1"
                    required
                    className="pl-11"
                  />
                </div>
              </GlassField>

              <GlassField label="O'qituvchi (ixtiyoriy)">
                <div className="relative">
                  <FieldIcon icon={I.user} tone="indigo" />
                  <GlassInput
                    value={trialForm.teacherName}
                    onChange={(e) => setTrialForm({ ...trialForm, teacherName: e.target.value })}
                    placeholder="O'qituvchi ismi..."
                    className="pl-11"
                  />
                </div>
              </GlassField>
            </div>

            <GlassField label="Qo'shimcha izoh">
              <div className="relative">
                <FieldIcon icon={I.note} tone="gray" />
                <GlassInput
                  value={trialForm.notes}
                  onChange={(e) => setTrialForm({ ...trialForm, notes: e.target.value })}
                  placeholder="Talabaning boshlang'ich bilimi yoki talabi..."
                  className="pl-11"
                />
              </div>
            </GlassField>

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton type="button" variant="secondary" onClick={() => setTrialTarget(null)}>
                Bekor qilish
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={scheduleTrialMutation.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.check} size={14} strokeWidth={2.5} />
                  {scheduleTrialMutation.isPending
                    ? 'Belgilanmoqda...'
                    : 'Sinov darsini tasdiqlash'}
                </span>
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {/* ── 7. Mark Trial Attendance & Outcome Modal (Apple Radio Cards) ── */}
      <GlassModal
        open={attendanceTarget !== null}
        onClose={() => setAttendanceTarget(null)}
        title="Sinov darsi davomati va xulosasi"
      >
        {attendanceTarget && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              markAttendanceMutation.mutate({
                id: attendanceTarget.id,
                data: attendanceForm,
              });
            }}
            className="space-y-4"
          >
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-3.5 text-xs text-indigo-800 dark:text-indigo-200">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                <Icon paths={I.sparkles} size={18} strokeWidth={2.1} />
              </div>
              <div>
                <p className="font-bold">
                  {attendanceTarget.firstName} {attendanceTarget.lastName || ''} — Dars natijasi
                </p>
                <p className="mt-1 text-[11px] opacity-85">
                  O'quvchining sinov darsidagi taassuroti va keyingi harakatni belgilang.
                </p>
              </div>
            </div>

            <GlassField label="Darsga qatnashdimi?" required>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAttendanceForm({ ...attendanceForm, attended: true })}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    attendanceForm.attended
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/25'
                      : 'border-slate-200/80 bg-white/50 text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      attendanceForm.attended
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200/70 dark:bg-white/10'
                    }`}
                  >
                    <Icon paths={I.checkCircle} size={18} strokeWidth={2.2} />
                  </span>
                  <div>
                    <div className="text-xs font-bold">Ha, qatnashdi</div>
                    <div className="text-[10.5px] opacity-75">Sinov darsi muvaffaqiyatli o'tdi</div>
                  </div>
                </motion.button>

                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setAttendanceForm({ ...attendanceForm, attended: false })}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    !attendanceForm.attended
                      ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/25'
                      : 'border-slate-200/80 bg-white/50 text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      !attendanceForm.attended
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-200/70 dark:bg-white/10'
                    }`}
                  >
                    <Icon paths={I.xCircle} size={18} strokeWidth={2.2} />
                  </span>
                  <div>
                    <div className="text-xs font-bold">Yo'q, kelmadi (No-show)</div>
                    <div className="text-[10.5px] opacity-75">Qayta bog'lanish talab etiladi</div>
                  </div>
                </motion.button>
              </div>
            </GlassField>

            <GlassField label="O'qituvchi / Talaba fikri (Feedback)" required>
              <div className="relative">
                <FieldIcon icon={I.note} tone="indigo" />
                <GlassInput
                  value={attendanceForm.feedback}
                  onChange={(e) =>
                    setAttendanceForm({ ...attendanceForm, feedback: e.target.value })
                  }
                  placeholder="Dars yaxshi o'tdi, guruhga mos keladi..."
                  required
                  className="pl-11"
                />
              </div>
            </GlassField>

            <GlassField label="Keyingi harakat (Next Action)">
              <div className="relative">
                <FieldIcon icon={I.compass} tone="emerald" />
                <GlassInput
                  value={attendanceForm.nextAction}
                  onChange={(e) =>
                    setAttendanceForm({ ...attendanceForm, nextAction: e.target.value })
                  }
                  placeholder="Masalan: Ota-onasiga qo'ng'iroq qilish va to'lov invoysini yuborish..."
                  className="pl-11"
                />
              </div>
            </GlassField>

            <div className="flex justify-end gap-2 pt-2">
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setAttendanceTarget(null)}
              >
                Bekor qilish
              </GlassButton>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={markAttendanceMutation.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.check} size={14} strokeWidth={2.5} />
                  {markAttendanceMutation.isPending ? 'Saqlanmoqda...' : 'Natijani saqlash'}
                </span>
              </GlassButton>
            </div>
          </form>
        )}
      </GlassModal>

      {toastNode}
    </motion.main>
  );
}

export default LeadsPage;