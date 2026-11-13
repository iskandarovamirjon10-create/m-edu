import { Link } from 'react-router-dom';
import { ActivityRings } from './ActivityRings';
import type { AttendanceStat } from '@/lib/types';
import { useSafeI18n } from '@/i18n/I18nProvider';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { DashboardGlassLayers, useDashboardGlassCard } from './DashboardGlass';

interface AttendanceSectionProps {
  stats: AttendanceStat[];
  overallRate: number;
}

export function AttendanceSection({ stats, overallRate }: AttendanceSectionProps) {
  const { t } = useSafeI18n();
  const sound = usePremiumSound();
  const cardRef = useDashboardGlassCard<HTMLDivElement>();

  return (
    <div
      ref={cardRef}
      className="lgx lgx--clear relative flex flex-col justify-between rounded-[2rem] p-5 sm:p-6"
    >
      <DashboardGlassLayers />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-primary">
            {t('dashboard.attendance', 'Davomat tahlili')}
          </h2>
          <p className="text-xs text-secondary">
            {t('dashboard.last30Days', 'Oxirgi 30 kunlik jamlangan ko‘rsatkich')}
          </p>
        </div>

        <Link
          to="/attendance"
          onClick={() => sound.playTick?.()}
          className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-primary transition-colors hover:underline"
        >
          <span>{t('nav.attendance', 'Jurnalni ochish')}</span>
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

export default AttendanceSection;
