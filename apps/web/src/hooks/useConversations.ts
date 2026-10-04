// M-EDU AI Copilot — integration pass
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AiWireMessage } from '../types/ai';
import { aiConversationsApi, AiConversationSummary } from '../lib/ai';

export function useConversations() {
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, isError, refetch } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => aiConversationsApi.list(50),
  });

  const createMutation = useMutation({
    mutationFn: (_title?: string) => aiConversationsApi.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiConversationsApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['ai-conversations'] });
      const previous = queryClient.getQueryData<AiConversationSummary[]>(['ai-conversations']);
      if (previous) {
        queryClient.setQueryData<AiConversationSummary[]>(
          ['ai-conversations'],
          previous.filter((c) => c.id !== id)
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['ai-conversations'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
  });

  const loadMessages = async (id: string): Promise<AiWireMessage[]> => {
    return aiConversationsApi.messages(id);
  };

  return {
    conversations: conversations || [],
    isLoading,
    isError,
    refetch,
    createNew: createMutation.mutateAsync,
    deleteConversation: deleteMutation.mutate,
    loadMessages,
  };
}
