/**
 * M-EDU Layout Decorative & Accessibility Systems — v11 "Titanium"
 * Ambient particles, offline banner, route announcer, and sticky scroll progress.
 */

import { useState, useEffect, useMemo, type RefObject } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { bannerVariants, pageVariants } from '../core/tokens';
import { useDeviceProfile, usePageVisible, useOnline, usePrefersReducedMotion } from '../core/singletons';
import { StaticIcon, I } from './Icons';

export function AmbientParticles() {
  const profile = useDeviceProfile();
  const visible = usePageVisible();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Deterministic seed → SSR-safe
  const particles = useMemo(() => {
    if (!mounted) return [];
    return Array.from({ length: 10 }, (_, i) => {
      const s = ((i * 9301 + 49297) % 233280) / 233280;
      const s2 = ((i * 4523 + 12345) % 100000) / 100000;
      const s3 = ((i * 7919 + 104729) % 100000) / 100000;
      return {
        id: i,
        left: s * 100,
        top: s2 * 100,
        size: 1 + s3 * 2.5,
        delay: s2 * 6,
        duration: 14 + s3 * 12,
        drift: (s - 0.5) * 60,
      };
    });
  }, [mounted]);

  if (!profile.allowAmbient || !visible || particles.length === 0) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{ contain: 'strict' }}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full bg-white/60 opacity-0 dark:bg-white/30"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            animation: `medu-particle-drift ${p.duration}s ${p.delay}s ease-in-out infinite`,
            ['--drift-x' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline"
          variants={bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-3"
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-2.5 rounded-full border border-[#FF9500]/50 bg-[#FF9500]/20 px-4 py-2 backdrop-blur-xl"
            style={{
              boxShadow: '0 8px 24px rgba(255,149,0,0.25), inset 0 1px 0 rgba(255,255,255,0.4)',
            }}
          >
            <StaticIcon paths={I.wifiOff} className="h-4 w-4 text-[#D97706] dark:text-[#FBBF24]" />
            <span className="text-[12px] font-semibold tracking-tight text-[#92400E] dark:text-[#FDE68A]">
              {t('common.offline') || "You're offline — changes may not save"}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RouteAnnouncer({ routeTitle }: { routeTitle: string }) {
  const location = useLocation();
  const { t } = useI18n();
  const [message, setMessage] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      const prefix = t('a11y.navigatedTo') || 'Navigated to';
      const target = routeTitle || t('a11y.newPage') || 'new page';
      setMessage(`${prefix} ${target}`);
    }, 150);
    return () => clearTimeout(id);
  }, [location.key, routeTitle, t]);

  return (
    <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
      {message}
    </div>
  );
}

export function ScrollProgress({ containerRef }: { containerRef: RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, { stiffness: 420, damping: 34, mass: 0.4 });

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none sticky top-0 z-30 h-[2px] origin-left"
      style={{
        scaleX,
        background: 'linear-gradient(90deg, #007AFF, #5856D6, #FF2D55, #FF9500)',
        boxShadow: '0 0 12px rgba(0,122,255,0.5)',
      }}
    />
  );
}

export function AnimatedOutlet() {
  const location = useLocation();
  const reduced = usePrefersReducedMotion();

  if (reduced) return <Outlet />;

  return (
    <motion.div
      key={location.pathname}
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      style={{ minHeight: 1 }}
    >
      <Outlet />
    </motion.div>
  );
}
