import { apiRequest } from '@/lib/api-client';
import type { WorkflowStatus } from '../config/workflow-config';

export interface WorkflowSummary {
  workflowId: string;
  nameEn: string;
  nameAr: string;
  status: WorkflowStatus;
  currentStepIndex: number;
  currentStep?: string;
  stepsTotal?: number;
  steps: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowOverview {
  activeWorkflows: number;
  pendingApprovals: number;
  myTasks: number;
  overdueTasks: number;
  completedToday: number;
  failedWorkflows: number;
  pendingTasks: number;
  failedAutomations: number;
  avgApprovalTimeMs: number;
  avgApprovalTimeHours: number;
  completionRate: number;
  taskLoadByRole: Array<{ role: string; count: number }>;
  taskLoadByBranch: Array<{ branchId: string | null; count: number }>;
  recentActivity: Array<{
    id: string;
    workflowId: string;
    workflowName: string;
    eventType: string;
    stepIndex: number | null;
    createdAt: string;
  }>;
}

export interface WorkflowTaskSummary {
  taskId: string;
  workflowId: string | null;
  title: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface WorkflowApprovalSummary {
  approvalId: string;
  workflowId: string | null;
  title: string;
  status: string;
  mode: string;
  requestedBy: string;
  dueAt: string | null;
  createdAt: string;
}

export interface WorkflowTemplateSummary {
  id: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  category: string | null;
  triggerType: string;
  status: string;
  version: number;
  isSystem: boolean;
  steps: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

function authHeaders(token: string, tenantId: string) {
  return { Authorization: `Bearer ${token}`, 'X-Tenant-Id': tenantId };
}

export async function fetchWorkflowOverview(token: string, tenantId: string, assigneeId?: string) {
  const q = assigneeId ? `?assigneeId=${encodeURIComponent(assigneeId)}` : '';
  return apiRequest<WorkflowOverview>(`/workflows/overview${q}`, {
    headers: authHeaders(token, tenantId),
  });
}

export async function fetchWorkflows(
  token: string,
  tenantId: string,
  params: { status?: string; search?: string; limit?: number; cursor?: string; paginated?: boolean } = {},
) {
  const sp = new URLSearchParams();
  if (params.paginated) sp.set('paginated', 'true');
  if (params.status) sp.set('status', params.status);
  if (params.search) sp.set('search', params.search);
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.cursor) sp.set('cursor', params.cursor);
  const qs = sp.toString();
  return apiRequest<PaginatedResponse<WorkflowSummary> | WorkflowSummary[]>(
    `/workflows${qs ? `?${qs}` : ''}`,
    { headers: authHeaders(token, tenantId) },
  );
}

export async function fetchWorkflow(token: string, tenantId: string, workflowId: string) {
  return apiRequest<WorkflowSummary>(`/workflows/${workflowId}`, {
    headers: authHeaders(token, tenantId),
  });
}

export async function createWorkflow(
  token: string,
  tenantId: string,
  body: {
    nameEn: string;
    nameAr: string;
    descriptionEn: string;
    descriptionAr: string;
    steps: string[];
    branchId?: string | null;
  },
) {
  return apiRequest<{ workflowId: string }>('/workflows', {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify(body),
  });
}

export async function advanceWorkflow(token: string, tenantId: string, workflowId: string, comment?: string) {
  return apiRequest<{ workflowId: string; status: string }>(`/workflows/${workflowId}/advance`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify({ comment: comment ?? null }),
  });
}

export async function cancelWorkflow(token: string, tenantId: string, workflowId: string, reason?: string) {
  return apiRequest<void>(`/workflows/${workflowId}/cancel`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify({ reason: reason ?? null }),
  });
}

export async function fetchWorkflowTasks(
  token: string,
  tenantId: string,
  params: { assigneeId?: string; status?: string; overdueOnly?: boolean; cursor?: string } = {},
) {
  const sp = new URLSearchParams();
  if (params.assigneeId) sp.set('assigneeId', params.assigneeId);
  if (params.status) sp.set('status', params.status);
  if (params.overdueOnly) sp.set('overdueOnly', 'true');
  if (params.cursor) sp.set('cursor', params.cursor);
  const qs = sp.toString();
  return apiRequest<PaginatedResponse<WorkflowTaskSummary>>(`/workflows/tasks${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(token, tenantId),
  });
}

export async function updateWorkflowTask(
  token: string,
  tenantId: string,
  taskId: string,
  body: { status?: string; assigneeId?: string; priority?: string; comment?: string },
) {
  return apiRequest<unknown>(`/workflows/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify(body),
  });
}

export async function fetchWorkflowApprovals(token: string, tenantId: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<WorkflowApprovalSummary[]>(`/workflows/approvals${q}`, {
    headers: authHeaders(token, tenantId),
  });
}

export async function approveWorkflowRequest(
  token: string,
  tenantId: string,
  approvalId: string,
  comment?: string,
) {
  return apiRequest<{ approvalId: string; status: string }>(`/workflows/approvals/${approvalId}/approve`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify({ comment }),
  });
}

export async function rejectWorkflowRequest(
  token: string,
  tenantId: string,
  approvalId: string,
  reason: string,
) {
  return apiRequest<{ approvalId: string; status: string }>(`/workflows/approvals/${approvalId}/reject`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify({ reason }),
  });
}

export async function fetchWorkflowTemplates(token: string, tenantId: string, search?: string) {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest<WorkflowTemplateSummary[]>(`/workflows/templates${q}`, {
    headers: authHeaders(token, tenantId),
  });
}

export async function createWorkflowTemplate(token: string, tenantId: string, body: Record<string, unknown>) {
  return apiRequest<WorkflowTemplateSummary>('/workflows/templates', {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify(body),
  });
}

export async function publishWorkflowTemplate(token: string, tenantId: string, templateId: string) {
  return apiRequest<WorkflowTemplateSummary>(`/workflows/templates/${templateId}/publish`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
  });
}

export async function startWorkflowFromTemplate(token: string, tenantId: string, templateId: string) {
  return apiRequest<{ workflowId: string }>(`/workflows/templates/${templateId}/start`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify({}),
  });
}

export async function fetchWorkflowAutomation(token: string, tenantId: string) {
  return apiRequest<unknown[]>('/workflows/automation', { headers: authHeaders(token, tenantId) });
}

export async function createWorkflowAutomationRule(
  token: string,
  tenantId: string,
  body: { name: string; eventType: string; actionType: string; isActive?: boolean },
) {
  return apiRequest<unknown>('/workflows/automation', {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify(body),
  });
}

export async function fetchWorkflowLogs(token: string, tenantId: string, workflowId?: string) {
  const q = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
  return apiRequest<unknown[]>(`/workflows/logs${q}`, { headers: authHeaders(token, tenantId) });
}

export async function exportWorkflowLogs(token: string, tenantId: string, workflowId?: string) {
  const q = workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : '';
  return apiRequest<{ csv: string; count: number }>(`/workflows/logs/export${q}`, {
    headers: authHeaders(token, tenantId),
  });
}

export async function fetchWorkflowAudit(token: string, tenantId: string, resourceId?: string) {
  const sp = new URLSearchParams();
  if (resourceId) sp.set('resourceId', resourceId);
  const qs = sp.toString();
  return apiRequest<Array<{
    id: string;
    action: string;
    resourceId: string | null;
    actorId: string | null;
    createdAt: string;
  }>>(`/workflows/audit${qs ? `?${qs}` : ''}`, { headers: authHeaders(token, tenantId) });
}

export async function fetchWorkflowSavedFilters(token: string, tenantId: string, scope?: string) {
  const q = scope ? `?scope=${encodeURIComponent(scope)}` : '';
  return apiRequest<Array<{ id: string; name: string; filters: Record<string, unknown> }>>(
    `/workflows/saved-filters${q}`,
    { headers: authHeaders(token, tenantId) },
  );
}

export async function saveWorkflowFilter(
  token: string,
  tenantId: string,
  body: { name: string; filters: Record<string, unknown>; scope?: string },
) {
  return apiRequest<{ id: string }>('/workflows/saved-filters', {
    method: 'POST',
    headers: authHeaders(token, tenantId),
    body: JSON.stringify(body),
  });
}

export async function deleteWorkflowSavedFilter(token: string, tenantId: string, filterId: string) {
  return apiRequest<{ id: string }>(`/workflows/saved-filters/${filterId}/delete`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
  });
}

export async function fetchWorkflowTask(token: string, tenantId: string, taskId: string) {
  return apiRequest<{
    taskId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    workflowName: string | null;
    dueAt: string | null;
    comments: unknown[];
  }>(`/workflows/tasks/${taskId}`, { headers: authHeaders(token, tenantId) });
}

export async function retryFailedWorkflow(token: string, tenantId: string, workflowId: string) {
  return apiRequest<{ workflowId: string; status: string }>(`/workflows/${workflowId}/retry`, {
    method: 'POST',
    headers: authHeaders(token, tenantId),
  });
}
