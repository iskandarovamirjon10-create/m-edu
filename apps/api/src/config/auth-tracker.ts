/**
 * Throttler tracker: per-user buckets for authenticated traffic.
 *
 * The ThrottlerGuard is a global APP_GUARD and therefore runs BEFORE the
 * controller-level JwtAuthGuard, so `req.user` is never populated when the
 * tracker runs. Previously this made every authenticated request fall back
 * to the client IP — meaning all tenants behind one NAT shared a single
 * bucket and a single tenant could exhaust it for everyone.
 *
 * This tracker reads the `sub` claim directly from the bearer JWT (no
 * signature verification — the guard chain still verifies the token before
 * the handler runs; the claim is used only to build a stable bucket key).
 * Anonymous traffic (login, register, bootstrap) still uses the IP.
 */
export function authTracker(req: { user?: { sub?: string }; ip?: string; headers?: { authorization?: string } } | null | undefined): string {
  if (req?.user?.sub) return req.user.sub;

  const header: unknown = req?.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return req?.ip ?? 'unknown';
      const json = Buffer.from(payloadPart, 'base64url').toString('utf8');
      const payload = JSON.parse(json) as { sub?: unknown };
      if (typeof payload.sub === 'string' && payload.sub) {
        return `user:${payload.sub}`;
      }
    } catch {
      // Malformed token — the auth guard will reject it anyway; bucket by IP.
    }
  }
  return req?.ip ?? 'unknown';
}
