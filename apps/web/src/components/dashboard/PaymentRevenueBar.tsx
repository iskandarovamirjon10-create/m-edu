/**
 * PaymentRevenueBar — iOS 27 Spatial Liquid Glass Financial Analytics Edition
 *
 * Monthly collected revenue with Apple Card-inspired refractive glass bars,
 * automatic peak-month illumination, Month-over-Month (MoM) telemetry badge,
 * and specular rim highlights.
 */

import { useMemo, useId } from 'react';
import {
  BarChart,
  Bar,
  Cell,
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

interface ChartPoint {
  label: string;
  total: number;
  isPeak?: boolean;
  isLatest?: boolean;
}

interface BarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

/* ============================================================================
 * iOS 27 LIQUID GLASS TOOLTIP
 * ========================================================================== */

function BarTooltip({ active, payload }: BarTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white/85 px-3.5 py-2.5 shadow-[0_18px_40px_-10px_rgba(15,23,42,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-[200%] dark:border-white/15 dark:bg-[#0F1422]/85 dark:shadow-[0_20px_45px_-10px_rgba(0,0,0,0.7),inset_0_1px_0.5px_rgba(255,255,255,0.2)]">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-2 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 to-transparent dark:via-white/30"
      />
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            point.isPeak
              ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
              : 'bg-[#2563EB] shadow-[0_0_8px_#2563EB]'
          }`}
        />
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
          {point.label}
        </p>
        {point.isPeak && (
          <span className="rounded-full bg-[#10B981]/15 px-1.5 py-0.2 text-[9.5px] font-extrabold text-[#059669] dark:text-[#34D399]">
            MAX
          </span>
        )}
      </div>
      <p className="mt-1 text-[15px] font-extrabold tracking-tight tabular-nums text-[#0F172A] dark:text-[#F8FAFC]">
        {formatCurrency(point.total)}
      </p>
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export function PaymentRevenueBar({
  totalAmount = 0,
  monthlyRevenue = [],
}: PaymentRevenueBarProps) {
  const uid = useId().replace(/:/g, '');
  const primaryBarGradId = `ios27-bar-primary-${uid}`;
  const peakBarGradId = `ios27-bar-peak-${uid}`;

  const chartData = useMemo<ChartPoint[]>(() => {
    let base: Array<{ label: string; total: number }> = [];

    if (!monthlyRevenue?.length) {
      base = totalAmount > 0 ? [{ label: 'Joriy oy', total: totalAmount }] : [];
    } else {
      base = monthlyRevenue.slice(-6).map((item) => {
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
    }

    if (!base.length) return [];

    const maxVal = Math.max(...base.map((d) => d.total), 0);

    return base.map((item, idx) => ({
      ...item,
      isPeak: maxVal > 0 && item.total === maxVal && base.length > 1,
      isLatest: idx === base.length - 1,
    }));
  }, [monthlyRevenue, totalAmount]);

  // Derived telemetry metrics (Average & MoM growth)
  const metrics = useMemo(() => {
    if (!chartData.length) {
      return { avg: 0, peakLabel: '—', momPercent: null as number | null };
    }
    const sum = chartData.reduce((acc, item) => acc + item.total, 0);
    const avg = Math.round(sum / chartData.length);
    const peakItem = chartData.reduce(
      (best, cur) => (cur.total > best.total ? cur : best),
      chartData[0],
    );

    let momPercent: number | null = null;
    if (chartData.length >= 2) {
      const prev = chartData[chartData.length - 2].total;
      const curr = chartData[chartData.length - 1].total;
      if (prev > 0) {
        momPercent = Math.round(((curr - prev) / prev) * 100);
      }
    }

    return {
      avg,
      peakLabel: peakItem?.total > 0 ? peakItem.label : '—',
      momPercent,
    };
  }, [chartData]);

  const hasData = chartData.length > 0;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/75 bg-white/[0.68] p-5 backdrop-blur-3xl backdrop-saturate-[200%] shadow-[0_24px_60px_-15px_rgba(15,23,42,0.07),0_4px_20px_-2px_rgba(15,23,42,0.03),inset_0_1px_1px_rgba(255,255,255,0.85)] transition-all duration-300 dark:border-white/[0.11] dark:bg-[#0B0F1A]/[0.68] dark:shadow-[0_28px_70px_-15px_rgba(0,0,0,0.65),inset_0_1px_0.5px_rgba(255,255,255,0.16)] sm:p-6">
      {/* iOS 27 Top Specular Rim & Optical Glaze */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/30"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/40 via-white/5 to-transparent dark:from-white/[0.04] dark:to-transparent"
      />

      {/* Ambient Volumetric Caustic Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-gradient-to-br from-[#2563EB]/20 via-[#10B981]/15 to-transparent blur-3xl transition-opacity duration-500 group-hover:opacity-90"
      />

      {/* ============================================================
          HEADER: Squircle Emblem + Title + Liquid Pill Action
      ============================================================ */}
      <div className="relative flex items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div
              aria-hidden="true"
              className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-[#2563EB] to-[#06B6D4] opacity-30 blur-xs"
            />
            <span
              className="relative flex h-10 w-10 items-center justify-center rounded-[0.95rem] text-white"
              style={{
                background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 50%, #0EA5E9 100%)',
                boxShadow:
                  '0 10px 22px -6px rgba(37,99,235,0.5), inset 0 1px 1px rgba(255,255,255,0.65)',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="5" width="20" height="14" rx="2.5" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </span>
          </div>

          <div>
            <h3 className="text-[15px] font-extrabold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              To&apos;lovlar statistikasi
            </h3>
            <p className="text-[11.5px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Oylik dinamika va tushum oqimi
            </p>
          </div>
        </div>

        <Link
          to="/payments"
          className="inline-flex items-center gap-1 rounded-full border border-black/[0.06] bg-white/75 px-3 py-1.5 text-[11.5px] font-bold text-[#2563EB] shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[#2563EB]/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.06] dark:text-[#60A5FA] dark:hover:bg-white/[0.1]"
        >
          <span>Batafsil</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* ============================================================
          HERO METRIC + DYNAMIC ISLAND TELEMETRY CAPSULES
      ============================================================ */}
      <div className="relative mt-1 rounded-[1.35rem] border border-black/[0.05] bg-white/[0.52] p-3.5 shadow-[inset_0_1px_2px_rgba(15,23,42,0.03),0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-white/[0.03] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-[#0F172A] dark:text-[#F8FAFC] sm:text-[28px]">
              {formatCurrency(totalAmount)}
            </span>

            {totalAmount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#059669] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-[#34D399]/30 dark:bg-[#10B981]/15 dark:text-[#34D399]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                Jami tushum
              </span>
            )}
          </div>

          {metrics.momPercent !== null && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
                metrics.momPercent >= 0
                  ? 'border border-[#10B981]/25 bg-[#10B981]/10 text-[#059669] dark:text-[#34D399]'
                  : 'border border-[#EF4444]/25 bg-[#EF4444]/10 text-[#EF4444]'
              }`}
            >
              <span>{metrics.momPercent >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(metrics.momPercent)}% o&apos;tgan oyga nisbatan</span>
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-2 text-[11px] font-semibold text-[#64748B] dark:border-white/[0.06] dark:text-[#94A3B8]">
          <span>Qabul qilingan to&apos;lovlar balansi</span>
          {hasData && (
            <div className="flex items-center gap-3 tabular-nums">
              <span>
                O&apos;rtacha:{' '}
                <strong className="font-bold text-[#0F172A] dark:text-[#E2E8F0]">
                  {compactNumber(metrics.avg)}
                </strong>
              </span>
              {metrics.peakLabel !== '—' && (
                <span>
                  Eng yuqori:{' '}
                  <strong className="font-bold text-[#10B981]">{metrics.peakLabel}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          CHART STAGE / EMPTY STATE
      ============================================================ */}
      <div className="relative mt-4 min-h-[175px] w-full flex-1 text-[#64748B] dark:text-[#94A3B8]">
        {hasData ? (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
              <defs>
                {/* iOS 27 Ultramarine Liquid Glass Bar Gradient */}
                <linearGradient id={primaryBarGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.95} />
                  <stop offset="55%" stopColor="#2563EB" stopOpacity={0.82} />
                  <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.38} />
                </linearGradient>

                {/* iOS 27 Biometric Emerald Peak Bar Gradient */}
                <linearGradient id={peakBarGradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34D399" stopOpacity={0.98} />
                  <stop offset="50%" stopColor="#10B981" stopOpacity={0.86} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.42} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 4"
                vertical={false}
                stroke="currentColor"
                className="opacity-[0.12] dark:opacity-[0.15]"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 600 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'currentColor', fontSize: 11, fontWeight: 600 }}
                tickFormatter={compactNumber}
              />
              <Tooltip
                content={<BarTooltip />}
                cursor={{
                  fill: 'currentColor',
                  fillOpacity: 0.05,
                  radius: 10,
                }}
              />
              <Bar
                dataKey="total"
                radius={[9, 9, 3, 3]}
                maxBarSize={32}
                animationDuration={850}
                animationEasing="ease-out"
              >
                {chartData.map((entry, idx) => (
                  <Cell
                    key={`cell-${entry.label}-${idx}`}
                    fill={`url(#${entry.isPeak ? peakBarGradId : primaryBarGradId})`}
                    stroke={
                      entry.isPeak
                        ? 'rgba(52, 211, 153, 0.65)'
                        : 'rgba(96, 165, 250, 0.55)'
                    }
                    strokeWidth={1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-black/10 bg-white/45 p-5 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
            <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80 text-[#2563EB] shadow-xs dark:border-white/10 dark:bg-white/[0.06] dark:text-[#60A5FA]">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2" y="5" width="20" height="14" rx="2.5" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </span>
            <p className="text-[13px] font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              To&apos;lovlar tarixi mavjud emas
            </p>
            <p className="mt-0.5 max-w-xs text-[11.5px] font-medium text-[#64748B] dark:text-[#94A3B8]">
              Qabul qilingan to&apos;lovlar bu yerda oylik tushum ko&apos;rinishida aks etadi.
            </p>
            <Link
              to="/payments"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[#2563EB]/25 bg-[#2563EB]/12 px-3.5 py-1.5 text-[11.5px] font-bold text-[#2563EB] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-all hover:bg-[#2563EB]/20 dark:border-[#3B82F6]/30 dark:bg-[#3B82F6]/15 dark:text-[#60A5FA]"
            >
              <span>+ To&apos;lov qo&apos;shish</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentRevenueBar;