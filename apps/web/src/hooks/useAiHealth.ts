// M-EDU Premium UI — see design brief
import { useQuery } from '@tanstack/react-query';
import { aiHealthApi } from '@/lib/ai';

export function useAiHealth() {
  const query = useQuery({
    queryKey: ['ai', 'health'],
    queryFn: () => aiHealthApi.check(),
    refetchInterval: 30_000,
  });

  return {
    isOnline: query.data?.ok ?? false,
    model: query.data?.model,
    isLoading: query.isLoading,
  };
}
