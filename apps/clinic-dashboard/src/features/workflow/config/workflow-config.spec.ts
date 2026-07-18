import { describe, expect, it } from 'vitest';
import {
  buildWorkflowPermCheck,
  canApproveWorkflows,
  canCreateWorkflows,
  canManageWorkflows,
  canViewWorkflows,
  WORKFLOW_STATUSES,
  WORKFLOW_TRIGGERS,
} from './workflow-config';

describe('workflow-config', () => {
  it('grants owner full workflow access', () => {
    const perm = buildWorkflowPermCheck(['owner']);
    expect(canViewWorkflows(perm)).toBe(true);
    expect(canCreateWorkflows(perm)).toBe(true);
    expect(canApproveWorkflows(perm)).toBe(true);
    expect(canManageWorkflows(perm)).toBe(true);
  });

  it('denies receptionist manage and approve by default', () => {
    const perm = buildWorkflowPermCheck(['receptionist']);
    expect(canViewWorkflows(perm)).toBe(true);
    expect(canManageWorkflows(perm)).toBe(false);
  });

  it('exports stable workflow statuses and triggers', () => {
    expect(WORKFLOW_STATUSES).toContain('active');
    expect(WORKFLOW_TRIGGERS.length).toBeGreaterThan(5);
  });
});
