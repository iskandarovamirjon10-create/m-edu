import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { usePaginatedQuery } from '../usePaginatedQuery';
import type { Paginated } from '@/lib/types';

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

function paginated<T>(rows: T[], total = rows.length): Paginated<T> {
  return { items: rows, total, page: 1, limit: 20, totalPages: Math.max(1, Math.ceil(total / 20)) };
}

describe('usePaginatedQuery', () => {
  it('fetches the first page with default page size', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([{ id: 1 }, { id: 2 }], 2));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePaginatedQuery(['students'], fetcher), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetcher).toHaveBeenCalledWith({ page: 1, limit: 20, search: '' });
    expect(result.current.data?.items).toHaveLength(2);
  });

  it('uses a custom page size', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([{ id: 1 }], 1));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePaginatedQuery(['x'], fetcher, { pageSize: 50 }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetcher).toHaveBeenCalledWith({ page: 1, limit: 50, search: '' });
  });

  it('refetches when page changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([{ id: 1 }], 1));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePaginatedQuery(['x'], fetcher), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith({ page: 2, limit: 20, search: '' }));
    expect(result.current.page).toBe(2);
  });

  it('refetches when search changes', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([], 0));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePaginatedQuery(['x'], fetcher), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => result.current.setSearch('ali'));
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith({ page: 1, limit: 20, search: 'ali' }));
  });

  it('exposes loading and error states from the underlying query', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePaginatedQuery(['x'], fetcher), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
