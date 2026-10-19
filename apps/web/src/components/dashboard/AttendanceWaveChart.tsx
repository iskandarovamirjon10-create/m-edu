/**
 * AttendanceWaveChart — daily attendance rate from the analytics endpoint.
 *
 * The period pills drive the API `dateFrom` range (filtered server-side);
 * chart colors come from design tokens only.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import { BarChart3, CalendarDays } from 'lucide-react';
import { attendanceApi } from '@/lib/api';
import { cn, clamp, Shimmer } from '@/lib/design';
import type { AttendanceStat } from '@/lib/types';

interface AttendanceWaveChartProps {
  overallRate?: number;
  attendanceStats?: AttendanceStat[];
}

type Period = 'Hafta' | 'Oy' | 'Yil';
const PERIOD_DAYS: Record<Period, number> = { Hafta: 7, Oy: 30, Yil: 365 };

interface DailyRow {
  date?: string;
  status?: string;
  count?: number;
  rate?: number | string;
}
interface Point {
  label: string;
  shortLabel: string;
  rate: number;
}

function periodStart(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days + 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Group raw `{ date, status, count }` rows into one attendance rate per day. */
function toDailyPoints(rows: DailyRow[]): Point[] {
  const byDate = new Map<string, { present: number; total: number; rate?: number }>();
  for (const row of rows) {
    const key = row.date ? String(row.date).slice(0, 10) : '';
    if (!key) continue;
    const entry =
      byDate.get(key) ?? { present: 0, total: 0, rate: undefined as number | undefined };
    const explicit = Number(row.rate);
    if (row.rate !== undefined && Number.isFinite(explicit)) {
      entry.rate = clamp(Math.round(explicit), 0, 100);
    } else {
      const count = Number(row.count) || 0;
      entry.total += count;
      if (row.status === 'PRESENT' || row.status === 'LATE') entry.present += count;
    }
    byDate.set(key, entry);
  }
  return Array.from(byDate.entries())
    .map(([date, v]) => ({
      date,
      rate: v.rate ?? (v.total > 0 ? Math.round((v.present / v.total) * 100) : 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, rate }) => {
      const d = new Date(date);
      const short = d.toLocaleDateString('uz-UZ', { weekday: 'short' });
      const full = d.toLocaleDateString('uz-UZ', { month: 'short', day: 'numeric' });
      return { label: `${short}, ${full}`, shortLabel: short, rate: clamp(rate, 0, 100) };
    });
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: Point }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-subtle bg-card px-3 py-2 shadow-dropdown">
      <p className="text-[11px] font-medium text-tertiary">{point.label}</p>
      <p className="text-sm font-semibold tabular-nums text-primary">{point.rate}% davomat</p>
    </div>
  );
}

export function AttendanceWaveChart({
  overallRate = 0,
  attendanceStats = [],
}: AttendanceWaveChartProps) {
  const [period, setPeriod] = useState<Period>('Hafta');

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'analytics', 'dashboard', period],
    queryFn: () => attendanceApi.analytics({ dateFrom: periodStart(PERIOD_DAYS[period]) }),
    staleTime: 60_000,
  });

  const chartData = useMemo<Point[]>(() => {
    const daily = (data as { daily?: DailyRow[] } | undefined)?.daily ?? [];
    const points = toDailyPoints(daily);
    if (points.length > 0) return points;
    if (attendanceStats.length > 0) {
      const total = attendanceStats.reduce((sum, s) => sum + (Number(s.count) || 0), 0);
      const present = Number(attendanceStats.find((s) => s.status === 'PRESENT')?.count || 0);
      const rate = total > 0 ? Math.round((present / total) * 100) : overallRate;
      if (rate > 0) return [{ label: '30 kunlik', shortLabel: 'Oy', rate }];
    }
    return [];
  }, [data, attendanceStats, overallRate]);

  const hasData = chartData.length > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            <BarChart3 className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-primary">Davomat statistikasi</h3>
            <p className="text-xs text-tertiary">
              O'rtacha ko'rsatkich: <span className="font-medium text-primary">{overallRate}%</span>
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Davomat davri"
          className="flex items-center gap-0.5 rounded-lg border border-subtle bg-black/[0.04] p-0.5 dark:bg-white/[0.06]"
        >
          {(Object.keys(PERIOD_DAYS) as Period[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={period === tab}
              onClick={() => setPeriod(tab)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150',
                period === tab ? 'bg-card text-primary shadow-xs' : 'text-tertiary hover:text-primary',
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className={cn('relative mt-2 w-full flex-1 text-tertiary', !hasData && 'min-h-[190px]')}>
        {isLoading ? (
          <Shimmer className="h-[200px] w-full" rounded="10px" />
        ) : hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-[0.08]" />
              <XAxis dataKey="shortLabel" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} dy={6} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-medium)' }} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="var(--primary)"
                fillOpacity={0.1}
                activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--bg-card)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-subtle p-6 text-center">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-black/[0.04] text-tertiary dark:bg-white/[0.06]">
              <CalendarDays className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <p className="text-xs font-medium text-primary">Davomat ma'lumotlari mavjud emas</p>
            <p className="mt-0.5 max-w-xs text-xs text-tertiary">
              Dars mashg'ulotlarida davomat qayd etilishi bilan statistika shu yerda ko'rinadi.
            </p>
            <Link
              to="/attendance"
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-500/15"
            >
              Davomat olish
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceWaveChart;
