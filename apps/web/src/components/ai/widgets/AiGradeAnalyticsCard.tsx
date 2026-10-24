/**
 * AiGradeAnalyticsCard — Interactive Liquid Glass Grade & Exam Analytics Widget.
 *
 * Responsibilities:
 *   - Visualizes exam scores, pass rates, and class averages from `grades.analytics` tool.
 *   - Overall pass rate bar and average marks indicators.
 *   - Breakdown of recent exams (subject, average, passed/failed counts).
 *   - Direct deep-link navigation to `/exams`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Award, ArrowUpRight, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiGradeAnalyticsData } from '@/types/ai';

export interface AiGradeAnalyticsCardProps {
  data?: AiGradeAnalyticsData | null;
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

export const AiGradeAnalyticsCard = memo(function AiGradeAnalyticsCard({
  data,
  loading = false,
  error,
  className,
}: AiGradeAnalyticsCardProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Imtihon ma'lumotlari yuklanmoqda"
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

  if (!data || !Array.isArray(data.exams) || data.exams.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.grades.empty', "Imtihon va baholar ma'lumoti topilmadi")}
      </div>
    );
  }

  const { totalExams = data.exams.length, overallPassRate = 0, overallAverage = 0, exams = [] } = data;

  const rateColor =
    overallPassRate >= 85 ? 'text-[#34C759]' : overallPassRate >= 70 ? 'text-[#007AFF]' : 'text-[#FF9500]';
  const progressBg =
    overallPassRate >= 85 ? 'bg-[#34C759]' : overallPassRate >= 70 ? 'bg-[#007AFF]' : 'bg-[#FF9500]';

  return (
    <div
      role="region"
      aria-label="AI Imtihon va Baholar tahlili"
      data-testid="ai-grade-analytics-card"
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#AF52DE]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#AF52DE]/15 to-[#AF52DE]/5 text-[#AF52DE] border border-[#AF52DE]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#AF52DE]/20">
            <Award className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.grades.title', "Imtihonlar & Baholar")}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {tr(t, 'ai.widget.grades.count', 'Imtihonlar soni')}:{' '}
              <strong className="text-[var(--text-primary)]">{totalExams}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.02] px-2.5 py-1 text-[11px] font-semibold dark:border-white/[0.08] dark:bg-white/[0.04]">
          <TrendingUp className="h-3.5 w-3.5 text-[#007AFF]" />
          <span>O'rtacha: {overallAverage} ball</span>
        </div>
      </div>

      {/* Overall Pass Rate Bar */}
      <div className="mt-3.5 rounded-xl border border-black/[0.04] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-[var(--text-secondary)]">Umumiy o'tish ko'rsatkichi</span>
          <span className={cn('text-sm font-bold tabular-nums', rateColor)}>{overallPassRate}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08]">
          <div
            className={cn('h-full transition-all duration-700 ease-out', progressBg)}
            style={{ width: `${Math.min(100, Math.max(0, overallPassRate))}%` }}
          />
        </div>
      </div>

      {/* Recent Exams List */}
      <div className="my-2 flex flex-col divide-y divide-black/[0.04] dark:divide-white/[0.06]">
        {exams.slice(0, 3).map((exam) => (
          <div key={exam.id} className="flex flex-col gap-1.5 py-2.5 first:pt-1 last:pb-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="truncate text-xs font-semibold text-[var(--text-primary)] block">
                  {exam.title}
                </span>
                <span className="text-[10.5px] font-medium text-[var(--text-muted)] truncate block">
                  {exam.subject} {exam.totalStudents ? `• ${exam.totalStudents} nafar o'quvchi` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold tabular-nums text-[var(--text-primary)]">
                  {exam.averageMarks ?? 0} / {exam.totalMarks}
                </span>
                {exam.passRate !== undefined && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {exam.passRate}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Navigation */}
      <div className="mt-1 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/exams"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.grades.viewAll', "Barcha imtihonlar jurnali")}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
