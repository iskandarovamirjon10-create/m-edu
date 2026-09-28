/**
 * AiToolActivityCard — polished, human-readable status of tool calls.
 *
 * Raw tool payloads, internal names for unknown tools and backend error
 * text are never dumped into the conversation; each activity resolves to
 * a short Uzbek phrase based on its state.
 */
import type { ReactNode } from 'react';
import { AlertTriangle, Check, CircleAlert, Loader2, X } from 'lucide-react';
import { aiToolStatusText, describeAiTool } from '@/lib/ai';
import type { AiToolActivity, AiToolActivityStatus } from '@/types/ai';
import { AiAvatar } from './AiAvatar';

const STATUS_ICON: Record<AiToolActivityStatus, ReactNode> = {
  running: <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />,
  success: <Check aria-hidden className="h-3.5 w-3.5" />,
  error: <CircleAlert aria-hidden className="h-3.5 w-3.5" />,
  pending_confirmation: <AlertTriangle aria-hidden className="h-3.5 w-3.5" />,
  cancelled: <X aria-hidden className="h-3.5 w-3.5" />,
};

const STATUS_COLOR: Record<AiToolActivityStatus, string> = {
  running: 'text-[var(--primary)]',
  success: 'text-[var(--success)]',
  error: 'text-[var(--danger)]',
  pending_confirmation: 'text-[var(--warning)]',
  cancelled: 'text-[var(--text-tertiary)]',
};

export interface AiToolActivityCardProps {
  activities: AiToolActivity[];
}

export function AiToolActivityCard({ activities }: AiToolActivityCardProps) {
  if (activities.length === 0) return null;

  return (
    <div className="flex items-start gap-3">
      <AiAvatar />

      <div className="min-w-0 max-w-[85%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-xs)] sm:max-w-[70%]">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
          M-EDU AI
        </span>

        <ul className="mt-1.5 flex flex-col gap-1.5">
          {activities.map((activity) => {
            const description = describeAiTool(activity.toolName);
            return (
              <li
                key={activity.id}
                className="flex items-center gap-2 text-xs leading-5 text-[var(--text-secondary)]"
              >
                <span className={['shrink-0', STATUS_COLOR[activity.status]].join(' ')}>
                  {STATUS_ICON[activity.status]}
                </span>
                <span className="min-w-0 break-words">
                  {aiToolStatusText(activity.toolName, activity.status)}
                </span>
                {!description.known && activity.toolName && (
                  <code className="shrink-0 rounded bg-[var(--state-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                    {activity.toolName}
                  </code>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default AiToolActivityCard;
