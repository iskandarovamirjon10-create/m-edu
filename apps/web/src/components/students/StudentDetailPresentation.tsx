/**
 * M-EDU Detail Primitives — v2.0 ("Chromatic Liquid Glass · 120Hz ProMotion")
 *
 * 🎯 v2.0 Architectural, Optical & Motion Upgrades:
 *   1. [Bugfix] Connected `tone` prop across `SectionHeader`, `InfoRow`, and `PermissionToggle` (was ignored in v1).
 *   2. [Optics] 3-Stop Chromatic Mesh Avatars (`HeroAvatar`) with top dome specular lens & live radar status beacon.
 *   3. [Tactile] `PermissionToggle` now features a true iOS 27 spring-physics toggle switch + `role="switch"` accessibility.
 *   4. [Physics] 120Hz ProMotion spring variants (`blur` -> crisp interpolation) and diagonal hover sheen on `StatTile`.
 *   5. [Resilience] `CountUp` guards against NaN/Infinity and formats decimals with locale-aware thousand separators.
 *   6. [Skeleton] Multi-depth anatomical bone structure inside `DetailSkeleton` with staggered optical waves.
 */

import { memo, useRef, useEffect, type ReactNode, type SVGProps } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';

/* ══════════════════════════════════════════════════════════════════════════
 * 120Hz PROMOTION SPRING TOKENS & SPATIAL VARIANTS
 * ════════════════════════════════════════════════════════════════════════ */

export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 540, damping: 34, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.85 },
  soft:   { type: 'spring' as const, stiffness: 220, damping: 26, mass: 1.0 },
  bouncy: { type: 'spring' as const, stiffness: 460, damping: 22, mass: 0.7 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.048, delayChildren: 0.03 },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98, filter: 'blur(5px)' },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: SPRING.smooth,
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * UNIFIED CHROMATIC TONE ENGINE
 * ════════════════════════════════════════════════════════════════════════ */

export type ChromaticTone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
export type StatTone = Exclude<ChromaticTone, 'slate'>;

interface ToneStyleSet {
  tileBg: string;
  tileText: string;
  tileRing: string;
  tileGlow: string;
  chip: string;
  activeBorder: string;
  activeSurface: string;
  switchBg: string;
  accentHex: string;
}

export const TONE_MATRIX: Record<ChromaticTone, ToneStyleSet> = {
  blue: {
    tileBg: 'bg-[#0066FF]/10 dark:bg-[#2997FF]/16',
    tileText: 'text-[#0066FF] dark:text-[#52ADFF]',
    tileRing: 'ring-[#0066FF]/20 dark:ring-[#2997FF]/30',
    tileGlow: '0 8px 20px -6px rgba(0, 102, 255, 0.35)',
    chip: 'bg-[#0066FF]/10 text-[#0052CC] ring-[#0066FF]/24 dark:bg-[#2997FF]/16 dark:text-[#7CC2FF] dark:ring-[#2997FF]/32',
    activeBorder: 'border-[#0066FF]/40 dark:border-[#2997FF]/45',
    activeSurface: 'bg-gradient-to-br from-[#0066FF]/[0.08] via-[#00C7BE]/[0.03] to-transparent dark:from-[#2997FF]/[0.15] dark:to-transparent',
    switchBg: 'bg-gradient-to-r from-[#0066FF] to-[#3B49DF]',
    accentHex: '#0066FF',
  },
  green: {
    tileBg: 'bg-[#16B853]/10 dark:bg-[#30D158]/16',
    tileText: 'text-[#129E46] dark:text-[#4AE06E]',
    tileRing: 'ring-[#16B853]/22 dark:ring-[#30D158]/30',
    tileGlow: '0 8px 20px -6px rgba(22, 184, 83, 0.35)',
    chip: 'bg-[#16B853]/10 text-[#0E7A36] ring-[#16B853]/24 dark:bg-[#30D158]/16 dark:text-[#4AE06E] dark:ring-[#30D158]/32',
    activeBorder: 'border-[#16B853]/40 dark:border-[#30D158]/45',
    activeSurface: 'bg-gradient-to-br from-[#16B853]/[0.08] via-[#00C7BE]/[0.03] to-transparent dark:from-[#30D158]/[0.15] dark:to-transparent',
    switchBg: 'bg-gradient-to-r from-[#16B853] to-[#0D9488]',
    accentHex: '#16B853',
  },
  orange: {
    tileBg: 'bg-[#FF9500]/12 dark:bg-[#FF9F0A]/16',
    tileText: 'text-[#C93400] dark:text-[#FFB340]',
    tileRing: 'ring-[#FF9500]/24 dark:ring-[#FF9F0A]/30',
    tileGlow: '0 8px 20px -6px rgba(255, 149, 0, 0.35)',
    chip: 'bg-[#FF9500]/12 text-[#B85000] ring-[#FF9500]/26 dark:bg-[#FF9F0A]/16 dark:text-[#FFB340] dark:ring-[#FF9F0A]/32',
    activeBorder: 'border-[#FF9500]/45 dark:border-[#FF9F0A]/45',
    activeSurface: 'bg-gradient-to-br from-[#FF9500]/[0.09] to-transparent dark:from-[#FF9F0A]/[0.15] dark:to-transparent',
    switchBg: 'bg-gradient-to-r from-[#FF9500] to-[#F97316]',
    accentHex: '#FF9500',
  },
  red: {
    tileBg: 'bg-[#FF3B30]/10 dark:bg-[#FF453A]/16',
    tileText: 'text-[#D70015] dark:text-[#FF6961]',
    tileRing: 'ring-[#FF3B30]/22 dark:ring-[#FF453A]/30',
    tileGlow: '0 8px 20px -6px rgba(255, 59, 48, 0.35)',
    chip: 'bg-[#FF3B30]/10 text-[#D70015] ring-[#FF3B30]/24 dark:bg-[#FF453A]/16 dark:text-[#FF6961] dark:ring-[#FF453A]/32',
    activeBorder: 'border-[#FF3B30]/40 dark:border-[#FF453A]/45',
    activeSurface: 'bg-gradient-to-br from-[#FF3B30]/[0.08] to-transparent dark:from-[#FF453A]/[0.15] dark:to-transparent',
    switchBg: 'bg-gradient-to-r from-[#FF3B30] to-[#E11D48]',
    accentHex: '#FF3B30',
  },
  purple: {
    tileBg: 'bg-[#7C3AED]/10 dark:bg-[#BF5AF2]/16',
    tileText: 'text-[#6D28D9] dark:text-[#DF9EFF]',
    tileRing: 'ring-[#7C3AED]/22 dark:ring-[#BF5AF2]/30',
    tileGlow: '0 8px 20px -6px rgba(124, 58, 237, 0.35)',
    chip: 'bg-[#7C3AED]/10 text-[#6D28D9] ring-[#7C3AED]/24 dark:bg-[#BF5AF2]/16 dark:text-[#DF9EFF] dark:ring-[#BF5AF2]/32',
    activeBorder: 'border-[#7C3AED]/40 dark:border-[#BF5AF2]/45',
    activeSurface: 'bg-gradient-to-br from-[#7C3AED]/[0.08] via-[#EC4899]/[0.03] to-transparent dark:from-[#BF5AF2]/[0.15] dark:to-transparent',
    switchBg: 'bg-gradient-to-r from-[#7C3AED] to-[#9333EA]',
    accentHex: '#7C3AED',
  },
  slate: {
    tileBg: 'bg-slate-500/10 dark:bg-white/[0.07]',
    tileText: 'text-slate-600 dark:text-slate-300',
    tileRing: 'ring-slate-500/15 dark:ring-white/10',
    tileGlow: '0 6px 14px -6px rgba(100, 116, 139, 0.25)',
    chip: 'bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:bg-white/[0.08] dark:text-slate-300 dark:ring-white/15',
    activeBorder: 'border-slate-400/40 dark:border-white/20',
    activeSurface: 'bg-slate-500/[0.05] dark:bg-white/[0.04]',
    switchBg: 'bg-slate-600 dark:bg-slate-500',
    accentHex: '#64748B',
  },
};

/* Backward-compatible export for external modules */
export const STAT_PALETTE: Record<StatTone, { bg: string; text: string }> = {
  blue:   { bg: TONE_MATRIX.blue.tileBg,   text: TONE_MATRIX.blue.tileText },
  green:  { bg: TONE_MATRIX.green.tileBg,  text: TONE_MATRIX.green.tileText },
  orange: { bg: TONE_MATRIX.orange.tileBg, text: TONE_MATRIX.orange.tileText },
  red:    { bg: TONE_MATRIX.red.tileBg,    text: TONE_MATRIX.red.tileText },
  purple: { bg: TONE_MATRIX.purple.tileBg, text: TONE_MATRIX.purple.tileText },
};

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS & PRECISION VECTOR RENDERER
 * ════════════════════════════════════════════════════════════════════════ */

export const ICON_STROKE = 1.85;

export const I = {
  userCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4'],
  edit: ['M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7', 'M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'],
  plus: ['M12 5v14', 'M5 12h14'],
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M19 8v6', 'M22 11h-6'],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M23 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  usersRound: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M22 21v-2a4 4 0 0 0-3-3.9', 'M16 3.1a4 4 0 0 1 0 7.8'],
  checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'M22 4 12 14.01l-3-3'],
  calendar: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z'],
  calendarCheck: ['M8 2v4', 'M16 2v4', 'M3 10h18', 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z', 'M9 15l2 2 4-4'],
  creditCard: ['M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z', 'M1 10h22', 'M6 15h2'],
  face: ['M9 3H5a2 2 0 0 0-2 2v4', 'M15 3h4a2 2 0 0 1 2 2v4', 'M21 15v4a2 2 0 0 1-2 2h-4', 'M9 21H5a2 2 0 0 1-2-2v-4', 'M9.5 10v.5', 'M14.5 10v.5', 'M9 15a4 4 0 0 0 6 0'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.7 2z'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 6 12 13 2 6'],
  mapPin: ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  unlink: ['M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.71 1.71', 'M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  award: ['M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z', 'M8.2 13.9 7 22l5-3 5 3-1.2-8.1'],
  book: ['M12 7v14', 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z'],
  sparkles: ['M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z', 'M18.5 3.5v3', 'M20 5h-3', 'M5.5 18v2.5', 'M6.75 19.25h-2.5'],
  arrowRight: ['M5 12h14', 'M12 5l7 7-7 7'],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  check: ['M20 6 9 17l-5-5'],
} as const;

export const Icon = memo(function Icon({
  paths,
  size = 18,
  className = '',
  strokeWidth = ICON_STROKE,
  ...rest
}: {
  paths: readonly string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden="true"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * GLASS CARD SURFACE — 3D Chromatic Specular Container
 * ════════════════════════════════════════════════════════════════════════ */

export const GlassCardSurface = memo(function GlassCardSurface({
  children,
  className = '',
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={[
        'glass-card relative overflow-hidden rounded-2xl sm:rounded-[1.4rem]',
        interactive ? 'glass-card--interactive' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * CHROMATIC MESH AVATAR ENGINE
 * ════════════════════════════════════════════════════════════════════════ */

export const AVATAR_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ['#0066FF', '#2563EB', '#00C7BE'], // Sapphire -> Electric Cyan
  ['#4F46E5', '#7C3AED', '#EC4899'], // Indigo -> Violet -> Rose
  ['#059669', '#10B981', '#06B6D4'], // Emerald -> Mint -> Teal
  ['#0284C7', '#3B82F6', '#6366F1'], // Sky -> Cobalt -> Indigo
  ['#7C3AED', '#9333EA', '#3B82F6'], // Royal Purple -> Sapphire
  ['#0F172A', '#1E293B', '#3B82F6'], // Obsidian -> Deep Sapphire
];

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function avatarGradient(name: string): string {
  const [a, b, c] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 52%, ${c} 100%)`;
}

export function getInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((p) => p.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '—'
  );
}

export function formatStudentStatus(isActive: boolean | undefined) {
  return isActive === false
    ? { color: 'red' as const, label: 'enum.status.INACTIVE' }
    : { color: 'green' as const, label: 'enum.status.ACTIVE' };
}

export function formatGroupStatus(isActive: boolean) {
  return isActive
    ? { color: 'green' as const, label: 'enum.status.ACTIVE' }
    : { color: 'slate' as const, label: 'enum.status.INACTIVE' };
}

/* ══════════════════════════════════════════════════════════════════════════
 * COUNT-UP TELEMETRY ENGINE (120Hz rAF + Locale Decimal Support)
 * ════════════════════════════════════════════════════════════════════════ */

function formatNumber(n: number, decimals: number): string {
  if (!Number.isFinite(n)) return '0';
  return decimals > 0
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : Math.round(n).toLocaleString();
}

export const CountUp = memo(function CountUp({
  value,
  duration = 0.9,
  suffix = '',
  prefix = '',
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const prevValueRef = useRef<number>(0);

  const safeTarget = Number.isFinite(value) ? value : 0;

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    if (reduced) {
      prevValueRef.current = safeTarget;
      el.textContent = `${prefix}${formatNumber(safeTarget, decimals)}${suffix}`;
      return;
    }

    const from = prevValueRef.current;
    const to = safeTarget;
    prevValueRef.current = safeTarget;

    if (from === to) {
      el.textContent = `${prefix}${formatNumber(to, decimals)}${suffix}`;
      return;
    }

    let rafId = 0;
    let startTime: number | null = null;
    const durationMs = Math.max(120, duration * 1000);

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / durationMs);
      // Quintic Apple ease-out for silky deceleration
      const eased = 1 - Math.pow(1 - progress, 5);
      const current = from + (to - from) * eased;

      if (spanRef.current) {
        spanRef.current.textContent = `${prefix}${formatNumber(current, decimals)}${suffix}`;
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [safeTarget, duration, suffix, prefix, decimals, reduced]);

  return (
    <span ref={spanRef} className="tabular-nums">
      {`${prefix}${formatNumber(safeTarget, decimals)}${suffix}`}
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * SECTION HEADER — Tone-Aware Specular Header Bar
 * ════════════════════════════════════════════════════════════════════════ */

export const SectionHeader = memo(function SectionHeader({
  icon,
  title,
  subtitle,
  tone = 'blue',
  actions,
}: {
  icon: readonly string[];
  title: string;
  subtitle?: string;
  tone?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'slate';
  actions?: ReactNode;
}) {
  const t = TONE_MATRIX[tone];

  return (
    <div className="relative flex items-center gap-3.5 border-b border-[var(--border-subtle)] bg-gradient-to-r from-white/55 via-white/25 to-transparent dark:from-white/[0.035] dark:via-white/[0.015] dark:to-transparent px-5 py-3.5">
      <div
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.tileBg} ${t.tileText} ring-1 ring-inset ${t.tileRing} shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-transform duration-200`}
        style={{ boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), ${t.tileGlow}` }}
      >
        <Icon paths={icon} size={16} strokeWidth={2.05} />
      </div>

      <div className="min-w-0 flex-1">
        <h2 className=" truncate text-[14px] font-bold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 truncate text-[11.5px] font-medium text-[var(--text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ACTION BUTTON — Tactile Micro-Glass Control
 * ════════════════════════════════════════════════════════════════════════ */

export const ActionButton = memo(function ActionButton({
  icon,
  label,
  tone,
  onClick,
  disabled,
  loading,
}: {
  icon: readonly string[];
  label: string;
  tone: 'edit' | 'delete' | 'unlink';
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const styles = {
    edit:   'text-[#0066FF] hover:bg-[#0066FF]/12 hover:border-[#0066FF]/35 dark:text-[#52ADFF] dark:hover:bg-[#2997FF]/20',
    delete: 'text-[#FF3B30] hover:bg-[#FF3B30]/12 hover:border-[#FF3B30]/35 dark:text-[#FF6961] dark:hover:bg-[#FF453A]/20',
    unlink: 'text-[#FF9500] hover:bg-[#FF9500]/12 hover:border-[#FF9500]/35 dark:text-[#FFB340] dark:hover:bg-[#FF9F0A]/20',
  }[tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { scale: 1.08, y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.92 }}
      transition={SPRING.bouncy}
      aria-label={label}
      title={label}
      className={[
        'relative flex h-8 w-8 items-center justify-center rounded-xl outline-none select-none',
        'border border-white/85 bg-white/75 backdrop-blur-md',
        'shadow-[0_1px_0_#FFF_inset,0_3px_8px_-2px_rgba(15,23,42,0.07)]',
        'dark:border-white/[0.12] dark:bg-white/[0.06] dark:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset]',
        'transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        styles,
      ].join(' ')}
    >
      {loading ? (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <Icon paths={icon} size={14} strokeWidth={2.15} />
      )}
    </motion.button>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * HERO AVATAR — 3D Specular Squircle + Live Radar Status Beacon
 * ════════════════════════════════════════════════════════════════════════ */

export const HeroAvatar = memo(function HeroAvatar({
  name,
  isActive,
  size = 96,
}: {
  name: string;
  isActive: boolean | undefined;
  size?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const active = isActive !== false;
  const gradient = avatarGradient(name);

  return (
    <div
      className="group relative select-none"
      style={{ width: size, height: size }}
    >
      {/* Subsurface Chromatic Halo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-1.5 rounded-[1.5rem] opacity-40 blur-lg transition-opacity duration-300 group-hover:opacity-65 dark:opacity-50"
        style={{ background: gradient }}
      />

      <motion.div
        initial={reduced ? false : { scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={reduced ? undefined : { scale: 1.03, rotate: -1 }}
        transition={SPRING.bouncy}
        className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.35rem] font-extrabold text-white ring-2 ring-white/90 dark:ring-white/15"
        style={{
          background: gradient,
          fontSize: Math.round(size * 0.33),
          letterSpacing: '-0.02em',
          boxShadow:
            'inset 0 2px 2px rgba(255,255,255,0.55), inset 0 -2px 4px rgba(0,0,0,0.22), 0 12px 28px -6px rgba(15,23,42,0.25)',
        }}
      >
        {/* Top Optical Dome Specular Reflection */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/45 to-transparent"
        />
        <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.22)]">
          {getInitials(name)}
        </span>
      </motion.div>

      {/* Live Status Beacon */}
      <span
        className="absolute -bottom-1 -right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full ring-[2.5px] ring-white dark:ring-[#0B0F19]"
        style={{
          background: active
            ? 'linear-gradient(135deg, #16B853 0%, #059669 100%)'
            : 'linear-gradient(135deg, #FF3B30 0%, #E11D48 100%)',
          boxShadow: active
            ? '0 4px 10px rgba(22, 184, 83, 0.45)'
            : '0 4px 10px rgba(255, 59, 48, 0.45)',
        }}
        role="status"
        aria-label={active ? 'Faol' : 'Nofaol'}
      >
        {active && !reduced && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className="relative h-2 w-2 rounded-full bg-white shadow-2xs" />
      </span>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * STAT TILE — Interactive Chromatic Telemetry Card
 * ════════════════════════════════════════════════════════════════════════ */

export const StatTile = memo(function StatTile({
  label,
  value,
  icon,
  tone = 'blue',
  format = 'number',
}: {
  label: string;
  value: number | string;
  icon: readonly string[];
  tone?: StatTone;
  format?: 'number' | 'percent' | 'string';
}) {
  const t = TONE_MATRIX[tone];
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      variants={cardVariants}
      whileHover={reduced ? undefined : { y: -3, scale: 1.01 }}
      transition={SPRING.snappy}
      className="glass-card glass-card--interactive group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 select-none"
    >
      {/* Subtle Corner Ambient Caustic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
        style={{ background: t.accentHex }}
      />

      <div
        className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.tileBg} ${t.tileText} ring-1 ring-inset ${t.tileRing} transition-transform duration-300 group-hover:scale-105`}
        style={{
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), ${t.tileGlow}`,
        }}
      >
        <Icon paths={icon} size={19} strokeWidth={2.05} />
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="text-[21px] font-extrabold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
          {typeof value === 'number' ? (
            format === 'percent' ? (
              <CountUp value={value} suffix="%" />
            ) : (
              <CountUp value={value} />
            )
          ) : (
            value
          )}
        </div>
        <div className="mt-1.5 truncate text-[11.5px] font-semibold text-[var(--text-secondary)]">
          {label}
        </div>
      </div>
    </motion.div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * INFO ROW — Tone-Aware Metadata List Item
 * ════════════════════════════════════════════════════════════════════════ */

export const InfoRow = memo(function InfoRow({
  icon,
  label,
  value,
  tone = 'slate',
}: {
  icon: readonly string[];
  label: string;
  value: ReactNode;
  tone?: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'slate';
}) {
  const t = TONE_MATRIX[tone];

  return (
    <div className="group flex items-start gap-3.5 rounded-xl px-2.5 py-2 transition-all duration-200 hover:bg-slate-900/[0.03] dark:hover:bg-white/[0.035]">
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${t.tileBg} ${t.tileText} ring-1 ring-inset ${t.tileRing} shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-none transition-transform duration-200 group-hover:scale-105`}
      >
        <Icon paths={icon} size={14} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-[13.5px] font-semibold text-[var(--text-primary)]">
          {value ?? '—'}
        </dd>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PERMISSION CHIP — Specular Status Pill
 * ════════════════════════════════════════════════════════════════════════ */

export const PermissionChip = memo(function PermissionChip({
  on,
  label,
  tone = 'blue',
}: {
  on: boolean;
  label: string;
  tone: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}) {
  if (!on) return null;
  const t = TONE_MATRIX[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-tight ring-1 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ${t.chip}`}
    >
      <Icon paths={I.check} size={10} strokeWidth={3} />
      <span>{label}</span>
    </span>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PERMISSION TOGGLE — iOS 27 Tactile Switch Card
 * ════════════════════════════════════════════════════════════════════════ */

export const PermissionToggle = memo(function PermissionToggle({
  checked,
  onChange,
  icon,
  label,
  description,
  tone = 'blue',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: readonly string[];
  label: string;
  description: string;
  tone?: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const t = TONE_MATRIX[tone];

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.988 }}
      transition={SPRING.snappy}
      data-state={checked ? 'on' : 'off'}
      className={[
        'group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border px-4 py-3.5 text-left outline-none select-none',
        'backdrop-blur-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
        checked
          ? `${t.activeBorder} ${t.activeSurface} shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_8px_20px_-8px_rgba(0,102,255,0.15)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]`
          : 'border-[var(--border-subtle)] bg-white/60 hover:bg-white/80 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:bg-white/[0.04]',
      ].join(' ')}
    >
      {/* Left Icon Tile */}
      <div
        className={[
          'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-200',
          checked
            ? `${t.switchBg} text-white shadow-sm`
            : 'bg-slate-900/[0.05] text-[var(--text-tertiary)] dark:bg-white/[0.06]',
        ].join(' ')}
        style={checked ? { boxShadow: t.tileGlow } : undefined}
      >
        <Icon paths={icon} size={16} strokeWidth={2.1} className="relative z-10" />
      </div>

      {/* Text Stack */}
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-bold tracking-tight text-[var(--text-primary)]">
            {label}
          </p>
          <AnimatePresence initial={false}>
            {checked && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SPRING.bouncy}
                className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[9.5px] font-extrabold uppercase tracking-wider ring-1 ring-inset ${t.chip}`}
              >
                ON
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-[var(--text-secondary)]">
          {description}
        </p>
      </div>

      {/* Right iOS 27 Tactile Switch Track */}
      <div
        aria-hidden="true"
        className={[
          'relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          checked
            ? t.switchBg
            : 'bg-slate-900/15 dark:bg-white/15',
        ].join(' ')}
      >
        <motion.span
          layout
          transition={SPRING.bouncy}
          className="h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.22)]"
          style={{
            marginLeft: checked ? 'auto' : 0,
          }}
        />
      </div>
    </motion.button>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * MULTI-DEPTH ANATOMICAL SHIMMER & DETAIL SKELETON
 * ════════════════════════════════════════════════════════════════════════ */

export const Shimmer = memo(function Shimmer({
  className = '',
  radius = '1.5rem',
  children,
}: {
  className?: string;
  radius?: string;
  children?: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={`glass-card skeleton-shimmer relative overflow-hidden ${className}`}
      style={{ borderRadius: radius }}
    >
      {children && (
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-4 sm:p-6">
          {children}
        </div>
      )}
    </div>
  );
});

const Bone = ({ className = '' }: { className?: string }) => (
  <div
    className={`rounded-full bg-slate-900/[0.07] dark:bg-white/[0.08] ${className}`}
  />
);

export const DetailSkeleton = memo(function DetailSkeleton() {
  return (
    <div
      className="space-y-5 select-none"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Profil ma'lumotlari yuklanmoqda…"
    >
      {/* 1 · Hero Profile Header Skeleton */}
      <Shimmer className="h-44 w-full" radius="1.75rem">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 rounded-[1.35rem] bg-slate-900/[0.08] dark:bg-white/[0.09]" />
            <div className="space-y-2.5">
              <Bone className="h-5 w-48 sm:w-64" />
              <Bone className="h-3 w-32 sm:w-40 opacity-75" />
              <div className="flex gap-2 pt-1">
                <Bone className="h-5 w-16 rounded-full" />
                <Bone className="h-5 w-20 rounded-full opacity-65" />
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2.5 sm:flex">
            <Bone className="h-9 w-28 rounded-xl" />
            <Bone className="h-9 w-9 rounded-xl" />
          </div>
        </div>
      </Shimmer>

      {/* 2 · 4x KPI Telemetry Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-20" radius="1.35rem">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-900/[0.07] dark:bg-white/[0.08]" />
              <div className="space-y-2">
                <Bone className="h-4 w-16" />
                <Bone className="h-2.5 w-20 opacity-65" />
              </div>
            </div>
          </Shimmer>
        ))}
      </div>

      {/* 3 · Split Detail Columns */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-80" radius="1.75rem">
          <Bone className="h-4 w-36" />
          <div className="space-y-4 py-2">
            {[1, 2, 3, 4].map((r) => (
              <div key={r} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-slate-900/[0.07] dark:bg-white/[0.08]" />
                <div className="space-y-1.5">
                  <Bone className="h-2.5 w-20 opacity-60" />
                  <Bone className="h-3.5 w-36" />
                </div>
              </div>
            ))}
          </div>
          <Bone className="h-8 w-full rounded-xl opacity-50" />
        </Shimmer>

        <div className="lg:col-span-2">
          <Shimmer className="h-80" radius="1.75rem">
            <div className="flex items-center justify-between">
              <Bone className="h-4 w-44" />
              <Bone className="h-7 w-24 rounded-lg" />
            </div>
            <div className="space-y-3.5 py-2">
              {[1, 2, 3, 4].map((r) => (
                <div key={r} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-900/[0.07] dark:bg-white/[0.08]" />
                    <div className="space-y-1.5">
                      <Bone className="h-3.5 w-40 sm:w-56" />
                      <Bone className="h-2.5 w-24 opacity-60" />
                    </div>
                  </div>
                  <Bone className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
            <Bone className="h-3 w-32 opacity-50" />
          </Shimmer>
        </div>
      </div>
    </div>
  );
});