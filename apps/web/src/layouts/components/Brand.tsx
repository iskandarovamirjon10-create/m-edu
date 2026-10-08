/**
 * M-EDU Brand Component — v11 "Titanium"
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MeduLogo } from '@/components/brand/MeduLogo';
import { Magnetic } from './Icons';

export function Brand({ size = 'md', compact = false }: { size?: 'sm' | 'md'; compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-3 no-underline group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2 rounded-xl"
    >
      <Magnetic strength={0.4}>
        <motion.div whileTap={{ scale: 0.92 }}>
          <MeduLogo size={size === 'sm' ? 'sm' : 'md'} alt="" className="drop-shadow-sm" />
        </motion.div>
      </Magnetic>
      {!compact && (
        <span
          className={[
            'font-semibold tracking-tighter text-[#1D1D1F] dark:text-[#F5F5F7]',
            size === 'sm' ? 'text-[17px]' : 'text-[19px]',
          ].join(' ')}
        >
          M-EDU
        </span>
      )}
    </Link>
  );
}
