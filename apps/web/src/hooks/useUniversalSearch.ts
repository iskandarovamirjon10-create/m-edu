import { useState, useCallback, useMemo } from 'react';
import { searchApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/errorMessages';

export interface SearchResultItem {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  href: string;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
  byType: Record<string, number>;
  tookMs: number;
}

export function useUniversalSearch(query: string, types?: string[], limit = 20) {
  const [results, setResults] = useState<SearchResponse>({ query, results: [], total: 0, byType: {}, tookMs: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      // Empty query → reset state without hitting the API
      if (!q) {
        setResults({ query: q, results: [], total: 0, byType: {}, tookMs: 0 });
        return;
      }
      const data = await searchApi.search(q, types, Math.min(limit, 50)) as unknown as SearchResponse;
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e : new Error(getErrorMessage(e)));
    } finally {
      setLoading(false);
    }
  }, [types, limit]);

  return useMemo(() => ({
    results,
    loading,
    error,
    runSearch,
  }), [results, loading, error, runSearch]);
}
