/**
 * Small, dependency-free auth helpers shared by the auth services, strategies
 * and controllers.
 *
 * These exist so the same normalization / escaping / error-narrowing rules are
 * applied identically everywhere instead of being re-implemented (and
 * re-subtly-differed) per call site.
 */

/**
 * Canonical e-mail normalization.
 *
 * Must be applied before EVERY `user.email` lookup or write so that
 * "User@Example.com " and "user@example.com" can never become two identities.
 * The DTO layer already applies this on input; the service layer repeats it
 * because controllers are not the only callers (seeds, OAuth callbacks, jobs).
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Narrow a thrown value to a Prisma unique-constraint violation (P2002).
 *
 * Accepts `unknown` so `catch (error: unknown)` stays type-safe without
 * reaching for `any`.
 */
export function isPrismaUniqueError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  return (error as { code?: unknown }).code === 'P2002';
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a dynamic value for interpolation into HTML text or a quoted
 * attribute. Apply it to every value that is not a literal in the template —
 * including environment-derived strings such as the organization name or an
 * absolute URL. Static markup must NOT be passed through it (that would
 * double-escape).
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Absolute frontend origin used to build links that must leave the API
 * (OAuth redirects, password-reset links).
 *
 * `FRONTEND_URL` is canonical. `NEXT_PUBLIC_APP_URL` is tolerated only as a
 * fallback for existing deployments that have not migrated yet — do not
 * introduce a third spelling.
 */
export function resolveFrontendUrl(fallback = 'http://localhost:3000'): string {
  return process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || fallback;
}
