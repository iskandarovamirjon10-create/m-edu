/**
 * GlassBadge V2 — Canonical status badge system.
 * Semantic variant set: primary | success | warning | danger | info | neutral
 * Legacy aliases: error, muted, cyan, azure, green, red, amber, blue, slate, purple
 */
import { type ReactNode } from 'react';

export type GlassBadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  // Legacy
  | 'error'
  | 'muted'
  | 'cyan'
  | 'azure'
  | 'green'
  | 'red'
  | 'amber'
  | 'blue'
  | 'slate'
  | 'purple';

export type GlassBadgeSize = 'sm' | 'md';

interface GlassBadgeProps {
  variant?: GlassBadgeVariant;
  /** Legacy: pages use `color` prop */
  color?: GlassBadgeVariant | (string & {});
  children: ReactNode;
  dot?: boolean;
  size?: GlassBadgeSize;
  className?: string;
}

// Normalize legacy names to canonical variants
const LEGACY_MAP: Record<string, GlassBadgeVariant> = {
  error:   'danger',
  muted:   'neutral',
  cyan:    'info',
  azure:   'primary',
  green:   'success',
  red:     'danger',
  amber:   'warning',
  blue:    'primary',
  slate:   'neutral',
  purple:  'primary',
};

const VARIANT_STYLES: Record<string, string> = {
  primary: 'bg-[var(--primary-soft)]  text-[var(--primary)]   border-[rgba(79,70,229,0.22)]',
  success: 'bg-[var(--success-soft)]  text-[var(--success)]   border-[var(--success-border)]',
  warning: 'bg-[var(--warning-soft)]  text-[var(--warning)]   border-[var(--warning-border)]',
  danger:  'bg-[var(--danger-soft)]   text-[var(--danger)]    border-[var(--danger-border)]',
  info:    'bg-[var(--info-soft)]     text-[var(--info)]      border-[var(--info-border)]',
  neutral: 'bg-[var(--neutral-soft)]  text-[var(--neutral)]   border-[var(--neutral-border)]',
};

const SIZE_CLASSES: Record<GlassBadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[0.6875rem] gap-1',
  md: 'px-2.5 py-1   text-[0.8125rem]  gap-1.5',
};

export function GlassBadge({
  variant,
  color,
  children,
  dot = false,
  size = 'md',
  className = '',
}: GlassBadgeProps) {
  const raw = (variant ?? color ?? 'neutral') as string;
  const canonical = LEGACY_MAP[raw] ?? raw;
  const styleClass = VARIANT_STYLES[canonical] ?? VARIANT_STYLES.neutral;

  return (
    <span
      className={[
        'inline-flex items-center',
        'font-medium rounded-[var(--radius-pill)] border',
        'whitespace-nowrap leading-none',
        'transition-colors duration-[var(--duration-fast)]',
        SIZE_CLASSES[size],
        styleClass,
        className,
      ].join(' ')}
    >
      {dot && (
        <span className="flex-shrink-0 inline-block w-1.5 h-1.5 rounded-full bg-current opacity-75" aria-hidden />
      )}
      {children}
    </span>
  );
}

/* ── Status Dot ─────────────────────────────────────────────── */
interface StatusDotProps {
  status: 'online' | 'offline' | 'warning' | 'error' | 'pending';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const DOT_STYLES: Record<StatusDotProps['status'], string> = {
  online:  'bg-[var(--success)]',
  offline: 'bg-[var(--neutral)]',
  warning: 'bg-[var(--warning)]',
  error:   'bg-[var(--danger)]',
  pending: 'bg-[var(--info)]',
};

const DOT_SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function StatusDot({ status, label, size = 'md' }: StatusDotProps) {
  return (
    <span className="inline-flex items-center gap-1.5" title={label ?? status}>
      <span
        className={[
          'rounded-full flex-shrink-0',
          DOT_STYLES[status],
          DOT_SIZES[size],
        ].join(' ')}
        aria-hidden
      />
      {label && (
        <span className="text-[var(--text-caption)] text-[var(--text-secondary)]">{label}</span>
      )}
    </span>
  );
}

export default GlassBadge;
