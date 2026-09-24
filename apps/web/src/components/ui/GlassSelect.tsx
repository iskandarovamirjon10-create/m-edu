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
              error
                ? 'border-[var(--state-error)] focus:shadow-[0_0_0_3px_rgba(240,112,112,0.18)]'
                : 'border-[var(--border-medium)]',
              'hover:border-[var(--border-strong)] hover:bg-[var(--bg-glass-hover)]',
              'focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)] focus:bg-[var(--bg-elevated)]',
              'disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-[var(--state-disabled)]',
              className,
            ].join(' ')}
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238899A8' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
            }}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
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
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--state-error)] flex items-center gap-1" role="alert">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--text-muted)]">{hint}</p>
        )}
      </div>
    );
  },
);

GlassSelect.displayName = 'GlassSelect';

export default GlassSelect;