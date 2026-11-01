/**
 * M-EDU V2 — Spatial Attendance Heatmap & Streak Radar (`AttendanceHeatmap.tsx`)
 * Visualizes longitudinal attendance patterns, seasonal peaks, and day-of-week anomalies.
 * Apple Fitness / GitHub Matrix architecture with optical glass tooltips and 120Hz physics.
 */

import { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { cn } from '@/lib/design';

interface HeatmapDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 = Sun, 1 = Mon ... 6 = Sat
  rate: number; // 0 - 100
  presentCount: number;
  totalStudents: number;
  isHoliday?: boolean;
}

interface AttendanceHeatmapProps {
  days?: HeatmapDay[];
  overallRate?: number;
  streakDays?: number;
}

const WEEK_DAYS = ['Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan', 'Yak'];

export const AttendanceHeatmap = memo(function AttendanceHeatmap({
  days: propDays,
  overallRate = 93.4,
  streakDays = 24,
}: AttendanceHeatmapProps) {
  const { playTick } = usePremiumSound();
  const [hoveredDay, setHoveredDay] = useState<{
    day: HeatmapDay;
    x: number;
    y: number;
  } | null>(null);

  // Generate synthetic representative 16 weeks (112 days) if not provided
  const days = useMemo<HeatmapDay[]>(() => {
    if (propDays && propDays.length > 0) return propDays;

    const list: HeatmapDay[] = [];
    const now = new Date();
    const totalDays = 112; // 16 weeks

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);

      const dayOfWeek = (d.getDay() + 6) % 7; // Normalize Monday = 0
      const isSunday = dayOfWeek === 6;

      // Realistic pseudo-random rate with weekend dips and mid-week peaks
      let rate = 0;
      let present = 0;
      const total = 320;

      if (!isSunday) {
        const base = 88 + ((d.getDate() * 7 + i * 3) % 11);
        rate = Math.min(100, Math.max(72, base));
        present = Math.round((rate / 100) * total);
      }

      const dateStr = d.toISOString().split('T')[0];

      list.push({
        date: dateStr,
        dayOfWeek,
        rate,
        presentCount: present,
        totalStudents: total,
        isHoliday: isSunday,
      });
    }
    return list;
  }, [propDays]);

  // Group days into 7 rows (days of week) and columns (weeks)
  const weeks = useMemo(() => {
    const colCount = Math.ceil(days.length / 7);
    const matrix: (HeatmapDay | null)[][] = Array.from({ length: 7 }, () =>
      Array(colCount).fill(null),
    );

    days.forEach((day, index) => {
      const weekIndex = Math.floor(index / 7);
      const dayIndex = day.dayOfWeek;
      if (matrix[dayIndex] && weekIndex < colCount) {
        matrix[dayIndex][weekIndex] = day;
      }
    });

    return { matrix, colCount };
  }, [days]);

  // Helper to get color class based on rate
  const getColorClass = (day: HeatmapDay | null) => {
    if (!day || day.isHoliday || day.rate === 0) {
      return 'bg-black/[0.04] dark:bg-white/[0.04] border-transparent';
    }
    if (day.rate < 75) {
      return 'bg-rose-500/40 border-rose-500/20 dark:bg-rose-500/50';
    }
    if (day.rate < 85) {
      return 'bg-amber-400/50 border-amber-400/20 dark:bg-amber-400/60';
    }
    if (day.rate < 93) {
      return 'bg-emerald-500/60 border-emerald-500/30 dark:bg-emerald-500/70';
    }
    return 'bg-emerald-400 dark:bg-emerald-400 border-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.4)]';
  };

  return (
    <div className="relative overflow-hidden rounded-[2.25rem] border border-white/60 bg-white/75 backdrop-blur-3xl backdrop-saturate-[200%] p-6 shadow-xl dark:border-white/[0.12] dark:bg-[#161618]/75">
      {/* Top Header & Metrics */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300 font-bold text-sm">
              🗓️
            </span>
            <h3 className="text-base font-bold tracking-tight text-[var(--text-primary,#1d1d1f)] dark:text-white">
              Davomat Qizg'inlik Radari (16 Haftalik Matritsa)
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary,#86868b)] mt-1 ml-10">
            Mavsumiy davomat dinamikasi va dars qoldirish xatarlarining taqsimoti
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-2xl bg-black/[0.03] dark:bg-white/[0.05] px-3.5 py-1.5 border border-black/[0.04] dark:border-white/[0.08]">
            <span className="text-xs text-[var(--text-secondary)] font-medium">
              O'rtacha:
            </span>
            <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
              {overallRate.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 px-3.5 py-1.5 border border-amber-500/20">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
              🔥 Streak:
            </span>
            <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300">
              {streakDays} kun
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Stage */}
      <div className="overflow-x-auto pb-2 no-scrollbar">
        <div className="inline-flex flex-col gap-1.5 min-w-[640px]">
          {weeks.matrix.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-1.5">
              <span className="w-9 text-[11px] font-semibold text-[var(--text-tertiary,#86868b)] text-right pr-2 select-none">
                {WEEK_DAYS[dayIdx]}
              </span>
              <div className="flex items-center gap-1.5">
                {row.map((cell, weekIdx) => (
                  <button
                    key={weekIdx}
                    type="button"
                    disabled={!cell || cell.isHoliday}
                    onMouseEnter={(e) => {
                      if (!cell || cell.isHoliday) return;
                      playTick();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setHoveredDay({
                        day: cell,
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                      });
                    }}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={cn(
                      'h-4 w-4 rounded-[4px] border transition-all duration-150',
                      getColorClass(cell),
                      cell && !cell.isHoliday && 'hover:scale-125 hover:z-10 cursor-pointer',
                    )}
                    aria-label={
                      cell
                        ? `${cell.date}: ${cell.rate}% davomat (${cell.presentCount}/${cell.totalStudents})`
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend & Footnotes */}
      <div className="mt-4 flex flex-wrap items-center justify-between border-t border-black/[0.05] dark:border-white/[0.07] pt-3 text-[11px] text-[var(--text-secondary,#86868b)]">
        <div className="flex items-center gap-2">
          <span>Kamroq</span>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-[3px] bg-black/[0.05] dark:bg-white/[0.05]" />
            <span className="h-3 w-3 rounded-[3px] bg-rose-500/40" />
            <span className="h-3 w-3 rounded-[3px] bg-amber-400/50" />
            <span className="h-3 w-3 rounded-[3px] bg-emerald-500/60" />
            <span className="h-3 w-3 rounded-[3px] bg-emerald-400" />
          </div>
          <span>Ko'proq (95%+)</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Yuqori intizom
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> O'rtacha
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Qoniqarsiz (&lt;75%)
          </span>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      <AnimatePresence>
        {hoveredDay && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: hoveredDay.x,
              top: hoveredDay.y - 74,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 9999,
            }}
            className="rounded-xl border border-white/50 bg-[#161618]/90 px-3 py-2 text-white shadow-2xl backdrop-blur-xl text-center"
          >
            <p className="text-[11px] font-bold text-neutral-300">
              {hoveredDay.day.date} ({WEEK_DAYS[hoveredDay.day.dayOfWeek]})
            </p>
            <p className="text-xs font-extrabold text-emerald-400 mt-0.5">
              {hoveredDay.day.rate.toFixed(1)}% Davomat
            </p>
            <p className="text-[10px] text-neutral-400">
              {hoveredDay.day.presentCount} / {hoveredDay.day.totalStudents} o'quvchi hozir
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
