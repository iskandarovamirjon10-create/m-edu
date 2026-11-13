'use client';

/**
 * ============================================================================
 * M-EDU Layout GlassSurface — true Liquid Glass material
 * ============================================================================
 *
 * The public API is unchanged (`GlassSurface`, `GLASS_TONE`, `useGlassTone`,
 * `GlassTone`, `LightSource`, `RefractionIntensity`), but the surface is no
 * longer a glassmorphic blur + coloured tint. It composes the `lgx` material:
 *
 *   · edge refraction        Chromium renders a real displacement lens at the
 *                            rim; other engines keep the blur chain.
 *   · thickness              stacked bevels: crest, side walls, meniscus.
 *   · specular               a highlight that follows pointer / thumb / gyro.
 *   · dispersion             neutral at rest; spectral fringe only in motion.
 *   · adaptive tint          sampled from the colour actually behind it.
 *   · physics                press gel, ripple, scroll and gyroscope response.
 *
 * No decorative blue/purple washes are applied. Depth comes from light and
 * geometry, not from colour.
 * ============================================================================
 */

import {
  memo,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  useDeviceProfile,
  usePrefersReducedMotion,
  useMediaQuery,
} from '../core/singletons';
import {
  useAdaptiveGlassTint,
  useLiquidGlassPhysics,
} from '../core/useLiquidGlass';
import {
  supportsBackdropRefraction,
  useLiquidGlassLens,
} from '../core/liquidGlassOptics';

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

/**
 * Tone presets. Colour fields remain for backward compatibility with callers
 * that read the config, but the rendered material is always neutral.
 */
export const GLASS_TONE: Record<GlassTone, GlassToneConfig> = {
  default: {
    blur: 20,
    sat: 170,
    brightness: 103,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.28))',
    bgDark: 'var(--glass-surface-bg, rgba(22, 22, 26, 0.34))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #18181b)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.38))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.16))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.2,
  },
  topbar: {
    blur: 18,
    sat: 165,
    brightness: 103,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.3))',
    bgDark: 'var(--glass-surface-bg, rgba(18, 18, 22, 0.36))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #141418)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.4))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.17))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.24,
  },
  sidebar: {
    blur: 22,
    sat: 165,
    brightness: 102,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.3))',
    bgDark: 'var(--glass-surface-bg, rgba(20, 20, 24, 0.38))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #16161a)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.36))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.15))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.18,
  },
  modal: {
    blur: 26,
    sat: 180,
    brightness: 104,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.38))',
    bgDark: 'var(--glass-surface-bg, rgba(24, 24, 28, 0.44))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1c1c20)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.46))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.2))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.26,
  },
  panel: {
    blur: 16,
    sat: 160,
    brightness: 101,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.24))',
    bgDark: 'var(--glass-surface-bg, rgba(26, 26, 30, 0.3))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1c1c20)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.3))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.13))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.14,
  },
  command: {
    blur: 30,
    sat: 185,
    brightness: 105,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.42))',
    bgDark: 'var(--glass-surface-bg, rgba(22, 22, 26, 0.48))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #18181c)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.5))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.22))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.28,
  },
  popover: {
    blur: 20,
    sat: 170,
    brightness: 103,
    bg: 'var(--glass-surface-bg, rgba(255, 255, 255, 0.36))',
    bgDark: 'var(--glass-surface-bg, rgba(28, 28, 34, 0.42))',
    bgOpaque: 'var(--bg-card, #ffffff)',
    bgOpaqueDark: 'var(--bg-card, #1e1e24)',
    edge: 'var(--border-subtle, rgba(255, 255, 255, 0.4))',
    edgeDark: 'var(--border-subtle, rgba(255, 255, 255, 0.18))',
    ambient: '128, 128, 128',
    ambientDark: '128, 128, 128',
    sheen: 0.22,
  },
};

/** Virtual light source angles for the specular wash. */
const LIGHT_GRADIENT_ANGLE: Record<LightSource, string> = {
  'top-left': '135deg',
  top: '180deg',
  'top-right': '225deg',
  left: '90deg',
  right: '270deg',
  'bottom-left': '45deg',
  bottom: '0deg',
  'bottom-right': '315deg',
};

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** CSS border-radius applied to the surface. */
  radius?: string;
  /** Interactive specular tracking. Default true. */
  spotlight?: boolean;
  /** Neutral specular rim. Default true. */
  edgeLight?: boolean;
  /** Renders the moving specular crest. Default true. */
  sheen?: boolean;
  /** Retained for API compatibility (neutral ambient is part of the depth layer). */
  ambient?: boolean;
  tone?: GlassTone;
  /** Ultra-fine frosted micro-texture. Default false. */
  noise?: boolean;
  /** Virtual light source direction. Default 'top-left'. */
  light?: LightSource;
  /** Optical edge refraction. Default 'default'. */
  refraction?: RefractionIntensity;
  /** Gentle 3D tilt response on pointer move. Default false. */
  parallax?: boolean;
  /** Tactile gel press + ripple. Default false. */
  ripple?: boolean;
  /** Gyroscope response (coarse pointers). Default false. */
  gyro?: boolean;
}

/* ─────────────────────────────────────────────────────────────
 * GlassSurface
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
  gyro = false,
  style,
  ...rest
}: GlassSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const cfg = GLASS_TONE[tone];
  const reduced = usePrefersReducedMotion();
  const reducedTransparency = useMediaQuery('(prefers-reduced-transparency: reduce)');
  const profile = useDeviceProfile();
  const isLowPower = Boolean(profile.lowPowerMode);

  const canRefract =
    refraction !== 'off' &&
    !reducedTransparency &&
    !isLowPower &&
    supportsBackdropRefraction();

  const canSheen = sheen && !reducedTransparency;
  const canRim = edgeLight && !reducedTransparency;
  const canNoise = noise && !reducedTransparency;
  const canParallax = parallax && !reduced && !reducedTransparency && !isLowPower;
  const canRipple = ripple && !reduced && !reducedTransparency && !isLowPower;
  const canInteract = spotlight || canParallax || canRipple || gyro;

  useLiquidGlassLens(surfaceRef, {
    enabled: canRefract,
    refraction:
      refraction === 'subtle' ? 0.7 : refraction === 'strong' ? 1.35 : 1,
  });
  useLiquidGlassPhysics(surfaceRef, {
    enabled: canInteract && !reducedTransparency,
    tilt: canParallax,
    press: canRipple,
    gyro,
    scrollMotion: canParallax || canRipple || gyro,
  });
  useAdaptiveGlassTint(surfaceRef, { enabled: !reducedTransparency });

  const effectiveBlur =
    reducedTransparency || profile.glassTier === 'minimal'
      ? 0
      : profile.glassTier === 'balanced'
        ? Math.min(cfg.blur, 16)
        : profile.isMobile
          ? Math.min(cfg.blur, 18)
          : cfg.blur;

  const mergedStyle: CSSProperties = {
    borderRadius: radius,
    '--lgx-radius': radius,
    '--lgx-blur': `${effectiveBlur}px`,
    '--lgx-sat': `${cfg.sat}%`,
    '--lgx-bright': (cfg.brightness / 100).toFixed(2),
    '--lgx-light-angle': LIGHT_GRADIENT_ANGLE[light],
    ...style,
  } as CSSProperties;

  return (
    <div
      {...rest}
      ref={surfaceRef}
      className={cn(
        'lgx group/glass touch-manipulation',
        `lgx--${tone}`,
        (tone === 'topbar' || tone === 'popover' || tone === 'command') && 'lgx--clear',
        className,
      )}
      style={mergedStyle}
      data-glass-tone={tone}
      data-glass-refraction={refraction}
      data-lgx-low-power={isLowPower ? 'true' : undefined}
      data-lgx-ambient={ambient ? 'true' : undefined}
    >
      <span aria-hidden="true" className="lgx__layer lgx__depth" />

      {canNoise && <span aria-hidden="true" className="lgx__layer lgx__noise" />}

      {canSheen && <span aria-hidden="true" className="lgx__specular" />}

      {canSheen && <span aria-hidden="true" className="lgx__dispersion" />}

      {canRim && <span aria-hidden="true" className="lgx__rim" />}

      {canRipple && <span aria-hidden="true" className="lgx__ripple" />}

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
