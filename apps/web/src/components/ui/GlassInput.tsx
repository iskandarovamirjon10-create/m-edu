/**
 * GlassInput — Text input with floating label and all states.
 */
import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from 'react';

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--text-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full px-4 py-2.5',
            'bg-[var(--bg-glass)]',
            'backdrop-blur-xl',
            'border rounded-xl',
            'text-[var(--text-primary)]',
            'placeholder:text-[var(--text-muted)]',
            'font-sans text-[0.9375rem]',
            'outline-none',
            'transition-[border-color,box-shadow,background-color] duration-200',
            error
              ? 'border-[var(--state-error)] focus:shadow-[0_0_0_3px_rgba(240,112,112,0.18)]'
              : 'border-[var(--border-medium)]',
            'hover:border-[var(--border-strong)] hover:bg-[var(--bg-glass-hover)]',
            'focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)] focus:bg-[var(--bg-elevated)]',
            'disabled:opacity-45 disabled:cursor-not-allowed disabled:bg-[var(--state-disabled)]',
            className,
          ].join(' ')}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--state-error)] flex items-center gap-1" role="alert">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
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

GlassInput.displayName = 'GlassInput';

interface GlassTextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const GlassTextArea = forwardRef<HTMLTextAreaElement, GlassTextAreaProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={[
            'w-full px-4 py-2.5 min-h-[100px] resize-y',
            'bg-[var(--bg-glass)]',
            'backdrop-blur-xl',
            'border rounded-xl',
            'text-[var(--text-primary)]',
            'placeholder:text-[var(--text-muted)]',
            'font-sans text-[0.9375rem]',
            'outline-none',
            'transition-[border-color,box-shadow] duration-200',
            error
              ? 'border-[var(--state-error)]'
              : 'border-[var(--border-medium)]',
            'hover:border-[var(--border-strong)]',
            'focus:border-brand-700 focus:shadow-[0_0_0_3px_rgba(84,115,252,0.18)]',
            'disabled:opacity-45 disabled:cursor-not-allowed',
            className,
          ].join(' ')}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...rest}
        />
        {error && <p className="text-xs text-[var(--state-error)]">{error}</p>}
        {!error && hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  },
);

GlassTextArea.displayName = 'GlassTextArea';

export default GlassInput;
