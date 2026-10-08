import { QueryClient } from '@tanstack/react-query';
import { registerQueryCachePurge } from './sessionCleanup';

/**
 * M-EDU Centralized TanStack Query Client — the ONLY QueryClient instance.
 *
 * Previously three competing instances existed (this file, an inline one in
 * App.tsx and a dead copy in providers/queryClient.ts). Everything now mounts
 * this one so cache policy and account-switch purging have a single source
 * of truth.
 *
 * Configuration mirrors the previously-active App.tsx client:
 *  - `retry` — transient failures only; never 4xx client errors
 *    (401/403/404/422), except 408 (timeout) and 429 (rate limit) which the
 *    API layer surfaces as retryable conditions.
 *  - `refetchOnWindowFocus: false` — intentional: the device-sync socket and
 *    explicit invalidations keep data fresh without a refetch burst on every
 *    tab focus.
 *  - `gcTime` 5 minutes — in-memory only; nothing is persisted to storage.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 5 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Clear all cached queries to prevent cross-account data leakage
 * when logging out or switching accounts.
 *
 * Wired into the auth lifecycle via `purgeSessionCaches()` — do not call this
 * directly from components; logout paths own the cache boundary.
 */
export function clearSensitiveQueryCache() {
  queryClient.clear();
  queryClient.removeQueries();
}

registerQueryCachePurge(clearSensitiveQueryCache);
