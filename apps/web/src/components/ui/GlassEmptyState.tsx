/**
 * GlassEmptyState — Empty state with icon.
 */
import { type ReactNode } from 'react';
import { GlassButton } from './GlassButton';

interface GlassEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Alias for description — accepted because most pages pass `message`. */
  message?: string;
  /** CTA: either { label, onClick } or a ready-rendered React node. */
  action?: { label: string; onClick: () => void } | ReactNode;
  className?: string;
}

export function GlassEmptyState({ icon, title, description, message, action, className = '' }: GlassEmptyStateProps) {
  const desc = description ?? message;
  const actionNode = action != null && typeof action === 'object' && 'label' in (action as object)
    ? null
    : (action as ReactNode | null);
  return (
    <div
      className={[
        'flex flex-col items-center justify-center',
        'py-16 px-6',
        'text-center gap-3',
        className,
      ].join(' ')}
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[rgba(148,234,239,0.10)] text-brand-700 mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-[1.0625rem] font-semibold text-[var(--text-primary)]">{title}</h3>
      {desc && (
        <p className="text-sm text-[var(--text-secondary)] max-w-sm">{desc}</p>
      )}
      {actionNode ? (
        <div className="mt-2">{actionNode}</div>
      ) : action ? (
        <GlassButton variant="secondary" size="sm" onClick={(action as { label: string; onClick: () => void }).onClick} className="mt-2">
          {(action as { label: string; onClick: () => void }).label}
        </GlassButton>
      ) : null}
    </div>
  );
}

interface GlassErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function GlassErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}: GlassErrorStateProps) {
  return (
    <div className={['flex flex-col items-center justify-center py-14 px-6 text-center gap-3', className].join(' ')}>
      <div className="w-13 h-13 rounded-2xl flex items-center justify-center bg-[rgba(240,112,112,0.10)] text-[var(--state-error)]">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
        </svg>
      </div>
      <h3 className="text-[1.0625rem] font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-sm">{message}</p>
      {onRetry && (
        <GlassButton variant="secondary" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </GlassButton>
      )}
    </div>
  );
}

export default GlassEmptyState;
