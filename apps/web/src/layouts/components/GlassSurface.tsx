/**
 * M-EDU Layout GlassSurface — v12 "Liquid Optical Engine"
 * VisionOS & iOS 18 inspired multi-layered refractive liquid glass.
 * Zero-rerender pointer tracking, masked specular border rims, chromatic
 * edge refraction, directional light sheen, and tactile liquid ripples.
 */
import {
  memo,
  useRef,
  useCallback,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useDeviceProfile, usePrefersReducedMotion } from '../core/singletons';

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

/** Tone → optical liquid surface tokens (tuned for Apple vibrancy & saturation). */
export const GLASS_TONE: Record<GlassTone, GlassToneConfig> = {
  default: {
    blur: 24, sat: 190, brightness: 103,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.68))',
    bgDark: 'var(--glass-surface-bg, rgba(24, 24, 28, 0.68))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #18181b)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.55))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.14))',
    ambient: '0, 122, 255', ambientDark: '10, 132, 255', sheen: 0.22,
  },
  topbar: {
    blur: 28, sat: 200, brightness: 104,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.72))',
    bgDark: 'var(--glass-surface-bg, rgba(20, 20, 24, 0.72))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #141418)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.65))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.16))',
    ambient: '0, 122, 255', ambientDark: '10, 132, 255', sheen: 0.26,
  },
  sidebar: {
    blur: 32, sat: 195, brightness: 102,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.74))',
    bgDark: 'var(--glass-surface-bg, rgba(22, 22, 26, 0.75))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #16161a)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.6))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.14))',
    ambient: '0, 122, 255', ambientDark: '10, 132, 255', sheen: 0.20,
  },
  modal: {
    blur: 36, sat: 210, brightness: 105,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.78))',
    bgDark: 'var(--glass-surface-bg, rgba(28, 28, 32, 0.80))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1c1c20)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.75))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.20))',
    ambient: '0, 122, 255', ambientDark: '10, 132, 255', sheen: 0.30,
  },
  panel: {
    blur: 20, sat: 180, brightness: 101,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.62))',
    bgDark: 'var(--glass-surface-bg, rgba(28, 28, 32, 0.60))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1c1c20)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.45))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.12))',
    ambient: '0, 122, 255', ambientDark: '10, 132, 255', sheen: 0.16,
  },
  command: {
    blur: 40, sat: 220, brightness: 106,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.82))',
    bgDark: 'var(--glass-surface-bg, rgba(24, 24, 28, 0.84))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #18181c)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.8))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.22))',
    ambient: '94, 92, 230', ambientDark: '94, 92, 230', sheen: 0.32,
  },
  popover: {
    blur: 28, sat: 200, brightness: 104,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.76))',
    bgDark: 'var(--glass-surface-bg, rgba(30, 30, 36, 0.78))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1e1e24)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.65))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.18))',
    ambient: '0, 122, 255', ambientDark: '10, 132, 255', sheen: 0.24,
  },
};

/** Multi-layered Apple optical elevation + inner glass thickness bevels. */
const TONE_ELEVATION: Record<GlassTone, string> = {
  default:
    'shadow-[0_10px_32px_-6px_rgba(0,0,0,0.08),0_2px_6px_rgba(0,0,0,0.03),inset_0_1px_1px_rgba(255,255,255,0.75),inset_0_-1px_1.5px_rgba(0,0,0,0.03)] dark:shadow-[0_14px_40px_-8px_rgba(0,0,0,0.55),inset_0_1px_0.5px_rgba(255,255,255,0.20),inset_0_-1px_2px_rgba(0,0,0,0.45)]',
  topbar:
    'shadow-[0_12px_36px_-8px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_1.5px_rgba(255,255,255,0.85),inset_0_-1px_1.5px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_44px_-8px_rgba(0,0,0,0.68),inset_0_1px_0.5px_rgba(255,255,255,0.22),inset_0_-1px_2px_rgba(0,0,0,0.5)]',
  sidebar:
    'border-r border-subtle shadow-[16px_0_48px_-12px_rgba(0,0,0,0.09),inset_0_1px_1.5px_rgba(255,255,255,0.8),inset_-1px_0_1px_rgba(255,255,255,0.45)] dark:shadow-[20px_0_56px_-12px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.2),inset_-1px_0_0.5px_rgba(255,255,255,0.1)]',
  modal:
    'shadow-[0_24px_64px_-12px_rgba(0,0,0,0.22),0_4px_16px_rgba(0,0,0,0.06),inset_0_1.5px_2px_rgba(255,255,255,0.92),inset_0_-1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_28px_72px_-12px_rgba(0,0,0,0.82),inset_0_1px_1px_rgba(255,255,255,0.26),inset_0_-1px_2px_rgba(0,0,0,0.6)]',
  panel:
    'shadow-[0_6px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.65)] dark:shadow-[0_8px_28px_-6px_rgba(0,0,0,0.45),inset_0_1px_0.5px_rgba(255,255,255,0.15)]',
  command:
    'shadow-[0_28px_80px_-12px_rgba(0,0,0,0.26),0_0_1px_1px_rgba(255,255,255,0.4),inset_0_1.5px_2px_rgba(255,255,255,0.95)] dark:shadow-[0_32px_88px_-12px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.28)]',
  popover:
    'shadow-[0_16px_44px_-8px_rgba(0,0,0,0.15),0_2px_10px_rgba(0,0,0,0.05),inset_0_1px_1.5px_rgba(255,255,255,0.88)] dark:shadow-[0_20px_52px_-8px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.24)]',
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
    'shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.45)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)]',
  default:
    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.75),inset_1px_0_1px_rgba(0,122,255,0.08),inset_-1px_-1px_1.5px_rgba(94,92,230,0.08)] dark:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.24),inset_1px_0_1.5px_rgba(10,132,255,0.16),inset_-1px_-1px_2px_rgba(94,92,230,0.14)]',
  strong:
    'shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.95),inset_1.5px_0_3px_rgba(0,122,255,0.16),inset_-1.5px_-1.5px_3px_rgba(175,82,222,0.14)] dark:shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.35),inset_1.5px_0_3px_rgba(10,132,255,0.26),inset_-1.5px_-1.5px_3px_rgba(191,90,242,0.22)]',
};

/** Ultra-fine tactile acrylic noise (Data URI SVG, zero network cost, zero feTurbulence). */
const LIQUID_NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100%25' height='100%25' fill='none'/%3E%3Ccircle cx='60' cy='60' r='0.75' fill='%23ffffff' opacity='0.035'/%3E%3C/svg%3E\")";

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
  ...rest
}: GlassSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const rippleRef = useRef<HTMLSpanElement | null>(null);
  const cfg = GLASS_TONE[tone];
  const reduced = usePrefersReducedMotion();
  const profile = useDeviceProfile();
  const isLowPower = Boolean(profile.lowPowerMode);

  const canParallax = parallax && !reduced && !isLowPower && profile.hoverCapable;
  const canSpotlight = spotlight && !isLowPower;
  const canEdgeLight = edgeLight && !isLowPower;
  const isInteractive = canSpotlight || canEdgeLight || canParallax;

  /** Zero-rerender 120fps pointer tracking via direct CSS custom properties */
  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerMove?.(e);
      if (!isInteractive || !surfaceRef.current) return;

      const el = surfaceRef.current;
      const rect = el.getBoundingClientRect();
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
    [isInteractive, canParallax, onPointerMove],
  );

  const handlePointerEnter = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerEnter?.(e);
      if (!isInteractive || !surfaceRef.current) return;
      surfaceRef.current.style.setProperty('--glass-spot-opacity', '1');
    },
    [isInteractive, onPointerEnter],
  );

  const handlePointerLeave = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerLeave?.(e);
      if (!isInteractive || !surfaceRef.current) return;
      const el = surfaceRef.current;
      el.style.setProperty('--glass-spot-opacity', '0');
      if (canParallax) {
        el.style.setProperty('--glass-rx', '0deg');
        el.style.setProperty('--glass-ry', '0deg');
      }
    },
    [isInteractive, canParallax, onPointerLeave],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      onPointerDown?.(e);
      if (!ripple || reduced || isLowPower || !surfaceRef.current || !rippleRef.current) return;

      const rect = surfaceRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rippleEl = rippleRef.current;

      rippleEl.style.left = `${x}px`;
      rippleEl.style.top = `${y}px`;
      rippleEl.getAnimations().forEach((anim) => anim.cancel());
      rippleEl.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.1)', opacity: 0.45 },
          { transform: 'translate(-50%, -50%) scale(3.2)', opacity: 0 },
        ],
        {
          duration: 650,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        },
      );
    },
    [ripple, reduced, isLowPower, onPointerDown],
  );

  const mergedStyle: CSSProperties = {
    borderRadius: radius,
    '--glass-mx': '50%',
    '--glass-my': '0px',
    '--glass-spot-opacity': '0',
    '--glass-ambient': cfg.ambient,
    '--glass-sheen-alpha': cfg.sheen,
    '--glass-light-angle': LIGHT_GRADIENT_ANGLE[light],
    backdropFilter: `blur(${cfg.blur}px) saturate(${cfg.sat}%) brightness(${cfg.brightness}%)`,
    WebkitBackdropFilter: `blur(${cfg.blur}px) saturate(${cfg.sat}%) brightness(${cfg.brightness}%)`,
    ...(canParallax
      ? {
          transform:
            'perspective(1100px) rotateX(var(--glass-rx, 0deg)) rotateY(var(--glass-ry, 0deg))',
          transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }
      : undefined),
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={surfaceRef}
      onPointerMove={isInteractive ? handlePointerMove : onPointerMove}
      onPointerEnter={isInteractive ? handlePointerEnter : onPointerEnter}
      onPointerLeave={isInteractive ? handlePointerLeave : onPointerLeave}
      onPointerDown={ripple ? handlePointerDown : onPointerDown}
      className={cn(
        'group/glass relative overflow-hidden',
        'bg-[var(--glass-surface-bg,rgba(255,255,255,0.68))] dark:bg-[var(--glass-surface-bg,rgba(24,24,28,0.72))]',
        'border border-black/[0.08] dark:border-white/[0.12]',
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
      {sheen && (
        <span
          aria-hidden="true"
          style={{
            background: `linear-gradient(var(--glass-light-angle, 135deg), rgba(255,255,255, calc(var(--glass-sheen-alpha, 0.2) * 1.15)) 0%, rgba(255,255,255, 0.03) 42%, transparent 75%)`,
          }}
          className="pointer-events-none absolute inset-0 z-0 opacity-90 dark:opacity-30"
        />
      )}

      {/* 2. Ambient Chromatic Liquid Wash */}
      {ambient && (
        <span
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 0%, rgba(var(--glass-ambient), 0.10), transparent 70%)',
          }}
          className="pointer-events-none absolute inset-0 z-0 dark:opacity-150"
        />
      )}

      {/* 3. Optical Chromatic Edge Refraction & Inner Bevel Lens */}
      {refraction !== 'off' && (
        <span
          aria-hidden="true"
          style={{ borderRadius: 'inherit' }}
          className={cn(
            'pointer-events-none absolute inset-0 z-0',
            REFRACTION_STYLES[refraction],
          )}
        />
      )}

      {/* 4. Interactive Liquid Caustic Spotlight (Follows Cursor / Touch) */}
      {spotlight && (
        <span
          aria-hidden="true"
          style={{
            opacity: 'var(--glass-spot-opacity, 0)',
            background:
              'radial-gradient(360px circle at var(--glass-mx, 50%) var(--glass-my, 0px), rgba(255, 255, 255, 0.32), rgba(var(--glass-ambient), 0.07) 45%, transparent 75%)',
          }}
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500 ease-out dark:mix-blend-screen"
        />
      )}

      {/* 5. Specular 1px Edge-Light Rim (Masked strictly to the border) */}
      {edgeLight && (
        <span
          aria-hidden="true"
          style={{
            borderRadius: 'inherit',
            padding: '1px',
            opacity: 'var(--glass-spot-opacity, 0)',
            background:
              'radial-gradient(240px circle at var(--glass-mx, 50%) var(--glass-my, 0px), rgba(255, 255, 255, 0.95), rgba(var(--glass-ambient), 0.45) 45%, transparent 75%)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ease-out"
        />
      )}

      {/* 6. Top Specular Rim Crest (Apple VisionOS Window Top Highlight) */}
      {sheen && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 top-0 z-10 h-[1px] bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/30"
        />
      )}

      {/* 7. Tactile Frosted Acrylic Micro-Noise */}
      {noise && (
        <span
          aria-hidden="true"
          style={{ backgroundImage: LIQUID_NOISE_DATA_URI }}
          className="pointer-events-none absolute inset-0 z-0 mix-blend-overlay"
        />
      )}

      {/* 8. Tactile Liquid Ripple Wave */}
      {ripple && (
        <span
          ref={rippleRef}
          aria-hidden="true"
          className="pointer-events-none absolute z-0 h-28 w-28 rounded-full bg-gradient-to-tr from-white/50 via-[#007AFF]/20 to-white/60 opacity-0 blur-[2px] dark:from-white/30 dark:via-[#0A84FF]/30 dark:to-white/40"
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