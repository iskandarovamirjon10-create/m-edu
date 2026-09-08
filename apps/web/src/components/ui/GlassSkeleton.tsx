/**
 * GlassSkeleton — Loading placeholder with shimmer animation.
 */
import { GlassSpinner } from './GlassSpinner';

interface GlassSkeletonProps {
  width?: string | number;
  height?: string | number;
  rounded?: string;
  className?: string;
}

export function GlassSkeleton({
  width = '100%',
  height = '1rem',
  rounded = '0.5rem',
  className = '',
}: GlassSkeletonProps) {
  return (
    <span
      className={[
        'inline-block align-middle',
        'bg-[linear-gradient(90deg,var(--border-subtle)_25%,rgba(20,30,45,0.06)_50%,var(--border-subtle)_75%)]',
        'bg-[length:200%_100%]',
        'animate-[skeleton-shimmer_1.6s_ease-in-out_infinite]',
        className,
      ].join(' ')}
      style={{ width, height, borderRadius: rounded }}
      aria-hidden="true"
    />
  );
}

/** Full-page loading state */
export function GlassPageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <GlassSpinner size="lg" />
        {label && (
          <p className="text-sm text-[var(--text-muted)] font-medium">{label}</p>
        )}
      </div>
    </div>
  );
}

export default GlassSkeleton;
