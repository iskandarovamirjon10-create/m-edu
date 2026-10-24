/**
 * M-EDU AI Copilot — "Liquid Glass Studio".
 * ============================================================================
 * Layout contract
 *   Desktop  (≥1024px): [History | Conversation | Context] + command palette
 *   Tablet   (768–1023px): [History | Conversation] + slide-over Context
 *   Mobile   (<768px): single canvas + history drawer + context bottom sheet
 *                      + a thumb-reachable quick action dock
 *
 * Premium comfort
 *   - ⌘K command palette, ⌘B history, ⌘. focus mode, ⌘⇧O new chat, ⌘⇧E export
 *   - Focus mode hides both rails for distraction-free work
 *   - Persisted density / calm-motion / sound preferences
 *   - Day / night / OLED / sepia via `--cp-*` design tokens
 *   - Drag-to-dismiss overlays, focus trap, scroll lock, safe-area padding
 * ============================================================================
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import {
  AiComposer,
  AiCopilotHeader,
  AiMessageList,
  CopilotHistoryRail,
  CopilotContextPanel,
  CopilotCommandPalette,
  type CopilotCommand,
} from '@/components/ai';
import {
  IconAttendance,
  IconCompose,
  IconCompass,
  IconDownload,
  IconFinance,
  IconHistory,
  IconMoon,
  IconPlus,
  IconReport,
  IconSchedule,
  IconSliders,
  IconSun,
  IconTrash,
} from '@/components/ai/copilotIcons';
import { useAiCopilot } from '@/hooks/useAiCopilot';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { useAiContextSuggestions } from '@/hooks/useAiContextSuggestions';
import { useConversations } from '@/hooks/useConversations';
import { useCopilotPreferences, copilotComfortClass } from '@/hooks/useCopilotPreferences';
import { useTheme } from '@/hooks/useTheme';
import { AI_MODELS, type ModelOption } from '@/components/ai/AiCopilotHeader';
import { ConfirmDialog } from '@/components/ui';
import { exportConversationToMarkdown, exportConversationToPrint } from '@/lib/ai/exportUtils';
import type { AiUiMessage } from '@/types/ai';
import { cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────────────────
 * Hooks
 * ─────────────────────────────────────────────────────────────────────── */

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    setMatches(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPaddingRight;
    };
  }, [locked]);
}

function useFocusTrap(
  active: boolean,
  ref: { readonly current: HTMLElement | null },
  onClose?: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    const SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (element) => !element.hasAttribute('aria-hidden') && element.offsetParent !== null,
      );

    const raf = requestAnimationFrame(() => {
      const elements = getFocusable();
      (elements[0] ?? node).focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = getFocusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      prevFocused?.focus?.({ preventScroll: true });
    };
  }, [active, ref]);
}

function useHotkeys(map: Record<string, () => void>) {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      if (!element) return false;
      return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable;
    };

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const parts: string[] = [];
      if (mod) parts.push('mod');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');
      parts.push(event.key.toLowerCase());
      const handler = mapRef.current[parts.join('+')];
      if (!handler) return;
      if (!mod && isEditable(event.target)) return;
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Mobile dock data
 * ─────────────────────────────────────────────────────────────────────── */

const DOCK_ACTIONS = [
  { id: 'attendance', label: 'Davomat', icon: <IconAttendance size={14} />, prompt: "Bugungi davomatni ko'rsat" },
  { id: 'finance', label: "Qarzdorlar", icon: <IconFinance size={14} />, prompt: "Muddati o'tgan to'lovlar va qarzdorlar ro'yxatini ko'rsat" },
  { id: 'schedule', label: 'Jadval', icon: <IconSchedule size={14} />, prompt: "Bugungi darslar jadvalini ko'rsat" },
  { id: 'report', label: 'Hisobot', icon: <IconReport size={14} />, prompt: "Bugungi boshqaruv hisobotini tayyorla" },
];

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ─────────────────────────────────────────────────────────────────────── */

export function AiCopilot() {
  const { t } = useSafeI18n();
  const online = useOnlineStatus();
  const { routeTitle, routeContext } = useAiContextSuggestions();
  const { isDark, toggleTheme } = useTheme();
  const { preferences, setPreference } = useCopilotPreferences();

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTabletUp = useMediaQuery('(min-width: 768px)');

  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(AI_MODELS[0]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  const historyDrawerRef = useRef<HTMLDivElement>(null);
  const contextSheetRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    status,
    error,
    busy,
    canSend,
    lastPrompt,
    conversationId,
    setConversationId,
    send,
    retry,
    stop,
    confirm,
    reject,
    dismissActionError,
    clear,
    hydrate,
  } = useAiCopilot({
    persistence: 'local',
    // The header picker is the source of truth: previously it changed state
    // only locally and every request still went to the default model.
    model: selectedModel.id,
  });

  const { createNew, deleteConversation, loadMessages } = useConversations();

  /* ── Data handlers ────────────────────────────────────────────── */
  const handleSelectConversation = useCallback(
    async (id: string) => {
      try {
        const wire = await loadMessages(id);
        const ui: AiUiMessage[] = wire.map((message, index) => ({
          id: `msg-${id}-${index}`,
          role: message.role,
          content: message.content || '',
          createdAt: Date.now() - (wire.length - index) * 60_000,
        }));
        hydrate(ui, wire, id);
      } catch {
        setConversationId(id);
      } finally {
        setIsMobileHistoryOpen(false);
      }
    },
    [loadMessages, hydrate, setConversationId],
  );

  const handleNewChat = useCallback(async () => {
    clear();
    setIsMobileHistoryOpen(false);
    try {
      const response = await createNew();
      if (response?.id) setConversationId(response.id);
    } catch {
      /* offline: local-only new chat */
    }
  }, [clear, createNew, setConversationId]);

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConversation(id);
      if (conversationId === id) clear();
    },
    [deleteConversation, conversationId, clear],
  );

  const handleClearConfirm = useCallback(() => {
    clear();
    setClearDialogOpen(false);
  }, [clear]);

  const handleExportChat = useCallback(() => {
    exportConversationToPrint(messages, 'M-EDU AI Copilot — Suhbat Hisoboti');
  }, [messages]);

  const handleContextAction = useCallback(
    (prompt: string) => {
      if (!canSend) return;
      setIsMobileContextOpen(false);
      setIsContextOpen(false);
      send(prompt);
    },
    [canSend, send],
  );

  /* ── Overlay coordination ─────────────────────────────────────── */
  useEffect(() => {
    if (isMobileHistoryOpen && isMobileContextOpen) setIsMobileContextOpen(false);
  }, [isMobileHistoryOpen, isMobileContextOpen]);

  useEffect(() => {
    if (isTabletUp) setIsMobileHistoryOpen(false);
  }, [isTabletUp]);
  useEffect(() => {
    if (isDesktop) setIsMobileContextOpen(false);
  }, [isDesktop]);

  useBodyScrollLock(isMobileHistoryOpen || isMobileContextOpen);
  useFocusTrap(isMobileHistoryOpen, historyDrawerRef, () => setIsMobileHistoryOpen(false));
  useFocusTrap(isMobileContextOpen, contextSheetRef, () => setIsMobileContextOpen(false));

  /* ── Hotkeys ──────────────────────────────────────────────────── */
  useHotkeys({
    'mod+b': () => {
      if (isTabletUp) setIsHistoryCollapsed((value) => !value);
      else setIsMobileHistoryOpen((value) => !value);
    },
    'mod+.': () => setFocusMode((value) => !value),
    'mod+shift+o': () => void handleNewChat(),
    'mod+shift+e': () => {
      if (messages.length > 0) handleExportChat();
    },
  });

  /* ── Drag to dismiss ──────────────────────────────────────────── */
  const onHistoryDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.x < -80 || info.velocity.x < -420) setIsMobileHistoryOpen(false);
  }, []);

  const onSheetDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 520) setIsMobileContextOpen(false);
  }, []);

  /* ── Command palette ──────────────────────────────────────────── */
  const commands = useMemo<CopilotCommand[]>(() => {
    const list: CopilotCommand[] = [
      {
        id: 'new',
        label: t('ai.newChat') || 'Yangi suhbat',
        hint: 'Toza suhbat boshlash',
        group: 'Amallar',
        shortcut: '⌘⇧O',
        icon: <IconCompose size={14} />,
        run: () => void handleNewChat(),
      },
      {
        id: 'focus',
        label: focusMode ? 'Diqqat rejimini yopish' : 'Diqqat rejimi',
        hint: 'Yon panellarni yashirish',
        group: 'Amallar',
        shortcut: '⌘.',
        icon: <IconSliders size={14} />,
        run: () => setFocusMode((value) => !value),
      },
      {
        id: 'history',
        label: 'Suhbatlar tarixi',
        hint: isHistoryCollapsed ? 'Panelni yoyish' : "Panelni yig'ish",
        group: 'Ko‘rinish',
        shortcut: '⌘B',
        icon: <IconHistory size={14} />,
        run: () => {
          if (isTabletUp) setIsHistoryCollapsed((value) => !value);
          else setIsMobileHistoryOpen(true);
        },
      },
      {
        id: 'context',
        label: 'Kontekst paneli',
        hint: 'Insight va tezkor amallar',
        group: 'Ko‘rinish',
        icon: <IconCompass size={14} />,
        run: () => {
          if (isDesktop) setIsContextOpen((value) => !value);
          else setIsMobileContextOpen(true);
        },
      },
      {
        id: 'theme',
        label: isDark ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish",
        hint: 'Kun / tun',
        group: 'Ko‘rinish',
        icon: isDark ? <IconSun size={14} /> : <IconMoon size={14} />,
        run: toggleTheme,
      },
      {
        id: 'export',
        label: 'Suhbatni chop etish / PDF',
        hint: 'A4 formati',
        group: 'Amallar',
        shortcut: '⌘⇧E',
        icon: <IconDownload size={14} />,
        run: () => messages.length > 0 && handleExportChat(),
      },
      {
        id: 'export-md',
        label: 'Suhbatni Markdown (.md) yuklab olish',
        hint: 'Faylga saqlash',
        group: 'Amallar',
        icon: <IconDownload size={14} />,
        run: () => messages.length > 0 && exportConversationToMarkdown(messages),
      },
      {
        id: 'clear',
        label: 'Chatni tozalash',
        hint: "Tarix butunlay o'chiriladi",
        group: 'Amallar',
        icon: <IconTrash size={14} />,
        run: () => setClearDialogOpen(true),
      },
    ];

    const prompts: CopilotCommand[] = [
      { id: 'p-attendance', label: 'Davomat tahlili', hint: "Bugungi davomatni ko'rsat", group: 'Tezkor so‘rovlar', icon: <IconAttendance size={14} />, run: () => canSend && send("Bugungi davomatni ko'rsat") },
      { id: 'p-finance', label: 'Qarzdorlar', hint: "To'lovlar va qarzdorlar", group: 'Tezkor so‘rovlar', icon: <IconFinance size={14} />, run: () => canSend && send("Muddati o'tgan to'lovlar va qarzdorlar ro'yxatini ko'rsat") },
      { id: 'p-schedule', label: 'Dars jadvali', hint: 'Bugungi darslar', group: 'Tezkor so‘rovlar', icon: <IconSchedule size={14} />, run: () => canSend && send("Bugungi darslar jadvalini ko'rsat") },
      { id: 'p-report', label: 'Boshqaruv hisoboti', hint: 'Kunlik xulosa', group: 'Tezkor so‘rovlar', icon: <IconReport size={14} />, run: () => canSend && send('Bugungi boshqaruv hisobotini tayyorla') },
    ];

    return [...list, ...prompts];
  }, [
    t,
    focusMode,
    isHistoryCollapsed,
    isTabletUp,
    isDesktop,
    isDark,
    toggleTheme,
    handleNewChat,
    handleExportChat,
    messages.length,
    canSend,
    send,
  ]);

  const contextNode = (
    <CopilotContextPanel
      routeContext={routeContext}
      onActionClick={handleContextAction}
      onClose={() => setIsContextOpen(false)}
      className="h-full w-[344px]"
    />
  );

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div
      className={cn(
        'cp-shell relative flex w-full overflow-hidden',
        copilotComfortClass(preferences),
      )}
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      {/* Ambient light */}
      <div aria-hidden="true" className="cp-aurora">
        <div className="cp-aurora__blob cp-aurora__blob--a" />
        <div className="cp-aurora__blob cp-aurora__blob--b" />
        <div className="cp-aurora__blob cp-aurora__blob--c" />
        <div className="cp-aurora__grain" />
      </div>

      {/* Left rail */}
      {!focusMode && (
        <div className="relative z-10 hidden h-full shrink-0 md:flex">
          <CopilotHistoryRail
            collapsed={isHistoryCollapsed}
            onToggleCollapse={() => setIsHistoryCollapsed((value) => !value)}
            activeId={conversationId ?? null}
            onSelect={handleSelectConversation}
            onNew={handleNewChat}
            onDelete={handleDeleteConversation}
            className="h-full"
          />
        </div>
      )}

      {/* Canvas */}
      <main
        aria-label="AI Copilot conversation"
        className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <AiCopilotHeader
          online={online}
          busy={busy}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          isHistoryCollapsed={isHistoryCollapsed}
          onToggleHistory={() => {
            if (isTabletUp) setIsHistoryCollapsed((value) => !value);
            else setIsMobileHistoryOpen(true);
          }}
          isContextOpen={isContextOpen}
          onToggleContext={() => {
            if (isDesktop) setIsContextOpen((value) => !value);
            else setIsMobileContextOpen(true);
          }}
          onOpenHistoryDrawer={() => setIsMobileHistoryOpen(true)}
          onOpenContextDrawer={() => setIsMobileContextOpen(true)}
          onNewChat={handleNewChat}
          onExportChat={messages.length > 0 ? handleExportChat : undefined}
          onClear={() => setClearDialogOpen(true)}
          onOpenSearch={() => setCommandOpen(true)}
          contextBadge={routeTitle}
          messageCount={messages.length || undefined}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          preferences={preferences}
          onPreferenceChange={setPreference}
          focusMode={focusMode}
          onToggleFocusMode={() => setFocusMode((value) => !value)}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
        </div>

        {/* Mobile thumb dock */}
        <div className="relative z-10 shrink-0 px-3 pb-0.5 md:hidden">
          <div className="cp-dock" role="group" aria-label="Tezkor amallar">
            {DOCK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={!canSend}
                onClick={() => send(action.prompt)}
                className="cp-dock__chip disabled:opacity-45"
              >
                <span aria-hidden="true" className="text-[color:var(--cp-accent)]">
                  {action.icon}
                </span>
                {action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="cp-dock__chip"
            >
              <span aria-hidden="true" className="text-[color:var(--cp-accent)]">
                <IconPlus size={14} />
              </span>
              Ko‘proq
            </button>
          </div>
        </div>

        <AiComposer
          status={status}
          onSend={send}
          onStop={stop}
          onClear={() => setClearDialogOpen(true)}
          soundEnabled={preferences.sound}
        />
      </main>

      {/* Desktop context panel */}
      <AnimatePresence initial={false}>
        {isDesktop && isContextOpen && !focusMode && (
          <motion.aside
            key="context-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 344, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
            className="relative z-10 hidden h-full shrink-0 overflow-hidden border-l border-[color:var(--cp-hairline)] lg:flex"
            aria-label="Context and tools"
          >
            {contextNode}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile history drawer */}
      <AnimatePresence>
        {isMobileHistoryOpen && (
          <motion.div
            key="history-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsMobileHistoryOpen(false)}
            className="cp-overlay md:hidden"
            aria-hidden="true"
          />
        )}
        {isMobileHistoryOpen && (
          <motion.div
            key="history-drawer"
            ref={historyDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Conversation history"
            tabIndex={-1}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.9 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.4, right: 0 }}
            onDragEnd={onHistoryDragEnd}
            className="fixed inset-y-0 left-0 z-[150] flex w-[min(86vw,20rem)] flex-col overflow-hidden bg-[var(--bg-card,var(--cp-surface-solid))] shadow-[var(--cp-shadow-3)] md:hidden"
          >
            <CopilotHistoryRail
              collapsed={false}
              onToggleCollapse={() => setIsMobileHistoryOpen(false)}
              activeId={conversationId ?? null}
              onSelect={handleSelectConversation}
              onNew={handleNewChat}
              onDelete={handleDeleteConversation}
              className="h-full w-full border-r-0"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile context bottom sheet */}
      <AnimatePresence>
        {isMobileContextOpen && (
          <motion.div
            key="context-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsMobileContextOpen(false)}
            className="cp-overlay lg:hidden"
            aria-hidden="true"
          />
        )}
        {isMobileContextOpen && (
          <motion.div
            key="context-sheet"
            ref={contextSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Context and tools"
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={onSheetDragEnd}
            className="fixed inset-x-0 bottom-0 z-[150] flex max-h-[86dvh] flex-col overflow-hidden rounded-t-[26px] bg-[var(--bg-card,var(--cp-surface-solid))] shadow-[var(--cp-shadow-3)] lg:hidden"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)' }}
          >
            <div
              aria-hidden="true"
              className="flex w-full shrink-0 cursor-grab items-center justify-center pb-1 pt-3 active:cursor-grabbing"
            >
              <div className="h-1.5 w-10 rounded-full bg-[color:var(--cp-hairline-strong)]" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <CopilotContextPanel
                routeContext={routeContext}
                onActionClick={handleContextAction}
                onClose={() => setIsMobileContextOpen(false)}
                className="h-full w-full border-l-0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <CopilotCommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        commands={commands}
      />

      {/* Clear confirmation */}
      <ConfirmDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
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
    </div>
  );
}

export default AiCopilot;
