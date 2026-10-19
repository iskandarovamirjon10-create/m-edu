/**
 * ============================================================================
 * AiAvatar v2.0 — Liquid Glass + Thinking + Status
 * ============================================================================
 * Fixes:
 *  - Jittery whileHover keyframes → smooth spring scale+rotate
 *  - useReducedMotion actually used (was referenced in comment only)
 *  - aria-hidden → aria-hidden="true" + role="img" + aria-label
 *  - className .join() → cn() (conditional safe)
 *  - UserAvatar dark-mode glass no longer blinding
 *  - size prop ('sm' | 'md' | 'lg') — no more fixed h-8 conflict
 *  - showOnMobile prop (default true) — chat avatars no longer vanish
 * Design:
 *  - AiAvatar: conic ring + glow pulse when state="thinking"
 *  - UserAvatar: status dot (online/offline/away) + optional name initial
 *  - Hover sheen sweep (diagonal light streak)
 *  - 4-layer glass: gradient + specular top + bottom bevel + corner flare
 *  - Scale-in entrance (220ms)
 * ============================================================================
 */

import { type ReactNode } from 'react';
import { Sparkles, User } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/design';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
} as const;

/* ============================================================================
 * SIZES
 * ========================================================================== */

type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<
  AvatarSize,
  { box: number; icon: number; radius: number; dot: number }
> = {
  sm: { box: 24, icon: 11, radius: 8, dot: 6 },
  md: { box: 32, icon: 15, radius: 12, dot: 8 },
  lg: { box: 40, icon: 18, radius: 14, dot: 10 },
};

const STATUS_COLOR: Record<'online' | 'offline' | 'away', string> = {
  online: '#34C759',
  offline: '#8E8E93',
  away: '#FF9500',
};

/* ============================================================================
 * AI AVATAR
 * ========================================================================== */

export interface AiAvatarProps {
  className?: string;
  size?: AvatarSize;
  state?: 'idle' | 'thinking';
  showOnMobile?: boolean;
}

export function AiAvatar({
  className,
  size = 'md',
  state = 'idle',
  showOnMobile = true,
}: AiAvatarProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size];
  const isThinking = state === 'thinking';

  return (
    <motion.span
      role="img"
      aria-label="AI avatar"
      initial={reduced ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.smooth}
      whileHover={
        reduced ? undefined : { scale: 1.04, rotate: 4, transition: SPRING.snappy }
      }
      whileTap={reduced ? undefined : { scale: 0.96 }}
      className={cn(
        'group/avatar relative shrink-0 items-center justify-center',
        showOnMobile ? 'flex' : 'hidden sm:flex',
        className
      )}
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
      }}
    >
      {/* Thinking — conic ring (rotates) */}
      {isThinking && !reduced && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            inset: -2,
            borderRadius: s.radius + 2,
            background:
              'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
            filter: 'blur(0.5px)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Thinking — glow pulse (static fallback for reduced motion) */}
      {isThinking && reduced && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            inset: -2,
            borderRadius: s.radius + 2,
            background:
              'conic-gradient(from 0deg, #007AFF, #5856D6, #AF52DE, #FF2D55, #FF9500, #007AFF)',
          }}
        />
      )}

      {/* Ambient glow pulse (only when thinking) */}
      {isThinking && !reduced && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0,122,255,0.4), transparent 70%)',
            filter: 'blur(6px)',
          }}
          animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.95, 1.1, 0.95] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Inner gradient tile */}
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden text-white"
        style={{
          borderRadius: s.radius,
          background:
            'linear-gradient(135deg, var(--ai-primary, #007AFF) 0%, var(--ai-secondary, #AF52DE) 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 12px -4px var(--ai-shadow-glow-primary, rgba(0,122,255,0.55))',
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

        {/* Hover sheen sweep */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: s.radius }}
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 ease-out group-hover/avatar:translate-x-full motion-reduce:hidden" />
        </span>

        {/* Sparkle glyph */}
        <Sparkles
          className="relative text-white"
          style={{ width: s.icon, height: s.icon }}
          strokeWidth={1.9}
          aria-hidden="true"
        />
      </span>
    </motion.span>
  );
}

/* ============================================================================
 * USER AVATAR
 * ========================================================================== */

export interface UserAvatarProps {
  className?: string;
  size?: AvatarSize;
  /** When provided, renders the first letter instead of the generic User icon. */
  name?: string;
  status?: 'online' | 'offline' | 'away';
  showOnMobile?: boolean;
  children?: ReactNode;
}

export function UserAvatar({
  className,
  size = 'md',
  name,
  status,
  showOnMobile = true,
  children,
}: UserAvatarProps) {
  const reduced = useReducedMotion();
  const s = SIZES[size];
  const initial = name?.trim().charAt(0).toUpperCase();

  return (
    <motion.span
      role="img"
      aria-label={name ? `${name} avatar` : 'Foydalanuvchi avatar'}
      initial={reduced ? false : { scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING.smooth}
      whileHover={
        reduced ? undefined : { scale: 1.04, transition: SPRING.snappy }
      }
      whileTap={reduced ? undefined : { scale: 0.96 }}
      className={cn(
        'group/avatar relative shrink-0 items-center justify-center',
        showOnMobile ? 'flex' : 'hidden sm:flex',
        className
      )}
      style={{
        width: s.box,
        height: s.box,
        borderRadius: s.radius,
      }}
    >
      {/* Inner glass tile */}
      <span
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          borderRadius: s.radius,
          background:
            'linear-gradient(145deg, rgba(255,255,255,0.90) 0%, rgba(240,240,245,0.85) 100%)',
          border: '1px solid var(--ai-border, rgba(0,0,0,0.08))',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 -1px 0 rgba(0,0,0,0.03), 0 2px 6px -2px rgba(0,0,0,0.06)',
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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ borderRadius: s.radius }}
        >
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 ease-out group-hover/avatar:translate-x-full motion-reduce:hidden dark:via-white/20" />
        </span>

        {/* Content: initial letter, custom, or generic icon */}
        {children ? (
          <span className="relative">{children}</span>
        ) : initial ? (
          <span
            className="relative font-semibold leading-none text-[var(--ai-text-primary,#1D1D1F)] dark:text-[var(--ai-text-primary,#F5F5F7)]"
            style={{ fontSize: s.icon, letterSpacing: '-0.02em' }}
          >
            {initial}
          </span>
        ) : (
          <User
            className="relative"
            style={{ width: s.icon, height: s.icon }}
            strokeWidth={1.9}
            aria-hidden="true"
          />
        )}
      </span>

      {/* Status dot */}
      {status && (
        <span
          aria-hidden="true"
          className="absolute flex items-center justify-center"
          style={{
            bottom: -2,
            right: -2,
            width: s.dot,
            height: s.dot,
          }}
        >
          {/* Pulse ring for online */}
          {status === 'online' && !reduced && (
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{ background: STATUS_COLOR[status] }}
              animate={{ scale: [1, 2.2, 1], opacity: [0.55, 0, 0.55] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <span
            className="relative rounded-full ring-2 ring-white dark:ring-[#1C1C1E]"
            style={{
              width: s.dot,
              height: s.dot,
              background: STATUS_COLOR[status],
            }}
          />
        </span>
      )}
    </motion.span>
  );
}

export default AiAvatar;