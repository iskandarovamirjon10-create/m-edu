/**
 * GlassStatCard — Apple-premium KPI tile + simple SVG sparkline.
 */
import { type ReactNode } from 'react';
import { cn } from '@/lib/design';

export type TrendDirection = 'up' | 'down' | 'neutral';

export type AccentColor =
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'violet'
  | 'slate';

export type StatCardSize = 'sm' | 'md' | 'lg';

export interface SparklineProps {
  values: number[];
  /** Stroke color (CSS color or var). */
  color: string;
  /** @deprecated no-op */
  glow?: string;
  /** @deprecated no-op */
  animated?: boolean;
  width?: number;
  height?: number;
}

export interface GlassStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; direction: TrendDirection; label?: string };
  sparkline?: number[];
  accent?: AccentColor;
  loading?: boolean;
  description?: string;
  className?: string;
  size?: StatCardSize;
  interactive?: boolean;
  onClick?: () => void;
  /** @deprecated no-op */
  disableRefraction?: boolean;
  /** @deprecated no-op */
  disableMotion?: boolean;
  /** @deprecated no-op */
  gradientTitle?: boolean;
  /** @deprecated no-op */
  glow?: boolean;
  /** @deprecated no-op */
  noReflection?: boolean;
}

const ACCENTS: Record<AccentColor, { color: string; bg: string }> = {
  indigo: { color: 'var(--primary)', bg: 'var(--tone-blue-bg)' },
  emerald: { color: 'var(--success)', bg: 'var(--tone-green-bg)' },
  amber: { color: 'var(--warning)', bg: 'var(--tone-orange-bg)' },
  rose: { color: 'var(--danger)', bg: 'var(--tone-red-bg)' },
  cyan: { color: 'var(--info)', bg: 'var(--tone-blue-bg)' },
  violet: { color: 'var(--tone-purple-fg)', bg: 'var(--tone-purple-bg)' },
  slate: { color: 'var(--text-secondary)', bg: 'var(--tone-bg)' },
};

const TREND: Record<TrendDirection, { fg: string; bg: string; path: string }> = {
  up: { fg: 'var(--success)', bg: 'var(--tone-green-bg)', path: 'M6 14 10 10 14 14 18 6' },
  down: { fg: 'var(--danger)', bg: 'var(--tone-red-bg)', path: 'M6 10 10 14 14 10 18 18' },
  neutral: { fg: 'var(--text-tertiary)', bg: 'var(--tone-bg)', path: 'M6 12h12' },
};

const SIZES: Record<
  StatCardSize,
  { pad: string; label: string; value: string; icon: string; gap: string }
> = {
  sm: { pad: 'p-3 sm:p-4', label: 'text-xs', value: 'text-lg sm:text-xl', icon: 'h-8 w-8', gap: 'gap-2' },
  md: { pad: 'p-3.5 sm:p-5', label: 'text-xs', value: 'text-xl sm:text-2xl', icon: 'h-9 w-9', gap: 'gap-2.5 sm:gap-3' },
  lg: { pad: 'p-4 sm:p-6', label: 'text-sm', value: 'text-2xl sm:text-3xl', icon: 'h-10 w-10 sm:h-11 sm:w-11', gap: 'gap-3 sm:gap-4' },
};

export function Sparkline({ values, color, width = 64, height = 24 }: SparklineProps) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pad = 2;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - pad - ((v - min) / range) * (height - 2 * pad);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
      className="flex-shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatCardSkeleton({ className = '', size = 'md' }: { className?: string; size?: StatCardSize }) {
  const sz = SIZES[size];
  return (
    <div
      aria-hidden="true"
      className={cn('bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card', sz.pad, className)}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="skeleton-shimmer h-3.5 rounded-lg" style={{ width: '6rem' }} />
        <div className="skeleton-shimmer h-9 w-9 rounded-xl" />
      </div>
      <div className="skeleton-shimmer mt-3 h-7 rounded-lg" style={{ width: '5rem' }} />
      <div className="skeleton-shimmer mt-2 h-3.5 rounded-lg" style={{ width: '4rem' }} />
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
  size = 'md',
  interactive = false,
  onClick,
}: GlassStatCardProps) {
  if (loading) return <StatCardSkeleton className={className} size={size} />;

  const accentCfg = ACCENTS[accent];
  const sz = SIZES[size];
  const trendCfg = trend ? TREND[trend.direction] : null;

  const content = (
    <span className={cn('relative z-[1] flex flex-col', sz.gap)}>
      <span className="flex items-start justify-between gap-2">
        <span className={cn('font-medium leading-tight text-secondary', sz.label)}>
          {label}
        </span>
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4',
              sz.icon,
            )}
            style={{ color: accentCfg.color, background: accentCfg.bg }}
          >
            {icon}
          </span>
        )}
      </span>

      <span className="flex items-end justify-between gap-3">
        <span className={cn('font-semibold leading-none tracking-tight tabular-nums text-primary min-w-0 truncate', sz.value)}>
          {value}
        </span>
        {sparkline && sparkline.length >= 2 && (
          <Sparkline values={sparkline} color={accentCfg.color} />
        )}
      </span>

      {trend && trendCfg ? (
        <span
          className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ color: trendCfg.fg, background: trendCfg.bg }}
        >
          <svg
            className="h-3 w-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d={trendCfg.path} />
          </svg>
          <span>{trend.value}</span>
          {trend.label && <span className="font-normal text-tertiary">{trend.label}</span>}
        </span>
      ) : description ? (
        <span className="text-xs text-tertiary">{description}</span>
      ) : null}
    </span>
  );

  const base = cn(
    'relative min-w-0 max-w-full box-border overflow-hidden bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] text-left transition-all duration-200',
    sz.pad,
    interactive &&
      'cursor-pointer hover:shadow-card-hover hover:border-black/[0.1] dark:hover:border-white/[0.15] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.985] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
    className,
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        data-component="glass-stat-card"
        data-accent={accent}
        data-size={size}
        className={cn(base, 'block w-full')}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-component="glass-stat-card"
      data-accent={accent}
      data-size={size}
      className={base}
    >
      {content}
    </div>
  );
}

export default GlassStatCard;
