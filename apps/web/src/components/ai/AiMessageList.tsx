/**
 * AiMessageList — conversation scroll area.
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [nearBottom, setNearBottom] = useState(true);

  const busy = status === 'sending' || status === 'thinking' || status === 'confirming';
  const thinkingLabel =
    status === 'sending' ? 'AI ishlayapti...' : 'Javob tayyorlanmoqda...';

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const top = element.scrollHeight;
    if (typeof element.scrollTo === 'function') {
      try {
        element.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        return;
      } catch {
        // jsdom / older engines: fall through to direct assignment.
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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-busy={busy}
        aria-label="AI suhbat tarixi"
        data-testid="ai-message-list"
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {empty ? (
          <AiWelcome disabled={promptsDisabled} onSelect={onPickPrompt} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
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

            <div aria-hidden className="h-1" />
          </div>
        )}
      </div>

      {!nearBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          data-testid="ai-scroll-bottom"
          className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-md)] transition-colors hover:bg-[var(--bg-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
        >
          Yangi javob
          <ArrowDown aria-hidden className="h-3.5 w-3.5" />
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
