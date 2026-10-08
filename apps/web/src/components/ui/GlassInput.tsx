/**
 * GlassInput V2 — Text input system with full state coverage.
 * Includes: TextInput, PasswordInput, SearchInput, Textarea
 */
import {
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
  forwardRef,
  useId,
  useState,
} from 'react';
import { useSafeI18n } from '@/i18n/I18nProvider';

type InputStatus = 'default' | 'error' | 'warning' | 'success';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  status?: InputStatus;
  /** Icon/element rendered left of input */
  inputPrefix?: ReactNode;
  /** Icon/element rendered right of input */
  inputSuffix?: ReactNode;
}

interface GlassInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'>, BaseFieldProps {
  className?: string;
}

const STATUS_BORDER: Record<InputStatus, string> = {
  default: 'border-[var(--border-medium)] focus:border-[var(--border-focus)] focus:shadow-[0_0_0_3px_var(--focus-ring)]',
  error:   'border-[var(--danger)] focus:border-[var(--danger)] focus:shadow-[0_0_0_3px_var(--focus-ring-danger)]',
  warning: 'border-[var(--warning)] focus:border-[var(--warning)] focus:shadow-[0_0_0_3px_rgba(217,119,6,0.22)]',
  success: 'border-[var(--success)] focus:border-[var(--success)] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.22)]',
};

const STATUS_ICON_COLOR: Record<InputStatus, string> = {
  default: 'text-[var(--text-tertiary)]',
  error:   'text-[var(--danger)]',
  warning: 'text-[var(--warning)]',
  success: 'text-[var(--success)]',
};

const ErrorIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
  </svg>
);

function FieldWrapper({
  label,
  error,
  hint,
  required,
  id,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-[var(--text-label)] font-medium text-[var(--text-secondary)] flex items-center gap-1">
          {label}
          {required && (
            <span className="text-[var(--danger)] text-xs leading-none" aria-hidden>*</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-[var(--text-caption)] text-[var(--danger)]" role="alert">
          <ErrorIcon />
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-[var(--text-caption)] text-[var(--text-tertiary)]">{hint}</p>
      )}
    </div>
  );
}

const INPUT_BASE = [
  'w-full bg-[var(--bg-input)]',
  'text-[var(--text-primary)]',
  'placeholder:text-[var(--text-tertiary)]',
  'font-[var(--font-body)] text-[var(--text-body)]',
  'border rounded-[var(--radius-md)]',
  'outline-none',
  'transition-[border-color,box-shadow,background-color]',
  'duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
  'hover:bg-[var(--bg-input-focus)] hover:border-[var(--border-strong)]',
  'focus:bg-[var(--bg-input-focus)]',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--state-disabled-bg)]',
].join(' ');

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, hint, required, status, inputPrefix, inputSuffix, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const effectiveStatus: InputStatus = error ? 'error' : status ?? 'default';
    const hasSides = inputPrefix || inputSuffix;

    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} id={inputId}>
        <div className="relative flex items-center">
          {inputPrefix && (
            <span className={['absolute left-3 flex items-center pointer-events-none [&>svg]:w-4 [&>svg]:h-4', STATUS_ICON_COLOR[effectiveStatus]].join(' ')}>
              {inputPrefix}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              INPUT_BASE,
              STATUS_BORDER[effectiveStatus],
              hasSides ? (inputPrefix && inputSuffix ? 'px-9' : inputPrefix ? 'pl-9 pr-3.5' : 'pl-3.5 pr-9') : 'px-3.5',
              'py-2.5',
              className,
            ].join(' ')}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            aria-required={required}
            {...rest}
          />
          {inputSuffix && (
            <span className={['absolute right-3 flex items-center [&>svg]:w-4 [&>svg]:h-4', STATUS_ICON_COLOR[effectiveStatus]].join(' ')}>
              {inputSuffix}
            </span>
          )}
        </div>
      </FieldWrapper>
    );
  },
);

GlassInput.displayName = 'GlassInput';

/* ── Password Input ─────────────────────────────────────────── */
const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M3 3l18 18M10.477 10.477A3 3 0 0 0 13.5 13.5M6.228 6.228A10.451 10.451 0 0 0 2.458 12C3.732 16.057 7.523 19 12 19c1.7 0 3.3-.43 4.7-1.19M9.773 4.576A10.452 10.452 0 0 1 12 4.25c4.478 0 8.268 2.943 9.542 7a10.5 10.5 0 0 1-4.293 5.77" />
    </svg>
  );

export const GlassPasswordInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ label, error, hint, required, status, className = '', id, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const effectiveStatus: InputStatus = error ? 'error' : status ?? 'default';

    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} id={inputId}>
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={[
              INPUT_BASE,
              STATUS_BORDER[effectiveStatus],
              'px-3.5 pr-10 py-2.5',
              className,
            ].join(' ')}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            aria-required={required}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            className={[
              'absolute right-3 flex items-center justify-center min-w-[44px] min-h-[44px]',
              'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
              'transition-colors duration-[var(--duration-fast)]',
              'focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] rounded',
            ].join(' ')}
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            <EyeIcon open={visible} />
          </button>
        </div>
      </FieldWrapper>
    );
  },
);

GlassPasswordInput.displayName = 'GlassPasswordInput';

/* ── Search Input ───────────────────────────────────────────── */
const SearchIconEl = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface GlassSearchInputProps extends GlassInputProps {
  onClear?: () => void;
}

export const GlassSearchInput = forwardRef<HTMLInputElement, GlassSearchInputProps>(
  ({ label, error, hint, required, onClear, className = '', id, value, ...rest }, ref) => {
    const generatedId = useId();
    const { t: ti } = useSafeI18n();
    const inputId = id ?? generatedId;

    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} id={inputId}>
        <div className="relative flex items-center">
          <span className="absolute left-3 flex items-center pointer-events-none text-[var(--text-tertiary)]">
            <SearchIconEl />
          </span>
          <input
            ref={ref}
            id={inputId}
            type="search"
            value={value}
            className={[
              INPUT_BASE,
              STATUS_BORDER.default,
              'pl-9 pr-3.5 py-2.5',
              '[&::-webkit-search-cancel-button]:hidden',
              className,
            ].join(' ')}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...rest}
          />
          {onClear && value && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-3 flex items-center justify-center min-w-[44px] min-h-[44px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)]"
              aria-label={ti('common.clear')}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </FieldWrapper>
    );
  },
);

GlassSearchInput.displayName = 'GlassSearchInput';

/* ── Textarea ────────────────────────────────────────────────── */
interface GlassTextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'>, BaseFieldProps {
  className?: string;
}

export const GlassTextArea = forwardRef<HTMLTextAreaElement, GlassTextAreaProps>(
  ({ label, error, hint, required, status, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const effectiveStatus: InputStatus = error ? 'error' : status ?? 'default';

    return (
      <FieldWrapper label={label} error={error} hint={hint} required={required} id={inputId}>
        <textarea
          ref={ref}
          id={inputId}
          className={[
            INPUT_BASE,
            STATUS_BORDER[effectiveStatus],
            'px-3.5 py-2.5 min-h-[100px] resize-y',
            className,
          ].join(' ')}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-required={required}
          {...rest}
        />
      </FieldWrapper>
    );
  },
);

GlassTextArea.displayName = 'GlassTextArea';

export default GlassInput;

