import { type ReactNode, type MouseEvent, type CSSProperties, useEffect, useState, useRef } from 'react';

interface KPICardProps {
  title: string;
  value: number;
  formattedValue?: string;
  description?: string;
  icon: ReactNode;
  trend?: {
    label: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  sparkline?: number[];
  accentColor?: string;
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (!values || values.length < 2) return null;
  const w = 72;
  const h = 26;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`kpi-spark-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#kpi-spark-${color.replace(/[^a-zA-Z0-9]/g, '')})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CountUpNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: number;
    const duration = 800; // ms
    const initial = display;
    const diff = value - initial;
    if (diff === 0) return;

    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(initial + diff * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="tabular-nums">
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

export function KPICard({
  title,
  value,
  formattedValue,
  description,
  icon,
  trend,
  sparkline,
  accentColor = 'var(--primary)',
}: KPICardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    cardRef.current.style.setProperty('--spotlight-x', `${x}%`);
    cardRef.current.style.setProperty('--spotlight-y', `${y}%`);
    cardRef.current.style.setProperty('--spotlight-opacity', '1');
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.setProperty('--spotlight-opacity', '0');
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-sm)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-medium)] hover:shadow-[var(--shadow-md)] sm:p-6"
      style={
        {
          '--spotlight-x': '50%',
          '--spotlight-y': '50%',
          '--spotlight-opacity': '0',
        } as CSSProperties
      }
    >
      {/* Zero-render CSS spotlight reflection */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: 'var(--spotlight-opacity)',
          background: `radial-gradient(400px circle at var(--spotlight-x) var(--spotlight-y), rgba(255,255,255,0.12), transparent 60%)`,
        }}
      />

      {/* Top row: Icon + Trend / Sparkline */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{
            color: accentColor,
            backgroundColor: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
          }}
        >
          {icon}
        </div>

        <div className="flex flex-col items-end gap-1">
          {sparkline && sparkline.length > 1 && (
            <MiniSparkline values={sparkline} color={accentColor} />
          )}

          {trend && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight ${
                trend.isNeutral
                  ? 'bg-[var(--neutral-soft)] text-[var(--text-secondary)]'
                  : trend.isPositive
                    ? 'bg-[var(--success-soft)] text-[var(--success)]'
                    : 'bg-[var(--danger-soft)] text-[var(--danger)]'
              }`}
            >
              {!trend.isNeutral && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className={trend.isPositive ? '' : 'rotate-180'}
                >
                  <path d="M7 17 17 7" /><path d="M7 7h10v10" />
                </svg>
              )}
              {trend.label}
            </span>
          )}
        </div>
      </div>

      {/* Metric content */}
      <div className="relative z-10 mt-5">
        <div
          className="truncate text-2xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums sm:text-3xl"
          title={formattedValue || String(value)}
        >
          {formattedValue ? (
            formattedValue
          ) : (
            <CountUpNumber value={value} />
          )}
        </div>

        <p className="mt-1 truncate text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {title}
        </p>

        {description && (
          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-tertiary)]">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
