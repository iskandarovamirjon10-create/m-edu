/**
 * M-EDU Layout Icons & Micro-Interactions — Apple-premium rewrite (v2).
 *
 * Design principles:
 * - `I` registry: plain 24×24 stroke paths (every key preserved, untouched).
 * - `StaticIcon`: crisp `currentColor` vector primitive — zero motion cost.
 * - `PremiumIcon`: monochrome icon whose stroke weight / scale / opacity
 *   glide toward the active state via spring physics (not CSS transitions) —
 *   color always comes from the surrounding token. No gradients, no glows.
 * - `Magnetic` / `IconButton`: restrained, physically-plausible press & hover
 *   feedback — the kind of motion you feel more than you see.
 *
 * No injected `<style>` blocks, no feTurbulence, no emoji.
 */

import {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  memo,
  forwardRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type ButtonHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
  type Transition,
} from 'framer-motion';
import { cn } from '@/lib/design';
import type { AccentKey } from '../core/tokens';
import { useDeviceProfile, usePrefersReducedMotion } from '../core/singletons';

/* ══════════════════════════════════════════════════════════════════════
 * ENVIRONMENT & SMALL UTILITIES
 * ════════════════════════════════════════════════════════════════════ */

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

function mergeRefs<T>(
  ...refs: Array<
    React.MutableRefObject<T> | React.LegacyRef<T> | undefined | null
  >
): React.RefCallback<T> {
  return (value) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(value);
      else if (ref != null) (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}

/* ══════════════════════════════════════════════════════════════════════
 * ICON REGISTRY — every key preserved (same shapes as before)
 * ════════════════════════════════════════════════════════════════════ */

export const I = {
  dashboard: [
    'M4 4h6.5v6.5H4z',
    'M13.5 4H20v6.5h-6.5z',
    'M4 13.5h6.5V20H4z',
    'M13.5 13.5H20V20h-6.5z',
  ],
  ai: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3',
    'M20 5h-3',
    'M5.5 18v2.5',
    'M6.75 19.25h-2.5',
  ],
  students: [
    'M22 9 12 4 2 9l10 5z',
    'M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
    'M22 9v6',
  ],
  teachers: [
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M16 10l2 2 4-4',
  ],
  groups: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  courses: [
    'M12 7v14',
    'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z',
  ],
  attendance: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
    'M9 15l2 2 4-4',
  ],
  face: [
    'M9 3H5a2 2 0 0 0-2 2v4',
    'M15 3h4a2 2 0 0 1 2 2v4',
    'M21 15v4a2 2 0 0 1-2 2h-4',
    'M9 21H5a2 2 0 0 1-2-2v-4',
    'M9.5 10v.5',
    'M14.5 10v.5',
    'M9 15a4 4 0 0 0 6 0',
  ],
  camera: [
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
    'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  library: [
    'M4 4v16',
    'M9 4v16',
    'M14 4v16',
    'M17.5 5.2 21 19.5',
    'M2 20h20',
  ],
  exams: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M9 15l2 2 4-4',
  ],
  payments: [
    'M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z',
    'M1 10h22',
    'M6 15h2',
  ],
  invoices: [
    'M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z',
    'M9 7h6',
    'M9 11h6',
    'M9 15h4',
  ],
  reports: ['M4 20V4', 'M4 20h17', 'M9 20v-7', 'M14 20V8', 'M19 20v-4'],
  homework: [
    'M13 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18 2l4 4-9 9-4 1 1-4z',
  ],
  cert: [
    'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
    'M8.2 13.9 7 22l5-3 5 3-1.2-8.1',
  ],
  chat: [
    'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z',
  ],
  executive: [
    'M21.2 15.9A10 10 0 1 1 8 2.8',
    'M22 12A10 10 0 0 0 12 2v10z',
  ],
  financial: [
    'M12 2v20',
    'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  ],
  payroll: [
    'M20 12V8H6a2 2 0 0 1 0-4h12v4',
    'M4 6v12c0 1.1.9 2 2 2h14v-4',
    'M18 12a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
  ],
  leads: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M12 12h.01',
  ],
  parentPortal: [
    'M3 11 12 3l9 8',
    'M5 9.5V21h14V9.5',
    'M9 21v-6h6v6',
  ],
  hr: [
    'M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    'M8 10h4',
    'M8 14h4',
    'M8 18h4',
    'M16 10h.01',
    'M16 14h.01',
    'M16 18h.01',
  ],
  automation: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
  followUp: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
    'M15 2h6v6',
    'M21 2l-6 6',
  ],
  branches: [
    'M3 21h18',
    'M5 21V8l7-5 7 5v13',
    'M9 21v-6h6v6',
    'M10 12h.01',
    'M14 12h.01',
  ],
  inventory: [
    'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    'M3.3 7 12 12l8.7-5',
    'M12 22V12',
  ],
  expenses: [
    'M5 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z',
    'M9 12h6',
  ],
  cameras: ['M23 7l-7 5 7 5V7z', 'M1 5h15v14H1z'],
  anomaly: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  governance: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
  ],
  users: [
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M23 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  audit: [
    'M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],
  logout: [
    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4',
    'M16 17l5-5-5-5',
    'M21 12H9',
  ],
  search: [
    'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    'M21 21l-4.3-4.3',
  ],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  calculator: [
    'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
    'M8 7h8',
    'M8 11h.01',
    'M12 11h.01',
    'M16 11h.01',
    'M8 15h.01',
    'M12 15h.01',
    'M16 15h.01',
  ],
  collapse: ['M11 19l-7-7 7-7', 'M20 19l-7-7 7-7'],
  expand: ['M13 5l7 7-7 7', 'M4 5l7 7-7 7'],
  keyboard: [
    'M3 6h18v12H3z',
    'M7 10h.01',
    'M11 10h.01',
    'M15 10h.01',
    'M19 10h.01',
    'M7 14h10',
  ],
  user: [
    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
    'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  wifiOff: [
    'M1 1l22 22',
    'M16.7 12.6A12 12 0 0 1 21 15',
    'M5 12.5a12 12 0 0 1 5.2-2.9',
    'M8.5 16a6 6 0 0 1 7 0',
    'M12 20h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  star: [
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  schedule: [
    'M8 2v4',
    'M16 2v4',
    'M3 10h18',
    'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z',
  ],
  telegram: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'],
  earlyWarning: [
    'M12 9v4',
    'M12 17h.01',
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
  ],
  notifications: [
    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9',
    'M13.73 21a2 2 0 0 1-3.46 0',
  ],
  grades: [
    'M9 11l3 3L22 4',
    'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  ],
} as const satisfies Record<string, readonly string[]>;

export type IconKey = keyof typeof I;
export type IconPaths = readonly string[];

/* ══════════════════════════════════════════════════════════════════════
 * SIZE & STROKE TOKENS
 * ════════════════════════════════════════════════════════════════════ */

export const ICON_SIZE = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export type IconSizeKey = keyof typeof ICON_SIZE;

const STROKE_BASE = 1.75;
const STROKE_ACTIVE = 2;
const DEFAULT_ICON_SIZE = ICON_SIZE.md;

/** Snappy, low-travel spring — used for press feedback. */
const SPRING_TAP: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.6 };
/** Slightly looser spring — used for tilt / lift / icon-state transitions. */
const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 24, mass: 0.75 };
/** Used when the user prefers reduced motion — effectively instant, no bounce. */
const SPRING_INSTANT: Transition = { type: 'tween', duration: 0 };

/* ══════════════════════════════════════════════════════════════════════
 * LEGACY SHARED DEFS
 * ════════════════════════════════════════════════════════════════════ */

/**
 * @deprecated Optical-refraction filter ids were removed with the v27 look
 * (no `feTurbulence` anywhere). Kept so existing imports keep compiling.
 */
export const REFRACTION_FILTER = {
  subtle: 'medu-refract-subtle',
  default: 'medu-refract-default',
  strong: 'medu-refract-strong',
} as const;

/**
 * @deprecated Renders nothing — the icon system no longer needs shared SVG
 * gradients or filters. Mounted once at the app root for API compatibility.
 */
export const IconDefsHost = memo(function IconDefsHost() {
  return null;
});

/* ══════════════════════════════════════════════════════════════════════
 * StaticIcon — crisp vector primitive
 * ════════════════════════════════════════════════════════════════════ */

export interface StaticIconProps {
  paths: IconPaths;
  className?: string;
  size?: number;
  strokeWidth?: number;
  /** Optional accessible name. When omitted the icon stays `aria-hidden`. */
  title?: string;
}

export const StaticIcon = memo(function StaticIcon({
  paths,
  className = '',
  size = DEFAULT_ICON_SIZE,
  strokeWidth = STROKE_BASE,
  title,
}: StaticIconProps) {
  const isDecorative = !title;

  return (
    <svg
      className={cn('shrink-0 select-none', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      role={isDecorative ? undefined : 'img'}
      aria-hidden={isDecorative || undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {(paths ?? []).map((d, index) => (
        <path key={index} d={d} />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * PremiumIcon — monochrome icon that glides toward the active state
 *
 * Rather than toggling Tailwind transition classes, stroke width / scale /
 * opacity are driven by `useSpring`, so the icon settles the same way a
 * native control would — no discrete "jump", just physically-plausible
 * motion that respects `prefers-reduced-motion`.
 * ════════════════════════════════════════════════════════════════════ */

export interface PremiumIconProps {
  paths: IconPaths;
  isActive?: boolean;
  /**
   * @deprecated Accent is carried by the surrounding token (active rows set
   * `text-brand-600`); the prop stays for API compatibility.
   */
  accent?: AccentKey;
  className?: string;
  size?: number;
  /** @deprecated no-op */
  revealOnActivate?: boolean;
  /** @deprecated no-op (refraction filters were removed) */
  refraction?: 'off' | 'subtle' | 'default';
}

export const PremiumIcon = memo(function PremiumIcon({
  paths,
  isActive = false,
  className = '',
  size = DEFAULT_ICON_SIZE,
}: PremiumIconProps) {
  const reduced = usePrefersReducedMotion();
  const transition = reduced ? SPRING_INSTANT : SPRING_SOFT;

  const strokeWidth = useSpring(isActive ? STROKE_ACTIVE : STROKE_BASE, transition);
  const scale = useSpring(isActive ? 1.08 : 1, transition);
  const opacity = useSpring(isActive ? 1 : 0.85, transition);

  return (
    <motion.svg
      className={cn('shrink-0 select-none', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      shapeRendering="geometricPrecision"
      style={{
        scale,
        transformOrigin: '50% 50%',
        filter: isActive ? 'drop-shadow(0 2px 6px rgba(0, 122, 255, 0.35))' : 'none',
      }}
      aria-hidden="true"
      focusable="false"
    >
      <motion.g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeWidth, opacity }}
      >
        {(paths ?? []).map((d, index) => (
          <path key={index} d={d} />
        ))}
      </motion.g>
    </motion.svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * Magnetic — subtle pointer tilt (mouse + fine pointers only)
 * ════════════════════════════════════════════════════════════════════ */

export interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  disabled?: boolean;
  maxTilt?: number;
  /** @deprecated no-op (specular glare layer was removed) */
  glare?: boolean;
}

const MagneticInner = memo(function MagneticInner({
  children,
  strength = 0.34,
  className = '',
  maxTilt = 8,
}: Omit<MagneticProps, 'disabled' | 'glare'>) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const baseRectRef = useRef<{ cx: number; cy: number } | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, SPRING_SOFT);
  const springY = useSpring(y, SPRING_SOFT);
  const hover = useMotionValue(0);
  const springHover = useSpring(hover, SPRING_SOFT);
  const scale = useTransform(springHover, [0, 1], [1, 1.02]);

  const tiltRange = clamp(strength * 18, 0, maxTilt);
  const rotateX = useTransform(springY, [-16, 16], [tiltRange, -tiltRange]);
  const rotateY = useTransform(springX, [-16, 16], [-tiltRange, tiltRange]);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    baseRectRef.current = {
      cx: rect.left - springX.get() + rect.width / 2,
      cy: rect.top - springY.get() + rect.height / 2,
    };
  }, [springX, springY]);

  const flush = useCallback(() => {
    rafRef.current = null;
    if (!baseRectRef.current) measure();
    const base = baseRectRef.current;
    if (!base) return;
    x.set(clamp((pointerRef.current.x - base.cx) * strength, -16, 16));
    y.set(clamp((pointerRef.current.y - base.cy) * strength, -16, 16));
  }, [strength, x, y, measure]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const onPointerEnter = useCallback(
    (e: ReactPointerEvent<HTMLSpanElement>) => {
      if (e.pointerType !== 'mouse') return;
      measure();
      hover.set(1);
    },
    [hover, measure],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLSpanElement>) => {
      if (e.pointerType !== 'mouse') return;
      pointerRef.current = { x: e.clientX, y: e.clientY };
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onPointerLeave = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    baseRectRef.current = null;
    x.set(0);
    y.set(0);
    hover.set(0);
  }, [x, y, hover]);

  return (
    <motion.span
      ref={ref}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
      style={{
        x: springX,
        y: springY,
        rotateX,
        rotateY,
        scale,
        transformPerspective: 820,
      }}
      className={cn('relative inline-flex', className)}
    >
      {children}
    </motion.span>
  );
});

export const Magnetic = memo(function Magnetic({
  children,
  strength = 0.34,
  className = '',
  disabled = false,
  maxTilt = 8,
  glare: _glare,
}: MagneticProps) {
  const profile = useDeviceProfile();
  const reduced = usePrefersReducedMotion();
  const isDisabled =
    disabled || reduced || !profile.hoverCapable || Boolean(profile.lowPowerMode);

  if (isDisabled) {
    return <span className={cn('relative inline-flex', className)}>{children}</span>;
  }

  return (
    <MagneticInner strength={strength} className={className} maxTilt={maxTilt}>
      {children}
    </MagneticInner>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * IconButton — square tile control
 * ════════════════════════════════════════════════════════════════════ */

const ICON_BUTTON_SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8 rounded-lg text-xs',
  md: 'h-10 w-10 rounded-xl text-sm',
  lg: 'h-12 w-12 rounded-2xl text-base',
};

export type IconButtonSize = keyof typeof ICON_BUTTON_SIZE_CLASS;
export type IconButtonVariant = 'tile' | 'ghost';

export interface IconButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    | 'onClick'
    | 'disabled'
    | 'className'
    | 'title'
    | 'children'
    | 'style'
    | 'onDrag'
    | 'onDragStart'
    | 'onDragEnd'
    | 'onAnimationStart'
  > {
  children: ReactNode;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  ariaLabel: string;
  ariaPressed?: boolean;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  /** Visual size preset. Defaults to `md` (10×10, same as before). */
  size?: IconButtonSize;
  /** `tile` keeps the original bordered square look; `ghost` drops bg/border. */
  variant?: IconButtonVariant;
  /** @deprecated no-op (magnetic tilt is opt-in via `<Magnetic />`) */
  magnetic?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** @deprecated no-op (refraction filters were removed) */
  refraction?: 'off' | 'subtle' | 'default';
  /** @deprecated no-op (press ripple was removed) */
  ripple?: boolean;
}

export const IconButton = memo(
  forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    {
      children,
      onClick,
      ariaLabel,
      ariaPressed,
      active = false,
      disabled = false,
      className = '',
      title,
      size = 'md',
      variant = 'tile',
      magnetic: _magnetic,
      leading,
      trailing,
      refraction: _refraction,
      ripple: _ripple,
      ...restProps
    },
    forwardedRef,
  ) {
    const reduced = usePrefersReducedMotion();
    const internalRef = useRef<HTMLButtonElement | null>(null);
    const mergedRef = useMemo(
      () => mergeRefs(internalRef, forwardedRef),
      [forwardedRef],
    );

    const canAnimate = !reduced && !disabled;

    return (
      <motion.button
        ref={mergedRef}
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        data-active={active || undefined}
        whileHover={canAnimate ? { y: -1, scale: 1.02 } : undefined}
        whileTap={canAnimate ? { scale: 0.92, y: 0 } : undefined}
        transition={SPRING_TAP}
        className={cn(
          'relative flex items-center justify-center select-none outline-none',
          'transition-all duration-150 ease-apple-spring',
          ICON_BUTTON_SIZE_CLASS[size],
          variant === 'ghost' &&
            (active
              ? 'text-apple-blue bg-apple-blue/10 border border-transparent'
              : cn(
                  'text-[var(--text-secondary)] border border-transparent',
                  'hover:text-[var(--text-primary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
                )),
          variant === 'tile' &&
            (active
              ? 'bg-apple-blue/15 text-apple-blue border border-apple-blue/30 shadow-[0_2px_8px_rgba(0,122,255,0.25),inset_0_1px_0_rgba(255,255,255,0.4)]'
              : cn(
                  'border border-black/[0.08] dark:border-white/[0.12] bg-white/70 dark:bg-white/[0.06] backdrop-blur-xl backdrop-saturate-150 text-[var(--text-secondary)]',
                  'shadow-[0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
                  'hover:text-[var(--text-primary)] hover:border-black/[0.12] dark:hover:border-white/[0.18] hover:bg-white/90 dark:hover:bg-white/[0.10]',
                )),
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--border-focus)]',
          className,
        )}
        {...restProps}
      >
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
          {leading}
          {children}
          {trailing}
        </span>
      </motion.button>
    );
  }),
);

IconButton.displayName = 'IconButton';

/* ══════════════════════════════════════════════════════════════════════
 * useMotionSubscribe — returns an unsubscribe function
 * ════════════════════════════════════════════════════════════════════ */

export function useMotionSubscribe<T = number>(
  motionValue: MotionValue<T>,
  callback: (value: T) => void,
): () => void {
  const callbackRef = useRef(callback);

  useIsomorphicLayoutEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(
    () => motionValue.on('change', (value) => callbackRef.current(value)),
    [motionValue],
  );

  return useCallback(() => {
    motionValue.clearListeners();
  }, [motionValue]);
}