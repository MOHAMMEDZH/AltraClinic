import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  deactivateUser,
  deleteUser,
  fetchUser,
  fetchUserOverview,
  fetchUsers,
  bulkUserAction,
  cancelStaffInvitation,
  forcePasswordReset,
  inviteStaffUser,
  reactivateUser,
  registerUser,
  resendVerification,
  revokeAllUserSessions,
  revokeUserSession,
  unlockUser,
  updateUser,
  type InviteStaffInput,
  type ListUsersParams,
  type RegisterUserInput,
  type UpdateUserInput,
} from '../api/identity-api';
export function useUserOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'overview', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchUserOverview(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useUsers(params: ListUsersParams, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'users', user?.tenantId, params],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchUsers(token, user.tenantId, params);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useInfiniteUsers(
  params: Omit<ListUsersParams, 'page' | 'cursor'>,
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['identity', 'users-infinite', user?.tenantId, params],
    queryFn: async ({ pageParam }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchUsers(token, user.tenantId, {
        ...params,
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
export function useUser(userId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'user', user?.tenantId, userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !userId) throw new Error('Not authenticated');
      return fetchUser(token, user.tenantId, userId);
    },
    enabled: Boolean(user?.tenantId && userId) && enabled,
  });
}

export function useRegisterUser() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterUserInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return registerUser(token, user.tenantId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity'] });
    },
  });
}

export function useUpdateUser(userId: string) {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateUser(token, user.tenantId, userId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['identity'] });
    },
  });
}

export function useUserLifecycle(userId: string) {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['identity'] });

  const deactivate = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deactivateUser(token, user.tenantId, userId);
    },
    onSuccess: invalidate,
  });

  const reactivate = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return reactivateUser(token, user.tenantId, userId);
    },
    onSuccess: invalidate,
  });

  const unlock = useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return unlockUser(token, user.tenantId, userId);
    },
    onSuccess: invalidate,
  });

  return { deactivate, reactivate, unlock };
}

export function useInviteStaffUser() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteStaffInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return inviteStaffUser(token, user.tenantId, input);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),
  });
}

export function useBulkUserAction() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userIds: string[];
      action: import('../api/identity-api').BulkAction;
      roles?: string[];
      branchIds?: string[];
      departmentId?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return bulkUserAction(token, user.tenantId, input);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),
  });
}

export function useCancelStaffInvitation() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelStaffInvitation(token, user.tenantId, invitationId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),
  });
}

export function useUserAdminActions(userId: string) {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['identity'] });

  return {
    forcePasswordReset: useMutation({
      mutationFn: async () => {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId) throw new Error('Not authenticated');
        return forcePasswordReset(token, user.tenantId, userId);
      },
      onSuccess: invalidate,
    }),
    resendVerification: useMutation({
      mutationFn: async () => {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId) throw new Error('Not authenticated');
        return resendVerification(token, user.tenantId, userId);
      },
      onSuccess: invalidate,
    }),
    revokeAllSessions: useMutation({
      mutationFn: async () => {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId) throw new Error('Not authenticated');
        return revokeAllUserSessions(token, user.tenantId, userId);
      },
      onSuccess: invalidate,
    }),
    revokeSession: useMutation({
      mutationFn: async (sessionId: string) => {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId) throw new Error('Not authenticated');
        return revokeUserSession(token, user.tenantId, userId, sessionId);
      },
      onSuccess: invalidate,
    }),
    deleteUser: useMutation({
      mutationFn: async () => {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId) throw new Error('Not authenticated');
        return deleteUser(token, user.tenantId, userId);
      },
      onSuccess: invalidate,
    }),
  };
}
