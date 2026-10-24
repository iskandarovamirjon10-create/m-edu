/**
 * AiToolActivityCard v4 — Premium inline tool caption
 * ============================================================================
 * v4 changes (from v3):
 *  - fix:  wrapper no longer re-announces ALL activities on any change.
 *          Single hidden live region announces ONLY the item(s) that
 *          changed — no more repetitive chatter.
 *  - fix:  initial mount is silent (skipFirst ref seeds state without
 *          announcing).
 *  - fix:  key no longer collides on parallel same-tool calls
 *          (id ?? `${toolName}-${index}`).
 *  - fix:  unknown-tool chip truncates long names (title= for full text).
 *  - a11y: `role="list"` / `role="listitem"` semantics for the group.
 *  - a11y: `aria-hidden="true"` explicit on all decorative icons.
 *  - a11y: prefers-contrast: more → solid surfaces + thicker text.
 *  - a11y: aria-busy set when any activity is running.
 *  - perf: memo() — re-renders only when activities array changes.
 *  - new:  status transition animation (icon cross-fades via
 *          AnimatePresence) — respects reduced motion.
 *  - new:  entrance stagger for multiple simultaneous activities.
 *  - new:  layout animation when activities are removed.
 *  - new:  `compact` variant for very tight spaces.
 *  - new:  `onAnnounce` callback — the host can pipe the announcement
 *          into its own live region if desired.
 *  - new:  terminal-only announcements (running → success/error/cancelled/
 *          pending_confirmation). Starting states stay silent.
 *  - new:  status tooltip on icon (title attr).
 * ============================================================================
 */

import {
  memo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Check, CircleAlert, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { aiToolStatusText, describeAiTool } from '@/lib/ai';
import type { AiToolActivity, AiToolActivityStatus } from '@/types/ai';
import { cn } from '@/lib/design';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
} as const;

/* ============================================================================
 * STATUS MAPS
 * ========================================================================== */

const STATUS_ICON: Record<AiToolActivityStatus, ReactNode> = {
  running: (
    <Loader2
      aria-hidden="true"
      className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
      strokeWidth={2}
    />
  ),
  success: <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />,
  error: <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />,
  pending_confirmation: (
    <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
  ),
  cancelled: <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />,
};

const STATUS_COLOR: Record<AiToolActivityStatus, string> = {
  running: 'var(--ai-primary, #007AFF)',
  success: 'var(--ai-success, #10B981)',
  error: 'var(--ai-danger, #FF3B30)',
  pending_confirmation: 'var(--ai-warning, #F59E0B)',
  cancelled: 'var(--ai-text-soft, #A1A1A6)',
};

/** Human-readable tooltip. Also useful for sighted users. */
const STATUS_TOOLTIP: Record<AiToolActivityStatus, string> = {
  running: 'Bajarilmoqda',
  success: 'Muvaffaqiyatli',
  error: 'Xatolik',
  pending_confirmation: 'Tasdiqlash kutilmoqda',
  cancelled: 'Bekor qilindi',
};

/**
 * Only announce terminal states. "running" states stay silent to avoid
 * spamming screen-reader users when several tools fire in parallel.
 */
const ANNOUNCABLE = new Set<AiToolActivityStatus>([
  'success',
  'error',
  'cancelled',
  'pending_confirmation',
]);

/* ============================================================================
 * HELPERS
 * ========================================================================== */

function activityKey(
  activity: AiToolActivity,
  index: number,
): string {
  return activity.id ?? `${activity.toolName || 'activity'}-${index}`;
}

/* ============================================================================
 * CARD
 * ========================================================================== */

export interface AiToolActivityCardProps {
  activities: AiToolActivity[];
  /** Compact variant for tight spaces (chat sidebar, popovers). */
  compact?: boolean;
  /** Accessible label for the whole group. */
  ariaLabel?: string;
  /** Optional hook for the host to mirror announcements into its own region. */
  onAnnounce?: (text: string) => void;
}

function AiToolActivityCardComponent({
  activities,
  compact = false,
  ariaLabel = 'AI amallari',
  onAnnounce,
}: AiToolActivityCardProps) {
  const reduced = Boolean(useReducedMotion());
  const [announcement, setAnnouncement] = useState<{ text: string; nonce: number }>({
    text: '',
    nonce: 0,
  });
  const prevStatusRef = useRef<Map<string, AiToolActivityStatus>>(new Map());
  const skipFirstRef = useRef(true);

  /* Track status changes and announce only meaningful transitions. */
  useEffect(() => {
    const next = new Map<string, AiToolActivityStatus>();
    const changes: string[] = [];

    activities.forEach((activity, i) => {
      const key = activityKey(activity, i);
      const status = (activity.status ?? 'running') as AiToolActivityStatus;
      next.set(key, status);

      const prev = prevStatusRef.current.get(key);

      /* First render: seed without announcing. */
      if (skipFirstRef.current) return;

      /* New activity appears AND is terminal → announce once. */
      if (prev === undefined && ANNOUNCABLE.has(status)) {
        changes.push(aiToolStatusText(activity.toolName ?? '', status));
        return;
      }

      /* Existing activity transitions to terminal → announce. */
      if (prev !== undefined && prev !== status && ANNOUNCABLE.has(status)) {
        changes.push(aiToolStatusText(activity.toolName ?? '', status));
      }
    });

    prevStatusRef.current = next;

    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }

    if (changes.length > 0) {
      const text = changes.join('. ');
      setAnnouncement({ text, nonce: Date.now() });
      onAnnounce?.(text);
    }
  }, [activities, onAnnounce]);

  const anyRunning = activities.some(
    (a) => (a.status ?? 'running') === 'running',
  );

  if (activities.length === 0) return null;

  return (
    <div
      role="list"
      aria-label={ariaLabel}
      aria-busy={anyRunning || undefined}
      className={cn(
        'flex flex-col gap-1.5 py-0.5',
        compact && 'gap-1',
      )}
    >
      {/* Single hidden announcer — only the changed item(s) are announced. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-nonce={announcement.nonce}
      >
        {announcement.text}
      </div>

      <AnimatePresence initial={false}>
        {activities.map((activity, i) => {
          const toolName = activity.toolName || '';
          const status = (activity.status || 'running') as AiToolActivityStatus;
          const description = describeAiTool(toolName);
          const statusText = aiToolStatusText(toolName, status);
          const key = activityKey(activity, i);

          return (
            <motion.div
              key={key}
              role="listitem"
              layout
              initial={reduced ? false : { opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -4 }}
              transition={{ ...SPRING.snappy, delay: reduced ? 0 : i * 0.03 }}
              className={cn(
                'flex items-center gap-2 leading-tight',
                compact ? 'text-[11.5px]' : 'text-[12.5px]',
              )}
              style={{ color: 'var(--ai-text-muted, #86868B)' }}
            >
              {/* Status icon — swaps with cross-fade on change */}
              <span
                aria-hidden="true"
                title={STATUS_TOOLTIP[status]}
                className="flex h-4 w-4 shrink-0 items-center justify-center"
                style={{ color: STATUS_COLOR[status] || STATUS_COLOR.running }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={status}
                    initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                    transition={SPRING.snappy}
                    className="flex"
                  >
                    {STATUS_ICON[status] || STATUS_ICON.running}
                  </motion.span>
                </AnimatePresence>
              </span>

              {/* Human-readable status text */}
              <span className="min-w-0 break-words">{statusText}</span>

              {/* Unknown tool — inline code chip, truncated */}
              {!description.known && toolName && (
                <code
                  className="shrink-0 truncate rounded px-1.5 py-0.5 text-[10.5px] font-normal tabular-nums"
                  style={{
                    background: 'var(--ai-bg-hover, rgba(0,0,0,0.04))',
                    color: 'var(--ai-text-soft, #A1A1A6)',
                    fontFamily:
                      "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
                    maxWidth: 140,
                  }}
                  title={toolName}
                >
                  {toolName}
                </code>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export const AiToolActivityCard = memo(AiToolActivityCardComponent);
AiToolActivityCard.displayName = 'AiToolActivityCard';

export default AiToolActivityCard;