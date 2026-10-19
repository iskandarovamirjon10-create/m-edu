/**
 * GlassAvatar — Apple-premium
 */
import { useState, useMemo, memo, type HTMLAttributes } from 'react';
import { cn, getInitials as getInit, avatarGradient } from '@/lib/design';

export type GlassAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type GlassAvatarStatus = 'online' | 'busy' | 'offline' | 'away';

interface GlassAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  name?: string;
  initials?: string;
  size?: GlassAvatarSize;
  status?: GlassAvatarStatus;
  className?: string;
}

const SIZE_CLASSES: Record<GlassAvatarSize, string> = {
  xs: 'w-6 h-6 text-[0.625rem]',
  sm: 'w-8 h-8 text-[0.775rem]',
  md: 'w-10 h-10 text-[0.9rem]',
  lg: 'w-14 h-14 text-[1.125rem]',
  xl: 'w-20 h-20 text-[1.5rem]',
  '2xl': 'w-28 h-28 text-[2rem]',
};

const STATUS_CLASSES: Record<GlassAvatarStatus, string> = {
  online: 'bg-[var(--success)]',
  busy: 'bg-[var(--danger)]',
  away: 'bg-[var(--warning)]',
  offline: 'bg-slate-400',
};

function getInitials(name?: string, initials?: string): string {
  if (initials) return initials;
  return getInit(name || '');
}

export const GlassAvatar = memo(function GlassAvatar({
  src,
  name,
  initials,
  size = 'md',
  status,
  className = '',
  ...rest
}: GlassAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const resolvedInitials = useMemo(() => getInitials(name, initials), [name, initials]);
  const gradient = useMemo(() => avatarGradient(name || initials || ''), [name, initials]);
  const showImage = Boolean(src) && !imgError;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full font-medium select-none border border-black/[0.08] dark:border-white/[0.12] shadow-xs',
        showImage ? 'bg-surface-100 dark:bg-surface-800' : 'text-white',
        SIZE_CLASSES[size],
        className,
      )}
      style={showImage ? undefined : { background: gradient }}
      aria-label={name}
      title={name}
      {...rest}
    >
      {showImage ? (
        <img
          src={src || ''}
          alt={name || 'Avatar'}
          onError={() => setImgError(true)}
          className="relative z-10 h-full w-full object-cover rounded-full"
        />
      ) : (
        <span aria-hidden="true" className="relative z-10 tracking-wider">{resolvedInitials}</span>
      )}
      {status && (
        <span
          aria-label={`Status: ${status}`}
          className="absolute -bottom-0.5 -right-0.5 z-20 flex h-3 w-3 items-center justify-center rounded-full bg-white dark:bg-surface-900"
        >
          <span className={cn('h-2 w-2 rounded-full', STATUS_CLASSES[status])} />
        </span>
      )}
    </span>
  );
});

GlassAvatar.displayName = 'GlassAvatar';
export default GlassAvatar;
