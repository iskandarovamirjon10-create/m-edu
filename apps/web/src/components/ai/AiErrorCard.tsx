/**
 * AiErrorCard — structured, user-safe failure state with safe retry.
 *
 * Shows an Uzbek message produced by `lib/ai.ts` (never stack traces or
 * server text) plus the last prompt so the user knows exactly what would
 * be re-sent. Retry is only offered when re-issuing the request is safe.
 */
import { CircleAlert, RefreshCw } from 'lucide-react';
import { GlassButton } from '@/components/ui';
import type { AiErrorInfo } from '@/types/ai';

export interface AiErrorCardProps {
  error: AiErrorInfo;
  lastPrompt: string;
  onRetry: () => void;
}

export function AiErrorCard({ error, lastPrompt, onRetry }: AiErrorCardProps) {
  return (
    <div
      role="alert"
      data-testid="ai-error-card"
      className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-4"
    >
      <div className="flex gap-3">
        <CircleAlert aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--danger)]">Xatolik yuz berdi</p>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{error.message}</p>

          {lastPrompt && (
            <p
              className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs leading-5 text-[var(--text-tertiary)]"
              style={{ overflowWrap: 'anywhere' }}
            >
              <span className="font-semibold text-[var(--text-secondary)]">So‘rov:</span>{' '}
              {lastPrompt}
            </p>
          )}

          {error.retryable && (
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw aria-hidden />}
              onClick={onRetry}
              className="mt-3"
              data-testid="ai-retry"
            >
              Qayta urinish
            </GlassButton>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiErrorCard;
