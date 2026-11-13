/**
 * Route Guards — Apple Design Award Edition v2
 *
 * Canonical source for Protected / PublicOnly.
 * App.tsx MUST import from here, not define its own (removes duplication).
 *
 * v2 FIXES (v1 → v2):
 *  1. [P0] Canonical source — resolves duplication with App.tsx
 *  2. [P0] Role[] → readonly Role[] — matches AppRoutes.STAFF_ROLES type
 *  3. [P0] Loading state uses a single, self-contained component
 *         (was: div wrapper + PageFallback mismatch — `labelKey` vs `label`)
 *  4. min-h-screen → min-h-dvh (Safari iOS safe)
 *  5. sanitizeReturnTo(): blocks `/\`, CRLF, protocol-relative, > 512 chars
 *  6. hasAnyRole wrapped in try/catch — auth error ≠ route crash
 *  7. BrandedSplash-consistent loading UX (or shared component via prop)
 *  8. role="status" + aria-live="polite" on loading
 *  9. Reduced-motion aware (static ring fallback)
 * 10. JSDoc on public API
 */

import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/auth/AuthContext';
import { useSafeI18n } from '@/i18n/I18nProvider';
import type { Role } from '@/lib/types';

/* ============================================================================
 * CONSTANTS
 * ========================================================================== */

/** Maximum length of a `returnTo` value we will honor. */
const MAX_RETURN_TO_LENGTH = 512;

/** Paths that should never be returned to after login (prevents redirect loops). */
const AUTH_LOOP_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth',
];

/* ============================================================================
 * RETURN-TO SANITIZATION
 * ========================================================================== */

/**
 * Validate a `returnTo` value from the URL query string.
 *
 * Only accepts internal, single-slash-rooted paths. Rejects:
 *   - protocol-relative URLs         (`//evil.com`)
 *   - backslash trick                (`/\evil.com` → browsers normalize to `//`)
 *   - CRLF injection                 (`\r\n`)
 *   - absolute URLs                  (`https://evil.com`)
 *   - strings starting without `/`   (`javascript:`, `data:`, etc.)
 *   - excessively long strings       (CPU / memory)
 *   - recursive auth loops           (`/login?returnTo=/login`)
 *
 * @returns A safe path starting with `/`, or the fallback.
 */
export function sanitizeReturnTo(
  raw: string | null | undefined,
  fallback: string = '/',
): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (trimmed.length > MAX_RETURN_TO_LENGTH) return fallback;
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('\\')) return fallback; // DEP-03 (CVE-2025-68470 bypass prevention)
  if (/[\r\n]/.test(trimmed)) return fallback;

  // Prevent redirect loops to login/auth pages
  const cleanPath = trimmed.split('?')[0].split('#')[0].toLowerCase();
  if (
    AUTH_LOOP_PATHS.some(
      (authPath) => cleanPath === authPath || cleanPath.startsWith(`${authPath}/`),
    )
  ) {
    return fallback;
  }

  return trimmed;
}

/* ============================================================================
 * SHARED LOADING STATE
 * ----------------------------------------------------------------------------
 * Self-contained — no PageFallback dependency (which had signature mismatch).
 * Uses design tokens; respects reduced motion; safe viewport fallback.
 * ========================================================================== */

function AuthLoading({
  labelKey,
  fallbackLabel,
}: {
  labelKey: string;
  fallbackLabel: string;
}) {
  const { t } = useSafeI18n();

  // Respect reduced motion at the component level
  const reduced =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const label = t(labelKey) || fallbackLabel;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh w-full items-center justify-center overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Ambient background soft glow orb */}
      <div
        className="pointer-events-none absolute h-96 w-96 rounded-full bg-indigo-500/10 blur-[64px] dark:bg-indigo-500/15"
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center gap-4">
        {/* Breathing aura ring */}
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute -inset-2 rounded-[24px] bg-gradient-to-tr from-indigo-500/30 to-purple-500/30 blur-md dark:from-indigo-500/25 dark:to-purple-500/25"
            animate={reduced ? undefined : { scale: [0.95, 1.15, 0.95], opacity: [0.45, 0.85, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            aria-hidden
          />

          {/* Squircle glass badge */}
          <motion.div
            className="relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-[0_12px_28px_-6px_rgba(79,70,229,0.5),inset_0_1px_1px_rgba(255,255,255,0.45)] ring-1 ring-white/20"
            animate={reduced ? undefined : { y: [0, -3, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg className="h-7 w-7 drop-shadow" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M6 24V8.5C6 7.67 6.67 7 7.5 7H9.2C9.8 7 10.35 7.35 10.6 7.9L16 16.8L21.4 7.9C21.65 7.35 22.2 7 22.8 7H24.5C25.33 7 26 7.67 26 8.5V24C26 24.55 25.55 25 25 25H22.8C22.25 25 21.8 24.55 21.8 24V14.5L17.4 21.4C17.1 21.9 16.58 22.2 16 22.2C15.42 22.2 14.9 21.9 14.6 21.4L10.2 14.5V24C10.2 24.55 9.75 25 9.2 25H7C6.45 25 6 24.55 6 24Z"
                fill="currentColor"
              />
            </svg>
          </motion.div>
        </div>

        {/* Brand title + micro tag */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[13px] font-black tracking-[0.24em] text-slate-900 indent-[0.24em] dark:text-white">
            M-EDU
          </span>
          <p className="text-[11px] font-medium tracking-wide text-slate-500 dark:text-slate-400">
            {label}
          </p>
        </div>

        {/* Aurora progress bar capsule */}
        <div className="relative h-1 w-32 overflow-hidden rounded-full bg-slate-200/70 shadow-inner dark:bg-white/10">
          <motion.div
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.7)]"
            animate={reduced ? undefined : { x: ['-100%', '240%'] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: [0.45, 0, 0.25, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ============================================================================
 * PROTECTED
 * ========================================================================== */

/**
 * Route guard for authenticated (and optionally role-gated) routes.
 *
 * Behavior:
 *   - While auth is loading: shows branded loading state.
 *   - Not logged in: redirects to `/login?returnTo=<current>`.
 *   - Logged in but lacking roles: redirects to `/unauthorized`.
 *   - Otherwise: renders children.
 *
 * @param roles - If provided and non-empty, user must have at least one (or all if requireAll=true).
 * @param requireAll - If true, user must have ALL listed roles.
 */
export function Protected({
  children,
  roles,
  requireAll = false,
}: {
  children: ReactNode;
  roles?: readonly Role[];
  requireAll?: boolean;
}) {
  const { user, loading, hasAnyRole, hasAllRoles } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <AuthLoading
        labelKey="auth.verifyingSession"
        fallbackLabel="Verifying session…"
      />
    );
  }

  if (!user) {
    const fullTarget = location.pathname + location.search + location.hash;
    const returnTo = fullTarget !== '/' ? `?returnTo=${encodeURIComponent(fullTarget)}` : '';
    return <Navigate to={`/login${returnTo}`} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/login" replace />;
  }


  if (roles?.length) {
    let allowed = false;
    try {
      allowed =
        requireAll && typeof hasAllRoles === 'function'
          ? hasAllRoles(...roles)
          : hasAnyRole(...roles);
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.error('[Protected] role verification threw:', err);
      }
      allowed = false;
    }
    if (!allowed) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

/* ============================================================================
 * PUBLIC ONLY
 * ========================================================================== */

/**
 * Route guard for unauthenticated-only routes (login, register, etc.).
 *
 * Behavior:
 *   - While auth is loading: shows branded loading state.
 *   - Already logged in: redirects to a sanitized `returnTo` or `/`.
 *   - Otherwise: renders children.
 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <AuthLoading
        labelKey="auth.preparing"
        fallbackLabel="Preparing…"
      />
    );
  }

  if (user) {
    if (user.mustChangePassword) {
      return <>{children}</>;
    }
    const params = new URLSearchParams(location.search);
    const safe = sanitizeReturnTo(params.get('returnTo'), '/');
    return <Navigate to={safe} replace />;
  }

  return <>{children}</>;
}

/* ============================================================================
 * EXPORTS
 * ========================================================================== */

export default Protected;