/**
 * M-EDU Layout Design & Motion Tokens
 *
 * Centralized z-index layers, spring physics, durations and framer-motion
 * variants. Accents follow the Apple system palette (single restrained ramp,
 * no rainbow gradients).
 */
import type { Variants } from 'framer-motion';

/* ── Z-INDEX LAYERS (single source of truth) ── */
export const Z_INDEX = {
  background: -10,
  content: 10,
  topbar: 30,
  sidebar: 35,
  mobileBottomNav: 40,
  floatingTools: 45, // Copilot, Calculator triggers
  dropdown: 50,
  mobileDrawer: 60,
  modal: 70, // Shortcuts, mobile search sheet
  toast: 80,
  skipLink: 100,
} as const;

/* ── MOTION SPRINGS & EASING ── */
export const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft: { type: 'spring', stiffness: 240, damping: 28, mass: 1.0 },
  magnetic: { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 },
  layout: { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 },
} as const;

export const EASE_APPLE = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** Durations in seconds — 150–250ms band (Apple-premium motion rule). */
export const DUR = { fast: 0.15, base: 0.2, slow: 0.25 } as const;

/* ── MOTION VARIANTS ── */
export const navListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.024, delayChildren: 0.04 } },
};

export const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

export const mobileSheetVariants: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: SPRING.smooth },
  exit: { x: '-100%', opacity: 0, transition: { duration: DUR.base, ease: EASE_APPLE } },
};

/** Backdrops only fade — the blur itself is a static CSS class. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DUR.base, ease: EASE_APPLE } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

export const popoverVariants: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.fast, ease: EASE_APPLE } },
  exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

export const bannerVariants: Variants = {
  hidden: { y: -48, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: SPRING.smooth },
  exit: { y: -48, opacity: 0, transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: -6, transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

/* ── BRAND ACCENTS (Apple system palette) ───────────────────────────────
 * `from`/`to` stay 6-digit hex so callers can append alpha (`${from}2E`)
 * and SVG gradients can use them as `stop-color`. `glow`/`edge` are rgba.
 */
export type AccentKey = 'blue' | 'purple' | 'pink' | 'green' | 'orange' | 'rainbow';

export const ACCENTS: Record<AccentKey, { from: string; to: string; glow: string; edge: string }> = {
  blue: { from: '#007AFF', to: '#0066D6', glow: 'rgba(0,122,255,0.16)', edge: 'rgba(0,122,255,0.28)' },
  purple: { from: '#5856D6', to: '#4744C4', glow: 'rgba(88,86,214,0.16)', edge: 'rgba(88,86,214,0.28)' },
  pink: { from: '#FF2D55', to: '#D70036', glow: 'rgba(255,45,85,0.14)', edge: 'rgba(255,45,85,0.24)' },
  green: { from: '#34C759', to: '#2FB14E', glow: 'rgba(52,199,89,0.16)', edge: 'rgba(52,199,89,0.28)' },
  orange: { from: '#FF9500', to: '#E68600', glow: 'rgba(255,149,0,0.14)', edge: 'rgba(255,149,0,0.24)' },
  // Legacy key kept for API compatibility — now a restrained blue→indigo ramp.
  rainbow: { from: '#007AFF', to: '#5856D6', glow: 'rgba(0,122,255,0.16)', edge: 'rgba(88,86,214,0.26)' },
};
