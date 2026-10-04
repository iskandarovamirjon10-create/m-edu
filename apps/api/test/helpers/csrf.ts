/**
 * Shared CSRF handshake for the e2e suites.
 *
 * The API applies double-submit-cookie CSRF validation to every state-changing
 * request that authenticates with the ambient `access_token` cookie and does
 * NOT carry an `Authorization` header (see `src/security/csrf.policy.ts`). The
 * real frontend satisfies this by calling `GET /api/csrf-token` before its
 * first mutation; the suites must do the same or every POST/PUT/PATCH/DELETE
 * is rejected with 403 before the handler ever runs.
 *
 * The token is fetched once per process and reused: the middleware only issues
 * a cookie when the request does not already carry one, so re-presenting the
 * same `XSRF-TOKEN` cookie with the matching `X-XSRF-TOKEN` header keeps the
 * comparison deterministic across the whole run.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CsrfCredentials {
  /** Ready to append to a `Cookie` request header. */
  cookie: string;
  /** Value for the `X-XSRF-TOKEN` request header. */
  token: string;
}

let cached: CsrfCredentials | null = null;

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export async function getCsrfCredentials(): Promise<CsrfCredentials> {
  if (cached) return cached;

  const res = await fetch(`${BASE_URL.replace(/\/api$/, '')}/api/csrf-token`, {
    redirect: 'manual',
  });

  const setCookies = res.headers.getSetCookie?.() ?? [];
  let token: string | undefined;
  for (const header of setCookies) {
    const match = header.match(/XSRF-TOKEN=([^;]+)/);
    if (match) {
      token = match[1];
      break;
    }
  }

  if (!token) {
    throw new Error(
      `GET /api/csrf-token did not issue an XSRF-TOKEN cookie (status ${res.status}); ` +
        'the CSRF middleware or the probe route is not running.',
    );
  }

  cached = { cookie: `XSRF-TOKEN=${token}`, token };
  return cached;
}

/**
 * Merge the CSRF cookie/header into an in-flight header bag for mutating
 * requests. Requests that already authenticate with an `Authorization` header
 * are exempt by policy, but sending the token anyway is harmless and keeps
 * every suite on one code path.
 */
export async function applyCsrf(
  method: string,
  headers: Record<string, string>,
): Promise<void> {
  if (!isMutatingMethod(method)) return;
  const csrf = await getCsrfCredentials();
  const existing = headers.Cookie;
  headers.Cookie = existing ? `${existing}; ${csrf.cookie}` : csrf.cookie;
  headers['X-XSRF-TOKEN'] = csrf.token;
}
