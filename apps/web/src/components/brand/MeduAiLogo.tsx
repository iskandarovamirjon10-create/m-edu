/**
 * MeduAiLogo — single source of truth for the official M-EDU AI Copilot Sparkle Logo (✨).
 *
 * Visual Identity:
 *  - Iconic 4-pointed radiant celestial sparkle starburst (✨)
 *  - Smooth luminous gradient (Electric Cyan -> Royal Indigo -> Neon Magenta/Pink)
 *  - High-res PNG with fallback vector astroid
 *  - Optional ambient neon pulse aura
 *  - Fully accessible (alt, aria-hidden for decorative marks)
 */

import { forwardRef, useState } from 'react';

export type MeduAiLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface MeduAiLogoProps {
  /** Size scale: xs 18px, sm 24px, md 32px, lg 44px, xl 64px, 2xl 88px */
  size?: MeduAiLogoSize;
  /** Pass alt="" if used decoratively next to text like "M-EDU AI" */
  alt?: string;
  className?: string;
  /** Add ambient neon glow behind the sparkle */
  glow?: boolean;
  /** Add subtle hover scale / rotation */
  interactive?: boolean;
}

const SIZE_CLASSES: Record<MeduAiLogoSize, { box: string; px: number }> = {
  xs: { box: 'h-[18px] w-[18px]', px: 18 },
  sm: { box: 'h-[24px] w-[24px]', px: 24 },
  md: { box: 'h-[32px] w-[32px]', px: 32 },
  lg: { box: 'h-[44px] w-[44px]', px: 44 },
  xl: { box: 'h-[64px] w-[64px]', px: 64 },
  '2xl': { box: 'h-[88px] w-[88px]', px: 88 },
};

const LOGO_SRC = `${import.meta.env.BASE_URL}medu-ai-logo.png`;

export const MeduAiLogo = forwardRef<HTMLDivElement, MeduAiLogoProps>(function MeduAiLogo(
  {
    size = 'md',
    alt = 'M-EDU AI Copilot',
    className = '',
    glow = false,
    interactive = false,
  },
  ref,
) {
  const [hasError, setHasError] = useState(false);
  const sizeConfig = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <div
      ref={ref}
      className={[
        'relative inline-flex shrink-0 items-center justify-center select-none',
        sizeConfig.box,
        interactive ? 'transition-transform duration-300 hover:scale-110 hover:rotate-6 cursor-pointer' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Optional ambient celestial neon glow */}
      {glow && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-full blur-md opacity-75 animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(0, 210, 255, 0.5) 0%, rgba(139, 92, 246, 0.45) 50%, rgba(236, 72, 153, 0.3) 100%)',
          }}
        />
      )}

      {!hasError ? (
        <img
          src={LOGO_SRC}
          alt={alt}
          width={sizeConfig.px}
          height={sizeConfig.px}
          decoding="async"
          draggable={false}
          onError={() => setHasError(true)}
          className={[
            'relative z-10 block h-full w-full object-contain filter drop-shadow-[0_2px_8px_rgba(124,58,237,0.35)]',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ) : (
        /* Fallback: Ultra-crisp SVG Glowing 4-Point Celestial Sparkle Star (✨) */
        <svg
          viewBox="0 0 100 100"
          className="relative z-10 h-full w-full drop-shadow-[0_2px_10px_rgba(124,58,237,0.5)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="aiSparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D2FF" />
              <stop offset="35%" stopColor="#007AFF" />
              <stop offset="70%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>
            <radialGradient id="aiCoreGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#007AFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Primary Celestial 4-Point Sparkle Star (✨) */}
          <path
            d="M50 4 C50 30 70 50 96 50 C70 50 50 70 50 96 C50 70 30 50 4 50 C30 50 50 30 50 4 Z"
            fill="url(#aiSparkleGrad)"
          />

          {/* Secondary Delicate Sparkle Star (top right) */}
          <path
            d="M78 12 C78 20 84 26 92 26 C84 26 78 32 78 40 C78 32 72 26 64 26 C72 26 78 20 78 12 Z"
            fill="url(#aiSparkleGrad)"
            opacity="0.85"
          />

          {/* Tertiary Micro Sparkle (bottom left) */}
          <path
            d="M22 68 C22 73 26 77 31 77 C26 77 22 81 22 86 C22 81 18 77 13 77 C18 77 22 73 22 68 Z"
            fill="url(#aiSparkleGrad)"
            opacity="0.75"
          />

          {/* Radiant Core White Star Center */}
          <circle cx="50" cy="50" r="14" fill="url(#aiCoreGlow)" />
          <circle cx="50" cy="50" r="4.5" fill="#FFFFFF" />
        </svg>
      )}
    </div>
  );
});

export default MeduAiLogo;
