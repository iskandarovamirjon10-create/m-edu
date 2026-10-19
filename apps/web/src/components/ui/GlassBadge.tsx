/**
 * GlassBadge & StatusDot — Apple-premium
 */
import { type ReactNode, memo } from 'react';
import { cn } from '@/lib/design';

export type GlassBadgeCanonicalVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'purple';

export type GlassBadgeVariant =
  | GlassBadgeCanonicalVariant
  | 'error'
  | 'muted'
  | 'cyan'
  | 'azure'
  | 'green'
  | 'red'
  | 'amber'
  | 'blue'
  | 'slate';

export type GlassBadgeSize = 'xs' | 'sm' | 'md';

interface GlassBadgeProps {
  variant?: GlassBadgeVariant;
  /** Legacy alias: pages often use `color` prop */
  color?: GlassBadgeVariant | (string & {});
  children: ReactNode;
  dot?: boolean;
  /** @deprecated no-op */
  pulse?: boolean;
  size?: GlassBadgeSize;
  className?: string;
}

const LEGACY_MAP: Record<string, GlassBadgeCanonicalVariant> = {
  error: 'danger',
  muted: 'neutral',
  cyan: 'info',
  azure: 'primary',
  green: 'success',
  red: 'danger',
  amber: 'warning',
  blue: 'primary',
  slate: 'neutral',
  purple: 'purple',
};

const VARIANT_STYLES: Record<GlassBadgeCanonicalVariant, string> = {
  primary:
    'bg-[rgba(0,122,255,0.10)] text-[var(--primary)] border-[rgba(0,122,255,0.24)] dark:bg-[rgba(10,132,255,0.16)] dark:border-[rgba(10,132,255,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  success:
    'bg-[rgba(52,199,89,0.10)] text-[var(--success)] border-[rgba(52,199,89,0.24)] dark:bg-[rgba(48,209,88,0.16)] dark:border-[rgba(48,209,88,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  warning:
    'bg-[rgba(255,149,0,0.10)] text-[var(--warning)] border-[rgba(255,149,0,0.24)] dark:bg-[rgba(255,159,10,0.16)] dark:border-[rgba(255,159,10,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  danger:
    'bg-[rgba(255,59,48,0.10)] text-[var(--danger)] border-[rgba(255,59,48,0.24)] dark:bg-[rgba(255,69,58,0.16)] dark:border-[rgba(255,69,58,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  info:
    'bg-[rgba(0,122,255,0.10)] text-[var(--info)] border-[rgba(0,122,255,0.24)] dark:bg-[rgba(10,132,255,0.16)] dark:border-[rgba(10,132,255,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  neutral:
    'bg-black/[0.04] text-[var(--text-secondary)] border-black/[0.08] dark:bg-white/[0.08] dark:text-[var(--text-secondary)] dark:border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  purple:
    'bg-[rgba(175,82,222,0.10)] text-[var(--tone-purple-fg)] border-[rgba(175,82,222,0.24)] dark:bg-[rgba(191,90,242,0.16)] dark:border-[rgba(191,90,242,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
};

const SIZE_CLASSES: Record<GlassBadgeSize, string> = {
  xs: 'px-1.5 py-0.5 text-[11px] gap-1 font-medium',
  sm: 'px-2 py-0.5 text-[11px] gap-1.5 font-medium',
  md: 'px-2.5 py-1 text-[12px] gap-1.5 font-medium',
};

export const GlassBadge = memo(function GlassBadge({
  variant,
  color,
  children,
  dot = false,
  pulse = false,
  size = 'md',
  className = '',
}: GlassBadgeProps) {
  const raw = (variant ?? color ?? 'neutral') as string;
  const canonical = (LEGACY_MAP[raw] ?? raw) as GlassBadgeCanonicalVariant;
  const styleClass = VARIANT_STYLES[canonical] ?? VARIANT_STYLES.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border backdrop-blur-md backdrop-saturate-150 select-none leading-none whitespace-nowrap transition-colors duration-150',
        SIZE_CLASSES[size],
        styleClass,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
          {pulse && (
            <span
              aria-hidden="true"
              className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"
            />
          )}
          <span aria-hidden="true" className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      <span>{children}</span>
    </span>
  );
});

GlassBadge.displayName = 'GlassBadge';

export type StatusType = 'online' | 'offline' | 'warning' | 'error' | 'pending' | 'success';

interface StatusDotProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** @deprecated no-op */
  pulse?: boolean;
}

const DOT_STYLES: Record<StatusType, string> = {
  online: 'bg-[var(--success)]',
  success: 'bg-[var(--success)]',
  offline: 'bg-slate-400 dark:bg-slate-600',
  warning: 'bg-[var(--warning)]',
  error: 'bg-[var(--danger)]',
  pending: 'bg-[var(--primary)]',
};

const DOT_SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export const StatusDot = memo(function StatusDot({
  status,
  label,
  size = 'md',
  pulse = false,
}: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-2 select-none" title={label ?? status}>
      <span className="relative flex items-center justify-center">
        {pulse && (
          <span
            aria-hidden="true"
            className={`absolute inline-flex animate-ping rounded-full opacity-75 ${DOT_STYLES[status]} ${DOT_SIZES[size]}`}
          />
        )}
        <span aria-hidden="true" className={`relative rounded-full shrink-0 ${DOT_STYLES[status]} ${DOT_SIZES[size]}`} />
      </span>
      {label && <span className="text-[12px] font-medium text-[var(--text-secondary)]">{label}</span>}
    </span>
  );
});

StatusDot.displayName = 'StatusDot';

export default GlassBadge;
