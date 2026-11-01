/**
 * M-EDU InvoicesPage — 
 *
 * Module Features:
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
import { useState, useEffect, useRef, useMemo, useCallback, type SVGProps } from 'react';
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
  FloatingActionIsland,
} from '@/components/ui';
import { useListKeyboardNavigation } from '@/hooks/useListKeyboardNavigation';
import { openSidecar, type QuickLookData } from '@/stores/ui.store';
import { ExecutivePDFStudio, type PDFStudioDocData } from '@/components/pdf-studio';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { formatCurrency } from '@/lib/format';
import { getErrorMessage } from '@/lib/errorMessages';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useSafeI18n } from '@/i18n/I18nProvider';
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
  qrCode: [
    'M3 3h6v6H3z', 'M15 3h6v6h-6z', 'M3 15h6v6H3z',
    'M7 7h.01', 'M19 7h.01', 'M7 19h.01',
    'M15 15h2v2h-2z', 'M19 15h2v2h-2z', 'M15 19h2v2h-2z', 'M19 19h2v2h-2z',
  ],
  copy: [
    'M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.57A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z',
    'M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2',
  ],
  calculator: [
    'M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
    'M8 6h8', 'M16 14v4', 'M16 10h.01', 'M12 10h.01', 'M8 10h.01', 'M12 14h.01', 'M8 14h.01', 'M12 18h.01', 'M8 18h.01',
  ],
  telegram: [
    'M21.5 2 2 9.5l7 3 3 7.5 2.5-4 7-14z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
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
  blue:    { fg: '#2563EB', bg: 'rgba(37,99,235,0.10)', glow: 'rgba(37,99,235,0.28)', border: 'rgba(37,99,235,0.20)' },
  green:   { fg: '#10B981', bg: 'rgba(16,185,129,0.10)',  glow: 'rgba(16,185,129,0.28)',  border: 'rgba(16,185,129,0.20)' },
  orange:  { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  glow: 'rgba(245,158,11,0.28)',  border: 'rgba(245,158,11,0.20)' },
  red:     { fg: '#EF4444', bg: 'rgba(239,68,68,0.10)',  glow: 'rgba(239,68,68,0.28)',  border: 'rgba(239,68,68,0.20)' },
  purple:  { fg: '#6366F1', bg: 'rgba(99,102,241,0.10)', glow: 'rgba(99,102,241,0.28)', border: 'rgba(99,102,241,0.20)' },
  cyan:    { fg: '#0284C7', bg: 'rgba(2,132,199,0.10)', glow: 'rgba(2,132,199,0.28)', border: 'rgba(2,132,199,0.20)' },
  gray:    { fg: '#64748B', bg: 'rgba(100,116,139,0.10)', glow: 'rgba(100,116,139,0.22)', border: 'rgba(100,116,139,0.20)' },
  emerald: { fg: '#10B981', bg: 'rgba(16,185,129,0.10)', glow: 'rgba(16,185,129,0.28)', border: 'rgba(16,185,129,0.20)' },
  amber:   { fg: '#F59E0B', bg: 'rgba(245,158,11,0.10)', glow: 'rgba(245,158,11,0.28)', border: 'rgba(245,158,11,0.20)' },
  rose:    { fg: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  glow: 'rgba(244,63,94,0.28)',  border: 'rgba(244,63,94,0.20)' },
  indigo:  { fg: '#6366F1', bg: 'rgba(88,86,214,0.10)',  glow: 'rgba(88,86,214,0.28)',  border: 'rgba(88,86,214,0.20)' },
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
  ['#1E293B', '#334155'], // Slate
  ['#1D4ED8', '#2563EB'], // Sapphire
  ['#047857', '#059669'], // Emerald
  ['#0F766E', '#0D9488'], // Teal
  ['#4338CA', '#4F46E5'], // Indigo
  ['#0F172A', '#1E293B'], // Obsidian
];

function invGradient(seed: string): string {
  const [a, b] = INV_PALETTES[nameHash(seed) % INV_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

/* ============================================================================
 * PREMIUM SUB-COMPONENTS
 * ========================================================================== */

function AuroraMesh() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute -top-[10%] -left-[10%] h-[560px] w-[560px] rounded-full bg-gradient-to-br from-blue-500/12 via-indigo-500/8 to-transparent blur-[130px] dark:from-blue-600/14 dark:via-indigo-600/10" />
      <div className="absolute top-[25%] -right-[10%] h-[520px] w-[520px] rounded-full bg-gradient-to-bl from-emerald-500/12 via-teal-500/8 to-transparent blur-[130px] dark:from-emerald-600/14 dark:via-teal-600/10" />
      <div className="absolute -bottom-[15%] left-[25%] h-[480px] w-[480px] rounded-full bg-gradient-to-tr from-purple-500/10 via-pink-500/6 to-transparent blur-[120px] dark:from-purple-600/12" />
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
      const safeVal = Number.isFinite(value) ? value : 0;
      setN(safeVal * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  if (currency) return <span className="tabular-nums">{formatCurrency(Number.isFinite(n) ? n : 0)}</span>;
  return <span className="tabular-nums">{Math.round(Number.isFinite(n) ? n : 0).toLocaleString('uz-UZ')}{suffix}</span>;
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
      whileHover={{ y: -2 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3.5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
    >
      <div
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
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
        <div className="mt-1.5 truncate text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#64748B]">
          {label}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[10.5px] font-semibold tracking-tight text-[#64748B]/80">
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
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      style={{
        background: invGradient(seed),
      }}
    >
      <Icon paths={I.invoice} size={18} strokeWidth={2} className="relative" />
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
  const { t } = useSafeI18n();
  usePageTitle(t('nav.invoices'));
  const { push } = useToast();
  const queryClient = useQueryClient();
  const sound = usePremiumSound();


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
  const [paymentLinksTarget, setPaymentLinksTarget] = useState<Invoice | null>(null);
  const [prorateOpen, setProrateOpen] = useState(false);
  const [prorateForm, setProrateForm] = useState({
    studentId: '',
    monthlyTuition: '',
    totalLessons: '12',
    attendedLessons: '6',
    reason: t('invoices.prorate.defaultReason'),
  });

  const paymentLinksQuery = useQuery({
    queryKey: ['invoice-payment-links', paymentLinksTarget?.id],
    queryFn: () => (paymentLinksTarget ? (invoicesApi.getPaymentLinks(paymentLinksTarget.id) as Promise<any>) : null),
    enabled: !!paymentLinksTarget,
  });

  const createProratedInvoice = useMutation({
    mutationFn: (data: any) => invoicesApi.createProrated(data),
    onSuccess: () => {
      push('success', t('invoices.prorate.success'));
      setProrateOpen(false);
      setProrateForm({
        studentId: '',
        monthlyTuition: '',
        totalLessons: '12',
        attendedLessons: '6',
        reason: t('invoices.prorate.defaultReason'),
      });
      invalidateAll();
    },
    onError: (err: any) => {
      push('error', getErrorMessage(err));
    },
  });

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
      setCreateForm({ description: '', unitPrice: '' });
      setCreateErrors({});
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
      sound.playSent();
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
    if (['DRAFT', 'CANCELLED', 'REFUNDED'].includes(inv.status)) return 0;
    if (typeof (inv as any).remaining === 'number') return (inv as any).remaining;
    const totalMinor = Math.round((Number(inv.total) || 0) * 100);
    const paidMinor = Math.round((Number((inv as any).paidAmount) || 0) * 100);
    const refundedMinor = Math.round((Number((inv as any).refundedAmount) || 0) * 100);
    return Math.max(0, Math.round(totalMinor - paidMinor + refundedMinor)) / 100;
  };

  const recordPayment = useMutation({
    mutationFn: ({ invoiceId, data }: { invoiceId: string; data: PaymentFormState }) =>
      invoicesApi.recordPayment(invoiceId, data),
    onSuccess: () => {
      sound.playPayment();
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
    const totalMinor = items.reduce((sum, inv) => sum + Math.round((Number(inv.total) || 0) * 100), 0);
    const paidMinor = items.reduce((sum, inv) => sum + Math.round((Number(inv.paidAmount) || 0) * 100), 0);
    const outstandingMinor = items.reduce((sum, inv) => sum + Math.round(remaining(inv as any) * 100), 0);
    const overdue = items.filter((inv) => inv.status === 'OVERDUE').length;
    return {
      total: Math.round(totalMinor) / 100,
      paid: Math.round(paidMinor) / 100,
      outstanding: Math.round(outstandingMinor) / 100,
      overdue,
      count: items.length,
    };
  }, [items]);


  const [studioDocData, setStudioDocData] = useState<PDFStudioDocData | null>(null);

  /* ── Executive PDF Studio ─────────────────────────────────────────── */
  const openExecutiveInvoiceStudio = useCallback((inv: any) => {
    sound.playPop();
    const studentName = inv.student?.user
      ? [inv.student?.user?.firstName, inv.student?.user?.lastName].filter(Boolean).join(' ') || inv.student?.user?.email || '—'
      : inv.studentId?.slice(0, 8) ?? t('invoices.col.student');
    setStudioDocData({
      id: inv.number || inv.id ? `INV-${inv.id?.slice(0, 8) || "—"}` : "INV-UNKNOWN",
      docType: 'receipt',
      title: t('invoices.sidecar.officialReceipt', { number: inv.number || inv.id?.slice(0, 6) || "" }),
      recipientName: studentName,
      recipientId: inv.studentId ? `STD-${inv.studentId.slice(0, 8)}` : undefined,
      amount: formatCurrency(inv.total),
      courseName: inv.items?.[0]?.description || t('invoices.sidecar.curriculumService'),
      dateStr: formatDate(inv.createdAt),
      items: [
        { label: t('invoices.numberLabel'), value: inv.number || inv.id?.slice(0, 8) || "—" },
        { label: t('invoices.total'), value: formatCurrency(inv.total) },
        { label: t('invoices.col.totalPaid'), value: formatCurrency(inv.paidAmount || 0) },
        { label: t('invoices.col.balanceDue'), value: formatCurrency(remaining(inv)) },
        { label: t('common.status'), value: t(invoiceStatusKey(inv.status)) },
        { label: t('payments.form.dueDate'), value: inv.dueDate ? formatDate(inv.dueDate) : t('common.none') },
      ],
    });
  }, [sound, t]);

  /* ── macOS Split-View Detail Sidecar ──────────────────────────────── */
  const handleOpenInvoiceSidecar = useCallback((inv: any) => {
    sound.playTick();
    const studentName = inv.student?.user
      ? [inv.student?.user?.firstName, inv.student?.user?.lastName].filter(Boolean).join(' ') || inv.student?.user?.email || '—'
      : inv.studentId?.slice(0, 8) ?? t('invoices.col.student');
    const bal = remaining(inv);
    const data: QuickLookData = {
      id: inv.id,
      type: 'general',
      title: `${inv.number || t('invoices.invoiceLabel')} — ${formatCurrency(inv.total)}`,
      subtitle: `${studentName} · ${t(invoiceStatusKey(inv.status))}`,
      badge: {
        text: t(invoiceStatusKey(inv.status)),
        tone: inv.status === 'PAID' ? 'emerald' : inv.status === 'OVERDUE' ? 'rose' : 'amber',
      },
      metrics: [
        { label: t('invoices.total'), value: formatCurrency(inv.total) },
        { label: t('invoices.col.totalPaid'), value: formatCurrency(inv.paidAmount || 0), trend: 'up' },
        { label: t('invoices.col.balanceDue'), value: formatCurrency(bal), trend: bal > 0 ? 'down' : 'neutral' },
        { label: t('common.status'), value: t(invoiceStatusKey(inv.status)) },
      ],
      details: [
        { label: t('invoices.numberLabel'), value: inv.number || inv.id, copyable: true },
        { label: t('invoices.col.student'), value: studentName },
        { label: t('common.date'), value: formatDate(inv.createdAt) },
        { label: t('payments.form.dueDate'), value: inv.dueDate ? formatDate(inv.dueDate) : '—' },
      ],
      primaryAction: {
        label: t('invoices.sidecar.pdfStudioAria'),
        onExecute: () => openExecutiveInvoiceStudio(inv),
      },
      secondaryAction: bal > 0 ? {
        label: t('invoices.sidecar.receivePayment'),
        onExecute: () => {
          setPayTarget(inv);
          setPaymentForm({
            amount: String(bal),
            method: 'CASH',
            description: '',
            reference: '',
          });
        },
      } : undefined,
    };
    openSidecar(data);
  }, [sound, openExecutiveInvoiceStudio, t]);

  /* ── Fast Keyboard Navigation ───────────────────────────────── */
  const {
    focusedIndex,
    selectedIds,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useListKeyboardNavigation<any>({
    items,
    getItemId: (inv) => inv.id,
    rowIdPrefix: 'invoice-row-',
    onSelect: (inv) => openExecutiveInvoiceStudio(inv),
    onQuickLook: (inv) => handleOpenInvoiceSidecar(inv),
    onEdit: (inv) => {
      setPayTarget(inv);
      setPaymentForm({
        amount: String(remaining(inv)),
        method: 'CASH',
        description: '',
        reference: '',
      });
    },
  });

  const handleExportSelectedInvoicesCsv = useCallback(() => {
    const selectedList = items.filter((inv) => selectedIds.has(inv.id));
    if (!selectedList.length) return;
    const headers = ['ID', 'Number', 'Student', 'Total', 'Paid', 'Status', 'CreatedAt'];
    const rows = selectedList.map((inv) => [
      inv.id,
      inv.number || '',
      inv.student?.user ? [inv.student?.user?.firstName, inv.student?.user?.lastName].filter(Boolean).join(' ') || inv.student?.user?.email || '—' : inv.studentId || '',
      inv.total,
      inv.paidAmount || 0,
      inv.status,
      inv.createdAt,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `medu-invoices-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    push('success', t('invoices.batch.exportedCsv', { count: selectedList.length }));
  }, [items, selectedIds, push, t]);

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (invoices.isLoading) {
    return (
      <div className="page-container space-y-5">
        <div className="h-28 rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80" />
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
      className="relative page-container space-y-5 pb-[max(6rem,env(safe-area-inset-bottom))]"
    >
      <AuroraMesh />

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
                background: 'linear-gradient(135deg, #6366F1 0%, #6366F1 100%)',
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
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#6366F1]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#6366F1]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  {t('invoices.billing')}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#2563EB]">
                  <Icon paths={I.layers} size={11} strokeWidth={2.5} />
                  {stats.count} {t('invoices.kpi.total')}
                </span>
                {stats.overdue > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#EF4444]">
                    <span className="relative flex h-1.5 w-1.5">
                      <motion.span
                        className="absolute inset-0 rounded-full bg-[#EF4444]"
                        animate={{ scale: [1, 2.4, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                      />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
                    </span>
                    {stats.overdue} {t('invoices.kpi.overdue')}
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('nav.invoices')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">
                {t('invoices.subtitle')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  variant="secondary"
                  onClick={() => setProrateOpen(true)}
                  className="min-h-[44px] px-4"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon paths={I.calculator} size={15} strokeWidth={2.2} />
                    {t('invoices.prorate.button')}
                  </span>
                </GlassButton>
              </motion.div>
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={SPRING.snappy}
            >
              <GlassButton
                variant="primary"
                onClick={() => setCreateOpen(true)}
                className="min-h-[44px] px-5"
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                <span className="inline-flex items-center gap-2">
                  <Icon paths={I.plus} size={15} strokeWidth={2.5} />
                  {t('invoices.createDraft')}
                </span>
              </GlassButton>
            </motion.div>
            </div>
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
          className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 p-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-sm"
        >
          <div className="overflow-x-auto">
            <GlassTabs
              aria-label={t('invoices.filterByStatus') || 'Invoices status filter'}
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
        className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-surface-900/80 shadow-card"
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
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6366F1]/10 text-[#6366F1]"
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
              <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#64748B]">
                {statusFilter ? t('invoices.emptyFiltered') : t('invoices.emptyHint')}
              </p>
              {!statusFilter && (
                <div className="mt-5">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => setCreateOpen(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}>
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
          <div className="relative divide-y divide-slate-200/80 dark:divide-slate-800 dark:divide-[#ffffff08]">
            {items.map((inv: any, idx: number) => {
              const bal = remaining(inv);
              const seed = inv.number || inv.id || 'invoice';
              const studentName = inv.student?.user
                ? [inv.student?.user?.firstName, inv.student?.user?.lastName].filter(Boolean).join(' ') || inv.student?.user?.email || '—'
                : inv.studentId?.slice(0, 8) ?? '—';
              const isRowSelected = isSelected(inv.id);
              const isRowFocused = focusedIndex === idx;

              return (
                <motion.div
                  key={inv.id}
                  id={`invoice-row-${inv.id}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING.smooth, delay: idx * 0.03 }}
                  className={`group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3.5 transition-all ${
                    isRowFocused
                      ? 'ring-2 ring-primary bg-primary/[0.06] rounded-xl'
                      : isRowSelected
                      ? 'bg-primary/[0.04]'
                      : 'hover:bg-primary/[0.03]'
                  }`}
                >
                  {/* Top / Left: Selection + Tile + Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Selection Checkbox with 44x44px touch hitbox */}
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center cursor-pointer -ml-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(inv.id);
                      }}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                          isRowSelected
                            ? 'border-primary bg-primary text-white shadow-sm'
                            : 'border-zinc-300 bg-white/50 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800/50'
                        }`}
                        aria-label={t('invoices.selectAria', { number: inv.number || inv.id?.slice(0, 8) || "—" })}
                      >
                        {isRowSelected && (
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>

                    <InvoiceTile seed={seed} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-mono text-[13.5px] font-bold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                          {inv.number || inv.id?.slice(0, 8) || "—"}
                        </p>
                        <StatusPill status={inv.status} label={t(invoiceStatusKey(inv.status))} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#64748B]">
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
                  </div>

                  {/* Desktop Column: Total Paid */}
                  <div className="hidden flex-col items-end sm:flex shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                      {t('invoices.col.totalPaid')}
                    </span>
                    <span className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-[#10B981]">
                      {formatCurrency(Number(inv.paidAmount || 0))}
                    </span>
                  </div>

                  {/* Bottom / Right: Balance Due + Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t border-black/[0.04] dark:border-white/[0.04] sm:border-0 shrink-0">
                    <div className="flex flex-col items-start sm:items-end shrink-0">
                      <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-[#F43F5E]">
                        {t('invoices.col.balanceDue')}
                      </span>
                      <span className="mt-0.5 font-mono text-[13.5px] sm:text-[14px] font-bold tabular-nums tracking-tight text-[#F43F5E]">
                        {formatCurrency(bal)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {inv.status === 'DRAFT' && (
                        <motion.button
                          type="button"
                          onClick={() => setIssueTarget(inv)}
                          whileHover={{ scale: 1.04, y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          transition={SPRING.snappy}
                          className="inline-flex min-h-[44px] h-11 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold tracking-tight outline-none"
                          style={{
                            background: 'rgba(37,99,235,0.10)',
                            color: '#2563EB',
                            border: '1px solid rgba(37,99,235,0.22)',
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <Icon paths={I.upload} size={14} strokeWidth={2.4} />
                          <span className="hidden sm:inline">{t('invoices.confirmIssue')}</span>
                        </motion.button>
                      )}
                      {inv.status !== 'DRAFT' && bal > 0 && (
                        <motion.button
                          type="button"
                          data-testid="invoice-record-payment-btn"
                          onClick={() => setPayTarget(inv)}
                          whileHover={{ scale: 1.04, y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          transition={SPRING.snappy}
                          aria-label={t('invoices.recordPayment')}
                          title={t('invoices.recordPayment')}
                          className="inline-flex min-h-[44px] h-11 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold tracking-tight outline-none"
                          style={{
                            background: 'rgba(16,185,129,0.10)',
                            color: '#10B981',
                            border: '1px solid rgba(16,185,129,0.22)',
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <Icon paths={I.cash} size={14} strokeWidth={2.4} />
                          <span className="hidden sm:inline">{t('invoices.recordPayment')}</span>
                        </motion.button>
                      )}
                      {Number(inv.paidAmount || 0) > 0 && (
                        <motion.button
                          type="button"
                          onClick={() => setRefundTarget(inv)}
                          whileHover={{ scale: 1.04, y: -1 }}
                          whileTap={{ scale: 0.96 }}
                          transition={SPRING.snappy}
                          className="inline-flex min-h-[44px] h-11 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold tracking-tight outline-none"
                          style={{
                            background: 'rgba(244,63,94,0.10)',
                            color: '#F43F5E',
                            border: '1px solid rgba(244,63,94,0.22)',
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <Icon paths={I.refresh} size={14} strokeWidth={2.4} />
                          <span className="hidden sm:inline">{t('invoices.recordRefund')}</span>
                        </motion.button>
                      )}
                      <motion.button
                        type="button"
                        onClick={() => setPaymentLinksTarget(inv)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={SPRING.snappy}
                        aria-label={t('invoices.payLinks.aria')}
                        title={t('invoices.payLinks.aria')}
                        className="flex h-11 w-11 items-center justify-center rounded-xl outline-none"
                        style={{
                          background: 'rgba(2,132,199,0.12)',
                          color: '#2563EB',
                          border: '1px solid rgba(37,99,235,0.22)',
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <Icon paths={I.qrCode} size={15} strokeWidth={2.2} />
                      </motion.button>

                      {/* Sidecar Split-View trigger */}
                      <motion.button
                        type="button"
                        data-testid="invoice-sidecar-btn"
                        onClick={() => handleOpenInvoiceSidecar(inv)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={t('invoices.sidecar.title')}
                        title={t('invoices.sidecar.title')}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-subtle bg-surface/80 text-secondary hover:text-primary hover:border-primary/40 transition-colors"
                      >
                        <span className="text-[13px] leading-none">◨</span>
                      </motion.button>

                      {/* Executive PDF Studio button */}
                      <motion.button
                        type="button"
                        onClick={() => openExecutiveInvoiceStudio(inv)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={t('invoices.sidecar.pdfStudioAria')}
                        title={t('invoices.sidecar.pdfStudioAria')}
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Printer className="h-4 w-4" />
                      </motion.button>
                    </div>
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
            if (!payTarget || recordPayment.isPending) return;
            const cleanStr = paymentForm.amount.trim().replace(/,/g, '.').replace(/\s+/g, '');
            const amount = parseFloat(cleanStr);
            if (!Number.isFinite(amount) || amount <= 0) {
              push('error', t('invoices.amountPositive'));
              return;
            }
            if (amount > remaining(payTarget)) {
              push('error', t('invoices.amountExceeds'));
              return;
            }
            recordPayment.mutate({
              invoiceId: payTarget.id,
              data: { ...paymentForm, amount: cleanStr },
            });
          }}
          className="space-y-5"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-2xl border border-[#10B98133] bg-[#10B981]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#10B981]/15 text-[#10B981]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('invoices.recordPaymentDesc')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-500/[0.02] p-4 dark:border-[#ffffff08] dark:bg-[#ffffff04]">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                {t('invoices.invoiceLabel')}
              </p>
              <p className="mt-1 font-mono text-[13.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                {payTarget?.number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
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

          <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setPayTarget(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
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
          <div className="flex items-start gap-3 rounded-2xl border border-[#2563EB33] bg-[#2563EB]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2563EB]/15 text-[#2563EB]">
              <Icon paths={I.upload} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12.5px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('invoices.issueBody', { number: issueTarget?.number ?? '' })}
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setIssueTarget(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
                {t('common.cancel')}
              </GlassButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="primary"
                disabled={issue.isPending}
                onClick={() => issueTarget && issue.mutate(issueTarget.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
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
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-500/[0.02] p-4 dark:border-[#ffffff08] dark:bg-[#ffffff04]">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  {t('invoices.invoiceLabel')}
                </p>
                <p className="mt-1 font-mono text-[13.5px] font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {(invoiceDetail.data as any).number}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
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
                          style={{ color: isSucceeded ? '#10B981' : '#64748B' }}
                        >
                          {t(invoiceStatusKey(p.status))}
                        </span>
                      </motion.label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] font-medium text-[#64748B]">{t('invoices.noPayments')}</p>
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
              <div className="space-y-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                  {t('invoices.refundHistory')}
                </p>
                {(invoiceDetail.data as any).refunds.map((r: InvoiceRefund) => (
                  <div
                    key={r.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-500/[0.02] p-3.5 dark:border-[#ffffff08] dark:bg-[#ffffff04] sm:flex-row sm:items-center sm:justify-between"
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
                                : '#64748B',
                          }}
                        >
                          {t(`invoices.refundStatus.${r.status}`)}
                        </span>
                      </div>
                      {r.reason && (
                        <p className="mt-1 truncate text-[11.5px] font-medium text-[#64748B]">{r.reason}</p>
                      )}
                      <p className="mt-0.5 text-[10.5px] text-[#64748B]">
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
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e: any) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}>
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
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e: any) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.currentTarget.click();
                            }
                          }}>
                          {t('invoices.reject')}
                        </GlassButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setRefundTarget(null);
                    setRefundForm(EMPTY_REFUND);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
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
                  onClick={() => {
                    if (requestRefund.isPending) return;
                    const cleanRefund = refundForm.amount.trim().replace(/,/g, '.').replace(/\s+/g, '');
                    const amountNum = parseFloat(cleanRefund);
                    if (!Number.isFinite(amountNum) || amountNum <= 0) return;
                    requestRefund.mutate({ ...refundForm, amount: amountNum });
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
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

          <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setRejectTarget(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
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
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
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
              if (createInvoice.isPending) return;
              const { description, unitPrice, ...rest } = createForm;
              const cleanUnitPrice = unitPrice.trim().replace(/,/g, '.').replace(/\s+/g, '');
              const parsedUnitPrice = parseFloat(cleanUnitPrice);
              createInvoice.mutate({
                ...rest,
                items: [{
                  description,
                  unitPrice: Number.isFinite(parsedUnitPrice) ? Math.round(parsedUnitPrice * 100) / 100 : 0,
                  quantity: 1,
                }],
              });
            }
          }}
          className="space-y-5"
          noValidate
        >
          <div className="flex items-center gap-3 rounded-2xl border border-[#6366F133] bg-[#6366F1]/[0.06] px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#6366F1]/15 text-[#6366F1]">
              <Icon paths={I.sparkles} size={18} strokeWidth={2} />
            </div>
            <p className="text-[12px] font-medium leading-snug text-[#1D1D1F] dark:text-[#F5F5F7]">
              {t('invoices.createDraftDesc')}
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
            <p className="text-[12.5px] font-medium text-[#EF4444]" role="alert">
              {createErrors._error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-4 dark:border-[#ffffff08]">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <GlassButton
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
                disabled={createInvoice.isPending}
                role="button"
                tabIndex={0}
                onKeyDown={(e: any) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.currentTarget.click();
                  }
                }}>
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
              className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white p-6 text-[#1D1D1F] dark:border-slate-800 dark:bg-[#131622] dark:text-[#F5F5F7] sm:p-8"
              style={{
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 30px -18px rgba(0,0,0,0.15)',
              }}
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5 dark:border-[#ffffff08]">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[16px] font-black text-white"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1 0%, #6366F1 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
                    }}
                  >
                    M
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight">{t('common.meduAcademy')}</h2>
                    <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">
                      Official Tuition & Billing Document
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-[20px] font-black uppercase tracking-tight">
                    {t('invoices.preview.invoice')}
                  </h1>
                  <p className="mt-1 font-mono text-[12.5px] font-semibold text-[#64748B]">
                    #{previewTarget.number || previewTarget.id?.slice(0, 8) || "—"}
                  </p>
                  <div className="mt-2 flex justify-end">
                    <StatusPill status={previewTarget.status} label={t(invoiceStatusKey(previewTarget.status))} />
                  </div>
                </div>
              </div>

              {/* Meta */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                    {t('invoices.preview.billedTo')}
                  </p>
                  <p className="mt-1 text-[13px] font-bold">
                    {previewTarget.student?.user
                      ? [previewTarget.student?.user?.firstName, previewTarget.student?.user?.lastName].filter(Boolean).join(' ') || previewTarget.student?.user?.email || '—'
                      : previewTarget.studentId || '—'}
                  </p>
                  {previewTarget.student?.user?.email && (
                    <p className="text-[11px] text-[#64748B]">{previewTarget.student?.user?.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
                    {t('invoices.preview.issueDate')}
                  </p>
                  <p className="mt-1 text-[13px] font-medium">
                    {previewTarget.issueDate
                      ? formatDate(previewTarget.issueDate)
                      : formatDate(previewTarget.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#64748B]">
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
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 dark:border-[#ffffff08]">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-[#00000003] text-[10.5px] font-bold uppercase tracking-wider text-[#64748B] dark:bg-[#ffffff04]">
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
                  <div className="flex justify-between border-b border-slate-200/80 dark:border-slate-800 py-1.5 dark:border-[#ffffff08]">
                    <span className="text-[#64748B]">{t('invoices.preview.subtotal')}</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(Number(previewTarget.subtotal || previewTarget.total || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/80 dark:border-slate-800 py-1.5 dark:border-[#ffffff08]">
                    <span className="text-[#64748B]">{t('invoices.preview.paidAmount')}</span>
                    <span className="font-mono font-medium text-[#10B981]">
                      {formatCurrency(Number(previewTarget.paidAmount || 0))}
                    </span>
                  </div>
                  {Number(previewTarget.refundedAmount || 0) > 0 && (
                    <div className="flex justify-between border-b border-slate-200/80 dark:border-slate-800 py-1.5 dark:border-[#ffffff08]">
                      <span className="text-[#64748B]">{t('invoices.preview.refunded')}</span>
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
              <div className="mt-6 flex flex-col gap-3 border-t border-slate-200/80 dark:border-slate-800 pt-4 text-[10.5px] text-[#64748B] dark:border-[#ffffff08] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-[#4A4A4F] dark:text-[#C7C7CC]">
                    {t('invoices.preview.paymentInstructions')}
                  </p>
                  <p>
                    {t('invoices.preview.instructionDetails', {
                      number: previewTarget.number || previewTarget.id?.slice(0, 8) || "—",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#4A4A4F] dark:text-[#C7C7CC]">{t('common.meduSystems')}</p>
                  <p>{t('invoices.preview.thankYou')}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setPreviewTarget(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
                  {t('common.close')}
                </GlassButton>
              </motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <GlassButton
                  type="button"
                  variant="primary"
                  onClick={() => window.print()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.currentTarget.click();
                    }
                  }}>
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

      {/* ============================================================
          PRORATE TUITION MODAL (Kunbay Biling)
      ============================================================ */}
      <GlassModal
        open={prorateOpen}
        onClose={() => setProrateOpen(false)}
        title={t('invoices.prorate.title')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!prorateForm.studentId) {
              push('error', t('payments.form.selectStudent'));
              return;
            }
            createProratedInvoice.mutate({
              studentId: prorateForm.studentId,
              monthlyTuition: Number(prorateForm.monthlyTuition) || 0,
              totalLessonsInMonth: Number(prorateForm.totalLessons) || 12,
              attendedLessons: Number(prorateForm.attendedLessons) || 0,
              reason: prorateForm.reason,
            });
          }}
          className="space-y-4"
        >
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3.5 text-xs text-sky-800 dark:text-sky-200">
            <p className="font-semibold">{t('invoices.prorate.title')}</p>
            <p className="mt-1 text-[11px] opacity-80">
              {t('invoices.prorate.desc')}
            </p>
          </div>

          <GlassField label={t('invoices.prorate.student')} required>
            <GlassSelect
              value={prorateForm.studentId}
              onChange={(e) => setProrateForm({ ...prorateForm, studentId: e.target.value })}
              required
              className="min-h-[44px]"
            >
              <option value="">{t('payments.form.selectStudent')}</option>
              {((students.data as any)?.items || []).map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.user?.firstName} {s.user?.lastName} {s.phone ? `(${s.phone})` : ''}
                </option>
              ))}
            </GlassSelect>
          </GlassField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <GlassField label={t('invoices.prorate.monthlyTuition')} required>
              <GlassInput
                type="number"
                placeholder="800 000"
                value={prorateForm.monthlyTuition}
                onChange={(e) => setProrateForm({ ...prorateForm, monthlyTuition: e.target.value })}
                required
                className="min-h-[44px]"
              />
            </GlassField>

            <GlassField label={t('invoices.prorate.totalLessons')} required>
              <GlassInput
                type="number"
                value={prorateForm.totalLessons}
                onChange={(e) => setProrateForm({ ...prorateForm, totalLessons: e.target.value })}
                required
                className="min-h-[44px]"
              />
            </GlassField>

            <GlassField label={t('invoices.prorate.attendedLessons')} required>
              <GlassInput
                type="number"
                value={prorateForm.attendedLessons}
                onChange={(e) => setProrateForm({ ...prorateForm, attendedLessons: e.target.value })}
                required
                className="min-h-[44px]"
              />
            </GlassField>
          </div>

          {Number(prorateForm.monthlyTuition) > 0 && Number(prorateForm.totalLessons) > 0 && (
            <div className="rounded-2xl border border-black/[0.08] bg-slate-50 dark:bg-slate-900/40 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span>1 ta dars narxi:</span>
                <span className="font-mono font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {formatCurrency(Math.round(Number(prorateForm.monthlyTuition) / (Number(prorateForm.totalLessons) || 1)))}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-black/[0.05] pt-2 text-sm font-bold dark:border-white/[0.05]">
                <span className="text-[#1D1D1F] dark:text-[#F5F5F7]">{t('invoices.prorate.calculatedTotal')}:</span>
                <span className="font-mono text-base text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(
                    Math.round(
                      (Number(prorateForm.monthlyTuition) / (Number(prorateForm.totalLessons) || 1)) *
                        (Number(prorateForm.attendedLessons) || 0)
                    )
                  )}
                </span>
              </div>
            </div>
          )}

          <GlassField label={t('common.description')}>
            <GlassInput
              value={prorateForm.reason}
              onChange={(e) => setProrateForm({ ...prorateForm, reason: e.target.value })}
              placeholder={t('invoices.prorate.defaultReason')}
              className="min-h-[44px]"
            />
          </GlassField>

          <div className="flex justify-end gap-2 pt-2">
            <GlassButton type="button" variant="secondary" onClick={() => setProrateOpen(false)} className="min-h-[44px]">
              {t('common.cancel')}
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={createProratedInvoice.isPending} className="min-h-[44px]">
              {createProratedInvoice.isPending ? t('common.saving') : t('invoices.prorate.submit')}
            </GlassButton>
          </div>
        </form>
      </GlassModal>

      {/* ============================================================
          PAYME & CLICK PAYMENT LINKS MODAL
      ============================================================ */}
      <GlassModal
        open={!!paymentLinksTarget}
        onClose={() => setPaymentLinksTarget(null)}
        title={t('invoices.payLinks.title')}
      >
        {paymentLinksTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <span>{t('invoices.numberLabel')}:</span>
                <span className="font-mono font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">
                  {paymentLinksTarget.number || paymentLinksTarget.id?.slice(0, 8) || "—"}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-[#64748B]">
                <span>{t('invoices.col.balanceDue')}:</span>
                <span className="font-mono text-sm font-bold text-[#F43F5E]">
                  {formatCurrency(remaining(paymentLinksTarget))}
                </span>
              </div>
            </div>

            {paymentLinksQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <span className="text-xs text-[#64748B]">{t('invoices.loading')}</span>
              </div>
            ) : paymentLinksQuery.data ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-800 dark:text-cyan-200 text-sm">Payme</span>
                      <a
                        href={paymentLinksQuery.data.paymeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-cyan-700 min-h-[36px] inline-flex items-center justify-center"
                      >
                        {t('invoices.pay')}
                      </a>
                    </div>
                    <p className="mt-1 text-[10px] text-cyan-900/70 dark:text-cyan-200/70">
                      {t('invoices.payLinks.desc')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator?.clipboard?.writeText) {
                          navigator.clipboard
                            .writeText(paymentLinksQuery.data.paymeUrl)
                            .then(() => push('success', t('invoices.payLinks.copied')))
                            .catch(() => push('error', 'Clipboard ruxsati berilmadi'));
                        }
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 hover:underline min-h-[36px]"
                    >
                      <Icon paths={I.copy} size={11} strokeWidth={2} />
                      {t('invoices.payLinks.copyLink')}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-brand-500/25 bg-brand-500/10 p-3.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-800 dark:text-blue-200 text-sm">Click</span>
                      <a
                        href={paymentLinksQuery.data.clickUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-blue-700 min-h-[36px] inline-flex items-center justify-center"
                      >
                        {t('invoices.pay')}
                      </a>
                    </div>
                    <p className="mt-1 text-[10px] text-blue-900/70 dark:text-blue-200/70">
                      {t('invoices.payLinks.desc')}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator?.clipboard?.writeText) {
                          navigator.clipboard
                            .writeText(paymentLinksQuery.data.clickUrl)
                            .then(() => push('success', t('invoices.payLinks.copied')))
                            .catch(() => push('error', 'Clipboard ruxsati berilmadi'));
                        }
                      }}
                      className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 hover:underline min-h-[36px]"
                    >
                      <Icon paths={I.copy} size={11} strokeWidth={2} />
                      {t('invoices.payLinks.copyLink')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white p-5 text-center shadow-sm dark:border-white/[0.08] dark:bg-black/40">
                  <img
                    src={paymentLinksQuery.data.qrCodeUrl}
                    alt="To'lov QR Kodi"
                    decoding="async"
                    className="h-44 w-44 rounded-xl border border-black/[0.08] p-2 dark:border-white/[0.08]"
                  />
                  <p className="mt-3 text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7]">
                    Payme / Click QR
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {t('invoices.payLinks.desc')}
                  </p>
                </div>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(paymentLinksQuery.data.paymeUrl)}&text=${encodeURIComponent(
                    `Hurmatli ota-ona! ${paymentLinksTarget.number || 'Invoys'} uchun to'lov miqdori: ${formatCurrency(
                      remaining(paymentLinksTarget)
                    )}. Quyidagi havola orqali to'lashingiz mumkin:`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-xs font-bold text-white shadow-sm hover:bg-sky-600 min-h-[44px]"
                >
                  <Icon paths={I.telegram} size={14} strokeWidth={2} />
                  {t('invoices.preview.paymentInstructions')} (Telegram)
                </a>
              </div>
            ) : null}

            <div className="flex justify-end pt-2">
              <GlassButton type="button" variant="secondary" onClick={() => setPaymentLinksTarget(null)} className="min-h-[44px]">
                {t('common.close')}
              </GlassButton>
            </div>
          </div>
        )}
      </GlassModal>

      {/* Floating Action Island for batch operations */}
      <FloatingActionIsland
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={[
          {
            label: 'CSV Eksport',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            ),
            onClick: handleExportSelectedInvoicesCsv,
            shortcutBadge: 'e',
          },
        ]}
      />

      {/* Executive PDF Studio Modal */}
      <ExecutivePDFStudio
        open={studioDocData !== null}
        onClose={() => setStudioDocData(null)}
        initialData={studioDocData ?? undefined}
      />
    </motion.div>
  );
}

export default InvoicesPage;
