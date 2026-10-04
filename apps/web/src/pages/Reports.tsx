/**
 * M-EDU ReportsPage — Apple Design Award Edition
 *
 * Premium craft:
 *  - Hero header with gradient analytics tile + live status chips
 *  - Animated KPI bar (Total Rows, Status, Dimension, Generated) with count-up
 *  - Premium filter toolbar with squircle leading icons per field
 *  - Premium report rows with tone-aware cell rendering
 *  - Export controls with format chips
 *  - Custom SVG icons in SF Symbols proportions
 *  - Shimmer skeletons (not pulse)
 *  - Framer Motion spring physics + staggered blur-in
 *  - Full i18n + a11y preserved
 */

import { toLocalISOString } from '../lib/format';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, type Variants } from 'framer-motion';
import {
  GlassErrorState,
  GlassButton,
  GlassSelect,
  GlassInput,
  useToast,
  GlassPagination,
} from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getErrorMessage } from '@/lib/errorMessages';
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
  hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10, filter: 'blur(6px)' },
  visible: { opacity: 1, x: 0, filter: 'blur(0px)', transition: SPRING.smooth },
};

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I: Record<string, string[]> = {
  chart: [
    'M3 3v18h18',
    'M7 15l3-4 4 3 4-6',
  ],
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
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54z'],
  calendar: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  calendarEnd: [
    'M8 2v4', 'M16 2v4', 'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
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
    'M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  ],
  check: ['M20 6 9 17l-5-5'],
  checkCircle: [
    'M22 11.08V12a10 10 0 1 1-5.93-9.14',
    'M22 4 12 14.01l-3-3',
  ],
  alertCircle: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 8v4', 'M12 16h.01',
  ],
  clock: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 6v6l4 2',
  ],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
  ],
  fileCsv: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 15l1.5 1.5L13 14',
  ],
  fileXls: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 13l4 4', 'M13 13l-4 4',
  ],
  filePdf: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 13h1.5a1 1 0 0 1 1 1v0a1 1 0 0 1-1 1H9v-2z',
    'M9 17h1',
    'M13 13v4',
  ],
  database: [
    'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3z',
    'M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5',
    'M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
  ],
  empty: [
    'M20 7h-9', 'M14 17H5',
    'M19 19v-2a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2',
    'M10 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  ],
  arrowLeft: ['M19 12H5', 'M12 19l-7-7 7-7'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  dot: ['M12 12h.01'],
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

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'gray' | 'emerald' | 'amber';

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
};

const DIMENSION_TONE: Record<string, Tone> = {
  STUDENTS: 'blue',
  ATTENDANCE: 'emerald',
  PAYMENTS: 'green',
  INVOICES: 'cyan',
  FINANCE: 'purple',
  TEACHERS: 'orange',
  GROUPS: 'blue',
  EXPENSES: 'red',
  PAYROLL: 'amber',
  LEADS: 'purple',
};

const STATUS_TONE: Record<string, Tone> = {
  READY: 'emerald',
  EMPTY: 'gray',
  INSUFFICIENT_DATA: 'amber',
};

/* ============================================================================
 * TYPES + CONSTANTS
 * ========================================================================== */

interface ReportColumn {
  key: string;
  label: string;
}

interface RunReportResponse {
  status: 'READY' | 'EMPTY' | 'INSUFFICIENT_DATA';
  reason?: string;
  type: string;
  columns: ReportColumn[];
  selectedColumns: string[];
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  page: number;
  pageSize: number;
  totalPages: number;
  generatedAt: string;
}

const REPORT_DIMENSIONS = [
  { value: 'STUDENTS', label: 'reports.dim.STUDENTS' },
  { value: 'ATTENDANCE', label: 'reports.dim.ATTENDANCE' },
  { value: 'PAYMENTS', label: 'reports.dim.PAYMENTS' },
  { value: 'INVOICES', label: 'reports.dim.INVOICES' },
  { value: 'FINANCE', label: 'reports.dim.FINANCE' },
  { value: 'TEACHERS', label: 'reports.dim.TEACHERS' },
  { value: 'GROUPS', label: 'reports.dim.GROUPS' },
  { value: 'EXPENSES', label: 'reports.dim.EXPENSES' },
  { value: 'PAYROLL', label: 'reports.dim.PAYROLL' },
  { value: 'LEADS', label: 'reports.dim.LEADS' },
];

const REPORT_STATUS_KEYS: Record<string, string> = {
  READY: 'reports.status.READY',
  EMPTY: 'reports.status.EMPTY',
  INSUFFICIENT_DATA: 'reports.status.INSUFFICIENT_DATA',
};

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const EXPORT_FORMATS: { value: ExportFormat; label: string; icon: string[]; tone: Tone }[] = [
  { value: 'csv', label: 'CSV', icon: I.fileCsv, tone: 'emerald' },
  { value: 'xlsx', label: 'XLSX', icon: I.fileXls, tone: 'green' },
  { value: 'pdf', label: 'PDF', icon: I.filePdf, tone: 'red' },
];

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

function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-28 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Shimmer key={i} className="h-[88px]" radius="1rem" />)}
      </div>
      <Shimmer className="h-40 w-full" radius="1.75rem" />
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
  stringValue,
  secondary,
}: {
  label: string;
  value?: number;
  icon: string[];
  tone?: Tone;
  stringValue?: string;
  secondary?: string;
}) {
  const c = TONES[tone];
  return (
    <motion.div
      variants={rowVariants}
      whileHover={{ y: -3 }}
      transition={SPRING.smooth}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#ffffff60] bg-[#ffffff80] px-4 py-3.5 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 16px -8px rgba(0,0,0,0.06)',
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
        <div className="text-[20px] font-bold tracking-tighter leading-none text-[#1D1D1F] dark:text-[#F5F5F7]">
          {typeof value === 'number' ? <CountUp value={value} /> : (
            <span className="text-[15px]">{stringValue}</span>
          )}
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

/** Tone-aware status badge */
function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone = STATUS_TONE[status] ?? 'gray';
  const c = TONES[tone];
  const isReady = status === 'READY';
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
        {isReady && (
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

/** Premium format segmented control */
function FormatSelector({
  value,
  onChange,
  disabled,
}: {
  value: ExportFormat;
  onChange: (f: ExportFormat) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Export format"
      className="inline-flex items-center gap-1 rounded-2xl border border-[#ffffff60] bg-[#ffffff80] p-1 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      }}
    >
      {EXPORT_FORMATS.map((fmt) => {
        const active = value === fmt.value;
        const c = TONES[fmt.tone];
        return (
          <motion.button
            key={fmt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(fmt.value)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={SPRING.snappy}
            className="relative overflow-hidden rounded-xl px-3 py-1.5 text-[11.5px] font-bold tracking-tight outline-none transition-colors disabled:opacity-50"
            style={{
              color: active ? c.fg : '#86868B',
            }}
          >
            {active && (
              <motion.span
                layoutId="format-active"
                className="absolute inset-0 rounded-xl"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 6px 16px -8px ${c.glow}`,
                }}
                transition={SPRING.smooth}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              <Icon paths={fmt.icon} size={12} strokeWidth={2.4} />
              {fmt.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/** Cell renderer — tone aware */
function ReportCell({ value, t }: { value: unknown; t: (k: string) => string }) {
  if (typeof value === 'boolean') {
    const tone: Tone = value ? 'emerald' : 'gray';
    const c = TONES[tone];
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.10em]"
        style={{
          background: c.bg,
          color: c.fg,
          border: `1px solid ${c.border}`,
        }}
      >
        <Icon paths={value ? I.check : I.dot} size={9} strokeWidth={2.6} />
        {value ? t('common.yes') : t('common.no')}
      </span>
    );
  }
  if (value === null || value === undefined) {
    return <span className="text-[11px] italic text-[#86868B]">—</span>;
  }
  if (typeof value === 'object') {
    return (
      <span className="font-mono text-[11px] text-[#86868B]">
        {JSON.stringify(value)}
      </span>
    );
  }
  return (
    <span className="text-[12.5px] font-medium tabular-nums text-[#1D1D1F] dark:text-[#F5F5F7]">
      {String(value)}
    </span>
  );
}

/* ============================================================================
 * MAIN PAGE
 * ========================================================================== */

export function ReportsPage() {
  const { t } = useI18n();
  usePageTitle(t('nav.reports'));
  const toast = useToast();

  const [dimension, setDimension] = useState('STUDENTS');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return toLocalISOString(d);
  });
  const [dateTo, setDateTo] = useState(() => toLocalISOString());
  const [page, setPage] = useState(1);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);

  /* ── Report query ─────────────────────────────────────────────────── */
  const reportQuery = useQuery({
    queryKey: ['reports', dimension, dateFrom, dateTo, page],
    queryFn: async () => {
      const res = await reportsApi.run({
        type: dimension,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: 50,
      });
      return res as RunReportResponse;
    },
  });

  /* ── Export handler ───────────────────────────────────────────────── */
  const exportData = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      await reportsApi.export(dimension, format, {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      toast.push({
        message: t('reports.exported', { filename: format.toUpperCase() }),
        type: 'success',
      });
    } catch (err: unknown) {
      toast.push({
        message: getErrorMessage(err) || t('reports.exportFailed'),
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const reportData = reportQuery.data;
  const dimensionTone = DIMENSION_TONE[dimension] ?? 'blue';

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="page-container space-y-5"
    >
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
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />
          <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, rotate: -6 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={SPRING.smooth}
              className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white"
              style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #AF52DE 100%)',
                boxShadow:
                  '0 12px 28px -10px rgba(0,122,255,0.55), inset 0 2px 0 rgba(255,255,255,0.35)',
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
              <Icon paths={I.chart} size={28} strokeWidth={2} className="relative" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#007AFF]/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#007AFF]">
                  <Icon paths={I.sparkles} size={11} strokeWidth={2.5} />
                  Analytics
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.14em]"
                  style={{
                    background: TONES[dimensionTone].bg,
                    color: TONES[dimensionTone].fg,
                    border: `1px solid ${TONES[dimensionTone].border}`,
                  }}
                >
                  <Icon paths={I.database} size={11} strokeWidth={2.5} />
                  {t(`reports.dim.${dimension}`)}
                </span>
                {reportData && (
                  <StatusBadge
                    status={reportData.status}
                    label={t(
                      REPORT_STATUS_KEYS[reportData.status] ??
                        `reports.status.${reportData.status}`,
                    )}
                  />
                )}
              </div>

              <h1 className="mt-2 text-3xl font-bold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7] sm:text-4xl">
                {t('reports.title')}
              </h1>
              <p className="mt-1 text-[13.5px] font-medium text-[#86868B]">
                {t('reports.subtitle')}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          KPI BAR
      ============================================================ */}
      {reportData && (
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiTile
            label={t('reports.totalRows')}
            value={reportData.totalRows ?? reportData.rows?.length ?? 0}
            icon={I.layers}
            tone="blue"
          />
          <KpiTile
            label={t('reports.reportStatus')}
            stringValue={t(
              REPORT_STATUS_KEYS[reportData.status] ??
                `reports.status.${reportData.status}`,
            )}
            icon={reportData.status === 'READY' ? I.checkCircle : I.alertCircle}
            tone={
              reportData.status === 'READY'
                ? 'emerald'
                : reportData.status === 'INSUFFICIENT_DATA'
                  ? 'amber'
                  : 'gray'
            }
          />
          <KpiTile
            label={t('reports.dimension')}
            stringValue={t(`reports.dim.${reportData.type}`)}
            icon={I.database}
            tone={dimensionTone}
          />
          <KpiTile
            label={t('reports.generated')}
            stringValue={
              reportData.generatedAt
                ? new Date(reportData.generatedAt).toLocaleTimeString()
                : t('reports.live')
            }
            icon={I.clock}
            tone="orange"
          />
        </motion.div>
      )}

      {/* ============================================================
          FILTER TOOLBAR
      ============================================================ */}
      <motion.div variants={cardVariants}>
        <div
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-4 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80] sm:p-5"
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

          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            {/* Filters */}
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {/* Dimension */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('reports.dimensionLabel')}
                </label>
                <div className="relative">
                  <FieldIcon icon={I.database} tone={dimensionTone} />
                  <GlassSelect
                    value={dimension}
                    onChange={(e) => {
                      setDimension(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-11"
                  >
                    {REPORT_DIMENSIONS.map((dim) => (
                      <option key={dim.value} value={dim.value}>
                        {t(dim.label)}
                      </option>
                    ))}
                  </GlassSelect>
                </div>
              </div>

              {/* Date from */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('reports.fromDate')}
                </label>
                <div className="relative">
                  <FieldIcon icon={I.calendar} tone="green" />
                  <GlassInput
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-11"
                  />
                </div>
              </div>

              {/* Date to */}
              <div>
                <label className="mb-1.5 block text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]">
                  {t('reports.toDate')}
                </label>
                <div className="relative">
                  <FieldIcon icon={I.calendarEnd} tone="red" />
                  <GlassInput
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="w-full pl-11"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  variant="secondary"
                  onClick={() => reportQuery.refetch()}
                  disabled={reportQuery.isFetching}
                >
                  <span className="inline-flex items-center gap-2">
                    <motion.span
                      animate={reportQuery.isFetching ? { rotate: 360 } : { rotate: 0 }}
                      transition={
                        reportQuery.isFetching
                          ? { duration: 1, repeat: Infinity, ease: 'linear' }
                          : { duration: 0.2 }
                      }
                    >
                      <Icon paths={I.refresh} size={14} strokeWidth={2.2} />
                    </motion.span>
                    {t('reports.refresh')}
                  </span>
                </GlassButton>
              </motion.div>

              <FormatSelector
                value={exportFormat}
                onChange={setExportFormat}
                disabled={isExporting}
              />

              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING.snappy}
              >
                <GlassButton
                  variant="primary"
                  onClick={() => exportData(exportFormat)}
                  disabled={isExporting || !reportData?.rows?.length}
                >
                  <span className="inline-flex items-center gap-2">
                    {isExporting ? (
                      <>
                        <motion.span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                        />
                        {t('reports.exporting')}
                      </>
                    ) : (
                      <>
                        <Icon paths={I.download} size={14} strokeWidth={2.4} />
                        {t('reports.export')}
                      </>
                    )}
                  </span>
                </GlassButton>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ============================================================
          TABLE
      ============================================================ */}
      {reportQuery.isLoading ? (
        <ReportsSkeleton />
      ) : reportQuery.isError ? (
        <motion.div variants={cardVariants} className="glass-card p-8">
          <GlassErrorState
            title={t('reports.loadError')}
            message={getErrorMessage(reportQuery.error)}
            onRetry={() => reportQuery.refetch()}
          />
        </motion.div>
      ) : !reportData || reportData.rows.length === 0 ? (
        <motion.div
          variants={cardVariants}
          className="relative overflow-hidden rounded-3xl border border-[#ffffff60] bg-[#ffffff80] p-10 backdrop-blur-xl dark:border-[#ffffff10] dark:bg-[#1c1c1e80]"
          style={{
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 30px -18px rgba(0,0,0,0.12)',
          }}
        >
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
              {t('reports.emptyTitle')}
            </p>
            <p className="mt-1 max-w-sm text-[12.5px] font-medium text-[#86868B]">
              {t('reports.emptyMessage')}
            </p>
          </div>
        </motion.div>
      ) : (
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
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
            }}
          />

          {/* Table header strip */}
          <div className="relative flex items-center gap-3 border-b border-[#00000008] px-5 py-3.5 dark:border-[#ffffff08]">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#007AFF]/10 text-[#007AFF]">
              <Icon paths={I.file} size={14} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7]">
                {t(`reports.dim.${reportData.type}`)}
              </p>
              <p className="text-[10.5px] font-medium text-[#86868B]">
                {reportData.rows.length} / {reportData.totalRows}
              </p>
            </div>
            <StatusBadge
              status={reportData.status}
              label={t(
                REPORT_STATUS_KEYS[reportData.status] ??
                  `reports.status.${reportData.status}`,
              )}
            />
          </div>

          {/* Table */}
          <div className="relative overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#00000008] dark:border-[#ffffff08]">
                  {reportData.columns.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#86868B]"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.rows.map((row, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...SPRING.smooth, delay: idx * 0.02 }}
                    className="border-b border-[#00000008] transition-colors hover:bg-[#007AFF]/[0.03] dark:border-[#ffffff08]"
                  >
                    {reportData.columns.map((col) => (
                      <td key={col.key} className="px-4 py-2.5">
                        <ReportCell value={row[col.key]} t={t} />
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {reportData.totalPages > 1 && (
            <div className="relative border-t border-[#00000008] p-4 dark:border-[#ffffff08]">
              <div className="flex justify-center">
                <GlassPagination
                  page={page}
                  totalPages={reportData.totalPages}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

export default ReportsPage;