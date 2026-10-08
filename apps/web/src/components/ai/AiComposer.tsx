/**
 * AiComposer — Premium Edition v5
 *
 * Includes:
 *  - Native Speech Recognition (Voice Input)
 *  - Animated mic pulse during speech
 *  - Contextual placeholders
 *  - Premium gradients and cursor hover effects
 *  - Auto-growing text area with smooth transitions
 *  - Apple-like haptics and sounds
 *
 * Contract notes (do not break):
 *  - Every user-facing string comes from the i18n dictionary — the composer
 *    previously hard-coded Uzbek text, so EN/RU users saw Uzbek labels and
 *    the accessible name of the textarea silently changed per locale.
 *  - `data-testid="ai-send"` / `ai-stop"` are part of the test/E2E contract.
 *  - The send affordance is ALWAYS rendered (disabled when empty) so its
 *    position never shifts as the user types — an empty composer with no
 *    send button reads as a dead input.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Square, X, Mic, Send, Loader2 } from 'lucide-react';
import { GlassButton, GlassTextArea } from '@/components/ui';
import type { AiStatus } from '@/hooks/useAiCopilot';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useI18n } from '@/i18n/I18nProvider';

const MIN_HEIGHT = 46;
const MAX_HEIGHT = 160;

export interface AiComposerProps {
  status: AiStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear?: () => void;
}

export function AiComposer({ status, onSend, onStop, onClear }: AiComposerProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const haptics = useHaptics();
  const sound = usePremiumSound();
  const { t } = useI18n();

  const { isListening, isSupported, toggle: toggleVoice } = useSpeechRecognition({
    onResult: (text) => {
      setDraft((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${text}` : text;
      });
      haptics.light();
    },
  });

  const busy = status === 'sending' || status === 'thinking' || status === 'confirming';
  const locked = busy || status === 'awaiting_confirmation';
  const canStop = status === 'sending' || status === 'thinking';
  const canSubmit = !locked && draft.trim().length > 0;

  useEffect(() => {
    const handleToggle = () => toggleVoice();
    window.addEventListener('medu-ai-toggle-voice', handleToggle);
    return () => window.removeEventListener('medu-ai-toggle-voice', handleToggle);
  }, [toggleVoice]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [draft]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || locked) return;
    haptics.success();
    sound.playPop();
    onSend(text);
    setDraft('');
    if (isListening) toggleVoice();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  /**
   * Contextual placeholder: an idle input invites a question, a busy input
   * explains what is happening, and an input waiting for confirmation says so
   * instead of still asking for a question the user cannot answer yet.
   */
  const placeholder = isListening
    ? t('ai.composer.listeningPlaceholder')
    : status === 'awaiting_confirmation'
      ? t('ai.composer.awaitingPlaceholder')
      : status === 'thinking'
        ? t('ai.composer.thinkingPlaceholder')
        : busy
          ? t('ai.composer.sendingPlaceholder')
          : t('ai.composer.placeholder');

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-glass)] p-3 backdrop-blur-2xl sm:p-5">
      <div className="mx-auto max-w-4xl">
        <div
          className="relative flex items-end gap-2 rounded-[24px] border border-[var(--border)] bg-[var(--bg-card)] p-2 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)] transition-all duration-300 ease-[var(--ease-apple)] focus-within:border-[#007AFF]/50 focus-within:shadow-[0_8px_32px_-8px_rgba(0,122,255,0.2),_0_0_0_4px_rgba(0,122,255,0.1)]"
          style={{
            background: isListening
              ? 'linear-gradient(135deg, var(--bg-card) 0%, rgba(0,122,255,0.03) 100%)'
              : 'var(--bg-card)',
          }}
        >
          {isListening && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[24px] ring-2 ring-[#007AFF] ring-offset-2 animate-pulse"
              style={{ animationDuration: '2s' }}
            />
          )}

          <GlassTextArea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={t('ai.composer.inputAria')}
            data-testid="ai-composer-input"
            rows={1}
            disabled={locked}
            className="min-h-[46px] flex-1 !resize-none !border-0 !bg-transparent !px-3 !py-2.5 !shadow-none focus:!bg-transparent text-[15px] leading-relaxed"
          />

          {draft.length > 0 && !busy && (
            <GlassButton
              variant="ghost"
              size="icon-sm"
              aria-label={t('ai.composer.clearInput')}
              onClick={() => {
                setDraft('');
                onClear?.();
                textareaRef.current?.focus();
                haptics.light();
              }}
              className="mb-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X aria-hidden className="h-4 w-4" />
            </GlassButton>
          )}

          {isSupported && !busy && draft.length === 0 && (
            <GlassButton
              variant={isListening ? 'primary' : 'ghost'}
              size="icon"
              aria-label={t('ai.composer.voiceInput')}
              onClick={() => {
                haptics.medium();
                toggleVoice();
              }}
              className={`mb-1 shrink-0 rounded-full transition-all duration-300 ${
                isListening
                  ? 'bg-[#007AFF] text-white shadow-[0_4px_16px_-4px_rgba(0,122,255,0.5)] scale-105'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Mic aria-hidden className="h-[18px] w-[18px]" />
            </GlassButton>
          )}

          {canStop && (
            <GlassButton
              variant="secondary"
              size="icon"
              data-testid="ai-stop"
              aria-label={t('ai.composer.stop')}
              onClick={onStop}
              className="mb-1 shrink-0 rounded-full bg-slate-200 text-slate-700 hover:bg-red-100 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300"
            >
              <Square aria-hidden className="h-4 w-4" />
            </GlassButton>
          )}

          <GlassButton
            onClick={submit}
            disabled={!canSubmit}
            loading={busy}
            data-testid="ai-send"
            aria-label={busy ? t('ai.composer.sending') : t('ai.composer.send')}
            className="mb-1 shrink-0 !h-10 !w-10 !rounded-full !p-0 bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-white shadow-[0_4px_12px_-4px_rgba(0,122,255,0.4)] disabled:opacity-40 transition-transform active:scale-95"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-4 w-4" style={{ marginLeft: '2px' }} />
            )}
          </GlassButton>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 px-2 text-[11px] font-medium text-[var(--text-tertiary)] opacity-80">
          {status === 'awaiting_confirmation' ? (
            <span className="text-[var(--warning-text)] flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--warning-text)] opacity-40" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--warning-text)]" />
              </span>
              {t('ai.composer.confirmPending')}
            </span>
          ) : (
            <div className="flex gap-4">
              <span>{t('ai.composer.newlineHint')}</span>
              <span>{t('ai.composer.sendHint')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiComposer;
