/**
 * OAuth state session (express-session + PostgreSQL store).
 *
 * Passport's Google strategy uses OAuth `state` for CSRF protection. With
 * `state: true` passport stores the generated state in `req.session`, which
 * requires session middleware — without it passport fails with
 * "OAuth 2.0 authentication requires session support".
 *
 * Architecture (aligned with M-EDU's existing auth):
 *  - Sessions are stored in PostgreSQL (the same database the platform
 *    already uses) via connect-pg-simple — durable across API restarts and
 *    multi-instance safe, unlike MemoryStore.
 *  - The session is TINY and short-lived (10 min, matching the state TTL):
 *    it holds ONLY the OAuth state nonce. No JWTs, no user data, no
 *    credentials.
 *  - Cookie is httpOnly + SameSite=Lax (top-level GET navigations like the
 *    Google redirect work; cross-site POSTs do not carry it) and Secure in
 *    production.
 *  - OAUTH_SESSION_SECRET comes from the environment — never hardcoded,
 *    never committed. Production fails fast without it.
 */

import { randomBytes } from 'crypto';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

export const OAUTH_SESSION_COOKIE = 'medu.oauth';
export const OAUTH_SESSION_TTL_MS = 10 * 60 * 1000; // 10 min — matches state TTL

/**
 * Resolve the session-signing secret.
 *  - production: REQUIRED, >= 32 chars (fail fast).
 *  - development: required when Google OAuth is configured; otherwise an
 *    ephemeral per-process secret is used (no persistence needed).
 */
export function resolveOAuthSessionSecret(
  env: NodeJS.ProcessEnv = process.env,
  nodeEnv = env.NODE_ENV || 'development',
): string {
  const secret = env.OAUTH_SESSION_SECRET || '';
  const googleConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  if (secret.length >= 32) return secret;

  if (nodeEnv === 'production' || googleConfigured) {
    throw new Error(
      'OAUTH_SESSION_SECRET must be set (at least 32 characters) when Google OAuth is configured or in production.',
    );
  }
  // Development without Google OAuth: ephemeral per-process secret.
  return randomBytes(32).toString('hex');
}

/**
 * Build the express-session options for the OAuth state flow. Exported for
 * deterministic unit testing of the cookie/security parameters.
 */
export function buildOAuthSessionOptions(env: NodeJS.ProcessEnv = process.env) {
  const ConnectPgSimple = connectPgSimple(session);
  const isProd = (env.NODE_ENV || 'development') === 'production';

  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to initialize the OAuth session store (connect-pg-simple backed).');
  }

  const store = new ConnectPgSimple({
    conString: env.DATABASE_URL,
    tableName: 'oauth_session',
    createTableIfMissing: true,
    pruneSessionInterval: 5 * 60, // prune expired rows every 5 minutes
  });

  // A pg Pool emits 'error' when an idle client hits a connection-level
  // failure; with no listener Node throws and CRASHES the whole API process
  // (verified: stopping Postgres mid-request killed the server). Attach a
  // no-throw listener so a DB hiccup degrades OAuth-session persistence
  // instead of taking down the platform.
  const sessionLogger = { error: (msg: string) => process.stderr.write(`[oauth-session] ${msg}\n`) };
  store.on('error', (err: Error) => {
    sessionLogger.error(
      `PostgreSQL store error (OAuth state sessions may fail until the database recovers): ${err.message}`,
    );
  });

  return {
    name: OAUTH_SESSION_COOKIE,
    secret: resolveOAuthSessionSecret(env),
    store,
    resave: false,
    saveUninitialized: false,
    rolling: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: isProd,
      maxAge: OAUTH_SESSION_TTL_MS,
    },
  };
}

/** Build the express-session middleware for the OAuth state flow. */
export function createOAuthSessionMiddleware() {
  // Defensive: when DATABASE_URL is unavailable (dev/test without DB,
  // migration environments, etc.), fall back to MemoryStore instead of
  // crashing. The OAuth state flow is still protected by passport's
  // state:true (CSRF nonce in session), and MemoryStore is sufficient for
  // single-instance development. Production must always have DATABASE_URL.
  try {
    const opts = buildOAuthSessionOptions();
    return session(opts);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === 'production') {
      // Fail fast in production — session persistence is a security boundary.
      throw new Error(`OAuth session store failed in production: ${msg}`);
    }
    // Development / test fallback — memory-backed session (per-process).
    // The state nonce is still generated and verified by passport.
    process.stderr.write(
      `[oauth-session] DB unavailable (${msg}), using MemoryStore fallback for Google OAuth. Set DATABASE_URL for persistent sessions.\n`,
    );
    return session({
      name: OAUTH_SESSION_COOKIE,
      secret: resolveOAuthSessionSecret(),
      resave: false,
      saveUninitialized: false,
      rolling: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure: false,
        maxAge: OAUTH_SESSION_TTL_MS,
      },
    });
  }
}
