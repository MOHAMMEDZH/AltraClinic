import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import type { DashboardCustomRange, DashboardRange } from '@/features/dashboard/api/dashboard-api';
import { fetchAnalyticsAlerts } from '../api/analytics-api';

export function useAnalyticsAlerts(
  branchId: string | null | undefined,
  range: DashboardRange,
  customRange?: DashboardCustomRange,
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  const branchKey = branchId === null ? 'all' : (branchId ?? user?.branchId ?? 'default');
  const customKey =
    range === 'custom' && customRange ? `${customRange.from}:${customRange.to}` : 'preset';

  return useQuery({
    queryKey: ['analytics', 'alerts', user?.tenantId, branchKey, range, customKey],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsAlerts(token, user.tenantId, branchId, range, customRange);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useAnalyticsFilterPresets(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['analytics', 'filter-presets', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const { fetchAnalyticsFilterPresets } = await import('../api/analytics-api');
      return fetchAnalyticsFilterPresets(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; filters: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const { createAnalyticsFilterPreset } = await import('../api/analytics-api');
      return createAnalyticsFilterPreset(token, user.tenantId, input.name, input.filters);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'filter-presets'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const { deleteAnalyticsFilterPreset } = await import('../api/analytics-api');
      await deleteAnalyticsFilterPreset(token, presetId, user.tenantId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'filter-presets'] });
    },
  });

  return { ...query, createPreset: createMutation, deletePreset: deleteMutation };
}
