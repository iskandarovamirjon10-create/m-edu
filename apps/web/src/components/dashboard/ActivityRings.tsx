import { useMemo } from 'react';
import type { AttendanceStat } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

interface ActivityRingsProps {
  stats: AttendanceStat[];
  overallRate: number;
}

const RING_CONFIG = [
  { status: 'PRESENT', labelKey: 'attendance.present', fallback: 'Present', color: 'var(--success)', r: 74 },
  { status: 'LATE',    labelKey: 'attendance.late',    fallback: 'Late',    color: 'var(--warning)', r: 58 },
  { status: 'ABSENT',  labelKey: 'attendance.absent',  fallback: 'Absent',  color: 'var(--danger)',  r: 42 },
] as const;

export function ActivityRings({ stats, overallRate }: ActivityRingsProps) {
  const { t } = useI18n();

  const totalRecords = useMemo(() => {
    return stats.reduce((sum, item) => sum + (item.count || 0), 0);
  }, [stats]);

  const statMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of stats) {
      map.set(item.status, item.count || 0);
    }
    return map;
  }, [stats]);

  if (!totalRecords) {
    return (
      <div className="flex h-[240px] items-center justify-center text-xs text-[var(--text-muted)]">
        {t('dashboard.noAttendance') || 'No attendance data recorded in the last 30 days.'}
      </div>
    );
  }

  const size = 180;
  const strokeWidth = 11;
  const center = size / 2;

  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-6 sm:flex-row">
      {/* Concentric Rings SVG */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 overflow-visible"
          aria-hidden="true"
        >
          {RING_CONFIG.map((cfg) => {
            const count = statMap.get(cfg.status) || 0;
            const circ = 2 * Math.PI * cfg.r;
            const fraction = Math.min(1, count / totalRecords);
            const dashLength = circ * fraction;

            return (
              <g key={cfg.status}>
                {/* Background track */}
                <circle
                  cx={center}
                  cy={center}
                  r={cfg.r}
                  fill="none"
                  stroke={cfg.color}
                  strokeWidth={strokeWidth}
                  strokeOpacity="0.15"
                />
                {/* Active progress arc */}
                {fraction > 0 && (
                  <circle
                    cx={center}
                    cy={center}
                    r={cfg.r}
                    fill="none"
                    stroke={cfg.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={`${dashLength} ${circ}`}
                    style={{
                      transition: 'stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Center Metric Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums">
            {overallRate}%
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t('dashboard.attendance') || 'Attendance'}
          </span>
        </div>
      </div>

      {/* Breakdown Legend */}
      <div className="w-full flex-1 space-y-2">
        {RING_CONFIG.map((cfg) => {
          const count = statMap.get(cfg.status) || 0;
          const percent = totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0;
          const label = t(cfg.labelKey) || cfg.fallback;

          return (
            <div
              key={cfg.status}
              className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--bg-surface)]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {label}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-3 tabular-nums">
                <span className="text-xs text-[var(--text-muted)]">{percent}%</span>
                <span className="w-8 text-right text-xs font-bold text-[var(--text-primary)]">
                  {count}
                </span>
              </div>
            </div>
          );
        })}

        {/* Excused status */}
        {statMap.has('EXCUSED') && (
          <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-[var(--bg-surface)]">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--info)]" />
              <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                {t('attendance.excused') || 'Excused'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3 tabular-nums">
              <span className="text-xs text-[var(--text-muted)]">
                {Math.round(((statMap.get('EXCUSED') || 0) / totalRecords) * 100)}%
              </span>
              <span className="w-8 text-right text-xs font-bold text-[var(--text-primary)]">
                {statMap.get('EXCUSED') || 0}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
