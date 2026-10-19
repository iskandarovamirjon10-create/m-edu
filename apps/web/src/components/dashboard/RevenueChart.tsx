/**
 * ============================================================================
 * RevenueChart v2.1 — Executive financial chart (Hyper-Refractive Liquid Glass)
 * ============================================================================
 */

import { useMemo } from 'react';
import {
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  CartesianGrid,
} from 'recharts';

import { GlassEmptyState } from '@/components/ui';
import { formatCurrency, formatMonth } from '@/lib/format';
import type { MonthlyRevenue } from '@/lib/types';
import { useI18n } from '@/i18n/I18nProvider';

export type Period = '7D' | '30D' | '90D' | '1Y';

interface RevenueTooltipPayload {
  value?: number;
  payload?: {
    month?: string;
    bucket?: string;
    total?: number;
  };
}

function formatRevenueLabel(dateStr: string | undefined, period: Period): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;

  if (period === '7D' || period === '30D') {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { month: 'short' });
}

function RevenueTooltip({
  active,
  payload,
  period,
}: {
  active?: boolean;
  payload?: RevenueTooltipPayload[];
  period?: Period;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value ?? payload[0].payload?.total;
  const rawDate = payload[0].payload?.month || payload[0].payload?.bucket;
  if (value === undefined) return null;

  let dateLabel = 'Period';
  if (rawDate) {
    const d = new Date(rawDate);
    if (!Number.isNaN(d.getTime())) {
      if (period === '7D' || period === '30D') {
        dateLabel = d.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      } else {
        dateLabel = formatMonth(rawDate);
      }
    } else {
      dateLabel = formatMonth(rawDate);
    }
  }

  return (
    <div className="rounded-[1.25rem] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.95)] backdrop-blur-3xl backdrop-saturate-[210%] dark:border-white/20 dark:bg-[#1C1C1E]/90 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.25)]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted,#86868B)]">
        {dateLabel}
      </p>
      <p className="mt-0.5 text-base font-bold tracking-tight text-[var(--text-primary,#1D1D1F)] dark:text-[var(--text-primary,#F5F5F7)]">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

export function RevenueChart({
  data,
  period,
}: {
  data: MonthlyRevenue[];
  period: Period;
}) {
  const { t } = useI18n();

  const formattedData = useMemo(() => {
    if (!data?.length) return [];
    return data.map((item) => {
      const rawDate = item.month || item.bucket;
      return {
        ...item,
        rawDate,
        label: formatRevenueLabel(rawDate, period),
        numericTotal: Number(item.total) || 0,
      };
    });
  }, [data, period]);

  if (!formattedData.length) {
    return (
      <div className="flex h-[280px] w-full items-center justify-center py-10">
        <GlassEmptyState
          title={t('dashboard.noRevenue') || 'No revenue recorded'}
          message={t('dashboard.noRevenueHint') || 'Payments recorded in this period will appear on this chart.'}
        />
      </div>
    );
  }

  const yAxisFormatter = (v: number) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
    return `${v}`;
  };

  return (
    <div className="mt-4 h-[280px] w-full" role="region" aria-label="Revenue chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={formattedData}
          margin={{ top: 15, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="meduRevenueArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A84FF" stopOpacity={0.35} />
              <stop offset="60%" stopColor="#0A84FF" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#0A84FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="meduRevenueBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5E5CE6" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#0A84FF" stopOpacity={0.45} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--border-subtle, rgba(120,120,128,0.18))"
            opacity={0.7}
          />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted, #86868B)', fontSize: 11, fontWeight: 600 }}
            minTickGap={16}
            interval="preserveStartEnd"
            dy={8}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--text-muted, #86868B)', fontSize: 10, fontWeight: 600 }}
            tickFormatter={yAxisFormatter}
            width={44}
          />

          <Tooltip
            cursor={{ stroke: 'var(--border, rgba(120,120,128,0.3))', strokeWidth: 1.5, strokeDasharray: '4 4' }}
            content={<RevenueTooltip period={period} />}
          />

          <Bar
            dataKey="numericTotal"
            maxBarSize={22}
            radius={[6, 6, 0, 0]}
            fill="url(#meduRevenueBar)"
            opacity={0.75}
          />

          <Area
            type="monotone"
            dataKey="numericTotal"
            stroke="#0A84FF"
            strokeWidth={2.5}
            fill="url(#meduRevenueArea)"
            activeDot={{
              r: 6,
              fill: '#FFFFFF',
              stroke: '#0A84FF',
              strokeWidth: 3,
              style: { filter: 'drop-shadow(0px 4px 10px rgba(10,132,255,0.55))' },
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default RevenueChart;