/**
 * GlassAvatar V2 — User avatar with V2 tokens.
 */
export type GlassAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface GlassAvatarProps {
  src?: string | null;
  name?: string;
  initials?: string;
  size?: GlassAvatarSize;
  className?: string;
}

const SIZE_CLASSES: Record<GlassAvatarSize, string> = {
  xs: 'w-7 h-7 text-[0.6875rem]',
  sm: 'w-8 h-8 text-[0.8125rem]',
  md: 'w-10 h-10 text-[0.9375rem]',
  lg: 'w-14 h-14 text-[1.125rem]',
  xl: 'w-18 h-18 text-[1.375rem]',
};

function getInitials(name?: string, initials?: string): string {
  if (initials) return initials;
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function GlassAvatar({
  src,
  name,
  initials,
  size = 'md',
  className = '',
}: GlassAvatarProps) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center',
        'rounded-full',
        'flex-shrink-0',
        'font-semibold font-sans',
        'select-none',
        'bg-gradient-to-br from-[var(--_brand-400)] to-[var(--_brand-600)]',
        'text-white',
        'ring-2 ring-white/40',
        'shadow-[0_2px_8px_rgba(79,70,229,0.22)]',
        'overflow-hidden',
        'relative',
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      aria-label={name}
      title={name}
    >
      {src ? (
        <img src={src} alt={name || ''} className="w-full h-full object-cover" />
      ) : (
        <span aria-hidden>{getInitials(name, initials)}</span>
      )}
    </span>
  );
}

export default GlassAvatar;
