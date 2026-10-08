/**
 * AiMessageList — Apple Design Award Edition v3 "Liquid Glass"
 *
 * Design philosophy: the conversation is the interface.
 *  - Removed: heavy card borders/shadows on scroll pill (was shadow-md + border)
 *  - Removed: aria-busy noise where status already covers it
 *  - Kept: all scroll logic (auto-stick, near-bottom detection, jump pill)
 *  - Kept: all a11y (role="log", aria-live, aria-label), memoization,
 *          reduced-motion scroll behavior, spacing sentinel
 *
 * Owns auto-scroll behaviour: it follows new content only while the user
 * is already near the bottom; when the user has scrolled up it stays put
 * and offers a "Yangi javob ↓" shortcut instead of jumping.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import type { AiErrorInfo, AiUiMessage } from '@/types/ai';
import type { AiStatus } from '@/hooks/useAiCopilot';
import { AiWelcome } from './AiWelcome';
import { AiUserMessage, AiAssistantMessage, AiSystemMessage } from './AiMessages';
import { AiThinking } from './AiThinking';
import { AiErrorCard } from './AiErrorCard';
import { useI18n } from '@/i18n/I18nProvider';

const NEAR_BOTTOM_PX = 80;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export interface AiMessageListProps {
  messages: AiUiMessage[];
  status: AiStatus;
  error: AiErrorInfo | null;
  lastPrompt: string;
  promptsDisabled: boolean;
  onPickPrompt: (text: string) => void;
  onRetry: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onDismissActionError: () => void;
}

function AiMessageListComponent({
  messages,
  status,
  error,
  lastPrompt,
  promptsDisabled,
  onPickPrompt,
  onRetry,
  onConfirm,
  onReject,
  onDismissActionError,
}: AiMessageListProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  const busy = status === 'sending' || status === 'thinking' || status === 'confirming';
  const thinkingLabel =
    status === 'sending' ? t('ai.status.working') : t('ai.status.preparing');

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const top = element.scrollHeight;
    if (typeof element.scrollTo === 'function') {
      try {
        element.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        return;
      } catch {
        /* jsdom / older engines: fall through */
      }
    }
    element.scrollTop = top;
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    setNearBottom(distance <= NEAR_BOTTOM_PX);
  }, []);

  const lastMessage = messages[messages.length - 1];
  const shouldStick = nearBottom || lastMessage?.role === 'user';

  useEffect(() => {
    if (!shouldStick) return;
    scrollToBottom();
  }, [messages, status, shouldStick, scrollToBottom]);

  const empty = messages.length === 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* ── Scroll area ──────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy}
        aria-label={t('ai.list.historyAria')}
        data-testid="ai-message-list"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6"
      >
        {empty ? (
          <AiWelcome disabled={promptsDisabled} onSelect={onPickPrompt} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 sm:gap-4">
            {messages.map((message) => {
              if (message.role === 'user') {
                return <AiUserMessage key={message.id} message={message} />;
              }
              if (message.role === 'assistant') {
                return (
                  <AiAssistantMessage
                    key={message.id}
                    message={message}
                    confirming={status === 'confirming'}
                    onConfirm={onConfirm}
                    onReject={onReject}
                    onDismissActionError={onDismissActionError}
                    onRegenerate={onRetry}
                  />
                );
              }
              return <AiSystemMessage key={message.id} message={message} />;
            })}

            {(status === 'sending' || status === 'thinking') && (
              <AiThinking label={thinkingLabel} />
            )}

            {error && (
              <AiErrorCard error={error} lastPrompt={lastPrompt} onRetry={onRetry} />
            )}

            {/* Sentinel — keeps last bubble breathing room from composer */}
            <div aria-hidden className="h-1" />
          </div>
        )}
      </div>

      {/* ── Jump-to-latest pill ──────────────────────────────────────── */}
      {!nearBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          data-testid="ai-scroll-bottom"
          aria-label={t('ai.scroll.newResponse')}
          className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium shadow-[0_4px_16px_-6px_rgba(0,0,0,0.18)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ai-primary)]/40"
          style={{
            borderColor: 'var(--ai-border, rgba(0,0,0,0.08))',
            background: 'var(--ai-bg-elevated, #FFFFFF)',
            color: 'var(--ai-text-primary, #1D1D1F)',
            backdropFilter: 'blur(16px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'var(--ai-bg-hover, rgba(0,0,0,0.04))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--ai-bg-elevated, #FFFFFF)';
          }}
        >
          {t('ai.scroll.newResponse')}
          <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/**
 * Memoized: the composer keeps its own draft state, so typing must not
 * re-render the whole conversation.
 */
export const AiMessageList = memo(AiMessageListComponent);
AiMessageList.displayName = 'AiMessageList';

export default AiMessageList;