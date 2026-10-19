/**
 * M-EDU PayrollPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient payroll tile + period chip + primary CTA
 *  - Premium period selector (glass toolbar with squircle selects)
 *  - Animated KPI tiles with count-up + currency formatting
 *  - Premium payroll rows with gradient avatar + status dot pulse + workflow actions
 *  - macOS-style workflow (Review → Approve → Pay) with tone-aware buttons
 *  - Premium Calculate modal with earnings/deductions split panels
 *  - Premium Cancel modal with warning banner
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n preserved
 */

import { fetchAllPaginated } from '@/lib/fetchAllPaginated';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { payrollApi, teachersApi } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys.factory';
import {
  GlassErrorState,
  GlassModal,
  GlassSelect,
  GlassInput,
  GlassTextArea,
  useToast,
  GlassField,
  GlassButton,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { useI18n } from '@/i18n/I18nProvider';
import type { PayrollRun, PayrollPeriodSummary } from '@/lib/types';

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
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  payroll: [
    'M12 2v20',
    'M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ],
  wallet: [
    'M21 12V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4',
    'M21 12H17a2 2 0 0 0 0 4h4',
  ],
  cash: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 7v10',
    'M9 9.5C9 8.1 10.3 7 12 7s3 1.1 3 2.5S13.7 12 12 12s-3 1.1-3 2.5S10.3 17 12 17s3-1.1 3-2.5',
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
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  trending: ['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  ban: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M4.93 4.93l14.14 14.14',
  ],
  warning: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  play: ['M6 4l14 8-14 8z'],
  stop: ['M6 6h12v12H6z'],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  arrowDown: ['M12 5v14', 'M19 12l-7 7-7-7'],
  arrowUp: ['M12 19V5', 'M5 12l7-7 7 7'],
  receipt: [
    'M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z',
    'M8 8h8', 'M8 12h8', 'M8 16h5',
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

const PAYROLL_STATUS_KEYS: Record<string, string> = {
  DRAFT: 'payroll.status.DRAFT',
  CALCULATED: 'payroll.status.CALCULATED',
  REVIEWED: 'payroll.status.REVIEWED',
  APPROVED: 'payroll.status.APPROVED',
  PAID: 'payments.status.PAID',
  CANCELLED: 'payments.status.CANCELLED',
};

const SALARY_TYPE_KEYS: Record<string, string> = {
  MONTHLY: 'payroll.salaryType.MONTHLY',
  HOURLY: 'payroll.salaryType.HOURLY',
  PER_LESSON: 'payroll.salaryType.PER_LESSON',
};

const STATUS_TONE: Record<string, Tone> = {
  DRAFT: 'gray',
  CALCULATED: 'purple',
  REVIEWED: 'orange',
  APPROVED: 'blue',
  PAID: 'emerald',
  CANCELLED: 'red',
};

const STATUS_PULSE: Record<string, boolean> = {
  REVIEWED: true,
  PAID: true,
};

const CURRENT_PERIOD = (() => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
})();

const MONTH_KEYS = [
  'payroll.month.1', 'payroll.month.2', 'payroll.month.3', 'payroll.month.4',
  'payroll.month.5', 'payroll.month.6', 'payroll.month.7', 'payroll.month.8',
  'payroll.month.9', 'payroll.month.10', 'payroll.month.11', 'payroll.month.12',
];

interface CalculateFormState {
  teacherId: string;
  baseAmount: string;
  bonus: string;
  otherDeduction: string;
  overtimeHours: string;
  absenceDays: string;
  lateCount: string;
  latePenaltyPerEvent: string;
  notes: string;
}

const EMPTY_FORM: CalculateFormState = {
  teacherId: '',
  baseAmount: '',
  bonus: '',
  otherDeduction: '',
  overtimeHours: '',
  absenceDays: '',
  lateCount: '',
  latePenaltyPerEvent: '',
  notes: '',
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

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

function getPeriodLabel(year: number, month: number, t: (k: string) => string): string {
  return `${t(MONTH_KEYS[month - 1])} ${year}`;
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

function PayrollSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-32" radius="1.5rem" />)}
      </div>
      <Shimmer className="h-96 w-full" radius="1.75rem" />
    </div>
  );
}

/** Count-up animation */
function CountUp({
  value,
  duration = 1.1,
  prefix = '',
  suffix = '',
}: {
  value: number;
  duration?: number;
  prefix?: string;
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
      {prefix}
      {Math.round(n).toLocaleString('uz-UZ')}
      {suffix}
    </span>
  );
}

/** Premium KPI tile */
function KpiTile({
  label,
  value,
  icon,
  tone = 'blue',
  currency = false,
}: {
  label: string;
  value: number | string;
  icon: string[];
  tone?: Tone;
  currency?: boolean;
}) {
  const c = TONES[tone];
  const isNumber = typeof value === 'number';
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -4 }}
      transition={SPRING.smooth}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      {/* gloss */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-3xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
      />
      {/* tinted orb */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.14] transition-opacity group-hover:opacity-25"
        style={{ background: c.fg, filter: 'blur(30px)' }}
      />

      <div className="relative flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={15} strokeWidth={2.2} />
        </div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          {label}
        </p>
      </div>

      <div
        className="relative mt-3 text-[26px] font-bold tracking-tighter leading-none"
        style={{ color: currency ? c.fg : undefined }}
      >
        <span className={currency ? '' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}>
          {isNumber ? (
            currency ? (
              <CountUp value={value as number} prefix="" suffix="" />
            ) : (
              <CountUp value={value as number} />
            )
          ) : (
            value
          )}
        </span>
      </div>
    </motion.div>
  );
}

/** Premium currency KPI (avoids CountUp prefix issues) */
function CurrencyKpiTile({
  label,
  amount,
  icon,
  tone = 'emerald',
}: {
  label: string;
  amount: number;
  icon: string[];
  tone?: Tone;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -4 }}
      transition={SPRING.smooth}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 10px 30px -18px rgba(0,0,0,0.12)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-3xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent)' }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.14] transition-opacity group-hover:opacity-25"
        style={{ background: c.fg, filter: 'blur(30px)' }}
      />

      <div className="relative flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: c.bg,
            color: c.fg,
            border: `1px solid ${c.border}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 12px -6px ${c.glow}`,
          }}
        >
          <Icon paths={icon} size={15} strokeWidth={2.2} />
        </div>
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
          {label}
        </p>
      </div>

      <div
        className="relative mt-3 text-[22px] font-bold tracking-tighter leading-tight"
        style={{ color: c.fg }}
      >
        {formatCurrency(amount)}
      </div>
    </motion.div>
  );
}

/** Premium status badge with pulse */
function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const tone = STATUS_TONE[status] ?? 'gray';
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

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function PayrollPage() {
  const { t } = useI18n();
  usePageTitle(t('payroll.title'));
  const { push, toastNode } = useToast();
  const queryClient = useQueryClient();

  const [year, setYear] = useState(CURRENT_PERIOD.year);
  const [month, setMonth] = useState(CURRENT_PERIOD.month);

  const [calculateOpen, setCalculateOpen] = useState(false);
  const [form, setForm] = useState<CalculateFormState>(EMPTY_FORM);
  const [cancelTarget, setCancelTarget] = useState<PayrollRun | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  /* ── Queries ───────────────────────────────────────────────────────── */
  const summary = useQuery({
    queryKey: queryKeys.payroll.summary(year, month),
    queryFn: () => payrollApi.periodSummary({ year, month }) as Promise<PayrollPeriodSummary>,
  });

  const runs = useQuery({
    queryKey: queryKeys.payroll.runs(year, month),
    queryFn: () =>
      fetchAllPaginated(payrollApi.listRuns, { year, month }) as Promise<{
        items: PayrollRun[];
        total: number;
      }>,
  });

  const teachers = useQuery({
    queryKey: queryKeys.payroll.teachers(),
    queryFn: () =>
      fetchAllPaginated(teachersApi.list) as Promise<{
        items: Array<{ id: string; user: { firstName: string; lastName: string } }>;
      }>,
  });

  /* ── Invalidate ────────────────────────────────────────────────────── */
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.payroll.runs(year, month) });
    queryClient.invalidateQueries({ queryKey: queryKeys.payroll.summary(year, month) });
    queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
  };

  /* ── Mutations ─────────────────────────────────────────────────────── */
  const calculate = useMutation({
    mutationFn: (data: CalculateFormState) =>
      payrollApi.calculate({
        teacherId: data.teacherId,
        periodYear: year,
        periodMonth: month,
        baseAmount: data.baseAmount ? Number(data.baseAmount) : undefined,
        bonus: data.bonus ? Number(data.bonus) : undefined,
        otherDeduction: data.otherDeduction ? Number(data.otherDeduction) : undefined,
        overtimeHours: data.overtimeHours ? Number(data.overtimeHours) : undefined,
        absenceDays: data.absenceDays ? Number(data.absenceDays) : undefined,
        lateCount: data.lateCount ? Number(data.lateCount) : undefined,
        latePenaltyPerEvent: data.latePenaltyPerEvent ? Number(data.latePenaltyPerEvent) : undefined,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      push('success', t('payroll.calculated'));
      setCalculateOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
    onError: (err) => push('error', getErrorMessage(err)),
  });

  const transition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'review' | 'approve' | 'pay' }) =>
      payrollApi[action](id),
    onSuccess: (_data, vars) => {
      push(
        'success',
        vars.action === 'pay'
          ? t('payroll.toast.paid')
          : vars.action === 'review'
            ? t('payroll.toast.reviewed')
            : t('payroll.toast.approved'),
      );
      invalidate();
    },
    onError: (err) => push('error', getErrorMessage(err)),
  });

  const cancel = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      payrollApi.cancel(id, reason),
    onSuccess: () => {
      push('success', t('payroll.cancelled'));
      setCancelTarget(null);
      setCancelReason('');
      invalidate();
    },
    onError: (err) => push('error', getErrorMessage(err)),
  });

  const s = summary.data;
  const periodLabel = getPeriodLabel(year, month, t);

  /* ── Derived stats for header chips ────────────────────────────────── */
  const chips = useMemo(() => {
    const items = runs.data?.items ?? [];
    const paidCount = items.filter((r) => r.status === 'PAID').length;
    const pendingCount = items.filter(
      (r) => !['PAID', 'CANCELLED'].includes(r.status),
    ).length;
    return { total: items.length, paidCount, pendingCount };
  }, [runs.data]);

  /* ── Handlers ──────────────────────────────────────────────────────── */
  const handleOpenCalculate = () => setCalculateOpen(true);

  const handleCloseCalculate = () => {
    if (calculate.isPending) return;
    setCalculateOpen(false);
    setForm(EMPTY_FORM);
  };

  const handleCalculateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherId) {
      push('error', t('payroll.teacherRequired'));
      return;
    }
    calculate.mutate(form);
  };

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    cancel.mutate({ id: cancelTarget.id, reason: cancelReason });
  };

  const { playPop, playTick } = usePremiumSound();

  const handleOpenPayrollSidecar = useCallback((run: PayrollRun) => {
    const teacherName = run.teacher?.user
      ? `${run.teacher.user.firstName} ${run.teacher.user.lastName}`.trim()
      : 'O\'qituvchi';
    const statusLabel = t(PAYROLL_STATUS_KEYS[run.status] || run.status);
    const salaryTypeLabel = run.salaryType && SALARY_TYPE_KEYS[run.salaryType]
      ? t(SALARY_TYPE_KEYS[run.salaryType])
      : run.salaryType || '—';
    const sidecarData: QuickLookData = {
      id: run.id,
      type: 'payment',
      title: teacherName,
      subtitle: `${statusLabel} · ${run.periodYear}-${String(run.periodMonth).padStart(2, '0')}`,
      badge: {
        text: statusLabel,
        tone: run.status === 'PAID' ? 'emerald' : run.status === 'APPROVED' ? 'blue' : run.status === 'CANCELLED' ? 'rose' : 'amber',
      },
      avatar: {
        text: teacherName.slice(0, 2).toUpperCase(),
        color: '#007AFF',
      },
      metrics: [
        { label: 'Net to\'lov', value: formatCurrency(run.netPay || run.netAmount || 0) },
        { label: 'Brut summa', value: formatCurrency(run.grossAmount || 0) },
        { label: 'Ushlanmalar', value: formatCurrency(run.deductions || 0) },
        { label: 'Oylik turi', value: salaryTypeLabel },
      ],
      details: [
        { label: 'Payroll ID', value: run.id, copyable: true },
        { label: 'O\'qituvchi', value: teacherName },
        { label: 'Davr', value: `${run.periodYear} / ${run.periodMonth}-oy` },
        { label: 'Asosiy oklad', value: formatCurrency(run.baseSalary || 0) },
        { label: 'Qo\'shimchalar', value: formatCurrency(run.adjustments || 0) },
        { label: 'Izohlar', value: run.notes || 'Izohsiz' },
      ],
      primaryAction: {
        label: run.status === 'DRAFT' ? 'Ko\'rib chiqish' : run.status === 'REVIEWED' ? 'Tasdiqlash' : 'To\'lov qilish',
        onExecute: () => {
          if (run.status === 'DRAFT') transition.mutate({ id: run.id, action: 'review' });
          else if (run.status === 'REVIEWED') transition.mutate({ id: run.id, action: 'approve' });
          else if (run.status === 'APPROVED') transition.mutate({ id: run.id, action: 'pay' });
        },
      },
    };
    openSidecar(sidecarData);
  }, [t, transition]);

  /* Keyboard shortcut 'c' to calculate new */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        playPop();
        handleOpenCalculate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playPop]);

  useListKeyboardNavigation<PayrollRun>({
    items: runs.data?.items ?? [],
    getItemId: (r) => r.id,
    rowIdPrefix: 'payroll-row-',
    onSelect: (r) => { playTick(); handleOpenPayrollSidecar(r); },
    onQuickLook: (r) => { playTick(); handleOpenPayrollSidecar(r); },
  });

  /* ── Render ────────────────────────────────────────────────────────── */
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
          className="liquid-glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
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
            {/* Gradient payroll icon */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #34C759 0%, #007AFF 100%)',
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
              <Icon paths={I.payroll} size={28} strokeWidth={2.2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34C759]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Payroll
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.calendar} size={11} strokeWidth={2.5} />
                  {periodLabel}
                </span>
                {chips.pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF9500]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF9500]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#FF9500]" />
                    {chips.pendingCount} pending
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('payroll.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('payroll.pageSubtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton type="button" variant="primary" onClick={handleOpenCalculate}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('payroll.calculate')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          PERIOD TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="inline-flex flex-wrap items-center gap-3 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
              <Icon paths={I.calendar} size={14} strokeWidth={2.2} />
            </div>
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
              {t('payroll.period')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-28">
              <GlassSelect
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {[
                  CURRENT_PERIOD.year - 2,
                  CURRENT_PERIOD.year - 1,
                  CURRENT_PERIOD.year,
                  CURRENT_PERIOD.year + 1,
                ].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </GlassSelect>
            </div>
            <div className="relative w-40">
              <GlassSelect
                value={String(month)}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTH_KEYS.map((mk, i) => (
                  <option key={mk} value={i + 1}>
                    {t(mk)}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          CONTENT
      ============================================================ */}
      {summary.isLoading || runs.isLoading ? (
        <PayrollSkeleton />
      ) : summary.isError ? (
        <motion.div variants={cardVariants} className="glass-card p-8">
          <GlassErrorState
            message={getErrorMessage(summary.error)}
            onRetry={() => summary.refetch()}
          />
        </motion.div>
      ) : s ? (
        <>
          {/* KPI Cards */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <CurrencyKpiTile
              label={t('payroll.totalNet')}
              amount={Number(s.totalNet) || 0}
              icon={I.wallet}
              tone="emerald"
            />
            <KpiTile
              label={t('payroll.fullyPaid')}
              value={s.paid ?? 0}
              icon={I.checkCircle}
              tone="blue"
            />
            <KpiTile
              label={t('payroll.pendingPayment')}
              value={s.unpaid ?? 0}
              icon={I.clock}
              tone="orange"
            />
            <KpiTile
              label={t('payroll.teachersEvaluated')}
              value={s.teachersCount ?? 0}
              icon={I.users}
              tone="purple"
            />
          </motion.div>

          {/* Payroll Runs Panel */}
          <motion.div
            variants={cardVariants}
            className="overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
            style={{
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-16"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
              }}
            />

            {/* Panel header */}
            <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[#00000008] px-5 py-4 dark:border-[#ffffff08]">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
                  <Icon paths={I.receipt} size={16} strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                    {t('payroll.register')}
                  </h2>
                  <p className="text-[11px] font-medium text-[#86868B]">
                    {periodLabel}
                  </p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                {t('payroll.runsCount', { count: runs.data?.items.length || 0 })}
              </span>
            </div>

            {/* Rows */}
            {runs.data && runs.data.items.length > 0 ? (
              <div className="divide-y divide-[#00000008] dark:divide-[#ffffff08]">
                {runs.data.items.map((run, idx) => {
                  const teacherName = run.teacher?.user
                    ? `${run.teacher.user.firstName} ${run.teacher.user.lastName}`
                    : (run.teacherId ?? '').slice(0, 8);
                  const initials = getInitials(teacherName);
                  const gradient = avatarGradient(teacherName);
                  const salaryKey =
                    SALARY_TYPE_KEYS[run.salaryType ?? ''] ??
                    `payroll.salaryType.${run.salaryType}`;
                  const statusKey =
                    PAYROLL_STATUS_KEYS[run.status] ?? `payroll.status.${run.status}`;
                  const isPending = transition.isPending;

                  return (
                    <motion.div
                      key={run.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3.5 transition-colors hover:bg-[#34C759]/[0.03]"
                    >
                      {/* Top / Left: Avatar + Employee */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-white/50 dark:ring-black/30"
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

                        {/* Employee */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {teacherName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                              {run.periodYear}-{String(run.periodMonth).padStart(2, '0')}
                            </span>
                            <span
                              className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                background: 'rgba(0,0,0,0.04)',
                                color: '#86868B',
                              }}
                            >
                              {t(salaryKey)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom / Right: Amounts + Status + Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0 shrink-0">
                        {/* Gross (hidden on mobile, visible on desktop) */}
                        <div className="hidden flex-col items-end sm:flex">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                            {t('payroll.col.gross')}
                          </span>
                          <span className="mt-0.5 text-[12.5px] font-semibold tabular-nums text-[#86868B]">
                            {formatCurrency(Number(run.grossAmount))}
                          </span>
                        </div>

                        {/* Net */}
                        <div className="flex flex-col items-start sm:items-end">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                            {t('payroll.col.net')}
                          </span>
                          <span className="mt-0.5 text-[14px] sm:text-[15px] font-bold tabular-nums tracking-tight text-[#10B981]">
                            {formatCurrency(Number(run.netAmount))}
                          </span>
                        </div>

                        {/* Status */}
                        <StatusBadge status={run.status} label={t(statusKey)} />

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-1.5 shrink-0">
                          {run.status === 'CALCULATED' && (
                            <WorkflowButton
                              tone="orange"
                              icon={I.play}
                              label={t('payroll.approveReview')}
                              disabled={isPending}
                              onClick={() =>
                                transition.mutate({ id: run.id, action: 'review' })
                              }
                            />
                          )}
                          {run.status === 'REVIEWED' && (
                            <WorkflowButton
                              tone="blue"
                              icon={I.check}
                              label={t('payroll.finalApprove')}
                              disabled={isPending}
                              onClick={() =>
                                transition.mutate({ id: run.id, action: 'approve' })
                              }
                            />
                          )}
                          {run.status === 'APPROVED' && (
                            <WorkflowButton
                              tone="emerald"
                              icon={I.cash}
                              label={t('payroll.markPaid')}
                              disabled={isPending}
                              onClick={() => transition.mutate({ id: run.id, action: 'pay' })}
                              primary
                            />
                          )}
                          {!['PAID', 'CANCELLED'].includes(run.status) && (
                            <motion.button
                              type="button"
                              onClick={() => setCancelTarget(run)}
                              whileHover={{ scale: 1.06 }}
                              whileTap={{ scale: 0.94 }}
                              transition={SPRING.snappy}
                              aria-label={t('common.cancel')}
                              title={t('common.cancel')}
                              className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                              style={{
                                background: 'rgba(255,59,48,0.10)',
                                color: '#FF3B30',
                                border: '1px solid rgba(255,59,48,0.2)',
                              }}
                            >
                              <Icon paths={I.ban} size={13} strokeWidth={2} />
                            </motion.button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10">
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
                    {t('payroll.emptyTitle')}
                  </p>
                  <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                    {t('payroll.emptyMessage', {
                      month: t(MONTH_KEYS[month - 1]),
                      year: String(year),
                    })}
                  </p>
                  <div className="mt-5">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <GlassButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleOpenCalculate}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                          {t('payroll.calculate')}
                        </span>
                      </GlassButton>
                    </motion.div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      ) : null}

      {/* ============================================================
          CALCULATE MODAL
      ============================================================ */}
      <GlassModal
        open={calculateOpen}
        onClose={handleCloseCalculate}
        title={t('payroll.calculateTitle', {
          month: t(MONTH_KEYS[month - 1]),
          year: String(year),
        })}
        wide
      >
        <form onSubmit={handleCalculateSubmit} className="space-y-5">
          {/* Hint banner */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#34C75933] bg-[#34C759]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#34C759]/15 text-[#34C759]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('payroll.calculateHint') ?? 'Enter earnings and deductions for this period.'}
            </p>
          </div>

          {/* Teacher select */}
          <div className="rounded-2xl border border-[#00000008] bg-[#00000002] p-4 dark:border-[#ffffff08] dark:bg-[#ffffff04]">
            <GlassField label={t('payroll.selectTeacher')} required>
              <div className="relative">
                <FieldIcon icon={I.users} tone="purple" />
                <GlassSelect
                  value={form.teacherId}
                  onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                  className="pl-11"
                >
                  <option value="">{t('payroll.chooseEmployee')}</option>
                  {(teachers.data?.items ?? []).map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.user.firstName} {teacher.user.lastName}
                    </option>
                  ))}
                </GlassSelect>
              </div>
            </GlassField>
          </div>

          {/* Earnings / Deductions split */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Earnings panel */}
            <div
              className="relative overflow-hidden rounded-2xl border border-[#34C75933] bg-[#34C759]/[0.04] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#34C759]/15 text-[#34C759]">
                  <Icon paths={I.arrowUp} size={13} strokeWidth={2.4} />
                </div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#34C759]">
                  {t('payroll.earnings')}
                </h3>
              </div>
              <div className="space-y-3">
                <GlassField label={t('payroll.form.baseAmount')}>
                  <GlassInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.baseAmount}
                    onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </GlassField>
                <GlassField label={t('payroll.form.bonus')}>
                  <GlassInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.bonus}
                    onChange={(e) => setForm({ ...form, bonus: e.target.value })}
                    placeholder="0.00"
                  />
                </GlassField>
                <GlassField label={t('payroll.form.overtimeHours')}>
                  <GlassInput
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.overtimeHours}
                    onChange={(e) => setForm({ ...form, overtimeHours: e.target.value })}
                    placeholder="0"
                  />
                </GlassField>
              </div>
            </div>

            {/* Deductions panel */}
            <div
              className="relative overflow-hidden rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.04] p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF3B30]/15 text-[#FF3B30]">
                  <Icon paths={I.arrowDown} size={13} strokeWidth={2.4} />
                </div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF3B30]">
                  {t('payroll.deductions')}
                </h3>
              </div>
              <div className="space-y-3">
                <GlassField label={t('payroll.form.absenceDays')}>
                  <GlassInput
                    type="number"
                    min="0"
                    step="1"
                    value={form.absenceDays}
                    onChange={(e) => setForm({ ...form, absenceDays: e.target.value })}
                    placeholder="0"
                  />
                </GlassField>
                <div className="grid grid-cols-2 gap-3">
                  <GlassField label={t('payroll.form.lateCount')}>
                    <GlassInput
                      type="number"
                      min="0"
                      step="1"
                      value={form.lateCount}
                      onChange={(e) => setForm({ ...form, lateCount: e.target.value })}
                      placeholder="0"
                    />
                  </GlassField>
                  <GlassField label={t('payroll.form.penaltyPerEvent')}>
                    <GlassInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.latePenaltyPerEvent}
                      onChange={(e) =>
                        setForm({ ...form, latePenaltyPerEvent: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </GlassField>
                </div>
                <GlassField label={t('payroll.form.otherDeductions')}>
                  <GlassInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.otherDeduction}
                    onChange={(e) => setForm({ ...form, otherDeduction: e.target.value })}
                    placeholder="0.00"
                  />
                </GlassField>
              </div>
            </div>
          </div>

          {/* Notes */}
          <GlassField
            label={t('payroll.form.notes')}
            hint={t('payroll.form.notesHint')}
          >
            <GlassTextArea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder={t('payroll.form.notesPlaceholder')}
            />
          </GlassField>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={handleCloseCalculate}
                disabled={calculate.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="submit"
                variant="primary"
                disabled={calculate.isPending}
              >
                <span className="inline-flex items-center gap-2">
                  {calculate.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('payroll.calculating')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.play} size={14} strokeWidth={2.4} />
                      {t('payroll.runCalculation')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          CANCEL MODAL
      ============================================================ */}
      <GlassModal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={t('payroll.cancelTitle')}
      >
        <form onSubmit={handleCancelSubmit} className="space-y-4">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#FF3B3033] bg-[#FF3B30]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF3B30]/15 text-[#FF3B30]">
              <Icon paths={I.warning} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-semibold leading-snug text-[#FF3B30]">
              {t('payroll.cancelWarning')}
            </p>
          </div>

          <GlassField label={t('payroll.cancelReasonLabel')} required>
            <GlassTextArea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('payroll.cancelReasonPlaceholder')}
              autoFocus
            />
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setCancelTarget(null)}
                disabled={cancel.isPending}
              >
                {t('common.close')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="submit"
                variant="danger"
                disabled={cancel.isPending || !cancelReason.trim()}
              >
                <span className="inline-flex items-center gap-2">
                  {cancel.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('payroll.cancelling')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.ban} size={14} strokeWidth={2.4} />
                      {t('payroll.confirmCancellation')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>
    </motion.div>
  );
}

/* ============================================================================
 * WORKFLOW BUTTON — tone-aware macOS-style action
 * ========================================================================== */

function WorkflowButton({
  tone,
  icon,
  label,
  onClick,
  disabled,
  primary,
}: {
  tone: Tone;
  icon: string[];
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const c = TONES[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.04, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING.snappy}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11.5px] font-bold tracking-tight outline-none disabled:opacity-50"
      style={{
        background: primary ? c.fg : c.bg,
        color: primary ? '#fff' : c.fg,
        border: `1px solid ${primary ? c.fg : c.border}`,
        boxShadow: primary
          ? `inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px ${c.glow}`
          : `inset 0 1px 0 rgba(255,255,255,0.4)`,
      }}
    >
      <Icon paths={icon} size={12} strokeWidth={2.6} />
      {label}
    </motion.button>
  );
}