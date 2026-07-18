import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AdvanceWorkflowCommand } from '../commands/advance-workflow.command';
import { WorkflowRepository } from '../../domain/repositories/workflow.repository.interface';
import { WORKFLOW_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { WorkflowAdvancedEvent } from '../../domain/events/workflow-advanced.event';

@Injectable()
export class AdvanceWorkflowHandler {
  constructor(
    @Inject(WORKFLOW_REPOSITORY) private readonly repository: WorkflowRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: AdvanceWorkflowCommand): Promise<void> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    if (!command.workflowId?.trim()) {
      throw new BadRequestException('Workflow ID is required');
    }
    if (!command.actionedBy?.trim()) {
      throw new BadRequestException('ActionedBy is required');
    }

    const workflow = await this.repository.findById(command.workflowId, tenantId);
    if (!workflow) {
      throw new NotFoundException(`Workflow ${command.workflowId} not found`);
    }

    workflow.advance(command.actionedBy, command.comment);
    await this.repository.save(workflow);
    await this.eventPublisher.publish(
      new WorkflowAdvancedEvent(
        tenantId,
        workflow.id,
        command.actionedBy,
        workflow.currentStepIndex,
        workflow.status.value,
        command.comment,
      ),
    );
  }
}
