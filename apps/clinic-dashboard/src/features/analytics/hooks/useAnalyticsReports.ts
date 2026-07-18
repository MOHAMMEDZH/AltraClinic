import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchAnalyticsReports } from '../api/analytics-api';

export function useAnalyticsReports(branchId: string | null | undefined) {
  const { getValidAccessToken, user } = useAuth();
  const branchKey = branchId === null ? 'all' : (branchId ?? user?.branchId ?? 'default');

  return useQuery({
    queryKey: ['analytics', 'reports', user?.tenantId, branchKey],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsReports(token, user.tenantId, branchId ?? undefined);
    },
    enabled: Boolean(user?.tenantId),
    staleTime: 120_000,
  });
}
