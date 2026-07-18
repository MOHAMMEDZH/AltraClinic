import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import type { DashboardCustomRange, DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { fetchAnalyticsDomain } from '../api/analytics-api';
import type { AnalyticsDomainId } from '../config/analytics-catalog';

export function useAnalyticsDomain(
  domainId: AnalyticsDomainId,
  branchId: string | null | undefined,
  range: DashboardRange = '30d',
  customRange?: DashboardCustomRange,
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  const branchKey = branchId === null ? 'all' : (branchId ?? user?.branchId ?? 'default');
  const customKey =
    range === 'custom' && customRange ? `${customRange.from}:${customRange.to}` : 'preset';

  return useQuery({
    queryKey: ['analytics', 'domain', domainId, user?.tenantId, branchKey, range, customKey],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsDomain(token, domainId, user.tenantId, branchId, range, customRange);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}
