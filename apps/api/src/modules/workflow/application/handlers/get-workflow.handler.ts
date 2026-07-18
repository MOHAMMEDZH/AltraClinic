import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetWorkflowQuery } from '../queries/get-workflow.query';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import { WORKFLOW_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { WorkflowDto } from '../dto/workflow.dto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetWorkflowHandler {
  constructor(
    @Inject(WORKFLOW_REPOSITORY) private readonly repository: WorkflowRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetWorkflowQuery): Promise<WorkflowDto> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    const workflow = await this.repository.findById(query.workflowId, tenantId);
    if (!workflow) {
      throw new NotFoundException(`Workflow ${query.workflowId} not found`);
    }

    return {
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
    };
  }
}
