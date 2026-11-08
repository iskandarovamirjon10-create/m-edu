'use client';

/**
 * ============================================================================
 * M-EDU App — v3.0 (iOS 27 / visionOS "Liquid Glass Root Shell & Resilience Engine")
 * ============================================================================
 *
 * 🎯 v3.0 Architectural, Performance & Spatial UI Upgrades:
 *  ✅ True Async Cache-Flush Chunk Guard + `vite:preloadError` Auto-Healing
 *  ✅ Stabilized Audio Refs — Zero accidental sound replays on state toggles
 *  ✅ Root-Level `<IconDefsHost />` — SVG gradients survive even root-level crashes
 *  ✅ Full Keyboard Recovery Matrix — `R` (Retry), `H` (Home), `D` (Diagnostics),
 *     `C` (Copy report) with dialog/select collision protection
 *  ✅ Dynamic Island PWA Banner — Adaptive dark-glass capsule positioned safely
 *     above mobile bottom navigation docks
 *  ✅ Adaptive Viewport Synchronizer — Passive `--app-vh` & `--app-vw` calibration
 *  ✅ Multi-Depth Specular Skeleton — Staggered shimmer wave physics
 * ============================================================================
 */

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
  type ReactNode,
} from 'react';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { AuthProvider } from '@/auth/AuthContext';
import { I18nProvider, useSafeI18n } from '@/i18n/I18nProvider';
import { ThemeProvider } from '@/hooks/useTheme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UserSettingsSync } from '@/components/UserSettingsSync';
import { ToastHost } from '@/components/ui';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { QuickPaymentModal } from '@/components/QuickPaymentModal';
import { QuickAttendanceModal } from '@/components/QuickAttendanceModal';
import { usePremiumSound } from '@/hooks/usePremiumSound';
import {
  IconDefsHost,
  PremiumIcon,
  StaticIcon,
  I as LayoutIcons,
} from '@/layouts/components/Icons';
import { AppRoutes } from './routes';
import { DocumentTitleManager } from './routes/DocumentTitle';
import { ScrollToTop } from './routes/ScrollToTop';
import { Protected, PublicOnly } from './routes/guards';

/* Re-export route guards for backwards compatibility across feature modules. */
export { Protected, PublicOnly };

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS & iOS 27 APPLE STUDIO PHYSICS
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 540, damping: 34, mass: 0.65 },
  smooth: { type: 'spring' as const, stiffness: 360, damping: 30, mass: 0.82 },
  soft: { type: 'spring' as const, stiffness: 220, damping: 26, mass: 1.0 },
  island: { type: 'spring' as const, stiffness: 440, damping: 32, mass: 0.75 },
  gel: { type: 'spring' as const, stiffness: 740, damping: 25, mass: 0.34 },
} as const;

const EASE_APPLE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.02 },
  },
};

// WebKit-safe card variants (no filter:blur to prevent backdrop-filter drop/flicker)
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.975 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING.smooth,
  },
};

const TopSpecular = memo(function TopSpecular({ inset = 'inset-x-8' }: { inset?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute top-0 z-20 ${inset}`}>
      <div className="h-px bg-gradient-to-r from-transparent via-white/95 to-transparent dark:via-white/35" />
      <div className="h-[0.5px] bg-gradient-to-r from-transparent via-[#38BDF8]/35 to-transparent dark:via-[#38BDF8]/25" />
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ENVIRONMENT, ACCESSIBILITY & SAFE LOCALIZATION HOOKS
 * ════════════════════════════════════════════════════════════════════════ */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return reduced;
}

function useStableSound() {
  const sound = usePremiumSound();
  const ref = useRef(sound);
  useEffect(() => {
    ref.current = sound;
  }, [sound]);
  return ref;
}

function isInteractiveTargetOrModalOpen(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    Boolean(el?.isContentEditable)
  ) {
    return true;
  }
  if (typeof document !== 'undefined') {
    const openDialog = document.querySelector(
      '[role="dialog"][data-state="open"], [role="dialog"]:not([aria-hidden="true"])',
    );
    if (openDialog && !openDialog.contains(el)) {
      return true;
    }
  }
  return false;
}

/**
 * Keeps `--app-vh` and `--app-vw` synchronized with the true visual viewport on mobile browsers,
 * accounting for dynamic toolbars, keyboards, and orientation shifts.
 */
function useViewportCssVar(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId = 0;

    const updateViewport = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
        const vw = (window.visualViewport?.width ?? window.innerWidth) * 0.01;
        const vvHeight = window.visualViewport?.height ?? window.innerHeight;
        document.documentElement.style.setProperty('--app-vh', `${vh}px`);
        document.documentElement.style.setProperty('--app-vw', `${vw}px`);
        document.documentElement.style.setProperty('--visual-viewport-height', `${vvHeight}px`);
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport, { passive: true });
    window.addEventListener('orientationchange', updateViewport, { passive: true });
    window.visualViewport?.addEventListener('resize', updateViewport, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);
}

/**
 * Root-safe translation hook that never throws even if rendered ABOVE <I18nProvider>.
 */
function useSafeTranslate() {
  let ctx: ReturnType<typeof useSafeI18n> | null = null;
  try {
    ctx = useSafeI18n();
  } catch {
    ctx = null;
  }

  return useCallback(
    (key: string, fallback: string) => {
      try {
        const val = ctx?.t?.(key);
        return typeof val === 'string' && val.trim().length > 0 && val !== key
          ? val
          : fallback;
      } catch {
        return fallback;
      }
    },
    [ctx],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SEMANTIC TONE PALETTES & INTELLIGENT ERROR CLASSIFIER
 * ════════════════════════════════════════════════════════════════════════ */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

interface TonePalette {
  fg: string;
  bg: string;
  glow: string;
  border: string;
  badge: string;
  jewelClass: string;
}

const TONE: Record<Tone, TonePalette> = {
  blue: {
    fg: 'var(--tone-blue-fg, #007AFF)',
    bg: 'var(--tone-blue-bg, rgba(0,122,255,0.10))',
    glow: 'var(--tone-blue-glow, rgba(0,122,255,0.30))',
    border: 'var(--tone-blue-border, rgba(0,122,255,0.26))',
    badge: 'SYS · UPDATE',
    jewelClass: 'jewel-blue',
  },
  green: {
    fg: 'var(--tone-green-fg, #34C759)',
    bg: 'var(--tone-green-bg, rgba(52,199,89,0.10))',
    glow: 'var(--tone-green-glow, rgba(52,199,89,0.30))',
    border: 'var(--tone-green-border, rgba(52,199,89,0.26))',
    badge: 'SYS · READY',
    jewelClass: 'jewel-emerald',
  },
  orange: {
    fg: 'var(--tone-orange-fg, #FF9500)',
    bg: 'var(--tone-orange-bg, rgba(255,149,0,0.10))',
    glow: 'var(--tone-orange-glow, rgba(255,149,0,0.30))',
    border: 'var(--tone-orange-border, rgba(255,149,0,0.26))',
    badge: 'NET · WARN',
    jewelClass: 'jewel-amber',
  },
  red: {
    fg: 'var(--tone-red-fg, #FF3B30)',
    bg: 'var(--tone-red-bg, rgba(255,59,48,0.10))',
    glow: 'var(--tone-red-glow, rgba(255,59,48,0.30))',
    border: 'var(--tone-red-border, rgba(255,59,48,0.26))',
    badge: 'ERR · FAULT',
    jewelClass: 'jewel-rose',
  },
  purple: {
    fg: 'var(--tone-purple-fg, #AF52DE)',
    bg: 'var(--tone-purple-bg, rgba(175,82,222,0.10))',
    glow: 'var(--tone-purple-glow, rgba(175,82,222,0.30))',
    border: 'var(--tone-purple-border, rgba(175,82,222,0.26))',
    badge: 'AUTH · LOCK',
    jewelClass: 'jewel-purple',
  },
  slate: {
    fg: 'var(--tone-slate-fg, #8E8E93)',
    bg: 'var(--tone-slate-bg, rgba(142,142,147,0.10))',
    glow: 'var(--tone-slate-glow, rgba(142,142,147,0.30))',
    border: 'var(--tone-slate-border, rgba(142,142,147,0.26))',
    badge: '404 · MISSING',
    jewelClass: 'jewel-slate',
  },
};

const CHUNK_RELOAD_STORAGE_KEY = 'medu:chunk_reload_ts';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

/**
 * Detects Vite/Webpack dynamic import failures after a fresh deployment.
 */
function isChunkLoadError(error: unknown): boolean {
  const msg = ((error as Error)?.message || String(error || '')).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('imported module') ||
    msg.includes('unable to preload css') ||
    (error as { name?: string })?.name === 'ChunkLoadError'
  );
}

/**
 * Awaits cache partition cleanup (bounded by a 600ms safety timeout) before reloading,
 * ensuring the browser never aborts the cache deletion promise mid-flight.
 */
async function flushCachesAndReload(onlyBuildCaches = false): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    if ('caches' in window) {
      const cleanupPromise = caches.keys().then((names) =>
        Promise.allSettled(
          names
            .filter(
              (name) =>
                !onlyBuildCaches ||
                name.includes('vite') ||
                name.includes('workbox') ||
                name.includes('precache'),
            )
            .map((name) => caches.delete(name)),
        ),
      );
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 600));
      await Promise.race([cleanupPromise, timeoutPromise]);
    }
  } catch {
    /* ignore cache deletion errors */
  }
  window.location.reload();
}

/**
 * Attempts a single automatic hard reload if a chunk fails to load,
 * guarded by a 15-second session cooldown to prevent infinite reload loops.
 */
function attemptSafeChunkAutoReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const now = Date.now();
    const lastAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || 0);
    if (now - lastAttempt > CHUNK_RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
      void flushCachesAndReload(true);
      return true;
    }
  } catch {
    /* Ignore storage security restrictions in private browsing */
  }
  return false;
}

/**
 * Synchronizes online network lifecycle with React Query caches & listens for Vite preload mismatches.
 */
function GlobalNetworkSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      void queryClient.invalidateQueries();
      void queryClient.resetQueries({
        predicate: (q) => q.state.status === 'error',
      });
    };

    const handleVitePreloadError = (event: Event) => {
      event.preventDefault();
      attemptSafeChunkAutoReload();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('vite:preloadError', handleVitePreloadError);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('vite:preloadError', handleVitePreloadError);
    };
  }, []);

  return null;
}

function extractErrorStatus(error: unknown): number | undefined {
  return (
    (error as { status?: number } | null)?.status ??
    (error as { response?: { status?: number } } | null)?.response?.status
  );
}

function toneForError(error: unknown): Tone {
  if (isChunkLoadError(error)) return 'blue';

  const status = extractErrorStatus(error);
  if (typeof status === 'number') {
    if (status === 401 || status === 403) return 'purple';
    if (status === 404) return 'slate';
    if (status >= 500) return 'red';
    if (status >= 400) return 'orange';
  }
  if (error instanceof TypeError) return 'orange';
  return 'red';
}

/* ══════════════════════════════════════════════════════════════════════════
 * SYSTEM VECTOR PATHS
 * ════════════════════════════════════════════════════════════════════════ */

const APP_ICONS = {
  sparkles: LayoutIcons.ai,
  alertTriangle: LayoutIcons.earlyWarning,
  home: LayoutIcons.home,
  shield: LayoutIcons.governance,
  refreshCw: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ] as const,
  terminal: ['M4 17l6-6-6-6', 'M12 19h8'] as const,
  copy: [
    'M9 9h10v10H9z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ] as const,
  check: ['M20 6L9 17l-5-5'] as const,
  close: ['M18 6L6 18', 'M6 6l12 12'] as const,
};

/* ══════════════════════════════════════════════════════════════════════════
 * LIQUID GLASS SHIMMER BLOCK (Multi-Depth Specular Skeleton Surface)
 * ════════════════════════════════════════════════════════════════════════ */

const Shimmer = memo(function Shimmer({
  className = '',
  radius = '1.35rem',
  delay = 0,
  children,
}: {
  className?: string;
  radius?: string;
  delay?: number;
  children?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{ borderRadius: radius }}
      className={[
        'relative isolate overflow-hidden',
        'border border-white/85 dark:border-white/[0.09]',
        'bg-white/70 dark:bg-white/[0.035] backdrop-blur-xl',
        'shadow-[0_1.5px_0_rgba(255,255,255,0.95)_inset,0_10px_28px_-8px_rgba(15,23,42,0.05)]',
        'dark:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_10px_28px_-8px_rgba(0,0,0,0.45)]',
        className,
      ].join(' ')}
    >
      <TopSpecular inset="inset-x-6" />

      {/* Base Ambient Tint */}
      <div className="pointer-events-none absolute inset-0 bg-[var(--skeleton-bg)] opacity-50" />

      {/* Inner Anatomical Bones */}
      {children && (
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-4 sm:p-5">
          {children}
        </div>
      )}

      {/* Staggered Optical Specular Wave */}
      {!reduced && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 -left-1/2 z-20 w-1/2 -skew-x-12"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--skeleton-shine, rgba(255,255,255,0.75)) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '350%'] }}
          transition={{
            duration: 1.9,
            delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}
    </div>
  );
});

const Bone = memo(function Bone({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-full bg-slate-900/[0.065] dark:bg-white/[0.075] ${className}`}
    />
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PAGE FALLBACK — Anatomical Liquid Glass Architectural Skeleton
 * ════════════════════════════════════════════════════════════════════════ */

export const PageFallback = memo(function PageFallback({
  label,
  labelKey,
}: {
  label?: string;
  labelKey?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const tr = useSafeTranslate();

  const resolved =
    label ??
    (labelKey
      ? tr(labelKey, 'Sahifa yuklanmoqda…')
      : tr('common.loading', 'Sahifa yuklanmoqda…'));

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: EASE_APPLE }}
      className="page-container select-none space-y-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={resolved}
    >
      {/* 1 · Hero Header Glass Skeleton */}
      <Shimmer className="h-28 w-full sm:h-32" radius="1.75rem" delay={0}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-900/[0.075] shadow-inner dark:bg-white/[0.085]" />
            <div className="space-y-2.5">
              <Bone className="h-4 w-44 sm:w-60" />
              <Bone className="h-2.5 w-28 opacity-70 sm:w-40" />
            </div>
          </div>
          <div className="hidden items-center gap-2.5 sm:flex">
            <Bone className="h-9 w-28 rounded-full" />
            <Bone className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Bone className="h-2 w-20" />
          <Bone className="h-2 w-14 opacity-60" />
        </div>
      </Shimmer>

      {/* 2 · KPI Telemetry Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-24" radius="1.4rem" delay={i * 0.08}>
            <div className="flex items-center justify-between">
              <Bone className="h-2.5 w-16" />
              <div className="h-6 w-6 rounded-lg bg-slate-900/[0.065] dark:bg-white/[0.075]" />
            </div>
            <div className="space-y-1.5">
              <Bone className="h-5 w-20" />
              <Bone className="h-2 w-12 opacity-65" />
            </div>
          </Shimmer>
        ))}
      </div>

      {/* 3 · Primary Content Split (Analytics Ring + Data Table) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-72" radius="1.65rem" delay={0.18}>
          <div className="flex items-center justify-between">
            <Bone className="h-3.5 w-28" />
            <Bone className="h-5 w-12 rounded-md opacity-60" />
          </div>
          <div className="my-auto flex items-center justify-center">
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-[10px] border-slate-900/[0.065] dark:border-white/[0.075]">
              <Bone className="h-3 w-12" />
            </div>
          </div>
          <div className="space-y-2">
            <Bone className="h-2.5 w-full" />
            <Bone className="h-2.5 w-4/5 opacity-75" />
          </div>
        </Shimmer>

        <div className="lg:col-span-2">
          <Shimmer className="h-72" radius="1.65rem" delay={0.26}>
            <div className="flex items-center justify-between">
              <Bone className="h-3.5 w-36" />
              <Bone className="h-7 w-24 rounded-lg" />
            </div>
            <div className="space-y-3 py-2">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-slate-900/[0.065] dark:bg-white/[0.075]" />
                    <div className="space-y-1.5">
                      <Bone className="h-3 w-32 sm:w-52" />
                      <Bone className="h-2 w-20 opacity-60" />
                    </div>
                  </div>
                  <Bone className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </Shimmer>
        </div>
      </div>

      <span className="sr-only">{resolved}</span>
    </motion.div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * BRANDED SPLASH — Apple Vision Pro Spatial Boot Screen
 * ════════════════════════════════════════════════════════════════════════ */

export const BrandedSplash = memo(function BrandedSplash({
  label = 'Tizim yuklanmoqda…',
}: {
  label?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className="relative flex min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh select-none items-center justify-center overflow-hidden bg-[var(--bg-page)] px-4"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Ambient Chromatic Caustics */}
      <div
        aria-hidden="true"
        className="glow-sapphire pointer-events-none absolute -left-36 -top-36 h-[500px] w-[500px] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--tone-blue-glow), transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="glow-purple pointer-events-none absolute -bottom-36 -right-36 h-[500px] w-[500px] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--tone-purple-glow), transparent 70%)',
        }}
      />

      <motion.div
        variants={containerVariants}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* ── 3D Liquid Glass Emblem ── */}
        <motion.div variants={cardVariants} className="relative h-24 w-24">
          {!reduced && (
            <>
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-3 rounded-full border border-sky-400/35 dark:border-sky-400/20"
                animate={{ scale: [0.94, 1.18, 0.94], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-6 rounded-full border border-indigo-400/20 dark:border-indigo-400/10"
                animate={{ scale: [0.9, 1.24, 0.9], opacity: [0.3, 0, 0.3] }}
                transition={{
                  duration: 2.8,
                  delay: 0.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </>
          )}

          {/* Rotating Conic Halo */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-full opacity-90 blur-[1.5px] will-change-transform"
            style={{ background: 'var(--gradient-conic)' }}
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          />

          {/* Inner Specular Glass Orb */}
          <motion.div
            initial={reduced ? false : { scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={SPRING.smooth}
            className="relative flex h-full w-full items-center justify-center rounded-full text-white ring-2 ring-white/90 dark:ring-[#0B1120]"
            style={{
              background: 'var(--gradient-hero)',
              boxShadow:
                'var(--shadow-brand-strong), inset 0 2px 2px rgba(255,255,255,0.65)',
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_55%)]"
            />
            <motion.div
              animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative z-10"
            >
              <PremiumIcon
                paths={APP_ICONS.sparkles}
                size={38}
                isActive
                accent="rainbow"
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* ── Typography with Sparkle & Crystal Badge ── */}
        <motion.div variants={cardVariants} className="text-center">
          <div className="inline-flex items-center gap-2.5">
            <h1 className="font-sans text-3xl font-black tracking-tight text-sparkle">
              M-EDU
            </h1>
            <span className="jewel-pill jewel-blue text-[10px] font-extrabold uppercase tracking-widest shadow-xs">
              Studio v3
            </span>
          </div>
          <p className="mt-2 text-[13px] font-medium tracking-tight text-[var(--text-secondary)]">
            {label}
          </p>
        </motion.div>

        {/* ── Liquid Glass Progress Bar ── */}
        <motion.div
          variants={cardVariants}
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative h-1.5 w-56 overflow-hidden rounded-full border border-white/75 bg-white/50 p-[1px] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]"
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'var(--gradient-hero)',
              boxShadow: '0 0 14px rgba(0, 122, 255, 0.55)',
            }}
            initial={{ width: '0%' }}
            animate={{ width: ['0%', '78%', '95%'] }}
            transition={{
              duration: 2.8,
              ease: EASE_APPLE,
              times: [0, 0.6, 1],
            }}
          />
          {!reduced && (
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-20 -skew-x-12"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
              }}
              animate={{ x: ['-120%', '420%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PREMIUM ERROR FALLBACK — Spatial Glass Recovery + Deep Telemetry Drawer
 * ════════════════════════════════════════════════════════════════════════ */

export interface PremiumErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
  tone?: Tone;
  error?: unknown;
  /** Set `false` when rendered inside `<main>` so Sidebar/TopBar layout stays intact. */
  fullScreen?: boolean;
}

export const PremiumErrorFallback = memo(function PremiumErrorFallback({
  title,
  message,
  onRetry,
  onHome,
  tone = 'red',
  error,
  fullScreen = true,
}: PremiumErrorFallbackProps) {
  const reduced = usePrefersReducedMotion();
  const tr = useSafeTranslate();
  const soundRef = useStableSound();

  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const chunkMismatch = useMemo(() => isChunkLoadError(error), [error]);
  const finalTone: Tone = useMemo(
    () => (error ? toneForError(error) : tone),
    [error, tone],
  );
  const c = TONE[finalTone];

  /* Auto-heal once if this is a fresh deployment chunk mismatch */
  useEffect(() => {
    if (chunkMismatch) {
      attemptSafeChunkAutoReload();
    } else if (error) {
      soundRef.current?.playError?.();
    }
  }, [chunkMismatch, error, soundRef]);

  const resolvedTitle = chunkMismatch
    ? tr('error.updateAvailableTitle', 'Tizimning yangi versiyasi mavjud')
    : title || tr('error.unexpectedTitle', 'Kutilmagan xatolik yuz berdi');

  const resolvedMessage = chunkMismatch
    ? tr(
        'error.updateAvailableMessage',
        'Platforma yangilandi. Eng so‘nggi imkoniyatlardan foydalanish uchun sahifani yangilang.',
      )
    : message ||
      tr(
        'error.unexpectedMessage',
        'Sahifani yuklashda muammo yuzaga keldi. Qayta urinib ko‘ring yoki bosh sahifaga qayting.',
      );

  const errorName = (error as Error)?.name || 'RuntimeException';
  const errorText =
    (error as Error)?.message ||
    (typeof error === 'string' ? error : 'Unknown system exception');
  const errorStack = (error as Error)?.stack;
  const statusCode = extractErrorStatus(error);

  /* ── Primary Retry Handler ── */
  const handlePrimaryAction = useCallback(() => {
    soundRef.current?.playTick?.();
    if (chunkMismatch && typeof window !== 'undefined') {
      void flushCachesAndReload(true);
      return;
    }
    onRetry?.();
  }, [chunkMismatch, onRetry, soundRef]);

  /* ── Rich Telemetry Report Builder & Clipboard Copy ── */
  const handleCopyReport = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const isOnline = typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    const viewport =
      typeof window !== 'undefined'
        ? `${window.innerWidth}x${window.innerHeight}`
        : 'N/A';

    const payload = [
      '=== M-EDU Studio v3 · Diagnostic Telemetry ===',
      `Timestamp : ${new Date().toISOString()}`,
      `URL       : ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `Network   : ${isOnline ? 'Online' : 'Offline'}`,
      `Viewport  : ${viewport}`,
      `Status    : ${statusCode ?? errorName}`,
      `Message   : ${errorText}`,
      errorStack ? `\n--- Stack Trace ---\n${errorStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      soundRef.current?.playSuccess?.();
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      /* Ignore clipboard permission errors */
    }
  }, [statusCode, errorName, errorText, errorStack, soundRef]);

  /* ── Keyboard Recovery Matrix (R = Retry, H = Home, D = Diagnostics, C = Copy) ── */
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (
        isInteractiveTargetOrModalOpen(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'r' && (onRetry || chunkMismatch)) {
        e.preventDefault();
        handlePrimaryAction();
      } else if (key === 'h' && onHome) {
        e.preventDefault();
        soundRef.current?.playTick?.();
        onHome();
      } else if (key === 'd' && Boolean(error)) {
        e.preventDefault();
        soundRef.current?.playPop?.();
        setShowDetails((prev) => !prev);
      } else if (key === 'c' && showDetails && Boolean(error)) {
        e.preventDefault();
        void handleCopyReport();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handlePrimaryAction,
    handleCopyReport,
    onHome,
    onRetry,
    chunkMismatch,
    error,
    showDetails,
    soundRef,
  ]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'relative flex w-full items-center justify-center overflow-y-auto px-4 py-8 scrollbar-thin',
        fullScreen
          ? 'min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh bg-[var(--bg-page)]'
          : 'min-h-[70vh]',
      ].join(' ')}
    >
      {/* Subsurface Chromatic Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full opacity-40 blur-3xl transition-colors duration-500"
        style={{
          background: `radial-gradient(circle, ${c.glow}, transparent 70%)`,
        }}
      />

      <motion.div
        variants={containerVariants}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="relative z-10 w-full max-w-lg"
      >
        <motion.div
          variants={cardVariants}
          className={[
            'vision-card relative isolate overflow-hidden rounded-3xl p-6 backdrop-blur-3xl sm:rounded-[2.25rem] sm:p-8',
            'border border-white/90 dark:border-white/[0.14]',
            'bg-white/85 dark:bg-[#0F172A]/88',
            'shadow-[0_1.5px_0_rgba(255,255,255,0.98)_inset,0_32px_80px_-16px_rgba(15,23,42,0.20)]',
            'dark:shadow-[0_1.5px_0_rgba(255,255,255,0.16)_inset,0_32px_80px_-16px_rgba(0,0,0,0.75)]',
          ].join(' ')}
        >
          <TopSpecular inset="inset-x-10" />

          {/* Top Liquid Specular Highlight */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-white/60 to-transparent dark:from-white/[0.06]"
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Status Telemetry Pill with Faceted Jewel Optics */}
            <span
              className={`jewel-pill ${c.jewelClass} mb-3.5 text-[10.5px] uppercase tracking-widest shadow-xs`}
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ backgroundColor: c.fg }}
              />
              {statusCode ? `HTTP ${statusCode} · ${c.badge}` : c.badge}
            </span>

            {/* 3D Glass Emblem Tile */}
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
                boxShadow: `inset 0 1.5px 1px rgba(255,255,255,0.75), 0 12px 28px -6px ${c.glow}`,
              }}
            >
              <StaticIcon
                paths={
                  chunkMismatch ? APP_ICONS.refreshCw : APP_ICONS.alertTriangle
                }
                size={28}
                strokeWidth={2}
              />
            </div>

            <h1 className="mt-4 text-xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              {resolvedTitle}
            </h1>

            <p className="mt-2 max-w-md text-[13.5px] font-medium leading-relaxed text-[var(--text-secondary)]">
              {resolvedMessage}
            </p>

            {/* Primary & Secondary Action Cluster */}
            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
              {(onRetry || chunkMismatch) && (
                <motion.button
                  type="button"
                  onClick={handlePrimaryAction}
                  whileHover={reduced ? undefined : { scale: 1.02 }}
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  className="btn-glow-primary inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  style={{
                    background: 'var(--gradient-hero)',
                    boxShadow:
                      'var(--shadow-brand), inset 0 1.5px 0 rgba(255,255,255,0.5)',
                  }}
                >
                  <StaticIcon
                    paths={APP_ICONS.refreshCw}
                    size={15}
                    strokeWidth={2.2}
                  />
                  <span>
                    {chunkMismatch
                      ? tr('common.updateNow', 'Sahifani yangilash')
                      : tr('common.retry', 'Qayta urinish')}
                  </span>
                  <kbd className="ml-1 hidden rounded border border-white/30 bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase sm:inline-block">
                    R
                  </kbd>
                </motion.button>
              )}

              {onHome && (
                <motion.button
                  type="button"
                  onClick={() => {
                    soundRef.current?.playTick?.();
                    onHome();
                  }}
                  whileHover={reduced ? undefined : { scale: 1.02 }}
                  whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
                  transition={SPRING.gel}
                  className={[
                    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold',
                    'border border-white/85 bg-white/75 text-[var(--text-primary)] backdrop-blur-md',
                    'shadow-[0_1px_0_#FFF_inset,0_2px_10px_rgba(15,23,42,0.06)]',
                    'hover:bg-white dark:border-white/[0.12] dark:bg-white/[0.07] dark:hover:bg-white/[0.12]',
                    'outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]',
                  ].join(' ')}
                >
                  <StaticIcon
                    paths={APP_ICONS.home}
                    size={15}
                    strokeWidth={2.1}
                  />
                  <span>{tr('common.home', 'Bosh sahifa')}</span>
                  <kbd className="ml-1 hidden rounded border border-slate-400/30 bg-slate-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-[var(--text-tertiary)] sm:inline-block">
                    H
                  </kbd>
                </motion.button>
              )}
            </div>

            {/* Expandable Diagnostics Drawer */}
            {Boolean(error) && (
              <div className="mt-5 w-full">
                <button
                  type="button"
                  onClick={() => {
                    soundRef.current?.playPop?.();
                    setShowDetails((prev) => !prev);
                  }}
                  aria-expanded={showDetails}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-[var(--text-tertiary)] transition-colors hover:bg-slate-500/10 hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                >
                  <StaticIcon
                    paths={APP_ICONS.terminal}
                    size={12}
                    strokeWidth={2}
                  />
                  <span>
                    {showDetails
                      ? tr('error.hideDetails', 'Texnik tafsilotlarni yashirish')
                      : tr('error.showDetails', 'Texnik tafsilotlar')}
                  </span>
                  <kbd className="ml-1 hidden rounded border border-slate-400/25 bg-slate-500/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase sm:inline-block">
                    D
                  </kbd>
                </button>

                <AnimatePresence initial={false}>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.24, ease: EASE_APPLE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2.5 rounded-2xl border border-slate-900/10 bg-slate-950/[0.045] p-3.5 text-left shadow-inner dark:border-white/10 dark:bg-black/40">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-900/10 pb-2 dark:border-white/10">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                              {errorName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyReport}
                            className="inline-flex min-h-[28px] items-center gap-1.5 rounded-lg border border-white/60 bg-white/85 px-2.5 py-1 text-[10.5px] font-semibold text-[var(--text-primary)] shadow-xs transition hover:bg-white active:scale-95 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/20"
                          >
                            <StaticIcon
                              paths={copied ? APP_ICONS.check : APP_ICONS.copy}
                              size={11}
                              strokeWidth={2.2}
                            />
                            <span>
                              {copied
                                ? tr('common.copied', 'Nusxalandi')
                                : tr('common.copy', 'Nusxalash')}
                            </span>
                            <kbd className="hidden font-mono text-[9px] opacity-65 sm:inline">
                              [C]
                            </kbd>
                          </button>
                        </div>

                        <div
                          tabIndex={0}
                          role="region"
                          aria-label="Diagnostic logs"
                          className="mt-2 max-h-36 overflow-y-auto break-words font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] scrollbar-thin focus:outline-none"
                        >
                          <p className="font-semibold text-[var(--text-primary)]">
                            {errorText}
                          </p>
                          {errorStack && (
                            <pre className="mt-2 whitespace-pre-wrap text-[10px] opacity-75">
                              {errorStack}
                            </pre>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Administrator Support Footnote */}
            <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
              <StaticIcon
                paths={APP_ICONS.shield}
                size={12}
                strokeWidth={2}
                className="opacity-75"
              />
              <span>
                {tr(
                  'error.contactAdmin',
                  'Muammo takrorlansa, tizim administratoriga murojaat qiling',
                )}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ERROR BOUNDARY WRAPPER — Route-Aware Auto-Reset + Query Cache Recovery
 * ════════════════════════════════════════════════════════════════════════ */

function RouteChangeErrorReset({
  locationKey,
  onReset,
}: {
  locationKey: string;
  onReset: () => void;
}) {
  const initialKeyRef = useRef(locationKey);

  useEffect(() => {
    if (locationKey !== initialKeyRef.current) {
      onReset();
    }
  }, [locationKey, onReset]);

  return null;
}

export function ErrorBoundaryWrapper({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRetry = useCallback((reset: () => void) => {
    void queryClient.resetQueries({
      predicate: (q) => q.state.status === 'error',
    });
    reset();
  }, []);

  const handleHome = useCallback(
    (reset: () => void) => {
      reset();
      navigate('/', { replace: true });
    },
    [navigate],
  );

  const locationSignature =
    location.key || `${location.pathname}${location.search}${location.hash}`;

  return (
    <ErrorBoundary
      label={label}
      fallback={({ error, reset }) => (
        <>
          <RouteChangeErrorReset
            locationKey={locationSignature}
            onReset={reset}
          />
          <PremiumErrorFallback
            fullScreen={false}
            title={label ? `${label} yuklanmadi` : 'Sahifani yuklashda xatolik'}
            message={
              (error as Error)?.message ||
              'Ushbu bo‘limni chizishda kutilmagan xatolik yuz berdi.'
            }
            onRetry={() => handleRetry(reset)}
            onHome={() => handleHome(reset)}
            error={error}
          />
        </>
      )}
    >
      <Suspense
        fallback={
          <PageFallback
            label={label ? `${label} yuklanmoqda…` : undefined}
          />
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * PWA UPDATE DYNAMIC ISLAND — Spatial Glass Release Notification
 * ════════════════════════════════════════════════════════════════════════ */

const PwaUpdateNotification = memo(function PwaUpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const tr = useSafeTranslate();
  const reduced = usePrefersReducedMotion();
  const soundRef = useStableSound();

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('medu:pwa-update-available', handleUpdate);
    return () =>
      window.removeEventListener('medu:pwa-update-available', handleUpdate);
  }, []);

  const handleApplyUpdate = useCallback(() => {
    if (isUpdating) return;
    setIsUpdating(true);
    soundRef.current?.playTick?.();
    void flushCachesAndReload(false);
  }, [isUpdating, soundRef]);

  useEffect(() => {
    if (!updateAvailable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isInteractiveTargetOrModalOpen(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleApplyUpdate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        soundRef.current?.playTick?.();
        setUpdateAvailable(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateAvailable, handleApplyUpdate, soundRef]);

  return (
    <AnimatePresence>
      {updateAvailable && (
        <motion.div
          key="pwa-dynamic-island"
          role="status"
          aria-live="polite"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
          transition={SPRING.island}
          className={[
            'fixed bottom-[5.5rem] left-4 right-4 z-[85] mx-auto flex max-w-md items-center justify-between gap-3 md:bottom-6',
            'relative isolate overflow-hidden rounded-full border border-white/25 bg-[#0B0F1A]/90 py-2.5 pl-4 pr-2.5 text-white backdrop-blur-3xl backdrop-saturate-[210%]',
            'glow-sapphire shadow-[0_1.5px_0_rgba(255,255,255,0.32)_inset,0_22px_54px_-10px_rgba(0,0,0,0.75)]',
          ].join(' ')}
        >
          <TopSpecular inset="inset-x-8" />

          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/35 bg-sky-500/20 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-sky-300">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
              </span>
              PWA
            </span>
            <p className="truncate text-xs font-semibold tracking-tight text-white/95">
              {tr('pwa.updateAvailable', 'M-EDU Studio yangilanishi tayyor')}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <motion.button
              type="button"
              disabled={isUpdating}
              whileTap={reduced ? undefined : { scaleX: 1.05, scaleY: 0.92 }}
              transition={SPRING.gel}
              onClick={handleApplyUpdate}
              className="btn-glow-primary flex min-h-[32px] items-center gap-1.5 rounded-full bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-3.5 py-1 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition hover:brightness-110 disabled:opacity-50"
            >
              <span>
                {isUpdating
                  ? 'Yangilanmoqda…'
                  : tr('common.updateNow', 'Yangilash')}
              </span>
              <kbd className="hidden rounded bg-black/25 px-1.5 py-0.5 font-mono text-[9px] uppercase opacity-85 sm:inline">
                U
              </kbd>
            </motion.button>
            <button
              type="button"
              onClick={() => {
                soundRef.current?.playTick?.();
                setUpdateAvailable(false);
              }}
              aria-label={tr('common.close', 'Yopish')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <StaticIcon paths={APP_ICONS.close} size={14} strokeWidth={2.2} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * ROOT APP SHELL
 * ════════════════════════════════════════════════════════════════════════ */

function RoutedAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const path = (e as CustomEvent<{ path: string }>)?.detail?.path;
      if (path && typeof path === 'string') {
        navigate(path);
      }
    };
    window.addEventListener('medu:navigate', handleNavigate);
    return () => window.removeEventListener('medu:navigate', handleNavigate);
  }, [navigate]);

  return <AuthProvider navigate={navigate}>{children}</AuthProvider>;
}

export default function App() {
  useViewportCssVar();

  return (
    <>
      {/* Root-level SVG Specular & Metallic Gradient Definitions (Survives Root ErrorBoundary) */}
      <IconDefsHost />

      <ErrorBoundary
        label="Root"
        fallback={({ error, reset }) => (
          <PremiumErrorFallback
            fullScreen
            title="Dasturni ishga tushirishda xatolik"
            message={
              (error as Error)?.message ||
              'Kritik xatolik tufayli tizimni ishga tushirib bo‘lmadi.'
            }
            onRetry={() => {
              queryClient.clear();
              reset();
            }}
            onHome={() => {
              window.location.href = '/';
            }}
            error={error}
          />
        )}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <I18nProvider>
              <ThemeProvider>
                <RoutedAuthProvider>
                  <ScrollToTop />
                  <DocumentTitleManager />
                  <UserSettingsSync />
                  <GlobalNetworkSync />
                  <AppRoutes />
                  <PwaUpdateNotification />
                  <OfflineIndicator />
                  <QuickPaymentModal />
                  <QuickAttendanceModal />
                  <ToastHost />
                </RoutedAuthProvider>
              </ThemeProvider>
            </I18nProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </>
  );
}