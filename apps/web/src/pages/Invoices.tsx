/**
 * M-EDU InvoicesPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient invoice tile + live chips
 *  - Ambient gradient orbs
 *  - Animated KPI bar (Total, Paid, Outstanding, Overdue)
 *  - Premium segmented tabs with layoutId
 *  - Premium invoice rows with gradient tile + status pill + actions
 *  - Premium modals with hint banners + squircle FieldIcons
 *  - Premium print preview
 *  - Shimmer skeletons
 *  - 100% logic preserved
 */

import { formatDate } from '../lib/format';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import { Printer } from 'lucide-react';
import { invoicesApi, studentsApi } from '@/lib/api';
import {
  GlassErrorState,
  GlassModal,
  GlassInput,
  GlassTextArea,
  GlassSelect,
  GlassField,
  GlassButton,
  useToast,
  GlassTabs,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useI18n } from '@/i18n/I18nProvider';
import type { Invoice, InvoicePayment, InvoiceRefund } from '@/lib/types';
import { queryKeys } from '@/lib/query-keys.factory';

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
 * CUSTOM ICONS
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  invoice: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h5',
  ],
  receipt: [
    'M4 2v20l3-2 3 2 3-2 3 2 3-2V2H4z',
    'M8 8h8',
    'M8 12h8',
    'M8 16h5',
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
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  xCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M15 9l-6 6', 'M9 9l6 6',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  check: ['M20 6 9 17l-5-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  upload: [
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
    'M17 8l-5-5-5 5',
    'M12 3v12',
  ],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  user: [
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M20 21v-1a8 8 0 0 0-16 0v1',
  ],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  note: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6', 'M8 13h8', 'M8 17h5',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  layers: [
    'M12 2 2 7l10 5 10-5z',
    'M2 17l10 5 10-5',
    'M2 12l10 5 10-5',
  ],
  hash: [
    'M4 9h16', 'M4 15h16',
    'M10 3 8 21', 'M16 3l-2 18',
  ],
  link: [
    'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
    'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
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
 * TONES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber' | 'rose' | 'indigo';

const TONES: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:    { fg: '#007AFF', bg: 'rgba(0,122,255,0.10)', glow: 'rgba(0,122,255,0.28)', border: 'rgba(0,122,255,0.20)' },
  green:   { fg: '#34C759', bg: 'rgba(52,199,89,0.10)',  glow: 'rgba(52,199,89,0.28)',  border: 'rgba(52,199,89,0.20)' },
  orange:  { fg: '#FF9500', bg: 'rgba(255,149,0,0.10)',  glow: 'rgba(255,149,0,0.28)',  border: 'rgba(255,149,0,0.20)' },
  red:     { fg: '#FF3B30', bg: 'rgba(255,59,48,0.10)',  glow: 'rgba(255,59,48,0.28)',  border: 'rgba(255,59,48,0.20)' },
  purple:  { fg: '#AF52DE', bg: 'rgba(175,82,222,0.10)', glow: 'rgba(175,82,222,0.28)', border: 'rgba(175,82,222,0.20)' },
  cyan:    { fg: '#32ADE6', bg: 'rgba(50,173,230,0.10)', glow: 'rgba(50,173,230,0.28)', border: 'rgba(50,173,230,0.20)' },
  gray:    { fg: '#86868B', bg: 'rgba(134,134,139,0.10)', glow: 'rgba(134,134,139,0.22)', border: 'rgba(134,134,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  rose:    { fg: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  glow: 'rgba(244,63,94,0.28)',  border: 'rgba(244,63,94,0.20)' },
  indigo:  { fg: '#5856D6', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)' },
};

const STATUS_TONE: Record<string, Tone> = {
  PAID: 'emerald',
  PARTIALLY_PAID: 'amber',
  OVERDUE: 'rose',
  ISSUED: 'blue',
  REFUNDED: 'purple',
  DRAFT: 'gray',
  CANCELLED: 'gray',
  PENDING: 'amber',
  SUCCEEDED: 'emerald',
};

/* ============================================================================
 * HELPERS (preserved)
 * ========================================================================== */

const INVOICE_STATUS_KEYS: Record<string, string> = {
  DRAFT: 'invoices.status.DRAFT',
  ISSUED: 'invoices.status.ISSUED',
  PARTIALLY_PAID: 'invoices.status.PARTIALLY_PAID',
  REFUNDED: 'invoices.status.REFUNDED',
  PENDING: 'payments.status.PENDING',
  PAID: 'payments.status.PAID',
  OVERDUE: 'payments.status.OVERDUE',
  CANCELLED: 'payments.status.CANCELLED',
  SUCCEEDED: 'payments.status.PAID',
};

function invoiceStatusKey(status: string): string {
  return INVOICE_STATUS_KEYS[status] ?? status;
}

function getInvoiceTone(status: string): Tone {
  return STATUS_TONE[status] ?? 'gray';
}

interface PaymentFormState {
  amount: string;
  method: string;
  reference: string;
  description: string;
}

interface RefundFormState {
  paymentId: string;
  amount: string;
  reason: string;
}

const EMPTY_PAYMENT: PaymentFormState = { amount: '', method: 'CASH', reference: '', description: '' };
const EMPTY_REFUND: RefundFormState = { paymentId: '', amount: '', reason: '' };

const FILTER_TABS = ['', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const INV_PALETTES = [
  ['#007AFF', '#5856D6'],
  ['#AF52DE', '#FF2D55'],
  ['#34C759', '#32ADE6'],
  ['#FF9500', '#FF2D55'],
  ['#5856D6', '#AF52DE'],
  ['#32ADE6', '#007AFF'],
];

function invGradient(seed: string): string {
  const [a, b] = INV_PALETTES[nameHash(seed) % INV_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AmbientOrbs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[8%] top-[6%] h-[44%] w-[40%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(0,122,255,0.14), transparent 70%)',
          }}
        animate={{ x: [0, 24, 0], y: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-[10%] -right-[8%] h-[46%] w-[42%] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgba(175,82,222,0.12), transparent 70%)',
          }}
        animate={{ x: [0, -28, 0], y: [0, -22, 0], opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

function CountUp({ value, duration = 1.1, suffix = '', currency = false }: { value: number; duration?: number; suffix?: string; currency?: boolean }) {
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

  if (currency) return <span className="tabular-nums">{formatCurrency(n)}</span>;
  return <span className="tabular-nums">{Math.round(n).toLocaleString('uz-UZ')}{suffix}</span>;
}

function KpiTile({
  label, value, icon, tone = 'blue', currency, secondary,
}: {
  label: string; value: number; icon: string[]; tone?: Tone; currency?: boolean; secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
      }}
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
        <div className="text-[18px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          <CountUp value={value} currency={currency} />
        </div>
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#86868B]">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#86868B]/80">
            {secondary}
          </div>
        )}
      </div>
    </motion.div>
  );
}

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

function StatusPill({ status, label }: { status: string; label: string }) {
  const tone = getInvoiceTone(status);
  const c = TONES[tone];
  const pulse = status === 'OVERDUE';
  return (
    <span
      className="relative inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em]"
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
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

function InvoiceTile({ seed }: { seed: string }) {
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
      style={{
        background: invGradient(seed),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px -6px rgba(0,0,0,0.25)',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)' }}
      />
      <Icon paths={I.invoice} size={20} strokeWidth={2} className="relative" />
    </div>
  );
}

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

function TextAreaFieldIcon({ icon, tone = 'blue' }: { icon: string[]; tone?: Tone }) {
  const c = TONES[tone];
  return (
    <span
      className="pointer-events-none absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg"
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

export function InvoicesPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.invoices'));
  const { push } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Invoice | null>(null);
  const [refundTarget, setRefundTarget] = useState<Invoice | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT);
  const [refundForm, setRefundForm] = useState<RefundFormState>(EMPTY_REFUND);
  const [issueTarget, setIssueTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [createForm, setCreateForm] = useState<any>({ description: '', unitPrice: '' });
  const [createErrors, setCreateErrors] = useState<any>({});

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all() });
  };

  const invoiceDetail = useQuery({
    queryKey: ['invoice-detail', refundTarget?.id],
    queryFn: () => (refundTarget ? (invoicesApi.get(refundTarget.id) as Promise<any>) : null),
    enabled: !!refundTarget,
  });

  const students = useQuery({
    queryKey: queryKeys.students.selectors(),
    queryFn: () => studentsApi.list({ limit: 100 }),
  });

  const createInvoice = useMutation({
    mutationFn: (data: any) => invoicesApi.create(data),
    onSuccess: () => {
      push('success', t('invoices.createSuccess'));
      setCreateOpen(false);
      invalidateAll();
    },
    onError: (err: any) => setCreateErrors({ _error: getErrorMessage(err) }),
  });

  const processRefund = useMutation({
    mutationFn: (id: string) => invoicesApi.processRefund(id),
    onSuccess: () => {
      push('success', t('invoices.refundProcessed') || 'Refund processed');
      setRefundTarget(null);
      invalidateAll();
    },
  });

  const rejectRefund = useMutation({
    mutationFn: (data: { id: string; reason: string }) => invoicesApi.rejectRefund(data.id, data.reason),
    onSuccess: () => {
      push('success', t('invoices.refundRejected') || 'Refund rejected');
      setRejectTarget(null);
      invalidateAll();
    },
  });

  const requestRefund = useMutation({
    mutationFn: (data: any) => invoicesApi.requestRefund(data),
    onSuccess: () => {
      push('success', t('invoices.refundRequested') || 'Refund requested');
      setRefundTarget(null);
      invalidateAll();
    },
  });

  const issue = useMutation({
    mutationFn: (id: string) => invoicesApi.issue(id),
    onSuccess: () => {
      push('success', t('invoices.issueSuccess') || 'Invoice issued');
      setIssueTarget(null);
      invalidateAll();
    },
  });

  const invoices = useQuery({
    queryKey: queryKeys.invoices.list({ status: statusFilter || undefined, limit: 100 }),
    queryFn: () => invoicesApi.list({ status: statusFilter || undefined, limit: 100 }) as Promise<any>,
  });

  const remaining = (inv: Invoice) => {
    if (typeof (inv as any).remaining === 'number') return (inv as any).remaining;
    const total = Number(inv.total) || 0;
    const paid = Number((inv as any).paidAmount) || 0;
    const refunded = Number((inv as any).refundedAmount) || 0;
    return Math.max(0, total - paid + refunded);
  };

  const recordPayment = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: PaymentFormState }) =>
      invoicesApi.recordPayment(invoiceId, data),
    onSuccess: () => {
      push('success', t('invoices.paymentSuccess'));
      setPayTarget(null);
      setPaymentForm(EMPTY_PAYMENT);
      invalidateAll();
    },
    onError: (error: any) => {
      push('error', getErrorMessage(error));
    },
  });

  /* ── Derived stats ────────────────────────────────────────────────── */
  const items: any[] = (invoices.data as any)?.items ?? [];

  const stats = useMemo(() => {
    const total = items.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const paid = items.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
    const outstanding = items.reduce((sum, inv) => sum + remaining(inv as any), 0);
    const overdue = items.filter((inv) => inv.status === 'OVERDUE').length;
    return { total, paid, outstanding, overdue, count: items.length };
  }, [items]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (invoices.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
        </div>
        <Shimmer className="h-96 w-full" radius="1.75rem" />
      </div>
    );
  }

  if (invoices.isError) {
    return (
      <div className="page-container space-y-5">
        <div className="glass-card p-8">
          <GlassErrorState message="Error loading invoices" onRetry={() => invoices.refetch()} />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative page-container space-y-5 pb-24"
    >
      <AmbientOrbs />

      {/* ============================================================
          HERO HEADER
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-6 backdrop-blur-2xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-7"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(88,86,214,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
              }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
                }}
              />
              <Icon paths={I.receipt} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5856D6]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#5856D6]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Billing
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.count} total
                </span>
                {stats.overdue > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF3B30]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#FF3B30]">
                    <span className="relative flex h-1.5 w-1.5">
                      <motion.span
                        className="absolute inset-0 rounded-full bg-[#FF3B30]"
                        animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#FF3B30]" />
                    </span>
                    {stats.overdue} overdue
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('nav.invoices')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('invoices.subtitle')}
              </p>
            </div>

            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('invoices.createDraft')}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      {stats.count > 0 && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile label={t('invoices.col.total')} value={stats.total} icon={I.invoice} tone="blue" currency />
          <KpiTile label={t('invoices.col.totalPaid')} value={stats.paid} icon={I.checkCircle} tone="emerald" currency />
          <KpiTile label={t('invoices.col.balanceDue')} value={stats.outstanding} icon={I.alertCircle} tone="rose" currency />
          <KpiTile label={t('invoices.status.OVERDUE')} value={stats.overdue} icon={I.clock} tone="amber" />
        </motion.div>
      )}

      {/* ============================================================
          FILTER TABS
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-3 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}
        >
          <div className="overflow-x-auto">
            <GlassTabs
              active={statusFilter}
              onChange={setStatusFilter}
              tabs={FILTER_TABS.map((opt) => ({
                id: opt,
                label: opt === '' ? t('invoices.allTab') : t(invoiceStatusKey(opt)),
              }))}
            />
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          INVOICES LIST
      ============================================================ */}
      <motion.div
        variants={cardVariants}
        className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
          }}
        />

        {items.length === 0 ? (
          <div className="relative p-10">
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#5856D6]/10 text-[#5856D6]"
                style={{
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -12px rgba(88,86,214,0.4)',
                }}
              >
                <Icon paths={I.empty} size={26} strokeWidth={1.8} />
              </div>
              <p className="mt-4 text-[15px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t('invoices.emptyTitle')}
              </p>
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
                {statusFilter ? t('invoices.emptyFiltered') : t('invoices.emptyHint')}
              </p>
              {!statusFilter && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                      <span className="inline-flex items-center gap-2">
                        <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                        {t('invoices.createDraft')}
                      </span>
                    </GlassButton>
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative divide-y divide-[#00000008] dark:divide-[#ffffff08]">
            {items.map((inv: any, idx: number) => {
              const bal = remaining(inv);
              const seed = inv.number || inv.id || 'invoice';
              const studentName = inv.student?.user
                ? `${inv.student.user.firstName} ${inv.student.user.lastName}`
                : inv.studentId?.slice(0, 8) ?? '—';

              return (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className="group flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[#5856D6]/[0.03]"
                >
                  <InvoiceTile seed={seed} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-[13.5px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                        {inv.number || inv.id.slice(0, 8)}
                      </p>
                      <StatusPill status={inv.status} label={t(invoiceStatusKey(inv.status))} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#86868B]">
                      <span className="inline-flex items-center gap-1">
                        <Icon paths={I.user} size={10} strokeWidth={2.2} className="opacity-60" />
                        {studentName}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Icon paths={I.calendar} size={10} strokeWidth={2.2} className="opacity-60" />
                        {inv.issueDate ? formatDate(inv.issueDate) : inv.createdAt ? formatDate(inv.createdAt) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="hidden flex-col items-end sm:flex">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                      {t('invoices.col.totalPaid')}
                    </span>
                    <span className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-[#10B981]">
                      {formatCurrency(Number(inv.paidAmount || 0))}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F43F5E]">
                      {t('invoices.col.balanceDue')}
                    </span>
                    <span className="mt-0.5 font-mono text-[14px] font-bold tabular-nums tracking-tight text-[#F43F5E]">
                      {formatCurrency(bal)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {inv.status === 'DRAFT' && (
                      <motion.button
                        type="button"
                        onClick={() => setIssueTarget(inv)}
                        whileHover={{ scale: 1.06, y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        transition={SPRING.snappy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold tracking-tight outline-none"
                        style={{
                          background: 'rgba(0,122,255,0.10)',
                          color: '#007AFF',
                          border: '1px solid rgba(0,122,255,0.22)',
                        }}
                      >
                        <Icon paths={I.upload} size={12} strokeWidth={2.4} />
                        <span className="hidden sm:inline">{t('invoices.confirmIssue')}</span>
                      </motion.button>
                    )}
                    {inv.status !== 'DRAFT' && bal > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => setPayTarget(inv)}
                        whileHover={{ scale: 1.06, y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        transition={SPRING.snappy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold tracking-tight outline-none"
                        style={{
                          background: 'rgba(16,185,129,0.10)',
                          color: '#10B981',
                          border: '1px solid rgba(16,185,129,0.22)',
                        }}
                      >
                        <Icon paths={I.cash} size={12} strokeWidth={2.4} />
                        <span className="hidden sm:inline">{t('invoices.recordPayment')}</span>
                      </motion.button>
                    )}
                    {Number(inv.paidAmount || 0) > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => setRefundTarget(inv)}
                        whileHover={{ scale: 1.06, y: -1 }}
                        whileTap={{ scale: 0.94 }}
                        transition={SPRING.snappy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold tracking-tight outline-none"
                        style={{
                          background: 'rgba(244,63,94,0.10)',
                          color: '#F43F5E',
                          border: '1px solid rgba(244,63,94,0.22)',
                        }}
                      >
                        <Icon paths={I.refresh} size={12} strokeWidth={2.4} />
                        <span className="hidden sm:inline">{t('invoices.recordRefund')}</span>
                      </motion.button>
                    )}
                    <motion.button
                      type="button"
                      onClick={() => setPreviewTarget(inv)}
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={SPRING.snappy}
                      aria-label={t('invoices.preview')}
                      title={t('invoices.preview') || 'Preview'}
                      className="flex h-8 w-8 items-center justify-center rounded-lg outline-none"
                      style={{
                        background: 'rgba(88,86,214,0.10)',
                        color: '#5856D6',
                        border: '1px solid rgba(88,86,214,0.20)',
                      }}
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ============================================================
          RECORD PAYMENT MODAL
      ============================================================ */}
      <GlassModal
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title={t('invoices.recordPayment')}
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!payTarget) return;
            const amount = Number(paymentForm.amount);
            if (!amount || amount <= 0) {
              push('error', t('invoices.amountPositive'));
              return;
            }
            if (amount > remaining(payTarget)) {
              push('error', t('invoices.amountExceeds'));
              return;
            }
            recordPayment.mutate({ invoiceId: payTarget.id, data: paymentForm });
          }}
          className="space-y-5"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-2xl border border-[#10B98133] bg-[#10B981]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10B981]/15 text-[#10B981]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              Record a payment against this invoice. Amount cannot exceed the balance due.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-4 dark:border-[#ffffff08] dark:bg-[#ffffff04]">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                {t('invoices.invoiceLabel')}
              </p>
              <p className="mt-1 font-mono text-[13.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {payTarget?.number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                {t('invoices.col.balanceDue')}
              </p>
              <p className="mt-1 font-mono text-[15px] font-bold text-[#F43F5E]">
                {payTarget ? formatCurrency(remaining(payTarget)) : ''}
              </p>
            </div>
          </div>

          <GlassField label={t('invoices.paymentAmount')} required>
            <div className="relative">
              <FieldIcon icon={I.cash} tone="emerald" />
              <GlassInput
                type="number"
                min="0.01"
                step="0.01"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                className="pl-11 font-mono text-[15px] font-bold text-[#10B981]"
                autoFocus
              />
            </div>
          </GlassField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassField label={t('invoices.paymentMethod')}>
              <div className="relative">
                <FieldIcon icon={I.wallet} tone="blue" />
                <GlassSelect
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="pl-11"
                >
                  <option value="CASH">{t('payments.method.CASH')}</option>
                  <option value="CARD">{t('payments.method.CARD')}</option>
                  <option value="BANK_TRANSFER">{t('payments.method.BANK_TRANSFER')}</option>
                  <option value="PAYME">{t('payments.method.PAYME')}</option>
                  <option value="CLICK">{t('payments.method.CLICK')}</option>
                  <option value="UZUM">{t('payments.method.UZUM')}</option>
                  <option value="OTHER">{t('payments.method.OTHER')}</option>
                </GlassSelect>
              </div>
            </GlassField>
            <GlassField label={t('invoices.referenceId')} hint={t('invoices.referenceHint')}>
              <div className="relative">
                <FieldIcon icon={I.hash} tone="cyan" />
                <GlassInput
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder={t('invoices.referencePlaceholder')}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          <GlassField label={t('invoices.notesLabel')} hint={t('invoices.notesHint')}>
            <div className="relative">
              <TextAreaFieldIcon icon={I.note} tone="gray" />
              <GlassTextArea
                rows={2}
                value={paymentForm.description}
                onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                placeholder={t('invoices.notesPlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="button" variant="secondary" onClick={() => setPayTarget(null)}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={recordPayment.isPending}>
                <span className="inline-flex items-center gap-2">
                  {recordPayment.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('invoices.processing')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {t('invoices.confirmPayment')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          ISSUE CONFIRMATION MODAL
      ============================================================ */}
      <GlassModal
        open={issueTarget !== null}
        onClose={() => setIssueTarget(null)}
        title={t('invoices.issueTitle')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-[#007AFF33] bg-[#007AFF]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#007AFF]/15 text-[#007AFF]">
              <Icon paths={I.upload} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('invoices.issueBody', { number: issueTarget?.number ?? '' })}
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="button" variant="secondary" onClick={() => setIssueTarget(null)}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="primary"
                disabled={issue.isPending}
                onClick={() => issueTarget && issue.mutate(issueTarget.id)}
              >
                <span className="inline-flex items-center gap-2">
                  {issue.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('invoices.issuing')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.check} size={14} strokeWidth={2.5} />
                      {t('invoices.confirmIssue')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          REFUND MODAL
      ============================================================ */}
      <GlassModal
        open={refundTarget !== null}
        onClose={() => {
          setRefundTarget(null);
          setRefundForm(EMPTY_REFUND);
        }}
        title={t('invoices.refundTitle')}
        wide
      >
        {invoiceDetail.isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((i) => <Shimmer key={i} className="h-16" radius="1rem" />)}
          </div>
        ) : invoiceDetail.isError ? (
          <GlassErrorState
            message={getErrorMessage(invoiceDetail.error)}
            onRetry={() => invoiceDetail.refetch()}
          />
        ) : invoiceDetail.data ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-[#00000008] bg-[#00000002] p-4 dark:border-[#ffffff08] dark:bg-[#ffffff04]">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('invoices.invoiceLabel')}
                </p>
                <p className="mt-1 font-mono text-[13.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {(invoiceDetail.data as any).number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('invoices.refundable')}
                </p>
                <p className="mt-1 font-mono text-[15px] font-bold text-[#F43F5E]">
                  {formatCurrency(
                    Math.max(
                      0,
                      Number((invoiceDetail.data as any).paidAmount || 0) -
                        Number((invoiceDetail.data as any).refundedAmount ?? 0),
                    ),
                  )}
                </p>
              </div>
            </div>

            <GlassField label={t('invoices.paymentLabel')} required hint={t('invoices.paymentSelectHint')}>
              {(invoiceDetail.data as any).payments && (invoiceDetail.data as any).payments.length > 0 ? (
                <div className="space-y-2">
                  {(invoiceDetail.data as any).payments.map((p: InvoicePayment) => {
                    const isSelected = refundForm.paymentId === p.id;
                    const isSucceeded = p.status === 'SUCCEEDED' || p.status === 'PAID';
                    return (
                      <motion.label
                        key={p.id}
                        whileHover={{ scale: 1.005 }}
                        className="flex items-center justify-between gap-3 rounded-xl border p-3 cursor-pointer transition-all"
                        style={{
                          borderColor: isSelected ? 'rgba(244,63,94,0.4)' : 'rgba(0,0,0,0.08)',
                          background: isSelected ? 'rgba(244,63,94,0.08)' : 'transparent',
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <input
                            type="radio"
                            name="refund-payment"
                            value={p.id}
                            checked={isSelected}
                            onChange={() => setRefundForm({ ...refundForm, paymentId: p.id, amount: '' })}
                            className="shrink-0 accent-rose-500"
                          />
                          <span className="truncate text-[12.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                            {formatCurrency(Number(p.amount))} · {t(`payments.method.${p.method ?? 'CARD'}`)}
                            {p.receiptNumber ? ` · ${p.receiptNumber}` : ''}
                          </span>
                        </span>
                        <span
                          className="shrink-0 text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: isSucceeded ? '#10B981' : '#86868B' }}
                        >
                          {t(invoiceStatusKey(p.status))}
                        </span>
                      </motion.label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] font-medium text-[#86868B]">{t('invoices.noPayments')}</p>
              )}
            </GlassField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <GlassField label={t('invoices.refundAmount')} required>
                <div className="relative">
                  <FieldIcon icon={I.cash} tone="rose" />
                  <GlassInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                    className="pl-11 font-mono text-[15px] font-bold text-[#F43F5E]"
                    placeholder="0.00"
                  />
                </div>
              </GlassField>
              <GlassField label={t('invoices.reason')} hint={t('invoices.reasonHint')}>
                <div className="relative">
                  <FieldIcon icon={I.note} tone="gray" />
                  <GlassInput
                    value={refundForm.reason}
                    onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                    placeholder={t('invoices.reasonPlaceholder')}
                    className="pl-11"
                  />
                </div>
              </GlassField>
            </div>

            {(invoiceDetail.data as any).refunds && (invoiceDetail.data as any).refunds.length > 0 && (
              <div className="space-y-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('invoices.refundHistory')}
                </p>
                {(invoiceDetail.data as any).refunds.map((r: InvoiceRefund) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-[#00000008] bg-[#00000002] p-3.5 dark:border-[#ffffff08] dark:bg-[#ffffff04] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {formatCurrency(Number(r.amount))}
                        </span>
                        <span
                          className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            background:
                              r.status === 'PROCESSED'
                                ? 'rgba(16,185,129,0.10)'
                                : r.status === 'REQUESTED'
                                ? 'rgba(245,158,11,0.10)'
                                : 'rgba(0,0,0,0.04)',
                            color:
                              r.status === 'PROCESSED'
                                ? '#10B981'
                                : r.status === 'REQUESTED'
                                ? '#F59E0B'
                                : '#86868B',
                          }}
                        >
                          {t(`invoices.refundStatus.${r.status}`)}
                        </span>
                      </div>
                      {r.reason && (
                        <p className="mt-1 truncate text-[11.5px] font-medium text-[#86868B]">{r.reason}</p>
                      )}
                      <p className="mt-0.5 text-[10.5px] text-[#86868B]">
                        {t('invoices.requested', { date: r.requestedAt ? formatDate(r.requestedAt) : '' })}
                        {r.processedAt ? t('invoices.processed', { date: formatDate(r.processedAt) }) : ''}
                      </p>
                    </div>
                    {r.status === 'REQUESTED' && (
                      <div className="flex shrink-0 items-center gap-2">
                        <GlassButton
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => processRefund.mutate(r.id)}
                          disabled={processRefund.isPending}
                        >
                          {t('invoices.process')}
                        </GlassButton>
                        <GlassButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRejectTarget(r);
                            setRejectReason('');
                          }}
                        >
                          {t('invoices.reject')}
                        </GlassButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setRefundTarget(null);
                    setRefundForm(EMPTY_REFUND);
                  }}
                >
                  {t('common.close')}
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="danger"
                  disabled={
                    !refundForm.paymentId ||
                    !Number(refundForm.amount) ||
                    Number(refundForm.amount) <= 0 ||
                    requestRefund.isPending
                  }
                  onClick={() =>
                    requestRefund.mutate({ ...refundForm, amount: Number(refundForm.amount) })
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    {requestRefund.isPending ? (
                      <>
                        <motion.span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        {t('invoices.requesting')}
                      </>
                    ) : (
                      <>
                        <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
                        {t('invoices.requestRefund')}
                      </>
                    )}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        ) : null}
      </GlassModal>

      {/* ============================================================
          REJECT REFUND MODAL
      ============================================================ */}
      <GlassModal
        open={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={t('invoices.rejectRefundTitle')}
      >
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-2xl border border-[#F59E0B33] bg-[#F59E0B]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F59E0B]/15 text-[#F59E0B]">
              <Icon paths={I.alertCircle} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-[#8A5A00] dark:text-[#FCD34D]">
              {t('invoices.rejectBody', {
                amount: rejectTarget ? formatCurrency(Number(rejectTarget.amount)) : '',
              })}
            </p>
          </div>

          <GlassField label={t('invoices.reason')} hint={t('common.optional')}>
            <div className="relative">
              <TextAreaFieldIcon icon={I.note} tone="amber" />
              <GlassTextArea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('invoices.rejectReasonPlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="button" variant="secondary" onClick={() => setRejectTarget(null)}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="danger"
                disabled={rejectRefund.isPending}
                onClick={() =>
                  rejectTarget && rejectRefund.mutate({ id: rejectTarget.id, reason: rejectReason })
                }
              >
                <span className="inline-flex items-center gap-2">
                  {rejectRefund.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('invoices.rejecting')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.xCircle} size={14} strokeWidth={2.4} />
                      {t('invoices.confirmReject')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </div>
      </GlassModal>

      {/* ============================================================
          CREATE INVOICE MODAL
      ============================================================ */}
      <GlassModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('invoices.createTitle')}
        wide
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!createForm.studentId || !createForm.number || !Number(createForm.unitPrice)) {
              push('error', t('invoices.createValidation'));
              return;
            }
            const newCreateErrors: { dueDate?: string } = {};
            if (
              createForm.dueDate &&
              new Date(createForm.dueDate) < new Date(new Date().toDateString())
            ) {
              newCreateErrors.dueDate = t('payments.validation.dueDatePast');
            }
            setCreateErrors(newCreateErrors);
            if (Object.keys(newCreateErrors).length === 0) {
              createInvoice.mutate(createForm);
            }
          }}
          className="space-y-5"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-2xl border border-[#5856D633] bg-[#5856D6]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#5856D6]/15 text-[#5856D6]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              Create a new draft invoice. You can issue it later.
            </p>
          </div>

          <GlassField label={t('payments.form.student')} required>
            <div className="relative">
              <FieldIcon icon={I.user} tone="purple" />
              <GlassSelect
                value={createForm.studentId}
                onChange={(e) => setCreateForm({ ...createForm, studentId: e.target.value })}
                className="pl-11"
              >
                <option value="">{t('payments.form.selectStudent')}</option>
                {(((students.data as any)?.items) ?? []).map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.user?.firstName} {st.user?.lastName}
                  </option>
                ))}
              </GlassSelect>
            </div>
          </GlassField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <GlassField label={t('invoices.numberLabel')} required>
              <div className="relative">
                <FieldIcon icon={I.hash} tone="cyan" />
                <GlassInput
                  value={createForm.number}
                  onChange={(e) => setCreateForm({ ...createForm, number: e.target.value })}
                  placeholder="INV-2026-000123"
                  className="pl-11 font-mono text-[13px]"
                />
              </div>
            </GlassField>

            <GlassField label={t('payments.form.dueDate')} error={createErrors.dueDate}>
              <div className="relative">
                <FieldIcon icon={I.calendar} tone="orange" />
                <GlassInput
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => {
                    setCreateForm({ ...createForm, dueDate: e.target.value });
                    setCreateErrors({});
                  }}
                  className="pl-11"
                />
              </div>
            </GlassField>
          </div>

          <GlassField label={t('common.description')} required>
            <div className="relative">
              <FieldIcon icon={I.note} tone="blue" />
              <GlassInput
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder={t('invoices.descriptionPlaceholder')}
                className="pl-11"
              />
            </div>
          </GlassField>

          <GlassField label={t('invoices.total')} required>
            <div className="relative">
              <FieldIcon icon={I.cash} tone="emerald" />
              <GlassInput
                type="number"
                min="0.01"
                step="0.01"
                value={createForm.unitPrice}
                onChange={(e) => setCreateForm({ ...createForm, unitPrice: e.target.value })}
                placeholder="0.00"
                className="pl-11 font-mono text-[15px] font-bold"
              />
            </div>
          </GlassField>

          {createErrors._error && (
            <p className="text-[12.5px] font-medium text-[#FF3B30]" role="alert">
              {createErrors._error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[#00000008] pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                disabled={createInvoice.isPending}
              >
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton type="submit" variant="primary" disabled={createInvoice.isPending}>
                <span className="inline-flex items-center gap-2">
                  {createInvoice.isPending ? (
                    <>
                      <motion.span
                        className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                      />
                      {t('invoices.creating')}
                    </>
                  ) : (
                    <>
                      <Icon paths={I.plus} size={14} strokeWidth={2.5} />
                      {t('invoices.createDraft')}
                    </>
                  )}
                </span>
              </GlassButton>
            </motion.div>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          INVOICE PREVIEW / PRINT MODAL
      ============================================================ */}
      <GlassModal
        open={previewTarget !== null}
        onClose={() => setPreviewTarget(null)}
        title={t('invoices.preview') || 'Invoice Preview'}
        wide
      >
        {previewTarget && (
          <div className="space-y-5">
            <div
              id="medu-printable-invoice"
              className="relative overflow-hidden rounded-2xl border border-[#00000008] bg-white p-6 text-[#1D1D1F] dark:border-[#ffffff10] dark:bg-[#1c1c1e] dark:text-[#F5F5F7] sm:p-8"
              style={{
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 30px -18px rgba(0,0,0,0.15)',
              }}
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#00000008] pb-5 dark:border-[#ffffff08]">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[16px] font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #5856D6 0%, #AF52DE 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    M
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight">M-EDU ACADEMY</h2>
                    <p className="mt-0.5 text-[11px] font-medium text-[#86868B]">
                      Official Tuition & Billing Document
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-[20px] font-black uppercase tracking-tight">
                    {t('invoices.preview.invoice')}
                  </h1>
                  <p className="mt-1 font-mono text-[12.5px] font-semibold text-[#86868B]">
                    #{previewTarget.number || previewTarget.id.slice(0, 8)}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <StatusPill status={previewTarget.status} label={t(invoiceStatusKey(previewTarget.status))} />
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('invoices.preview.billedTo')}
                  </p>
                  <p className="mt-1 text-[13px] font-bold">
                    {previewTarget.student?.user
                      ? `${previewTarget.student.user.firstName} ${previewTarget.student.user.lastName}`
                      : previewTarget.studentId || '—'}
                  </p>
                  {previewTarget.student?.user?.email && (
                    <p className="text-[11px] text-[#86868B]">{previewTarget.student.user.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('invoices.preview.issueDate')}
                  </p>
                  <p className="mt-1 text-[13px] font-medium">
                    {previewTarget.issueDate
                      ? formatDate(previewTarget.issueDate)
                      : formatDate(previewTarget.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                    {t('invoices.preview.dueDate')}
                  </p>
                  <p className="mt-1 text-[13px] font-medium">
                    {previewTarget.dueDate
                      ? formatDate(previewTarget.dueDate)
                      : t('invoices.preview.onReceipt')}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div className="mt-5 overflow-hidden rounded-xl border border-[#00000008] dark:border-[#ffffff08]">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-[#00000003] text-[10.5px] font-bold uppercase tracking-wider text-[#86868B] dark:bg-[#ffffff04]">
                    <tr>
                      <th className="px-4 py-2.5 text-left">{t('invoices.preview.description')}</th>
                      <th className="px-4 py-2.5 text-right">{t('invoices.preview.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3">
                        {previewTarget.notes || (previewTarget as any).description || t('invoices.preview.defaultItem')}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {formatCurrency(Number(previewTarget.total || previewTarget.subtotal || 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-5 flex justify-end">
                <div className="w-full max-w-[280px] space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between border-b border-[#00000008] py-1.5 dark:border-[#ffffff08]">
                    <span className="text-[#86868B]">{t('invoices.preview.subtotal')}</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(Number(previewTarget.subtotal || previewTarget.total || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#00000008] py-1.5 dark:border-[#ffffff08]">
                    <span className="text-[#86868B]">{t('invoices.preview.paidAmount')}</span>
                    <span className="font-mono font-medium text-[#10B981]">
                      {formatCurrency(Number(previewTarget.paidAmount || 0))}
                    </span>
                  </div>
                  {Number(previewTarget.refundedAmount || 0) > 0 && (
                    <div className="flex justify-between border-b border-[#00000008] py-1.5 dark:border-[#ffffff08]">
                      <span className="text-[#86868B]">{t('invoices.preview.refunded')}</span>
                      <span className="font-mono font-medium text-[#F43F5E]">
                        {formatCurrency(Number(previewTarget.refundedAmount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-[15px] font-bold">
                    <span>{t('invoices.preview.balanceDue')}</span>
                    <span className="font-mono text-[#F43F5E]">
                      {formatCurrency(remaining(previewTarget))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex flex-col gap-3 border-t border-[#00000008] pt-4 text-[10.5px] text-[#86868B] dark:border-[#ffffff08] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-[#4A4A4F] dark:text-[#C7C7CC]">
                    {t('invoices.preview.paymentInstructions')}
                  </p>
                  <p>
                    {t('invoices.preview.instructionDetails', {
                      number: previewTarget.number || previewTarget.id.slice(0, 8),
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#4A4A4F] dark:text-[#C7C7CC]">M-EDU Learning Systems</p>
                  <p>{t('invoices.preview.thankYou')}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton type="button" variant="secondary" onClick={() => setPreviewTarget(null)}>
                  {t('common.close')}
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton type="button" variant="primary" onClick={() => window.print()}>
                  <span className="inline-flex items-center gap-2">
                    <Printer className="h-4 w-4" />
                    {t('invoices.preview.printInvoice')}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        )}
      </GlassModal>
    </motion.div>
  );
}

export default InvoicesPage;