/**
 * GlassStatCard — KPI metric card.
 */
import { type ReactNode } from 'react';

interface GlassStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' };
  className?: string;
}

export function GlassStatCard({ label, value, icon, trend, className = '' }: GlassStatCardProps) {
  const trendColor =
    trend?.direction === 'up'   ? 'text-[var(--state-success)]' :
    trend?.direction === 'down' ? 'text-[var(--state-error)]' :
    'text-[var(--text-muted)]';

  return (
    <div
      className={[
        'relative overflow-hidden',
        'bg-[var(--bg-card)]',
        'backdrop-blur-2xl backdrop-saturate-[1.6]',
        'border border-[var(--border-glass)]',
        'rounded-3xl',
        'p-6',
        'shadow-[var(--shadow-md)]',
        'transition-all duration-[280ms] ease-[cubic-bezier(.25,.46,.45,.94)]',
        'hover:shadow-[var(--shadow-lg)]',
        'hover:-translate-y-0.5',
        className,
      ].join(' ')}
    >
      {/* Reflection */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, transparent 50%, rgba(148,234,239,0.04) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
          {icon && (
            <span className="text-brand-700 opacity-70">{icon}</span>
          )}
        </div>
        <p className="text-[2.125rem] font-bold text-[var(--text-primary)] leading-none tracking-tight">
          {value}
        </p>
        {trend && (
          <p className={['text-sm mt-1', trendColor].join(' ')}>
            {trend.direction === 'up' && '↑ '}
            {trend.direction === 'down' && '↓ '}
            {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

export default GlassStatCard;
