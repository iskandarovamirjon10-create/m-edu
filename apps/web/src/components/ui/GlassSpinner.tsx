/**
 * GlassSpinner — Loading spinner component.
 */
export type GlassSpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

interface GlassSpinnerProps {
  size?: GlassSpinnerSize;
  className?: string;
}

const SIZE_CLASSES: Record<GlassSpinnerSize, string> = {
  xs: 'w-3.5 h-3.5 border-[1.5px]',
  sm: 'w-4.5 h-4.5 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
};

export function GlassSpinner({ size = 'md', className = '' }: GlassSpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        'inline-block rounded-full',
        'border-[var(--border-subtle)]',
        'border-t-brand-700',
        'animate-spin',
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
    />
  );
}

export default GlassSpinner;
