/**
 * PaymentRevenueBar — monthly collected revenue, real series from the backend.
 */

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import type { MonthlyRevenue } from '@/lib/types';
import { formatCurrency, formatMonth } from '@/lib/format';
import { compactNumber } from '@/lib/design';

interface PaymentRevenueBarProps {
  totalAmount?: number;
  monthlyRevenue?: MonthlyRevenue[];
}

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { label: string; total: number } }>;
}

function BarTooltip({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-subtle bg-card px-3 py-2 shadow-dropdown">
      <p className="text-[11px] font-medium text-tertiary">{point.label}</p>
      <p className="text-sm font-semibold tabular-nums text-primary">{formatCurrency(point.total)}</p>
    </div>
  );
}

export function PaymentRevenueBar({ totalAmount = 0, monthlyRevenue = [] }: PaymentRevenueBarProps) {
  const chartData = useMemo(() => {
    if (!monthlyRevenue?.length) {
      return totalAmount > 0 ? [{ label: 'Joriy oy', total: totalAmount }] : [];
    }
    return monthlyRevenue.slice(-6).map((item) => {
      const raw = item.month || item.bucket || '';
      let label = raw;
      if (raw) {
        try {
          label = formatMonth(raw);
        } catch {
          label = raw;
        }
      }
      return { label, total: Number(item.total) || 0 };
    });
  }, [monthlyRevenue, totalAmount]);

  const hasData = chartData.length > 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-subtle bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-apple-blue/10 text-apple-blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-primary">To'lovlar statistikasi</h3>
        </div>
        <Link to="/payments" className="text-xs font-medium text-brand-500 hover:text-brand-600">
          Batafsil
        </Link>
      </div>

      <div className="pt-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold tracking-tight tabular-nums text-primary">
            {formatCurrency(totalAmount)}
          </span>
          {totalAmount > 0 && (
            <span className="inline-flex items-center rounded-full bg-apple-green/10 px-2 py-0.5 text-[11px] font-medium text-apple-green">
              Jami tushum
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-tertiary">Qabul qilingan to'lovlar balansi</p>
      </div>

      <div className="relative mt-4 min-h-[160px] w-full flex-1 text-tertiary">
        {hasData ? (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="opacity-[0.08]"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'currentColor', fontSize: 11 }}
                tickFormatter={compactNumber}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.05 }} />
              <Bar dataKey="total" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-36 flex-col items-center justify-center rounded-lg border border-dashed border-subtle p-4 text-center">
            <span className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04] text-tertiary dark:bg-white/[0.06]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </span>
            <p className="text-xs font-medium text-primary">To'lovlar tarixi mavjud emas</p>
            <p className="mt-0.5 max-w-xs text-xs text-tertiary">
              Qabul qilingan to'lovlar bu yerda oylik tushum ko'rinishida aks etadi.
            </p>
            <Link
              to="/payments"
              className="mt-2.5 inline-flex items-center gap-1 rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-500 transition-colors hover:bg-brand-500/15"
            >
              To'lov qo'shish
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentRevenueBar;
