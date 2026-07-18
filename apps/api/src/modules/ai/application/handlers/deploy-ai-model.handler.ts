import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DeployAiModelCommand } from '../commands/deploy-ai-model.command';
import { AiModelRepository } from '../../domain/repositories/ai-model.repository.interface';
import { AI_MODEL_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { AiModelDeployedEvent } from '../../domain/events/ai-model-deployed.event';
import { AiPolicy } from '../../policies/ai-policy.service';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';

@Injectable()
export class DeployAiModelHandler {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repository: AiModelRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly policy: AiPolicy,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async execute(command: DeployAiModelCommand): Promise<void> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    await this.enforcement.enforceFeature(tenantId, 'aiModels');
    if (!command.modelId?.trim()) {
      throw new BadRequestException('Model ID is required');
    }
    if (!command.deployedBy?.trim()) {
      throw new BadRequestException('DeployedBy is required');
    }
    if (!this.policy.canOperateModels(command.deployedByRoles ?? [])) {
      throw new ForbiddenException('User does not have permission to deploy AI models');
    }

    const model = await this.repository.findById(command.modelId, tenantId);
    if (!model) {
      throw new NotFoundException(`AI model ${command.modelId} not found`);
    }

    model.deploy(command.deployedBy);
    await this.repository.save(model);
    await this.eventPublisher.publish(new AiModelDeployedEvent(tenantId, model.id, command.deployedBy));
  }
}
