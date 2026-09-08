/**
 * GlassButton — Primary action component for M-EDU Liquid Glass UI.
 * All states: default, hover, active, focus, disabled, loading.
 */
import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react';
import { GlassSpinner } from './GlassSpinner';

export type GlassButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
  // Legacy variant names accepted for backwards compatibility
  | 'success' | 'danger-outline';
export type GlassButtonSize     = 'sm' | 'md' | 'lg' | 'icon';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<GlassButtonVariant, string> = {
  primary: [
    'bg-gradient-to-br from-brand-700 to-brand-800',
    'text-white',
    'shadow-[0_4px_16px_rgba(84,115,252,0.30)]',
    'hover:shadow-[0_8px_28px_rgba(84,115,252,0.42)]',
    'hover:-translate-y-px',
    'active:translate-y-0',
    'active:shadow-[0_2px_8px_rgba(84,115,252,0.25)]',
  ].join(' '),
  secondary: [
    'bg-[var(--bg-glass)]',
    'backdrop-blur-xl',
    'text-[var(--text-primary)]',
    'border border-[var(--border-medium)]',
    'hover:bg-[var(--bg-glass-hover)]',
    'hover:border-[var(--border-strong)]',
    'hover:-translate-y-px',
    'active:translate-y-0',
    'shadow-[var(--shadow-xs)]',
  ].join(' '),
  ghost: [
    'bg-transparent',
    'text-[var(--text-secondary)]',
    'border border-transparent',
    'hover:bg-[var(--state-hover)]',
    'hover:text-[var(--text-primary)]',
    'hover:border-[var(--border-subtle)]',
  ].join(' '),
  danger: [
    'bg-gradient-to-br from-[#F07070] to-[#D95555]',
    'text-white',
    'shadow-[0_4px_16px_rgba(240,112,112,0.28)]',
    'hover:shadow-[0_8px_28px_rgba(240,112,112,0.38)]',
    'hover:-translate-y-px',
    'active:translate-y-0',
  ].join(' '),
  // Legacy names → sensible fallbacks
  success: '',
  'danger-outline': '',
};

const SIZE_CLASSES: Record<GlassButtonSize, string> = {
  sm:   'px-3.5 py-2 text-sm rounded-lg gap-1.5',
  md:   'px-5 py-2.5 text-[0.9375rem] rounded-xl gap-2',
  lg:   'px-7 py-3.5 text-base rounded-xl gap-2.5',
  icon: 'p-2.5 rounded-xl aspect-square',
};

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ variant: variantProp = 'primary', size = 'md', loading = false, icon, children, className = '', disabled, ...rest }, ref) => {
    // Legacy pages pass variant="success" etc. — map to the closest real variant.
    const variant = (variantProp === 'success' ? 'secondary' : variantProp === 'danger-outline' ? 'ghost' : variantProp) as GlassButtonVariant;
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={[
          'inline-flex items-center justify-center',
          'font-medium font-sans tracking-[0.01em]',
          'border-0 cursor-pointer',
          'select-none whitespace-nowrap',
          'transition-all duration-[220ms] ease-[cubic-bezier(.25,.46,.45,.94)]',
          'relative overflow-hidden',
          // Inner sheen
          'before:absolute before:inset-0 before:rounded-[inherit]',
          'before:bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,transparent_50%)]',
          'before:pointer-events-none',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          isDisabled ? 'opacity-45 cursor-not-allowed pointer-events-none' : '',
          className,
        ].join(' ')}
        disabled={isDisabled}
        {...rest}
      >
        {loading ? (
          <GlassSpinner size={size === 'lg' ? 'md' : size === 'sm' ? 'sm' : 'sm'} />
        ) : icon ? (
          <span className="flex-shrink-0 [&>svg]:w-[1em] [&>svg]:h-[1em]">{icon}</span>
        ) : null}
        {children && <span>{children}</span>}
      </button>
    );
  },
);

GlassButton.displayName = 'GlassButton';

export default GlassButton;
