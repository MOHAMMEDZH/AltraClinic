import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchUserAuditEntries, fetchUserLoginHistory, fetchUserSessions, fetchUserTrustedDevices } from '../api/identity-api';

export function useUserLoginHistory(userId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'login-history', user?.tenantId, userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !userId) throw new Error('Not authenticated');
      return fetchUserLoginHistory(token, user.tenantId, userId);
    },
    enabled: Boolean(user?.tenantId && userId) && enabled,
  });
}

export function useUserSessions(userId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'sessions', user?.tenantId, userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !userId) throw new Error('Not authenticated');
      return fetchUserSessions(token, user.tenantId, userId);
    },
    enabled: Boolean(user?.tenantId && userId) && enabled,
  });
}

export function useUserTrustedDevices(userId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'trusted-devices', user?.tenantId, userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !userId) throw new Error('Not authenticated');
      return fetchUserTrustedDevices(token, user.tenantId, userId);
    },
    enabled: Boolean(user?.tenantId && userId) && enabled,
  });
}

export function useUserAudit(userId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'audit', user?.tenantId, userId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !userId) throw new Error('Not authenticated');
      return fetchUserAuditEntries(token, user.tenantId, userId);
    },
    enabled: Boolean(user?.tenantId && userId) && enabled,
  });
}

export function useStaffInvitations(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['identity', 'invitations', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const { fetchStaffInvitations } = await import('../api/identity-api');
      return fetchStaffInvitations(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}
