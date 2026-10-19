/**
 * M-EDU Design Kit — one source of truth for shared UI helpers.
 *
 * Consolidates what was previously copy-pasted across ~15 page files:
 *   cn · tones · motion tokens · CountUp · Shimmer · icons · avatar helpers
 *
 * All values follow the Apple-premium design language defined in
 * `src/styles/design-tokens.css` and `tailwind.config.js`.
 */

import { useEffect, useRef, useState } from 'react';

/* ══════════════════════════════════════════════════════════════════════
 * Class name helper
 * ══════════════════════════════════════════════════════════════════════ */

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

/** Join class names, dropping falsy values. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue): void => {
    if (!v && v !== 0) return;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (typeof v === 'object') {
      for (const [key, on] of Object.entries(v)) if (on) out.push(key);
    }
  };
  values.forEach(walk);
  return out.join(' ');
}


/* ══════════════════════════════════════════════════════════════════════
 * Tone palette — Apple system colors, one definition
 * ══════════════════════════════════════════════════════════════════════ */

export type ToneName =
  | 'blue' | 'green' | 'orange' | 'red' | 'purple'
  | 'cyan' | 'gray' | 'slate' | 'amber' | 'indigo' | 'rose' | 'teal';

export interface Tone {
  fg: string;
  bg: string;
  glow: string;
  border: string;
  /** Tailwind classes for a solid tinted chip */
  chip: string;
}

const tone = (fg: string, rgb: string, chip: string): Tone => ({
  fg,
  bg: `rgba(${rgb}, 0.10)`,
  glow: `rgba(${rgb}, 0.20)`,
  border: `rgba(${rgb}, 0.24)`,
  chip,
});

/** Single source of truth for accent tones. */
export const TONES: Record<ToneName, Tone> = {
  blue:   tone('#007AFF', '0,122,255',   'bg-apple-blue/10 text-apple-blue'),
  green:  tone('#34C759', '52,199,89',   'bg-apple-green/10 text-apple-green'),
  orange: tone('#FF9500', '255,149,0',   'bg-apple-orange/10 text-apple-orange'),
  red:    tone('#FF3B30', '255,59,48',   'bg-apple-red/10 text-apple-red'),
  purple: tone('#AF52DE', '175,82,222',  'bg-apple-purple/10 text-apple-purple'),
  cyan:   tone('#5AC8FA', '90,200,250',  'bg-apple-teal/10 text-apple-teal'),
  gray:   tone('#8E8E93', '142,142,147', 'bg-black/5 text-surface-600 dark:bg-white/10 dark:text-surface-400'),
  slate:  tone('#8E8E93', '142,142,147', 'bg-black/5 text-surface-600 dark:bg-white/10 dark:text-surface-400'),
  amber:  tone('#FF9500', '255,149,0',   'bg-apple-orange/10 text-apple-orange'),
  indigo: tone('#5856D6', '88,86,214',   'bg-apple-indigo/10 text-apple-indigo'),
  rose:   tone('#FF2D55', '255,45,85',   'bg-apple-pink/10 text-apple-pink'),
  teal:   tone('#5AC8FA', '90,200,250',  'bg-apple-teal/10 text-apple-teal'),
};

/** Map a value/keyword to a tone name. Falls back to gray. */
export function resolveTone(value?: string | null): ToneName {
  if (!value) return 'gray';
  const v = value.toLowerCase();
  const known: ToneName[] = [
    'blue', 'green', 'orange', 'red', 'purple', 'cyan',
    'gray', 'slate', 'amber', 'indigo', 'rose', 'teal',
  ];
  const aliases: Record<string, ToneName> = {
    success: 'green', ok: 'green', active: 'green', paid: 'green', operational: 'green',
    warning: 'orange', warn: 'orange', pending: 'orange', draft: 'orange',
    error: 'red', danger: 'red', failed: 'red', overdue: 'red', critical: 'red',
    info: 'blue', azure: 'blue', primary: 'blue',
    muted: 'gray', neutral: 'gray', inactive: 'gray', archived: 'gray',
  };
  if ((known as string[]).includes(v)) return v as ToneName;
  if (aliases[v]) return aliases[v];
  return 'gray';
}

/** Badge/tone color by status keyword (used for API status strings). */
export function statusTone(status?: string | null): ToneName {
  return resolveTone(status);
}

/** Legacy alias kept for existing imports. */
export const statusColor = (status?: string | null): 'success' | 'error' | 'warning' | 'primary' | 'muted' => {
  const t = resolveTone(status);
  if (t === 'green') return 'success';
  if (t === 'red') return 'error';
  if (t === 'orange' || t === 'amber') return 'warning';
  if (t === 'blue' || t === 'indigo' || t === 'purple') return 'primary';
  return 'muted';
};


/* ══════════════════════════════════════════════════════════════════════
 * Motion tokens — Apple spring curves
 * ══════════════════════════════════════════════════════════════════════ */

export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 480, damping: 34, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.9 },
  soft:   { type: 'spring' as const, stiffness: 220, damping: 30, mass: 1.0 },
  gentle: { type: 'spring' as const, stiffness: 180, damping: 26, mass: 1.0 },
};

export const EASE = [0.32, 0.72, 0, 1] as const;
export const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/** Container stagger variants (framer-motion). */
export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.045, delayChildren: 0.04 },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 420, damping: 34 },
  },
};

export const cardVariants = itemVariants;


/* ══════════════════════════════════════════════════════════════════════
 * Reduced motion — single implementation
 * ══════════════════════════════════════════════════════════════════════ */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(cb: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** SSR-safe prefers-reduced-motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStoreSafe(subscribeToReducedMotion, readReducedMotion, () => false);
}

/** Alias matching framer-motion's naming. */
export const useReducedMotion = usePrefersReducedMotion;

/** Minimal useSyncExternalStore wrapper with graceful fallback. */
function useSyncExternalStoreSafe<T>(
  subscribe: (cb: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot: () => T,
): T {
  const [value, setValue] = useState<T>(() =>
    typeof window === 'undefined' ? getServerSnapshot() : getSnapshot(),
  );
  const ref = useRef({ subscribe, getSnapshot });
  ref.current = { subscribe, getSnapshot };

  useEffect(() => {
    const update = () => setValue(ref.current.getSnapshot());
    update();
    return ref.current.subscribe(update);
  }, []);

  return value;
}


/* ══════════════════════════════════════════════════════════════════════
 * CountUp — one rAF implementation (previously copy-pasted 8×)
 * ══════════════════════════════════════════════════════════════════════ */

export interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  className?: string;
}

/**
 * Animated number that writes directly to a span (zero React re-renders per frame).
 */
export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  locale,
  className,
}: CountUpProps): JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    if (reduced) {
      el.textContent = `${prefix}${formatter.format(value)}${suffix}`;
      return;
    }

    let frame = 0;
    const from = 0;
    const delta = value - from;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + delta * eased;
      el.textContent = `${prefix}${formatter.format(current)}${suffix}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, decimals, prefix, suffix, locale, reduced]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {`${prefix}${value.toFixed(decimals)}${suffix}`}
    </span>
  );
}


/* ══════════════════════════════════════════════════════════════════════
 * Shimmer / skeleton — one implementation (previously 12×)
 * ══════════════════════════════════════════════════════════════════════ */

export interface ShimmerProps {
  className?: string;
  /** CSS border-radius, e.g. "8px" or "9999px" */
  rounded?: string;
  width?: string | number;
  height?: string | number;
  style?: React.CSSProperties;
}

/** Neutral shimmer block used for loading placeholders. */
export function Shimmer({ className, rounded = '8px', width, height, style }: ShimmerProps): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-shimmer', className)}
      style={{ borderRadius: rounded, width, height, ...style }}
    />
  );
}

/** Standard list skeleton: `rows` shimmer bars. */
export function ShimmerList({ rows = 5, className }: { rows?: number; className?: string }): JSX.Element {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer key={i} height={56} rounded="12px" />
      ))}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════
 * Icons — one inline SVG path map (previously copy-pasted 12×)
 * ══════════════════════════════════════════════════════════════════════ */

export const ICON_PATHS = {
  check: ['M20 6 9 17l-5-5'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  xCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm15 9-6 6', 'm9 9 6 6'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronUp: ['m18 15-6-6-6 6'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
  arrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
  arrowUp: ['M12 19V5', 'm5 12 7-7 7 7'],
  arrowDown: ['M12 5v14', 'm19 12-7 7-7-7'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.35-4.35'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  mail: ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z', 'm22 6-10 7L2 6'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z'],
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M9 22V12h6v10'],
  folder: ['M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2Z'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z', 'M14 2v6h6'],
  image: ['M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z', 'm21 15-5-5L5 21'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19', 'm1 1 22 22', 'M14.12 14.12a3 3 0 1 1-4.24-4.24'],
  refresh: ['M23 4v6h-6', 'M1 20v-6h6', 'M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15'],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3Z'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4', 'M12 8h.01'],
  alert: ['M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', 'M12 9v4', 'M12 17h.01'],
  alertCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 8v4', 'M12 16h.01'],
  lock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  unlock: ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2Z', 'M7 11V7a5 5 0 0 1 9.9-1'],
  star: ['m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z'],
  heart: ['M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8Z'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  barChart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
  trendingUp: ['m23 6-9.5 9.5-5-5L1 18', 'M17 6h6v6'],
  trendingDown: ['m23 18-9.5-9.5-5 5L1 6', 'M17 18h6v-6'],
  creditCard: ['M1 5h22v14H1z', 'M1 10h22'],
  cash: ['M2 6h20v12H2z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  copy: ['M9 9h11a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  externalLink: ['M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6', 'M15 3h6v6', 'M10 14 21 3'],
  menu: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
  more: ['M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'],
  sparkles: ['m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z', 'M18 17.5 18.8 19.7 21 20.5l-2.2.8L18 23.5l-.8-2.2L15 20.5l2.2-.8L18 17.5Z'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z'],
  graduationCap: ['m22 10-10-5-10 5 10 5 10-5Z', 'M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5'],
  clipboard: ['M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2', 'M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z'],
  camera: ['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  video: ['m23 7-7 5 7 5V7Z', 'M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z'],
  mapPin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z'],
  globe: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z'],
  sun: ['M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M12 1v2', 'M12 21v2', 'M4.22 4.22l1.42 1.42', 'M18.36 18.36l1.42 1.42', 'M1 12h2', 'M21 12h2', 'M4.22 19.78l1.42-1.42', 'M18.36 5.64l1.42-1.42'],
  moon: ['M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z'],
  logOut: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'],
  shieldCheck: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z', 'm9 12 2 2 4-4'],
  database: ['M12 8c4.42 0 8-1.34 8-3s-3.58-3-8-3-8 1.34-8 3 3.58 3 8 3Z', 'M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5', 'M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3'],
  server: ['M20 2H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Z', 'M20 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Z', 'M6 6h.01', 'M6 18h.01'],
  cpu: ['M18 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z', 'M15 9H9v6h6V9Z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M20 9h3', 'M20 14h3', 'M1 9h3', 'M1 14h3'],
  key: ['M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4'],
  dollarSign: ['M12 1v22', 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  percent: ['M19 5 5 19', 'M6.5 6.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z', 'M17.5 17.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  target: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z', 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
  layers: ['m12 2 10 5-10 5L2 7l10-5Z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  play: ['m5 3 14 9-14 9V3Z'],
  pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  mic: ['M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v4', 'M8 23h8'],
  printer: ['M6 9V2h12v7', 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2', 'M6 14h12v8H6z'],
  share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'm16 6-4-4-4 4', 'M12 2v13'],
  qrCode: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h3v3h-3z', 'M21 14v3', 'M17 21h4', 'M14 21h1'],
  hash: ['M4 9h16', 'M4 15h16', 'M10 3 8 21', 'M16 3l-2 18'],
  tag: ['M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z', 'M7 7h.01'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z'],
  archive: ['M21 8v13H3V8', 'M1 3h22v5H1z', 'M10 12h4'],
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  compass: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z'],
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName | (string & {});
  size?: number;
  className?: string;
  strokeWidth?: number;
  title?: string;
}

/** Crisp Apple stroke icon renderer driven by ICON_PATHS with defensive fallback. */
export function Icon({
  name,
  size = 18,
  className,
  strokeWidth = 1.75,
  title,
}: IconProps): JSX.Element {
  const paths = (ICON_PATHS as Record<string, readonly string[]>)[name] ?? [];
  const isDecorative = !title;

  return (
    <svg
      aria-hidden={isDecorative || undefined}
      role={isDecorative ? undefined : 'img'}
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      className={cn('shrink-0 select-none inline-block align-middle', className)}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}


/* ══════════════════════════════════════════════════════════════════════
 * Identity helpers (initials, deterministic avatar color)
 * ══════════════════════════════════════════════════════════════════════ */

/** Stable small hash for deterministic color picking. */
export function nameHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Two-letter initials from a full name. */
export function getInitials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Muted Apple-neutral avatar gradient pairs (no rainbow candy).
 * The same palette everywhere — replaces 7 drifting copies.
 */
export const AVATAR_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#007AFF', '#5856D6'],
  ['#5856D6', '#AF52DE'],
  ['#34C759', '#007AFF'],
  ['#FF9500', '#FF2D55'],
  ['#5AC8FA', '#34C759'],
  ['#8E8E93', '#636366'],
];

/** Deterministic `background: linear-gradient(...)` for an identity string. */
export function avatarGradient(seed: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(seed) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}


/* ══════════════════════════════════════════════════════════════════════
 * Misc
 * ══════════════════════════════════════════════════════════════════════ */

/** Clamp a number between bounds. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Percentage helper that guards division by zero. */
export function percent(value: number, total: number, decimals = 0): number {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/** Group thousands with locale formatting (memo-friendly wrapper). */
export function formatCount(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Compact money axis labels: 1.2M, 45K, 999. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
