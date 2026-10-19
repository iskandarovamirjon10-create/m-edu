import {
  forwardRef,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/design';
import { useSafeI18n } from '@/i18n/I18nProvider';

export type InputStatus = 'default' | 'error' | 'warning' | 'success';
export type InputSize = 'sm' | 'md' | 'lg';

interface BaseFieldProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  status?: InputStatus;
  size?: InputSize;
  inputPrefix?: ReactNode;
  inputSuffix?: ReactNode;
  /** @deprecated accepted for compatibility; not used */
  disableRefraction?: boolean;
  /** @deprecated accepted for compatibility; not used */
  disableMotion?: boolean;
  /** @deprecated accepted for compatibility; not used */
  decorative?: boolean;
  /** @deprecated accepted for compatibility; not used */
  noReflection?: boolean;
}

export interface GlassInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    BaseFieldProps {}
export interface GlassTextAreaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'>,
    BaseFieldProps {}

const SIZE: Record<InputSize, string> = {
  sm: 'h-8 text-xs px-2.5',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-[15px] px-3.5',
};

const STATUS: Record<InputStatus, string> = {
  default:
    'border-black/[0.08] dark:border-white/[0.10] hover:border-black/[0.15] dark:hover:border-white/[0.20] focus:border-apple-blue focus:shadow-[0_0_0_3px_var(--focus-ring)]',
  error: 'border-apple-red focus:border-apple-red focus:shadow-[0_0_0_3px_var(--focus-ring-danger)]',
  warning:
    'border-apple-orange focus:border-apple-orange focus:shadow-[0_0_0_3px_var(--focus-ring)]',
  success: 'border-apple-green focus:border-apple-green focus:shadow-[0_0_0_3px_var(--focus-ring)]',
};

const CONTROL =
  'w-full rounded-xl border bg-white/70 dark:bg-white/[0.05] dark:focus:bg-surface-900/90 backdrop-blur-xl backdrop-saturate-150 text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] outline-none shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)] transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:opacity-50';

const LABEL = 'mb-1.5 block text-xs font-medium text-[var(--text-secondary)]';

function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  children,
}: {
  id: string;
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {label && (
        <label htmlFor={id} className={LABEL}>
          {label}
          {required && (
            <span aria-hidden="true" className="ml-1 text-apple-red">
              *
            </span>
          )}
        </label>
      )}
      {children}
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
    </>
  );
}

function describedBy(id: string, error?: string, hint?: string): string | undefined {
  if (error) return `${id}-err`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  {
    label,
    error,
    hint,
    required,
    status = 'default',
    size = 'md',
    inputPrefix,
    inputSuffix,
    className,
    id: idProp,
    ...props
  },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const effective: InputStatus = error ? 'error' : status;

  return (
    <div className="w-full">
      <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
        <div className="relative">
          {inputPrefix && (
            <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-[var(--text-tertiary)] [&>svg]:h-4 [&>svg]:w-4">
              {inputPrefix}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, error, hint)}
            aria-required={required || undefined}
            className={cn(
              CONTROL,
              SIZE[size],
              STATUS[effective],
              inputPrefix ? 'pl-9' : '',
              inputSuffix ? 'pr-10' : '',
              className,
            )}
            {...props}
          />
          {inputSuffix && (
            <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[var(--text-tertiary)] [&>svg]:h-4 [&>svg]:w-4">
              {inputSuffix}
            </span>
          )}
        </div>
      </FieldShell>
    </div>
  );
});

export const GlassTextArea = forwardRef<HTMLTextAreaElement, GlassTextAreaProps>(
  function GlassTextArea(
    { label, error, hint, required, status = 'default', className, id: idProp, ...props },
    ref,
  ) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const effective: InputStatus = error ? 'error' : status;

    return (
      <div className="w-full">
        <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
          <textarea
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, error, hint)}
            aria-required={required || undefined}
            className={cn(
              CONTROL,
              'min-h-[96px] resize-y px-3 py-2 text-sm leading-relaxed',
              STATUS[effective],
              className,
            )}
            {...props}
          />
        </FieldShell>
      </div>
    );
  },
);

export const GlassPasswordInput = forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassPasswordInput(
    { label, error, hint, required, status = 'default', size = 'md', className, id: idProp, inputPrefix, ...props },
    ref,
  ) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const [show, setShow] = useState(false);
    const { t } = useSafeI18n();
    const effective: InputStatus = error ? 'error' : status;
    const toggleLabel = show ? t('auth.hidePassword', 'Hide') : t('auth.showPassword', 'Show');

    return (
      <div className="w-full">
        <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
          <div className="relative">
            {inputPrefix && (
              <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-[var(--text-tertiary)] [&>svg]:h-4 [&>svg]:w-4">
                {inputPrefix}
              </span>
            )}
            <input
              ref={ref}
              id={id}
              type={show ? 'text' : 'password'}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(id, error, hint)}
              aria-required={required || undefined}
              className={cn(
                CONTROL,
                SIZE[size],
                STATUS[effective],
                inputPrefix ? 'pl-9' : '',
                'pr-14',
                className,
              )}
              {...props}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-1 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-black/5 hover:text-[var(--text-primary)] dark:hover:bg-white/10"
              aria-label={toggleLabel}
              aria-pressed={show}
            >
              {toggleLabel}
            </button>
          </div>
        </FieldShell>
      </div>
    );
  },
);

export const GlassSearchInput = forwardRef<HTMLInputElement, GlassInputProps>(
  function GlassSearchInput(
    { label, error, hint, required, status = 'default', size = 'md', className, id: idProp, inputPrefix, inputSuffix, ...props },
    ref,
  ) {
    const autoId = useId();
    const id = idProp ?? autoId;
    const effective: InputStatus = error ? 'error' : status;

    return (
      <div className="w-full">
        <FieldShell id={id} label={label} error={error} hint={hint} required={required}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center text-[var(--text-tertiary)] [&>svg]:h-4 [&>svg]:w-4">
              {inputPrefix}
            </span>
            <input
              ref={ref}
              id={id}
              type="search"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(id, error, hint)}
              aria-required={required || undefined}
              className={cn(
                CONTROL,
                SIZE[size],
                STATUS[effective],
                'pl-9',
                inputSuffix ? 'pr-10' : '',
                className,
              )}
              {...props}
            />
            {inputSuffix && (
              <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center text-[var(--text-tertiary)] [&>svg]:h-4 [&>svg]:w-4">
                {inputSuffix}
              </span>
            )}
          </div>
        </FieldShell>
      </div>
    );
  },
);

export default GlassInput;
