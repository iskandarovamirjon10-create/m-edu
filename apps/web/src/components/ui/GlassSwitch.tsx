import type { InputHTMLAttributes } from 'react';

/** GlassSwitch V2 — Toggle switch with V2 tokens. */
export function GlassSwitch({
  checked,
  onChange,
  disabled,
  className = '',
  id,
  'aria-label': ariaLabel,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={[
        'relative inline-flex items-center cursor-pointer select-none',
        disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '',
        className,
      ].join(' ')}
    >
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        className="sr-only peer"
        aria-label={ariaLabel}
        {...rest}
      />
      {/* Track */}
      <span
        className={[
          'relative w-10 h-[1.375rem] rounded-[var(--radius-pill)]',
          'transition-[background-color,border-color] duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
          'bg-[var(--border-medium)] border border-[var(--border-medium)]',
          'peer-checked:bg-[var(--primary)] peer-checked:border-[var(--primary)]',
          'peer-focus-visible:shadow-[0_0_0_3px_var(--focus-ring)]',
        ].join(' ')}
      >
        {/* Thumb */}
        <span
          className={[
            'absolute top-[2px] left-[2px]',
            'w-[1.125rem] h-[1.125rem] rounded-full',
            'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.18)]',
            'transition-transform duration-[var(--duration-fast)] [transition-timing-function:var(--ease-standard)]',
          ].join(' ')}
          style={{ transform: checked ? 'translateX(18px)' : 'translateX(0)' }}
        />
      </span>
    </label>
  );
}

export default GlassSwitch;
