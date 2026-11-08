'use client';

/**
 * ============================================================================
 * M-EDU Layout GlassSurface — iOS 27 / visionOS "Liquid Optical Engine"
 * ============================================================================
 *
 * True Liquid Glass Architecture:
 *  • Full GLASS_TONE token binding (light/dark bg, edge, ambient & opaque modes)
 *  • Cached bounding-rect geometry — zero layout thrashing on 120fps pointermove
 *  • Unified Touch + Pointer caustic spotlight & masked chromatic border rim
 *  • Dual specular crest + bottom meniscus bounce line for convex lens depth
 *  • Strict prefers-reduced-transparency solid surface fallback
 *  • Isolated blend context so inner children never clash with optical layers
 * ============================================================================
 */

import {
  memo,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  useDeviceProfile,
  usePrefersReducedMotion,
  useMediaQuery,
} from '../core/singletons';

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type GlassTone =
  | 'default'
  | 'topbar'
  | 'sidebar'
  | 'modal'
  | 'panel'
  | 'command'
  | 'popover';

export type LightSource =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right';

export type RefractionIntensity = 'off' | 'subtle' | 'default' | 'strong';

export interface GlassToneConfig {
  blur: number;
  sat: number;
  brightness: number;
  bg: string;
  bgDark: string;
  /** Fully opaque fallback used when `prefers-reduced-transparency: reduce`. */
  bgOpaque: string;
  bgOpaqueDark: string;
  edge: string;
  edgeDark: string;
  ambient: string;
  ambientDark: string;
  sheen: number;
}

/** Tone -> optical liquid surface tokens (tuned for iOS 27 vibrancy & dispersion). */
export const GLASS_TONE: Record<GlassTone, GlassToneConfig> = {
  default: {
    blur: 24,
    sat: 195,
    brightness: 103,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.68))',
    bgDark: 'var(--glass-surface-bg, rgba(22, 22, 26, 0.70))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #18181b)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.62))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.15))',
    ambient: '0, 122, 255',
    ambientDark: '10, 132, 255',
    sheen: 0.22,
  },
  topbar: {
    blur: 28,
    sat: 205,
    brightness: 104,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.74))',
    bgDark: 'var(--glass-surface-bg, rgba(18, 18, 22, 0.74))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #141418)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.68))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.17))',
    ambient: '0, 122, 255',
    ambientDark: '10, 132, 255',
    sheen: 0.26,
  },
  sidebar: {
    blur: 32,
    sat: 200,
    brightness: 102,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.75))',
    bgDark: 'var(--glass-surface-bg, rgba(20, 20, 24, 0.76))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #16161a)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.64))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.15))',
    ambient: '0, 122, 255',
    ambientDark: '10, 132, 255',
    sheen: 0.20,
  },
  modal: {
    blur: 36,
    sat: 215,
    brightness: 105,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.80))',
    bgDark: 'var(--glass-surface-bg, rgba(24, 24, 28, 0.82))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1c1c20)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.78))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.22))',
    ambient: '0, 122, 255',
    ambientDark: '90, 200, 250',
    sheen: 0.30,
  },
  panel: {
    blur: 20,
    sat: 185,
    brightness: 101,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.62))',
    bgDark: 'var(--glass-surface-bg, rgba(26, 26, 30, 0.62))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1c1c20)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.48))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.13))',
    ambient: '0, 122, 255',
    ambientDark: '10, 132, 255',
    sheen: 0.16,
  },
  command: {
    blur: 40,
    sat: 225,
    brightness: 106,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.84))',
    bgDark: 'var(--glass-surface-bg, rgba(22, 22, 26, 0.86))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #18181c)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.82))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.24))',
    ambient: '94, 92, 230',
    ambientDark: '94, 92, 230',
    sheen: 0.32,
  },
  popover: {
    blur: 28,
    sat: 205,
    brightness: 104,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.78))',
    bgDark: 'var(--glass-surface-bg, rgba(28, 28, 34, 0.80))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1e1e24)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.68))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.19))',
    ambient: '0, 122, 255',
    ambientDark: '10, 132, 255',
    sheen: 0.24,
  },
};

/** Multi-layered Apple optical elevation + inner glass thickness bevels. */
const TONE_ELEVATION: Record<GlassTone, string> = {
  default:
    'shadow-[0_10px_32px_-6px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.78),inset_0_-1px_1.5px_rgba(0,0,0,0.03)] dark:shadow-[0_14px_40px_-8px_rgba(0,0,0,0.58),inset_0_1px_0.5px_rgba(255,255,255,0.22),inset_0_-1px_2px_rgba(0,0,0,0.45)]',
  topbar:
    'shadow-[0_12px_36px_-8px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.88),inset_0_-1px_1.5px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_44px_-8px_rgba(0,0,0,0.68),inset_0_1px_0.5px_rgba(255,255,255,0.24),inset_0_-1px_2px_rgba(0,0,0,0.5)]',
  sidebar:
    'border-r shadow-[16px_0_48px_-12px_rgba(0,0,0,0.09),inset_0_1px_1.5px_rgba(255,255,255,0.82),inset_-1px_0_1px_rgba(255,255,255,0.45)] dark:shadow-[20px_0_56px_-12px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.22),inset_-1px_0_0.5px_rgba(255,255,255,0.12)]',
  modal:
    'shadow-[0_24px_64px_-12px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.06),inset_0_1.5px_2px_rgba(255,255,255,0.94),inset_0_-1px_2px_rgba(0,122,255,0.08)] dark:shadow-[0_28px_72px_-12px_rgba(0,0,0,0.82),inset_0_1px_1px_rgba(255,255,255,0.28),inset_0_-1px_2px_rgba(10,132,255,0.16)]',
  panel:
    'shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.68)] dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45),inset_0_1px_0.5px_rgba(255,255,255,0.16)]',
  command:
    'shadow-[0_28px_80px_-12px_rgba(0,0,0,0.26),0_0_1px_1px_rgba(255,255,255,0.42),inset_0_1.5px_2px_rgba(255,255,255,0.96),inset_0_-1px_2px_rgba(94,92,230,0.12)] dark:shadow-[0_32px_88px_-12px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.30),inset_0_-1px_2px_rgba(94,92,230,0.22)]',
  popover:
    'shadow-[0_16px_44px_-8px_rgba(0,0,0,0.15),0_2px_10px_rgba(0,0,0,0.05),inset_0_1px_1.5px_rgba(255,255,255,0.90)] dark:shadow-[0_20px_52px_-8px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.25)]',
};

/** Virtual light source angles for liquid surface reflection. */
const LIGHT_GRADIENT_ANGLE: Record<LightSource, string> = {
  'top-left': '135deg',
  'top': '180deg',
  'top-right': '225deg',
  'left': '90deg',
  'right': '270deg',
  'bottom-left': '45deg',
  'bottom': '0deg',
  'bottom-right': '315deg',
};

/** Chromatic & bevel edge refraction intensity presets. */
const REFRACTION_STYLES: Record<RefractionIntensity, string> = {
  off: '',
  subtle:
    'shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.48)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.14)]',
  default:
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.78),inset_1px_0_1.5px_rgba(0,122,255,0.10),inset_-1px_-1px_1.5px_rgba(94,92,230,0.10)] dark:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.26),inset_1px_0_1.5px_rgba(90,200,250,0.18),inset_-1px_-1px_2px_rgba(94,92,230,0.16)]',
  strong:
    'shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.96),inset_1.5px_0_3px_rgba(0,122,255,0.18),inset_-1.5px_-1.5px_3px_rgba(175,82,222,0.16)] dark:shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.38),inset_1.5px_0_3px_rgba(90,200,250,0.28),inset_-1.5px_-1.5px_3px_rgba(191,90,242,0.24)]',
};

/** Ultra-fine tactile acrylic noise (Data URI SVG, zero network cost, zero feTurbulence). */
const LIQUID_NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='none'/%3E%3Ccircle cx='60' cy='60' r='0.75' fill='%23ffffff' opacity='0.035'/%3E%3C/svg%3E\")";

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

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** CSS border-radius applied to the surface. */
  radius?: string;
  /** Interactive cursor/touch liquid caustic spotlight. Default true. */
  spotlight?: boolean;
  /** Dynamic 1px specular border rim that illuminates near the pointer. Default true. */
  edgeLight?: boolean;
  /** Renders top & directional specular light reflection. Default true. */
  sheen?: boolean;
  /** Subtle ambient chromatic aura wash inside the glass. Default false. */
  ambient?: boolean;
  tone?: GlassTone;
  /** Ultra-fine frosted acrylic micro-texture. Default false. */
  noise?: boolean;
  /** Virtual light source direction for liquid surface sheen. Default 'top-left'. */
  light?: LightSource;
  /** Optical edge refraction & prismatic bevel depth. Default 'default'. */
  refraction?: RefractionIntensity;
  /** Gentle 3D spatial tilt response on pointer move. Default false. */
  parallax?: boolean;
  /** Tactile liquid wave pulse on pointer down. Default false. */
  ripple?: boolean;
}

/* ─────────────────────────────────────────────────────────────
 * GlassSurface Component
 * ───────────────────────────────────────────────────────────── */

export const GlassSurface = memo(function GlassSurface({
  children,
  className = '',
  radius = '2rem',
  spotlight = true,
  edgeLight = true,
  sheen = true,
  ambient = false,
  tone = 'default',
  noise = false,
  light = 'top-left',
  refraction = 'default',
  parallax = false,
  ripple = false,
  style,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  onPointerDown,
  onPointerUp,
  onPointerCancel,
  ...rest
}: GlassSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const rippleRef = useRef<HTMLSpanElement | null>(null);
  const rectRef = useRef<CachedRect | null>(null);

  const cfg = GLASS_TONE[tone];
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const profile = useDeviceProfile();
  const isLowPower = Boolean(profile.lowPowerMode);

  // Touch and desktop both get interactive liquid light unless reduced-transparency or low-power is active
  const canParallax =
    parallax && !reduced && !reducedTransparency && !isLowPower && Boolean(profile.hoverCapable);
  const canSpotlight = spotlight && !reducedTransparency && !isLowPower;
  const canEdgeLight = edgeLight && !reducedTransparency && !isLowPower;
  const canSheen = sheen && !reducedTransparency;
  const canAmbient = ambient && !reducedTransparency;
  const canRefraction = refraction !== 'off' && !reducedTransparency;
  const canNoise = noise && !reducedTransparency;
  const canRipple = ripple && !reduced && !reducedTransparency && !isLowPower;
  const isInteractive = canSpotlight || canEdgeLight || canParallax;

  // Invalidate cached bounding rect on scroll or resize so pointer tracking never causes layout thrashing
  useEffect(() => {
    if (!isInteractive) return;
    const invalidate = () => {
      rectRef.current = null;
    };
    window.addEventListener('scroll', invalidate, { passive: true, capture: true });
    window.addEventListener('resize', invalidate, { passive: true });
    return () => {
      window.removeEventListener('scroll', invalidate, true);
      window.removeEventListener('resize', invalidate);
    };
  }, [isInteractive]);

  const updatePointerCoords = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = surfaceRef.current;
      if (!el) return;
      if (!rectRef.current) rectRef.current = readRect(el);
      const rect = rectRef.current;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      el.style.setProperty('--glass-mx', `${x}px`);
      el.style.setProperty('--glass-my', `${y}px`);
      el.style.setProperty('--glass-spot-opacity', '1');

      if (canParallax && rect.width > 0 && rect.height > 0) {
        const nx = (x / rect.width - 0.5) * 2;
        const ny = (y / rect.height - 0.5) * 2;
        el.style.setProperty('--glass-rx', `${(-ny * 1.6).toFixed(2)}deg`);
        el.style.setProperty('--glass-ry', `${(nx * 1.6).toFixed(2)}deg`);
      }
    },
    [canParallax],
  );

  const releasePointer = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return;
    el.style.setProperty('--glass-spot-opacity', '0');
    if (canParallax) {
      el.style.setProperty('--glass-rx', '0deg');
      el.style.setProperty('--glass-ry', '0deg');
    }
  }, [canParallax]);

  const handlePointerEnter = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerEnter?.(e);
      if (!isInteractive || !surfaceRef.current) return;
      rectRef.current = readRect(surfaceRef.current);
      updatePointerCoords(e);
    },
    [isInteractive, updatePointerCoords, onPointerEnter],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e);
      if (!isInteractive) return;
      updatePointerCoords(e);
    },
    [isInteractive, updatePointerCoords, onPointerMove],
  );

  const handlePointerLeave = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(e);
      if (!isInteractive) return;
      releasePointer();
    },
    [isInteractive, releasePointer, onPointerLeave],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      if (isInteractive && surfaceRef.current) {
        rectRef.current = readRect(surfaceRef.current);
        updatePointerCoords(e);
      }
      if (!canRipple || !surfaceRef.current || !rippleRef.current) return;

      if (!rectRef.current) rectRef.current = readRect(surfaceRef.current);
      const rect = rectRef.current;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rippleEl = rippleRef.current;

      rippleEl.style.left = `${x}px`;
      rippleEl.style.top = `${y}px`;
      rippleEl.getAnimations().forEach((anim) => anim.cancel());
      rippleEl.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.12)', opacity: 0.48 },
          { transform: 'translate(-50%, -50%) scale(3.4)', opacity: 0 },
        ],
        {
          duration: 640,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
    },
    [isInteractive, canRipple, updatePointerCoords, onPointerDown],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerUp?.(e);
      if (isInteractive && e.pointerType !== 'mouse') {
        releasePointer();
      }
    },
    [isInteractive, releasePointer, onPointerUp],
  );

  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerCancel?.(e);
      if (isInteractive) {
        releasePointer();
      }
    },
    [isInteractive, releasePointer, onPointerCancel],
  );

  const effectiveBlur = (() => {
    if (reducedTransparency || profile.glassTier === 'minimal') return 0;
    if (profile.glassTier === 'balanced') return Math.min(cfg.blur, 18);
    if (profile.isMobile) return Math.min(cfg.blur, 26);
    return cfg.blur;
  })();

  const filterVal =
    effectiveBlur > 0
      ? `blur(${effectiveBlur}px) saturate(${cfg.sat}%) brightness(${cfg.brightness}%)`
      : 'none';

  const mergedStyle: CSSProperties = {
    borderRadius: radius,
    '--glass-mx': '50%',
    '--glass-my': '0px',
    '--glass-spot-opacity': '0',
    '--glass-bg-light': reducedTransparency ? cfg.bgOpaque : cfg.bg,
    '--glass-bg-dark': reducedTransparency ? cfg.bgOpaqueDark : cfg.bgDark,
    '--glass-edge-light': reducedTransparency ? 'rgba(0, 0, 0, 0.08)' : cfg.edge,
    '--glass-edge-dark': reducedTransparency ? 'rgba(255, 255, 255, 0.14)' : cfg.edgeDark,
    '--glass-ambient-light': cfg.ambient,
    '--glass-ambient-dark': cfg.ambientDark,
    '--glass-sheen-alpha': cfg.sheen,
    '--glass-light-angle': LIGHT_GRADIENT_ANGLE[light],
    backdropFilter: filterVal,
    WebkitBackdropFilter: filterVal,
    ...(canParallax
      ? {
          transform:
            'perspective(1100px) rotateX(var(--glass-rx, 0deg)) rotateY(var(--glass-ry, 0deg))',
          transition:
            'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 300ms ease-out, border-color 300ms ease-out, background-color 300ms ease-out',
        }
      : undefined),
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={surfaceRef}
      onPointerEnter={isInteractive ? handlePointerEnter : onPointerEnter}
      onPointerMove={isInteractive ? handlePointerMove : onPointerMove}
      onPointerLeave={isInteractive ? handlePointerLeave : onPointerLeave}
      onPointerDown={isInteractive || canRipple ? handlePointerDown : onPointerDown}
      onPointerUp={isInteractive ? handlePointerUp : onPointerUp}
      onPointerCancel={isInteractive ? handlePointerCancel : onPointerCancel}
      className={cn(
        'group/glass relative isolate overflow-hidden',
        '[--glass-ambient:var(--glass-ambient-light)] dark:[--glass-ambient:var(--glass-ambient-dark)]',
        'bg-[var(--glass-bg-light)] dark:bg-[var(--glass-bg-dark)]',
        'border border-[var(--glass-edge-light)] dark:border-[var(--glass-edge-dark)]',
        'transition-[box-shadow,border-color,background-color] duration-300 ease-out',
        TONE_ELEVATION[tone],
        className,
      )}
      style={mergedStyle}
      data-glass-tone={tone}
      data-glass-refraction={refraction}
      {...rest}
    >
      {/* 1. Directional Liquid Glass Gradient Wash (Virtual Light Source) */}
      {canSheen && (
        <span
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(var(--glass-light-angle, 135deg), rgba(255,255,255, calc(var(--glass-sheen-alpha, 0.2) * 1.18)) 0%, rgba(255,255,255, 0.035) 42%, transparent 75%)',
          }}
          className="pointer-events-none absolute inset-0 -z-10 opacity-90 dark:opacity-35"
        />
      )}

      {/* 2. Ambient Chromatic Liquid Wash */}
      {canAmbient && (
        <span
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 0%, rgba(var(--glass-ambient), 0.14), transparent 72%)',
          }}
          className="pointer-events-none absolute inset-0 -z-10 opacity-85 dark:opacity-100"
        />
      )}

      {/* 3. Optical Chromatic Edge Refraction & Inner Bevel Lens */}
      {canRefraction && (
        <span
          aria-hidden="true"
          style={{ borderRadius: 'inherit' }}
          className={cn(
            'pointer-events-none absolute inset-0 -z-10',
            REFRACTION_STYLES[refraction],
          )}
        />
      )}

      {/* 4. Interactive Liquid Caustic Spotlight (Follows Cursor & Touch) */}
      {canSpotlight && (
        <span
          aria-hidden="true"
          style={{
            opacity: 'var(--glass-spot-opacity, 0)',
            background:
              'radial-gradient(340px circle at var(--glass-mx, 50%) var(--glass-my, 0px), rgba(255, 255, 255, 0.36), rgba(var(--glass-ambient), 0.10) 42%, rgba(94, 92, 230, 0.04) 65%, transparent 80%)',
          }}
          className="pointer-events-none absolute inset-0 -z-10 transition-opacity duration-500 ease-out dark:mix-blend-screen"
        />
      )}

      {/* 5. Specular 1px Chromatic Edge-Light Rim (Masked strictly to the border) */}
      {canEdgeLight && (
        <span
          aria-hidden="true"
          style={{
            borderRadius: 'inherit',
            padding: '1px',
            opacity: 'var(--glass-spot-opacity, 0)',
            background:
              'radial-gradient(240px circle at var(--glass-mx, 50%) var(--glass-my, 0px), rgba(255, 255, 255, 0.98), rgba(var(--glass-ambient), 0.52) 44%, rgba(94, 92, 230, 0.25) 68%, transparent 82%)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ease-out"
        />
      )}

      {/* 6. Top Specular Rim Crest & Bottom Meniscus Bounce (iOS 27 Lens Profile) */}
      {canSheen && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 bottom-0 z-10 h-[0.5px] bg-gradient-to-r from-transparent via-[rgba(var(--glass-ambient),0.28)] to-transparent dark:via-[rgba(var(--glass-ambient),0.38)]"
          />
        </>
      )}

      {/* 7. Tactile Frosted Acrylic Micro-Noise */}
      {canNoise && (
        <span
          aria-hidden="true"
          style={{ backgroundImage: LIQUID_NOISE_DATA_URI }}
          className="pointer-events-none absolute inset-0 -z-10 mix-blend-overlay"
        />
      )}

      {/* 8. Tactile Liquid Ripple Wave */}
      {canRipple && (
        <span
          ref={rippleRef}
          aria-hidden="true"
          className="pointer-events-none absolute -z-10 h-28 w-28 rounded-full bg-gradient-to-tr from-white/55 via-[#007AFF]/25 to-white/65 opacity-0 blur-[2px] dark:from-white/35 dark:via-[#0A84FF]/35 dark:to-white/45"
        />
      )}

      {/* Surface Content */}
      {children}
    </div>
  );
});

GlassSurface.displayName = 'GlassSurface';

/* ─────────────────────────────────────────────────────────────
 * Hook
 * ───────────────────────────────────────────────────────────── */

export function useGlassTone(tone: GlassTone): GlassToneConfig {
  return GLASS_TONE[tone];
}
