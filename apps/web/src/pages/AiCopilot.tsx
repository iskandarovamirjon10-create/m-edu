/**
 * M-EDU AI Copilot page.
 *
 * Composition only: state and API logic live in `hooks/useAiCopilot`,
 * API calls in `lib/ai.ts`, presentation in `components/ai/*`.
 */
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import {
  AiComposer,
  AiCopilotHeader,
  AiMessageList,
} from '@/components/ai';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export default function AiCopilot() {
  const {
    messages,
    status,
    error,
    busy,
    canSend,
    lastPrompt,
    send,
    retry,
    stop,
    confirm,
    reject,
    dismissActionError,
    clear,
  } = useAiCopilot();

  const online = useOnlineStatus();
  const [clearOpen, setClearOpen] = useState(false);

  const handlePickPrompt = (text: string): void => {
    if (canSend) send(text);
  };

  return (
    <div className="relative flex h-[calc(100svh-7.25rem)] min-h-[20rem] min-w-0 flex-col overflow-hidden lg:h-[calc(100svh-8.25rem)]">
      <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 px-4 pt-4 sm:px-6 sm:pt-6">
        <AiCopilotHeader online={online} busy={busy} onClear={() => setClearOpen(true)} />

        <section
          aria-label="AI suhbat"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-glass)] shadow-[var(--shadow-lg)] backdrop-blur-xl"
        >
          <AiMessageList
            messages={messages}
            status={status}
            error={error}
            lastPrompt={lastPrompt}
            promptsDisabled={!canSend}
            onPickPrompt={handlePickPrompt}
            onRetry={retry}
            onConfirm={confirm}
            onReject={reject}
            onDismissActionError={dismissActionError}
          />

          <AiComposer status={status} onSend={send} onStop={stop} />
        </section>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clear();
          setClearOpen(false);
        }}
        title="Chatni tozalash"
        description="Suhbat tarixi shu qurilmadan o‘chiriladi. Bu amalni ortga qaytarib bo‘lmaydi."
        confirmLabel="Tozalash"
        cancelLabel="Bekor qilish"
        tone="danger"
      />
    </div>
  );
}
