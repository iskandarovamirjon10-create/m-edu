/**
 * Copilot Controls — premium, theme-aware interaction primitives.
 *
 * Intentionally local to the AI surface: the rest of the product keeps its
 * GlassButton system, while Copilot gets its own tactile language (spring
 * press, specular rim, accent glow) without leaking styles elsewhere.
 */
import {
  forwardRef,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────────────────
 * Button
 * ─────────────────────────────────────────────────────────────────────── */

export type CopilotButtonVariant = 'primary' | 'glass' | 'ghost' | 'tint' | 'danger';
export type CopilotButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

const VARIANT: Record<CopilotButtonVariant, string> = {
  primary: 'cp-btn--primary',
  glass: 'cp-btn--glass',
  ghost: 'cp-btn--ghost',
  tint: 'cp-btn--tint',
  danger: 'cp-btn--danger',
};

const SIZE: Record<CopilotButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px]',
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-12 px-5 text-[14px] rounded-[16px]',
  icon: 'h-11 w-11 p-0',
  'icon-sm': 'h-9 w-9 p-0',
};

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | 'onDrag'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onDragEnter'
  | 'onDragLeave'
  | 'onDragOver'
  | 'onDrop'
  | 'onAnimationStart'
  | 'onAnimationEnd'
  | 'onAnimationIteration'
  | 'onTransitionEnd'
>;

export interface CopilotButtonProps extends NativeButtonProps {
  variant?: CopilotButtonVariant;
  size?: CopilotButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  /** Wraps content in a spring-press animation (respects reduced motion). */
  tactile?: boolean;
}

export const CopilotButton = forwardRef<HTMLButtonElement, CopilotButtonProps>(
  function CopilotButton(
    {
      variant = 'glass',
      size = 'md',
      icon,
      iconEnd,
      loading = false,
      fullWidth = false,
      tactile = true,
      className,
      children,
      disabled,
      type = 'button',
      onPointerDown,
      onPointerUp,
      onPointerLeave,
      ...rest
    },
    ref,
  ) {
    const [pressed, setPressed] = useState(false);
    const iconOnly = !children && (size === 'icon' || size === 'icon-sm');

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        data-pressed={tactile && pressed ? 'true' : undefined}
        aria-busy={loading || undefined}
        onPointerDown={(event) => {
          if (!disabled && !loading) setPressed(true);
          onPointerDown?.(event);
        }}
        onPointerUp={(event) => {
          setPressed(false);
          onPointerUp?.(event);
        }}
        onPointerLeave={(event) => {
          setPressed(false);
          onPointerLeave?.(event);
        }}
        whileTap={tactile ? { scale: 0.97 } : undefined}
        transition={{ type: 'spring', stiffness: 520, damping: 30, mass: 0.6 }}
        className={cn(
          'cp-btn',
          VARIANT[variant],
          SIZE[size],
          fullWidth && 'w-full',
          iconOnly && 'shrink-0',
          className,
        )}
        {...rest}
      >
        <span aria-hidden="true" className="cp-btn__glow rounded-[inherit]" />
        {loading ? (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent motion-reduce:animate-none"
          />
        ) : (
          icon && <span className="relative shrink-0">{icon}</span>
        )}
        {children && <span className="relative truncate">{children}</span>}
        {iconEnd && <span className="relative shrink-0 opacity-80">{iconEnd}</span>}
      </motion.button>
    );
  },
);

/* ─────────────────────────────────────────────────────────────────────────
 * Icon button
 * ─────────────────────────────────────────────────────────────────────── */

export interface CopilotIconButtonProps
  extends Omit<CopilotButtonProps, 'children' | 'icon' | 'iconEnd' | 'size'> {
  label: string;
  icon: ReactNode;
  active?: boolean;
  size?: 'icon' | 'icon-sm';
}

export const CopilotIconButton = forwardRef<HTMLButtonElement, CopilotIconButtonProps>(
  function CopilotIconButton(
    { label, icon, active = false, variant = 'ghost', size = 'icon-sm', className, ...rest },
    ref,
  ) {
    return (
      <CopilotButton
        ref={ref}
        aria-label={label}
        aria-pressed={active || undefined}
        variant={variant}
        size={size}
        className={cn(
          'cp-icon-btn',
          size === 'icon' && '!h-11 !w-11',
          size === 'icon-sm' && '!h-9 !w-9',
          active && 'border-[color:var(--cp-accent-line)] bg-[color:var(--cp-accent-soft)] text-[color:var(--cp-accent)]',
          className,
        )}
        {...rest}
      >
        <span aria-hidden="true" className="flex items-center justify-center">
          {icon}
        </span>
      </CopilotButton>
    );
  },
);

/* ─────────────────────────────────────────────────────────────────────────
 * Segmented control
 * ─────────────────────────────────────────────────────────────────────── */

export interface CopilotSegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

export interface CopilotSegmentedProps<T extends string> {
  options: readonly CopilotSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function CopilotSegmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: CopilotSegmentedProps<T>) {
  const layoutId = useId();
  return (
    <div role="group" aria-label={ariaLabel} className={cn('cp-segment', className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className="cp-segment__item"
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                className="cp-segment__thumb"
                style={{ left: 0, right: 0 }}
                transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Small atoms
 * ─────────────────────────────────────────────────────────────────────── */

export function CopilotKbd({ children }: { children: ReactNode }) {
  return <kbd className="cp-kbd">{children}</kbd>;
}

export function CopilotStatusDot({ online, label }: { online: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('cp-live-dot', !online && 'cp-live-dot--offline')}
    />
  );
}

export function CopilotBadge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  className?: string;
}) {
  const tones: Record<typeof tone, string> = {
    neutral: 'bg-[color:var(--cp-surface-sunken)] text-[color:var(--cp-text-tertiary)] border-[color:var(--cp-hairline)]',
    accent: 'bg-[color:var(--cp-accent-soft)] text-[color:var(--cp-accent)] border-[color:var(--cp-accent-line)]',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
