/**
 * ============================================================================
 * ActivityRings v2.0 — Apple Fitness-inspired concentric rings
 * ============================================================================
 * Fixes:
 *  - Safe i18n (no raw-key leaks)
 *  - Correct denominator: rings sum to 100% of non-excused records
 *  - Mount grow-in animation (respects prefers-reduced-motion)
 *  - Staggered legend entrance
 *  - Aria labels on the ring container
 *  - Empty state redesigned
 * Design:
 *  - Gradient strokes + subtle glow per ring
 *  - Responsive ring size (mobile→tablet→desktop)
 *  - Refined center typography (% dimmed)
 *  - Structured legend rows (count + percent aligned)
 * ============================================================================
 */

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/design';
import type { AttendanceStat } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

interface ActivityRingsProps {
  stats: AttendanceStat[];
  overallRate: number;
}

const RING_CONFIG = [
  {
    status: 'PRESENT',
    labelKey: 'attendance.present',
    fallback: 'Present',
    color: 'var(--success, #34C759)',
    ringFrom: '#30D158',
    ringTo: '#248A3D',
    glow: 'rgba(52, 199, 89, 0.4)',
    r: 74,
  },
  {
    status: 'LATE',
    labelKey: 'attendance.late',
    fallback: 'Late',
    color: 'var(--warning, #FF9F0A)',
    ringFrom: '#FFB340',
    ringTo: '#C93400',
    glow: 'rgba(255, 159, 10, 0.4)',
    r: 58,
  },
  {
    status: 'ABSENT',
    labelKey: 'attendance.absent',
    fallback: 'Absent',
    color: 'var(--danger, #FF453A)',
    ringFrom: '#FF6961',
    ringTo: '#B71C1C',
    glow: 'rgba(255, 69, 58, 0.4)',
    r: 42,
  },
] as const;

function resolveTranslation(
  t: (key: string) => string,
  key: string,
  fallback: string
): string {
  try {
    const v = t(key);
    return !v || v === key ? fallback : v;
  } catch {
    return fallback;
  }
}

export function ActivityRings({ stats, overallRate }: ActivityRingsProps) {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener('change', handler);
    };
  }, []);

  const { statMap, totalRecords, ringTotal, excusedCount } = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    for (const item of stats) {
      const c = item.count || 0;
      map.set(item.status, c);
      total += c;
    }
    const excused = map.get('EXCUSED') || 0;
    return {
      statMap: map,
      totalRecords: total,
      ringTotal: total - excused, // rings exclude EXCUSED so arcs sum to 100%
      excusedCount: excused,
    };
  }, [stats]);

  /* ── Empty state ──────────────────────────────────────────────── */
  if (!totalRecords) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-3 text-center">
        <svg
          viewBox="0 0 64 64"
          className="h-16 w-16 text-[var(--text-muted,#8E8E93)]"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" strokeDasharray="4 6" />
          <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.15" strokeDasharray="3 5" />
        </svg>
        <p className="max-w-[240px] text-[12.5px] leading-relaxed text-[var(--text-muted,#8E8E93)]">
          {resolveTranslation(
            t,
            'dashboard.noAttendance',
            'No attendance data recorded in the last 30 days.'
          )}
        </p>
      </div>
    );
  }

  const size = 180;
  const strokeWidth = 12;
  const center = size / 2;
  const denominator = ringTotal || totalRecords;
  const displayRate = Math.round(overallRate || 0);

  return (
    <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      {/* ── Rings ─────────────────────────────────────────────── */}
      <div
        className="relative aspect-square w-[160px] shrink-0 sm:w-[176px] md:w-[192px]"
        role="img"
        aria-label={`Umumiy davomat: ${displayRate}%`}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            {RING_CONFIG.map((cfg) => (
              <linearGradient
                key={cfg.status}
                id={`ring-grad-${cfg.status}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={cfg.ringFrom} />
                <stop offset="100%" stopColor={cfg.ringTo} />
              </linearGradient>
            ))}
          </defs>

          {RING_CONFIG.map((cfg) => {
            const count = statMap.get(cfg.status) || 0;
            const circ = 2 * Math.PI * cfg.r;
            const fraction = Math.min(1, count / denominator);
            const dashLength = circ * fraction;

            return (
              <g key={cfg.status}>
                {/* Track */}
                <circle
                  cx={center}
                  cy={center}
                  r={cfg.r}
                  fill="none"
                  stroke={cfg.color}
                  strokeOpacity="0.10"
                  strokeWidth={strokeWidth}
                />
                {/* Progress arc */}
                <circle
                  cx={center}
                  cy={center}
                  r={cfg.r}
                  fill="none"
                  stroke={`url(#ring-grad-${cfg.status})`}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={
                    mounted || reduceMotion ? `${dashLength} ${circ}` : `0 ${circ}`
                  }
                  style={{
                    transition: reduceMotion
                      ? 'none'
                      : 'stroke-dasharray 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
                    filter: `drop-shadow(0 0 6px ${cfg.glow})`,
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Center metric */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tracking-tight tabular-nums text-[var(--text-primary,#1D1D1F)] sm:text-3xl dark:text-[var(--text-primary,#F5F5F7)]">
            {displayRate}
            <span className="ml-0.5 text-base font-semibold opacity-50 sm:text-lg">%</span>
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted,#8E8E93)]">
            {resolveTranslation(t, 'dashboard.attendance', 'Attendance')}
          </span>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────── */}
      <div className="w-full flex-1 space-y-1">
        {RING_CONFIG.map((cfg, idx) => {
          const count = statMap.get(cfg.status) || 0;
          const percent =
            totalRecords > 0 ? Math.round((count / totalRecords) * 100) : 0;
          const label = resolveTranslation(t, cfg.labelKey, cfg.fallback);

          return (
            <div
              key={cfg.status}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5',
                'transition-colors duration-200 ease-out',
                'hover:bg-black/[0.025] dark:hover:bg-white/[0.04]'
              )}
              style={{
                animation:
                  mounted && !reduceMotion
                    ? `legendIn 360ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + idx * 60}ms both`
                    : undefined,
              }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(0,0,0,0.03)] dark:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]"
                style={{ backgroundColor: cfg.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                {label}
              </span>
              <span className="shrink-0 tabular-nums text-[12px] font-medium text-[var(--text-muted,#8E8E93)]">
                {count}
              </span>
              <span className="w-9 shrink-0 text-right tabular-nums text-[12.5px] font-semibold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
                {percent}%
              </span>
            </div>
          );
        })}

        {excusedCount > 0 && (
          <div
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200 hover:bg-black/[0.025] dark:hover:bg-white/[0.04]"
            style={{
              animation:
                mounted && !reduceMotion
                  ? `legendIn 360ms cubic-bezier(0.22, 1, 0.36, 1) ${120 + RING_CONFIG.length * 60}ms both`
                  : undefined,
            }}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_rgba(0,0,0,0.03)] dark:shadow-[0_0_0_3px_rgba(255,255,255,0.04)]"
              style={{ backgroundColor: 'var(--info, #0A84FF)' }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
              {resolveTranslation(t, 'attendance.excused', 'Excused')}
            </span>
            <span className="shrink-0 tabular-nums text-[12px] font-medium text-[var(--text-muted,#8E8E93)]">
              {excusedCount}
            </span>
            <span className="w-9 shrink-0 text-right tabular-nums text-[12.5px] font-semibold text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
              {totalRecords > 0 ? Math.round((excusedCount / totalRecords) * 100) : 0}%
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes legendIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}