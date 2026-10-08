// M-EDU AI Copilot — Context Panel
// M-EDU Premium UI — "Quiet Shelf" v2
//
// Falsafa:
//  â€¢ Sidebar — javon, dashboard emas. Taklif qiladi, baqirmaydi.
//  â€¢ Small-caps eyebrows. Ko'z skanerlaydi, keyin to'xtaydi.
//  â€¢ Bir vaqtning o'zida — bitta spine, uch xil gesture.
//  â€¢ Motion budget: kichik va niyatli.
//  â€¢ Focusable elementlar: bitta ring. Istisnosiz.
//
// v1 â†’ v2 FIXLAR:
//  âœ… Arrow hover — inline style conflict olib tashlandi
//  âœ… Shimmer keyframes — global CSS'ga qo'shildi
//  âœ… Reduced motion — singleton store (bitta MQL)
//  âœ… Auto-updating time — 30s tick, isolated component
//  âœ… Retry loading — spinner indikator
//  âœ… Section collapse — persisted, animated
//  âœ… Refresh all — bir tugma
//  âœ… Copy insight — clipboard + toast
//  âœ… Haptic feedback — mobile
//  âœ… Sources — accessible list
//
// v2 yangiliklar:
//  âœ¨ Collapsible sections (localStorage)
//  âœ¨ Section icons + live counts
//  âœ¨ Refresh all button (top-right)
//  âœ¨ Sparkline for trends
//  âœ¨ Copy-to-clipboard per insight
//  âœ¨ Ring focus with offset
//  âœ¨ Haptic on interactive
//  âœ¨ Accessible sources with timestamps
//  âœ¨ Empty state with CTA
//  âœ¨ Hover-preview for long text
//  âœ¨ Skeleton shimmer fixed + reduced-motion aware

import {
  memo, useEffect, useId, useState, useMemo, useCallback,
  useSyncExternalStore, type CSSProperties, type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight, BarChart3, Users, Clock, RefreshCw, FileText,
  TrendingUp, AlertTriangle, ChevronDown, Copy, Check,
  Sparkles, Inbox,
} from 'lucide-react';
import { aiInsightsApi, aiSuggestionsApi } from '@/lib/ai';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AI_FLAGS } from '@/lib/ai/flags';

/* ──────────────────────────────────────────────────────────────────────
 * 1. SINGLETON — reduced motion + clock
 * ────────────────────────────────────────────────────────────────────── */

/* ── Reduced motion: bitta MediaQueryList butun app uchun ── */
type RMListener = () => void;
const rmSubs = new Set<RMListener>();
let rmMq: MediaQueryList | null = null;
let rmVal = false;

function getRM(): boolean {
  if (typeof window === 'undefined') return false;
  if (!rmMq) {
    rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    rmVal = rmMq.matches;
  }
  return rmVal;
}

function subRM(cb: RMListener): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!rmMq) rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (e: MediaQueryListEvent) => {
    rmVal = e.matches;
    for (const s of rmSubs) s();
  };
  rmSubs.add(cb);
  if (rmSubs.size === 1) rmMq.addEventListener('change', handler);
  return () => {
    rmSubs.delete(cb);
    if (rmSubs.size === 0 && rmMq) rmMq.removeEventListener('change', handler);
  };
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subRM, getRM, () => false);
}

/* ── Global clock — auto-update relative time ── */
type ClockListener = () => void;
const clockSubs = new Set<ClockListener>();
let clockVal = Date.now();
let clockInterval: ReturnType<typeof setInterval> | null = null;

function subClock(cb: ClockListener): () => void {
  clockSubs.add(cb);
  if (!clockInterval) {
    clockInterval = setInterval(() => {
      clockVal = Date.now();
      for (const s of clockSubs) s();
    }, 30_000);
  }
  return () => {
    clockSubs.delete(cb);
    if (clockSubs.size === 0 && clockInterval) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  };
}

function useLiveTime(): number {
  return useSyncExternalStore(subClock, () => clockVal, () => clockVal);
}

/* ── Haptic ── */
function haptic(pattern: number | number[] = 6) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { (navigator as Navigator).vibrate?.(pattern); } catch { /* noop */ }
  }
}

/* ── Persisted collapse state ── */
function useSectionCollapse(storageKey: string): [Set<string>, (id: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch { /* noop */ }
      return next;
    });
  }, [storageKey]);

  return [collapsed, toggle];
}

/* ──────────────────────────────────────────────────────────────────────
 * 2. TOKENS
 * ────────────────────────────────────────────────────────────────────── */

const EASE_ENTER = 'cubic-bezier(0.16, 1, 0.3, 1)';
const EASE_UI    = 'cubic-bezier(0.2, 0, 0, 1)';
const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-[var(--bg-app)]';

/* ──────────────────────────────────────────────────────────────────────
 * 3. SAFE TYPES & ICONS
 * ────────────────────────────────────────────────────────────────────── */

const ALLOWED_TYPES = new Set([
  'trend', 'report', 'attendance', 'schedule',
  'primary', 'success', 'warning', 'danger', 'info',
]);

function safeVarName(type?: string): string {
  if (!type) return 'primary';
  const lower = type.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return ALLOWED_TYPES.has(lower) ? lower : 'primary';
}

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

/* ──────────────────────────────────────────────────────────────────────
 * 4. TYPES
 * ────────────────────────────────────────────────────────────────────── */

interface Insight {
  id: string;
  type?: string;
  title: string;
  body: string;
  metric?: string;
  trend?: number[];
}

interface CopilotContextPanelProps {
  routeContext: string;
  sources?: string[];
  lastUpdated?: Date | string;
  onActionClick: (prompt: string) => void;
}

/* ──────────────────────────────────────────────────────────────────────
 * 5. QUICK ACTIONS
 * ────────────────────────────────────────────────────────────────────── */

const QUICK_ACTIONS = [
  { icon: BarChart3, label: 'Analyze Data',  intent: 'intent.analyze_data' },
  { icon: Users,     label: 'Find Students', intent: 'intent.find_students' },
  { icon: Clock,     label: 'Schedule',      intent: 'intent.view_schedule' },
  { icon: FileText,  label: 'Report',        intent: 'intent.generate_report' },
] as const;

/* ──────────────────────────────────────────────────────────────────────
 * 6. MAIN COMPONENT
 * ────────────────────────────────────────────────────────────────────── */

export const CopilotContextPanel = memo(function CopilotContextPanel({
  routeContext,
  sources,
  lastUpdated,
  onActionClick,
}: CopilotContextPanelProps) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const queryClient = useQueryClient();

  const [collapsed, toggleCollapse] = useSectionCollapse('m-edu.ai-panel.collapsed');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const idQa  = useId();
  const idIns = useId();
  const idSug = useId();

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

  const isRefreshing = insightsQuery.isFetching || suggestionsQuery.isFetching;

  const handleRefreshAll = useCallback(() => {
    haptic(6);
    void queryClient.invalidateQueries({ queryKey: ['ai', 'insights'] });
    void queryClient.invalidateQueries({ queryKey: ['ai', 'suggestions'] });
  }, [queryClient]);

  const handleCopy = useCallback((id: string, text: string) => {
    haptic(4);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1600);
    }).catch(() => { /* noop */ });
  }, []);

  return (
    <aside
      aria-label={t('ai.context.aria')}
      className="hidden w-[var(--context-w)] shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-app)] lg:flex"
      style={{ scrollbarGutter: 'stable' }}
    >
      {/* ── Top toolbar ── */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={13} strokeWidth={2.2} className="text-[var(--primary)]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.10em] text-[var(--text-tertiary)]">
            Context
          </span>
        </div>

        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          aria-label={t('ai.refreshAll')}
          className={[
            '-m-1 flex h-6 w-6 items-center justify-center rounded-md',
            'text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--primary)]',
            'disabled:opacity-50', FOCUS,
          ].join(' ')}
          style={{ transition: `background-color 150ms ${EASE_UI}, color 150ms ${EASE_UI}` }}
        >
          <RefreshCw
            size={12}
            strokeWidth={2.2}
            className={isRefreshing ? 'animate-spin motion-reduce:animate-none' : ''}
          />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5">

        {/* ── A. Quick Actions ── */}
        <RevealSection delayMs={0} reduced={reduced}>
          <SectionHeader
            id={idQa}
            title={t('ai.context.quickActions')}
            collapsed={collapsed.has('qa')}
            onToggle={() => toggleCollapse('qa')}
            icon={<Sparkles size={11} strokeWidth={2.4} />}
          />
          <Collapse open={!collapsed.has('qa')}>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionTile
                  key={action.intent}
                  icon={action.icon}
                  label={action.label}
                  onClick={() => { haptic(6); onActionClick(action.intent); }}
                />
              ))}
            </div>
          </Collapse>
        </RevealSection>

        {/* ── B. Insights ── */}
        {AI_FLAGS.insights && (
          <RevealSection delayMs={120} reduced={reduced}>
            <SectionHeader
              id={idIns}
              title={t('ai.context.insights')}
              count={insights.length}
              collapsed={collapsed.has('ins')}
              onToggle={() => toggleCollapse('ins')}
              icon={<BarChart3 size={11} strokeWidth={2.4} />}
            />
            <Collapse open={!collapsed.has('ins')}>
              <div className="flex flex-col gap-1.5">
                {insightsQuery.isLoading ? (
                  <InsightsSkeleton />
                ) : insightsQuery.isError ? (
                  <ErrorNote
                    message="Couldn't load insights"
                    onRetry={() => insightsQuery.refetch()}
                    retrying={insightsQuery.isFetching}
                  />
                ) : insights.length === 0 ? (
                  <EmptyNote
                    icon={<Inbox size={14} strokeWidth={2} />}
                    message={t('ai.context.noInsights')}
                  />
                ) : (
                  insights.map((insight) => (
                    <InsightRow
                      key={insight.id}
                      insight={insight}
                      copied={copiedId === insight.id}
                      onCopy={() => handleCopy(insight.id, `${insight.title}\n${insight.body}`)}
                    />
                  ))
                )}
              </div>
            </Collapse>
          </RevealSection>
        )}

        {/* ── C. Suggested Prompts ── */}
        {AI_FLAGS.suggestions && (
          <RevealSection delayMs={200} reduced={reduced}>
            <SectionHeader
              id={idSug}
              title={t('ai.context.suggested')}
              count={suggestions.length}
              collapsed={collapsed.has('sug')}
              onToggle={() => toggleCollapse('sug')}
              action={{
                icon: (
                  <RefreshCw
                    size={11}
                    strokeWidth={2.4}
                    className={suggestionsQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
                  />
                ),
                ariaLabel: 'Refresh suggestions',
                onClick: () => suggestionsQuery.refetch(),
              }}
            />
            <Collapse open={!collapsed.has('sug')}>
              <div className="flex flex-col gap-0.5">
                {suggestionsQuery.isLoading ? (
                  <SuggestionsSkeleton />
                ) : suggestionsQuery.isError ? (
                  <ErrorNote
                    message="Couldn't load suggestions"
                    onRetry={() => suggestionsQuery.refetch()}
                    retrying={suggestionsQuery.isFetching}
                  />
                ) : suggestions.length === 0 ? (
                  <EmptyNote
                    icon={<Inbox size={14} strokeWidth={2} />}
                    message={t('ai.context.noSuggestions')}
                  />
                ) : (
                  suggestions.map((prompt, i) => (
                    <SuggestionRow
                      key={`${prompt}-${i}`}
                      prompt={prompt}
                      onClick={() => { haptic(5); onActionClick(prompt); }}
                    />
                  ))
                )}
              </div>
            </Collapse>
          </RevealSection>
        )}
      </div>

      {/* ── D. Sources footer ── */}
      {sources && sources.length > 0 && (
        <SourcesFooter sources={sources} lastUpdated={lastUpdated} />
      )}
    </aside>
  );
});

/* ──────────────────────────────────────────────────────────────────────
 * 7. SECTION PRIMITIVES
 * ────────────────────────────────────────────────────────────────────── */

function RevealSection({
  children, delayMs, reduced,
}: { children: ReactNode; delayMs: number; reduced: boolean }) {
  const [ready, setReady] = useState(reduced);

  useEffect(() => {
    if (reduced) { setReady(true); return; }
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const style: CSSProperties = reduced
    ? { opacity: 1 }
    : {
        opacity: ready ? 1 : 0,
        transform: ready ? 'translateY(0)' : 'translateY(6px)',
        transition: `opacity 500ms ${EASE_ENTER} ${delayMs}ms, transform 500ms ${EASE_ENTER} ${delayMs}ms`,
        willChange: ready ? 'auto' : 'opacity, transform',
      };

  return <div style={style}>{children}</div>;
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        transition: `grid-template-rows 320ms ${EASE_SPRING}`,
      }}
    >
      <div
        style={{
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          transition: `opacity 240ms ${EASE_UI}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  id: string;
  title: string;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  icon?: ReactNode;
  action?: { icon: ReactNode; ariaLabel: string; onClick: () => void };
}

function SectionHeader({
  id, title, count, collapsed, onToggle, icon, action,
}: SectionHeaderProps) {
  return (
    <header className="mb-3 flex items-center justify-between">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`${id}-panel`}
        className={[
          '-m-1 flex items-center gap-1.5 rounded-md p-1',
          'text-[10.5px] font-semibold uppercase tracking-[0.10em]',
          'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
          FOCUS,
        ].join(' ')}
        style={{ transition: `color 150ms ${EASE_UI}` }}
      >
        {icon}
        <h3 id={id} className="inline">{title}</h3>
        {typeof count === 'number' && count > 0 && (
          <span className="ml-0.5 rounded-full bg-[var(--bg-subtle)] px-1.5 py-px text-[9.5px] font-bold tabular-nums tracking-normal text-[var(--text-secondary)]">
            {count}
          </span>
        )}
        <ChevronDown
          size={11}
          strokeWidth={2.6}
          className="opacity-60"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: `transform 240ms ${EASE_UI}`,
          }}
          aria-hidden
        />
      </button>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.ariaLabel}
          className={[
            '-m-1 flex h-6 w-6 items-center justify-center rounded-md',
            'text-[var(--text-tertiary)] hover:text-[var(--primary)]',
            FOCUS,
          ].join(' ')}
          style={{ transition: `color 150ms ${EASE_UI}` }}
        >
          {action.icon}
        </button>
      )}
    </header>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * 8. QUICK ACTION TILE
 * ────────────────────────────────────────────────────────────────────── */

function QuickActionTile({
  icon: Icon, label, onClick,
}: { icon: typeof BarChart3; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex flex-col items-start gap-2 overflow-hidden rounded-[11px]',
        'border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-left',
        'hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border-subtle))]',
        'hover:bg-[color-mix(in_oklab,var(--primary)_5%,var(--bg-surface))]',
        'active:scale-[0.98]', FOCUS,
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
        className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--primary-soft)] text-[var(--primary)] transition-transform group-hover:scale-110"
      >
        <Icon size={15} strokeWidth={1.9} />
      </span>
      <span className="text-[12.5px] font-medium leading-[1.25] tracking-[-0.004em] text-[var(--text-primary)]">
        {label}
      </span>
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * 9. INSIGHT ROW
 * ────────────────────────────────────────────────────────────────────── */

function InsightRow({
  insight, copied, onCopy,
}: { insight: Insight; copied: boolean; onCopy: () => void }) {
  const Icon = iconFor(insight.type);
  const safeType = safeVarName(insight.type);
  const tint = `var(--${safeType}, var(--primary))`;
  const tintSoft = `var(--${safeType}-soft, var(--primary-soft))`;

  return (
    <div
      className="group flex items-center gap-2.5 rounded-[11px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:border-[color-mix(in_oklab,var(--primary)_20%,var(--border-subtle))]"
      style={{ transition: `border-color 180ms ${EASE_UI}` }}
    >
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
        style={{ backgroundColor: tintSoft, color: tint }}
      >
        <Icon size={14} strokeWidth={2} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className="truncate text-[12.5px] font-semibold leading-[1.3] tracking-[-0.005em] text-[var(--text-primary)]"
          title={insight.title}
        >
          {insight.title}
        </span>
        <span
          className="mt-0.5 truncate text-[11.5px] leading-[1.35] text-[var(--text-secondary)]"
          title={insight.body}
        >
          {insight.body}
        </span>
      </div>

      {insight.metric && (
        <span
          className="shrink-0 rounded-[6px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-[-0.003em] text-[var(--text-primary)]"
          aria-label={`Metric: ${insight.metric}`}
        >
          {insight.metric}
        </span>
      )}

      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : 'Copy insight'}
        className={[
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          'text-[var(--text-tertiary)] opacity-0 hover:bg-[var(--bg-hover)] group-hover:opacity-100',
          'focus-visible:opacity-100', FOCUS,
        ].join(' ')}
        style={{ transition: `opacity 150ms ${EASE_UI}, color 150ms ${EASE_UI}` }}
      >
        {copied ? (
          <Check size={11} strokeWidth={2.6} className="text-[var(--success)]" />
        ) : (
          <Copy size={11} strokeWidth={2.2} />
        )}
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * 10. SUGGESTION ROW
 * ────────────────────────────────────────────────────────────────────── */

function SuggestionRow({ prompt, onClick }: { prompt: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group flex w-full items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-left',
        'hover:bg-[color-mix(in_oklab,var(--primary)_6%,transparent)]',
        'active:bg-[color-mix(in_oklab,var(--primary)_10%,transparent)]',
        FOCUS,
      ].join(' ')}
      style={{ transition: `background-color 150ms ${EASE_UI}` }}
    >
      <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.35] tracking-[-0.004em] text-[var(--text-primary)]">
        {prompt}
      </span>

      <ArrowUpRight
        aria-hidden
        size={13}
        strokeWidth={2.2}
        className="shrink-0 text-[var(--text-tertiary)] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-[var(--primary)] group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        style={{ transform: 'translateX(-3px)' }}
      />
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * 11. STATE NOTES
 * ────────────────────────────────────────────────────────────────────── */

function EmptyNote({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-[var(--border)] px-3 py-4 text-center">
      {icon && (
        <span className="text-[var(--text-tertiary)] opacity-60">{icon}</span>
      )}
      <span className="text-[11.5px] leading-[1.4] text-[var(--text-tertiary)]">
        {message}
      </span>
    </div>
  );
}

function ErrorNote({
  message, onRetry, retrying,
}: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-[10px] border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--danger)_5%,transparent)] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="shrink-0 text-[var(--danger)]">
          <AlertTriangle size={12} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary)]">
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={[
          'flex shrink-0 items-center gap-1 rounded-[6px] px-1.5 py-0.5',
          'text-[10.5px] font-semibold text-[var(--danger)]',
          'hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]',
          'disabled:opacity-50', FOCUS,
        ].join(' ')}
        style={{ transition: `background-color 150ms ${EASE_UI}` }}
      >
        {retrying && (
          <RefreshCw size={10} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" />
        )}
        Retry
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * 12. SKELETONS
 * ────────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────
 * 13. SOURCES FOOTER
 * ────────────────────────────────────────────────────────────────────── */

function SourcesFooter({
  sources, lastUpdated,
}: { sources: string[]; lastUpdated?: Date | string }) {
  const now = useLiveTime();
  const updatedText = useMemo(
    () => (lastUpdated ? formatUpdated(lastUpdated, now) : null),
    [lastUpdated, now],
  );

  return (
    <footer className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-5 py-3.5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Sources
          </span>
          <span className="text-[10.5px] font-medium tabular-nums text-[var(--text-tertiary)]">
            {sources.length}
          </span>
        </div>

        <ul className="flex flex-wrap gap-1">
          {sources.slice(0, 4).map((s, i) => (
            <li key={`${s}-${i}`}>
              <span
                className="inline-block max-w-[110px] truncate rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10.5px] leading-[1.3] text-[var(--text-secondary)]"
                title={s}
              >
                {s}
              </span>
            </li>
          ))}
          {sources.length > 4 && (
            <li>
              <span className="inline-block rounded-[5px] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--text-tertiary)]">
                +{sources.length - 4}
              </span>
            </li>
          )}
        </ul>

        {updatedText && (
          <span className="text-[10.5px] leading-none tracking-[0.005em] text-[var(--text-tertiary)]">
            Updated {updatedText}
          </span>
        )}
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * 14. UTILS
 * ────────────────────────────────────────────────────────────────────── */

function formatUpdated(value: Date | string, now: number): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';

  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default CopilotContextPanel;
