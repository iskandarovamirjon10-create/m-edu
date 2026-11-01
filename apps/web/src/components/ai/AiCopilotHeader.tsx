/**
 * AiCopilotHeader — iOS 27 Liquid Glass command bar.
 * ============================================================================
 * - Identity bar (brand, live presence, model) sits on its own glass surface.
 * - Adaptive actions: mobile keeps only what fits (history, context, new),
 *   desktop reveals search, export, view mode and comfort controls.
 * - Full a11y: menu roles, roving focus, Escape restore, typeahead, live
 *   status announcements and 44px touch targets.
 * - Day/night: every surface is driven by `--cp-*` tokens; no hard-coded
 *   light-only backgrounds.
 * ============================================================================
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  IconChevronDown,
  IconClose,
  IconCompass,
  IconDownload,
  IconHistory,
  IconModels,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSidebarCollapse,
  IconSidebarExpand,
  IconSliders,
  IconSun,
  IconTrash,
} from './copilotIcons';
import {
  CopilotButton,
  CopilotIconButton,
  CopilotKbd,
  CopilotSegmented,
  CopilotStatusDot,
} from './CopilotControls';
import { cn } from '@/lib/design';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { CopilotPreferences } from '@/hooks/useCopilotPreferences';

/* ─────────────────────────────────────────────────────────────────────────
 * Utilities
 * ─────────────────────────────────────────────────────────────────────── */

function tr(t: (key: string) => string, key: string, fallback: string): string {
  try {
    const value = t(key);
    return !value || value === key ? fallback : value;
  } catch {
    return fallback;
  }
}

function haptic(kind: 'tap' | 'success' | 'warning' = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    const pattern: Record<'tap' | 'success' | 'warning', number | number[]> = {
      tap: 8,
      success: [10, 28, 10],
      warning: 18,
    };
    navigator.vibrate(pattern[kind]);
  } catch {
    /* noop */
  }
}

function useOutsidePointer(ref: RefObject<HTMLElement | null>, handler: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) handler();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [ref, handler, active]);
}

/* ─────────────────────────────────────────────────────────────────────────
 * Models
 * ─────────────────────────────────────────────────────────────────────── */

export interface ModelOption {
  id: string;
  label: string;
  badge: string;
  description?: string;
}

export const AI_MODELS: ModelOption[] = [
  {
    id: 'medu-flash',
    label: 'M-EDU Flash',
    badge: 'Tezkor',
    description: "Kundalik savollar va tezkor ma'lumot so'rovlari",
  },
  {
    id: 'medu-pro',
    label: 'M-EDU Pro',
    badge: 'Chuqur',
    description: 'Murakkab tahlil, hisobot va rejalashtirish',
  },
  {
    id: 'medu-reason',
    label: 'M-EDU Reason',
    badge: 'Mantiq',
    description: "Bosqichma-bosqich mantiqiy va matematik tahlil",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
 * Model menu
 * ─────────────────────────────────────────────────────────────────────── */

function ModelMenu({
  id,
  open,
  selected,
  onSelect,
  onClose,
  triggerRef,
}: {
  id: string;
  open: boolean;
  selected: ModelOption;
  onSelect: (model: ModelOption) => void;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const index = AI_MODELS.findIndex((model) => model.id === selected.id);
    setActiveIndex(index >= 0 ? index : 0);
  }, [open, selected.id]);

  useEffect(() => {
    if (open) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = AI_MODELS.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % count);
        return;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => (index - 1 + count) % count);
        return;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        return;
      case 'End':
        event.preventDefault();
        setActiveIndex(count - 1);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        onClose();
        triggerRef.current?.focus();
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const model = AI_MODELS[activeIndex];
        if (model) {
          onSelect(model);
          onClose();
          triggerRef.current?.focus();
        }
        return;
      }
      case 'Tab':
        onClose();
        return;
      default:
        if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
          const query = event.key.toLowerCase();
          for (let step = 1; step <= count; step += 1) {
            const index = (activeIndex + step) % count;
            if (AI_MODELS[index].label.toLowerCase().startsWith(query)) {
              event.preventDefault();
              setActiveIndex(index);
              break;
            }
          }
        }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          role="menu"
          aria-label="Model tanlash"
          aria-orientation="vertical"
          onKeyDown={onKeyDown}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'absolute left-0 top-full z-50 mt-2 w-[19rem] overflow-hidden p-1.5',
            'cp-dialog',
          )}
        >
          <div className="px-2.5 pb-1.5 pt-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--cp-text-tertiary)]">
            Neyro model
          </div>
          {AI_MODELS.map((model, index) => {
            const isSelected = model.id === selected.id;
            return (
              <button
                key={model.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                tabIndex={index === activeIndex ? 0 : -1}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => {
                  haptic('tap');
                  onSelect(model);
                  onClose();
                  triggerRef.current?.focus();
                }}
                className={cn(
                  'group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left outline-none transition-colors duration-150',
                  'focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent-line)]',
                  isSelected
                    ? 'bg-[color:var(--cp-accent-soft)]'
                    : 'hover:bg-[color:var(--cp-surface-sunken)]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] border',
                    isSelected
                      ? 'border-[color:var(--cp-accent-line)] bg-[color:var(--cp-accent)] text-white'
                      : 'border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)] text-[color:var(--cp-text-tertiary)]',
                  )}
                >
                  <IconModels size={14} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-[12.5px] font-semibold',
                        isSelected ? 'text-[color:var(--cp-accent)]' : 'text-[color:var(--cp-text)]',
                      )}
                    >
                      {model.label}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
                        isSelected
                          ? 'bg-[color:var(--cp-accent)] text-white'
                          : 'bg-[color:var(--cp-surface-sunken)] text-[color:var(--cp-text-tertiary)]',
                      )}
                    >
                      {model.badge}
                    </span>
                  </span>
                  {model.description && (
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-[color:var(--cp-text-tertiary)]">
                      {model.description}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Comfort menu
 * ─────────────────────────────────────────────────────────────────────── */

export interface AiCopilotHeaderProps {
  online: boolean;
  busy: boolean;
  /**
   * Provider readiness: `fallback` means the answers come from the
   * deterministic database engine, not the language model.
   */
  mode?: 'live' | 'fallback' | 'offline';
  suggestionsActive?: boolean;
  onNewChat?: () => void;
  onToggleSuggestions?: () => void;
  onClear?: () => void;
  contextBadge?: string;
  assistantName?: string;
  messageCount?: number;
  tokens?: number;
  selectedModel?: ModelOption;
  onSelectModel?: (model: ModelOption) => void;
  onOpenHistoryDrawer?: () => void;
  onOpenContextDrawer?: () => void;
  onOpenSearch?: () => void;
  onExportChat?: () => void;
  isHistoryCollapsed?: boolean;
  onToggleHistory?: () => void;
  isContextOpen?: boolean;
  onToggleContext?: () => void;
  viewMode?: 'full' | 'split' | 'drawer';
  onChangeViewMode?: (mode: 'full' | 'split' | 'drawer') => void;
  /** Day/night quick switch. */
  isDark?: boolean;
  onToggleTheme?: () => void;
  /** Persisted comfort preferences (density / motion / sound). */
  preferences?: CopilotPreferences;
  onPreferenceChange?: <K extends keyof CopilotPreferences>(
    key: K,
    value: CopilotPreferences[K],
  ) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export function AiCopilotHeader({
  online,
  busy,
  mode,
  suggestionsActive,
  onNewChat,
  onToggleSuggestions,
  onClear,
  onExportChat,
  contextBadge,
  assistantName,
  messageCount,
  tokens,
  selectedModel = AI_MODELS[0],
  onSelectModel,
  onOpenHistoryDrawer,
  onOpenContextDrawer,
  onOpenSearch,
  isHistoryCollapsed = false,
  onToggleHistory,
  isContextOpen = false,
  onToggleContext,
  viewMode = 'full',
  onChangeViewMode,
  isDark = false,
  onToggleTheme,
  preferences,
  onPreferenceChange,
  focusMode = false,
  onToggleFocusMode,
}: AiCopilotHeaderProps) {
  const { t } = useSafeI18n();
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [comfortOpen, setComfortOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const comfortRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const statusId = useId();

  useOutsidePointer(menuRef, () => setModelMenuOpen(false), modelMenuOpen);
  useOutsidePointer(comfortRef, () => setComfortOpen(false), comfortOpen);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModelMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modelMenuOpen]);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.shiftKey || event.altKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (event.target as HTMLElement | null)?.isContentEditable) return;
      const key = event.key.toLowerCase();
      if (key === 'n' && onNewChat) {
        event.preventDefault();
        onNewChat();
      } else if (key === 'k' && onOpenSearch) {
        event.preventDefault();
        onOpenSearch();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onNewChat, onOpenSearch]);

  const contextActive = isContextOpen || suggestionsActive;
  const reachable = online && mode !== 'offline';
  const statusText = !reachable
    ? tr(t, 'ai.status.offline', 'Oflayn')
    : busy
      ? tr(t, 'ai.status.busy', 'Javob tayyorlanmoqda…')
      : mode === 'fallback'
        ? tr(t, 'ai.status.fallback', 'Bazaviy rejim')
        : 'AI yordamchi';
  const statusAria = !reachable
    ? 'Oflayn'
    : busy
      ? 'AI ishlamoqda'
      : mode === 'fallback'
        ? 'Bazaviy rejim: model kaliti sozlanmagan'
        : 'AI onlayn';
  const metaLabel =
    messageCount !== undefined && tokens !== undefined
      ? `${messageCount} xabar, ${tokens} token`
      : messageCount !== undefined
        ? `${messageCount} xabar`
        : `${tokens ?? 0} token`;

  const density = preferences?.density ?? 'comfortable';
  const reduceMotion = preferences?.reduceMotion ?? false;
  const sound = preferences?.sound ?? true;

  return (
    <header
      role="banner"
      aria-label={tr(t, 'ai.header.aria', 'AI suhbat boshqaruv paneli')}
      className={cn(
        'relative z-30 shrink-0 px-2.5 pt-2.5 sm:px-4 sm:pt-3.5',
        // Day/night header veil — the aurora stays visible behind the bar.
        'bg-transparent',
        'backdrop-blur-xl',
      )}
    >
      <div id={statusId} aria-live="polite" aria-atomic="true" className="sr-only">
        {`${assistantName || 'M-EDU AI Copilot'}: ${statusAria}`}
      </div>

      {/* Identity command bar — the glass surface itself. */}
      <div
        className={cn(
          'cp-header-bar mx-auto flex max-w-[1400px] items-center justify-between gap-2 rounded-[20px] px-2 py-1.5 sm:gap-3 sm:px-2.5',
          'bg-[var(--bg-card)]',
          'border border-[color:var(--cp-hairline)] shadow-[var(--cp-shadow-1)]',
          'backdrop-blur-2xl backdrop-saturate-150',
        )}
        style={{ background: 'color-mix(in srgb, var(--cp-surface-raised) 84%, transparent)' }}
      >
        {/* ── LEFT ─────────────────────────────────────────────────── */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          {onOpenHistoryDrawer && (
            <CopilotIconButton
              label={tr(t, 'ai.history.openDrawer', 'Tarixni ochish')}
              icon={<IconHistory size={17} />}
              onClick={() => {
                haptic('tap');
                onOpenHistoryDrawer();
              }}
              className="md:hidden"
            />
          )}

          {onToggleHistory && (
            <CopilotIconButton
              label={
                isHistoryCollapsed
                  ? tr(t, 'ai.history.expand', 'Tarixni yoyish')
                  : tr(t, 'ai.history.collapse', "Tarixni yig'ish")
              }
              icon={isHistoryCollapsed ? <IconSidebarExpand size={17} /> : <IconSidebarCollapse size={17} />}
              onClick={() => {
                haptic('tap');
                onToggleHistory();
              }}
              className="hidden md:inline-flex"
            />
          )}

          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className={cn(
                'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] text-white sm:h-9 sm:w-9',
                'shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_8px_20px_-8px_rgba(10,132,255,0.7)]',
                'ring-1 ring-white/25',
              )}
              style={{ background: 'var(--cp-brand-gradient)' }}
            >
              <MeduAiLogo size="xs" />
            </span>

            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[13px] font-semibold tracking-[-0.015em] text-[color:var(--cp-text)] sm:text-sm">
                {assistantName || 'M-EDU AI Copilot'}
              </span>
              <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-[color:var(--cp-text-tertiary)]">
                <CopilotStatusDot online={reachable} label={statusAria} />
                <span className="truncate">{statusText}</span>
              </span>
            </div>
          </div>

          {onSelectModel && (
            <div ref={menuRef} className="relative ml-0.5 hidden sm:block">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => {
                  haptic('tap');
                  setModelMenuOpen((value) => !value);
                }}
                onKeyDown={(event) => {
                  if (!modelMenuOpen && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setModelMenuOpen(true);
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={modelMenuOpen}
                aria-controls={modelMenuOpen ? menuId : undefined}
                className={cn(
                  'group inline-flex h-8 items-center gap-1.5 rounded-[11px] border px-2',
                  'border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)]',
                  'text-[11px] font-semibold text-[color:var(--cp-text-secondary)]',
                  'transition-all duration-200 hover:border-[color:var(--cp-accent-line)] hover:text-[color:var(--cp-text)]',
                  'outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cp-accent-line)]',
                  modelMenuOpen && 'border-[color:var(--cp-accent-line)] text-[color:var(--cp-text)]',
                )}
              >
                <IconModels size={13} className="text-[color:var(--cp-accent)]" />
                <span className="max-w-[7.5rem] truncate">{selectedModel.label}</span>
                <span className="rounded-[6px] bg-[color:var(--cp-accent-soft)] px-1 py-px text-[8.5px] font-bold uppercase tracking-wider text-[color:var(--cp-accent)]">
                  {selectedModel.badge}
                </span>
                <IconChevronDown
                  size={12}
                  className={cn('opacity-60 transition-transform duration-200', modelMenuOpen && 'rotate-180')}
                />
              </button>

              <ModelMenu
                id={menuId}
                open={modelMenuOpen}
                selected={selectedModel}
                onSelect={(model) => onSelectModel(model)}
                onClose={() => setModelMenuOpen(false)}
                triggerRef={triggerRef}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT ────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          {onOpenSearch && (
            <CopilotIconButton
              label={tr(t, 'ai.search', 'Qidirish')}
              icon={<IconSearch size={17} />}
              onClick={() => {
                haptic('tap');
                onOpenSearch();
              }}
              className="hidden sm:inline-flex"
            />
          )}

          {contextBadge && (
            <span className="hidden max-w-[9rem] truncate rounded-full border border-[color:var(--cp-accent-line)] bg-[color:var(--cp-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--cp-accent)] xl:inline-flex">
              {contextBadge}
            </span>
          )}

          {(messageCount !== undefined || tokens !== undefined) && (
            <span
              aria-label={metaLabel}
              className="hidden items-center gap-1.5 rounded-full border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--cp-text-tertiary)] lg:inline-flex"
            >
              {messageCount !== undefined && (
                <span>
                  <span className="font-semibold text-[color:var(--cp-text-secondary)]">
                    {messageCount.toLocaleString()}
                  </span>{' '}
                  {tr(t, 'ai.meta.messages', 'ta xabar')}
                </span>
              )}
              {messageCount !== undefined && tokens !== undefined && (
                <span aria-hidden="true" className="opacity-40">·</span>
              )}
              {tokens !== undefined && (
                <span>
                  <span className="font-semibold text-[color:var(--cp-text-secondary)]">
                    {tokens.toLocaleString()}
                  </span>{' '}
                  {tr(t, 'ai.meta.tokens', 'token')}
                </span>
              )}
            </span>
          )}

          {onChangeViewMode && (
            <CopilotSegmented
              ariaLabel={tr(t, 'ai.viewMode', "Ko'rinish rejimi")}
              className="hidden xl:inline-flex"
              value={viewMode}
              onChange={(mode) => {
                haptic('tap');
                onChangeViewMode(mode);
              }}
              options={[
                { value: 'full', label: 'Full' },
                { value: 'split', label: 'Split' },
                { value: 'drawer', label: 'Drawer' },
              ]}
            />
          )}

          {onToggleFocusMode && (
            <CopilotIconButton
              label={focusMode ? 'Diqqat rejimidan chiqish' : 'Diqqat rejimi (⌘.)'}
              icon={<IconSparkFocus />}
              active={focusMode}
              onClick={() => {
                haptic('tap');
                onToggleFocusMode();
              }}
              className="hidden lg:inline-flex"
            />
          )}

          {onNewChat && (
            <CopilotButton
              variant="tint"
              size="sm"
              onClick={() => {
                haptic('success');
                onNewChat();
              }}
              aria-label={tr(t, 'ai.newChat', 'Yangi suhbat')}
              aria-keyshortcuts="Meta+N Control+N"
              className="!h-8 gap-1.5 rounded-[11px] px-2 text-[11.5px] sm:px-2.5"
              icon={<IconPlus size={14} />}
            >
              <span className="hidden sm:inline">{tr(t, 'ai.newChat', 'Yangi suhbat')}</span>
            </CopilotButton>
          )}

          {onExportChat && (
            <CopilotIconButton
              label={tr(t, 'ai.exportChat', 'Suhbatni eksport qilish')}
              icon={<IconDownload size={17} />}
              onClick={() => {
                haptic('tap');
                onExportChat();
              }}
              className="hidden sm:inline-flex"
            />
          )}

          {onToggleTheme && (
            <CopilotIconButton
              label={isDark ? "Yorug' rejim" : "Qorong'i rejim"}
              icon={isDark ? <IconSun size={17} /> : <IconMoon size={17} />}
              onClick={() => {
                haptic('tap');
                onToggleTheme();
              }}
              className="hidden md:inline-flex"
            />
          )}

          {preferences && onPreferenceChange && (
            <div ref={comfortRef} className="relative hidden md:block">
              <CopilotIconButton
                label="Kontrast va qulaylik"
                icon={<IconSliders size={17} />}
                active={comfortOpen}
                onClick={() => setComfortOpen((value) => !value)}
                aria-expanded={comfortOpen}
                aria-haspopup="dialog"
              />
              <AnimatePresence>
                {comfortOpen && (
                  <motion.div
                    role="dialog"
                    aria-label="Qulaylik sozlamalari"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="cp-dialog absolute right-0 top-full z-50 mt-2 w-64 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--cp-text-tertiary)]">
                        Qulaylik
                      </span>
                      <button
                        type="button"
                        aria-label="Yopish"
                        onClick={() => setComfortOpen(false)}
                        className="cp-icon-btn !h-6 !w-6"
                      >
                        <IconClose size={13} />
                      </button>
                    </div>
                    <ComfortRow
                      label="Zichlik"
                      hint={density === 'compact' ? 'Ixcham' : 'Keng'}
                      active={density === 'compact'}
                      onToggle={() => onPreferenceChange('density', density === 'compact' ? 'comfortable' : 'compact')}
                    />
                    <ComfortRow
                      label="Sokin animatsiya"
                      hint={reduceMotion ? 'Yoniq' : "O'chiq"}
                      active={reduceMotion}
                      onToggle={() => onPreferenceChange('reduceMotion', !reduceMotion)}
                    />
                    <ComfortRow
                      label="Ovoz effektlari"
                      hint={sound ? 'Yoniq' : "O'chiq"}
                      active={sound}
                      onToggle={() => onPreferenceChange('sound', !sound)}
                    />
                    <p className="mt-2 border-t border-[color:var(--cp-hairline)] pt-2 text-[10px] leading-relaxed text-[color:var(--cp-text-tertiary)]">
                      <CopilotKbd>⌘</CopilotKbd> <CopilotKbd>K</CopilotKbd> buyruqlar,{' '}
                      <CopilotKbd>⌘</CopilotKbd> <CopilotKbd>B</CopilotKbd> tarix,{' '}
                      <CopilotKbd>⌘</CopilotKbd> <CopilotKbd>.</CopilotKbd> diqqat.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {onClear && (
            <CopilotIconButton
              label={tr(t, 'ai.clearChat', 'Chatni tozalash')}
              icon={<IconTrash size={16} />}
              data-testid="ai-clear-header"
              onClick={() => {
                haptic('warning');
                onClear();
              }}
            />
          )}

          {/* Mobile context sheet */}
          {(onOpenContextDrawer ?? onToggleContext) && (
            <CopilotIconButton
              label={tr(t, 'ai.contextPanel', 'Kontekst paneli')}
              icon={<IconCompass size={17} />}
              active={contextActive}
              onClick={() => {
                haptic('tap');
                if (onToggleContext) onToggleContext();
                else onOpenContextDrawer?.();
              }}
              className="md:hidden"
            />
          )}
          {/* Desktop context panel toggle */}
          {(onToggleContext ?? onToggleSuggestions) && (
            <CopilotIconButton
              label={tr(t, 'ai.contextPanel', 'Kontekst paneli')}
              icon={<IconCompass size={17} />}
              active={contextActive}
              onClick={() => {
                haptic('tap');
                (onToggleContext ?? onToggleSuggestions)?.();
              }}
              className="hidden md:inline-flex"
            />
          )}
        </div>
      </div>
    </header>
  );
}

function ComfortRow({
  label,
  hint,
  active,
  onToggle,
}: {
  label: string;
  hint: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="min-w-0">
        <span className="block text-[11.5px] font-semibold text-[color:var(--cp-text)]">{label}</span>
        <span className="block text-[10px] text-[color:var(--cp-text-tertiary)]">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          'relative h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200',
          active
            ? 'border-[color:var(--cp-accent-line)] bg-[color:var(--cp-accent)]'
            : 'border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)]',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-[17px] w-[17px] -translate-y-1/2 rounded-full bg-white shadow transition-all duration-200',
            active ? 'left-[18px]' : 'left-[2px]',
          )}
        />
      </button>
    </div>
  );
}

/** Focus-mode glyph (rams-eye): a simple aperture. */
function IconSparkFocus() {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.2c4.6 0 8.2 3.6 9.3 7.8-1.1 4.2-4.7 7.8-9.3 7.8S3.8 16.2 2.7 12C3.8 7.8 7.4 4.2 12 4.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export default AiCopilotHeader;
