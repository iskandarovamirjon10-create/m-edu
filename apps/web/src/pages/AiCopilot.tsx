/**
 * M-EDU AI Copilot Workspace
 * Chat interface, history drawer, context inspector, and intelligent assistant tools.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  AnimatePresence,
  motion,
  useDragControls,
  type PanInfo,
} from 'framer-motion';
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
import { useAiHealth } from '@/hooks/useAiHealth';
import {
  useCopilotPreferences,
  copilotComfortClass,
} from '@/hooks/useCopilotPreferences';
import { useTheme } from '@/hooks/useTheme';
import { AI_MODELS, type ModelOption } from '@/components/ai/AiCopilotHeader';
import { ConfirmDialog } from '@/components/ui';
import {
  exportConversationToMarkdown,
  exportConversationToPrint,
} from '@/lib/ai/exportUtils';
import type { AiUiMessage } from '@/types/ai';
import { cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────────────────
 * Constants & Spring Physics (Fluid Motion)
 * ─────────────────────────────────────────────────────────────────────── */

const SPRING_PANEL = {
  type: 'spring' as const,
  damping: 32,
  stiffness: 350,
  mass: 0.85,
};

const SPRING_SHEET = {
  type: 'spring' as const,
  damping: 36,
  stiffness: 380,
  mass: 0.8,
};

const DOCK_ACTIONS = [
  {
    id: 'attendance',
    label: 'Davomat',
    icon: <IconAttendance size={14} />,
    prompt: "Bugungi davomatni ko'rsat va tahlil qilib ber",
  },
  {
    id: 'finance',
    label: 'Qarzdorlar',
    icon: <IconFinance size={14} />,
    prompt: "Muddati o'tgan to'lovlar va qarzdorlar ro'yxatini ko'rsat",
  },
  {
    id: 'schedule',
    label: 'Jadval',
    icon: <IconSchedule size={14} />,
    prompt: "Bugungi darslar jadvalini ko'rsat",
  },
  {
    id: 'report',
    label: 'Hisobot',
    icon: <IconReport size={14} />,
    prompt: 'Bugungi boshqaruv hisobotini tayyorla',
  },
] as const;

/* ─────────────────────────────────────────────────────────────────────────
 * Custom Ergonomic Hooks
 * ─────────────────────────────────────────────────────────────────────── */

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return;
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;

    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

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
): void {
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
        (el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
      );

    const raf = requestAnimationFrame(() => {
      const elements = getFocusable();
      (elements[0] ?? node).focus({ preventScroll: true });
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

function useHotkeys(map: Record<string, () => void>): void {
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable
      );
    };

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const parts: string[] = [];
      if (mod) parts.push('mod');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');
      parts.push(event.key.toLowerCase());

      const combo = parts.join('+');
      const handler = mapRef.current[combo];
      if (!handler) return;

      // Allow Escape and Mod+ shortcuts even inside inputs
      if (!mod && event.key !== 'Escape' && isEditable(event.target)) return;
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Main V2 Component
 * ─────────────────────────────────────────────────────────────────────── */

export function AiCopilot() {
  const { t } = useSafeI18n();
  const online = useOnlineStatus();
  const { routeTitle, routeContext } = useAiContextSuggestions();
  const { isDark, toggleTheme } = useTheme();
  const { preferences, setPreference } = useCopilotPreferences();

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTabletUp = useMediaQuery('(min-width: 768px)');

  /* ── UI Layout States ─────────────────────────────────────────── */
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(AI_MODELS[0]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const historyDrawerRef = useRef<HTMLDivElement>(null);
  const contextSheetRef = useRef<HTMLDivElement>(null);
  const dragDepthRef = useRef(0);
  const sheetDragControls = useDragControls();

  /* ── Copilot Engine Hook ──────────────────────────────────────── */
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
    model: selectedModel.id,
  });

  const { createNew, renameConversation, deleteConversation, loadMessages } = useConversations();
  const { mode: aiMode } = useAiHealth();

  const isStreaming = status === 'streaming';
  const isThinking = busy && !isStreaming;

  /* ── V2 Interactive Spotlight Tracker (Desktop Fine Pointer) ────
   * The spotlight follows the cursor, so it fires dozens of times per
   * second. Reading `getBoundingClientRect()` inside the handler would force
   * a layout on every pointer event; instead the rect is cached on enter /
   * resize and writes are coalesced into one rAF frame. */
  const spotRectRef = useRef<DOMRect | null>(null);
  const spotPointRef = useRef<{ x: number; y: number } | null>(null);
  const spotFrameRef = useRef(0);

  const flushSpotlight = useCallback(() => {
    spotFrameRef.current = 0;
    const el = shellRef.current;
    const point = spotPointRef.current;
    const rect = spotRectRef.current;
    if (!el || !point || !rect || rect.width === 0 || rect.height === 0) return;
    const x = ((point.x - rect.left) / rect.width) * 100;
    const y = ((point.y - rect.top) / rect.height) * 100;
    el.style.setProperty('--cp-spot-x', `${x.toFixed(1)}%`);
    el.style.setProperty('--cp-spot-y', `${y.toFixed(1)}%`);
  }, []);

  const handleShellPointerEnter = useCallback(() => {
    spotRectRef.current = shellRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const handleShellPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDesktop || preferences.reduceMotion) return;
      spotPointRef.current = { x: event.clientX, y: event.clientY };
      if (!spotRectRef.current) {
        spotRectRef.current = shellRef.current?.getBoundingClientRect() ?? null;
      }
      if (spotFrameRef.current) return;
      spotFrameRef.current = requestAnimationFrame(flushSpotlight);
    },
    [isDesktop, preferences.reduceMotion, flushSpotlight],
  );

  useEffect(() => {
    const invalidate = () => {
      spotRectRef.current = null;
    };
    window.addEventListener('resize', invalidate, { passive: true });
    window.addEventListener('scroll', invalidate, { passive: true });
    return () => {
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate);
      if (spotFrameRef.current) cancelAnimationFrame(spotFrameRef.current);
    };
  }, []);

  /* ── Data & Conversation Handlers ─────────────────────────────── */
  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (loadingConvId === id) return;
      setLoadingConvId(id);
      try {
        const wire = await loadMessages(id);
        const now = Date.now();
        const ui: AiUiMessage[] = wire.map((message, index) => ({
          id: `msg-${id}-${index}`,
          role: message.role,
          content: message.content || '',
          createdAt: now - (wire.length - index) * 60_000,
        }));
        hydrate(ui, wire, id);
      } catch {
        setConversationId(id);
      } finally {
        setLoadingConvId(null);
        setIsMobileHistoryOpen(false);
      }
    },
    [loadMessages, hydrate, setConversationId, loadingConvId],
  );

  const handleNewChat = useCallback(async () => {
    clear();
    setIsMobileHistoryOpen(false);
    try {
      const response = await createNew();
      if (response?.id) setConversationId(response.id);
    } catch {
      /* Offline resilience: operates cleanly in local session mode */
    }
  }, [clear, createNew, setConversationId]);

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      await renameConversation({ id, title });
    },
    [renameConversation],
  );

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
    if (messages.length === 0) return;
    exportConversationToPrint(messages, 'M-EDU AI Copilot — Suhbat Hisoboti');
  }, [messages]);

  const handleExportMarkdown = useCallback(() => {
    if (messages.length === 0) return;
    exportConversationToMarkdown(messages);
  }, [messages]);

  const handleContextAction = useCallback(
    (prompt: string) => {
      if (!canSend) return;
      setIsMobileContextOpen(false);
      if (!isDesktop) setIsContextOpen(false);
      send(prompt);
    },
    [canSend, isDesktop, send],
  );

  const handleToggleHistory = useCallback(() => {
    if (isTabletUp) {
      if (focusMode) setFocusMode(false);
      setIsHistoryCollapsed((prev) => !prev);
    } else {
      setIsMobileHistoryOpen((prev) => !prev);
    }
  }, [isTabletUp, focusMode]);

  const handleToggleContext = useCallback(() => {
    if (isDesktop) {
      if (focusMode) setFocusMode(false);
      setIsContextOpen((prev) => !prev);
    } else {
      setIsMobileContextOpen((prev) => !prev);
    }
  }, [isDesktop, focusMode]);

  /* ── Drag & Drop Prompt / File Support ────────────────────────── */
  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    if (event.dataTransfer?.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingFile(false);
      if (!canSend) return;

      const file = event.dataTransfer?.files?.[0];
      if (!file) return;

      if (
        file.type.startsWith('text/') ||
        /\.(txt|md|csv|json)$/i.test(file.name)
      ) {
        try {
          const text = await file.text();
          const clipped = text.slice(0, 8000);
          send(
            `📄 **${file.name}** fayli mazmuni bo'yicha tahlil qilib ber:\n\n\`\`\`\n${clipped}\n\`\`\``,
          );
        } catch {
          /* Ignore unreadable file */
        }
      }
    },
    [canSend, send],
  );

  /* ── Overlay & Viewport Coordination ──────────────────────────── */
  useEffect(() => {
    if (isMobileHistoryOpen && isMobileContextOpen) {
      setIsMobileContextOpen(false);
    }
  }, [isMobileHistoryOpen, isMobileContextOpen]);

  useEffect(() => {
    if (isTabletUp) setIsMobileHistoryOpen(false);
  }, [isTabletUp]);

  useEffect(() => {
    if (isDesktop) setIsMobileContextOpen(false);
  }, [isDesktop]);

  useBodyScrollLock(isMobileHistoryOpen || isMobileContextOpen);
  useFocusTrap(isMobileHistoryOpen, historyDrawerRef, () =>
    setIsMobileHistoryOpen(false),
  );
  useFocusTrap(isMobileContextOpen, contextSheetRef, () =>
    setIsMobileContextOpen(false),
  );

  /* ── Complete V2 Hotkey Matrix ────────────────────────────────── */
  useHotkeys({
    'mod+k': () => setCommandOpen((prev) => !prev),
    'mod+b': handleToggleHistory,
    'mod+i': handleToggleContext,
    'mod+.': () => setFocusMode((prev) => !prev),
    'mod+shift+o': () => void handleNewChat(),
    'mod+shift+e': handleExportChat,
    'mod+shift+m': handleExportMarkdown,
    'mod+shift+backspace': () => {
      if (messages.length > 0) setClearDialogOpen(true);
    },
    escape: () => {
      if (busy) stop();
      else if (focusMode) setFocusMode(false);
    },
  });

  /* ── Gesture Drag Dismiss Handlers ────────────────────────────── */
  const onHistoryDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.x < -75 || info.velocity.x < -380) {
      setIsMobileHistoryOpen(false);
    }
  }, []);

  const onSheetDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.y > 95 || info.velocity.y > 480) {
      setIsMobileContextOpen(false);
    }
  }, []);

  /* ── Command Palette Actions & Model Switcher ─────────────────── */
  const commands = useMemo<CopilotCommand[]>(() => {
    const coreActions: CopilotCommand[] = [
      {
        id: 'new',
        label: t('ai.newChat') || 'Yangi suhbat',
        hint: 'Toza suhbat oynasini ochish',
        group: 'Amallar',
        shortcut: '⌘⇧O',
        icon: <IconCompose size={14} />,
        run: () => void handleNewChat(),
      },
      {
        id: 'focus',
        label: focusMode ? 'Diqqat rejimidan chiqish' : 'Diqqat rejimi (Focus)',
        hint: 'Chalg‘ituvchi yon panellarni yashirish',
        group: 'Ko‘rinish',
        shortcut: '⌘.',
        icon: <IconSliders size={14} />,
        run: () => setFocusMode((prev) => !prev),
      },
      {
        id: 'history',
        label: 'Suhbatlar tarixi',
        hint: isHistoryCollapsed ? 'Chap panelni yoyish' : "Chap panelni yig'ish",
        group: 'Ko‘rinish',
        shortcut: '⌘B',
        icon: <IconHistory size={14} />,
        run: handleToggleHistory,
      },
      {
        id: 'context',
        label: 'Kontekst va vositalar paneli',
        hint: 'Sahifa bo‘yicha tahlil va tezkor amallar',
        group: 'Ko‘rinish',
        shortcut: '⌘I',
        icon: <IconCompass size={14} />,
        run: handleToggleContext,
      },
      {
        id: 'theme',
        label: isDark ? "Yorug' rejimga o'tish" : "Qorong'i rejimga o'tish",
        hint: 'Liquid Glass kun / tun mavzusi',
        group: 'Ko‘rinish',
        icon: isDark ? <IconSun size={14} /> : <IconMoon size={14} />,
        run: toggleTheme,
      },
      {
        id: 'density',
        label:
          preferences.density === 'compact'
            ? 'Qulay (Comfortable) zichlik'
            : 'Ixcham (Compact) zichlik',
        hint: 'Xabarlar orasidagi masofani moslash',
        group: 'Ko‘rinish',
        icon: <IconSliders size={14} />,
        run: () =>
          setPreference(
            'density',
            preferences.density === 'compact' ? 'comfortable' : 'compact',
          ),
      },
      {
        id: 'export',
        label: 'Suhbatni chop etish / PDF',
        hint: 'Rasmiy A4 hisobot formatida saqlash',
        group: 'Eksport',
        shortcut: '⌘⇧E',
        icon: <IconDownload size={14} />,
        run: handleExportChat,
      },
      {
        id: 'export-md',
        label: 'Markdown (.md) sifatida yuklab olish',
        hint: 'Hujjat sifatida saqlash',
        group: 'Eksport',
        shortcut: '⌘⇧M',
        icon: <IconDownload size={14} />,
        run: handleExportMarkdown,
      },
      {
        id: 'clear',
        label: 'Suhbatni tozalash',
        hint: "Joriy suhbat tarixini butunlay o'chirish",
        group: 'Amallar',
        shortcut: '⌘⇧⌫',
        icon: <IconTrash size={14} />,
        run: () => setClearDialogOpen(true),
      },
    ];

    const quickPrompts: CopilotCommand[] = DOCK_ACTIONS.map((item) => ({
      id: `prompt-${item.id}`,
      label: `${item.label} tahlili`,
      hint: item.prompt,
      group: 'Tezkor so‘rovlar',
      icon: item.icon,
      run: () => canSend && send(item.prompt),
    }));

    const modelSwitchers: CopilotCommand[] = AI_MODELS.map((model) => ({
      id: `model-${model.id}`,
      label: `Model: ${model.label}`,
      hint:
        selectedModel.id === model.id
          ? '✓ Hozir faol model'
          : model.description || "Ushbu AI modelga o'tish",
      group: 'AI Modellar',
      icon: <IconSliders size={14} />,
      run: () => setSelectedModel(model),
    }));

    return [...coreActions, ...quickPrompts, ...modelSwitchers];
  }, [
    t,
    focusMode,
    isHistoryCollapsed,
    isDark,
    toggleTheme,
    preferences.density,
    setPreference,
    handleNewChat,
    handleToggleHistory,
    handleToggleContext,
    handleExportChat,
    handleExportMarkdown,
    canSend,
    send,
    selectedModel.id,
  ]);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div
      ref={shellRef}
      onPointerEnter={handleShellPointerEnter}
      onPointerMove={handleShellPointerMove}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-busy={busy ? 'true' : 'false'}
      data-thinking={isThinking ? 'true' : 'false'}
      className={cn(
        'cp-shell relative flex w-full overflow-hidden select-none sm:select-auto',
        copilotComfortClass(preferences),
      )}
      style={{ height: 'calc(100dvh - 4rem)' }}
    >
      {/* ── 1. Spatial Aurora Ambient Layer ──────────────────────── */}
      <div aria-hidden="true" className="cp-aurora">
        <div className="cp-aurora__blob cp-aurora__blob--a" />
        <div className="cp-aurora__blob cp-aurora__blob--b" />
        <div className="cp-aurora__blob cp-aurora__blob--c" />
        <div className="cp-aurora__grain" />
      </div>

      {/* ── 2. Drag-and-Drop File Glass Overlay ──────────────────── */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            key="drop-zone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-3 z-[180] flex flex-col items-center justify-center rounded-[var(--cp-radius-xl)] cp-glass--floating border-2 border-dashed border-[color:var(--cp-accent)]"
          >
            <div className="cp-badge cp-badge--accent mb-2 px-3 py-1 text-xs">
              M-EDU AI Dropzone
            </div>
            <p className="text-base font-semibold text-[color:var(--cp-text)]">
              Tahlil qilish uchun faylni shu yerga tashlang
            </p>
            <p className="mt-1 text-xs text-[color:var(--cp-text-tertiary)]">
              .txt, .md, .csv yoki .json formatidagi ma’lumotlar qo‘llab-quvvatlanadi
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. Left Rail: Conversation History (Animated) ────────── */}
      <AnimatePresence initial={false}>
        {!focusMode && isTabletUp && (
          <motion.div
            key="desktop-history-rail"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={SPRING_PANEL}
            className="relative z-10 hidden h-full shrink-0 overflow-hidden md:flex"
          >
            <CopilotHistoryRail
              collapsed={isHistoryCollapsed}
              onToggleCollapse={() => setIsHistoryCollapsed((prev) => !prev)}
              activeId={conversationId ?? null}
              onSelect={handleSelectConversation}
              onNew={handleNewChat}
              onRename={handleRenameConversation}
              onDelete={handleDeleteConversation}
              className="h-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 4. Central Conversation Studio Canvas ────────────────── */}
      <main
        aria-label="AI Copilot conversation"
        aria-busy={busy}
        className="relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden"
      >
        <AiCopilotHeader
          online={online}
          mode={aiMode}
          busy={busy}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          isHistoryCollapsed={isHistoryCollapsed}
          onToggleHistory={handleToggleHistory}
          isContextOpen={isContextOpen}
          onToggleContext={handleToggleContext}
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
          onToggleFocusMode={() => setFocusMode((prev) => !prev)}
        />

        {/* Top Floating Status Bar: Offline Warning & Focus Mode Pill */}
        <AnimatePresence>
          {(!online || focusMode) && (
            <motion.div
              key="status-bar"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-none absolute inset-x-0 top-16 z-30 flex items-center justify-center gap-2 px-4"
            >
              {!online && (
                <div
                  role="status"
                  className="pointer-events-auto cp-badge border-[color:var(--cp-danger-bright)] bg-[color:var(--cp-surface-floating)] px-3 py-1 text-xs text-[color:var(--cp-danger-bright)] shadow-[var(--cp-shadow-2)]"
                >
                  <span className="cp-live-dot cp-live-dot--offline mr-1" />
                  Oflayn rejim — internet aloqasi kutilmoqda
                </div>
              )}

              {focusMode && (
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  className="pointer-events-auto cp-badge cp-badge--accent cp-hover-lift cursor-pointer px-3 py-1 text-xs shadow-[var(--cp-shadow-2)]"
                  title="Diqqat rejimidan chiqish (⌘.)"
                >
                  <span>Diqqat rejimi faol</span>
                  <kbd className="cp-kbd ml-1">⌘.</kbd>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Stream Area */}
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
            isStreaming={isStreaming}
          />
        </div>

        {/* Mobile Spatial Quick Dock */}
        <div className="relative z-10 shrink-0 px-3 pb-1 md:hidden">
          <div className="cp-dock" role="group" aria-label="Tezkor amallar">
            {DOCK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={!canSend}
                onClick={() => send(action.prompt)}
                className="cp-dock__chip disabled:opacity-45"
              >
                <span
                  aria-hidden="true"
                  className="text-[color:var(--cp-accent)]"
                >
                  {action.icon}
                </span>
                {action.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="cp-dock__chip"
              aria-label="Barcha buyruqlar"
            >
              <span
                aria-hidden="true"
                className="text-[color:var(--cp-accent)]"
              >
                <IconPlus size={14} />
              </span>
              Buyruqlar
            </button>
          </div>
        </div>

        {/* AI Composer Input */}
        <AiComposer
          status={status}
          onSend={send}
          onStop={stop}
          onClear={() => setClearDialogOpen(true)}
          soundEnabled={preferences.sound}
        />
      </main>

      {/* ── 5. Right Rail: Desktop Context & Insights Panel ──────── */}
      <AnimatePresence initial={false}>
        {isDesktop && isContextOpen && !focusMode && (
          <motion.aside
            key="desktop-context-panel"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 344, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={SPRING_PANEL}
            className="relative z-10 hidden h-full shrink-0 overflow-hidden border-l border-[color:var(--cp-hairline)] lg:flex"
            aria-label="Context and tools"
          >
            <CopilotContextPanel
              routeContext={routeContext}
              onActionClick={handleContextAction}
              onClose={() => setIsContextOpen(false)}
              className="h-full w-[344px]"
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── 6. Mobile History Drawer (Left Glass Slide-Over) ─────── */}
      <AnimatePresence>
        {isMobileHistoryOpen && (
          <>
            <motion.div
              key="history-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileHistoryOpen(false)}
              className="cp-overlay md:hidden"
              aria-hidden="true"
            />
            <motion.div
              key="history-drawer"
              ref={historyDrawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Suhbatlar tarixi"
              tabIndex={-1}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={SPRING_SHEET}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.45, right: 0 }}
              onDragEnd={onHistoryDragEnd}
              className="cp-glass--floating fixed inset-y-0 left-0 z-[165] flex w-[min(86vw,20.5rem)] flex-col overflow-hidden border-r border-[color:var(--cp-hairline-strong)] md:hidden"
            >
              <CopilotHistoryRail
                collapsed={false}
                onToggleCollapse={() => setIsMobileHistoryOpen(false)}
                activeId={conversationId ?? null}
                onSelect={handleSelectConversation}
                onNew={handleNewChat}
                onRename={handleRenameConversation}
                onDelete={handleDeleteConversation}
                className="h-full w-full border-r-0 bg-transparent"
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 7. Mobile / Tablet Context Bottom Sheet (Handle-Driven) ─ */}
      <AnimatePresence>
        {isMobileContextOpen && (
          <>
            <motion.div
              key="context-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileContextOpen(false)}
              className="cp-overlay lg:hidden"
              aria-hidden="true"
            />
            <motion.div
              key="context-sheet"
              ref={contextSheetRef}
              role="dialog"
              aria-modal="true"
              aria-label="Kontekst va tezkor amallar"
              tabIndex={-1}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={SPRING_SHEET}
              drag="y"
              dragControls={sheetDragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.45 }}
              onDragEnd={onSheetDragEnd}
              className="cp-glass--floating cp-specular fixed inset-x-0 bottom-0 z-[165] flex max-h-[86dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-[color:var(--cp-hairline-strong)] lg:hidden"
              style={{
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
              }}
            >
              {/* Dedicated Drag Grabber Handle (Prevents inner scroll conflict) */}
              <div
                aria-hidden="true"
                onPointerDown={(event) => sheetDragControls.start(event)}
                className="flex w-full shrink-0 cursor-grab touch-none items-center justify-center pb-2 pt-3.5 active:cursor-grabbing"
              >
                <div className="h-1.5 w-11 rounded-full bg-[color:var(--cp-hairline-strong)] transition-transform active:scale-95" />
              </div>

              <div className="min-h-0 flex-1 overflow-hidden">
                <CopilotContextPanel
                  routeContext={routeContext}
                  onActionClick={handleContextAction}
                  onClose={() => setIsMobileContextOpen(false)}
                  className="h-full w-full border-l-0 bg-transparent"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── 8. Command Palette (⌘K) ──────────────────────────────── */}
      <CopilotCommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        commands={commands}
      />

      {/* ── 9. Clear Chat Confirmation Dialog ────────────────────── */}
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