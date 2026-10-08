/**
 * AiAvatar — Premium Edition
 *
 * Craft:
 *  - AI avatar: gradient (primary → secondary), top sheen, inner highlight,
 *    outer glow, sparkle glyph with subtle rotation on hover
 *  - User avatar: glass gradient (soft → white), hairline border, person glyph
 *  - Matched pair: same size, same radius, same sheen — only color differs
 *  - Both avatars hidden on mobile (sm:flex), matching current API
 *  - Reduced-motion respected
 */

import { Sparkles, User } from 'lucide-react';
import { motion } from 'framer-motion';

/* ============================================================================
 * MOTION
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
} as const;

/* ============================================================================
 * AI AVATAR — gradient + sheen + glow
 * ========================================================================== */

export function AiAvatar({ className = '' }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      whileHover={{ scale: 1.06, rotate: [0, -3, 3, 0] }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING.snappy}
      className={[
        'relative hidden h-8 w-8 shrink-0 items-center justify-center sm:flex',
        className,
      ].join(' ')}
      style={{
        borderRadius: '12px',
        background:
          'linear-gradient(135deg, var(--ai-primary, #007AFF) 0%, var(--ai-secondary, #AF52DE) 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.45), ' +
          'inset 0 -1px 0 rgba(0,0,0,0.10), ' +
          '0 4px 12px -4px var(--ai-shadow-glow-primary, rgba(0,122,255,0.55))',
      }}
    >
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[12px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.4) 0%, transparent 55%)',
        }}
      />
      {/* Sparkle glyph */}
      <Sparkles
        className="relative h-[15px] w-[15px] text-white"
        strokeWidth={1.9}
      />
    </motion.span>
  );
}

/* ============================================================================
 * USER AVATAR — glass + sheen + subtle ring
 * ========================================================================== */

export function UserAvatar({ className = '' }: { className?: string }) {
  return (
    <motion.span
      aria-hidden
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      transition={SPRING.snappy}
      className={[
        'relative hidden h-8 w-8 shrink-0 items-center justify-center sm:flex',
        className,
      ].join(' ')}
      style={{
        borderRadius: '12px',
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(240,240,245,0.85) 100%)',
        border: '1px solid var(--ai-border, rgba(0,0,0,0.08))',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.9), ' +
          'inset 0 -1px 0 rgba(0,0,0,0.03), ' +
          '0 2px 6px -2px rgba(0,0,0,0.06)',
        color: 'var(--ai-text-muted, #86868B)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Top sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[12px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 55%)',
        }}
      />
      {/* Person glyph */}
      <User className="relative h-[15px] w-[15px]" strokeWidth={1.9} />
    </motion.span>
  );
}

export default AiAvatar;