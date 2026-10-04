// M-EDU AI Copilot — History Rail
// M-EDU Premium UI — Quiet Chrome Edition
//
// Design notes (unchanged philosophy):
//  • The rail is chrome, not content. It sits quieter than the
//    conversation it holds. No bold weights on non-active rows,
//    no saturated colors, no glow, no lift, no shadow.
//  • Group headers become small-caps eyebrows. 10.5px uppercase,
//    +0.08em tracking, tertiary.
//  • One indicator per state:
//      Active row → soft primary wash + 2px rounded left bar.
//      Hover row  → neutral wash, 150ms in, 80ms press.
//  • Delete is a whisper. Hidden until hover/focus-within.
//  • Collapse is a width animation on the Apple UI curve —
//    300ms in, no bounce.
//
// ✨ FIXES (v2):
//  - All dynamic Tailwind classes → inline styles (JIT can't scan)
//  - usePrefersReducedMotion() — no more 1-frame flash
//  - useConversations error state with retry
//  - RailLoading pulse: replaced fragile arbitrary animation
//  - aria-current: "page" instead of "true" (more specific)
//  - Delete button: sibling, stopPropagation removed (unnecessary)
//  - Custom scrollbar: fallback class + inline styles
//  - Type-safe CSSProperties for dynamic motion values

import { memo, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useConversations } from '@/hooks/useConversations';
import type { AiConversationSummary } from '@/lib/ai';
import { useAiHealth } from '@/hooks/useAiHealth';
import { AI_FLAGS } from '@/lib/ai/flags';

/* ------------------------------------------------------------------ */
/*  Motion system — as VALUES, applied via inline style                */
/*  Why: Tailwind JIT cannot see `[${VAR}]`. Inline styles can.        */
/* ------------------------------------------------------------------ */

const EASE_UI     = 'cubic-bezier(0.2, 0, 0, 1)';
const EASE_ENTER  = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** Collapse width — physical, not sluggish. */
const WIDTH_MS = 300;

/** Item entrance — one beat per item, capped. */
const ENTER_MS = 380;
const ENTER_BEAT = 22;
const ENTER_CAP = 12;

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--bg-surface)]';

/* ------------------------------------------------------------------ */
/*  Reduced-motion hook — never hide content when user prefers less    */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ------------------------------------------------------------------ */
/*  Motion style builders                                              */
/* ------------------------------------------------------------------ */

/** Width-collapse transition (rail shell). */
function buildShellStyle(collapsed: boolean): CSSProperties {
  return {
    width: collapsed ? 'var(--rail-w-collapsed)' : 'var(--rail-w-expanded)',
    transition: `width ${WIDTH_MS}ms ${EASE_UI}`,
    willChange: 'width',
  };
}

/** Entrance transition for a single row. */
function buildEnterStyle(
  ready: boolean,
  staggerMs: number,
  reduced: boolean,
): CSSProperties {
  if (reduced) {
    // Never hide content when reduced motion is preferred.
    return { opacity: 1, transform: 'none' };
  }
  return {
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(4px)',
    transition:
      `opacity ${ENTER_MS}ms ${EASE_ENTER} ${staggerMs}ms, ` +
      `transform ${ENTER_MS}ms ${EASE_ENTER} ${staggerMs}ms`,
    willChange: 'opacity, transform',
  };
}

/* ------------------------------------------------------------------ */
/*  Public props                                                       */
/* ------------------------------------------------------------------ */

interface CopilotHistoryRailProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Entry point — honors the feature flag without violating hooks      */
/* ------------------------------------------------------------------ */

export const CopilotHistoryRail = memo(function CopilotHistoryRail(
  props: CopilotHistoryRailProps,
) {
  if (!AI_FLAGS.conversations) return null;
  return <CopilotHistoryRailInner {...props} />;
});

/* ------------------------------------------------------------------ */
/*  Inner — owns the data hooks                                        */
/* ------------------------------------------------------------------ */

const CopilotHistoryRailInner = memo(function CopilotHistoryRailInner({
  collapsed,
  onToggleCollapse,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: CopilotHistoryRailProps) {
  const { conversations, isLoading, isError, refetch } = useConversations();
  const { isOnline, isLoading: isHealthLoading } = useAiHealth();
  const reduced = usePrefersReducedMotion();

  /* Reveal on next frame so the entrance actually paints. */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (reduced) { setReady(true); return; }
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  /* Grouping: calendar days, not 24h windows. */
  const grouped = useMemo(() => {
    const today: AiConversationSummary[] = [];
    const yesterday: AiConversationSummary[] = [];
    const last7: AiConversationSummary[] = [];
    const older: AiConversationSummary[] = [];

    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const now = startOfDay(new Date());
    const DAY = 86_400_000;

    for (const conv of conversations) {
      const day = startOfDay(new Date(conv.updatedAt));
      const diff = Math.round((now - day) / DAY);
      if (diff <= 0) today.push(conv);
      else if (diff === 1) yesterday.push(conv);
      else if (diff <= 7) last7.push(conv);
      else older.push(conv);
    }

    return [
      { label: 'Today', items: today },
      { label: 'Yesterday', items: yesterday },
      { label: 'Last 7 days', items: last7 },
      { label: 'Older', items: older },
    ].filter((g) => g.items.length > 0);
  }, [conversations]);

  /* Flatten for a stable stagger index across sections. */
  const staggerIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const g of grouped) {
      for (const c of g.items) map.set(c.id, i++);
    }
    return map;
  }, [grouped]);

  return (
    <aside
      aria-label="Conversation history"
      className={[
        'flex h-full shrink-0 flex-col overflow-hidden',
        'border-r border-[var(--border)] bg-[var(--bg-surface)]',
        collapsed ? 'items-center' : '',
      ].join(' ')}
      style={{
        ...buildShellStyle(collapsed),
        scrollbarGutter: 'stable',
      }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <header
        className={[
          'flex h-16 shrink-0 items-center border-b border-[var(--border)]',
          collapsed ? 'w-full justify-center' : 'justify-between px-4',
        ].join(' ')}
      >
        {!collapsed && (
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Conversations
          </h2>
        )}

        <button
          type="button"
          onClick={onNew}
          aria-label="New conversation"
          title="New conversation"
          className={[
            'flex items-center justify-center rounded-[9px] text-[var(--text-secondary)]',
            'hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
            'active:scale-[0.94] motion-reduce:active:scale-100',
            collapsed ? 'h-9 w-9' : 'h-7 w-7',
            FOCUS,
          ].join(' ')}
          style={{
            transition:
              `background-color 150ms ${EASE_UI}, ` +
              `color 150ms ${EASE_UI}, ` +
              `transform 100ms ${EASE_UI}`,
          }}
        >
          <Plus size={collapsed ? 18 : 15} strokeWidth={2.2} />
        </button>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div
        className={[
          'flex-1 overflow-y-auto overflow-x-hidden',
          collapsed ? 'flex flex-col items-center px-2 py-3' : 'px-2.5 py-3',
        ].join(' ')}
        style={{
          // Custom scrollbar styling without depending on a global class
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border) transparent',
        }}
      >
        {isLoading ? (
          <RailLoading collapsed={collapsed} />
        ) : isError ? (
          <RailError
            collapsed={collapsed}
            onRetry={() => refetch()}
          />
        ) : grouped.length === 0 ? (
          <RailEmpty collapsed={collapsed} />
        ) : (
          grouped.map((group) => (
            <section
              key={group.label}
              className={collapsed ? 'mb-2 w-full' : 'mb-4 w-full last:mb-1'}
            >
              {!collapsed && (
                <h3 className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                  {group.label}
                </h3>
              )}

              <ul className="flex w-full flex-col gap-0.5">
                {group.items.map((conv) => (
                  <ConversationRow
                    key={conv.id}
                    conv={conv}
                    collapsed={collapsed}
                    active={activeId === conv.id}
                    ready={ready}
                    reduced={reduced}
                    stagger={
                      Math.min(staggerIndex.get(conv.id) ?? 0, ENTER_CAP) *
                      ENTER_BEAT
                    }
                    onSelect={onSelect}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer
        className={[
          'shrink-0 border-t border-[var(--border)]',
          collapsed ? 'flex justify-center p-2.5' : 'p-3',
        ].join(' ')}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand history"
            title="Expand history"
            className={[
              'flex h-9 w-9 items-center justify-center rounded-[9px]',
              'text-[var(--text-tertiary)]',
              'hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
              'active:scale-[0.94] motion-reduce:active:scale-100',
              FOCUS,
            ].join(' ')}
            style={{
              transition:
                `background-color 150ms ${EASE_UI}, ` +
                `color 150ms ${EASE_UI}, ` +
                `transform 100ms ${EASE_UI}`,
            }}
          >
            <ChevronRight size={16} strokeWidth={2.2} />
          </button>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--primary-soft)] text-[var(--primary)]"
              >
                <MessageSquare size={13} strokeWidth={2.1} />
              </span>

              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[12.5px] font-semibold leading-tight tracking-[-0.008em] text-[var(--text-primary)]">
                  M-EDU AI
                </span>
                <StatusLine isOnline={isOnline} isLoading={isHealthLoading} />
              </div>
            </div>

            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse history"
              title="Collapse history"
              className={[
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]',
                'text-[var(--text-tertiary)]',
                'hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]',
                'active:scale-[0.94] motion-reduce:active:scale-100',
                FOCUS,
              ].join(' ')}
              style={{
                transition:
                  `background-color 150ms ${EASE_UI}, ` +
                  `color 150ms ${EASE_UI}, ` +
                  `transform 100ms ${EASE_UI}`,
              }}
            >
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>
          </div>
        )}
      </footer>
    </aside>
  );
});

/* ------------------------------------------------------------------ */
/*  ConversationRow — expanded and collapsed share one component       */
/* ------------------------------------------------------------------ */

interface RowProps {
  conv: AiConversationSummary;
  collapsed: boolean;
  active: boolean;
  ready: boolean;
  reduced: boolean;
  stagger: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const ConversationRow = memo(function ConversationRow({
  conv,
  collapsed,
  active,
  ready,
  reduced,
  stagger,
  onSelect,
  onDelete,
}: RowProps) {
  const time = new Date(conv.updatedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const enterStyle = buildEnterStyle(ready, stagger, reduced);

  /* ── Collapsed variant ─────────────────────────────────────── */
  if (collapsed) {
    return (
      <li style={enterStyle}>
        <button
          type="button"
          onClick={() => onSelect(conv.id)}
          title={conv.title}
          aria-label={conv.title}
          aria-current={active ? 'page' : undefined}
          className={[
            'flex h-9 w-9 items-center justify-center rounded-[9px]',
            'active:scale-[0.94] motion-reduce:active:scale-100',
            active
              ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]',
            FOCUS,
          ].join(' ')}
          style={{
            transition:
              `background-color 150ms ${EASE_UI}, ` +
              `color 150ms ${EASE_UI}, ` +
              `transform 100ms ${EASE_UI}`,
          }}
        >
          <MessageSquare size={15} strokeWidth={2.1} />
        </button>
      </li>
    );
  }

  /* ── Expanded variant ──────────────────────────────────────── */
  return (
    <li className="group relative" style={enterStyle}>
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        aria-current={active ? 'page' : undefined}
        className={[
          'relative flex w-full flex-col items-stretch rounded-[10px] px-2.5 py-2 text-left',
          active
            ? 'bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]'
            : 'hover:bg-[color-mix(in_oklab,var(--text-primary)_4%,transparent)]',
          FOCUS,
        ].join(' ')}
        style={{
          transition: `background-color 150ms ${EASE_UI}`,
        }}
      >
        {/* Active rail — 2px, rounded right, top/bottom inset 8px. */}
        <span
          aria-hidden
          className={[
            'pointer-events-none absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full',
            'bg-[var(--primary)]',
            active ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{
            transition: `opacity 150ms ${EASE_UI}`,
          }}
        />

        {/* Line 1 — title + time. */}
        <div className="flex items-center gap-2">
          <span
            className={[
              'min-w-0 flex-1 truncate text-[12.5px] leading-[1.35] tracking-[-0.005em]',
              active
                ? 'font-semibold text-[var(--text-primary)]'
                : 'font-medium text-[var(--text-primary)]',
            ].join(' ')}
          >
            {conv.title}
          </span>

          <span className="shrink-0 text-[10.5px] font-medium tabular-nums tracking-[0.005em] text-[var(--text-tertiary)]">
            {time}
          </span>
        </div>

        {/* Line 2 — preview. Padding-right reserves room for delete. */}
        <span className="mt-0.5 block truncate pr-6 text-[11.5px] leading-[1.35] text-[var(--text-tertiary)]">
          {conv.preview}
        </span>
      </button>

      {/* Delete — hidden until hover or keyboard focus-within. */}
      <button
        type="button"
        onClick={() => onDelete(conv.id)}
        aria-label={`Delete conversation "${conv.title}"`}
        title="Delete"
        className={[
          'absolute right-1.5 top-1/2 -translate-y-1/2',
          'flex h-6 w-6 items-center justify-center rounded-[6px]',
          'text-[var(--text-tertiary)]',
          'opacity-0 translate-x-[3px]',
          'group-hover:opacity-100 group-hover:translate-x-0',
          'group-focus-within:opacity-100 group-focus-within:translate-x-0',
          'hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]',
          'focus-visible:opacity-100 focus-visible:translate-x-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]',
        ].join(' ')}
        style={{
          transition:
            `opacity 150ms ${EASE_UI}, ` +
            `transform 150ms ${EASE_UI}, ` +
            `background-color 150ms ${EASE_UI}, ` +
            `color 150ms ${EASE_UI}`,
        }}
      >
        <Trash2 size={12} strokeWidth={2.2} />
      </button>
    </li>
  );
});

/* ------------------------------------------------------------------ */
/*  Small parts                                                        */
/* ------------------------------------------------------------------ */

function StatusLine({ isOnline, isLoading }: { isOnline: boolean; isLoading: boolean }) {
  const tone = isLoading
    ? { label: 'Connecting', color: 'var(--warning)' }
    : isOnline
      ? { label: 'Connected', color: 'var(--success)' }
      : { label: 'Reconnecting', color: 'var(--danger)' };

  return (
    <span className="mt-0.5 flex items-center gap-1.5 leading-none">
      <span aria-hidden className="relative flex h-1.5 w-1.5">
        {isLoading && !reducedMotionGlobal() && (
          <span
            className="absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping"
            style={{ backgroundColor: tone.color }}
          />
        )}
        <span
          className="relative h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: tone.color }}
        />
      </span>
      <span className="text-[10.5px] font-medium tracking-[0.005em] text-[var(--text-tertiary)]">
        {tone.label}
      </span>
    </span>
  );
}

/** Synchronous reduced-motion probe for micro-decisions. */
function reducedMotionGlobal(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function RailLoading({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex h-32 items-center justify-center" role="status" aria-live="polite">
        <span className="flex items-center gap-[3px]" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-[3.5px] w-[3.5px] rounded-full bg-[var(--primary)]"
              style={{
                animation: reducedMotionGlobal()
                  ? 'none'
                  : 'rail-dot-pulse 1.4s cubic-bezier(0.4,0,0.6,1) infinite',
                animationDelay: reducedMotionGlobal() ? undefined : `${i * 180}ms`,
                opacity: reducedMotionGlobal() ? 0.55 : undefined,
              }}
            />
          ))}
        </span>
        <style>{`
          @keyframes rail-dot-pulse {
            0%, 100% { opacity: 0.35; transform: scale(0.9); }
            50%      { opacity: 1;    transform: scale(1.15); }
          }
        `}</style>
        <span className="sr-only">Loading conversations</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-1 pt-1" role="status" aria-live="polite">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <SkeletonBar width="70%" />
          <SkeletonBar width="45%" />
        </div>
      ))}
      <span className="sr-only">Loading conversations</span>
    </div>
  );
}

function SkeletonBar({ width }: { width: string }) {
  return (
    <div
      className="relative h-2.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"
      style={{ width }}
    >
      <span
        aria-hidden
        className="absolute inset-0 motion-reduce:hidden"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
          animation: 'rail-shimmer 1.8s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes rail-shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function RailEmpty({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;

  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <p className="mt-4 text-[12.5px] font-semibold leading-tight tracking-[-0.005em] text-[var(--text-secondary)]">
        No conversations yet
      </p>
      <p className="mt-1.5 max-w-[200px] text-[11.5px] leading-[1.45] text-[var(--text-tertiary)] [text-wrap:pretty]">
        Start a new chat to explore M-EDU AI&apos;s capabilities.
      </p>
    </div>
  );
}

function RailError({
  collapsed,
  onRetry,
}: {
  collapsed: boolean;
  onRetry: () => void;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onRetry}
        title="Retry loading conversations"
        aria-label="Retry loading conversations"
        className={[
          'flex h-9 w-9 items-center justify-center rounded-[9px]',
          'text-[var(--danger)] hover:bg-[var(--danger-soft)]',
          FOCUS,
        ].join(' ')}
        style={{ transition: `background-color 150ms ${EASE_UI}` }}
      >
        <RefreshCw size={15} strokeWidth={2.2} />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--danger-soft)] text-[var(--danger)]"
      >
        <AlertTriangle size={18} strokeWidth={2} />
      </span>
      <div>
        <p className="text-[12.5px] font-semibold leading-tight tracking-[-0.005em] text-[var(--text-primary)]">
          Couldn&apos;t load
        </p>
        <p className="mt-1.5 max-w-[200px] text-[11.5px] leading-[1.45] text-[var(--text-tertiary)] [text-wrap:pretty]">
          Check your connection and try again.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={[
          'inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5',
          'text-[11.5px] font-semibold text-[var(--danger)]',
          'hover:bg-[var(--danger-soft)]',
          FOCUS,
        ].join(' ')}
        style={{ transition: `background-color 150ms ${EASE_UI}` }}
      >
        <RefreshCw size={11} strokeWidth={2.4} />
        Retry
      </button>
    </div>
  );
}

export default CopilotHistoryRail;