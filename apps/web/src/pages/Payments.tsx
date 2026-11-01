/**
 * M-EDU Payments Page
 * Financial transaction tracking, student tuition payments, and receipt generation.
 */

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { paymentsApi, studentsApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassPagination,
  GlassInput,
  GlassSelect,
  GlassField,
  GlassModal,
  GlassButton,
  FloatingActionIsland,
  useToasts,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { ExecutivePDFStudio } from '@/components/pdf-studio';
import { CashierZReportModal } from '@/components/payments/CashierZReportModal';
import { PosThermalReceiptModal } from '@/components/payments/PosThermalReceiptModal';
import { AiDebtReminderModal } from '@/components/payments/AiDebtReminderModal';
import { PaymentsAnalyticsTab } from '@/components/payments/PaymentsAnalyticsTab';
import { ExecutiveCashflowForecastRadar } from '@/components/payments/ExecutiveCashflowForecastRadar';
import { CurrencySplitCalculator } from '@/components/payments/CurrencySplitCalculator';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import type {
  Paginated,
  Payment,
  Student,
  PaymentStatus,
  PaymentMethod,
} from '@/lib/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 *  FLUID MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 32, mass: 0.65 },
  smooth: { type: 'spring', stiffness: 360, damping: 30, mass: 0.85 },
  liquid: { type: 'spring', stiffness: 260, damping: 26, mass: 0.95 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.05 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.liquid },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 *  LIQUID GLASS OPTICAL SURFACES & JEWEL PALETTE
 * ========================================================================== */

const LIQUID_PANEL =
  'relative overflow-hidden rounded-[28px] border border-white/75 dark:border-white/[0.12] ' +
  'bg-gradient-to-b from-white/[0.72] via-white/[0.52] to-white/[0.64] ' +
  'dark:from-white/[0.09] dark:via-white/[0.04] dark:to-white/[0.07] ' +
  'backdrop-blur-3xl backdrop-saturate-[200%] ' +
  'shadow-[0_24px_48px_-12px_rgba(15,23,42,0.07),0_4px_16px_-4px_rgba(15,23,42,0.04),inset_0_1.5px_1px_rgba(255,255,255,0.92),inset_0_-1px_1px_rgba(255,255,255,0.45)] ' +
  'dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.65),inset_0_1px_0.5px_rgba(255,255,255,0.22),inset_0_-1px_0.5px_rgba(255,255,255,0.05)]';

const LIQUID_CARD =
  'relative overflow-hidden rounded-[24px] border border-white/80 dark:border-white/[0.12] ' +
  'bg-gradient-to-br from-white/[0.76] via-white/[0.54] to-white/[0.68] ' +
  'dark:from-white/[0.10] dark:via-white/[0.04] dark:to-white/[0.07] ' +
  'backdrop-blur-2xl backdrop-saturate-[190%] ' +
  'shadow-[0_16px_36px_-10px_rgba(15,23,42,0.06),inset_0_1.5px_1px_rgba(255,255,255,0.95),inset_0_-1px_1px_rgba(255,255,255,0.4)] ' +
  'dark:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.55),inset_0_1px_0.5px_rgba(255,255,255,0.22),inset_0_-1px_0.5px_rgba(255,255,255,0.04)]';

const LIQUID_PILL_RECESSED =
  'rounded-2xl border border-slate-900/[0.06] dark:border-white/[0.08] ' +
  'bg-slate-900/[0.035] dark:bg-black/35 ' +
  'shadow-[inset_0_2px_4px_rgba(15,23,42,0.05),0_1px_0_rgba(255,255,255,0.7)] ' +
  'dark:shadow-[inset_0_2px_5px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.07)]';

type Tone =
  | 'sapphire'
  | 'jade'
  | 'amber'
  | 'coral'
  | 'amethyst'
  | 'celeste'
  | 'titanium';

const LIQUID_TONES: Record<
  Tone,
  {
    fg: string;
    darkFg: string;
    surface: string;
    rim: string;
    caustic: string;
    orbGradient: string;
    dot: string;
  }
> = {
  sapphire: {
    fg: '#1D4ED8',
    darkFg: '#60A5FA',
    surface:
      'linear-gradient(135deg, rgba(59,130,246,0.16) 0%, rgba(99,102,241,0.06) 100%)',
    rim: 'rgba(59,130,246,0.28)',
    caustic: 'rgba(59,130,246,0.32)',
    orbGradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 50%, #0EA5E9 100%)',
    dot: '#3B82F6',
  },
  jade: {
    fg: '#047857',
    darkFg: '#34D399',
    surface:
      'linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(20,184,166,0.06) 100%)',
    rim: 'rgba(16,185,129,0.30)',
    caustic: 'rgba(16,185,129,0.32)',
    orbGradient: 'linear-gradient(135deg, #059669 0%, #10B981 55%, #0D9488 100%)',
    dot: '#10B981',
  },
  amber: {
    fg: '#B45309',
    darkFg: '#FBBF24',
    surface:
      'linear-gradient(135deg, rgba(245,158,11,0.16) 0%, rgba(249,115,22,0.06) 100%)',
    rim: 'rgba(245,158,11,0.30)',
    caustic: 'rgba(245,158,11,0.30)',
    orbGradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 55%, #EA580C 100%)',
    dot: '#F59E0B',
  },
  coral: {
    fg: '#BE123C',
    darkFg: '#FB7185',
    surface:
      'linear-gradient(135deg, rgba(244,63,94,0.16) 0%, rgba(225,29,72,0.06) 100%)',
    rim: 'rgba(244,63,94,0.30)',
    caustic: 'rgba(244,63,94,0.34)',
    orbGradient: 'linear-gradient(135deg, #E11D48 0%, #F43F5E 55%, #EC4899 100%)',
    dot: '#F43F5E',
  },
  amethyst: {
    fg: '#6D28D9',
    darkFg: '#C084FC',
    surface:
      'linear-gradient(135deg, rgba(139,92,246,0.16) 0%, rgba(192,132,252,0.06) 100%)',
    rim: 'rgba(139,92,246,0.28)',
    caustic: 'rgba(139,92,246,0.32)',
    orbGradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 55%, #DB2777 100%)',
    dot: '#8B5CF6',
  },
  celeste: {
    fg: '#0369A1',
    darkFg: '#38BDF8',
    surface:
      'linear-gradient(135deg, rgba(14,165,233,0.16) 0%, rgba(56,189,248,0.06) 100%)',
    rim: 'rgba(14,165,233,0.28)',
    caustic: 'rgba(14,165,233,0.30)',
    orbGradient: 'linear-gradient(135deg, #0284C7 0%, #0EA5E9 55%, #2563EB 100%)',
    dot: '#0EA5E9',
  },
  titanium: {
    fg: '#475569',
    darkFg: '#94A3B8',
    surface:
      'linear-gradient(135deg, rgba(100,116,139,0.14) 0%, rgba(148,163,184,0.05) 100%)',
    rim: 'rgba(100,116,139,0.24)',
    caustic: 'rgba(100,116,139,0.20)',
    orbGradient: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
    dot: '#64748B',
  },
};

/* ============================================================================
 * CUSTOM ICONS (SVG Icons)
 * ========================================================================== */

const ICON_STROKE = 1.8;

const I: Record<string, string[]> = {
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  cash: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 7v10',
    'M9 9.5C9 8.1 10.3 7 12 7s3 1.1 3 2.5S13.7 12 12 12s-3 1.1-3 2.5S10.3 17 12 17s3-1.1 3-2.5',
  ],
  creditCard: [
    'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',
    'M1 10h22',
    'M6 15h2',
  ],
  banknote: [
    'M2 6h20v12H2z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M6 12h.01',
    'M18 12h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4',
    'M12 16h.01',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6',
    'M9 9l6 6',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  receipt: [
    'M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z',
    'M8 8h8',
    'M8 12h8',
    'M8 16h5',
  ],
  printer: [
    'M6 9V2h12v7',
    'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2',
    'M6 14h12v8H6z',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  empty: [
    'M20 7h-9',
    'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  sidecar: [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M15 3v18',
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
      aria-hidden
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * CONSTANTS & MAPPINGS
 * ========================================================================== */

const PAYMENT_STATUSES: PaymentStatus[] = ['PAID', 'PENDING', 'OVERDUE', 'CANCELLED'];
const PAYMENT_METHODS: PaymentMethod[] = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'PAYME',
  'CLICK',
  'UZUM',
  'OTHER',
];

const STATUS_TONE: Record<PaymentStatus, Tone> = {
  PAID: 'jade',
  PENDING: 'amber',
  OVERDUE: 'coral',
  CANCELLED: 'titanium',
};

const STATUS_PULSE: Record<PaymentStatus, boolean> = {
  PAID: true,
  PENDING: false,
  OVERDUE: true,
  CANCELLED: false,
};

const STATUS_ICON: Record<PaymentStatus, string[]> = {
  PAID: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  PENDING: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  OVERDUE: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16h.01'],
  CANCELLED: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
};

const METHOD_TONE: Record<PaymentMethod, Tone> = {
  CASH: 'jade',
  CARD: 'sapphire',
  BANK_TRANSFER: 'amethyst',
  PAYME: 'celeste',
  CLICK: 'sapphire',
  UZUM: 'amethyst',
  OTHER: 'titanium',
};

const METHOD_ICON: Record<PaymentMethod, string[]> = {
  CASH: ['M2 6h20v12H2z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6 12h.01', 'M18 12h.01'],
  CARD: ['M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M1 10h22', 'M6 15h2'],
  BANK_TRANSFER: ['M3 21h18', 'M5 21V10l7-5 7 5v11', 'M9 21v-6h6v6'],
  PAYME: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M8 12h8', 'M12 8v8'],
  CLICK: ['M9 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M15 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M12 3v18'],
  UZUM: ['M12 2v20', 'M5 8c3 0 5 2 7 4s4 4 7 4', 'M5 16c3 0 5-2 7-4s4-4 7-4'],
  OTHER: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v.01', 'M11 12h1v4h1'],
};

interface PaymentFilters {
  page: number;
  limit: number;
  status?: PaymentStatus;
  search?: string;
}

interface PaymentFormState {
  studentId: string;
  amount: string;
  description: string;
  dueDate: string;
  method: PaymentMethod;
}

const INITIAL_FORM: PaymentFormState = {
  studentId: '',
  amount: '',
  description: '',
  dueDate: '',
  method: 'CASH',
};

/* ============================================================================
 * HELPERS & BESPOKE AVATAR PALETTES
 * ========================================================================== */

export function parseSafeAmount(raw: string): number {
  if (!raw) return NaN;
  const normalized = raw.trim().replace(/,/g, '.').replace(/\s+/g, '');
  const val = parseFloat(normalized);
  return Number.isFinite(val) ? Math.round(val * 100) / 100 : NaN;
}

export function formatStudentName(student: Student | undefined): string {
  if (!student?.user) return '—';
  const { firstName, lastName } = student.user;
  return [firstName, lastName].filter(Boolean).join(' ') || '—';
}

export function formatPaymentStatus(status: PaymentStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatPaymentMethod(method: PaymentMethod): string {
  return method.charAt(0) + method.slice(1).toLowerCase();
}

export function toPaymentMethod(method?: string | null): PaymentMethod {
  return method && (PAYMENT_METHODS as string[]).includes(method)
    ? (method as PaymentMethod)
    : 'CASH';
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
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Curated  Jewel & Aurora Avatar Gradients */
const LIQUID_AVATAR_PALETTES = [
  ['#2563EB', '#7C3AED'], // Sapphire -> Amethyst
  ['#059669', '#0284C7'], // Jade -> Celeste
  ['#7C3AED', '#DB2777'], // Amethyst -> Rose Quartz
  ['#0284C7', '#4F46E5'], // Celeste -> Indigo
  ['#D97706', '#E11D48'], // Liquid Amber -> Crimson Coral
  ['#0D9488', '#2563EB'], // Teal -> Sapphire
  ['#4F46E5', '#9333EA'], // Deep Indigo -> Violet
  ['#10B981', '#059669'], // Emerald -> Deep Jade
];

function avatarGradient(name: string): string {
  const [a, b] = LIQUID_AVATAR_PALETTES[nameHash(name) % LIQUID_AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 *  LIQUID GLASS SUB-COMPONENTS
 * ========================================================================== */

/** Top specular meniscus reflection inside any Liquid Glass container */
function LiquidMeniscus() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-20 opacity-80 dark:opacity-30"
      style={{
        background:
          'radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.2) 45%, transparent 100%)',
      }}
    />
  );
}

function Shimmer({ className = '', radius = '1.5rem' }: { className?: string; radius?: string }) {
  return (
    <div
      className={`relative overflow-hidden border border-white/60 bg-white/40 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-white/[0.04] ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.75) 50%, transparent 80%)',
        }}
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-32 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-[96px]" radius="1.5rem" />
        ))}
      </div>
      <Shimmer className="h-16 w-full" radius="1.5rem" />
      <Shimmer className="h-96 w-full" radius="1.75rem" />
    </div>
  );
}

function CountUp({
  value,
  duration = 1.1,
}: {
  value: number;
  duration?: number;
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
      const safeVal = Number.isFinite(value) ? value : 0;
      setN(safeVal * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(Number.isFinite(n) ? n : 0).toLocaleString('uz-UZ')}</span>;
}

/** Refractive  KPI Lens Tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'sapphire',
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
}) {
  const c = LIQUID_TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={SPRING.liquid}
      className={`group flex items-center gap-3.5 px-4 py-4 ${LIQUID_CARD}`}
    >
      <LiquidMeniscus />
      {/* Ambient caustic glow at bottom corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-65"
        style={{ background: c.caustic }}
      />

      {/* 3D Liquid Glass Squircle Icon */}
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-white"
        style={{
          background: c.orbGradient,
          boxShadow: `0 10px 22px -6px ${c.caustic}, inset 0 1.5px 1px rgba(255,255,255,0.65), inset 0 -1px 1px rgba(0,0,0,0.15)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[14px]"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 100%)',
          }}
        />
        <Icon paths={icon} size={19} strokeWidth={2.1} className="relative drop-shadow-sm" />
      </div>

      <div className="relative min-w-0 flex-1">
        <div className="text-[24px] font-bold tracking-tight leading-none text-slate-900 dark:text-white">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Tactile Liquid Glass Status Capsule */
function StatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
  const tone = STATUS_TONE[status];
  const c = LIQUID_TONES[tone];
  const pulse = STATUS_PULSE[status];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.11em] backdrop-blur-md"
      style={{
        background: c.surface,
        color: c.fg,
        border: `1px solid ${c.rim}`,
        boxShadow: `inset 0 1px 0.5px rgba(255,255,255,0.7), 0 4px 12px -4px ${c.caustic}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.dot }}
            animate={{ scale: [1, 2.5, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      </span>
      <span className="dark:brightness-125">{label}</span>
    </span>
  );
}

/** Jewel-Toned Payment Method Chip */
function MethodChip({ method, label }: { method: PaymentMethod; label: string }) {
  const tone = METHOD_TONE[method] ?? 'titanium';
  const c = LIQUID_TONES[tone];
  const icon = METHOD_ICON[method] ?? METHOD_ICON.OTHER;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] backdrop-blur-md"
      style={{
        background: c.surface,
        color: c.fg,
        border: `1px solid ${c.rim}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)',
      }}
    >
      <Icon paths={icon} size={10.5} strokeWidth={2.2} className="dark:brightness-125" />
      <span className="dark:brightness-125">{label}</span>
    </span>
  );
}

/** Refractive Squircle Leading Icon for Inputs */
function FieldIcon({ icon, tone = 'sapphire' }: { icon: string[]; tone?: Tone }) {
  const c = LIQUID_TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[9px]"
      style={{
        background: c.surface,
        color: c.fg,
        border: `1px solid ${c.rim}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
      }}
      aria-hidden
    >
      <Icon paths={icon} size={12.5} strokeWidth={2.2} className="dark:brightness-125" />
    </span>
  );
}

/**  Recessed Liquid Pill Status Controller */
function InlineStatusSelector({
  value,
  onChange,
  disabled,
  ariaLabel,
  t,
}: {
  value: PaymentStatus;
  onChange: (s: PaymentStatus) => void;
  disabled?: boolean;
  ariaLabel?: string;
  t: (k: string) => string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 p-1 ${LIQUID_PILL_RECESSED}`}
    >
      {PAYMENT_STATUSES.map((s) => {
        const active = value === s;
        const c = LIQUID_TONES[STATUS_TONE[s]];
        return (
          <motion.button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(s)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            transition={SPRING.snappy}
            className="relative flex h-6 w-6 items-center justify-center rounded-xl outline-none transition-colors disabled:opacity-40"
            title={t(`payments.status.${s}`)}
            aria-label={t(`payments.status.${s}`)}
            style={{
              background: active ? c.surface : 'transparent',
              color: active ? c.fg : '#94A3B8',
              border: active ? `1px solid ${c.rim}` : '1px solid transparent',
              boxShadow: active
                ? `inset 0 1px 0.5px rgba(255,255,255,0.85), 0 2px 6px -2px ${c.caustic}`
                : 'none',
            }}
          >
            <Icon paths={STATUS_ICON[s]} size={11.5} strokeWidth={2.3} className="dark:brightness-125" />
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function PaymentsPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('payments.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playPayment, playError } = usePremiumSound();

  /* ── Tab state ────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics' | 'cashflow'>('ledger');

  /* ── Filter state ─────────────────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  /* ── Modal state ──────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null);
  const [thermalReceiptTarget, setThermalReceiptTarget] = useState<Payment | null>(null);
  const [aiDebtTarget, setAiDebtTarget] = useState<Payment | null>(null);
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const [zReportModalOpen, setZReportModalOpen] = useState(false);
  const [splitCalcOpen, setSplitCalcOpen] = useState(false);

  /* ── Form state ───────────────────────────────────────────────────── */
  const [form, setForm] = useState<PaymentFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<
    Partial<Record<keyof PaymentFormState, string>>
  >({});

  /* ── Query params ─────────────────────────────────────────────────── */
  const params = useMemo<PaymentFilters>(
    () => ({
      page,
      limit: 20,
      status: (status as PaymentStatus) || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, status, debouncedSearch],
  );

  /* ── Data fetching ────────────────────────────────────────────────── */
  const payments = useQuery({
    queryKey: queryKeys.payments.list(params),
    queryFn: () => paymentsApi.list(params),
    placeholderData: (previousData) => previousData,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 100 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = payments.data as Paginated<Payment> | undefined;
  const paymentList = useMemo(() => data?.items || [], [data]);
  const studentList = useMemo(() => {
    if (Array.isArray(students.data)) return students.data;
    return (students.data as Paginated<Student> | undefined)?.items || [];
  }, [students.data]);

  /* ── Derived stats (from current page) ────────────────────────────── */
  const stats = useMemo(() => {
    const total = paymentList.length;
    const paid = paymentList.filter((p) => p.status === 'PAID').length;
    const pending = paymentList.filter((p) => p.status === 'PENDING').length;
    const overdue = paymentList.filter((p) => p.status === 'OVERDUE').length;
    const totalAmount =
      Math.round(
        paymentList
          .filter((p) => p.status === 'PAID')
          .reduce((sum, p) => sum + Math.round((Number(p.amount) || 0) * 100), 0),
      ) / 100;
    return { total, paid, pending, overdue, totalAmount };
  }, [paymentList]);

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenPaymentSidecar = useCallback((payment: Payment) => {
    const studentName = formatStudentName(payment.student);
    const isDebt = payment.status === 'PENDING' || payment.status === 'OVERDUE';
    const data: QuickLookData = {
      id: payment.id,
      type: 'payment',
      title: formatCurrency(payment.amount),
      subtitle: `${studentName} · ${payment.method || 'CASH'}`,
      badge: {
        text: t(`payments.status.${payment.status}`),
        tone: payment.status === 'PAID' ? 'emerald' : payment.status === 'PENDING' ? 'amber' : 'rose',
      },
      avatar: {
        text: getInitials(studentName),
        color: payment.status === 'PAID' ? '#059669' : '#4F46E5',
      },
      metrics: [
        { label: t('payments.sidecar.amount'), value: formatCurrency(payment.amount), trend: 'up' },
        { label: t('payments.sidecar.status'), value: t(`payments.status.${payment.status}`) },
        { label: t('payments.sidecar.method'), value: t(`payments.method.${toPaymentMethod(payment.method)}`) },
        { label: t('payments.sidecar.date'), value: formatDate(payment.createdAt) },
      ],
      details: [
        { label: t('payments.sidecar.id'), value: payment.id, copyable: true },
        { label: t('payments.sidecar.student'), value: studentName },
        { label: t('payments.sidecar.description'), value: payment.description || t('payments.sidecar.defaultDesc') },
        { label: t('payments.sidecar.updatedAt'), value: formatDate((payment as any).updatedAt || payment.createdAt) },
      ],
      primaryAction: {
        label: t('payments.sidecar.officialReceipt'),
        onExecute: () => setReceiptTarget(payment),
      },
      secondaryAction: isDebt
        ? {
            label: t('payments.sidecar.sendAiReminder'),
            onExecute: () => setAiDebtTarget(payment),
          }
        : {
            label: t('payments.sidecar.posSlip'),
            onExecute: () => setThermalReceiptTarget(payment),
          },
    };
    openSidecar(data);
  }, [t]);

  /* ── Fast Keyboard-First Navigation ─────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<Payment>({
    items: paymentList,
    getItemId: (p) => p.id,
    rowIdPrefix: 'payment-row-',
    onSelect: (p) => setReceiptTarget(p),
    onQuickLook: (p) => handleOpenPaymentSidecar(p),
    onEdit: (p) => handleOpenPaymentSidecar(p),
  });

  /* ── Batch actions ────────────────────────────────────────────────── */
  const handleBatchMarkAsPaid = async () => {
    let count = 0;
    for (const id of selectedIds) {
      try {
        await paymentsApi.update(id, { status: 'PAID' });
        count++;
      } catch {
        // continue
      }
    }
    qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
    clearSelection();
    push('success', t('payments.batchPaidSuccess', { count }));
  };

  const handleExportSelectedPaymentsCSV = () => {
    const selectedRows = paymentList.filter((p) => isSelected(p.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Student,Amount,Status,Method,Date']
        .concat(
          selectedRows.map(
            (p) =>
              `"${p.id}","${formatStudentName(p.student)}","${p.amount}","${p.status}","${p.method}","${p.createdAt}"`,
          ),
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payments_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    clearSelection();
    push('success', t('payments.exportSuccess', { count: selectedRows.length }));
  };

  /* ── Create mutation ──────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () => {
      const parsedAmount = parseSafeAmount(form.amount);
      return paymentsApi.create({
        studentId: form.studentId,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        description: form.description.trim() || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        method: form.method,
      });
    },
    onSuccess: () => {
      playPayment();
      push('success', t('payments.created'));
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
      if (form.studentId) {
        qc.invalidateQueries({ queryKey: queryKeys.students.detail(form.studentId) });
      }
      qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  /* ── Update status mutation ───────────────────────────────────────── */
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      paymentsApi.update(id, { status }),
    onSuccess: () => {
      playPayment();
      push('success', t('payments.updated'));
      qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  /* ── Validators ───────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PaymentFormState, string>> = {};
    if (!form.studentId) {
      errors.studentId = 'payments.validation.studentRequired';
    }
    const parsedAmount = parseSafeAmount(form.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      errors.amount = 'payments.validation.amountPositive';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleFormChange = useCallback(
    (field: keyof PaymentFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleStatusFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatus(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleUpdateStatus = useCallback(
    (paymentId: string, newStatus: PaymentStatus) => {
      if (updateStatus.isPending) return;
      updateStatus.mutate({ id: paymentId, status: newStatus });
    },
    [updateStatus],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (create.isPending) return;
      if (!validateForm()) return;
      create.mutate();
    },
    [validateForm, create],
  );

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setModalOpen(true);
  }, []);

  const { refetch: refetchPayments } = payments;
  const handleRetry = useCallback(() => {
    void refetchPayments();
  }, [refetchPayments]);

  const hasActiveFilters = Boolean(status || search);
  const totalPayments = data?.total || 0;

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (payments.isLoading && !data) {
    return (
      <div className="page-container max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] space-y-5 pb-24 sm:pb-8">
        <PaymentsSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (payments.isError) {
    return (
      <div className="page-container max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] space-y-5 pb-24 sm:pb-8">
        <div className={`${LIQUID_PANEL} p-8`}>
          <LiquidMeniscus />
          <GlassErrorState
            title={t('payments.loadError')}
            message={getErrorMessage(payments.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] relative space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh variant="corporate" opacity={0.65} />
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className={`${LIQUID_PANEL} p-6 sm:p-7`}>
          <LiquidMeniscus />
          {/* Ambient Aurora Caustics behind Hero */}
          <span
            aria-hidden
            className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-emerald-400/20 blur-3xl dark:bg-emerald-500/15"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -bottom-12 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl dark:bg-indigo-500/15"
          />

          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* 3D Liquid Jewel Wallet Orb */}
            <motion.div
              initial={{ scale: 0.88, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.liquid}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] text-white"
              style={{
                background:
                  'linear-gradient(135deg, #059669 0%, #0EA5E9 55%, #4F46E5 100%)',
                boxShadow:
                  '0 18px 36px -10px rgba(14,165,233,0.48), inset 0 2px 1px rgba(255,255,255,0.65), inset 0 -2px 2px rgba(0,0,0,0.2)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-1 top-1 h-1/2 rounded-t-[18px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.58), transparent)',
                }}
              />
              <Icon paths={I.wallet} size={28} strokeWidth={2.1} className="relative drop-shadow-sm" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Jade Liquid Pill */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: LIQUID_TONES.jade.surface,
                    color: LIQUID_TONES.jade.fg,
                    border: `1px solid ${LIQUID_TONES.jade.rim}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                  }}
                >
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.4} />
                  <span className="dark:brightness-125">Payments</span>
                </span>

                {/* Sapphire Count Pill */}
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: LIQUID_TONES.sapphire.surface,
                    color: LIQUID_TONES.sapphire.fg,
                    border: `1px solid ${LIQUID_TONES.sapphire.rim}`,
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                  }}
                >
                  <Icon paths={I.layers} size={11} strokeWidth={2.4} />
                  <span className="dark:brightness-125">
                    {totalPayments} {totalPayments === 1 ? t('payments.countOne') : t('payments.countMany')}
                  </span>
                </span>

                {/* Coral Overdue Pill */}
                {stats.overdue > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]"
                    style={{
                      background: LIQUID_TONES.coral.surface,
                      color: LIQUID_TONES.coral.fg,
                      border: `1px solid ${LIQUID_TONES.coral.rim}`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
                    }}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                    <span className="dark:brightness-125">{t('payments.overdueBadge', { count: stats.overdue })}</span>
                  </span>
                )}
              </div>

              <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                {t('payments.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
                {t('payments.subtitle')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
              <motion.div
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setZReportModalOpen(true)}
                  className="!rounded-2xl !border-emerald-400/35 !bg-emerald-500/[0.08] hover:!bg-emerald-500/[0.14] !shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.8)]"
                >
                  <span className="inline-flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Icon paths={I.receipt} size={15} strokeWidth={2.2} />
                    {t('payments.zReport')}
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('open-ai-copilot', {
                        detail: {
                          prompt: t('payments.aiPrompt'),
                        },
                      }),
                    );
                  }}
                  className="!rounded-2xl !border-violet-400/35 !bg-violet-500/[0.08] hover:!bg-violet-500/[0.14] !shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.8)]"
                >
                  <span className="inline-flex items-center gap-2 font-semibold text-violet-700 dark:text-violet-300">
                    <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                    {t('payments.aiAnalysis')}
                  </span>
                </GlassButton>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleOpenModal}
                  className="!rounded-2xl !border-white/30 !bg-gradient-to-r !from-blue-600 !via-indigo-600 !to-violet-600 !text-white !shadow-[0_12px_24px_-6px_rgba(37,99,235,0.45),inset_0_1.5px_1px_rgba(255,255,255,0.5)]"
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    {t('payments.add')}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          ENTERPRISE FINANCIAL TABS
      ============================================================ */}
      <div className="flex rounded-2xl bg-slate-900/[0.04] p-1.5 dark:bg-white/[0.05] border border-slate-900/[0.06] dark:border-white/[0.08] backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition-all ${
            activeTab === 'ledger'
              ? 'bg-white text-blue-600 shadow-md dark:bg-white/[0.12] dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {t('payments.tabs.ledger')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition-all ${
            activeTab === 'analytics'
              ? 'bg-white text-blue-600 shadow-md dark:bg-white/[0.12] dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {t('payments.tabs.analytics')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cashflow')}
          className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition-all ${
            activeTab === 'cashflow'
              ? 'bg-white text-blue-600 shadow-md dark:bg-white/[0.12] dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {t('payments.tabs.cashflow')}
        </button>
      </div>

      {activeTab === 'analytics' && (
        <PaymentsAnalyticsTab
          payments={paymentList}
          onOpenQuickPayment={handleOpenModal}
          onOpenZReport={() => setZReportModalOpen(true)}
        />
      )}

      {activeTab === 'cashflow' && (
        <ExecutiveCashflowForecastRadar />
      )}

      {activeTab === 'ledger' && (
        <>
          {/* ============================================================
              REFRACTIVE KPI LENS BAR
          ============================================================ */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
          >
            <KpiTile label={t('payments.allStatuses')} value={totalPayments || stats.total} icon={I.receipt} tone="sapphire" />
            <KpiTile label={t('payments.status.PAID')} value={stats.paid} icon={I.checkCircle} tone="jade" />
            <KpiTile label={t('payments.status.PENDING')} value={stats.pending} icon={I.clock} tone="amber" />
            <KpiTile label={t('payments.status.OVERDUE')} value={stats.overdue} icon={I.alertCircle} tone="coral" />
          </motion.div>

      {/* ============================================================
          LIQUID GLASS FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className={`${LIQUID_CARD} p-4`}>
          <LiquidMeniscus />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <FieldIcon icon={I.search} tone="sapphire" />
              <GlassInput
                placeholder={t('payments.searchPlaceholder')}
                value={search}
                onChange={handleSearchChange}
                aria-label={t('payments.searchPlaceholder')}
                type="search"
                className="pl-11"
              />
            </div>
            {/* Status */}
            <div className="relative sm:w-60">
              <FieldIcon icon={I.filter} tone="amber" />
              <GlassSelect
                value={status}
                onChange={handleStatusFilterChange}
                aria-label={t('payments.filterByStatus')}
                className="pl-11"
              >
                <option value="">{t('payments.allStatuses')}</option>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`payments.status.${s}`)}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          LIQUID GLASS PAYMENTS LEDGER
      ============================================================ */}
      <motion.div variants={cardVariants} className={LIQUID_PANEL}>
        <LiquidMeniscus />

        {paymentList.length === 0 ? (
          <div className="relative p-12">
            <div className="flex flex-col items-center text-center">
              <div
                className="relative flex h-16 w-16 items-center justify-center rounded-[22px] text-white"
                style={{
                  background: LIQUID_TONES.sapphire.orbGradient,
                  boxShadow:
                    '0 14px 28px -8px rgba(37,99,235,0.4), inset 0 1.5px 1px rgba(255,255,255,0.65)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.9} />
              </div>
              <p className="mt-4 text-[15.5px] font-bold tracking-tight text-slate-900 dark:text-white">
                {hasActiveFilters ? t('payments.emptyFiltered') : t('payments.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[13px] font-medium text-slate-500 dark:text-slate-400">
                {hasActiveFilters
                  ? t('payments.emptyFilteredHint')
                  : t('payments.emptyHint')}
              </p>
              {!hasActiveFilters && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton type="button" variant="primary" size="sm" onClick={handleOpenModal}>
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('payments.add')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="relative divide-y divide-slate-900/[0.05] dark:divide-white/[0.06]">
              {paymentList.map((payment, idx) => {
                const studentName = formatStudentName(payment.student);
                const initials = getInitials(studentName);
                const gradient = avatarGradient(studentName);
                const isUpdatingStatus =
                  updateStatus.isPending && updateStatus.variables?.id === payment.id;
                const isRowSelected = isSelected(payment.id);
                const isRowFocused = focusedIndex === idx;

                return (
                  <motion.div
                    key={payment.id}
                    id={`payment-row-${payment.id}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.025 }}
                    className={`group flex flex-col gap-3 px-4 py-3.5 transition-all sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                      isRowFocused
                        ? 'rounded-2xl bg-blue-500/[0.08] ring-2 ring-blue-500/60'
                        : isRowSelected
                        ? 'bg-blue-500/[0.05]'
                        : 'hover:bg-white/55 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Student Info Group */}
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      {/* Liquid Checkbox with guaranteed >= 44x44px touch target */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(payment.id);
                        }}
                        className="h-9 w-9 min-h-[44px] min-w-[44px] -m-2 inline-flex items-center justify-center shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                        aria-label={
                          isRowSelected
                            ? t('payments.deselectRowAria', { name: studentName })
                            : t('payments.selectRowAria', { name: studentName })
                        }
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-[7px] border transition-all ${
                            isRowSelected
                              ? 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_4px_10px_rgba(37,99,235,0.35),inset_0_1px_0.5px_rgba(255,255,255,0.5)]'
                              : 'border-slate-300/90 bg-white/70 hover:border-blue-400 dark:border-white/20 dark:bg-white/[0.06]'
                          }`}
                        >
                          {isRowSelected && (
                            <svg
                              className="h-3.5 w-3.5"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      </button>

                      {/* 3D Liquid Squircle Avatar */}
                      <div
                        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] text-[12.5px] font-bold tracking-tight text-white"
                        style={{
                          background: gradient,
                          boxShadow:
                            '0 8px 18px -6px rgba(15,23,42,0.28), inset 0 1.5px 1px rgba(255,255,255,0.55), inset 0 -1px 1px rgba(0,0,0,0.18)',
                        }}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[13px]"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.45), transparent)',
                          }}
                        />
                        <span className="relative drop-shadow-sm">{initials}</span>
                      </div>

                      {/* Student + Meta */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">
                          {studentName}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                          <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                            <Icon
                              paths={I.calendar}
                              size={11}
                              strokeWidth={2.1}
                              className="opacity-65"
                            />
                            {formatDate(payment.createdAt)}
                          </span>
                          <MethodChip
                            method={toPaymentMethod(payment.method)}
                            label={t(`payments.method.${toPaymentMethod(payment.method)}`)}
                          />
                          {payment.description && (
                            <span
                              className="max-w-[12rem] truncate text-slate-500/90 dark:text-slate-400/90 sm:max-w-[16rem]"
                              title={payment.description}
                            >
                              {payment.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount, Status & Optical Actions */}
                    <div className="flex w-full shrink-0 items-center justify-between gap-3.5 border-t border-slate-900/[0.04] pt-2.5 dark:border-white/[0.05] sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
                      {/* Jade Amount Display */}
                      <div className="flex shrink-0 flex-col items-start sm:items-end">
                        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                          {t('payments.col.amount')}
                        </span>
                        <span className="mt-0.5 bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-[15px] font-extrabold tabular-nums tracking-tight text-transparent dark:from-emerald-400 dark:to-teal-300">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>

                      {/* Status + Controls */}
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge
                          status={payment.status}
                          label={t(`payments.status.${payment.status}`)}
                        />

                        <div className="hidden items-center sm:flex">
                          <InlineStatusSelector
                            value={payment.status}
                            onChange={(s) => handleUpdateStatus(payment.id, s)}
                            disabled={isUpdatingStatus}
                            ariaLabel={t('payments.updateStatusFor', { name: studentName })}
                            t={t}
                          />
                        </div>

                        {isUpdatingStatus && (
                          <motion.span
                            className="h-3.5 w-3.5 rounded-full border-2 border-blue-500/30 border-t-blue-600"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                          />
                        )}

                        {/* AI Debt Reminder Shortcut for Pending / Overdue Payments */}
                        {(payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
                          <motion.button
                            type="button"
                            onClick={() => setAiDebtTarget(payment)}
                            whileHover={{ scale: 1.07, y: -1 }}
                            whileTap={{ scale: 0.93 }}
                            transition={SPRING.snappy}
                            aria-label={t('payments.sidecar.sendAiReminder')}
                            title={t('payments.sidecar.sendAiReminder')}
                            className="h-9 w-9 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/[0.08] text-amber-600 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.8)] backdrop-blur-md transition-colors hover:border-amber-400/70 hover:bg-amber-500/[0.16] hover:text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/[0.12] dark:text-amber-300"
                          >
                            <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                          </motion.button>
                        )}

                        {/* Sidecar Split-View Optical Button with guaranteed >= 44x44px touch target */}
                        <motion.button
                          type="button"
                          onClick={() => handleOpenPaymentSidecar(payment)}
                          whileHover={{ scale: 1.07, y: -1 }}
                          whileTap={{ scale: 0.93 }}
                          transition={SPRING.snappy}
                          aria-label={t('payments.sidecarAria')}
                          title={t('payments.sidecarTitle')}
                          className="h-9 w-9 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border border-white/80 bg-white/60 text-slate-600 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.9),0_2px_6px_rgba(15,23,42,0.05)] backdrop-blur-md transition-colors hover:border-blue-400/50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-slate-300 dark:hover:text-blue-400"
                        >
                          <Icon paths={I.sidecar} size={15} strokeWidth={2} />
                        </motion.button>

                        {/* Liquid Sapphire Receipt Button with guaranteed >= 44px min height & touch target */}
                        <motion.button
                          type="button"
                          onClick={() => setReceiptTarget(payment)}
                          whileHover={{ scale: 1.05, y: -1 }}
                          whileTap={{ scale: 0.94 }}
                          transition={SPRING.snappy}
                          aria-label={t('payments.receipt')}
                          title={t('payments.receipt')}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[11.5px] font-bold tracking-tight outline-none backdrop-blur-md focus-visible:ring-2 focus-visible:ring-blue-500"
                          style={{
                            background: LIQUID_TONES.sapphire.surface,
                            color: LIQUID_TONES.sapphire.fg,
                            border: `1px solid ${LIQUID_TONES.sapphire.rim}`,
                            boxShadow:
                              'inset 0 1px 0.5px rgba(255,255,255,0.8), 0 4px 10px -4px rgba(37,99,235,0.28)',
                          }}
                        >
                          <Icon
                            paths={I.receipt}
                            size={13.5}
                            strokeWidth={2.2}
                            className="dark:brightness-125"
                          />
                          <span className="hidden dark:brightness-125 sm:inline">
                            {t('payments.receipt')}
                          </span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="relative border-t border-slate-900/[0.05] px-5 py-3.5 dark:border-white/[0.06]">
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </motion.div>

      {/* Fast Floating Action Island */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        entityName={t('payments.entityName')}
        actions={[
          {
            label: t('payments.bulkMarkPaid'),
            shortcut: 'P',
            icon: <Icon paths={I.check} size={13} strokeWidth={2.4} />,
            variant: 'primary',
            onClick: handleBatchMarkAsPaid,
          },
          {
            label: t('payments.bulkExportCsv'),
            shortcut: 'C',
            icon: <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />,
            variant: 'default',
            onClick: handleExportSelectedPaymentsCSV,
          },
        ]}
      />
    </>
  )}

      {/* ============================================================
          CREATE PAYMENT MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('payments.form.title')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Liquid Jade Hint Banner */}
          <div
            className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl px-4 py-3.5 backdrop-blur-xl"
            style={{
              background: LIQUID_TONES.jade.surface,
              border: `1px solid ${LIQUID_TONES.jade.rim}`,
              boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.75)',
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{
                background: LIQUID_TONES.jade.orbGradient,
                boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.6)',
              }}
            >
              <Icon paths={I.sparkles} size={17} strokeWidth={2.1} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-slate-800 dark:text-slate-100">
              {t('payments.modalSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField
              label={t('payments.form.student')}
              required
              error={formErrors.studentId ? t(formErrors.studentId) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.user} tone="amethyst" />
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={formErrors.studentId ? 'student-error' : undefined}
                  className="pl-11"
                >
                  <option value="">{t('payments.form.selectStudent')}</option>
                  {studentList.map((student) => (
                    <option key={student.id} value={student.id}>
                      {formatStudentName(student)}
                    </option>
                  ))}
                </GlassSelect>
              </div>
              {formErrors.studentId && (
                <span id="student-error" className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                  {t(formErrors.studentId)}
                </span>
              )}
            </GlassField>

            <GlassField
              label={
                <div className="flex items-center justify-between">
                  <span>{t('payments.form.amount')}</span>
                  <button
                    type="button"
                    onClick={() => setSplitCalcOpen((v) => !v)}
                    className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    💱 {t('payments.calculator.button')}
                  </button>
                </div>
              }
              required
              error={formErrors.amount ? t(formErrors.amount) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.cash} tone="jade" />
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={handleFormChange('amount')}
                  required
                  aria-invalid={Boolean(formErrors.amount)}
                  aria-describedby={formErrors.amount ? 'amount-error' : undefined}
                  placeholder="299.99"
                  className="pl-11"
                />
              </div>
              {formErrors.amount && (
                <span id="amount-error" className="mt-1 text-sm text-rose-600 dark:text-rose-400">
                  {t(formErrors.amount)}
                </span>
              )}
            </GlassField>

            <GlassField label={t('payments.form.method')}>
              <div className="relative">
                <FieldIcon icon={I.creditCard} tone="sapphire" />
                <GlassSelect
                  value={form.method}
                  onChange={handleFormChange('method')}
                  aria-label={t('payments.form.method')}
                  className="pl-11"
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {t(`payments.method.${method}`)}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>

            <GlassField label={t('payments.form.dueDate')}>
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="amber" />
                <GlassInput
                  type="date"
                  value={form.dueDate}
                  onChange={handleFormChange('dueDate')}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          {splitCalcOpen && (
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-2">
              <CurrencySplitCalculator
                requiredAmountUzs={parseSafeAmount(form.amount) || 0}
                onApplyPayment={({ cashUzs, changeUzs }) => {
                  setSplitCalcOpen(false);
                  const netAmount = Math.max(0, cashUzs - changeUzs);
                  setForm((prev) => ({
                    ...prev,
                    amount: String(netAmount || cashUzs),
                    description:
                      changeUzs > 0
                        ? `${prev.description ? prev.description + ' · ' : ''}Qaytim: ${changeUzs.toLocaleString('uz-UZ')} UZS`
                        : prev.description,
                  }));
                }}
                onClose={() => setSplitCalcOpen(false)}
              />
            </div>
          )}

          <GlassField label={t('common.description')}>
            <GlassInput
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder={t('common.optionalDescription')}
            />
          </GlassField>

          <div className="flex justify-end gap-2.5 border-t border-slate-900/[0.06] pt-4 dark:border-white/[0.08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
                disabled={create.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={create.isPending}
                className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !shadow-[0_10px_20px_-6px_rgba(37,99,235,0.45),inset_0_1px_0.5px_rgba(255,255,255,0.5)]"
              >
                <span className="inline-flex items-center gap-2">
                  {create.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('payments.saving')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      {t('payments.add')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          RECEIPT MODAL
      ============================================================ */}
      <GlassModal
        open={receiptTarget !== null}
        onClose={() => setReceiptTarget(null)}
        title={t('payments.receipt')}
        wide
      >
        {receiptTarget && (
          <div className="space-y-5">
            <div id="medu-printable-receipt" className={`${LIQUID_CARD} p-6 text-slate-900 dark:text-white`}>
              <LiquidMeniscus />

              {/* Header */}
              <div className="relative flex items-start justify-between border-b border-slate-900/[0.06] pb-4 dark:border-white/[0.08]">
                <div className="flex items-start gap-3.5">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-2xl text-[15px] font-black text-white"
                    style={{
                      background: LIQUID_TONES.sapphire.orbGradient,
                      boxShadow:
                        '0 10px 20px -6px rgba(37,99,235,0.45), inset 0 1.5px 1px rgba(255,255,255,0.65)',
                    }}
                  >
                    {t('payments.receipt.academyName').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-[16.5px] font-bold tracking-tight">
                      {t('payments.receipt.academyName')}
                    </h3>
                    <p className="mt-0.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                      {t('payments.receipt.title')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="inline-block rounded-xl px-2.5 py-1 font-mono text-[11px] font-bold"
                    style={{
                      background: LIQUID_TONES.sapphire.surface,
                      color: LIQUID_TONES.sapphire.fg,
                      border: `1px solid ${LIQUID_TONES.sapphire.rim}`,
                    }}
                  >
                    RCP-{receiptTarget.id.slice(0, 8).toUpperCase()}
                  </span>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {formatDate(receiptTarget.createdAt)}
                  </p>
                </div>
              </div>

              {/* Student / Status */}
              <div className="relative mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {t('payments.form.student')}
                  </span>
                  <p className="mt-1 text-[14.5px] font-semibold tracking-tight">
                    {formatStudentName(receiptTarget.student)}
                  </p>
                  {receiptTarget.student?.user?.email && (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                      <Icon paths={I.mail} size={11} strokeWidth={2} className="opacity-70" />
                      {receiptTarget.student?.user?.email}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {t('common.status')}
                  </span>
                  <div className="mt-1.5">
                    <StatusBadge
                      status={receiptTarget.status}
                      label={t(`payments.status.${receiptTarget.status}`)}
                    />
                  </div>
                </div>
              </div>

              {/* Recessed Optical Ledger Panel */}
              <div className={`relative mt-5 p-4 ${LIQUID_PILL_RECESSED}`}>
                <div className="flex items-center justify-between border-b border-slate-900/[0.06] pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:border-white/[0.06] dark:text-slate-500">
                  <span>{t('common.description')}</span>
                  <span>{t('payments.col.amount')}</span>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <span className="text-[13.5px] font-medium">
                    {receiptTarget.description || '—'}
                  </span>
                  <span className="text-[14.5px] font-bold tabular-nums">
                    {formatCurrency(receiptTarget.amount)}
                  </span>
                </div>
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-900/[0.06] pt-3.5 dark:border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t('payments.form.method')}:
                    </span>
                    <MethodChip
                      method={toPaymentMethod(receiptTarget.method)}
                      label={t(`payments.method.${toPaymentMethod(receiptTarget.method)}`)}
                    />
                  </div>
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      {t('payments.receipt.total')}
                    </span>
                    <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-[21px] font-black tracking-tight text-transparent dark:from-emerald-400 dark:to-teal-300">
                      {formatCurrency(receiptTarget.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification Footer */}
              <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/[0.06] pt-4 text-[11px] font-medium text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                <div className="inline-flex items-center gap-1.5">
                  <Icon paths={I.shield} size={14} strokeWidth={2.2} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{t('payments.receipt.footer')}</span>
                </div>
                <span className="font-mono text-slate-400">ID: {receiptTarget.id.slice(0, 12)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap justify-end gap-2.5">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setReceiptTarget(null)}
                >
                  {t('common.close')}
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setThermalReceiptTarget(receiptTarget)}
                  className="!rounded-2xl !border-emerald-400/35 !bg-emerald-500/[0.08] hover:!bg-emerald-500/[0.14]"
                >
                  <span className="inline-flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Icon paths={I.receipt} size={15} strokeWidth={2.2} />
                    {t('payments.posThermalReceipt')}
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => window.print()}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.printer} size={15} strokeWidth={2} />
                    {t('payments.receipt.print')}
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={() => setPdfStudioOpen(true)}
                  className="!rounded-2xl !border-white/30 !bg-gradient-to-r !from-blue-600 !via-indigo-600 !to-violet-600 !text-white !shadow-[0_12px_24px_-6px_rgba(37,99,235,0.45),inset_0_1.5px_1px_rgba(255,255,255,0.5)]"
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                    {t('payments.receipt.pdfStudio')}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        )}
      </GlassModal>

      {/* Executive PDF Studio */}
      {receiptTarget && (
        <ExecutivePDFStudio
          open={pdfStudioOpen}
          onClose={() => setPdfStudioOpen(false)}
          initialData={{
            id: `RCP-${receiptTarget.id.slice(0, 8).toUpperCase()}`,
            docType: 'receipt',
            title: "To'lov Kvitansiyasi / Official Receipt",
            recipientName: formatStudentName(receiptTarget.student),
            recipientId: receiptTarget.studentId || undefined,
            amount: formatCurrency(receiptTarget.amount),
            dateStr: formatDate(receiptTarget.createdAt),
            items: [
              { label: "O'quvchi / Student", value: formatStudentName(receiptTarget.student) },
              { label: "To'lov usuli / Method", value: t(`payments.method.${toPaymentMethod(receiptTarget.method)}`) },
              { label: 'Status / Status', value: t(`payments.status.${receiptTarget.status}`) },
              { label: 'Izoh / Description', value: receiptTarget.description || "O'quv kursi to'lovi" },
              { label: 'Sana / Transaction Date', value: formatDate(receiptTarget.createdAt) },
            ],
          }}
        />
      )}

      {/* POS Thermal Receipt Modal */}
      <PosThermalReceiptModal
        open={thermalReceiptTarget !== null}
        onClose={() => setThermalReceiptTarget(null)}
        payment={thermalReceiptTarget}
      />

      {/* AI Smart Debt Reminder Modal */}
      <AiDebtReminderModal
        open={aiDebtTarget !== null}
        onClose={() => setAiDebtTarget(null)}
        payment={aiDebtTarget}
      />

      {/* Cashier Shift Reconciliation & Z-Report Modal */}
      <CashierZReportModal
        open={zReportModalOpen}
        onClose={() => setZReportModalOpen(false)}
        onShiftClosed={() => void refetchPayments()}
      />
    </motion.div>
  );
}