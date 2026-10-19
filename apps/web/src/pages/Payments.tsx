/**
 * M-EDU PaymentsPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient wallet tile + live stats chips + primary CTA
 *  - Animated KPI bar (Total, Paid, Pending, Overdue) with count-up
 *  - Premium filter toolbar with squircle leading icons
 *  - Premium payment rows: gradient avatar + method chip + status badge + amount
 *  - Inline status segmented control (tone-aware)
 *  - Premium receipt modal with M-EDU branded print layout
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n preserved
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
import { useI18n } from '@/i18n/I18nProvider';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

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
    'M6 12h.01', 'M18 12h.01',
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
    'M12 8v4', 'M12 16h.01',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.35-4.35',
  ],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  receipt: [
    'M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z',
    'M8 8h8', 'M8 12h8', 'M8 16h5',
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
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  trending: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  mail: [
    'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M22 6 12 13 2 6',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
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
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
};

/* ============================================================================
 * CONSTANTS
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
  PAID: 'emerald',
  PENDING: 'orange',
  OVERDUE: 'red',
  CANCELLED: 'gray',
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
  CASH: 'emerald',
  CARD: 'blue',
  BANK_TRANSFER: 'purple',
  PAYME: 'cyan',
  CLICK: 'blue',
  UZUM: 'purple',
  OTHER: 'gray',
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
 * HELPERS
 * ========================================================================== */

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

/** Normalizes a loosely-typed API method value into a known PaymentMethod. */
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

function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
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
}

function PaymentsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-12 w-full" radius="1rem" />
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
      setN(value * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums">{Math.round(n).toLocaleString('uz-UZ')}</span>;
}

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: number;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.35), transparent)' }}
      />
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
        />
        <Icon paths={icon} size={18} strokeWidth={2} className="relative" />
      </div>
      <div className="relative min-w-0 flex-1">
        <div className="text-[22px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

/** Premium status badge with pulse */
function StatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
  const tone = STATUS_TONE[status];
  const c = TONES[tone];
  const pulse = STATUS_PULSE[status];
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {pulse && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ background: c.fg, opacity: 0.6 }}
            animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: c.fg }} />
      </span>
      {label}
    </span>
  );
}

/** Method chip */
function MethodChip({ method, label }: { method: PaymentMethod; label: string }) {
  const tone = METHOD_TONE[method] ?? 'gray';
  const c = TONES[tone];
  const icon = METHOD_ICON[method] ?? METHOD_ICON.OTHER;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
      style={{
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      <Icon paths={icon} size={10} strokeWidth={2.2} />
      {label}
    </span>
  );
}

/** Squircle leading icon for inputs */
function FieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg"
      style={{ background: c.bg, color: c.fg }}
      aria-hidden
    >
      <Icon paths={icon} size={12} strokeWidth={2.2} />
    </span>
  );
}

/** Inline status segmented control (compact) */
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
      className="inline-flex items-center gap-0.5 rounded-xl border border-[#00000008] bg-[#00000002] p-0.5 dark:border-[#ffffff08] dark:bg-[#ffffff04]"
    >
      {PAYMENT_STATUSES.map((s) => {
        const active = value === s;
        const c = TONES[STATUS_TONE[s]];
        return (
          <motion.button
            key={s}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(s)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            className="relative flex h-6 w-6 items-center justify-center rounded-lg outline-none disabled:opacity-40"
            title={t(`payments.status.${s}`)}
            aria-label={t(`payments.status.${s}`)}
            style={{
              background: active ? c.bg : 'transparent',
              color: active ? c.fg : '#B0B0B5',
              border: active ? `1px solid ${c.border}` : '1px solid transparent',
            }}
          >
            <Icon paths={STATUS_ICON[s]} size={11} strokeWidth={2.4} />
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
  const { t } = useI18n();
  usePageTitle(t('payments.title'));
  const { push, toastNode } = useToasts();
  const qc = useQueryClient();

  /* ── Filter state ─────────────────────────────────────────────────── */
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  /* ── Modal state ──────────────────────────────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null);
  const [pdfStudioOpen, setPdfStudioOpen] = useState(false);

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
    const totalAmount = paymentList
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    return { total, paid, pending, overdue, totalAmount };
  }, [paymentList]);

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenPaymentSidecar = useCallback((payment: Payment) => {
    const studentName = formatStudentName(payment.student);
    const data: QuickLookData = {
      id: payment.id,
      type: 'payment',
      title: formatCurrency(payment.amount),
      subtitle: `${studentName} · ${payment.method}`,
      badge: {
        text: payment.status,
        tone: payment.status === 'PAID' ? 'emerald' : payment.status === 'PENDING' ? 'amber' : 'rose',
      },
      avatar: {
        text: getInitials(studentName),
        color: payment.status === 'PAID' ? '#10B981' : '#6366F1',
      },
      metrics: [
        { label: 'Summa', value: formatCurrency(payment.amount), trend: 'up' },
        { label: 'Holat', value: payment.status },
        { label: 'To\'lov usuli', value: payment.method || 'CASH' },
        { label: 'Sana', value: formatDate(payment.createdAt) },
      ],
      details: [
        { label: 'To\'lov ID', value: payment.id, copyable: true },
        { label: 'Talaba', value: studentName },
        { label: 'Izoh / Tavsif', value: payment.description || 'To\'lov qayd etildi' },
        { label: 'O\'zgartirilgan', value: formatDate((payment as any).updatedAt || payment.createdAt) },
      ],
      primaryAction: {
        label: 'Rasmiy Kvitansiya (PDF Studio)',
        onExecute: () => setReceiptTarget(payment),
      },
    };
    openSidecar(data);
  }, []);

  /* ── Superhuman Keyboard-First Navigation ─────────────────────────── */
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
    push('success', `${count} ta to'lov "To'langan" deb yangilandi`);
  };

  const handleExportSelectedPaymentsCSV = () => {
    const selectedRows = paymentList.filter((p) => isSelected(p.id));
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['ID,Student,Amount,Status,Method,Date']
        .concat(
          selectedRows.map(
            (p) =>
              `"${p.id}","${formatStudentName(p.student)}","${p.amount}","${p.status}","${p.method}","${p.createdAt}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payments_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    push('success', `${selectedRows.length} ta to'lov CSV formatida yuklandi`);
  };

  /* ── Create mutation ──────────────────────────────────────────────── */
  const create = useMutation({
    mutationFn: () =>
      paymentsApi.create({
        studentId: form.studentId,
        amount: parseFloat(form.amount) || 0,
        description: form.description.trim() || undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        method: form.method,
      }),
    onSuccess: () => {
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
      push('error', getErrorMessage(e));
    },
  });

  /* ── Update status mutation ───────────────────────────────────────── */
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      paymentsApi.update(id, { status }),
    onSuccess: () => {
      push('success', t('payments.updated'));
      qc.invalidateQueries({ queryKey: queryKeys.payments.all() });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all() });
    },
    onError: (e: Error) => {
      push('error', getErrorMessage(e));
    },
  });

  /* ── Validators ───────────────────────────────────────────────────── */
  const validateForm = useCallback((): boolean => {
    const errors: Partial<Record<keyof PaymentFormState, string>> = {};
    if (!form.studentId) {
      errors.studentId = 'payments.validation.studentRequired';
    }
    if (!form.amount || parseFloat(form.amount) <= 0) {
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
      updateStatus.mutate({ id: paymentId, status: newStatus });
    },
    [updateStatus],
  );

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
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
        <PaymentsSkeleton />
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (payments.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
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
      className="page-container space-y-5"
    >
      {toastNode}

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card sm:p-7"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {/* Gradient wallet tile */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #34C759 0%, #32ADE6 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(52,199,89,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.wallet} size={28} strokeWidth={2.2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Payments
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {totalPayments} {totalPayments === 1 ? t('payments.countOne') : t('payments.countMany')}
                </span>
                {stats.overdue > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B30]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF3B30]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF3B30]" />
                    {stats.overdue} overdue
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('payments.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('payments.subtitle')}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <motion.div
                whileHover={{ scale: 1.03 }}
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
                          prompt: "Qarzdor o'quvchilar, kechikkan to'lovlar va umumiy kassa intizomi bo'yicha tahliliy hisobot ber.",
                        },
                      }),
                    );
                  }}
                  className="!border-purple-500/30 hover:!border-purple-500/50"
                >
                  <span className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium">
                    <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                    AI Tahlil
                  </span>
                </GlassButton>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton type="button" variant="primary" onClick={handleOpenModal}>
                  <span className="inline-flex items-center gap-2">
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
          KPI STATS
      ============================================================ */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <KpiTile label={t('payments.allStatuses')} value={stats.total} icon={I.receipt} tone="blue" />
        <KpiTile label={t('payments.status.PAID')} value={stats.paid} icon={I.checkCircle} tone="emerald" />
        <KpiTile label={t('payments.status.PENDING')} value={stats.pending} icon={I.clock} tone="orange" />
        <KpiTile label={t('payments.status.OVERDUE')} value={stats.overdue} icon={I.alertCircle} tone="red" />
      </motion.div>

      {/* ============================================================
          FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <FieldIcon icon={I.search} tone="blue" />
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
            <div className="relative sm:w-56">
              <FieldIcon icon={I.filter} tone="orange" />
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
          PAYMENTS LIST
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />

        {paymentList.length === 0 ? (
          <div className="relative p-10">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#007AFF]/10 text-[#007AFF]"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(0,122,255,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {hasActiveFilters ? t('payments.emptyFiltered') : t('payments.empty')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
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
            <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
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
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 transition-all ${
                      isRowFocused
                        ? 'ring-2 ring-[#007AFF] bg-[#007AFF]/[0.06] rounded-xl'
                        : isRowSelected
                        ? 'bg-[#007AFF]/[0.04]'
                        : 'hover:bg-[#34C759]/[0.03]'
                    }`}
                  >
                    {/* Student Info Group */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(payment.id);
                        }}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                          isRowSelected
                            ? 'border-[#007AFF] bg-[#007AFF] text-white'
                            : 'border-zinc-300 bg-white/50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50'
                        }`}
                        aria-label={isRowSelected ? "Tanlovni bekor qilish" : "Tanlash"}
                      >
                        {isRowSelected && (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                      {/* Avatar */}
                      <div
                        className="relative flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
                        style={{
                          background: gradient,
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,0,0,0.25)',
                        }}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 rounded-full"
                          style={{
                            background:
                              'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)',
                          }}
                        />
                        <span className="relative">{initials}</span>
                      </div>

                      {/* Student + meta */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {studentName}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[#86868B]">
                          <span className="inline-flex items-center gap-1 tabular-nums shrink-0">
                            <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                            {formatDate(payment.createdAt)}
                          </span>
                          <MethodChip
                            method={toPaymentMethod(payment.method)}
                            label={t(`payments.method.${toPaymentMethod(payment.method)}`)}
                          />
                          {payment.description && (
                            <span
                              className="max-w-[12rem] sm:max-w-[16rem] truncate"
                              title={payment.description}
                            >
                              {payment.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Amount, Status & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0 shrink-0">
                      {/* Amount */}
                      <div className="flex flex-col items-start sm:items-end shrink-0">
                        <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                          {t('payments.col.amount')}
                        </span>
                        <span className="mt-0.5 text-[14px] sm:text-[15px] font-bold tabular-nums tracking-tight text-[#10B981]">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>

                      {/* Status badge + inline selector */}
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge
                          status={payment.status}
                          label={t(`payments.status.${payment.status}`)}
                        />
                        <div className="hidden sm:flex items-center">
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
                            className="h-3.5 w-3.5 rounded-full border-2 border-[#007AFF]/30 border-t-[#007AFF]"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                          />
                        )}

                        {/* Sidecar Split-View trigger */}
                        <motion.button
                          type="button"
                          onClick={() => handleOpenPaymentSidecar(payment)}
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.92 }}
                          aria-label="Sidecar tafsilotlarini ochish"
                          title="Sidecar tafsilotlari (Split-View · Space)"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle bg-surface/80 text-secondary hover:text-primary hover:border-primary/40 transition-colors"
                        >
                          <span className="text-[13px] leading-none">◨</span>
                        </motion.button>

                        {/* Receipt action */}
                        <motion.button
                          type="button"
                          onClick={() => setReceiptTarget(payment)}
                          whileHover={{ scale: 1.06, y: -1 }}
                          whileTap={{ scale: 0.94 }}
                          transition={SPRING.snappy}
                          aria-label={t('payments.receipt')}
                          title={t('payments.receipt')}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-2 sm:px-2.5 text-[11px] font-bold tracking-tight outline-none"
                          style={{
                            background: 'rgba(0,122,255,0.10)',
                            color: '#007AFF',
                            border: '1px solid rgba(0,122,255,0.2)',
                          }}
                        >
                          <Icon paths={I.receipt} size={12} strokeWidth={2.2} />
                          <span className="hidden sm:inline">{t('payments.receipt')}</span>
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="relative border-t border-[#00000008] px-4 py-3 dark:border-[#ffffff08]">
              <GlassPagination
                page={page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </motion.div>

      {/* Superhuman Floating Action Island */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClearSelection={clearSelection}
        entityName="to'lov"
        actions={[
          {
            label: "To'langan deb belgilash",
            shortcut: 'P',
            icon: <Icon paths={I.check} size={13} strokeWidth={2.4} />,
            variant: 'primary',
            onClick: handleBatchMarkAsPaid,
          },
          {
            label: 'CSV Eksport',
            shortcut: 'C',
            icon: <Icon paths={I.sparkles} size={13} strokeWidth={2.2} />,
            variant: 'default',
            onClick: handleExportSelectedPaymentsCSV,
          },
        ]}
      />

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
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#34C75933] bg-[#34C759]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#34C759]/15 text-[#34C759]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
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
                <FieldIcon icon={I.user} tone="purple" />
                <GlassSelect
                  value={form.studentId}
                  onChange={handleFormChange('studentId')}
                  required
                  aria-invalid={Boolean(formErrors.studentId)}
                  aria-describedby={
                    formErrors.studentId ? 'student-error' : undefined
                  }
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
                <span
                  id="student-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {t(formErrors.studentId)}
                </span>
              )}
            </GlassField>

            <GlassField
              label={t('payments.form.amount')}
              required
              error={formErrors.amount ? t(formErrors.amount) : undefined}
            >
              <div className="relative">
                <FieldIcon icon={I.cash} tone="emerald" />
                <GlassInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={handleFormChange('amount')}
                  required
                  aria-invalid={Boolean(formErrors.amount)}
                  aria-describedby={
                    formErrors.amount ? 'amount-error' : undefined
                  }
                  placeholder="299.99"
                  className="pl-11"
                />
              </div>
              {formErrors.amount && (
                <span
                  id="amount-error"
                  className="mt-1 text-sm"
                  style={{ color: 'var(--state-error)' }}
                >
                  {t(formErrors.amount)}
                </span>
              )}
            </GlassField>

            <GlassField label={t('payments.form.method')}>
              <div className="relative">
                <FieldIcon icon={I.creditCard} tone="blue" />
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
                <FieldIcon icon={I.calendar} tone="orange" />
                <GlassInput
                  type="date"
                  value={form.dueDate}
                  onChange={handleFormChange('dueDate')}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          <GlassField label={t('common.description')}>
            <GlassInput
              value={form.description}
              onChange={handleFormChange('description')}
              placeholder={t('common.optionalDescription')}
            />
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
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
              <GlassButton type="submit" variant="primary" disabled={create.isPending}>
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
            <div
              id="medu-printable-receipt"
              className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/90 p-6 text-[var(--text-primary)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/90 dark:text-[var(--text-primary)] shadow-card"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-black/[0.05] pb-4 dark:border-white/[0.05]">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-[15px] font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    {t('payments.receipt.academyName').charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold tracking-tight">
                      {t('payments.receipt.academyName')}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                      {t('payments.receipt.title')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-lg bg-[#007AFF]/10 px-2 py-1 font-mono text-[11px] font-bold text-[#007AFF]">
                    RCP-{receiptTarget.id.slice(0, 8).toUpperCase()}
                  </span>
                  <p className="mt-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                    {formatDate(receiptTarget.createdAt)}
                  </p>
                </div>
              </div>

              {/* Student / Status */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {t('payments.form.student')}
                  </span>
                  <p className="mt-1 text-[14px] font-semibold tracking-tight">
                    {formatStudentName(receiptTarget.student)}
                  </p>
                  {receiptTarget.student?.user?.email && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-[var(--text-secondary)]">
                      <Icon paths={I.mail} size={11} strokeWidth={2} className="opacity-60" />
                      {receiptTarget.student.user.email}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                    {t('common.status')}
                  </span>
                  <div className="mt-1.5">
                    <StatusBadge
                      status={receiptTarget.status}
                      label={formatPaymentStatus(receiptTarget.status)}
                    />
                  </div>
                </div>
              </div>

              {/* Item + amount panel */}
              <div className="mt-5 rounded-2xl border border-black/[0.05] bg-black/[0.02] p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <div className="flex items-center justify-between border-b border-black/[0.05] pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)] dark:border-white/[0.05]">
                  <span>{t('common.description')}</span>
                  <span>{t('payments.col.amount')}</span>
                </div>
                <div className="flex items-center justify-between pt-3">
                  <span className="text-[13px] font-medium">
                    {receiptTarget.description || '—'}
                  </span>
                  <span className="text-[14px] font-bold tabular-nums">
                    {formatCurrency(receiptTarget.amount)}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-3 dark:border-white/[0.05]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {t('payments.form.method')}:
                    </span>
                    <MethodChip
                      method={toPaymentMethod(receiptTarget.method)}
                      label={t(`payments.method.${toPaymentMethod(receiptTarget.method)}`)}
                    />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {t('payments.receipt.total')}
                    </span>
                    <span className="text-[20px] font-black tracking-tighter text-[#34C759] dark:text-[#30D158]">
                      {formatCurrency(receiptTarget.amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification footer */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-4 text-[10.5px] font-medium text-[var(--text-tertiary)] dark:border-white/[0.05]">
                <div className="inline-flex items-center gap-1.5">
                  <Icon paths={I.shield} size={13} strokeWidth={2.2} className="text-[#34C759]" />
                  <span>{t('payments.receipt.footer')}</span>
                </div>
                <span className="font-mono">ID: {receiptTarget.id.slice(0, 12)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
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
                  className="!bg-gradient-to-r !from-blue-600 !to-indigo-600 !text-white !border-blue-400/40"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.sparkles} size={15} strokeWidth={2.2} />
                    Executive PDF Studio
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
              { label: "Status / Status", value: t(`payments.status.${receiptTarget.status}`) },
              { label: "Izoh / Description", value: receiptTarget.description || "O'quv kursi to'lovi" },
              { label: "Sana / Transaction Date", value: formatDate(receiptTarget.createdAt) },
            ],
          }}
        />
      )}
    </motion.div>
  );
}