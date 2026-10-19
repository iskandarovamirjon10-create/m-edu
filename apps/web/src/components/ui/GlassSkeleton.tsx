/**
 * GlassSkeleton — Apple-premium shimmer placeholders.
 */
import { cn } from '@/lib/design';
import { GlassSpinner } from './GlassSpinner';

export type SkeletonVariant = 'text' | 'rect' | 'circle' | 'card';
export type SkeletonIntensity = 'subtle' | 'default' | 'strong';

export interface GlassSkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  rounded?: string;
  className?: string;
  /** Number of lines for text skeleton. */
  lines?: number;
  /** @deprecated no-op — intensity is now uniform. */
  intensity?: SkeletonIntensity;
  /** @deprecated no-op */
  disableRefraction?: boolean;
}

const toCss = (v: string | number) => (typeof v === 'number' ? `${v}px` : v);

function Bar({
  width,
  height,
  radius,
  className,
}: {
  width: string | number;
  height: string | number;
  radius?: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn('skeleton-shimmer rounded-lg', className)}
      style={{
        width: toCss(width),
        height: toCss(height),
        ...(radius ? { borderRadius: radius } : null),
      }}
    />
  );
}

export function GlassSkeleton({
  variant = 'rect',
  width = '100%',
  height = '1rem',
  rounded,
  className = '',
  lines = 1,
}: GlassSkeletonProps) {
  if (variant === 'circle') {
    const size = toCss(width);
    return (
      <Bar
        width={size}
        height={size}
        radius="50%"
        className={cn('inline-block', className)}
      />
    );
  }

  if (variant === 'text') {
    return (
      <span className={cn('flex w-full flex-col gap-2', className)} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => {
          const isLast = i === lines - 1 && lines > 1;
          return (
            <Bar
              key={i}
              width={isLast ? '66%' : width}
              height={height}
              radius={rounded}
            />
          );
        })}
      </span>
    );
  }

  if (variant === 'card') {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl backdrop-saturate-150 border border-black/[0.06] dark:border-white/[0.08] rounded-2xl shadow-card p-5',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex flex-1 flex-col gap-2">
            <Bar width="8rem" height="1rem" />
            <Bar width="6rem" height="2rem" radius="8px" />
          </div>
          <Bar width="36px" height="36px" radius="10px" />
        </div>
        <Bar width="5rem" height="0.875rem" />
      </div>
    );
  }

  return <Bar width={width} height={height} radius={rounded} className={className} />;
}

export interface GlassPageLoaderProps {
  label?: string;
  /** @deprecated no-op */
  glass?: boolean;
}

export function GlassPageLoader({ label = 'Loading…' }: GlassPageLoaderProps) {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <GlassSpinner size="lg" />
        {label && <p className="text-sm font-medium text-secondary">{label}</p>}
      </div>
    </div>
  );
}

export default GlassSkeleton;
