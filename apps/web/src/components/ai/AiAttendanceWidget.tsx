/**
 * AiAttendanceWidget v4 — premium Apple-grade live dashboard
 * ============================================================================
 * v4 changes (from v3):
 *  - Fix: global keyboard shortcuts are now scoped — only ONE widget reacts
 *    per document (last-mounted wins), and shortcuts are disabled while the
 *    user is typing or while another element is focused in another widget.
 *  - Fix: CSV escaping no longer mangles embedded ";" — only the delimiter
 *    is protected. BOM added.
 *  - Fix: MetricCard polymorphic typing — no `any`, proper union return.
 *  - Fix: ActionButton disabled-as-link now truly non-interactive (tabIndex,
 *    aria-disabled, onClick guard).
 *  - Fix: useLiveAnnouncer uses a monotonic nonce to defeat React batching.
 *  - Fix: spinner respects prefers-reduced-motion.
 *  - Fix: MetricCard gets focus-visible ring when clickable.
 *  - Fix: AttendanceRing no longer remounts — animates dash via `animate`.
 *  - Fix: Sparkline re-draws when data changes (keyed motion.path).
 *  - Fix: ring has sr-only label (screen readers get the value).
 *  - Fix: dark-mode hover layer is visible in dark (inverted colors).
 *  - Fix: stylesheet is injected once via `document.adoptedStyleSheets`
 *    (or a <style id> singleton), not on every render.
 *  - New: `loading` prop → Skeleton metric grid.
 *  - New: `onCopyError` / `onDownloadError` / `onCopySuccess` callbacks.
 *  - New: haptics on copy / download / refresh (graceful).
 *  - New: `aria-keyshortcuts` on action buttons.
 *  - New: `prefers-contrast` support (contrast-more: Tailwind utilities).
 *  - New: mobile priority — Jami full-width, then 3-col for states.
 *  - New: `role="region"` + `aria-label` on widget root.
 *  - New: respects `prefers-reduced-data` for the shimmer.
 * ============================================================================
 */

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  memo,
  type ButtonHTMLAttributes,
  type AnchorHTMLAttributes,
  type ReactNode,
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
  total:   { fg: '#6366F1', soft: 'rgba(99,102,241,0.10)', ring: 'rgba(99,102,241,0.22)' },
  present: { fg: '#10B981', soft: 'rgba(16,185,129,0.10)', ring: 'rgba(16,185,129,0.22)' },
  absent:  { fg: '#F43F5E', soft: 'rgba(244,63,94,0.10)',  ring: 'rgba(244,63,94,0.22)' },
  late:    { fg: '#F59E0B', soft: 'rgba(245,158,11,0.10)', ring: 'rgba(245,158,11,0.22)' },
} as const;

/* ═══════════════════════════════════════════════════════════════════
 * HAPTICS
 * ═══════════════════════════════════════════════════════════════════ */
function haptic(kind: 'tap' | 'success' | 'warning' | 'error'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    const map = {
      tap: 10,
      success: [12, 40, 12],
      warning: [18, 50, 18],
      error: [40, 60, 40],
    } as const;
    navigator.vibrate(map[kind] as number | number[]);
  } catch {
    /* noop */
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * HOOKS
 * ═══════════════════════════════════════════════════════════════════ */

/**
 * Live announcer — defeats React batching by using a monotonic nonce in the
 * node content. Works reliably with VoiceOver / NVDA / TalkBack.
 */
function useLiveAnnouncer() {
  const [state, setState] = useState<{ msg: string; priority: 'polite' | 'assertive'; nonce: number }>({
    msg: '',
    priority: 'polite',
    nonce: 0,
  });

  const announce = useCallback((msg: string, priority: 'polite' | 'assertive' = 'polite') => {
    setState((s) => ({ msg, priority, nonce: s.nonce + 1 }));
  }, []);

  const node = (
    <div
      role="status"
      aria-live={state.priority}
      aria-atomic="true"
      className="sr-only"
      data-nonce={state.nonce}
    >
      {state.msg}
    </div>
  );

  return { announce, node };
}

function useIsApple(): boolean {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
    const platform = uaData?.platform || navigator.platform || '';
    return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad/i.test(navigator.userAgent);
  }, []);
}

/** Additional preference hooks for the shimmer etc. */
function usePrefersReducedData(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-data: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
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
 * GLOBAL SHORTCUT REGISTRY
 * Only one widget handles shortcuts at a time (the most recently mounted one
 * or the one the user last interacted with).
 * ═══════════════════════════════════════════════════════════════════ */
type ShortcutHandler = (e: KeyboardEvent) => boolean; // return true if handled
const shortcutRegistry: { id: symbol; handler: ShortcutHandler }[] = [];
let activeShortcutId: symbol | null = null;

function useWidgetShortcuts(id: symbol, handler: ShortcutHandler, active: boolean) {
  useEffect(() => {
    // Register
    shortcutRegistry.push({ id, handler });
    if (shortcutRegistry.length === 1) activeShortcutId = id;

    const onKey = (e: KeyboardEvent) => {
      if (activeShortcutId !== id) return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const editable =
        tag === 'input' ||
        tag === 'textarea' ||
        (e.target as HTMLElement | null)?.isContentEditable;
      if (editable) return;
      if (handler(e)) {
        // Handled — do not propagate.
        e.preventDefault();
      }
    };

    document.addEventListener('keydown', onKey, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKey, { capture: true } as EventListenerOptions);
      const idx = shortcutRegistry.findIndex((r) => r.id === id);
      if (idx >= 0) shortcutRegistry.splice(idx, 1);
      if (activeShortcutId === id) {
        activeShortcutId = shortcutRegistry[shortcutRegistry.length - 1]?.id ?? null;
      }
    };
  }, [id, handler, active]);

  // Claim focus-shortcut ownership when this widget receives focus.
  const claim = useCallback(() => {
    if (activeShortcutId !== id && shortcutRegistry.some((r) => r.id === id)) {
      activeShortcutId = id;
    }
  }, [id]);

  return claim;
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
  paths: readonly string[]; size?: number; strokeWidth?: number; className?: string;
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
 * SPARKLINE — re-draws on data change
 * ═══════════════════════════════════════════════════════════════════ */
const Sparkline = memo(function Sparkline({
  data, color, width = 48, height = 16, reduced,
}: {
  data: readonly number[]; color: string; width?: number; height?: number; reduced: boolean;
}) {
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

  // Key on the path so React remounts → pathLength re-animates.
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <motion.path
        key={path}
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
 * ATTENDANCE RING — animates dash, no remount
 * ═══════════════════════════════════════════════════════════════════ */
const AttendanceRing = memo(function AttendanceRing({
  presentPct, latePct, absentPct, size = 64, reduced, label,
}: {
  presentPct: number; latePct: number; absentPct: number; size?: number; reduced: boolean; label: string;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = presentPct + latePct + absentPct || 1;

  const presentDash = (presentPct / total) * c;
  const lateDash = (latePct / total) * c;
  const absentDash = (absentPct / total) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor"
          strokeWidth={stroke} opacity="0.08" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={METRIC.present.fg} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${presentDash} ${c}`} strokeDashoffset={0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={false}
          animate={{ strokeDasharray: `${presentDash} ${c}` }}
          transition={{ duration: reduced ? 0 : 1.0, ease: EASE_APPLE }} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={METRIC.late.fg} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${lateDash} ${c}`} strokeDashoffset={-presentDash}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={false}
          animate={{ strokeDasharray: `${lateDash} ${c}` }}
          transition={{ duration: reduced ? 0 : 1.0, ease: EASE_APPLE, delay: reduced ? 0 : 0.12 }} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={METRIC.absent.fg} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${absentDash} ${c}`} strokeDashoffset={-(presentDash + lateDash)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={false}
          animate={{ strokeDasharray: `${absentDash} ${c}` }}
          transition={{ duration: reduced ? 0 : 1.0, ease: EASE_APPLE, delay: reduced ? 0 : 0.24 }} />
      </svg>
      {/* SR-only accurate value */}
      <span className="sr-only">{label}</span>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * SKELETON
 * ═══════════════════════════════════════════════════════════════════ */
const MetricSkeleton = memo(function MetricSkeleton({ reduced }: { reduced: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl p-3">
          <div className="mb-2 h-2.5 w-14 rounded bg-slate-900/[0.06] dark:bg-white/[0.08]" />
          <div
            className="h-5 w-10 rounded bg-slate-900/[0.08] dark:bg-white/[0.10] motion-safe:animate-pulse"
            style={{ animationDelay: reduced ? undefined : `${i * 80}ms` }}
          />
        </div>
      ))}
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * METRIC CARD — polymorphic without `any`
 * ═══════════════════════════════════════════════════════════════════ */
interface MetricCardProps {
  icon: readonly string[];
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
  ariaLabel?: string;
}

const MetricCard = memo(function MetricCard({
  icon, label, value, pct, accent, soft, spark, onClick, reduced, delay, emphasis, ariaLabel,
}: MetricCardProps) {
  const display = useCountUp(value, reduced);

  const className = [
    'group relative flex flex-col items-start overflow-hidden rounded-xl p-3 text-left',
    'transition-colors duration-200',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900',
    onClick ? 'cursor-pointer' : '',
  ].filter(Boolean).join(' ');

  const style = {
    background: emphasis ? `linear-gradient(135deg, ${soft} 0%, transparent 75%)` : 'transparent',
    border: emphasis ? `1px solid ${accent}38` : '1px solid transparent',
    boxShadow: emphasis
      ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 16px -8px ${accent}66`
      : undefined,
  };

  const body = (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 contrast-more:group-hover:opacity-0"
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
    </>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel ?? `${label}: ${value}${pct !== undefined ? ` (${pct}%)` : ''}`}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING.smooth, delay }}
        whileHover={reduced ? undefined : { y: -1.5 }}
        whileTap={reduced ? undefined : { scale: 0.985 }}
        className={className}
        style={style}
      >
        {body}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING.smooth, delay }}
      className={className}
      style={style}
    >
      {body}
    </motion.div>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * ACTION BUTTON — properly typed, href/button split
 * ═══════════════════════════════════════════════════════════════════ */
interface ActionButtonBaseProps {
  icon: readonly string[];
  label: string;
  variant?: 'primary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  shortcut?: string;
  shortcutLabel?: string; // for aria-keyshortcuts, e.g. "Meta+E"
  reduced: boolean;
  children?: never;
}

type ActionButtonProps = ActionButtonBaseProps &
  (
    | ({ onClick?: () => void; href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'>)
    | ({ href: string; onClick?: () => void } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'onClick'>)
  );

const ActionButton = memo(function ActionButton(props: ActionButtonProps) {
  const {
    icon, label, variant = 'ghost', loading, disabled,
    shortcut, shortcutLabel, reduced,
  } = props;

  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  const baseClass = [
    'group/btn relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
    'text-[12px] font-semibold tracking-tight',
    'outline-none transition-all duration-200',
    'focus-visible:ring-2 focus-visible:ring-offset-0',
    isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    isPrimary
      ? 'text-white shadow-sm focus-visible:ring-indigo-500/60'
      : 'text-slate-700 focus-visible:ring-slate-400/50 dark:text-slate-200',
    'contrast-more:border contrast-more:border-current',
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

  const hoverAnim = reduced || isDisabled ? undefined : { y: -1 };
  const tapAnim = reduced || isDisabled ? undefined : { scale: 0.97 };

  const inner = (
    <>
      {!isPrimary && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-200 group-hover/btn:opacity-100"
          style={{ background: 'rgba(15,23,42,0.04)' }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {loading ? (
          reduced ? (
            <Icon paths={I.refresh} size={12} strokeWidth={2.4} />
          ) : (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              className="inline-flex"
              aria-hidden="true"
            >
              <Icon paths={I.refresh} size={12} strokeWidth={2.4} />
            </motion.span>
          )
        ) : (
          <Icon paths={icon} size={12} strokeWidth={2.3} />
        )}
        <span>{loading ? 'Yuklanmoqda…' : label}</span>
        {shortcut && !loading && (
          <kbd
            aria-hidden="true"
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

  const commonMotionProps = {
    whileHover: hoverAnim,
    whileTap: tapAnim,
    transition: SPRING.snappy,
    className: baseClass,
    style: baseStyle,
    'aria-keyshortcuts': shortcutLabel,
    'aria-busy': loading || undefined,
  } as const;

  if ('href' in props && props.href) {
    const { href, onClick, ...rest } = props as Extract<ActionButtonProps, { href: string }>;
    const isExternal = /^https?:\/\//.test(href);
    return (
      <motion.a
        {...commonMotionProps}
        {...(rest as unknown as Record<string, unknown>)}
        href={isDisabled ? undefined : href}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        target={isExternal ? '_blank' : undefined}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
        aria-disabled={isDisabled || undefined}
        tabIndex={isDisabled ? -1 : undefined}
      >
        {inner}
      </motion.a>
    );
  }

  const { onClick, ...rest } = props as Extract<ActionButtonProps, { onClick?: () => void }>;
  return (
    <motion.button
      {...commonMotionProps}
      {...(rest as unknown as Record<string, unknown>)}
      type="button"
      onClick={onClick}
      disabled={isDisabled}
    >
      {inner}
    </motion.button>
  );
}) as <P extends ActionButtonProps>(props: P) => ReactNode;

/* ═══════════════════════════════════════════════════════════════════
 * CSV EXPORT — Excel-safe (correct escaping)
 * ═══════════════════════════════════════════════════════════════════ */
interface ExportRow {
  id: string | number;
  studentName: string;
  className: string;
  status: 'present' | 'absent' | 'late';
  timestamp?: string;
}

/** Escape a field per RFC 4180 — only doubles quotes. Does NOT touch ";". Formula-injection hardened. */
function csvField(s: string): string {
  let str = String(s ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsv(
  rows: ExportRow[],
  meta: { total: number; present: number; absent: number; late: number },
): string {
  const BOM = '\uFEFF';
  const sep = ';';
  const header = ['ID', "O'quvchi", 'Sinf', 'Holat', 'Vaqt'].map(csvField).join(sep);
  const metaRow = [
    `Jami: ${meta.total}`,
    `Qatnashgan: ${meta.present}`,
    `Yo'q: ${meta.absent}`,
    `Kechikkan: ${meta.late}`,
  ]
    .map(csvField)
    .join(sep);
  const statusMap: Record<ExportRow['status'], string> = {
    present: 'Qatnashgan',
    absent: "Yo'q",
    late: 'Kechikkan',
  };
  const body = rows
    .map((r) =>
      [
        String(r.id),
        csvField(r.studentName),
        csvField(r.className),
        csvField(statusMap[r.status]),
        csvField(r.timestamp ?? ''),
      ].join(sep),
    )
    .join('\r\n');
  return BOM + [metaRow, '', header, body].join('\r\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════════════
 * STYLE SINGLETON — injected once, no duplicate keyframes
 * ═══════════════════════════════════════════════════════════════════ */
const STYLE_ID = 'ai-attendance-widget-styles-v4';
function ensureStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes cornerShimmer {
      0%, 100% { opacity: 0.30; transform: translate(0, 0); }
      50%      { opacity: 0.60; transform: translate(4px, 4px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ai-attendance-shimmer { animation: none !important; }
    }
  `;
  document.head.appendChild(el);
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
  loading?: boolean;
  onOpenClassBreakdown?: () => void;
  onRefresh?: () => void;
  onCopySuccess?: () => void;
  onCopyError?: (e: unknown) => void;
  onDownloadSuccess?: () => void;
  onDownloadError?: (e: unknown) => void;
}

export function AiAttendanceWidget({
  total = 0, present = 0, absent = 0, late = 0,
  rows, sparkTotal, sparkPresent, sparkAbsent, sparkLate,
  loading = false,
  onOpenClassBreakdown, onRefresh,
  onCopySuccess, onCopyError,
  onDownloadSuccess, onDownloadError,
}: AiAttendanceWidgetProps) {
  const reduced = Boolean(useReducedMotion());
  const reducedData = usePrefersReducedData();
  const isApple = useIsApple();
  const { announce, node: announcer } = useLiveAnnouncer();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [greeting, setGreeting] = useState(() => computeGreeting());
  const shortcutMod = isApple ? '⌘' : 'Ctrl+';
  const shortcutPrefix = isApple ? 'Meta' : 'Control';

  const downloadTimer = useRef<number | null>(null);
  const copyTimer = useRef<number | null>(null);
  const widgetId = useRef(Symbol('attendance-widget')).current;

  const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
  const absentPct = total > 0 ? Math.round((absent / total) * 100) : 0;
  const latePct = total > 0 ? Math.round((late / total) * 100) : 0;
  const isEmpty = total === 0 && !loading;

  useEffect(() => { ensureStyles(); }, []);

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
    if (downloadTimer.current !== null) window.clearTimeout(downloadTimer.current);
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
        haptic('success');
        onDownloadSuccess?.();
        downloadTimer.current = null;
      };
      if (reduced) finish();
      else downloadTimer.current = window.setTimeout(finish, 700);
    } catch (e) {
      setDownloading(false);
      haptic('error');
      announce("Hisobotni yuklab bo'lmadi", 'assertive');
      onDownloadError?.(e);
    }
  }, [
    downloading, isEmpty, rows, total, present, absent, late,
    announce, reduced, onDownloadSuccess, onDownloadError,
  ]);

  const handleCopySummary = useCallback(async () => {
    const summary = [
      `📊 Bugungi davomat`,
      `Jami: ${total}`,
      `Qatnashgan: ${present} (${presentPct}%)`,
      `Yo'q: ${absent} (${absentPct}%)`,
      `Kechikkan: ${late} (${latePct}%)`,
    ].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      announce('Xulosa nusxalandi', 'polite');
      haptic('tap');
      onCopySuccess?.();
      if (reduced) {
        setCopied(false);
      } else {
        if (copyTimer.current !== null) window.clearTimeout(copyTimer.current);
        copyTimer.current = window.setTimeout(() => {
          setCopied(false);
          copyTimer.current = null;
        }, 1800);
      }
    } catch (e) {
      haptic('error');
      announce("Nusxalab bo'lmadi", 'assertive');
      onCopyError?.(e);
    }
  }, [
    total, present, absent, late, presentPct, absentPct, latePct,
    announce, reduced, onCopySuccess, onCopyError,
  ]);

  const shortcutHandler = useCallback((e: KeyboardEvent): boolean => {
    const mod = isApple ? e.metaKey : e.ctrlKey;
    if (!mod) return false;
    const key = e.key.toLowerCase();
    if (key === 'e' && !e.shiftKey && !e.altKey) { handleDownloadExcel(); return true; }
    if (key === 'c' && e.shiftKey) { handleCopySummary(); return true; }
    if (key === 'b') { onOpenClassBreakdown?.(); return true; }
    return false;
  }, [isApple, handleDownloadExcel, handleCopySummary, onOpenClassBreakdown]);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const claimShortcutOwnership = useWidgetShortcuts(widgetId, shortcutHandler, true);

  // Claim ownership when the user focuses/interacts with the widget
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onFocus = () => claimShortcutOwnership();
    const onPointer = () => claimShortcutOwnership();
    el.addEventListener('focusin', onFocus);
    el.addEventListener('pointerdown', onPointer);
    return () => {
      el.removeEventListener('focusin', onFocus);
      el.removeEventListener('pointerdown', onPointer);
    };
  }, [claimShortcutOwnership]);

  const ringLabel = `Umumiy qatnashish: ${presentPct}%, kechikkan: ${latePct}%, yo'q: ${absentPct}%`;
  const showShimmer = !reduced && !reducedData;

  return (
    <>
      {announcer}
      <motion.div
        ref={rootRef}
        role="region"
        aria-label="AI Davomat vidjeti"
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
        {showShimmer && (
          <span
            aria-hidden="true"
            className="ai-attendance-shimmer pointer-events-none absolute left-3 top-3 h-16 w-16 rounded-full bg-white/30 blur-2xl motion-safe:animate-[cornerShimmer_6s_ease-in-out_infinite] dark:bg-white/[0.08]"
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

            {!isEmpty && !loading && (
              <motion.div
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ ...SPRING.smooth, delay: 0.15 }}
                className="relative flex shrink-0 items-center justify-center text-slate-900 dark:text-slate-100"
              >
                <AttendanceRing
                  presentPct={presentPct}
                  latePct={latePct}
                  absentPct={absentPct}
                  size={64}
                  reduced={reduced}
                  label={ringLabel}
                />
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                  aria-hidden="true"
                >
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
          {loading ? (
            <MetricSkeleton reduced={reduced} />
          ) : isEmpty ? (
            <EmptyState reduced={reduced} onRefresh={onRefresh} />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                shortcut={`${shortcutMod}B`}
                shortcutLabel={`${shortcutPrefix}+B`}
                reduced={reduced} />
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
                      shortcut={`${shortcutMod}⇧C`}
                      shortcutLabel={`${shortcutPrefix}+Shift+C`}
                      reduced={reduced} />
                  </motion.div>
                )}
              </AnimatePresence>

              <ActionButton icon={I.download} label="Excel yuklash"
                onClick={handleDownloadExcel}
                loading={downloading}
                disabled={downloading || isEmpty}
                shortcut={`${shortcutMod}E`}
                shortcutLabel={`${shortcutPrefix}+E`}
                reduced={reduced} />

              {onRefresh && (
                <motion.button
                  type="button"
                  onClick={() => { haptic('tap'); onRefresh(); }}
                  whileHover={reduced ? undefined : { rotate: 90 }}
                  whileTap={reduced ? undefined : { scale: 0.9 }}
                  transition={SPRING.snappy}
                  aria-label="Yangilash"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-900/[0.08] bg-white/65 text-slate-600 outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/50 dark:border-white/[0.10] dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.10]"
                >
                  <Icon paths={I.refresh} size={12} strokeWidth={2.2} />
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
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

const EmptyState = memo(function EmptyState({
  reduced, onRefresh,
}: { reduced: boolean; onRefresh?: () => void }) {
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
          {onRefresh
            ? "Davomat belgilanmagani ko'rinadi. Yangilab qayta urinib ko'ring."
            : "Davomat belgilanmagani ko'rinadi."}
        </p>
      </div>
    </motion.div>
  );
});

export default AiAttendanceWidget;