/**
 * M-EDU Layout Design & Motion Tokens — v11 "Titanium"
 * Centralized z-index layers, spring physics, WCAG AA color tokens, and framer-motion variants.
 */
import type { Variants } from 'framer-motion';

/* ── Z-INDEX LAYERS (Single Source of Truth) ── */
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
  snappy:   { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth:   { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:     { type: 'spring', stiffness: 240, damping: 28, mass: 1.0 },
  magnetic: { type: 'spring', stiffness: 260, damping: 22, mass: 0.6 },
  layout:   { type: 'spring', stiffness: 380, damping: 34, mass: 0.9 },
} as const;

export const EASE_APPLE = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const DUR = { fast: 0.18, base: 0.28, slow: 0.42 } as const;

/* ── MOTION VARIANTS ── */
export const navListVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.024, delayChildren: 0.04 } },
};

export const navItemVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: SPRING.smooth },
};

export const mobileSheetVariants: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 32, mass: 0.85 } },
  exit: { x: '-100%', opacity: 0, transition: { duration: DUR.base, ease: EASE_APPLE } },
};

export const backdropVariants: Variants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  visible: { opacity: 1, backdropFilter: 'blur(14px)', transition: { duration: DUR.base, ease: EASE_APPLE } },
  exit: { opacity: 0, backdropFilter: 'blur(0px)', transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

export const popoverVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.96, filter: 'blur(4px)' },
  visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transition: { duration: DUR.fast, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: -8, scale: 0.96, filter: 'blur(4px)', transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

export const bannerVariants: Variants = {
  hidden: { y: -60, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: SPRING.smooth },
  exit: { y: -60, opacity: 0, transition: { duration: DUR.fast, ease: EASE_APPLE } },
};

export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT_EXPO } },
};

/* ── BRAND ACCENTS ── */
export type AccentKey = 'blue' | 'purple' | 'pink' | 'green' | 'orange' | 'rainbow';

export const ACCENTS: Record<AccentKey, { from: string; to: string; glow: string; edge: string }> = {
  blue:    { from: '#007AFF', to: '#5856D6', glow: 'rgba(0,122,255,0.45)', edge: 'rgba(0,122,255,0.5)' },
  purple:  { from: '#5856D6', to: '#AF52DE', glow: 'rgba(88,86,214,0.45)', edge: 'rgba(88,86,214,0.5)' },
  pink:    { from: '#FF2D55', to: '#AF52DE', glow: 'rgba(255,45,85,0.45)', edge: 'rgba(255,45,85,0.5)' },
  green:   { from: '#34C759', to: '#32ADE6', glow: 'rgba(52,199,89,0.45)', edge: 'rgba(52,199,89,0.5)' },
  orange:  { from: '#FF9500', to: '#FF2D55', glow: 'rgba(255,149,0,0.45)', edge: 'rgba(255,149,0,0.5)' },
  rainbow: { from: '#007AFF', to: '#FF2D55', glow: 'rgba(175,82,222,0.55)', edge: 'rgba(175,82,222,0.6)' },
};
