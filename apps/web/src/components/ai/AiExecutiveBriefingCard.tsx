/**
 * AiExecutiveBriefingCard — Apple Intelligence Liquid Glass Executive Digest.
 * ============================================================================
 * Provides leadership with a proactive, contextual AI-driven morning briefing:
 * - Live synthesized operational summary in natural Uzbek.
 * - Key operational metrics (attendance %, absentees, risk count, debt).
 * - Prioritized action pills with 1-click execution or deep-link to AI Copilot.
 * ============================================================================
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Users,
  CreditCard,
  GraduationCap,
} from 'lucide-react';
import { aiApi, type AiExecutiveBriefing } from '@/lib/api';
import { cn } from '@/lib/design';

export function AiExecutiveBriefingCard() {
  const [briefing, setBriefing] = useState<AiExecutiveBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBriefing = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await aiApi.getExecutiveBriefing();
      setBriefing(data);
    } catch {
      // Quiet failover if offline or not authenticated
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
  }, []);

  const handleActionClick = (prompt: string) => {
    window.dispatchEvent(
      new CustomEvent('open-ai-copilot', {
        detail: { prompt },
      }),
    );
  };

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl p-5 shadow-sm animate-pulse">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 rounded-md bg-[#007AFF]/20" />
          <div className="h-4 w-44 rounded bg-black/10 dark:bg-white/10" />
        </div>
        <div className="mt-3.5 space-y-2">
          <div className="h-3.5 w-full rounded bg-black/5 dark:bg-white/5" />
          <div className="h-3.5 w-4/5 rounded bg-black/5 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const sentimentColor =
    briefing.sentiment === 'critical'
      ? 'from-rose-500/15 to-orange-500/15 border-rose-500/30'
      : briefing.sentiment === 'attention'
        ? 'from-amber-500/15 to-blue-500/15 border-amber-500/30'
        : 'from-[#007AFF]/15 via-[#5856D6]/10 to-[#AF52DE]/15 border-[#007AFF]/25';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border transition-all duration-300',
        'bg-gradient-to-br backdrop-blur-2xl backdrop-saturate-150',
        'shadow-[0_4px_24px_-8px_rgba(0,122,255,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]',
        'dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]',
        sentimentColor,
      )}
    >
      {/* Specular aurora highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-[#007AFF]/20 to-[#AF52DE]/20 blur-3xl"
      />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-3.5 sm:px-5 pt-3.5 sm:pt-4 pb-2.5 sm:pb-3">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] to-[#5856D6] text-white shadow-sm shadow-[#007AFF]/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="truncate text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                AI Boshqaruv Brifingi
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#007AFF]/10 px-2 py-0.5 text-[10px] font-medium text-[#007AFF] dark:bg-[#007AFF]/20 dark:text-[#64D2FF]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#007AFF] animate-pulse" />
                Jonli tahlil
              </span>
            </div>
            <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
              Bugungi eng muhim operatsion xulosalar va tavsiyalar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button
            type="button"
            onClick={() => fetchBriefing(true)}
            disabled={refreshing}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-colors"
            title="Qayta tahlil qilish"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin text-[#007AFF]')} />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-black/5 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-100 transition-colors"
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main briefing content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3.5 sm:px-5 pb-4 space-y-3.5 w-full min-w-0"
          >
            {/* Digest text */}
            <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
              {briefing.summary}
            </p>

            {/* Quick telemetry chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 w-full min-w-0">
              <div className="flex items-center gap-2 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 p-2 sm:p-2.5 min-w-0 overflow-hidden">
                <Users className="h-4 w-4 shrink-0 text-[#007AFF]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400 truncate">Davomat</div>
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                    {briefing.metrics.attendanceRate}%{' '}
                    <span className="text-[10px] font-normal text-zinc-500">
                      ({briefing.metrics.presentToday} / {briefing.metrics.presentToday + briefing.metrics.absentToday})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 p-2 sm:p-2.5 min-w-0 overflow-hidden">
                <CreditCard className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400 truncate">Qarzdorlar</div>
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                    {briefing.metrics.debtorsCount}{' '}
                    <span className="text-[10px] font-normal text-zinc-500">nafar</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 p-2 sm:p-2.5 min-w-0 overflow-hidden">
                <GraduationCap className="h-4 w-4 shrink-0 text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400 truncate">Guruhlar</div>
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                    {briefing.metrics.groupsCount}{' '}
                    <span className="text-[10px] font-normal text-zinc-500">faol</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-white/70 dark:bg-zinc-800/60 border border-black/5 dark:border-white/5 p-2 sm:p-2.5 min-w-0 overflow-hidden">
                <AlertTriangle className={cn("h-4 w-4 shrink-0", briefing.metrics.highRiskStudents > 0 ? "text-amber-500" : "text-emerald-500")} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase font-semibold text-zinc-400 truncate">Xavf guruhi</div>
                  <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">
                    {briefing.metrics.highRiskStudents}{' '}
                    <span className="text-[10px] font-normal text-zinc-500">o'quvchi</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pending actions notification banner */}
            {briefing.metrics.pendingActionsCount !== undefined && briefing.metrics.pendingActionsCount > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span><strong>{briefing.metrics.pendingActionsCount} ta AI amali</strong> rahbar tasdig'ini kutmoqda</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleActionClick("Tasdiqlash kutilayotgan barcha AI amallarini ko'rsat")}
                  className="font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Ko'rib chiqish →
                </button>
              </div>
            )}

            {/* Priority action pills */}
            {briefing.priorityActions && briefing.priorityActions.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Tavsiya etilgan amallar:
                </div>
                <div className="flex flex-wrap gap-2">
                  {briefing.priorityActions.map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => handleActionClick(act.prompt)}
                      className={cn(
                        'group flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-medium transition-all',
                        'bg-white/80 dark:bg-zinc-800/80 border border-black/8 dark:border-white/10',
                        'hover:bg-[#007AFF] hover:text-white hover:border-[#007AFF]',
                        'shadow-sm hover:shadow-md hover:shadow-[#007AFF]/25',
                      )}
                    >
                      <span className="text-zinc-700 dark:text-zinc-300 group-hover:text-white transition-colors">
                        {act.title}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#007AFF] group-hover:text-white transition-colors">
                        {act.actionLabel}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
