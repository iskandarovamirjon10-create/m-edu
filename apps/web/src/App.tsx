/**
 * M-EDU App — Apple Design Award Edition v3 (PREMIUM + INTEGRATED)
 *
 * v3 FIXES (v2 → v3):
 *  1. [P0] ThemeProvider added — was completely missing (useTheme() threw)
 *  2. [P0] Protected / PublicOnly removed — imported from ./Protected (canonical source)
 *         and re-exported for backward compatibility
 *  3. [P0] PageFallback now supports both `label` and `labelKey` (was label-only)
 *  4. usePrefersReducedMotion — local kept, but marked for extraction to /hooks
 *  5. Imports consolidated at top (was mid-file after containers)
 *  6. Removed unused `useMemo` import
 *  7. Removed dead icon paths (I.lock, I.zap, I.arrowRight)
 *  8. BrandedSplash — exported (reusable for OAuth callback, etc.)
 *  9. Root ErrorBoundary — onHome added (was retry-only)
 * 10. staggerChildren 0.07 → 0.06 (Apple HIG)
 * 11. Provider order documented
 */

import { Suspense, useState, useEffect, type ReactNode } from 'react';
import {
  BrowserRouter, useNavigate,
} from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { motion, type Variants } from 'framer-motion';
import { AuthProvider } from '@/auth/AuthContext';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';
import { ThemeProvider } from '@/hooks/useTheme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UserSettingsSync } from '@/components/UserSettingsSync';
import { ToastHost } from '@/components/ui';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { QuickPaymentModal } from '@/components/QuickPaymentModal';
import { QuickAttendanceModal } from '@/components/QuickAttendanceModal';
import { AppRoutes } from './routes';
import { DocumentTitleManager } from './routes/DocumentTitle';
import { Protected, PublicOnly } from './routes/guards';

/* Re-export route guards so existing `from '../App'` imports keep working. */
export { Protected, PublicOnly };

/* ============================================================================
 * MOTION TOKENS
 * ----------------------------------------------------------------------------
 * NOTE: Should be extracted to /src/motion/tokens.ts once a shared source exists.
 * Kept inline here to avoid breaking changes in this iteration.
 * ========================================================================== */

const SPRING = {
  snappy: { type: 'spring', stiffness: 500, damping: 30, mass: 0.7 },
  smooth: { type: 'spring', stiffness: 340, damping: 30, mass: 0.9 },
  soft:   { type: 'spring', stiffness: 240, damping: 28, mass: 1.0 },
} as const;

const EASE_APPLE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)', scale: 0.98 },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
    transition: SPRING.smooth,
  },
};

/* ============================================================================
 * REDUCED MOTION HOOK
 * ----------------------------------------------------------------------------
 * NOTE: Should be extracted to /src/hooks/usePrefersReducedMotion.ts.
 * ========================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/* ============================================================================
 * TONE PALETTES
 * ========================================================================== */

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';

const TONE: Record<Tone, { fg: string; bg: string; glow: string; border: string }> = {
  blue:   { fg: 'var(--tone-blue-fg)',   bg: 'var(--tone-blue-bg)',   glow: 'var(--tone-blue-glow)',   border: 'var(--tone-blue-border)'   },
  green:  { fg: 'var(--tone-green-fg)',  bg: 'var(--tone-green-bg)',  glow: 'var(--tone-green-glow)',  border: 'var(--tone-green-border)'  },
  orange: { fg: 'var(--tone-orange-fg)', bg: 'var(--tone-orange-bg)', glow: 'var(--tone-orange-glow)', border: 'var(--tone-orange-border)' },
  red:    { fg: 'var(--tone-red-fg)',    bg: 'var(--tone-red-bg)',    glow: 'var(--tone-red-glow)',    border: 'var(--tone-red-border)'    },
  purple: { fg: 'var(--tone-purple-fg)', bg: 'var(--tone-purple-bg)', glow: 'var(--tone-purple-glow)', border: 'var(--tone-purple-border)' },
  slate:  { fg: 'var(--tone-slate-fg)',  bg: 'var(--tone-slate-bg)',  glow: 'var(--tone-slate-glow)',  border: 'var(--tone-slate-border)'  },
};

function toneForError(error: unknown): Tone {
  const status =
    (error as { status?: number } | null)?.status ??
    (error as { response?: { status?: number } } | null)?.response?.status;

  if (typeof status === 'number') {
    if (status === 401 || status === 403) return 'orange';
    if (status === 404) return 'slate';
    if (status >= 500) return 'red';
    if (status >= 400) return 'orange';
  }
  if (error instanceof TypeError) return 'orange';
  return 'red';
}

/* ============================================================================
 * ICONS (SF Symbols proportions)
 * ========================================================================== */

const ICON_STROKE = 1.75;

const I = {
  sparkles: [
    'M12 3.5 13.9 9.1 19.5 11 13.9 12.9 12 18.5 10.1 12.9 4.5 11 10.1 9.1z',
    'M18.5 3.5v3', 'M20 5h-3',
    'M5.5 18v2.5', 'M6.75 19.25h-2.5',
  ],
  alertTriangle: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4', 'M12 17h.01',
  ],
  refreshCw: [
    'M23 4v6h-6',
    'M1 20v-6h6',
    'M3.51 9a9 9 0 0 1 14.85-3.36L23 10',
    'M20.49 15a9 9 0 0 1-14.85 3.36L1 14',
  ],
  home: [
    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M9 22V12h6v10',
  ],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  ],
};

function Icon({
  paths, size = 18, className = '', strokeWidth = ICON_STROKE,
  label, ...rest
}: {
  paths: string[];
  size?: number;
  className?: string;
  strokeWidth?: number;
  label?: string;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}

/* ============================================================================
 * SHIMMER
 * ========================================================================== */

function Shimmer({ className = '', radius = '0.75rem' }: { className?: string; radius?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        borderRadius: radius,
        background: 'var(--bg-subtle, #E5E5EA)',
      }}
      aria-hidden
    >
      {!reduced && (
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, var(--overlay-glass-glow, rgba(255,255,255,0.65)) 50%, transparent 100%)',
          }}
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

/* ============================================================================
 * QUERY CLIENT
 * ========================================================================== */

/* QueryClient lives in `lib/queryClient.ts` — single instance, registered
 * with `purgeSessionCaches()` so logout/account switches wipe the cache. */

/* ============================================================================
 * PAGE FALLBACK — dual label support (label / labelKey)
 * ========================================================================== */

export function PageFallback({
  label,
  labelKey,
}: {
  label?: string;
  labelKey?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { t } = useI18n();

  const resolved =
    label ??
    (labelKey ? (t(labelKey) || 'Loading…') : 'Loading page…');

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: EASE_APPLE }}
      className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6"
      role="status"
      aria-live="polite"
      aria-label={resolved}
    >
      <Shimmer className="h-32 w-full" radius="2rem" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-16" radius="1rem" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Shimmer className="h-72" radius="1.5rem" />
        <div className="lg:col-span-2">
          <Shimmer className="h-72" radius="1.5rem" />
        </div>
      </div>

      <span className="sr-only">{resolved}</span>
    </motion.div>
  );
}

/* ============================================================================
 * BRANDED SPLASH — exported for reuse
 * ========================================================================== */

export function BrandedSplash({ label = 'Loading your session…' }: { label?: string }) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden"
      style={{ background: 'var(--bg-app)' }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--tone-blue-glow), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--tone-purple-glow), transparent 70%)' }}
      />

      <motion.div
        variants={containerVariants}
        initial={reduced ? 'visible' : 'hidden'}
        animate="visible"
        className="relative flex flex-col items-center gap-6"
      >
        <motion.div variants={cardVariants} className="relative" style={{ width: 96, height: 96 }}>
          <motion.div
            className="absolute -inset-1 rounded-full p-[3px]"
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            aria-hidden
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: 'var(--gradient-conic)' }}
            />
          </motion.div>

          <motion.div
            initial={reduced ? false : { scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={SPRING.smooth}
            className="relative flex h-full w-full items-center justify-center rounded-full text-white ring-2 ring-white/70 dark:ring-black/50"
            style={{
              background: 'var(--gradient-hero)',
              boxShadow: 'var(--shadow-brand), inset 0 2px 0 rgba(255,255,255,0.4)',
            }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.45), transparent 55%)',
              }}
            />
            <motion.div
              animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon paths={I.sparkles} size={36} strokeWidth={2} className="relative" />
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div variants={cardVariants} className="text-center">
          <h1
            className="text-2xl font-bold tracking-tighter"
            style={{ color: 'var(--text-primary)' }}
          >
            M-EDU
          </h1>
          <p
            className="mt-1 text-[12px] font-medium tracking-tight"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {label}
          </p>
        </motion.div>

        <motion.div
          variants={cardVariants}
          className="relative h-1 w-44 overflow-hidden rounded-full"
          style={{ background: 'var(--border-subtle)' }}
          aria-hidden
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: 'var(--gradient-hero)' }}
            initial={{ width: '0%' }}
            animate={{ width: ['0%', '80%', '95%'] }}
            transition={{ duration: 3.2, ease: EASE_APPLE, times: [0, 0.6, 1] }}
          />
          {!reduced && (
            <motion.div
              className="absolute inset-y-0 w-12"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
              }}
              animate={{ x: ['-100%', '400%'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            />
          )}
        </motion.div>

        <motion.div variants={cardVariants} className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--primary)' }}
              animate={reduced ? undefined : { opacity: [0.25, 1, 0.25], scale: [0.9, 1.1, 0.9] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.16, ease: 'easeInOut' }}
            />
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ============================================================================
 * PREMIUM ERROR FALLBACK
 * ========================================================================== */

export function PremiumErrorFallback({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. You can try again or return home.',
  onRetry,
  onHome,
  tone = 'red',
  error,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
  tone?: Tone;
  error?: unknown;
}) {
  const finalTone: Tone = error ? toneForError(error) : tone;
  const c = TONE[finalTone];

  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4"
      style={{ background: 'var(--bg-app)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: `radial-gradient(circle, ${c.glow}, transparent 70%)` }}
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative w-full max-w-md"
      >
        <motion.div
          variants={cardVariants}
          className="overflow-hidden rounded-3xl border p-6 backdrop-blur-xl"
          style={{
            borderColor: 'var(--border)',
            background: 'var(--glass-bg-strong, var(--bg-elevated))',
            boxShadow: 'var(--shadow-glass, 0 12px 40px -12px rgba(0,0,0,0.15))',
          }}
        >
          <div className="flex flex-col items-center text-center">
            <div
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl"
              style={{
                background: c.bg,
                color: c.fg,
                border: `1px solid ${c.border}`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 24px -8px ${c.glow}`,
              }}
            >
              <Icon paths={I.alertTriangle} size={28} strokeWidth={2} />
            </div>

            <h1
              className="mt-4 text-2xl font-bold tracking-tighter"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h1>
            <p
              className="mt-2 max-w-sm text-[13.5px] font-medium leading-relaxed"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {message}
            </p>

            <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              {onRetry && (
                <motion.button
                  type="button"
                  onClick={onRetry}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING.snappy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  style={{
                    background: 'var(--gradient-hero)',
                    boxShadow: 'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.3)',
                  }}
                >
                  <Icon paths={I.refreshCw} size={14} strokeWidth={2.4} />
                  Try again
                </motion.button>
              )}
              {onHome && (
                <motion.button
                  type="button"
                  onClick={onHome}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING.snappy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--overlay-hover)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Icon paths={I.home} size={14} strokeWidth={2.4} />
                  Go home
                </motion.button>
              )}
            </div>

            <div
              className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-medium"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <Icon paths={I.shield} size={11} strokeWidth={2.2} className="opacity-70" />
              If this keeps happening, contact your administrator
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ============================================================================
 * ERROR BOUNDARY WRAPPER
 * ========================================================================== */

export function ErrorBoundaryWrapper({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  const navigate = useNavigate();

  return (
    <ErrorBoundary
      label={label}
      fallback={({ error, reset }) => (
        <PremiumErrorFallback
          title={label ? `${label} failed to load` : 'Something went wrong'}
          message={
            (error as Error)?.message ||
            'An unexpected error occurred while rendering this page.'
          }
          onRetry={reset}
          onHome={() => navigate('/', { replace: true })}
          error={error}
        />
      )}
    >
      <Suspense fallback={<PageFallback label={`Loading ${label ?? 'page'}…`} />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/* ============================================================================
 * ROOT APP
 * ----------------------------------------------------------------------------
 * Provider order (outer → inner):
 *   ErrorBoundary       — last-resort catch-all
 *   QueryClientProvider — data layer (no DOM deps)
 *   BrowserRouter       — routing (needs DOM history)
 *   I18nProvider        — translations (used by ThemeProvider error paths)
 *   ThemeProvider       — theme (DOM class/attr; no deps)
 *   AuthProvider        — auth (needs localStorage, router context)
 *   DocumentTitleManager — needs router
 *   UserSettingsSync     — needs auth
 *   AppRoutes            — needs everything above
 *   ToastHost            — needs router
 * ========================================================================== */

export default function App() {
  return (
    <ErrorBoundary
      label="Root"
      fallback={({ error, reset }) => (
        <PremiumErrorFallback
          title="App failed to start"
          message={
            (error as Error)?.message ||
            'A critical error prevented the application from starting.'
          }
          onRetry={reset}
          onHome={() => { window.location.href = '/'; }}
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
              <AuthProvider>
                <DocumentTitleManager />
                <UserSettingsSync />
                <AppRoutes />
                <OfflineIndicator />
                <QuickPaymentModal />
                <QuickAttendanceModal />
                <ToastHost />
              </AuthProvider>
            </ThemeProvider>
          </I18nProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
