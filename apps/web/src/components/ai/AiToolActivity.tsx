/**
 * AiToolActivityCard — Apple Design Award Edition v3 "Liquid Glass"
 *
 * Design philosophy: tool activity is a caption, not a card.
 *  - Removed: AiAvatar, bordered card, uppercase brand label, shadow.
 *    The activity list is a single line under the assistant message,
 *    not a separate bubble — exactly like ChatGPT's tool-call indicator.
 *  - Kept: per-status icon + color, tool description resolution,
 *    unknown-tool code chip, all a11y (`aria-hidden` on decorative icons).
 *
 * Raw tool payloads, internal names for unknown tools and backend error
 * text are never dumped into the conversation; each activity resolves to
 * a short Uzbek phrase based on its state.
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Check, CircleAlert, Loader2, X } from 'lucide-react';
import { aiToolStatusText, describeAiTool } from '@/lib/ai';
import type { AiToolActivity, AiToolActivityStatus } from '@/types/ai';

/* ============================================================================
 * STATUS MAPS — icon + tone per state
 * ========================================================================== */

const STATUS_ICON: Record<AiToolActivityStatus, ReactNode> = {
  running: (
    <Loader2
      aria-hidden
      className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
      strokeWidth={2}
    />
  ),
  success: <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />,
  error: <CircleAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />,
  pending_confirmation: (
    <AlertTriangle aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
  ),
  cancelled: <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />,
};

const STATUS_COLOR: Record<AiToolActivityStatus, string> = {
  running: 'var(--ai-primary, #007AFF)',
  success: 'var(--ai-success, #10B981)',
  error: 'var(--ai-danger, #FF3B30)',
  pending_confirmation: 'var(--ai-warning, #F59E0B)',
  cancelled: 'var(--ai-text-soft, #A1A1A6)',
};

/* ============================================================================
 * CARD
 * ========================================================================== */

export interface AiToolActivityCardProps {
  activities: AiToolActivity[];
}

export function AiToolActivityCard({ activities }: AiToolActivityCardProps) {
  if (activities.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-1.5 py-0.5"
      role="status"
      aria-live="polite"
    >
      {activities.map((activity) => {
        const toolName = activity.toolName || '';
        const status = (activity.status || 'running') as AiToolActivityStatus;
        const description = describeAiTool(toolName);

        return (
          <div
            key={activity.id || toolName}
            className="flex items-center gap-2 text-[12.5px] leading-tight"
            style={{ color: 'var(--ai-text-muted, #86868B)' }}
          >
            {/* Status icon — color is the only signal */}
            <span
              className="flex h-4 w-4 shrink-0 items-center justify-center"
              style={{ color: STATUS_COLOR[status] || STATUS_COLOR.running }}
            >
              {STATUS_ICON[status] || STATUS_ICON.running}
            </span>

            {/* Human-readable status text */}
            <span className="min-w-0 break-words">
              {aiToolStatusText(toolName, status)}
            </span>

            {/* Unknown tool — inline code chip */}
            {!description.known && toolName && (
              <code
                className="shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-normal tabular-nums"
                style={{
                  background: 'var(--ai-bg-hover, rgba(0,0,0,0.04))',
                  color: 'var(--ai-text-soft, #A1A1A6)',
                  fontFamily:
                    "'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace",
                }}
              >
                {toolName}
              </code>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AiToolActivityCard;