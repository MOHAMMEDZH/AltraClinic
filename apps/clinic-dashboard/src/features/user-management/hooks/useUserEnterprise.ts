import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/app/providers/AuthProvider';

import {

  archiveCustomRole,

  archiveUser,

  assignUserCustomRoles,

  createCustomRole,

  createDepartment,

  deleteCustomRole,

  deleteSavedFilter,

  duplicateCustomRole,

  exportUsersApi,

  exportUsersPdf,

  exportUsersXlsx,

  fetchCustomRoles,

  fetchDepartments,

  fetchGlobalAuditEntries,

  fetchIdentityFeatures,

  fetchPermissionOverview,

  fetchSavedFilters,

  fetchUserSchedule,

  importUsers,

  importUsersXlsx,

  inviteStaffSms,

  fetchRegions,

  createRegion,

  syncUserRegions,

  uploadUserAvatar,

  lockUser,

  restoreUser,

  saveSavedFilter,

  suspendUser,

  updateCustomRole,

  updateUserSchedule,

  type BulkAction,

  type GlobalAuditParams,

  type ListUsersParams,

  type ScheduleDay,

} from '../api/identity-api';



export function useDepartments(enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'departments', user?.tenantId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchDepartments(token, user.tenantId);

    },

    enabled: Boolean(user?.tenantId) && enabled,

    staleTime: 120_000,

  });

}



export function useIdentityFeatures(enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'features', user?.tenantId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchIdentityFeatures(token, user.tenantId);

    },

    enabled: Boolean(user?.tenantId) && enabled,

    staleTime: 300_000,

  });

}



export function useCreateDepartment() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (input: { name: string; nameAr?: string; branchId?: string }) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return createDepartment(token, user.tenantId, input);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'departments'] }),

  });

}



export function useCustomRoles(enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'custom-roles', user?.tenantId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchCustomRoles(token, user.tenantId);

    },

    enabled: Boolean(user?.tenantId) && enabled,

  });

}



export function useCreateCustomRole() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (input: { name: string; description?: string; permissions: Record<string, string[]> }) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return createCustomRole(token, user.tenantId, input);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'custom-roles'] }),

  });

}



export function useUpdateCustomRole() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (input: {

      roleId: string;

      name?: string;

      description?: string;

      permissions?: Record<string, string[]>;

    }) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      const { roleId, ...body } = input;

      return updateCustomRole(token, user.tenantId, roleId, body);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'custom-roles'] }),

  });

}



export function useDuplicateCustomRole() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (roleId: string) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return duplicateCustomRole(token, user.tenantId, roleId);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'custom-roles'] }),

  });

}



export function useArchiveCustomRole() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (roleId: string) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return archiveCustomRole(token, user.tenantId, roleId);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'custom-roles'] }),

  });

}



export function useDeleteCustomRole() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (roleId: string) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return deleteCustomRole(token, user.tenantId, roleId);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'custom-roles'] }),

  });

}



export function usePermissionOverview(enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'permission-overview', user?.tenantId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchPermissionOverview(token, user.tenantId);

    },

    enabled: Boolean(user?.tenantId) && enabled,

    staleTime: 300_000,

  });

}



export function useSavedFilters(enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'saved-filters', user?.tenantId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchSavedFilters(token, user.tenantId);

    },

    enabled: Boolean(user?.tenantId) && enabled,

  });

}



export function useSaveFilter() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (input: { name: string; filters: Record<string, unknown> }) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return saveSavedFilter(token, user.tenantId, input);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'saved-filters'] }),

  });

}



export function useDeleteSavedFilter() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (filterId: string) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return deleteSavedFilter(token, user.tenantId, filterId);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'saved-filters'] }),

  });

}



export function useUserSchedule(userId: string | undefined, enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'schedule', user?.tenantId, userId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId || !userId) throw new Error('Not authenticated');

      return fetchUserSchedule(token, user.tenantId, userId);

    },

    enabled: Boolean(user?.tenantId && userId) && enabled,

  });

}



export function useUpdateUserSchedule(userId: string) {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (days: ScheduleDay[]) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return updateUserSchedule(token, user.tenantId, userId, days);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'schedule', user?.tenantId, userId] }),

  });

}



export function useAssignUserCustomRoles(userId: string) {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (customRoleIds: string[]) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return assignUserCustomRoles(token, user.tenantId, userId, customRoleIds);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),

  });

}



export function useLockUser(userId: string) {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (reason?: string) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return lockUser(token, user.tenantId, userId, reason);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),

  });

}



export function useGlobalAudit(params: GlobalAuditParams = {}, enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'audit-global', user?.tenantId, params],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchGlobalAuditEntries(token, user.tenantId, params);

    },

    enabled: Boolean(user?.tenantId) && enabled,

  });

}



export function useExtendedLifecycle(userId: string) {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['identity'] });



  return {

    suspend: useMutation({

      mutationFn: async () => {

        const token = await getValidAccessToken();

        if (!token || !user?.tenantId) throw new Error('Not authenticated');

        return suspendUser(token, user.tenantId, userId);

      },

      onSuccess: invalidate,

    }),

    archive: useMutation({

      mutationFn: async () => {

        const token = await getValidAccessToken();

        if (!token || !user?.tenantId) throw new Error('Not authenticated');

        return archiveUser(token, user.tenantId, userId);

      },

      onSuccess: invalidate,

    }),

    restore: useMutation({

      mutationFn: async () => {

        const token = await getValidAccessToken();

        if (!token || !user?.tenantId) throw new Error('Not authenticated');

        return restoreUser(token, user.tenantId, userId);

      },

      onSuccess: invalidate,

    }),

  };

}



export function useExportUsers() {

  const { getValidAccessToken, user } = useAuth();

  return useMutation({

    mutationFn: async (params: ListUsersParams) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return exportUsersApi(token, user.tenantId, params);

    },

  });

}



export function useExportUsersXlsx() {

  const { getValidAccessToken, user } = useAuth();

  return useMutation({

    mutationFn: async (params: ListUsersParams) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return exportUsersXlsx(token, user.tenantId, params);

    },

  });

}



export function useExportUsersPdf() {

  const { getValidAccessToken, user } = useAuth();

  return useMutation({

    mutationFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return exportUsersPdf(token, user.tenantId);

    },

  });

}



export function useImportUsers() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (

      rows: Array<{ email: string; firstName: string; lastName: string; roles?: string[]; password?: string }>,

    ) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return importUsers(token, user.tenantId, rows);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),

  });

}



export function useImportUsersXlsx() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (file: File) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return importUsersXlsx(token, user.tenantId, file);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),

  });

}



export function useSmsInviteStaff() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (input: import('../api/identity-api').InviteStaffInput) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return inviteStaffSms(token, user.tenantId, input);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),

  });

}



export function useRegions(enabled = true) {

  const { getValidAccessToken, user } = useAuth();

  return useQuery({

    queryKey: ['identity', 'regions', user?.tenantId],

    queryFn: async () => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return fetchRegions(token, user.tenantId);

    },

    enabled: Boolean(user?.tenantId) && enabled,

    staleTime: 120_000,

  });

}



export function useCreateRegion() {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (input: { name: string; nameAr?: string }) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return createRegion(token, user.tenantId, input);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'regions'] }),

  });

}



export function useSyncUserRegions(userId: string) {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (regionIds: string[]) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return syncUserRegions(token, user.tenantId, userId, regionIds);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity', 'user', user?.tenantId, userId] }),

  });

}



export function useUploadUserAvatar(userId: string) {

  const { getValidAccessToken, user } = useAuth();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (file: File) => {

      const token = await getValidAccessToken();

      if (!token || !user?.tenantId) throw new Error('Not authenticated');

      return uploadUserAvatar(token, user.tenantId, userId, file);

    },

    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['identity'] }),

  });

}



export type { BulkAction };


