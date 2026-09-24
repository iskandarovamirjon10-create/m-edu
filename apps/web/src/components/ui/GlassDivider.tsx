/**
 * GlassDivider V2 — Horizontal and vertical dividers.
 */
import { type ReactNode } from 'react';

interface GlassDividerProps {
  children?: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function GlassDivider({
  children,
  className = '',
  orientation = 'horizontal',
}: GlassDividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={['w-px bg-[var(--border-subtle)] self-stretch', className].join(' ')}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (children) {
    return (
      <div
        className={['flex items-center gap-3 w-full', className].join(' ')}
        role="separator"
      >
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="text-[var(--text-caption)] text-[var(--text-tertiary)] whitespace-nowrap font-medium">
          {children}
        </span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>
    );
  }

  return (
    <div
      className={['h-px bg-[var(--border-subtle)] w-full', className].join(' ')}
      role="separator"
    />
  );
}

export default GlassDivider;
