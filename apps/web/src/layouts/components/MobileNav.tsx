'use client';

/**
 * ============================================================================
 * M-EDU Mobile Navigation — v3.0 "Chromatic Liquid Glass (iOS 27 / visionOS)"
 * ============================================================================
 *
 * v2 → v3.0 Senior Architecture & Liquid Glass Upgrades:
 *  • [fix] Auto-reveal bottom dock on route change (`location.pathname`) so
 *          navigating from a scrolled page to a short page never locks the dock hidden
 *  • [fix] Smart Virtual Keyboard focus guard: ignores checkboxes/radios/buttons
 *          and debounces focus transitions to eliminate dock bounce between inputs
 *  • [fix] Active tab re-tap scrolls viewport/container smoothly back to top (iOS standard)
 *  • [fix] Scoped `<LayoutGroup>` around bottom dock for collision-free lens morphing
 *  • [fix] Isolated `MobileSearchSheet` vertical drag to its handle via `useDragControls`
 *          so horizontal scope pill scrolling never triggers accidental sheet drags
 *  • [fix] WebKit-safe zero-size SVG `<defs>` (removed `opacity: 0` culling hazard)
 *          and removed heavy SVG filter from `blur-xl` bloom layer
 *  • [fix] Safe `useBodyScrollLock` fallback so nested modals never freeze body scroll
 *  • [feat] Surfaced `userEmail` in `MobileMenuDrawer` profile card with online badge
 *  • [feat] Added persistent Recent Searches history & keyboard arrow navigation
 *           inside `MobileSearchSheet`
 *  • All exports (`SPRING_SLAB`, `MobileBottomNav`, `MobileMenuDrawer`, `MobileSearchSheet`)
 *    and TypeScript contracts 100% preserved
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
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  LayoutGroup,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useDragControls,
  type MotionValue,
  type MotionStyle,
} from 'framer-motion';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useDeviceProfile, useFocusTrap, useMediaQuery } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, Magnetic, I } from './Icons';
import { ThemeToggle } from './TopBar';
import { ALL_ITEMS_MAP, NavItems, RecentRoutes, type NavItem } from './Sidebar';
import { preloadRoute } from '@/routes/index';

/* ══════════════════════════════════════════════════════════════════════════
 * ROUTES
 * ════════════════════════════════════════════════════════════════════════ */

const STAFF_MOBILE_TAB_ROUTES = ['/', '/attendance', '/payments', '/leads'] as const;
const TEACHER_MOBILE_TAB_ROUTES = ['/attendance', '/groups', '/schedule', '/grades'] as const;
const ASSISTANT_MOBILE_TAB_ROUTES = ['/attendance', '/schedule', '/students', '/groups'] as const;
const STUDENT_MOBILE_TAB_ROUTES = ['/', '/schedule', '/attendance', '/chat'] as const;
const PARENT_MOBILE_TAB_ROUTES = [
  '/parent-portal',
  '/chat',
  '/notifications',
  '/settings',
] as const;
const FINANCE_MOBILE_TAB_ROUTES = ['/payments', '/invoices', '/expenses', '/reports'] as const;
const RECEPTIONIST_MOBILE_TAB_ROUTES = ['/', '/attendance', '/leads', '/students'] as const;
const PLATFORM_OWNER_MOBILE_TAB_ROUTES = ['/', '/users', '/reports', '/settings'] as const;

const NON_KEYBOARD_INPUT_TYPES = new Set([
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'range',
  'color',
  'file',
  'image',
  'hidden',
]);

function isVirtualKeyboardTarget(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
    return !NON_KEYBOARD_INPUT_TYPES.has(type);
  }
  return false;
}

/* ══════════════════════════════════════════════════════════════════════════
 * SPRINGS, HAPTICS & I18N GUARD
 * ════════════════════════════════════════════════════════════════════════ */

/** Shape-morphing: lens travelling between tabs, sheets arriving */
const SPRING_MORPH = {
  type: 'spring',
  stiffness: 440,
  damping: 34,
  mass: 0.68,
  restDelta: 0.001,
} as const;

/** Direct manipulation: press, release, toggles */
const SPRING_TOUCH = {
  type: 'spring',
  stiffness: 660,
  damping: 32,
  mass: 0.42,
} as const;

/** Gel: press deformation of the glass — bouncier than touch */
const SPRING_GEL = {
  type: 'spring',
  stiffness: 740,
  damping: 24,
  mass: 0.34,
} as const;

/** Large surfaces: drawer slab (Exported contract) */
export const SPRING_SLAB = {
  type: 'spring',
  stiffness: 360,
  damping: 36,
  mass: 0.85,
  restDelta: 0.001,
} as const;

/** Native-grade iOS 27 mobile drawer spring: snappy, zero stutter */
const DRAWER_SPRING = {
  type: 'spring',
  stiffness: 430,
  damping: 38,
  mass: 0.58,
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

/** Ensures empty-string translations never produce blank labels */
function tr(
  t: (key: string, fallback?: string) => string,
  key: string,
  fallback: string,
): string {
  const val = t(key, fallback);
  return typeof val === 'string' && val.trim().length > 0 ? val : fallback;
}

/* ══════════════════════════════════════════════════════════════════════════
 * BODY SCROLL LOCK — ref-counted & safe against external 'hidden' state
 * ════════════════════════════════════════════════════════════════════════ */

let scrollLockCount = 0;
let savedOverflow = '';

function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;
    if (scrollLockCount === 0) {
      const current = document.body.style.overflow;
      savedOverflow = current === 'hidden' ? '' : current;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0 && typeof document !== 'undefined') {
        document.body.style.overflow = savedOverflow;
      }
    };
  }, [locked]);
}

/* ══════════════════════════════════════════════════════════════════════════
 * LIQUID GLASS — iOS 27 CHROMATIC & REFRACTIVE SVG SINGLETON
 *
 * Uses a 0x0px offscreen SVG with color-interpolation-filters="sRGB" and
 * without `opacity: 0` so WebKit/Safari never culls the filter definition.
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
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText =
    'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;overflow:hidden;z-index:-1;';

  const defs = document.createElementNS(SVG_NS, 'defs');
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', LIQUID_FILTER_ID);
  filter.setAttribute('x', '-25%');
  filter.setAttribute('y', '-25%');
  filter.setAttribute('width', '150%');
  filter.setAttribute('height', '150%');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const turbulence = document.createElementNS(SVG_NS, 'feTurbulence');
  turbulence.setAttribute('type', 'fractalNoise');
  turbulence.setAttribute('baseFrequency', '0.012 0.024');
  turbulence.setAttribute('numOctaves', '2');
  turbulence.setAttribute('seed', '11');
  turbulence.setAttribute('result', 'noise');

  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('in', 'noise');
  blur.setAttribute('stdDeviation', '0.45');
  blur.setAttribute('result', 'softNoise');

  const displacement = document.createElementNS(SVG_NS, 'feDisplacementMap');
  displacement.setAttribute('in', 'SourceGraphic');
  displacement.setAttribute('in2', 'softNoise');
  displacement.setAttribute('scale', '4.2');
  displacement.setAttribute('xChannelSelector', 'R');
  displacement.setAttribute('yChannelSelector', 'G');
  displacement.setAttribute('result', 'refracted');

  filter.append(turbulence, blur, displacement);
  defs.append(filter);
  svg.append(defs);

  return svg;
}

function acquireLiquidDefs(): () => void {
  liquidDefsRefCount += 1;
  if (!liquidDefsElement && typeof document !== 'undefined') {
    const existing = document.getElementById(LIQUID_DEFS_ID) as SVGSVGElement | null;
    if (existing) {
      liquidDefsElement = existing;
    } else {
      liquidDefsElement = buildLiquidDefsElement();
      document.body.append(liquidDefsElement);
    }
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
 * OPTICAL REFRACTION — pointer sheen + chromatic rim, zero React re-renders
 * ════════════════════════════════════════════════════════════════════════ */

function useOpticalRefraction(initialX = 160, initialY = 30) {
  const x = useMotionValue(initialX);
  const y = useMotionValue(initialY);
  const opacity = useSpring(0, { stiffness: 280, damping: 28 });
  const sx = useSpring(x, { stiffness: 400, damping: 34, mass: 0.38 });
  const sy = useSpring(y, { stiffness: 400, damping: 34, mass: 0.38 });

  const rectRef = useRef<CachedRect | null>(null);

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

  const sheen = useMotionTemplate`radial-gradient(185px circle at ${sx}px ${sy}px, rgba(255,255,255,0.46), rgba(90,200,250,0.16) 38%, rgba(94,92,230,0.08) 62%, transparent 80%)`;
  const rim = useMotionTemplate`radial-gradient(135px circle at ${sx}px 0px, rgba(255,255,255,1), rgba(90,200,250,0.55) 45%, transparent 100%)`;

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
 * GLASS TOKENS — iOS 27 Multi-Layer Bevel & Chromatic Inner Rim
 * ════════════════════════════════════════════════════════════════════════ */

const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/70 focus-visible:ring-offset-0';

const GLASS_SLAB = cn(
  'border border-white/75 bg-white/[0.72]',
  'backdrop-blur-3xl backdrop-saturate-[220%]',
  'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.16),0_6px_20px_-2px_rgba(0,0,0,0.08),inset_0_1.5px_1px_0_rgba(255,255,255,0.98),inset_0_-1px_1px_0_rgba(0,122,255,0.08)]',
  'dark:border-white/[0.16] dark:bg-[#16161a]/[0.80]',
  'dark:shadow-[0_24px_60px_-8px_rgba(0,0,0,0.75),0_8px_24px_-2px_rgba(0,0,0,0.5),inset_0_1.5px_1px_0_rgba(255,255,255,0.25),inset_0_-1px_1px_0_rgba(90,200,250,0.12)]',
);

const GLASS_SOLID =
  'border border-black/[0.08] bg-[var(--bg-card)] dark:border-white/[0.14]';

const GLASS_DRAWER = cn(
  'border border-white/65 bg-white/[0.84]',
  'backdrop-blur-3xl backdrop-saturate-[210%]',
  'shadow-[inset_0_1.5px_0_rgba(255,255,255,0.96),inset_0_-1px_0_rgba(0,122,255,0.15),0_24px_52px_-12px_rgba(0,0,0,0.3),0_4px_16px_-4px_rgba(0,0,0,0.12)]',
  'dark:border-white/[0.16] dark:bg-[#141418]/[0.90]',
  'dark:shadow-[inset_0_1.5px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(10,132,255,0.18),0_28px_60px_-12px_rgba(0,0,0,0.75),0_6px_20px_-4px_rgba(0,0,0,0.45)]',
);

const GLASS_CHIP = cn(
  'border border-black/[0.06] bg-black/[0.045] text-secondary',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-0.5px_0_rgba(0,0,0,0.04)]',
  'dark:border-white/[0.12] dark:bg-white/[0.09] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]',
  'hover:bg-black/[0.08] dark:hover:bg-white/[0.15]',
);

const LENS_ACTIVE = cn(
  'border border-white/80 bg-white/[0.84]',
  'backdrop-blur-2xl backdrop-saturate-[210%]',
  'shadow-[0_0_20px_rgba(0,122,255,0.2),0_4px_16px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),inset_0_1.5px_1px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(0,122,255,0.18)]',
  'dark:border-white/[0.24] dark:bg-white/[0.18]',
  'dark:shadow-[0_0_24px_rgba(10,132,255,0.35),0_6px_22px_rgba(0,0,0,0.5),inset_0_1.5px_1px_rgba(255,255,255,0.4),inset_0_-1px_1px_rgba(90,200,250,0.3)]',
);

const TAB_IDLE = 'text-[#8E8E93] dark:text-[#98989D]';
const TAB_ACTIVE = 'text-[#007AFF] dark:text-[#0A84FF]';

/* ══════════════════════════════════════════════════════════════════════════
 * AMBIENT — static gradients, real motion lives in SheenLayer
 * ════════════════════════════════════════════════════════════════════════ */

const AMBIENT_WARM =
  'radial-gradient(90% 65% at 32% 16%, rgba(255,255,255,0.12), rgba(255,159,10,0.04) 45%, transparent 70%)';
const AMBIENT_COOL =
  'radial-gradient(90% 65% at 68% 84%, rgba(90,200,250,0.18), rgba(94,92,230,0.06) 50%, transparent 70%)';

/* ══════════════════════════════════════════════════════════════════════════
 * SHEEN LAYER — pointer sheen + ambient drift + refracted chromatic rim
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
  // Continuous drift is a luxury: skip it on low-power devices so the dock
  // never competes with page scrolling for the compositor.
  const profile = useDeviceProfile();
  const canDrift = driftEnabled && !profile.lowPowerMode;
  const warmAnim = canDrift
    ? { x: [-10, 10, -10], y: [-8, 5, -8], scale: [1, 1.04, 1] }
    : undefined;
  const coolAnim = canDrift
    ? { x: [8, -8, 8], y: [5, -8, 5], scale: [1.04, 1, 1.04] }
    : undefined;

  return (
    <>
      <motion.div
        aria-hidden="true"
        animate={warmAnim}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: AMBIENT_WARM, opacity: 0.88 } as MotionStyle}
        className="pointer-events-none absolute inset-0 z-0 mix-blend-soft-light dark:mix-blend-screen"
      />
      <motion.div
        aria-hidden="true"
        animate={coolAnim}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        style={{ background: AMBIENT_COOL, opacity: 0.88 } as MotionStyle}
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
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px]"
        />
      )}
    </>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * TOP SPECULAR — shared static hairline with chromatic sub-fringe
 * ════════════════════════════════════════════════════════════════════════ */

const TopSpecular = memo(function TopSpecular({
  inset = 'inset-x-8',
}: {
  inset?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute top-0 z-10', inset)}
    >
      <div className="h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/45" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-[#5AC8FA]/35 to-transparent dark:via-[#5AC8FA]/25" />
    </div>
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
  const location = useLocation();
  const normalizedRole = role?.toUpperCase() ?? '';
  const soundRef = useStableSound();
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');

  /* ── Optical refraction: pointer sheen on dock surface ── */
  const { bind: refrBind, sheen, rim, opacity: refrOpacity } = useOpticalRefraction(180, 28);
  useLiquidDefs(!reducedTransparency);

  /* ── Recede while reading down, return on scroll up / route change ── */
  const [dockHidden, setDockHidden] = useState(false);
  const lastScrollRef = useRef(0);

  // CRITICAL FIX: Always reveal the bottom dock when navigating to a new route
  useEffect(() => {
    setDockHidden(false);
    lastScrollRef.current = 0;
  }, [location.pathname]);

  // Smart Virtual Keyboard Guard: only hide dock for genuine text-input fields
  useEffect(() => {
    let blurTimer: number | undefined;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (isVirtualKeyboardTarget(target) && !target?.closest('nav')) {
        window.clearTimeout(blurTimer);
        setDockHidden(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (isVirtualKeyboardTarget(target) && !target?.closest('nav')) {
        blurTimer = window.setTimeout(() => {
          setDockHidden(false);
        }, 100);
      }
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });
    window.addEventListener('focusout', handleFocusOut, { passive: true });
    return () => {
      window.clearTimeout(blurTimer);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      setDockHidden(false);
      return;
    }

    const customEl = scrollContainerRef?.current;
    const target: HTMLElement | Window = customEl ?? window;

    const getMetrics = () => {
      if (customEl) {
        return {
          y: customEl.scrollTop,
          clientHeight: customEl.clientHeight,
          scrollHeight: customEl.scrollHeight,
        };
      }
      const doc = document.documentElement;
      return {
        y: window.scrollY || doc.scrollTop,
        clientHeight: window.innerHeight,
        scrollHeight: doc.scrollHeight,
      };
    };

    const onScroll = () => {
      const { y, clientHeight, scrollHeight } = getMetrics();
      const delta = y - lastScrollRef.current;
      if (Math.abs(delta) < 8) return;
      lastScrollRef.current = y;

      const atTop = y <= 72;
      const atBottom = y + clientHeight >= scrollHeight - 36;
      if (atTop || atBottom || delta < 0) setDockHidden(false);
      else if (y > 180) setDockHidden(true);
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [scrollContainerRef, reduced]);

  const revealDock = useCallback(() => setDockHidden(false), []);

  const tabs = useMemo(() => {
    let routes: readonly string[] = STAFF_MOBILE_TAB_ROUTES;
    if (normalizedRole === 'STUDENT') routes = STUDENT_MOBILE_TAB_ROUTES;
    else if (normalizedRole === 'PARENT') routes = PARENT_MOBILE_TAB_ROUTES;
    else if (normalizedRole === 'TEACHER') routes = TEACHER_MOBILE_TAB_ROUTES;
    else if (normalizedRole === 'ASSISTANT') routes = ASSISTANT_MOBILE_TAB_ROUTES;
    else if (normalizedRole === 'PLATFORM_OWNER') routes = PLATFORM_OWNER_MOBILE_TAB_ROUTES;
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

  const isTabActive = useMemo(() => {
    const current = location.pathname;
    return tabs.some((item) =>
      item.end ? current === item.to : current === item.to || current.startsWith(`${item.to}/`),
    );
  }, [tabs, location.pathname]);

  const handleOpenMore = useCallback(() => {
    triggerHaptic(6);
    soundRef.current.playPop?.();
    onOpenMore();
  }, [onOpenMore, soundRef]);

  // iOS Standard: Re-tapping the currently active tab scrolls smoothly to the top
  const handleTabClick = useCallback(
    (item: NavItem) => {
      triggerHaptic(6);
      soundRef.current.playTick?.();
      const current = location.pathname;
      const alreadyActive = item.end
        ? current === item.to
        : current === item.to || current.startsWith(`${item.to}/`);

      if (alreadyActive) {
        const customEl = scrollContainerRef?.current;
        if (customEl) {
          customEl.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        } else if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
        }
      }
    },
    [location.pathname, scrollContainerRef, reduced, soundRef],
  );

  return (
    <>
      {/* Bottom scrim — fades with the dock, no full-width backdrop blur */}
      <motion.div
        aria-hidden="true"
        animate={{ opacity: dockHidden ? 0 : 1 }}
        transition={reduced ? { duration: 0 } : { duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-24 select-none bg-gradient-to-t from-[var(--bg-app,#090d16)]/80 via-[var(--bg-app,#090d16)]/25 to-transparent md:hidden"
      />

      <nav
        aria-label={tr(t, 'a11y.primaryNav', 'Primary navigation')}
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 z-40 select-none md:hidden',
          'pl-[max(0.875rem,env(safe-area-inset-left,0px))] pr-[max(0.875rem,env(safe-area-inset-right,0px))]',
          'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
        )}
      >
        <motion.div
          initial={reduced ? false : { y: 48, opacity: 0, scale: 0.96 }}
          animate={{
            y: dockHidden ? 104 : 0,
            opacity: dockHidden ? 0 : 1,
            scale: dockHidden ? 0.96 : 1,
          }}
          transition={reduced ? { duration: 0.15 } : SPRING_MORPH}
          onFocusCapture={revealDock}
          className={cn(
            'relative mx-auto max-w-[25.5rem] transform-gpu will-change-transform sm:max-w-[26.5rem]',
            dockHidden ? 'pointer-events-none' : 'pointer-events-auto',
          )}
        >
          <div
            {...(reducedTransparency ? {} : refrBind)}
            className={cn(
              'relative overflow-hidden rounded-full',
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
                  withRefract={false}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-8 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/35"
                />
                <TopSpecular inset="inset-x-8" />
              </>
            )}

            <LayoutGroup id="medu-mobile-bottom-dock">
              <ul className="relative z-10 flex items-stretch p-1 sm:p-1.5">
                {tabs.map((item) => (
                  <li key={item.to} className="relative min-w-0 flex-1">
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onTouchStart={() => preloadRoute(item.to)}
                      onMouseEnter={() => preloadRoute(item.to)}
                      onClick={() => handleTabClick(item)}
                      className={cn(
                        'group relative flex min-h-[3.25rem] w-full touch-manipulation flex-col items-center justify-center rounded-full px-1 py-1',
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
                                  : { type: 'spring', stiffness: 420, damping: 30, mass: 0.65 }
                              }
                              aria-hidden="true"
                              className={cn(
                                'absolute inset-0.5 z-0 overflow-hidden rounded-full',
                                LENS_ACTIVE,
                              )}
                            >
                              {!reducedTransparency && (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-2.5 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/80"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -left-1 top-0 h-3 w-4 rounded-full bg-gradient-to-br from-white/90 via-[#5AC8FA]/40 to-transparent blur-[1px] dark:from-white/50 dark:via-[#5AC8FA]/30"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -right-1 top-0 h-3 w-4 rounded-full bg-gradient-to-bl from-[#5E5CE6]/40 via-white/40 to-transparent blur-[1px] dark:from-[#5E5CE6]/30 dark:via-white/20"
                                  />
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-x-3.5 bottom-0 h-[1px] rounded-full bg-gradient-to-r from-transparent via-apple-blue/50 to-transparent dark:via-[#5AC8FA]/60"
                                  />
                                </>
                              )}
                            </motion.div>
                          )}

                          <motion.div
                            whileTap={reduced ? undefined : { scale: 0.92 }}
                            transition={SPRING_TOUCH}
                            className="relative z-10 flex flex-col items-center justify-center gap-1"
                          >
                            <motion.span
                              animate={
                                isActive ? { scale: [0.92, 1.15, 1], y: -1 } : { scale: 1, y: 0 }
                              }
                              transition={
                                reduced
                                  ? { duration: 0.1 }
                                  : { type: 'spring', stiffness: 500, damping: 25 }
                              }
                              className={cn(
                                'transition-colors duration-200',
                                isActive
                                  ? TAB_ACTIVE
                                  : cn(TAB_IDLE, 'group-hover:text-primary'),
                              )}
                            >
                              <StaticIcon
                                paths={item.iconPath}
                                className="h-[1.25rem] w-[1.25rem]"
                              />
                            </motion.span>
                            <span
                              className={cn(
                                'max-w-[4.8rem] truncate text-[10.5px] leading-none tracking-[-0.012em] transition-colors duration-200',
                                isActive
                                  ? cn(TAB_ACTIVE, 'font-semibold')
                                  : cn(TAB_IDLE, 'font-medium'),
                              )}
                            >
                              {tr(t, item.labelKey, item.label)}
                            </span>
                          </motion.div>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}

                {/* Authentic Apple 5th Tab: More Button */}
                <li className="relative min-w-0 flex-1">
                  <motion.button
                    type="button"
                    onClick={handleOpenMore}
                    whileTap={reduced ? undefined : { scale: 0.92 }}
                    transition={SPRING_TOUCH}
                    aria-label={tr(t, 'a11y.openMenu', 'Open menu')}
                    aria-haspopup="dialog"
                    className={cn(
                      'group relative flex min-h-[3.25rem] w-full touch-manipulation flex-col items-center justify-center rounded-full px-1 py-1',
                      'transition-colors duration-200',
                      !isTabActive ? TAB_ACTIVE : TAB_IDLE,
                      'hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]',
                      FOCUS_RING,
                    )}
                  >
                    {!isTabActive && (
                      <motion.div
                        layoutId="dock-lens-active"
                        transition={
                          reduced
                            ? { duration: 0.15 }
                            : { type: 'spring', stiffness: 420, damping: 30, mass: 0.65 }
                        }
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-0.5 z-0 overflow-hidden rounded-full',
                          LENS_ACTIVE,
                        )}
                      >
                        {!reducedTransparency && (
                          <>
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-2.5 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/80"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute -left-1 top-0 h-3 w-4 rounded-full bg-gradient-to-br from-white/90 via-[#5AC8FA]/40 to-transparent blur-[1px] dark:from-white/50 dark:via-[#5AC8FA]/30"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute -right-1 top-0 h-3 w-4 rounded-full bg-gradient-to-bl from-[#5E5CE6]/40 via-white/40 to-transparent blur-[1px] dark:from-[#5E5CE6]/30 dark:via-white/20"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-x-3.5 bottom-0 h-[1px] rounded-full bg-gradient-to-r from-transparent via-apple-blue/50 to-transparent dark:via-[#5AC8FA]/60"
                            />
                          </>
                        )}
                      </motion.div>
                    )}

                    {!isTabActive && (
                      <span
                        aria-hidden="true"
                        className="absolute right-2.5 top-1.5 z-20 h-1.5 w-1.5 rounded-full bg-apple-blue shadow-[0_0_6px_rgba(0,122,255,0.85)]"
                      />
                    )}

                    <div className="relative z-10 flex flex-col items-center justify-center gap-1">
                      <motion.span
                        animate={
                          !isTabActive ? { scale: [0.92, 1.15, 1], y: -1 } : { scale: 1, y: 0 }
                        }
                        transition={
                          reduced
                            ? { duration: 0.1 }
                            : { type: 'spring', stiffness: 500, damping: 25 }
                        }
                        className={cn(
                          'transition-colors duration-200',
                          !isTabActive ? TAB_ACTIVE : TAB_IDLE,
                        )}
                      >
                        <StaticIcon paths={I.menu} className="h-[1.25rem] w-[1.25rem]" />
                      </motion.span>
                      <span
                        className={cn(
                          'max-w-full truncate text-[10.5px] leading-none tracking-[-0.012em] transition-colors',
                          !isTabActive ? cn(TAB_ACTIVE, 'font-semibold') : 'font-medium',
                        )}
                      >
                        {tr(t, 'nav.more', 'More')}
                      </span>
                    </div>
                  </motion.button>
                </li>
              </ul>
            </LayoutGroup>
          </div>
        </motion.div>
      </nav>
    </>
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
  userEmail,
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

  const {
    bind: drawerRefrBind,
    sheen: drawerSheen,
    rim: drawerRim,
    opacity: drawerRefrOpacity,
  } = useOpticalRefraction(166, 40);

  // Keep the filter alive for the whole lifetime so exit animations never
  // lose their definition mid-flight.
  useLiquidDefs(!reducedTransparency);
  useFocusTrap(drawerRef, open, closeBtnRef);
  useBodyScrollLock(open);

  const dragControls = useDragControls();
  const dragOffset = useMotionValue(0);

  const backdropOpacity = useTransform(dragOffset, [-280, 0], [0, 1]);
  const handleHeight = useTransform(dragOffset, [-180, 0, 60], [58, 36, 44]);
  const slabScaleX = useTransform(dragOffset, [-240, 0, 80], [0.97, 1, 1.02]);
  const slabScaleY = useTransform(dragOffset, [-240, 0, 80], [1.012, 1, 0.992]);
  const edgeCausticOpacity = useTransform(dragOffset, [-180, -10, 0, 60], [0.95, 0.25, 0, 0.65]);

  const smoothScaleX = useSpring(slabScaleX, SPRING_GEL);
  const smoothScaleY = useSpring(slabScaleY, SPRING_GEL);
  const smoothHandleHeight = useSpring(handleHeight, { stiffness: 380, damping: 30 });

  useEffect(() => {
    if (open) {
      dragOffset.set(0);
    }
  }, [open, dragOffset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
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
      .map((w) => Array.from(w)[0]?.toUpperCase() ?? '')
      .join('');
  }, [orgName]);

  const displayName = userName || orgName;
  const displayInitials = userInitials || orgInitials;
  const secondaryMeta = userEmail || (orgName && displayName !== orgName ? orgName : '');

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
    (_: unknown, info: { offset: { x: number } }) => {
      dragOffset.set(info.offset.x);
    },
    [dragOffset],
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (info.offset.x < -64 || info.velocity.x < -240) {
        triggerHaptic(10);
        soundRef.current.playPop?.();
        onClose();
      } else {
        dragOffset.set(0);
      }
    },
    [dragOffset, onClose, soundRef],
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
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="absolute inset-0"
            onClick={handleBackdropClick}
            aria-hidden="true"
          >
            <motion.div
              style={{ opacity: backdropOpacity }}
              className="absolute inset-0 bg-black/55 backdrop-blur-[8px] dark:bg-black/75"
            />
          </div>

          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={tr(t, 'a11y.mainNav', 'Navigation menu')}
            drag="x"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ left: -340, right: 0 }}
            dragElastic={{ left: 0.08, right: 0.06 }}
            dragSnapToOrigin
            onDrag={handleDrag}
            onDragEnd={handleDragEnd}
            style={
              reduced
                ? undefined
                : ({
                    scaleX: smoothScaleX,
                    scaleY: smoothScaleY,
                  } as MotionStyle)
            }
            initial={{ x: '-104%', opacity: 0.92 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-104%', opacity: 0.92 }}
            transition={reduced ? { duration: 0.16 } : DRAWER_SPRING}
            className="absolute left-0 top-0 ml-[max(0.75rem,env(safe-area-inset-left,0px))] mt-[calc(0.75rem+env(safe-area-inset-top,0px))] h-[calc(100dvh-1.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[min(338px,88vw)] origin-left transform-gpu will-change-transform"
          >
            <div
              {...(open && !reducedTransparency ? drawerRefrBind : {})}
              className={cn(
                'relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem]',
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
                    withRefract={false}
                  />
                  <TopSpecular inset="inset-x-8" />

                  <motion.div
                    aria-hidden="true"
                    style={
                      {
                        opacity: edgeCausticOpacity,
                        filter: `url(#${LIQUID_FILTER_ID})`,
                      } as MotionStyle
                    }
                    className="pointer-events-none absolute inset-y-6 right-0 z-20 w-[3px] bg-gradient-to-b from-transparent via-[#5AC8FA] to-transparent shadow-[0_0_16px_2px_rgba(90,200,250,0.65)]"
                  />

                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-12 -top-12 h-44 w-44 rounded-full bg-apple-blue/12 blur-2xl"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-[#FF9F0A]/10 blur-2xl dark:bg-[#FF9F0A]/14"
                  />
                </>
              )}

              {/* Right edge drag strip to swipe drawer closed */}
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="absolute inset-y-0 right-0 z-30 flex w-5 touch-none select-none cursor-grab items-center justify-center active:cursor-grabbing"
                aria-hidden="true"
              >
                <motion.div
                  aria-hidden="true"
                  style={{ height: smoothHandleHeight }}
                  className="w-1 rounded-full bg-gradient-to-b from-black/15 via-black/30 to-black/15 shadow-[0_0_6px_rgba(0,122,255,0.2)] dark:from-white/20 dark:via-white/40 dark:to-white/20"
                />
              </div>

              {/* Header: draggable to swipe closed */}
              <div
                onPointerDown={(e) => {
                  const target = e.target as HTMLElement | null;
                  if (!target?.closest('button, a')) {
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
                    whileTap={reduced ? undefined : { scaleX: 1.08, scaleY: 0.9 }}
                    transition={SPRING_GEL}
                    onClick={handleCloseClick}
                    className={cn(
                      'flex h-11 min-h-[44px] w-11 min-w-[44px] touch-manipulation items-center justify-center rounded-full sm:h-9 sm:min-h-[36px] sm:w-9 sm:min-w-[36px]',
                      GLASS_CHIP,
                      FOCUS_RING,
                    )}
                    aria-label={tr(t, 'a11y.closeMenu', 'Close menu')}
                  >
                    <StaticIcon paths={I.close} className="h-4 w-4" />
                  </motion.button>
                </Magnetic>
              </div>

              {/* Profile Card: surfaces userName, role, orgName AND userEmail */}
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
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="inline-flex shrink-0 items-center rounded-full bg-apple-blue/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-apple-blue dark:bg-apple-blue/20 dark:text-[#5AC8FA]">
                        {formattedRole}
                      </span>
                      {secondaryMeta && (
                        <span
                          className="truncate text-[11.5px] text-[#636366] dark:text-[#98989D]"
                          title={secondaryMeta}
                        >
                          • {secondaryMeta}
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

              {/* Navigation list: native 120fps touch scrolling */}
              <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                <NavItems role={role} onNavigate={onClose} isMobile={true} />
              </div>

              {/* Preferences Strip: Theme & Language */}
              <div className="relative z-10 flex shrink-0 items-center justify-between gap-2 border-t border-black/[0.06] px-4 py-2.5 dark:border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-medium text-tertiary">
                    {tr(t, 'a11y.themeSelection', 'Theme')}
                  </span>
                  <ThemeToggle size="sm" />
                </div>
                <div className="flex items-center gap-1.5">
                  <LanguageSwitcher variant="pill" showBadge />
                </div>
              </div>

              {/* Footer logout */}
              <div className="relative z-10 shrink-0 p-4 pt-1">
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  whileTap={reduced ? undefined : { scaleX: 1.03, scaleY: 0.95 }}
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
                  aria-label={tr(t, 'nav.logout', 'Log out')}
                >
                  <StaticIcon paths={I.logout} />
                  <span>{tr(t, 'nav.logout', 'Log out')}</span>
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
 * 3. MOBILE SEARCH SHEET (With Handle-Only Drag & Recent Searches History)
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
const RECENT_SEARCHES_KEY = 'medu:mobile-recent-searches:v1';
const MAX_RECENT_SEARCHES = 5;

function detectScopeFromValue(val: string): string | null {
  const match = val.match(SCOPE_PREFIX_RE);
  if (!match) return null;
  const rawPrefix = match[1].toLowerCase();
  const found = SPOTLIGHT_QUICK_SCOPES.find((s) => s.prefix === rawPrefix);
  return found ? found.id : null;
}

function readRecentSearches(): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(items: string[]): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)));
  } catch {
    /* ignore quota errors */
  }
}

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
  const sheetDragControls = useDragControls();

  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readRecentSearches());
  const [selectedRecentIdx, setSelectedRecentIdx] = useState<number>(-1);

  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');

  // Keep the filter alive for the whole lifetime so exit animations never
  // lose their definition mid-flight.
  useLiquidDefs(!reducedTransparency);
  useFocusTrap(containerRef, open, inputRef);
  useBodyScrollLock(open);

  const { bind: searchRefrBind, sheen, rim, opacity } = useOpticalRefraction(200, 24);

  useEffect(() => {
    if (open) {
      setRecentSearches(readRecentSearches());
      setSelectedRecentIdx(-1);
    } else {
      setValue('');
      setActiveScope(null);
      setIsFocused(false);
      setSelectedRecentIdx(-1);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const cleanQuery = useMemo(() => value.replace(SCOPE_PREFIX_RE, '').trim(), [value]);
  const hasSubmittableQuery = cleanQuery.length > 0;
  const hasAnyText = value.trim().length > 0;

  const commitSearch = useCallback(
    (rawQuery: string) => {
      const q = rawQuery.trim();
      const stripped = q.replace(SCOPE_PREFIX_RE, '').trim();
      if (!q || !stripped) return;
      triggerHaptic(10);
      soundRef.current.playTick?.();

      const nextRecent = [q, ...recentSearches.filter((item) => item !== q)].slice(
        0,
        MAX_RECENT_SEARCHES,
      );
      setRecentSearches(nextRecent);
      saveRecentSearches(nextRecent);

      onSubmit(q);
      onClose();
    },
    [recentSearches, onSubmit, onClose, soundRef],
  );

  const submit = useCallback(() => {
    commitSearch(value);
  }, [commitSearch, value]);

  const handleInputChange = useCallback((nextVal: string) => {
    setValue(nextVal);
    setSelectedRecentIdx(-1);
    setActiveScope(detectScopeFromValue(nextVal));
  }, []);

  const handleInputKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedRecentIdx >= 0 && recentSearches[selectedRecentIdx]) {
          commitSearch(recentSearches[selectedRecentIdx]);
        } else {
          submit();
        }
      } else if (e.key === 'ArrowDown' && recentSearches.length > 0) {
        e.preventDefault();
        setSelectedRecentIdx((i) => Math.min(recentSearches.length - 1, i + 1));
      } else if (e.key === 'ArrowUp' && recentSearches.length > 0) {
        e.preventDefault();
        setSelectedRecentIdx((i) => Math.max(-1, i - 1));
      }
    },
    [selectedRecentIdx, recentSearches, commitSearch, submit],
  );

  const handleScopeSelect = useCallback(
    (scopeId: string, prefix: string) => {
      triggerHaptic(6);
      soundRef.current.playTick?.();
      const stripped = value.replace(SCOPE_PREFIX_RE, '');
      if (activeScope === scopeId) {
        setActiveScope(null);
        setValue(stripped);
      } else {
        setActiveScope(scopeId);
        setValue(`${prefix} ${stripped}`);
      }
      inputRef.current?.focus();
    },
    [value, activeScope, soundRef],
  );

  const handleRemoveRecent = useCallback(
    (itemToRemove: string) => {
      triggerHaptic(5);
      const updated = recentSearches.filter((item) => item !== itemToRemove);
      setRecentSearches(updated);
      saveRecentSearches(updated);
    },
    [recentSearches],
  );

  const handleClearAllRecent = useCallback(() => {
    triggerHaptic(6);
    setRecentSearches([]);
    saveRecentSearches([]);
  }, []);

  const handleClearOrClose = useCallback(() => {
    triggerHaptic(5);
    if (value) {
      setValue('');
      setActiveScope(null);
      setSelectedRecentIdx(-1);
      inputRef.current?.focus();
    } else {
      onClose();
    }
  }, [value, onClose]);

  const handleBackdropClick = useCallback(() => {
    triggerHaptic(5);
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-search"
          className="fixed inset-0 z-[70] flex items-start justify-center px-3.5 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[8px] dark:bg-black/75"
            onClick={handleBackdropClick}
            aria-hidden="true"
          />

          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={tr(t, 'nav.searchPlaceholder', 'Search')}
            drag="y"
            dragControls={sheetDragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 60 || info.velocity.y > 220) {
                triggerHaptic(8);
                soundRef.current.playPop?.();
                onClose();
              }
            }}
            initial={
              reduced
                ? { opacity: 0 }
                : {
                    y: -24,
                    opacity: 0,
                    scale: 0.95,
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
            className="relative w-full max-w-md transform-gpu"
          >
            {/* iOS 27 Drag Handle Indicator — isolated drag trigger */}
            <div
              onPointerDown={(e) => sheetDragControls.start(e)}
              className="flex w-full touch-none select-none cursor-grab items-center justify-center pb-2 pt-0.5 active:cursor-grabbing"
              aria-label={tr(t, 'a11y.dragToClose', 'Drag handle to close drawer')}
            >
              <div className="h-1.5 w-10 rounded-full bg-white/45 shadow-[0_1px_4px_rgba(0,0,0,0.3)] backdrop-blur-sm dark:bg-white/35" />
            </div>

            {/* GPU-Safe Focus Bloom (no SVG displacement filter on blur-xl layer) */}
            {!reducedTransparency && (
              <motion.div
                aria-hidden="true"
                animate={{
                  opacity: isFocused ? 0.9 : 0.3,
                  scale: isFocused ? 1.015 : 0.99,
                }}
                transition={SPRING_MORPH}
                className="pointer-events-none absolute -inset-2 rounded-[2.4rem] bg-gradient-to-r from-apple-blue/20 via-[#5AC8FA]/20 to-[#5E5CE6]/20 blur-xl dark:from-apple-blue/30 dark:via-[#5AC8FA]/25 dark:to-[#5E5CE6]/30"
              />
            )}

            <div {...(reducedTransparency ? {} : searchRefrBind)}>
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
                      withRim
                      withRefract={false}
                    />
                    <TopSpecular inset="inset-x-10" />
                  </>
                )}

                <div className="relative z-10 flex items-center gap-3 px-[18px] py-4">
                  <motion.span
                    animate={{ scale: isFocused || hasAnyText ? 1.1 : 1 }}
                    transition={SPRING_TOUCH}
                    className={cn(
                      'transition-colors duration-200',
                      isFocused || hasAnyText ? TAB_ACTIVE : TAB_IDLE,
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
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={tr(t, 'nav.searchPlaceholder', 'Search…')}
                    className="min-w-0 flex-1 bg-transparent text-[17px] font-medium tracking-[-0.015em] text-primary outline-none placeholder:text-[#636366]/65 dark:placeholder:text-[#98989D]/65"
                    aria-label={tr(t, 'nav.searchPlaceholder', 'Search')}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />

                  <div className="flex items-center gap-2">
                    <AnimatePresence mode="wait">
                      {hasSubmittableQuery && (
                        <motion.button
                          key="submit-pill"
                          type="button"
                          initial={{ scaleX: 0.7, scaleY: 0.7, opacity: 0, x: 8 }}
                          animate={{ scaleX: 1, scaleY: 1, opacity: 1, x: 0 }}
                          exit={{ scaleX: 0.7, scaleY: 0.7, opacity: 0, x: 8 }}
                          whileTap={
                            reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }
                          }
                          transition={SPRING_GEL}
                          onClick={submit}
                          className={cn(
                            'inline-flex min-h-[44px] touch-manipulation items-center justify-center rounded-full bg-gradient-to-b from-[#2A95FF] to-apple-blue px-4 py-2 text-[12.5px] font-semibold tracking-tight text-white sm:min-h-[36px]',
                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(120,200,255,0.4),0_4px_12px_rgba(0,122,255,0.4)]',
                            FOCUS_RING,
                          )}
                        >
                          {tr(t, 'common.search', 'Go')}
                        </motion.button>
                      )}
                    </AnimatePresence>

                    <motion.button
                      type="button"
                      whileTap={
                        reduced ? undefined : { scaleX: 1.08, scaleY: 0.9 }
                      }
                      transition={SPRING_GEL}
                      onClick={handleClearOrClose}
                      className={cn(
                        'flex h-11 min-h-[44px] w-11 min-w-[44px] touch-manipulation items-center justify-center rounded-full sm:h-7 sm:min-h-[28px] sm:w-7 sm:min-w-[28px]',
                        GLASS_CHIP,
                        FOCUS_RING,
                      )}
                      aria-label={
                        value
                          ? tr(t, 'common.clear', 'Clear')
                          : tr(t, 'a11y.closeSearch', 'Close search')
                      }
                    >
                      <StaticIcon paths={I.close} className="h-3.5 w-3.5" />
                    </motion.button>
                  </div>
                </div>

                {/* Quick Scope Filter Pills */}
                <div className="relative z-10 border-t border-black/[0.05] bg-black/[0.02] px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.025]">
                  <LayoutGroup id="spotlight-scopes">
                    <div
                      role="group"
                      aria-label={tr(t, 'nav.searchScope', 'Search scope')}
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
                              reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }
                            }
                            transition={SPRING_GEL}
                            onClick={() => handleScopeSelect(scope.id, scope.prefix)}
                            className={cn(
                              'relative inline-flex min-h-[40px] shrink-0 touch-manipulation items-center rounded-full px-3.5 py-1.5 text-[12px] font-medium tracking-tight transition-colors sm:min-h-[34px]',
                              selected
                                ? cn(TAB_ACTIVE, 'font-semibold')
                                : cn(TAB_IDLE, 'hover:text-primary'),
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
                                className="absolute inset-0 -z-10 rounded-full border border-apple-blue/30 bg-apple-blue/[0.13] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(120,200,255,0.35)] dark:border-apple-blue/45 dark:bg-apple-blue/[0.22]"
                              />
                            )}
                            {tr(t, scope.labelKey, scope.fallback)}
                          </motion.button>
                        );
                      })}
                    </div>
                  </LayoutGroup>

                  <span aria-live="polite" className="sr-only">
                    {activeScope ? `Active search scope: ${activeScope}` : ''}
                  </span>
                </div>

                {/* Recent Searches History Section */}
                {recentSearches.length > 0 && (
                  <div className="relative z-10 border-t border-black/[0.05] px-4 py-3 dark:border-white/[0.07]">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#8E8E93]">
                        {tr(t, 'nav.recentSearches', 'Recent searches')}
                      </span>
                      <button
                        type="button"
                        onClick={handleClearAllRecent}
                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-apple-blue transition-opacity hover:opacity-80"
                      >
                        {tr(t, 'common.clear', 'Clear')}
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {recentSearches.map((item, idx) => {
                        const isHighlighted = idx === selectedRecentIdx;
                        return (
                          <li
                            key={item}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 transition-colors',
                              isHighlighted
                                ? 'bg-apple-blue/12 text-apple-blue'
                                : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.05]',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => commitSearch(item)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-[13.5px] font-medium text-primary"
                            >
                              <StaticIcon
                                paths={I.search}
                                className="h-3.5 w-3.5 shrink-0 opacity-50"
                              />
                              <span className="truncate">{item}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveRecent(item)}
                              aria-label={`Remove ${item}`}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8E8E93] transition-colors hover:bg-black/[0.06] hover:text-primary dark:hover:bg-white/[0.08]"
                            >
                              <StaticIcon paths={I.close} className="h-3 w-3" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </GlassSurface>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
MobileSearchSheet.displayName = 'MobileSearchSheet';
