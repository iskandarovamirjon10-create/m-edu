/**
 * M-EDU Liquid Glass Surface — v11 "Titanium"
 * Zero-rerender cursor spotlight via CSS custom variables.
 * Multi-layer optical physics: specular edge + chromatic fringe + refraction + spotlight + noise.
 */

import { useRef, useCallback, type HTMLAttributes, type ReactNode } from 'react';
import { useMediaQuery, usePrefersReducedMotion } from '../core/singletons';

export type GlassTone = 'default' | 'topbar' | 'sidebar' | 'modal';

export const GLASS_TONE: Record<GlassTone, { blur: number; sat: number; bg: string; bgDark: string; edge: string; edgeDark: string }> = {
  default: { blur: 40, sat: 190, bg: 'rgba(255,255,255,0.72)', bgDark: 'rgba(28,28,30,0.72)', edge: 'rgba(255,255,255,0.85)', edgeDark: 'rgba(255,255,255,0.10)' },
  topbar:  { blur: 56, sat: 220, bg: 'rgba(255,255,255,0.68)', bgDark: 'rgba(20,20,22,0.68)', edge: 'rgba(255,255,255,0.90)', edgeDark: 'rgba(255,255,255,0.12)' },
  sidebar: { blur: 44, sat: 200, bg: 'rgba(255,255,255,0.74)', bgDark: 'rgba(28,28,30,0.74)', edge: 'rgba(255,255,255,0.85)', edgeDark: 'rgba(255,255,255,0.10)' },
  modal:   { blur: 60, sat: 220, bg: 'rgba(255,255,255,0.85)', bgDark: 'rgba(20,20,22,0.85)', edge: 'rgba(255,255,255,0.95)', edgeDark: 'rgba(255,255,255,0.14)' },
};

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  radius?: string;
  spotlight?: boolean;
  tone?: GlassTone;
  noise?: boolean;
}

export function GlassSurface({
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
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)');
  const compactGlass = useMediaQuery('(max-width: 767px)');
  const validSpotlight = spotlight && !reduced && hoverCapable;
  const t = GLASS_TONE[tone];
  const blurRadius = compactGlass ? Math.min(t.blur, 18) : t.blur;
  const saturation = compactGlass ? Math.min(t.sat, 150) : t.sat;

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!validSpotlight) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--spot-y', `${((e.clientY - r.top) / r.height) * 100}%`);
    el.style.setProperty('--spot-o', '1');
  }, [validSpotlight]);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--spot-o', '0');
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`medu-glass relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        ['--glass-bg' as string]: t.bg,
        ['--glass-bg-dark' as string]: t.bgDark,
        ['--glass-edge' as string]: t.edge,
        ['--glass-edge-dark' as string]: t.edgeDark,
        ['--spot-x' as string]: '50%',
        ['--spot-y' as string]: '0%',
        ['--spot-o' as string]: '0',
        WebkitBackdropFilter: `blur(${blurRadius}px) saturate(${saturation}%)`,
        backdropFilter: `blur(${blurRadius}px) saturate(${saturation}%)`,
        backgroundColor: t.bg,
        ...style,
      }}
      {...rest}
    >
      {/* 1. Specular edge highlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: 'inherit',
          boxShadow:
            `inset 0 1px 0 ${t.edge},` +
            'inset 0 -1px 0 rgba(255,255,255,0.10),' +
            'inset 1px 0 0 rgba(255,255,255,0.20),' +
            'inset -1px 0 0 rgba(255,255,255,0.20)',
        }}
      />

      {/* 2. Chromatic refraction — subtle RGB fringing */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          borderRadius: 'inherit',
          background:
            'linear-gradient(90deg, rgba(255,0,90,0.05) 0%, transparent 8%, transparent 92%, rgba(0,120,255,0.05) 100%)',
          mixBlendMode: 'screen',
        }}
      />

      {/* 3. Bottom inner refraction glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 opacity-30 dark:opacity-20"
        style={{
          borderRadius: 'inherit',
          background: 'linear-gradient(0deg, rgba(255,255,255,0.35), transparent)',
          mixBlendMode: 'overlay',
        }}
      />

      {/* 4. Spotlight highlight (CSS var driven, 0 re-render) */}
      {validSpotlight && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            borderRadius: 'inherit',
            opacity: 'var(--spot-o)',
            background: 'radial-gradient(560px circle at var(--spot-x) var(--spot-y), rgba(255,255,255,0.42), transparent 42%)',
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* 5. Noise grain for depth (skipped on mobile devices) */}
      {noise && !compactGlass && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14] dark:opacity-[0.20]"
          style={{
            borderRadius: 'inherit',
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E")`,
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {children}
    </div>
  );
}
