/**
 * M-EDU Layout Decorations & Accessibility Systems — v5 "Hyper-Refractive Liquid Glass"
 * VisionOS-inspired ambient illumination, refractive offline capsules,
 * WCAG live announcer, ultra-smooth scroll beam, and fluid route transitions.
 */
import {
  memo,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { Icon, cn, usePrefersReducedMotion } from '@/lib/design';
import { SPRING, bannerVariants } from '../core/tokens';
import { useOnline } from '../core/singletons';

/* ══════════════════════════════════════════════════════════════════
 * 1 · AMBIENT — Ultra-Refractive Spatial Wash (VisionOS style)
 * ══════════════════════════════════════════════════════════════════ */

export const AmbientParticles = memo(function AmbientParticles() {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {reduced ? (
        <div className="absolute inset-0 bg-black/[0.015] dark:bg-white/[0.02]" />
      ) : (
        <>
          {/* Top Caustic Light Wash */}
          <div className="absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-b from-[#007AFF]/[0.06] via-[#5E5CE6]/[0.02] to-transparent dark:from-[#0A84FF]/[0.09] dark:via-[#5E5CE6]/[0.03]" />
          {/* Bottom Ambient Glow */}
          <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-black/[0.03] to-transparent dark:from-white/[0.04]" />
        </>
      )}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════
 * 2 · OFFLINE BANNER — Refractive Liquid Glass Capsule
 * ══════════════════════════════════════════════════════════════════ */

type BannerMode = 'hidden' | 'offline' | 'reconnected';

export const OfflineBanner = memo(function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  const reduced = usePrefersReducedMotion();

  const wasOfflineRef = useRef(false);
  const [mode, setMode] = useState<BannerMode>(() =>
    online ? 'hidden' : 'offline',
  );

  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true;
      setMode('offline');
      return;
    }

    if (wasOfflineRef.current) {
      setMode('reconnected');
      const timer = setTimeout(() => {
        setMode('hidden');
        wasOfflineRef.current = false;
      }, 3000);
      return () => clearTimeout(timer);
    }

    setMode('hidden');
  }, [online]);

  const isOffline = mode === 'offline';

  return (
    <AnimatePresence mode="popLayout">
      {mode !== 'hidden' && (
        <motion.div
          key={mode}
          variants={bannerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          role="status"
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[calc(0.85rem+env(safe-area-inset-top,0px))]"
        >
          <motion.div
            initial={reduced ? false : { scale: 0.94, y: -8 }}
            animate={{ scale: 1, y: 0 }}
            exit={reduced ? undefined : { scale: 0.96, y: -8 }}
            transition={SPRING.snappy}
            className={cn(
              'pointer-events-auto inline-flex items-center gap-2.5 rounded-full border px-4.5 py-2 text-[12px] font-bold shadow-[0_12px_36px_-8px_rgba(0,0,0,0.22),inset_0_1px_1.5px_rgba(255,255,255,0.9)] backdrop-blur-3xl backdrop-saturate-[210%]',
              isOffline
                ? 'border-apple-orange/40 bg-white/80 text-apple-orange dark:bg-[#1C1C1E]/85 dark:border-apple-orange/50'
                : 'border-apple-green/40 bg-white/80 text-apple-green dark:bg-[#1C1C1E]/85 dark:border-apple-green/50',
            )}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
              {!reduced && (
                <motion.span
                  className={cn(
                    'absolute inset-0 rounded-full',
                    isOffline ? 'bg-apple-orange' : 'bg-apple-green',
                  )}
                  animate={{ scale: [1, 2.4, 1], opacity: [0.75, 0, 0.75] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <span
                className={cn(
                  'relative h-2.5 w-2.5 rounded-full',
                  isOffline ? 'bg-apple-orange' : 'bg-apple-green',
                )}
              />
            </span>

            <Icon name={isOffline ? 'alertCircle' : 'check'} size={16} />

            <span>
              {isOffline
                ? t('common.offline') ||
                  'Internet aloqasi uzildi — o\'zgarishlar saqlanmasligi mumkin'
                : t('common.backOnline') || 'Aloqa muvaffaqiyatli tiklandi'}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ══════════════════════════════════════════════════════════════════
 * 3 · ROUTE ANNOUNCER — WCAG 2.1 AA Live Region
 * ══════════════════════════════════════════════════════════════════ */

export const RouteAnnouncer = memo(function RouteAnnouncer({
  routeTitle,
}: {
  routeTitle: string;
}) {
  const location = useLocation();
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const isFirstMount = useRef(true);

  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const id = setTimeout(() => {
      const tr = tRef.current;
      const prefix = tr('a11y.navigatedTo') || 'Sahifaga o\'tildi:';
      const target =
        routeTitle ||
        (typeof document !== 'undefined' ? document.title : '') ||
        tr('a11y.newPage') ||
        'yangi sahifa';
      setMessage(`${prefix} ${target}`);
    }, 150);

    return () => clearTimeout(id);
  }, [location.pathname, routeTitle]);

  return (
    <div aria-live="polite" aria-atomic="true" role="status" className="sr-only">
      {message}
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════
 * 4 · SCROLL PROGRESS — Slim Refractive Luminous Beam
 * ══════════════════════════════════════════════════════════════════ */

export const ScrollProgress = memo(function ScrollProgress({
  containerRef,
}: {
  containerRef: RefObject<HTMLElement | null>;
}) {
  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 400,
    damping: 36,
    mass: 0.3,
  });
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.008, 0.995, 1],
    [0, 1, 1, 0],
  );

  return (
    <motion.div
      aria-hidden="true"
      style={{ opacity }}
      className="pointer-events-none sticky top-0 z-30 h-[2.5px] w-full overflow-hidden"
    >
      <motion.div
        className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#007AFF] via-[#5E5CE6] to-[#007AFF] shadow-[0_0_12px_#007AFF] dark:from-[#0A84FF] dark:via-[#BF5AF2] dark:to-[#0A84FF] dark:shadow-[0_0_14px_#0A84FF]"
        style={{ scaleX }}
      />
    </motion.div>
  );
});

/* ══════════════════════════════════════════════════════════════════
 * 5 · ANIMATED OUTLET — Fluid Frozen Outlet & Containing-Block Cleanup
 * ══════════════════════════════════════════════════════════════════ */

export const AnimatedOutlet = memo(function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full w-full flex-1 flex flex-col"
    >
      {outlet}
    </motion.div>
  );
});