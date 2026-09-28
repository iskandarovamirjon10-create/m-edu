/**
 * GlassButton V2 — Canonical button component for M-EDU Design System V2.
 *
 * Variants: primary | secondary | tertiary | ghost | danger | success | warning | link
 * Sizes:    xs | sm | md | lg | xl | icon
 * States:   default | hover | pressed | focus | disabled | loading
 */
import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { GlassSpinner } from './GlassSpinner';

export type GlassButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'
  | 'link'
  // Legacy aliases
  | 'danger-outline';

export type GlassButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /** Icon placed after children */
  iconEnd?: ReactNode;
  children?: ReactNode;
  /** Render as a different element (e.g., Link) via Radix Slot */
  asChild?: boolean;
  /** Show success checkmark state */
  success?: boolean;
}

const VARIANT_CLASSES: Record<GlassButtonVariant, string> = {
  primary: [
    'bg-[var(--primary)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[0_2px_8px_rgba(79,70,229,0.28)]',
    'hover:bg-[var(--primary-hover)]',
    'hover:shadow-[0_6px_20px_rgba(79,70,229,0.36)]',
    'active:bg-[var(--primary-pressed)]',
    'active:shadow-[0_1px_4px_rgba(79,70,229,0.20)]',
    'active:scale-[0.98]',
  ].join(' '),

  secondary: [
    'bg-[var(--bg-glass)]',
    'backdrop-blur-xl',
    'text-[var(--text-primary)]',
    'border border-[var(--border-medium)]',
    'shadow-[var(--shadow-xs)]',
    'hover:bg-[var(--bg-glass-hover)]',
    'hover:border-[var(--border-strong)]',
    'hover:shadow-[var(--shadow-sm)]',
    'active:scale-[0.98]',
    'active:shadow-none',
  ].join(' '),

  tertiary: [
    'bg-[var(--primary-soft)]',
    'text-[var(--primary)]',
    'border border-transparent',
    'hover:bg-[var(--primary-soft-hover)]',
    'hover:border-[var(--border-focus)]',
    'active:scale-[0.98]',
  ].join(' '),

  ghost: [
    'bg-transparent',
    'text-[var(--text-secondary)]',
    'border border-transparent',
    'hover:bg-[var(--state-hover)]',
    'hover:text-[var(--text-primary)]',
    'active:bg-[var(--state-active)]',
    'active:scale-[0.98]',
  ].join(' '),

  danger: [
    'bg-[var(--danger)]',
    'text-white',
    'border border-transparent',
    'shadow-[0_2px_8px_rgba(220,38,38,0.25)]',
    'hover:bg-[var(--danger-text)]',
    'hover:shadow-[0_6px_20px_rgba(220,38,38,0.32)]',
    'active:scale-[0.98]',
  ].join(' '),

  'danger-outline': [
    'bg-transparent',
    'text-[var(--danger)]',
    'border border-[var(--danger-border)]',
    'hover:bg-[var(--danger-soft)]',
    'active:scale-[0.98]',
  ].join(' '),

  success: [
    'bg-[var(--success)]',
    'text-white',
    'border border-transparent',
    'shadow-[0_2px_8px_rgba(22,163,74,0.25)]',
    'hover:bg-[var(--success-text)]',
    'hover:shadow-[0_6px_20px_rgba(22,163,74,0.32)]',
    'active:scale-[0.98]',
  ].join(' '),

  warning: [
    'bg-[var(--warning)]',
    'text-white',
    'border border-transparent',
    'shadow-[0_2px_8px_rgba(217,119,6,0.25)]',
    'hover:bg-[var(--warning-text)]',
    'hover:shadow-[0_6px_20px_rgba(217,119,6,0.32)]',
    'active:scale-[0.98]',
  ].join(' '),

  link: [
    'bg-transparent',
    'text-[var(--primary)]',
    'border border-transparent',
    'underline-offset-4',
    'hover:underline',
    'hover:text-[var(--primary-hover)]',
    'active:text-[var(--primary-pressed)]',
    'p-0 h-auto',
  ].join(' '),
};

const SIZE_CLASSES: Record<GlassButtonSize, string> = {
  xs:      'h-7 px-2.5 text-xs rounded-[var(--radius-sm)] gap-1',
  sm:      'h-8 px-3.5 text-sm rounded-[var(--radius-md)] gap-1.5',
  md:      'h-9 px-4 text-[var(--text-body)] rounded-[var(--radius-md)] gap-2',
  lg:      'h-11 px-6 text-[var(--text-body-lg)] rounded-[var(--radius-lg)] gap-2',
  xl:      'h-13 px-8 text-lg rounded-[var(--radius-lg)] gap-2.5',
  icon:    'h-9 w-9 rounded-[var(--radius-md)]',
  'icon-sm': 'h-7 w-7 rounded-[var(--radius-sm)]',
  'icon-lg': 'h-11 w-11 rounded-[var(--radius-lg)]',
};

const BASE_CLASSES = [
  'inline-flex items-center justify-center',
  'font-medium font-sans',
  'whitespace-nowrap select-none',
  'cursor-pointer',
  'border',
  'relative overflow-hidden',
  'transition-[background-color,border-color,box-shadow,transform,color]',
  'duration-[var(--duration-fast)]',
  '[transition-timing-function:var(--ease-standard)]',
  // Disabled
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
  // Focus ring
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
  'focus-visible:shadow-[0_0_0_3px_var(--focus-ring)]',
].join(' ');

// ── Success checkmark icon ────────────────────────────────────
const CheckIcon = () => (
  <svg className="w-[1em] h-[1em]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 10l5 5 7-7" />
  </svg>
);

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant: variantProp = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconEnd,
      children,
      className = '',
      disabled,
      asChild,
      success: showSuccess = false,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    const computedClass = [
      BASE_CLASSES,
      VARIANT_CLASSES[variantProp] ?? VARIANT_CLASSES.ghost,
      SIZE_CLASSES[size],
      className,
    ].join(' ');

    const content = (
      <>
        {/* Absolute loader to preserve geometry */}
        {(loading || showSuccess) && (
          <div className="absolute inset-0 flex items-center justify-center animate-in fade-in duration-200">
            {loading ? (
              <GlassSpinner size={size === 'lg' || size === 'xl' ? 'md' : 'sm'} />
            ) : (
              <CheckIcon />
            )}
          </div>
        )}

        {/* Content wrapper - stays hidden during loading to maintain exact width */}
        <span
          className={`flex items-center justify-center ${loading || showSuccess ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
          style={{ gap: 'inherit' }}
        >
          {icon && (
            <span className="flex-shrink-0 flex items-center [&>svg]:w-[1em] [&>svg]:h-[1em]">
              {icon}
            </span>
          )}
          {children && size !== 'icon' && size !== 'icon-sm' && size !== 'icon-lg' && (
            <span className="leading-none">{children}</span>
          )}
          {iconEnd && (
            <span className="flex-shrink-0 flex items-center [&>svg]:w-[1em] [&>svg]:h-[1em]">
              {iconEnd}
            </span>
          )}
        </span>
      </>
    );

    if (asChild) {
      return (
        <Slot ref={ref} className={computedClass} {...rest}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={computedClass}
        disabled={isDisabled}
        aria-busy={loading}
        {...rest}
      >
        {content}
      </button>
    );
  },
);

GlassButton.displayName = 'GlassButton';

export default GlassButton;
