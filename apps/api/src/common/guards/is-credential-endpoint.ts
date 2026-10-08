import type { ExecutionContext } from '@nestjs/common';

/**
 * Endpoints whose only defence against credential stuffing / token guessing
 * is the rate limiter (they have no session, no CAPTCHA and no lockout).
 *
 * Keyed by controller class name + handler name — the exact pair
 * `@nestjs/throttler` itself uses to build its storage key, so this list can
 * never drift from what the guard actually limits.
 */
const CREDENTIAL_ENDPOINTS: Readonly<Record<string, ReadonlySet<string>>> = {
  AuthController: new Set([
    // Password authentication
    'login',
    'parentLogin',
    // First-platform-owner minting
    'bootstrap',
    // Account creation / invitation redemption
    'register',
    'acceptInvitation',
    'exchangeAuthCode',
    // OAuth hand-off (state/code exchange)
    'googleAuth',
    'googleAuthCallback',
    // Password recovery — a guessing window on a single token
    'forgotPassword',
    'resetPassword',
  ]),
};

/**
 * True when `context` routes to a credential endpoint.
 *
 * Fails OPEN on any introspection error: the `default` throttler still runs
 * for every route, so a predicate bug can only relax the extra backstop, never
 * remove rate limiting entirely.
 */
export function isCredentialEndpoint(context: ExecutionContext): boolean {
  try {
    const handlers = CREDENTIAL_ENDPOINTS[context.getClass()?.name];
    if (!handlers) return false;
    return handlers.has(context.getHandler()?.name);
  } catch {
    return false;
  }
}
