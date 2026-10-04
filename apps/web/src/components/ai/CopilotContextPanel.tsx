// M-EDU AI Copilot — Context Panel
// M-EDU Premium UI — Quiet Shelf Edition
//
// Design philosophy (unchanged from original):
//  • A sidebar is a shelf, not a dashboard. It offers, doesn't shout.
//  • Small-caps eyebrows. The eye skims, then lands.
//  • Three gesture languages, one spine.
//  • Motion budget: tiny and intentional.
//  • Every focusable element: one ring. No exceptions.
//
// ✨ FIXES:
//  - All dynamic Tailwind classes → inline styles (CSS vars can't be JIT-scanned)
//  - Reduced-motion entrance: never starts hidden (no flash)
//  - Query error states: quiet, informative, retryable
//  - useId() for aria-labelledby (no collisions in multi-instance)
//  - CSS variable injection guard for insight.type
//  - Shimmer skeletons (not pulse) — matches M-EDU design language
//  - React 19 types (ReactNode, CSSProperties)
//  - lastUpdated: accepts Date | string, formats locally

import { memo, useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  BarChart3,
  Users,
  Clock,
  RefreshCw,
  FileText,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { aiInsightsApi, aiSuggestionsApi } from '@/lib/ai';
import { AI_FLAGS } from '@/lib/ai/flags';

/* ------------------------------------------------------------------ */
/*  Motion system — defined as CSS VALUES, applied via inline style    */
/*  Why: Tailwind's JIT can't see `[${VAR}]`. Inline styles can.       */
/* ------------------------------------------------------------------ */

const EASE_ENTER = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_UI    = 'cubic-bezier(0.2, 0, 0, 1)';

const ENTER_MS   = 500;
const ENTER_STAGGER = { a: 0, b: 120, c: 200 } as const;

/* ------------------------------------------------------------------ */
/*  Reduced-motion helper                                              */
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
/*  FOCUS ring — one class, applied everywhere                         */
/* ------------------------------------------------------------------ */

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--bg-app)]';

/* ------------------------------------------------------------------ */
/*  Safe CSS variable resolver for insight types                       */
/*  Backend may send arbitrary strings. We whitelist.                  */
/* ------------------------------------------------------------------ */

const ALLOWED_TYPES = new Set([
  'trend', 'report', 'attendance', 'schedule',
  'primary', 'success', 'warning', 'danger', 'info',
]);

function safeVarName(type?: string): string {
  if (!type) return 'primary';
  const lower = type.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return ALLOWED_TYPES.has(lower) ? lower : 'primary';
}

/* ------------------------------------------------------------------ */
/*  Insights — icon per type, with a safe default                      */
/* ------------------------------------------------------------------ */

const INSIGHT_ICON: Record<string, typeof BarChart3> = {
  trend: TrendingUp,
  report: FileText,
  attendance: Users,
  schedule: Clock,
  primary: BarChart3,
  success: TrendingUp,
  warning: AlertTriangle,
  danger: AlertTriangle,
  info: BarChart3,
};

const iconFor = (type?: string) =>
  (type && INSIGHT_ICON[safeVarName(type)]) || INSIGHT_ICON.primary;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Insight {
  id: string;
  type?: string;
  title: string;
  body: string;
  metric?: string;
}

interface CopilotContextPanelProps {
  routeContext: string;
  sources?: string[];
  lastUpdated?: Date | string;
  onActionClick: (prompt: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Quick Actions — three gesture languages: tile edition              */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { icon: BarChart3, label: 'Analyze Data',    intent: 'intent.analyze_data' },
  { icon: Users,     label: 'Find Students',   intent: 'intent.find_students' },
  { icon: Clock,     label: 'Schedule',        intent: 'intent.view_schedule' },
  { icon: FileText,  label: 'Report',          intent: 'intent.generate_report' },
] as const;

/* ------------------------------------------------------------------ */
/*  Reveal helper — inline styles, not Tailwind arbitrary values       */
/* ------------------------------------------------------------------ */

function buildRevealStyle(ready: boolean, delayMs: number, reduced: boolean): CSSProperties {
  if (reduced) {
    // Never hide content when reduced motion is preferred
    return { opacity: 1, transform: 'none' };
  }
  return {
    opacity: ready ? 1 : 0,
    transform: ready ? 'translateY(0)' : 'translateY(6px)',
    transition: `opacity ${ENTER_MS}ms ${EASE_ENTER} ${delayMs}ms, transform ${ENTER_MS}ms ${EASE_ENTER} ${delayMs}ms`,
    willChange: 'opacity, transform',
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CopilotContextPanel = memo(function CopilotContextPanel({
  routeContext,
  sources,
  lastUpdated,
  onActionClick,
}: CopilotContextPanelProps) {
  const reduced = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);

  // Entrance — reveal on next frame so the initial state actually paints.
  // If reduced motion, skip and show immediately.
  useEffect(() => {
    if (reduced) { setReady(true); return; }
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Unique IDs — no aria-labelledby collisions
  const idQa    = useId();
  const idIns   = useId();
  const idSug   = useId();

  /* Data */
  const insightsQuery = useQuery({
    queryKey: ['ai', 'insights', routeContext],
    queryFn: () => aiInsightsApi.list(routeContext),
    enabled: AI_FLAGS.insights,
    retry: 1,
  });

  const suggestionsQuery = useQuery({
    queryKey: ['ai', 'suggestions', routeContext],
    queryFn: () => aiSuggestionsApi.list(routeContext),
    staleTime: 60_000,
    enabled: AI_FLAGS.suggestions,
    retry: 1,
  });

  const insights = (insightsQuery.data ?? []) as Insight[];
  const suggestions = (suggestionsQuery.data ?? []) as string[];

  const insightsLoading = insightsQuery.isLoading;
  const suggestionsLoading = suggestionsQuery.isLoading;

  return (
    <aside
      aria-label="Copilot context"
      className="hidden w-[var(--context-w)] shrink-0 flex-col overflow-y-auto overscroll-contain border-l border-[var(--border)] bg-[var(--bg-app)] lg:flex"
      style={{ scrollbarGutter: 'stable' }}
    >
      <div className="flex flex-1 flex-col gap-8 px-5 py-6">

        {/* ── A. Quick Actions ──────────────────────────────────── */}
        <section
          style={buildRevealStyle(ready, ENTER_STAGGER.a, reduced)}
          aria-labelledby={idQa}
        >
          <SectionHeader
            id={idQa}
            title="Quick actions"
            actionLabel="View all"
          />

          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.intent}
                  type="button"
                  onClick={() => onActionClick(action.intent)}
                  className={[
                    'group flex flex-col items-start gap-2 rounded-[11px]',
                    'border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left',
                    'hover:border-[color-mix(in_oklab,var(--primary)_30%,var(--border-subtle))]',
                    'hover:bg-[color-mix(in_oklab,var(--primary)_4%,var(--bg-surface))]',
                    'active:bg-[color-mix(in_oklab,var(--primary)_8%,var(--bg-surface))]',
                    FOCUS,
                  ].join(' ')}
                  style={{
                    transition:
                      `background-color 180ms ${EASE_UI}, ` +
                      `border-color 180ms ${EASE_UI}, ` +
                      `transform 100ms ${EASE_UI}`,
                  }}
                >
                  <span
                    aria-hidden
                    className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--primary-soft)] text-[var(--primary)]"
                  >
                    <ActionIcon size={15} strokeWidth={1.9} />
                  </span>
                  <span className="text-[12.5px] font-medium leading-[1.25] tracking-[-0.004em] text-[var(--text-primary)]">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── B. Insights ───────────────────────────────────────── */}
        {AI_FLAGS.insights && (
          <section
            style={buildRevealStyle(ready, ENTER_STAGGER.b, reduced)}
            aria-labelledby={idIns}
          >
            <SectionHeader
              id={idIns}
              title="Insights"
              actionLabel="See all"
            />

            <div className="flex flex-col gap-1.5">
              {insightsLoading ? (
                <InsightsSkeleton />
              ) : insightsQuery.isError ? (
                <ErrorNote
                  message="Couldn't load insights"
                  onRetry={() => insightsQuery.refetch()}
                />
              ) : insights.length === 0 ? (
                <EmptyNote>No insights available</EmptyNote>
              ) : (
                insights.map((insight) => {
                  const InsightIcon = iconFor(insight.type);
                  const safeType = safeVarName(insight.type);
                  const tint     = `var(--${safeType}, var(--primary))`;
                  const tintSoft = `var(--${safeType}-soft, var(--primary-soft))`;

                  return (
                    <div
                      key={insight.id}
                      className="flex items-center gap-2.5 rounded-[11px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5"
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                        style={{ backgroundColor: tintSoft, color: tint }}
                      >
                        <InsightIcon size={14} strokeWidth={2} />
                      </span>

                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[12.5px] font-semibold leading-[1.3] tracking-[-0.005em] text-[var(--text-primary)]">
                          {insight.title}
                        </span>
                        <span className="mt-0.5 truncate text-[11.5px] leading-[1.35] text-[var(--text-secondary)]">
                          {insight.body}
                        </span>
                      </div>

                      {insight.metric && (
                        <span className="shrink-0 rounded-[6px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-[-0.003em] text-[var(--text-primary)]">
                          {insight.metric}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ── C. Suggested Prompts ──────────────────────────────── */}
        {AI_FLAGS.suggestions && (
          <section
            style={buildRevealStyle(ready, ENTER_STAGGER.c, reduced)}
            aria-labelledby={idSug}
          >
            <SectionHeader
              id={idSug}
              title="Suggested prompts"
              actionIcon={
                <RefreshCw
                  size={13}
                  strokeWidth={2.1}
                  className={suggestionsLoading ? 'animate-spin motion-reduce:animate-none' : ''}
                />
              }
              onActionClick={() => suggestionsQuery.refetch()}
              actionAriaLabel="Refresh suggestions"
            />

            <div className="flex flex-col gap-0.5">
              {suggestionsLoading ? (
                <SuggestionsSkeleton />
              ) : suggestionsQuery.isError ? (
                <ErrorNote
                  message="Couldn't load suggestions"
                  onRetry={() => suggestionsQuery.refetch()}
                />
              ) : suggestions.length === 0 ? (
                <EmptyNote>No suggestions</EmptyNote>
              ) : (
                suggestions.map((prompt, i) => (
                  <button
                    key={`${prompt}-${i}`}
                    type="button"
                    onClick={() => onActionClick(prompt)}
                    className={[
                      'group flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left',
                      'hover:bg-[color-mix(in_oklab,var(--primary)_5%,transparent)]',
                      'active:bg-[color-mix(in_oklab,var(--primary)_9%,transparent)]',
                      FOCUS,
                    ].join(' ')}
                    style={{
                      transition: `background-color 150ms ${EASE_UI}`,
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.35] tracking-[-0.004em] text-[var(--text-primary)]">
                      {prompt}
                    </span>

                    <ArrowUpRight
                      aria-hidden
                      size={13}
                      strokeWidth={2.2}
                      className="shrink-0 text-[var(--text-tertiary)] transition-all duration-150 group-hover:-translate-x-0 group-hover:text-[var(--primary)] group-hover:opacity-100 group-focus-visible:-translate-x-0 group-focus-visible:text-[var(--primary)] group-focus-visible:opacity-100 motion-reduce:transition-none"
                      style={{
                        opacity: 0,
                        transform: 'translateX(-3px)',
                      }}
                    />
                  </button>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── D. Source footer ──────────────────────────────────── */}
      {sources && sources.length > 0 && (
        <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 py-3.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                Sources
              </span>
              <span
                className="min-w-0 truncate text-[11px] leading-[1.4] text-[var(--text-secondary)]"
                title={sources.join(', ')}
              >
                {sources.join(' · ')}
              </span>
            </div>

            {lastUpdated && (
              <span className="text-[10.5px] leading-none tracking-[0.005em] text-[var(--text-tertiary)]">
                Updated {formatUpdated(lastUpdated)}
              </span>
            )}
          </div>
        </footer>
      )}
    </aside>
  );
});

/* ------------------------------------------------------------------ */
/*  Section header — small-caps eyebrow + optional action              */
/* ------------------------------------------------------------------ */

function SectionHeader({
  id,
  title,
  actionLabel,
  actionIcon,
  onActionClick,
  actionAriaLabel,
}: {
  id: string;
  title: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onActionClick?: () => void;
  actionAriaLabel?: string;
}) {
  return (
    <header className="mb-3 flex items-baseline justify-between">
      <h3
        id={id}
        className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
      >
        {title}
      </h3>

      {(actionLabel || actionIcon) && (
        <button
          type="button"
          onClick={onActionClick}
          aria-label={actionAriaLabel}
          className={[
            '-m-1 rounded-[6px] p-1 text-[11.5px] font-medium tracking-[-0.003em]',
            'text-[var(--text-tertiary)]',
            'hover:text-[var(--primary)]',
            FOCUS,
          ].join(' ')}
          style={{ transition: `color 150ms ${EASE_UI}` }}
        >
          {actionIcon ?? actionLabel}
        </button>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal helpers — quiet, one-liners                               */
/* ------------------------------------------------------------------ */

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-dashed border-[var(--border)] px-3 py-3 text-center text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
      {children}
    </div>
  );
}

function ErrorNote({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_5%,transparent)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="text-[var(--danger)]">
          <AlertTriangle size={12} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={`shrink-0 rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] ${FOCUS}`}
        style={{ transition: `background-color 150ms ${EASE_UI}` }}
      >
        Retry
      </button>
    </div>
  );
}

function SkeletonRow({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[11px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
      <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-[8px] bg-[var(--bg-subtle)]">
        <Shimmer />
      </div>
      <div className="flex-1 space-y-1.5">
        <div
          className="relative h-2.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"
          style={{ width }}
        >
          <Shimmer />
        </div>
        <div className="relative h-2.5 w-1/2 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <Shimmer />
        </div>
      </div>
    </div>
  );
}

function Shimmer() {
  return (
    <span
      aria-hidden
      className="absolute inset-0 motion-reduce:hidden"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        animation: 'copilot-shimmer 1.8s ease-in-out infinite',
      }}
    />
  );
}

function InsightsSkeleton() {
  return (
    <>
      <SkeletonRow width="65%" />
      <SkeletonRow width="50%" />
    </>
  );
}

function SuggestionsSkeleton() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="relative h-7 overflow-hidden rounded-[8px] bg-[var(--bg-surface)]"
        >
          <Shimmer />
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Time formatting — accepts Date or ISO string                       */
/* ------------------------------------------------------------------ */

function formatUpdated(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';

  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default CopilotContextPanel;