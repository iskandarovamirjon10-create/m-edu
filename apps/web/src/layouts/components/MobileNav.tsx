/**
 * M-EDU Spatial Mobile Navigation System — visionOS 2 & iOS 18 Liquid Glass
 * Features:
 * - Real-time pointer/touch chromatic refraction & specular tracking
 * - Velocity-coupled elastic deformation physics (120Hz ProMotion ready)
 * - Dual-layer sub-pixel specular rims & inner caustic lens dispersion
 * - Synchronized ultra-crisp micro-haptics & acoustic feedback
 * - Interactive Spotlight Command Sheet with morphing quick-scopes
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from 'framer-motion';
import { useI18n } from '@/i18n/I18nProvider';
import { usePrefersReducedMotion, cn } from '@/lib/design';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import { useFocusTrap } from '../core/singletons';
import { GlassSurface } from './GlassSurface';
import { Brand } from './Brand';
import { StaticIcon, Magnetic, I } from './Icons';
import {
  ALL_ITEMS_MAP,
  HIDDEN_FOR_STUDENT,
  NavItems,
  type NavItem,
} from './Sidebar';

const MOBILE_TAB_ROUTES = ['/', '/attendance', '/students', '/face'] as const;

/* ============================================================================
 * 0. APPLE CORE PHYSICS & HAPTIC ENGINE CONSTANTS
 * ========================================================================== */

/** iOS 18 Dynamic Island & VisionOS Spatial Spring Profiles */
const LIQUID_MORPH_SPRING = {
  type: 'spring' as const,
  stiffness: 440,
  damping: 34,
  mass: 0.68,
  restDelta: 0.001,
};

const TACTILE_PRESS_SPRING = {
  type: 'spring' as const,
  stiffness: 620,
  damping: 30,
  mass: 0.45,
};

const SPATIAL_DRAWER_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 36,
  mass: 0.8,
  restDelta: 0.001,
};

const SPOTLIGHT_SPRING = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 34,
  mass: 0.65,
};

/** Subtle Micro-Haptic Feedback Helper (Safe no-op on unsupported devices) */
function triggerHaptic(pattern: number | number[] = 8) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore security/permission blocks on strict browsers
  }
}

/**
 * Custom Hook: Real-Time Optical Specular Tracking (Zero React Re-renders)
 * Tracks touch/pointer across glass surfaces to project a refractive light cone.
 */
function useOpticalRefraction(initialX = 160, initialY = 30) {
  const mouseX = useMotionValue(initialX);
  const mouseY = useMotionValue(initialY);
  const glowOpacity = useSpring(0, { stiffness: 300, damping: 30 });

  const smoothX = useSpring(mouseX, { stiffness: 400, damping: 35, mass: 0.4 });
  const smoothY = useSpring(mouseY, { stiffness: 400, damping: 35, mass: 0.4 });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
      glowOpacity.set(1);
    },
    [mouseX, mouseY, glowOpacity],
  );

  const handlePointerLeave = useCallback(() => {
    glowOpacity.set(0);
  }, [glowOpacity]);

  const specularBackground = useMotionTemplate`radial-gradient(150px circle at ${smoothX}px ${smoothY}px, rgba(0, 122, 255, 0.18), rgba(94, 92, 230, 0.08) 45%, transparent 80%)`;
  const rimHighlight = useMotionTemplate`radial-gradient(90px circle at ${smoothX}px 0px, rgba(255, 255, 255, 0.95), rgba(0, 122, 255, 0.4) 50%, transparent 100%)`;

  return {
    handlePointerMove,
    handlePointerLeave,
    specularBackground,
    rimHighlight,
    glowOpacity,
  };
}

/* ============================================================================
 * 1. MOBILE BOTTOM NAVIGATION (Floating Hyper-Refractive Dock)
 * ========================================================================== */

export function MobileBottomNav({
  role,
  onOpenMore,
}: {
  role: string;
  onOpenMore: () => void;
}) {
  const { t } = useI18n();
  const location = useLocation();
  const normalizedRole = role?.toUpperCase() ?? '';
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();
  const [pressedTab, setPressedTab] = useState<string | null>(null);

  const {
    handlePointerMove,
    handlePointerLeave,
    specularBackground,
    rimHighlight,
    glowOpacity,
  } = useOpticalRefraction(180, 28);

  const tabs = useMemo(
    () =>
      MOBILE_TAB_ROUTES.map((route) => ALL_ITEMS_MAP.get(route))
        .filter((item): item is NavItem => Boolean(item))
        .filter(
          (item) => !(normalizedRole === 'STUDENT' && HIDDEN_FOR_STUDENT.has(item.to)),
        ),
    [normalizedRole],
  );

  // Dynamic ambient ground caustic position based on active tab index
  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex((item) =>
      item.end
        ? location.pathname === item.to
        : location.pathname.startsWith(item.to),
    );
    return idx === -1 ? 0 : idx;
  }, [tabs, location.pathname]);

  return (
    <nav
      aria-label={t('a11y.primaryNav', 'Primary navigation')}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3.5 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))] md:hidden select-none"
    >
      <motion.div
        initial={reduced ? false : { y: 48, opacity: 0, scale: 0.92, filter: 'blur(8px)' }}
        animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={reduced ? { duration: 0.15 } : LIQUID_MORPH_SPRING}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className="pointer-events-auto relative mx-auto max-w-[27rem] will-change-transform"
      >
        {/* Dynamic Shifting Ambient Caustic Ground Reflection */}
        <motion.div
          aria-hidden
          animate={{
            x: `${(activeIndex - (tabs.length - 1) / 2) * 22}%`,
          }}
          transition={LIQUID_MORPH_SPRING}
          className="pointer-events-none absolute -inset-x-2 -bottom-2.5 h-12 rounded-full bg-gradient-to-r from-transparent via-apple-blue/25 to-transparent blur-2xl dark:via-apple-blue/40"
        />

        {/* Secondary Chromatic Dispersion Aura */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 -bottom-1 h-6 rounded-full bg-gradient-to-r from-[#5E5CE6]/0 via-[#5E5CE6]/20 to-[#00C7BE]/0 blur-xl dark:via-[#5E5CE6]/30"
        />

        <GlassSurface
          tone="topbar"
          radius="2.35rem"
          spotlight={true}
          className="relative overflow-hidden border border-black/[0.07] dark:border-white/[0.14] bg-white/[0.78] dark:bg-[#141417]/[0.78] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.18),0_4px_12px_rgba(0,0,0,0.05),inset_0_1.5px_1.5px_rgba(255,255,255,0.98),inset_0_-1px_1.5px_rgba(0,0,0,0.05)] dark:shadow-[0_22px_56px_-10px_rgba(0,0,0,0.82),0_4px_16px_rgba(0,0,0,0.4),inset_0_1.5px_1.5px_rgba(255,255,255,0.22),inset_0_-1px_1px_rgba(0,0,0,0.6)] backdrop-blur-3xl backdrop-saturate-[200%]"
        >
          {/* Interactive Pointer-Tracked Refractive Surface Glow */}
          <motion.div
            aria-hidden
            style={{ background: specularBackground, opacity: glowOpacity }}
            className="pointer-events-none absolute inset-0 z-0 transition-opacity"
          />

          {/* Static Ambient Top Specular Rim */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/45"
          />

          {/* Interactive Pointer-Tracked Top Edge Rim Light */}
          <motion.div
            aria-hidden
            style={{ background: rimHighlight, opacity: glowOpacity }}
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px]"
          />

          {/* Sub-pixel Bottom Chromatic Refraction Line */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-12 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-apple-blue/35 to-transparent dark:via-apple-blue/50"
          />

          <ul className="relative z-10 flex items-stretch justify-between gap-1 p-1.5">
            {tabs.map((item) => {
              const isPressed = pressedTab === item.to;

              return (
                <li key={item.to} className="relative min-w-0 flex-1">
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onPointerDown={() => setPressedTab(item.to)}
                    onPointerUp={() => setPressedTab(null)}
                    onPointerCancel={() => setPressedTab(null)}
                    onClick={() => {
                      triggerHaptic(6);
                      sound.playTick?.();
                    }}
                    className="group relative flex min-h-[3.75rem] w-full flex-col items-center justify-center rounded-[1.85rem] px-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-apple-blue/70"
                  >
                    {({ isActive }) => (
                      <>
                        {/* Morphing Liquid Active Lens Capsule */}
                        {isActive && (
                          <motion.div
                            layoutId="hyper-nav-active-capsule"
                            transition={reduced ? { duration: 0.15 } : LIQUID_MORPH_SPRING}
                            className="absolute inset-0 z-0 overflow-hidden rounded-[1.75rem] border border-black/[0.05] dark:border-white/[0.15] bg-gradient-to-b from-white via-white/90 to-white/75 shadow-[0_6px_20px_-2px_rgba(0,122,255,0.22),0_2px_5px_rgba(0,0,0,0.05),inset_0_2px_2px_rgba(255,255,255,1),inset_0_-1px_1px_rgba(0,122,255,0.08)] dark:from-white/[0.20] dark:via-white/[0.11] dark:to-white/[0.05] dark:shadow-[0_8px_24px_-4px_rgba(10,132,255,0.38),inset_0_1.5px_1.5px_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(10,132,255,0.2)]"
                          >
                            {/* Inner Chromatic Caustic Dome */}
                            <div className="absolute inset-0 bg-[radial-gradient(110%_90%_at_50%_0%,rgba(0,122,255,0.18)_0%,rgba(94,92,230,0.06)_50%,transparent_85%)] dark:bg-[radial-gradient(110%_90%_at_50%_0%,rgba(10,132,255,0.34)_0%,rgba(94,92,230,0.12)_50%,transparent_85%)]" />

                            {/* Subtle Bottom Lens Reflection */}
                            <div className="absolute inset-x-3 bottom-0 h-[1.5px] bg-gradient-to-r from-transparent via-apple-blue/40 to-transparent dark:via-white/30" />
                          </motion.div>
                        )}

                        {/* Top Specular Laser Pill Indicator */}
                        {isActive && (
                          <motion.span
                            layoutId="hyper-nav-top-specular"
                            transition={reduced ? { duration: 0.15 } : LIQUID_MORPH_SPRING}
                            className="absolute top-[3px] z-20 h-[3px] w-6 rounded-full bg-gradient-to-r from-apple-blue via-[#5AC8FA] to-apple-blue shadow-[0_1px_10px_rgba(0,122,255,0.75)] dark:shadow-[0_1px_12px_rgba(90,200,250,0.9)]"
                          />
                        )}

                        {/* Tactile Physics Content Wrapper */}
                        <motion.div
                          animate={{
                            scale: isPressed ? 0.88 : isActive ? 1.02 : 1,
                            y: isActive ? 0.5 : 0,
                          }}
                          transition={TACTILE_PRESS_SPRING}
                          className="relative z-10 flex flex-col items-center justify-center gap-1"
                        >
                          <motion.span
                            animate={{
                              scale: isActive ? 1.1 : 1,
                              y: isActive ? -1 : 0,
                              filter: isActive
                                ? 'drop-shadow(0 4px 10px rgba(0, 122, 255, 0.45))'
                                : 'drop-shadow(0 0px 0px rgba(0, 0, 0, 0))',
                            }}
                            transition={TACTILE_PRESS_SPRING}
                            className={cn(
                              'transition-colors duration-200',
                              isActive
                                ? 'text-apple-blue dark:text-[#409CFF]'
                                : 'text-[#636366] group-hover:text-primary dark:text-[#98989D] dark:group-hover:text-white',
                            )}
                          >
                            <StaticIcon
                              paths={item.iconPath}
                              className="h-[1.35rem] w-[1.35rem]"
                            />
                          </motion.span>

                          <motion.span
                            animate={{
                              opacity: isActive ? 1 : 0.72,
                              scale: isActive ? 1.02 : 0.96,
                            }}
                            transition={TACTILE_PRESS_SPRING}
                            className={cn(
                              'max-w-[4.6rem] truncate text-[10.5px] tracking-[-0.015em] transition-colors duration-200',
                              isActive
                                ? 'font-bold text-apple-blue dark:text-[#409CFF]'
                                : 'font-semibold text-[#636366] dark:text-[#98989D]',
                            )}
                          >
                            {t(item.labelKey) || item.label}
                          </motion.span>
                        </motion.div>
                      </>
                    )}
                  </NavLink>
                </li>
              );
            })}

            {/* Subtle Optical Divider before "More" */}
            <li aria-hidden className="my-2.5 w-[1px] shrink-0 bg-gradient-to-b from-transparent via-black/[0.08] to-transparent dark:via-white/[0.12]" />

            {/* "More" Trigger with Spring Torsion & Liquid Ripple */}
            <li className="relative min-w-0 flex-1">
              <motion.button
                type="button"
                onClick={() => {
                  triggerHaptic([6, 20, 10]);
                  sound.playPop?.();
                  onOpenMore();
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.88 }}
                transition={TACTILE_PRESS_SPRING}
                aria-label={t('a11y.openMenu', 'Open menu')}
                className="group relative flex min-h-[3.75rem] w-full flex-col items-center justify-center gap-1 rounded-[1.85rem] px-1 py-1.5 text-[10.5px] font-semibold tracking-[-0.015em] text-[#636366] outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-apple-blue/70 dark:text-[#98989D] dark:hover:bg-white/[0.07]"
              >
                <span className="transition-transform duration-300 ease-out group-hover:scale-110 group-active:rotate-90">
                  <StaticIcon paths={I.menu} className="h-[1.35rem] w-[1.35rem]" />
                </span>
                <span className="max-w-full truncate opacity-75 transition-opacity group-hover:opacity-100">
                  {t('nav.more', 'More')}
                </span>
              </motion.button>
            </li>
          </ul>
        </GlassSurface>
      </motion.div>
    </nav>
  );
}

/* ============================================================================
 * 2. MOBILE MENU DRAWER (Spatial Floating Glass Slab with Elastic Physics)
 * ========================================================================== */

export function MobileMenuDrawer({
  open,
  onClose,
  role,
  orgName,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  role: string;
  orgName: string;
  onLogout: () => void;
}) {
  const { t } = useI18n();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();

  // Drag-linked motion values for real-time backdrop & elastic stretch
  const dragX = useMotionValue(0);
  const backdropOpacity = useTransform(dragX, [-260, 0], [0, 1]);
  const panelScaleY = useTransform(dragX, [-200, 0, 60], [0.97, 1, 0.99]);
  const pillStretchHeight = useTransform(dragX, [-120, 0, 40], [56, 40, 48]);

  const {
    handlePointerMove,
    handlePointerLeave,
    specularBackground,
    glowOpacity,
  } = useOpticalRefraction(150, 200);

  useEffect(() => {
    if (!open) {
      dragX.set(0);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, dragX]);

  const formattedRole = useMemo(
    () => (role ? role.replace(/_/g, ' ').toLowerCase() : 'member'),
    [role],
  );

  const orgInitials = useMemo(() => {
    if (!orgName) return 'ME';
    return orgName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('');
  }, [orgName]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-menu"
          className="fixed inset-0 z-[60] xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Gesture-Coupled Spatial Frosted Backdrop */}
          <motion.div
            style={{ opacity: backdropOpacity }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/45 backdrop-blur-xl backdrop-saturate-150 dark:bg-black/65"
            onClick={() => {
              triggerHaptic(5);
              onClose();
            }}
            aria-hidden="true"
          />

          {/* Spatial Floating Drawer Slab */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('a11y.mainNav') || 'Navigation menu'}
            style={{ x: dragX, scaleY: panelScaleY }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.42, right: 0.06 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -65 || info.velocity.x < -240) {
                triggerHaptic(10);
                sound.playPop?.();
                onClose();
              }
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            initial={{ x: '-105%', opacity: 0, scale: 0.96 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: '-105%', opacity: 0, scale: 0.97 }}
            transition={reduced ? { duration: 0.18 } : SPATIAL_DRAWER_SPRING}
            className="absolute left-0 top-0 ml-3 mt-3 h-[calc(100dvh-24px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-[min(328px,88vw)] origin-left touch-pan-y will-change-transform"
          >
            <GlassSurface
              tone="sidebar"
              radius="2.6rem"
              spotlight={true}
              className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden border border-black/[0.08] dark:border-white/[0.14] bg-white/[0.84] dark:bg-[#151518]/[0.84] shadow-[28px_0_70px_-14px_rgba(0,0,0,0.28),inset_0_1.5px_2px_rgba(255,255,255,0.95),inset_-1.5px_0_1.5px_rgba(255,255,255,0.7)] backdrop-blur-3xl backdrop-saturate-[200%] dark:shadow-[28px_0_80px_-12px_rgba(0,0,0,0.85),inset_0_1.5px_1.5px_rgba(255,255,255,0.24),inset_-1px_0_1px_rgba(255,255,255,0.12)]"
            >
              {/* Pointer-Tracked Refractive Surface Sheen */}
              <motion.div
                aria-hidden
                style={{ background: specularBackground, opacity: glowOpacity }}
                className="pointer-events-none absolute inset-0 z-0"
              />

              {/* Top-Left Spatial Aurora Orb */}
              <div
                aria-hidden
                className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-apple-blue/20 via-[#5E5CE6]/15 to-transparent blur-3xl dark:from-apple-blue/25 dark:via-[#5E5CE6]/20"
              />

              {/* Dynamic Elastic Edge Grabber Bar */}
              <motion.div
                aria-hidden
                style={{ height: pillStretchHeight }}
                className="pointer-events-none absolute right-2 top-1/2 z-30 w-1 -translate-y-1/2 rounded-full bg-black/15 shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-colors dark:bg-white/25"
              />

              {/* Header */}
              <div className="relative z-10 flex h-[4.25rem] shrink-0 items-center justify-between border-b border-black/[0.06] px-6 dark:border-white/[0.08]">
                <Brand />
                <Magnetic strength={0.35}>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.86 }}
                    transition={TACTILE_PRESS_SPRING}
                    onClick={() => {
                      triggerHaptic(6);
                      sound.playPop?.();
                      onClose();
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/[0.07] bg-black/[0.04] text-[#636366] shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] outline-none transition-colors hover:bg-black/[0.08] focus-visible:ring-2 focus-visible:ring-apple-blue/60 dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-[#98989D] dark:shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.22)] dark:hover:bg-white/[0.16]"
                    aria-label={t('a11y.closeMenu') || 'Close menu'}
                  >
                    <StaticIcon paths={I.close} className="h-4 w-4" />
                  </motion.button>
                </Magnetic>
              </div>

              {/* Spatial Identity Card (VisionOS Persona Pill) */}
              <motion.div
                initial={reduced ? false : { y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...LIQUID_MORPH_SPRING, delay: 0.04 }}
                className="relative z-10 shrink-0 px-4 pt-4 pb-2"
              >
                <div className="group relative flex items-center gap-3.5 overflow-hidden rounded-[1.65rem] border border-black/[0.06] bg-gradient-to-b from-white/75 to-white/45 p-3.5 shadow-[0_8px_24px_-6px_rgba(0,0,0,0.06),inset_0_1.5px_1.5px_rgba(255,255,255,0.95)] dark:border-white/[0.10] dark:from-white/[0.08] dark:to-white/[0.03] dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.18)]">
                  {/* Subtle Top Specular Line inside Identity Card */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-6 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/35"
                  />

                  {/* 3D Frosted Organization Monogram Orb */}
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-gradient-to-br from-apple-blue via-[#3A82F6] to-[#5E5CE6] text-[14px] font-extrabold tracking-tight text-white shadow-[0_6px_16px_rgba(0,122,255,0.35),inset_0_1.5px_1.5px_rgba(255,255,255,0.6)] dark:border-white/25">
                    {orgInitials}
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#34C759] dark:border-[#18181b]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold tracking-tight text-primary">
                      {orgName}
                    </p>
                    <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-apple-blue/15 bg-apple-blue/10 px-2.5 py-0.5 dark:border-apple-blue/30 dark:bg-apple-blue/20">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-apple-blue opacity-75" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-apple-blue dark:bg-[#409CFF]" />
                      </span>
                      <p className="text-[10.5px] font-bold capitalize tracking-wide text-apple-blue dark:text-[#5AC8FA]">
                        {formattedRole}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Scrollable Navigation List with Optical Edge Masking */}
              <div className="relative z-10 flex-1 min-h-0 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent_0%,black_12px,black_calc(100%-12px),transparent_100%)]">
                <NavItems role={role} onNavigate={onClose} isMobile={true} />
              </div>

              {/* Footer / Tactile Crimson Glass Logout Button */}
              <div className="relative z-10 shrink-0 border-t border-black/[0.06] p-4 dark:border-white/[0.08]">
                <motion.button
                  type="button"
                  onClick={() => {
                    triggerHaptic([10, 30, 15]);
                    onLogout();
                  }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.95 }}
                  transition={TACTILE_PRESS_SPRING}
                  className="group relative flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-[1.45rem] border border-apple-red/25 bg-gradient-to-b from-apple-red/[0.14] to-apple-red/[0.08] px-4 py-3.5 text-[14px] font-bold tracking-tight text-apple-red shadow-[0_6px_20px_-4px_rgba(255,59,48,0.18),inset_0_1px_1.5px_rgba(255,255,255,0.65)] outline-none transition-all hover:from-apple-red/[0.20] hover:to-apple-red/[0.12] focus-visible:ring-2 focus-visible:ring-apple-red/60 dark:border-apple-red/35 dark:from-apple-red/[0.22] dark:to-apple-red/[0.12] dark:text-[#FF6961] dark:shadow-[0_6px_24px_-4px_rgba(255,69,58,0.28),inset_0_1px_1px_rgba(255,255,255,0.22)]"
                >
                  <span className="transition-transform duration-200 group-hover:-translate-x-1">
                    <StaticIcon paths={I.logout} />
                  </span>
                  <span>{t('nav.logout')}</span>
                </motion.button>
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ============================================================================
 * 3. MOBILE SEARCH SHEET (iOS 18 Spotlight Liquid Command Capsule)
 * ========================================================================== */

const SPOTLIGHT_QUICK_SCOPES = [
  { id: 'students', labelKey: 'nav.students', fallback: 'Students', prefix: 'student:' },
  { id: 'attendance', labelKey: 'nav.attendance', fallback: 'Attendance', prefix: 'date:' },
  { id: 'face', labelKey: 'nav.faceId', fallback: 'Face ID', prefix: 'bio:' },
] as const;

export function MobileSearchSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (q: string) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activeScope, setActiveScope] = useState<string | null>(null);
  const sound = usePremiumSound();
  const reduced = usePrefersReducedMotion();

  const {
    handlePointerMove,
    handlePointerLeave,
    specularBackground,
    glowOpacity,
  } = useOpticalRefraction(200, 24);

  useFocusTrap(containerRef, open, inputRef);

  useEffect(() => {
    if (!open) {
      setValue('');
      setActiveScope(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q) return;
    triggerHaptic(10);
    sound.playTick?.();
    onSubmit(q);
    onClose();
  }, [value, onSubmit, onClose, sound]);

  const handleScopeSelect = useCallback(
    (scopeId: string, prefix: string) => {
      triggerHaptic(6);
      sound.playTick?.();
      setActiveScope((prev) => {
        const next = prev === scopeId ? null : scopeId;
        if (next) {
          const cleanVal = value.replace(/^(student:|date:|bio:)\s*/i, '');
          setValue(`${prefix} ${cleanVal}`);
        } else {
          setValue((v) => v.replace(/^(student:|date:|bio:)\s*/i, ''));
        }
        return next;
      });
      inputRef.current?.focus();
    },
    [value, sound],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-search"
          className="fixed inset-0 z-[70] flex items-start justify-center px-3.5 pt-[calc(4rem+env(safe-area-inset-top,0px))] xl:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {/* Spatial Frosted Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-xl backdrop-saturate-150 dark:bg-black/65"
            onClick={() => {
              triggerHaptic(5);
              onClose();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            aria-hidden="true"
          />

          {/* Spotlight Command Capsule */}
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.searchPlaceholder') || 'Search'}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            initial={{ y: -28, opacity: 0, scale: 0.94, filter: 'blur(10px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ y: -18, opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
            transition={reduced ? { duration: 0.18 } : SPOTLIGHT_SPRING}
            className="relative w-full max-w-md will-change-transform"
          >
            {/* Dynamic Breathing Chromatic Focus Aura */}
            <motion.div
              aria-hidden
              animate={{
                opacity: isFocused ? 0.85 : 0.35,
                scale: isFocused ? 1.02 : 0.98,
              }}
              transition={LIQUID_MORPH_SPRING}
              className="pointer-events-none absolute -inset-2 rounded-[2.4rem] bg-gradient-to-r from-apple-blue/30 via-[#5E5CE6]/25 to-[#00C7BE]/25 blur-2xl dark:from-apple-blue/40 dark:via-[#5E5CE6]/35 dark:to-[#00C7BE]/30"
            />

            <GlassSurface
              tone="modal"
              radius="2.1rem"
              spotlight={true}
              className="relative overflow-hidden border border-black/[0.08] dark:border-white/[0.15] bg-white/[0.86] dark:bg-[#18181C]/[0.86] shadow-[0_28px_68px_-12px_rgba(0,0,0,0.28),inset_0_1.5px_2px_rgba(255,255,255,0.98)] backdrop-blur-3xl backdrop-saturate-[200%] dark:shadow-[0_28px_72px_-12px_rgba(0,0,0,0.88),inset_0_1.5px_1.5px_rgba(255,255,255,0.26)]"
            >
              {/* Interactive Pointer Specular Overlay */}
              <motion.div
                aria-hidden
                style={{ background: specularBackground, opacity: glowOpacity }}
                className="pointer-events-none absolute inset-0 z-0"
              />

              {/* Top Specular Laser Rim */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/45"
              />

              {/* Primary Search Input Row */}
              <div className="relative z-10 flex items-center gap-3 px-4.5 py-4">
                <motion.span
                  animate={{
                    scale: isFocused || value.length > 0 ? 1.12 : 1,
                    rotate: isFocused ? -6 : 0,
                  }}
                  transition={TACTILE_PRESS_SPRING}
                  className={cn(
                    'transition-colors duration-200',
                    isFocused || value.length > 0
                      ? 'text-apple-blue dark:text-[#409CFF]'
                      : 'text-[#636366] dark:text-[#98989D]',
                  )}
                >
                  <StaticIcon paths={I.search} className="h-5 w-5" />
                </motion.span>

                <input
                  ref={inputRef}
                  value={value}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  placeholder={t('nav.searchPlaceholder') || 'Search…'}
                  className="flex-1 bg-transparent text-[16.5px] font-semibold tracking-[-0.01em] text-primary outline-none placeholder:font-medium placeholder:text-[#636366]/65 dark:placeholder:text-[#98989D]/65"
                  aria-label={t('nav.searchPlaceholder') || 'Search'}
                  type="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />

                <div className="flex items-center gap-2">
                  <AnimatePresence mode="popLayout">
                    {value.trim().length > 0 && (
                      <motion.button
                        key="submit-pill"
                        type="button"
                        initial={{ scale: 0.6, opacity: 0, x: 8 }}
                        animate={{ scale: 1, opacity: 1, x: 0 }}
                        exit={{ scale: 0.6, opacity: 0, x: 8 }}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.9 }}
                        transition={TACTILE_PRESS_SPRING}
                        onClick={submit}
                        className="flex items-center gap-1 rounded-full bg-gradient-to-b from-[#1A8CFF] to-apple-blue px-3.5 py-1.5 text-[12px] font-bold tracking-tight text-white shadow-[0_4px_14px_rgba(0,122,255,0.45),inset_0_1px_1px_rgba(255,255,255,0.6)]"
                      >
                        <span>{t('common.search', 'Go')}</span>
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.86 }}
                    transition={TACTILE_PRESS_SPRING}
                    onClick={() => {
                      triggerHaptic(5);
                      if (value) {
                        setValue('');
                        setActiveScope(null);
                        inputRef.current?.focus();
                      } else {
                        onClose();
                      }
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-black/[0.06] bg-black/[0.05] text-[#636366] shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] transition-colors hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-apple-blue/60 dark:border-white/[0.12] dark:bg-white/[0.10] dark:text-[#98989D] dark:hover:bg-white/[0.18]"
                    aria-label={t('a11y.closeSearch') || 'Close search'}
                  >
                    <StaticIcon paths={I.close} className="h-3.5 w-3.5" />
                  </motion.button>
                </div>
              </div>

              {/* Morphing Quick-Scope Filter Bar (iOS 18 Spotlight Categorizer) */}
              <div className="relative z-10 flex items-center justify-between gap-2 border-t border-black/[0.05] bg-black/[0.02] px-4 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {SPOTLIGHT_QUICK_SCOPES.map((scope) => {
                    const isSelected = activeScope === scope.id;
                    return (
                      <motion.button
                        key={scope.id}
                        type="button"
                        whileTap={{ scale: 0.92 }}
                        transition={TACTILE_PRESS_SPRING}
                        onClick={() => handleScopeSelect(scope.id, scope.prefix)}
                        className={cn(
                          'relative rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-tight transition-colors outline-none',
                          isSelected
                            ? 'text-apple-blue dark:text-[#5AC8FA]'
                            : 'text-[#636366] hover:text-primary dark:text-[#98989D] dark:hover:text-white',
                        )}
                      >
                        {isSelected && (
                          <motion.span
                            layoutId="spotlight-scope-pill"
                            transition={LIQUID_MORPH_SPRING}
                            className="absolute inset-0 -z-10 rounded-full border border-apple-blue/25 bg-apple-blue/12 shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.6)] dark:border-apple-blue/40 dark:bg-apple-blue/20"
                          />
                        )}
                        {t(scope.labelKey, scope.fallback)}
                      </motion.button>
                    );
                  })}
                </div>

                <span className="shrink-0 rounded-md border border-black/[0.06] bg-white/60 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#636366]/80 shadow-xs dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-[#98989D]">
                  ESC
                </span>
              </div>
            </GlassSurface>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}