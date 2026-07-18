import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createAnalyticsDashboard,
  fetchAnalyticsDashboards,
  fetchAnalyticsLayout,
  saveAnalyticsLayout,
  type AnalyticsLayout,
} from '../api/analytics-api';
import type { AnalyticsGridItem } from '../lib/analytics-grid-layout';

export function useAnalyticsDashboardBuilder(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dashboardsQuery = useQuery({
    queryKey: ['analytics', 'dashboards', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsDashboards(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });

  const layoutQuery = useQuery({
    queryKey: ['analytics', 'layout', user?.tenantId, 'builder'],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsLayout(token, user.tenantId, 'builder');
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });

  const saveLayoutMutation = useMutation({
    mutationFn: async (layout: {
      widgetOrder: string[];
      hiddenWidgets: string[];
      gridLayout?: AnalyticsGridItem[];
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveAnalyticsLayout(token, user.tenantId, { profile: 'builder', ...layout });
    },
    onSuccess: () => {
      setSuccess('Layout saved');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'layout'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const createDashboardMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      widgets: Array<{ metricName: string; title: string; chartType: string; size: string }>;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createAnalyticsDashboard(token, user.tenantId, {
        name: input.name,
        dashboardType: 'custom',
        widgets: input.widgets,
        isPublic: false,
      });
    },
    onSuccess: () => {
      setSuccess('Dashboard created');
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['analytics', 'dashboards'] });
    },
    onError: (err: Error) => setError(err.message),
  });

  return {
    dashboards: dashboardsQuery.data ?? [],
    savedLayout: layoutQuery.data as AnalyticsLayout | null | undefined,
    saveLayoutMutation,
    createDashboardMutation,
    success,
    error,
  };
}
