/**
 * AiAttendanceCard — Interactive Liquid Glass Attendance Summary Widget.
 *
 * Responsibilities:
 *   - Visualizes real attendance metrics from `attendance.summary` tool.
 *   - Overall rate circle / percentage, present / absent / late counts.
 *   - Graceful states: loading, empty, partial data, error.
 *   - Direct deep-link navigation to `/attendance`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, ArrowUpRight, BarChart3, AlertCircle } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiAttendanceSummaryData } from '@/types/ai';

export interface AiAttendanceCardProps {
  data?: AiAttendanceSummaryData | null;
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

export const AiAttendanceCard = memo(function AiAttendanceCard({
  data,
  loading = false,
  error,
  className,
}: AiAttendanceCardProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Davomat ma'lumotlari yuklanmoqda"
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

  if (!data || !data.overall) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.attendance.empty', "Davomat ma'lumotlari topilmadi")}
      </div>
    );
  }

  const { total = 0, present = 0, rate = 0 } = data.overall;
  
  // Extract byStatus safely
  let absentCount = 0;
  let lateCount = 0;
  if (Array.isArray(data.byStatus)) {
    for (const item of data.byStatus) {
      if (item.status === 'ABSENT') absentCount = item._count?.status ?? 0;
      if (item.status === 'LATE') lateCount = item._count?.status ?? 0;
    }
  }

  // Rate color calculation
  const rateColor =
    rate >= 90 ? 'text-[#34C759]' : rate >= 75 ? 'text-[#FF9500]' : 'text-[#FF3B30]';
  const progressBg =
    rate >= 90 ? 'bg-[#34C759]' : rate >= 75 ? 'bg-[#FF9500]' : 'bg-[#FF3B30]';

  return (
    <div
      role="region"
      aria-label="AI Davomat hisoboti"
      data-testid="ai-attendance-card"
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#007AFF]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#007AFF]/15 to-[#007AFF]/5 text-[#007AFF] border border-[#007AFF]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#007AFF]/20">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.attendance.title', 'Davomat Tahlili')}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {tr(t, 'ai.widget.attendance.totalStudents', 'Jami oʻquvchilar')}:{' '}
              <strong className="text-[var(--text-primary)]">{total}</strong>
            </span>
          </div>
        </div>

        {/* Rate badge */}
        <div className="flex flex-col items-end">
          <span className={cn('text-base font-bold tabular-nums tracking-tight', rateColor)}>
            {rate}%
          </span>
          <span className="text-[10px] font-medium text-[var(--text-muted)]">
            {tr(t, 'ai.widget.attendance.rate', 'Davomat koʻrsatkichi')}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="my-3.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_currentColor]', progressBg)}
          style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
        />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-1">
        <div className="flex flex-col items-center rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.02] p-1.5 sm:p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-white/[0.02] dark:shadow-none min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)] truncate">
            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#34C759] shrink-0" />
            <span className="truncate">{tr(t, 'attendance.status.present', 'Kelgan')}</span>
          </div>
          <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {present}
          </span>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.02] p-1.5 sm:p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-white/[0.02] dark:shadow-none min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)] truncate">
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#FF9500] shrink-0" />
            <span className="truncate">{tr(t, 'attendance.status.late', 'Kechikkan')}</span>
          </div>
          <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {lateCount}
          </span>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-black/[0.04] dark:border-white/[0.06] bg-black/[0.02] p-1.5 sm:p-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-white/[0.02] dark:shadow-none min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-medium text-[var(--text-secondary)] truncate">
            <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#FF3B30] shrink-0" />
            <span className="truncate">{tr(t, 'attendance.status.absent', 'Kelmadi')}</span>
          </div>
          <span className="mt-1 text-xs sm:text-sm font-bold tabular-nums text-[var(--text-primary)]">
            {absentCount}
          </span>
        </div>
      </div>

      {/* Footer Navigation Link */}
      <div className="mt-2.5 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/attendance"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.attendance.viewAll', 'Davomat boʻlimiga oʻtish')}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
