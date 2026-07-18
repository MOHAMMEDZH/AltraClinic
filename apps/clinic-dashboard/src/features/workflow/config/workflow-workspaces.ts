export type WorkflowStepType = (typeof STEP_TYPES)[number];

export interface WorkflowStepDef {
  id?: string;
  type: WorkflowStepType;
  labelEn: string;
  labelAr?: string;
  branchCondition?: string;
  config?: Record<string, unknown>;
}

export type WorkflowWorkspaceId =
  | 'reception'
  | 'clinical'
  | 'inventory'
  | 'accountant'
  | 'manager'
  | 'owner'
  | 'super_admin';

export const WORKFLOW_WORKSPACES: Array<{
  id: WorkflowWorkspaceId;
  roles: string[];
  links: Array<{ to: string; labelKey: string }>;
}> = [
  {
    id: 'reception',
    roles: ['receptionist', 'assistant'],
    links: [
      { to: '/workflows/tasks?tab=my', labelKey: 'workflow.workspaces.links.appointments' },
      { to: '/workflows/tasks?overdue=true', labelKey: 'workflow.workspaces.links.followUps' },
    ],
  },
  {
    id: 'clinical',
    roles: ['doctor', 'dentist', 'specialist', 'nurse'],
    links: [
      { to: '/workflows/approvals', labelKey: 'workflow.workspaces.links.treatmentPlans' },
      { to: '/workflows/tasks', labelKey: 'workflow.workspaces.links.clinicalTasks' },
    ],
  },
  {
    id: 'inventory',
    roles: ['inventory_manager'],
    links: [
      { to: '/workflows/tasks?tab=overdue', labelKey: 'workflow.workspaces.links.lowStock' },
      { to: '/workflows/approvals', labelKey: 'workflow.workspaces.links.purchaseOrders' },
    ],
  },
  {
    id: 'accountant',
    roles: ['accountant'],
    links: [
      { to: '/workflows/approvals', labelKey: 'workflow.workspaces.links.refunds' },
      { to: '/workflows/tasks', labelKey: 'workflow.workspaces.links.payments' },
    ],
  },
  {
    id: 'manager',
    roles: ['general_manager', 'branch_manager'],
    links: [
      { to: '/workflows/monitoring', labelKey: 'workflow.workspaces.links.bottlenecks' },
      { to: '/workflows/approvals', labelKey: 'workflow.workspaces.links.approvalQueue' },
    ],
  },
  {
    id: 'owner',
    roles: ['owner'],
    links: [
      { to: '/workflows/approvals', labelKey: 'workflow.workspaces.links.criticalApprovals' },
      { to: '/workflows/monitoring', labelKey: 'workflow.workspaces.links.executive' },
    ],
  },
  {
    id: 'super_admin',
    roles: ['super_admin'],
    links: [
      { to: '/workflows/automation', labelKey: 'workflow.workspaces.links.platformAutomation' },
      { to: '/workflows/audit', labelKey: 'workflow.workspaces.links.systemAudit' },
    ],
  },
];

export function resolveDefaultWorkspace(roles: string[]): WorkflowWorkspaceId {
  for (const ws of WORKFLOW_WORKSPACES) {
    if (ws.roles.some((r) => roles.includes(r))) return ws.id;
  }
  return 'manager';
}
