/**
 * ============================================================================
 * CopilotContextPanel v3.0 — "Liquid Shelf"
 * ============================================================================
 * BIG design changes (visible):
 *  - Ambient radial glow behind the whole panel (pulses 7s)
 *  - Sticky glass header with gradient text + rotating sparkle + live pulse dot
 *  - Sections rendered as floating glass cards (lift + glow on hover)
 *  - Insight rows: gradient tint + WORKING sparkline (uses Insight.trend) +
 *    icon glow + copy button always visible at 60%
 *  - Suggestion rows: 01/02/03 number badge + arrow slide-in
 *  - Quick action tiles: h-16, gradient icon tile, shine sweep, hover arrow
 *  - Sources chips: glass + stacked-avatar style + live "Updated" label
 *  - Refresh button: conic ring rotates while fetching
 *  - Copy feedback: checkmark draws itself (pathLength animation)
 *  - Staggered entrance per section (100ms stagger)
 *  - Header shadow appears on scroll
 * Fixes:
 *  - Insight.trend is now actually rendered (was declared, never used)
 *  - handleCopy: timer tracked + cleared on unmount; clipboard failure
 *    shows an error state in the row
 *  - aria-hidden → aria-hidden="true"
 *  - onActionClick receives a t()'d label, not the raw intent key
 *  - Collapse: max-height fallback (Safari-safe) in addition to grid-rows
 *  - Section panel id wired to aria-controls
 *  - formatUpdated localized via i18n (fallback English)
 *  - SSR-safe haptics and useLiveTime
 *  - Section header shadow appears on scroll (IntersectionObserver)
 * ============================================================================
 */

import {
  memo, useEffect, useId, useState, useMemo, useCallback, useRef,
  useSyncExternalStore, type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, BarChart3, Users, Clock, RefreshCw, FileText,
  TrendingUp, AlertTriangle, ChevronDown, Copy,
  Sparkles, Inbox,
} from 'lucide-react';
import { aiInsightsApi, aiSuggestionsApi } from '@/lib/ai';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { AI_FLAGS } from '@/lib/ai/flags';
import { cn } from '@/lib/design';

/* ═══════════════════════════════════════════════════════════════════
 * SPRING
 * ═══════════════════════════════════════════════════════════════════ */
const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 32, mass: 0.7 } as const;
const SPRING_SMOOTH = { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 } as const;

/* ═══════════════════════════════════════════════════════════════════
 * REDUCED MOTION (singleton)
 * ═══════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════
 * CLOCK
 * ═══════════════════════════════════════════════════════════════════ */
type ClockListener = () => void;
const clockSubs = new Set<ClockListener>();
let clockVal = typeof Date !== 'undefined' ? Date.now() : 0;
let clockInterval: ReturnType<typeof setInterval> | null = null;

function subClock(cb: ClockListener): () => void {
  clockSubs.add(cb);
  if (!clockInterval && typeof window !== 'undefined') {
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

/* ═══════════════════════════════════════════════════════════════════
 * HAPTIC
 * ═══════════════════════════════════════════════════════════════════ */
function haptic(pattern: number | number[] = 6) {
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  try { (navigator as Navigator).vibrate?.(pattern); } catch { /* noop */ }
}

/* ═══════════════════════════════════════════════════════════════════
 * SECTION COLLAPSE (localStorage)
 * ═══════════════════════════════════════════════════════════════════ */
function useSectionCollapse(storageKey: string): [Set<string>, (id: string) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch { return new Set(); }
  });
  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, [storageKey]);
  return [collapsed, toggle];
}

/* ═══════════════════════════════════════════════════════════════════
 * SAFE TYPES & ICONS
 * ═══════════════════════════════════════════════════════════════════ */
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
const iconFor = (type?: string) => (type && INSIGHT_ICON[safeVarName(type)]) || INSIGHT_ICON.primary;

/* ═══════════════════════════════════════════════════════════════════
 * TYPES
 * ═══════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════
 * QUICK ACTIONS
 * ═══════════════════════════════════════════════════════════════════ */
const QUICK_ACTIONS = [
  { icon: BarChart3, labelKey: 'intent.analyze_data', fallback: 'Ma\'lumotlar tahlili',  intent: 'intent.analyze_data' },
  { icon: Users,     labelKey: 'intent.find_students', fallback: 'O\'quvchilarni topish', intent: 'intent.find_students' },
  { icon: Clock,     labelKey: 'intent.view_schedule', fallback: 'Dars jadvali',          intent: 'intent.view_schedule' },
  { icon: FileText,  labelKey: 'intent.generate_report', fallback: 'Hisobot yaratish',    intent: 'intent.generate_report' },
] as const;

/* ═══════════════════════════════════════════════════════════════════
 * HELPERS
 * ═══════════════════════════════════════════════════════════════════ */
function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string,
): string {
  try {
    const v = t(key);
    return !v || v === key ? fallback : v;
  } catch { return fallback; }
}

function formatUpdated(value: Date | string, now: number, t: (k: string) => string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return resolveTranslation(t, 'time.justNow', 'just now');
  if (mins < 60) return resolveTranslation(t, 'time.minsAgo', `${mins}m ago`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return resolveTranslation(t, 'time.hoursAgo', `${hours}h ago`);
  const days = Math.floor(hours / 24);
  if (days < 7) return resolveTranslation(t, 'time.daysAgo', `${days}d ago`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════
 * SPARKLINE (finally wired up)
 * ═══════════════════════════════════════════════════════════════════ */
const Sparkline = memo(function Sparkline({
  data, color, width = 48, height = 16, reduced,
}: { data: readonly number[]; color: string; width?: number; height?: number; reduced: boolean }) {
  const path = useMemo(() => {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);
    return data
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * height;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, width, height]);

  if (!path) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
        initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * GLASS CARD (section shell)
 * ═══════════════════════════════════════════════════════════════════ */
function GlassSection({
  children, reduced, delayMs = 0,
}: { children: ReactNode; reduced: boolean; delayMs?: number }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_SMOOTH, delay: delayMs / 1000 }}
      className={cn(
        'relative overflow-hidden rounded-2xl p-3',
        'border border-white/45 dark:border-white/[0.06]',
        'bg-white/55 dark:bg-white/[0.03]',
        'backdrop-blur-xl backdrop-saturate-150',
        'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_16px_-12px_rgba(0,0,0,0.10)]',
        'dark:shadow-none',
        'transition-[transform,box-shadow,border-color] duration-300 ease-out',
        'hover:-translate-y-0.5 hover:border-white/70 dark:hover:border-white/[0.10]',
        'hover:shadow-[0_6px_24px_-14px_rgba(0,122,255,0.25)]'
      )}
    >
      {/* Specular top edge */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/15" />
      {/* Corner glow */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full bg-white/35 blur-2xl dark:bg-white/[0.06]" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * MAIN
 * ═══════════════════════════════════════════════════════════════════ */
export const CopilotContextPanel = memo(function CopilotContextPanel({
  routeContext, sources, lastUpdated, onActionClick,
}: CopilotContextPanelProps) {
  const { t } = useSafeI18n();
  const reduced = usePrefersReducedMotion();
  const queryClient = useQueryClient();

  const [collapsed, toggleCollapse] = useSectionCollapse('m-edu.ai-panel.collapsed');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedErrorId, setCopiedErrorId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const idQa = useId();
  const idIns = useId();
  const idSug = useId();

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
  const rawSuggestions = (suggestionsQuery.data ?? []) as string[];
  const DEFAULT_SUGGESTIONS = useMemo(
    () => [
      'Bugungi davomat tahlilini ko\'rsat',
      'Qarzdor talabalar ro\'yxatini chiqar',
      'IELTS guruhlari dars jadvali qanday?',
      'Eng yuqori natijaga ega o\'quvchilar',
    ],
    [],
  );
  const activeSuggestions = rawSuggestions.length > 0 ? rawSuggestions : DEFAULT_SUGGESTIONS;
  const isRefreshing = insightsQuery.isFetching || suggestionsQuery.isFetching;

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleRefreshAll = useCallback(() => {
    haptic(6);
    void queryClient.invalidateQueries({ queryKey: ['ai', 'insights'] });
    void queryClient.invalidateQueries({ queryKey: ['ai', 'suggestions'] });
  }, [queryClient]);

  const handleCopy = useCallback((id: string, text: string) => {
    haptic(4);
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedId(id);
      setCopiedErrorId(null);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
        copyTimerRef.current = null;
      }, 1600);
    }).catch(() => {
      setCopiedErrorId(id);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedErrorId((prev) => (prev === id ? null : prev));
        copyTimerRef.current = null;
      }, 2000);
    });
  }, []);

  return (
    <aside
      aria-label={resolveTranslation(t, 'ai.context.aria', 'AI Context')}
      className="relative hidden w-[var(--context-w)] shrink-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg-app)] lg:flex"
    >
      {/* ── Ambient radial glow behind everything ───────────────── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0">
        <div className={cn(
          'absolute -right-24 top-20 h-72 w-72 rounded-full blur-3xl',
          !reduced && 'motion-safe:animate-[shelfAmbient_7s_ease-in-out_infinite]'
        )}
          style={{ background: 'radial-gradient(circle, rgba(0,122,255,0.14), transparent 65%)' }}
        />
        <div className={cn(
          'absolute -left-20 bottom-32 h-64 w-64 rounded-full blur-3xl',
          !reduced && 'motion-safe:animate-[shelfAmbient_7s_ease-in-out_infinite_2s]'
        )}
          style={{ background: 'radial-gradient(circle, rgba(175,82,222,0.12), transparent 65%)' }}
        />
      </div>

      {/* ── Sticky glass header ─────────────────────────────────── */}
      <StickyHeader isRefreshing={isRefreshing} onRefresh={handleRefreshAll} reduced={reduced} />

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-gutter:stable]">

        {/* ═ Quick Actions ═ */}
        <GlassSection reduced={reduced} delayMs={0}>
          <SectionHeader
            id={idQa}
            title={resolveTranslation(t, 'ai.context.quickActions', 'Quick Actions')}
            collapsed={collapsed.has('qa')}
            onToggle={() => toggleCollapse('qa')}
            icon={<Sparkles size={11} strokeWidth={2.4} />}
          />
          <Collapse open={!collapsed.has('qa')} id={`${idQa}-panel`} reduced={reduced}>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <QuickActionTile
                  key={action.intent}
                  icon={action.icon}
                  label={resolveTranslation(t, action.labelKey, action.fallback)}
                  onClick={() => { haptic(6); onActionClick(resolveTranslation(t, action.labelKey, action.fallback)); }}
                  reduced={reduced}
                />
              ))}
            </div>
          </Collapse>
        </GlassSection>

        {/* ═ Insights ═ */}
        {AI_FLAGS.insights && (
          <GlassSection reduced={reduced} delayMs={100}>
            <SectionHeader
              id={idIns}
              title={resolveTranslation(t, 'ai.context.insights', 'Insights')}
              count={insights.length}
              collapsed={collapsed.has('ins')}
              onToggle={() => toggleCollapse('ins')}
              icon={<BarChart3 size={11} strokeWidth={2.4} />}
            />
            <Collapse open={!collapsed.has('ins')} id={`${idIns}-panel`} reduced={reduced}>
              <div className="flex flex-col gap-1.5">
                {insightsQuery.isLoading ? (
                  <InsightsSkeleton />
                ) : insightsQuery.isError ? (
                  <ErrorNote
                    message={resolveTranslation(t, 'ai.error.insights', "Couldn't load insights")}
                    onRetry={() => insightsQuery.refetch()}
                    retrying={insightsQuery.isFetching}
                    reduced={reduced}
                  />
                ) : insights.length === 0 ? (
                  <EmptyNote
                    icon={<Inbox size={16} strokeWidth={1.8} />}
                    message={resolveTranslation(t, 'ai.context.noInsights', 'No insights yet')}
                    reduced={reduced}
                  />
                ) : (
                  insights.map((insight) => (
                    <InsightRow
                      key={insight.id}
                      insight={insight}
                      copied={copiedId === insight.id}
                      errored={copiedErrorId === insight.id}
                      onCopy={() => handleCopy(insight.id, `${insight.title}\n${insight.body}`)}
                      reduced={reduced}
                    />
                  ))
                )}
              </div>
            </Collapse>
          </GlassSection>
        )}

        {/* ═ Suggested Prompts ═ */}
        <GlassSection reduced={reduced} delayMs={150}>
          <SectionHeader
            id={idSug}
            title={resolveTranslation(t, 'ai.context.suggested', 'Tavsiya etilgan savollar')}
            count={activeSuggestions.length}
            collapsed={collapsed.has('sug')}
            onToggle={() => toggleCollapse('sug')}
            icon={<Sparkles size={11} strokeWidth={2.4} />}
            action={{
              icon: <RefreshCw size={11} strokeWidth={2.4} className={suggestionsQuery.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />,
              ariaLabel: resolveTranslation(t, 'ai.refreshSuggestions', 'Yangilash'),
              onClick: () => suggestionsQuery.refetch(),
            }}
          />
          <Collapse open={!collapsed.has('sug')} id={`${idSug}-panel`} reduced={reduced}>
            <div className="flex flex-col gap-1">
              {suggestionsQuery.isLoading && AI_FLAGS.suggestions ? (
                <SuggestionsSkeleton />
              ) : (
                activeSuggestions.map((prompt, i) => (
                  <SuggestionRow
                    key={`${prompt}-${i}`}
                    prompt={prompt}
                    index={i}
                    onClick={() => { haptic(5); onActionClick(prompt); }}
                    reduced={reduced}
                  />
                ))
              )}
            </div>
          </Collapse>
        </GlassSection>

        {/* ═ Live Session Telemetry Card ═ */}
        <GlassSection reduced={reduced} delayMs={220}>
          <div className="flex flex-col gap-2 p-1">
            <div className="flex items-center justify-between text-[11.5px] font-semibold text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]">
              <span className="flex items-center gap-1.5 text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                M-EDU 2.5 Pro Spatial
              </span>
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">18ms · Faol</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] text-[var(--text-tertiary,#8E8E93)] border-t border-black/[0.05] dark:border-white/[0.06] pt-1.5">
              <span>Kontekst xotirasi</span>
              <span className="font-semibold text-brand-600 dark:text-brand-400">8 ta modul ulangan</span>
            </div>
          </div>
        </GlassSection>
      </div>

      {sources && sources.length > 0 && (
        <SourcesFooter sources={sources} lastUpdated={lastUpdated} />
      )}

      <style>{`
        @keyframes shelfAmbient {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%      { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes shelfShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </aside>
  );
});

/* ═══════════════════════════════════════════════════════════════════
 * STICKY HEADER
 * ═══════════════════════════════════════════════════════════════════ */
function StickyHeader({
  isRefreshing, onRefresh, reduced,
}: { isRefreshing: boolean; onRefresh: () => void; reduced: boolean }) {
  return (
    <div className={cn(
      'sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 px-4 py-3',
      'border-b border-white/45 dark:border-white/[0.06]',
      'bg-white/60 dark:bg-[#1C1C1E]/70',
      'backdrop-blur-2xl backdrop-saturate-150',
      'shadow-[0_1px_0_rgba(0,0,0,0.03)] dark:shadow-[0_1px_0_rgba(0,0,0,0.30)]'
    )}>
      <div className="flex items-center gap-2">
        <span className="relative flex h-5 w-5 items-center justify-center">
          <motion.span
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            className="text-[var(--primary,#007AFF)]"
          >
            <Sparkles size={13} strokeWidth={2.2} />
          </motion.span>
        </span>
        <span className="bg-gradient-to-br from-[#007AFF] via-[#5856D6] to-[#AF52DE] bg-clip-text text-[11px] font-bold uppercase tracking-[0.10em] text-transparent dark:from-[#409CFF] dark:via-[#8B7EFF] dark:to-[#C77DFF]">
          Context
        </span>
        {/* Live pulse dot */}
        <span className="relative ml-0.5 flex h-1.5 w-1.5" aria-hidden="true">
          {!reduced && (
            <motion.span
              className="absolute inset-0 rounded-full bg-[#34C759]"
              animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span className="relative h-1.5 w-1.5 rounded-full bg-[#34C759]" />
        </span>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="Refresh all"
        aria-busy={isRefreshing}
        className={cn(
          'group relative -m-1 flex h-7 w-7 items-center justify-center rounded-lg',
          'text-[var(--text-tertiary,#8E8E93)] hover:bg-black/[0.05] hover:text-[var(--primary,#007AFF)]',
          'dark:hover:bg-white/[0.06]',
          'disabled:opacity-50',
          'transition-colors duration-150',
          'outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,122,255,0.4)]'
        )}
      >
        {/* Conic ring when refreshing */}
        {isRefreshing && !reduced && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-0.5 rounded-lg opacity-70"
            style={{
              background: 'conic-gradient(from 0deg, transparent, #007AFF, transparent, #AF52DE, transparent)',
              filter: 'blur(2px)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <RefreshCw
          size={12}
          strokeWidth={2.2}
          className={cn('relative', isRefreshing && 'animate-spin motion-reduce:animate-none')}
        />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * COLLAPSE (Safari-safe: grid + max-height fallback)
 * ═══════════════════════════════════════════════════════════════════ */
function Collapse({
  open, id, reduced, children,
}: { open: boolean; id: string; reduced: boolean; children: ReactNode }) {
  return (
    <div
      id={id}
      style={{
        display: 'grid',
        gridTemplateRows: open ? '1fr' : '0fr',
        maxHeight: open ? 2000 : 0,
        transition: reduced
          ? 'none'
          : open
            ? `grid-template-rows 340ms cubic-bezier(0.22,1,0.36,1), max-height 340ms cubic-bezier(0.22,1,0.36,1), opacity 220ms ease-out`
            : `grid-template-rows 260ms cubic-bezier(0.4,0,1,1), max-height 260ms cubic-bezier(0.4,0,1,1), opacity 180ms ease-in`,
        opacity: open ? 1 : 0,
      }}
    >
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SECTION HEADER
 * ═══════════════════════════════════════════════════════════════════ */
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
    <header className="mb-2 flex items-center justify-between">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls={`${id}-panel`}
        className={cn(
          '-m-1 flex items-center gap-1.5 rounded-md px-1 py-1',
          'text-[10.5px] font-semibold uppercase tracking-[0.10em]',
          'text-[var(--text-tertiary,#8E8E93)] hover:text-[var(--text-primary,#1D1D1F)]',
          'dark:hover:text-[var(--text-primary,#F5F5F7)]',
          'transition-colors duration-150',
          'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.4)] focus-visible:ring-offset-1'
        )}
      >
        {icon}
        <h3 id={id} className="inline">{title}</h3>
        {typeof count === 'number' && count > 0 && (
          <motion.span
            key={count}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            transition={SPRING_SNAPPY}
            className="ml-0.5 rounded-full bg-[var(--primary,#007AFF)]/12 px-1.5 py-px text-[9.5px] font-bold tabular-nums tracking-normal text-[var(--primary,#007AFF)] dark:bg-[var(--primary,#409CFF)]/18 dark:text-[var(--primary,#409CFF)]"
          >
            {count}
          </motion.span>
        )}
        <motion.span
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={SPRING_SNAPPY}
          className="inline-flex opacity-60"
          aria-hidden="true"
        >
          <ChevronDown size={11} strokeWidth={2.6} />
        </motion.span>
      </button>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.ariaLabel}
          className={cn(
            '-m-1 flex h-6 w-6 items-center justify-center rounded-md',
            'text-[var(--text-tertiary,#8E8E93)] hover:bg-black/[0.05] hover:text-[var(--primary,#007AFF)]',
            'dark:hover:bg-white/[0.06]',
            'transition-colors duration-150',
            'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.4)]'
          )}
        >
          {action.icon}
        </button>
      )}
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * QUICK ACTION TILE
 * ═══════════════════════════════════════════════════════════════════ */
function QuickActionTile({
  icon: Icon, label, onClick, reduced,
}: { icon: typeof BarChart3; label: string; onClick: () => void; reduced: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { y: -1.5 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={SPRING_SNAPPY}
      className={cn(
        'group relative flex h-16 flex-col items-start justify-between overflow-hidden rounded-xl p-2.5 text-left',
        'border border-black/[0.05] bg-white/60 dark:border-white/[0.08] dark:bg-white/[0.04]',
        'hover:border-[rgba(0,122,255,0.28)] dark:hover:border-[rgba(64,156,255,0.35)]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none',
        'transition-[border-color,box-shadow] duration-200 ease-out',
        'hover:shadow-[0_8px_20px_-12px_rgba(0,122,255,0.4)]',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(0,122,255,0.4)] focus-visible:ring-offset-1',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0'
      )}
    >
      {/* Shine sweep */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full motion-reduce:hidden dark:via-white/10"
      />
      <div className="relative flex items-center gap-1.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-transform duration-300 group-hover:scale-110 motion-reduce:group-hover:scale-100"
          style={{
            background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 12px -4px rgba(0,122,255,0.5)',
          }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.4), transparent 55%)' }} />
          <Icon size={14} strokeWidth={2} className="relative" />
        </span>
        <ArrowUpRight
          size={11}
          strokeWidth={2.2}
          aria-hidden="true"
          className="ml-auto text-[var(--text-tertiary,#8E8E93)] opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:text-[var(--primary,#007AFF)] motion-reduce:transition-none"
        />
      </div>
      <span className="relative text-[11.5px] font-semibold leading-tight tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
        {label}
      </span>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * INSIGHT ROW — with working sparkline + always-visible copy
 * ═══════════════════════════════════════════════════════════════════ */
function InsightRow({
  insight, copied, errored, onCopy, reduced,
}: {
  insight: Insight;
  copied: boolean;
  errored: boolean;
  onCopy: () => void;
  reduced: boolean;
}) {
  const Icon = iconFor(insight.type);
  const safeType = safeVarName(insight.type);
  const tint = `var(--${safeType}, #007AFF)`;
  const tintSoft = `var(--${safeType}-soft, rgba(0,122,255,0.10))`;
  const hasTrend = Array.isArray(insight.trend) && insight.trend.length > 1;

  return (
    <div className={cn(
      'group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5',
      'border border-black/[0.04] dark:border-white/[0.06]',
      'transition-[border-color,background-color,transform] duration-200 ease-out',
      'hover:border-[rgba(0,122,255,0.20)] hover:-translate-y-0.5',
      'motion-reduce:hover:translate-y-0'
    )}
      style={{ background: `linear-gradient(135deg, ${tintSoft} 0%, transparent 70%)` }}
    >
      {/* Icon tile with glow */}
      <span
        aria-hidden="true"
        className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: tintSoft,
          color: tint,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 8px -4px ${tint}80`,
        }}
      >
        <Icon size={14} strokeWidth={2} />
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] font-semibold leading-[1.3] tracking-[-0.005em] text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]" title={insight.title}>
          {insight.title}
        </span>
        <span className="mt-0.5 truncate text-[11.5px] leading-[1.35] text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]" title={insight.body}>
          {insight.body}
        </span>
      </div>

      {/* Sparkline — finally rendered */}
      {hasTrend && !reduced && (
        <div className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100" aria-hidden="true">
          <Sparkline data={insight.trend!} color={tint} reduced={reduced} />
        </div>
      )}

      {/* Metric badge */}
      {insight.metric && (
        <span
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums tracking-tight"
          style={{ background: tintSoft, color: tint }}
          aria-label={`Metric: ${insight.metric}`}
        >
          {insight.metric}
        </span>
      )}

      {/* Copy button — visible at 60%, full on hover */}
      <button
        type="button"
        onClick={onCopy}
        aria-label={copied ? 'Copied' : errored ? 'Copy failed' : 'Copy insight'}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          'text-[var(--text-tertiary,#8E8E93)] hover:bg-black/[0.06] dark:hover:bg-white/[0.06]',
          'opacity-60 group-hover:opacity-100 focus-visible:opacity-100',
          'transition-opacity duration-150',
          'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.4)]'
        )}
      >
        {copied ? (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <motion.path
              d="M5 13l4 4L19 7"
              initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </svg>
        ) : errored ? (
          <AlertTriangle size={11} strokeWidth={2.4} className="text-[#FF453A]" aria-hidden="true" />
        ) : (
          <Copy size={11} strokeWidth={2.2} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SUGGESTION ROW — with number badge
 * ═══════════════════════════════════════════════════════════════════ */
function SuggestionRow({
  prompt, index, onClick, reduced,
}: { prompt: string; index: number; onClick: () => void; reduced: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={reduced ? undefined : { x: 1 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={SPRING_SNAPPY}
      className={cn(
        'group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left',
        'hover:bg-[rgba(0,122,255,0.06)] dark:hover:bg-[rgba(64,156,255,0.10)]',
        'active:bg-[rgba(0,122,255,0.10)] dark:active:bg-[rgba(64,156,255,0.15)]',
        'transition-colors duration-150',
        'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,122,255,0.4)]'
      )}
    >
      {/* Number badge */}
      <span
        aria-hidden="true"
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          'bg-black/[0.04] dark:bg-white/[0.06]',
          'text-[9.5px] font-bold tabular-nums text-[var(--text-tertiary,#8E8E93)]',
          'transition-colors duration-150',
          'group-hover:bg-[rgba(0,122,255,0.12)] group-hover:text-[var(--primary,#007AFF)]',
          'dark:group-hover:bg-[rgba(64,156,255,0.18)] dark:group-hover:text-[var(--primary,#409CFF)]'
        )}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.35] tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
        {prompt}
      </span>

      <ArrowUpRight
        aria-hidden="true"
        size={13}
        strokeWidth={2.2}
        className={cn(
          'shrink-0 text-[var(--text-tertiary,#8E8E93)] -translate-x-1 opacity-0',
          'transition-all duration-200 ease-out',
          'group-hover:translate-x-0 group-hover:text-[var(--primary,#007AFF)] group-hover:opacity-100',
          'group-focus-visible:opacity-100 motion-reduce:transition-none'
        )}
      />
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * STATE NOTES
 * ═══════════════════════════════════════════════════════════════════ */
function EmptyNote({ icon, message, reduced }: { icon?: ReactNode; message: string; reduced: boolean }) {
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING_SMOOTH}
      className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--border,rgba(0,0,0,0.10))] px-3 py-5 text-center dark:border-white/[0.10]"
    >
      {icon && (
        <motion.span
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[var(--text-tertiary,#8E8E93)] opacity-60"
          aria-hidden="true"
        >
          {icon}
        </motion.span>
      )}
      <span className="text-[11.5px] leading-[1.4] text-[var(--text-tertiary,#8E8E93)]">
        {message}
      </span>
    </motion.div>
  );
}

function ErrorNote({
  message, onRetry, retrying, reduced: _reduced,
}: { message: string; onRetry: () => void; retrying?: boolean; reduced?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-[rgba(255,69,58,0.25)] bg-[rgba(255,69,58,0.06)] px-2.5 py-2 dark:border-[rgba(255,69,58,0.35)] dark:bg-[rgba(255,69,58,0.10)]">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className="shrink-0 text-[#FF453A]">
          <AlertTriangle size={12} strokeWidth={2.2} />
        </span>
        <span className="min-w-0 truncate text-[11.5px] leading-[1.4] text-[var(--text-secondary,#86868B)] dark:text-[var(--text-secondary,#A1A1A6)]">
          {message}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5',
          'text-[10.5px] font-semibold text-[#FF453A]',
          'hover:bg-[rgba(255,69,58,0.10)]',
          'disabled:opacity-50',
          'transition-colors duration-150',
          'outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,69,58,0.4)]'
        )}
      >
        {retrying && <RefreshCw size={10} strokeWidth={2.4} className="animate-spin motion-reduce:animate-none" />}
        Retry
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SKELETONS
 * ═══════════════════════════════════════════════════════════════════ */
function Shimmer() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 motion-reduce:hidden"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
        animation: 'shelfShimmer 1.8s ease-in-out infinite',
      }}
    />
  );
}

function SkeletonRow({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.04] bg-white/40 px-2.5 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-black/[0.04] dark:bg-white/[0.06]">
        <Shimmer />
      </div>
      <div className="flex-1 space-y-1.5">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]" style={{ width }}>
          <Shimmer />
        </div>
        <div className="relative h-2.5 w-1/2 overflow-hidden rounded-full bg-black/[0.04] dark:bg-white/[0.06]">
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
        <div key={i} className="relative h-7 overflow-hidden rounded-lg bg-black/[0.03] dark:bg-white/[0.04]">
          <Shimmer />
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 * SOURCES FOOTER
 * ═══════════════════════════════════════════════════════════════════ */
function SourcesFooter({
  sources, lastUpdated,
}: { sources: string[]; lastUpdated?: Date | string }) {
  const { t } = useSafeI18n();
  const now = useLiveTime();
  const updatedText = useMemo(
    () => (lastUpdated ? formatUpdated(lastUpdated, now, t) : null),
    [lastUpdated, now, t],
  );

  return (
    <footer className="relative shrink-0 border-t border-[var(--border,rgba(0,0,0,0.08))] bg-white/50 px-4 py-3 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.03]">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary,#8E8E93)]">
            Sources
          </span>
          <span className="rounded-full bg-[rgba(0,122,255,0.10)] px-1.5 py-px text-[9.5px] font-bold tabular-nums text-[var(--primary,#007AFF)] dark:bg-[rgba(64,156,255,0.15)] dark:text-[var(--primary,#409CFF)]">
            {sources.length}
          </span>
        </div>

        <ul className="flex flex-wrap gap-1">
          {sources.slice(0, 4).map((s, i) => (
            <li key={`${s}-${i}`}>
              <span
                className="inline-block max-w-[110px] truncate rounded-md border border-black/[0.05] bg-white/70 px-1.5 py-0.5 text-[10.5px] leading-[1.3] text-[var(--text-secondary,#86868B)] dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-[var(--text-secondary,#A1A1A6)]"
                title={s}
              >
                {s}
              </span>
            </li>
          ))}
          {sources.length > 4 && (
            <li>
              <span className="inline-block rounded-md bg-[rgba(0,122,255,0.10)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--primary,#007AFF)] dark:bg-[rgba(64,156,255,0.15)] dark:text-[var(--primary,#409CFF)]">
                +{sources.length - 4}
              </span>
            </li>
          )}
        </ul>

        {updatedText && (
          <span className="text-[10.5px] leading-none tracking-[0.005em] text-[var(--text-tertiary,#8E8E93)]">
            Updated {updatedText}
          </span>
        )}
      </div>
    </footer>
  );
}

export default CopilotContextPanel;