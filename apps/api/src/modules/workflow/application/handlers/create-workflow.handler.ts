import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateWorkflowCommand } from '../commands/create-workflow.command';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import { WORKFLOW_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { WorkflowCreatedEvent } from '../../domain/events/workflow-created.event';
import { Workflow } from '../../domain/entities/workflow.entity';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';

@Injectable()
export class CreateWorkflowHandler {
  constructor(
    @Inject(WORKFLOW_REPOSITORY) private readonly repository: WorkflowRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async execute(command: CreateWorkflowCommand): Promise<{ workflowId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    await this.enforcement.enforceFeature(tenantId, 'customWorkflows');

    if (!command.nameEn?.trim()) {
      throw new BadRequestException('Workflow nameEn is required');
    }
    if (!command.nameAr?.trim()) {
      throw new BadRequestException('Workflow nameAr is required');
    }
    if (!command.descriptionEn?.trim()) {
      throw new BadRequestException('Workflow descriptionEn is required');
    }
    if (!command.descriptionAr?.trim()) {
      throw new BadRequestException('Workflow descriptionAr is required');
    }
    if (!Array.isArray(command.steps) || !command.steps.length) {
      throw new BadRequestException('Workflow steps are required');
    }
    if (!command.createdBy?.trim()) {
      throw new BadRequestException('CreatedBy is required');
    }

    const workflow = Workflow.create({
      tenantId,
      branchId: command.branchId,
      nameEn: command.nameEn,
      nameAr: command.nameAr,
      descriptionEn: command.descriptionEn,
      descriptionAr: command.descriptionAr,
      steps: command.steps,
      createdBy: command.createdBy,
    });

    await this.repository.save(workflow);
    await this.eventPublisher.publish(
      new WorkflowCreatedEvent(
        tenantId,
        workflow.id,
        workflow.nameEn,
        workflow.nameAr,
        workflow.createdBy,
        workflow.branchId,
      ),
    );

    return { workflowId: workflow.id };
  }
}
