/**
 * GlassSurface — minimal Apple-premium glass surface.
 *
 * Simple: `bg-card` + hairline `border border-subtle` + `rounded-xl` plus
 * optional tone/elevation class maps. Tilt is optional (≤4deg) and only
 * interactive when `onClick` is provided (keyboard-safe via role/tabIndex/onKeyDown).
 */
import {
  forwardRef,
  useCallback,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cn, usePrefersReducedMotion } from '@/lib/design';

export type GlassElevation = 'low' | 'mid' | 'high' | 'floating';
export type GlassTone = 'light' | 'frost' | 'deep' | 'subtle';

export interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  elevation?: GlassElevation;
  tone?: GlassTone;
  className?: string;
  /** Optional subtle tilt (max 4°) — only active if onClick is also present */
  tilt?: boolean;
  /** Optional top specular highlight line. Default true. */
  sheen?: boolean;
}

const ELEVATION_CLASSES: Record<GlassElevation, string> = {
  low: 'shadow-[0_2px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)]',
  mid: 'shadow-[0_8px_24px_-6px_rgba(0,0,0,0.07),inset_0_1px_0_rgba(255,255,255,0.85)] dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]',
  high: 'shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] dark:shadow-[0_20px_48px_-8px_rgba(0,0,0,0.68),inset_0_1px_0_rgba(255,255,255,0.16)]',
  floating: 'shadow-[0_24px_56px_-12px_rgba(0,0,0,0.18),0_4px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[0_28px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.22)]',
};

const TONE_CLASSES: Record<GlassTone, string> = {
  light: 'bg-white/75 dark:bg-surface-900/75 backdrop-blur-xl backdrop-saturate-150',
  frost: 'bg-white/85 dark:bg-white/[0.07] backdrop-blur-2xl backdrop-saturate-180',
  deep: 'bg-slate-900/[0.04] dark:bg-surface-950/80 backdrop-blur-xl backdrop-saturate-150',
  subtle: 'bg-white/50 dark:bg-surface-900/40 backdrop-blur-lg backdrop-saturate-125',
};

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  function GlassSurface(
    {
      children,
      elevation = 'mid',
      tone = 'light',
      className = '',
      tilt = false,
      sheen = true,
      onClick,
      tabIndex,
      role,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const reduced = usePrefersReducedMotion();
    const rootRef = useRef<HTMLDivElement | null>(null);

    const handleRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as { current: HTMLDivElement | null }).current = node;
      },
      [ref],
    );

    const isInteractive = Boolean(onClick);
    const shouldTilt = tilt && isInteractive && !reduced;

    const handleMouseMove = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (!shouldTilt || !rootRef.current) return;
        const rect = rootRef.current.getBoundingClientRect();
        const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -4;
        const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 4;
        rootRef.current.style.setProperty('--gls-rot-x', `${rx.toFixed(2)}deg`);
        rootRef.current.style.setProperty('--gls-rot-y', `${ry.toFixed(2)}deg`);
        rootRef.current.style.transform = `perspective(1200px) rotateX(var(--gls-rot-x)) rotateY(var(--gls-rot-y)) translateZ(2px)`;
      },
      [shouldTilt],
    );

    const resetTilt = useCallback(() => {
      if (!rootRef.current) return;
      rootRef.current.style.removeProperty('--gls-rot-x');
      rootRef.current.style.removeProperty('--gls-rot-y');
      rootRef.current.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    }, []);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (!isInteractive) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as unknown as MouseEvent<HTMLDivElement>);
        }
      },
      [isInteractive, onClick, onKeyDown],
    );

    const interactiveProps = isInteractive
      ? {
          role: role ?? 'button',
          tabIndex: tabIndex ?? 0,
          onKeyDown: handleKeyDown,
        }
      : {};

    return (
      <div
        {...rest}
        {...interactiveProps}
        ref={handleRef}
        onClick={onClick}
        onMouseMove={shouldTilt ? handleMouseMove : undefined}
        onMouseLeave={shouldTilt ? resetTilt : undefined}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] transition-all duration-200',
          shouldTilt && 'will-change-transform',
          ELEVATION_CLASSES[elevation],
          TONE_CLASSES[tone],
          isInteractive && 'cursor-pointer hover:shadow-card-hover hover:border-black/[0.14] dark:hover:border-white/[0.2] active:scale-[0.985]',
          className,
        )}
        style={{ transformStyle: 'preserve-3d', ...rest.style }}
      >
        {sheen && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/85 to-transparent dark:via-white/20"
          />
        )}
        {children}
      </div>
    );
  },
);

GlassSurface.displayName = 'GlassSurface';
export default GlassSurface;
