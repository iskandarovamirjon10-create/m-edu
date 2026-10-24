/**
 * AiScheduleTimeline — Interactive Liquid Glass Lessons & Timetable Widget.
 *
 * Responsibilities:
 *   - Visualizes real lesson timetable data from `schedule.list` tool.
 *   - Chronological timeline of lessons with group badge, time chips, and room.
 *   - Graceful states: loading, empty, error.
 *   - Direct deep-link navigation to `/schedule`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, ArrowUpRight, AlertCircle, Users } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiScheduleListData } from '@/types/ai';

export interface AiScheduleTimelineProps {
  data?: AiScheduleListData | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

function tr(t: (k: string) => string, key: string, fallback: string): string {
  try {
    const val = t(key);
    return !val || val === key ? fallback : val;
  } catch {
    return fallback;
  }
}

export const AiScheduleTimeline = memo(function AiScheduleTimeline({
  data,
  loading = false,
  error,
  className,
}: AiScheduleTimelineProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Dars jadvali yuklanmoqda"
        className={cn(
          'w-full max-w-md animate-pulse rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-black/10 dark:bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-black/10 dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded bg-black/10 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400',
          className
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data || !Array.isArray(data.lessons) || data.lessons.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.schedule.empty', "Rejalashtirilgan darslar topilmadi")}
      </div>
    );
  }

  const { total = data.lessons.length, lessons = [] } = data;

  return (
    <div
      role="region"
      aria-label="AI Dars jadvali"
      data-testid="ai-schedule-timeline"
      className={cn(
        'relative overflow-hidden w-full max-w-md rounded-2xl border p-4.5',
        'border-black/[0.08] dark:border-white/10',
        'bg-white/85 text-[var(--text-primary)] backdrop-blur-2xl dark:bg-[#1C1C1E]/85',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_12px_32px_-12px_rgba(0,0,0,0.12)]',
        'dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_32px_-12px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {/* Specular edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#5856D6]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5856D6]/15 to-[#5856D6]/5 text-[#5856D6] border border-[#5856D6]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#5856D6]/20">
            <Calendar className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.schedule.title', 'Darslar Jadvali')}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {tr(t, 'ai.widget.schedule.count', 'Jami darslar')}:{' '}
              <strong className="text-[var(--text-primary)]">{total}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Timeline List (Top 6) */}
      <div className="my-2.5 flex flex-col gap-2">
        {lessons.slice(0, 6).map((lesson) => (
          <div
            key={lesson.id}
            className="flex items-center justify-between rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.015] p-2.5 text-xs dark:bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] dark:shadow-none hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <div className="flex items-center gap-1 rounded-lg bg-[#007AFF]/10 border border-[#007AFF]/15 px-2 py-0.5 font-bold tabular-nums text-[#007AFF] dark:bg-[#007AFF]/20">
                <Clock className="h-3 w-3" />
                <span>
                  {lesson.startTime} - {lesson.endTime}
                </span>
              </div>
              <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-[var(--text-primary)]">
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                <span className="truncate">{lesson.group || 'Guruh'}</span>
              </div>
            </div>

            {lesson.room && (
              <div className="flex items-center gap-1 shrink-0 text-[11px] font-medium text-[var(--text-secondary)] bg-black/[0.03] dark:bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                <MapPin className="h-3 w-3 text-[var(--text-muted)]" />
                <span>{lesson.room}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Navigation Link */}
      <div className="mt-1 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/schedule"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.schedule.viewAll', 'Toʻliq jadvalga oʻtish')}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
