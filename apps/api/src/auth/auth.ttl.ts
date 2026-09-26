/**
 * Canonical authentication lifetime configuration.
 *
 * `JWT_EXPIRES_IN` is parsed in exactly ONE place and every consumer derives
 * its value from that single parse:
 *
 *   - JWT `signOptions.expiresIn`      -> seconds (jsonwebtoken convention)
 *   - `Session.expiresAt` / `ParentSession.expiresAt` -> milliseconds
 *   - `access_token` cookie `maxAge`   -> milliseconds (RFC 6265 convention)
 *
 * Deriving all three from one source guarantees the cookie cannot outlive the
 * JWT and the DB session row cannot outlive either of them. Never hard-code a
 * third independent duration anywhere else.
 */

/** Fallback when `JWT_EXPIRES_IN` is unset or unusable (24 hours). */
export const DEFAULT_AUTH_TTL_MS = 24 * 60 * 60 * 1000;

/** Upper bound — refuse absurd values rather than mint a century-long session. */
export const MAX_AUTH_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const UNIT_MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parse a duration string ("24h", "30m", "900s", "86400000") into milliseconds.
 *
 * A bare number is treated as milliseconds (the historical behaviour of this
 * codebase, and what `ms()` does with a numeric string). Anything else —
 * missing, empty, negative, zero, above the ceiling, or not matching
 * `<digits><unit>` — falls back to `fallbackMs` instead of throwing, so a bad
 * env value can never take authentication down.
 */
export function parseDurationMs(
  raw: string | null | undefined,
  fallbackMs: number = DEFAULT_AUTH_TTL_MS,
): number {
  if (raw === null || raw === undefined) return fallbackMs;
  const trimmed = raw.trim();
  if (!trimmed) return fallbackMs;

  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(trimmed);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = (match[2] || 'ms').toLowerCase();
  const ttl = value * UNIT_MULTIPLIERS[unit];

  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_AUTH_TTL_MS) return fallbackMs;
  return ttl;
}

/**
 * Canonical auth lifetime in milliseconds.
 *
 * Reads `process.env.JWT_EXPIRES_IN` at call time (never at module load) so
 * tests and operators can change it between calls.
 */
export function authTtlMs(raw: string | null | undefined = process.env.JWT_EXPIRES_IN): number {
  return parseDurationMs(raw);
}

/** Same lifetime expressed in seconds — for `signOptions.expiresIn`. */
export function authTtlSeconds(raw: string | null | undefined = process.env.JWT_EXPIRES_IN): number {
  return Math.max(1, Math.floor(authTtlMs(raw) / 1000));
}

/** Same lifetime in milliseconds — for the `access_token` cookie `maxAge`. */
export function authCookieMaxAgeMs(raw: string | null | undefined = process.env.JWT_EXPIRES_IN): number {
  return authTtlMs(raw);
}
