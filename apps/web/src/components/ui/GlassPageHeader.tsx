/**
 * GlassPageHeader V2 — Consistent page header with V2 typography.
 */
import { type ReactNode } from 'react';
import { GlassButton } from './GlassButton';

interface GlassPageHeaderProps {
  title: string;
  description?: string;
  /** Alias for description */
  subtitle?: string;
  /** Breadcrumb-like prefix element */
  breadcrumb?: ReactNode;
  action?: ReactNode | { label: string; onClick: () => void };
  actions?: ReactNode;
  className?: string;
}

export function GlassPageHeader({
  title,
  description,
  subtitle,
  breadcrumb,
  action,
  actions,
  className = '',
}: GlassPageHeaderProps) {
  const desc = description ?? subtitle;
  const rawAction = actions ?? action;
  const isLegacyAction =
    rawAction != null &&
    typeof rawAction === 'object' &&
    'label' in (rawAction as object) &&
    !('props' in (rawAction as object));

  const actionNodes = isLegacyAction ? (
    <GlassButton
      size="sm"
      onClick={(rawAction as { label: string; onClick: () => void }).onClick}
    >
      {(rawAction as { label: string; onClick: () => void }).label}
    </GlassButton>
  ) : (rawAction as ReactNode | undefined);

  return (
    <div
      className={[
        'flex items-start justify-between',
        'flex-wrap gap-4',
        'mb-6',
        className,
      ].join(' ')}
    >
      <div className="flex flex-col gap-1 min-w-0">
        {breadcrumb && (
          <div className="text-[var(--text-caption)] text-[var(--text-tertiary)] mb-1">
            {breadcrumb}
          </div>
        )}
        <h1 className="text-[var(--text-h2)] font-bold text-[var(--text-primary)] leading-tight tracking-tight truncate">
          {title}
        </h1>
        {desc && (
          <p className="text-[var(--text-body)] text-[var(--text-secondary)] mt-0.5">
            {desc}
          </p>
        )}
      </div>
      {actionNodes && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actionNodes}
        </div>
      )}
    </div>
  );
}

export default GlassPageHeader;
