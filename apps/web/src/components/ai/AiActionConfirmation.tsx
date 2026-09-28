/**
 * AiActionConfirmation + result/error cards.
 *
 * Security-critical UX: the card shows only information the backend
 * actually returned (tool name, relayed arguments, backend message).
 * Nothing is inferred from the opaque actionId, and confirmation stays
 * strictly explicit — no automatic execution, no re-confirmation.
 */
import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Check, CircleAlert, ChevronDown } from 'lucide-react';
import { GlassButton } from '@/components/ui';
import { describeAiProposal, describeAiTool } from '@/lib/ai';
import type { AiActionResult, AiErrorInfo, AiPendingAction } from '@/types/ai';

export interface AiActionConfirmationProps {
  action: AiPendingAction;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
}

export function AiActionConfirmation({
  action,
  busy,
  onConfirm,
  onReject,
}: AiActionConfirmationProps) {
  const titleId = useId();
  const descriptionId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  const toolDescription = describeAiTool(action.toolName);
  const title = describeAiProposal(action.toolName);
  const description = toolDescription.known
    ? `AI «${toolDescription.subject}» bo‘yicha amal bajarishni xohlaydi. Davom etishdan oldin tasdiqlang.`
    : 'AI tizimda amal bajarishni xohlaydi. Davom etishdan oldin tasdiqlang.';
  const parameters = action.parameters ?? [];

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      data-testid="ai-action-confirmation"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onReject();
        }
      }}
      className="rounded-2xl border border-[var(--warning-border)] bg-[var(--warning-soft)] p-4 shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center gap-2 text-[var(--warning)]">
        <AlertTriangle aria-hidden className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-wider">
          Tasdiqlash talab qilinadi
        </span>
      </div>

      <h4 id={titleId} className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
        {title}
      </h4>

      <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>

      {parameters.length > 0 && (
        <dl className="mt-3 grid gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          {parameters.map((parameter) => (
            <div key={parameter.key} className="flex gap-3 text-xs leading-5">
              <dt className="w-24 shrink-0 text-[var(--text-tertiary)]">{parameter.label}</dt>
              <dd className="min-w-0 break-words text-[var(--text-primary)]">
                {parameter.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-3 text-xs leading-5 text-[var(--warning-text)] dark:text-[var(--warning)]">
        Ushbu amal tizimdagi ma’lumotlarni o‘zgartirishi mumkin. Davom etishdan oldin
        tasdiqlang.
      </p>

      {(action.rawArguments || action.backendMessage) && (
        <details className="mt-2 group/details">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]">
            <ChevronDown
              aria-hidden
              className="h-3.5 w-3.5"
            />
            Texnik tafsilotlar
          </summary>
          {action.backendMessage && (
            <p className="mt-1.5 break-words text-[11px] leading-5 text-[var(--text-tertiary)]">
              {action.backendMessage}
            </p>
          )}
          {action.rawArguments && (
            <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
              {action.rawArguments}
            </pre>
          )}
        </details>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <GlassButton
          ref={confirmRef}
          variant="warning"
          size="sm"
          onClick={onConfirm}
          loading={busy}
          disabled={busy}
          data-testid="ai-confirm"
        >
          Tasdiqlash
        </GlassButton>

        <GlassButton
          variant="secondary"
          size="sm"
          onClick={onReject}
          disabled={busy}
          data-testid="ai-reject"
        >
          Bekor qilish
        </GlassButton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmed action result                                             */
/* ------------------------------------------------------------------ */

export interface ActionResultCardProps {
  result: AiActionResult;
}

export function ActionResultCard({ result }: ActionResultCardProps) {
  const detailsId = useId();

  return (
    <div
      role="status"
      data-testid="ai-action-result"
      className="rounded-2xl border border-[var(--success-border)] bg-[var(--success-soft)] p-4 shadow-[var(--shadow-xs)]"
    >
      <div className="flex items-center gap-2 text-[var(--success)]">
        <Check aria-hidden className="h-4 w-4" />
        <span className="text-sm font-semibold">{result.title}</span>
      </div>

      {result.summary && (
        <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{result.summary}</p>
      )}

      {result.fields.length > 0 && (
        <dl className="mt-2.5 grid gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          {result.fields.map((field) => (
            <div key={field.key} className="flex gap-3 text-xs leading-5">
              <dt className="w-28 shrink-0 text-[var(--text-tertiary)]">{field.label}</dt>
              <dd className="min-w-0 break-words text-[var(--text-primary)]">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.raw && (
        <details className="mt-2 group/details">
          <summary
            id={detailsId}
            className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]"
          >
            <ChevronDown
              aria-hidden
              className="h-3.5 w-3.5"
            />
            Texnik tafsilotlar
          </summary>
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-2 text-[11px] leading-4 text-[var(--text-secondary)]">
            {result.raw}
          </pre>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confirmation failure                                                */
/* ------------------------------------------------------------------ */

export interface ActionErrorNoteProps {
  error: AiErrorInfo;
  onDismiss: () => void;
}

export function ActionErrorNote({ error, onDismiss }: ActionErrorNoteProps) {
  return (
    <div
      role="alert"
      data-testid="ai-action-error"
      className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-soft)] p-3.5"
    >
      <div className="flex gap-2.5">
        <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--danger)]">
            Amalni tasdiqlashda xatolik
          </p>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{error.message}</p>
          <GlassButton variant="ghost" size="sm" className="mt-1.5" onClick={onDismiss}>
            Tushunarli
          </GlassButton>
        </div>
      </div>
    </div>
  );
}
