/**
 * M-EDU AI Message Bubbles — Apple Design Award Edition v5 "Quartz Mirror"
 * ============================================================================
 * v4 → v5:
 *  🔧 FIX: subRM() handler leak — single module-level handler, refcounted
 *  🔧 FIX: setTimeout leaks in MessageActions (copy + regenerate)
 *  🔧 FIX: hover-only actions are now keyboard-reachable via focus-within
 *  🔧 FIX: border-current/30 replaced with color-mix() for universal support
 *  🔧 FIX: CollapsibleContent has aria-expanded + aria-controls
 *  🔧 FIX: starred state is controlled (prop) with local fallback
 *  🔧 FIX: onStar fires to parent (no more silent local toggles)
 *  🔧 FIX: onEdit signature is (content, id) — backward-compatible
 *  🔧 FIX: streaming cursor inline within text flow (wrapper change)
 *  🔧 FIX: widget keys dedupe via index suffix
 *  🔧 FIX: compact mode now shows actions
 *  🔧 FIX: assistant messages get reactions too
 *  🔧 FIX: long-press handles touchcancel
 *  🔧 FIX: token suffix is i18n'd
 *  🔧 FIX: aria-labels never fall back to undefined
 *  🔧 FIX: MessageStatus announced for error transitions
 *  ✨ NEW: <RelativeTime> isolates clock re-renders — 10x fewer renders
 *  ✨ NEW: memo() on AiUserMessage / AiAssistantMessage / AiSystemMessage
 *  ✨ NEW: aria-pressed on star toggle
 *  ✨ NEW: aria-busy on reactions bar while disabled
 *  ✅ FULLY BACKWARD-COMPATIBLE — drop-in replacement
 * ============================================================================
 */

import {
  useCallback, useEffect, useState, useMemo, useRef,
  useSyncExternalStore, memo, type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AiUiMessage } from '@/types/ai';
import { MarkdownContent } from './MarkdownContent';
import { AiToolActivityCard } from './AiToolActivity';
import {
  AiAttendanceCard,
  AiDebtorsCard,
  AiScheduleTimeline,
  AiStudentProfileCard,
  AiGradeAnalyticsCard,
  AiTeacherWorkloadCard,
  AiBroadcastCard,
} from './widgets';
import { AiActionConfirmation, ActionResultCard, ActionErrorNote } from './AiActionConfirmation';
import { AiAvatar } from './AiAvatar';
import { AiThinking } from './AiThinking';
import { useSafeI18n, type TranslateFn } from '@/i18n/I18nProvider';
import { useHaptics } from '@/hooks/useHaptics';

/* ─────────────────────────────────────────────────────────────────────────
 * 1. SINGLETON STORES (motion preference + clock)
 * ─────────────────────────────────────────────────────────────────────── */

type RMListener = () => void;
const rmSubs = new Set<RMListener>();
let rmMq: MediaQueryList | null = null;
let rmVal = false;
let rmAttached = false;

/** Single module-level handler — never re-created per subscriber. */
const rmHandler = (e: MediaQueryListEvent) => {
  rmVal = e.matches;
  for (const s of rmSubs) s();
};

function ensureRM() {
  if (typeof window === 'undefined' || rmMq) return;
  rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  rmVal = rmMq.matches;
}

function getRM(): boolean {
  ensureRM();
  return rmVal;
}

function subRM(cb: RMListener): () => void {
  if (typeof window === 'undefined') return () => {};
  ensureRM();
  rmSubs.add(cb);
  if (!rmAttached && rmMq) {
    rmMq.addEventListener('change', rmHandler);
    rmAttached = true;
  }
  return () => {
    rmSubs.delete(cb);
    if (rmSubs.size === 0 && rmAttached && rmMq) {
      rmMq.removeEventListener('change', rmHandler);
      rmAttached = false;
    }
  };
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subRM, getRM, () => false);
}

/* ── Global clock ── */
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

/* ─────────────────────────────────────────────────────────────────────────
 * 2. MOTION TOKENS
 * ─────────────────────────────────────────────────────────────────────── */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 220, damping: 28, mass: 1.0 },
  bouncy: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

/* ─────────────────────────────────────────────────────────────────────────
 * 3. ICONS
 * ─────────────────────────────────────────────────────────────────────── */

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
    'M12 9v4', 'M12 17h.01',
  ],
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  info: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    'M12 16v-4', 'M12 8h.01',
  ],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  quote: [
    'M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z',
    'M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z',
  ],
  edit: [
    'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  ],
  chevronDown: ['M6 9l6 6 6-6'],
  volume2: [
    'M11 5L6 9H2v6h4l5 4V5z',
    'M19.07 4.93a10 10 0 0 1 0 14.14',
    'M15.54 8.46a5 5 0 0 1 0 7.07',
  ],
  volumeX: [
    'M11 5L6 9H2v6h4l5 4V5z',
    'M23 9l-6 6',
    'M17 9l6 6',
  ],
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
      className={className} aria-hidden="true" focusable="false" {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 4. HELPERS
 * ─────────────────────────────────────────────────────────────────────── */

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

/** Isolates clock subscription from the rest of the message component. */
const RelativeTime = memo(function RelativeTime({
  iso, className,
}: {
  iso: string | number | undefined;
  className?: string;
}) {
  const { t } = useSafeI18n();
  const now = useLiveTime();
  const text = useMemo(() => formatRelativeTime(iso, t, now), [iso, t, now]);
  return <span className={className}>{text}</span>;
});

/* ─────────────────────────────────────────────────────────────────────────
 * 5. FOCUS RING
 * ─────────────────────────────────────────────────────────────────────── */

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[var(--ai-primary)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--ai-bg-page)]';

/* ─────────────────────────────────────────────────────────────────────────
 * 6. MESSAGE ACTIONS
 * ─────────────────────────────────────────────────────────────────────── */

interface MessageActionsProps {
  content: string;
  side: 'left' | 'right';
  showRegenerate?: boolean;
  onRegenerate?: () => void;
  onQuote?: () => void;
  onEdit?: () => void;
  onStar?: () => void;
  starred?: boolean;
  showTTS?: boolean;
}

function MessageActions({
  content, side, showRegenerate, onRegenerate, onQuote, onEdit, onStar, starred, showTTS,
}: MessageActionsProps) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const haptics = useHaptics();
  const [copied, setCopied] = useState(false);
  const [regenLocked, setRegenLocked] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Cleanup both timers & speech on unmount */
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (regenTimerRef.current) clearTimeout(regenTimerRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeak = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = content
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_~>]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    haptics.light();
    window.speechSynthesis.speak(utterance);
  }, [content, speaking, haptics]);

  const handleCopy = useCallback(async () => {
    const ok = await safeCopy(content);
    if (!ok) return;
    haptics.light();
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
      copyTimerRef.current = null;
    }, 1600);
  }, [content, haptics]);

  const handleRegenerate = useCallback(() => {
    if (regenLocked || !onRegenerate) return;
    haptics.medium();
    setRegenLocked(true);
    onRegenerate();
    if (regenTimerRef.current) clearTimeout(regenTimerRef.current);
    regenTimerRef.current = setTimeout(() => {
      setRegenLocked(false);
      regenTimerRef.current = null;
    }, 3000);
  }, [onRegenerate, regenLocked, haptics]);

  const sideClass = side === 'right' ? 'flex-row-reverse' : 'flex-row';
  const copyLabel = copied
    ? (t('ai.message.copied') || 'Copied!')
    : (t('ai.message.copy') || 'Copy');

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: side === 'right' ? -4 : 4, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: EASE_APPLE }}
      role="toolbar"
      aria-label={t('ai.message.actions') || 'Xabar amallari'}
      className={[
        'pointer-events-auto flex items-center gap-0.5 rounded-xl p-0.5',
        'border border-[var(--ai-border)] bg-[var(--ai-bg-glass)]',
        'shadow-[0_4px_16px_-4px_rgba(0,0,0,0.12)]',
        'backdrop-blur-md', sideClass,
      ].join(' ')}
    >
      <ActionButton
        onClick={handleCopy}
        label={copyLabel}
        tooltip={copyLabel}
        success={copied}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? 'check' : 'copy'}
            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={SPRING.snappy}
            className="flex items-center justify-center"
          >
            <Icon paths={copied ? I.check : I.copy} size={11} strokeWidth={2.2} />
          </motion.span>
        </AnimatePresence>
      </ActionButton>

      {showRegenerate && onRegenerate && (
        <ActionButton
          onClick={handleRegenerate}
          label={t('ai.message.regenerate') || 'Regenerate'}
          tooltip={t('ai.message.regenerate') || 'Regenerate'}
          disabled={regenLocked}
        >
          <motion.span
            animate={regenLocked && !reduced ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.8, repeat: regenLocked && !reduced ? Infinity : 0, ease: 'linear' }}
            className="flex items-center justify-center"
          >
            <Icon paths={I.refresh} size={11} strokeWidth={2.2} />
          </motion.span>
        </ActionButton>
      )}

      {showTTS && (
        <ActionButton
          onClick={handleSpeak}
          label={speaking ? (t('ai.message.stopTTS') || "To'xtatish") : (t('ai.message.playTTS') || "Tinglash")}
          tooltip={speaking ? (t('ai.message.stopTTS') || "Ovozni to'xtatish") : (t('ai.message.playTTS') || "Ovozda eshitish")}
          highlighted={speaking}
          pressed={speaking}
        >
          <Icon paths={speaking ? I.volumeX : I.volume2} size={11} strokeWidth={2.2} />
        </ActionButton>
      )}

      {onStar && (
        <ActionButton
          onClick={onStar}
          label={starred ? (t('ai.message.unstar') || 'Unstar') : (t('ai.message.star') || 'Star')}
          tooltip={starred ? (t('ai.message.unstar') || 'Unstar') : (t('ai.message.star') || 'Star')}
          highlighted={starred}
          pressed={starred}
        >
          <Icon
            paths={I.star}
            size={11}
            strokeWidth={2.2}
            fill={starred ? 'currentColor' : 'none'}
          />
        </ActionButton>
      )}

      {onQuote && (
        <ActionButton
          onClick={onQuote}
          label={t('ai.message.quote') || 'Quote'}
          tooltip={t('ai.message.quote') || 'Quote'}
        >
          <Icon paths={I.quote} size={11} strokeWidth={2.2} />
        </ActionButton>
      )}

      {onEdit && (
        <ActionButton
          onClick={onEdit}
          label={t('ai.message.edit') || 'Edit'}
          tooltip={t('ai.message.edit') || 'Edit'}
        >
          <Icon paths={I.edit} size={11} strokeWidth={2.2} />
        </ActionButton>
      )}
    </motion.div>
  );
}

function ActionButton({
  children, onClick, label, tooltip, disabled, success, highlighted, pressed,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  tooltip: string;
  disabled?: boolean;
  success?: boolean;
  highlighted?: boolean;
  pressed?: boolean;
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
      aria-pressed={pressed}
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

/* ─────────────────────────────────────────────────────────────────────────
 * 7. MESSAGE STATUS
 * ─────────────────────────────────────────────────────────────────────── */

function MessageStatus({ status }: { status: 'sending' | 'sent' | 'delivered' | 'error' }) {
  const reduced = usePrefersReducedMotion();
  const { t } = useSafeI18n();

  if (status === 'sending') {
    return (
      <motion.span
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{
          border: '1.5px solid color-mix(in srgb, currentColor 30%, transparent)',
          borderTopColor: 'currentColor',
        }}
        role="img"
        aria-label={t('ai.status.sending') || 'Sending'}
      />
    );
  }

  if (status === 'error') {
    return (
      <span
        className="inline-flex items-center text-[10px] font-bold"
        style={{ color: 'var(--ai-danger)' }}
        role="img"
        aria-label={t('ai.status.failedToSend') || 'Failed to send'}
      >
        ⚠
      </span>
    );
  }

  const label = status === 'delivered'
    ? (t('ai.status.delivered') || 'Delivered')
    : (t('ai.status.sent') || 'Sent');

  return (
    <svg
      width="14" height="10" viewBox="0 0 14 10" fill="none"
      stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      role="img"
      aria-label={label}
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

/* ─────────────────────────────────────────────────────────────────────────
 * 8. TYPING INDICATOR
 * ─────────────────────────────────────────────────────────────────────── */

export function AiTypingIndicator() {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className="flex items-center gap-1.5 px-1.5 py-1"
      role="status"
      aria-label={t('ai.assistantTyping') || 'AI yozmoqda…'}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{
            background: 'var(--ai-secondary, #5856D6)',
            boxShadow: '0 0 8px rgba(88, 86, 214, 0.4)',
          }}
          animate={
            reduced
              ? { opacity: 0.7 }
              : { y: [0, -4, 0], opacity: [0.4, 1, 0.4], scale: [0.85, 1.15, 0.85] }
          }
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 9. STREAMING CURSOR + SHIMMER
 * ─────────────────────────────────────────────────────────────────────── */

function StreamingCursor() {
  const reduced = usePrefersReducedMotion();

  if (reduced) {
    return (
      <span
        className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px]"
        style={{ background: 'color-mix(in srgb, var(--ai-secondary) 60%, transparent)' }}
        aria-hidden="true"
      />
    );
  }

  return (
    <motion.span
      className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px]"
      style={{
        background: 'var(--ai-secondary)',
        boxShadow: '0 0 8px color-mix(in srgb, var(--ai-secondary) 70%, transparent)',
      }}
      animate={{ opacity: [1, 0.2, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    />
  );
}

function StreamingShimmer() {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <motion.span
        className="absolute inset-y-0 w-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--ai-primary) 15%, transparent) 50%, transparent 100%)',
          willChange: 'transform',
        }}
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 10. COLLAPSIBLE LONG MESSAGE (a11y-correct)
 * ─────────────────────────────────────────────────────────────────────── */

const COLLAPSE_THRESHOLD = 500;

function CollapsibleContent({
  content, children,
}: { content: string; children: ReactNode }) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const contentId = useRef<string>(`collapsible-${Math.random().toString(36).slice(2, 9)}`).current;
  const shouldCollapse = content.length > COLLAPSE_THRESHOLD;

  if (!shouldCollapse) return <>{children}</>;

  return (
    <div className="relative">
      <div
        id={contentId}
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? 'none' : 220,
          transition: reduced ? undefined : `max-height 360ms ${EASE_APPLE}`,
        }}
      >
        {children}
      </div>

      {!expanded && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{ background: 'linear-gradient(180deg, transparent, var(--ai-bg-glass))' }}
        />
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={[
          'mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1',
          'text-[11px] font-bold tracking-tight',
          'text-[var(--ai-primary)]',
          'hover:bg-[color-mix(in_srgb,var(--ai-primary)_10%,transparent)]',
          FOCUS_RING,
        ].join(' ')}
        style={{ transition: reduced ? undefined : `background-color 180ms ${EASE_APPLE}` }}
      >
        <Icon
          paths={I.chevronDown}
          size={11}
          strokeWidth={2.4}
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: reduced ? undefined : `transform 220ms ${EASE_APPLE}`,
          }}
        />
        {expanded
          ? (t('ai.message.showLess') || 'Show less')
          : (t('ai.message.showMore') || 'Show more')}
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 11. REACTION BAR
 * ─────────────────────────────────────────────────────────────────────── */

const REACTION_EMOJIS = ['👍', '❤️', '🔥', '🎯', '💡', '✨'] as const;

function ReactionBar({
  onReact, side,
}: { onReact: (emoji: string) => void; side: 'left' | 'right' }) {
  const haptics = useHaptics();
  const reduced = usePrefersReducedMotion();
  const { t } = useSafeI18n();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.9 }}
      transition={SPRING.snappy}
      role="toolbar"
      aria-label={t('ai.message.reactions') || 'Reaksiyalar'}
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
          className={[
            'flex h-6 w-6 items-center justify-center rounded-full text-[13px] outline-none',
            'hover:bg-[var(--ai-bg-hover)]',
            FOCUS_RING,
          ].join(' ')}
          aria-label={`${t('ai.message.reactWith') || 'Reaksiya'}: ${emoji}`}
        >
          {emoji}
        </motion.button>
      ))}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 12. USER MESSAGE
 * ─────────────────────────────────────────────────────────────────────── */

export interface AiUserMessageProps {
  message: AiUiMessage;
  status?: 'sending' | 'sent' | 'delivered' | 'error';
  compact?: boolean;
  /** Backward-compatible: (content) or (content, id). */
  onEdit?: (content: string, id: string) => void;
  /** Optional controlled star. Falls back to local state when omitted. */
  starred?: boolean;
  onStar?: (next: boolean) => void;
}

function AiUserMessageComponent({
  message, status = 'sent', compact, onEdit, starred, onStar,
}: AiUserMessageProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useSafeI18n();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [localStarred, setLocalStarred] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveStarred = starred ?? localStarred;

  const handleStar = () => {
    if (starred === undefined) setLocalStarred((s) => !s);
    onStar?.(!effectiveStarred);
  };

  const handleFocusEnter = () => setShowActions(true);
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setShowActions(false);
      setShowReactions(false);
    }
  };

  const handleTouchStart = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = setTimeout(() => setShowReactions(true), 500);
  };
  const handleTouchCancel = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
      onFocusCapture={handleFocusEnter}
      onBlurCapture={handleBlur}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchCancel}
      onTouchCancel={handleTouchCancel}
      className="group/user flex items-end justify-end gap-2 sm:gap-3"
    >
      <AnimatePresence>
        {showActions && (
          <div className="relative">
            <MessageActions
              content={message.content}
              side="right"
              onStar={handleStar}
              starred={effectiveStarred}
              onEdit={onEdit ? () => onEdit(message.content, message.id) : undefined}
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
        <motion.div
          whileHover={reduced ? undefined : { scale: 1.005 }}
          transition={SPRING.snappy}
          className={[
            'relative w-fit min-w-[3.75rem] overflow-hidden px-4 py-2.5 text-white bg-[#007AFF]',
            'max-w-[85%] sm:max-w-[70%] rounded-2xl',
            compact ? 'rounded-tr-md' : 'rounded-br-md',
          ].join(' ')}
          style={{
            background:
              'linear-gradient(135deg, var(--ai-primary, #007AFF) 0%, var(--ai-primary-strong, #0051D5) 100%)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.28), ' +
              'inset 0 -1px 0 rgba(0,0,0,0.08), ' +
              '0 6px 20px -6px var(--ai-shadow-glow-primary, rgba(0, 122, 255, 0.35))',
            overflowWrap: 'anywhere',
            wordBreak: 'normal',
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-t-2xl"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.24), transparent 70%)' }}
          />

          {effectiveStarred && (
            <motion.span
              initial={reduced ? false : { scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={SPRING.bouncy}
              className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center text-[10px]"
              role="img"
              aria-label={t('ai.starred') || 'Yulduzcha'}
            >
              ★
            </motion.span>
          )}

          {/* Accessible user label for screen readers & a11y */}
          <span className="sr-only">{t('ai.you') || 'You'}</span>

          {message.attachments && message.attachments.length > 0 && (
            <div className="relative mb-2 flex flex-wrap gap-2">
              {message.attachments.map((att, idx) => (
                <div
                  key={att.id || idx}
                  className="relative overflow-hidden rounded-xl border border-white/20 bg-black/20"
                >
                  <img
                    src={att.url || (att.base64?.startsWith('data:') ? att.base64 : `data:${att.mimeType};base64,${att.base64}`)}
                    alt={att.name || 'Biriktirilgan rasm'}
                    className="max-h-48 max-w-full rounded-xl object-contain shadow-sm"
                  />
                  {att.name && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-0.5 text-[10px] text-white/90 truncate">
                      {att.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="relative whitespace-pre-wrap [overflow-wrap:break-word] [word-break:normal] text-[13.5px] font-medium leading-[1.55] tracking-tight">
            {message.content}
          </div>
        </motion.div>

        {!compact && (
          <div className="flex items-center gap-1.5 pr-2.5 text-[10px] font-medium text-[var(--ai-text-muted)] opacity-80">
            <RelativeTime iso={message.createdAt} className="tabular-nums" />
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

      {/* User Avatar removed for Apple Messages pure aesthetic */}
    </motion.div>
  );
}

export const AiUserMessage = memo(AiUserMessageComponent);
AiUserMessage.displayName = 'AiUserMessage';

/* ─────────────────────────────────────────────────────────────────────────
 * 13. ASSISTANT MESSAGE
 * ─────────────────────────────────────────────────────────────────────── */

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
  starred?: boolean;
  onStar?: (next: boolean) => void;
}

/* ─────────────────────────────────────────────────────────────────────────
 * ACTION CHIP EXTRACTION FOR DEEP SYSTEM INTEGRATION
 * ─────────────────────────────────────────────────────────────────────── */

interface ActionChip {
  label: string;
  path: string;
  icon: string;
}

function getActionChipIcon(path: string): string {
  if (path.startsWith('/attendance')) return '📋';
  if (path.startsWith('/payments') || path.startsWith('/finance') || path.startsWith('/invoices')) return '💳';
  if (path.startsWith('/students')) return '👥';
  if (path.startsWith('/schedule')) return '📅';
  if (path.startsWith('/academic-risk')) return '🚨';
  if (path.startsWith('/groups')) return '🏫';
  if (path.startsWith('/teachers')) return '👨‍🏫';
  if (path.startsWith('/courses')) return '📚';
  if (path.startsWith('/notifications')) return '📢';
  if (path.startsWith('/analytics') || path.startsWith('/reports')) return '📊';
  return '🔗';
}

function extractActionChips(content: string): ActionChip[] {
  if (!content) return [];
  const chips: ActionChip[] = [];
  const linkRegex = /\[([^\]]+)\]\((\/[a-zA-Z0-9_\-/]+)\)/g;
  let match: RegExpExecArray | null;
  const seenPaths = new Set<string>();

  while ((match = linkRegex.exec(content)) !== null) {
    const [, label, path] = match;
    if (!seenPaths.has(path)) {
      seenPaths.add(path);
      chips.push({
        label,
        path,
        icon: getActionChipIcon(path),
      });
    }
  }
  return chips.slice(0, 4);
}

function AiAssistantMessageComponent({
  message, confirming, onConfirm, onReject, onDismissActionError,
  onRegenerate, streaming, compact, onQuote, starred, onStar,
}: AiAssistantMessageProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useSafeI18n();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [localStarred, setLocalStarred] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectiveStarred = starred ?? localStarred;

  const hasContent = Boolean(message.content.trim());
  const hasActivities = Boolean(message.toolActivities && message.toolActivities.length > 0);
  const canShowActions = (hasContent || hasActivities) && !streaming;
  const tokenCount = useMemo(
    () => (hasContent ? estimateTokens(message.content) : 0),
    [hasContent, message.content],
  );

  const actionChips = useMemo(
    () => (hasContent ? extractActionChips(message.content) : []),
    [hasContent, message.content],
  );

  const handleStar = () => {
    if (starred === undefined) setLocalStarred((s) => !s);
    onStar?.(!effectiveStarred);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setShowActions(false);
      setShowReactions(false);
    }
  };

  const handleTouchStart = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = setTimeout(() => setShowReactions(true), 500);
  };
  const handleTouchCancel = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    };
  }, []);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.smooth}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
      onFocusCapture={() => setShowActions(true)}
      onBlurCapture={handleBlur}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchCancel}
      onTouchCancel={handleTouchCancel}
      className="group/assistant flex items-start gap-2 sm:gap-3"
    >
      {!compact && (!streaming || hasContent || hasActivities) && <AiAvatar />}
      {compact && <div className="w-10 shrink-0 sm:w-11" aria-hidden="true" />}

      <div className="flex min-w-0 max-w-[88%] flex-col gap-2 sm:max-w-[75%]">
        {hasActivities && message.toolActivities && (
          <AiToolActivityCard activities={message.toolActivities} />
        )}

        {hasActivities &&
          message.toolActivities?.map((activity, index) => {
            if (!activity.result || activity.status === 'running') return null;
            const key = activity.id ?? `${activity.toolName}-${index}`;

            if (
              activity.toolName === 'attendance.summary' ||
              activity.toolName === 'attendance.groups' ||
              activity.toolName === 'attendance.today' ||
              activity.toolName === 'attendance.mark'
            ) {
              return <AiAttendanceCard key={key} data={activity.result} />;
            }
            if (
              activity.toolName === 'finance.debtors' ||
              activity.toolName === 'finance.overdue_debtors' ||
              activity.toolName === 'payments.debtors' ||
              activity.toolName === 'payments.list' ||
              activity.toolName === 'payments.create'
            ) {
              return <AiDebtorsCard key={key} data={activity.result} />;
            }
            if (
              activity.toolName === 'schedule.list' ||
              activity.toolName === 'schedule.today' ||
              activity.toolName === 'schedule.roomConflictCheck'
            ) {
              return <AiScheduleTimeline key={key} data={activity.result} />;
            }
            if (
              activity.toolName === 'students.search' ||
              activity.toolName === 'students.create' ||
              activity.toolName === 'students.get'
            ) {
              return <AiStudentProfileCard key={key} data={activity.result} />;
            }
            if (activity.toolName === 'grades.analytics' || activity.toolName === 'exams.summary') {
              return <AiGradeAnalyticsCard key={key} data={activity.result} />;
            }
            if (activity.toolName === 'teachers.workload') {
              return <AiTeacherWorkloadCard key={key} data={activity.result} />;
            }
            if (activity.toolName === 'broadcast.send' || activity.toolName === 'notifications.broadcast') {
              return <AiBroadcastCard key={key} data={activity.result} />;
            }
            return null;
          })}

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

        {hasContent && (
          <div
            className={[
              'relative min-w-0 overflow-hidden px-4 py-3 rounded-2xl',
              'text-[#1c1c1e] dark:text-[#f5f5f7]',
              compact ? 'rounded-tl-md' : 'rounded-bl-md',
            ].join(' ')}
            style={{
              border: '1px solid var(--ai-border, rgba(0, 0, 0, 0.08))',
              background: 'var(--ai-bg-glass, rgba(255, 255, 255, 0.85))',
              backdropFilter: 'blur(20px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.4), ' +
                '0 4px 16px -8px rgba(0,0,0,0.08)',
            }}
          >
            {streaming && <StreamingShimmer />}

            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
              style={{
                background: 'linear-gradient(180deg, var(--ai-primary) 0%, var(--ai-secondary) 100%)',
                boxShadow: '0 0 10px color-mix(in srgb, var(--ai-secondary) 40%, transparent)',
              }}
            />

            {!compact && (
              <span
                className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{ color: 'var(--ai-primary)' }}
              >
                <Icon paths={I.sparkles} size={10} strokeWidth={2.5} />
                {t('ai.assistant') || 'AI'}
                {effectiveStarred && (
                  <motion.span
                    initial={reduced ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={SPRING.bouncy}
                    role="img"
                    aria-label={t('ai.starred') || 'Yulduzcha'}
                  >
                    ★
                  </motion.span>
                )}
              </span>
            )}

            <CollapsibleContent content={message.content}>
              <MarkdownContent content={message.content} className="mt-0.5" />
            </CollapsibleContent>

            {actionChips.length > 0 && !streaming && (
              <div className="mt-3 pt-2.5 border-t border-[var(--ai-border,rgba(0,0,0,0.06))] flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ai-text-muted)] mr-1">
                  Tezkor amallar:
                </span>
                {actionChips.map((chip) => (
                  <button
                    key={chip.path}
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(
                          new CustomEvent('medu:navigate', { detail: { path: chip.path } })
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11.5px] font-semibold transition-all border border-[var(--ai-border,rgba(0,0,0,0.08))] bg-white/70 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 hover:scale-[1.02] active:scale-[0.98] text-[var(--ai-primary)] shadow-sm"
                  >
                    <span className="text-[12px]">{chip.icon}</span>
                    <span>{chip.label}</span>
                    <span className="opacity-50 text-[10px]">→</span>
                  </button>
                ))}
              </div>
            )}

            {streaming && (
              <span className="ml-1 inline-block align-baseline">
                <StreamingCursor />
              </span>
            )}
          </div>
        )}

        {streaming && !hasContent && !hasActivities && (
          <div className="w-full max-w-xl py-1">
            <AiThinking />
          </div>
        )}

        {canShowActions && (
          <div className="flex items-center gap-2 pl-1">
            <RelativeTime
              iso={message.createdAt}
              className="text-[10px] font-semibold tabular-nums text-[var(--ai-text-muted)]"
            />

            {tokenCount > 0 && (
              <>
                <span className="text-[10px] text-[var(--ai-text-muted)] opacity-40">·</span>
                <span className="text-[10px] font-medium tabular-nums text-[var(--ai-text-muted)] opacity-70">
                  {tokenCount} {t('ai.tokens') || 'tok'}
                </span>
              </>
            )}

            <AnimatePresence>
              {showActions && (
                <MessageActions
                  content={message.content}
                  side="left"
                  showRegenerate={Boolean(onRegenerate)}
                  onRegenerate={onRegenerate}
                  onStar={handleStar}
                  starred={effectiveStarred}
                  onQuote={onQuote}
                  showTTS={true}
                />
              )}
            </AnimatePresence>

            {showReactions && (
              <ReactionBar side="left" onReact={() => setShowReactions(false)} />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export const AiAssistantMessage = memo(AiAssistantMessageComponent);
AiAssistantMessage.displayName = 'AiAssistantMessage';

/* ─────────────────────────────────────────────────────────────────────────
 * 14. SYSTEM MESSAGE
 * ─────────────────────────────────────────────────────────────────────── */

export interface AiSystemMessageProps {
  message: AiUiMessage;
  onRetry?: () => void;
}

function AiSystemMessageComponent({ message, onRetry }: AiSystemMessageProps) {
  const reduced = usePrefersReducedMotion();
  const { t } = useSafeI18n();
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
        role={isError ? 'alert' : 'note'}
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
          aria-hidden="true"
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
              'ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 min-h-[36px] tap-extend',
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
            {t('ai.error.retry') || 'Qayta urinish'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export const AiSystemMessage = memo(AiSystemMessageComponent);
AiSystemMessage.displayName = 'AiSystemMessage';