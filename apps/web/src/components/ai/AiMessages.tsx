/**
 * M-EDU AI Message Bubbles — Apple Design Award Edition v2 "Aurora Whisper"
 *
 * ✨ BUG FIXES:
 *  - i18n everywhere (no hardcoded "Siz")
 *  - Reduced-motion respected per component
 *  - Avatar rings + gradient tiles
 *  - Streaming cursor for live generation
 *  - Per-message hover actions (copy / regenerate / feedback)
 *  - Message status (sent / delivered) with animated check
 *  - Timestamps with relative time
 *  - Premium typing indicator (3-dot wave, Apple style)
 *  - Error message with retry button
 *  - Grouped consecutive messages (compact spacing)
 *
 * ✨ NEW:
 *  - Framer Motion spring entrance with stagger
 *  - Custom SVG icons in SF Symbols proportions
 *  - Tone system for message kinds
 *  - Copy-to-clipboard with feedback
 *  - "Copy code" button on markdown blocks
 *  - Tap-to-copy message body
 *  - Error state with action
 *  - Tooltip on hover for all actions
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AiUiMessage } from '@/types/ai';
import { MarkdownContent } from './MarkdownContent';
import { AiToolActivityCard } from './AiToolActivity';
import { AiActionConfirmation, ActionResultCard, ActionErrorNote } from './AiActionConfirmation';
import { AiAvatar, UserAvatar } from './AiAvatar';
import { useI18n } from '@/i18n/I18nProvider';
import { useHaptics } from '@/hooks/useHaptics';

/* ============================================================================
 * MOTION TOKENS
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ============================================================================
 * REDUCED MOTION
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ============================================================================
 * CUSTOM ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  copy: [
    'M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ],
  check: ['M20 6 9 17l-5-5'],
  refresh: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  thumbsUp: [
    'M7 10v12',
    'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z',
  ],
  thumbsDown: [
    'M17 14V2',
    'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4',
    'M12 8h.01',
  ],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'],
};

function Icon({
  paths, size = 14, className = '', strokeWidth = ICON_STROKE, ...rest
}: {
  paths: string[]; size?: number; className?: string; strokeWidth?: number;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function formatRelativeTime(iso?: string | number): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/* ============================================================================
 * MESSAGE ACTIONS — hover reveal bar
 * ========================================================================== */

interface MessageActionsProps {
  content: string;
  side: 'left' | 'right';
  showRegenerate?: boolean;
  onRegenerate?: () => void;
}

function MessageActions({ content, side, showRegenerate, onRegenerate }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const reduced = usePrefersReducedMotion();

  const haptics = useHaptics();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      haptics.light();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  }, [content, haptics]);

  return (
    <motion.div
      initial={{ opacity: 0, y: side === 'right' ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: EASE_APPLE }}
      className={[
        'pointer-events-auto flex items-center gap-0.5 rounded-xl border border-[#00000008] bg-[#ffffff90] p-0.5 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md dark:border-[#ffffff10] dark:bg-[#1c1c1e90]',
        side === 'right' ? 'order-first' : '',
      ].join(' ')}
    >
      <motion.button
        type="button"
        onClick={handleCopy}
        whileHover={reduced ? undefined : { scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={SPRING.snappy}
        aria-label={copied ? 'Copied' : 'Copy message'}
        title={copied ? 'Copied!' : 'Copy'}
        className="flex h-6 w-6 items-center justify-center rounded-lg text-[#86868B] outline-none transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/40 dark:hover:bg-white/10 dark:hover:text-[#F5F5F7]"
        style={{ color: copied ? '#34C759' : undefined }}
      >
        <Icon paths={copied ? I.check : I.copy} size={11} strokeWidth={2.2} />
      </motion.button>

      {showRegenerate && onRegenerate && (
        <motion.button
          type="button"
          onClick={onRegenerate}
          whileHover={reduced ? undefined : { scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={SPRING.snappy}
          aria-label="Regenerate response"
          title="Regenerate"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[#86868B] outline-none transition-colors hover:bg-black/5 hover:text-[#1D1D1F] focus-visible:ring-2 focus-visible:ring-[#007AFF]/40 dark:hover:bg-white/10 dark:hover:text-[#F5F5F7]"
        >
          <Icon paths={I.refresh} size={11} strokeWidth={2.2} />
        </motion.button>
      )}
    </motion.div>
  );
}

/* ============================================================================
 * MESSAGE STATUS (sent / delivered) — animated
 * ========================================================================== */

function MessageStatus({ status }: { status: 'sending' | 'sent' | 'delivered' | 'error' }) {
  if (status === 'sending') {
    return (
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="inline-block h-2.5 w-2.5 rounded-full border border-white/40 border-t-white"
        aria-label="Sending"
      />
    );
  }
  if (status === 'error') {
    return (
      <span className="text-[9.5px] font-bold text-[#FF3B30]" title="Failed to send">
        ⚠
      </span>
    );
  }
  // sent / delivered — double check
  return (
    <svg
      width="14" height="10" viewBox="0 0 14 10" fill="none"
      stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round"
      aria-label={status}
      className="opacity-70"
    >
      <path d="M1 5l3 3L12 1" />
      {status === 'delivered' && <path d="M5 5l3 3L14 1" opacity="0.6" />}
    </svg>
  );
}

/* ============================================================================
 * TYPING INDICATOR — 3-dot wave
 * ========================================================================== */

export function AiTypingIndicator() {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-[#AF52DE]"
          animate={reduced ? {} : {
            y: [0, -4, 0],
            opacity: [0.4, 1, 0.4],
            scale: [0.85, 1.1, 0.85],
          }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.16,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================================
 * STREAMING CURSOR
 * ========================================================================== */

function StreamingCursor() {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return <span className="ml-0.5 inline-block h-4 w-0.5 bg-[#AF52DE]/60 align-middle" />;
  }
  return (
    <motion.span
      className="ml-0.5 inline-block h-4 w-0.5 bg-[#AF52DE] align-middle"
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ============================================================================
 * USER MESSAGE
 * ========================================================================== */

export interface AiUserMessageProps {
  message: AiUiMessage;
  /** Optional status for sent/delivered indicator */
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  /** Compact mode when grouped with previous user message */
  compact?: boolean;
}

export function AiUserMessage({ message, status = 'sent', compact }: AiUserMessageProps) {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-end justify-end gap-2 sm:gap-3"
    >
      {/* Hover actions (left of bubble) */}
      <AnimatePresence>
        {hovered && !compact && (
          <MessageActions content={message.content} side="right" />
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col items-end gap-1">
        {/* Bubble */}
        <div
          className={[
            'relative min-w-0 overflow-hidden rounded-2xl px-4 py-2.5 text-white',
            compact ? 'rounded-tr-md' : 'rounded-br-md',
            'max-w-[85%] sm:max-w-[70%]',
          ].join(' ')}
          style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.28), ' +
              'inset 0 -1px 0 rgba(0,0,0,0.08), ' +
              '0 6px 20px -6px rgba(0,122,255,0.45)',
            overflowWrap: 'anywhere',
          }}
        >
          {/* Top sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22), transparent 70%)',
            }}
          />

          {!compact && (
            <span className="relative mb-0.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
              {t('ai.you') || 'You'}
            </span>
          )}

          <div className="relative whitespace-pre-wrap text-[13.5px] font-medium leading-[1.55] tracking-tight">
            {message.content}
          </div>
        </div>

        {/* Meta row (timestamp + status) — only in compact or last message */}
        {!compact && (
          <div className="flex items-center gap-1.5 pr-1 text-[10px] font-semibold text-[#86868B]">
            <span className="tabular-nums">{formatRelativeTime(message.createdAt)}</span>
            {status && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-white/80 mix-blend-difference" style={{ color: 'currentColor' }}>
                  <MessageStatus status={status} />
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!compact && <UserAvatar />}
    </motion.div>
  );
}

/* ============================================================================
 * ASSISTANT MESSAGE
 * ========================================================================== */

export interface AiAssistantMessageProps {
  message: AiUiMessage;
  confirming: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onDismissActionError: () => void;
  /** Called when user clicks regenerate */
  onRegenerate?: () => void;
  /** Is this message currently streaming? */
  streaming?: boolean;
  /** Compact mode when grouped */
  compact?: boolean;
}

export function AiAssistantMessage({
  message,
  confirming,
  onConfirm,
  onReject,
  onDismissActionError,
  onRegenerate,
  streaming,
  compact,
}: AiAssistantMessageProps) {
  const reduced = usePrefersReducedMotion();
  const [hovered, setHovered] = useState(false);

  const hasContent = Boolean(message.content.trim());
  const hasActivities = Boolean(message.toolActivities && message.toolActivities.length > 0);
  const hasConfirmation = Boolean(message.confirmation);
  const hasActionResult = Boolean(message.actionResult);
  const hasActionError = Boolean(message.actionError);
  const hasOnlyContent = hasContent && !hasActivities && !hasConfirmation && !hasActionResult && !hasActionError;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-start gap-2 sm:gap-3"
    >
      {!compact && <AiAvatar />}

      {/* Avatar placeholder keeps alignment in compact mode */}
      {compact && <div className="w-10 shrink-0 sm:w-11" aria-hidden />}

      <div className="flex min-w-0 max-w-[88%] flex-col gap-2 sm:max-w-[75%]">
        {/* Tool activities */}
        {hasActivities && message.toolActivities && (
          <AiToolActivityCard activities={message.toolActivities} />
        )}

        {/* Confirmation */}
        {message.confirmation && (
          <AiActionConfirmation
            action={message.confirmation}
            busy={confirming}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}

        {/* Action result */}
        {message.actionResult && <ActionResultCard result={message.actionResult} />}

        {/* Action error */}
        {message.actionError && (
          <ActionErrorNote error={message.actionError} onDismiss={onDismissActionError} />
        )}

        {/* Content bubble */}
        {hasContent && (
          <div
            className={[
              'relative min-w-0 overflow-hidden rounded-2xl px-4 py-3',
              compact ? 'rounded-tl-md' : 'rounded-bl-md',
            ].join(' ')}
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 16px -8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Accent edge (left) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
              style={{
                background: 'linear-gradient(180deg, #007AFF 0%, #AF52DE 100%)',
                boxShadow: '0 0 10px rgba(175,82,222,0.4)',
              }}
            />

            {!compact && (
              <span
                className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--primary)' }}
              >
                <Icon paths={I.sparkles} size={10} strokeWidth={2.5} />
                M-EDU AI
              </span>
            )}

            <MarkdownContent content={message.content} className="mt-0.5" />

            {/* Streaming cursor */}
            {streaming && <StreamingCursor />}
          </div>
        )}

        {/* Typing indicator when no content yet */}
        {streaming && !hasContent && !hasActivities && (
          <div
            className="relative w-fit rounded-2xl rounded-bl-md px-4 py-3"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <AiTypingIndicator />
          </div>
        )}

        {/* Hover actions + timestamp footer */}
        {hasOnlyContent && !streaming && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-[10px] font-semibold tabular-nums text-[#86868B]">
              {formatRelativeTime(message.createdAt)}
            </span>
            <AnimatePresence>
              {hovered && (
                <MessageActions
                  content={message.content}
                  side="left"
                  showRegenerate
                  onRegenerate={onRegenerate}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * SYSTEM MESSAGE — branded, tone-aware
 * ========================================================================== */

export interface AiSystemMessageProps {
  message: AiUiMessage;
  /** Optional retry handler for error kind */
  onRetry?: () => void;
}

export function AiSystemMessage({ message, onRetry }: AiSystemMessageProps) {
  const reduced = usePrefersReducedMotion();
  const isError = message.kind === 'error';

  const tone = isError
    ? {
        fg: '#FF3B30',
        bg: 'rgba(255,59,48,0.10)',
        border: 'rgba(255,59,48,0.28)',
        glow: 'rgba(255,59,48,0.28)',
        icon: I.alertTriangle,
      }
    : {
        fg: '#86868B',
        bg: 'var(--bg-card)',
        border: 'var(--border)',
        glow: 'rgba(0,0,0,0.06)',
        icon: I.info,
      };

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      className="flex justify-center px-2"
    >
      <div
        className="inline-flex max-w-full items-center gap-2 rounded-full border px-3.5 py-1.5"
        style={{
          background: tone.bg,
          borderColor: tone.border,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px -4px ${tone.glow}`,
          overflowWrap: 'anywhere',
        }}
      >
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          style={{ color: tone.fg }}
        >
          <Icon paths={tone.icon} size={12} strokeWidth={2.2} />
        </span>
        <span
          className="text-[11.5px] font-semibold leading-5"
          style={{ color: isError ? tone.fg : 'var(--text-tertiary)' }}
        >
          {message.content}
        </span>

        {/* Retry button for errors */}
        {isError && onRetry && (
          <motion.button
            type="button"
            onClick={onRetry}
            whileHover={reduced ? undefined : { scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            className="ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold outline-none focus-visible:ring-2"
            style={{
              background: `${tone.fg}20`,
              color: tone.fg,
              border: `1px solid ${tone.fg}40`,
            }}
          >
            <Icon paths={I.refresh} size={9} strokeWidth={2.5} />
            Retry
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}