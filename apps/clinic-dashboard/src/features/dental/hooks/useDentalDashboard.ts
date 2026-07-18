import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { fetchDentalDashboard } from '../api/dental-dashboard-api';

export function useDentalDashboard(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'dashboard', user?.tenantId ?? 'none'],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchDentalDashboard(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}
