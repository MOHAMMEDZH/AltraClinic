import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createAiConversation,
  deleteAiConversation,
  exportAiConversation,
  fetchAiConversation,
  fetchAiConversations,
  fetchAiOverview,
  fetchAiProviderHealth,
  fetchAiSubscriptionLimits,
  sendAiMessage,
  streamAiMessage,
  updateAiConversation,
} from '../api/ai-api';

const ROOT = ['ai'] as const;

export function useAiProviderHealth(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'provider-health', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiProviderHealth(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useAiOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'overview', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiOverview(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useAiSubscriptionLimits(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'subscription-limits', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiSubscriptionLimits(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useAiConversations(search?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'conversations', user?.tenantId, search],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiConversations(token, user.tenantId, search);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useAiConversation(conversationId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'conversation', conversationId, user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !conversationId) throw new Error('Not authenticated');
      return fetchAiConversation(token, user.tenantId, conversationId);
    },
    enabled: Boolean(user?.tenantId && conversationId),
  });
}

export function useCreateAiConversation() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createAiConversation>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createAiConversation(token, user.tenantId, body);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: [...ROOT, 'conversations'] });
      void qc.setQueryData([...ROOT, 'conversation', data.conversationId, user?.tenantId], data);
    },
  });
}

export function useDeleteAiConversation() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteAiConversation(token, user.tenantId, id);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'conversations'] }),
  });
}

export function useRenameAiConversation() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateAiConversation(token, user.tenantId, id, { title });
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...ROOT, 'conversations'] });
      void qc.invalidateQueries({ queryKey: [...ROOT, 'conversation', vars.id] });
    },
  });
}

export function useTogglePinAiConversation() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pinned }: { id: string; pinned: boolean }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateAiConversation(token, user.tenantId, id, { pinned });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'conversations'] }),
  });
}

export function useExportAiConversation() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return exportAiConversation(token, user.tenantId, id);
    },
  });
}

export function useSendAiMessage() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
      attachments,
      context,
      stream,
      onStreamChunk,
      signal,
    }: {
      conversationId: string;
      content: string;
      attachments?: Array<{ name: string; mimeType: string; dataUrl?: string }>;
      context?: Record<string, unknown>;
      stream?: boolean;
      onStreamChunk?: (chunk: string) => void;
      signal?: AbortSignal;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      if (stream) {
        let full = '';
        for await (const chunk of streamAiMessage(token, user.tenantId, conversationId, {
          content,
          attachments,
          context,
        }, { signal })) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
          full += chunk;
          onStreamChunk?.(full);
        }
        return {
          userMessage: { messageId: 'stream-user', role: 'user', content },
          assistantMessage: {
            messageId: 'stream-assistant',
            role: 'assistant',
            content: full,
            citations: [],
            tokenCount: Math.ceil(full.length / 4),
          },
        };
      }

      return sendAiMessage(token, user.tenantId, conversationId, { content, attachments, context });
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: [...ROOT, 'conversations'] });
      void qc.invalidateQueries({ queryKey: [...ROOT, 'conversation', vars.conversationId] });
      void qc.invalidateQueries({ queryKey: [...ROOT, 'overview'] });
      void qc.invalidateQueries({ queryKey: [...ROOT, 'subscription-limits'] });
    },
  });
}
