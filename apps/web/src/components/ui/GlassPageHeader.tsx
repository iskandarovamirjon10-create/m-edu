/**
 * GlassPageHeader — Consistent page header across all pages.
 */
import { type ReactNode } from 'react';
import { GlassButton } from './GlassButton';

interface GlassPageHeaderProps {
  title: string;
  description?: string;
  /** Alias for description — accepted because most pages pass `subtitle`. */
  subtitle?: string;
  /**
   * Alias for actions (singular). Accepts a ready-rendered ReactNode OR the
   * legacy { label, onClick } object (rendered as a GlassButton) — pages that
   * pass a plain object previously crashed at runtime because React cannot
   * render objects as children.
   */
  action?: ReactNode | { label: string; onClick: () => void };
  actions?: ReactNode;
  className?: string;
}

export function GlassPageHeader({ title, description, subtitle, action, actions, className = '' }: GlassPageHeaderProps) {
  const desc = description ?? subtitle;
  const rawAction = actions ?? action;
  const actionNodes =
    rawAction != null && typeof rawAction === 'object' && 'label' in (rawAction as object) && !('props' in (rawAction as object))
      ? (
          <GlassButton size="sm" onClick={(rawAction as { label: string; onClick: () => void }).onClick}>
            {(rawAction as { label: string; onClick: () => void }).label}
          </GlassButton>
        )
      : (rawAction as ReactNode | undefined);
  return (
    <div
      className={[
        'flex items-start justify-between',
        'flex-wrap gap-4',
        'mb-7',
        className,
      ].join(' ')}
    >
      <div>
        <h1 className="text-[1.625rem] font-bold text-[var(--text-primary)] leading-tight tracking-tight">
          {title}
        </h1>
        {desc && (
          <p className="mt-1 text-[0.9375rem] text-[var(--text-secondary)]">{desc}</p>
        )}
      </div>
      {actionNodes && <div className="flex items-center gap-3 flex-shrink-0">{actionNodes}</div>}
    </div>
  );
}

export default GlassPageHeader;
