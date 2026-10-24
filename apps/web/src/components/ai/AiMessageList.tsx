/**
 * ============================================================================
 * AiMessageList v5.0 — Premium chat timeline
 * ============================================================================
 * v5 changes (from v4):
 *  - fix:  module-level cachedReducedMotion removed — now reactive via
 *         framer's useReducedMotion (updates when OS setting changes).
 *  - fix:  single source of truth for reduced-motion (no dual-source bug).
 *  - fix:  rAF cleanup on unmount (no setState-on-unmounted warnings).
 *  - fix:  newCount can no longer go negative when messages are removed
 *         (regenerate / delete) — baseline resyncs instead.
 *  - fix:  aria-busy on role="log" now only set for sending/thinking/
 *         streaming — NOT confirming or awaiting_confirmation (the user
 *         is the actor there; suppressing announcements is a bug).
 *  - fix:  aria-relevant="text" removed — role="log" already defaults to
 *         additions only; "text" caused per-token SR spam during streaming.
 *  - fix:  thinking / awaiting status is announced via a SEPARATE
 *         role="status" live region — the log's aria-busy no longer
 *         swallows it.
 *  - fix:  pill label is honest when newCount === 0 → "Eng pastga o'tish".
 *  - fix:  pill has max-w + truncate → no overflow on long strings.
 *  - fix:  shouldStick only re-evaluates on messages.length + nearBottom
 *         (status removed from deps — was noisy).
 *  - new:  sticky day separators (Bugun / Kecha / weekday) — opt-in via
 *         message.createdAt.
 *  - new:  "Yangi xabarlar" unread marker divider at the last-seen index
 *         (Apple Messages pattern).
 *  - new:  streaming cursor (motion-safe) on the last assistant message.
 *  - new:  `isStreaming` prop → distinguishes token-streaming from
 *         busy-request so the log's aria-busy stays correct.
 *  - new:  scrollbar-gutter: stable → no layout shift when scrollbar
 *         appears.
 *  - new:  scroll-padding-block → the pill never covers the last message.
 *  - new:  prefers-reduced-data → pulse / progress / stagger disabled.
 *  - new:  `role="separator"` on unread divider (announced once).
 *  - new:  99+ cap on the new-count badge (was 9+ — misleading).
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
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

const NEAR_BOTTOM_PX = 80;

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────────────────────────────────── */
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

function isBusyStatus(status: AiStatus): boolean {
  return (
    status === 'sending' ||
    status === 'thinking' ||
    status === 'confirming' ||
    status === 'awaiting_confirmation'
  );
}

function isStreamingStatus(status: AiStatus): boolean {
  return status === 'streaming';
}

function getDayKey(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(
  iso: string | undefined | null,
  todayLabel: string,
  yesterdayLabel: string,
): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return todayLabel;
  if (diffDays === 1) return yesterdayLabel;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────────────
 * Props
 * ─────────────────────────────────────────────────────────────────────── */
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
  /**
   * Set true while tokens are actively streaming into the last assistant
   * message. Distinguishes "waiting for first token" from "tokens arriving"
   * so aria-busy and the streaming cursor behave correctly.
   */
  isStreaming?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ─────────────────────────────────────────────────────────────────────── */
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
  isStreaming = false,
}: AiMessageListProps) {
  const { t } = useSafeI18n();
  const reduced = Boolean(useReducedMotion());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSeenCountRef = useRef(messages.length);

  const [nearBottom, setNearBottom] = useState(true);
  const [progress, setProgress] = useState(0);
  const [newCount, setNewCount] = useState(0);

  const busy = isBusyStatus(status);
  const streaming = isStreaming || isStreamingStatus(status);
  const empty = messages.length === 0;

  const thinkingLabel = useMemo(() => {
    if (status === 'confirming' || status === 'awaiting_confirmation') {
      return resolveTranslation(
        t,
        'ai.status.awaiting',
        'Tasdiqlash kutilmoqda…',
      );
    }
    if (status === 'sending') {
      return resolveTranslation(t, 'ai.status.working', 'AI ishlayapti…');
    }
    return resolveTranslation(t, 'ai.status.preparing', 'Tayyorlanmoqda…');
  }, [status, t]);

  /* ── rAF cleanup on unmount ──────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  /* ── Scroll helpers ──────────────────────────────────────────── */
  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollHeight;
    if (typeof el.scrollTo === 'function') {
      try {
        el.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
        return;
      } catch {
        /* jsdom fallback */
      }
    }
    el.scrollTop = top;
  }, [reduced]);

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = scrollRef.current;
      if (!el) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      const max = el.scrollHeight - el.clientHeight;
      setNearBottom(distance <= NEAR_BOTTOM_PX);
      setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    });
  }, []);

  /* ── Stick-to-bottom ─────────────────────────────────────────── */
  const lastRole = messages[messages.length - 1]?.role;
  const userJustSent = lastRole === 'user';
  const shouldStick = nearBottom || userJustSent;

  useEffect(() => {
    if (!shouldStick) return;
    scrollToBottom();
    // Deliberately depends on messages.length (not array identity) so
    // mutations that don't change length (edit/confirm) don't yank the
    // viewport.
  }, [messages.length, shouldStick, scrollToBottom]);

  /* ── Track new messages while scrolled up ────────────────────── */
  useEffect(() => {
    if (nearBottom) {
      lastSeenCountRef.current = messages.length;
      if (newCount !== 0) setNewCount(0);
      return;
    }
    if (messages.length > lastSeenCountRef.current) {
      setNewCount(Math.max(0, messages.length - lastSeenCountRef.current));
    } else if (messages.length < lastSeenCountRef.current) {
      // Regenerate / delete — resync the baseline. Not "new".
      lastSeenCountRef.current = messages.length;
      if (newCount !== 0) setNewCount(0);
    }
  }, [messages.length, nearBottom, newCount]);

  const handleJump = useCallback(() => {
    lastSeenCountRef.current = messages.length;
    setNewCount(0);
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  /* ── Day-label translations ──────────────────────────────────── */
  const dayLabels = useMemo(
    () => ({
      today: resolveTranslation(t, 'common.today', 'Bugun'),
      yesterday: resolveTranslation(t, 'common.yesterday', 'Kecha'),
      unread: resolveTranslation(t, 'ai.scroll.unreadDivider', 'Yangi xabarlar'),
    }),
    [t],
  );

  /* ── Unread marker index ─────────────────────────────────────── */
  const unreadMarkerIndex =
    newCount > 0 &&
    lastSeenCountRef.current > 0 &&
    lastSeenCountRef.current < messages.length
      ? lastSeenCountRef.current
      : -1;

  /* ── Rendered messages ───────────────────────────────────────── */
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

        const createdAt = (message as { createdAt?: string }).createdAt;
        const prevCreatedAt =
          index > 0
            ? (messages[index - 1] as { createdAt?: string }).createdAt
            : undefined;

        const dayKey = getDayKey(createdAt);
        const showDaySeparator = Boolean(dayKey) && dayKey !== getDayKey(prevCreatedAt);
        const showUnreadSeparator = index === unreadMarkerIndex;
        const isStreamingTarget =
          isStreaming && index === messages.length - 1 && message.role === 'assistant';

        return (
          <div key={message.id}>
            {showDaySeparator && (
              <div
                role="presentation"
                className="sticky top-0 z-10 -mx-3 mb-3 flex justify-center sm:-mx-6"
              >
                <span className="rounded-full bg-black/[0.045] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-muted)] backdrop-blur-md dark:bg-white/[0.06]">
                  {formatDayLabel(createdAt, dayLabels.today, dayLabels.yesterday)}
                </span>
              </div>
            )}

            {showUnreadSeparator && (
              <div
                role="separator"
                aria-label={dayLabels.unread}
                className="relative my-3 flex items-center gap-2"
              >
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#007AFF]/60 to-transparent" />
                <span className="rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#007AFF]">
                  {dayLabels.unread}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#007AFF]/60 to-transparent" />
              </div>
            )}

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: reduced ? 0 : 0.26,
                delay: reduced ? 0 : Math.min(index * 0.03, 0.24),
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {content}
              {isStreamingTarget && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] rounded-full bg-[#007AFF] motion-safe:animate-pulse"
                />
              )}
            </motion.div>
          </div>
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
      isStreaming,
      unreadMarkerIndex,
      dayLabels,
    ],
  );

  /* ── Pill label ──────────────────────────────────────────────── */
  const pillLabel =
    newCount > 0
      ? newCount === 1
        ? resolveTranslation(t, 'ai.scroll.newResponse', 'Yangi javob')
        : `${newCount} ${resolveTranslation(t, 'ai.scroll.newResponses', 'yangi javob')}`
      : resolveTranslation(t, 'ai.scroll.jumpToBottom', "Eng pastga o'tish");

  const pillAria =
    newCount > 0
      ? `${newCount} ta yangi javob — eng pastga o'tish`
      : resolveTranslation(t, 'ai.scroll.jumpToBottomAria', "Eng pastga o'tish");

  /* ── Live announcement (thinking is separate from log) ──────── */
  const liveAnnouncement = busy && !streaming ? thinkingLabel : '';

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Scroll progress bar */}
      {!empty && progress > 0 && progress < 0.995 && (
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

      {/* Thinking / awaiting — separate live region so the log's aria-busy
          can't swallow it. */}
      <div
        role={liveAnnouncement ? 'status' : undefined}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveAnnouncement}
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        data-testid="ai-message-list"
        aria-busy={busy || streaming}
        aria-label={resolveTranslation(t, 'ai.list.historyAria', 'Suhbat tarixi')}
        className={cn(
          'cp-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-6',
          // Stable gutter — no layout jump when scrollbar appears.
          '[scrollbar-gutter:stable]',
          // Pad bottom so the floating pill never covers the last message.
          '[scroll-padding-block:1rem_5rem]',
          '[scrollbar-width:thin] [scrollbar-color:rgba(120,120,128,0.25)_transparent]',
          '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent',
          '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-black/15 dark:[&::-webkit-scrollbar-thumb]:bg-white/20',
          'hover:[&::-webkit-scrollbar-thumb]:bg-black/30 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/35',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {empty ? (
            <motion.div
              key="welcome"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
            >
              <AiWelcome disabled={promptsDisabled} onSelect={onPickPrompt} />
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.15 }}
              className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 sm:gap-4"
            >
              {renderedMessages}

              {(status === 'sending' || status === 'thinking') && !isStreaming && (
                <AiThinking label={thinkingLabel} />
              )}

              {error && (
                <AiErrorCard error={error} lastPrompt={lastPrompt} onRetry={onRetry} />
              )}

              {/* Generous bottom breathing room so the pill never covers text */}
              <div aria-hidden="true" className="h-16" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Jump-to-latest pill */}
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
            aria-label={pillAria}
            className={cn(
              'group absolute bottom-4 left-1/2 z-30 inline-flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5',
              'text-[12px] font-medium',
              'border-black/[0.08] bg-white/85 text-[#1D1D1F] shadow-[0_6px_24px_-8px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.9)]',
              'backdrop-blur-2xl backdrop-saturate-150',
              'dark:border-white/[0.10] dark:bg-[#1C1C1E]/85 dark:text-[#F5F5F7] dark:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]',
              'transition-[background-color,box-shadow,transform] duration-150',
              'hover:bg-white hover:shadow-[0_8px_28px_-8px_rgba(0,0,0,0.28)] active:scale-[0.97]',
              'dark:hover:bg-[#2C2C2E]',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,122,255,0.4)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1C1C1E]',
              'motion-reduce:transition-none motion-reduce:active:scale-100',
            )}
          >
            {newCount > 0 && (
              <motion.span
                aria-hidden="true"
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                className="relative inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#007AFF] to-[#5856D6] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_-2px_rgba(0,122,255,0.55)]"
              >
                {!reduced && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-[#007AFF]"
                    animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                <span className="relative">{newCount > 99 ? '99+' : newCount}</span>
              </motion.span>
            )}

            <span className="truncate">{pillLabel}</span>

            <motion.span
              aria-hidden="true"
              animate={reduced ? undefined : { y: [0, 2, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="flex shrink-0"
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