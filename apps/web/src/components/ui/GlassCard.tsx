/**
 * GlassCard V2 — Surface card component for M-EDU Design System V2.
 *
 * variant: 'default' | 'elevated' | 'flat' | 'interactive'
 * padding: 'none' | 'sm' | 'md' | 'lg' | 'xl'
 */
import { type ReactNode, type HTMLAttributes, forwardRef, useEffect, useRef } from 'react';

export type GlassCardVariant = 'default' | 'elevated' | 'flat' | 'interactive';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: GlassCardVariant;
  /** @deprecated use variant="interactive" */
  hover?: boolean;
  /** @deprecated use variant="interactive" */
  interactive?: boolean;
  className?: string;
  /** Render without glass reflection overlay */
  noReflection?: boolean;
}

const VARIANT_CLASSES: Record<GlassCardVariant, string> = {
  default: [
    'bg-[var(--bg-card)]',
    'border border-[var(--border)]',
    'shadow-[var(--shadow-md)]',
    'transition-[background-color,box-shadow,border-color]',
    'duration-[var(--duration-normal)]',
    '[transition-timing-function:var(--ease-standard)]',
    'hover:bg-[var(--bg-card-hover)]',
    'hover:border-[var(--border-medium)]',
  ].join(' '),

  elevated: [
    'bg-[var(--bg-elevated)]',
    'border border-[var(--border)]',
    'shadow-[var(--shadow-lg)]',
    'transition-[background-color,box-shadow,border-color]',
    'duration-[var(--duration-normal)]',
    '[transition-timing-function:var(--ease-standard)]',
  ].join(' '),

  flat: [
    'bg-[var(--bg-surface)]',
    'border border-[var(--border-subtle)]',
    'shadow-none',
    'transition-[background-color,border-color]',
    'duration-[var(--duration-normal)]',
    '[transition-timing-function:var(--ease-standard)]',
    'hover:border-[var(--border-medium)]',
  ].join(' '),

  interactive: [
    'bg-[var(--bg-card)]',
    'border border-[var(--border)]',
    'shadow-[var(--shadow-sm)]',
    'cursor-pointer',
    'transition-[background-color,box-shadow,border-color,transform]',
    'duration-[var(--duration-normal)]',
    '[transition-timing-function:var(--ease-standard)]',
    'hover:bg-[var(--bg-card-hover)]',
    'hover:border-[var(--border-medium)]',
    'hover:shadow-[var(--shadow-md)]',
    'hover:-translate-y-0.5',
    'active:translate-y-0',
    'active:shadow-[var(--shadow-xs)]',
  ].join(' '),
};

const PADDING_CLASSES: Record<string, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-5',
  lg:   'p-6',
  xl:   'p-8',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      padding,
      variant: variantProp = 'default',
      hover = false,
      interactive = false,
      className = '',
      noReflection = false,
      ...rest
    },
    ref,
  ) => {
    const variant = hover || interactive ? 'interactive' : variantProp;
    // An explicit `padding` prop wins. Otherwise, when the caller passes its own
    // padding via className (e.g. "p-0", "p-6"), don't stack the default on top.
    const hasExplicitPadding = /(^|\s)p[xytrbl]?-/.test(className);
    const paddingClass = padding
      ? PADDING_CLASSES[padding]
      : hasExplicitPadding
        ? ''
        : PADDING_CLASSES.md;

    // Merge the external ref with a local ref for cursor tracking
    const localRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      const el = localRef.current;
      if (!el || variant !== 'interactive') return;
      
      let raf = 0;
      const onMove = (e: MouseEvent) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          el.style.setProperty('--ad-glow-x', `${((e.clientX - r.left) / r.width) * 100}%`);
          el.style.setProperty('--ad-glow-y', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
      };
      
      el.addEventListener('mousemove', onMove, { passive: true });
      return () => {
        el.removeEventListener('mousemove', onMove);
        cancelAnimationFrame(raf);
      };
    }, [variant]);

    return (
      <div
        ref={(node) => {
          localRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={[
          'relative overflow-hidden group',
          'backdrop-blur-[16px] [backdrop-filter:blur(16px)_saturate(1.5)]',
          '[-webkit-backdrop-filter:blur(16px)_saturate(1.5)]',
          'rounded-[var(--radius-xl)]',
          VARIANT_CLASSES[variant],
          paddingClass,
          className,
        ].join(' ')}
        {...rest}
      >
        {/* Reflection overlay */}
        {!noReflection && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] z-0 transition-opacity duration-300"
            style={{
              background: variant === 'interactive' 
                ? 'radial-gradient(600px circle at var(--ad-glow-x, 50%) var(--ad-glow-y, 50%), rgba(255,255,255,0.1), transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
            }}
          />
        )}
        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
