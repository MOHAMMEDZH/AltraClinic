import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchBeautyDashboard } from '../api/beauty-dashboard-api';

export function useBeautyDashboard(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['beauty', 'dashboard', user?.tenantId ?? 'none'],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBeautyDashboard(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}
