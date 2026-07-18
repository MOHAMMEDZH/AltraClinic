import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import type { DashboardCustomRange, DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { fetchAnalyticsOverview } from '../api/analytics-api';

export function useAnalyticsOverview(
  branchId: string | null | undefined,
  range: DashboardRange = '7d',
  customRange?: DashboardCustomRange,
) {
  const { getValidAccessToken, user } = useAuth();
  const branchKey = branchId === null ? 'all' : (branchId ?? user?.branchId ?? 'default');
  const customKey =
    range === 'custom' && customRange ? `${customRange.from}:${customRange.to}` : 'preset';

  return useQuery({
    queryKey: ['analytics', 'overview', user?.tenantId, branchKey, range, customKey],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsOverview(token, branchId, user.tenantId, range, customRange);
    },
    enabled: Boolean(user?.tenantId),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
