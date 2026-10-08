import { Link } from 'react-router-dom';
import { ActivityRings } from './ActivityRings';
import type { AttendanceStat } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

interface AttendanceSectionProps {
  stats: AttendanceStat[];
  overallRate: number;
}

export function AttendanceSection({ stats, overallRate }: AttendanceSectionProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col justify-between rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            {t('dashboard.attendance') || 'Attendance Analysis'}
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {t('dashboard.last30Days') || 'Aggregated over the last 30 days'}
          </p>
        </div>

        <Link
          to="/attendance"
          className="items-center gap-1 text-xs font-semibold text-[var(--primary)] transition-colors hover:underline inline-flex"
        >
          <span>{t('nav.attendance') || 'Open sheet'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" /><path d="M7 7h10v10" />
          </svg>
        </Link>
      </div>

      <div className="my-auto">
        <ActivityRings stats={stats} overallRate={overallRate} />
      </div>
    </div>
  );
}
