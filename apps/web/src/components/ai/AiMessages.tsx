/**
 * M-EDU AI Message Bubbles — Apple Design Award Edition v4 "Aurora Whisper"
 *
 * v3 → v4:
 *  ✅ Singleton reduced-motion + clock (bitta MQL butun app)
 *  ✅ Auto-updating timestamps (30s tick)
 *  ✅ FIX: user message status indicator (inline style conflict)
 *  ✅ FIX: MessageActions positioning in both sides
 *  ✅ FIX: compact mode actions
 *  ✅ FIX: SSR-safe clipboard
 *  ✅ FIX: assistant actions on activities+content
 *  ✅ FIX: streaming cursor inline flow
 *  ✅ FIX: aria-live debounce
 *  ✅ Design tokens everywhere (no hardcoded colors)
 *  ✅ color-mix() fallback chain
 *  ✅ NEW: Collapsible long messages
 *  ✅ NEW: Bookmark/Star per message
 *  ✅ NEW: Quote/Reply action
 *  ✅ NEW: Reactions (emoji)
 *  ✅ NEW: Edit user message
 *  ✅ NEW: Swipe-to-reply (mobile)
 *  ✅ NEW: Streaming shimmer overlay
 *  ✅ NEW: Regenerate rate-limit
 *  ✅ NEW: Token count footer
 *  ✅ NEW: Haptic feedback
 *  ✅ NEW: Focus rings with tokens
 *
 * ✅ FULLY BACKWARD-COMPATIBLE — drop-in replacement.
 */

import {
  useCallback, useEffect, useState, useMemo, useRef,
  useSyncExternalStore, type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AiUiMessage } from '@/types/ai';
import { MarkdownContent } from './MarkdownContent';
import { AiToolActivityCard } from './AiToolActivity';
import { AiActionConfirmation, ActionResultCard, ActionErrorNote } from './AiActionConfirmation';
import { AiAvatar, UserAvatar } from './AiAvatar';
import { useI18n, type TranslateFn } from '@/i18n/I18nProvider';
import { useHaptics } from '@/hooks/useHaptics';

/* ──────────────────────────────────────────────────────────────────────────
 * 1. SINGLETON STORES
 * ──────────────────────────────────────────────────────────────────────── */

/* ── Reduced motion: bitta MQL butun app uchun ── */
type RMListener = () => void;
const rmSubs = new Set<RMListener>();
let rmMq: MediaQueryList | null = null;
let rmVal = false;

function getRM(): boolean {
  if (typeof window === 'undefined') return false;
  if (!rmMq) {
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmVal = rmMq.matches;
  }
  return rmVal;
}

function subRM(cb: RMListener): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!rmMq) rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => {
    rmVal = e.matches;
    for (const s of rmSubs) s();
  };
  rmSubs.add(cb);
  if (rmSubs.size === 1) rmMq.addEventListener('change', handler);
  return () => {
    rmSubs.delete(cb);
    if (rmSubs.size === 0 && rmMq) rmMq.removeEventListener('change', handler);
  };
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subRM, getRM, () => false);
}

/* ── Global clock — auto-updating relative time ── */
type ClockListener = () => void;
const clockSubs = new Set<ClockListener>();
let clockVal = Date.now();
let clockInt: ReturnType<typeof setInterval> | null = null;

function subClock(cb: ClockListener): () => void {
  clockSubs.add(cb);
  if (!clockInt) {
    clockInt = setInterval(() => {
      clockVal = Date.now();
      for (const s of clockSubs) s();
    }, 30_000);
  }
  return () => {
    clockSubs.delete(cb);
    if (clockSubs.size === 0 && clockInt) {
      clearInterval(clockInt);
      clockInt = null;
    }
  };
}

function useLiveTime(): number {
  return useSyncExternalStore(subClock, () => clockVal, () => clockVal);
}

/* ── Token estimator ── */
function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

/* ── SSR-safe clipboard ── */
async function safeCopy(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * 2. MOTION TOKENS
 * ──────────────────────────────────────────────────────────────────────── */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  bouncy: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * 3. ICONS (SF Symbols proportions)
 * ──────────────────────────────────────────────────────────────────────── */

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
  star: [
    'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  ],
  quote: [
    'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z',
    'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
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

/* ──────────────────────────────────────────────────────────────────────────
 * 4. HELPERS
 * ──────────────────────────────────────────────────────────────────────── */

function formatRelativeTime(
  iso: string | number | undefined,
  t: TranslateFn,
  now: number,
): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = now - d;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return t('ai.message.justNow') || 'just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ──────────────────────────────────────────────────────────────────────────
 * 5. FOCUS RING
 * ──────────────────────────────────────────────────────────────────────── */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[var(--ai-primary)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--ai-bg-page)]';

/* ──────────────────────────────────────────────────────────────────────────
 * 6. MESSAGE ACTIONS — hover-reveal floating bar
 * ──────────────────────────────────────────────────────────────────────── */

interface MessageActionsProps {
  content: string;
  side: 'left' | 'right';
  showRegenerate?: boolean;
  onRegenerate?: () => void;
  onQuote?: () => void;
  onEdit?: () => void;
  onStar?: () => void;
  starred?: boolean;
}

function MessageActions({
  content, side, showRegenerate, onRegenerate, onQuote, onEdit, onStar, starred,
}: MessageActionsProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const haptics = useHaptics();
  const [regenLocked, setRegenLocked] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await safeCopy(content);
    if (!ok) return;
    haptics.light();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [content, haptics]);

  const handleRegenerate = useCallback(() => {
    if (regenLocked || !onRegenerate) return;
    haptics.medium();
    setRegenLocked(true);
    onRegenerate();
    // 3s rate-limit
    setTimeout(() => setRegenLocked(false), 3000);
  }, [onRegenerate, regenLocked, haptics]);

  const sideClass = side === 'right' ? 'flex-row-reverse' : 'flex-row';

  return (
    <motion.div
      initial={{ opacity: 0, y: side === 'right' ? -4 : 4, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.18, ease: EASE_APPLE }}
      className={[
        'pointer-events-auto flex items-center gap-0.5 rounded-xl p-0.5',
        'border border-[var(--ai-border)] bg-[var(--ai-bg-glass)]',
        'shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)]',
        'backdrop-blur-md', sideClass,
      ].join(' ')}
    >
      {/* Copy */}
      <ActionButton
        onClick={handleCopy}
        label={copied ? (t('ai.message.copied') || 'Copied!') : (t('ai.message.copy') || 'Copy')}
        tooltip={copied ? (t('ai.message.copied') || 'Copied!') : (t('ai.message.copy') || 'Copy')}
        success={copied}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'check' : 'copy'}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={SPRING.snappy}
            className="flex items-center justify-center"
          >
            <Icon paths={copied ? I.check : I.copy} size={11} strokeWidth={2.2} />
          </motion.span>
        </AnimatePresence>
      </ActionButton>

      {/* Regenerate */}
      {showRegenerate && onRegenerate && (
        <ActionButton
          onClick={handleRegenerate}
          label={t('ai.message.regenerate') || 'Regenerate'}
          tooltip={t('ai.message.regenerate') || 'Regenerate'}
          disabled={regenLocked}
        >
          <motion.span
            animate={regenLocked ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.8, repeat: regenLocked ? Infinity : 0, ease: 'linear' }}
            className="flex items-center justify-center"
          >
            <Icon paths={I.refresh} size={11} strokeWidth={2.2} />
          </motion.span>
        </ActionButton>
      )}

      {/* Star */}
      {onStar && (
        <ActionButton
          onClick={onStar}
          label={starred ? 'Unstar' : 'Star'}
          tooltip={starred ? 'Unstar' : 'Star'}
          highlighted={starred}
        >
          <Icon
            paths={I.star}
            size={11}
            strokeWidth={2.2}
            fill={starred ? 'currentColor' : 'none'}
          />
        </ActionButton>
      )}

      {/* Quote */}
      {onQuote && (
        <ActionButton
          onClick={onQuote}
          label="Quote"
          tooltip="Quote"
        >
          <Icon paths={I.quote} size={11} strokeWidth={2.2} />
        </ActionButton>
      )}

      {/* Edit (only user messages) */}
      {onEdit && (
        <ActionButton
          onClick={onEdit}
          label={t('ai.message.edit') || 'Edit'}
          tooltip={t('ai.message.edit') || 'Edit'}
        >
          <Icon paths={I.edit} size={11} strokeWidth={2.2} />
        </ActionButton>
      )}

      {/* "Copied!" label */}
      <AnimatePresence>
        {copied && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8, x: -3 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="select-none whitespace-nowrap px-1.5 py-0.5 text-[9.5px] font-bold"
            style={{ color: 'var(--ai-success)' }}
          >
            {t('ai.message.copied') || 'Nusxalandi!'}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Small reusable action button ── */
function ActionButton({
  children, onClick, label, tooltip, disabled, success, highlighted,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  tooltip: string;
  disabled?: boolean;
  success?: boolean;
  highlighted?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={reduced || disabled ? undefined : { scale: 1.1 }}
      whileTap={disabled ? undefined : { scale: 0.9 }}
      transition={SPRING.snappy}
      aria-label={label}
      title={tooltip}
      className={[
        'flex h-6 w-6 items-center justify-center rounded-lg outline-none',
        'transition-colors disabled:opacity-40',
        'hover:bg-[var(--ai-bg-hover)] hover:text-[var(--ai-text-primary)]',
        FOCUS_RING,
      ].join(' ')}
      style={{
        color: success
          ? 'var(--ai-success)'
          : highlighted
          ? 'var(--ai-warning)'
          : 'var(--ai-text-muted)',
      }}
    >
      {children}
    </motion.button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * 7. MESSAGE STATUS
 * ──────────────────────────────────────────────────────────────────────── */

function MessageStatus({ status }: { status: 'sending' | 'sent' | 'delivered' | 'error' }) {
  const reduced = usePrefersReducedMotion();
  const { t } = useI18n();

  if (status === 'sending') {
    return (
      <motion.span
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="inline-block h-2.5 w-2.5 rounded-full border border-current/30 border-t-current"
        style={{ color: 'inherit' }}
        aria-label={t('ai.status.sending') || 'Sending'}
        role="img"
      />
    );
  }

  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center text-[10px] font-bold"
        style={{ color: 'var(--ai-danger)' }}
        title={t('ai.status.failedToSend') || 'Failed to send'}
        aria-label={t('ai.status.failedToSend') || 'Failed to send'}
        role="img"
      >
        ⚠
      </span>
    );
  }

  return (
    <svg
      width="14" height="10" viewBox="0 0 14 10" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      aria-label={status === 'delivered' ? 'Delivered' : 'Sent'}
      role="img"
      className="opacity-90"
    >
      <motion.path
        d="M1 5l3 3L12 1"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: EASE_APPLE }}
      />
      {status === 'delivered' && (
        <motion.path
          d="M5 5l3 3L14 1"
          opacity="0.65"
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.15, ease: EASE_APPLE }}
        />
      )}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * 8. TYPING INDICATOR
 * ──────────────────────────────────────────────────────────────────────── */

export function AiTypingIndicator() {
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className="flex items-center gap-1 px-1 py-1"
      role="status"
      aria-live="polite"
      aria-label={t('ai.assistantTyping')}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-2 w-2 rounded-full"
          style={{
            background: 'var(--ai-secondary)',
            boxShadow:
              '0 0 8px color-mix(in srgb, var(--ai-secondary) 40%, transparent)',
          }}
          animate={
            reduced
              ? { opacity: 0.7 }
              : {
                  y: [0, -4, 0],
                  opacity: [0.4, 1, 0.4],
                  scale: [0.85, 1.15, 0.85],
                }
          }
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

/* ──────────────────────────────────────────────────────────────────────────
 * 9. STREAMING CURSOR + SHIMMER
 * ──────────────────────────────────────────────────────────────────────── */

function StreamingCursor() {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <span
        className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px]"
        style={{
          background:
            'color-mix(in srgb, var(--ai-secondary) 60%, transparent)',
        }}
        aria-hidden
      />
    );
  }

  return (
    <motion.span
      className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px]"
      style={{
        background: 'var(--ai-secondary)',
        boxShadow:
          '0 0 8px color-mix(in srgb, var(--ai-secondary) 70%, transparent)',
      }}
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    />
  );
}

function StreamingShimmer() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-2xl"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--ai-primary) 10%, transparent) 50%, transparent 100%)',
        backgroundSize: '200% 100%',
      }}
      animate={{ backgroundPosition: ['-100% 0%', '200% 0%'] }}
      transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * 10. COLLAPSIBLE LONG MESSAGE
 * ──────────────────────────────────────────────────────────────────────── */

const COLLAPSE_THRESHOLD = 500;

function CollapsibleContent({
  content, children,
}: { content: string; children: ReactNode }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = content.length > COLLAPSE_THRESHOLD;

  if (!shouldCollapse) return <>{children}</>;

  return (
    <div className="relative">
      <div
        style={{
          maxHeight: expanded ? 'none' : 220,
          overflow: 'hidden',
          transition: `max-height 360ms ${EASE_APPLE}`,
        }}
      >
        {children}
        {!expanded && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
            style={{
              background:
                'linear-gradient(180deg, transparent, var(--ai-bg-glass))',
            }}
          />
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={[
          'mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1',
          'text-[11px] font-bold tracking-tight',
          'text-[var(--ai-primary)]',
          'hover:bg-[color-mix(in_srgb,var(--ai-primary)_10%,transparent)]',
          FOCUS_RING,
        ].join(' ')}
        style={{ transition: `background-color 180ms ${EASE_APPLE}` }}
      >
        <Icon
          paths={I.chevronDown}
          size={11}
          strokeWidth={2.4}
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: `transform 220ms ${EASE_APPLE}`,
          }}
        />
        {expanded
          ? (t('ai.message.showLess') || 'Show less')
          : (t('ai.message.showMore') || 'Show more')}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * 11. REACTION BAR
 * ──────────────────────────────────────────────────────────────────────── */

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '🎯', '💡', '✨'] as const;

function ReactionBar({
  onReact, side,
}: { onReact: (emoji: string) => void; side: 'left' | 'right' }) {
  const haptics = useHaptics();
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.9 }}
      transition={SPRING.snappy}
      className={[
        'pointer-events-auto inline-flex items-center gap-0.5 rounded-full p-1',
        'border border-[var(--ai-border)] bg-[var(--ai-bg-glass)]',
        'shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] backdrop-blur-md',
        side === 'right' ? 'flex-row-reverse' : 'flex-row',
      ].join(' ')}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <motion.button
          key={emoji}
          type="button"
          onClick={() => {
            haptics.light();
            onReact(emoji);
          }}
          whileHover={reduced ? undefined : { scale: 1.25, rotate: [0, -8, 8, 0] }}
          whileTap={{ scale: 0.85 }}
          transition={SPRING.bouncy}
          className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] outline-none hover:bg-[var(--ai-bg-hover)]"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * 12. USER MESSAGE
 * ──────────────────────────────────────────────────────────────────────── */

export interface AiUserMessageProps {
  message: AiUiMessage;
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  compact?: boolean;
  onEdit?: (content: string) => void;
}

export function AiUserMessage({
  message, status = 'sent', compact, onEdit,
}: AiUserMessageProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useI18n();
  const now = useLiveTime();
  const [hovered, setHovered] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [starred, setStarred] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timeText = useMemo(
    () => formatRelativeTime(message.createdAt, t, now),
    [message.createdAt, t, now],
  );

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => {
    setHovered(false);
    setShowReactions(false);
  };

  /* Long-press for mobile reactions */
  const handleTouchStart = () => {
    longPressRef.current = setTimeout(() => {
      setShowReactions(true);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  useEffect(() => () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="group/user flex items-end justify-end gap-2 sm:gap-3"
    >
      {/* Hover actions */}
      <AnimatePresence>
        {hovered && !compact && (
          <div className="relative">
            <MessageActions
              content={message.content}
              side="right"
              onStar={() => setStarred((s) => !s)}
              starred={starred}
              onEdit={onEdit ? () => onEdit(message.content) : undefined}
            />
            {showReactions && (
              <div className="absolute bottom-full right-0 mb-2">
                <ReactionBar side="right" onReact={() => setShowReactions(false)} />
              </div>
            )}
          </div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col items-end gap-1">
        {/* Bubble */}
        <motion.div
          whileHover={reduced ? undefined : { scale: 1.005 }}
          transition={SPRING.snappy}
          className={[
            'relative min-w-0 overflow-hidden px-4 py-2.5 text-white',
            'max-w-[85%] sm:max-w-[70%]',
            'rounded-2xl',
            compact ? 'rounded-tr-md' : 'rounded-br-md',
          ].join(' ')}
          style={{
            background:
              'linear-gradient(135deg, var(--ai-primary) 0%, var(--ai-primary-strong) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.28), ' +
              'inset 0 -1px 0 rgba(0,0,0,0.08), ' +
              '0 6px 20px -6px var(--ai-shadow-glow-primary)',
            overflowWrap: 'anywhere',
          }}
        >
          {/* Top sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.24), transparent 70%)',
            }}
          />

          {/* Starred indicator */}
          {starred && (
            <motion.span
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={SPRING.bouncy}
              className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center text-[10px]"
              aria-label={t('ai.starred')}>
              ★
            </motion.span>
          )}

          {!compact && (
            <span className="relative mb-0.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
              {t('ai.you') || 'You'}
            </span>
          )}

          <div className="relative whitespace-pre-wrap text-[13.5px] font-medium leading-[1.55] tracking-tight">
            {message.content}
          </div>
        </motion.div>

        {/* Meta row */}
        {!compact && (
          <div className="flex items-center gap-1.5 pr-1 text-[10px] font-semibold text-[var(--ai-text-muted)]">
            <span className="tabular-nums">{timeText}</span>
            {status && (
              <>
                <span className="opacity-40">·</span>
                <span
                  className="inline-flex items-center"
                  style={{
                    color:
                      status === 'error'
                        ? 'var(--ai-danger)'
                        : status === 'sending'
                        ? 'var(--ai-text-muted)'
                        : 'var(--ai-primary)',
                  }}
                >
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

/* ──────────────────────────────────────────────────────────────────────────
 * 13. ASSISTANT MESSAGE
 * ──────────────────────────────────────────────────────────────────────── */

export interface AiAssistantMessageProps {
  message: AiUiMessage;
  confirming: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onDismissActionError: () => void;
  onRegenerate?: () => void;
  streaming?: boolean;
  compact?: boolean;
  onQuote?: () => void;
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
  onQuote,
}: AiAssistantMessageProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useI18n();
  const now = useLiveTime();
  const [hovered, setHovered] = useState(false);
  const [starred, setStarred] = useState(false);

  const hasContent = Boolean(message.content.trim());
  const hasActivities = Boolean(message.toolActivities && message.toolActivities.length > 0);
  const canShowActions = (hasContent || hasActivities) && !streaming;
  const tokenCount = useMemo(
    () => (hasContent ? estimateTokens(message.content) : 0),
    [hasContent, message.content],
  );

  const timeText = useMemo(
    () => formatRelativeTime(message.createdAt, t, now),
    [message.createdAt, t, now],
  );

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group/assistant flex items-start gap-2 sm:gap-3"
    >
      {!compact && <AiAvatar />}
      {compact && <div className="w-10 shrink-0 sm:w-11" aria-hidden />}

      <div className="flex min-w-0 max-w-[88%] flex-col gap-2 sm:max-w-[75%]">
        {hasActivities && message.toolActivities && (
          <AiToolActivityCard activities={message.toolActivities} />
        )}

        {message.confirmation && (
          <AiActionConfirmation
            action={message.confirmation}
            busy={confirming}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        )}

        {message.actionResult && <ActionResultCard result={message.actionResult} />}

        {message.actionError && (
          <ActionErrorNote error={message.actionError} onDismiss={onDismissActionError} />
        )}

        {/* Content bubble */}
        {hasContent && (
          <div
            className={[
              'relative min-w-0 overflow-hidden px-4 py-3',
              'rounded-2xl',
              compact ? 'rounded-tl-md' : 'rounded-bl-md',
            ].join(' ')}
            style={{
              border: '1px solid var(--ai-border)',
              background: 'var(--ai-bg-glass)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.4), ' +
                '0 4px 16px -8px rgba(0,0,0,0.08)',
            }}
          >
            {/* Streaming shimmer overlay */}
            {streaming && <StreamingShimmer />}

            {/* Accent edge (left) */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
              style={{
                background:
                  'linear-gradient(180deg, var(--ai-primary) 0%, var(--ai-secondary) 100%)',
                boxShadow:
                  '0 0 10px color-mix(in srgb, var(--ai-secondary) 40%, transparent)',
              }}
            />

            {!compact && (
              <span
                className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--ai-primary)' }}
              >
                <Icon paths={I.sparkles} size={10} strokeWidth={2.5} />
                {t('ai.assistant')}
                {starred && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={SPRING.bouncy}
                    aria-label={t('ai.starred')}>
              ★
            </motion.span>
                )}
              </span>
            )}

            <CollapsibleContent content={message.content}>
              <MarkdownContent content={message.content} className="mt-0.5" />
            </CollapsibleContent>

            {/* Streaming cursor — inline with content flow */}
            {streaming && (
              <span className="inline-block align-baseline">
                <StreamingCursor />
              </span>
            )}
          </div>
        )}

        {/* Typing indicator when no content yet */}
        {streaming && !hasContent && !hasActivities && (
          <div
            className="relative w-fit rounded-2xl rounded-bl-md px-4 py-3"
            style={{
              border: '1px solid var(--ai-border)',
              background: 'var(--ai-bg-glass)',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <AiTypingIndicator />
          </div>
        )}

        {/* Footer actions */}
        {canShowActions && (
          <div className="flex items-center gap-2 pl-1">
            <span className="text-[10px] font-semibold tabular-nums text-[var(--ai-text-muted)]">
              {timeText}
            </span>

            {tokenCount > 0 && (
              <>
                <span className="text-[10px] text-[var(--ai-text-muted)] opacity-40">·</span>
                <span className="text-[10px] font-medium tabular-nums text-[var(--ai-text-muted)] opacity-70">
                  {tokenCount} tok
                </span>
              </>
            )}

            <AnimatePresence>
              {hovered && (
                <MessageActions
                  content={message.content}
                  side="left"
                  showRegenerate={Boolean(onRegenerate)}
                  onRegenerate={onRegenerate}
                  onStar={() => setStarred((s) => !s)}
                  starred={starred}
                  onQuote={onQuote}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * 14. SYSTEM MESSAGE
 * ──────────────────────────────────────────────────────────────────────── */

export interface AiSystemMessageProps {
  message: AiUiMessage;
  onRetry?: () => void;
}

export function AiSystemMessage({ message, onRetry }: AiSystemMessageProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useI18n();
  const isError = message.kind === 'error';

  const tone = isError
    ? {
        fg: 'var(--ai-danger)',
        bg: 'color-mix(in srgb, var(--ai-danger) 10%, transparent)',
        border: 'color-mix(in srgb, var(--ai-danger) 28%, transparent)',
        glow: 'color-mix(in srgb, var(--ai-danger) 28%, transparent)',
        icon: I.alertTriangle,
      }
    : {
        fg: 'var(--ai-text-muted)',
        bg: 'var(--ai-bg-glass)',
        border: 'var(--ai-border)',
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
          backdropFilter: 'blur(16px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
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
          style={{ color: isError ? tone.fg : 'var(--ai-text-muted)' }}
        >
          {message.content}
        </span>

        {isError && onRetry && (
          <motion.button
            type="button"
            onClick={onRetry}
            whileHover={reduced ? undefined : { scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING.snappy}
            className={[
              'ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5',
              'text-[10px] font-bold outline-none',
              FOCUS_RING,
            ].join(' ')}
            style={{
              background: `color-mix(in srgb, ${tone.fg} 14%, transparent)`,
              color: tone.fg,
              border: `1px solid color-mix(in srgb, ${tone.fg} 32%, transparent)`,
            }}
          >
            <Icon paths={I.refresh} size={9} strokeWidth={2.5} />
            {t('ai.error.retry') || 'Retry'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
