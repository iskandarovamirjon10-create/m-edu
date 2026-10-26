// M-EDU AI Copilot — conversation history
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AiWireMessage } from '../types/ai';
import { aiConversationsApi, type AiConversationSummary } from '../lib/ai';

const CONVERSATIONS_KEY = ['ai-conversations'] as const;

export function useConversations() {
  const queryClient = useQueryClient();

  const { data: conversations, isLoading, isError, refetch } = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => aiConversationsApi.list(50),
  });

  const createMutation = useMutation({
    mutationFn: (_title?: string) => aiConversationsApi.create(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      aiConversationsApi.rename(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_KEY });
      const previous = queryClient.getQueryData<AiConversationSummary[]>(CONVERSATIONS_KEY);
      if (previous) {
        queryClient.setQueryData<AiConversationSummary[]>(
          CONVERSATIONS_KEY,
          previous.map((conversation) =>
            conversation.id === id ? { ...conversation, title } : conversation,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CONVERSATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiConversationsApi.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CONVERSATIONS_KEY });
      const previous = queryClient.getQueryData<AiConversationSummary[]>(CONVERSATIONS_KEY);
      if (previous) {
        queryClient.setQueryData<AiConversationSummary[]>(
          CONVERSATIONS_KEY,
          previous.filter((c) => c.id !== id),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(CONVERSATIONS_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
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
    renameConversation: renameMutation.mutateAsync,
    isRenaming: renameMutation.isPending,
    deleteConversation: deleteMutation.mutate,
    loadMessages,
  };
}
