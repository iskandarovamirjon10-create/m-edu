/**
 * GlassSurface — A glass morphism surface that adapts to context.
 * The building block for the entire M-EDU Liquid Glass design system.
 */
import { type ReactNode, type HTMLAttributes, forwardRef} from'react';

export type GlassElevation ='low' |'mid' |'high';
export type GlassTone ='light' |'frost' |'deep';

interface GlassSurfaceProps extends HTMLAttributes<HTMLDivElement> {
 children?: ReactNode;
 elevation?: GlassElevation;
 tone?: GlassTone;
 className?: string;
 /** Tilt with 3D perspective on hover (use on ID cards / hero elements). */
 tilt?: boolean;
}

const TONE_CLASSES: Record<GlassTone, string> = {
 light:'bg-[var(--bg-card)]',
 frost:'bg-[var(--bg-glass)]',
 deep:'bg-[var(--bg-elevated)]',
};

const ELEVATION_CLASSES: Record<GlassElevation, string> = {
 low:'shadow-[var(--shadow-sm)]',
 mid:'shadow-[var(--shadow-md)]',
 high:'shadow-[var(--shadow-lg)]',
};

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
 ({ children, elevation ='mid', tone ='light', className ='', tilt = false, ...rest}, ref) => {
 return (
 <div
 ref={ref}
 className={[
'relative overflow-hidden backdrop-blur-2xl backdrop-saturate-[1.6]',
'border border-[var(--border-glass)]',
'transition-[background-color,box-shadow,transform] duration-[280ms] ease-[cubic-bezier(.25,.46,.45,.94)]',
 TONE_CLASSES[tone],
 ELEVATION_CLASSES[elevation],
 tilt ? 'hover:-translate-y-1 hover:shadow-[var(--shadow-lg),var(--shadow-glow-cyan)] [transform-style:preserve-3d]' : '',
 className,
 ].filter(Boolean).join(' ')}
 {...rest}
 >
 {/* Glass reflection sheen */}
 <div
 aria-hidden
 className="pointer-events-none absolute inset-0 rounded-[inherit]"
 style={{
 background:
'linear-gradient(135deg, rgba(255,255,255,0.32) 0%, transparent 45%, rgba(148,234,239,0.04) 100%)',
}}
 />
 {children}
 </div>
 );
},
);

GlassSurface.displayName ='GlassSurface';

export default GlassSurface;
