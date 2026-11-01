/**
 * ============================================================================
 * AiAvatar v3.0 — Liquid Glass · Premium · A11y · Robust
 * ============================================================================
 * v3 changes (from v2.0):
 *  - a11y: AI aria-label now reflects state ("thinking"/"idle");
 *         optional live-region announcement via `announce` prop.
 *  - a11y: UserAvatar status is announced via sr-only;
 *         status dot now has SHAPE variants for color-blind users
 *         (online=dot, away=dash, offline=ring).
 *  - a11y: `title` tooltip on wrapper (native, accessible fallback).
 *  - a11y: `prefers-contrast` → thicker border + solid stroke.
 *  - fix:  thinking glow was `rounded-full` on rounded-rect tile — now
 *         uses `borderRadius: s.radius + 6` so it hugs the shape.
 *  - fix:  hover removed rotate-jitter — smooth spring scale only.
 *         `playful` prop re-enables rotate for those who want it.
 *  - fix:  hover disabled while thinking (no competing motion).
 *  - fix:  conic ring uses `background` on a masked border (2px),
 *         no `filter: blur` — GPU-friendly, no halo.
 *  - fix:  `prefers-reduced-data` skips sheen sweep.
 *  - new:  `xs` (20px) and `xl` (56px) sizes.
 *  - new:  UserAvatar `src` → real image + skeleton while loading +
 *         automatic fallback to initial / icon on error.
 *  - new:  `verified` and `badge` (number) indicators.
 *  - new:  `frame` prop — thin accent ring (Apple Watch style).
 *  - new:  `intensity` prop — glow/sheen strength 0..1.
 *  - new:  `onImageError` callback.
 *  - new:  `aria-busy` when image loading.
 *  - new:  default export is a `{ AiAvatar, UserAvatar }` namespace,
 *         plus named exports (both work).
 * ============================================================================
 */

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { User, Check } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { MeduAiLogo } from '@/components/brand/MeduAiLogo';
import { cn } from '@/lib/design';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

/* ============================================================================
 * MEDIA HOOKS
 * ========================================================================== */

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

/* ============================================================================
 * SIZES
 * ========================================================================== */

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<
  AvatarSize,
  { box: number; icon: number; radius: number; dot: number }
> = {
  xs: { box: 20, icon: 9,  radius: 6,  dot: 5 },
  sm: { box: 24, icon: 11, radius: 8,  dot: 6 },
  md: { box: 32, icon: 15, radius: 12, dot: 8 },
  lg: { box: 40, icon: 18, radius: 14, dot: 10 },
  xl: { box: 56, icon: 24, radius: 18, dot: 13 },
};

type Status = 'online' | 'offline' | 'away';

const STATUS_META: Record<
  Status,
  { color: string; colorDark: string; label: string; shape: 'dot' | 'dash' | 'ring' }
> = {
  online:  { color: '#34C759', colorDark: '#30D158', label: 'onlayn',  shape: 'dot'  },
  away:    { color: '#FF9500', colorDark: '#FF9F0A', label: 'uzoqda',  shape: 'dash' },
  offline: { color: '#8E8E93', colorDark: '#636366', label: 'oflayn',  shape: 'ring' },
};

/* ============================================================================
 * SHARED — surface tokens
 * ========================================================================== */

function glassRingStyle(radius: number, intensity: number): CSSProperties {
  return {
    borderRadius: radius + 2,
    padding: 2,
    background:
      'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
    WebkitMask:
      'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    opacity: 0.85 + intensity * 0.15,
  };
}

/* ============================================================================
 * AI AVATAR
 * ========================================================================== */

export interface AiAvatarProps {
  className?: string;
  size?: AvatarSize;
  state?: 'idle' | 'thinking';
  showOnMobile?: boolean;
  /** Screen-reader announcement on state change (opt-in). */
  announce?: boolean;
  /** Glow/sheen strength. 0 = off, 1 = default, 2 = intense. */
  intensity?: number;
  /** Enables subtle rotate on hover (default false — Apple-calm). */
  playful?: boolean;
  /** Adds a thin accent ring around the tile. */
  frame?: boolean;
  /** Native tooltip on hover. */
  title?: string;
}

export function AiAvatar({
  className,
  size = 'md',
  state = 'idle',
  showOnMobile = true,
  announce = false,
  intensity = 1,
  playful = false,
  frame = false,
  title,
}: AiAvatarProps) {
  const reduced = useReducedMotion();
  const reducedData = useMediaQuery('(prefers-reduced-data: reduce)');
  const highContrast = useMediaQuery('(prefers-contrast: more)');
  const s = SIZES[size];
  const isThinking = state === 'thinking';

  const label = isThinking ? 'AI avatar — javob tayyorlayapti' : 'AI avatar';
  const tooltip = title ?? (isThinking ? 'AI o\'ylayapti…' : 'AI');

  // Disable heavy motion when: reduced, reduced-data, or thinking (ring is
  // already animating — no need for hover motion to compete).
  const motionOff = Boolean(reduced) || Boolean(reducedData) || isThinking;
  const sheenOn = !reduced && !reducedData;

  const hover = motionOff
    ? undefined
    : {
        scale: playful ? 1.04 : 1.03,
        rotate: playful ? 4 : 0,
        transition: SPRING.snappy,
      };

  return (
    <motion.span
      role="img"
      aria-label={label}
      aria-live={announce ? 'polite' : undefined}
      aria-atomic={announce ? true : undefined}
      title={tooltip}
      initial={reduced ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.smooth}
      whileHover={hover}
      whileTap={motionOff ? undefined : { scale: 0.97 }}
      className={cn(
        'group/avatar relative shrink-0 items-center justify-center overflow-visible',
        showOnMobile ? 'flex' : 'hidden sm:flex',
        className,
      )}
      style={{ width: s.box, height: s.box, borderRadius: s.radius }}
    >
      {/* ── Frame ring (optional) ─────────────────────────────────────── */}
      {frame && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: s.radius,
            border: highContrast ? '1.5px solid currentColor' : '1px solid var(--ai-border, rgba(0,0,0,0.10))',
          }}
        />
      )}

      {/* ── Thinking: rotating conic ring (masked border) ─────────────── */}
      {isThinking && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            inset: -2,
            ...glassRingStyle(s.radius, intensity),
          }}
          animate={reduced ? undefined : { rotate: 360 }}
          transition={
            reduced ? undefined : { duration: 8, repeat: Infinity, ease: 'linear' }
          }
        />
      )}

      {/* ── Thinking: ambient glow pulse (correct radius) ─────────────── */}
      {isThinking && !reduced && intensity > 0 && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            inset: -6,
            borderRadius: s.radius + 6,
            background:
              'radial-gradient(circle, rgba(0,122,255,0.38), transparent 70%)',
            filter: 'blur(6px)',
          }}
          animate={{ opacity: [0.35, 0.7, 0.35], scale: [0.97, 1.06, 0.97] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* ── Inner gradient tile ───────────────────────────────────────── */}
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden text-white"
        style={{
          borderRadius: s.radius,
          background:
            'linear-gradient(135deg, var(--ai-primary, #007AFF) 0%, var(--ai-secondary, #AF52DE) 100%)',
          boxShadow: highContrast
            ? 'inset 0 0 0 1px rgba(255,255,255,0.9)'
            : [
                'inset 0 1px 0 rgba(255,255,255,0.45)',
                'inset 0 -1px 0 rgba(0,0,0,0.10)',
                `0 4px 12px -4px var(--ai-shadow-glow-primary, rgba(0,122,255,${0.4 + intensity * 0.15}))`,
              ].join(', '),
        }}
      >
        {/* Specular top sheen */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: s.radius,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, transparent 55%)',
          }}
        />

        {/* Corner lens flare */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-2 -top-2 rounded-full bg-white/40 blur-md"
          style={{ width: s.box * 0.6, height: s.box * 0.6 }}
        />

        {/* Hover sheen sweep (skips reduced-data) */}
        {sheenOn && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ borderRadius: s.radius }}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover/avatar:translate-x-full motion-reduce:hidden" />
          </span>
        )}

        {/* Official Premium AI Sparkle Logo (✨) */}
        <MeduAiLogo
          size={s.box >= 40 ? 'md' : s.box >= 32 ? 'sm' : 'xs'}
          className="relative z-10"
          alt=""
        />
      </span>
    </motion.span>
  );
}

/* ============================================================================
 * STATUS DOT — color + shape for color-blind users
 * ========================================================================== */

function StatusDot({
  status,
  size,
  reduced,
}: {
  status: Status;
  size: number;
  reduced: boolean | null;
}) {
  const meta = STATUS_META[status];
  const showPulse = status === 'online' && !reduced;

  return (
    <span
      aria-hidden="true"
      className="absolute flex items-center justify-center"
      style={{ bottom: -2, right: -2, width: size, height: size }}
    >
      {showPulse && (
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: meta.color }}
          animate={{ scale: [1, 2.2, 1], opacity: [0.55, 0, 0.55] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <span
        className="relative flex items-center justify-center rounded-full ring-2 ring-white dark:ring-[#1C1C1E]"
        style={{
          width: size,
          height: size,
          background: meta.shape === 'ring' ? 'transparent' : meta.color,
          border: meta.shape === 'ring' ? `1.5px solid ${meta.color}` : undefined,
        }}
      >
        {/* Shape variants for color-blind support */}
        {meta.shape === 'dash' && (
          <span
            style={{
              width: size * 0.5,
              height: Math.max(1.5, size * 0.14),
              background: '#fff',
              borderRadius: 1,
            }}
          />
        )}
        {meta.shape === 'ring' && (
          <span
            style={{
              width: size * 0.35,
              height: Math.max(1.5, size * 0.14),
              background: meta.color,
              borderRadius: 1,
            }}
          />
        )}
      </span>
    </span>
  );
}

/* ============================================================================
 * USER AVATAR
 * ========================================================================== */

export interface UserAvatarProps {
  className?: string;
  size?: AvatarSize;
  /** Optional image URL. Falls back to initial → icon on error. */
  src?: string;
  /** When provided, renders the first letter if no image/error. */
  name?: string;
  status?: Status;
  showOnMobile?: boolean;
  /** Verified checkmark badge (top-right). */
  verified?: boolean;
  /** Numeric notification count (top-right). Wins over `verified`. */
  badge?: number;
  /** Adds a thin accent frame. */
  frame?: boolean;
  /** External loading state — shows skeleton. */
  loading?: boolean;
  /** Forwarded to the inner <img> (alt, crossOrigin, etc.). */
  imgProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  children?: ReactNode;
  title?: string;
}

export function UserAvatar({
  className,
  size = 'md',
  src,
  name,
  status,
  showOnMobile = true,
  verified = false,
  badge,
  frame = false,
  loading = false,
  imgProps,
  onImageError,
  children,
  title,
}: UserAvatarProps) {
  const reduced = useReducedMotion();
  const reducedData = useMediaQuery('(prefers-reduced-data: reduce)');
  const highContrast = useMediaQuery('(prefers-contrast: more)');
  const s = SIZES[size];

  const [imgState, setImgState] = useState<'idle' | 'loading' | 'loaded' | 'error'>(
    src ? 'loading' : 'idle',
  );

  useEffect(() => {
    if (!src) {
      setImgState('idle');
      return;
    }
    setImgState('loading');
  }, [src]);

  const initial = useMemo(
    () => name?.trim().charAt(0).toUpperCase() || '',
    [name],
  );

  const statusMeta = status ? STATUS_META[status] : null;
  const showImg = Boolean(src) && imgState !== 'error';
  const showImgVisual = showImg && imgState === 'loaded';
  const showSkeleton = (loading || imgState === 'loading') && !showImgVisual;

  const baseLabel = name ? `${name} avatar` : 'Foydalanuvchi avatar';
  const label = statusMeta ? `${baseLabel}, ${statusMeta.label}` : baseLabel;
  const tooltip = title ?? name ?? 'Foydalanuvchi';

  const showVerified = verified && badge === undefined;
  const showBadge = typeof badge === 'number' && badge > 0;

  return (
    <motion.span
      role="img"
      aria-label={label}
      aria-busy={showSkeleton || undefined}
      title={tooltip}
      initial={reduced ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.smooth}
      whileHover={reduced ? undefined : { scale: 1.04, transition: SPRING.snappy }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={cn(
        'group/avatar relative shrink-0 items-center justify-center overflow-visible',
        showOnMobile ? 'flex' : 'hidden sm:flex',
        className,
      )}
      style={{ width: s.box, height: s.box, borderRadius: s.radius }}
    >
      {/* ── Frame ring (optional) ─────────────────────────────────────── */}
      {frame && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: s.radius,
            border: highContrast
              ? '1.5px solid currentColor'
              : '1px solid var(--ai-border, rgba(0,0,0,0.10))',
          }}
        />
      )}

      {/* ── Inner glass tile ─────────────────────────────────────────── */}
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          borderRadius: s.radius,
          background: highContrast
            ? 'Canvas'
            : 'linear-gradient(145deg, rgba(255,255,255,0.90) 0%, rgba(240,240,245,0.85) 100%)',
          border: highContrast
            ? '1.5px solid currentColor'
            : '1px solid var(--ai-border, rgba(0,0,0,0.08))',
          boxShadow: highContrast
            ? 'none'
            : [
                'inset 0 1px 0 rgba(255,255,255,0.9)',
                'inset 0 -1px 0 rgba(0,0,0,0.03)',
                '0 2px 6px -2px rgba(0,0,0,0.06)',
              ].join(', '),
          color: 'var(--ai-text-muted, #86868B)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        {/* Dark-mode glass overlay */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            borderRadius: s.radius,
            background:
              'linear-gradient(145deg, rgba(58,58,60,0.75) 0%, rgba(44,44,46,0.65) 100%)',
          }}
        />

        {/* Specular top sheen */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: s.radius,
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, transparent 55%)',
          }}
        />

        {/* Bottom bevel */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/[0.06] to-transparent dark:via-white/[0.06]"
        />

        {/* Hover sheen sweep */}
        {!reduced && !reducedData && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            style={{ borderRadius: s.radius }}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover/avatar:translate-x-full motion-reduce:hidden dark:via-white/20" />
          </span>
        )}

        {/* Image (progressive) */}
        {showImg && (
          <img
            {...imgProps}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              setImgState('loaded');
              imgProps?.onLoad?.(e);
            }}
            onError={(e) => {
              setImgState('error');
              onImageError?.(e);
            }}
            className={cn(
              'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
              showImgVisual ? 'opacity-100' : 'opacity-0',
              imgProps?.className,
            )}
            style={{ borderRadius: s.radius, ...imgProps?.style }}
          />
        )}

        {/* Skeleton while loading */}
        {showSkeleton && (
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-slate-900/[0.06] dark:bg-white/[0.08] motion-safe:animate-pulse"
            style={{ borderRadius: s.radius }}
          />
        )}

        {/* Content (custom → initial → icon) */}
        {!showSkeleton && (
          <>
            {children ? (
              <span className="relative">{children}</span>
            ) : !showImgVisual && initial ? (
              <span
                className="relative font-semibold leading-none text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]"
                style={{ fontSize: s.icon, letterSpacing: '-0.02em' }}
              >
                {initial}
              </span>
            ) : !showImgVisual ? (
              <User
                className="relative"
                style={{ width: s.icon, height: s.icon }}
                strokeWidth={1.9}
                aria-hidden="true"
              />
            ) : null}
          </>
        )}
      </span>

      {/* ── Status dot ────────────────────────────────────────────────── */}
      {status && <StatusDot status={status} size={s.dot} reduced={reduced} />}

      {/* ── Verified badge ────────────────────────────────────────────── */}
      {showVerified && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-[#007AFF] text-white ring-2 ring-white dark:ring-[#1C1C1E]"
          style={{
            top: -3,
            right: -3,
            width: Math.max(10, s.dot * 0.95),
            height: Math.max(10, s.dot * 0.95),
          }}
          aria-label="Tasdiqlangan"
        >
          <Check size={Math.max(7, s.dot * 0.6)} strokeWidth={3} aria-hidden="true" />
        </span>
      )}

      {/* ── Count badge ───────────────────────────────────────────────── */}
      {showBadge && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-[#FF3B30] font-bold text-white ring-2 ring-white dark:ring-[#1C1C1E]"
          style={{
            top: -4,
            right: -4,
            minWidth: Math.max(14, s.dot * 1.15),
            height: Math.max(14, s.dot * 1.15),
            padding: `0 ${Math.max(3, s.dot * 0.25)}px`,
            fontSize: Math.max(8.5, s.dot * 0.65),
            lineHeight: 1,
          }}
          aria-label={`${badge} ta yangi xabar`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </motion.span>
  );
}

/* ============================================================================
 * EXPORTS
 * ========================================================================== */

export default Object.assign(AiAvatar, { AiAvatar, UserAvatar });