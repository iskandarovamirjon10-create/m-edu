/**
 * ============================================================================
 * KPICard v2.1 — Executive metric tile (Hyper-Refractive Liquid Glass)
 * ============================================================================
 */

import { type CSSProperties, type KeyboardEvent, type ReactNode, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn, CountUp, TONES, resolveTone, usePrefersReducedMotion } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';

export interface KPICardTrend {
  label: string;
  isPositive?: boolean;
  isNeutral?: boolean;
}

export interface KPICardProps {
  title: string;
  value: number;
  formattedValue?: string;
  description?: string;
  icon: ReactNode;
  accentColor?: string;
  href?: string;
  onClick?: () => void;
  trend?: KPICardTrend;
  delay?: number;
}

const TREND_CHIP: Record<'positive' | 'neutral' | 'negative', string> = {
  positive: 'bg-apple-green/12 text-apple-green dark:bg-apple-green/18',
  neutral: 'bg-black/[0.06] text-secondary dark:bg-white/[0.08]',
  negative: 'bg-apple-red/12 text-apple-red dark:bg-apple-red/18',
};

const TREND_DOT: Record<'positive' | 'neutral' | 'negative', string> = {
  positive: 'bg-apple-green',
  neutral: 'bg-secondary/70',
  negative: 'bg-apple-red',
};

function withAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#')) return color;
  let h = color.slice(1);
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return color;
  const num = parseInt(h, 16);
  if (Number.isNaN(num)) return color;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function splitValue(formatted?: string): { prefix: string; suffix: string; numeric: boolean } {
  if (!formatted) return { prefix: '', suffix: '', numeric: true };
  const match = formatted.match(/\d+(?:[.,\s]\d+)*/);
  if (!match || match.index === undefined) {
    return { prefix: formatted, suffix: '', numeric: false };
  }
  return {
    prefix: formatted.slice(0, match.index),
    suffix: formatted.slice(match.index + match[0].length),
    numeric: true,
  };
}

function Sparkline({
  tone,
  gradientId,
}: {
  tone: 'positive' | 'neutral' | 'negative';
  gradientId: string;
}) {
  const strokeColor =
    tone === 'positive' ? '#34C759' : tone === 'negative' ? '#FF3B30' : '#6366F1';

  const path =
    tone === 'positive'
      ? 'M0 26 C 15 24, 30 20, 45 16 C 60 12, 75 18, 90 8 C 105 3, 115 5, 120 2'
      : tone === 'negative'
        ? 'M0 4 C 15 6, 30 12, 45 14 C 60 22, 75 18, 90 24 C 105 27, 115 26, 120 29'
        : 'M0 16 C 20 12, 40 20, 60 14 C 80 18, 100 13, 120 15';

  const fillPath =
    tone === 'positive'
      ? 'M0 26 C 15 24, 30 20, 45 16 C 60 12, 75 18, 90 8 C 105 3, 115 5, 120 2 L 120 32 L 0 32 Z'
      : tone === 'negative'
        ? 'M0 4 C 15 6, 30 12, 45 14 C 60 22, 75 18, 90 24 C 105 27, 115 26, 120 29 L 120 32 L 0 32 Z'
        : 'M0 16 C 20 12, 40 20, 60 14 C 80 18, 100 13, 120 15 L 120 32 L 0 32 Z';

  return (
    <svg
      viewBox="0 0 120 32"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-1 -right-2 h-14 w-28 opacity-30 transition-opacity duration-300 group-hover:opacity-55 sm:h-16 sm:w-32 lg:h-20 lg:w-40 dark:opacity-25 dark:group-hover:opacity-45 motion-reduce:transition-none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} />
      <path
        d={path}
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KPICard({
  title,
  value,
  formattedValue,
  description,
  icon,
  accentColor = '#6366F1',
  href,
  onClick,
  trend,
  delay = 0,
}: KPICardProps) {
  const navigate = useNavigate();
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();
  const uid = useId();
  const lastHoverRef = useRef(0);
  const interactive = Boolean(href || onClick);

  const activate = () => {
    sound.playPop();
    if (onClick) onClick();
    else if (href) navigate(href);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || e.repeat) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activate();
    }
  };

  const handleMouseEnter = () => {
    if (!interactive) return;
    const now = Date.now();
    if (now - lastHoverRef.current > 800) {
      lastHoverRef.current = now;
      sound.playTick();
    }
  };

  const { prefix, suffix, numeric } = splitValue(formattedValue);
  const trendTone = trend?.isNeutral ? 'neutral' : trend?.isPositive ? 'positive' : 'negative';

  const isHexAccent = /^#([0-9a-f]{3,8})$/i.test(accentColor);
  const tone = isHexAccent ? 'blue' : resolveTone(accentColor);
  const gradientId = `kpi-spark-${uid}`;

  const styleVars = {
    '--kpi-glow': withAlpha(accentColor, 0.45),
    '--kpi-accent-30': withAlpha(accentColor, 0.35),
    '--kpi-accent-solid': accentColor,
  } as CSSProperties;

  return (
    <motion.div
      role={interactive ? 'button' : 'group'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`${title}: ${formattedValue ?? value}${interactive ? ' — ochish uchun bosing' : ''}`}
      onClick={interactive ? activate : undefined}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduced ? 0 : 0.45,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      style={styleVars}
      className={cn(
        'group relative flex h-full flex-col justify-between gap-3 overflow-hidden rounded-[1.75rem]',
        'border border-white/65 bg-white/75 p-4 backdrop-blur-3xl backdrop-saturate-[210%] sm:p-4.5 lg:p-5.5',
        'shadow-[0_16px_48px_-12px_rgba(0,0,0,0.12),inset_0_1.5px_1.5px_rgba(255,255,255,0.95)]',
        'dark:border-white/[0.15] dark:bg-[#1C1C1E]/75 dark:shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.22)]',
        'transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent dark:before:via-white/40',
        interactive &&
          cn(
            'cursor-pointer select-none outline-none',
            'hover:-translate-y-1 hover:border-[color:var(--kpi-accent-30)]',
            'hover:shadow-[0_20px_52px_-14px_var(--kpi-glow),inset_0_1.5px_1.5px_rgba(255,255,255,0.95)]',
            'active:translate-y-0 active:scale-[0.98] active:duration-75',
            'motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100 motion-reduce:transition-none',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--kpi-accent-solid)]'
          )
      )}
    >
      <Sparkline tone={trendTone} gradientId={gradientId} />

      {/* Top row: label + icon */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-secondary sm:text-[11.5px]">
          {title}
        </span>
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 ease-out sm:h-11 sm:w-11',
            'group-hover:scale-[1.1] group-active:scale-100 motion-reduce:group-hover:scale-100',
            !isHexAccent && TONES[tone].chip
          )}
          style={
            isHexAccent
              ? { backgroundColor: withAlpha(accentColor, 0.15), color: accentColor }
              : undefined
          }
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      {/* Value */}
      <div className="relative z-10 text-[24px] font-bold tabular-nums tracking-tight text-primary sm:text-[28px] lg:text-[30px]">
        {numeric ? (
          <CountUp value={value} prefix={prefix} suffix={suffix} />
        ) : (
          <span>{prefix}</span>
        )}
      </div>

      {/* Footer: description + trend */}
      {(description || trend) && (
        <div className="relative z-10 flex items-center justify-between gap-2">
          <span className="line-clamp-1 min-w-0 flex-1 truncate text-[11.5px] font-medium text-tertiary sm:text-xs">
            {description}
          </span>
          {trend && (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight',
                TREND_CHIP[trendTone]
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', TREND_DOT[trendTone])}
                aria-hidden="true"
              />
              {trend.label}
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default KPICard;