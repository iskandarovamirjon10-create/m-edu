/**
 * GlassCard V2 — Surface card component for M-EDU Design System V2.
 *
 * variant: 'default' | 'elevated' | 'flat' | 'interactive'
 * padding: 'none' | 'sm' | 'md' | 'lg' | 'xl'
 */
import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';

export type GlassCardVariant = 'default' | 'elevated' | 'flat' | 'interactive';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: GlassCardVariant;
  /** @deprecated use variant="interactive" */
  hover?: boolean;
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
      padding = 'md',
      variant: variantProp = 'default',
      hover = false,
      className = '',
      noReflection = false,
      ...rest
    },
    ref,
  ) => {
    const variant = hover ? 'interactive' : variantProp;

    return (
      <div
        ref={ref}
        className={[
          'relative overflow-hidden',
          'backdrop-blur-[16px] [backdrop-filter:blur(16px)_saturate(1.5)]',
          '[-webkit-backdrop-filter:blur(16px)_saturate(1.5)]',
          'rounded-[var(--radius-xl)]',
          VARIANT_CLASSES[variant],
          PADDING_CLASSES[padding],
          className,
        ].join(' ')}
        {...rest}
      >
        {/* Reflection overlay */}
        {!noReflection && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] z-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)',
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
