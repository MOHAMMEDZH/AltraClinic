import { hasPermission } from '@booking/permissions';

export type WorkflowPermAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

export function buildWorkflowPermCheck(roles: string[]) {
  return (action: WorkflowPermAction) => hasPermission(roles, 'api.workflow', action);
}

export function canViewWorkflows(perm: ReturnType<typeof buildWorkflowPermCheck>) {
  return perm('view');
}

export function canCreateWorkflows(perm: ReturnType<typeof buildWorkflowPermCheck>) {
  return perm('create');
}

export function canManageWorkflows(perm: ReturnType<typeof buildWorkflowPermCheck>) {
  return perm('manage');
}

export function canApproveWorkflows(perm: ReturnType<typeof buildWorkflowPermCheck>) {
  return perm('approve');
}

export function canUpdateWorkflows(perm: ReturnType<typeof buildWorkflowPermCheck>) {
  return perm('update');
}

export const WORKFLOW_STATUSES = ['active', 'completed', 'canceled', 'failed', 'paused'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const TASK_STATUSES = [
  'pending', 'assigned', 'in_progress', 'waiting_approval', 'completed', 'rejected', 'overdue', 'escalated',
] as const;

/** Kanban board column order (presentation). */
export const KANBAN_COLUMNS = TASK_STATUSES;

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;

export const WORKFLOW_TRIGGERS = [
  'patient.registered',
  'appointment.created',
  'appointment.cancelled',
  'invoice.created',
  'payment.received',
  'inventory.low_stock',
  'subscription.expiring',
  'user.created',
  'security.alert',
] as const;

export const TEMPLATE_CATEGORIES = ['clinical', 'financial', 'inventory', 'administrative', 'subscription', 'security'] as const;

export const STEP_TYPES = ['task', 'approval', 'notification', 'delay', 'escalation', 'automation', 'webhook'] as const;
export type WorkflowStepType = (typeof STEP_TYPES)[number];

export interface WorkflowStepDef {
  id?: string;
  type: WorkflowStepType;
  labelEn: string;
  labelAr?: string;
  branchCondition?: string;
  config?: Record<string, unknown>;
}

export { WORKFLOW_WORKSPACES, resolveDefaultWorkspace } from './workflow-workspaces';
export type { WorkflowWorkspaceId } from './workflow-workspaces';
