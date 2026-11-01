/**
 * AiComposer — iOS 27 Liquid Glass conversational composer.
 * ============================================================================
 * Premium behaviour:
 *  - Snap-to-glass shell with specular rim, focus halo and gradient ring
 *  - Circular character budget around the send button
 *  - Voice capture with live waveform + elapsed time
 *  - Slash command palette (full keyboard: ↑ ↓ Tab ↵ Esc)
 *  - Draft persistence, history recall (↑), paste clamping and inline retry
 *  - Mobile: 44px targets + safe-area padding; desktop: keyboard hints
 *  - prefers-reduced-motion / contrast / data are all respected
 * ============================================================================
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IconClose,
  IconMic,
  IconRefresh,
  IconSend,
  IconStop,
  IconWave,
} from './copilotIcons';
import { CopilotButton, CopilotIconButton, CopilotKbd } from './CopilotControls';
import { Paperclip, X as LucideX } from 'lucide-react';
import type { AiStatus } from '@/hooks/useAiCopilot';
import type { AiAttachment } from '@/types/ai';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import {
  AiSlashCommandMenu,
  SLASH_COMMANDS,
  type SlashCommand,
} from './AiSlashCommandMenu';

const MIN_HEIGHT = 46;
const MAX_HEIGHT = 168;
const MAX_CHARS = 4000;
const SOFT_LIMIT = 3600;
const SOUND_THROTTLE_MS = 260;
const HISTORY_LIMIT = 50;

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export interface AiComposerProps {
  status: AiStatus;
  onSend: (text: string, attachments?: AiAttachment[]) => void;
  onStop: () => void;
  onClear?: () => void;
  onSendError?: (error: unknown) => void;
  storageKey?: string;
  autoFocus?: boolean;
  submitOnEnter?: boolean;
  /** Composer-level voice/send feedback (from Copilot preferences). */
  soundEnabled?: boolean;
}

export function AiComposer({
  status,
  onSend,
  onStop,
  onClear,
  onSendError,
  storageKey = 'ai-composer-draft',
  autoFocus = false,
  submitOnEnter = true,
  soundEnabled = true,
}: AiComposerProps) {
  const [draft, setDraft] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? stored.slice(0, MAX_CHARS) : '';
    } catch {
      return '';
    }
  });

  const [focused, setFocused] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);
  const [slashMenuOpen, setSlashMenuOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<string | null>(null);
  const [voiceElapsed, setVoiceElapsed] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const lastSoundRef = useRef(0);
  const prevLockedRef = useRef(false);
  const prevLenRef = useRef(draft.length);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);

  const haptics = useHaptics();
  const sound = usePremiumSound();
  const { t, locale } = useSafeI18n();

  const voiceStatusId = useId();
  const slashMenuId = useId();
  const announcerId = useId();
  const errorId = useId();

  const prefersContrast = useMediaQuery('(prefers-contrast: more)');

  const playPop = useCallback(() => {
    if (!soundEnabled) return;
    const now = Date.now();
    if (now - lastSoundRef.current < SOUND_THROTTLE_MS) return;
    lastSoundRef.current = now;
    sound.playPop();
  }, [sound, soundEnabled]);

  const speechLang = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'uz-UZ';

  const appendWithinLimit = useCallback((current: string, incoming: string) => {
    const separator = current.trim() ? ' ' : '';
    const available = Math.max(0, MAX_CHARS - current.length - separator.length);
    return `${current}${separator}${incoming.slice(0, available)}`;
  }, []);

  const { isListening, isSupported, toggle: toggleVoice } = useSpeechRecognition({
    lang: speechLang,
    onResult: (text) => {
      setDraft((current) => appendWithinLimit(current, text.trim()));
      haptics.light();
    },
  });

  const busy = status === 'sending' || status === 'thinking' || status === 'confirming';
  const awaitingConfirmation = status === 'awaiting_confirmation';
  const locked = busy || awaitingConfirmation;
  const canStop = status === 'sending' || status === 'thinking';

  const trimmedDraft = draft.trim();
  const canSubmit = !locked && trimmedDraft.length > 0 && draft.length <= MAX_CHARS;

  const isSlash = draft.startsWith('/') && !draft.includes('\n');
  const filteredCommands = useMemo(() => {
    if (!isSlash) return [];
    const query = draft.toLowerCase().trim();
    return SLASH_COMMANDS.filter(
      (command) =>
        command.command.toLowerCase().startsWith(query) ||
        command.title.toLowerCase().includes(query.slice(1)),
    );
  }, [draft, isSlash]);

  const showSlashMenu = isSlash && filteredCommands.length > 0 && !locked && slashMenuOpen;

  /* ── Draft persistence ─────────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      try {
        if (draft) window.localStorage.setItem(storageKey, draft);
        else window.localStorage.removeItem(storageKey);
      } catch {
        /* quota / private mode */
      }
    }, 500);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [draft, storageKey]);

  useEffect(() => {
    if (isSlash && slashMenuOpen) {
      setSlashIndex(0);
      setSlashMenuOpen(true);
    }
  }, [isSlash, slashMenuOpen]);

  /* ── Auto-resize ───────────────────────────────────────────────────── */
  useIsomorphicLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
    element.style.overflowY = element.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [draft]);

  const focusTextarea = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      textareaRef.current?.focus();
      rafRef.current = null;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (autoFocus) focusTextarea();
  }, [autoFocus, focusTextarea]);

  useEffect(() => {
    if (prevLockedRef.current && !locked) focusTextarea();
    prevLockedRef.current = locked;
  }, [locked, focusTextarea]);

  /* ── Voice timer ───────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isListening) {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
      setVoiceElapsed(0);
      return;
    }
    const startedAt = Date.now();
    voiceTimerRef.current = window.setInterval(() => {
      setVoiceElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => {
      if (voiceTimerRef.current !== null) window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    };
  }, [isListening]);

  useEffect(() => {
    if (draft.length === MAX_CHARS && prevLenRef.current < MAX_CHARS) haptics.medium();
    prevLenRef.current = draft.length;
  }, [draft.length, haptics]);

  /* ── Live announcer ────────────────────────────────────────────────── */
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    let next = '';
    if (error) next = error;
    else if (awaitingConfirmation) next = 'Amal tasdiqlanishi kutilmoqda';
    else if (status === 'thinking') next = t('ai.composer.thinking') || "O'ylayapman…";
    else if (status === 'sending') next = t('ai.composer.sending') || 'Yuborilmoqda…';
    else if (lastSent) next = t('ai.composer.sent') || 'Xabar yuborildi';
    if (next !== announcement) setAnnouncement(next);
  }, [status, awaitingConfirmation, error, lastSent, announcement, t]);

  const handleSelectSlash = useCallback(
    (command: SlashCommand) => {
      if (locked) return;
      if (command.hasArg) {
        setDraft(command.prompt.slice(0, MAX_CHARS));
        focusTextarea();
        return;
      }
      setDraft('');
      onClear?.();
      haptics.success();
      playPop();
      try {
        onSend(command.prompt);
        setLastSent(command.prompt);
      } catch (cause) {
        setError(t('ai.composer.sendFailed') || "Yuborib bo'lmadi. Qayta urinib ko'ring.");
        onSendError?.(cause);
      }
    },
    [focusTextarea, haptics, locked, onClear, onSend, onSendError, playPop, t],
  );

  const processFiles = useCallback((files: FileList | File[]) => {
    const validImageFiles = Array.from(files).filter(
      (file) => file.type.startsWith('image/') && file.size <= 15 * 1024 * 1024
    );

    if (validImageFiles.length === 0) return;

    for (const file of validImageFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (!base64) return;
        const newAttachment: AiAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'image',
          url: URL.createObjectURL(file),
          base64,
          mimeType: file.type,
          name: file.name,
          size: file.size,
        };
        setAttachments((prev) => [...prev.slice(-3), newAttachment]);
        haptics.light();
      };
      reader.readAsDataURL(file);
    }
  }, [haptics]);

  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (items) {
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        processFiles(imageFiles);
      }
    }

    const pasted = event.clipboardData?.getData('text') || '';
    const current = event.currentTarget.value;
    if (current.length + pasted.length > MAX_CHARS) haptics.medium();
  }, [haptics, processFiles]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    haptics.light();
  }, [haptics]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || locked || text.length > MAX_CHARS) return;
    if (isListening) toggleVoice();
    haptics.success();
    playPop();
    try {
      const promptToSend = text || (attachments.length > 0 ? "Ushbu biriktirilgan rasmni tahlil qilib, xulosa ber." : "");
      onSend(promptToSend, attachments.length > 0 ? attachments : undefined);
      if (text) {
        historyRef.current = [text, ...historyRef.current].slice(0, HISTORY_LIMIT);
        historyIdxRef.current = -1;
      }
      setDraft('');
      setAttachments([]);
      setError(null);
      setLastSent(promptToSend);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    } catch (cause) {
      setError(t('ai.composer.sendFailed') || "Yuborib bo'lmadi. Qayta urinib ko'ring.");
      onSendError?.(cause);
    } finally {
      focusTextarea();
    }
  }, [attachments, draft, focusTextarea, haptics, isListening, locked, onSend, onSendError, playPop, storageKey, t, toggleVoice]);

  const retryLast = useCallback(() => {
    if (!lastSent || locked) return;
    setError(null);
    try {
      onSend(lastSent);
    } catch (cause) {
      setError(t('ai.composer.sendFailed') || "Yuborib bo'lmadi.");
      onSendError?.(cause);
    }
  }, [lastSent, locked, onSend, onSendError, t]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;

    if (showSlashMenu) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSlashIndex((index) => (index + 1) % filteredCommands.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSlashIndex((index) => (index - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const selected = filteredCommands[slashIndex] ?? filteredCommands[0];
        if (selected) handleSelectSlash(selected);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        // Contract: first Escape closes the palette AND clears the command draft.
        setDraft('');
        setSlashMenuOpen(false);
        onClear?.();
        return;
      }
    }

    if (event.key === 'ArrowUp' && !isSlash && draft === '' && historyRef.current.length > 0) {
      event.preventDefault();
      const nextIndex = Math.min(historyIdxRef.current + 1, historyRef.current.length - 1);
      historyIdxRef.current = nextIndex;
      setDraft(historyRef.current[nextIndex]);
      return;
    }
    if (event.key === 'ArrowDown' && historyIdxRef.current >= 0) {
      event.preventDefault();
      const nextIndex = historyIdxRef.current - 1;
      historyIdxRef.current = nextIndex;
      setDraft(nextIndex < 0 ? '' : historyRef.current[nextIndex]);
      return;
    }

    if (event.key === 'Escape' && draft.length > 0 && !locked) {
      event.preventDefault();
      setDraft('');
      onClear?.();
      return;
    }

    if (event.key !== 'Enter' || event.shiftKey) return;
    if (!submitOnEnter || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    submit();
  };

  const clearDraft = () => {
    setDraft('');
    setError(null);
    onClear?.();
    focusTextarea();
  };

  const placeholder = isListening
    ? t('ai.composer.listeningPlaceholder') || 'Tinglayapman… gapiring'
    : awaitingConfirmation
      ? t('ai.composer.awaitingPlaceholder') || 'Tasdiqlang yoki bekor qiling'
      : busy
        ? t('ai.composer.sendingPlaceholder') || 'Javob tayyorlanmoqda…'
        : t('ai.composer.placeholder') || "Savol bering, hisobot so'rang yoki topshiriq bering…";

  const showCounter = draft.length > 0;
  const usage = Math.min(1, draft.length / MAX_CHARS);
  const counterTone =
    draft.length >= MAX_CHARS
      ? 'text-[color:var(--cp-danger)]'
      : draft.length >= SOFT_LIMIT
        ? 'text-[color:var(--cp-warning)]'
        : 'text-[color:var(--cp-text-tertiary)]';

  const ringTone =
    draft.length >= MAX_CHARS
      ? 'var(--cp-danger)'
      : draft.length >= SOFT_LIMIT
        ? 'var(--cp-warning)'
        : 'var(--cp-accent)';

  const inputAriaDescription =
    [error ? errorId : null, isListening ? voiceStatusId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div
      role="form"
      aria-label={t('ai.composer.formAria') || 'Xabar yozish'}
      data-testid="ai-composer"
      className={cn(
        'relative shrink-0 px-2.5 pt-2.5 sm:px-4 sm:pt-3',
        'pb-[max(env(safe-area-inset-bottom),10px)]',
        prefersContrast && 'border-t border-black dark:border-white',
      )}
    >
      <div id={announcerId} aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <div className="mx-auto w-full max-w-4xl">
        {/* Voice chip */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              id={voiceStatusId}
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mb-2 inline-flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--cp-danger)]/25 bg-[color:var(--cp-danger)]/10 px-3 text-[11.5px] font-semibold text-[color:var(--cp-danger)]"
            >
              <span className="cp-wave" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </span>
              <span>{t('ai.composer.listening') || 'Tinglayapman…'}</span>
              {voiceElapsed > 0 && (
                <span className="font-mono tabular-nums opacity-75">
                  {String(Math.floor(voiceElapsed / 60)).padStart(2, '0')}:
                  {String(voiceElapsed % 60).padStart(2, '0')}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  toggleVoice();
                  haptics.light();
                }}
                aria-label={t('ai.composer.cancelVoice') || 'Ovoz yozishni bekor qilish'}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full outline-none transition-colors hover:bg-[color:var(--cp-danger)]/15 focus-visible:ring-2 focus-visible:ring-[color:var(--cp-danger)]/50"
              >
                <IconClose size={11} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              id={errorId}
              role="alert"
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              className="mb-2 flex items-start gap-2 overflow-hidden rounded-xl border border-rose-500/25 bg-rose-500/[0.08] px-3 py-2 text-[12px] text-rose-700 dark:text-rose-300"
            >
              <span aria-hidden="true" className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span className="min-w-0 flex-1 break-words">{error}</span>
              {lastSent && (
                <button
                  type="button"
                  onClick={retryLast}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold outline-none hover:bg-rose-500/15 focus-visible:ring-2 focus-visible:ring-rose-500/40"
                >
                  <IconRefresh size={11} />
                  {t('common.retry') || 'Qayta'}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachments preview tray */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              className="mb-2 flex flex-wrap gap-2 overflow-hidden px-1"
            >
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="relative group flex items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.06] p-1.5 pr-2.5 backdrop-blur-md text-xs shadow-xs"
                >
                  <img
                    src={att.url || att.base64}
                    alt={att.name || 'Attachment'}
                    className="h-9 w-9 rounded-lg object-cover"
                  />
                  <div className="flex flex-col min-w-0 max-w-[120px]">
                    <span className="truncate text-[11px] font-medium text-[color:var(--cp-text)]">
                      {att.name || 'Rasm'}
                    </span>
                    <span className="text-[9.5px] text-[color:var(--cp-text-tertiary)]">
                      {att.size ? `${Math.round(att.size / 1024)} KB` : 'Rasm'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-[color:var(--cp-text-secondary)] transition-colors"
                    aria-label="Rasmni o'chirish"
                  >
                    <LucideX size={12} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative">
          {showSlashMenu && (
            <AiSlashCommandMenu
              id={slashMenuId}
              query={draft}
              selectedIndex={slashIndex}
              onSelect={handleSelectSlash}
              onClose={() => setSlashMenuOpen(false)}
            />
          )}

          <div
            className="cp-composer flex items-end gap-1 p-1.5 sm:gap-1.5 sm:p-2"
            data-focused={focused ? 'true' : undefined}
            data-locked={locked ? 'true' : undefined}
          >
            <span aria-hidden="true" className="cp-composer__ring" />

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => {
                const next = event.target.value;
                const clipped = next.length <= MAX_CHARS ? next : next.slice(0, MAX_CHARS);
                if (clipped !== next) haptics.medium();
                setDraft(clipped);
                if (!isSlash) setSlashMenuOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              aria-label={t('ai.composer.inputAria') || 'Xabar matni'}
              aria-describedby={inputAriaDescription}
              aria-controls={showSlashMenu ? slashMenuId : undefined}
              aria-activedescendant={showSlashMenu ? `${slashMenuId}-option-${slashIndex}` : undefined}
              aria-invalid={error ? true : undefined}
              data-testid="ai-composer-input"
              rows={1}
              maxLength={MAX_CHARS}
              disabled={locked}
              autoFocus={autoFocus}
              className={cn(
                'min-h-[46px] max-h-[168px] min-w-0 flex-1 resize-none',
                'border-0 bg-transparent px-2.5 py-3 sm:px-3',
                'text-base sm:text-[14.5px] leading-[1.55] tracking-[-0.011em]',
                'text-[#1c1c1e] dark:text-[#f5f5f7] outline-none',
                'placeholder:text-[#8e8e93] dark:placeholder:text-[#636366]',
                'focus:ring-0 focus-visible:outline-none',
                'disabled:cursor-not-allowed',
              )}
              style={{ height: MIN_HEIGHT }}
            />

            {draft.length > 0 && !locked && (
              <CopilotIconButton
                label={t('ai.composer.clearInput') || 'Matnni tozalash'}
                icon={<IconClose size={15} />}
                onClick={clearDraft}
                className="mb-0.5"
              />
            )}

            {/* Image attachment button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <button
              type="button"
              aria-label="Rasm biriktirish"
              title="Rasm biriktirish (screenshot yoki fayl)"
              onClick={() => fileInputRef.current?.click()}
              disabled={locked || attachments.length >= 4}
              className="cp-icon-btn mb-0.5 shrink-0 rounded-[13px] text-[color:var(--cp-text-secondary)] hover:text-[color:var(--cp-text)] transition-colors"
            >
              <Paperclip size={16} />
            </button>

            {isSupported && !busy && !awaitingConfirmation && (
              <button
                type="button"
                aria-label={
                  isListening
                    ? t('ai.composer.stopVoice') || "Ovozni to'xtatish"
                    : t('ai.composer.voiceInput') || 'Ovoz bilan kiritish'
                }
                aria-pressed={isListening}
                onClick={() => {
                  haptics.medium();
                  toggleVoice();
                }}
                className={cn(
                  'cp-icon-btn mb-0.5 shrink-0 rounded-[13px] transition-all duration-200',
                  isListening
                    ? 'border-[color:var(--cp-danger)]/30 bg-[color:var(--cp-danger)]/15 text-[color:var(--cp-danger)]'
                    : '',
                )}
              >
                {isListening ? <IconWave size={17} bars={5} /> : <IconMic size={17} />}
              </button>
            )}

            {canStop && (
              <CopilotButton
                variant="danger"
                size="icon-sm"
                data-testid="ai-stop"
                aria-label={t('ai.composer.stop') || "To'xtatish"}
                onClick={onStop}
                className="mb-0.5 shrink-0 !h-10 !w-10 rounded-[13px] border border-[color:var(--cp-danger)]/25 bg-[color:var(--cp-danger)]/10"
                icon={<IconStop size={14} />}
              />
            )}

            <div className="relative mb-0.5 shrink-0">
              {showCounter && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 44 44"
                  className="pointer-events-none absolute inset-0 h-10 w-10 -rotate-90"
                >
                  <circle cx="22" cy="22" r="20" fill="none" stroke="var(--cp-hairline)" strokeWidth="2" />
                  <circle
                    cx="22"
                    cy="22"
                    r="20"
                    fill="none"
                    stroke={ringTone}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={125.6}
                    strokeDashoffset={125.6 * (1 - usage)}
                    style={{ transition: 'stroke-dashoffset 160ms linear, stroke 200ms linear' }}
                  />
                </svg>
              )}

              <CopilotButton
                variant="primary"
                size="icon"
                onClick={submit}
                disabled={!canSubmit}
                aria-busy={busy ? 'true' : undefined}
                data-testid="ai-send"
                aria-label={busy ? t('ai.composer.sending') || 'Yuborilmoqda' : t('ai.composer.send') || 'Yuborish'}
                className="relative z-[1] shrink-0 !h-10 !w-10 rounded-[14px]"
              >
                {busy ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-[1.8px] border-white/80 border-t-transparent motion-reduce:animate-none"
                  />
                ) : (
                  <IconSend size={17} />
                )}
              </CopilotButton>
            </div>
          </div>
        </div>

        {/* Footer hints */}
        <div className="mt-1.5 flex min-h-5 items-center justify-between gap-3 px-1">
          <div className="min-w-0 text-[10.5px] font-medium text-[color:var(--cp-text-tertiary)]">
            {awaitingConfirmation ? (
              <span className="inline-flex items-center gap-1.5 text-[color:var(--cp-warning)]">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                <span className="truncate">
                  {t('ai.composer.confirmPending') || 'Amalni tasdiqlashni yakunlang'}
                </span>
              </span>
            ) : busy ? (
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent motion-reduce:animate-none"
                />
                {status === 'thinking'
                  ? t('ai.composer.thinking') || "O'ylayapman…"
                  : t('ai.composer.sending') || 'Yuborilmoqda…'}
              </span>
            ) : (
              <div className="hidden items-center gap-3 sm:flex">
                <span className="inline-flex items-center gap-1.5">
                  <CopilotKbd>↵</CopilotKbd>
                  {t('ai.composer.sendHint') || 'yuborish'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CopilotKbd>⇧↵</CopilotKbd>
                  {t('ai.composer.newlineHint') || 'yangi qator'}
                </span>
                <span className="inline-flex items-center gap-1.5 opacity-80">
                  <CopilotKbd>/</CopilotKbd>
                  buyruqlar
                </span>
              </div>
            )}
          </div>

          {showCounter && (
            <span aria-live="off" className={cn('shrink-0 text-[10.5px] font-medium tabular-nums transition-colors', counterTone)}>
              {draft.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default AiComposer;
