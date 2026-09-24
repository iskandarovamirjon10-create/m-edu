/**
 * Throttler tracker: per-user buckets for authenticated traffic.
 *
 * The ThrottlerGuard is a global APP_GUARD and therefore runs BEFORE the
 * controller-level JwtAuthGuard, so `req.user` is never populated when the
 * tracker runs. Previously this made every authenticated request fall back
 * to the client IP — meaning all tenants behind one NAT shared a single
 * bucket and a single tenant could exhaust it for everyone.
 *
 * SECURITY: the `sub` claim is only trusted when the Bearer JWT signature
 * is cryptographically verified with the same secret resolution used by
 * JwtStrategy. Unverified/forged tokens fall back to IP so they cannot
 * pick an arbitrary rate-limit bucket. Anonymous traffic still uses IP.
 */
import { verify, type JwtPayload as JwtVerifyPayload } from 'jsonwebtoken';

function resolveJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (secret) {
    if (process.env.NODE_ENV === 'production' && secret.length < 32) {
      return null;
    }
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return 'medu-dev-secret-do-not-use-in-production';
}

function verifiedSubFromBearer(header: unknown): string | null {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const secret = resolveJwtSecret();
  if (!secret) return null;
  try {
    const payload = verify(token, secret) as JwtVerifyPayload & { sub?: unknown };
    if (typeof payload.sub === 'string' && payload.sub) {
      return payload.sub;
    }
    return null;
  } catch {
    // Forged/expired/malformed signature — never trust the claim.
    return null;
  }
}

export function authTracker(req: { user?: { sub?: string }; ip?: string; headers?: { authorization?: string } } | null | undefined): string {
  // req.user is only set after JwtAuthGuard validated the token.
  if (req?.user?.sub) return `user:${req.user.sub}`;

  const sub = verifiedSubFromBearer(req?.headers?.authorization);
  if (sub) return `user:${sub}`;

  return req?.ip ?? 'unknown';
}
