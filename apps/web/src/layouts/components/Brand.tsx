/**
 * M-EDU Brand lockup — logo mark + wordmark + tone badge.
 * Clean Apple-premium chrome: no injected styles, no refraction filters,
 * no emoji, no chromatic bloom. `forwardRef`, Link integration and every
 * prop from the previous version are preserved.
 */
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { cn, usePrefersReducedMotion } from '@/lib/design';
import { Magnetic } from './Icons';

/* ─────────────────────────────────────────────────────────────
 * Public types
 * ───────────────────────────────────────────────────────────── */

export type BrandSize = 'sm' | 'md';
export type BrandBadgeTone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger';

export interface BrandProps
  extends Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'color'> {
  /** Visual scale of the logo mark and typography. */
  size?: BrandSize;
  /** Hides the wordmark and badge, rendering only the interactive logo mark. */
  compact?: boolean;
  /** Version or environment pill (e.g. "v2", "Beta"). Pass `null` to hide. */
  badge?: ReactNode;
  /** Tone of the badge chip. Default `brand`. */
  badgeTone?: BrandBadgeTone;
  /** Custom router destination (defaults to "/"). */
  to?: LinkProps['to'];
  /** Disables magnetic cursor pull when used in tight/dense containers. */
  magnetic?: boolean;
  /** Wraps the lockup in a subtle glass pill (useful on busy backdrops). */
  glass?: boolean;
  /** @deprecated no-op — SVG refraction was removed. */
  disableRefraction?: boolean;
}

/* ─────────────────────────────────────────────────────────────
 * Tokens
 * ───────────────────────────────────────────────────────────── */

const BADGE_TONES: Record<BrandBadgeTone, string> = {
  brand: 'border-brand-500/25 bg-brand-500/10 text-brand-600 dark:text-brand-400',
  neutral: 'border-black/10 bg-black/[0.05] text-secondary dark:border-white/10 dark:bg-white/[0.08]',
  success: 'border-apple-green/25 bg-apple-green/10 text-apple-green',
  warning: 'border-apple-orange/25 bg-apple-orange/10 text-apple-orange',
  danger: 'border-apple-red/25 bg-apple-red/10 text-apple-red',
};

const SIZES: Record<BrandSize, { gap: string; mark: string; wordmark: string; badgeX: string }> = {
  sm: { gap: 'gap-2', mark: 'rounded-[10px]', wordmark: 'text-[16.5px] tracking-[-0.022em]', badgeX: 'px-1.5' },
  md: { gap: 'gap-2.5', mark: 'rounded-xl', wordmark: 'text-[18.5px] tracking-[-0.026em]', badgeX: 'px-2' },
};

/* ─────────────────────────────────────────────────────────────
 * Pieces
 * ───────────────────────────────────────────────────────────── */

function BrandBadge({
  children,
  tone,
  size,
}: {
  children: ReactNode;
  tone: BrandBadgeTone;
  size: BrandSize;
}) {
  return (
    <span
      data-part="brand-badge"
      data-tone={tone}
      className={cn(
        'inline-flex items-center rounded-full border py-0.5 text-[11px] font-medium leading-none',
        SIZES[size].badgeX,
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────
 * Brand
 * ───────────────────────────────────────────────────────────── */

export const Brand = forwardRef<HTMLAnchorElement, BrandProps>(function Brand(
  {
    size = 'md',
    compact = false,
    badge = 'v2',
    badgeTone = 'brand',
    to = '/',
    magnetic = true,
    glass = false,
    disableRefraction: _disableRefraction = false,
    className,
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) {
  const reduced = usePrefersReducedMotion();
  const styles = SIZES[size];
  const hasBadge = badge !== null && badge !== false;
  const hasShell = glass && !compact;

  const logoMark = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        styles.mark,
        !reduced &&
          'transition-transform duration-150 ease-apple-spring hover:scale-[1.03] active:scale-95 motion-reduce:transition-none',
      )}
    >
      <MeduLogo
        size={size}
        alt=""
        className="block select-none"
      />
    </span>
  );

  const wordmark = !compact ? (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-semibold leading-none text-primary',
        styles.wordmark,
      )}
    >
      <span>M-EDU</span>
      {hasBadge && (
        <BrandBadge tone={badgeTone} size={size}>
          {badge}
        </BrandBadge>
      )}
    </span>
  ) : null;

  const lockup = (
    <>
      {magnetic && !reduced ? <Magnetic strength={0.32}>{logoMark}</Magnetic> : logoMark}
      {wordmark}
    </>
  );

  return (
    <Link
      ref={ref}
      to={to}
      aria-label={ariaLabel ?? 'M-EDU — Bosh sahifa'}
      className={cn(
        'group inline-flex max-w-full select-none items-center rounded-xl no-underline outline-none',
        styles.gap,
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--border-focus)]',
        !reduced && 'transition-transform duration-150 ease-apple-spring active:scale-[0.98]',
        className,
      )}
      {...rest}
    >
      {hasShell ? (
        <span className="inline-flex items-center rounded-xl border border-subtle bg-[var(--glass-surface-bg)] px-2.5 py-1 shadow-card backdrop-blur-xl">
          {lockup}
        </span>
      ) : (
        lockup
      )}
    </Link>
  );
});

Brand.displayName = 'Brand';

export default Brand;
