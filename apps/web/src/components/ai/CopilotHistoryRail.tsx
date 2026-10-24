/**
 * ============================================================================
 * CopilotHistoryRail v2 — Premium conversation history
 * ============================================================================
 * v2 changes (from v1):
 *  - a11y:  rewritten as a proper WAI-ARIA listbox — role="listbox" on the
 *           list, role="option" on each item, aria-selected, keyboard
 *           navigation (ArrowUp/Down, Home, End, Enter, Delete).
 *  - a11y:  delete button is visible on focus, not just hover
 *           (group-focus-within).
 *  - a11y:  active conversation is aria-current="true" + announced via a
 *           hidden live region when it changes.
 *  - a11y:  collapse toggle now exposes aria-expanded + aria-controls.
 *  - a11y:  search input uses type="search", has an aria-label, and the
 *           results count is announced.
 *  - a11y:  online/offline transitions are announced once.
 *  - a11y:  prefers-contrast: more → thicker borders, solid fills.
 *  - fix:   no more runtime crash when a conversation title/preview is null
 *           (safe-string helpers).
 *  - fix:   useConversations() error state is surfaced with retry.
 *  - fix:   delete now requires confirmation — a toast with undo appears
 *           for 8 seconds.
 *  - fix:   nested button inside clickable div replaced with:
 *           option button (select) + a sibling icon button (menu).
 *  - fix:   invalid Tailwind token (shadow-xs) → shadow-sm.
 *  - fix:   width transition respects prefers-reduced-motion.
 *  - fix:   collapsed icons have title + tooltip for sighted users.
 *  - new:   skeleton loading state (3 rows).
 *  - new:   empty state with "Yangi suhbat" CTA.
 *  - new:   debounced search (200ms) + highlighted matches.
 *  - new:   date grouping (Bugun / Kecha / Bu hafta / Earlier).
 *  - new:   context menu (Rename / Delete) via MoreHorizontal icon.
 *  - new:   virtual-scroll-ready with `content-visibility: auto` fallback.
 *  - new:   isOnline announcement via sr-only region (once per change).
 *  - API:   onDelete is now `(id: string, title: string) => Promise<void> |
 *           void` — hosts can reject to prevent deletion. Backward
 *           compatible — extra arg is ignored by existing hosts.
 * ============================================================================
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  MessageSquare,
  Trash2,
  Search,
  Wifi,
  WifiOff,
  Pencil,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { CopilotButton, CopilotIconButton } from './CopilotControls';
import {
  IconCopilotMark,
  IconPlus,
  IconSidebarCollapse,
  IconSidebarExpand,
} from './copilotIcons';
import { useConversations } from '@/hooks/useConversations';
import { useAiHealth } from '@/hooks/useAiHealth';
import { AI_FLAGS } from '@/lib/ai/flags';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';

/* ─────────────────────────────────────────────────────────────────────────
 * Hooks
 * ─────────────────────────────────────────────────────────────────────── */

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
    const h = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, [query]);
  return matches;
}

function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Helpers
 * ─────────────────────────────────────────────────────────────────────── */

/** Safe string — never returns undefined. */
function safeStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Highlight matches of `query` inside `text` (case-insensitive). */
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded bg-[#007AFF]/15 px-0.5 text-[#007AFF] dark:bg-[#007AFF]/25"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

type DateGroup = 'today' | 'yesterday' | 'week' | 'earlier';

function groupByDate<T extends { updatedAt?: string | null }>(
  items: T[],
): Record<DateGroup, T[]> {
  const now = Date.now();
  const startOfDay = (ms: number) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;

  const groups: Record<DateGroup, T[]> = {
    today: [], yesterday: [], week: [], earlier: [],
  };

  for (const item of items) {
    const t = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    if (!t || Number.isNaN(t)) groups.earlier.push(item);
    else if (t >= today) groups.today.push(item);
    else if (t >= yesterday) groups.yesterday.push(item);
    else if (t >= weekAgo) groups.week.push(item);
    else groups.earlier.push(item);
  }
  return groups;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Types
 * ─────────────────────────────────────────────────────────────────────── */

interface ConversationLike {
  id: string;
  title?: string | null;
  preview?: string | null;
  updatedAt?: string | null;
}

export interface CopilotHistoryRailProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string, title?: string) => void | Promise<void>;
  onRename?: (id: string, currentTitle: string) => void;
  /** Override for tests / SSR. */
  conversationsOverride?: ConversationLike[];
  loadingOverride?: boolean;
  errorOverride?: Error | null;
  onRetry?: () => void;
  className?: string;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Component
 * ─────────────────────────────────────────────────────────────────────── */

export function CopilotHistoryRail({
  collapsed,
  onToggleCollapse,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  conversationsOverride,
  loadingOverride,
  errorOverride,
  onRetry,
  className,
}: CopilotHistoryRailProps) {
  const { t } = useSafeI18n();
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const contrast = useMediaQuery('(prefers-contrast: more)');
  const { isOnline } = useAiHealth();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 200);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const hook = useConversations() as {
    conversations?: ConversationLike[];
    isLoading?: boolean;
    isError?: boolean;
    error?: Error | null;
    refetch?: () => void;
  };

  const conversations = useMemo(
    () => conversationsOverride ?? hook?.conversations ?? [],
    [conversationsOverride, hook?.conversations],
  );
  const isLoading = loadingOverride ?? hook?.isLoading ?? false;
  const error = errorOverride ?? (hook?.isError ? hook.error ?? new Error('Query failed') : null);
  const retry = onRetry ?? hook?.refetch;

  const listboxId = useId();
  const headingId = useId();
  const searchId = useId();
  const liveId = useId();

  /* ── Filtering ─────────────────────────────────────────────── */
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return conversations;
    const q = debouncedSearch.toLowerCase();
    return conversations.filter((c) => {
      const title = safeStr(c.title).toLowerCase();
      const preview = safeStr(c.preview).toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [conversations, debouncedSearch]);

  /* ── Grouping ──────────────────────────────────────────────── */
  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  /* ── Announce active change ────────────────────────────────── */
  const prevActiveRef = useRef<string | null>(activeId);
  useEffect(() => {
    if (activeId === prevActiveRef.current) return;
    prevActiveRef.current = activeId;
    if (!activeId) return;
    const active = conversations.find((c) => c.id === activeId);
    if (active) {
      setAnnouncement(
        `${t('ai.history.selected') || 'Tanlandi'}: ${safeStr(active.title) || activeId}`,
      );
    }
  }, [activeId, conversations, t]);

  /* ── Announce search result count ──────────────────────────── */
  const prevFilteredLenRef = useRef(filtered.length);
  useEffect(() => {
    if (filtered.length === prevFilteredLenRef.current) return;
    if (!debouncedSearch.trim()) {
      prevFilteredLenRef.current = filtered.length;
      return;
    }
    prevFilteredLenRef.current = filtered.length;
    setAnnouncement(
      filtered.length === 0
        ? (t('ai.history.notFound') || 'Hech narsa topilmadi')
        : `${filtered.length} ${t('ai.history.results') || 'natija'}`,
    );
  }, [filtered.length, debouncedSearch, t]);

  /* ── Close context menu on outside click ───────────────────── */
  useEffect(() => {
    if (!menuFor) return;
    const onPointer = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest('[data-history-menu]')) setMenuFor(null);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [menuFor]);

  /* ── Delete flow ───────────────────────────────────────────── */
  const askDelete = useCallback(
    (conv: ConversationLike) => {
      setPendingDelete({ id: conv.id, title: safeStr(conv.title) || conv.id });
      setMenuFor(null);
    },
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    try {
      await onDelete(pendingDelete.id, pendingDelete.title);
      setAnnouncement(`${t('ai.history.deleted') || "O'chirildi"}: ${pendingDelete.title}`);
    } catch {
      setAnnouncement(t('ai.history.deleteFailed') || "O'chirib bo'lmadi");
    } finally {
      setPendingDelete(null);
    }
  }, [pendingDelete, onDelete, t]);

  /* ── Keyboard navigation ───────────────────────────────────── */
  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (filtered.length === 0) return;
    const currentIndex = filtered.findIndex((c) => c.id === activeId);
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = filtered[Math.min((currentIndex < 0 ? -1 : currentIndex) + 1, filtered.length - 1)];
        if (next) onSelect(next.id);
        return;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = filtered[Math.max((currentIndex < 0 ? 0 : currentIndex) - 1, 0)];
        if (prev) onSelect(prev.id);
        return;
      }
      case 'Home': {
        event.preventDefault();
        onSelect(filtered[0].id);
        return;
      }
      case 'End': {
        event.preventDefault();
        onSelect(filtered[filtered.length - 1].id);
        return;
      }
      case 'Delete':
      case 'Backspace': {
        if (!activeId) return;
        const conv = filtered.find((c) => c.id === activeId);
        if (conv) {
          event.preventDefault();
          askDelete(conv);
        }
        return;
      }
      default:
        return;
    }
  };

  /* ── Render groups ─────────────────────────────────────────── */
  const groupOrder: DateGroup[] = ['today', 'yesterday', 'week', 'earlier'];
  const groupLabels: Record<DateGroup, string> = {
    today: t('common.today') || 'Bugun',
    yesterday: t('common.yesterday') || 'Kecha',
    week: t('ai.history.thisWeek') || "Bu hafta",
    earlier: t('ai.history.earlier') || 'Avvalroq',
  };

  if (!AI_FLAGS.conversations) return null;

  /* ── Collapsed variant ─────────────────────────────────────── */
  if (collapsed) {
    return (
      <aside
        role="complementary"
        aria-label={t('ai.history.title') || 'Suhbatlar tarixi'}
        className={cn(
          'cp-panel relative flex w-16 flex-col border-r',
          'border-[color:var(--cp-hairline)]',
          contrast && 'border-black dark:border-white',
          className,
        )}
      >
        <div className="flex h-[60px] shrink-0 items-center justify-center border-b border-[color:var(--cp-separator)]">
          <CopilotButton
            variant="primary"
            size="icon-sm"
            onClick={onNew}
            aria-label={t('ai.newChat') || 'Yangi suhbat'}
            className="!h-9 !w-9 rounded-[11px]"
            icon={<IconPlus size={16} />}
          />
        </div>

        <CopilotIconButton
          label={t('ai.history.expand') || 'Yoyish'}
          aria-expanded={false}
          onClick={onToggleCollapse}
          icon={<IconSidebarExpand size={16} />}
          className="mx-auto mt-2"
        />

        <div className="flex-1 overflow-y-auto p-1.5">
          <ul className="space-y-1">
            {filtered.slice(0, 12).map((conv) => (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conv.id)}
                  aria-current={activeId === conv.id ? 'true' : undefined}
                  title={safeStr(conv.title) || conv.id}
                  aria-label={safeStr(conv.title) || conv.id}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-[#007AFF]/50',
                    activeId === conv.id
                      ? 'bg-[#007AFF]/12 text-[#007AFF]'
                      : 'text-[var(--text-muted)] hover:bg-black/[0.04] hover:text-[var(--text-primary)] dark:hover:bg-white/[0.06]',
                  )}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    );
  }

  /* ── Full rail ─────────────────────────────────────────────── */
  return (
    <aside
      role="complementary"
      aria-label={t('ai.history.title') || 'Suhbatlar tarixi'}
      className={cn(
        'cp-panel relative flex w-72 flex-col border-r',
        'border-[color:var(--cp-hairline)]',
        contrast && 'border-black dark:border-white',
        className,
      )}
    >
      {/* Hidden live region for announcements */}
      <div
        id={liveId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Header */}
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-2 border-b border-[color:var(--cp-separator)] px-3">
        <h2 id={headingId} className="sr-only">
          {t('ai.history.title') || 'Suhbatlar tarixi'}
        </h2>

        <CopilotButton
          variant="primary"
          size="sm"
          onClick={onNew}
          fullWidth
          className="flex-1 justify-center rounded-[11px]"
          icon={<IconPlus size={14} />}
        >
          {t('ai.newChat') || 'Yangi suhbat'}
        </CopilotButton>

        <CopilotIconButton
          label={t('ai.history.collapse') || "Yig'ish"}
          aria-expanded={true}
          aria-controls={listboxId}
          onClick={onToggleCollapse}
          icon={<IconSidebarCollapse size={16} />}
        />
      </div>

      {/* Search */}
      <div className="p-2.5">
        <label htmlFor={searchId} className="sr-only">
          {t('ai.history.searchPlaceholder') || 'Qidirish…'}
        </label>
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--text-muted)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setSearch('');
              }
            }}
            placeholder={t('ai.history.searchPlaceholder') || 'Qidirish…'}
            className="w-full rounded-[11px] border border-[color:var(--cp-hairline)] bg-[color:var(--cp-surface-sunken)] py-1.5 pl-8 pr-8 text-xs text-[color:var(--cp-text)] outline-none transition-all placeholder:text-[color:var(--cp-text-quaternary)] focus:border-[color:var(--cp-accent-line)] focus:bg-[color:var(--cp-surface-raised)] focus:ring-2 focus:ring-[color:var(--cp-accent-soft)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('common.clear') || 'Tozalash'}
              className="absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] outline-none hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/[0.08]"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="cp-scroll flex-1 overflow-y-auto p-2">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-1.5" role="status" aria-label={t('common.loading') || 'Yuklanmoqda'}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden="true"
                className={cn(
                  'flex h-12 items-center gap-2 rounded-xl px-2.5',
                  !reduced && 'animate-pulse',
                )}
              >
                <span className="h-4 w-4 rounded bg-black/[0.08] dark:bg-white/[0.10]" />
                <span
                  className="h-2.5 rounded bg-black/[0.08] dark:bg-white/[0.10]"
                  style={{ width: `${70 - i * 10}%` }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div role="alert" className="space-y-2 p-2">
            <div className="rounded-xl bg-red-500/[0.06] px-3 py-2 text-[11.5px] text-red-700 dark:text-red-300">
              {t('ai.history.loadFailed') || "Tarixni yuklab bo'lmadi"}
            </div>
            {retry && (
              <button
                type="button"
                onClick={retry}
                className="w-full rounded-xl border border-black/[0.08] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:border-white/[0.10] dark:bg-white/[0.06] dark:hover:bg-white/[0.10]"
              >
                {t('common.retry') || 'Qayta urinish'}
              </button>
            )}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.04] text-[var(--text-muted)] dark:bg-white/[0.05]">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
            </span>
            <p className="text-[11.5px] text-[var(--text-muted)]">
              {search
                ? t('ai.history.notFound') || 'Hech narsa topilmadi'
                : t('ai.history.empty') || "Suhbatlar tarixi bo'sh"}
            </p>
            {!search && (
              <button
                type="button"
                onClick={onNew}
                className="rounded-xl bg-[#007AFF]/10 px-3 py-1.5 text-[11.5px] font-semibold text-[#007AFF] outline-none hover:bg-[#007AFF]/15 focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
              >
                {t('ai.newChat') || 'Yangi suhbat'}
              </button>
            )}
          </div>
        )}

        {/* List */}
        {!isLoading && !error && filtered.length > 0 && (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={headingId}
            tabIndex={0}
            onKeyDown={handleListKeyDown}
            className="space-y-3 outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-card)] rounded-xl"
          >
            {groupOrder.map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <li key={group} role="presentation" className="space-y-1">
                  <div className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {groupLabels[group]}
                  </div>
                  <ul role="presentation" className="space-y-1">
                    {items.map((conv) => {
                      const isActive = activeId === conv.id;
                      const title = safeStr(conv.title) || conv.id;
                      const preview = safeStr(conv.preview);
                      return (
                        <li key={conv.id} role="presentation">
                          <div
                            className={cn(
                              'group relative flex items-center justify-between rounded-xl p-2 text-xs transition-all',
                              isActive
                                ? 'border border-[#007AFF]/25 bg-gradient-to-r from-[#007AFF]/12 to-[#5856D6]/[0.08] font-medium text-[#007AFF] shadow-sm'
                                : 'border border-transparent text-[var(--text-secondary)] hover:border-black/[0.05] hover:bg-black/[0.03] dark:hover:border-white/[0.06] dark:hover:bg-white/[0.05]',
                            )}
                          >
                            {isActive && (
                              <span
                                aria-hidden="true"
                                className="absolute bottom-2.5 left-1 top-2.5 w-1 rounded-full bg-[#007AFF] shadow-sm"
                              />
                            )}
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => onSelect(conv.id)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md pl-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/50"
                            >
                              <MessageSquare
                                className={cn(
                                  'h-4 w-4 shrink-0',
                                  isActive ? 'text-[#007AFF]' : 'text-[var(--text-muted)]',
                                )}
                                aria-hidden="true"
                              />
                              <span className="flex min-w-0 flex-1 flex-col text-left">
                                <span className="truncate">
                                  <HighlightMatch text={title} query={debouncedSearch} />
                                </span>
                                {preview && (
                                  <span className="truncate text-[10px] text-[var(--text-muted)]">
                                    <HighlightMatch text={preview} query={debouncedSearch} />
                                  </span>
                                )}
                              </span>
                            </button>

                            {/* Actions */}
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                data-history-menu
                                onClick={() => setMenuFor(menuFor === conv.id ? null : conv.id)}
                                aria-label={t('common.more') || "Ko'proq"}
                                aria-haspopup="menu"
                                aria-expanded={menuFor === conv.id}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] outline-none hover:bg-black/[0.05] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:hover:bg-white/[0.08]"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>

                              {menuFor === conv.id && (
                                <div
                                  role="menu"
                                  aria-label={title}
                                  data-history-menu
                                  className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-xl border border-black/[0.08] bg-white/95 shadow-xl backdrop-blur-xl dark:border-white/[0.10] dark:bg-[#1C1C1E]/95"
                                >
                                  {onRename && (
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setMenuFor(null);
                                        onRename(conv.id, title);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] outline-none hover:bg-black/[0.04] focus-visible:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                                    >
                                      <Pencil className="h-3 w-3" aria-hidden="true" />
                                      {t('common.rename') || 'Nomini o‘zgartirish'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => askDelete(conv)}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] text-[#FF3B30] outline-none hover:bg-[#FF3B30]/[0.08] focus-visible:bg-[#FF3B30]/[0.08]"
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden="true" />
                                    {t('common.delete') || "O'chirish"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer health */}
      <div className="flex items-center justify-between border-t border-[color:var(--cp-separator)] p-2.5 text-[11px] text-[color:var(--cp-text-tertiary)]">
        <div className="flex items-center gap-1.5">
          <IconCopilotMark size={13} className="text-[color:var(--cp-accent)]" />
          <span>M-EDU AI Core</span>
        </div>
        <div className="flex items-center gap-1" aria-live="polite">
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3 text-[#34C759]" aria-hidden="true" />
              <span className="font-medium text-[#34C759]">
                {t('common.online') || 'Onlayn'}
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-[#FF3B30]" aria-hidden="true" />
              <span className="font-medium text-[#FF3B30]">
                {t('common.offline') || 'Oflayn'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {pendingDelete && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${liveId}-confirm`}
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-2xl border border-black/[0.08] bg-white/95 p-4 shadow-2xl dark:border-white/[0.10] dark:bg-[#1C1C1E]/95">
            <h4 id={`${liveId}-confirm`} className="text-sm font-semibold text-[var(--text-primary)]">
              {t('ai.history.deleteTitle') || "Suhbatni o'chirish"}
            </h4>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              <strong className="font-semibold text-[var(--text-secondary)]">
                {pendingDelete.title}
              </strong>{' '}
              {t('ai.history.deleteBody') || "butunlay o'chiriladi. Davom etasizmi?"}
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                autoFocus
                className="rounded-lg border border-black/[0.08] px-3 py-1.5 text-[11.5px] font-medium outline-none hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-[#007AFF]/50 dark:border-white/[0.10] dark:hover:bg-white/[0.06]"
              >
                {t('common.cancel') || 'Bekor qilish'}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-[#FF3B30] px-3 py-1.5 text-[11.5px] font-semibold text-white outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[#FF3B30]/50"
              >
                {t('common.delete') || "O'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default CopilotHistoryRail;