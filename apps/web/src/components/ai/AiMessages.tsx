/**
 * Message bubbles: AiUserMessage, AiAssistantMessage, AiSystemMessage.
 */
import type { AiUiMessage } from '@/types/ai';
import { MarkdownContent } from './MarkdownContent';
import { AiToolActivityCard } from './AiToolActivity';
import { AiActionConfirmation, ActionResultCard, ActionErrorNote } from './AiActionConfirmation';
import { AiAvatar, UserAvatar } from './AiAvatar';

export interface AiUserMessageProps {
  message: AiUiMessage;
}

export function AiUserMessage({ message }: AiUserMessageProps) {
  return (
    <div className="flex items-end justify-end gap-3">
      <div
        className="min-w-0 max-w-[85%] rounded-2xl rounded-br-md bg-[var(--primary)] px-4 py-2.5 text-white shadow-[var(--shadow-sm)] sm:max-w-[70%]"
        style={{ overflowWrap: 'anywhere' }}
      >
        <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-white/70">
          Siz
        </span>
        <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>
      </div>
      <UserAvatar />
    </div>
  );
}

export interface AiAssistantMessageProps {
  message: AiUiMessage;
  confirming: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onDismissActionError: () => void;
}

export function AiAssistantMessage({
  message,
  confirming,
  onConfirm,
  onReject,
  onDismissActionError,
}: AiAssistantMessageProps) {
  const hasContent = Boolean(message.content.trim());
  const hasActivities = Boolean(message.toolActivities && message.toolActivities.length > 0);

  return (
    <div className="flex items-start gap-3">
      <AiAvatar />

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

        {hasContent && (
          <div className="rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-xs)]">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
              M-EDU AI
            </span>
            <MarkdownContent content={message.content} className="mt-1.5" />
          </div>
        )}
      </div>
    </div>
  );
}

export interface AiSystemMessageProps {
  message: AiUiMessage;
}

export function AiSystemMessage({ message }: AiSystemMessageProps) {
  const isError = message.kind === 'error';

  return (
    <div className="flex justify-center px-2">
      <span
        className={[
          'max-w-full rounded-full border px-3 py-1 text-center text-[11px] leading-5',
          isError
            ? 'border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]'
            : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-tertiary)]',
        ].join(' ')}
        style={{ overflowWrap: 'anywhere' }}
      >
        {message.content}
      </span>
    </div>
  );
}
