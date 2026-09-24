/**
 * GlassTooltip V2 — Hover tooltip with V2 animation and tokens.
 */
import { type ReactNode, useState, useId } from 'react';

interface GlassTooltipProps {
  children: ReactNode;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const PLACEMENT_CLASSES: Record<string, string> = {
  top:    'bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+6px)] left-1/2 -translate-x-1/2',
  left:   'right-[calc(100%+6px)] top-1/2 -translate-y-1/2',
  right:  'left-[calc(100%+6px)] top-1/2 -translate-y-1/2',
};

export function GlassTooltip({
  children,
  content,
  placement = 'top',
}: GlassTooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <span aria-describedby={visible ? id : undefined}>{children}</span>
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={[
            'absolute z-[var(--z-tooltip)]',
            'px-2.5 py-1.5',
            'bg-[var(--text-primary)]',
            'text-[var(--text-inverse)]',
            'text-[var(--text-caption)] font-medium',
            'rounded-[var(--radius-sm)]',
            'whitespace-nowrap max-w-[200px]',
            'shadow-[var(--shadow-lg)]',
            'pointer-events-none select-none',
            PLACEMENT_CLASSES[placement],
          ].join(' ')}
          style={{ animation: 'scale-in var(--duration-fast) var(--ease-enter) both' }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default GlassTooltip;
