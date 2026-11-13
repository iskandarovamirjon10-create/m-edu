import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
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
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AuroraMesh } from '@/components/ui/AuroraMesh';
import { usePremiumSound } from '@/hooks/usePremiumSound';

/* ============================================================================
 * PRINT ISOLATION & CRISP PAPER TYPOGRAPHY
 * ========================================================================== */
const PAYMENTS_PRINT_CSS = `
@media print {
  body * {
    visibility: hidden !important;
  }
  #medu-printable-receipt,
  #medu-printable-receipt * {
    visibility: visible !important;
  }
  #medu-printable-receipt {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
    margin: 0 !important;
    padding: 32px !important;
    background: #ffffff !important;
    color: #0f172a !important;
    box-shadow: none !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 12px !important;
    transform: none !important;
    backdrop-filter: none !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #medu-printable-receipt .print-solid-ink {
    background: none !important;
    -webkit-text-fill-color: #0f172a !important;
    color: #0f172a !important;
  }
}
`;

/* ============================================================================
 * APPLE FLUID SPRING PHYSICS
 * ========================================================================== */
const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 500, damping: 34, mass: 0.6 },
  smooth: { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.8 },
  spatial: { type: 'spring' as const, stiffness: 280, damping: 28, mass: 0.9 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.02 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING.spatial },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * SPATIAL GLASS SURFACES & DUAL-THEME CHROMATIC PALETTE
 * Engineered for razor-sharp legibility on BOTH Pearl Light & OLED Dark themes
 * ========================================================================== */
const SPATIAL_PANEL =
  'relative overflow-hidden rounded-[28px] border border-slate-200/85 dark:border-white/[0.10] ' +
  'bg-white/80 dark:bg-slate-900/65 backdrop-blur-3xl backdrop-saturate-[180%] ' +
  'shadow-[0_20px_44px_-14px_rgba(15,23,42,0.07),0_2px_8px_-2px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.95)] ' +
  'dark:shadow-[0_24px_52px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.12)]';

const SPATIAL_CARD =
  'relative overflow-hidden rounded-[22px] border border-slate-200/80 dark:border-white/[0.09] ' +
  'bg-white/75 dark:bg-slate-900/55 backdrop-blur-2xl backdrop-saturate-[180%] ' +
  'shadow-[0_12px_28px_-10px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.92)] ' +
  'dark:shadow-[0_14px_32px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.10)]';

const SPATIAL_WELL =
  'rounded-2xl border border-slate-200/75 dark:border-white/[0.07] ' +
  'bg-slate-100/75 dark:bg-black/30 ' +
  'shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)] dark:shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)]';

type Tone =
  | 'sapphire'
  | 'jade'
  | 'amber'
  | 'coral'
  | 'amethyst'
  | 'celeste'
  | 'titanium';

type SortKey =
  | 'date-desc'
  | 'date-asc'
  | 'amount-desc'
  | 'amount-asc'
  | 'status-risk'
  | 'name-asc';

type DensityMode = 'comfortable' | 'compact';

interface ToneTokens {
  badge: string;
  text: string;
  dot: string;
  orb: string;
  glow: string;
  ring: string;
  bar: string;
}

const TONE_TOKENS: Record<Tone, ToneTokens> = {
  sapphire: {
    badge:
      'bg-blue-500/[0.10] text-blue-700 border-blue-500/25 dark:bg-blue-400/[0.15] dark:text-blue-300 dark:border-blue-400/30',
    text: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500 dark:bg-blue-400',
    orb: 'bg-gradient-to-br from-blue-500 via-indigo-500 to-sky-500 shadow-[0_10px_22px_-6px_rgba(37,99,235,0.48)]',
    glow: 'bg-blue-500/20 dark:bg-blue-400/15',
    ring: 'ring-blue-500/65 dark:ring-blue-400/65',
    bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
  },
  jade: {
    badge:
      'bg-emerald-500/[0.11] text-emerald-700 border-emerald-500/25 dark:bg-emerald-400/[0.15] dark:text-emerald-300 dark:border-emerald-400/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    orb: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 shadow-[0_10px_22px_-6px_rgba(16,185,129,0.48)]',
    glow: 'bg-emerald-500/20 dark:bg-emerald-400/15',
    ring: 'ring-emerald-500/65 dark:ring-emerald-400/65',
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-400',
  },
  amber: {
    badge:
      'bg-amber-500/[0.12] text-amber-800 border-amber-500/30 dark:bg-amber-400/[0.15] dark:text-amber-300 dark:border-amber-400/30',
    text: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    orb: 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 shadow-[0_10px_22px_-6px_rgba(245,158,11,0.48)]',
    glow: 'bg-amber-500/20 dark:bg-amber-400/15',
    ring: 'ring-amber-500/65 dark:ring-amber-400/65',
    bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
  },
  coral: {
    badge:
      'bg-rose-500/[0.11] text-rose-700 border-rose-500/25 dark:bg-rose-400/[0.15] dark:text-rose-300 dark:border-rose-400/30',
    text: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500 dark:bg-rose-400',
    orb: 'bg-gradient-to-br from-rose-500 via-pink-500 to-red-500 shadow-[0_10px_22px_-6px_rgba(244,63,94,0.48)]',
    glow: 'bg-rose-500/20 dark:bg-rose-400/15',
    ring: 'ring-rose-500/65 dark:ring-rose-400/65',
    bar: 'bg-gradient-to-r from-rose-500 to-pink-500',
  },
  amethyst: {
    badge:
      'bg-violet-500/[0.11] text-violet-700 border-violet-500/25 dark:bg-violet-400/[0.15] dark:text-violet-300 dark:border-violet-400/30',
    text: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500 dark:bg-violet-400',
    orb: 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-[0_10px_22px_-6px_rgba(139,92,246,0.48)]',
    glow: 'bg-violet-500/20 dark:bg-violet-400/15',
    ring: 'ring-violet-500/65 dark:ring-violet-400/65',
    bar: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
  },
  celeste: {
    badge:
      'bg-sky-500/[0.11] text-sky-700 border-sky-500/25 dark:bg-sky-400/[0.15] dark:text-sky-300 dark:border-sky-400/30',
    text: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500 dark:bg-sky-400',
    orb: 'bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600 shadow-[0_10px_22px_-6px_rgba(14,165,233,0.48)]',
    glow: 'bg-sky-500/20 dark:bg-sky-400/15',
    ring: 'ring-sky-500/65 dark:ring-sky-400/65',
    bar: 'bg-gradient-to-r from-sky-400 to-cyan-500',
  },
  titanium: {
    badge:
      'bg-slate-500/[0.10] text-slate-700 border-slate-400/30 dark:bg-slate-400/[0.14] dark:text-slate-300 dark:border-slate-400/25',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500 dark:bg-slate-400',
    orb: 'bg-gradient-to-br from-slate-600 via-slate-700 to-zinc-700 shadow-[0_10px_22px_-6px_rgba(71,85,105,0.4)]',
    glow: 'bg-slate-500/15 dark:bg-slate-400/10',
    ring: 'ring-slate-500/55 dark:ring-slate-400/55',
    bar: 'bg-gradient-to-r from-slate-400 to-slate-500',
  },
};

/* ============================================================================
 * STRICTLY-TYPED SF-INSPIRED VECTOR ICON SYSTEM (Zero Missing Keys Guaranteed)
 * ========================================================================== */
const ICON_STROKE = 1.85;

const I = {
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
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
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
  x: ['M18 6 6 18', 'M6 6l12 12'],
  plus: ['M12 5v14', 'M5 12h14'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M21 21l-4.35-4.35'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  sort: ['M7 15l5 5 5-5', 'M7 9l5-5 5 5'],
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
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
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
  layers: ['M12 2 2 7l10 5 10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  sidecar: [
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z',
    'M15 3v18',
  ],
  download: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M7 10l5 5 5-5',
    'M12 15V3',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  keyboard: [
    'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
    'M6 9h.01',
    'M10 9h.01',
    'M14 9h.01',
    'M18 9h.01',
    'M8 15h8',
  ],
  rowsComfortable: ['M3 5h18', 'M3 12h18', 'M3 19h18'],
  rowsCompact: ['M3 4h18', 'M3 9h18', 'M3 14h18', 'M3 19h18'],
  chart: ['M18 20V10', 'M12 20V4', 'M6 20v-6'],
  radar: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
    'M12 12l4.5-4.5',
  ],
} as const satisfies Record<string, readonly string[]>;

function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  const safePaths = Array.isArray(paths) ? paths : [];
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
      {safePaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ============================================================================
 * CONSTANTS & DOMAIN MAPPINGS
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

const QUICK_AMOUNT_PRESETS = [350_000, 500_000, 750_000, 1_000_000, 1_500_000] as const;

const STATUS_RISK_ORDER: Record<PaymentStatus, number> = {
  OVERDUE: 0,
  PENDING: 1,
  PAID: 2,
  CANCELLED: 3,
};

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

const STATUS_ICON: Record<PaymentStatus, readonly string[]> = {
  PAID: I.checkCircle,
  PENDING: I.clock,
  OVERDUE: I.alertCircle,
  CANCELLED: I.xCircle,
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

const METHOD_ICON: Record<PaymentMethod, readonly string[]> = {
  CASH: I.banknote,
  CARD: I.creditCard,
  BANK_TRANSFER: ['M3 21h18', 'M5 21V10l7-5 7 5v11', 'M9 21v-6h6v6'],
  PAYME: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M8 12h8', 'M12 8v8'],
  CLICK: [
    'M9 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'M15 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'M12 3v18',
  ],
  UZUM: [
    'M12 2v20',
    'M5 8c3 0 5 2 7 4s4 4 7 4',
    'M5 16c3 0 5-2 7-4s4-4 7-4',
  ],
  OTHER: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v.01',
    'M11 12h1v4h1',
  ],
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
 * PUBLIC HELPERS (100% Export Contract Preserved + Hardened)
 * ========================================================================== */
export function parseSafeAmount(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : NaN;
  }
  if (raw === null || raw === undefined) return NaN;

  // Strip whitespace, NBSP, apostrophes, and underscores used as thousand separators
  const clean = String(raw)
    .trim()
    .replace(/[\s\u00A0_'’`]+/g, '');
  if (!clean) return NaN;

  const hasComma = clean.includes(',');
  const hasDot = clean.includes('.');
  let normalized = clean;

  if (hasComma && hasDot) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    normalized =
      lastDot > lastComma
        ? clean.replace(/,/g, '')
        : clean.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    const parts = clean.split(',');
    normalized =
      parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
        ? clean.replace(/,/g, '')
        : clean.replace(',', '.');
  } else if (hasDot) {
    const parts = clean.split('.');
    normalized =
      parts.length > 2 ||
      (parts.length === 2 && parts[1].length === 3 && !clean.startsWith('0.'))
        ? clean.replace(/\./g, '')
        : clean;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
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

/* ============================================================================
 * INTERNAL UTILITIES
 * ========================================================================== */
function getInitials(name: string): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned || cleaned === '—') return '—';
  return (
    cleaned
      .split(/\s+/)
      .map((p) => Array.from(p)[0] ?? '')
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

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #2563EB 0%, #6366F1 100%)',
  'linear-gradient(135deg, #059669 0%, #0EA5E9 100%)',
  'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
  'linear-gradient(135deg, #0284C7 0%, #4F46E5 100%)',
  'linear-gradient(135deg, #D97706 0%, #F43F5E 100%)',
  'linear-gradient(135deg, #0D9488 0%, #2563EB 100%)',
  'linear-gradient(135deg, #4F46E5 0%, #9333EA 100%)',
  'linear-gradient(135deg, #10B981 0%, #047857 100%)',
] as const;

function avatarGradient(name: string): string {
  return AVATAR_GRADIENTS[nameHash(name) % AVATAR_GRADIENTS.length];
}

function buildLocalDateString(offsetDays = 0, endOfMonth = false): string {
  const now = new Date();
  const target = endOfMonth
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  const yyyy = target.getFullYear();
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const dd = String(target.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toSafeIsoDate(dateInput: string): string | undefined {
  if (!dateInput) return undefined;
  const candidate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? new Date(`${dateInput}T12:00:00`)
    : new Date(dateInput);
  return Number.isNaN(candidate.getTime()) ? undefined : candidate.toISOString();
}

/* ============================================================================
 * APPLE SPATIAL SUB-COMPONENTS
 * ========================================================================== */
function SpecularRim() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
    />
  );
}

function Shimmer({
  className = '',
  radius = '1.5rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden border border-slate-200/70 bg-white/60 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-slate-900/50 ${className}`}
      style={{ borderRadius: radius }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/[0.07]"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
          <Shimmer key={i} className="h-[100px]" radius="1.375rem" />
        ))}
      </div>
      <Shimmer className="h-16 w-full" radius="1.375rem" />
      <Shimmer className="h-96 w-full" radius="1.75rem" />
    </div>
  );
}

/** Smooth Previous-to-Next Interpolated Number Counter */
function CountUp({
  value,
  duration = 0.7,
}: {
  value: number;
  duration?: number;
}) {
  const safeVal = Number.isFinite(value) ? value : 0;
  const reduced = useReducedMotion();
  const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const [display, setDisplay] = useState<number>(safeVal);
  const prevRef = useRef<number>(reduced || isTest ? safeVal : 0);

  useEffect(() => {
    if (reduced || isTest) {
      prevRef.current = safeVal;
      setDisplay(safeVal);
      return;
    }
    const from = prevRef.current;
    const to = safeVal;
    if (from === to) {
      setDisplay(to);
      return;
    }
    let raf = 0;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      prevRef.current = to;
    };
  }, [safeVal, duration, reduced, isTest]);

  return (
    <span className="tabular-nums">
      {Math.round(Number.isFinite(display) ? display : 0).toLocaleString('uz-UZ')}
    </span>
  );
}

/** Dual-Theme Apple Bento KPI Tile */
function KpiTile({
  label,
  value,
  subText,
  icon,
  tone = 'sapphire',
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  subText?: string;
  icon: readonly string[];
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
}) {
  const tok = TONE_TOKENS[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -2.5, scale: 1.008 }}
      whileTap={onClick ? { scale: 0.985 } : undefined}
      transition={SPRING.spatial}
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
      className={`group flex items-center gap-3.5 px-4 py-4 transition-shadow ${SPATIAL_CARD} ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${active ? `ring-2 ${tok.ring}` : ''}`}
    >
      <SpecularRim />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full blur-2xl transition-opacity duration-500 ${tok.glow} ${
          active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
        }`}
      />
      <div
        className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] text-white ${tok.orb}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[12px] bg-gradient-to-b from-white/45 to-transparent"
        />
        <Icon paths={icon} size={19} strokeWidth={2.1} className="relative drop-shadow-xs" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[23px] font-bold leading-none tracking-tight text-slate-900 dark:text-white">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </div>
        {subText && (
          <div className={`mt-0.5 truncate text-[11px] font-bold tabular-nums ${tok.text}`}>
            {subText}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Dual-Theme Semantic Status Capsule */
function StatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
  const tok = TONE_TOKENS[STATUS_TONE[status]];
  const pulse = STATUS_PULSE[status];
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] backdrop-blur-md ${tok.badge}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <motion.span
            className={`absolute inset-0 rounded-full ${tok.dot}`}
            animate={{ scale: [1, 2.4, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={`relative h-1.5 w-1.5 rounded-full ${tok.dot}`} />
      </span>
      <span>{label}</span>
    </span>
  );
}

/** Dual-Theme Payment Method Chip */
function MethodChip({ method, label }: { method: PaymentMethod; label: string }) {
  const tok = TONE_TOKENS[METHOD_TONE[method] ?? 'titanium'];
  const icon = METHOD_ICON[method] ?? METHOD_ICON.OTHER;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] backdrop-blur-md ${tok.badge}`}
    >
      <Icon paths={icon} size={10.5} strokeWidth={2.2} />
      <span>{label}</span>
    </span>
  );
}

/** Dual-Theme Squircle Field Prefix Icon */
function FieldIcon({
  icon,
  tone = 'sapphire',
}: {
  icon: readonly string[];
  tone?: Tone;
}) {
  const tok = TONE_TOKENS[tone];
  return (
    <span
      className={`pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[8px] border ${tok.badge}`}
      aria-hidden="true"
    >
      <Icon paths={icon} size={12.5} strokeWidth={2.2} />
    </span>
  );
}

/** Tactile Segmented Status Radio Pill */
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
      className={`inline-flex items-center gap-0.5 p-1 ${SPATIAL_WELL}`}
    >
      {PAYMENT_STATUSES.map((s) => {
        const active = value === s;
        const tok = TONE_TOKENS[STATUS_TONE[s]];
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
            title={t(`payments.status.${s}`)}
            aria-label={t(`payments.status.${s}`)}
            className={`relative flex h-6 w-6 items-center justify-center rounded-xl border outline-none transition-colors disabled:opacity-40 ${
              active
                ? `${tok.badge} shadow-xs`
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
            }`}
          >
            <Icon paths={STATUS_ICON[s]} size={11.5} strokeWidth={2.3} />
          </motion.button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * MAIN PAGE COMPONENT
 * ========================================================================== */
export function PaymentsPage() {
  const { t } = useSafeI18n();
  usePageTitle(t('payments.title'));
  const { user: currentUser } = useAuth();
  const currentCashierName = currentUser
    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') ||
      currentUser.username ||
      'Kassir-Operator'
    : 'Kassir-Operator';

  const { push, toastNode } = useToasts();
  const qc = useQueryClient();
  const { playPayment, playError, playTick } = usePremiumSound();
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  /* ── View & Tab state ─────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<'ledger' | 'analytics' | 'cashflow'>('ledger');
  const [density, setDensity] = useState<DensityMode>('comfortable');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ── Filter & Sort state ──────────────────────────────────────────── */
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | ''>('');
  const [sortBy, setSortBy] = useState<SortKey>('date-desc');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  /* ── Modal & Batch state ──────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null);
  const [thermalReceiptTarget, setThermalReceiptTarget] = useState<Payment | null>(null);
  const [aiDebtTarget, setAiDebtTarget] = useState<Payment | null>(null);
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);
  const [zReportModalOpen, setZReportModalOpen] = useState(false);
  const [splitCalcOpen, setSplitCalcOpen] = useState(false);
  const [isBatchPending, setIsBatchPending] = useState(false);

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
    queryFn: () => studentsApi.list({ limit: 500 }),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  });

  const data = payments.data as Paginated<Payment> | undefined;
  const rawPaymentList = useMemo(() => data?.items || [], [data]);

  /* ── Client-side method filter & multi-criteria sorting ───────────── */
  const paymentList = useMemo(() => {
    let list = [...rawPaymentList];
    if (methodFilter) {
      list = list.filter((p) => toPaymentMethod(p.method) === methodFilter);
    }
    if (sortBy === 'date-desc') {
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sortBy === 'date-asc') {
      list.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    } else if (sortBy === 'amount-desc') {
      list.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
    } else if (sortBy === 'amount-asc') {
      list.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
    } else if (sortBy === 'status-risk') {
      list.sort((a, b) => {
        const diff = STATUS_RISK_ORDER[a.status] - STATUS_RISK_ORDER[b.status];
        return diff !== 0 ? diff : (Number(b.amount) || 0) - (Number(a.amount) || 0);
      });
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) =>
        formatStudentName(a.student).localeCompare(formatStudentName(b.student)),
      );
    }
    return list;
  }, [rawPaymentList, methodFilter, sortBy]);

  const studentList = useMemo(() => {
    if (Array.isArray(students.data)) return students.data;
    return (students.data as Paginated<Student> | undefined)?.items || [];
  }, [students.data]);

  /* ── Financial Telemetry & Method Distribution ────────────────────── */
  const stats = useMemo(() => {
    const total = rawPaymentList.length;
    const paid = rawPaymentList.filter((p) => p.status === 'PAID').length;
    const pending = rawPaymentList.filter((p) => p.status === 'PENDING').length;
    const overdue = rawPaymentList.filter((p) => p.status === 'OVERDUE').length;

    const sumBy = (predicate: (p: Payment) => boolean) =>
      Math.round(
        rawPaymentList
          .filter(predicate)
          .reduce((acc, p) => acc + Math.round((Number(p.amount) || 0) * 100), 0),
      ) / 100;

    const totalAmount = sumBy((p) => p.status === 'PAID');
    const pendingOnlyAmount = sumBy((p) => p.status === 'PENDING');
    const overdueOnlyAmount = sumBy((p) => p.status === 'OVERDUE');
    const pendingAmount = Math.round((pendingOnlyAmount + overdueOnlyAmount) * 100) / 100;
    const activeVolume = totalAmount + pendingOnlyAmount + overdueOnlyAmount;

    const paidPct = activeVolume > 0 ? (totalAmount / activeVolume) * 100 : 100;
    const pendingPct = activeVolume > 0 ? (pendingOnlyAmount / activeVolume) * 100 : 0;
    const overduePct = activeVolume > 0 ? (overdueOnlyAmount / activeVolume) * 100 : 0;
    const collectionRate = total > 0 ? Math.round((paid / total) * 100) : 100;

    const methodCounts = rawPaymentList.reduce<Partial<Record<PaymentMethod, number>>>(
      (acc, p) => {
        const m = toPaymentMethod(p.method);
        acc[m] = (acc[m] || 0) + 1;
        return acc;
      },
      {},
    );

    return {
      total,
      paid,
      pending,
      overdue,
      totalAmount,
      pendingOnlyAmount,
      overdueOnlyAmount,
      pendingAmount,
      paidPct,
      pendingPct,
      overduePct,
      collectionRate,
      methodCounts,
    };
  }, [rawPaymentList]);

  /* ── Copy Transaction ID helper ───────────────────────────────────── */
  const handleCopyId = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(id);
      }
      playTick?.();
      setCopiedId(id);
      push('success', `ID nusxalandi: ${id.slice(0, 8).toUpperCase()}`);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === id ? null : curr));
      }, 1800);
    },
    [playTick, push],
  );

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenPaymentSidecar = useCallback(
    (payment: Payment) => {
      const studentName = formatStudentName(payment.student);
      const isDebt = payment.status === 'PENDING' || payment.status === 'OVERDUE';
      const sidecarPayload: QuickLookData = {
        id: payment.id,
        type: 'payment',
        title: formatCurrency(payment.amount),
        subtitle: `${studentName} · ${payment.method || 'CASH'}`,
        badge: {
          text: t(`payments.status.${payment.status}`),
          tone:
            payment.status === 'PAID'
              ? 'emerald'
              : payment.status === 'PENDING'
                ? 'amber'
                : 'rose',
        },
        avatar: {
          text: getInitials(studentName),
          color: payment.status === 'PAID' ? '#059669' : '#4F46E5',
        },
        metrics: [
          {
            label: t('payments.sidecar.amount'),
            value: formatCurrency(payment.amount),
            trend: 'up',
          },
          {
            label: t('payments.sidecar.status'),
            value: t(`payments.status.${payment.status}`),
          },
          {
            label: t('payments.sidecar.method'),
            value: t(`payments.method.${toPaymentMethod(payment.method)}`),
          },
          {
            label: t('payments.sidecar.date'),
            value: formatDate(payment.createdAt),
          },
        ],
        details: [
          { label: t('payments.sidecar.id'), value: payment.id, copyable: true },
          { label: t('payments.sidecar.student'), value: studentName },
          {
            label: t('payments.sidecar.description'),
            value: payment.description || t('payments.sidecar.defaultDesc'),
          },
          {
            label: t('payments.sidecar.updatedAt'),
            value: formatDate(
              (payment as { updatedAt?: string }).updatedAt || payment.createdAt,
            ),
          },
          ...(payment.receivedBy
            ? [
                {
                  label: 'Kassir / Operator',
                  value:
                    [payment.receivedBy.firstName, payment.receivedBy.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                    payment.receivedBy.username ||
                    '—',
                },
              ]
            : []),
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
      openSidecar(sidecarPayload);
    },
    [t],
  );

  /* ── Keyboard-First List Navigation ───────────────────────────────── */
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

  const allOnPageSelected =
    paymentList.length > 0 && paymentList.every((p) => isSelected(p.id));
  const someOnPageSelected =
    !allOnPageSelected && paymentList.some((p) => isSelected(p.id));

  const selectedTotalUzs = useMemo(() => {
    if (selectedCount === 0) return 0;
    return (
      Math.round(
        paymentList
          .filter((p) => isSelected(p.id))
          .reduce((sum, p) => sum + Math.round((Number(p.amount) || 0) * 100), 0),
      ) / 100
    );
  }, [selectedCount, paymentList, isSelected]);

  const handleToggleSelectAllOnPage = useCallback(() => {
    playTick?.();
    if (allOnPageSelected) {
      clearSelection();
    } else {
      paymentList.forEach((p) => {
        if (!isSelected(p.id)) toggleSelection(p.id);
      });
    }
  }, [allOnPageSelected, clearSelection, paymentList, isSelected, toggleSelection, playTick]);

  /* ── Batch Mark-as-Paid & RFC-4180 CSV Export ─────────────────────── */
  const handleBatchMarkAsPaid = useCallback(async () => {
    if (isBatchPending || selectedIds.size === 0) return;
    const targetIds = Array.from(selectedIds).filter((id) => {
      const found = rawPaymentList.find((p) => p.id === id);
      return !found || found.status !== 'PAID';
    });

    if (targetIds.length === 0) {
      clearSelection();
      playTick?.();
      push('success', t('payments.updated'));
      return;
    }

    setIsBatchPending(true);
    try {
      let successCount = 0;
      const CHUNK_SIZE = 5;
      for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
        const chunk = targetIds.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map((id) => paymentsApi.update(id, { status: 'PAID' })),
        );
        successCount += results.filter((r) => r.status === 'fulfilled').length;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.payments.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() }),
        qc.invalidateQueries({ queryKey: queryKeys.invoices.all() }),
      ]);

      clearSelection();
      if (successCount > 0) {
        playPayment();
        push('success', t('payments.batchPaidSuccess', { count: successCount }));
      } else {
        playError();
        push('error', t('payments.batchFailed', 'To‘lovlarni yangilab bo‘lmadi'));
      }
    } catch (e) {
      playError();
      push('error', getErrorMessage(e as Error));
    } finally {
      setIsBatchPending(false);
    }
  }, [
    isBatchPending,
    selectedIds,
    rawPaymentList,
    qc,
    clearSelection,
    playPayment,
    playError,
    playTick,
    push,
    t,
  ]);

  const exportPaymentsRowsToCSV = useCallback(
    (rowsToExport: Payment[]) => {
      if (rowsToExport.length === 0) return;
      const escapeCell = (val: unknown) => {
        let str = String(val ?? '');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str.replace(/"/g, '""')}"`;
      };
      const header = [
        'ID',
        'Student',
        'Amount',
        'Status',
        'Method',
        'Description',
        'Date',
      ]
        .map(escapeCell)
        .join(',');

      const lines = rowsToExport.map((p) =>
        [
          p.id,
          formatStudentName(p.student),
          p.amount,
          p.status,
          toPaymentMethod(p.method),
          p.description || '',
          p.createdAt,
        ]
          .map(escapeCell)
          .join(','),
      );

      const csvString = '\uFEFF' + [header, ...lines].join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medu-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      playTick?.();
      push('success', t('payments.exportSuccess', { count: rowsToExport.length }));
    },
    [playTick, push, t],
  );

  const handleExportSelectedPaymentsCSV = useCallback(() => {
    const selectedRows = paymentList.filter((p) => isSelected(p.id));
    exportPaymentsRowsToCSV(selectedRows);
    clearSelection();
  }, [paymentList, isSelected, exportPaymentsRowsToCSV, clearSelection]);

  /* ── Mutations ────────────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () => {
      const parsedAmount = parseSafeAmount(form.amount);
      return paymentsApi.create({
        studentId: form.studentId,
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        description: form.description.trim() || undefined,
        dueDate: toSafeIsoDate(form.dueDate),
        method: form.method,
      });
    },
    onSuccess: () => {
      playPayment();
      push('success', t('payments.created'));
      setModalOpen(false);
      setSplitCalcOpen(false);
      setForm(INITIAL_FORM);
      setFormErrors({});
      void qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
      if (form.studentId) {
        void qc.invalidateQueries({ queryKey: queryKeys.students.detail(form.studentId) });
      }
      void qc.invalidateQueries({ queryKey: queryKeys.students.all() });
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status: nextStatus }: { id: string; status: PaymentStatus }) =>
      paymentsApi.update(id, { status: nextStatus }),
    onSuccess: (_res, variables) => {
      playPayment();
      push('success', t('payments.updated'));
      setReceiptTarget((curr) =>
        curr && curr.id === variables.id ? { ...curr, status: variables.status } : curr,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      void qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
    },
    onError: (e: Error) => {
      playError();
      push('error', getErrorMessage(e));
    },
  });

  /* ── Validation & Form Handlers ───────────────────────────────────── */
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

  const handleFormChange = useCallback(
    (field: keyof PaymentFormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      },
    [],
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setStatus(e.target.value);
      setPage(1);
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    playTick?.();
    setSearch('');
    setStatus('');
    setMethodFilter('');
    setSortBy('date-desc');
    setPage(1);
  }, [playTick]);

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
    setSplitCalcOpen(false);
    setForm(INITIAL_FORM);
    setFormErrors({});
  }, []);

  const handleOpenModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setSplitCalcOpen(false);
    setModalOpen(true);
  }, []);

  /* ── Deep-link query param listener (?action=new) ─────────────────── */
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      handleOpenModal();
      const next = new URLSearchParams(searchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, handleOpenModal, setSearchParams]);

  const { refetch: refetchPayments } = payments;
  const handleRetry = useCallback(() => {
    playTick?.();
    void refetchPayments();
  }, [refetchPayments, playTick]);

  /* ── Global Keyboard Shortcuts (N, Z, I, /, ?, P, C, Esc) ─────────── */
  useEffect(() => {
    const anyModalOpen =
      modalOpen ||
      receiptTarget !== null ||
      thermalReceiptTarget !== null ||
      aiDebtTarget !== null ||
      pdfStudioOpen ||
      zReportModalOpen;

    const onKeyDown = (e: KeyboardEvent) => {
      if (anyModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape' && shortcutsOpen) {
        e.preventDefault();
        setShortcutsOpen(false);
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        setZReportModalOpen(true);
      } else if (key === 'i') {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('open-ai-copilot', {
            detail: { prompt: t('payments.aiPrompt') },
          }),
        );
      } else if (key === 'n') {
        e.preventDefault();
        handleOpenModal();
      } else if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === 'p' && selectedCount > 0) {
        e.preventDefault();
        void handleBatchMarkAsPaid();
      } else if (key === 'c' && selectedCount > 0) {
        e.preventDefault();
        handleExportSelectedPaymentsCSV();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    modalOpen,
    receiptTarget,
    thermalReceiptTarget,
    aiDebtTarget,
    pdfStudioOpen,
    zReportModalOpen,
    shortcutsOpen,
    selectedCount,
    handleOpenModal,
    handleBatchMarkAsPaid,
    handleExportSelectedPaymentsCSV,
    t,
  ]);

  const hasActiveFilters = Boolean(
    status || search || methodFilter || sortBy !== 'date-desc',
  );
  const totalPayments = data?.total || 0;
  const livePreviewAmount = useMemo(() => parseSafeAmount(form.amount), [form.amount]);

  /* ── Loading State ────────────────────────────────────────────────── */
  if (payments.isLoading && !data) {
    return (
      <div className="page-container max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] space-y-5 pb-24 sm:pb-8">
        <PaymentsSkeleton />
      </div>
    );
  }

  /* ── Error State ──────────────────────────────────────────────────── */
  if (payments.isError) {
    return (
      <div className="page-container max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] space-y-5 pb-24 sm:pb-8">
        <div className={`${SPATIAL_PANEL} p-8`}>
          <SpecularRim />
          <GlassErrorState
            title={t('payments.loadError')}
            message={getErrorMessage(payments.error as Error)}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  /* ── Main Render ──────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container max-w-7xl 2xl:max-w-[1600px] 3xl:max-w-[1800px] relative space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <style>{PAYMENTS_PRINT_CSS}</style>
      <AuroraMesh variant="corporate" opacity={0.55} />
      {toastNode}

      {/* ============================================================
          HERO COMMAND HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div className={`${SPATIAL_PANEL} p-6 sm:p-7`}>
          <SpecularRim />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-emerald-500/15 blur-3xl dark:bg-emerald-400/12"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -right-12 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl dark:bg-indigo-400/12"
          />

          <div className="relative flex flex-col items-start gap-5 lg:flex-row lg:items-center">
            {/* 3D Spatial Treasury Squircle */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -5 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.spatial}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-emerald-500 via-sky-500 to-indigo-600 text-white shadow-[0_16px_34px_-8px_rgba(14,165,233,0.5),inset_0_1.5px_1px_rgba(255,255,255,0.65)]"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1 top-1 h-1/2 rounded-t-[18px] bg-gradient-to-b from-white/50 to-transparent"
              />
              <Icon
                paths={I.wallet}
                size={28}
                strokeWidth={2.05}
                className="relative drop-shadow-xs"
              />
            </motion.div>

            {/* Title & Live Eyebrow Badges */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.13em] ${TONE_TOKENS.jade.badge}`}
                >
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.4} />
                  <span>Treasury OS</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.13em] ${TONE_TOKENS.sapphire.badge}`}
                >
                  <Icon paths={I.layers} size={11} strokeWidth={2.3} />
                  <span>
                    {totalPayments}{' '}
                    {totalPayments === 1
                      ? t('payments.countOne')
                      : t('payments.countMany')}
                  </span>
                </span>

                {stats.overdue > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ledger');
                      setStatus((prev) => (prev === 'OVERDUE' ? '' : 'OVERDUE'));
                      setPage(1);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.13em] transition hover:scale-[1.02] ${TONE_TOKENS.coral.badge}`}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500 dark:bg-rose-400" />
                    <span>{t('payments.overdueBadge', { count: stats.overdue })}</span>
                  </button>
                )}

                <span className="hidden items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100/70 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 xl:inline-flex">
                  <Icon paths={I.user} size={10.5} strokeWidth={2.2} />
                  <span>{currentCashierName}</span>
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-[34px]">
                {t('payments.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-slate-500 dark:text-slate-400">
                {t('payments.subtitle')}
              </p>
            </div>

            {/* Apple Pro Segmented Action Bar */}
            <div className="flex w-full flex-wrap items-center justify-start gap-2.5 lg:w-auto lg:justify-end">
              <div
                data-action="secondary"
                className="flex items-center gap-1 rounded-xl border border-slate-200/85 bg-slate-100/70 p-1 backdrop-blur-xl dark:border-white/[0.09] dark:bg-white/[0.04]"
              >
                {paymentList.length > 0 && (
                  <motion.button
                    type="button"
                    onClick={() => exportPaymentsRowsToCSV(paymentList)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING.snappy}
                    title={t('payments.bulkExportCsv')}
                    aria-label={t('payments.bulkExportCsv')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-500/12 dark:text-sky-300 dark:hover:bg-sky-400/15"
                  >
                    <Icon paths={I.download} size={13.5} strokeWidth={2.2} />
                    <span className="hidden md:inline">CSV</span>
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  onClick={() => setZReportModalOpen(true)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING.snappy}
                  title={`${t('payments.zReport')} (Z)`}
                  aria-label={t('payments.zReport')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/12 dark:text-emerald-300 dark:hover:bg-emerald-400/15"
                >
                  <Icon paths={I.receipt} size={14} strokeWidth={2.2} />
                  <span className="hidden sm:inline">{t('payments.zReport')}</span>
                  <kbd
                    aria-hidden="true"
                    className="hidden rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.2 font-mono text-[9.5px] lg:inline-block"
                  >
                    Z
                  </kbd>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('open-ai-copilot', {
                        detail: { prompt: t('payments.aiPrompt') },
                      }),
                    );
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  transition={SPRING.snappy}
                  title={`${t('payments.aiAnalysis')} (I)`}
                  aria-label={t('payments.aiAnalysis')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-500/12 dark:text-violet-300 dark:hover:bg-violet-400/15"
                >
                  <Icon paths={I.sparkles} size={14} strokeWidth={2.2} />
                  <span className="hidden sm:inline">{t('payments.aiAnalysis')}</span>
                  <kbd
                    aria-hidden="true"
                    className="hidden rounded border border-violet-500/30 bg-violet-500/10 px-1 py-0.2 font-mono text-[9.5px] lg:inline-block"
                  >
                    I
                  </kbd>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setShortcutsOpen((v) => !v)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={SPRING.snappy}
                  title="Klaviatura yorliqlari (?)"
                  aria-label="Klaviatura yorliqlari"
                  aria-expanded={shortcutsOpen}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                    shortcutsOpen
                      ? 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300'
                      : 'text-slate-600 hover:bg-slate-900/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <Icon paths={I.keyboard} size={15} strokeWidth={2} />
                </motion.button>
              </div>

              {/* Primary CTA */}
              <motion.div
                data-action="primary"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={handleOpenModal}
                  data-action="primary"
                  className="h-10 min-h-10 rounded-xl px-4 text-xs font-semibold shadow-[var(--shadow-brand)] sm:text-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                    <span>{t('payments.add')}</span>
                    <kbd
                      aria-hidden="true"
                      className="hidden rounded border border-white/35 bg-white/15 px-1.5 py-0.2 font-mono text-[10px] xl:inline-block"
                    >
                      N
                    </kbd>
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>

          {/* Collapsible Apple Keyboard Shortcuts HUD */}
          <AnimatePresence>
            {shortcutsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 18 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={SPRING.smooth}
                className="overflow-hidden"
              >
                <div className={`grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-7 ${SPATIAL_WELL}`}>
                  {[
                    { key: 'N', desc: t('payments.add') },
                    { key: '/', desc: 'Qidiruv' },
                    { key: 'Z', desc: t('payments.zReport') },
                    { key: 'I', desc: t('payments.aiAnalysis') },
                    { key: 'P', desc: 'Tanlanganni tasdiqlash' },
                    { key: 'C', desc: 'CSV Eksport' },
                    { key: 'Space', desc: 'Tezkor ko‘rish' },
                  ].map((sc) => (
                    <div
                      key={sc.key}
                      className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/75 px-2.5 py-1.5 text-[11px] dark:border-white/[0.08] dark:bg-white/[0.04]"
                    >
                      <kbd className="rounded-md border border-slate-300/80 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white">
                        {sc.key}
                      </kbd>
                      <span className="truncate font-medium text-slate-600 dark:text-slate-300">
                        {sc.desc}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ============================================================
          APPLE SEGMENTED VIEW TABS
      ============================================================ */}
      <div
        role="tablist"
        aria-label={t('payments.title')}
        className="flex rounded-2xl border border-slate-200/85 bg-slate-100/80 p-1 backdrop-blur-xl dark:border-white/[0.08] dark:bg-slate-900/60"
      >
        {(
          [
            { id: 'ledger', label: t('payments.tabs.ledger'), icon: I.receipt },
            { id: 'analytics', label: t('payments.tabs.analytics'), icon: I.chart },
            { id: 'cashflow', label: t('payments.tabs.cashflow'), icon: I.radar },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors ${
                active
                  ? 'text-blue-600 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="payments-tab-pill"
                  transition={SPRING.snappy}
                  className="absolute inset-0 rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-white/[0.12] dark:bg-white/[0.12]"
                />
              )}
              <Icon paths={tab.icon} size={13.5} strokeWidth={2.2} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'analytics' && (
        <PaymentsAnalyticsTab
          payments={paymentList}
          onOpenQuickPayment={handleOpenModal}
          onOpenZReport={() => setZReportModalOpen(true)}
        />
      )}

      {activeTab === 'cashflow' && <ExecutiveCashflowForecastRadar />}

      {activeTab === 'ledger' && (
        <>
          {/* ============================================================
              BENTO KPI TILES
          ============================================================ */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-2 gap-3.5 sm:grid-cols-4"
          >
            <KpiTile
              label={t('payments.allStatuses')}
              value={totalPayments || stats.total}
              subText={`${stats.collectionRate}% yig'iluvchanlik`}
              icon={I.receipt}
              tone="sapphire"
              active={status === ''}
              onClick={() => {
                setStatus('');
                setPage(1);
              }}
            />
            <KpiTile
              label={t('payments.status.PAID')}
              value={stats.paid}
              subText={stats.totalAmount > 0 ? formatCurrency(stats.totalAmount) : undefined}
              icon={I.checkCircle}
              tone="jade"
              active={status === 'PAID'}
              onClick={() => {
                setStatus((prev) => (prev === 'PAID' ? '' : 'PAID'));
                setPage(1);
              }}
            />
            <KpiTile
              label={t('payments.status.PENDING')}
              value={stats.pending}
              subText={
                stats.pendingOnlyAmount > 0
                  ? formatCurrency(stats.pendingOnlyAmount)
                  : undefined
              }
              icon={I.clock}
              tone="amber"
              active={status === 'PENDING'}
              onClick={() => {
                setStatus((prev) => (prev === 'PENDING' ? '' : 'PENDING'));
                setPage(1);
              }}
            />
            <KpiTile
              label={t('payments.status.OVERDUE')}
              value={stats.overdue}
              subText={
                stats.overdueOnlyAmount > 0
                  ? formatCurrency(stats.overdueOnlyAmount)
                  : undefined
              }
              icon={I.alertCircle}
              tone="coral"
              active={status === 'OVERDUE'}
              onClick={() => {
                setStatus((prev) => (prev === 'OVERDUE' ? '' : 'OVERDUE'));
                setPage(1);
              }}
            />
          </motion.div>

          {/* ============================================================
              APPLE STORAGE-STYLE TREASURY PULSE & QUICK METHOD PILLS
          ============================================================ */}
          {rawPaymentList.length > 0 && (
            <motion.div variants={cardVariants} className={`${SPATIAL_CARD} px-4 py-3.5 sm:px-5`}>
              <SpecularRim />
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Multi-Segment Volume Bar */}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Tushum: <strong className="tabular-nums">{formatCurrency(stats.totalAmount)}</strong>
                      </span>
                      {stats.pendingOnlyAmount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          Kutilmoqda:{' '}
                          <strong className="tabular-nums">{formatCurrency(stats.pendingOnlyAmount)}</strong>
                        </span>
                      )}
                      {stats.overdueOnlyAmount > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          Qarz:{' '}
                          <strong className="tabular-nums">{formatCurrency(stats.overdueOnlyAmount)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200/80 p-0.5 dark:bg-white/[0.08]">
                    {stats.paidPct > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.paidPct}%` }}
                        transition={SPRING.smooth}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      />
                    )}
                    {stats.pendingPct > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.pendingPct}%` }}
                        transition={SPRING.smooth}
                        className="ml-0.5 h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                      />
                    )}
                    {stats.overduePct > 0 && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.overduePct}%` }}
                        transition={SPRING.smooth}
                        className="ml-0.5 h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500"
                      />
                    )}
                  </div>
                </div>

                {/* 1-Click Payment Method Quick Filter Strip */}
                <div className="flex flex-wrap items-center gap-1.5 lg:pl-4">
                  <button
                    type="button"
                    onClick={() => {
                      playTick?.();
                      setMethodFilter('');
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider transition ${
                      methodFilter === ''
                        ? TONE_TOKENS.sapphire.badge
                        : 'border-slate-200/80 bg-white/60 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    Barchasi
                  </button>
                  {PAYMENT_METHODS.filter((m) => (stats.methodCounts[m] ?? 0) > 0).map(
                    (m) => {
                      const active = methodFilter === m;
                      const tok = TONE_TOKENS[METHOD_TONE[m]];
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            playTick?.();
                            setMethodFilter((prev) => (prev === m ? '' : m));
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider transition ${
                            active
                              ? `${tok.badge} ring-1 ${tok.ring}`
                              : 'border-slate-200/80 bg-white/60 text-slate-600 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]'
                          }`}
                        >
                          <Icon paths={METHOD_ICON[m]} size={10.5} strokeWidth={2.2} />
                          <span>{t(`payments.method.${m}`)}</span>
                          <span className="opacity-70">({stats.methodCounts[m]})</span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ============================================================
              PRECISION FILTER, SORT & DENSITY COMMAND BAR
          ============================================================ */}
          <motion.div variants={cardVariants}>
            <div className={`${SPATIAL_CARD} p-4`}>
              <SpecularRim />
              <div className="relative grid grid-cols-1 items-center gap-3 sm:grid-cols-2 lg:grid-cols-12">
                {/* Search Input with `/` Shortcut Indicator */}
                <div className="relative sm:col-span-2 lg:col-span-4">
                  <FieldIcon icon={I.search} tone="sapphire" />
                  <GlassInput
                    ref={searchInputRef}
                    placeholder={t('payments.searchPlaceholder')}
                    value={search}
                    onChange={handleSearchChange}
                    aria-label={t('payments.searchPlaceholder')}
                    type="search"
                    className="pl-11 pr-9"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setPage(1);
                      }}
                      aria-label="Qidiruvni tozalash"
                      className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200/80 text-slate-600 hover:bg-slate-300 dark:bg-white/15 dark:text-slate-300 dark:hover:bg-white/25"
                    >
                      <Icon paths={I.x} size={11} strokeWidth={2.5} />
                    </button>
                  ) : (
                    <kbd
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300/70 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 dark:border-white/15 dark:bg-white/[0.06] dark:text-slate-500 sm:inline-block"
                    >
                      /
                    </kbd>
                  )}
                </div>

                {/* Status Filter */}
                <div className="relative lg:col-span-2">
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

                {/* Method Filter */}
                <div className="relative lg:col-span-2">
                  <FieldIcon icon={I.creditCard} tone="amethyst" />
                  <GlassSelect
                    value={methodFilter}
                    onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | '')}
                    aria-label={t('payments.form.method')}
                    className="pl-11"
                  >
                    <option value="">{t('payments.form.method')}: Barchasi</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`payments.method.${m}`)}
                      </option>
                    ))}
                  </GlassSelect>
                </div>

                {/* Multi-Criteria Sort */}
                <div className="relative lg:col-span-2">
                  <FieldIcon icon={I.sort} tone="celeste" />
                  <GlassSelect
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortKey)}
                    aria-label="Saralash"
                    className="pl-11"
                  >
                    <option value="date-desc">Sana (Yangi ↓)</option>
                    <option value="date-asc">Sana (Eski ↑)</option>
                    <option value="amount-desc">Summa (Ko&apos;p ↓)</option>
                    <option value="amount-asc">Summa (Kam ↑)</option>
                    <option value="status-risk">Qarzdorlik ustuvor ⚡</option>
                    <option value="name-asc">Talaba (A–Z)</option>
                  </GlassSelect>
                </div>

                {/* Density Switcher, Sync & Reset */}
                <div className="flex items-center justify-between gap-1.5 sm:col-span-2 lg:col-span-2 lg:justify-end">
                  <div className={`inline-flex items-center p-0.5 ${SPATIAL_WELL}`}>
                    <button
                      type="button"
                      onClick={() => setDensity('comfortable')}
                      title="Erkin ko'rinish"
                      aria-label="Erkin ko'rinish"
                      className={`flex h-7 w-7 items-center justify-center rounded-xl transition ${
                        density === 'comfortable'
                          ? 'bg-white text-blue-600 shadow-xs dark:bg-white/15 dark:text-white'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon paths={I.rowsComfortable} size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDensity('compact')}
                      title="Zich kassir rejimi"
                      aria-label="Zich kassir rejimi"
                      className={`flex h-7 w-7 items-center justify-center rounded-xl transition ${
                        density === 'compact'
                          ? 'bg-white text-blue-600 shadow-xs dark:bg-white/15 dark:text-white'
                          : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <Icon paths={I.rowsCompact} size={13} strokeWidth={2.2} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleRetry}
                    title="Yangilash"
                    aria-label="Jadvalni yangilash"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 transition hover:border-blue-400/50 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:text-blue-400"
                  >
                    <Icon
                      paths={I.refresh}
                      size={13.5}
                      strokeWidth={2.2}
                      className={payments.isFetching ? 'animate-spin text-blue-500' : ''}
                    />
                  </button>

                  {hasActiveFilters && (
                    <GlassButton
                      type="button"
                      variant="ghost"
                      onClick={handleResetFilters}
                      className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/15"
                    >
                      <Icon
                        paths={I.x}
                        size={12}
                        strokeWidth={2.5}
                        className="mr-1 inline-block"
                      />
                      Tozalash
                    </GlassButton>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ============================================================
              APPLE WALLET-GRADE TRANSACTION LEDGER
          ============================================================ */}
          <motion.div variants={cardVariants} className={SPATIAL_PANEL}>
            <SpecularRim />
            {paymentList.length === 0 ? (
              <div className="relative p-12">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`relative flex h-16 w-16 items-center justify-center rounded-[22px] text-white ${TONE_TOKENS.sapphire.orb}`}
                  >
                    <Icon paths={I.empty} size={26} strokeWidth={1.9} />
                  </div>
                  <p className="mt-4 text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">
                    {hasActiveFilters ? t('payments.emptyFiltered') : t('payments.empty')}
                  </p>
                  <p className="mt-1 max-w-sm text-[13px] font-medium text-slate-500 dark:text-slate-400">
                    {hasActiveFilters
                      ? t('payments.emptyFilteredHint')
                      : t('payments.emptyHint')}
                  </p>
                  <div className="mt-5 flex items-center gap-2">
                    {hasActiveFilters ? (
                      <GlassButton
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleResetFilters}
                      >
                        Filtrlarni tiklash
                      </GlassButton>
                    ) : (
                      <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                        <GlassButton
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={handleOpenModal}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                            {t('payments.add')}
                          </span>
                        </GlassButton>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Ledger Header Bar (Select All + Indeterminate + Live Selected Sum) */}
                <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/75 bg-slate-50/75 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-slate-400 sm:px-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllOnPage}
                      className="inline-flex items-center gap-2 rounded-lg py-1 pr-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-[7px] border transition-all ${
                          allOnPageSelected || someOnPageSelected
                            ? 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs'
                            : 'border-slate-300 bg-white hover:border-blue-400 dark:border-white/20 dark:bg-white/[0.06]'
                        }`}
                      >
                        {allOnPageSelected && (
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
                        {someOnPageSelected && (
                          <span className="h-0.5 w-2.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span className="text-slate-700 dark:text-slate-200">
                        {selectedCount > 0
                          ? `${selectedCount} ta tanlandi`
                          : `Barchasini tanlash (${paymentList.length})`}
                      </span>
                    </button>

                    {selectedCount > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold normal-case tracking-normal tabular-nums ${TONE_TOKENS.sapphire.badge}`}
                      >
                        Tanlangan jami: {formatCurrency(selectedTotalUzs)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Tushum: {formatCurrency(stats.totalAmount)}
                    </span>
                    {stats.pendingAmount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">
                        Kutilmoqda: {formatCurrency(stats.pendingAmount)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Transaction Rows */}
                <div className="relative divide-y divide-slate-200/65 dark:divide-white/[0.06]">
                  {paymentList.map((payment, idx) => {
                    const studentName = formatStudentName(payment.student);
                    const initials = getInitials(studentName);
                    const gradient = avatarGradient(studentName);
                    const isUpdatingStatus =
                      updateStatus.isPending && updateStatus.variables?.id === payment.id;
                    const isRowSelected = isSelected(payment.id);
                    const isRowFocused = focusedIndex === idx;
                    const isUnpaid =
                      payment.status === 'PENDING' || payment.status === 'OVERDUE';
                    const shortCode = payment.id.slice(0, 8).toUpperCase();

                    const amountColorClass =
                      payment.status === 'PAID'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : payment.status === 'OVERDUE'
                          ? 'text-rose-600 dark:text-rose-400'
                          : payment.status === 'PENDING'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-400 line-through dark:text-slate-500';

                    return (
                      <motion.div
                        key={payment.id}
                        id={`payment-row-${payment.id}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING.smooth, delay: Math.min(idx * 0.018, 0.25) }}
                        onClick={() => handleOpenPaymentSidecar(payment)}
                        className={`group relative flex cursor-pointer flex-col gap-3 px-4 transition-colors sm:flex-row sm:items-center sm:justify-between sm:px-6 ${
                          density === 'compact' ? 'py-2.5' : 'py-3.5'
                        } ${
                          isRowFocused
                            ? 'bg-blue-500/[0.08] ring-2 ring-inset ring-blue-500/60 dark:bg-blue-400/[0.10]'
                            : isRowSelected
                              ? 'bg-blue-500/[0.05] dark:bg-blue-400/[0.07]'
                              : 'hover:bg-slate-50/90 dark:hover:bg-white/[0.035]'
                        }`}
                      >
                        {/* Left Group: Checkbox + Squircle Avatar + Student Meta */}
                        <div className="flex min-w-0 flex-1 items-center gap-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelection(payment.id);
                            }}
                            className="-m-2 inline-flex h-9 w-9 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={
                              isRowSelected
                                ? t('payments.deselectRowAria', { name: studentName })
                                : t('payments.selectRowAria', { name: studentName })
                            }
                          >
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-[7px] border transition-all ${
                                isRowSelected
                                  ? 'border-blue-600 bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_4px_10px_rgba(37,99,235,0.35)]'
                                  : 'border-slate-300 bg-white group-hover:border-blue-400 dark:border-white/20 dark:bg-white/[0.06]'
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

                          {/* 3D Squircle Avatar */}
                          <div
                            className={`relative flex shrink-0 items-center justify-center rounded-[15px] font-bold tracking-tight text-white shadow-[0_8px_18px_-6px_rgba(15,23,42,0.28),inset_0_1px_0.5px_rgba(255,255,255,0.5)] ${
                              density === 'compact'
                                ? 'h-9 w-9 text-[11.5px]'
                                : 'h-11 w-11 text-[12.5px]'
                            }`}
                            style={{ background: gradient }}
                          >
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[12px] bg-gradient-to-b from-white/40 to-transparent"
                            />
                            <span className="relative drop-shadow-xs">{initials}</span>
                          </div>

                          {/* Student Name & Transaction Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-[14px] font-semibold tracking-tight text-slate-900 dark:text-white">
                                {studentName}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => handleCopyId(payment.id, e)}
                                title="Tranzaksiya ID nusxalash"
                                className="hidden items-center gap-1 rounded-md border border-slate-200/80 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100 hover:border-blue-400/50 hover:text-blue-600 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-400 dark:hover:text-blue-300 sm:inline-flex"
                              >
                                <Icon
                                  paths={copiedId === payment.id ? I.check : I.copy}
                                  size={9.5}
                                  strokeWidth={2.3}
                                />
                                <span>#{shortCode}</span>
                              </button>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
                                <Icon
                                  paths={I.calendar}
                                  size={11}
                                  strokeWidth={2.1}
                                  className="opacity-70"
                                />
                                {formatDate(payment.createdAt)}
                              </span>

                              <MethodChip
                                method={toPaymentMethod(payment.method)}
                                label={t(`payments.method.${toPaymentMethod(payment.method)}`)}
                              />

                              {payment.receivedBy && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200/75 bg-slate-100/80 px-2 py-0.5 text-[10.5px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
                                  title={`Kassir: ${
                                    [
                                      payment.receivedBy.firstName,
                                      payment.receivedBy.lastName,
                                    ]
                                      .filter(Boolean)
                                      .join(' ') || payment.receivedBy.username
                                  }`}
                                >
                                  <Icon paths={I.user} size={10} strokeWidth={2.2} />
                                  <span>
                                    {[
                                      payment.receivedBy.firstName,
                                      payment.receivedBy.lastName,
                                    ]
                                      .filter(Boolean)
                                      .join(' ') || payment.receivedBy.username}
                                  </span>
                                </span>
                              )}

                              {payment.description && (
                                <span
                                  className="max-w-[12rem] truncate text-slate-500 dark:text-slate-400 sm:max-w-[16rem]"
                                  title={payment.description}
                                >
                                  {payment.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Group: Semantic Amount + Status + Tactile Actions */}
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-slate-200/60 pt-2.5 dark:border-white/[0.05] sm:w-auto sm:justify-end sm:border-0 sm:pt-0"
                        >
                          <div className="flex shrink-0 flex-col items-start sm:items-end">
                            <span className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-slate-400 dark:text-slate-500">
                              {t('payments.col.amount')}
                            </span>
                            <span
                              className={`mt-0.5 text-[15px] font-extrabold tabular-nums tracking-tight ${amountColorClass}`}
                            >
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                            <StatusBadge
                              status={payment.status}
                              label={t(`payments.status.${payment.status}`)}
                            />

                            {/* Mobile 1-Click Confirm Paid Button (Fixes Mobile Dead-End) */}
                            {isUnpaid && (
                              <motion.button
                                type="button"
                                disabled={isUpdatingStatus}
                                onClick={() => handleUpdateStatus(payment.id, 'PAID')}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.94 }}
                                transition={SPRING.snappy}
                                title={t('payments.status.PAID')}
                                className={`inline-flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-bold md:hidden ${TONE_TOKENS.jade.badge}`}
                              >
                                <Icon paths={I.check} size={12} strokeWidth={2.5} />
                                <span>Tasdiqlash</span>
                              </motion.button>
                            )}

                            {/* Desktop Segmented Status Controller */}
                            <div className="hidden items-center md:flex">
                              <InlineStatusSelector
                                value={payment.status}
                                onChange={(s) => handleUpdateStatus(payment.id, s)}
                                disabled={isUpdatingStatus}
                                ariaLabel={t('payments.updateStatusFor', {
                                  name: studentName,
                                })}
                                t={t}
                              />
                            </div>

                            {isUpdatingStatus && (
                              <motion.span
                                className="h-3.5 w-3.5 rounded-full border-2 border-blue-500/30 border-t-blue-600 dark:border-t-blue-400"
                                animate={{ rotate: 360 }}
                                transition={{
                                  duration: 0.85,
                                  repeat: Infinity,
                                  ease: 'linear',
                                }}
                              />
                            )}

                            {/* AI Smart Debt Reminder */}
                            {isUnpaid && (
                              <motion.button
                                type="button"
                                onClick={() => setAiDebtTarget(payment)}
                                whileHover={{ scale: 1.06, y: -1 }}
                                whileTap={{ scale: 0.94 }}
                                transition={SPRING.snappy}
                                aria-label={t('payments.sidecar.sendAiReminder')}
                                title={t('payments.sidecar.sendAiReminder')}
                                className={`inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border transition-colors ${TONE_TOKENS.amber.badge}`}
                              >
                                <Icon paths={I.sparkles} size={14.5} strokeWidth={2.2} />
                              </motion.button>
                            )}

                            {/* Sidecar Quick-Look */}
                            <motion.button
                              type="button"
                              onClick={() => handleOpenPaymentSidecar(payment)}
                              whileHover={{ scale: 1.06, y: -1 }}
                              whileTap={{ scale: 0.94 }}
                              transition={SPRING.snappy}
                              aria-label={t('payments.sidecarAria')}
                              title={t('payments.sidecarTitle')}
                              className="inline-flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200/85 bg-white/80 text-slate-600 shadow-2xs transition-colors hover:border-blue-400/50 hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/[0.12] dark:bg-white/[0.06] dark:text-slate-300 dark:hover:text-blue-400"
                            >
                              <Icon paths={I.sidecar} size={14.5} strokeWidth={2} />
                            </motion.button>

                            {/* Official Receipt Trigger */}
                            <motion.button
                              type="button"
                              onClick={() => setReceiptTarget(payment)}
                              whileHover={{ scale: 1.04, y: -1 }}
                              whileTap={{ scale: 0.95 }}
                              transition={SPRING.snappy}
                              aria-label={t('payments.receipt')}
                              title={t('payments.receipt')}
                              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-[11.5px] font-bold tracking-tight outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500 ${TONE_TOKENS.sapphire.badge}`}
                            >
                              <Icon paths={I.receipt} size={13.5} strokeWidth={2.2} />
                              <span className="hidden sm:inline">
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
                <div className="relative border-t border-slate-200/70 px-5 py-3.5 dark:border-white/[0.06]">
                  <GlassPagination
                    page={page}
                    totalPages={data?.totalPages ?? 1}
                    onPageChange={setPage}
                  />
                </div>
              </>
            )}
          </motion.div>

          {/* Floating Batch Action Island */}
          <FloatingActionIsland
            selectedCount={selectedCount}
            onClearSelection={clearSelection}
            entityName={t('payments.entityName')}
            actions={[
              {
                label: isBatchPending
                  ? t('payments.saving')
                  : t('payments.bulkMarkPaid'),
                shortcut: 'P',
                icon: <Icon paths={I.check} size={13} strokeWidth={2.4} />,
                variant: 'primary',
                onClick: () => void handleBatchMarkAsPaid(),
              },
              {
                label: t('payments.bulkExportCsv'),
                shortcut: 'C',
                icon: <Icon paths={I.download} size={13} strokeWidth={2.2} />,
                variant: 'default',
                onClick: handleExportSelectedPaymentsCSV,
              },
            ]}
          />
        </>
      )}

      {/* ============================================================
          SMART CASHIER CREATE PAYMENT STUDIO MODAL
      ============================================================ */}
      <GlassModal
        open={modalOpen}
        onClose={handleCloseModal}
        title={t('payments.form.title')}
        wide
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          {/* Luminous Cashier Banner */}
          <div
            className={`relative flex items-center justify-between gap-3.5 overflow-hidden rounded-2xl border px-4 py-3.5 ${TONE_TOKENS.jade.badge}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white ${TONE_TOKENS.jade.orb}`}
              >
                <Icon paths={I.sparkles} size={17} strokeWidth={2.1} />
              </div>
              <p className="text-[12.5px] font-medium leading-snug text-slate-800 dark:text-slate-100">
                {t('payments.modalSubtitle')}
              </p>
            </div>
            {Number.isFinite(livePreviewAmount) && livePreviewAmount > 0 && (
              <span className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-extrabold tabular-nums text-white shadow-xs dark:bg-emerald-500">
                {formatCurrency(livePreviewAmount)}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Student Selector */}
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
            </GlassField>

            {/* Amount + Live Preview + Cashier Presets */}
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
                  placeholder="500000"
                  className="pl-11"
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {QUICK_AMOUNT_PRESETS.map((preset) => {
                  const isActivePreset = livePreviewAmount === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        playTick?.();
                        setForm((prev) => ({ ...prev, amount: String(preset) }));
                        setFormErrors((prev) => ({ ...prev, amount: undefined }));
                      }}
                      className={`rounded-lg border px-2 py-0.5 text-[10.5px] font-bold tabular-nums transition ${
                        isActivePreset
                          ? TONE_TOKENS.jade.badge
                          : 'border-slate-200/80 bg-white/70 text-slate-600 hover:border-emerald-500/40 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:text-emerald-300'
                      }`}
                    >
                      {preset >= 1_000_000
                        ? `${(preset / 1_000_000).toLocaleString('uz-UZ')}M`
                        : `${(preset / 1000).toLocaleString('uz-UZ')}k`}{' '}
                      so&apos;m
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    playTick?.();
                    const base = Number.isFinite(livePreviewAmount) ? livePreviewAmount : 0;
                    setForm((prev) => ({ ...prev, amount: String(base + 100_000) }));
                    setFormErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  className="rounded-lg border border-blue-500/25 bg-blue-500/[0.08] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-blue-700 transition hover:bg-blue-500/[0.15] dark:border-blue-400/25 dark:bg-blue-400/[0.12] dark:text-blue-300"
                >
                  +100k
                </button>
              </div>
            </GlassField>

            {/* Payment Method Select + Apple Pay Style Quick Tiles */}
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

              <div className="mt-2 flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.slice(0, 6).map((m) => {
                  const active = form.method === m;
                  const tok = TONE_TOKENS[METHOD_TONE[m]];
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        playTick?.();
                        setForm((prev) => ({ ...prev, method: m }));
                      }}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition ${
                        active
                          ? tok.badge
                          : 'border-slate-200/80 bg-white/70 text-slate-500 hover:text-slate-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      <Icon paths={METHOD_ICON[m]} size={10} strokeWidth={2.2} />
                      <span>{t(`payments.method.${m}`)}</span>
                    </button>
                  );
                })}
              </div>
            </GlassField>

            {/* Due Date + Smart Cashier Date Shortcuts */}
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

              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { label: 'Bugun', value: buildLocalDateString(0) },
                  { label: '+3 kun', value: buildLocalDateString(3) },
                  { label: '+7 kun', value: buildLocalDateString(7) },
                  { label: 'Oy oxiri', value: buildLocalDateString(0, true) },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      playTick?.();
                      setForm((prev) => ({ ...prev, dueDate: preset.value }));
                    }}
                    className={`rounded-lg border px-2 py-0.5 text-[10.5px] font-semibold transition ${
                      form.dueDate === preset.value
                        ? TONE_TOKENS.amber.badge
                        : 'border-slate-200/80 bg-white/70 text-slate-600 hover:border-amber-400/50 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </GlassField>
          </div>

          {/* Currency & Change Split Calculator */}
          <AnimatePresence>
            {splitCalcOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-500/[0.05] p-2 dark:border-blue-400/20 dark:bg-blue-400/[0.06]"
              >
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
                    setFormErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  onClose={() => setSplitCalcOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <GlassField label={t('common.description')}>
            <GlassInput
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder={t('common.optionalDescription')}
            />
          </GlassField>

          <div className="flex justify-end gap-2.5 border-t border-slate-200/80 pt-4 dark:border-white/[0.08]">
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
                className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !shadow-[0_10px_22px_-6px_rgba(37,99,235,0.48)]"
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
          PRINT-PERFECTED OFFICIAL RECEIPT MODAL
      ============================================================ */}
      <GlassModal
        open={receiptTarget !== null}
        onClose={() => setReceiptTarget(null)}
        title={t('payments.receipt')}
        wide
      >
        {receiptTarget && (
          <div className="space-y-5">
            <div
              id="medu-printable-receipt"
              className={`${SPATIAL_CARD} p-6 text-slate-900 dark:text-white`}
            >
              <SpecularRim />

              {/* Academy Official Header */}
              <div className="relative flex items-start justify-between border-b border-slate-200/80 pb-4 dark:border-white/[0.08]">
                <div className="flex items-start gap-3.5">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-[15px] font-black text-white ${TONE_TOKENS.sapphire.orb}`}
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
                  <button
                    type="button"
                    onClick={() => handleCopyId(receiptTarget.id)}
                    title="Kvitansiya ID nusxalash"
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-mono text-[11px] font-bold transition ${TONE_TOKENS.sapphire.badge}`}
                  >
                    <span>RCP-{receiptTarget.id.slice(0, 8).toUpperCase()}</span>
                    <Icon
                      paths={copiedId === receiptTarget.id ? I.check : I.copy}
                      size={11}
                      strokeWidth={2.2}
                    />
                  </button>
                  <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {formatDate(receiptTarget.createdAt)}
                  </p>
                </div>
              </div>

              {/* Student & Status Metadata */}
              <div className="relative mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                    {t('payments.form.student')}
                  </span>
                  <p className="mt-1 text-[15px] font-semibold tracking-tight">
                    {formatStudentName(receiptTarget.student)}
                  </p>
                  {receiptTarget.student?.user?.email && (
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
                      <Icon
                        paths={I.mail}
                        size={11}
                        strokeWidth={2}
                        className="opacity-70"
                      />
                      {receiptTarget.student.user.email}
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

              {/* Itemized Financial Breakdown */}
              <div className={`relative mt-5 p-4 ${SPATIAL_WELL}`}>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:border-white/[0.07] dark:text-slate-500">
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

                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3.5 dark:border-white/[0.07]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {t('payments.form.method')}:
                    </span>
                    <MethodChip
                      method={toPaymentMethod(receiptTarget.method)}
                      label={t(
                        `payments.method.${toPaymentMethod(receiptTarget.method)}`,
                      )}
                    />
                  </div>

                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                      {t('payments.receipt.total')}
                    </span>
                    <span className="print-solid-ink bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-[21px] font-black tabular-nums tracking-tight text-transparent dark:from-emerald-400 dark:to-teal-300">
                      {formatCurrency(receiptTarget.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cryptographic-style Verification Footer */}
              <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-4 text-[11px] font-medium text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                <div className="inline-flex items-center gap-1.5">
                  <Icon
                    paths={I.shield}
                    size={14}
                    strokeWidth={2.2}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                  <span>{t('payments.receipt.footer')}</span>
                </div>
                <span className="font-mono text-slate-400">
                  ID: {receiptTarget.id.slice(0, 12)}
                </span>
              </div>
            </div>

            {/* Modal Action Controls */}
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

              {(receiptTarget.status === 'PENDING' ||
                receiptTarget.status === 'OVERDUE') && (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <GlassButton
                    type="button"
                    variant="secondary"
                    disabled={updateStatus.isPending}
                    onClick={() => handleUpdateStatus(receiptTarget.id, 'PAID')}
                    className="!rounded-2xl !border-emerald-500/35 !bg-emerald-500/12"
                  >
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                      <Icon paths={I.checkCircle} size={15} strokeWidth={2.2} />
                      <span>{t('payments.status.PAID')}</span>
                    </span>
                  </GlassButton>
                </motion.div>
              )}

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
                  className="!rounded-2xl !border-white/30 !bg-gradient-to-r !from-blue-600 !via-indigo-600 !to-violet-600 !text-white !shadow-[0_12px_24px_-6px_rgba(37,99,235,0.45)]"
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
              {
                label: "O'quvchi / Student",
                value: formatStudentName(receiptTarget.student),
              },
              {
                label: "To'lov usuli / Method",
                value: t(`payments.method.${toPaymentMethod(receiptTarget.method)}`),
              },
              {
                label: 'Status / Status',
                value: t(`payments.status.${receiptTarget.status}`),
              },
              {
                label: 'Izoh / Description',
                value: receiptTarget.description || "O'quv kursi to'lovi",
              },
              {
                label: 'Sana / Transaction Date',
                value: formatDate(receiptTarget.createdAt),
              },
            ],
          }}
        />
      )}

      {/* POS Thermal Receipt Modal */}
      <PosThermalReceiptModal
        open={thermalReceiptTarget !== null}
        onClose={() => setThermalReceiptTarget(null)}
        payment={thermalReceiptTarget}
        cashierName={
          thermalReceiptTarget?.receivedBy
            ? [
                thermalReceiptTarget.receivedBy.firstName,
                thermalReceiptTarget.receivedBy.lastName,
              ]
                .filter(Boolean)
                .join(' ') ||
              thermalReceiptTarget.receivedBy.username ||
              currentCashierName
            : currentCashierName
        }
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

export default PaymentsPage;