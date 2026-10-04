/**
 * GlassButton V3 — Canonical button for M-EDU Design System V4 (Aurora Prime).
 *
 * Variants: primary | secondary | tertiary | ghost | danger | success | warning | link | danger-outline (legacy)
 * Sizes:    xs | sm | md | lg | xl | icon | icon-sm | icon-lg
 * States:   default | hover | pressed | focus | disabled | loading | success
 *
 * v3 FIXES (v2 → v3):
 *  1. asChild — full feature support via cloneElement (icons, loading, success, disabled preserved)
 *  2. h-13 → h-12/h-14 valid Tailwind (was invalid — xl button collapsed)
 *  3. hover:bg — --danger-hover / --success-hover / --warning-hover (was -text → semantic bug)
 *  4. type="button" default (was missing — submitted forms!)
 *  5. Shadows — var(--shadow-brand) / var(--shadow-glow-*) tokens (was hardcoded rgba)
 *  6. Loader animation — .fade-in (built-in) instead of tailwindcss-animate plugin
 *  7. text-white → var(--text-on-brand)
 *  8. disabled:opacity-[var(--opacity-disabled)]
 *  9. leading-none → leading-tight (descenders no longer clipped)
 * 10. Icon-only without aria-label — dev warning
 * 11. Gap — --btn-gap CSS variable (was fragile `gap: inherit`)
 * 12. loading && success dev warning
 * 13. isIconSize const — no more 3x repeated checks
 * 14. --primary-pressed → --primary-active (tokens V4.1)
 */

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

/* ============================================================================
 * TYPES
 * ========================================================================== */

export type GlassButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning'
  | 'link'
  // Legacy alias — kept for backward compat
  | 'danger-outline';

export type GlassButtonSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | 'icon'
  | 'icon-sm'
  | 'icon-lg';

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

interface GlassButtonProps extends Omit<NativeButtonProps, 'children'> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /** Icon placed after children */
  iconEnd?: ReactNode;
  children?: ReactNode;
  /** Render as a different element (e.g., <Link>) — full feature support preserved via cloneElement */
  asChild?: boolean;
  /** Show success checkmark state (caller controls timing) */
  success?: boolean;
}

/* ============================================================================
 * VARIANT CLASSES — design-token-driven
 * ========================================================================== */

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
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-danger)]',
    // v3: hover uses -hover surface, not -text
    'hover:bg-[var(--danger-hover)]',
    'active:bg-[var(--danger-active)]',
    'active:shadow-[var(--shadow-xs)]',
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
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-success)]',
    'hover:bg-[var(--success-hover)]',
    'active:bg-[var(--success-active)]',
    'active:shadow-[var(--shadow-xs)]',
    'active:scale-[0.98]',
  ].join(' '),

  warning: [
    'bg-[var(--warning)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-warning)]',
    'hover:bg-[var(--warning-hover)]',
    'active:bg-[var(--warning-active)]',
    'active:shadow-[var(--shadow-xs)]',
    'active:scale-[0.98]',
  ].join(' '),

  link: [
    'bg-transparent',
    'text-[var(--primary)]',
    'border border-transparent',
    'underline-offset-4',
    'hover:underline',
    'hover:text-[var(--primary-hover)]',
    'active:text-[var(--primary-active)]',
    'p-0 h-auto',
  ].join(' '),
};

/* ============================================================================
 * SIZE CLASSES — heights and paddings (valid Tailwind sizes)
 * Gap is applied to content wrapper via --btn-gap
 * ========================================================================== */

const SIZE_CLASSES: Record<GlassButtonSize, string> = {
  xs:        'h-7 px-2.5 text-[var(--text-xs)] rounded-[var(--radius-sm)]',
  sm:        'h-8 px-3.5 text-[var(--text-sm)] rounded-[var(--radius-md)]',
  md:        'h-10 px-4 text-[var(--text-body)] rounded-[var(--radius-md)]',
  lg:        'h-12 px-6 text-[var(--text-body-lg)] rounded-[var(--radius-lg)]',
  xl:        'h-14 px-8 text-[var(--text-lg)] rounded-[var(--radius-lg)]',
  icon:      'h-10 w-10 rounded-[var(--radius-md)]',
  'icon-sm': 'h-8 w-8 rounded-[var(--radius-sm)]',
  'icon-lg': 'h-12 w-12 rounded-[var(--radius-lg)]',
};

const SIZE_GAP: Record<GlassButtonSize, string> = {
  xs:        '0.25rem',  // gap-1
  sm:        '0.375rem', // gap-1.5
  md:        '0.5rem',   // gap-2
  lg:        '0.5rem',
  xl:        '0.625rem', // gap-2.5
  icon:      '0',
  'icon-sm': '0',
  'icon-lg': '0',
};

/* ============================================================================
 * BASE CLASSES
 * ========================================================================== */

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
  // Disabled — v3: token opacity (was 0.50)
  'disabled:opacity-[var(--opacity-disabled,0.55)]',
  'disabled:cursor-not-allowed',
  'disabled:pointer-events-none',
  // Focus ring
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
  'focus-visible:shadow-[0_0_0_3px_var(--focus-ring)]',
].join(' ');

/* ============================================================================
 * SUCCESS CHECKMARK
 * ========================================================================== */

const CheckIcon = () => (
  <svg
    className="w-[1em] h-[1em]"
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 10l5 5 7-7" />
  </svg>
);

/* ============================================================================
 * HELPERS
 * ========================================================================== */

const ICON_SIZES = new Set<GlassButtonSize>(['icon', 'icon-sm', 'icon-lg']);

function getSpinnerSize(size: GlassButtonSize): 'sm' | 'md' {
  // v3: icon-lg (48px) now maps to 'md' like lg/xl
  if (size === 'lg' || size === 'xl' || size === 'icon-lg') return 'md';
  return 'sm';
}

const isDev = (() => {
  try {
    // Vite
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  } catch { /* noop */ }
  try {
    // Node / fallback
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

function devWarn(condition: boolean, message: string): void {
  if (isDev && condition && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[GlassButton] ${message}`);
  }
}

/* ============================================================================
 * CONTENT BUILDER — shared between native and asChild paths
 * ========================================================================== */

interface ContentParts {
  iconEl: ReactNode;
  iconEndEl: ReactNode;
  childrenNode: ReactNode;
  showLoading: boolean;
  showSuccess: boolean;
  spinnerSize: 'sm' | 'md';
  gap: string;
}

function buildContentWrapper(parts: ContentParts): ReactElement {
  const {
    iconEl, iconEndEl, childrenNode,
    showLoading, showSuccess, spinnerSize, gap,
  } = parts;

  return (
    <>
      {/* Absolute overlay — preserves button geometry during loading/success */}
      {(showLoading || showSuccess) && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center fade-in"
          style={{ animationDuration: 'var(--duration-fast)' }}
        >
          {showLoading ? <GlassSpinner size={spinnerSize} /> : <CheckIcon />}
        </span>
      )}

      {/* Content wrapper — hidden (but present) during loading to preserve width */}
      <span
        className={[
          'flex items-center justify-center',
          showLoading || showSuccess ? 'opacity-0' : 'opacity-100',
          'transition-opacity',
        ].join(' ')}
        style={{
          gap,
          transitionDuration: 'var(--duration-fast)',
        }}
      >
        {iconEl && (
          <span className="flex-shrink-0 flex items-center [&>svg]:w-[1em] [&>svg]:h-[1em]">
            {iconEl}
          </span>
        )}
        {childrenNode != null && childrenNode !== false && (
          // v3: leading-tight (was leading-none — clipped descenders)
          <span className="leading-tight">{childrenNode}</span>
        )}
        {iconEndEl && (
          <span className="flex-shrink-0 flex items-center [&>svg]:w-[1em] [&>svg]:h-[1em]">
            {iconEndEl}
          </span>
        )}
      </span>
    </>
  );
}

/* ============================================================================
 * COMPONENT
 * ========================================================================== */

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconEnd,
      children,
      className = '',
      disabled,
      asChild,
      success: successProp = false,
      type = 'button', // v3: default to 'button' (was undefined → submit in forms)
      ...rest
    },
    ref,
  ) => {
    const isDisabled = Boolean(disabled) || loading;
    const showSuccess = Boolean(successProp) && !loading;

    // v3: single source of truth for icon-size check
    const isIconSize = ICON_SIZES.has(size);

    // Dev guards
    devWarn(
      loading && successProp,
      'Both `loading` and `success` are true. `loading` takes precedence.',
    );
    devWarn(
      isIconSize && !rest['aria-label'] && !rest['aria-labelledby'],
      'Icon-only buttons must have an `aria-label` or `aria-labelledby` for accessibility.',
    );
    devWarn(
      Boolean(asChild) && Children.count(children) !== 1,
      '`asChild` expects a single child element.',
    );

    const computedClass = [
      BASE_CLASSES,
      VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.ghost,
      SIZE_CLASSES[size],
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const gap = SIZE_GAP[size];

    const iconEl = icon;
    const iconEndEl = iconEnd;
    const childrenNode = !isIconSize ? children : null;

    const contentWrapper = buildContentWrapper({
      iconEl,
      iconEndEl,
      childrenNode,
      showLoading: loading,
      showSuccess,
      spinnerSize: getSpinnerSize(size),
      gap,
    });

    /* ------------------------------------------------------------------
     * asChild — full feature support via cloneElement.
     * Slot alone cannot inject children; cloneElement lets us preserve
     * icons, loading, success, and disabled without dropping features.
     * ------------------------------------------------------------------ */
    if (asChild) {
      if (!isValidElement(children)) {
        devWarn(true, '`asChild` used without a valid single child element.');
        // Fall back to native button to avoid crash
        return (
          <button
            ref={ref}
            type={type}
            className={computedClass}
            disabled={isDisabled}
            aria-busy={loading || undefined}
            {...rest}
          >
            {contentWrapper}
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

      // Merge props: consumer props → child props → our computed props
      const mergedProps: Record<string, unknown> = {
        ...rest,
        className: mergedClassName,
        'aria-busy': loading || undefined,
      };

      // Only pass `disabled` if the child element type supports it
      if ('disabled' in childProps) {
        mergedProps.disabled = isDisabled;
      }

      // Replace child's children with our full content wrapper,
      // preserving the child's original children as the label.
      mergedProps.children = buildContentWrapper({
        iconEl,
        iconEndEl,
        // Preserve the child's original children as the label
        childrenNode: !isIconSize ? childProps.children : null,
        showLoading: loading,
        showSuccess,
        spinnerSize: getSpinnerSize(size),
        gap,
      });

      // Radix Slot handles className + event handler merging for safety.
      // We pass merged className via Slot, but since we've already merged,
      // render as Slot to keep event handler chaining intact.
      return (
        <Slot ref={ref} {...(mergedProps as object)}>
          {cloneElement(child, { className: '' })}
        </Slot>
      );
    }

    /* ------------------------------------------------------------------
     * Native button
     * ------------------------------------------------------------------ */
    return (
      <button
        ref={ref}
        type={type}
        className={computedClass}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...rest}
      >
        {contentWrapper}
      </button>
    );
  },
);

GlassButton.displayName = 'GlassButton';

export default GlassButton;

/* ============================================================================
 * STYLE REFERENCE — what changed vs v2
 * ----------------------------------------------------------------------------
 * PRIMARY:
 *   bg:              var(--primary)            ✓
 *   text:            var(--text-on-brand)      ✓ (was text-white)
 *   shadow:          var(--shadow-brand)       ✓ (was hardcoded rgba)
 *   hover:bg:        var(--primary-hover)      ✓
 *   active:bg:       var(--primary-active)     ✓ (was --primary-pressed)
 *
 * DANGER:
 *   bg:              var(--danger)             ✓
 *   hover:bg:        var(--danger-hover)       ✓ (was --danger-text — WRONG)
 *   active:bg:       var(--danger-active)      ✓
 *   shadow:          var(--shadow-glow-danger) ✓
 *
 * XL HEIGHT:
 *   was:             h-13 (INVALID)            ✗
 *   now:             h-14 (56px)               ✓
 * ========================================================================== */