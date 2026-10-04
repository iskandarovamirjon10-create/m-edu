import { QueryClient } from '@tanstack/react-query';

/**
 * M-EDU Centralized TanStack Query Client
 * Configured for multi-device synchronization and cache isolation.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient failures only — never 4xx client errors (401/403/404/422).
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          return false;
        }
        return failureCount < 1;
      },
      // Automatically re-fetch stale queries when window or tab regains focus
      // to ensure cross-device updates reflect immediately.
      refetchOnWindowFocus: true,
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Clear all cached queries to prevent cross-account data leakage
 * when logging out or switching accounts.
 */
export function clearSensitiveQueryCache() {
  queryClient.clear();
  queryClient.removeQueries();
}
