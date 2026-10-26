/**
 * GlassCard — Apple-premium
 */
import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/design';

export type GlassCardVariant = 'default' | 'elevated' | 'flat' | 'interactive' | 'tactile';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: GlassCardVariant;
  /** @deprecated no-op */
  hover?: boolean;
  /** @deprecated no-op */
  interactive?: boolean;
  className?: string;
  /** @deprecated no-op */
  noReflection?: boolean;
  /** @deprecated no-op */
  disableRefraction?: boolean;
  /** @deprecated no-op */
  disableMotion?: boolean;
  /** @deprecated no-op */
  gradientTitle?: boolean;
}

const VARIANT_CLASSES: Record<GlassCardVariant, string> = {
  default:
    'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[border-color,box-shadow,background-color] duration-200 hover:shadow-card-hover hover:border-black/[0.08] dark:hover:border-white/[0.12]',
  elevated:
    'bg-white/90 dark:bg-surface-900/90 backdrop-blur-2xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card-elevated shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-200',
  flat:
    'bg-white/50 dark:bg-surface-900/40 backdrop-blur-md backdrop-saturate-150 border border-black/[0.04] dark:border-white/[0.05] rounded-2xl shadow-none transition-all duration-200',
  tactile:
    'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-apple-card shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-200',
  interactive:
    'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-card-hover hover:border-black/[0.1] dark:hover:border-white/[0.15] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] transform-gpu transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,box-shadow] cursor-pointer',
};

const PADDING_CLASSES: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
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
      noReflection,
      disableRefraction,
      disableMotion,
      gradientTitle,
      ...rest
    },
    ref,
  ) => {
    const variant = hover || interactive ? 'interactive' : variantProp;
    const hasExplicitPadding = /(^|\s)p[xytrbl]?-/.test(className);
    const paddingClass = padding ? PADDING_CLASSES[padding] : hasExplicitPadding ? '' : PADDING_CLASSES.md;

    return (
      <div ref={ref} className={cn(VARIANT_CLASSES[variant], paddingClass, className)} {...rest}>
        {children}
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';
export default GlassCard;
