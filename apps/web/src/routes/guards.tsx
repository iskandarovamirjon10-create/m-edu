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
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-screen min-h-[calc(var(--app-vh,1vh)*100)] min-h-dvh w-full items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-4">
        <motion.span
          className="h-8 w-8 rounded-full border-[3px] border-[var(--border-medium)] border-t-[var(--primary)]"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          aria-hidden
        />
        <p className="text-[var(--text-sm)] font-medium text-[var(--text-tertiary)]">
          {label}
        </p>
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

  if (roles?.length) {
    let allowed = false;
    try {
      allowed =
        requireAll && typeof hasAllRoles === 'function'
          ? hasAllRoles(...roles)
          : hasAnyRole(...roles);
    } catch (err) {
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
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