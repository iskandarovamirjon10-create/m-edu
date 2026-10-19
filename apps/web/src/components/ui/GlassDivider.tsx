/**
 * GlassDivider — simple Apple-premium divider.
 *
 * 1px line using tokens, orientation (horizontal/vertical), optional label,
 * thickness/variant/spacing support. Accepts all public props and keeps
 * `aria-orientation` + `role="separator"`. Removes any non-existent
 * shimmer keyframes.
 */
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerVariant = 'solid' | 'dashed' | 'dotted' | 'gradient' | 'glow';
export type DividerThickness = 'thin' | 'default' | 'thick';
export type DividerSpacing = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type DividerLabelAlign = 'start' | 'center' | 'end';

export interface GlassDividerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Optional label rendered between two lines (horizontal only). */
  children?: ReactNode;
  orientation?: DividerOrientation;
  variant?: DividerVariant;
  thickness?: DividerThickness;
  spacing?: DividerSpacing;
  labelAlign?: DividerLabelAlign;
  /** @deprecated no-op — variants no longer use a shimmer animation. */
  animated?: boolean;
  /** Extra classes for the label element. */
  labelClassName?: string;
  /** Extra classes for the line element(s). */
  lineClassName?: string;
}

/* ─────────────────────────────────────────────────────────────
 * Maps
 * ───────────────────────────────────────────────────────────── */

const SPACING_HORIZONTAL: Record<DividerSpacing, string> = {
  none: '',
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
  xl: 'my-10',
};

const SPACING_VERTICAL: Record<DividerSpacing, string> = {
  none: '',
  sm: 'mx-2',
  md: 'mx-4',
  lg: 'mx-6',
  xl: 'mx-10',
};

const THICKNESS_H: Record<DividerThickness, string> = {
  thin: 'h-px',
  default: 'h-px',
  thick: 'h-0.5',
};

const THICKNESS_V: Record<DividerThickness, string> = {
  thin: 'w-px',
  default: 'w-px',
  thick: 'w-0.5',
};

const BORDER_COLOR = 'border-black/[0.06] dark:border-white/[0.08]';

/* ─────────────────────────────────────────────────────────────
 * Line
 * ───────────────────────────────────────────────────────────── */

interface LineProps {
  orientation: DividerOrientation;
  variant: DividerVariant;
  thickness: DividerThickness;
  className?: string;
}

function Line({ orientation, variant, thickness, className }: LineProps) {
  const vertical = orientation === 'vertical';

  if (variant === 'dashed' || variant === 'dotted') {
    return (
      <div
        aria-hidden="true"
        className={cn(
          vertical
            ? (thickness === 'thick' ? 'border-l-2' : 'border-l')
            : (thickness === 'thick' ? 'border-t-2' : 'border-t'),
          variant === 'dashed' ? 'border-dashed' : 'border-dotted',
          BORDER_COLOR,
          vertical ? 'w-0' : 'h-0',
          className,
        )}
      />
    );
  }

  const bg =
    variant === 'gradient'
      ? vertical
        ? 'bg-gradient-to-b from-transparent via-black/[0.06] to-transparent dark:via-white/[0.08]'
        : 'bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.08]'
      : 'bg-black/[0.06] dark:bg-white/[0.08]';

  const style: CSSProperties | undefined = variant === 'glow'
    ? { boxShadow: '0 0 0 1px rgba(0, 122, 255, 0.15)' }
    : undefined;

  return (
    <div
      aria-hidden="true"
      className={cn(
        vertical ? THICKNESS_V[thickness] : THICKNESS_H[thickness],
        bg,
        className,
      )}
      style={style}
    />
  );
}

/* ─────────────────────────────────────────────────────────────
 * GlassDivider
 * ───────────────────────────────────────────────────────────── */

export const GlassDivider = forwardRef<HTMLDivElement, GlassDividerProps>(
  function GlassDivider(
    {
      children,
      className,
      orientation = 'horizontal',
      variant = 'solid',
      thickness = 'default',
      spacing = 'none',
      labelAlign = 'center',
      labelClassName,
      lineClassName,
      ...rest
    },
    ref,
  ) {
    const vertical = orientation === 'vertical';

    if (vertical) {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation="vertical"
          data-orientation="vertical"
          data-variant={variant}
          data-thickness={thickness}
          className={cn('inline-flex self-stretch', SPACING_VERTICAL[spacing], className)}
          {...rest}
        >
          <Line orientation="vertical" variant={variant} thickness={thickness} className={cn('self-stretch', lineClassName)} />
        </div>
      );
    }

    const shared = {
      role: 'separator' as const,
      'aria-orientation': 'horizontal' as const,
      'data-orientation': 'horizontal' as const,
      'data-variant': variant,
      'data-thickness': thickness,
    };

    if (!children) {
      return (
        <div ref={ref} {...shared} className={cn('w-full', SPACING_HORIZONTAL[spacing], className)} {...rest}>
          <Line orientation="horizontal" variant={variant} thickness={thickness} className={lineClassName} />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        {...shared}
        data-label-align={labelAlign}
        className={cn('flex w-full items-center gap-3', SPACING_HORIZONTAL[spacing], className)}
        {...rest}
      >
        {labelAlign !== 'start' && (
          <Line orientation="horizontal" variant={variant} thickness={thickness} className={cn('flex-1', lineClassName)} />
        )}
        <span className={cn('whitespace-nowrap text-xs font-medium text-tertiary', labelClassName)}>
          {children}
        </span>
        {labelAlign !== 'end' && (
          <Line orientation="horizontal" variant={variant} thickness={thickness} className={cn('flex-1', lineClassName)} />
        )}
      </div>
    );
  },
);

GlassDivider.displayName = 'GlassDivider';
export default GlassDivider;
