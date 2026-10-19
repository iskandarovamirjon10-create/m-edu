import { forwardRef, useId, type ChangeEvent, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/design';

export type SwitchSize = 'sm' | 'md' | 'lg';

export interface GlassSwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> {
  label?: string;
  error?: string;
  hint?: string;
  size?: SwitchSize;
  /** Called with the new checked value. */
  onChange?: (checked: boolean) => void;
  /** @deprecated accepted for compatibility; not used */
  disableRefraction?: boolean;
  /** @deprecated accepted for compatibility; not used */
  disableMotion?: boolean;
  /** @deprecated accepted for compatibility; not used */
  decorative?: boolean;
  /** @deprecated accepted for compatibility; not used */
  noReflection?: boolean;
}

const TRACK: Record<SwitchSize, string> = {
  sm: 'h-4 w-7',
  md: 'h-5 w-9',
  lg: 'h-6 w-11',
};
const THUMB: Record<SwitchSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};
const THUMB_OFFSET: Record<SwitchSize, string> = {
  sm: 'left-0.5 top-0.5',
  md: 'left-0.5 top-0.5',
  lg: 'left-0.5 top-0.5',
};

/**
 * iOS-style switch. A visually-hidden checkbox drives a styled track + thumb.
 * `onChange` receives the boolean checked value (legacy contract).
 */
export const GlassSwitch = forwardRef<HTMLInputElement, GlassSwitchProps>(function GlassSwitch(
  { label, error, hint, size = 'md', className, onChange, id: idProp, disabled, ...rest },
  ref,
) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <div className="flex w-full items-start gap-3">
      <label
        htmlFor={id}
        className={cn(
          'relative mt-0.5 inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors duration-150',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        )}
      >
        <input
          ref={ref}
          id={id}
          type="checkbox"
          role="switch"
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange?.(e.target.checked)}
          className="peer sr-only"
          {...rest}
        />
        {/* Track */}
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full bg-black/15 transition-colors duration-200 ease-apple-spring border border-black/[0.04] dark:border-white/[0.08]',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--focus-ring)] peer-focus-visible:ring-offset-2',
            'dark:bg-white/20',
            'peer-checked:bg-[var(--primary)] peer-checked:border-transparent',
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            TRACK[size],
          )}
        />
        {/* Thumb */}
        <span
          aria-hidden="true"
          className={cn(
            'absolute rounded-full bg-white shadow-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform duration-200 ease-apple-spring',
            'dark:bg-white',
            'peer-checked:translate-x-[calc(100%-2px)]',
            THUMB_OFFSET[size],
            THUMB[size],
          )}
        />
      </label>

      {(label || hint || error) && (
        <div className="min-w-0 flex-1">
          {label && (
            <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>
          )}
          {hint && !error && (
            <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">{hint}</span>
          )}
          {error && (
            <span role="alert" className="mt-0.5 block text-xs text-apple-red">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

export default GlassSwitch;
