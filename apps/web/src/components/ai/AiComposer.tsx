/**
 * ============================================================================
 * AiComposer v6.0 — Liquid Glass Composer
 * ============================================================================
 * VISUAL (what's new):
 *  - Ambient glow behind shell (state-responsive: idle 35% → focus 70% →
 *    listening 85%), pulses with the current mode
 *  - Floating "Listening" chip with Siri-style waveform bars (7 bars,
 *    staggered) — visible above the shell even while typing
 *  - Send button: conic light ring pulses when the composer is "ready"
 *  - 4-layer liquid glass shell (specular top + bevel + dark tint + corner
 *    glow) — visually consistent with AiThinking / AiCopilotHeader
 *  - Bottom row: iOS-style hint chips (↵ / ⇧↵) + char counter at 80%
 *  - Entrance fade-up on mount, reduced-motion friendly
 * Fixes:
 *  - resolveTranslation — no raw-key leaks
 *  - send button 44→40px on mobile (still tappable, less crowding)
 *  - better lock state: visually dimmed + disabled placeholder
 *  - char counter (4000 max) with warning color
 * Contract preserved:
 *  - data-testid="ai-send" / "ai-stop" / "ai-composer-input"
 *  - Send button ALWAYS rendered (disabled when empty)
 *  - Same prop API
 * ============================================================================
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Square, X, Mic, Send, Loader2 } from 'lucide-react';
import { GlassButton, GlassTextArea } from '@/components/ui';
import type { AiStatus } from '@/hooks/useAiCopilot';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

const MIN_HEIGHT = 40;
const MAX_HEIGHT = 160;
const MAX_CHARS = 4000;
const COUNTER_THRESHOLD = 3200;

const SPRING_SMOOTH = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;

function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const v = t(key);
    return !v || v === key ? fallback : v;
  } catch {
    return fallback;
  }
}

export interface AiComposerProps {
  status: AiStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear?: () => void;
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Siri-style waveform
 * ────────────────────────────────────────────────────────────────────────── */

function Waveform({ reduced, tone = '#007AFF' }: { reduced: boolean; tone?: string }) {
  const BARS = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div className="flex h-5 items-center gap-[3px]" aria-hidden="true">
      {BARS.map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: tone }}
          animate={
            reduced
              ? { height: 10, opacity: 0.7 }
              : {
                  height: [6, 16, 10, 20, 8, 6],
                  opacity: [0.55, 1, 0.7, 1, 0.6, 0.55],
                }
          }
          transition={{
            duration: 1.3,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Composer
 * ────────────────────────────────────────────────────────────────────────── */

export function AiComposer({ status, onSend, onStop, onClear }: AiComposerProps) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const haptics = useHaptics();
  const sound = usePremiumSound();
  const { t } = useI18n();
  const reduced = useReducedMotion();

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
  const canSubmit = !locked && draft.trim().length > 0 && draft.length <= MAX_CHARS;
  const showCounter = draft.length >= COUNTER_THRESHOLD;
  const overLimit = draft.length > MAX_CHARS;

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, [draft]);

  // External voice toggle (from parent)
  useEffect(() => {
    const handleToggle = () => toggleVoice();
    window.addEventListener('medu-ai-toggle-voice', handleToggle);
    return () => window.removeEventListener('medu-ai-toggle-voice', handleToggle);
  }, [toggleVoice]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || locked || overLimit) return;
    haptics.success();
    sound.playPop();
    onSend(text);
    setDraft('');
    if (isListening) toggleVoice();
    // Keep focus for fast follow-up
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter') return;
    if (event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  const placeholder = isListening
    ? resolveTranslation(t, 'ai.composer.listeningPlaceholder', 'Tinglayapman… gapiring')
    : status === 'awaiting_confirmation'
      ? resolveTranslation(t, 'ai.composer.awaitingPlaceholder', 'Tasdiqlang yoki bekor qiling')
      : status === 'thinking'
        ? resolveTranslation(t, 'ai.composer.thinkingPlaceholder', 'AI javob tayyorlayapti…')
        : busy
          ? resolveTranslation(t, 'ai.composer.sendingPlaceholder', 'Yuborilmoqda…')
          : resolveTranslation(t, 'ai.composer.placeholder', 'Savol bering, hisobot so\'rang yoki amal bajarishni ayting…');

  // State-responsive ambient glow
  const ambientOpacity = isListening ? 0.85 : busy ? 0.55 : focused ? 0.7 : 0.35;
  const ambientBackground = isListening
    ? 'radial-gradient(ellipse at 30% 50%, rgba(0,122,255,0.55), transparent 55%), radial-gradient(ellipse at 75% 50%, rgba(88,86,214,0.45), transparent 55%)'
    : 'radial-gradient(ellipse at 30% 50%, rgba(0,122,255,0.30), transparent 60%), radial-gradient(ellipse at 75% 50%, rgba(175,82,222,0.24), transparent 60%)';

  return (
    <div className="shrink-0 border-t border-[var(--border,rgba(0,0,0,0.08))] bg-[var(--bg-glass,rgba(255,255,255,0.7))] p-3 backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[rgba(28,28,30,0.6)] sm:p-5">
      <div className="mx-auto max-w-4xl">
        {/* ── Floating "Listening" chip ────────────────────────── */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              key="listening-chip"
              initial={reduced ? false : { opacity: 0, y: 8, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.94 }}
              transition={SPRING_SMOOTH}
              className="mb-2 inline-flex items-center gap-2.5 rounded-full border border-[rgba(0,122,255,0.28)] bg-[rgba(0,122,255,0.10)] px-3 py-1.5 backdrop-blur-xl"
              role="status"
              aria-live="polite"
            >
              <Waveform reduced={!!reduced} />
              <span className="text-[11px] font-semibold tracking-tight text-[#007AFF] dark:text-[#409CFF]">
                Tinglayapman
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Shell wrapper (ambient glow lives here) ──────────── */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING_SMOOTH}
          className="relative"
        >
          {/* Ambient glow — state-responsive */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-3 -z-10 rounded-[32px] blur-2xl"
            style={{ background: ambientBackground }}
            animate={{ opacity: ambientOpacity }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />

          {/* Liquid glass shell — 4 layers */}
          <div
            data-state={isListening ? 'listening' : focused ? 'focused' : busy ? 'busy' : 'idle'}
            className={cn(
              'relative overflow-hidden rounded-[26px]',
              'border backdrop-blur-2xl backdrop-saturate-150',
              'transition-[border-color,box-shadow] duration-300 ease-out',
              isListening
                ? 'border-[rgba(0,122,255,0.45)] shadow-[0_0_0_4px_rgba(0,122,255,0.12),0_12px_40px_-12px_rgba(0,122,255,0.4)]'
                : 'border-white/60 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.14)] dark:border-white/[0.10]',
              'dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_8px_24px_-12px_rgba(0,0,0,0.50)]'
            )}
            style={{
              background: isListening
                ? 'linear-gradient(135deg, rgba(0,122,255,0.06) 0%, rgba(255,255,255,0.72) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.55) 100%)',
            }}
          >
            {/* Layer 2: Dark tint */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden dark:block"
              style={{
                background: isListening
                  ? 'linear-gradient(135deg, rgba(0,122,255,0.18) 0%, rgba(28,28,30,0.65) 100%)'
                  : 'linear-gradient(135deg, rgba(28,28,30,0.65) 0%, rgba(28,28,30,0.45) 100%)',
              }}
            />

            {/* Layer 3: Specular top edge */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/25"
            />

            {/* Layer 4: Specular bottom bevel */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.06]"
            />

            {/* Corner lens flare */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-8 -top-8 h-20 w-20 rounded-full bg-white/35 blur-2xl dark:bg-white/[0.10]"
            />

            {/* ── Content row ─────────────────────────────────── */}
            <div className="relative flex items-end gap-1.5 p-2">
              <GlassTextArea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                aria-label={resolveTranslation(t, 'ai.composer.inputAria', 'AI uchun xabar')}
                data-testid="ai-composer-input"
                rows={1}
                disabled={locked}
                className={cn(
                  'min-h-[40px] flex-1 !resize-none !border-0 !bg-transparent !px-3 !py-2 !shadow-none focus:!bg-transparent',
                  'text-[15px] leading-relaxed'
                )}
              />

              {/* Clear (X) */}
              {draft.length > 0 && !busy && (
                <GlassButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label={resolveTranslation(t, 'ai.composer.clearInput', 'Matnni tozalash')}
                  onClick={() => {
                    setDraft('');
                    onClear?.();
                    textareaRef.current?.focus();
                    haptics.light();
                  }}
                  className="mb-1 rounded-full text-[var(--text-muted,#8E8E93)] hover:bg-black/[0.05] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:bg-white/[0.08]"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </GlassButton>
              )}

              {/* Mic (visible when supported, hidden while busy) */}
              {isSupported && !busy && (
                <GlassButton
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    isListening
                      ? resolveTranslation(t, 'ai.composer.stopVoice', 'Ovozni to\'xtatish')
                      : resolveTranslation(t, 'ai.composer.voiceInput', 'Ovoz bilan kiritish')
                  }
                  aria-pressed={isListening}
                  onClick={() => {
                    haptics.medium();
                    toggleVoice();
                  }}
                  className={cn(
                    'mb-1 shrink-0 rounded-full transition-all duration-300',
                    isListening
                      ? 'bg-[#007AFF] text-white shadow-[0_4px_16px_-4px_rgba(0,122,255,0.55)] scale-105 hover:bg-[#0062CC]'
                      : 'text-[var(--text-muted,#8E8E93)] hover:bg-black/[0.05] hover:text-[var(--text-primary,#1D1D1F)] dark:hover:bg-white/[0.08]'
                  )}
                >
                  <Mic aria-hidden="true" className="h-[18px] w-[18px]" />
                </GlassButton>
              )}

              {/* Stop */}
              {canStop && (
                <GlassButton
                  variant="secondary"
                  size="icon"
                  data-testid="ai-stop"
                  aria-label={resolveTranslation(t, 'ai.composer.stop', 'To\'xtatish')}
                  onClick={onStop}
                  className="mb-1 shrink-0 rounded-full border border-[rgba(255,69,58,0.22)] bg-[rgba(255,69,58,0.10)] text-[#FF453A] hover:bg-[rgba(255,69,58,0.16)]"
                >
                  <Square aria-hidden="true" className="h-4 w-4" />
                </GlassButton>
              )}

              {/* Send — always rendered. Conic ring when ready */}
              <div className="relative mb-1 shrink-0">
                {canSubmit && !reduced && (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[3px] rounded-full"
                    style={{
                      background:
                        'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
                      filter: 'blur(2px)',
                    }}
                    animate={{ rotate: 360, opacity: [0.55, 0.85, 0.55] }}
                    transition={{
                      rotate: { duration: 6, repeat: Infinity, ease: 'linear' },
                      opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                    }}
                  />
                )}
                <GlassButton
                  onClick={submit}
                  disabled={!canSubmit}
                  loading={busy}
                  data-testid="ai-send"
                  aria-label={
                    busy
                      ? resolveTranslation(t, 'ai.composer.sending', 'Yuborilmoqda')
                      : resolveTranslation(t, 'ai.composer.send', 'Yuborish')
                  }
                  className={cn(
                    'relative !h-10 !w-10 !rounded-full !p-0',
                    'bg-gradient-to-br from-[#007AFF] to-[#5856D6] text-white',
                    'shadow-[0_4px_14px_-4px_rgba(0,122,255,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]',
                    'transition-[transform,opacity] duration-150',
                    'active:scale-95 motion-reduce:active:scale-100',
                    'disabled:opacity-40 disabled:shadow-none'
                  )}
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send
                      className="h-4 w-4"
                      style={{ marginLeft: '2px' }}
                      aria-hidden="true"
                    />
                  )}
                </GlassButton>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Bottom hints row ─────────────────────────────────── */}
        <div className="mt-2.5 flex items-center justify-between gap-3 px-2 text-[11px] font-medium text-[var(--text-tertiary,#8E8E93)]">
          {status === 'awaiting_confirmation' ? (
            <span className="flex items-center gap-1.5 text-[var(--warning-text,#B25000)] dark:text-[#FFB340]">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40 motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
              </span>
              {resolveTranslation(
                t,
                'ai.composer.confirmPending',
                'Tasdiqlash kutilmoqda'
              )}
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <HintChip>
                <span className="opacity-70">⇧</span>
                <span>+</span>
                <span className="font-mono">↵</span>
                <span className="ml-1 opacity-90">
                  {resolveTranslation(t, 'ai.composer.newlineHint', 'yangi qator')}
                </span>
              </HintChip>
              <HintChip>
                <span className="font-mono">↵</span>
                <span className="ml-1 opacity-90">
                  {resolveTranslation(t, 'ai.composer.sendHint', 'yuborish')}
                </span>
              </HintChip>
            </div>
          )}

          {showCounter && (
            <span
              className={cn(
                'shrink-0 tabular-nums text-[10.5px] font-semibold transition-colors',
                overLimit
                  ? 'text-[#FF453A]'
                  : draft.length > COUNTER_THRESHOLD + 400
                    ? 'text-[#FF9500]'
                    : 'text-[var(--text-tertiary,#8E8E93)]'
              )}
            >
              {draft.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── *
 * Hint chip (iOS keyboard accessory style)
 * ────────────────────────────────────────────────────────────────────────── */

function HintChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md border border-black/[0.06] bg-black/[0.03] px-1.5 text-[10px] leading-none text-[var(--text-tertiary,#8E8E93)] dark:border-white/[0.08] dark:bg-white/[0.04]">
      {children}
    </span>
  );
}

export default AiComposer;