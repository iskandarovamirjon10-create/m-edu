import type { Paginated } from '@/lib/types';

export async function fetchAllPaginated<T = unknown>(
  fetchFn: (params: Record<string, unknown>) => Promise<unknown>,
  baseParams: Record<string, unknown> = {},
): Promise<Paginated<T>> {
  const limit = typeof baseParams.limit === 'number' ? baseParams.limit : 100;
  let page = 1;
  let allItems: T[] = [];
  const MAX_PAGES = 100; // safety valve against a misbehaving paginated API
  
  while (page <= MAX_PAGES) {
    const response = (await fetchFn({ ...baseParams, page, limit })) as Paginated<T>;
    const items = response?.items || [];
    allItems = allItems.concat(items);
    
    if (page >= (response?.totalPages ?? 1) || items.length < limit) {
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
  };
}
