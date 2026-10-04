/**
 * AiComposer — auto-growing message input built on GlassTextArea /
 * GlassButton.
 *
 * Keyboard: Enter sends, Shift+Enter inserts a newline (IME composition is
 * respected). Send/stop/clear states are derived from the request state
 * machine so impossible combinations cannot be rendered.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Square, X } from 'lucide-react';
import { GlassButton, GlassTextArea } from '@/components/ui';
import type { AiStatus } from '@/hooks/useAiCopilot';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';

const MIN_HEIGHT = 46;
const MAX_HEIGHT = 160;

export interface AiComposerProps {
  status: AiStatus;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function AiComposer({ status, onSend, onStop }: AiComposerProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const haptics = useHaptics();
  const sound = usePremiumSound();

  const busy = status === 'sending' || status === 'thinking' || status === 'confirming';
  const locked = busy || status === 'awaiting_confirmation';
  const canStop = status === 'sending' || status === 'thinking';
  const canSubmit = !locked && draft.trim().length > 0;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [draft]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || locked) return;
    haptics.light();
    sound.playPop();
    onSend(text);
    setDraft('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-glass)] p-3 backdrop-blur-xl sm:p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-[var(--shadow-sm)] focus-within:border-[var(--border-focus)] focus-within:shadow-[0_0_0_3px_var(--focus-ring)]">
          <GlassTextArea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="M-EDU AI’dan biror narsa so‘rang..."
            aria-label="Xabar matni"
            data-testid="ai-composer-input"
            rows={1}
            disabled={locked}
            className="min-h-[46px] flex-1 !resize-none !border-0 !bg-transparent !px-2 !py-2 !shadow-none focus:!bg-transparent"
          />

          {draft.length > 0 && !busy && (
            <GlassButton
              variant="ghost"
              size="icon-sm"
              aria-label="Matnni tozalash"
              data-testid="ai-clear-input"
              onClick={() => {
                setDraft('');
                textareaRef.current?.focus();
              }}
            >
              <X aria-hidden className="h-4 w-4" />
            </GlassButton>
          )}

          {canStop && (
            <GlassButton
              variant="secondary"
              size="icon-sm"
              aria-label="To‘xtatish"
              data-testid="ai-stop"
              onClick={onStop}
            >
              <Square aria-hidden className="h-3.5 w-3.5" />
            </GlassButton>
          )}

          <GlassButton
            onClick={submit}
            disabled={!canSubmit}
            loading={busy}
            aria-label={busy ? 'Yuborilmoqda' : 'Yuborish'}
            data-testid="ai-send"
            className="!h-11 shrink-0 !px-4"
          >
            {busy ? '...' : 'Yuborish'}
          </GlassButton>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-[var(--text-tertiary)]">
          {status === 'awaiting_confirmation' ? (
            <span className="font-medium text-[var(--warning-text)]">
              Amalni tasdiqlashni yakunlang
            </span>
          ) : (
            <span>Shift + Enter — yangi qator</span>
          )}
          <span>Enter — yuborish</span>
        </div>
      </div>
    </div>
  );
}

export default AiComposer;
