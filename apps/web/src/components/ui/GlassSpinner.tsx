/**
 * GlassSpinner V2 — Loading spinner with V2 tokens.
 */
import { useSafeI18n } from '@/i18n/I18nProvider';

export type GlassSpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

interface GlassSpinnerProps {
  size?: GlassSpinnerSize;
  className?: string;
}

const SIZE_CLASSES: Record<GlassSpinnerSize, string> = {
  xs: 'w-3.5 h-3.5 border-[1.5px]',
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-8 h-8 border-[2.5px]',
};

export function GlassSpinner({ size = 'md', className = '' }: GlassSpinnerProps) {
  const { t } = useSafeI18n();
  return (
    <span
      role="status"
      aria-label={t('a11y.loading')}
      className={[
        'inline-block rounded-full flex-shrink-0',
        'border-[var(--border-medium)]',
        'border-t-[var(--primary)]',
        'animate-spin',
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
    />
  );
}

export default GlassSpinner;
