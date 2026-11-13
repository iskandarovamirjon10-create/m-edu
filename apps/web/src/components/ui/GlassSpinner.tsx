import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/design';

export type GlassSpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface GlassSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: GlassSpinnerSize;
  /** @deprecated no-op */ disableRefraction?: boolean;
  /** @deprecated no-op */ decorative?: boolean;
  /** @deprecated no-op */ noReflection?: boolean;
  /** @deprecated no-op */ enableNoise?: boolean;
  /** @deprecated no-op */ glassDepth?: number;
  /** @deprecated no-op */ variant?: unknown;
  label?: string;
}

const sizeMap: Record<GlassSpinnerSize, string> = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6', xl: 'h-8 w-8' };

export function GlassSpinner({size='md', className='', label, disableRefraction: _disableRefraction, decorative: _decorative, noReflection: _noReflection, enableNoise: _enableNoise, glassDepth: _glassDepth, variant: _variant, ...props}: GlassSpinnerProps) {
  const aria = label ? { 'role':'status' as const, 'aria-label': label } : { 'aria-hidden': true as const };
  return (<div {...aria} className={cn('animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--text-primary)]', sizeMap[size], className)} {...props} />);
}

export default GlassSpinner;
