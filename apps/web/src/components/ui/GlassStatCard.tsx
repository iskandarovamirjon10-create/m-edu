/**
 * GlassStatCard V2 — KPI metric card for dashboards.
 *
 * Features: loading skeleton, sparkline, trend, accent color, numeric typography
 */
import { type ReactNode } from 'react';

type TrendDirection = 'up' | 'down' | 'neutral';
type AccentColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'violet' | 'slate';

interface SparklineProps {
  values: number[];
  color: string;
}

function Sparkline({ values, color }: SparklineProps) {
  if (values.length < 2) return null;
  const w = 64;
  const h = 24;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  const fillPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="flex-shrink-0">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#spark-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ACCENT_STYLES: Record<AccentColor, { icon: string; value: string; spark: string }> = {
  indigo:  { icon: 'text-[var(--primary)] bg-[var(--primary-soft)]',      value: 'text-[var(--primary)]',  spark: 'var(--primary)' },
  emerald: { icon: 'text-[var(--success)] bg-[var(--success-soft)]',      value: 'text-[var(--success)]',  spark: 'var(--success)' },
  amber:   { icon: 'text-[var(--warning)] bg-[var(--warning-soft)]',      value: 'text-[var(--warning)]',  spark: 'var(--warning)' },
  rose:    { icon: 'text-[var(--danger)]  bg-[var(--danger-soft)]',       value: 'text-[var(--danger)]',   spark: 'var(--danger)'  },
  cyan:    { icon: 'text-[var(--info)]    bg-[var(--info-soft)]',         value: 'text-[var(--info)]',     spark: 'var(--info)'    },
  violet:  { icon: 'text-[var(--primary)] bg-[var(--primary-soft)]',      value: 'text-[var(--text-primary)]', spark: 'var(--primary)' },
  slate:   { icon: 'text-[var(--neutral)] bg-[var(--neutral-soft)]',      value: 'text-[var(--text-primary)]', spark: 'var(--neutral)'  },
};

const TREND_CLASSES: Record<TrendDirection, string> = {
  up:      'text-[var(--success)]',
  down:    'text-[var(--danger)]',
  neutral: 'text-[var(--text-tertiary)]',
};

const TREND_ICONS: Record<TrendDirection, string> = {
  up:      '↑',
  down:    '↓',
  neutral: '→',
};

interface GlassStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; direction: TrendDirection; label?: string };
  sparkline?: number[];
  accent?: AccentColor;
  loading?: boolean;
  description?: string;
  className?: string;
}

// Skeleton state
function StatCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={[
        'relative overflow-hidden',
        'bg-[var(--bg-card)]',
        'backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)_saturate(1.5)]',
        'border border-[var(--border)]',
        'rounded-[var(--radius-xl)]',
        'p-5 shadow-[var(--shadow-md)]',
        className,
      ].join(' ')}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded-[var(--radius-sm)] skeleton-shimmer" />
          <div className="h-9 w-9 rounded-[var(--radius-md)] skeleton-shimmer" />
        </div>
        <div className="h-8 w-20 rounded-[var(--radius-sm)] skeleton-shimmer" />
        <div className="h-3.5 w-16 rounded-[var(--radius-sm)] skeleton-shimmer" />
      </div>
    </div>
  );
}

export function GlassStatCard({
  label,
  value,
  icon,
  trend,
  sparkline,
  accent = 'indigo',
  loading = false,
  description,
  className = '',
}: GlassStatCardProps) {
  if (loading) return <StatCardSkeleton className={className} />;

  const accentStyle = ACCENT_STYLES[accent];

  return (
    <div
      className={[
        'relative overflow-hidden',
        'bg-[var(--bg-card)]',
        'backdrop-blur-[16px] [-webkit-backdrop-filter:blur(16px)_saturate(1.5)]',
        'border border-[var(--border)]',
        'rounded-[var(--radius-xl)]',
        'p-5 shadow-[var(--shadow-md)]',
        'transition-[background-color,box-shadow,border-color,transform]',
        'duration-[var(--duration-normal)] [transition-timing-function:var(--ease-standard)]',
        'hover:bg-[var(--bg-card-hover)]',
        'hover:shadow-[var(--shadow-lg)]',
        className,
      ].join(' ')}
    >
      {/* Reflection */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] z-0"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Header row: label + icon */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[var(--text-label)] font-medium text-[var(--text-secondary)] leading-tight">
            {label}
          </p>
          {icon && (
            <span
              className={[
                'flex-shrink-0 inline-flex items-center justify-center',
                'w-9 h-9 rounded-[var(--radius-md)]',
                '[&>svg]:w-4 [&>svg]:h-4',
                accentStyle.icon,
              ].join(' ')}
            >
              {icon}
            </span>
          )}
        </div>

        {/* Value + sparkline */}
        <div className="flex items-end justify-between gap-3">
          <p
            className={[
              'text-numeric-lg text-[var(--text-primary)]',
              'font-[700] leading-none tracking-[-0.025em]',
              'font-variant-numeric: tabular-nums',
            ].join(' ')}
            style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: "'tnum'" }}
          >
            {value}
          </p>
          {sparkline && sparkline.length >= 2 && (
            <Sparkline values={sparkline} color={`var(--_${accent === 'indigo' ? 'brand-500' : accent === 'emerald' ? 'green-500' : accent === 'amber' ? 'amber-500' : accent === 'rose' ? 'red-500' : 'brand-500'})`} />
          )}
        </div>

        {/* Trend or description */}
        {trend && (
          <p className={['text-[var(--text-caption)] flex items-center gap-1 font-medium', TREND_CLASSES[trend.direction]].join(' ')}>
            <span aria-hidden>{TREND_ICONS[trend.direction]}</span>
            <span>{trend.value}</span>
            {trend.label && <span className="text-[var(--text-tertiary)] font-normal">{trend.label}</span>}
          </p>
        )}
        {!trend && description && (
          <p className="text-[var(--text-caption)] text-[var(--text-tertiary)]">{description}</p>
        )}
      </div>
    </div>
  );
}

export default GlassStatCard;
