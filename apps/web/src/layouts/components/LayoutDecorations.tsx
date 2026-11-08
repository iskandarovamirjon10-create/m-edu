/**
 * M-EDU Layout Decorations & Accessibility Systems — V4.0 "Liquid Glass"
 * Token-synchronized ambient illumination, refractive offline capsules,
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
import { useSafeI18n } from '@/i18n/I18nProvider';
import { Icon, cn, usePrefersReducedMotion } from '@/lib/design';
import { SPRING, bannerVariants } from '../core/tokens';
import { useOnline } from '../core/singletons';

/* ══════════════════════════════════════════════════════════════════
 * 1 · AMBIENT — Refractive Spatial Wash (Synced to V4 Caustics)
 * ══════════════════════════════════════════════════════════════════ */

export const AmbientParticles = memo(function AmbientParticles() {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none"
    >
      {reduced ? null : (
        <>
          {/* Top Caustic Light Wash */}
          <div className="absolute inset-x-0 top-0 h-[45vh] bg-gradient-to-b from-[var(--glass-caustic-1)] via-[var(--glass-caustic-2)] to-transparent" />
          {/* Bottom Ambient Glow */}
          <div className="absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-[var(--glass-caustic-2)] to-transparent" />
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
  const { t } = useSafeI18n();
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
              'pointer-events-auto inline-flex items-center gap-2.5 rounded-full border px-4.5 py-2 text-[12px] font-bold shadow-glass-floating backdrop-blur-3xl backdrop-saturate-[210%]',
              isOffline
                ? 'border-apple-orange/40 bg-surface/85 text-apple-orange'
                : 'border-apple-green/40 bg-surface/85 text-apple-green',
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
  const { t } = useSafeI18n();
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
      style={{ opacity, top: 'var(--shell-progress-top, 0px)' }}
      className="pointer-events-none sticky z-30 h-[2.5px] w-full overflow-hidden"
    >
      <motion.div
        className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[var(--c-blue)] via-[var(--c-purple)] to-[var(--c-blue)] shadow-[0_0_12px_var(--c-blue)]"
        style={{ scaleX }}
      />
    </motion.div>
  );
});

/* ══════════════════════════════════════════════════════════════════
 * 5 · ANIMATED OUTLET — Fluid VisionOS-Grade Screen Transitions
 * ══════════════════════════════════════════════════════════════════ */

export const AnimatedOutlet = memo(function AnimatedOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduced = usePrefersReducedMotion();

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {outlet && (
        <motion.div
          key={location.pathname}
          initial={reduced ? undefined : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{
            duration: reduced ? 0 : 0.16,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="min-h-full w-full max-w-full min-w-0 flex-1 flex flex-col transform-gpu"
        >
          {outlet}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ══════════════════════════════════════════════════════════════════
 * 6 · ROUTE PROGRESS BAR — Luminous Top Accent Beam on Screen Transition
 * ══════════════════════════════════════════════════════════════════ */

export const RouteProgressBar = memo(function RouteProgressBar() {
  const location = useLocation();
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(false);
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (reduced) return;
    setActive(true);
    const timer = setTimeout(() => setActive(false), 420);
    return () => clearTimeout(timer);
  }, [location.pathname, reduced]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed top-0 inset-x-0 z-[100] h-[2.5px] overflow-hidden"
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full bg-gradient-to-r from-transparent via-[var(--c-blue)] to-[var(--c-purple)] shadow-[0_0_12px_var(--c-blue)]"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
});
