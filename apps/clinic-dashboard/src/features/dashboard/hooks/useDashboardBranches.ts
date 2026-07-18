import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { fetchDashboardBranches } from '../api/dashboard-api';
import { canSelectDashboardBranch } from '../config/dashboard-branch-scope';

export function useDashboardBranches() {
  const { getValidAccessToken, user } = useAuth();
  const branch = useOptionalBranch();
  /** Prefer DynamicBranchProvider config source; fall back to static role map. */
  const canSelect =
    branch?.view.canSelectBranch ?? canSelectDashboardBranch(user?.roles ?? []);

  return useQuery({
    queryKey: ['dashboard', 'branches', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchDashboardBranches(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && canSelect,
    staleTime: 300_000,
  });
}
