import { Inject, Injectable } from '@nestjs/common';
import { ListWorkflowsQuery } from '../queries/list-workflows.query';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import { WORKFLOW_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { WorkflowDto } from '../dto/workflow.dto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListWorkflowsHandler {
  constructor(
    @Inject(WORKFLOW_REPOSITORY) private readonly repository: WorkflowRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListWorkflowsQuery): Promise<WorkflowDto[]> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      return [];
    }

    const workflows = await this.repository.list({
      tenantId,
      branchId: query.branchId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    return workflows.map((workflow) => ({
      workflowId: workflow.id,
      tenantId: workflow.tenantId,
      branchId: workflow.branchId,
      nameEn: workflow.nameEn,
      nameAr: workflow.nameAr,
      descriptionEn: workflow.descriptionEn,
      descriptionAr: workflow.descriptionAr,
      steps: workflow.steps,
      currentStepIndex: workflow.currentStepIndex,
      currentStep: workflow.currentStep,
      status: workflow.status.value,
      createdBy: workflow.createdBy,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
      canceledBy: workflow.canceledBy,
      canceledAt: workflow.canceledAt?.toISOString() ?? null,
      cancelReason: workflow.cancelReason,
    }));
  }
}
