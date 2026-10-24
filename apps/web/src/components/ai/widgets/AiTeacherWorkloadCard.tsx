/**
 * AiTeacherWorkloadCard — Interactive Liquid Glass Teacher Workload Widget.
 *
 * Responsibilities:
 *   - Visualizes teacher workload, group assignments, and hours from `teachers.workload` tool.
 *   - Weekly teaching hours and attendance benchmarks.
 *   - Teacher cards with subject specializations and student counts.
 *   - Direct deep-link navigation to `/teachers`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ArrowUpRight, AlertCircle, Clock, Users, BookOpen } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiTeacherWorkloadData } from '@/types/ai';

export interface AiTeacherWorkloadCardProps {
  data?: AiTeacherWorkloadData | null;
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

export const AiTeacherWorkloadCard = memo(function AiTeacherWorkloadCard({
  data,
  loading = false,
  error,
  className,
}: AiTeacherWorkloadCardProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="O'qituvchilar ma'lumotlari yuklanmoqda"
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

  if (!data || !Array.isArray(data.teachers) || data.teachers.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.teachers.empty', "O'qituvchilar yuklamasi topilmadi")}
      </div>
    );
  }

  const { totalTeachers = data.teachers.length, totalHours = 0, teachers = [] } = data;

  return (
    <div
      role="region"
      aria-label="AI O'qituvchilar yuklamasi"
      data-testid="ai-teacher-workload-card"
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF9500]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF9500]/15 to-[#FF9500]/5 text-[#FF9500] border border-[#FF9500]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#FF9500]/20">
            <Briefcase className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.teachers.title', "O'qituvchilar Yuklamasi")}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {tr(t, 'ai.widget.teachers.count', 'Faol ustozlar')}:{' '}
              <strong className="text-[var(--text-primary)]">{totalTeachers}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-black/[0.02] px-2.5 py-1 text-[11px] font-semibold dark:border-white/[0.08] dark:bg-white/[0.04]">
          <Clock className="h-3.5 w-3.5 text-[#FF9500]" />
          <span>Jami: {totalHours} soat/hafta</span>
        </div>
      </div>

      {/* Teacher List */}
      <div className="my-2 flex flex-col divide-y divide-black/[0.04] dark:divide-white/[0.06]">
        {teachers.slice(0, 3).map((teacher) => (
          <div key={teacher.id} className="flex flex-col gap-1.5 py-2.5 first:pt-1 last:pb-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="truncate text-xs font-semibold text-[var(--text-primary)] block">
                  {teacher.name}
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {teacher.groupsCount} ta guruh
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {teacher.studentsCount} ta o'quvchi
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs font-bold tabular-nums text-[var(--text-primary)]">
                  {teacher.weeklyHours} soat
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {teacher.attendanceRate}% davomat
                </span>
              </div>
            </div>

            {/* Specialization Tags */}
            {Array.isArray(teacher.specializations) && teacher.specializations.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mt-1">
                {teacher.specializations.map((spec, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] font-medium text-[var(--text-secondary)]"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer Navigation */}
      <div className="mt-1 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/teachers"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.teachers.viewAll', "Barcha o'qituvchilar")}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
