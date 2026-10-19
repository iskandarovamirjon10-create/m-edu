/**
 * ============================================================================
 * AiMessageList v4.0 — Staggered Messages + New-Response Counter
 * ============================================================================
 * VISUAL (what's new):
 *  - Staggered message entrance (fade-up, 30ms stagger cap at 240ms)
 *  - Scroll pill: new-message counter badge ("3 yangi javob ↓"),
 *    AnimatePresence slide-up, pulse when new message arrives while away
 *  - Thin scroll-progress bar at top edge (gradient blue→purple)
 *  - Empty→content crossfade (AiWelcome fades out, messages in)
 * Fixes:
 *  - aria-busy removed from role="log" (comment said so, code didn't —
 *    aria-busy on a live region suppresses announcements)
 *  - Imperative onMouseEnter/Leave → CSS hover
 *  - resolveTranslation helper (no raw-key leaks)
 *  - Scroll handler rAF-throttled
 *  - prefersReducedMotion cached
 *  - Sentinel h-1 → h-4 (breathing room)
 *  - Pill z-index above messages
 *  - New message counter (tracks how many arrived while user was scrolled up)
 * API: unchanged.
 * ============================================================================
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import type { AiErrorInfo, AiUiMessage } from '@/types/ai';
import type { AiStatus } from '@/hooks/useAiCopilot';
import { AiWelcome } from './AiWelcome';
import { AiUserMessage, AiAssistantMessage, AiSystemMessage } from './AiMessages';
import { AiThinking } from './AiThinking';
import { AiErrorCard } from './AiErrorCard';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

const NEAR_BOTTOM_PX = 80;

/** Cached — matchMedia is a DOM query, no need to call it on every scroll. */
let cachedReducedMotion: boolean | null = null;
function prefersReducedMotion(): boolean {
  if (cachedReducedMotion !== null) return cachedReducedMotion;
  cachedReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return cachedReducedMotion;
}

function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const v = t(key);
    return !v || v === key ? fallback : v;
  } catch {
    return fallback;
  }
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
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const lastSeenCountRef = useRef(messages.length);

  const [nearBottom, setNearBottom] = useState(true);
  const [progress, setProgress] = useState(0);
  const [newCount, setNewCount] = useState(0);

  const thinkingLabel =
    status === 'sending'
      ? resolveTranslation(t, 'ai.status.working', 'Ishlanmoqda…')
      : resolveTranslation(t, 'ai.status.preparing', 'Tayyorlanmoqda…');

  const empty = messages.length === 0;

  /* ── Scroll helpers ───────────────────────────────────────────── */

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollHeight;
    if (typeof el.scrollTo === 'function') {
      try {
        el.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        return;
      } catch {
        /* jsdom fallback */
      }
    }
    el.scrollTop = top;
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollRef.current;
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const max = el.scrollHeight - el.clientHeight;
      setNearBottom(distance <= NEAR_BOTTOM_PX);
      setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    });
  }, []);

  /* ── Stick-to-bottom on new content ───────────────────────────── */

  const lastMessage = messages[messages.length - 1];
  const shouldStick = nearBottom || lastMessage?.role === 'user';

  useEffect(() => {
    if (!shouldStick) return;
    scrollToBottom();
  }, [messages, status, shouldStick, scrollToBottom]);

  /* ── Track new messages that arrived while scrolled up ────────── */

  useEffect(() => {
    if (nearBottom) {
      lastSeenCountRef.current = messages.length;
      setNewCount(0);
    } else if (messages.length > lastSeenCountRef.current) {
      setNewCount(messages.length - lastSeenCountRef.current);
    }
  }, [messages.length, nearBottom]);

  const handleJump = useCallback(() => {
    lastSeenCountRef.current = messages.length;
    setNewCount(0);
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  /* ── Rendered message elements (memoized stagger delays) ──────── */

  const renderedMessages = useMemo(
    () =>
      messages.map((message, index) => {
        const content =
          message.role === 'user' ? (
            <AiUserMessage message={message} />
          ) : message.role === 'assistant' ? (
            <AiAssistantMessage
              message={message}
              confirming={status === 'confirming'}
              onConfirm={onConfirm}
              onReject={onReject}
              onDismissActionError={onDismissActionError}
              onRegenerate={onRetry}
            />
          ) : (
            <AiSystemMessage message={message} />
          );

        return (
          <motion.div
            key={message.id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0 : 0.26,
              delay: reduced ? 0 : Math.min(index * 0.03, 0.24),
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {content}
          </motion.div>
        );
      }),
    [
      messages,
      status,
      onConfirm,
      onReject,
      onDismissActionError,
      onRetry,
      reduced,
    ],
  );

  /* ── Pill label ────────────────────────────────────────────────── */

  const pillBaseLabel = resolveTranslation(t, 'ai.scroll.newResponse', 'Yangi javob');
  const pillLabel =
    newCount > 1
      ? `${newCount} ${resolveTranslation(t, 'ai.scroll.newResponses', 'yangi javob')}`
      : pillBaseLabel;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* ── Scroll progress bar (top edge) ─────────────────────────── */}
      {!empty && progress > 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] overflow-hidden bg-transparent"
        >
          <motion.div
            className="h-full origin-left rounded-full bg-gradient-to-r from-[#007AFF] via-[#5856D6] to-[#AF52DE]"
            animate={{ scaleX: Math.max(0.02, progress) }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{ transformOrigin: 'left' }}
          />
        </div>
      )}

      {/* ── Scroll area ────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label={resolveTranslation(t, 'ai.list.historyAria', 'Suhbat tarixi')}
        className={cn(
          'min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6',
          '[scrollbar-width:thin] [scrollbar-color:rgba(120,120,128,0.25)_transparent]',
          '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20',
          'hover:[&::-webkit-scrollbar-thumb]:bg-black/30 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/35'
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {empty ? (
            <motion.div
              key="welcome"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
            >
              <AiWelcome disabled={promptsDisabled} onSelect={onPickPrompt} />
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 sm:gap-4"
            >
              {renderedMessages}

              {(status === 'sending' || status === 'thinking') && (
                <AiThinking label={thinkingLabel} />
              )}

              {error && (
                <AiErrorCard error={error} lastPrompt={lastPrompt} onRetry={onRetry} />
              )}

              {/* Sentinel — generous breathing room so content is never under floating pills */}
              <div aria-hidden="true" className="h-16" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Jump-to-latest pill ────────────────────────────────────── */}
      <AnimatePresence>
        {!nearBottom && !empty && (
          <motion.button
            key="jump-pill"
            type="button"
            onClick={handleJump}
            initial={reduced ? false : { opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }}
            data-testid="ai-scroll-bottom"
            aria-label={
              newCount > 0
                ? `${newCount} ta yangi javob — eng pastga o'tish`
                : resolveTranslation(t, 'ai.scroll.newResponse', 'Eng pastga o\'tish')
            }
            className={cn(
              'group absolute bottom-4 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5',
              'text-[12px] font-medium',
              'border-black/[0.08] bg-white/85 text-[#1D1D1F] shadow-[0_6px_24px_-8px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]',
              'backdrop-blur-2xl backdrop-saturate-150',
              'dark:border-white/[0.10] dark:bg-[#1C1C1E]/85 dark:text-[#F5F5F7] dark:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]',
              'transition-[background-color,box-shadow,transform] duration-150',
              'hover:bg-white hover:shadow-[0_8px_28px_-8px_rgba(0,0,0,0.28)] active:scale-[0.97]',
              'dark:hover:bg-[#2C2C2E]',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,122,255,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1C1C1E]',
              'motion-reduce:transition-none motion-reduce:active:scale-100'
            )}
          >
            {/* Counter badge — pulses when new content arrived */}
            {newCount > 0 && (
              <motion.span
                aria-hidden="true"
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                className="relative inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_-2px_rgba(0,122,255,0.55)]"
              >
                {!reduced && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-[#007AFF]"
                    animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span className="relative">{newCount > 9 ? '9+' : newCount}</span>
              </motion.span>
            )}

            <span>{pillLabel}</span>

            <motion.span
              aria-hidden="true"
              animate={reduced ? undefined : { y: [0, 2, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex"
            >
              <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.2} />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
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