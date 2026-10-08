/**
 * Session cleanup — hard boundary between two accounts on one browser.
 *
 * When a session ends (logout, remote revocation, 401), every cache that could
 * still hold the previous account's data must be wiped BEFORE the next user
 * authenticates:
 *
 *  1. TanStack Query cache  — in-memory, but survives a client-side
 *     account switch inside the same SPA lifetime.
 *  2. Service Worker Cache Storage — persists across page loads and is
 *     JavaScript-readable (`caches.match`), so stale authenticated API
 *     responses would otherwise survive logout and could be replayed to a
 *     different user (see sw.js: API responses are no longer cached there,
 *     but buckets written by older SW versions must still be purged).
 *
 * Both steps are best-effort: `caches` is unavailable in insecure contexts,
 * and private-mode browsers may throw on any storage access — a failed purge
 * must never break logout itself.
 */

let queryCachePurge: (() => void) | null = null;

/**
 * Register the query-cache purge. Called once from `lib/queryClient.ts` to
 * avoid a circular import between the API client and the query client.
 */
export function registerQueryCachePurge(purge: () => void): void {
  queryCachePurge = purge;
}

/** Names of Cache Storage buckets the app's service worker writes to. */
const SW_CACHE_NAMES = ['medu-v1', 'medu-static-v1'];

/** Delete every Cache Storage bucket the app may have filled (best-effort). */
async function purgeServiceWorkerCaches(): Promise<void> {
  if (typeof caches === 'undefined') return; // insecure context / unsupported
  const keys = await caches.keys().catch(() => []);
  await Promise.all(
    keys
      .filter((key) => SW_CACHE_NAMES.includes(key))
      .map((key) => caches.delete(key).catch(() => undefined)),
  );
}

/**
 * Wipe all session-scoped storage. Fire-and-forget safe: call it during
 * logout; it never throws.
 */
export function purgeSessionCaches(): void {
  try {
    queryCachePurge?.();
  } catch {
    /* query client unavailable — nothing else to do */
  }
  void purgeServiceWorkerCaches().catch(() => undefined);
}
