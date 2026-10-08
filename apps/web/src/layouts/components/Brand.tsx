/**
 * M-EDU Brand Component — v12 "Titanium"
 * Liquid Glass lockup: logo mark + wordmark, with magnetic physics and
 * Apple-grade focus, shadow and reduced-motion handling.
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { Magnetic } from './Icons';
import { SPRING } from '../core/tokens';
import { usePrefersReducedMotion } from '../core/singletons';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Tone tokens — matches TopBar v12                                          */
/* ────────────────────────────────────────────────────────────────────────── */

const TONE = {
  label: 'text-[#1D1D1F] dark:text-[#F5F5F7]',
  focus:
    'outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF]/55 dark:focus-visible:ring-[#0A84FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
} as const;

/* ────────────────────────────────────────────────────────────────────────── */
/*  Brand                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface BrandProps {
  size?: 'sm' | 'md';
  compact?: boolean;
}

export function Brand({ size = 'md', compact = false }: BrandProps) {
  const reduced = usePrefersReducedMotion();

  const logoSize = size === 'sm' ? 'sm' : 'md';
  const wordmarkClass =
    size === 'sm'
      ? 'text-[17px] tracking-[-0.022em]'
      : 'text-[19px] tracking-[-0.024em]';

  const tap = reduced ? undefined : { scale: 0.92 };
  const logoHover = reduced
    ? undefined
    : { scale: 1.04, rotate: -2 } as const;

  return (
    <Link
      to="/"
      aria-label="M-EDU — Home"
      className={[
        'group inline-flex items-center gap-3 rounded-xl no-underline',
        'transition-opacity duration-200',
        TONE.focus,
      ].join(' ')}
    >
      <Magnetic strength={0.4}>
        <motion.div
          whileHover={logoHover}
          whileTap={tap}
          transition={SPRING.snappy}
          className="relative will-change-transform"
        >
          {/* Soft accent bloom — only visible on hover, feels alive */}
          <span
            aria-hidden
            className={[
              'pointer-events-none absolute inset-0 -z-10 rounded-full',
              'bg-[radial-gradient(circle_at_center,rgba(0,122,255,0.35),transparent_70%)]',
              'opacity-0 blur-md transition-opacity duration-300',
              'group-hover:opacity-100',
              'dark:bg-[radial-gradient(circle_at_center,rgba(10,132,255,0.45),transparent_70%)]',
            ].join(' ')}
          />
          <MeduLogo
            size={logoSize}
            alt=""
            className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          />
        </motion.div>
      </Magnetic>

      {!compact && (
        <span
          className={[
            'font-semibold',
            wordmarkClass,
            TONE.label,
            // Subtle optical lift on hover — Apple marketing site technique
            'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            reduced ? '' : 'group-hover:translate-x-[1px]',
          ].join(' ')}
        >
          M-EDU
        </span>
      )}
    </Link>
  );
}