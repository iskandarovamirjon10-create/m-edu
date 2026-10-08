/**
 * CSRF policy — which requests are subject to double-submit validation.
 *
 * CSRF protection exists for ONE threat: a browser that authenticates with an
 * ambient cookie (`access_token`) being tricked into sending a state-changing
 * request by a third-party page. It is therefore applied to exactly that
 * class of request and skipped for everything else:
 *
 *   1. Non-mutating methods (GET/HEAD/OPTIONS) — no state change.
 *   2. Machine-to-machine endpoints that authenticate with their OWN secret
 *      and are never cookie-authenticated (e.g. the Telegram webhook, which
 *      verifies `x-telegram-bot-api-secret-token`). These callers cannot read
 *      a browser cookie, so a double-submit requirement would simply break
 *      them (see F-002).
 *   3. Requests that carry an explicit `Authorization` header
 *      (`Bearer …` / `ApiKey …`). Cross-site attackers cannot set custom
 *      headers without a CORS preflight, so these are not CSRF-able.
 *
 * Everything else that mutates state MUST present
 * `X-XSRF-TOKEN === XSRF-TOKEN cookie`.
 */

/** Methods that can change state and are therefore protected. */
export const CSRF_PROTECTED_METHODS: readonly string[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Path prefixes (after the global `/api` prefix is applied, so they are
 * matched against the full request path) that are exempt because they
 * authenticate by their own signature/secret.
 *
 * Overridable at runtime with `CSRF_EXEMPT_PATHS` (comma-separated absolute
 * paths) so operators can register additional machine integrations without a
 * code change. Environment-provided entries are ALWAYS additive.
 */
export const DEFAULT_CSRF_EXEMPT_PATHS: readonly string[] = [
  '/api/webhooks/', // Telegram & future webhook integrations (own secret)
  // Browser error-telemetry sink: machine endpoint, log-only (no state
  // change), body-validated and throttled — CSRF adds nothing here and a
  // crash reporter cannot fetch tokens before posting.
  '/api/client-errors',
];

export function csrfExemptPaths(env: NodeJS.ProcessEnv = process.env): string[] {
  const extra = (env.CSRF_EXEMPT_PATHS ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return [...DEFAULT_CSRF_EXEMPT_PATHS, ...extra];
}

/** True when the path is a machine endpoint that must bypass CSRF. */
export function isCsrfExemptPath(path: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return csrfExemptPaths(env).some((prefix) => path.startsWith(prefix));
}

/** True when the request authenticates with an explicit Authorization header. */
export function hasHeaderAuth(headers: Record<string, unknown>): boolean {
  const raw = headers['authorization'];
  return typeof raw === 'string' && raw.trim().length > 0;
}

export interface CsrfDecisionInput {
  method: string;
  /** Full request path (`req.originalUrl`), including the `/api` prefix. */
  path: string;
  headers: Record<string, unknown>;
  env?: NodeJS.ProcessEnv;
}

/**
 * Whether CSRF double-submit validation must be enforced for this request.
 * Pure function: trivially unit-testable, no request/response coupling.
 */
export function requiresCsrfValidation({ method, path, headers, env }: CsrfDecisionInput): boolean {
  if (!CSRF_PROTECTED_METHODS.includes(method.toUpperCase())) return false;
  if (isCsrfExemptPath(path, env)) return false;
  if (hasHeaderAuth(headers)) return false;
  return true;
}
