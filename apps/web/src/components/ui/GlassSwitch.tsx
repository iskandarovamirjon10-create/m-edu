import type { InputHTMLAttributes } from 'react';

/** Liquid-glass toggle switch — mirrors the glass design language. */
export function GlassSwitch({
  checked,
  onChange,
  disabled,
  className = '',
  id,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked' | 'onChange'> & {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={[
        'relative inline-flex items-center cursor-pointer select-none',
        disabled ? 'opacity-45 cursor-not-allowed' : '',
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
        {...rest}
      />
      <span
        className={[
          'relative w-10 h-5 rounded-full transition-colors duration-200',
          'bg-[var(--bg-glass)] border border-[var(--border-medium)]',
          'peer-checked:bg-[var(--m-vivid)] peer-checked:border-[var(--m-vivid)]',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--m-vivid)] peer-focus-visible:ring-offset-2',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
            'peer-checked:translate-x-5',
          ].join(' ')}
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </span>
    </label>
  );
}
