import { useQuery } from '@tanstack/react-query';
import type { Paginated } from '@/lib/types';

/**
 * Fetch all pages of a paginated API endpoint asynchronously and merge them.
 * This resolves the UI truncation issue for dropdowns that previously used a hardcoded limit of 100.
 */
export function useAllPaginatedItems<T>(
  queryKey: unknown[],
  fetchFn: (params: { page: number; limit: number; [key: string]: any }) => Promise<Paginated<T>>,
  baseParams: Record<string, any> = {},
) {
  return useQuery({
    queryKey: [...queryKey, 'all-paginated', baseParams],
    queryFn: async () => {
      const limit = baseParams.limit || 100;
      // Hard safety cap: an API that never reports totalPages (or returns a
      // huge total) would otherwise loop forever and hang the UI. 100 pages
      // × 100 rows = 10,000 items, which is enough for every dropdown in the
      // product while still bounding worst-case runtime.
      const MAX_PAGES = 100;
      let page = 1;
      let allItems: T[] = [];

      while (page <= MAX_PAGES) {
        const response = await fetchFn({ ...baseParams, page, limit });
        allItems = allItems.concat(response.items);

        if (page >= response.totalPages || response.items.length < limit) {
          break;
        }
        page++;
      }
      
      return {
        items: allItems,
        total: allItems.length,
        page: 1,
        limit: allItems.length,
        totalPages: 1,
      } as Paginated<T>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
