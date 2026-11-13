'use client';

/**
 * ============================================================================
 * AiComposer — iOS 27 / visionOS "Liquid Glass Conversational Composer"
 * ============================================================================
 *
 * Premium behaviour & fixes:
 *  • Snap-to-glass shell with chromatic specular rim, focus halo & gradient ring
 *  • Circular character budget around the send button with dynamic color tone
 *  • Voice capture with live waveform + elapsed chronometer
 *  • Slash command palette (full keyboard: ↑ ↓ Tab ↵ Esc) with safe index clamping
 *  • Image-only submission support + attachment retry memory + ObjectURL cleanup
 *  • Streaming-aware Stop button (`sending` | `thinking` | `streaming`)
 *  • Draft persistence, safe history recall (↑/↓), paste & drop image handling
 *  • prefers-reduced-motion / contrast / data are all respected
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
  memo,
  type KeyboardEvent,
  type ClipboardEvent,
  type DragEvent,
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
import { cn, usePrefersReducedMotion } from '@/lib/design';
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
const MAX_ATTACHMENTS = 4;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const SPRING_GEL = {
  type: 'spring' as const,
  stiffness: 740,
  damping: 25,
  mass: 0.34,
};

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

function revokeAttachmentUrl(att?: AiAttachment) {
  if (att?.url && att.url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(att.url);
    } catch {
      /* ignore */
    }
  }
}

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-6' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute top-0 z-10', inset)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/30" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-[#5AC8FA]/30 to-transparent dark:via-[#5AC8FA]/20" />
    </div>
  );
});

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
  const [lastSentAttachments, setLastSentAttachments] = useState<
    AiAttachment[] | undefined
  >(undefined);
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const attachmentsRef = useRef(attachments);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(revokeAttachmentUrl);
    };
  }, []);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const lastSoundRef = useRef(0);
  const prevLockedRef = useRef(false);
  const prevLenRef = useRef(draft.length);
  const historyRef = useRef<string[]>([]);
  const historyIdxRef = useRef(-1);

  const reduced = usePrefersReducedMotion();
  const haptics = useHaptics();
  const sound = usePremiumSound();
  const { t, locale } = useSafeI18n();

  // Ref-stabilized feedback hooks
  const hapticsRef = useRef(haptics);
  const soundRef = useRef(sound);
  useEffect(() => {
    hapticsRef.current = haptics;
    soundRef.current = sound;
  }, [haptics, sound]);

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
    soundRef.current.playPop?.();
  }, [soundEnabled]);

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
      hapticsRef.current.light?.();
    },
  });

  // Include 'streaming' so Stop button and busy state stay active while tokens stream
  const busy =
    status === 'sending' ||
    status === 'thinking' ||
    status === 'streaming' ||
    status === 'confirming';
  const awaitingConfirmation = status === 'awaiting_confirmation';
  const locked = busy || awaitingConfirmation;
  const canStop =
    status === 'sending' || status === 'thinking' || status === 'streaming';

  const trimmedDraft = draft.trim();
  const hasAttachments = attachments.length > 0;
  // Fixed: allow submitting when either text OR image attachments are present
  const canSubmit =
    !locked &&
    (trimmedDraft.length > 0 || hasAttachments) &&
    draft.length <= MAX_CHARS;

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

  const showSlashMenu =
    isSlash && filteredCommands.length > 0 && !locked && slashMenuOpen;

  // Keep slashIndex strictly within bounds whenever query or filtered list changes
  useEffect(() => {
    if (!isSlash) {
      setSlashIndex(0);
      return;
    }
    setSlashIndex((prev) =>
      filteredCommands.length > 0 ? Math.min(prev, filteredCommands.length - 1) : 0,
    );
  }, [draft, isSlash, filteredCommands.length]);

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

  /* ── Auto-resize ───────────────────────────────────────────────────── */
  useIsomorphicLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(
      Math.max(element.scrollHeight, MIN_HEIGHT),
      MAX_HEIGHT,
    )}px`;
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
    if (draft.length === MAX_CHARS && prevLenRef.current < MAX_CHARS) {
      hapticsRef.current.medium?.();
    }
    prevLenRef.current = draft.length;
  }, [draft.length]);

  /* ── Live announcer ────────────────────────────────────────────────── */
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    let next = '';
    if (error) next = error;
    else if (awaitingConfirmation) next = 'Amal tasdiqlanishi kutilmoqda';
    else if (status === 'thinking') next = t('ai.composer.thinking') || 'O‘ylayapman…';
    else if (status === 'sending' || status === 'streaming')
      next = t('ai.composer.sending') || 'Yuborilmoqda…';
    else if (lastSent) next = t('ai.composer.sent') || 'Xabar yuborildi';
    if (next !== announcement) setAnnouncement(next);
  }, [status, awaitingConfirmation, error, lastSent, announcement, t]);

  const handleSelectSlash = useCallback(
    (command: SlashCommand) => {
      if (locked) return;
      historyIdxRef.current = -1;
      if (command.hasArg) {
        setDraft(command.prompt.slice(0, MAX_CHARS));
        setSlashMenuOpen(false);
        focusTextarea();
        return;
      }
      setDraft('');
      setSlashMenuOpen(false);
      onClear?.();
      hapticsRef.current.success?.();
      playPop();
      try {
        onSend(command.prompt);
        setLastSent(command.prompt);
        setLastSentAttachments(undefined);
        setError(null);
      } catch (cause) {
        setError(
          t('ai.composer.sendFailed') || 'Yuborib bo‘lmadi. Qayta urinib ko‘ring.',
        );
        onSendError?.(cause);
      }
    },
    [focusTextarea, locked, onClear, onSend, onSendError, playPop, t],
  );

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileList = Array.from(files);
      const oversizedFiles = fileList.filter(
        (file) => file.type.startsWith('image/') && file.size > MAX_IMAGE_BYTES,
      );
      if (oversizedFiles.length > 0) {
        setError(
          t('ai.composer.imageTooLarge') || 'Rasm hajmi juda katta (maksimal 15 MB).',
        );
      }

      const validImageFiles = fileList.filter(
        (file) => file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES,
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
          setAttachments((prev) => {
            if (prev.length >= MAX_ATTACHMENTS) {
              const evicted = prev.slice(0, prev.length - (MAX_ATTACHMENTS - 1));
              evicted.forEach(revokeAttachmentUrl);
            }
            return [...prev.slice(-(MAX_ATTACHMENTS - 1)), newAttachment];
          });
          hapticsRef.current.light?.();
        };
        reader.onerror = () => {
          setError(
            t('ai.composer.fileReadError') || 'Faylni o‘qishda xatolik yuz berdi.',
          );
        };
        reader.readAsDataURL(file);
      }
    },
    [t],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
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
      if (current.length + pasted.length > MAX_CHARS) {
        hapticsRef.current.medium?.();
      }
    },
    [processFiles],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (locked) return;
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const hasImages = Array.from(files).some((f) => f.type.startsWith('image/'));
      if (hasImages) {
        event.preventDefault();
        event.stopPropagation();
        processFiles(files);
      }
    },
    [locked, processFiles],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) revokeAttachmentUrl(target);
      return prev.filter((a) => a.id !== id);
    });
    hapticsRef.current.light?.();
  }, []);

  const submit = useCallback(() => {
    const text = draft.trim();
    if ((!text && attachments.length === 0) || locked || draft.length > MAX_CHARS) {
      return;
    }
    if (isListening) toggleVoice();
    hapticsRef.current.success?.();
    playPop();

    const promptToSend =
      text ||
      (attachments.length > 0
        ? 'Ushbu biriktirilgan rasmni tahlil qilib, xulosa ber.'
        : '');
    const sentAttachments = attachments.length > 0 ? [...attachments] : undefined;

    try {
      onSend(promptToSend, sentAttachments);
      if (text) {
        historyRef.current = [text, ...historyRef.current].slice(0, HISTORY_LIMIT);
      }
      historyIdxRef.current = -1;
      setDraft('');
      setAttachments([]);
      setError(null);
      setLastSent(promptToSend);
      setLastSentAttachments(sentAttachments);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    } catch (cause) {
      setError(
        t('ai.composer.sendFailed') || 'Yuborib bo‘lmadi. Qayta urinib ko‘ring.',
      );
      onSendError?.(cause);
    } finally {
      focusTextarea();
    }
  }, [
    attachments,
    draft,
    focusTextarea,
    isListening,
    locked,
    onSend,
    onSendError,
    playPop,
    storageKey,
    t,
    toggleVoice,
  ]);

  const retryLast = useCallback(() => {
    if (!lastSent || locked) return;
    setError(null);
    try {
      onSend(lastSent, lastSentAttachments);
    } catch (cause) {
      setError(t('ai.composer.sendFailed') || 'Yuborib bo‘lmadi.');
      onSendError?.(cause);
    }
  }, [lastSent, lastSentAttachments, locked, onSend, onSendError, t]);

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
        setSlashIndex(
          (index) => (index - 1 + filteredCommands.length) % filteredCommands.length,
        );
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

    if (
      event.key === 'ArrowUp' &&
      !isSlash &&
      draft === '' &&
      historyRef.current.length > 0
    ) {
      event.preventDefault();
      const nextIndex = Math.min(
        historyIdxRef.current + 1,
        historyRef.current.length - 1,
      );
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
      historyIdxRef.current = -1;
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
    historyIdxRef.current = -1;
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
        : t('ai.composer.placeholder') ||
          'Savol bering, hisobot so‘rang yoki topshiriq bering…';

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
    [error ? errorId : null, isListening ? voiceStatusId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div
      role="form"
      aria-label={t('ai.composer.formAria') || 'Xabar yozish'}
      data-testid="ai-composer"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
        }
      }}
      onDrop={handleDrop}
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
              key="voice-listening-chip"
              id={voiceStatusId}
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="mb-2 inline-flex min-h-8 items-center gap-2 rounded-full border border-[color:var(--cp-danger)]/30 bg-[color:var(--cp-danger)]/12 px-3 text-[11.5px] font-semibold text-[color:var(--cp-danger)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] backdrop-blur-xl"
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
                  hapticsRef.current.light?.();
                }}
                aria-label={
                  t('ai.composer.cancelVoice') || 'Ovoz yozishni bekor qilish'
                }
                className="ml-0.5 inline-flex h-5 w-5 min-h-[36px] min-w-[36px] tap-extend items-center justify-center rounded-full outline-none transition-colors hover:bg-[color:var(--cp-danger)]/15 focus-visible:ring-2 focus-visible:ring-[color:var(--cp-danger)]/50"
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
              key="composer-error-banner"
              id={errorId}
              role="alert"
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              className="mb-2 flex items-start gap-2 overflow-hidden rounded-xl border border-rose-500/30 bg-rose-500/[0.09] px-3 py-2 text-[12px] text-rose-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl dark:text-rose-300"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current"
              />
              <span className="min-w-0 flex-1 break-words">{error}</span>
              {lastSent && (
                <button
                  type="button"
                  onClick={retryLast}
                  className="inline-flex shrink-0 min-h-[36px] tap-extend items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold outline-none hover:bg-rose-500/15 focus-visible:ring-2 focus-visible:ring-rose-500/40"
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
              key="composer-attachments-tray"
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 6, height: 0 }}
              className="mb-2 flex flex-wrap gap-2 overflow-hidden px-1"
            >
              {attachments.map((att) => (
                <motion.div
                  key={att.id}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={SPRING_GEL}
                  className="group relative flex items-center gap-2 rounded-xl border border-white/70 bg-white/75 p-1.5 pr-2.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_4px_12px_-2px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/12 dark:bg-white/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                >
                  <img
                    src={att.url || att.base64}
                    alt={att.name || 'Attachment'}
                    className="h-9 w-9 rounded-lg object-cover ring-1 ring-black/5 dark:ring-white/10"
                  />
                  <div className="flex max-w-[120px] min-w-0 flex-col">
                    <span className="truncate text-[11px] font-medium text-[color:var(--cp-text)]">
                      {att.name || 'Rasm'}
                    </span>
                    <span className="text-[9.5px] tabular-nums text-[color:var(--cp-text-tertiary)]">
                      {att.size ? `${Math.max(1, Math.round(att.size / 1024))} KB` : 'Rasm'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="ml-1 flex h-5 w-5 min-h-[36px] min-w-[36px] tap-extend items-center justify-center rounded-full text-[color:var(--cp-text-secondary)] transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label="Rasmni o‘chirish"
                  >
                    <LucideX size={12} />
                  </button>
                </motion.div>
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
            className="cp-composer relative isolate flex items-end gap-1 overflow-hidden p-1.5 sm:gap-1.5 sm:p-2"
            data-focused={focused ? 'true' : undefined}
            data-locked={locked ? 'true' : undefined}
          >
            <TopSpecular inset="inset-x-6" />
            <span aria-hidden="true" className="cp-composer__ring" />

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => {
                const next = event.target.value;
                const clipped =
                  next.length <= MAX_CHARS ? next : next.slice(0, MAX_CHARS);
                if (clipped !== next) hapticsRef.current.medium?.();
                historyIdxRef.current = -1;
                setDraft(clipped);
                const nextIsSlash =
                  clipped.startsWith('/') && !clipped.includes('\n');
                if (nextIsSlash) setSlashMenuOpen(true);
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={placeholder}
              aria-label={t('ai.composer.inputAria') || 'Xabar matni'}
              aria-describedby={inputAriaDescription}
              aria-controls={showSlashMenu ? slashMenuId : undefined}
              aria-expanded={showSlashMenu}
              aria-haspopup={showSlashMenu ? 'listbox' : undefined}
              aria-activedescendant={
                showSlashMenu ? `${slashMenuId}-option-${slashIndex}` : undefined
              }
              aria-invalid={error ? true : undefined}
              data-testid="ai-composer-input"
              rows={1}
              maxLength={MAX_CHARS}
              disabled={locked}
              autoFocus={autoFocus}
              className={cn(
                'max-h-[168px] min-h-[46px] min-w-0 flex-1 resize-none',
                'border-0 bg-transparent px-2.5 py-3 sm:px-3',
                'text-base leading-[1.55] tracking-[-0.011em] sm:text-[14.5px]',
                'text-[#1c1c1e] outline-none dark:text-[#f5f5f7]',
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
            <motion.button
              type="button"
              whileTap={
                reduced || locked || attachments.length >= MAX_ATTACHMENTS
                  ? undefined
                  : { scaleX: 1.06, scaleY: 0.9 }
              }
              transition={SPRING_GEL}
              aria-label="Rasm biriktirish"
              title="Rasm biriktirish (screenshot yoki fayl)"
              onClick={() => fileInputRef.current?.click()}
              disabled={locked || attachments.length >= MAX_ATTACHMENTS}
              className="cp-icon-btn tap-extend mb-0.5 shrink-0 min-h-[44px] min-w-[44px] rounded-[13px] text-[color:var(--cp-text-secondary)] transition-colors hover:text-[color:var(--cp-text)] disabled:opacity-40"
            >
              <Paperclip size={16} />
            </motion.button>

            {isSupported && !busy && !awaitingConfirmation && (
              <motion.button
                type="button"
                whileTap={reduced ? undefined : { scaleX: 1.06, scaleY: 0.9 }}
                transition={SPRING_GEL}
                aria-label={
                  isListening
                    ? t('ai.composer.stopVoice') || 'Ovozni to‘xtatish'
                    : t('ai.composer.voiceInput') || 'Ovoz bilan kiritish'
                }
                aria-pressed={isListening}
                onClick={() => {
                  hapticsRef.current.medium?.();
                  toggleVoice();
                }}
                className={cn(
                  'cp-icon-btn tap-extend mb-0.5 shrink-0 min-h-[44px] min-w-[44px] rounded-[13px] transition-all duration-200',
                  isListening
                    ? 'border-[color:var(--cp-danger)]/35 bg-[color:var(--cp-danger)]/15 text-[color:var(--cp-danger)] shadow-[0_0_12px_rgba(255,59,48,0.25)]'
                    : '',
                )}
              >
                {isListening ? <IconWave size={17} bars={5} /> : <IconMic size={17} />}
              </motion.button>
            )}

            {canStop && (
              <CopilotButton
                variant="danger"
                size="icon-sm"
                data-testid="ai-stop"
                aria-label={t('ai.composer.stop') || 'To‘xtatish'}
                onClick={onStop}
                className="mb-0.5 !h-10 !w-10 shrink-0 rounded-[13px] border border-[color:var(--cp-danger)]/25 bg-[color:var(--cp-danger)]/10"
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
                  <circle
                    cx="22"
                    cy="22"
                    r="20"
                    fill="none"
                    stroke="var(--cp-hairline)"
                    strokeWidth="2"
                  />
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
                    style={{
                      transition: 'stroke-dashoffset 160ms linear, stroke 200ms linear',
                    }}
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
                aria-label={
                  busy
                    ? t('ai.composer.sending') || 'Yuborilmoqda'
                    : t('ai.composer.send') || 'Yuborish'
                }
                className="relative z-[1] !h-10 !w-10 shrink-0 rounded-[14px]"
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
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                />
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
                  ? t('ai.composer.thinking') || 'O‘ylayapman…'
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
            <span
              aria-live="off"
              className={cn(
                'shrink-0 text-[10.5px] font-medium tabular-nums transition-colors',
                counterTone,
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

export default AiComposer;