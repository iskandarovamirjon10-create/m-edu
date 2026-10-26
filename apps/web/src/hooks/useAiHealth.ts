// M-EDU Premium UI — AI provider readiness
import { useQuery } from '@tanstack/react-query';
import { aiHealthApi, type AiHealthMode } from '@/lib/ai';

export interface AiHealthState {
  /** Endpoint reachable (independent of provider configuration). */
  isOnline: boolean;
  /** True only when a real model provider is configured. */
  configured: boolean | null;
  /** `live` = model answers, `fallback` = database-backed answers, `offline` = unreachable. */
  mode: AiHealthMode;
  model?: string;
  provider?: string;
  isLoading: boolean;
  refetch: () => void;
}

export function useAiHealth(): AiHealthState {
  const query = useQuery({
    queryKey: ['ai', 'health'],
    queryFn: () => aiHealthApi.check(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  const data = query.data;
  const reachable = !query.isError;

  const configured =
    typeof data?.configured === 'boolean'
      ? data.configured
      : data?.mode
        ? data.mode === 'live'
        : null;

  const mode: AiHealthMode = query.isError
    ? 'offline'
    : data?.mode === 'fallback' || configured === false
      ? 'fallback'
      : 'live';

  return {
    isOnline: reachable,
    configured,
    mode,
    model: data?.model,
    provider: data?.provider,
    isLoading: query.isLoading,
    refetch: () => {
      void query.refetch();
    },
  };
}
