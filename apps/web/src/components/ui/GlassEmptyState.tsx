/**
 * GlassEmptyState V2 — Empty, Error, NotFound, Permission states.
 */
import { type ReactNode } from 'react';
import { GlassButton } from './GlassButton';

interface GlassEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Alias for description */
  message?: string;
  action?: { label: string; onClick: () => void } | ReactNode;
  className?: string;
}

const DefaultEmptyIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

export function GlassEmptyState({
  icon,
  title,
  description,
  message,
  action,
  className = '',
}: GlassEmptyStateProps) {
  const desc = description ?? message;
  const isActionObj = action != null && typeof action === 'object' && 'label' in (action as object);

  return (
    <div
      className={[
        'flex flex-col items-center justify-center',
        'py-16 px-6',
        'text-center gap-4',
        className,
      ].join(' ')}
    >
      {/* Icon container */}
      <div className="w-14 h-14 rounded-[var(--radius-xl)] flex items-center justify-center bg-[var(--primary-soft)] text-[var(--primary)]">
        {icon ?? <DefaultEmptyIcon />}
      </div>

      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-[var(--text-h4)] font-semibold text-[var(--text-primary)]">{title}</h3>
        {desc && (
          <p className="text-[var(--text-body-sm)] text-[var(--text-primary)] opacity-80">{desc}</p>
        )}
      </div>

      {isActionObj ? (
        <GlassButton
          variant="secondary"
          size="sm"
          onClick={(action as { label: string; onClick: () => void }).onClick}
        >
          {(action as { label: string; onClick: () => void }).label}
        </GlassButton>
      ) : action ? (
        <div>{action as ReactNode}</div>
      ) : null}
    </div>
  );
}

/* ── Error State ─────────────────────────────────────────────── */
const ErrorIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

interface GlassErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

import { useSafeI18n } from '@/i18n/I18nProvider';

export function GlassErrorState({
  title,
  message,
  onRetry,
  className = '',
}: GlassErrorStateProps) {
  const { t } = useSafeI18n();
  const finalTitle = title || t('common.error') || 'Something went wrong';

  return (
    <div
      className={[
        'flex flex-col items-center justify-center py-16 px-6 text-center gap-4',
        className,
      ].join(' ')}
    >
      <div className="w-14 h-14 rounded-[var(--radius-xl)] flex items-center justify-center bg-[var(--danger-soft)] text-[var(--danger)]">
        <ErrorIcon />
      </div>
      <div className="flex flex-col gap-1.5 max-w-xs">
        <h3 className="text-[var(--text-h4)] font-semibold text-[var(--text-primary)]">{finalTitle}</h3>
        <p className="text-[var(--text-body-sm)] text-[var(--text-primary)] opacity-80">{message}</p>
      </div>
      {onRetry && (
        <GlassButton variant="secondary" size="sm" onClick={onRetry}>
          {t('common.tryAgain') || 'Try again'}
        </GlassButton>
      )}
    </div>
  );
}

export default GlassEmptyState;
