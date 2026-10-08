/**
 * M-EDU Liquid Glass Surface — v13 "Artisan Titanium"
 * Zero-rerender cursor spotlight via CSS custom variables.
 * Multi-layer optical physics: specular edge + chromatic fringe + refraction + spotlight + noise.
 *
 * Optimizations:
 *  - rAF-throttled spotlight (no main-thread thrash on fast movement)
 *  - Mouse handlers only attached when spotlight is actually active
 *  - Constant gradient/noise strings hoisted (zero per-render allocation)
 *  - prefers-reduced-transparency honored (solid fallback, no blur cost)
 *  - mix-blend layers isolated to prevent visual bleed
 */

import {
  useRef,
  useCallback,
  useEffect,
  memo,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import {
  useDeviceProfile,
  useMediaQuery,
  usePrefersReducedMotion,
} from '../core/singletons';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tone tokens                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type GlassTone = 'default' | 'topbar' | 'sidebar' | 'modal';

export interface GlassToneConfig {
  blur: number;
  sat: number;
  bg: string;
  bgDark: string;
  edge: string;
  edgeDark: string;
}

export const GLASS_TONE: Record<GlassTone, GlassToneConfig> = {
  default: {
    blur: 40,
    sat: 190,
    bg: 'rgba(255,255,255,0.72)',
    bgDark: 'rgba(28,28,30,0.72)',
    edge: 'rgba(255,255,255,0.85)',
    edgeDark: 'rgba(255,255,255,0.10)',
  },
  topbar: {
    blur: 56,
    sat: 220,
    bg: 'rgba(255,255,255,0.68)',
    bgDark: 'rgba(20,20,22,0.68)',
    edge: 'rgba(255,255,255,0.90)',
    edgeDark: 'rgba(255,255,255,0.12)',
  },
  sidebar: {
    blur: 44,
    sat: 200,
    bg: 'rgba(255,255,255,0.74)',
    bgDark: 'rgba(28,28,30,0.74)',
    edge: 'rgba(255,255,255,0.85)',
    edgeDark: 'rgba(255,255,255,0.10)',
  },
  modal: {
    blur: 60,
    sat: 220,
    bg: 'rgba(255,255,255,0.85)',
    bgDark: 'rgba(20,20,22,0.85)',
    edge: 'rgba(255,255,255,0.95)',
    edgeDark: 'rgba(255,255,255,0.14)',
  },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  Layer constants — hoisted, never re-created                               */
/* ────────────────────────────────────────────────────────────────────────── */

const CHROMATIC_FRINGE_BG =
  'linear-gradient(90deg, rgba(255,0,90,0.05) 0%, transparent 8%, transparent 92%, rgba(0,120,255,0.05) 100%)';

const BOTTOM_REFRACTION_BG =
  'linear-gradient(0deg, rgba(255,255,255,0.35), transparent)';

const SPOTLIGHT_BG =
  'radial-gradient(560px circle at var(--spot-x) var(--spot-y), rgba(255,255,255,0.42), transparent 42%)';

const NOISE_BG_IMAGE =
  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.55\'/%3E%3C/svg%3E")';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Component                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** CSS border-radius value. Defaults to `2rem`. */
  radius?: string;
  /** Enable cursor-tracked specular spotlight (auto-disabled on touch / reduced-motion). */
  spotlight?: boolean;
  /** Visual tone preset — controls blur, saturation and edge intensity. */
  tone?: GlassTone;
  /** Render the film-grain noise layer (skipped on mobile). */
  noise?: boolean;
}

export const GlassSurface = memo(function GlassSurface({
  children,
  className = '',
  radius = '2rem',
  spotlight = true,
  tone = 'default',
  noise = true,
  style,
  ...rest
}: GlassSurfaceProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const reduced = usePrefersReducedMotion();
  const profile = useDeviceProfile();
  const reducedTransparency = useMediaQuery(
    '(prefers-reduced-transparency: reduce)',
  );

  /* ── Derived flags ──────────────────────────────────────────────────── */
  const isCompact = profile.isMobile;
  const validSpotlight = spotlight && !reduced && profile.hoverCapable;

  const t = GLASS_TONE[tone];
  const blurRadius = isCompact ? Math.min(t.blur, 18) : t.blur;
  const saturation = isCompact ? Math.min(t.sat, 150) : t.sat;
  const useBlur = !reducedTransparency;

  /* ── rAF-throttled spotlight (zero re-renders, zero thrash) ────────── */
  const frame = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      pending.current = { x: e.clientX, y: e.clientY };
      if (frame.current != null) return;

      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const p = pending.current;
        const el = ref.current;
        if (!p || !el) return;

        const r = el.getBoundingClientRect();
        el.style.setProperty('--spot-x', `${((p.x - r.left) / r.width) * 100}%`);
        el.style.setProperty('--spot-y', `${((p.y - r.top) / r.height) * 100}%`);
        el.style.setProperty('--spot-o', '1');
      });
    },
    [],
  );

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (frame.current != null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    pending.current = null;
    el.style.setProperty('--spot-o', '0');
  }, []);

  /* Clean up any in-flight frame on unmount */
  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return (
    <div
      ref={ref}
      onMouseMove={validSpotlight ? onMove : undefined}
      onMouseLeave={validSpotlight ? onLeave : undefined}
      data-glass-tone={tone}
      data-glass-reduced-transparency={reducedTransparency ? 'true' : undefined}
      className={`medu-glass relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        isolation: 'isolate',
        ['--glass-surface-bg' as string]: t.bg,
        ['--glass-surface-bg-dark' as string]: t.bgDark,
        ['--glass-surface-edge' as string]: t.edge,
        ['--glass-surface-edge-dark' as string]: t.edgeDark,
        ['--spot-x' as string]: '50%',
        ['--spot-y' as string]: '0%',
        ['--spot-o' as string]: '0',
        ...(useBlur && {
          WebkitBackdropFilter: `blur(${blurRadius}px) saturate(${saturation}%)`,
          backdropFilter: `blur(${blurRadius}px) saturate(${saturation}%)`,
        }),
        ...style,
      }}
      {...rest}
    >
      {/* 1 · Specular edge highlight (theme-driven via CSS vars) */}
      <div
        aria-hidden
        className="medu-glass-specular pointer-events-none absolute inset-0"
        style={{ borderRadius: 'inherit' }}
      />

      {/* 2 · Chromatic refraction — subtle RGB fringing at the extremes */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          borderRadius: 'inherit',
          background: CHROMATIC_FRINGE_BG,
          mixBlendMode: 'screen',
        }}
      />

      {/* 3 · Bottom inner refraction glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-30 dark:opacity-20"
        style={{
          borderRadius: 'inherit',
          background: BOTTOM_REFRACTION_BG,
          mixBlendMode: 'overlay',
        }}
      />

      {/* 4 · Cursor spotlight (CSS var driven · 0 re-render · rAF throttled) */}
      {validSpotlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-500 ease-out will-change-[opacity]"
          style={{
            borderRadius: 'inherit',
            opacity: 'var(--spot-o)' as unknown as number,
            background: SPOTLIGHT_BG,
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* 5 · Film-grain noise (skipped on mobile to save GPU) */}
      {noise && !isCompact && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.20]"
          style={{
            borderRadius: 'inherit',
            backgroundImage: NOISE_BG_IMAGE,
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {children}
    </div>
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Optional companion hook — for surfaces that only need the tone config     */
/* ────────────────────────────────────────────────────────────────────────── */

export function useGlassTone(tone: GlassTone): GlassToneConfig {
  return GLASS_TONE[tone];
}