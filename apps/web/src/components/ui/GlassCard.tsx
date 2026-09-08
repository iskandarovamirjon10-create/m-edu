/**
 * GlassCard — Card container with glass aesthetic.
 */
import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  className?: string;
}

const PADDING_CLASSES: Record<string, string> = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, padding = 'md', hover = false, className = '', ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={[
          'relative overflow-hidden',
          'bg-[var(--bg-card)]',
          'backdrop-blur-2xl backdrop-saturate-[1.6]',
          'border border-[var(--border-glass)]',
          'rounded-3xl',
          'shadow-[var(--shadow-md)]',
          'transition-all duration-[280ms] ease-[cubic-bezier(.25,.46,.45,.94)]',
          hover
            ? 'hover:bg-[var(--bg-card-hover)] hover:shadow-[var(--shadow-lg)] hover:-translate-y-0.5'
            : '',
          PADDING_CLASSES[padding],
          className,
        ].join(' ')}
        {...rest}
      >
        {/* Reflection */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            background:
              'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, transparent 48%, rgba(148,234,239,0.04) 100%)',
          }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';

export default GlassCard;
