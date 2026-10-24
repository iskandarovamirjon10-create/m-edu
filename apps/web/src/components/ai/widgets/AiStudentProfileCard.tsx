/**
 * AiStudentProfileCard — Interactive Liquid Glass Student Dossier Widget.
 *
 * Responsibilities:
 *   - Visualizes student profile data from `students.search` or `students.get` tool.
 *   - Displays student avatar initials, full name, groups, phone, and balance.
 *   - Graceful states: loading, empty, error.
 *   - Direct deep-link navigation to `/students/:id`.
 */
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Mail, ArrowUpRight, AlertCircle, GraduationCap } from 'lucide-react';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/design';
import type { AiStudentSearchData } from '@/types/ai';

export interface AiStudentProfileCardProps {
  data?: AiStudentSearchData | null;
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

export const AiStudentProfileCard = memo(function AiStudentProfileCard({
  data,
  loading = false,
  error,
  className,
}: AiStudentProfileCardProps) {
  const { t } = useSafeI18n();

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Talaba ma'lumotlari yuklanmoqda"
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

  if (!data || !Array.isArray(data.students) || data.students.length === 0) {
    return (
      <div
        role="status"
        className={cn(
          'w-full max-w-md rounded-2xl border border-[var(--border-subtle,rgba(0,0,0,0.08))] p-4 text-center text-xs text-[var(--text-muted,#86868B)]',
          'bg-[var(--bg-card,#ffffff)]/80 backdrop-blur-xl dark:bg-[#1C1C1E]/80',
          className
        )}
      >
        {tr(t, 'ai.widget.students.empty', "Talaba ma'lumotlari topilmadi")}
      </div>
    );
  }

  const { total = data.students.length, students = [] } = data;

  return (
    <div
      role="region"
      aria-label="AI Talaba profillari"
      data-testid="ai-student-profile-card"
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
        className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#34C759]/30 to-transparent"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#34C759]/15 to-[#34C759]/5 text-[#34C759] border border-[#34C759]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:bg-[#34C759]/20">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
          <div>
            <h4 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
              {tr(t, 'ai.widget.students.title', 'Topilgan Talabalar')}
            </h4>
            <span className="text-[11px] font-medium text-[var(--text-muted)]">
              {tr(t, 'ai.widget.students.count', 'Natijalar soni')}:{' '}
              <strong className="text-[var(--text-primary)]">{total}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Student List (Top 3) */}
      <div className="my-2 flex flex-col divide-y divide-black/[0.04] dark:divide-white/[0.06]">
        {students.slice(0, 3).map((student) => {
          const initials = `${student.firstName?.[0] || ''}${student.lastName?.[0] || ''}`.toUpperCase() || 'ST';
          return (
            <div key={student.id} className="flex flex-col gap-2 py-2.5 first:pt-1 last:pb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#007AFF] via-[#5856D6] to-[#AF52DE] text-[11px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_6px_rgba(0,122,255,0.3)]">
                    {initials}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {student.firstName} {student.lastName}
                    </span>
                    {student.email && (
                      <span className="flex items-center gap-1 text-[10.5px] text-[var(--text-muted)] truncate">
                        <Mail className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{student.email}</span>
                      </span>
                    )}
                    {student.phone && (
                      <span className="flex items-center gap-1 text-[10.5px] text-[var(--text-muted)] truncate">
                        <Phone className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{student.phone}</span>
                      </span>
                    )}
                  </div>
                </div>

                <Link
                  to={`/students/${student.id}`}
                  className="group inline-flex shrink-0 items-center gap-1 rounded-lg border border-black/[0.06] dark:border-white/10 bg-white/70 dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#007AFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] transition-all hover:bg-[#007AFF]/10 hover:border-[#007AFF]/30 active:scale-[0.96]"
                >
                  <span>{tr(t, 'common.view', 'Profil')}</span>
                  <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </div>

              {/* Groups Chips */}
              {Array.isArray(student.groups) && student.groups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-10">
                  {student.groups.map((group, idx) => (
                    <span
                      key={idx}
                      className="rounded-md border border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] shadow-xs"
                    >
                      {group}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Navigation Link */}
      <div className="mt-1 flex items-center justify-end border-t border-black/[0.06] dark:border-white/[0.06] pt-2">
        <Link
          to="/students"
          className="group inline-flex items-center gap-1 text-[11px] font-semibold text-[#007AFF] hover:text-[#0051A8] transition-colors active:scale-[0.98]"
        >
          <span>{tr(t, 'ai.widget.students.viewAll', 'Barcha oʻquvchilar roʻyxati')}</span>
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>
    </div>
  );
});
