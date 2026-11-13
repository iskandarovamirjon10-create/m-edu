/**
 * GlassPageHeader — Apple-premium page header.
 *
 * Title + optional description + right-aligned actions. No liquid refraction,
 * no chromatic orb, no gradient title.
 */
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/design';
import { GlassButton } from './GlassButton';

export type PageHeaderSize = 'sm' | 'md' | 'lg';

export interface GlassPageHeaderProps {
  title: string;
  description?: string;
  /** Alias for `description` (V2 compatibility). */
  subtitle?: string;
  /** Breadcrumb-like prefix element. */
  breadcrumb?: ReactNode;
  /** @deprecated use `actions` */
  action?: ReactNode | { label: string; onClick: () => void };
  actions?: ReactNode;
  className?: string;
  size?: PageHeaderSize;
  /** Renders the header inside a solid card surface. */
  glass?: boolean;
  /** @deprecated no-op */
  glow?: boolean;
  /** @deprecated no-op */
  gradientTitle?: boolean;
  /** @deprecated no-op */
  disableRefraction?: boolean;
}

const SIZE_MAP: Record<
  PageHeaderSize,
  { title: string; desc: string; gap: string; pad: string }
> = {
  sm: { title: 'text-xl', desc: 'text-sm', gap: 'gap-2', pad: 'px-4 py-3' },
  md: { title: 'text-[28px]', desc: 'text-sm', gap: 'gap-3', pad: 'px-5 py-4' },
  lg: { title: 'text-[32px]', desc: 'text-sm', gap: 'gap-4', pad: 'px-6 py-5' },
};

/**
 * PageActions — the single canonical action lane for page headers and toolbars.
 * Primary action last (right), secondaries first, one gap scale everywhere.
 */
export function PageActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Page actions"
      data-page-actions
      className={cn(
        'action-bar action-bar--stack w-full min-w-0',
        'sm:w-auto sm:shrink-0 sm:flex-nowrap sm:justify-end sm:gap-2.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GlassPageHeader({
  title,
  description,
  subtitle,
  breadcrumb,
  action,
  actions,
  className,
  size = 'md',
  glass = false,
}: GlassPageHeaderProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const desc = description ?? subtitle;
  const sz = SIZE_MAP[size];

  // Legacy `action={{ label, onClick }}` shape from V2.
  const rawAction = actions ?? action;
  const isLegacyAction =
    rawAction != null &&
    typeof rawAction === 'object' &&
    'label' in (rawAction as object) &&
    !('props' in (rawAction as object));

  const actionNodes = isLegacyAction ? (
    <GlassButton
      size="sm"
      onClick={(rawAction as { label: string; onClick: () => void }).onClick}
    >
      {(rawAction as { label: string; onClick: () => void }).label}
    </GlassButton>
  ) : (
    (rawAction as ReactNode | undefined)
  );

  return (
    <div
      data-component="glass-page-header"
      data-size={size}
      className={cn(
        'mb-5 sm:mb-6',
        glass && cn('bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]', sz.pad),
        className,
      )}
    >
      <div className={cn('flex min-w-0 flex-col justify-between sm:flex-row sm:items-center', sz.gap)}>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {breadcrumb && (
            <nav
              aria-label="Breadcrumb"
              className="mb-1 text-xs tracking-wide text-tertiary"
            >
              {breadcrumb}
            </nav>
          )}

          <h1
            id={titleId}
            className={cn(
              'min-w-0 text-balance font-semibold tracking-tight text-primary',
              sz.title,
            )}
          >
            {title}
          </h1>

          {desc && (
            <p className={cn('mt-0.5 max-w-2xl leading-relaxed text-pretty text-secondary', sz.desc)}>
              {desc}
            </p>
          )}
        </div>

        {actionNodes && <PageActions>{actionNodes}</PageActions>}
      </div>
    </div>
  );
}

export default GlassPageHeader;
