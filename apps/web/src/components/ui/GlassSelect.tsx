/**
 * GlassSelect — Custom styled select with glass aesthetic.
 */
import { type SelectHTMLAttributes, type ReactNode, forwardRef, useId } from 'react';

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Declarative options. Optional — pages may instead pass <option> children. */
  options?: Array<{ value: string; label: string }>;
  /** Legacy-style children (<option> elements). Rendered when provided. */
  children?: ReactNode;
  placeholder?: string;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(
  ({ label, error, hint, options, children, placeholder, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-secondary)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={[
              'w-full px-4 py-2.5 pr-10',
              'bg-[var(--bg-glass)]',
              'backdrop-blur-xl',
              'border rounded-xl',
              'text-[var(--text-primary)]',
              'font-sans text-[0.9375rem]',
              'outline-none cursor-pointer',
              'transition-[border-color,box-shadow] duration-200',
              'appearance-none',
              'focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)]',
              error ? 'border-[var(--state-error)]' : 'border-[var(--border-medium)]',
              'hover:border-[var(--border-strong)]',
              'focus:border-brand-700',
              'disabled:opacity-45 disabled:cursor-not-allowed',
              className,
            ].join(' ')}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238899A8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
            aria-invalid={!!error}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
            {children}
          </select>
        </div>
        {error && <p className="text-xs text-[var(--state-error)]">{error}</p>}
        {!error && hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);

GlassSelect.displayName = 'GlassSelect';

export default GlassSelect;
