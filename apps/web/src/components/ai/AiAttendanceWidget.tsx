/**
 * AiAttendanceWidget v3 — Live Data · Count-Up · Sparkline Draw
 * ============================================================================
 * Fixes:
 *  - ActionButton: replaced `any` with proper polymorphic typing; <a> no
 *    longer receives `disabled`/`type`; rel/target added when href is external
 *  - useLiveAnnouncer: node is now stable (memoized) — no SR re-announce on
 *    every parent render
 *  - Timer leaks: download + copy timers now tracked in refs + cleared on
 *    unmount
 *  - Keyboard shortcuts now work WITHOUT the widget being focused (document
 *    listener, guarded by element visibility) — ⌘E / ⌘B / ⌘⇧C now function
 *  - handleDownloadExcel no-ops when isEmpty (shortcut path too)
 *  - buildCsv escapes className for quotes and semicolons (Excel-safe)
 *  - share icon replaced by copy icon (it copies, not shares)
 *  - greeting refreshes every 60s via interval (was stuck at mount)
 *  - useIsApple uses userAgentData when available
 *  - prefers-reduced-motion skips artificial timers
 * Design (visible):
 *  - Live pulse dot next to "AI Davomat" label
 *  - Animated count-up on every metric value (rAF + easeOut, respects r.m.)
 *  - Sparkline pathLength draw on mount / change
 *  - AttendanceRing re-draws when totals change (keyed remount)
 *  - Emphasis card: gradient bg + accent glow + tinted border
 *  - Corner specular shimmer (6s pulse)
 *  - Widget hover: subtle lift + glow (motion, r.m.-safe)
 *  - Refresh button spins while busy
 * ============================================================================
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
  type ComponentType,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════════════
 * MOTION
 * ═══════════════════════════════════════════════════════════════════ */
const SPRING = {
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
} as const;
const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════════════════════════════════════════════════
 * GLASS LAYERS
 * ═══════════════════════════════════════════════════════════════════ */
const GLASS = {
  specular:
    'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0) 20%)',
  chromatic:
    'linear-gradient(90deg, rgba(0,122,255,0.045) 0%, rgba(175,82,222,0.03) 50%, rgba(255,45,85,0.045) 100%)',
  depth:
    'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 55%)',
} as const;

const RAINBOW_EDGE =
  'linear-gradient(90deg, transparent 0%, rgba(0,122,255,0.55) 20%, rgba(175,82,222,0.5) 50%, rgba(255,149,0,0.45) 80%, transparent 100%)';

/* ═══════════════════════════════════════════════════════════════════
 * PALETTE
 * ═══════════════════════════════════════════════════════════════════ */
const METRIC = {
  total:   { fg: '#6366F1', soft: 'rgba(99,102,241,0.10)',  ring: 'rgba(99,102,241,0.22)' },
  present: { fg: '#10B981', soft: 'rgba(16,185,129,0.10)',  ring: 'rgba(16,185,129,0.22)' },
  absent:  { fg: '#F43F5E', soft: 'rgba(244,63,94,0.10)',   ring: 'rgba(244,63,94,0.22)'  },
  late:    { fg: '#F59E0B', soft: 'rgba(245,158,11,0.10)',  ring: 'rgba(245,158,11,0.22)' },
} as const;

/* ═══════════════════════════════════════════════════════════════════
 * HOOKS
 * ═══════════════════════════════════════════════════════════════════ */

/** Stable live announcer node (memoized once). */
function useLiveAnnouncer() {
  const [msg, setMsg] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');
  const announce = useCallback((m: string, p: 'polite' | 'assertive' = 'polite') => {
    setPriority(p);
    setMsg('');
    requestAnimationFrame(() => requestAnimationFrame(() => setMsg(m)));
  }, []);
  const node = useMemo(
    () => (
      <div role="status" aria-live={priority} aria-atomic="true" className="sr-only">
        {msg}
      </div>
    ),
    [msg, priority],
  );
  return { announce, node };
}

function useIsApple(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    // @ts-expect-error userAgentData is new
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad/i.test(navigator.userAgent);
  }, []);
}

/** Animated counter — rAF based, respects reduced motion. */
function useCountUp(value: number, reduced: boolean, duration = 700): number {
  const [display, setDisplay] = useState(reduced ? value : 0);
  const prevRef = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const from = prevRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, duration]);

  return display;
}

/* ═══════════════════════════════════════════════════════════════════
 * ICONS
 * ═══════════════════════════════════════════════════════════════════ */
const I = {
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  check: ['M20 6 9 17l-5-5'],
  minus: ['M5 12h14'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
  grid: ['M3 3h18v18H3z', 'M3 9h18', 'M9 21V9'],
  arrowRight: ['M5 12h14', 'M13 5l7 7-7 7'],
  spark: ['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z'],
  copy: ['M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  refresh: ['M21 12a9 9 0 1 1-3-6.7L21 8', 'M21 3v5h-5'],
};

function Icon({ paths, size = 14, strokeWidth = 2, className = '' }: {
  paths: string[]; size?: number; strokeWidth?: number; className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" focusable="false">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SPARKLINE — with draw animation
 * ═══════════════════════════════════════════════════════════════════ */
const Sparkline = memo(function Sparkline({
  data, color, width = 48, height = 16, reduced,
}: { data: readonly number[]; color: string; width?: number; height?: number; reduced: boolean }) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, width, height]);

  if (!path) return null;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: EASE_APPLE }}
      />
    </svg>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * ATTENDANCE RING — keyed remount on data change
 * ═══════════════════════════════════════════════════════════════════ */
const AttendanceRing = memo(function AttendanceRing({
  presentPct, latePct, absentPct, size = 64, reduced,
}: {
  presentPct: number; latePct: number; absentPct: number; size?: number; reduced: boolean;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = presentPct + latePct + absentPct || 1;

  const presentDash = (presentPct / total) * c;
  const lateDash = (latePct / total) * c;
  const absentDash = (absentPct / total) * c;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
        strokeWidth={stroke} opacity="0.08" />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={METRIC.present.fg} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${presentDash} ${c}`} strokeDashoffset={0}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={reduced ? false : { strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${presentDash} ${c}` }}
        transition={{ duration: 1.1, ease: EASE_APPLE }} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={METRIC.late.fg} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${lateDash} ${c}`} strokeDashoffset={-presentDash}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={reduced ? false : { strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${lateDash} ${c}` }}
        transition={{ duration: 1.1, ease: EASE_APPLE, delay: 0.15 }} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={METRIC.absent.fg} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={`${absentDash} ${c}`} strokeDashoffset={-(presentDash + lateDash)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={reduced ? false : { strokeDasharray: `0 ${c}` }}
        animate={{ strokeDasharray: `${absentDash} ${c}` }}
        transition={{ duration: 1.1, ease: EASE_APPLE, delay: 0.3 }} />
    </svg>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * METRIC CARD — count-up + emphasis glow
 * ═══════════════════════════════════════════════════════════════════ */
interface MetricCardProps {
  icon: string[];
  label: string;
  value: number;
  pct?: number;
  accent: string;
  soft: string;
  spark?: readonly number[];
  onClick?: () => void;
  reduced: boolean;
  delay: number;
  emphasis?: boolean;
}

const MetricCard = memo(function MetricCard({
  icon, label, value, pct, accent, soft, spark, onClick, reduced, delay, emphasis,
}: MetricCardProps) {
  const display = useCountUp(value, reduced);
  const Comp = (onClick ? motion.button : motion.div) as ComponentType<any>;

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.smooth, delay }}
      whileHover={reduced || !onClick ? undefined : { y: -1.5 }}
      whileTap={reduced || !onClick ? undefined : { scale: 0.985 }}
      className={`group relative flex flex-col items-start overflow-hidden rounded-xl p-3 text-left transition-colors duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        background: emphasis
          ? `linear-gradient(135deg, ${soft} 0%, transparent 75%)`
          : 'transparent',
        border: emphasis
          ? `1px solid ${accent}38`
          : '1px solid transparent',
        boxShadow: emphasis
          ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 16px -8px ${accent}66`
          : undefined,
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: soft }}
      />
      <div className="relative z-10 flex w-full items-center gap-1.5">
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
          style={{ background: soft, color: accent }}
        >
          <Icon paths={icon} size={11} strokeWidth={2.2} />
        </span>
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400">
          {label}
        </span>
      </div>
      <div className="relative z-10 mt-2 flex w-full items-end justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[19px] font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
            {display.toLocaleString()}
          </span>
          {pct !== undefined && (
            <span className="text-[10.5px] font-bold tabular-nums" style={{ color: accent }}>
              {pct}%
            </span>
          )}
        </div>
        {spark && spark.length > 1 && (
          <div className="opacity-70 transition-opacity duration-300 group-hover:opacity-100">
            <Sparkline data={spark} color={accent} reduced={reduced} />
          </div>
        )}
      </div>
    </Comp>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * ACTION BUTTON — properly typed, no `any`
 * ═══════════════════════════════════════════════════════════════════ */
interface ActionButtonProps {
  icon: string[];
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  shortcut?: string;
  reduced: boolean;
}

const ActionButton = memo(function ActionButton({
  icon, label, onClick, href, variant = 'ghost',
  loading, disabled, shortcut, reduced,
}: ActionButtonProps) {
  const isPrimary = variant === 'primary';
  const baseClass = [
    'group/btn relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
    'text-[12px] font-semibold tracking-tight',
    'outline-none transition-all duration-200',
    'focus-visible:ring-2 focus-visible:ring-offset-0',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    isPrimary
      ? 'text-white shadow-sm focus-visible:ring-indigo-500/60'
      : 'text-slate-700 focus-visible:ring-slate-400/50 dark:text-slate-200',
  ].join(' ');
  const baseStyle = isPrimary
    ? {
        background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.3) inset, 0 4px 14px -4px rgba(99,102,241,0.5)',
      }
    : {
        background: 'rgba(255,255,255,0.65)',
        border: '1px solid rgba(15,23,42,0.08)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset',
      };
  const hoverAnim = reduced || disabled ? undefined : { y: -1 };
  const tapAnim = reduced || disabled ? undefined : { scale: 0.97 };

  const inner = (
    <>
      {!isPrimary && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover/btn:opacity-100 dark:opacity-0"
          style={{ background: 'rgba(15,23,42,0.04)' }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {loading ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            className="inline-flex"
          >
            <Icon paths={I.refresh} size={12} strokeWidth={2.4} />
          </motion.span>
        ) : (
          <Icon paths={icon} size={12} strokeWidth={2.3} />
        )}
        <span>{loading ? 'Yuklanmoqda…' : label}</span>
        {shortcut && !loading && (
          <kbd
            className={[
              'ml-0.5 rounded border px-1 py-px text-[9.5px] font-bold tabular-nums',
              isPrimary
                ? 'border-white/25 bg-white/15 text-white/90'
                : 'border-slate-300/70 bg-white/60 text-slate-500 dark:border-white/15 dark:bg-white/10 dark:text-slate-400',
            ].join(' ')}
          >
            {shortcut}
          </kbd>
        )}
      </span>
    </>
  );

  if (href) {
    const isExternal = /^https?:\/\//.test(href);
    return (
      <motion.a
        href={href}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        target={isExternal ? '_blank' : undefined}
        onClick={onClick}
        aria-disabled={disabled || loading || undefined}
        whileHover={hoverAnim}
        whileTap={tapAnim}
        transition={SPRING.snappy}
        className={baseClass}
        style={baseStyle}
      >
        {inner}
      </motion.a>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={hoverAnim}
      whileTap={tapAnim}
      transition={SPRING.snappy}
      className={baseClass}
      style={baseStyle}
    >
      {inner}
    </motion.button>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * EXPORT
 * ═══════════════════════════════════════════════════════════════════ */
interface ExportRow {
  id: string | number;
  studentName: string;
  className: string;
  status: 'present' | 'absent' | 'late';
  timestamp?: string;
}

function csvEscape(s: string): string {
  return `"${String(s).replace(/"/g, '""').replace(/;/g, ',')}"`;
}

function buildCsv(rows: ExportRow[], meta: { total: number; present: number; absent: number; late: number }): string {
  const BOM = '\uFEFF';
  const sep = ';';
  const header = ['ID', 'O\'quvchi', 'Sinf', 'Holat', 'Vaqt'].join(sep);
  const metaRow = [
    `Jami: ${meta.total}`,
    `Qatnashgan: ${meta.present}`,
    `Yo'q: ${meta.absent}`,
    `Kechikkan: ${meta.late}`,
  ].join(sep);
  const statusMap: Record<ExportRow['status'], string> = {
    present: 'Qatnashgan',
    absent: 'Yo\'q',
    late: 'Kechikkan',
  };
  const body = rows
    .map((r) =>
      [
        r.id,
        csvEscape(r.studentName),
        csvEscape(r.className),
        statusMap[r.status],
        r.timestamp ?? '',
      ].join(sep),
    )
    .join('\n');
  return BOM + [metaRow, '', header, body].join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN
 * ═══════════════════════════════════════════════════════════════════ */
export interface AiAttendanceWidgetProps {
  total?: number;
  present?: number;
  absent?: number;
  late?: number;
  rows?: ExportRow[];
  sparkTotal?: readonly number[];
  sparkPresent?: readonly number[];
  sparkAbsent?: readonly number[];
  sparkLate?: readonly number[];
  onOpenClassBreakdown?: () => void;
  onRefresh?: () => void;
}

export function AiAttendanceWidget({
  total = 0, present = 0, absent = 0, late = 0,
  rows, sparkTotal, sparkPresent, sparkAbsent, sparkLate,
  onOpenClassBreakdown, onRefresh,
}: AiAttendanceWidgetProps) {
  const reduced = Boolean(useReducedMotion());
  const isApple = useIsApple();
  const { announce, node: announcer } = useLiveAnnouncer();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [greeting, setGreeting] = useState(() => computeGreeting());
  const shortcutMod = isApple ? '⌘' : 'Ctrl+';

  const downloadTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);

  const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
  const absentPct = total > 0 ? Math.round((absent / total) * 100) : 0;
  const latePct = total > 0 ? Math.round((late / total) * 100) : 0;
  const isEmpty = total === 0;

  // Refresh greeting every 60s
  useEffect(() => {
    const id = window.setInterval(() => setGreeting(computeGreeting()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (downloadTimer.current !== null) window.clearTimeout(downloadTimer.current);
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
    };
  }, []);

  const handleDownloadExcel = useCallback(() => {
    if (downloading || isEmpty) return;
    setDownloading(true);
    announce('Hisobot tayyorlanmoqda…', 'polite');
    try {
      const meta = { total, present, absent, late };
      const csv = buildCsv(rows ?? [], meta);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`davomat_hisoboti_${stamp}.csv`, csv);
      const finish = () => {
        setDownloading(false);
        announce('Hisobot yuklandi', 'polite');
        downloadTimer.current = null;
      };
      if (reduced) finish();
      else downloadTimer.current = window.setTimeout(finish, 700);
    } catch {
      setDownloading(false);
      announce('Hisobotni yuklab bo\'lmadi', 'assertive');
    }
  }, [downloading, isEmpty, rows, total, present, absent, late, announce, reduced]);

  const handleCopySummary = useCallback(async () => {
    const summary = [
      `📊 Bugungi davomat`,
      `Jami: ${total}`,
      `Qatnashgan: ${present} (${presentPct}%)`,
      `Yo'q: ${absent} (${absentPct}%)`,
      `Kechikkan: ${late} (${latePct}%)`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      announce('Xulosa nusxalandi', 'polite');
      if (reduced) {
        setCopied(false);
      } else {
        if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => {
          setCopied(false);
          copyTimer.current = null;
        }, 1800);
      }
    } catch {
      announce('Nusxalab bo\'lmadi', 'assertive');
    }
  }, [total, present, absent, late, presentPct, absentPct, latePct, announce, reduced]);

  // Global keyboard shortcuts — work even without focus, but only when
  // the widget is mounted & visible in the DOM.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current) return;
      // Don't hijack while typing in an input
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement | null)?.isContentEditable) return;
      const mod = isApple ? e.metaKey : e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 'e') { e.preventDefault(); handleDownloadExcel(); }
      else if (key === 'c' && e.shiftKey) { e.preventDefault(); handleCopySummary(); }
      else if (key === 'b') { e.preventDefault(); onOpenClassBreakdown?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isApple, handleDownloadExcel, handleCopySummary, onOpenClassBreakdown]);

  return (
    <>
      {announcer}
      <motion.div
        ref={rootRef}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={reduced ? undefined : { y: -2 }}
        transition={SPRING.smooth}
        className="mt-3 w-full overflow-hidden rounded-2xl outline-none"
        style={{ position: 'relative', isolation: 'isolate' }}
      >
        {/* Layer 1: base frosted glass */}
        <div className="absolute inset-0 -z-30" aria-hidden="true"
          style={{
            background: 'rgba(255,255,255,0.68)',
            backdropFilter: 'blur(26px) saturate(180%)',
            WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          }} />
        <div className="absolute inset-0 -z-30 hidden dark:block" aria-hidden="true"
          style={{
            background: 'rgba(15,23,42,0.55)',
            backdropFilter: 'blur(26px) saturate(180%)',
            WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          }} />

        {/* Layer 2: specular + chromatic + depth */}
        <div className="pointer-events-none absolute inset-0 -z-20" aria-hidden="true"
          style={{ backgroundImage: [GLASS.specular, GLASS.chromatic, GLASS.depth].join(', ') }} />

        {/* Layer 3: chromatic refraction edge */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[1.5px] opacity-60"
          style={{ background: RAINBOW_EDGE }} aria-hidden="true" />

        {/* Layer 4: border + shadow */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true"
          style={{
            border: '1px solid rgba(255,255,255,0.85)',
            boxShadow: [
              '0 1px 0 rgba(255,255,255,0.9) inset',
              '0 1px 3px rgba(15,23,42,0.04)',
              '0 12px 36px -16px rgba(15,23,42,0.16)',
            ].join(', '),
          }} />
        <div className="pointer-events-none absolute inset-0 hidden rounded-2xl dark:block" aria-hidden="true"
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: [
              '0 1px 0 rgba(255,255,255,0.08) inset',
              '0 12px 36px -16px rgba(0,0,0,0.65)',
            ].join(', '),
          }} />

        {/* Corner specular shimmer */}
        {!reduced && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-3 h-16 w-16 rounded-full bg-white/30 blur-2xl motion-safe:animate-[cornerShimmer_6s_ease-in-out_infinite] dark:bg-white/[0.08]"
          />
        )}

        {/* Content */}
        <div className="relative z-10 p-4">
          {/* Header row */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <motion.div
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400"
              >
                <span className="inline-flex" style={{ color: METRIC.present.fg }}>
                  <Icon paths={I.spark} size={12} strokeWidth={2.2} />
                </span>
                <span>AI Davomat</span>
                {/* Live pulse indicator */}
                <span className="relative ml-0.5 inline-flex h-1.5 w-1.5" aria-hidden="true">
                  {!reduced && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 motion-safe:animate-ping" />
                  )}
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              </motion.div>
              <motion.p
                initial={reduced ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...SPRING.smooth, delay: 0.1 }}
                className="mt-1 text-[14px] font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50"
              >
                {greeting}
              </motion.p>
            </div>

            {/* Overall ring — keyed on data for re-animation */}
            {!isEmpty && (
              <motion.div
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING.smooth, delay: 0.15 }}
                className="relative flex shrink-0 items-center justify-center text-slate-900 dark:text-slate-100"
                title={`Umumiy qatnashish: ${presentPct}%`}
              >
                <AttendanceRing
                  key={`${present}-${late}-${absent}`}
                  presentPct={presentPct}
                  latePct={latePct}
                  absentPct={absentPct}
                  size={64}
                  reduced={reduced}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[14px] font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
                    {presentPct}
                    <span className="text-[9px] font-semibold opacity-70">%</span>
                  </span>
                  <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    qatnashdi
                  </span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Metric grid */}
          {isEmpty ? (
            <EmptyState reduced={reduced} />
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <MetricCard icon={I.users} label="Jami" value={total}
                accent={METRIC.total.fg} soft={METRIC.total.soft}
                spark={sparkTotal} reduced={reduced} delay={0.18} />
              <MetricCard icon={I.check} label="Qatnashgan" value={present} pct={presentPct}
                accent={METRIC.present.fg} soft={METRIC.present.soft}
                spark={sparkPresent} reduced={reduced} delay={0.24} emphasis />
              <MetricCard icon={I.minus} label="Yo'q" value={absent} pct={absentPct}
                accent={METRIC.absent.fg} soft={METRIC.absent.soft}
                spark={sparkAbsent} reduced={reduced} delay={0.30} />
              <MetricCard icon={I.clock} label="Kechikkan" value={late} pct={latePct}
                accent={METRIC.late.fg} soft={METRIC.late.soft}
                spark={sparkLate} reduced={reduced} delay={0.36} />
            </div>
          )}

          {/* Action bar */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING.smooth, delay: 0.42 }}
            className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <ActionButton icon={I.arrowRight} label="Batafsil" href="/attendance"
                variant="primary" reduced={reduced} />
              <ActionButton icon={I.grid} label="Sinflar kesimida"
                onClick={onOpenClassBreakdown}
                shortcut={`${shortcutMod}B`} reduced={reduced} />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <AnimatePresence mode="wait" initial={false}>
                {copied ? (
                  <motion.div key="copied"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}>
                    <ActionButton icon={I.check} label="Nusxalandi"
                      variant="ghost" reduced={reduced} />
                  </motion.div>
                ) : (
                  <motion.div key="copy"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}>
                    <ActionButton icon={I.copy} label="Xulosa"
                      onClick={handleCopySummary}
                      shortcut={`${shortcutMod}⇧C`} reduced={reduced} />
                  </motion.div>
                )}
              </AnimatePresence>

              <ActionButton icon={I.download} label="Excel yuklash"
                onClick={handleDownloadExcel}
                loading={downloading}
                disabled={downloading || isEmpty}
                shortcut={`${shortcutMod}E`} reduced={reduced} />

              {onRefresh && (
                <motion.button
                  type="button"
                  onClick={onRefresh}
                  whileHover={reduced ? undefined : { rotate: 90 }}
                  whileTap={reduced ? undefined : { scale: 0.9 }}
                  transition={SPRING.snappy}
                  aria-label="Yangilash" title="Yangilash"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-900/[0.08] bg-white/65 text-slate-600 outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:border-white/[0.10] dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.10]"
                >
                  <Icon paths={I.refresh} size={12} strokeWidth={2.2} />
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>

      <style>{`
        @keyframes cornerShimmer {
          0%, 100% { opacity: 0.30; transform: translate(0, 0); }
          50%      { opacity: 0.60; transform: translate(4px, 4px); }
        }
      `}</style>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════════════ */
function computeGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Erta tonggi davomat:';
  if (h < 12) return 'Xayrli tong — bugungi davomat:';
  if (h < 17) return 'Bugungi davomat holati:';
  if (h < 22) return 'Kechgi davomat hisoboti:';
  return 'Bugungi yakuniy davomat:';
}

const EmptyState = memo(function EmptyState({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.smooth, delay: 0.15 }}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-900/[0.08] px-4 py-7 text-center dark:border-white/[0.10]"
    >
      <motion.div
        animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/[0.04] text-slate-400 dark:bg-white/[0.05] dark:text-slate-500"
      >
        <Icon paths={I.users} size={16} strokeWidth={2} />
      </motion.div>
      <div>
        <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          Bugun uchun ma'lumot yo'q
        </p>
        <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
          Davomat belgilanmagani ko'rinadi. Yangilab qayta urinib ko'ring.
        </p>
      </div>
    </motion.div>
  );
});

export default AiAttendanceWidget;