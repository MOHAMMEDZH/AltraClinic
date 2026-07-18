import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  advanceWorkflow,
  approveWorkflowRequest,
  cancelWorkflow,
  createWorkflow,
  createWorkflowAutomationRule,
  createWorkflowTemplate,
  fetchWorkflow,
  fetchWorkflowApprovals,
  fetchWorkflowAutomation,
  fetchWorkflowLogs,
  retryFailedWorkflow,
  fetchWorkflowOverview,
  exportWorkflowLogs,
  fetchWorkflowAudit,
  fetchWorkflowSavedFilters,
  saveWorkflowFilter,
  deleteWorkflowSavedFilter,
  fetchWorkflowTask,
  fetchWorkflows,
  fetchWorkflowTasks,
  fetchWorkflowTemplates,
  publishWorkflowTemplate,
  rejectWorkflowRequest,
  startWorkflowFromTemplate,
  updateWorkflowTask,
} from '../api/workflow-api';

const ROOT = ['workflows'] as const;

export function useWorkflowOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'overview', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowOverview(token, user.tenantId, user.id);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useInfiniteWorkflows(params: { status?: string; search?: string }, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...ROOT, 'list', user?.tenantId, params],
    queryFn: async ({ pageParam }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const res = await fetchWorkflows(token, user.tenantId, {
        ...params,
        paginated: true,
        limit: 50,
        cursor: pageParam as string | undefined,
      });
      if (Array.isArray(res)) return { items: res, nextCursor: null };
      return res;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useWorkflow(workflowId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'detail', workflowId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !workflowId) throw new Error('Not authenticated');
      return fetchWorkflow(token, user.tenantId, workflowId);
    },
    enabled: Boolean(workflowId && user?.tenantId) && enabled,
  });
}

export function useWorkflowTasks(params: { assigneeId?: string; overdueOnly?: boolean }, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useInfiniteQuery({
    queryKey: [...ROOT, 'tasks', user?.tenantId, params],
    queryFn: async ({ pageParam }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowTasks(token, user.tenantId, { ...params, cursor: pageParam as string | undefined });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useWorkflowApprovals(status?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'approvals', user?.tenantId, status],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowApprovals(token, user.tenantId, status);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useWorkflowTemplates(search?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'templates', user?.tenantId, search],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowTemplates(token, user.tenantId, search);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useWorkflowAutomation(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'automation', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowAutomation(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useWorkflowLogs(workflowId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'logs', user?.tenantId, workflowId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowLogs(token, user.tenantId, workflowId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useCreateWorkflow() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createWorkflow>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createWorkflow(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useAdvanceWorkflow() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({ workflowId, comment }: { workflowId: string; comment?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return advanceWorkflow(token, user.tenantId, workflowId, comment);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useCancelWorkflow() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({ workflowId, reason }: { workflowId: string; reason?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelWorkflow(token, user.tenantId, workflowId, reason);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useApproveWorkflow() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({ approvalId, comment }: { approvalId: string; comment?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approveWorkflowRequest(token, user.tenantId, approvalId, comment);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useRejectWorkflow() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({ approvalId, reason }: { approvalId: string; reason: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return rejectWorkflowRequest(token, user.tenantId, approvalId, reason);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function usePublishTemplate() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return publishWorkflowTemplate(token, user.tenantId, templateId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useStartFromTemplate() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return startWorkflowFromTemplate(token, user.tenantId, templateId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createWorkflowTemplate(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useCreateAutomationRule() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (body: { name: string; eventType: string; actionType: string; isActive?: boolean }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createWorkflowAutomationRule(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async ({
      taskId,
      body,
    }: {
      taskId: string;
      body: { status?: string; assigneeId?: string; priority?: string; comment?: string };
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateWorkflowTask(token, user.tenantId, taskId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useWorkflowAudit(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'audit', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowAudit(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useWorkflowSavedFilters(scope?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'saved-filters', user?.tenantId, scope],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWorkflowSavedFilters(token, user.tenantId, scope);
    },
    enabled: Boolean(user?.tenantId) && enabled,
  });
}

export function useSaveWorkflowFilter() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (body: { name: string; filters: Record<string, unknown>; scope?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return saveWorkflowFilter(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useDeleteWorkflowSavedFilter() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (filterId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteWorkflowSavedFilter(token, user.tenantId, filterId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}

export function useWorkflowTaskDetail(taskId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'task', taskId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !taskId) throw new Error('Not authenticated');
      return fetchWorkflowTask(token, user.tenantId, taskId);
    },
    enabled: Boolean(taskId && user?.tenantId) && enabled,
  });
}

export function useExportWorkflowLogs() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (workflowId?: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return exportWorkflowLogs(token, user.tenantId, workflowId);
    },
  });
}

export function useRetryWorkflow() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (workflowId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return retryFailedWorkflow(token, user.tenantId, workflowId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROOT }),
  });
}
