import { memo, useRef, useEffect, type ReactNode, type SVGProps } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePrefersReducedMotion } from '@/layouts/core/singletons';

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS & VARIANTS
 * ════════════════════════════════════════════════════════════════════════ */

export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 500, damping: 32, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.9 },
  soft:   { type: 'spring' as const, stiffness: 220, damping: 26, mass: 1.0 },
} as const;

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.06 },
  },
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING.smooth,
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * ICONS & HELPERS
 * ════════════════════════════════════════════════════════════════════════ */

export const ICON_STROKE = 1.8;

export const I = {
  userCircle: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6 z', 'M6.2 18.4c.9-1.4 2.4-2.4 5.8-2.4s4.9 1 5.8 2.4'],
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

export const GlassCardSurface = memo(function GlassCardSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'relative overflow-hidden rounded-xl sm:rounded-2xl',
        'border border-slate-200/80 dark:border-white/[0.08]',
        'bg-white/90 dark:bg-[#0B0F19]/80 backdrop-blur-md',
        'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_20px_-4px_rgba(0,0,0,0.5)]',
        className,
      ].join(' ')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/10 to-transparent"
      />
      {children}
    </div>
  );
});

export const AVATAR_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#1E293B', '#334155'], // Slate
  ['#1D4ED8', '#2563EB'], // Sapphire
  ['#047857', '#059669'], // Emerald
  ['#0F766E', '#0D9488'], // Teal
  ['#4338CA', '#4F46E5'], // Indigo
  ['#0F172A', '#1E293B'], // Obsidian
];

export function nameHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function avatarGradient(name: string): string {
  const [a, b] = AVATAR_PALETTES[nameHash(name) % AVATAR_PALETTES.length];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function getInitials(name: string): string {
  return (
    name
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

export const CountUp = memo(function CountUp({
  value,
  duration = 0.85,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  duration?: number;
  suffix?: string;
  decimals?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    if (reduced) {
      prevValueRef.current = value;
      el.textContent = `${decimals > 0 ? value.toFixed(decimals) : value.toLocaleString()}${suffix}`;
      return;
    }

    const from = prevValueRef.current;
    const to = value;
    prevValueRef.current = value;

    if (from === to) {
      el.textContent = `${decimals > 0 ? to.toFixed(decimals) : to.toLocaleString()}${suffix}`;
      return;
    }

    let rafId: number;
    let startTime: number | null = null;
    const durationMs = duration * 1000;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = from + (to - from) * eased;

      if (spanRef.current) {
        spanRef.current.textContent = `${decimals > 0 ? current.toFixed(decimals) : Math.round(current).toLocaleString()}${suffix}`;
      }

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration, suffix, decimals, reduced]);

  return <span ref={spanRef} className="tabular-nums">{value.toLocaleString()}</span>;
});

export const SectionHeader = memo(function SectionHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon: readonly string[];
  title: string;
  subtitle?: string;
  tone?: 'blue' | 'green' | 'purple' | 'orange';
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] px-5 py-3.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 ring-1 ring-inset ring-blue-500/10">
        <Icon paths={icon} size={15} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-[13.5px] font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
});

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
    edit:   'text-[#007AFF] hover:bg-[#007AFF]/12 hover:border-[#007AFF]/30 dark:text-[#38BDF8]',
    delete: 'text-[#FF3B30] hover:bg-[#FF3B30]/12 hover:border-[#FF3B30]/30 dark:text-[#FF453A]',
    unlink: 'text-[#FF3B30] hover:bg-[#FF3B30]/12 hover:border-[#FF3B30]/30 dark:text-[#FF453A]',
  }[tone];

  const baseClass = [
    'flex h-7 w-7 items-center justify-center rounded-lg outline-none select-none',
    'border border-white/80 bg-white/65 shadow-[0_1px_0_#FFF_inset,0_2px_5px_rgba(15,23,42,0.04)]',
    'dark:border-white/[0.10] dark:bg-white/[0.05] dark:shadow-none',
    'transition-all duration-200 active:scale-95',
    'disabled:cursor-not-allowed disabled:opacity-40',
    styles,
  ].join(' ');

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={disabled ? undefined : { scale: 1.08 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={SPRING.snappy}
      aria-label={label}
      title={label}
      className={baseClass}
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
        <Icon paths={icon} size={13} strokeWidth={2.1} />
      )}
    </motion.button>
  );
});

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

  return (
    <div className="relative select-none" style={{ width: size, height: size }}>
      <motion.div
        initial={reduced ? false : { scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={SPRING.smooth}
        className="relative flex h-full w-full items-center justify-center rounded-2xl font-bold text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
        style={{
          background: avatarGradient(name),
          fontSize: Math.round(size * 0.32),
          letterSpacing: '0.02em',
        }}
      >
        <span className="relative z-10">{getInitials(name)}</span>
      </motion.div>

      <span
        className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white dark:ring-[#121623]"
        style={{
          background: isActive === false ? '#EF4444' : '#10B981',
        }}
        aria-label={isActive === false ? 'Nofaol' : 'Faol'}
      >
        <span className="h-2 w-2 rounded-full bg-white shadow-sm" />
      </span>
    </div>
  );
});

export type StatTone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

export const STAT_PALETTE: Record<StatTone, { bg: string; text: string }> = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400' },
  green:  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400' },
  orange: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400' },
  red:    { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400' },
  purple: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-600 dark:text-indigo-400' },
};

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
  const c = STAT_PALETTE[tone];
  const reduced = usePrefersReducedMotion();

  return (
    <motion.div
      variants={cardVariants}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={SPRING.smooth}
      className={[
        'group relative flex items-center gap-3.5 overflow-hidden rounded-xl px-4 py-3.5 select-none',
        'border border-slate-200/80 dark:border-white/[0.08]',
        'bg-white/90 dark:bg-[#0B0F19]/80 backdrop-blur-md',
        'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_rgba(0,0,0,0.02)]',
        'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_20px_-4px_rgba(0,0,0,0.5)]',
      ].join(' ')}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text} ring-1 ring-inset ring-black/5 dark:ring-white/10`}
      >
        <Icon paths={icon} size={18} strokeWidth={2} />
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="text-xl font-bold leading-none tracking-tight text-slate-900 dark:text-white tabular-nums">
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
        <div className="mt-1.5 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {label}
        </div>
      </div>
    </motion.div>
  );
});

export const InfoRow = memo(function InfoRow({
  icon,
  label,
  value,
}: {
  icon: readonly string[];
  label: string;
  value: ReactNode;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
}) {
  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-slate-50 dark:hover:bg-white/[0.03]">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 ring-1 ring-inset ring-black/5 dark:ring-white/5">
        <Icon paths={icon} size={13} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-[13px] font-semibold text-slate-900 dark:text-white">
          {value}
        </dd>
      </div>
    </div>
  );
});

export const PermissionChip = memo(function PermissionChip({
  on,
  label,
  tone,
}: {
  on: boolean;
  label: string;
  tone: 'blue' | 'green' | 'purple';
}) {
  if (!on) return null;
  const styles = {
    blue:   'bg-blue-50 text-blue-700 ring-blue-500/20 dark:bg-blue-950/40 dark:text-blue-300',
    green:  'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300',
    purple: 'bg-indigo-50 text-indigo-700 ring-indigo-500/20 dark:bg-indigo-950/40 dark:text-indigo-300',
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold tracking-tight ring-1 ring-inset ${styles}`}
    >
      <Icon paths={I.check} size={9} strokeWidth={3} />
      <span>{label}</span>
    </span>
  );
});

export const PermissionToggle = memo(function PermissionToggle({
  checked,
  onChange,
  icon,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: readonly string[];
  label: string;
  description: string;
  tone?: 'blue' | 'green' | 'purple';
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.99 }}
      transition={SPRING.snappy}
      data-state={checked ? 'on' : 'off'}
      className={[
        'group relative flex w-full items-start gap-3.5 overflow-hidden rounded-xl border px-3.5 py-3 text-left outline-none select-none transition-all duration-150',
        checked
          ? 'border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-500/30'
          : 'border-slate-200/80 bg-slate-50/40 dark:border-white/[0.06] dark:bg-white/[0.02]',
      ].join(' ')}
    >
      <div
        className={[
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
          checked
            ? 'bg-blue-600 text-white'
            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
        ].join(' ')}
      >
        <Icon paths={icon} size={15} strokeWidth={2} className="relative z-10" />
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">
            {label}
          </p>
          <AnimatePresence>
            {checked && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={SPRING.snappy}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white"
              >
                <Icon paths={I.check} size={10} strokeWidth={3.2} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-0.5 text-[11.5px] font-medium text-[var(--text-secondary)]">
          {description}
        </p>
      </div>
    </motion.button>
  );
});

export const Shimmer = memo(function Shimmer({
  className = '',
  radius = '1.5rem',
}: {
  className?: string;
  radius?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer relative overflow-hidden border border-white/60 dark:border-white/[0.06] ${className}`}
      style={{ borderRadius: radius }}
    />
  );
});

export const DetailSkeleton = memo(function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Shimmer className="h-44 w-full" radius="1.75rem" />
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-20" radius="1.35rem" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-80" radius="1.75rem" />
        <div className="lg:col-span-2">
          <Shimmer className="h-80" radius="1.75rem" />
        </div>
      </div>
    </div>
  );
});
