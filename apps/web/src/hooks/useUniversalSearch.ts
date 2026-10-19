import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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

const EMPTY: SearchResponse = { query: '', results: [], total: 0, byType: {}, tookMs: 0 };

export function useUniversalSearch(query: string, typeFilter?: string, limit = 20) {
  const [results, setResults] = useState<SearchResponse>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Derive a stable `types` reference so the query effect below does not
  // re-run on every render when the caller passes an inline array.
  const types = useMemo(() => (typeFilter ? [typeFilter] : []), [typeFilter]);

  // Monotonic sequence + unmount flag so a slow older response can never
  // overwrite a newer keystroke's results (classic race).
  const seqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      seqRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const seq = ++seqRef.current;
    const q = query.trim();

    if (!q) {
      setResults({ ...EMPTY, query });
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    let cancelled = false;
    searchApi
      .search(q, types, Math.min(limit, 50))
      .then((data) => {
        if (cancelled || !mountedRef.current || seq !== seqRef.current) return;
        setResults(data as unknown as SearchResponse);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled || !mountedRef.current || seq !== seqRef.current) return;
        setError(e instanceof Error ? e : new Error(getErrorMessage(e)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, types, limit]);

  const runSearch = useCallback(
    async (q: string) => {
      const seq = ++seqRef.current;
      setLoading(true);
      setError(null);
      try {
        if (!q) {
          if (mountedRef.current && seq === seqRef.current) {
            setResults({ ...EMPTY, query: q });
          }
          return;
        }
        const data = await searchApi.search(q, types, Math.min(limit, 50));
        if (mountedRef.current && seq === seqRef.current) {
          setResults(data as unknown as SearchResponse);
        }
      } catch (e: unknown) {
        if (mountedRef.current && seq === seqRef.current) {
          setError(e instanceof Error ? e : new Error(getErrorMessage(e)));
        }
      } finally {
        if (mountedRef.current && seq === seqRef.current) {
          setLoading(false);
        }
      }
    },
    [types, limit],
  );

  return useMemo(() => ({
    results,
    loading,
    error,
    runSearch,
  }), [results, loading, error, runSearch]);
}
