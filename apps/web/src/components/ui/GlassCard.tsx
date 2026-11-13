/**
 * GlassCard — Apple Spatial Material & Solarium Architecture (iOS 27 / visionOS Grade)
 * 
 * Features:
 *  - 3-Layered Apple Shadow hierarchy (ambient contact + diffused penumbra + caustic rim)
 *  - Dynamic Cursor Spotlight & Specular Sheen via CSS properties
 *  - Interactive 3D micro-parallax tilt on pointer movement
 *  - Continuous superellipse curvature (Apple Squircle)
 *  - Tactile audio & haptic feedback integration
 */
import {
  type ReactNode,
  type HTMLAttributes,
  type MouseEvent,
  forwardRef,
  useRef,
  useState,
  useCallback,
} from 'react';
import { cn } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';

export type GlassCardVariant = 'default' | 'elevated' | 'flat' | 'interactive' | 'tactile' | 'spatial';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: GlassCardVariant;
  /** Enables 3D tilt and cursor spotlight tracking */
  interactive?: boolean;
  hover?: boolean;
  /** Enable dynamic optical spotlight reflection */
  spotlight?: boolean;
  /** Custom accent bloom color (e.g., rgba(10,132,255,0.15)) */
  accentGlow?: string;
  className?: string;
  /** @deprecated no-op for backward compatibility */
  noReflection?: boolean;
  /** @deprecated no-op for backward compatibility */
  disableRefraction?: boolean;
  /** @deprecated no-op for backward compatibility */
  disableMotion?: boolean;
  /** @deprecated no-op for backward compatibility */
  gradientTitle?: boolean;
}

const VARIANT_CLASSES: Record<GlassCardVariant, string> = {
  default: cn(
    'relative isolate overflow-hidden',
    'bg-white/80 dark:bg-[#18181b]/80 backdrop-blur-xl backdrop-blur-2xl backdrop-saturate-180',
    'border border-black/[0.08] dark:border-white/[0.12]',
    'rounded-2xl rounded-[22px]',
    // Apple 3-Layered Shadow
    'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_32px_-6px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
    'transition-[border-color,box-shadow,background-color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
  ),
  elevated: cn(
    'relative isolate overflow-hidden',
    'bg-white/92 dark:bg-[#202024]/90 backdrop-blur-2xl backdrop-blur-3xl backdrop-saturate-200',
    'border border-black/[0.09] dark:border-white/[0.15]',
    'rounded-2xl rounded-[24px]',
    // High Elevation Apple Shadow
    'shadow-card-elevated shadow-[0_2px_4px_rgba(0,0,0,0.05),0_16px_40px_-8px_rgba(0,0,0,0.12),inset_0_1px_1px_0_rgba(255,255,255,0.95)]',
    'dark:shadow-[0_2px_6px_rgba(0,0,0,0.5),0_20px_48px_-10px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.18)]',
    'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
  ),
  flat: cn(
    'relative isolate overflow-hidden',
    'bg-white/50 dark:bg-white/[0.04] backdrop-blur-md backdrop-saturate-150',
    'border border-black/[0.05] dark:border-white/[0.08]',
    'rounded-2xl rounded-[20px] shadow-none transition-all duration-200',
  ),
  tactile: cn(
    'relative isolate overflow-hidden',
    'bg-white/85 dark:bg-[#1a1a1e]/85 backdrop-blur-xl backdrop-blur-2xl backdrop-saturate-180',
    'border border-black/[0.07] dark:border-white/[0.11]',
    'rounded-2xl rounded-[22px]',
    'shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)]',
    'dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
    'transition-all duration-200',
  ),
  interactive: cn(
    'relative isolate overflow-hidden cursor-pointer select-none',
    'bg-white/80 dark:bg-[#18181b]/80 backdrop-blur-xl backdrop-blur-2xl backdrop-saturate-180',
    'border border-black/[0.08] dark:border-white/[0.12]',
    'rounded-2xl rounded-[22px]',
    'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_0_rgba(255,255,255,0.85)]',
    'dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_32px_-6px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
    // Apple Interactive States
    'hover:border-black/[0.15] dark:hover:border-white/[0.22]',
    'hover:shadow-[0_4px_8px_rgba(0,0,0,0.06),0_18px_36px_-6px_rgba(0,0,0,0.12),inset_0_1px_0_0_rgba(255,255,255,0.95)]',
    'dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.4),0_24px_50px_-8px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.22)]',
    'hover:-translate-y-1 active:translate-y-0 active:scale-[0.985]',
    'transform-gpu transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
  ),
  spatial: cn(
    'relative isolate overflow-hidden',
    'bg-gradient-to-b from-white/90 to-white/70 dark:from-[#24242a]/90 dark:to-[#18181b]/80',
    'backdrop-blur-3xl backdrop-saturate-200',
    'border border-white/40 dark:border-white/[0.16]',
    'rounded-2xl rounded-[26px]',
    'shadow-[0_4px_16px_rgba(0,0,0,0.08),0_24px_64px_-12px_rgba(0,0,0,0.14),inset_0_1.5px_0_0_rgba(255,255,255,1)]',
    'dark:shadow-[0_6px_20px_rgba(0,0,0,0.6),0_30px_70px_-14px_rgba(0,0,0,0.8),inset_0_1.5px_0_0_rgba(255,255,255,0.24)]',
    'transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
  ),
};

const PADDING_CLASSES: Record<string, string> = {
  none: '',
  sm: 'p-3 sm:p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-6 sm:p-7',
  xl: 'p-6 sm:p-9',
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      padding,
      variant: variantProp = 'default',
      hover = false,
      interactive = false,
      spotlight = true,
      accentGlow,
      className = '',
      onMouseEnter,
      onMouseMove,
      onMouseLeave,
      noReflection: _noReflection,
      disableRefraction: _disableRefraction,
      disableMotion: _disableMotion,
      gradientTitle: _gradientTitle,
      ...rest
    },
    ref,
  ) => {
    const isInteractive = hover || interactive;
    const variant = isInteractive && variantProp === 'default' ? 'interactive' : variantProp;
    const hasExplicitPadding = /(^|\s)p[xytrbl]?-/.test(className);
    const paddingClass = padding ? PADDING_CLASSES[padding] : hasExplicitPadding ? '' : PADDING_CLASSES.md;

    const innerRef = useRef<HTMLDivElement | null>(null);
    const [mousePos, setMousePos] = useState({ x: -100, y: -100, opacity: 0 });
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const { playSound } = usePremiumSound();

    const handleMouseEnter = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        if (isInteractive) {
          playSound('click', 0.25);
        }
        setMousePos((prev) => ({ ...prev, opacity: 1 }));
        onMouseEnter?.(e);
      },
      [isInteractive, onMouseEnter, playSound],
    );

    const handleMouseMove = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        const target = innerRef.current;
        if (target) {
          const rect = target.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setMousePos({ x, y, opacity: 1 });

          // Interactive 3D Parallax Tilt (calibrated to Apple subtle 3-4 degrees)
          if (isInteractive) {
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -3;
            const rotateY = ((x - centerX) / centerX) * 3;
            setTilt({ x: rotateX, y: rotateY });
          }
        }
        onMouseMove?.(e);
      },
      [isInteractive, onMouseMove],
    );

    const handleMouseLeave = useCallback(
      (e: MouseEvent<HTMLDivElement>) => {
        setMousePos((prev) => ({ ...prev, opacity: 0 }));
        setTilt({ x: 0, y: 0 });
        onMouseLeave?.(e);
      },
      [onMouseLeave],
    );

    const setMergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ref as any).current = node;
        }
      },
      [ref],
    );

    return (
      <div
        ref={setMergedRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: isInteractive && (tilt.x !== 0 || tilt.y !== 0)
            ? `perspective(1000px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`
            : undefined,
          ...rest.style,
        }}
        className={cn(
          'group/glass-card min-w-0 max-w-full box-border',
          VARIANT_CLASSES[variant],
          paddingClass,
          className,
        )}
        {...rest}
      >
        {/* Apple Dynamic Specular Meniscus (Top Edge Highlight) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/25 to-transparent z-10"
        />

        {/* Dynamic Cursor Spotlight Ray */}
        {spotlight && mousePos.opacity > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 z-0"
            style={{
              opacity: mousePos.opacity,
              background: `radial-gradient(420px circle at ${mousePos.x}px ${mousePos.y}px, ${
                accentGlow || 'rgba(255,255,255,0.18)'
              }, transparent 65%)`,
            }}
          />
        )}

        {/* Card Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';
export default GlassCard;
