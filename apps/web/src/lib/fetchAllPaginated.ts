import type { Paginated } from '@/lib/types';

export async function fetchAllPaginated<T = unknown>(
  fetchFn: (params: any) => Promise<any>,
  baseParams: Record<string, any> = {},
): Promise<Paginated<T>> {
  const limit = baseParams.limit || 100;
  let page = 1;
  let allItems: T[] = [];
  
  while (true) {
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
