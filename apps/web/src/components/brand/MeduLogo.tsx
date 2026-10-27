/**
 * MeduLogo — single source of truth for the official M-EDU logo.
 *
 * Every brand mark in the app (sidebar, mobile bar/sheet, auth screens,
 * offline page, favicon) renders this component so the official asset is
 * swapped in exactly once. Renders the raster PNG from `public/` inside a
 * tile that matches the previous brand-mark footprint (size + radius), with
 * `object-fit: contain` so the aspect ratio is preserved.
 */
import { forwardRef } from 'react';

type MeduLogoSize = 'sm' | 'md' | 'lg' | 'xl';

export interface MeduLogoProps {
  /** Tile size — matches the legacy brand marks: sm 32, md 36, lg 48, xl 56 px. */
  size?: MeduLogoSize;
  /** Decorative marks (next to an adjacent "M-EDU" text label) should pass alt="". */
  alt?: string;
  className?: string;
}

const SIZE_CLASSES: Record<MeduLogoSize, string> = {
  sm: 'h-8 w-8 rounded-xl',
  md: 'h-9 w-9 rounded-xl',
  lg: 'h-12 w-12 rounded-2xl',
  xl: 'h-14 w-14 rounded-2xl',
};

const LOGO_SRC = `${import.meta.env.BASE_URL}medu-logo.png`;

export const MeduLogo = forwardRef<HTMLImageElement, MeduLogoProps>(function MeduLogo(
  { size = 'md', alt = 'M-EDU', className },
  ref,
) {
  return (
    <img
      ref={ref}
      src={LOGO_SRC}
      alt={alt}
      width={256}
      height={256}
      decoding="async"
      draggable={false}
      className={[
        'block shrink-0 object-contain bg-white ring-1 ring-black/5',
        'shadow-[0_4px_14px_rgba(84,115,252,0.30)]',
        SIZE_CLASSES[size],
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
});

export default MeduLogo;
