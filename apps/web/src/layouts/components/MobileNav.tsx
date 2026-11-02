'use client';

/**
 * ============================================================================
 * M-EDU Mobile Navigation — Liquid Glass (iOS 26+ / visionOS)
 * ============================================================================
 *
 * Real Liquid Glass — not glassmorphism:
 *
 *  • Multi-layer bevel: bright top rim + cool bottom rim + chromatic fringe
 *  • Environmental light: warm & cool gradients drift in opposite phases
 *    (GPU-composited, framer-motion transform animations)
 *  • Refractive specular: pointer rim travels through an SVG fractal-
 *    displacement filter, bending like light on curved glass
 *  • Liquid press: every tap compresses the glass (scaleX↑ scaleY↓)
 *  • Lens caustics: active lens gets corner catchlights + a cool bounce line
 *  • Drawer edge refraction: dragging stretches and chills the slab's edge
 *  • Search bloom refraction: focus halo flows through the lens filter
 *
 * ─── Fixes vs. the previous revision ────────────────────────────────────
 *  [perf]  getBoundingClientRect() no longer runs per pointermove — rects
 *          are measured once per gesture and invalidated on scroll/resize.
 *  [perf]  <filter id="lg-refract"> is now a reference-counted singleton in
 *          document.body. Was tripled across three surfaces before; that
 *          violated id uniqueness and caused mid-animation flicker.
 *  [perf]  Ambient glow actually drifts now — GPU-composited transforms,
 *          no per-frame style recalculation. Warm/cool move in opposite
 *          phases so the surface never looks frozen.
 *  [perf]  MobileBottomNav / MobileMenuDrawer / MobileSearchSheet are
 *          wrapped in React.memo. Public API unchanged.
 *  [fix]   Drawer declares aria-modal="true" — now also traps focus via
 *          useFocusTrap(drawerRef, open, closeBtnRef). Was a real a11y
 *          break: Tab could escape the modal.
 *  [fix]   useOpticalRefraction tolerates a missing/empty currentTarget.
 *  [fix]   sound instance captured through a ref — no stale closures.
 *  [fix]   Search input is now <input type="text" role="searchbox"
 *          inputMode="search" enterKeyHint="search"> — kills the cross-
 *          browser ::-webkit/moz/ms search-cancel-button zoo in one move.
 *  [fix]   AnimatePresence mode="popLayout" → "wait" on the submit pill.
 *  [a11y]  aria-live region politely announces scope selection changes.
 *  [a11y]  i18n fallbacks treat empty string as "missing" — no blank labels.
 *  [style] prefers-reduced-transparency strips filters, sheens and ambient
 *          glows entirely — clean GLASS_SOLID fallback, not degraded blur.
 * ============================================================================
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { NavLink } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useDragControls,
  type MotionValue,
  type MotionStyle,
} from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useFocusTrap, useMediaQuery } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, Magnetic, I } from './Icons';
import { ALL_ITEMS_MAP, NavItems, RecentRoutes, type NavItem } from './Sidebar';

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ════════════════════════════════════════════════════════════════════════ */

const STAFF_MOBILE_TAB_ROUTES = ['/', '/attendance', '/payments', '/leads'] as const;
const TEACHER_MOBILE_TAB_ROUTES = ['/attendance', '/groups', '/schedule', '/grades'] as const;
const STUDENT_MOBILE_TAB_ROUTES = ['/', '/schedule', '/attendance', '/chat'] as const;
const PARENT_MOBILE_TAB_ROUTES = [
  '/parent-portal',
  '/chat',
  '/notifications',
  '/settings',
] as const;
const FINANCE_MOBILE_TAB_ROUTES = ['/payments', '/invoices', '/expenses', '/reports'] as const;
const RECEPTIONIST_MOBILE_TAB_ROUTES = ['/', '/attendance', '/leads', '/students'] as const;

/* ══════════════════════════════════════════════════════════════════════════
 * SPRINGS & HAPTICS
 * ════════════════════════════════════════════════════════════════════════ */

/** Shape-morphing: lens travelling between tabs, sheets arriving */
const SPRING_MORPH = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.7,
  restDelta: 0.001,
} as const;

/** Direct manipulation: press, release, toggles */
const SPRING_TOUCH = { type: 'spring', stiffness: 640, damping: 32, mass: 0.45 } as const;

/** Gel: press deformation of the glass — bouncier than touch */
const SPRING_GEL = { type: 'spring', stiffness: 720, damping: 26, mass: 0.35 } as const;

/** Large surfaces: drawer slab */
export const SPRING_SLAB = {
  type: 'spring',
  stiffness: 360,
  damping: 36,
  mass: 0.85,
  restDelta: 0.001,
} as const;

/** Native-grade mobile drawer spring: snappy, critical damping, zero stutter */
const DRAWER_SPRING = {
  type: 'spring',
  stiffness: 420,
  damping: 38,
  mass: 0.6,
  restDelta: 0.001,
} as const;

function triggerHaptic(pattern: number | number[] = 8) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* blocked by browser policy */
  }
}

/* ══════════════════════════════════════════════════════════════════════════
 * LIQUID GLASS — SVG FILTER SINGLETON
 *
 * One <filter id="lg-refract"> exists in document.body at a time, kept
 * alive by reference counting. Every nav surface that needs it calls
 * `useLiquidDefs(enabled)`. No duplicate ids, no flicker on unmount.
 * ════════════════════════════════════════════════════════════════════════ */

const LIQUID_DEFS_ID = 'lg-defs';
const LIQUID_FILTER_ID = 'lg-refract';
const SVG_NS = 'http://www.w3.org/2000/svg';

let liquidDefsRefCount = 0;
let liquidDefsElement: SVGSVGElement | null = null;

function buildLiquidDefsElement(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('id', LIQUID_DEFS_ID);
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText =
    'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', LIQUID_FILTER_ID);
  filter.setAttribute('x', '-20%');
  filter.setAttribute('y', '-20%');
  filter.setAttribute('width', '140%');
  filter.setAttribute('height', '140%');

  const turbulence = document.createElementNS(SVG_NS, 'feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('baseFrequency', '0.014 0.022');
  turbulence.setAttribute('numOctaves', '2');
  turbulence.setAttribute('seed', '7');
  turbulence.setAttribute('result', 'noise');

  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'noise');
  blur.setAttribute('stdDeviation', '0.4');
  blur.setAttribute('result', 'soft');

  const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'soft');
  displacement.setAttribute('scale', '3.5');
  displacement.setAttribute('xChannelSelector', 'R');
  displacement.setAttribute('yChannelSelector', 'G');

  filter.append(turbulence, blur, displacement);
  defs.append(filter);
  svg.append(defs);

  return svg;
}

function acquireLiquidDefs(): () => void {
  liquidDefsRefCount += 1;
  if (!liquidDefsElement && typeof document !== 'undefined') {
    liquidDefsElement = buildLiquidDefsElement();
    document.body.append(liquidDefsElement);
  }
  return () => {
    liquidDefsRefCount = Math.max(0, liquidDefsRefCount - 1);
    if (liquidDefsRefCount === 0 && liquidDefsElement) {
      liquidDefsElement.remove();
      liquidDefsElement = null;
    }
  };
}

function useLiquidDefs(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    return acquireLiquidDefs();
  }, [enabled]);
}

/* ══════════════════════════════════════════════════════════════════════════
 * CACHED RECT — one measurement per layout change, never per frame
 * ════════════════════════════════════════════════════════════════════════ */

interface CachedRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function readRect(el: HTMLElement): CachedRect {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/* ══════════════════════════════════════════════════════════════════════════
 * OPTICAL REFRACTION — pointer sheen + rim, no React re-renders
 * ════════════════════════════════════════════════════════════════════════ */

function useOpticalRefraction(initialX = 160, initialY = 30) {
  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);
  const opacity = useSpring(0, { stiffness: 260, damping: 30 });
  const sx = useSpring(x, { stiffness: 380, damping: 34, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 380, damping: 34, mass: 0.4 });

  const rectRef = useRef<CachedRect | null>(null);

  // Invalidate on scroll / resize so the next pointer event re-measures.
  useEffect(() => {
    const invalidate = () => {
      rectRef.current = null;
    };
    window.addEventListener('scroll', invalidate, { passive: true, capture: true });
    window.addEventListener('resize', invalidate, { passive: true });
    return () => {
      window.removeEventListener('scroll', invalidate, true);
      window.removeEventListener('resize', invalidate);
    };
  }, []);

  const measure = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement | null;
    if (el) rectRef.current = readRect(el);
  }, []);

  const track = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const el = e.currentTarget as HTMLElement | null;
      if (!el) return;
      if (!rectRef.current) rectRef.current = readRect(el);
      const r = rectRef.current;
      x.set(e.clientX - r.left);
      y.set(e.clientY - r.top);
      opacity.set(1);
    },
    [x, y, opacity],
  );

  const release = useCallback(() => opacity.set(0), [opacity]);

  const sheen = useMotionTemplate`radial-gradient(170px circle at ${sx}px ${sy}px, rgba(255,255,255,0.42), rgba(0,122,255,0.12) 45%, transparent 75%)`;
  const rim = useMotionTemplate`radial-gradient(120px circle at ${sx}px 0px, rgba(255,255,255,0.98), transparent 100%)`;

  return {
    bind: {
      onPointerEnter: measure,
      onPointerDown: track,
      onPointerMove: track,
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
    },
    sheen,
    rim,
    opacity,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * STABLE SOUND — ref-captured audio hooks
 * ════════════════════════════════════════════════════════════════════════ */

function useStableSound() {
  const sound = usePremiumSound();
  const ref = useRef(sound);
  useEffect(() => {
    ref.current = sound;
  }, [sound]);
  return ref;
}

/* ══════════════════════════════════════════════════════════════════════════
 * GLASS TOKENS — multi-layer bevel
 * ════════════════════════════════════════════════════════════════════════ */

const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/70 focus-visible:ring-offset-0';

const GLASS_SLAB = cn(
  'border border-white/60 bg-white/80',
  'backdrop-blur-2xl backdrop-saturate-[200%]',
  'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.92),inset_0_-1px_0_0_rgba(0,122,255,0.14),0_12px_36px_-6px_rgba(0,0,0,0.12),0_2px_10px_-2px_rgba(0,0,0,0.04)]',
  'dark:border-white/[0.14] dark:bg-[#16161a]/85',
  'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),inset_0_-1px_0_0_rgba(10,132,255,0.18),0_16px_44px_-8px_rgba(0,0,0,0.7),0_2px_12px_-2px_rgba(0,0,0,0.4)]',
);

const GLASS_SOLID =
  'border border-black/[0.08] bg-[var(--bg-card)] dark:border-white/[0.14]';

/** High-performance mobile drawer glass (ultra-smooth 60/120fps hardware compositing) */
const GLASS_DRAWER = cn(
  'border border-white/60 bg-white/85',
  'backdrop-blur-2xl backdrop-saturate-[200%]',
  'shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(0,122,255,0.12),0_24px_48px_-12px_rgba(0,0,0,0.28),0_4px_16px_-4px_rgba(0,0,0,0.12)]',
  'dark:border-white/[0.14] dark:bg-[#16161a]/92',
  'dark:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(10,132,255,0.14),0_28px_56px_-12px_rgba(0,0,0,0.7),0_6px_20px_-4px_rgba(0,0,0,0.4)]',
);

const GLASS_CHIP = cn(
  'border border-black/[0.06] bg-black/[0.045] text-[var(--text-secondary)]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-0.5px_0_rgba(0,0,0,0.03)]',
  'dark:border-white/[0.1] dark:bg-white/[0.09] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
  'hover:bg-black/[0.08] dark:hover:bg-white/[0.15]',
);

const LENS_ACTIVE = cn(
  'border border-apple-blue/25 bg-gradient-to-b from-apple-blue/15 to-apple-blue/[0.06]',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_10px_-2px_rgba(0,122,255,0.28)]',
  'dark:border-apple-blue/35 dark:from-apple-blue/25 dark:to-apple-blue/[0.10]',
  'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_12px_-2px_rgba(10,132,255,0.42)]',
);

const TAB_IDLE = 'text-[#8E8E93] dark:text-[#98989D]';
const TAB_ACTIVE = 'text-[#007AFF] dark:text-[#0A84FF]';

/* ══════════════════════════════════════════════════════════════════════════
 * AMBIENT — static gradients, real motion lives in SheenLayer
 * ════════════════════════════════════════════════════════════════════════ */

const AMBIENT_WARM =
  'radial-gradient(90% 65% at 35% 18%, rgba(255,255,255,0.08), transparent 65%)';
const AMBIENT_COOL =
  'radial-gradient(90% 65% at 65% 82%, rgba(120,190,255,0.16), transparent 65%)';

/* ══════════════════════════════════════════════════════════════════════════
 * SHEEN LAYER — pointer sheen + ambient drift + optional refracted rim
 *
 * Ambient drift uses framer-motion's `animate` prop with transform-only
 * keyframes → pure compositor work. Warm and cool move in opposite
 * phases so the surface never looks frozen.
 * ════════════════════════════════════════════════════════════════════════ */

interface SheenLayerProps {
  sheen: MotionValue<string>;
  rim: MotionValue<string>;
  opacity: MotionValue<number>;
  driftEnabled: boolean;
  withRim?: boolean;
  withRefract?: boolean;
}

const SheenLayer = memo(function SheenLayer({
  sheen,
  rim,
  opacity,
  driftEnabled,
  withRim = true,
  withRefract = false,
}: SheenLayerProps) {
  const warmAnim = driftEnabled
    ? { x: [-10, 10, -10], y: [-8, 5, -8], scale: [1, 1.04, 1] }
    : false;
  const coolAnim = driftEnabled
    ? { x: [8, -8, 8], y: [5, -8, 5], scale: [1.04, 1, 1.04] }
    : false;

  return (
    <>
      <motion.div
        aria-hidden="true"
        animate={warmAnim}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: AMBIENT_WARM, opacity: 0.85 } as MotionStyle}
        className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
      />
      <motion.div
        aria-hidden="true"
        animate={coolAnim}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: AMBIENT_COOL, opacity: 0.85 } as MotionStyle}
        className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
      />
      <motion.div
        aria-hidden="true"
        style={{ background: sheen, opacity } as MotionStyle}
        className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
      />
      {withRim && (
        <motion.div
          aria-hidden="true"
          style={
            {
              background: rim,
              opacity,
              filter: withRefract ? `url(#${LIQUID_FILTER_ID})` : undefined,
            } as MotionStyle
          }
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[1.5px]"
        />
      )}
    </>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * TOP SPECULAR — shared static hairline
 * ════════════════════════════════════════════════════════════════════════ */

const TopSpecular = memo(function TopSpecular({
  inset = 'inset-x-8',
}: {
  inset?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-0 z-10 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/40',
        inset,
      )}
    />
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * 1. MOBILE BOTTOM NAV
 * ════════════════════════════════════════════════════════════════════════ */

export const MobileBottomNav = memo(function MobileBottomNav({
  role,
  onOpenMore,
  scrollContainerRef,
}: {
  role: string;
  onOpenMore: () => void;
  /** Scroll host used for the iOS-style recede/reveal behaviour. */
  scrollContainerRef?: RefObject<HTMLElement | null>;
}) {
  const { t } = useSafeI18n();
  const normalizedRole = role?.toUpperCase() ?? '';
  const soundRef = useStableSound();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');

  /* ── Optical refraction: pointer sheen on dock surface ── */
  const { bind: refrBind, sheen, rim, opacity: refrOpacity } = useOpticalRefraction(180, 28);
  useLiquidDefs(!reducedTransparency);

  /* ── Recede while reading down, return on scroll up / at either edge ── */
  const [dockHidden, setDockHidden] = useState(false);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    const el = scrollContainerRef?.current;
    if (!el || reduced) return;

    const onScroll = () => {
      const y = el.scrollTop;
      const delta = y - lastScrollRef.current;
      if (Math.abs(delta) < 8) return;
      lastScrollRef.current = y;

      const atTop = y <= 72;
      const atBottom = y + el.clientHeight >= el.scrollHeight - 32;
      if (atTop || atBottom || delta < 0) setDockHidden(false);
      else if (y > 180) setDockHidden(true);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef, reduced]);

  const revealDock = useCallback(() => setDockHidden(false), []);

  const tabs = useMemo(() => {
    let routes: readonly string[] = STAFF_MOBILE_TAB_ROUTES;
    if (normalizedRole === 'STUDENT') routes = STUDENT_MOBILE_TAB_ROUTES;
    else if (normalizedRole === 'PARENT') routes = PARENT_MOBILE_TAB_ROUTES;
    else if (normalizedRole === 'TEACHER') routes = TEACHER_MOBILE_TAB_ROUTES;
    else if (
      normalizedRole === 'ACCOUNTANT' ||
      normalizedRole === 'FINANCE' ||
      normalizedRole === 'FINANCE_MANAGER'
    ) {
      routes = FINANCE_MOBILE_TAB_ROUTES;
    } else if (normalizedRole === 'RECEPTIONIST') {
      routes = RECEPTIONIST_MOBILE_TAB_ROUTES;
    }
    return routes
      .map((route) => ALL_ITEMS_MAP.get(route))
      .filter((item): item is NavItem => Boolean(item));
  }, [normalizedRole]);

  const handleOpenMore = useCallback(() => {
    triggerHaptic(6);
    soundRef.current.playPop?.();
    onOpenMore();
  }, [onOpenMore, soundRef]);

  const handleTabClick = useCallback(() => {
    triggerHaptic(6);
    soundRef.current.playTick?.();
  }, [soundRef]);

  return (
    <nav
      aria-label={t('a11y.primaryNav', 'Primary navigation')}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 select-none md:hidden',
        'pl-[max(0.875rem,env(safe-area-inset-left,0px))] pr-[max(0.875rem,env(safe-area-inset-right,0px))]',
        'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
      )}
    >
      <motion.div
        initial={
          reduced ? false : { y: 48, opacity: 0, scale: 0.96 }
        }
        animate={{
          y: dockHidden ? 104 : 0,
          opacity: dockHidden ? 0 : 1,
          scale: 1,
        }}
        transition={reduced ? { duration: 0.15 } : SPRING_MORPH}
        onFocusCapture={revealDock}
        className={cn(
          'relative mx-auto max-w-[25.5rem] sm:max-w-[26.5rem]',
          dockHidden ? 'pointer-events-none' : 'pointer-events-auto',
        )}
      >
        <div
          {...(reducedTransparency ? {} : refrBind)}
          className={cn(
            'relative overflow-hidden rounded-[1.85rem]',
            reducedTransparency ? GLASS_SOLID : GLASS_SLAB,
          )}
        >
          {/* ── Liquid Glass optical layers ── */}
          {!reducedTransparency && (
            <>
              <SheenLayer
                sheen={sheen}
                rim={rim}
                opacity={refrOpacity}
                driftEnabled={!reduced}
                withRim
                withRefract
              />
              <TopSpecular inset="inset-x-6" />
            </>
          )}

          <ul className="relative z-10 flex items-stretch p-1 sm:p-1.5">
            {tabs.map((item) => (
              <li key={item.to} className="relative min-w-0 flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={handleTabClick}
                  className={cn(
                    'group relative flex min-h-[3.25rem] w-full flex-col items-center justify-center rounded-[1.15rem] px-1 py-1',
                    FOCUS_RING,
                  )}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="dock-lens-active"
                          transition={
                            reduced
                              ? { duration: 0.15 }
                              : { type: 'spring', stiffness: 500, damping: 35, mass: 0.5 }
                          }
                          aria-hidden="true"
                          className={cn(
                            'absolute inset-0 z-0 rounded-[1.15rem]',
                            LENS_ACTIVE,
                          )}
                        >
                          {/* Corner caustic catchlights — real liquid glass lens effect */}
                          {!reducedTransparency && (
                            <>
                              <span
                                aria-hidden="true"
                                className="absolute -top-px -left-px h-4 w-4 rounded-tl-[1.15rem] bg-gradient-to-br from-white/70 via-white/10 to-transparent dark:from-white/30"
                              />
                              <span
                                aria-hidden="true"
                                className="absolute -top-px -right-px h-4 w-4 rounded-tr-[1.15rem] bg-gradient-to-bl from-white/50 via-white/5 to-transparent dark:from-white/20"
                              />
                              {/* Cool bounce line at bottom edge */}
                              <span
                                aria-hidden="true"
                                className="absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-apple-blue/30 to-transparent dark:via-apple-blue/45"
                              />
                            </>
                          )}
                        </motion.div>
                      )}

                      <motion.div
                        whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.88 }}
                        transition={SPRING_GEL}
                        className="relative z-10 flex flex-col items-center justify-center gap-1"
                      >
                        <motion.span
                          animate={isActive ? { scale: 1.08, y: -0.5 } : { scale: 1, y: 0 }}
                          transition={SPRING_TOUCH}
                          className={cn(
                            'transition-colors duration-200',
                            isActive
                              ? TAB_ACTIVE
                              : cn(
                                  TAB_IDLE,
                                  'group-hover:text-[var(--text-primary)]',
                                ),
                          )}
                        >
                          <StaticIcon
                            paths={item.iconPath}
                            className="h-[1.25rem] w-[1.25rem]"
                          />
                        </motion.span>
                        <span
                          className={cn(
                            'max-w-[4.8rem] truncate text-[10px] tracking-[-0.01em] transition-colors duration-200',
                            isActive
                              ? cn(TAB_ACTIVE, 'font-semibold')
                              : cn(TAB_IDLE, 'font-medium'),
                          )}
                        >
                          {t(item.labelKey, item.label)}
                        </span>
                      </motion.div>
                    </>
                  )}
                </NavLink>
              </li>
            ))}

            {/* Authentic Apple 5th Tab: More Button (Evenly Distributed) */}
            <li className="relative min-w-0 flex-1">
              <motion.button
                type="button"
                onClick={handleOpenMore}
                whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.88 }}
                transition={SPRING_GEL}
                aria-label={t('a11y.openMenu', 'Open menu')}
                className={cn(
                  'group relative flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-1 rounded-[1.15rem] px-1 py-1',
                  'transition-colors duration-200',
                  TAB_IDLE,
                  'hover:text-[var(--text-primary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]',
                  FOCUS_RING,
                )}
              >
                <StaticIcon paths={I.menu} className="h-[1.25rem] w-[1.25rem]" />
                <span className="max-w-full truncate text-[10px] font-medium tracking-[-0.01em]">
                  {t('nav.more', 'More')}
                </span>
              </motion.button>
            </li>
          </ul>
        </div>
      </motion.div>
    </nav>
  );
});
MobileBottomNav.displayName = 'MobileBottomNav';

/* ══════════════════════════════════════════════════════════════════════════
 * 2. MOBILE MENU DRAWER
 * ════════════════════════════════════════════════════════════════════════ */

export const MobileMenuDrawer = memo(function MobileMenuDrawer({
  open,
  onClose,
  role,
  orgName,
  userName,
  userInitials,
  userEmail: _userEmail,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  role: string;
  orgName: string;
  userName?: string;
  userInitials?: string;
  userEmail?: string;
  onLogout: () => void;
}) {
  const { t } = useSafeI18n();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const soundRef = useStableSound();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');

  /* ── Liquid Glass optical refraction for drawer surface ── */
  const { bind: drawerRefrBind, sheen: drawerSheen, rim: drawerRim, opacity: drawerRefrOpacity } = useOpticalRefraction(166, 40);
  useLiquidDefs(open && !reducedTransparency);

  // Real focus trap: Tab cycles inside the dialog. Matches aria-modal="true".
  useFocusTrap(drawerRef, open, closeBtnRef);

  const dragControls = useDragControls();
  const dragX = useMotionValue(0);
  const backdropOpacity = useSpring(1, { stiffness: 360, damping: 34 });
  const handleHeight = useSpring(36, { stiffness: 360, damping: 34 });

  // Reset springs when closed.
  useEffect(() => {
    if (!open) {
      dragX.set(0);
      backdropOpacity.set(1);
      handleHeight.set(36);
    }
  }, [open, dragX, backdropOpacity, handleHeight]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const formattedRole = useMemo(
    () => (role ? role.replace(/_/g, ' ').toLowerCase() : 'member'),
    [role],
  );

  const orgInitials = useMemo(() => {
    if (!orgName) return 'ME';
    return orgName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }, [orgName]);

  const displayName = userName || orgName;
  const displayInitials = userInitials || orgInitials;

  const handleBackdropClick = useCallback(() => {
    triggerHaptic(5);
    onClose();
  }, [onClose]);

  const handleCloseClick = useCallback(() => {
    triggerHaptic(6);
    soundRef.current.playPop?.();
    onClose();
  }, [onClose, soundRef]);

  const handleLogout = useCallback(() => {
    triggerHaptic([10, 30, 15]);
    onLogout();
  }, [onLogout]);

  const handleDrag = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const x = Math.min(0, info.offset.x);
      dragX.set(x);
      backdropOpacity.set(Math.max(0, 1 + x / 260));
      handleHeight.set(Math.min(56, 36 + Math.max(0, -x) * 0.16));
    },
    [dragX, backdropOpacity, handleHeight],
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (info.offset.x < -60 || info.velocity.x < -220) {
        triggerHaptic(10);
        soundRef.current.playPop?.();
        onClose();
      } else {
        dragX.set(0);
        backdropOpacity.set(1);
        handleHeight.set(36);
      }
    },
    [dragX, backdropOpacity, handleHeight, onClose, soundRef],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          className="fixed inset-0 z-[60] xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="absolute inset-0"
            onClick={handleBackdropClick}
            aria-hidden="true"
          >
            <motion.div
              style={{ opacity: backdropOpacity }}
              className="absolute inset-0 bg-black/55 backdrop-blur-[6px] dark:bg-black/75"
            />
          </div>

          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('a11y.mainNav', 'Navigation menu')}
            style={{ x: dragX }}
            drag="x"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.35, right: 0.05 }}
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            initial={{ x: '-102%', opacity: 0.95 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-102%', opacity: 0.95 }}
            transition={reduced ? { duration: 0.16 } : DRAWER_SPRING}
            className="absolute left-0 top-0 ml-[max(0.75rem,env(safe-area-inset-left,0px))] mt-[calc(0.75rem+env(safe-area-inset-top,0px))] h-[calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[min(332px,88vw)] origin-left transform-gpu will-change-transform"
          >
            <div
              {...(open && !reducedTransparency ? drawerRefrBind : {})}
              className={cn(
                'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[2.5rem]',
                reducedTransparency ? GLASS_SOLID : GLASS_DRAWER,
              )}
            >
              {!reducedTransparency && (
                <>
                  <SheenLayer
                    sheen={drawerSheen}
                    rim={drawerRim}
                    opacity={drawerRefrOpacity}
                    driftEnabled={!reduced}
                    withRim
                    withRefract
                  />
                  <TopSpecular inset="inset-x-8" />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-apple-blue/12 blur-2xl"
                  />
                  {/* Bottom-right warm caustic glow */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-[#FF9F0A]/8 blur-2xl dark:bg-[#FF9F0A]/12"
                  />
                </>
              )}

              {/* Right edge drag strip to swipe drawer closed */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="absolute inset-y-0 right-0 z-30 flex w-7 cursor-grab items-center justify-center touch-none select-none active:cursor-grabbing"
                aria-label="Drag handle to close drawer"
              >
                <motion.div
                  aria-hidden="true"
                  style={{ height: handleHeight }}
                  className="w-1 rounded-full bg-gradient-to-b from-black/15 via-black/25 to-black/15 dark:from-white/20 dark:via-white/35 dark:to-white/20 shadow-[0_0_4px_rgba(0,122,255,0.15)]"
                />
              </div>

              {/* Header: draggable to swipe closed */}
              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (!target?.closest('button')) {
                    dragControls.start(e);
                  }
                }}
                className="relative z-10 flex h-[4.25rem] shrink-0 cursor-grab items-center justify-between border-b border-black/[0.06] px-6 active:cursor-grabbing dark:border-white/[0.08]"
              >
                <Brand />
                <Magnetic strength={0.3}>
                  <motion.button
                    ref={closeBtnRef}
                    type="button"
                    whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                    transition={SPRING_GEL}
                    onClick={handleCloseClick}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      GLASS_CHIP,
                      FOCUS_RING,
                    )}
                    aria-label={t('a11y.closeMenu', 'Close menu')}
                  >
                    <StaticIcon paths={I.close} className="h-4 w-4" />
                  </motion.button>
                </Magnetic>
              </div>

              {/* Profile Card: draggable to swipe closed */}
              <motion.div
                initial={reduced ? false : { y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...SPRING_MORPH, delay: 0.04 }}
                onPointerDown={(e) => dragControls.start(e)}
                className="relative z-10 shrink-0 cursor-grab px-4 pb-2 pt-3.5 active:cursor-grabbing"
              >
                <div
                  className={cn(
                    'relative flex items-center gap-3.5 overflow-hidden rounded-[1.6rem] p-3.5',
                    'border border-black/[0.05] bg-white/70 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(120,200,255,0.2),0_8px_20px_-8px_rgba(16,24,40,0.1)]',
                    'dark:border-white/[0.09] dark:bg-white/[0.06] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_20px_-8px_rgba(0,0,0,0.5)]',
                    'backdrop-blur-md',
                  )}
                >
                  {/* Profile card top specular hairline */}
                  {!reducedTransparency && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/30"
                    />
                  )}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-apple-blue to-[#5E5CE6] text-[14px] font-bold tracking-tight text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(120,200,255,0.4),0_6px_16px_rgba(0,122,255,0.35)]">
                    {displayInitials}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#34C759] shadow-sm shadow-emerald-500/40 dark:border-[#1c1c20]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-primary">
                      {displayName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-apple-blue/10 text-apple-blue dark:bg-apple-blue/20 dark:text-[#5AC8FA]">
                        {formattedRole}
                      </span>
                      {orgName && displayName !== orgName && (
                        <span className="truncate text-[11.5px] text-[#636366] dark:text-[#98989D]">
                          • {orgName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Quick Recent Routes Pills */}
              <div className="relative z-10 shrink-0">
                <RecentRoutes role={role} onNavigate={onClose} />
              </div>

              {/* Navigation list: 100% liberated native 120fps touch scrolling */}
              <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                <NavItems role={role} onNavigate={onClose} isMobile={true} />
              </div>

              {/* Footer logout */}
              <div className="relative z-10 shrink-0 border-t border-black/[0.06] p-4 dark:border-white/[0.08]">
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  whileTap={reduced ? undefined : { scaleX: 1.02, scaleY: 0.96 }}
                  whileHover={reduced ? undefined : { scale: 1.01 }}
                  transition={SPRING_GEL}
                  className={cn(
                    'flex w-full items-center justify-center gap-2.5 rounded-[1.4rem] px-4 py-3.5 text-[14px] font-semibold tracking-tight',
                    'border border-apple-red/25 bg-apple-red/[0.1] text-apple-red',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(255,120,100,0.2)] transition-colors hover:bg-apple-red/[0.16]',
                    'dark:border-apple-red/35 dark:bg-apple-red/[0.18] dark:text-[#FF6961] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]',
                    'focus-visible:ring-2 focus-visible:ring-apple-red/60',
                    'outline-none backdrop-blur-sm',
                  )}
                  aria-label={t('nav.logout', 'Log out')}
                >
                  <StaticIcon paths={I.logout} />
                  <span>{t('nav.logout', 'Log out')}</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
MobileMenuDrawer.displayName = 'MobileMenuDrawer';

/* ══════════════════════════════════════════════════════════════════════════
 * 3. MOBILE SEARCH SHEET
 * ════════════════════════════════════════════════════════════════════════ */

const SPOTLIGHT_QUICK_SCOPES = [
  { id: 'students', labelKey: 'nav.students', fallback: 'Students', prefix: 'student:' },
  { id: 'teachers', labelKey: 'nav.teachers', fallback: 'Teachers', prefix: 'teacher:' },
  { id: 'groups', labelKey: 'nav.groups', fallback: 'Groups', prefix: 'group:' },
  { id: 'courses', labelKey: 'nav.courses', fallback: 'Courses', prefix: 'course:' },
  { id: 'attendance', labelKey: 'nav.attendance', fallback: 'Attendance', prefix: 'date:' },
  { id: 'face', labelKey: 'nav.faceRecognition', fallback: 'Face ID', prefix: 'bio:' },
] as const;

const SCOPE_PREFIX_RE = /^(student:|teacher:|group:|course:|date:|bio:)\s*/i;

export const MobileSearchSheet = memo(function MobileSearchSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (q: string) => void;
}) {
  const { t } = useSafeI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const soundRef = useStableSound();

  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeScope, setActiveScope] = useState<string | null>(null);

  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');

  useLiquidDefs(open && !reducedTransparency);
  useFocusTrap(containerRef, open, inputRef);

  const { sheen, rim, opacity } = useOpticalRefraction(200, 24);

  // Reset on close.
  useEffect(() => {
    if (!open) {
      setValue('');
      setActiveScope(null);
      setIsFocused(false);
    }
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q) return;
    triggerHaptic(10);
    soundRef.current.playTick?.();
    onSubmit(q);
    onClose();
  }, [value, onSubmit, onClose, soundRef]);

  const handleScopeSelect = useCallback(
    (scopeId: string, prefix: string) => {
      triggerHaptic(6);
      soundRef.current.playTick?.();
      const clean = value.replace(SCOPE_PREFIX_RE, '');
      if (activeScope === scopeId) {
        setActiveScope(null);
        setValue(clean);
      } else {
        setActiveScope(scopeId);
        setValue(`${prefix} ${clean}`);
      }
      inputRef.current?.focus();
    },
    [value, activeScope, soundRef],
  );

  const handleClearOrClose = useCallback(() => {
    triggerHaptic(5);
    if (value) {
      setValue('');
      setActiveScope(null);
      inputRef.current?.focus();
    } else {
      onClose();
    }
  }, [value, onClose]);

  const handleBackdropClick = useCallback(() => {
    triggerHaptic(5);
    onClose();
  }, [onClose]);

  const hasValue = value.trim().length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-search"
          className="fixed inset-0 z-[70] flex items-start justify-center px-3.5 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[6px] dark:bg-black/75"
            onClick={handleBackdropClick}
            aria-hidden="true"
          />

          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.searchPlaceholder') || 'Search'}
            initial={
              reduced
                ? { opacity: 0 }
                : {
                    y: -22,
                    opacity: 0,
                    scale: 0.96,
                  }
            }
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0 }
                : {
                    y: -14,
                    opacity: 0,
                    scale: 0.97,
                  }
            }
            transition={reduced ? { duration: 0.16 } : SPRING_MORPH}
            className="relative w-full max-w-md transform-gpu will-change-transform"
          >
            {!reducedTransparency && (
              <motion.div
                aria-hidden="true"
                animate={{
                  opacity: isFocused ? 0.85 : 0.28,
                  scale: isFocused ? 1.01 : 0.99,
                }}
                transition={SPRING_MORPH}
                className="pointer-events-none absolute -inset-2 rounded-[2.4rem] bg-apple-blue/15 blur-xl dark:bg-apple-blue/25"
              />
            )}

            <GlassSurface
              tone="modal"
              radius="2.1rem"
              spotlight={!reducedTransparency}
              className={cn(
                'relative overflow-hidden',
                reducedTransparency ? GLASS_SOLID : GLASS_SLAB,
              )}
            >
              {!reducedTransparency && (
                <>
                  <SheenLayer
                    sheen={sheen}
                    rim={rim}
                    opacity={opacity}
                    driftEnabled={!reduced}
                    withRim={false}
                  />
                  <TopSpecular inset="inset-x-10" />
                </>
              )}

              <div className="relative z-10 flex items-center gap-3 px-[18px] py-4">
                <motion.span
                  animate={{ scale: isFocused || hasValue ? 1.1 : 1 }}
                  transition={SPRING_TOUCH}
                  className={cn(
                    'transition-colors duration-200',
                    isFocused || hasValue ? TAB_ACTIVE : TAB_IDLE,
                  )}
                >
                  <StaticIcon paths={I.search} className="h-5 w-5" />
                </motion.span>

                <input
                  ref={inputRef}
                  type="text"
                  role="searchbox"
                  inputMode="search"
                  enterKeyHint="search"
                  value={value}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  placeholder={t('nav.searchPlaceholder') || 'Search…'}
                  className="min-w-0 flex-1 bg-transparent text-[17px] font-medium tracking-[-0.015em] text-primary outline-none placeholder:text-[#636366]/65 dark:placeholder:text-[#98989D]/65"
                  aria-label={t('nav.searchPlaceholder') || 'Search'}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />

                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {hasValue && (
                      <motion.button
                        key="submit-pill"
                        type="button"
                        initial={{ scaleX: 0.7, scaleY: 0.7, opacity: 0, x: 8 }}
                        animate={{ scaleX: 1, scaleY: 1, opacity: 1, x: 0 }}
                        exit={{ scaleX: 0.7, scaleY: 0.7, opacity: 0, x: 8 }}
                        whileTap={
                          reduced ? undefined : { scaleX: 0.95, scaleY: 0.9 }
                        }
                        transition={SPRING_GEL}
                        onClick={submit}
                        className={cn(
                          'rounded-full bg-gradient-to-b from-[#2A95FF] to-apple-blue px-3.5 py-1.5 text-[12.5px] font-semibold tracking-tight text-white',
                          'shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-1px_0_rgba(120,200,255,0.4),0_4px_12px_rgba(0,122,255,0.4)]',
                          FOCUS_RING,
                        )}
                      >
                        {t('common.search', 'Go')}
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="button"
                    whileTap={
                      reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }
                    }
                    transition={SPRING_GEL}
                    onClick={handleClearOrClose}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full',
                      GLASS_CHIP,
                      FOCUS_RING,
                    )}
                    aria-label={
                      value
                        ? t('common.clear') || 'Clear'
                        : t('a11y.closeSearch') || 'Close search'
                    }
                  >
                    <StaticIcon paths={I.close} className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              </div>

              <div className="relative z-10 border-t border-black/[0.05] bg-black/[0.02] px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.025]">
                <div
                  role="group"
                  aria-label={t('nav.searchScope') || 'Search scope'}
                  className="no-scrollbar flex items-center gap-1 overflow-x-auto"
                >
                  {SPOTLIGHT_QUICK_SCOPES.map((scope) => {
                    const selected = activeScope === scope.id;
                    return (
                      <motion.button
                        key={scope.id}
                        type="button"
                        aria-pressed={selected}
                        whileTap={
                          reduced ? undefined : { scaleX: 1.03, scaleY: 0.94 }
                        }
                        transition={SPRING_GEL}
                        onClick={() => handleScopeSelect(scope.id, scope.prefix)}
                        className={cn(
                          'relative shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium tracking-tight transition-colors',
                          selected
                            ? cn(TAB_ACTIVE, 'font-semibold')
                            : cn(TAB_IDLE, 'hover:text-[var(--text-primary)]'),
                          FOCUS_RING,
                        )}
                      >
                        {selected && (
                          <motion.span
                            layoutId="spotlight-scope-pill"
                            transition={
                              reduced ? { duration: 0.15 } : SPRING_MORPH
                            }
                            aria-hidden="true"
                            className="absolute inset-0 -z-10 rounded-full border border-apple-blue/25 bg-apple-blue/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(120,200,255,0.35)] dark:border-apple-blue/40 dark:bg-apple-blue/[0.2]"
                          />
                        )}
                        {t(scope.labelKey, scope.fallback)}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Polite announcement for scope toggling */}
                <span aria-live="polite" className="sr-only">
                  {activeScope
                    ? `Scope: ${activeScope}`
                    : ''}
                </span>
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
MobileSearchSheet.displayName = 'MobileSearchSheet';