import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/design';

export type SelectStatus = 'default' | 'error' | 'warning' | 'success';
export type SelectSize = 'sm' | 'md' | 'lg';

export interface GlassSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  status?: SelectStatus;
  size?: SelectSize;
  options?: Array<{ label: string; value: string | number; disabled?: boolean }>;
  placeholder?: string;
  /** @deprecated accepted for compatibility; not used */
  disableRefraction?: boolean;
  /** @deprecated accepted for compatibility; not used */
  disableMotion?: boolean;
  /** @deprecated accepted for compatibility; not used */
  decorative?: boolean;
  /** @deprecated accepted for compatibility; not used */
  noReflection?: boolean;
}

const SIZE: Record<SelectSize, string> = {
  sm: 'h-8 text-base sm:text-xs px-2.5',
  md: 'h-10 text-[16px] sm:text-sm px-3',
  lg: 'h-12 text-[16px] sm:text-[15px] px-3.5',
};

const STATUS: Record<SelectStatus, string> = {
  default:
    'border-black/[0.08] dark:border-white/[0.10] hover:border-black/[0.15] dark:hover:border-white/[0.20] focus:border-apple-blue focus:shadow-[0_0_0_3px_var(--focus-ring)]',
  error: 'border-apple-red focus:border-apple-red focus:shadow-[0_0_0_3px_var(--focus-ring-danger)]',
  warning:
    'border-apple-orange focus:border-apple-orange focus:shadow-[0_0_0_3px_var(--focus-ring)]',
  success: 'border-apple-green focus:border-apple-green focus:shadow-[0_0_0_3px_var(--focus-ring)]',
};

/**
 * Native select in a restrained shell. `placeholder` renders a disabled
 * empty-value option; `options` render plain <option> children.
 */
export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(function GlassSelect(
  {
    label,
    error,
    hint,
    required,
    status = 'default',
    size = 'md',
    options = [],
    placeholder,
    className,
    children,
    id: idProp,
    ...props
  },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const effective: SelectStatus = error ? 'error' : status;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-apple-red">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          aria-required={required || undefined}
          className={cn(
            'w-full appearance-none rounded-xl border bg-white/70 dark:bg-white/[0.05] dark:focus:bg-surface-900/90 backdrop-blur-xl backdrop-saturate-150 pr-9 text-[var(--text-primary)] outline-none shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)] transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50',
            SIZE[size],
            STATUS[effective],
            className,
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={String(o.value)} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        {/* Chevron */}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-apple-red">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[var(--text-tertiary)]">
          {hint}
        </p>
      )}
    </div>
  );
});

export default GlassSelect;
