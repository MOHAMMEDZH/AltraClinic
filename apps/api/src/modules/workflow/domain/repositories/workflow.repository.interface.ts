import { Workflow } from '../entities/workflow.entity';

export interface WorkflowFilter {
  tenantId: string;
  branchId?: string | null;
  status?: string | null;
  limit?: number;
  offset?: number;
}

export interface WorkflowRepository {
  save(workflow: Workflow): Promise<void>;
  findById(workflowId: string, tenantId: string): Promise<Workflow | null>;
  list(filter: WorkflowFilter): Promise<Workflow[]>;
}
