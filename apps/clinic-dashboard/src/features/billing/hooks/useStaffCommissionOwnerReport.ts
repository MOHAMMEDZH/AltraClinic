import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchStaffCommissionOwnerReport } from '../api/staff-commission-api';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

/** Owner staff-commission summary (api.staff-commission export). */
export function useStaffCommissionOwnerReport(days = 90, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['staff-commission', 'owner-report', days, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      return fetchStaffCommissionOwnerReport(token, user.tenantId, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
    },
    staleTime: 60_000,
  });
}
