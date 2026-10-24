

import {
  type ReactNode,
  type ButtonHTMLAttributes,
  type ReactElement,
  Children,
  cloneElement,
  isValidElement,
  forwardRef,
} from 'react';
import { Slot } from '@radix-ui/react-slot';
import { GlassSpinner } from './GlassSpinner';
import { usePremiumSound } from '@/hooks/usePremiumSound';



export type GlassButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'
  | 'link'
  | 'danger-outline';

export type GlassButtonSize =
  | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  | 'icon' | 'icon-sm' | 'icon-lg';

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

interface GlassButtonProps extends Omit<NativeButtonProps, 'children'> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;

  
  loading?: boolean;

  
  success?: boolean;

  
  icon?: ReactNode;

  
  iconEnd?: ReactNode;

  children?: ReactNode;

  
  asChild?: boolean;

  
  pressed?: boolean;
  haptic?: boolean;
}



const VARIANT_CLASSES: Record<GlassButtonVariant, string> = {
  
  primary: [
    'bg-[var(--primary)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-brand)]',
    'hover:bg-[var(--primary-hover)]',
    'hover:shadow-[var(--shadow-brand-strong)]',
    'active:bg-[var(--primary-active)]',
    'active:shadow-[var(--shadow-xs)]',
  ].join(' '),

  
  secondary: [
    'bg-[var(--bg-glass)]',
    'backdrop-blur-[var(--glass-blur-strong)]',
    'text-[var(--text-primary)]',
    'border border-[var(--border-medium)]',
    'shadow-[var(--shadow-xs)]',
    'hover:bg-[var(--bg-glass-hover)]',
    'hover:border-[var(--border-strong)]',
    'hover:shadow-[var(--shadow-sm)]',
  ].join(' '),

  
  tertiary: [
    'bg-[var(--primary-soft)]',
    'text-[var(--primary)]',
    'border border-transparent',
    'hover:bg-[var(--primary-soft-hover)]',
    'hover:border-[var(--border-focus)]',
  ].join(' '),

  
  ghost: [
    'bg-transparent',
    'text-[var(--text-secondary)]',
    'border border-transparent',
    'hover:bg-[var(--state-hover)]',
    'hover:text-[var(--text-primary)]',
    'active:bg-[var(--state-active)]',
  ].join(' '),

  
  danger: [
    'bg-[var(--danger)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-danger)]',
    'hover:bg-[var(--danger-hover)]',
    'active:bg-[var(--danger-active)]',
    'active:shadow-[var(--shadow-xs)]',
  ].join(' '),

  
  'danger-outline': [
    'bg-transparent',
    'text-[var(--danger)]',
    'border border-[var(--danger-border)]',
    'hover:bg-[var(--danger-soft)]',
  ].join(' '),

  
  success: [
    'bg-[var(--success)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-success)]',
    'hover:bg-[var(--success-hover)]',
    'active:bg-[var(--success-active)]',
    'active:shadow-[var(--shadow-xs)]',
  ].join(' '),

  
  warning: [
    'bg-[var(--warning)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-warning)]',
    'hover:bg-[var(--warning-hover)]',
    'active:bg-[var(--warning-active)]',
    'active:shadow-[var(--shadow-xs)]',
    // Weight floor — a11y for amber bg
    '[&_[data-btn-label]]:font-semibold',
  ].join(' '),

  
  link: [
    'bg-transparent',
    'text-[var(--primary)]',
    'border border-transparent',
    'underline-offset-4',
    'hover:underline',
    'hover:text-[var(--primary-hover)]',
    'active:text-[var(--primary-active)]',
    '!h-auto !p-0 !min-h-0',
    'shadow-none',
  ].join(' '),
};



const SIZE_CLASSES: Record<GlassButtonSize, string> = {
  xs:        'h-7 min-h-7  px-2.5 text-[var(--text-xs)]       rounded-[var(--radius-sm)] tap-extend',
  sm:        'h-8 min-h-8  px-3.5 text-[var(--text-sm)]       rounded-[var(--radius-md)] tap-extend',
  md:        'h-10 min-h-10 px-4  text-[var(--text-body)]     rounded-[var(--radius-md)]',
  lg:        'h-12 min-h-12 px-6  text-[var(--text-body-lg)]  rounded-[var(--radius-lg)]',
  xl:        'h-14 min-h-14 px-8  text-[var(--text-lg)]       rounded-[var(--radius-lg)]',
  icon:      'h-10 w-10  min-h-10 min-w-10 rounded-[var(--radius-md)]',
  'icon-sm': 'h-8 w-8    min-h-8  min-w-8  rounded-[var(--radius-sm)] tap-extend',
  'icon-lg': 'h-12 w-12  min-h-12 min-w-12 rounded-[var(--radius-lg)]',
};


const SIZE_GAP: Record<GlassButtonSize, string> = {
  xs:        '0.25rem',
  sm:        '0.375rem',
  md:        '0.5rem',
  lg:        '0.5rem',
  xl:        '0.625rem',
  icon:      '0',
  'icon-sm': '0',
  'icon-lg': '0',
};



const BASE_CLASSES = [
  
  'relative inline-flex items-center justify-center',
  'isolate',

  
  'font-sans font-medium',
  'leading-tight',
  'whitespace-nowrap select-none',

  
  'cursor-pointer',
  'border',
  '[touch-action:manipulation]',
  '[-webkit-tap-highlight-color:transparent]',

  
  'transition-[background-color,border-color,color,box-shadow,transform]',
  'duration-[150ms]',
  '[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',

  
  '[transform:translate3d(0,var(--btn-press-y,0),0)_scale(var(--btn-press-scale,1))]',
  'active:[--btn-press-y:0.5px]',
  'active:[--btn-press-scale:0.97]',

  
  'disabled:opacity-[var(--opacity-disabled,0.55)]',
  'disabled:cursor-not-allowed',

  
  'focus-visible:outline-2',
  'focus-visible:outline-offset-2',
  'focus-visible:outline-[var(--border-focus)]',
  'focus-visible:shadow-[0_0_0_3px_var(--focus-ring,theme(colors.indigo.500/0.22))]',

  
  '[text-align:center]',

  
  'forced-colors:border-[CanvasText]',
].join(' ');



const CheckIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    style={{ width: '1em', height: '1em', display: 'block' }}
  >
    <path d="M4 10l5 5 7-7" />
  </svg>
);



const ICON_SIZES = new Set<GlassButtonSize>(['icon', 'icon-sm', 'icon-lg']);
const WIDE_SIZES = new Set<GlassButtonSize>(['lg', 'xl', 'icon-lg']);

function getSpinnerSize(size: GlassButtonSize): 'sm' | 'md' {
  return WIDE_SIZES.has(size) ? 'md' : 'sm';
}


const IS_DEV: boolean = (() => {
  try {
    // Vite / ESM
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) return true;
  } catch {  }
  try {
    // Node / CJS
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

function devWarn(condition: boolean, message: string): void {
  if (IS_DEV && condition && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[GlassButton] ${message}`);
  }
}



interface ContentParts {
  iconEl: ReactNode;
  iconEndEl: ReactNode;
  childrenNode: ReactNode;
  showLoading: boolean;
  showSuccess: boolean;
  spinnerSize: 'sm' | 'md';
  gap: string;
}

function buildContent(parts: ContentParts): ReactElement {
  const {
    iconEl, iconEndEl, childrenNode,
    showLoading, showSuccess, spinnerSize, gap,
  } = parts;

  const isBusy = showLoading || showSuccess;

  return (
    <>
      {}
      {isBusy && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{ borderRadius: 'inherit' }}
          aria-live={showSuccess ? 'polite' : undefined}
          role={showLoading ? 'status' : undefined}
        >
          <span className="fade-in" style={{ animationDuration: 'var(--duration-fast, 120ms)' }}>
            {showLoading ? <GlassSpinner size={spinnerSize} /> : <CheckIcon />}
          </span>
        </span>
      )}

      {}
      <span
        className={[
          'flex items-center justify-center',
          isBusy ? 'opacity-0' : 'opacity-100',
          'transition-opacity duration-[var(--duration-fast,120ms)]',
        ].join(' ')}
        style={{ gap }}
      >
        {iconEl && (
          <span
            className="flex-shrink-0 flex items-center justify-center"
            data-btn-icon
            aria-hidden
          >
            {iconEl}
          </span>
        )}

        {childrenNode != null && childrenNode !== false && (
          <span data-btn-label className="leading-tight">
            {childrenNode}
          </span>
        )}

        {iconEndEl && (
          <span
            className="flex-shrink-0 flex items-center justify-center"
            data-btn-icon
            aria-hidden
          >
            {iconEndEl}
          </span>
        )}
      </span>
    </>
  );
}



export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      success = false,
      pressed,
      icon,
      iconEnd,
      children,
      className = '',
      disabled,
      asChild,
      type = 'button',
      haptic = true,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const sound = usePremiumSound();
    
    const showLoading = loading;
    const showSuccess = success && !loading;
    const isDisabled = Boolean(disabled) || showLoading;
    const isIconSize = ICON_SIZES.has(size);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic && !isDisabled) {
        sound.playTick();
      }
      onClick?.(e);
    };

    
    devWarn(
      loading && success,
      'Both `loading` and `success` are true. `loading` takes precedence.',
    );
    devWarn(
      isIconSize && !rest['aria-label'] && !rest['aria-labelledby'],
      'Icon-only buttons require `aria-label` or `aria-labelledby`.',
    );
    devWarn(
      Boolean(asChild) && Children.count(children) !== 1,
      '`asChild` expects exactly one child element.',
    );
    devWarn(
      variant === 'link' && (icon != null || iconEnd != null),
      'Link variant ignores icons — remove them or use ghost.',
    );

    
    const variantClass = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
    const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.md;

    const computedClass = [
      BASE_CLASSES,
      variantClass,
      sizeClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const gap = SIZE_GAP[size];

    
    const content = buildContent({
      iconEl: icon,
      iconEndEl: iconEnd,
      childrenNode: !isIconSize ? children : null,
      showLoading,
      showSuccess,
      spinnerSize: getSpinnerSize(size),
      gap,
    });

    
    const sharedAttrs: Record<string, unknown> = {
      'aria-busy': showLoading || undefined,
      'aria-pressed': typeof pressed === 'boolean' ? pressed : undefined,
      'aria-disabled': isDisabled || undefined,
      'data-loading': showLoading || undefined,
      'data-success': showSuccess || undefined,
      'data-icon-only': isIconSize || undefined,
      'data-variant': variant,
      'data-size': size,
      ...rest,
      onClick: handleClick,
    };

    
    if (asChild) {
      if (!isValidElement(children)) {
        devWarn(true, '`asChild` used without valid child — falling back to <button>.');
        return (
          <button
            ref={ref}
            type={type}
            className={computedClass}
            disabled={isDisabled}
            {...sharedAttrs}
          >
            {content}
          </button>
        );
      }

      const child = children as ReactElement<{
        className?: string;
        disabled?: boolean;
        children?: ReactNode;
      }>;

      const childProps = child.props ?? {};
      const mergedClassName = [computedClass, childProps.className]
        .filter(Boolean)
        .join(' ');

      // Preserve child's own children as the visible label
      const labelContent = isIconSize ? null : childProps.children;
      const childAwareContent = buildContent({
        iconEl: icon,
        iconEndEl: iconEnd,
        childrenNode: labelContent,
        showLoading,
        showSuccess,
        spinnerSize: getSpinnerSize(size),
        gap,
      });

      const mergedProps: Record<string, unknown> = {
        ...sharedAttrs,
        className: mergedClassName,
        children: childAwareContent,
      };

      // Only forward `disabled` if the child supports it (e.g. <button>, <input>)
      if ('disabled' in childProps) {
        mergedProps.disabled = isDisabled;
      }

      // Slot merges refs + event handlers safely
      return (
        <Slot ref={ref} {...(mergedProps as object)}>
          {cloneElement(child, { className: '' } as never)}
        </Slot>
      );
    }

    
    return (
      <button
        ref={ref}
        type={type}
        className={computedClass}
        disabled={isDisabled}
        {...sharedAttrs}
      >
        {content}
      </button>
    );
  },
);

GlassButton.displayName = 'GlassButton';

export default GlassButton;

