import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  composeNotification,
  createAutomationRule,
  createNotificationTemplate,
  deleteAutomationRule,
  deleteNotification,
  deleteNotificationTemplate,
  deleteSavedNotificationFilter,
  exportNotificationsCsv,
  fetchAutomationRules,
  fetchChannelSettings,
  fetchDrafts,
  fetchMyNotificationPreferences,
  fetchNotification,
  fetchNotifications,
  fetchNotificationsOverview,
  fetchNotificationTemplates,
  fetchSavedNotificationFilters,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  registerDeviceToken,
  retryNotification,
  saveDraft,
  saveNotificationFilter,
  sendDraft,
  testNotificationTemplate,
  updateAutomationRule,
  updateChannelSetting,
  updateMyNotificationPreferences,
  updateNotificationFlags,
  updateNotificationTemplate,
  type ComposeNotificationInput,
  type CreateAutomationInput,
  type CreateTemplateInput,
  type ListNotificationsParams,
  type RegisterDeviceTokenInput,
  type SaveDraftInput,
  type UpdateAutomationInput,
  type UpdatePreferencesInput,
  type UpdateTemplateInput,
} from '../api/notifications-api';

const QUERY_ROOT = ['notifications'] as const;

export function useNotificationsOverview(enabled = true, recipientId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'overview', user?.tenantId, recipientId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchNotificationsOverview(token, user.tenantId, recipientId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useUnreadCount(enabled = true, polling = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'unread-count', user?.tenantId, user?.userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchUnreadCount(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId && user?.userId) && enabled,
    staleTime: 15_000,
    refetchInterval: polling ? 60_000 : false,
  });
}

export function useNotificationsList(
  params: Omit<ListNotificationsParams, 'cursor'>,
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'list', user?.tenantId, params],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchNotifications(token, user.tenantId, {
        ...params,
        paginated: true,
        limit: params.limit ?? 50,
      });
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useInfiniteNotificationsList(
  params: Omit<ListNotificationsParams, 'cursor' | 'paginated'>,
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...QUERY_ROOT, 'list-infinite', user?.tenantId, params],
    queryFn: async ({ pageParam }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchNotifications(token, user.tenantId, {
        ...params,
        paginated: true,
        limit: params.limit ?? 50,
        cursor: pageParam as string | undefined,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useNotification(notificationId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'detail', user?.tenantId, notificationId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !notificationId) throw new Error('Not authenticated');
      return fetchNotification(token, user.tenantId, notificationId);
    },
    enabled: Boolean(user?.tenantId && notificationId) && enabled,
  });
}

function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: QUERY_ROOT });
}

export function useMarkNotificationRead() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return markNotificationRead(token, user.tenantId, notificationId);
    },
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (recipientId?: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return markAllNotificationsRead(token, user.tenantId, recipientId);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateNotificationFlags() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async ({
      notificationId,
      flags,
    }: {
      notificationId: string;
      flags: { isStarred?: boolean; isArchived?: boolean };
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateNotificationFlags(token, user.tenantId, notificationId, flags);
    },
    onSuccess: invalidate,
  });
}

export function useRetryNotification() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return retryNotification(token, user.tenantId, notificationId);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteNotification() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteNotification(token, user.tenantId, notificationId);
    },
    onSuccess: invalidate,
  });
}

export function useNotificationTemplates(search?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'templates', user?.tenantId, search],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchNotificationTemplates(token, user.tenantId, search);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useCreateNotificationTemplate() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (input: CreateTemplateInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createNotificationTemplate(token, user.tenantId, input);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateNotificationTemplate() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async ({ templateId, input }: { templateId: string; input: UpdateTemplateInput }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateNotificationTemplate(token, user.tenantId, templateId, input);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteNotificationTemplate() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteNotificationTemplate(token, user.tenantId, templateId);
    },
    onSuccess: invalidate,
  });
}

export function useTestNotificationTemplate() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({
      templateId,
      recipientId,
      variables,
    }: {
      templateId: string;
      recipientId: string;
      variables?: Record<string, string>;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return testNotificationTemplate(token, user.tenantId, templateId, recipientId, variables);
    },
  });
}

export function useMyNotificationPreferences(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'preferences', user?.tenantId, user?.userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchMyNotificationPreferences(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useUpdateMyNotificationPreferences() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (input: UpdatePreferencesInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateMyNotificationPreferences(token, user.tenantId, input);
    },
    onSuccess: invalidate,
  });
}

export function useChannelSettings(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'channels', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchChannelSettings(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useUpdateChannelSetting() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async ({
      channel,
      input,
    }: {
      channel: string;
      input: { isEnabled?: boolean; provider?: string; providerStatus?: string };
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateChannelSetting(token, user.tenantId, channel, input);
    },
    onSuccess: invalidate,
  });
}

export function useAutomationRules(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'automation', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAutomationRules(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useCreateAutomationRule() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (input: CreateAutomationInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createAutomationRule(token, user.tenantId, input);
    },
    onSuccess: invalidate,
  });
}

export function useUpdateAutomationRule() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async ({ ruleId, input }: { ruleId: string; input: UpdateAutomationInput }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateAutomationRule(token, user.tenantId, ruleId, input);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteAutomationRule() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (ruleId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteAutomationRule(token, user.tenantId, ruleId);
    },
    onSuccess: invalidate,
  });
}

export function useComposeNotification() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (input: ComposeNotificationInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return composeNotification(token, user.tenantId, input);
    },
    onSuccess: invalidate,
  });
}

export function useNotificationDrafts(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'drafts', user?.tenantId, user?.userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchDrafts(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useSaveNotificationDraft() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (input: SaveDraftInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveDraft(token, user.tenantId, input);
    },
    onSuccess: invalidate,
  });
}

export function useSendNotificationDraft() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return sendDraft(token, user.tenantId, draftId);
    },
    onSuccess: invalidate,
  });
}

export function useRegisterDeviceToken() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (input: RegisterDeviceTokenInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return registerDeviceToken(token, user.tenantId, input);
    },
  });
}

export function useSavedNotificationFilters(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...QUERY_ROOT, 'saved-filters', user?.tenantId, user?.userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchSavedNotificationFilters(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useSaveNotificationFilter() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async ({ name, filters }: { name: string; filters: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveNotificationFilter(token, user.tenantId, name, filters);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSavedNotificationFilter() {
  const { getValidAccessToken, user } = useAuth();
  const invalidate = useInvalidateNotifications();
  return useMutation({
    mutationFn: async (filterId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteSavedNotificationFilter(token, user.tenantId, filterId);
    },
    onSuccess: invalidate,
  });
}

export function useExportNotifications() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (params?: { status?: string; channel?: string; limit?: number }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return exportNotificationsCsv(token, user.tenantId, params);
    },
  });
}
