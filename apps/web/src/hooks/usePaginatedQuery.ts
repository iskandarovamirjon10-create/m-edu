import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Paginated } from '@/lib/types';

export function usePaginatedQuery<T>(
  key: unknown[],
  fetcher: (params: { page: number; limit: number; search?: string }) => Promise<Paginated<T>>,
  options?: { pageSize?: number },
) {
  const pageSize = options?.pageSize ?? 20;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const params = useMemo(() => ({ page, limit: pageSize, search }), [page, pageSize, search]);

  const query = useQuery<Paginated<T>>({
    queryKey: [...key, params],
    queryFn: () => fetcher(params),
  });

  return {
    ...query,
    page,
    setPage,
    search,
    setSearch,
    pageSize,
  };
}
