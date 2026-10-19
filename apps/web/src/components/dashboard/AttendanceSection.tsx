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
    <div className="relative overflow-hidden flex flex-col justify-between rounded-2xl border border-subtle/80 bg-card/85 backdrop-blur-xl p-5 shadow-card before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent dark:before:via-white/10 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-primary">
            {t('dashboard.attendance') || 'Attendance Analysis'}
          </h2>
          <p className="text-xs text-secondary">
            {t('dashboard.last30Days') || 'Aggregated over the last 30 days'}
          </p>
        </div>

        <Link
          to="/attendance"
          className="items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline inline-flex"
        >
          <span>{t('nav.attendance') || 'Open sheet'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17 17 7" /><path d="M7 7h10v10" />
          </svg>
        </Link>
      </div>

      <div className="my-auto pt-2">
        <ActivityRings stats={stats} overallRate={overallRate} />
      </div>
    </div>
  );
}

