'use client';

/**
 * ============================================================================
 * M-EDU AI Copilot Workspace — iOS 27 / visionOS "Liquid Intelligence Studio"
 * ============================================================================
 *
 * Senior Production v2.5 Architecture:
 *  • [ssr]  Hydration-safe `useMediaQuery` via `useSyncExternalStore`.
 *  • [ux]   Smart Horizontal Dock with dynamic scroll chevrons, edge masks & category tabs.
 *  • [feat] Staged File Attachment Tray (multi-file preview, size/line telemetry & custom analysis).
 *  • [feat] Integrated Web Speech API (`uz-UZ`) Live Voice Dictation engine.
 *  • [fix]  Full modal lifecycle (`AnimatePresence`, `useFocusTrap`, `Escape`, scroll lock)
 *           for `AiLessonPlanStudio` and all studio overlays.
 *  • [perf] Zero-re-render ref guards for conversation switching & streaming exports.
 * ============================================================================
 */

import { createPortal } from 'react-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  memo,
  type CSSProperties,
  type DragEvent,
  type ChangeEvent,
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
  AiExecutiveSuperStudio,
  type StudioTabId,
  AiSocialPostStudioModal,
  AiLessonPlanStudio,
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
import { cn, usePrefersReducedMotion } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────────────────
 * Bespoke Pixel-Perfect Vector Icons (14x14 / 16x16 iOS 27 Stroke Craft)
 * ─────────────────────────────────────────────────────────────────────── */

const IconSparklePrism = memo(function IconSparklePrism({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  );
});

const IconDiagnosticPulse = memo(function IconDiagnosticPulse({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
});

const IconBloomTest = memo(function IconBloomTest({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
});

const IconMegaphoneStudio = memo(function IconMegaphoneStudio({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
});

const IconLessonBook = memo(function IconLessonBook({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
});

const IconFaceId = memo(function IconFaceId({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </svg>
  );
});

const IconChurnRadar = memo(function IconChurnRadar({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
});

const IconInventoryCube = memo(function IconInventoryCube({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
});

const IconChevronLeft = memo(function IconChevronLeft({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
});

const IconChevronRight = memo(function IconChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
});

const IconPaperclip = memo(function IconPaperclip({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
});

const IconClose = memo(function IconClose({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
});

/* ─────────────────────────────────────────────────────────────────────────
 * Constants & iOS 27 Liquid Spring Physics
 * ─────────────────────────────────────────────────────────────────────── */

const SPRING_PANEL = {
  type: 'spring' as const,
  damping: 34,
  stiffness: 380,
  mass: 0.8,
  restDelta: 0.001,
};

const SPRING_SHEET = {
  type: 'spring' as const,
  damping: 36,
  stiffness: 400,
  mass: 0.72,
  restDelta: 0.001,
};

const SPRING_GEL = {
  type: 'spring' as const,
  stiffness: 740,
  damping: 25,
  mass: 0.34,
};

type DockFilterCategory = 'all' | 'studios' | 'analytics';

interface StagedAttachment {
  id: string;
  name: string;
  sizeLabel: string;
  lineCount: number;
  content: string;
}

const DOCK_ACTIONS = [
  {
    id: 'attendance',
    label: 'Davomat',
    icon: <IconAttendance size={14} />,
    prompt: 'Bugungi davomatni ko‘rsat va tahlil qilib ber',
  },
  {
    id: 'finance',
    label: 'Moliya & Qarz',
    icon: <IconFinance size={14} />,
    prompt:
      'O‘quv markazining joriy oydagi tushumi, xarajatlari va qarzdorlik holatini ko‘rsat',
  },
  {
    id: 'biometrics',
    label: 'Face ID & Kameralar',
    icon: <IconFaceId size={14} />,
    prompt: 'Kameralar va Face ID biometrik davomat tizimi holatini tahlil qilib ber',
  },
  {
    id: 'leads',
    label: 'Lidlar',
    icon: <IconCompass size={14} />,
    prompt: 'Lidlar, konversiya darajasi va sinov darslari statistikasini ko‘rsat',
  },
  {
    id: 'churn',
    label: 'Xavf Radari',
    icon: <IconChurnRadar size={14} />,
    prompt:
      'Ketib qolish xavfi yuqori bo‘lgan o‘quvchilar ro‘yxati va saqlab qolish choralarini ko‘rsat',
  },
  {
    id: 'schedule',
    label: 'Jadval',
    icon: <IconSchedule size={14} />,
    prompt: 'Bugungi darslar jadvalini ko‘rsat',
  },
  {
    id: 'inventory',
    label: 'Ombor',
    icon: <IconInventoryCube size={14} />,
    prompt: 'Ombordagi o‘quv materiallari va tugayotgan tovarlar qoldig‘ini tekshir',
  },
  {
    id: 'report',
    label: 'Hisobot',
    icon: <IconReport size={14} />,
    prompt: 'Bugungi boshqaruv hisobotini tayyorla',
  },
] as const;

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-8' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute top-0 z-20', inset)}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/35" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-[#5AC8FA]/35 to-transparent dark:via-[#5AC8FA]/25" />
    </div>
  );
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Custom Ergonomic & SSR-Safe Hooks
 * ─────────────────────────────────────────────────────────────────────── */

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener?.('change', onStoreChange);
      return () => mq.removeEventListener?.('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    const node = ref.current;
    if (!node) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    const SELECTOR =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(SELECTOR)).filter(
        (el) =>
          !el.hasAttribute('aria-hidden') &&
          !el.closest('[aria-hidden="true"]') &&
          el.getClientRects().length > 0,
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

function useHotkeys(map: Record<string, () => void>, disabled = false): void {
  const mapRef = useRef(map);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    mapRef.current = map;
    disabledRef.current = disabled;
  }, [map, disabled]);

  useEffect(() => {
    const isEditable = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.tagName === 'SELECT' ||
        el.isContentEditable
      );
    };

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const keyLower = event.key.toLowerCase();

      if (disabledRef.current && !(mod && keyLower === 'k')) return;

      const parts: string[] = [];
      if (mod) parts.push('mod');
      if (event.shiftKey) parts.push('shift');
      if (event.altKey) parts.push('alt');
      parts.push(keyLower);

      const combo = parts.join('+');
      const handler = mapRef.current[combo];
      if (!handler) return;

      if (!mod && event.key !== 'Escape' && isEditable(event.target)) return;
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Main iOS 27 Liquid Glass Component
 * ─────────────────────────────────────────────────────────────────────── */

export function AiCopilot() {
  const { t } = useSafeI18n();
  usePageTitle(t('ai.title') || 'AI Yordamchi — M-EDU');
  const online = useOnlineStatus();
  const { routeTitle, routeContext } = useAiContextSuggestions();
  const { isDark, toggleTheme } = useTheme();
  const { preferences, setPreference } = useCopilotPreferences();
  const systemReduced = usePrefersReducedMotion();
  const isMotionReduced = Boolean(preferences.reduceMotion || systemReduced);

  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTabletUp = useMediaQuery('(min-width: 768px)');

  /* ── UI Layout & Studio States ────────────────────────────────── */
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(() => AI_MODELS[0]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [loadingConvId, setLoadingConvId] = useState<string | null>(null);
  const [isSuperStudioOpen, setIsSuperStudioOpen] = useState(false);
  const [superStudioInitialTab, setSuperStudioInitialTab] = useState<StudioTabId | undefined>(undefined);
  const [isSocialStudioOpen, setIsSocialStudioOpen] = useState(false);
  const [isLessonStudioOpen, setIsLessonStudioOpen] = useState(false);

  /* ── New Senior UX States: Smart Dock, File Staging & Voice ───── */
  const [dockCategory] = useState<DockFilterCategory>('all');
  const [canScrollDockLeft, setCanScrollDockLeft] = useState(false);
  const [canScrollDockRight, setCanScrollDockRight] = useState(true);
  const [stagedFiles, setStagedFiles] = useState<StagedAttachment[]>([]);
  const [fileFeedbackToast, setFileFeedbackToast] = useState<string | null>(null);
  const [isListeningVoice] = useState(false);

  const openSuperStudio = useCallback((tab?: StudioTabId) => {
    setSuperStudioInitialTab(tab);
    setIsSuperStudioOpen(true);
  }, []);

  const shellRef = useRef<HTMLDivElement>(null);
  const historyDrawerRef = useRef<HTMLDivElement>(null);
  const contextSheetRef = useRef<HTMLDivElement>(null);
  const lessonModalRef = useRef<HTMLDivElement>(null);
  const dockScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const latestConvReqRef = useRef<string | null>(null);
  const activeLoadingIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const sheetDragControls = useDragControls();

  const showToast = useCallback((msg: string) => {
    setFileFeedbackToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (dockScrollFrameRef.current) cancelAnimationFrame(dockScrollFrameRef.current);
    toastTimerRef.current = setTimeout(() => setFileFeedbackToast(null), 3400);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      recognitionRef.current?.stop?.();
    };
  }, []);

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

  const messagesRef = useRef<AiUiMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const hasMessages = messages.length > 0;

  const { createNew, renameConversation, deleteConversation, loadMessages } =
    useConversations();
  const { mode: aiMode } = useAiHealth();

  const isStreaming = status === 'streaming';
  const isThinking = busy && !isStreaming;

  /* ── Smart Send Wrapper (Automatically attaches staged files) ──── */
  const handleSendWithStagedFiles = useCallback(
    (userPrompt: string) => {
      if (!canSend) return;
      if (stagedFiles.length === 0) {
        send(userPrompt);
        return;
      }

      const filesPayload = stagedFiles
        .map(
          (f) =>
            `📄 **Fayl: ${f.name}** (${f.sizeLabel}, ${f.lineCount} qator):\n\`\`\`\n${f.content}\n\`\`\``,
        )
        .join('\n\n');

      const combinedPrompt = `${userPrompt.trim()}\n\n---\n${filesPayload}`;
      setStagedFiles([]);
      send(combinedPrompt);
    },
    [canSend, stagedFiles, send],
  );

  /* ── Interactive Spotlight Tracker (Zero Layout Thrashing) ────── */
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
    el.style.setProperty('--cp-spot-opacity', '1');
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

  const handleShellPointerLeave = useCallback(() => {
    shellRef.current?.style.setProperty('--cp-spot-opacity', '0');
  }, []);

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

  /* ── Quick Dock Horizontal Scroll Telemetry & Controls (RAF debounced) ── */
  const dockScrollFrameRef = useRef<number | null>(null);
  const updateDockScrollState = useCallback(() => {
    if (dockScrollFrameRef.current) return;
    dockScrollFrameRef.current = requestAnimationFrame(() => {
      dockScrollFrameRef.current = null;
      const el = dockScrollRef.current;
      if (!el) return;
      const { scrollLeft, scrollWidth, clientWidth } = el;
      const left = scrollLeft > 6;
      const right = scrollLeft + clientWidth < scrollWidth - 6;
      setCanScrollDockLeft((prev) => (prev !== left ? left : prev));
      setCanScrollDockRight((prev) => (prev !== right ? right : prev));
    });
  }, []);

  useEffect(() => {
    updateDockScrollState();
    window.addEventListener('resize', updateDockScrollState, { passive: true });
    return () => window.removeEventListener('resize', updateDockScrollState);
  }, [updateDockScrollState, dockCategory, focusMode]);

  const scrollDockBy = useCallback((delta: number) => {
    dockScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  /* ── Data & Conversation Handlers (Zero-Re-Render Ref Guarded) ── */
  const handleSelectConversation = useCallback(
    async (id: string) => {
      if (activeLoadingIdRef.current === id) return;
      latestConvReqRef.current = id;
      activeLoadingIdRef.current = id;
      setLoadingConvId(id);
      try {
        const wire = await loadMessages(id);
        if (latestConvReqRef.current !== id) return;
        const now = Date.now();
        const safeWire = Array.isArray(wire) ? wire : [];
        const ui: AiUiMessage[] = safeWire.map((message, index) => {
          const createdAt = message.createdAt
            ? new Date(message.createdAt).getTime()
            : now - (safeWire.length - index) * 60_000;
          const timestamp = message.createdAt
            ? new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : undefined;

          // Reconstruct rich tool activities from durable toolCalls and toolResult
          const toolCallsList = Array.isArray(message.toolCalls) ? (message.toolCalls as any[]) : [];
          const reconstructedActivities = toolCallsList.map((call: any, callIdx: number) => ({
            id: call.id || `call-${message.id || id}-${callIdx}`,
            toolName: call.name || call.function?.name || 'unknown',
            args:
              call.arguments ||
              (call.function?.arguments
                ? typeof call.function.arguments === 'string'
                  ? JSON.parse(call.function.arguments)
                  : call.function.arguments
                : {}),
            status: (message.toolResult ? (message.toolResult.ok ? 'success' : 'error') : 'done') as any,
            result: message.toolResult,
          }));

          const toolActivities =
            message.toolActivities ||
            (reconstructedActivities.length > 0 ? reconstructedActivities : undefined);

          return {
            id: message.id || `msg-${id}-${index}`,
            role: message.role,
            content: message.content || '',
            status: message.status,
            createdAt,
            timestamp,
            actionId: message.actionId,
            toolCalls: message.toolCalls,
            toolResult: message.toolResult,
            toolActivities,
            activities: toolActivities,
          };
        });
        hydrate(ui, safeWire, id);
      } catch {
        if (latestConvReqRef.current === id) {
          setConversationId(id);
        }
      } finally {
        if (latestConvReqRef.current === id) {
          activeLoadingIdRef.current = null;
          setLoadingConvId(null);
          setIsMobileHistoryOpen(false);
        }
      }
    },
    [loadMessages, hydrate, setConversationId],
  );

  const handleNewChat = useCallback(async () => {
    latestConvReqRef.current = null;
    activeLoadingIdRef.current = null;
    setLoadingConvId(null);
    setStagedFiles([]);
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
      try {
        await renameConversation({ id, title });
      } catch {
        showToast('Suhbat nomini saqlashda xatolik yuz berdi');
      }
    },
    [renameConversation, showToast],
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
    setStagedFiles([]);
    setClearDialogOpen(false);
  }, [clear]);

  const handleExportChat = useCallback(() => {
    if (messagesRef.current.length === 0) return;
    exportConversationToPrint(messagesRef.current, 'M-EDU AI Copilot — Suhbat Hisoboti');
  }, []);

  const handleExportMarkdown = useCallback(() => {
    if (messagesRef.current.length === 0) return;
    exportConversationToMarkdown(messagesRef.current);
  }, []);

  const handleContextAction = useCallback(
    (prompt: string) => {
      if (!canSend) return;
      setIsMobileContextOpen(false);
      if (!isDesktop) setIsContextOpen(false);
      handleSendWithStagedFiles(prompt);
    },
    [canSend, isDesktop, handleSendWithStagedFiles],
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

  /* ── Staged File Ingestion (Drag & Drop + File Picker) ────────── */
  const ingestFiles = useCallback(
    async (fileList: FileList | null | undefined) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList).slice(0, 4);
      const validAdditions: StagedAttachment[] = [];

      for (const file of files) {
        const isTextReadable =
          file.type.startsWith('text/') ||
          /\.(txt|md|csv|json|log|tsv|xml|yaml|yml)$/i.test(file.name);

        if (!isTextReadable) {
          showToast(`⚠️ "${file.name}" formati qo‘llab-quvvatlanmaydi (.txt, .csv, .md, .json tanlang)`);
          continue;
        }

        try {
          const rawText = await file.text();
          const clipped = rawText.slice(0, 10_000);
          const lineCount = clipped.split(/\r?\n/).length;
          validAdditions.push({
            id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: file.name,
            sizeLabel: formatFileSize(file.size),
            lineCount,
            content: clipped,
          });
        } catch {
          showToast(`"${file.name}" faylini o‘qib bo‘lmadi`);
        }
      }

      if (validAdditions.length > 0) {
        setStagedFiles((prev) => [...prev, ...validAdditions].slice(0, 4));
        showToast(`✅ ${validAdditions.length} ta fayl tahlil uchun tayyorlandi`);
      }
    },
    [showToast],
  );

  useEffect(() => {
    const resetDrag = () => {
      dragDepthRef.current = 0;
      setIsDraggingFile(false);
    };
    window.addEventListener('dragend', resetDrag);
    window.addEventListener('drop', resetDrag);
    return () => {
      window.removeEventListener('dragend', resetDrag);
      window.removeEventListener('drop', resetDrag);
    };
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const types = Array.from(event.dataTransfer?.types ?? []);
    if (!types.includes('Files')) return;
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (dragDepthRef.current === 0) return;
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
      await ingestFiles(event.dataTransfer?.files);
    },
    [ingestFiles],
  );

  const handleFileInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      await ingestFiles(event.target.files);
      event.target.value = '';
    },
    [ingestFiles],
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

  useBodyScrollLock(
    isMobileHistoryOpen || isMobileContextOpen || isLessonStudioOpen,
  );
  useFocusTrap(isMobileHistoryOpen, historyDrawerRef, () =>
    setIsMobileHistoryOpen(false),
  );
  useFocusTrap(isMobileContextOpen, contextSheetRef, () =>
    setIsMobileContextOpen(false),
  );
  useFocusTrap(isLessonStudioOpen, lessonModalRef, () =>
    setIsLessonStudioOpen(false),
  );

  const hasAnyModalOpen =
    commandOpen ||
    clearDialogOpen ||
    isSuperStudioOpen ||
    isSocialStudioOpen ||
    isLessonStudioOpen ||
    isMobileHistoryOpen ||
    isMobileContextOpen;

  /* ── Complete Hotkey Matrix ───────────────────────────────────── */
  useHotkeys(
    {
      'mod+k': () => setCommandOpen((prev) => !prev),
      'mod+b': handleToggleHistory,
      'mod+i': handleToggleContext,
      'mod+.': () => setFocusMode((prev) => !prev),
      'mod+shift+o': () => void handleNewChat(),
      'mod+shift+e': handleExportChat,
      'mod+shift+m': handleExportMarkdown,
      'mod+shift+backspace': () => {
        if (messagesRef.current.length > 0) setClearDialogOpen(true);
      },
      escape: () => {
        if (busy) stop();
        else if (focusMode) setFocusMode(false);
      },
    },
    hasAnyModalOpen,
  );

  /* ── Gesture Drag Dismiss Handlers ────────────────────────────── */
  const onHistoryDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.x < -70 || info.velocity.x < -360) {
      setIsMobileHistoryOpen(false);
    }
  }, []);

  const onSheetDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    if (info.offset.y > 90 || info.velocity.y > 440) {
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
        id: 'super-studio',
        label: 'AI Super Studio',
        hint: 'Ilg‘or analitika va boshqaruv shablonlari',
        group: 'Amallar',
        icon: <IconSparklePrism size={14} />,
        run: () => openSuperStudio(),
      },
      {
        id: 'studio-diagnostic',
        label: 'O‘quvchi 360° Diagnostikasi',
        hint: 'Akademik salomatlik, SWOT va ota-onaga xabar',
        group: 'Amallar',
        icon: <IconDiagnosticPulse size={14} />,
        run: () => openSuperStudio('diagnostic'),
      },
      {
        id: 'studio-quiz',
        label: 'Bloom Test & Dars Rejasi',
        hint: '45 daqiqalik konspekt va nazorat testlari',
        group: 'Amallar',
        icon: <IconBloomTest size={14} />,
        run: () => openSuperStudio('quiz'),
      },
      {
        id: 'social-studio',
        label: 'SMM E’lon Studiyasi',
        hint: 'Telegram va Instagram uchun 3 xil yuqori konversiyali e’lon',
        group: 'Amallar',
        icon: <IconMegaphoneStudio size={14} />,
        run: () => setIsSocialStudioOpen(true),
      },
      {
        id: 'lesson-studio',
        label: '5-Bosqichli Dars Rejasi Studiyasi',
        hint: 'Kirish, nazariya, amaliyot, test va uy vazifasi',
        group: 'Amallar',
        icon: <IconLessonBook size={14} />,
        run: () => setIsLessonStudioOpen(true),
      },
      {
        id: 'attach-file',
        label: 'Fayl biriktirish (.txt, .csv, .md, .json)',
        hint: 'Ma’lumotlar bazasi yoki hisobot faylini tahlil qilish',
        group: 'Amallar',
        icon: <IconPaperclip size={14} />,
        run: () => fileInputRef.current?.click(),
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
        hint: isHistoryCollapsed ? 'Chap panelni yoyish' : 'Chap panelni yig‘ish',
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
        label: isDark ? 'Yorug‘ rejimga o‘tish' : 'Qorong‘i rejimga o‘tish',
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
      ...(hasMessages
        ? [
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
              hint: 'Joriy suhbat tarixini butunlay o‘chirish',
              group: 'Amallar',
              shortcut: '⌘⇧⌫',
              icon: <IconTrash size={14} />,
              run: () => setClearDialogOpen(true),
            },
          ]
        : []),
    ];

    const quickPrompts: CopilotCommand[] = DOCK_ACTIONS.map((item) => ({
      id: `prompt-${item.id}`,
      label: `${item.label} tahlili`,
      hint: item.prompt,
      group: 'Tezkor so‘rovlar',
      icon: item.icon,
      run: () => canSend && handleSendWithStagedFiles(item.prompt),
    }));

    const modelSwitchers: CopilotCommand[] = AI_MODELS.map((model) => ({
      id: `model-${model.id}`,
      label: `Model: ${model.label}`,
      hint:
        selectedModel.id === model.id
          ? '✓ Hozir faol model'
          : model.description || 'Ushbu AI modelga o‘tish',
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
    hasMessages,
    handleNewChat,
    handleToggleHistory,
    handleToggleContext,
    handleExportChat,
    handleExportMarkdown,
    canSend,
    handleSendWithStagedFiles,
    selectedModel.id,
    openSuperStudio,
  ]);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div
      ref={shellRef}
      onPointerEnter={handleShellPointerEnter}
      onPointerMove={handleShellPointerMove}
      onPointerLeave={handleShellPointerLeave}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-busy={busy ? 'true' : 'false'}
      data-thinking={isThinking ? 'true' : 'false'}
      style={
        {
          '--cp-spot-x': '50%',
          '--cp-spot-y': '25%',
          '--cp-spot-opacity': '0',
        } as CSSProperties
      }
      className={cn(
        'cp-shell relative isolate flex h-full min-h-0 w-full min-w-0 flex-1 select-none overflow-hidden sm:select-auto',
        copilotComfortClass(preferences),
      )}
    >
      {/* Hidden File Input for Manual Attachment Button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.csv,.json,.log,.tsv,.xml,.yaml,.yml,text/*"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* ── 1. Spatial Aurora Ambient Layer + Interactive Caustic Spotlight ── */}
      <div aria-hidden="true" className="cp-aurora">
        <div className="cp-aurora__blob cp-aurora__blob--a" />
        <div className="cp-aurora__blob cp-aurora__blob--b" />
        <div className="cp-aurora__blob cp-aurora__blob--c" />
        <div className="cp-aurora__grain" />
      </div>

      {/* ── 2. Drag-and-Drop File Liquid Glass Overlay ────────────── */}
      <AnimatePresence>
        {isDraggingFile && (
          <motion.div
            key="drop-zone"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="cp-glass--floating pointer-events-none absolute inset-3 z-[180] flex flex-col items-center justify-center overflow-hidden rounded-[var(--cp-radius-xl)] border-2 border-dashed border-[color:var(--cp-accent)] backdrop-blur-3xl"
          >
            <TopSpecular inset="inset-x-10" />
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--cp-accent)]/15 text-[color:var(--cp-accent)] shadow-inner">
              <IconPaperclip size={26} />
            </div>
            <div className="cp-badge cp-badge--accent mb-2 px-3 py-1 text-xs font-semibold">
              M-EDU AI Smart Dropzone
            </div>
            <p className="text-base font-bold text-[color:var(--cp-text)]">
              Tahlil qilish uchun fayllarni shu yerga tashlang
            </p>
            <p className="mt-1 text-xs text-[color:var(--cp-text-tertiary)]">
              4 tagacha .txt, .md, .csv, .json yoki .log fayllarni biriktirish mumkin
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
        aria-busy={busy || Boolean(loadingConvId)}
        className={cn(
          'relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-hidden transition-all duration-500',
          (busy || isListeningVoice) && 'apple-intelligence-aura',
        )}
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
          onExportChat={hasMessages ? handleExportChat : undefined}
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

        {/* Conversation Switching Top Liquid Progress Indicator */}
        <AnimatePresence>
          {loadingConvId && (
            <motion.div
              key="conv-loading-bar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-30 h-0.5 w-full overflow-hidden bg-indigo-500/15"
            >
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                className="h-full w-1/2 bg-gradient-to-r from-transparent via-indigo-500 to-sky-400"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Floating Status Bar: Offline Warning, Toast & Focus Mode Pill */}
        <AnimatePresence>
          {(!online || focusMode || fileFeedbackToast) && (
            <motion.div
              key="status-bar"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="pointer-events-none absolute inset-x-0 top-16 z-30 flex flex-wrap items-center justify-center gap-2 px-4"
            >
              {!online && (
                <div
                  role="status"
                  className="cp-badge pointer-events-auto border-[color:var(--cp-danger-bright)] bg-[color:var(--cp-surface-floating)] px-3 py-1 text-xs text-[color:var(--cp-danger-bright)] shadow-[var(--cp-shadow-2)] backdrop-blur-2xl"
                >
                  <span className="cp-live-dot cp-live-dot--offline mr-1" />
                  Oflayn rejim — internet aloqasi kutilmoqda
                </div>
              )}

              {fileFeedbackToast && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.94 }}
                  role="status"
                  className="cp-badge pointer-events-auto border-indigo-500/35 bg-white/90 dark:bg-zinc-900/90 px-3.5 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-100 shadow-lg backdrop-blur-2xl"
                >
                  {fileFeedbackToast}
                </motion.div>
              )}

              {focusMode && (
                <motion.button
                  type="button"
                  whileTap={
                    isMotionReduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }
                  }
                  transition={SPRING_GEL}
                  onClick={() => setFocusMode(false)}
                  className="cp-badge cp-badge--accent cp-hover-lift pointer-events-auto cursor-pointer px-3.5 py-1.5 min-h-10 sm:min-h-[32px] inline-flex items-center text-xs shadow-[var(--cp-shadow-2)] backdrop-blur-2xl touch-manipulation"
                  title="Diqqat rejimidan chiqish (⌘.)"
                >
                  <span>Diqqat rejimi faol</span>
                  <kbd className="cp-kbd ml-1">⌘.</kbd>
                </motion.button>
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
            onPickPrompt={(text) => canSend && handleSendWithStagedFiles(text)}
            onRetry={retry}
            onConfirm={confirm}
            onReject={reject}
            onDismissActionError={dismissActionError}
            isStreaming={isStreaming}
          />
        </div>

        {/* ── Staged File Attachments Tray (Liquid Glass Inspection Bar) ── */}
        <AnimatePresence>
          {stagedFiles.length > 0 && (
            <motion.div
              key="staged-files-tray"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={SPRING_PANEL}
              className="relative z-20 mx-3 mb-2 rounded-2xl border border-indigo-500/30 bg-white/85 dark:bg-zinc-900/85 p-2.5 shadow-lg backdrop-blur-2xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <IconPaperclip size={13} />
                  <span>Biriktirilgan fayllar ({stagedFiles.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() =>
                      handleSendWithStagedFiles(
                        'Biriktirilgan fayl(lar)ni chuqur tahlil qilib, asosiy ko‘rsatkichlar, xulosalar va amaliy tavsiyalarni chiqarib ber.',
                      )
                    }
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 min-h-[38px] tap-extend text-[11px] font-bold text-white shadow-xs transition-all active:scale-95"
                  >
                    ⚡ Chuqur tahlil qilish
                  </button>
                  <button
                    type="button"
                    disabled={!canSend}
                    onClick={() =>
                      handleSendWithStagedFiles(
                        'Ushbu fayl ma’lumotlari asosida tartibli jadval va qisqa rahbariyat hisobotini shakllantirib ber.',
                      )
                    }
                    className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50 px-3 py-1.5 min-h-[38px] tap-extend text-[11px] font-semibold text-indigo-700 dark:text-indigo-200 transition-all"
                  >
                    📊 Jadval & Hisobot
                  </button>
                  <button
                    type="button"
                    onClick={() => setStagedFiles([])}
                    className="rounded-lg px-2.5 py-1.5 min-h-[38px] tap-extend text-[11px] font-medium text-zinc-500 hover:text-rose-600 transition-colors"
                  >
                    Tozalash
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/70 px-3 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-800 dark:text-zinc-100 truncate max-w-[160px]">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {file.sizeLabel} • {file.lineCount} qator
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setStagedFiles((prev) => prev.filter((item) => item.id !== file.id))
                      }
                      aria-label={`${file.name} faylini olib tashlash`}
                      className="rounded-full p-1.5 min-h-[36px] min-w-[36px] tap-extend flex items-center justify-center text-zinc-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                    >
                      <IconClose size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Spatial Quick Dock (Clean Minimal Single-Tier) ── */}
        <div className="relative z-10 shrink-0 px-3 pb-1.5">
          <div className="relative flex items-center">
            {canScrollDockLeft && (
              <button
                type="button"
                onClick={() => scrollDockBy(-260)}
                aria-label="Chapga surish"
                className="hidden sm:flex absolute left-0 z-20 h-7 w-7 min-h-[32px] min-w-[32px] items-center justify-center rounded-full border border-[color:var(--cp-hairline-strong)] bg-white/95 dark:bg-zinc-900/95 text-[color:var(--cp-text)] shadow-sm backdrop-blur-xl hover:scale-105 active:scale-95 transition-all"
              >
                <IconChevronLeft size={13} />
              </button>
            )}

            <div
              ref={dockScrollRef}
              onScroll={updateDockScrollState}
              className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none scroll-smooth px-0.5"
              role="group"
              aria-label="Tezkor amallar"
            >
              {/* STUDIO LAUNCHERS */}
              {(dockCategory === 'all' || dockCategory === 'studios') && (
                <>
                  <motion.button
                    type="button"
                whileTap={isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }}
                transition={SPRING_GEL}
                onClick={() => openSuperStudio()}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all min-h-[34px] touch-manipulation',
                  'border-indigo-500/40 bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-pink-500/15',
                  'text-indigo-700 shadow-2xs hover:border-indigo-500/70',
                  'dark:border-indigo-400/45 dark:from-indigo-500/25 dark:via-purple-500/20 dark:to-pink-500/20 dark:text-indigo-200 dark:hover:border-indigo-400',
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-300">
                  <IconSparklePrism size={11} />
                </span>
                <span>AI Super Studio</span>
              </motion.button>

                                    <motion.button
                    type="button"
                    whileTap={
                      isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }
                    }
                    transition={SPRING_GEL}
                    onClick={() => openSuperStudio('scenario')}
                    className="cp-dock__chip flex items-center gap-1.5 border-amber-500/35 text-amber-700 hover:border-amber-500/65 dark:border-amber-400/40 dark:text-amber-300 min-h-10 sm:min-h-[36px] touch-manipulation"
                  >
                    <IconDiagnosticPulse size={14} />
                    <span>What-If Ssenariy</span>
                  </motion.button>
<motion.button
                    type="button"
                    whileTap={
                      isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }
                    }
                    transition={SPRING_GEL}
                    onClick={() => openSuperStudio('diagnostic')}
                    className="cp-dock__chip flex items-center gap-1.5 border-emerald-500/35 text-emerald-700 hover:border-emerald-500/65 dark:border-emerald-400/40 dark:text-emerald-300 min-h-10 sm:min-h-[36px] touch-manipulation"
                  >
                    <IconDiagnosticPulse size={14} />
                    <span>360° Diagnostika</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={
                      isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }
                    }
                    transition={SPRING_GEL}
                    onClick={() => openSuperStudio('quiz')}
                    className="cp-dock__chip flex items-center gap-1.5 border-violet-500/35 text-violet-700 hover:border-violet-500/65 dark:border-violet-400/40 dark:text-violet-300 min-h-10 sm:min-h-[36px] touch-manipulation"
                  >
                    <IconBloomTest size={14} />
                    <span>Bloom Test</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={
                      isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }
                    }
                    transition={SPRING_GEL}
                    onClick={() => setIsSocialStudioOpen(true)}
                    className="cp-dock__chip flex items-center gap-1.5 border-rose-500/35 text-rose-700 hover:border-rose-500/65 dark:border-rose-400/40 dark:text-rose-300 min-h-10 sm:min-h-[36px] touch-manipulation"
                  >
                    <IconMegaphoneStudio size={14} />
                    <span>SMM E’lon</span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={
                      isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }
                    }
                    transition={SPRING_GEL}
                    onClick={() => setIsLessonStudioOpen(true)}
                    className="cp-dock__chip flex items-center gap-1.5 border-sky-500/35 text-sky-700 hover:border-sky-500/65 dark:border-sky-400/40 dark:text-sky-300 min-h-10 sm:min-h-[36px] touch-manipulation"
                  >
                    <IconLessonBook size={14} />
                    <span>Dars Rejasi V2</span>
                  </motion.button>
                </>
              )}

              {/* ANALYTICS QUICK PROMPTS */}
              {(dockCategory === 'all' || dockCategory === 'analytics') &&
                DOCK_ACTIONS.map((action) => (
                  <motion.button
                    key={action.id}
                    type="button"
                    disabled={!canSend}
                    whileTap={
                      isMotionReduced || !canSend
                        ? undefined
                        : { scaleX: 1.04, scaleY: 0.93 }
                    }
                    transition={SPRING_GEL}
                    onClick={() => handleSendWithStagedFiles(action.prompt)}
                    className="cp-dock__chip disabled:opacity-45 min-h-10 sm:min-h-[36px] touch-manipulation"
                  >
                    <span aria-hidden="true" className="text-[color:var(--cp-accent)]">
                      {action.icon}
                    </span>
                    {action.label}
                  </motion.button>
                ))}

              <motion.button
                type="button"
                whileTap={
                  isMotionReduced ? undefined : { scaleX: 1.04, scaleY: 0.93 }
                }
                transition={SPRING_GEL}
                onClick={() => setCommandOpen(true)}
                className="cp-dock__chip min-h-10 sm:min-h-[36px] touch-manipulation"
                aria-label="Barcha buyruqlar (⌘K)"
              >
                <span aria-hidden="true" className="text-[color:var(--cp-accent)]">
                  <IconPlus size={14} />
                </span>
                <span>Buyruqlar</span>
                <kbd className="cp-kbd ml-1 hidden sm:inline-block text-[10px]">⌘K</kbd>
              </motion.button>
            </div>

            {canScrollDockRight && (
              <button
                type="button"
                onClick={() => scrollDockBy(260)}
                aria-label="O‘ngga surish"
                className="hidden sm:flex absolute right-0 z-20 h-9 w-9 min-h-[44px] min-w-[44px] tap-extend items-center justify-center rounded-full border border-[color:var(--cp-hairline-strong)] bg-white/90 dark:bg-zinc-900/90 text-[color:var(--cp-text)] shadow-md backdrop-blur-xl hover:scale-105 active:scale-95 transition-all"
              >
                <IconChevronRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* AI Composer Input */}
        <AiComposer
          status={status}
          onSend={handleSendWithStagedFiles}
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

      {/* ── 6. Mobile History Drawer (Left Liquid Glass Slide-Over) ─ */}
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
              dragSnapToOrigin
              dragConstraints={{ left: -320, right: 0 }}
              dragElastic={{ left: 0.12, right: 0.04 }}
              onDragEnd={onHistoryDragEnd}
              className="cp-glass--floating fixed inset-y-0 left-0 z-[165] flex w-[min(86vw,20.5rem)] flex-col overflow-hidden border-r border-[color:var(--cp-hairline-strong)] md:hidden"
            >
              <TopSpecular inset="inset-x-6" />
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
              dragSnapToOrigin
              dragConstraints={{ top: 0, bottom: 420 }}
              dragElastic={{ top: 0.04, bottom: 0.18 }}
              onDragEnd={onSheetDragEnd}
              className="cp-glass--floating cp-specular fixed inset-x-0 bottom-0 z-[165] flex max-h-[86dvh] flex-col overflow-hidden rounded-t-[28px] border-t border-[color:var(--cp-hairline-strong)] lg:hidden"
              style={{
                paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
              }}
            >
              <TopSpecular inset="inset-x-8" />
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

      {/* ── 9. Executive Super Studio Modal ──────────────────────── */}
      <AiExecutiveSuperStudio
        isOpen={isSuperStudioOpen}
        initialTab={superStudioInitialTab}
        onClose={() => setIsSuperStudioOpen(false)}
        onInsertPrompt={(p) => {
          setIsSuperStudioOpen(false);
          if (canSend) {
            handleSendWithStagedFiles(p);
          }
        }}
      />

      {/* ── 9.1 SMM Announcement Studio Modal (Contextual Default) ─ */}
      <AiSocialPostStudioModal
        isOpen={isSocialStudioOpen}
        defaultTopic={routeTitle && routeTitle !== 'AI Copilot' ? routeTitle : ''}
        onClose={() => setIsSocialStudioOpen(false)}
      />

      {/* ── 9.2 Pedagogical Lesson Plan Studio Modal (Full Motion & Focus Trap) ─ */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isLessonStudioOpen && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="5-Bosqichli Dars Rejasi Studiyasi"
              className="fixed inset-0 z-[220] flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto"
            >
              <motion.div
                key="lesson-studio-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setIsLessonStudioOpen(false)}
                className="fixed inset-0 bg-zinc-950/65 backdrop-blur-md"
                aria-hidden="true"
              />
              <motion.div
                key="lesson-studio-dialog"
                ref={lessonModalRef}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={SPRING_PANEL}
                className="relative z-10 w-full max-w-5xl rounded-[28px] bg-white/95 dark:bg-zinc-900/95 border border-white/25 dark:border-white/10 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.45)] backdrop-blur-2xl overflow-hidden max-h-[92vh] flex flex-col focus:outline-none"
              >
                <TopSpecular inset="inset-x-10" />
                <AiLessonPlanStudio onClose={() => setIsLessonStudioOpen(false)} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── 10. Clear Chat Confirmation Dialog ───────────────────── */}
      <ConfirmDialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        onConfirm={handleClearConfirm}
        title={t('ai.clearChatTitle') || 'Chatni tozalash'}
        description={
          t('ai.clearChatDescription') ||
          'Suhbat tarixi tozalansinmi? Bu amalni ortga qaytarib bo‘lmaydi.'
        }
        confirmLabel={t('common.clear') || 'Tozalash'}
        cancelLabel={t('common.cancel') || 'Bekor qilish'}
        tone="danger"
      />
    </div>
  );
}

export default AiCopilot;