import { Injectable } from '@nestjs/common';
import { Workflow } from '../domain/entities/workflow.entity';
import { WorkflowRepository, WorkflowFilter } from '../domain/repositories/workflow.repository.interface';

@Injectable()
export class InMemoryWorkflowRepository implements WorkflowRepository {
  private readonly items: Workflow[] = [];

  async save(workflow: Workflow): Promise<void> {
    const index = this.items.findIndex((item) => item.id === workflow.id && item.tenantId === workflow.tenantId);
    if (index >= 0) {
      this.items[index] = workflow;
      return;
    }

    this.items.push(workflow);
  }

  async findById(workflowId: string, tenantId: string): Promise<Workflow | null> {
    return this.items.find((item) => item.id === workflowId && item.tenantId === tenantId) ?? null;
  }

  async list(filter: WorkflowFilter): Promise<Workflow[]> {
    const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
    const offset = filter.offset && filter.offset >= 0 ? filter.offset : 0;

    return this.items
      .filter((item) => item.tenantId === filter.tenantId)
      .filter((item) => (filter.branchId ? item.branchId === filter.branchId : true))
      .filter((item) => (filter.status ? item.status.value === filter.status : true))
      .slice(offset, offset + limit);
  }
}
