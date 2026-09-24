/**
 * GlassSkeleton V2 — Loading placeholder with shimmer animation.
 * variant: 'text' | 'rect' | 'circle' | 'card'
 */
import { GlassSpinner } from './GlassSpinner';

type SkeletonVariant = 'text' | 'rect' | 'circle' | 'card';

interface GlassSkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  rounded?: string;
  className?: string;
  /** Number of lines for text skeleton */
  lines?: number;
}

export function GlassSkeleton({
  variant = 'rect',
  width = '100%',
  height = '1rem',
  rounded,
  className = '',
  lines = 1,
}: GlassSkeletonProps) {
  const shimmerClass = 'skeleton-shimmer inline-block align-middle';

  if (variant === 'circle') {
    const size = typeof width === 'number' ? `${width}px` : width;
    return (
      <span
        className={[shimmerClass, className].join(' ')}
        style={{ width: size, height: size, borderRadius: '50%', display: 'inline-block' }}
        aria-hidden
      />
    );
  }

  if (variant === 'text') {
    return (
      <span className={['flex flex-col gap-2 w-full', className].join(' ')} aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={shimmerClass}
            style={{
              width: i === lines - 1 && lines > 1 ? '66%' : (typeof width === 'number' ? `${width}px` : width),
              height: typeof height === 'number' ? `${height}px` : height,
              borderRadius: rounded ?? 'var(--radius-sm)',
              display: 'block',
            }}
          />
        ))}
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={[
          'bg-[var(--bg-card)] border border-[var(--border-subtle)]',
          'rounded-[var(--radius-xl)] p-5 shadow-[var(--shadow-sm)]',
          className,
        ].join(' ')}
        aria-hidden
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col gap-2 flex-1">
            <span className="skeleton-shimmer h-4 w-32 rounded-[var(--radius-sm)] block" />
            <span className="skeleton-shimmer h-8 w-24 rounded-[var(--radius-sm)] block" />
          </div>
          <span className="skeleton-shimmer w-9 h-9 rounded-[var(--radius-md)] flex-shrink-0" />
        </div>
        <span className="skeleton-shimmer h-3.5 w-20 rounded-[var(--radius-sm)] block" />
      </div>
    );
  }

  return (
    <span
      className={[shimmerClass, className].join(' ')}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: rounded ?? 'var(--radius-md)',
        display: 'block',
      }}
      aria-hidden
    />
  );
}

/** Full-page loading state */
export function GlassPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <GlassSpinner size="lg" />
        {label && (
          <p className="text-[var(--text-body-sm)] text-[var(--text-secondary)] font-medium">{label}</p>
        )}
      </div>
    </div>
  );
}

export default GlassSkeleton;
