/**
 * M-EDU Layout Icons & Micro-Interactions — Artisan rewrite (v4).
 *
 * What changed from v3:
 *   - Every glyph is redrawn on a strict 24×24 optical grid: 1.75 base stroke,
 *     round caps/joins, consistent 3.5–20.5 safe area.
 *   - Duotone depth is a real vector gradient instead of a flat 8% fill:
 *     closed volumes get a top-lit tint, open strokes stay razor sharp.
 *   - `vector-effect="non-scaling-stroke"` keeps stroke weight constant while
 *     icons scale on hover/press, so 13–16 px icons never look mushy.
 *   - `PremiumIcon` springs stroke weight, scale and tint for the active state.
 *
 * Deterministic hand variations (FNV-1a over path data) are preserved, and
 * reduced motion collapses every spring to instant.
 *
 * Public API is unchanged: `I`, `ICON_SIZE`, `StaticIcon`, `PremiumIcon`,
 * `IconButton`, `Magnetic`, `ARTISAN`, `createArtisanProfile`, `IconArtDefs`,
 * `useMotionSubscribe`, deprecated `REFRACTION_FILTER` / `IconDefsHost`.
 */

import {
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useId,
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
  type MotionStyle,
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

/** SVG ids must be CSS-safe: React's `useId` can contain `:` characters. */
function useSvgId(prefix: string): string {
  const raw = useId();
  return useMemo(
    () => `${prefix}-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [prefix, raw],
  );
}

/** Only closed volumes receive the duotone wash — lines stay crisp. */
function isClosedPath(d: string): boolean {
  return /z\s*$/i.test(d.trim());
}

/* ══════════════════════════════════════════════════════════════════════
 * ARTISAN PROFILE — deterministic per-icon hand variations
 * ════════════════════════════════════════════════════════════════════ */

/** Stable 32-bit FNV-1a hash over the concatenated path data. */
function hashPaths(paths: readonly string[]): number {
  let h = 2166136261;
  for (const d of paths) {
    for (let i = 0; i < d.length; i++) {
      h ^= d.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

interface ArtisanPathOffset {
  ghostX: number;
  ghostY: number;
  bleedX: number;
  bleedY: number;
}

interface ArtisanProfile {
  seed: number;
  groupX: number;
  groupY: number;
  rotate: number;
  perPath: readonly ArtisanPathOffset[];
}

/** Deterministic "hand" — large enough to be felt, never enough to wobble. */
export function createArtisanProfile(paths: readonly string[]): ArtisanProfile {
  const seed = hashPaths(paths);
  const rand = (bit: number) => ((seed >> bit) & 0xff) / 255;

  const perPath: ArtisanPathOffset[] = paths.map((_, i) => {
    const s = (seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
    const r = (bit: number) => ((s >> bit) & 0xff) / 255;
    return {
      ghostX: (r(0) - 0.5) * 0.65,
      ghostY: (r(4) - 0.5) * 0.65,
      bleedX: (r(8) - 0.5) * 0.45,
      bleedY: (r(12) - 0.5) * 0.45,
    };
  });

  return {
    seed,
    groupX: (rand(0) - 0.5) * 0.4,
    groupY: (rand(8) - 0.5) * 0.4,
    rotate: (rand(16) - 0.5) * 1.0,
    perPath,
  };
}

export const ARTISAN = {
  ghostOpacity: 0.34,
  bleedOpacity: 0.18,
  ghostThickness: 0.78,
  bleedThickness: 1.22,
} as const;

/* ══════════════════════════════════════════════════════════════════════
 * ICON REGISTRY
 * ════════════════════════════════════════════════════════════════════ */

export const I = {
  /* ── Management ─────────────────────────────────────────────────── */
  dashboard: [
    'M5.5 3.4h2.5a2.1 2.1 0 0 1 2.1 2.1v2.5a2.1 2.1 0 0 1-2.1 2.1H5.5a2.1 2.1 0 0 1-2.1-2.1V5.5a2.1 2.1 0 0 1 2.1-2.1z',
    'M16 3.4h2.5a2.1 2.1 0 0 1 2.1 2.1v2.5a2.1 2.1 0 0 1-2.1 2.1H16a2.1 2.1 0 0 1-2.1-2.1V5.5A2.1 2.1 0 0 1 16 3.4z',
    'M5.5 13.9h2.5a2.1 2.1 0 0 1 2.1 2.1v2.5a2.1 2.1 0 0 1-2.1 2.1H5.5a2.1 2.1 0 0 1-2.1-2.1V16a2.1 2.1 0 0 1 2.1-2.1z',
    'M16 13.9h2.5a2.1 2.1 0 0 1 2.1 2.1v2.5a2.1 2.1 0 0 1-2.1 2.1H16a2.1 2.1 0 0 1-2.1-2.1V16a2.1 2.1 0 0 1 2.1-2.1z',
  ],
  home: [
    'M3.4 10.7 12 3.6l8.6 7.1',
    'M5.5 9.6V19a1.6 1.6 0 0 0 1.6 1.6h9.8A1.6 1.6 0 0 0 18.5 19V9.6',
    'M9.7 20.6v-5.3a2.3 2.3 0 0 1 4.6 0v5.3',
  ],
  ai: [
    'M12 2.6c.7 4.3 2 5.6 6.3 6.3-4.3.7-5.6 2-6.3 6.3-.7-4.3-2-5.6-6.3-6.3 4.3-.7 5.6-2 6.3-6.3z',
    'M18.3 14.6c.3 1.9.9 2.5 2.8 2.8-1.9.3-2.5.9-2.8 2.8-.3-1.9-.9-2.5-2.8-2.8 1.9-.3 2.5-.9 2.8-2.8z',
    'M5.6 16.2v3',
    'M7.1 17.7H4.6',
  ],
  reports: [
    'M3.4 20.6V3.4',
    'M3.4 20.6h17.2',
    'M7.8 20.6v-6.2',
    'M12 20.6V9.8',
    'M16.2 20.6v-3.8',
    'M17.4 9.4l3.2-3.2',
    'M20.6 9.4V6.2h-3.2',
  ],
  earlyWarning: [
    'M12 9.2v4.2',
    'M12 17.2h.01',
    'M10.3 3.9 2 18.2a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  ],

  /* ── Academics ──────────────────────────────────────────────────── */
  students: [
    'M2.6 8.6 12 3.5l9.4 5.1L12 13.7z',
    'M6.2 10.6v4.6c0 1.8 2.6 3.2 5.8 3.2s5.8-1.4 5.8-3.2v-4.6',
    'M21.4 8.8v6.1',
  ],
  teachers: [
    'M9.4 10.9a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2z',
    'M2.6 20.6v-1.7a4.4 4.4 0 0 1 4.4-4.4h4.8a4.4 4.4 0 0 1 4.4 4.4v1.7',
    'M15.4 6.9l2.1 2.1 4.1-4.1',
  ],
  groups: [
    'M15.6 20.6v-1.7a4.3 4.3 0 0 0-4.3-4.3H6a4.3 4.3 0 0 0-4.3 4.3v1.7',
    'M8.6 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22.3 20.6v-1.7a4.3 4.3 0 0 0-3.2-4.1',
    'M15.8 3.2a4 4 0 0 1 0 7.7',
  ],
  courses: [
    'M12 6.9v14.2',
    'M12 6.9a4.3 4.3 0 0 0-4.3-4.3H2.4v14a1 1 0 0 0 1 1h4.3a4.3 4.3 0 0 1 4.3 4.4 4.3 4.3 0 0 1 4.3-4.4h4.3a1 1 0 0 0 1-1v-14h-5.3A4.3 4.3 0 0 0 12 6.9z',
  ],
  schedule: [
    'M8 2.4v3.4',
    'M16 2.4v3.4',
    'M3.4 9.6h17.2',
    'M19 4.6H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2z',
    'M12 13.4v2.9l2 1.2',
  ],
  attendance: [
    'M8 2.4v3.4',
    'M16 2.4v3.4',
    'M3.4 9.6h17.2',
    'M19 4.6H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2z',
    'M8.8 15.2l2.1 2.1 4.3-4.3',
  ],
  face: [
    'M3.4 8.4V6A2.6 2.6 0 0 1 6 3.4h2.4',
    'M15.6 3.4H18A2.6 2.6 0 0 1 20.6 6v2.4',
    'M20.6 15.6V18a2.6 2.6 0 0 1-2.6 2.6h-2.4',
    'M8.4 20.6H6A2.6 2.6 0 0 1 3.4 18v-2.4',
    'M9.2 10.2v.6',
    'M14.8 10.2v.6',
    'M8.9 14.4a4.2 4.2 0 0 0 6.2 0',
  ],
  homework: [
    'M13.4 3.4H6.2a2 2 0 0 0-2 2v15.2a2 2 0 0 0 2 2h11.6a2 2 0 0 0 2-2v-8',
    'M17.8 2.4l3.8 3.8-8.4 8.4-4.6 1.2 1.2-4.6z',
  ],
  grades: [
    'M8.6 11.2l3 3 8.4-8.4',
    'M20.6 12v7.2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2h10.4',
  ],
  exams: [
    'M13.6 2.4H6.2a2 2 0 0 0-2 2v15.2a2 2 0 0 0 2 2h11.6a2 2 0 0 0 2-2V8.4z',
    'M13.6 2.4v6h6',
    'M8.6 15.2l2.1 2.1 4.7-4.7',
  ],
  library: [
    'M4.2 3.4v17.2',
    'M8.7 3.4v17.2',
    'M13.2 3.4v17.2',
    'M16.6 4.6 20.2 19',
    'M2.4 20.6h19.2',
  ],

  /* ── Finance ────────────────────────────────────────────────────── */
  payments: [
    'M20.8 5.6H3.2A2.2 2.2 0 0 0 1 7.8v8.4a2.2 2.2 0 0 0 2.2 2.2h17.6a2.2 2.2 0 0 0 2.2-2.2V7.8a2.2 2.2 0 0 0-2.2-2.2z',
    'M1 10.6h22',
    'M5.6 15.2h2.6',
  ],
  invoices: [
    'M5.4 2.6v18.8l2.6-1.7 2.1 1.7 1.9-1.7 1.9 1.7 2.1-1.7 2.6 1.7V2.6z',
    'M9 7.4h6',
    'M9 11.2h6',
    'M9 15h3.8',
  ],
  expenses: [
    'M5.4 2.6v18.8l2.6-1.7 2.1 1.7 1.9-1.7 1.9 1.7 2.1-1.7 2.6 1.7V2.6z',
    'M9 8.2h6',
    'M9 12.4h6',
  ],
  payroll: [
    'M20.4 11.6V7.4H6.2a2.1 2.1 0 0 1 0-4.2h11.8v4.2',
    'M4.4 5.6v12.2a2.2 2.2 0 0 0 2.2 2.2h13.8v-4.4',
    'M18 11.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z',
  ],
  financial: [
    'M12 2.4v19.2',
    'M16.7 5.2H9.4a3.5 3.5 0 0 0 0 7h5.2a3.5 3.5 0 0 1 0 7H7',
  ],

  /* ── Communication & CRM ────────────────────────────────────────── */
  leads: [
    'M12 21.4a9.4 9.4 0 1 0 0-18.8 9.4 9.4 0 0 0 0 18.8z',
    'M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2z',
    'M12 12h.01',
  ],
  telegram: ['M22 2 11 13', 'M22 2l-7 20-4-9-9-4z'],
  chat: [
    'M20.8 11.6a8.2 8.2 0 0 1-.9 3.7 8.4 8.4 0 0 1-7.5 4.6 8.2 8.2 0 0 1-3.7-.9L3.2 21l1.9-5.6a8.2 8.2 0 0 1-.9-3.7 8.4 8.4 0 0 1 4.6-7.5 8.2 8.2 0 0 1 3.7-.9h.5a8.4 8.4 0 0 1 7.8 8.3z',
    'M8.6 11.8h.01',
    'M12.2 11.8h.01',
    'M15.8 11.8h.01',
  ],
  notifications: [
    'M18.4 8.4a6.4 6.4 0 1 0-12.8 0c0 7-2.7 8.6-2.7 8.6h18.2s-2.7-1.6-2.7-8.6',
    'M9.9 20.6a2.4 2.4 0 0 0 4.2 0',
  ],

  /* ── Administration ─────────────────────────────────────────────── */
  users: [
    'M16.4 20.6v-1.6a4.2 4.2 0 0 0-4.2-4.2H5.7A4.2 4.2 0 0 0 1.5 19v1.6',
    'M8.9 11.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    'M22.5 20.6v-1.6a4.2 4.2 0 0 0-3.1-4',
    'M16 3.5a4 4 0 0 1 0 7.4',
  ],
  branches: [
    'M3.4 20.6h17.2',
    'M5.4 20.6V7.6l6.6-4.4 6.6 4.4v13',
    'M9.4 20.6v-5.4h5.2v5.4',
    'M9.2 11.2h.01',
    'M14.8 11.2h.01',
  ],
  camera: [
    'M21.6 18.4a2.2 2.2 0 0 1-2.2 2.2H3.4a2.2 2.2 0 0 1-2.2-2.2V8.9a2.2 2.2 0 0 1 2.2-2.2h3.4l2-2.9h6.4l2 2.9h3.4a2.2 2.2 0 0 1 2.2 2.2z',
    'M12 16.8a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z',
  ],
  cameras: [
    'M22.4 7.4 15.8 12l6.6 4.6z',
    'M15.2 5.4H3.4a2 2 0 0 0-2 2v9.2a2 2 0 0 0 2 2h11.8a2 2 0 0 0 2-2V7.4a2 2 0 0 0-2-2z',
  ],
  audit: [
    'M2.2 12S6.2 4.4 12 4.4 21.8 12 21.8 12 17.8 19.6 12 19.6 2.2 12 2.2 12z',
    'M12 14.9a2.9 2.9 0 1 0 0-5.8 2.9 2.9 0 0 0 0 5.8z',
  ],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],

  /* ── Extended modules ───────────────────────────────────────────── */
  executive: [
    'M20.9 15.8A9.9 9.9 0 1 1 8.2 3.1',
    'M21.8 11.9A9.9 9.9 0 0 0 12 2.1v9.8z',
  ],
  parentPortal: [
    'M3.2 10.8 12 3.2l8.8 7.6',
    'M5.6 9.6V19a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2V9.6',
    'M12 18.2c-2.3-1.5-3.4-2.7-3.4-4a1.9 1.9 0 0 1 3.4-1.2 1.9 1.9 0 0 1 3.4 1.2c0 1.3-1.1 2.5-3.4 4z',
  ],
  hr: [
    'M20 5.4H4a2 2 0 0 0-2 2v9.2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7.4a2 2 0 0 0-2-2z',
    'M8.6 11.4a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8z',
    'M5.2 15.6a3.4 3.4 0 0 1 6.8 0',
    'M14.8 9.8h4',
    'M14.8 13.6h4',
  ],
  automation: ['M13.2 2.4 4.1 13.6h7.3l-1.1 8 9.6-11.2h-7.4z'],
  followUp: [
    'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z',
    'M15 2h6v6',
    'M21 2l-6 6',
  ],
  inventory: [
    'M20.6 15.8V8.2a2 2 0 0 0-1-1.7l-6.6-3.8a2 2 0 0 0-2 0L4.4 6.5a2 2 0 0 0-1 1.7v7.6a2 2 0 0 0 1 1.7l6.6 3.8a2 2 0 0 0 2 0l6.6-3.8a2 2 0 0 0 1-1.7z',
    'M3.7 7.1 12 11.9l8.3-4.8',
    'M12 21.4v-9.5',
  ],
  cert: [
    'M12 14.6a5.1 5.1 0 1 0 0-10.2 5.1 5.1 0 0 0 0 10.2z',
    'M8.3 13.5 6.9 21.6l5.1-2.9 5.1 2.9-1.4-8.1',
    'M10.2 9.4l1.3 1.3 2.6-2.6',
  ],
  anomaly: ['M22 12h-3.7l-2.8 7.6L9.5 4.4 6.7 12H2'],
  governance: [
    'M12 21.6s7.8-3.9 7.8-9.6V5.4L12 2.4 4.2 5.4V12c0 5.7 7.8 9.6 7.8 9.6z',
    'M8.8 11.8l2.2 2.2 4.2-4.2',
  ],

  /* ── Controls & utility ─────────────────────────────────────────── */
  logout: [
    'M9.2 20.6H5.4a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2h3.8',
    'M16.4 16.8l4.8-4.8-4.8-4.8',
    'M21.2 12H9.4',
  ],
  search: [
    'M11 18.8a7.8 7.8 0 1 0 0-15.6 7.8 7.8 0 0 0 0 15.6z',
    'M20.8 20.8l-4.4-4.4',
  ],
  menu: ['M3.4 6.6h17.2', 'M3.4 12h17.2', 'M3.4 17.4h17.2'],
  close: ['M6.4 6.4l11.2 11.2', 'M17.6 6.4 6.4 17.6'],
  calculator: [
    'M18.6 3.4H5.4a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h13.2a2 2 0 0 0 2-2V5.4a2 2 0 0 0-2-2z',
    'M7.8 7.6h8.4',
    'M8.1 11.6h.01',
    'M12 11.6h.01',
    'M15.9 11.6h.01',
    'M8.1 15.4h.01',
    'M12 15.4h.01',
    'M15.9 15.4h.01',
  ],
  collapse: ['M11.4 18.6 4.4 12l7-6.6', 'M19.6 18.6 12.6 12l7-6.6'],
  expand: ['M12.6 5.4l7 6.6-7 6.6', 'M4.4 5.4l7 6.6-7 6.6'],
  fullscreenEnter: [
    'M8.4 3.4H5.4a2 2 0 0 0-2 2v3',
    'M15.6 3.4h3a2 2 0 0 1 2 2v3',
    'M20.6 15.6v3a2 2 0 0 1-2 2h-3',
    'M3.4 15.6v3a2 2 0 0 0 2 2h3',
  ],
  fullscreenExit: [
    'M8.4 3.4v3a2 2 0 0 1-2 2h-3',
    'M20.6 8.4h-3a2 2 0 0 1-2-2v-3',
    'M3.4 15.6h3a2 2 0 0 1 2 2v3',
    'M15.6 20.6v-3a2 2 0 0 1 2-2h3',
  ],
  keyboard: [
    'M20 5.4H4a2 2 0 0 0-2 2v9.2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7.4a2 2 0 0 0-2-2z',
    'M6.8 9.6h.01',
    'M10.4 9.6h.01',
    'M14 9.6h.01',
    'M17.6 9.6h.01',
    'M6.8 14.4h10.4',
  ],
  user: [
    'M20.4 20.6v-1.8a4.2 4.2 0 0 0-4.2-4.2H7.8a4.2 4.2 0 0 0-4.2 4.2v1.8',
    'M12 11.2a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  ],
  wifiOff: [
    'M2.2 2.2 21.8 21.8',
    'M16.7 12.6A12 12 0 0 1 21 15',
    'M5 12.5a12 12 0 0 1 5.2-2.9',
    'M8.5 16a6 6 0 0 1 7 0',
    'M12 20h.01',
  ],
  check: ['M20.4 6.4 9.6 17.2 4.4 12'],
  star: [
    'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.4l6.5-.9z',
  ],
  pin: [
    'M9.2 3.4h5.6',
    'M10.4 3.4v5.2l-2.6 3.1a.8.8 0 0 0 .6 1.3h7.2a.8.8 0 0 0 .6-1.3l-2.6-3.1V3.4',
    'M12 13v7.6',
  ],
  chevronDown: ['M6.4 9.4 12 15l5.6-5.6'],
  chevronRight: ['M9.4 5.6 15 11.2 9.4 16.8'],
  arrowRight: ['M4.6 12h14.8', 'M12.8 5.4 19.4 12l-6.6 6.6'],
  arrowUpRight: ['M7 17 17 7', 'M9.2 7H17v7.8'],
  sparkles: [
    'M12 3.4c.5 3.6 1.6 4.7 5.2 5.2-3.6.5-4.7 1.6-5.2 5.2-.5-3.6-1.6-4.7-5.2-5.2 3.6-.5 4.7-1.6 5.2-5.2z',
    'M17.8 14.6c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5z',
  ],
  command: [
    'M9 3.4a2.6 2.6 0 1 1 2.6 2.6H9zm0 17.2a2.6 2.6 0 1 0 2.6-2.6H9zM15 3.4a2.6 2.6 0 1 0-2.6 2.6H15zm0 17.2a2.6 2.6 0 1 1-2.6-2.6H15z',
    'M11.6 9h.8v6h-.8z',
  ],
  sun: [
    'M12 16.6a4.6 4.6 0 1 0 0-9.2 4.6 4.6 0 0 0 0 9.2z',
    'M12 2.4v2.2',
    'M12 19.4v2.2',
    'M2.4 12h2.2',
    'M19.4 12h2.2',
    'M5.2 5.2l1.6 1.6',
    'M17.2 17.2l1.6 1.6',
    'M18.8 5.2l-1.6 1.6',
    'M6.8 17.2l-1.6 1.6',
  ],
  moon: ['M20.6 14.4A8.6 8.6 0 1 1 9.6 3.4a6.9 6.9 0 0 0 11 11z'],
  monitor: [
    'M20 3.4H4a2 2 0 0 0-2 2v9.2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5.4a2 2 0 0 0-2-2z',
    'M8.4 20.6h7.2',
    'M12 16.6v4',
  ],
  globe: [
    'M12 21.4a9.4 9.4 0 1 0 0-18.8 9.4 9.4 0 0 0 0 18.8z',
    'M2.6 12h18.8',
    'M12 2.6c2.5 2.6 3.8 5.9 3.8 9.4s-1.3 6.8-3.8 9.4c-2.5-2.6-3.8-5.9-3.8-9.4S9.5 5.2 12 2.6z',
  ],
  plus: ['M12 4.4v15.2', 'M4.4 12h15.2'],
  edit: [
    'M12.6 4.4H5.4a2 2 0 0 0-2 2v12.2a2 2 0 0 0 2 2h12.2a2 2 0 0 0 2-2v-7.2',
    'M17.4 2.8l3.8 3.8-8.6 8.6-4.8 1 1-4.8z',
  ],
  trash: [
    'M3.4 6.4h17.2',
    'M8.4 6.4V4.6a1.2 1.2 0 0 1 1.2-1.2h4.8a1.2 1.2 0 0 1 1.2 1.2v1.8',
    'M18.6 6.4l-1 13.2a1.4 1.4 0 0 1-1.4 1.3H7.8a1.4 1.4 0 0 1-1.4-1.3l-1-13.2',
  ],
  dots: ['M5.4 12h.01', 'M12 12h.01', 'M18.6 12h.01'],
} as const satisfies Record<string, readonly string[]>;

export type IconKey = keyof typeof I;
export type IconPaths = readonly string[];

/* ══════════════════════════════════════════════════════════════════════
 * SIZE, STROKE & SPRING TOKENS
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

/** Duotone tint stops — volume, never a blob. */
const TINT_TOP = 0.17;
const TINT_BOTTOM = 0.035;
const TINT_TOP_ACTIVE = 0.26;
const TINT_BOTTOM_ACTIVE = 0.07;

const SPRING_TAP: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.6 };
const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 24, mass: 0.75 };
const SPRING_INSTANT: Transition = { type: 'tween', duration: 0 };

/* ══════════════════════════════════════════════════════════════════════
 * LEGACY SHARED DEFS
 * ════════════════════════════════════════════════════════════════════ */

/**
 * @deprecated Optical-refraction filter ids were removed with the v27 look.
 * Kept so existing imports keep compiling.
 */
export const REFRACTION_FILTER = {
  subtle: 'medu-refract-subtle',
  default: 'medu-refract-default',
  strong: 'medu-refract-strong',
} as const;

/** @deprecated Renders nothing — kept for API compatibility. */
export const IconDefsHost = memo(function IconDefsHost() {
  return null;
});

/** Optional edge-wobble filter for `<StaticIcon rough />` consumers. */
export const IconArtDefs = memo(function IconArtDefs() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
    >
      <defs>
        <filter id="ic-hand-wobble" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85 0.85"
            numOctaves="1"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="0.55"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * Shared paint — gradient duotone
 * ════════════════════════════════════════════════════════════════════ */

function DuotoneDefs({ id, active = false }: { id: string; active?: boolean }) {
  return (
    <defs>
      <linearGradient
        id={id}
        x1="4"
        y1="2.5"
        x2="20"
        y2="21.5"
        gradientUnits="userSpaceOnUse"
      >
        <stop
          offset="0%"
          stopColor="currentColor"
          stopOpacity={active ? TINT_TOP_ACTIVE : TINT_TOP}
        />
        <stop
          offset="100%"
          stopColor="currentColor"
          stopOpacity={active ? TINT_BOTTOM_ACTIVE : TINT_BOTTOM}
        />
      </linearGradient>
    </defs>
  );
}

/* ══════════════════════════════════════════════════════════════════════
 * StaticIcon
 * ════════════════════════════════════════════════════════════════════ */

export interface StaticIconProps {
  paths: IconPaths;
  className?: string;
  size?: number;
  strokeWidth?: number;
  /** Optional accessible name. When omitted the icon stays `aria-hidden`. */
  title?: string;
  /** Subtle volumetric duotone fill for closed shapes. Default true. */
  duotone?: boolean;
  /** @deprecated Kept for backward compatibility */
  artisan?: boolean;
  /** @deprecated Kept for backward compatibility */
  rough?: boolean;
}

export const StaticIcon = memo(function StaticIcon({
  paths,
  className = '',
  size = DEFAULT_ICON_SIZE,
  strokeWidth = STROKE_BASE,
  title,
  duotone = true,
}: StaticIconProps) {
  const isDecorative = !title;
  const safePaths = paths ?? [];
  const tintId = useSvgId('ic-tint');
  const fillable = useMemo(
    () => (duotone ? safePaths.filter(isClosedPath) : []),
    [duotone, safePaths],
  );

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
      {fillable.length > 0 && <DuotoneDefs id={tintId} />}

      {fillable.length > 0 && (
        <g fill={`url(#${tintId})`} stroke="none" aria-hidden="true">
          {fillable.map((d, i) => (
            <path key={`fill-${i}`} d={d} />
          ))}
        </g>
      )}

      <g fill="none" stroke="currentColor">
        {safePaths.map((d, i) => (
          <path key={`stroke-${i}`} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * PremiumIcon
 * ════════════════════════════════════════════════════════════════════ */

export interface PremiumIconProps {
  paths: IconPaths;
  isActive?: boolean;
  /** @deprecated Accent is carried by surrounding design tokens. */
  accent?: AccentKey;
  className?: string;
  size?: number;
  /** Subtle volumetric duotone fill for closed shapes. Default true. */
  duotone?: boolean;
  /** @deprecated no-op */
  revealOnActivate?: boolean;
  /** @deprecated no-op */
  refraction?: 'off' | 'subtle' | 'default';
  /** @deprecated Kept for backward compatibility */
  artisan?: boolean;
  /** @deprecated Kept for backward compatibility */
  rough?: boolean;
}

export const PremiumIcon = memo(function PremiumIcon({
  paths,
  isActive = false,
  className = '',
  size = DEFAULT_ICON_SIZE,
  duotone = true,
}: PremiumIconProps) {
  const reduced = usePrefersReducedMotion();
  const transition = reduced ? SPRING_INSTANT : SPRING_SOFT;
  const safePaths = paths ?? [];
  const tintId = useSvgId('ic-tint');
  const fillable = useMemo(
    () => (duotone ? safePaths.filter(isClosedPath) : []),
    [duotone, safePaths],
  );

  const strokeWidth = useSpring(isActive ? STROKE_ACTIVE : STROKE_BASE, transition);
  const scale = useSpring(isActive ? 1.045 : 1, transition);
  const tintOpacity = useSpring(isActive ? 1 : 0.62, transition);

  return (
    <motion.svg
      className={cn('shrink-0 select-none', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ scale, transformOrigin: '50% 50%' }}
      shapeRendering="geometricPrecision"
      aria-hidden="true"
      focusable="false"
    >
      {fillable.length > 0 && <DuotoneDefs id={tintId} active={isActive} />}

      {fillable.length > 0 && (
        <motion.g
          fill={`url(#${tintId})`}
          stroke="none"
          style={{ opacity: tintOpacity } as MotionStyle}
          aria-hidden="true"
        >
          {fillable.map((d, i) => (
            <path key={`fill-${i}`} d={d} />
          ))}
        </motion.g>
      )}

      <motion.g
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ strokeWidth } as MotionStyle}
      >
        {safePaths.map((d, i) => (
          <path key={`stroke-${i}`} d={d} vectorEffect="non-scaling-stroke" />
        ))}
      </motion.g>
    </motion.svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════
 * Magnetic
 * ════════════════════════════════════════════════════════════════════ */

export interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
  disabled?: boolean;
  maxTilt?: number;
  /** @deprecated no-op */
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
 * IconButton
 * ════════════════════════════════════════════════════════════════════ */

const ICON_BUTTON_SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-8 w-8 rounded-lg',
  md: 'h-10 w-10 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
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
  size?: IconButtonSize;
  variant?: IconButtonVariant;
  /** @deprecated no-op */
  magnetic?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** @deprecated no-op */
  refraction?: 'off' | 'subtle' | 'default';
  /** @deprecated no-op */
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
        whileHover={canAnimate ? { y: -1 } : undefined}
        whileTap={canAnimate ? { scale: 0.94, y: 0 } : undefined}
        transition={SPRING_TAP}
        className={cn(
          'relative flex items-center justify-center select-none',
          'border outline-none',
          'transition-[background-color,border-color,color,box-shadow] duration-200 ease-apple-spring',
          ICON_BUTTON_SIZE_CLASS[size],
          variant === 'ghost' && 'border-transparent bg-transparent',
          variant === 'tile' &&
            (active
              ? cn(
                  'border-brand-500/35 bg-brand-500/[0.12] text-brand-600',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-1px_0_rgba(0,122,255,0.22),0_3px_10px_-3px_rgba(0,122,255,0.35)]',
                  'dark:border-brand-400/40 dark:bg-brand-400/[0.18] dark:text-brand-300',
                  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_12px_-3px_rgba(10,132,255,0.45)]',
                )
              : cn(
                  'border-black/[0.07] bg-white/55 text-[var(--text-secondary)]',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.03)]',
                  'backdrop-blur-md hover:text-[var(--text-primary)] hover:bg-white/80',
                  'dark:border-white/[0.09] dark:bg-white/[0.055]',
                  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:hover:bg-white/[0.1]',
                )),
          variant === 'ghost' &&
            (active
              ? 'text-brand-600 dark:text-brand-400'
              : cn(
                  'text-[var(--text-secondary)]',
                  'hover:text-[var(--text-primary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
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
 * useMotionSubscribe
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
