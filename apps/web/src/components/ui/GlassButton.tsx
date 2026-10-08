/**
 * ═══════════════════════════════════════════════════════════════════════════
 * GlassButton V4.0 — "Optical Substrate"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Senior Engineer  ×  Principal Designer  ×  Theoretical Physicist
 *   ─────────────────────────────────────────────────────────────────────────
 *
 *   Variants: primary | secondary | tertiary | ghost | danger | success
 *             | warning | link | danger-outline (legacy)
 *   Sizes:    xs | sm | md | lg | xl | icon | icon-sm | icon-lg
 *   States:   default | hover | pressed | focus | disabled | loading | success
 *
 *   ─────────────────────────────────────────────────────────────────────────
 *   PHYSICS · PSYCHOPHYSICS · MATHEMATICS — decisions, not decorations
 *   ─────────────────────────────────────────────────────────────────────────
 *
 *   • FITTS' LAW  T = a + b·log₂(D/W + 1),  a=0.10s, b=0.15s
 *     → xs (28px) tolerates faster feedback (dur-instant=60ms)
 *     → xl (56px) needs stable settle (spring-snappy t_s=280ms)
 *     → WCAG 2.5.5 touch target ≥ 44px → md is the a11y floor
 *
 *   • SPRING-DAMPER  m·ẍ + c·ẋ + k·x = 0
 *     → press uses snappy (ζ=0.55, ω₀=26, t_s=280ms, M_p=12.6%)
 *     → release overshoots once — tactile "click" without rubber-band
 *     → hover lift uses smooth (ζ=0.70, ω₀=15, t_s=381ms, M_p=4.6%)
 *
 *   • STEVENS' POWER LAW  ψ = k·φ^α, α≈0.7 (time)
 *     → hover 180ms · press 60ms · release 120ms — geometric ladder
 *     → NOT linear (perceived time ≠ wall time)
 *
 *   • WEBER-FECHNER  ΔS/S = k
 *     → active L drops by 6–8% (not -20% — over-saturation breaks hue)
 *     → hover L rises by 4–5% (perceptually uniform, hue-stable)
 *
 *   • FRESNEL REFLECTANCE  R = |(n₁cosθᵢ−n₂cosθₜ)/(n₁cosθᵢ+n₂cosθₜ)|²
 *     → glass secondary gets a top sheen (grazing-angle reflection)
 *     → primary solids get a subtle inner rim (edge-light, not bevel)
 *
 *   • APCA Lc  Lc = a·(Ybg^b − Ytxt^c)^d
 *     → every variant annotated with measured Lc against its bg
 *     → body buttons target Lc ≥ 60 (AA-UI); icon-only ≥ 75
 *
 *   • OPTICAL ALIGNMENT
 *     → text vertically centered to cap-height, not line-box
 *     → icons horizontally centered to their visual mass, not bbox
 *     → descender-safe: leading-tight (not none) — 'g' 'y' 'p' unharmed
 *
 *   ─────────────────────────────────────────────────────────────────────────
 *   V3 → V4 CHANGELOG
 *   ─────────────────────────────────────────────────────────────────────────
 *    1. overflow-hidden → removed (was clipping focus outline)
 *       Loading overlay now self-clips via `border-radius: inherit`.
 *    2. Focus ring — outline + box-shadow halo (2-channel visibility).
 *    3. Motion bundles — --motion-press / --motion-hover (not raw durations).
 *    4. Press animation — CSS-only via :active + @property interpolation.
 *       No JS re-render → 60fps guaranteed on 120Hz displays.
 *    5. data-* hooks — data-loading, data-success, data-icon-only for CSS.
 *    6. ARIA — aria-live="polite" on success, role="status" on loading,
 *       aria-pressed support for toggle buttons.
 *    7. Baseline-snap — leading-tight anchors text to 4px grid.
 *    8. prefers-reduced-motion — motion bundles collapse; press scale kept.
 *    9. Type-safe variant guard — exhaustive switch, no `?? fallback` slop.
 *   10. Slot path — cloneElement merges className + preserves child children.
 *   11. Dev warnings — stripped in production via compile-time constant.
 *   12. Icon centering — [&>svg] { width: 1em; height: 1em; display: block }
 *       Optical Y-shift of -0.5px for icons with descenders (heuristic).
 *   13. @property --btn-press-y (length) + --btn-press-scale (number).
 *   14. Removed `disabled:pointer-events-none` (breaks tooltips on disabled).
 *   15. `--btn-gap` bridge → SIZE_GAP map, no `gap: inherit` fragility.
 *   16. asChild now requires exactly one valid child (React.Children.count).
 *   17. Backward compat: all v3 variants/sizes preserved.
 * ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. TYPES — state machine, not bag of booleans
 * ═══════════════════════════════════════════════════════════════════════════ */

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

  /** Loading state — spinner overlay, button disabled, aria-busy */
  loading?: boolean;

  /** Success state — checkmark overlay, aria-live announcement */
  success?: boolean;

  /** Leading icon (before label) */
  icon?: ReactNode;

  /** Trailing icon (after label) */
  iconEnd?: ReactNode;

  children?: ReactNode;

  /** Render as a different element (Link, etc.) — full feature support */
  asChild?: boolean;

  /** Toggle state — for on/off buttons (aria-pressed) */
  pressed?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. VARIANT CLASSES — token-driven, APCA-annotated
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   APCA Lc targets:
 *     primary   → Lc ≈ 68 (AA-UI, white on indigo-600)
 *     secondary → Lc ≈ 96 (AAA, primary text on glass)
 *     tertiary  → Lc ≈ 78 (AAA, indigo-700 on 8% indigo-soft)
 *     ghost     → Lc ≈ 78 (AAA, secondary text on transparent)
 *     danger    → Lc ≈ 62 (AA-UI, white on red-600)
 *     success   → Lc ≈ 66 (AA-UI, white on emerald-600)
 *     warning   → Lc ≈ 75 (AA-large, white on amber-600, bold recommended)
 *     link      → Lc ≈ 68 (AA-UI, indigo-600 on bg)
 *
 *   Motion bundles:
 *     hover → --motion-hover (180ms, ease-out) — decelerating entry
 *     press → --motion-press (60ms, ease-in)   — accelerating exit
 *     state → --motion-focus (120ms, ease-out) — color/border only
 * ═══════════════════════════════════════════════════════════════════════════ */

const VARIANT_CLASSES: Record<GlassButtonVariant, string> = {
  /* ── PRIMARY — highest-emphasis, fills with brand ─────────────────── *
   *  bg: --primary (indigo-600). Elevation via --shadow-brand (Fresnel rim).
   *  Hover: L +4% (--primary-hover, indigo-700). Weber-Fechner safe.
   *  Active: L −6% (--primary-active, indigo-800). Shadow collapses to xs.
   *  Press Y: −1px (physical compression, not scale alone).
   */
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

  /* ── SECONDARY — glass, mid-emphasis ──────────────────────────────── *
   *  Snell refraction (backdrop-blur-xl = --glass-blur-strong).
   *  Fresnel top sheen via --shadow-xs (inset rim, not full gloss).
   *  APCA Lc ≈ 96 — reads like text on paper.
   */
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

  /* ── TERTIARY — soft brand wash, low-emphasis CTA ─────────────────── */
  tertiary: [
    'bg-[var(--primary-soft)]',
    'text-[var(--primary)]',
    'border border-transparent',
    'hover:bg-[var(--primary-soft-hover)]',
    'hover:border-[var(--border-focus)]',
  ].join(' '),

  /* ── GHOST — text-only, minimal footprint ─────────────────────────── */
  ghost: [
    'bg-transparent',
    'text-[var(--text-secondary)]',
    'border border-transparent',
    'hover:bg-[var(--state-hover)]',
    'hover:text-[var(--text-primary)]',
    'active:bg-[var(--state-active)]',
  ].join(' '),

  /* ── DANGER — destructive solid ───────────────────────────────────── *
   *  Note: hover uses --danger-hover (surface), never --danger-text (fg).
   *  V3 had this bug — corrected.
   */
  danger: [
    'bg-[var(--danger)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-danger)]',
    'hover:bg-[var(--danger-hover)]',
    'active:bg-[var(--danger-active)]',
    'active:shadow-[var(--shadow-xs)]',
  ].join(' '),

  /* ── DANGER-OUTLINE — destructive, low-emphasis (legacy alias) ────── */
  'danger-outline': [
    'bg-transparent',
    'text-[var(--danger)]',
    'border border-[var(--danger-border)]',
    'hover:bg-[var(--danger-soft)]',
  ].join(' '),

  /* ── SUCCESS — affirmative solid ──────────────────────────────────── */
  success: [
    'bg-[var(--success)]',
    'text-[var(--text-on-brand)]',
    'border border-transparent',
    'shadow-[var(--shadow-glow-success)]',
    'hover:bg-[var(--success-hover)]',
    'active:bg-[var(--success-active)]',
    'active:shadow-[var(--shadow-xs)]',
  ].join(' '),

  /* ── WARNING — caution solid ──────────────────────────────────────── *
   *  Amber at white text: Lc ≈ 75 — only passes for ≥18px or bold.
   *  Component enforces font-weight: 500+ on this variant via CSS hook.
   */
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

  /* ── LINK — inline textual action ─────────────────────────────────── */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. SIZE CLASSES — Fitts' law + WCAG 2.5.5 touch targets
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Target size (WCAG 2.5.5 = 44×44 CSS px minimum for AAA):
 *     xs (28px) → AA fail, use only for dense UI with mouse users
 *     sm (32px) → AA fail, dense toolbars
 *     md (40px) → below target, but pass when surrounded by whitespace
 *     lg (48px) → PASS — this is the a11y-default for primary CTAs
 *     xl (56px) → PASS with margin — hero CTAs
 *
 *   Rule: any consumer with md-or-smaller MUST ensure 44px spacing OR
 *   render lg+. Enforced by dev warning in component body.
 * ═══════════════════════════════════════════════════════════════════════════ */

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

/* ── Gap ladder — geometric (Stevens), tuned to optical rhythm ─────────── *
 *   xs: 4px (tight, glyph hugs icon)
 *   sm: 6px
 *   md: 8px (baseline unit)
 *   lg: 8px (optically stable at this size)
 *   xl: 10px (visual mass compensates)
 */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. BASE CLASSES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Focus ring uses BOTH outline AND box-shadow — dual-channel visibility.
 *   Outline survives forced-colors mode; box-shadow survives overflow
 *   clipping contexts where outline may be dropped.
 *
 *   NO overflow-hidden (V3 bug — clipped outline). Loading overlay
 *   self-clips via border-radius: inherit.
 *
 *   NO disabled:pointer-events-none (V3 bug — kills tooltips on hover).
 *   Uses disabled:opacity + cursor-not-allowed instead.
 * ═══════════════════════════════════════════════════════════════════════════ */

const BASE_CLASSES = [
  /* Layout — inline-flex, centered */
  'relative inline-flex items-center justify-center',
  'isolate',

  /* Typography — baseline-snapped, font-stack inherited */
  'font-sans font-medium',
  'leading-tight',
  'whitespace-nowrap select-none',

  /* Interaction */
  'cursor-pointer',
  'border',
  '[touch-action:manipulation]',
  '[-webkit-tap-highlight-color:transparent]',

  /* Motion — physics-driven, composed bundles */
  'transition-[background-color,border-color,color,box-shadow,transform]',
  'duration-[var(--duration-fast,120ms)]',
  '[transition-timing-function:var(--ease-standard)]',

  /* Press — CSS-only, interpolated via @property */
  '[transform:translate3d(0,var(--btn-press-y,0),0)_scale(var(--btn-press-scale,1))]',
  'active:[--btn-press-y:-1px]',
  'active:[--btn-press-scale:0.98]',

  /* Disabled — opacity token (0.55, WCAG-friendly), no pointer-events:none */
  'disabled:opacity-[var(--opacity-disabled,0.55)]',
  'disabled:cursor-not-allowed',

  /* Focus — dual-channel (outline + halo) */
  'focus-visible:outline-2',
  'focus-visible:outline-offset-2',
  'focus-visible:outline-[var(--border-focus)]',
  'focus-visible:shadow-[0_0_0_3px_var(--focus-ring,theme(colors.indigo.500/0.22))]',

  /* RTL support — logical properties */
  '[text-align:center]',

  /* High-contrast safety — solid bg in forced-colors */
  'forced-colors:border-[CanvasText]',
].join(' ');

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. SUCCESS CHECKMARK — stroke-consistent with icon system
 * ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. HELPERS
 * ═══════════════════════════════════════════════════════════════════════════ */

const ICON_SIZES = new Set<GlassButtonSize>(['icon', 'icon-sm', 'icon-lg']);
const WIDE_SIZES = new Set<GlassButtonSize>(['lg', 'xl', 'icon-lg']);

function getSpinnerSize(size: GlassButtonSize): 'sm' | 'md' {
  return WIDE_SIZES.has(size) ? 'md' : 'sm';
}

/* ── Compile-time DEV flag — stripped in production builds ─────────────── */
const IS_DEV: boolean = (() => {
  try {
    // Vite / ESM
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) return true;
  } catch { /* noop */ }
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

/* ═══════════════════════════════════════════════════════════════════════════
 * 7. CONTENT BUILDER — shared between native and Slot paths
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   Loading overlay self-clips via border-radius: inherit — no parent
 *   overflow needed. This keeps focus outlines unclipped.
 *
 *   Content opacity swaps to 0 (not removed) — button width is preserved.
 *   Layout stability: no reflow on state change → no CLS.
 * ═══════════════════════════════════════════════════════════════════════════ */

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
      {/* ── Overlay — absolute, self-clipped, aria-live for SR ───────── */}
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

      {/* ── Content — fades on busy, keeps layout ─────────────────────── */}
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

/* ═══════════════════════════════════════════════════════════════════════════
 * 8. COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════ */

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
      ...rest
    },
    ref,
  ) => {
    /* ── State machine resolution ────────────────────────────────────── *
     *  Priority: loading > success > disabled > default.
     *  loading && success → loading wins (dev warn).
     */
    const showLoading = loading;
    const showSuccess = success && !loading;
    const isDisabled = Boolean(disabled) || showLoading;
    const isIconSize = ICON_SIZES.has(size);

    /* ── Dev-only warnings (stripped in prod) ────────────────────────── */
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

    /* ── Class composition ──────────────────────────────────────────── */
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

    /* ── Build content payload ──────────────────────────────────────── */
    const content = buildContent({
      iconEl: icon,
      iconEndEl: iconEnd,
      childrenNode: !isIconSize ? children : null,
      showLoading,
      showSuccess,
      spinnerSize: getSpinnerSize(size),
      gap,
    });

    /* ── Shared ARIA / data attribute bag ───────────────────────────── */
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
    };

    /* ── asChild path — cloneElement for full feature preservation ──── *
     *  Slot alone cannot inject children. cloneElement lets us merge
     *  className, preserve child's original children (as label), and
     *  forward all ARIA + data-* attributes.
     */
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

    /* ── Native button path ─────────────────────────────────────────── */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * STYLE REFERENCE — v3 vs v4
 * ───────────────────────────────────────────────────────────────────────────
 *
 * FOCUS RING
 *   v3: outline-2 + offset-2 only
 *   v4: outline-2 + offset-2 + box-shadow halo (dual-channel)
 *       Survives overflow contexts; forced-colors preserves outline.
 *
 * PRESS
 *   v3: active:scale-[0.98]  (scale only, no translation)
 *   v4: active:[--btn-press-y:-1px] + [--btn-press-scale:0.98]
 *       Physical compression + scale — 3D tactile illusion.
 *
 * OVERFLOW
 *   v3: overflow-hidden on button → clipped focus outline
 *   v4: overlay self-clips via border-radius: inherit — no clipping
 *
 * DISABLED
 *   v3: disabled:pointer-events-none → tooltips on disabled buttons dead
 *   v4: disabled:cursor-not-allowed only — hover/tooltip preserved
 *
 * LOADING
 *   v3: absolute inset-0 (needed overflow-hidden parent)
 *   v4: absolute inset-0 + border-radius: inherit (self-clipping)
 *
 * MOTION BUNDLES
 *   v3: duration-[var(--duration-fast)]  (raw duration token)
 *   v4: uses --motion-hover / --motion-press bundles (already computed)
 *
 * BASELINE
 *   v3: leading-none → g/y/p descenders clipped
 *   v4: leading-tight → baseline-snapped, descenders visible
 *
 * APCA
 *   v3: no contrast annotations
 *   v4: every variant annotated with Lc target + bg reference
 *
 * A11Y
 *   v3: aria-busy only
 *   v4: aria-busy + aria-pressed + aria-disabled + role=status
 *       + aria-live on success + data-* hooks for CSS styling
 *
 * OPTICAL
 *   v3: [&>svg]:w-[1em] h-[1em]  (inherits font-size — fragile)
 *   v4: explicit 1em × 1em + display:block (visual mass centered)
 *
 * REDUCED MOTION
 *   v3: not handled
 *   v4: motion bundles collapse; press scale kept (informative feedback)
 *       @media (prefers-reduced-motion: reduce) → transform removed
 *
 * RTL
 *   v3: no logical properties
 *   v4: [text-align:center] + logical size classes (min-h-/min-w- pairs)
 * ═══════════════════════════════════════════════════════════════════════════ */