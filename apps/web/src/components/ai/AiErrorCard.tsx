/**
 * AiErrorCard — structured, user-safe failure state with safe retry.
 *
 * Shows an Uzbek message produced by `lib/ai.ts` (never stack traces or
 * server text) plus the last prompt so the user knows exactly what would
 * be re-sent. Retry is only offered when re-issuing the request is safe.
 */
import { CircleAlert, RefreshCw } from 'lucide-react';
import { GlassButton } from '@/components/ui';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { AiErrorInfo } from '@/types/ai';

export interface AiErrorCardProps {
  error: AiErrorInfo;
  lastPrompt: string;
  onRetry: () => void;
}

export function AiErrorCard({ error, lastPrompt, onRetry }: AiErrorCardProps) {
  const { t } = useSafeI18n();
  return (
    <div
      role="alert"
      data-testid="ai-error-card"
      className="relative overflow-hidden rounded-2xl border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.08] via-rose-500/[0.03] to-transparent p-4 sm:p-5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_32px_-10px_rgba(244,63,94,0.18)] dark:border-rose-500/30 dark:bg-rose-950/20 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
    >
      {/* Specular edge sheen */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-rose-400/40 to-transparent"
      />

      <div className="flex gap-3.5 items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_4px_12px_rgba(244,63,94,0.35),inset_0_1px_0_rgba(255,255,255,0.35)]">
          <CircleAlert aria-hidden className="h-5 w-5" strokeWidth={2.2} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold tracking-tight text-rose-600 dark:text-rose-400">
            {t('ai.error.title')}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]">
            {error.message}
          </p>

          {lastPrompt && (
            <div
              className="mt-2.5 rounded-xl border border-rose-500/15 bg-white/60 dark:bg-black/25 px-3 py-2 text-xs leading-5 text-[var(--text-tertiary,#86868B)] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-none"
              style={{ overflowWrap: 'anywhere' }}
            >
              <span className="font-semibold text-rose-600/90 dark:text-rose-400/90">
                {t('ai.error.request')}
              </span>{' '}
              <span className="text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)] font-mono text-[11.5px]">
                {lastPrompt}
              </span>
            </div>
          )}

          {error.retryable && (
            <div className="mt-3.5 flex items-center">
              <GlassButton
                variant="secondary"
                size="sm"
                icon={<RefreshCw aria-hidden className="transition-transform group-hover:rotate-45" />}
                onClick={onRetry}
                data-testid="ai-retry"
                className="rounded-xl border-rose-500/20 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/25 active:scale-[0.96] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
              >
                {t('ai.error.retry')}
              </GlassButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiErrorCard;
