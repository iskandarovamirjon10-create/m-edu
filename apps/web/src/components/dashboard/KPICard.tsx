/**
 * ============================================================================
 * KPICard v3.0 — iOS 27 Liquid Glass Edition (Solarium Architecture)
 * ============================================================================
 *
 * Optical Physics & Craft:
 *  - Multi-layered refractive Liquid Glass lens (zero legacy flat glassmorphism)
 *  - Curved top specular meniscus + dynamic bottom-right ambient caustic bloom
 *  - 3D Jewel Squircle icon orb with inner rim refraction & elevation shadow
 *  - Holographic SVG Sparkline with optical glow filter & live terminal beacon
 *  - Tactile Liquid Pill trend capsule (Jade Emerald / Crimson Coral / Titanium)
 *  - 100% API, a11y, sound effects, and reduced-motion compatibility preserved
 */

import { type CSSProperties, type KeyboardEvent, type ReactNode, useId, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn, CountUp, TONES, resolveTone, usePrefersReducedMotion } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useLiquidGlassLens } from '@/layouts/core/liquidGlassOptics';
import {
  useAdaptiveGlassTint,
  useLiquidGlassPhysics,
} from '@/layouts/core/useLiquidGlass';

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

/* ============================================================================
 * iOS 27 JEWEL PALETTE & LIQUID CAPSULE TOKENS
 * ========================================================================== */

type TrendTone = 'positive' | 'neutral' | 'negative';

const LIQUID_TREND_PALETTE: Record<
  TrendTone,
  {
    stroke: string;
    beacon: string;
    chipStyle: CSSProperties;
    textClass: string;
    dotClass: string;
  }
> = {
  positive: {
    stroke: '#10B981', // Jade Emerald
    beacon: '#059669',
    chipStyle: {
      background:
        'linear-gradient(135deg, rgba(16,185,129,0.16) 0%, rgba(20,184,166,0.06) 100%)',
      border: '1px solid rgba(16,185,129,0.28)',
      boxShadow:
        'inset 0 1px 0.5px rgba(255,255,255,0.75), 0 4px 12px -4px rgba(16,185,129,0.28)',
    },
    textClass: 'text-emerald-700 dark:text-emerald-300',
    dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]',
  },
  neutral: {
    stroke: '#94A3B8', // Titanium (matches the slate chip + text classes)
    beacon: '#64748B',
    chipStyle: {
      background:
        'linear-gradient(135deg, rgba(100,116,139,0.14) 0%, rgba(148,163,184,0.05) 100%)',
      border: '1px solid rgba(148,163,184,0.24)',
      boxShadow: 'inset 0 1px 0.5px rgba(255,255,255,0.7)',
    },
    textClass: 'text-slate-600 dark:text-slate-300',
    dotClass: 'bg-slate-400 dark:bg-slate-400',
  },
  negative: {
    stroke: '#F43F5E', // Crimson Coral
    beacon: '#E11D48',
    chipStyle: {
      background:
        'linear-gradient(135deg, rgba(244,63,94,0.16) 0%, rgba(225,29,72,0.06) 100%)',
      border: '1px solid rgba(244,63,94,0.28)',
      boxShadow:
        'inset 0 1px 0.5px rgba(255,255,255,0.75), 0 4px 12px -4px rgba(244,63,94,0.28)',
    },
    textClass: 'text-rose-700 dark:text-rose-300',
    dotClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]',
  },
};

/* ============================================================================
 * HELPERS
 * ========================================================================== */

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

/* ============================================================================
 * HOLOGRAPHIC LIQUID SPARKLINE
 * ========================================================================== */

function Sparkline({
  tone,
  gradientId,
}: {
  tone: TrendTone;
  gradientId: string;
}) {
  const { stroke } = LIQUID_TREND_PALETTE[tone];

  const path =
    tone === 'positive'
      ? 'M0 26 C 15 24, 30 20, 45 16 C 60 12, 75 18, 90 8 C 105 3, 112 5, 116 3'
      : tone === 'negative'
        ? 'M0 4 C 15 6, 30 12, 45 14 C 60 22, 75 18, 90 24 C 105 27, 112 26, 116 28'
        : 'M0 16 C 20 12, 40 20, 60 14 C 80 18, 100 13, 116 15';

  const fillPath = `${path} L 116 32 L 0 32 Z`;
  const endY = tone === 'positive' ? 3 : tone === 'negative' ? 28 : 15;

  return (
    <svg
      viewBox="0 0 120 32"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-1 -right-1 h-16 w-32 opacity-40 transition-all duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-75 sm:h-18 sm:w-36 lg:h-20 lg:w-44 dark:opacity-35 dark:group-hover:opacity-65 motion-reduce:transition-none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.42" />
          <stop offset="65%" stopColor={stroke} stopOpacity="0.10" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={fillPath}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.path
        d={path}
        stroke={stroke}
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
      {/* Optical terminal beacon */}
      <circle cx="116" cy={endY} r="3" fill={stroke} fillOpacity="0.3" />
      <circle cx="116" cy={endY} r="1.75" fill={stroke} />
    </svg>
  );
}

/* ============================================================================
 * MAIN COMPONENT — KPICard (iOS 27 Liquid Glass)
 * ========================================================================== */

export function KPICard({
  title,
  value,
  formattedValue,
  description,
  icon,
  accentColor = '#4F46E5', // Deep Electric Indigo default
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const interactive = Boolean(href || onClick);

  useLiquidGlassPhysics(cardRef, {
    enabled: !reduced && interactive,
    tilt: interactive,
    press: interactive,
    maxTilt: 2.4,
  });

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
  const trendTone: TrendTone = trend?.isNeutral
    ? 'neutral'
    : trend?.isPositive
      ? 'positive'
      : 'negative';
  const trendConfig = LIQUID_TREND_PALETTE[trendTone];

  const isHexAccent = /^#([0-9a-f]{3,8})$/i.test(accentColor);
  const tone = isHexAccent ? 'blue' : resolveTone(accentColor);
  const gradientId = `kpi-spark-${uid.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const styleVars = {
    '--lgx-radius': '26px',
    '--kpi-caustic': withAlpha(accentColor, 0.28),
    '--kpi-rim-hover': withAlpha(accentColor, 0.42),
    '--kpi-accent-solid': accentColor,
  } as CSSProperties;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: reduced ? 0 : 0.48,
        delay: reduced ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="h-full [perspective:1000px]"
    >
      <div
        ref={cardRef}
        role={interactive ? 'button' : 'group'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={`${title}: ${formattedValue ?? value}${interactive ? ' — ochish uchun bosing' : ''}`}
        onClick={interactive ? activate : undefined}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        style={styleVars}
        className={cn(
          'lgx lgx--clear group relative flex h-full flex-col justify-between gap-3.5 p-4 sm:p-5 lg:p-5.5',
          'transform-gpu',
          interactive &&
            cn(
              'cursor-pointer select-none outline-none',
              'hover:border-[color:var(--kpi-rim-hover)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--kpi-accent-solid)]',
              'motion-reduce:transition-none',
            ),
        )}
      >
        <span aria-hidden="true" className="lgx__layer lgx__depth" />
        <span aria-hidden="true" className="lgx__specular" />
        <span aria-hidden="true" className="lgx__rim" />
      {/* Ambient caustic bloom: the only colour on the card, and it breathes. */}
      <span
        aria-hidden="true"
        className="kpi-caustic pointer-events-none absolute -bottom-8 -right-8 h-28 w-28 rounded-full opacity-55 blur-2xl transition-opacity duration-500 group-hover:opacity-90 dark:opacity-40"
        style={{ background: withAlpha(accentColor, 0.32) }}
      />

      {/* Accent light follows the lens glint (no React state, no re-render). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(340px circle at var(--lgx-glint-x, 50%) var(--lgx-glint-y, 8%), ${withAlpha(
            accentColor,
            0.14,
          )}, transparent 70%)`,
        }}
      />

      {/* 3. Holographic Sparkline */}
      <Sparkline tone={trendTone} gradientId={gradientId} />

      {/* Top row: Title + 3D Refractive Squircle Icon */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400 sm:text-[11.5px]">
          {title}
        </span>

        <span
          className={cn(
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] transition-transform duration-300 ease-out sm:h-11 sm:w-11',
            'group-hover:scale-[1.08] group-hover:-rotate-2 group-active:scale-100 motion-reduce:group-hover:scale-100',
            !isHexAccent && TONES[tone].chip,
          )}
          style={
            isHexAccent
              ? {
                  background: `linear-gradient(135deg, ${withAlpha(accentColor, 0.20)} 0%, ${withAlpha(accentColor, 0.07)} 100%)`,
                  color: accentColor,
                  border: `1px solid ${withAlpha(accentColor, 0.30)}`,
                  boxShadow: `0 10px 22px -6px ${withAlpha(accentColor, 0.35)}, inset 0 1.5px 1px rgba(255,255,255,0.82), inset 0 -1px 1px ${withAlpha(accentColor, 0.15)}`,
                }
              : undefined
          }
          aria-hidden="true"
        >
          {/* Inner lens reflection on icon squircle */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-1 top-0.5 h-1/2 rounded-t-[12px]"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.65) 0%, transparent 100%)',
            }}
          />
          <span className="relative z-10 drop-shadow-xs dark:brightness-125">{icon}</span>
        </span>
      </div>

      {/* Value Display */}
      <div className="relative z-10 text-[25px] font-extrabold tabular-nums tracking-tight text-slate-900 dark:text-white sm:text-[28px] lg:text-[31px]">
        {numeric ? (
          <CountUp value={value} prefix={prefix} suffix={suffix} />
        ) : (
          <span>{prefix}</span>
        )}
      </div>

      {/* Footer: Description + Liquid Pill Trend Capsule */}
      {(description || trend) && (
        <div className="relative z-10 flex items-center justify-between gap-2 pt-0.5">
          <span className="line-clamp-1 min-w-0 flex-1 truncate text-[11.5px] font-medium text-slate-500/90 dark:text-slate-400/90 sm:text-xs">
            {description}
          </span>

          {trend && (
            <span
              style={trendConfig.chipStyle}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold tracking-tight backdrop-blur-md',
                trendConfig.textClass,
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', trendConfig.dotClass)}
                aria-hidden="true"
              />
              <span>{trend.label}</span>
            </span>
          )}
        </div>
      )}
      </div>
    </motion.div>
  );
}

export default KPICard;