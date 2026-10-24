/**
 * M-EDU App — v20 "Spatial Glass · Apple Studio Pro" (Root Shell & Resilience Layer)
 *
 * 🎯 v18 → v20 World-Class Architectural & Visual Upgrades:
 *  ✅ Smart Chunk-Load / New Deployment Detector — Auto-detects Vite/Webpack dynamic import mismatches and triggers hard cache reload.
 *  ✅ Route-Aware Auto-Recovery — `ErrorBoundaryWrapper` listens to `location.pathname` so Sidebar navigation automatically clears route errors.
 *  ✅ Telemetry Diagnostics Drawer + 1-Click Copy — Expandable stack/code viewer with instant clipboard copy for enterprise support.
 *  ✅ Keyboard Recovery Shortcuts — Press `R` to retry, `H` for Home, or `D` to toggle diagnostics on the error screen.
 *  ✅ Multi-Depth Anatomical Skeleton (`PageFallback`) — Structured inner bone geometry instead of flat empty blocks.
 *  ✅ Root-Safe Localization — Translations work inside `PremiumErrorFallback` with graceful fallback if `I18nProvider` itself crashed.
 */

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  useRef,
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

/* Re-export route guards so existing `from '../App'` imports keep working. */
export { Protected, PublicOnly };

/* ══════════════════════════════════════════════════════════════════════════
 * MOTION TOKENS & PHYSICS (Synchronized with core/tokens & design-tokens.css)
 * ════════════════════════════════════════════════════════════════════════ */

const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 520, damping: 32, mass: 0.7 },
  smooth: { type: 'spring' as const, stiffness: 320, damping: 28, mass: 0.9 },
  soft:   { type: 'spring' as const, stiffness: 220, damping: 26, mass: 1.0 },
} as const;

const EASE_APPLE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.055, delayChildren: 0.03 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.975 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: SPRING.smooth,
  },
};

/* ══════════════════════════════════════════════════════════════════════════
 * SSR-SAFE REDUCED MOTION & SAFE I18N HOOKS
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
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

/**
 * Safe translation hook that never throws even if rendered ABOVE <I18nProvider>
 * (e.g., inside the outermost Root ErrorBoundary fallback).
 */
function useSafeTranslate() {
  const ctx = useSafeI18n();
  return useCallback(
    (key: string, fallback: string) => {
      const val = ctx?.t?.(key);
      return val && val !== key ? val : fallback;
    },
    [ctx],
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * SEMANTIC TONE PALETTES & INTELLIGENT ERROR CLASSIFIER
 * ════════════════════════════════════════════════════════════════════════ */

export type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<
  Tone,
  { fg: string; bg: string; glow: string; border: string; badge: string }
> = {
  blue: {
    fg: 'var(--tone-blue-fg, #007AFF)',
    bg: 'var(--tone-blue-bg, rgba(0,122,255,0.10))',
    glow: 'var(--tone-blue-glow, rgba(0,122,255,0.28))',
    border: 'var(--tone-blue-border, rgba(0,122,255,0.24))',
    badge: 'SYS · UPDATE',
  },
  green: {
    fg: 'var(--tone-green-fg, #34C759)',
    bg: 'var(--tone-green-bg, rgba(52,199,89,0.10))',
    glow: 'var(--tone-green-glow, rgba(52,199,89,0.28))',
    border: 'var(--tone-green-border, rgba(52,199,89,0.24))',
    badge: 'SYS · OK',
  },
  orange: {
    fg: 'var(--tone-orange-fg, #FF9500)',
    bg: 'var(--tone-orange-bg, rgba(255,149,0,0.10))',
    glow: 'var(--tone-orange-glow, rgba(255,149,0,0.28))',
    border: 'var(--tone-orange-border, rgba(255,149,0,0.24))',
    badge: 'NET · WARN',
  },
  red: {
    fg: 'var(--tone-red-fg, #FF3B30)',
    bg: 'var(--tone-red-bg, rgba(255,59,48,0.10))',
    glow: 'var(--tone-red-glow, rgba(255,59,48,0.28))',
    border: 'var(--tone-red-border, rgba(255,59,48,0.24))',
    badge: 'ERR · FAULT',
  },
  purple: {
    fg: 'var(--tone-purple-fg, #AF52DE)',
    bg: 'var(--tone-purple-bg, rgba(175,82,222,0.10))',
    glow: 'var(--tone-purple-glow, rgba(175,82,222,0.28))',
    border: 'var(--tone-purple-border, rgba(175,82,222,0.24))',
    badge: 'AUTH · LOCK',
  },
  slate: {
    fg: 'var(--tone-slate-fg, #8E8E93)',
    bg: 'var(--tone-slate-bg, rgba(142,142,147,0.10))',
    glow: 'var(--tone-slate-glow, rgba(142,142,147,0.28))',
    border: 'var(--tone-slate-border, rgba(142,142,147,0.24))',
    badge: '404 · MISSING',
  },
};

/**
 * Detects when a user's browser fails to load a lazy route chunk after a fresh deployment.
 */
function isChunkLoadError(error: unknown): boolean {
  const msg = ((error as Error)?.message || String(error || '')).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('imported module') ||
    (error as { name?: string })?.name === 'ChunkLoadError'
  );
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
 * ADDITIONAL SYSTEM ICONS
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
  terminal: [
    'M4 17l6-6-6-6',
    'M12 19h8',
  ] as const,
  copy: [
    'M9 9h10v10H9z',
    'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  ] as const,
  check: [
    'M20 6L9 17l-5-5',
  ] as const,
};

/* ══════════════════════════════════════════════════════════════════════════
 * LIQUID GLASS SHIMMER BLOCK (Multi-Depth Specular Skeleton Surface)
 * ════════════════════════════════════════════════════════════════════════ */

const Shimmer = memo(function Shimmer({
  className = '',
  radius = '1.25rem',
  children,
}: {
  className?: string;
  radius?: string;
  children?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden="true"
      style={{ borderRadius: radius }}
      className={[
        'relative overflow-hidden',
        'border border-white/80 dark:border-white/[0.08]',
        'bg-white/60 dark:bg-white/[0.035] backdrop-blur-xl',
        'shadow-[0_1px_0_rgba(255,255,255,0.92)_inset,0_8px_24px_-6px_rgba(15,23,42,0.05)]',
        'dark:shadow-[0_1px_0_rgba(255,255,255,0.07)_inset,0_8px_24px_-6px_rgba(0,0,0,0.4)]',
        className,
      ].join(' ')}
    >
      {/* Base ambient skeleton tint */}
      <div className="pointer-events-none absolute inset-0 bg-[var(--skeleton-bg)] opacity-55" />

      {/* Optional inner anatomical bones */}
      {children && (
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-3.5 sm:p-5">
          {children}
        </div>
      )}

      {/* Optical Specular Wave */}
      {!reduced && (
        <motion.div
          className="pointer-events-none absolute inset-y-0 -left-1/2 z-20 w-1/2 -skew-x-12"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--skeleton-shine, rgba(255,255,255,0.68)) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '350%'] }}
          transition={{ duration: 1.85, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </div>
  );
});

const Bone = ({ className = '' }: { className?: string }) => (
  <div
    className={`rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07] ${className}`}
  />
);

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
      className="page-container space-y-5 select-none"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={resolved}
    >
      {/* 1 · Hero Header Glass Skeleton with Inner Anatomical Bones */}
      <Shimmer className="h-28 w-full sm:h-32" radius="1.75rem">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-slate-900/[0.07] dark:bg-white/[0.08]" />
            <div className="space-y-2.5">
              <Bone className="h-4 w-40 sm:w-56" />
              <Bone className="h-2.5 w-28 sm:w-36 opacity-70" />
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <Bone className="h-9 w-24 rounded-full" />
            <Bone className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Bone className="h-2 w-16" />
          <Bone className="h-2 w-12 opacity-60" />
        </div>
      </Shimmer>

      {/* 2 · KPI Telemetry Row */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-24" radius="1.35rem">
            <div className="flex items-center justify-between">
              <Bone className="h-2.5 w-16" />
              <div className="h-6 w-6 rounded-lg bg-slate-900/[0.06] dark:bg-white/[0.07]" />
            </div>
            <div className="space-y-1.5">
              <Bone className="h-5 w-20" />
              <Bone className="h-2 w-12 opacity-65" />
            </div>
          </Shimmer>
        ))}
      </div>

      {/* 3 · Primary Content Split (Rings/Chart + Table Skeleton) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-72" radius="1.65rem">
          <Bone className="h-3.5 w-28" />
          <div className="my-auto flex items-center justify-center">
            <div className="h-32 w-32 rounded-full border-[10px] border-slate-900/[0.06] dark:border-white/[0.07]" />
          </div>
          <div className="space-y-2">
            <Bone className="h-2.5 w-full" />
            <Bone className="h-2.5 w-4/5 opacity-75" />
          </div>
        </Shimmer>

        <div className="lg:col-span-2">
          <Shimmer className="h-72" radius="1.65rem">
            <div className="flex items-center justify-between">
              <Bone className="h-3.5 w-36" />
              <Bone className="h-7 w-24 rounded-lg" />
            </div>
            <div className="space-y-3 py-2">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-slate-900/[0.06] dark:bg-white/[0.07]" />
                    <div className="space-y-1.5">
                      <Bone className="h-3 w-32 sm:w-48" />
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
 * BRANDED SPLASH — Apple Studio Spatial Boot Screen
 * ════════════════════════════════════════════════════════════════════════ */

export const BrandedSplash = memo(function BrandedSplash({
  label = 'Tizim yuklanmoqda…',
}: {
  label?: string;
}) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className="relative flex min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh items-center justify-center overflow-y-auto bg-[var(--bg-page)] px-4 select-none"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Ambient Chromatic Caustics */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-36 -top-36 h-[480px] w-[480px] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--tone-blue-glow), transparent 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -right-36 h-[480px] w-[480px] rounded-full opacity-45 blur-3xl"
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
          {/* Outer Pulse Ring */}
          {!reduced && (
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3 rounded-full border border-sky-400/30 dark:border-sky-400/20"
              animate={{ scale: [0.94, 1.16, 0.94], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* Rotating Conic Halo */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-full opacity-90 blur-[1px] will-change-transform"
            style={{ background: 'var(--gradient-conic)' }}
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />

          {/* Inner Specular Glass Orb */}
          <motion.div
            initial={reduced ? false : { scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={SPRING.smooth}
            className={[
              'relative flex h-full w-full items-center justify-center rounded-full text-white',
              'ring-2 ring-white/90 dark:ring-[#0B1120]',
            ].join(' ')}
            style={{
              background: 'var(--gradient-hero)',
              boxShadow:
                'var(--shadow-brand-strong), inset 0 2px 1px rgba(255,255,255,0.55)',
            }}
          >
            {/* Top Dome Reflection */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.52)_0%,rgba(255,255,255,0)_55%)]"
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

        {/* ── Typography ── */}
        <motion.div variants={cardVariants} className="text-center">
          <div className="inline-flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              M-EDU
            </h1>
            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">
              Studio
            </span>
          </div>
          <p className="mt-1 text-[12.5px] font-medium tracking-tight text-[var(--text-secondary)]">
            {label}
          </p>
        </motion.div>

        {/* ── Liquid Glass Progress Bar ── */}
        <motion.div
          variants={cardVariants}
          aria-hidden="true"
          className="relative h-1.5 w-48 overflow-hidden rounded-full border border-white/60 bg-white/50 p-[1px] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06]"
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'var(--gradient-hero)',
              boxShadow: '0 0 10px rgba(0, 122, 255, 0.45)',
            }}
            initial={{ width: '0%' }}
            animate={{ width: ['0%', '78%', '94%'] }}
            transition={{
              duration: 3.0,
              ease: EASE_APPLE,
              times: [0, 0.6, 1],
            }}
          />
          {!reduced && (
            <motion.div
              className="pointer-events-none absolute inset-y-0 w-14 -skew-x-12"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
              }}
              animate={{ x: ['-120%', '420%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════════════════════
 * PREMIUM ERROR FALLBACK — Context-Aware Recovery + Telemetry Inspector
 * ════════════════════════════════════════════════════════════════════════ */

export interface PremiumErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
  tone?: Tone;
  error?: unknown;
  /** Set `false` when rendered inside `<main>` so it doesn't break Sidebar/TopBar layout. */
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

  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const chunkMismatch = isChunkLoadError(error);
  const finalTone: Tone = error ? toneForError(error) : tone;
  const c = TONE[finalTone];

  const resolvedTitle = chunkMismatch
    ? tr('error.updateAvailableTitle', 'Tizimning yangi versiyasi mavjud')
    : title || tr('error.unexpectedTitle', 'Kutilmagan xatolik yuz berdi');

  const resolvedMessage = chunkMismatch
    ? tr(
        'error.updateAvailableMessage',
        'Platforma yangilandi. Eng so\'nggi imkoniyatlardan foydalanish uchun sahifani yangilang.',
      )
    : message ||
      tr(
        'error.unexpectedMessage',
        'Sahifani yuklashda muammo yuzaga keldi. Qayta urinib ko\'ring yoki bosh sahifaga qayting.',
      );

  const errorName = (error as Error)?.name || 'RuntimeException';
  const errorText =
    (error as Error)?.message ||
    (typeof error === 'string' ? error : 'Unknown system exception');
  const statusCode = extractErrorStatus(error);

  /* ── Handle Primary Retry (Force Reload if Chunk Mismatch) ── */
  const handlePrimaryAction = useCallback(() => {
    if (chunkMismatch && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    onRetry?.();
  }, [chunkMismatch, onRetry]);

  /* ── Copy Telemetry Payload to Clipboard ── */
  const handleCopyReport = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const payload = [
      `M-EDU Diagnostic Report`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `Code: ${statusCode ?? errorName}`,
      `Message: ${errorText}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Ignore clipboard permission errors */
    }
  }, [statusCode, errorName, errorText]);

  /* ── Keyboard Shortcuts (R = Retry, H = Home) ── */
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if ((e.key === 'r' || e.key === 'R') && (onRetry || chunkMismatch)) {
        e.preventDefault();
        handlePrimaryAction();
      } else if ((e.key === 'h' || e.key === 'H') && onHome) {
        e.preventDefault();
        onHome();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlePrimaryAction, onHome, onRetry, chunkMismatch]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        'relative flex w-full items-center justify-center overflow-y-auto scrollbar-thin px-4 py-8',
        fullScreen
          ? 'min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh bg-[var(--bg-page)]'
          : 'min-h-[68vh]',
      ].join(' ')}
    >
      {/* Subsurface Tone Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[440px] w-[440px] -translate-x-1/2 rounded-full opacity-35 blur-3xl transition-colors duration-500"
        style={{
          background: `radial-gradient(circle, ${c.glow}, transparent 70%)`,
        }}
      />

      <motion.div
        variants={containerVariants}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="relative z-10 w-full max-w-md"
      >
        <motion.div
          variants={cardVariants}
          className={[
            'relative overflow-hidden rounded-2xl sm:rounded-[2rem] p-4.5 sm:p-7 backdrop-blur-2xl',
            'border border-white/85 dark:border-white/[0.12]',
            'bg-white/82 dark:bg-[#0F172A]/85',
            'shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_28px_70px_-16px_rgba(15,23,42,0.18)]',
            'dark:shadow-[0_1px_0_rgba(255,255,255,0.10)_inset,0_28px_70px_-16px_rgba(0,0,0,0.7)]',
          ].join(' ')}
        >
          {/* Top Specular Sheen */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/55 to-transparent dark:from-white/[0.05]"
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Status Telemetry Pill */}
            <span
              className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: c.fg }}
              />
              {statusCode ? `HTTP ${statusCode}` : c.badge}
            </span>

            {/* Emblem Tile */}
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.65), 0 10px 24px -6px ${c.glow}`,
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

            <h1 className="mt-4 text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
              {resolvedTitle}
            </h1>

            <p className="mt-2 max-w-sm text-[13.5px] font-medium leading-relaxed text-[var(--text-secondary)]">
              {resolvedMessage}
            </p>

            {/* Action Cluster */}
            <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
              {(onRetry || chunkMismatch) && (
                <motion.button
                  type="button"
                  onClick={handlePrimaryAction}
                  whileHover={reduced ? undefined : { scale: 1.025 }}
                  whileTap={reduced ? undefined : { scale: 0.965 }}
                  transition={SPRING.snappy}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  style={{
                    background: 'var(--gradient-hero)',
                    boxShadow:
                      'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.45)',
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
                </motion.button>
              )}

              {onHome && (
                <motion.button
                  type="button"
                  onClick={onHome}
                  whileHover={reduced ? undefined : { scale: 1.025 }}
                  whileTap={reduced ? undefined : { scale: 0.965 }}
                  transition={SPRING.snappy}
                  className={[
                    'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-bold',
                    'border border-white/85 bg-white/70 text-[var(--text-primary)] backdrop-blur-md',
                    'shadow-[0_1px_0_#FFF_inset,0_2px_8px_rgba(15,23,42,0.06)]',
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
                </motion.button>
              )}
            </div>

            {/* Expandable Diagnostics Drawer */}
            {Boolean(error) && (
              <div className="mt-5 w-full">
                <button
                  type="button"
                  onClick={() => setShowDetails((prev) => !prev)}
                  aria-expanded={showDetails}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
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
                </button>

                <AnimatePresence initial={false}>
                  {showDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: EASE_APPLE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 rounded-2xl border border-slate-900/10 bg-slate-950/[0.04] p-3 text-left dark:border-white/10 dark:bg-black/30">
                        <div className="flex items-center justify-between gap-2 pb-1.5">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            {errorName}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyReport}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-primary)] shadow-sm transition hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
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
                          </button>
                        </div>
                        <div
                          tabIndex={0}
                          role="region"
                          aria-label="Diagnostic logs"
                          className="max-h-28 overflow-y-auto break-words font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] focus:outline-none"
                        >
                          {errorText}
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

/**
 * Automatically resets the active ErrorBoundary whenever the user navigates
 * to a different route or changes tabs/query parameters.
 */
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

  /**
   * Calls `reset()` BEFORE `navigate('/')` so the boundary clears its error state
   * immediately prior to transitioning to the home route.
   */
  const handleHome = useCallback(
    (reset: () => void) => {
      reset();
      navigate('/', { replace: true });
    },
    [navigate],
  );

  return (
    <ErrorBoundary
      label={label}
      fallback={({ error, reset }) => (
        <>
          <RouteChangeErrorReset
            locationKey={location.key || `${location.pathname}${location.search}${location.hash}`}
            onReset={reset}
          />
          <PremiumErrorFallback
            fullScreen={false}
            title={label ? `${label} yuklanmadi` : 'Sahifani yuklashda xatolik'}
            message={
              (error as Error)?.message ||
              'Ushbu bo\'limni chizishda kutilmagan xatolik yuz berdi.'
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

/**
 * PWA Update Notification Banner — listens for new releases announced by main.tsx
 */
function PwaUpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const tr = useSafeTranslate();

  useEffect(() => {
    const handleUpdate = () => setUpdateAvailable(true);
    window.addEventListener('medu:pwa-update-available', handleUpdate);
    return () => window.removeEventListener('medu:pwa-update-available', handleUpdate);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-sky-400/30 bg-slate-900/95 p-3.5 text-white shadow-2xl backdrop-blur-xl sm:bottom-6"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 animate-pulse" />
        <p className="text-xs font-medium">
          {tr('pwa.updateAvailable', 'Yangi versiya mavjud.')}
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="shrink-0 min-h-[36px] rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-sky-400 active:scale-95"
      >
        {tr('common.updateNow', 'Yangilash')}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ROOT APP SHELL
 * --------------------------------------------------------------------------
 * Provider Hierarchy (outer → inner):
 *   1. ErrorBoundary       — Root crash safety net
 *   2. QueryClientProvider — Data & cache layer
 *   3. BrowserRouter       — DOM history & v7 future flags
 *   4. I18nProvider        — Localization engine
 *   5. ThemeProvider       — Light/Dark/Seasonal substrate
 *   6. IconDefsHost        — Shared SVG metallic/specular gradient definitions
 *   7. RoutedAuthProvider  — Session & RBAC state
 * ════════════════════════════════════════════════════════════════════════ */

function RoutedAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return <AuthProvider navigate={navigate}>{children}</AuthProvider>;
}

export default function App() {
  return (
    <ErrorBoundary
      label="Root"
      fallback={({ error, reset }) => (
        <PremiumErrorFallback
          fullScreen
          title="Dasturni ishga tushirishda xatolik"
          message={
            (error as Error)?.message ||
            'Kritik xatolik tufayli tizimni ishga tushirib bo\'lmadi.'
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
              {/* Global SVG Gradient Definitions for all <PremiumIcon /> instances */}
              <IconDefsHost />

              <RoutedAuthProvider>
                <ScrollToTop />
                <DocumentTitleManager />
                <UserSettingsSync />
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
  );
}