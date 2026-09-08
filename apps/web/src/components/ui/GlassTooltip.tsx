/**
 * GlassTooltip — Hover tooltip wrapper.
 */
import { type ReactNode, useState } from 'react';

interface GlassTooltipProps {
  children: ReactNode;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const PLACEMENT_CLASSES: Record<string, string> = {
  top:    'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  left:   'right-[calc(100%+8px)] top-1/2 -translate-y-1/2',
  right:  'left-[calc(100%+8px)] top-1/2 -translate-y-1/2',
};

export function GlassTooltip({ children, content, placement = 'top' }: GlassTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={[
            'absolute z-50',
            'px-3 py-1.5',
            'bg-[var(--text-primary)]',
            'text-[var(--text-inverse)]',
            'text-xs font-medium',
            'rounded-lg',
            'whitespace-nowrap',
            'shadow-[var(--shadow-md)]',
            'animate-[scale-in_0.15s_ease_forwards]',
            'pointer-events-none',
            PLACEMENT_CLASSES[placement],
          ].join(' ')}
        >
          {content}
        </span>
      )}
    </span>
  );
}

export default GlassTooltip;
