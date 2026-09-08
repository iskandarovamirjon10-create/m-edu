/**
 * GlassBadge — Status/role badge with all variants.
 */
import { type ReactNode } from 'react';

export type GlassBadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'muted'
  | 'cyan'
  | 'azure'
  | 'info'
  // Legacy color names accepted by legacy page code
  | 'green'
  | 'red'
  | 'amber'
  | 'blue'
  | 'slate'
  | 'purple';

interface GlassBadgeProps {
  variant?: GlassBadgeVariant;
  /** Alias for variant — accepted because most pages pass `color`. */
  color?: GlassBadgeVariant | (string & {});
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

// Maps legacy color names to variants so existing page code works unchanged
const LEGACY_MAP: Record<string, GlassBadgeVariant> = {
  green:  'success',
  red:    'error',
  amber:  'warning',
  blue:   'primary',
  slate:  'muted',
  purple: 'primary',
};

const VARIANT_STYLES: Record<GlassBadgeVariant, string> = {
  primary: 'bg-[rgba(84,115,252,0.12)] text-[#4360e8] border-[rgba(84,115,252,0.22)]',
  success: 'bg-[rgba(94,230,168,0.12)] text-[#2ea870] border-[rgba(94,230,168,0.22)]',
  warning: 'bg-[rgba(245,184,106,0.12)] text-[#c07828] border-[rgba(245,184,106,0.22)]',
  error:   'bg-[rgba(240,112,112,0.12)] text-[#d04545] border-[rgba(240,112,112,0.22)]',
  muted:   'bg-[var(--state-disabled)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  cyan:    'bg-[rgba(148,234,239,0.14)] text-[#1e9aa8] border-[rgba(148,234,239,0.25)]',
  azure:   'bg-[rgba(126,194,243,0.14)] text-[#2270a8] border-[rgba(126,194,243,0.25)]',
  info:    'bg-[rgba(148,234,239,0.12)] text-[#5474FC] border-[rgba(148,234,239,0.22)]',
  // Legacy fallbacks (will be resolved via LEGACY_MAP above)
  green:  '',
  red:    '',
  amber:  '',
  blue:   '',
  slate:  '',
  purple: '',
};

export function GlassBadge({ variant, color, children, dot = false, className = '' }: GlassBadgeProps) {
  const raw = (variant ?? color ?? 'muted') as string;
  const resolved = (LEGACY_MAP[raw] ?? raw) as GlassBadgeVariant;
  return (
    <span className={[
      'inline-flex items-center gap-1.5',
      'px-2.5 py-1',
      'text-[0.8125rem] font-medium',
      'rounded-full border',
      'transition-all duration-150',
      'whitespace-nowrap',
      VARIANT_STYLES[resolved],
      className,
    ].join(' ')}>
      {dot && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      )}
      {children}
    </span>
  );
}

export default GlassBadge;
