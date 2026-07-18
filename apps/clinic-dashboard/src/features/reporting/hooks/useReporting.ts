import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createReportShare,
  downloadAnalyticsReport,
  downloadOperationalReport,
  fetchAnalyticsReports,
  fetchAnalyticsReportDetail,
  fetchOperationalReports,
  fetchReportAudit,
  fetchReportFilterPresets,
  fetchReportShares,
  generateAnalyticsReport,
  recordReportAudit,
  requestOperationalReport,
  saveReportFilterPreset,
  deleteReportFilterPreset,
  fetchReportCustomDefinitions,
  saveReportCustomDefinition,
  deleteReportCustomDefinition,
  deleteAnalyticsReport,
  fetchRecentReportActivity,
  fetchOperationalReportDetail,
  updateAnalyticsReportSchedule,
  type GenerateAnalyticsReportInput,
  type AnalyticsReportSummary,
} from '../api/reporting-api';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useSavedAnalyticsReports(
  branchId?: string | null,
  enabled = true,
  options?: { refetchInterval?: number | false | ((query: { state: { data?: AnalyticsReportSummary[] } }) => number | false) },
) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'analytics-reports', branchId ?? 'all', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAnalyticsReports(token, user.tenantId, branchId ?? undefined);
    },
    staleTime: 20_000,
    refetchInterval: options?.refetchInterval,
  });
}

export function useAnalyticsReportDetail(reportId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'analytics-report', reportId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && reportId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !reportId) throw new Error('Not authenticated');
      return fetchAnalyticsReportDetail(token, reportId, user.tenantId);
    },
    staleTime: 15_000,
  });
}

export function useOperationalReports(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'operational', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchOperationalReports(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useReportShares(reportId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'shares', reportId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && reportId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !reportId) throw new Error('Not authenticated');
      return fetchReportShares(token, user.tenantId, reportId);
    },
    staleTime: 15_000,
  });
}

export function useReportAudit(reportId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'audit', reportId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && reportId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !reportId) throw new Error('Not authenticated');
      return fetchReportAudit(token, user.tenantId, reportId);
    },
    staleTime: 10_000,
  });
}

export function useReportFilterPresets(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'filter-presets', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchReportFilterPresets(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useGenerateAnalyticsReport() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateAnalyticsReportInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return generateAnalyticsReport(token, input, user.tenantId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting'] }),
  });
}

export function useDownloadAnalyticsReport() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({ reportId, filename }: { reportId: string; filename: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      await downloadAnalyticsReport(token, reportId, filename, user.tenantId);
    },
  });
}

export function useDownloadOperationalReport() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({ reportId, filename }: { reportId: string; filename: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      await downloadOperationalReport(token, reportId, filename, user.tenantId);
    },
  });
}

export function useRequestOperationalReport() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { type: string; format: string; name?: string; branchId?: string; startDate?: string; endDate?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return requestOperationalReport(token, user.tenantId, {
        ...body,
        createdBy: user.userId,
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting'] }),
  });
}

export function useCreateReportShare() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      ...body
    }: { reportId: string; targetType: string; targetId: string; access: string; reportKind?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createReportShare(token, user.tenantId, reportId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['reporting', 'shares', vars.reportId] });
      void qc.invalidateQueries({ queryKey: ['reporting', 'audit', vars.reportId] });
    },
  });
}

export function useRecordReportAudit() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      action,
      details,
    }: { reportId: string; action: string; details?: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      await recordReportAudit(token, user.tenantId, reportId, action, details);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['reporting', 'audit', vars.reportId] });
    },
  });
}

export function useSaveReportFilterPreset() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { id?: string; name: string; filters: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveReportFilterPreset(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting', 'filter-presets'] }),
  });
}

export function useDeleteReportFilterPreset() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (presetId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      await deleteReportFilterPreset(token, user.tenantId, presetId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting', 'filter-presets'] }),
  });
}

export function useReportCustomDefinitions(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'custom-definitions', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchReportCustomDefinitions(token, user.tenantId);
    },
    staleTime: 20_000,
  });
}

export function useSaveReportCustomDefinition() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: Parameters<typeof saveReportCustomDefinition>[2],
    ) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveReportCustomDefinition(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting', 'custom-definitions'] }),
  });
}

export function useDeleteReportCustomDefinition() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (definitionId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      await deleteReportCustomDefinition(token, user.tenantId, definitionId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting', 'custom-definitions'] }),
  });
}

export function useUnifiedReportDetail(reportId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'unified-report', reportId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && reportId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !reportId) throw new Error('Not authenticated');
      try {
        const analytics = await fetchAnalyticsReportDetail(token, reportId, user.tenantId);
        return { kind: 'analytics' as const, report: analytics };
      } catch {
        const operational = await fetchOperationalReportDetail(token, user.tenantId, reportId);
        return { kind: 'operational' as const, report: operational };
      }
    },
    staleTime: 15_000,
  });
}

export function useRecentReportActivity(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['reporting', 'activity', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchRecentReportActivity(token, user.tenantId);
    },
    staleTime: 20_000,
  });
}

export function useUpdateAnalyticsReport() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportId,
      ...body
    }: {
      reportId: string;
      isScheduled?: boolean;
      scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
      recipientEmails?: string[];
      name?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateAnalyticsReportSchedule(token, user.tenantId, reportId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting'] }),
  });
}

export function useDeleteAnalyticsReport() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reportId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      await deleteAnalyticsReport(token, user.tenantId, reportId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reporting'] }),
  });
}
