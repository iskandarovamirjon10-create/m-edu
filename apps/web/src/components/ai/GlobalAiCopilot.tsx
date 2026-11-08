/**
 * GlobalAiCopilot — the assistant available on every page.
 * ============================================================================
 * Desktop: right-side glass sheet (440px) with a soft scrim.
 * Mobile:  full-width bottom sheet with drag-to-dismiss and safe-area padding.
 *
 * Behaviour kept from v2:
 *  - focus trap + focus restore, body scroll lock, Escape close (nested-aware)
 *  - ⌘J / Ctrl+J toggle, custom `open-ai-copilot` prompt bridge
 *  - unread indicator when a reply lands while closed
 *  - feature: quick route-aware prompts
 * ============================================================================
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  IconClose,
  IconMaximize,
  IconSpark,
  IconTrash,
} from './copilotIcons';
import { CopilotBadge, CopilotIconButton } from './CopilotControls';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useAiContextSuggestions } from '@/hooks/useAiContextSuggestions';
import { useHaptics } from '@/hooks/useHaptics';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useCopilotPreferences } from '@/hooks/useCopilotPreferences';
import {
  useAiCopilotOpen,
  toggleAiCopilot,
  closeAiCopilot,
  openAiCopilot,
} from '@/stores/ui.store';
import { ConfirmDialog } from '@/components/ui';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { AiComposer } from './AiComposer';
import { AiMessageList } from './AiMessageList';
import { AiWelcome } from './AiWelcome';
import { cn } from '@/lib/design';

const EXCLUDED_ROUTES = [
  '/ai-copilot',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/kiosk',
  '/attendance-kiosk',
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, [query]);
  return matches;
}

function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [active]);
}

function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  restoreTo: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const restoreTarget = restoreTo.current;
    const previous = document.activeElement as HTMLElement | null;
    const rafId = requestAnimationFrame(() => container.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (activeElement === first || activeElement === container || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('keydown', onKeyDown);
      const target = restoreTarget ?? previous;
      if (target?.isConnected) target.focus();
    };
  }, [ref, active, restoreTo]);
}

export interface GlobalAiCopilotProps {
  onOpen?: () => void;
  onClose?: () => void;
  initialPrompt?: string;
}

export function GlobalAiCopilot({ onOpen, onClose, initialPrompt }: GlobalAiCopilotProps = {}) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useSafeI18n();
  const reduced = Boolean(useReducedMotion());
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const contrast = useMediaQuery('(prefers-contrast: more)');
  const haptics = useHaptics();
  const sound = usePremiumSound();
  const { preferences } = useCopilotPreferences();

  const isOpen = useAiCopilotOpen();
  const [clearOpen, setClearOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const dialogId = useId();
  const titleId = useId();

  const { routeTitle, smartPrompts } = useAiContextSuggestions();
  const online = useOnlineStatus();

  const getContext = useCallback(() => routeTitle || 'M-EDU Platform', [routeTitle]);

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
  } = useAiCopilot({ getContext, persistence: 'local' });

  useBodyScrollLock(isOpen);
  useFocusTrap(panelRef, isOpen && !clearOpen, fabRef);

  useEffect(() => {
    if (isOpen) onOpen?.();
    else onClose?.();
  }, [isOpen, onOpen, onClose]);

  const initialPromptConsumedRef = useRef(false);
  useEffect(() => {
    if (!isOpen || !initialPrompt || initialPromptConsumedRef.current) return;
    initialPromptConsumedRef.current = true;
    send(initialPrompt);
  }, [isOpen, initialPrompt, send]);

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const wasBusy = prevStatusRef.current === 'sending' || prevStatusRef.current === 'thinking';
    if (wasBusy && status === 'idle' && !isOpen) setUnread(true);
    if (isOpen) setUnread(false);
    prevStatusRef.current = status;
  }, [status, isOpen]);

  useEffect(() => {
    if (!isOpen || clearOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault();
        haptics.light();
        closeAiCopilot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, clearOpen, haptics]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j') return;
      const element = event.target as HTMLElement | null;
      const tag = element?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || element?.isContentEditable) return;
      event.preventDefault();
      haptics.light();
      toggleAiCopilot();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [haptics]);

  useEffect(() => {
    let timerId: number | undefined;
    const onOpenWithPrompt = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      if (!isOpen) openAiCopilot();
      if (detail?.prompt) {
        timerId = window.setTimeout(() => send(detail.prompt!), 80);
      }
    };
    window.addEventListener('open-ai-copilot', onOpenWithPrompt as EventListener);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      window.removeEventListener('open-ai-copilot', onOpenWithPrompt as EventListener);
    };
  }, [isOpen, send]);

  const isExcluded = EXCLUDED_ROUTES.some((route) => pathname.startsWith(route));
  if (isExcluded) return null;

  const handleFabClick = () => {
    haptics.medium();
    if (!isOpen) sound.playPop();
    toggleAiCopilot();
  };

  const handleClose = () => {
    haptics.light();
    closeAiCopilot();
  };

  const handleClearConfirm = () => {
    clear();
    setClearOpen(false);
  };

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────── */}
      {!isOpen && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5rem)] right-4 z-[120] md:bottom-6 md:right-6">
          {!reduced && !contrast && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-2 rounded-[26px] opacity-60 blur-xl"
              style={{ background: 'var(--cp-brand-gradient)' }}
            />
          )}

          <motion.button
            ref={fabRef}
            type="button"
            onClick={handleFabClick}
            aria-label={
              isOpen ? t('a11y.aiCopilotClose') || 'AI Copilotni yopish' : t('a11y.aiCopilot') || 'AI Copilot'
            }
            aria-expanded={isOpen}
            aria-controls={dialogId}
            aria-haspopup="dialog"
            aria-keyshortcuts="Meta+J Control+J"
            whileHover={reduced ? undefined : { scale: 1.06, y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 460, damping: 26, mass: 0.7 }}
            className={cn(
              'group relative flex h-14 w-14 items-center justify-center rounded-[20px] text-white',
              'border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_18px_38px_-12px_rgba(10,132,255,0.75)]',
              'outline-none transition-colors focus-visible:ring-4 focus-visible:ring-[color:var(--cp-accent-soft)]',
              contrast && 'border-2 border-black dark:border-white',
            )}
            style={{ background: 'var(--cp-brand-gradient)' }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.38),transparent_58%)]"
            />
            <MeduAiLogo
              size="md"
              glow
              className={cn('relative transition-transform duration-300', !reduced && 'group-hover:rotate-12 group-hover:scale-110')}
            />
            {busy && (
              <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
                {!reduced && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--cp-warning)] opacity-70" />
                )}
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[color:var(--cp-warning)] ring-2 ring-white dark:ring-black" />
              </span>
            )}
            {unread && !busy && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[color:var(--cp-success-bright)] ring-2 ring-white dark:ring-black"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </span>
            )}
            {unread && <span className="sr-only">{t('ai.newReplyReady') || 'Yangi javob tayyor'}</span>}
          </motion.button>
        </div>
      )}

      {/* ── Sheet ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              onClick={handleClose}
              className={cn(
                'cp-overlay fixed inset-0 z-[140] bg-black/45 backdrop-blur-[6px]',
                contrast && 'bg-black/75',
              )}
            />

            <motion.div
              ref={panelRef}
              id={dialogId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={reduced ? { opacity: 1 } : isMobile ? { y: '100%' } : { x: '100%', opacity: 0 }}
              animate={reduced ? { opacity: 1 } : isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : isMobile ? { y: '100%' } : { x: '100%', opacity: 0 }}
              transition={reduced ? { duration: 0.15 } : { type: 'spring', damping: 32, stiffness: 360, mass: 0.9 }}
              className={cn(
                'fixed z-[150] flex flex-col overflow-hidden outline-none',
                isMobile
                  ? 'inset-x-0 bottom-0 h-[88dvh] max-h-[92dvh] rounded-t-[26px]'
                  : 'inset-y-0 right-0 w-[440px] max-w-full border-l',
                'border-[color:var(--cp-hairline)]',
                'bg-[var(--bg-card,#ffffff)] dark:bg-[#16161b]',
                'shadow-[var(--cp-shadow-3)]',
                contrast && 'border-2 border-black dark:border-white',
              )}
              style={{
                paddingBottom: isMobile ? 'max(env(safe-area-inset-bottom, 0px), 0px)' : undefined,
              }}
            >
              {isMobile && (
                <div
                  aria-hidden="true"
                  onClick={handleClose}
                  className="flex h-6 shrink-0 cursor-pointer items-center justify-center pt-2.5"
                >
                  <span className="h-1.5 w-12 rounded-full bg-[color:var(--cp-hairline-strong)] active:scale-95 transition-transform" />
                </div>
              )}

              {/* Header */}
              <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--cp-separator)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="relative flex h-9 w-9 items-center justify-center rounded-[12px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_-10px_rgba(10,132,255,0.7)]"
                    style={{ background: 'var(--cp-brand-gradient)' }}
                  >
                    <MeduAiLogo size="xs" />
                  </span>
                  <div className="min-w-0">
                    <h3 id={titleId} className="truncate text-[13.5px] font-semibold tracking-[-0.015em] text-[color:var(--cp-text)]">
                      M-EDU Copilot
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10.5px] text-[color:var(--cp-text-tertiary)]">
                      <span className={cn('cp-live-dot', !online && 'cp-live-dot--offline')} aria-hidden="true" />
                      <span className="truncate font-medium">
                        {online ? routeTitle || 'M-EDU' : t('common.offline') || 'Oflayn'}
                      </span>
                      {busy && <CopilotBadge tone="accent">ishlamoqda</CopilotBadge>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-0.5">
                  <CopilotIconButton
                    label={t('ai.openFullStudio') || "To'liq ekranga o'tish"}
                    icon={<IconMaximize size={16} />}
                    onClick={() => {
                      handleClose();
                      navigate('/ai-copilot');
                    }}
                  />
                  <CopilotIconButton
                    label={t('ai.clearChat') || 'Chatni tozalash'}
                    icon={<IconTrash size={16} />}
                    onClick={() => setClearOpen(true)}
                    disabled={messages.length === 0}
                  />
                  <CopilotIconButton
                    label={t('common.close') || 'Yopish'}
                    icon={<IconClose size={16} />}
                    onClick={handleClose}
                    aria-keyshortcuts="Escape"
                  />
                </div>
              </div>

              {/* Smart prompts */}
              {smartPrompts && smartPrompts.length > 0 && (
                <div
                  role="region"
                  aria-label={t('ai.suggestedPrompts') || 'Tavsiya etilgan'}
                  className="cp-scroll flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[color:var(--cp-separator)] bg-[color:var(--cp-surface-sunken)] px-3.5 py-2 [scrollbar-width:none]"
                >
                  <IconSpark size={12} className="shrink-0 text-[color:var(--cp-accent)]" />
                  {smartPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={!canSend}
                      onClick={() => send(prompt)}
                      aria-busy={!canSend || undefined}
                      className="shrink-0 rounded-full border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-raised)] px-3 py-1 text-[11px] font-medium text-[color:var(--cp-text-secondary)] shadow-[var(--cp-inner-rim)] transition-all duration-150 hover:border-[color:var(--cp-accent-line)] hover:text-[color:var(--cp-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Conversation */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {messages.length === 0 && status === 'idle' && !error ? (
                  <div className="cp-scroll flex-1 overflow-y-auto">
                    <AiWelcome
                      disabled={!canSend}
                      onSelect={(text) => canSend && send(text)}
                      compact
                    />
                  </div>
                ) : (
                  <AiMessageList
                    messages={messages}
                    status={status}
                    error={error}
                    lastPrompt={lastPrompt}
                    promptsDisabled={!canSend}
                    onPickPrompt={(text) => canSend && send(text)}
                    onRetry={retry}
                    onConfirm={confirm}
                    onReject={reject}
                    onDismissActionError={dismissActionError}
                    isStreaming={status === 'streaming'}
                  />
                )}
              </div>

              <div className="shrink-0">
                <AiComposer
                  status={status}
                  onSend={send}
                  onStop={stop}
                  onClear={() => setClearOpen(true)}
                  autoFocus={!isMobile && !reduced}
                  soundEnabled={preferences.sound}
                />
              </div>

              {/* Desktop footer shortcut */}
              <div className="hidden shrink-0 items-center justify-center gap-2 border-t border-[color:var(--cp-separator)] bg-[color:var(--cp-surface-sunken)] px-3 py-1.5 text-[9.5px] font-medium text-[color:var(--cp-text-tertiary)] md:flex">
                <kbd className="cp-kbd">⌘J</kbd>
                yopish / ochish
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
        title={t('ai.clearChatTitle') || 'Chatni tozalash'}
        description={
          t('ai.clearChatDescription') ||
          "Suhbat tarixi tozalansinmi? Bu amalni ortga qaytarib bo'lmaydi."
        }
        confirmLabel={t('common.clear') || 'Tozalash'}
        cancelLabel={t('common.cancel') || 'Bekor qilish'}
        tone="danger"
      />
    </>
  );
}

export default GlobalAiCopilot;
