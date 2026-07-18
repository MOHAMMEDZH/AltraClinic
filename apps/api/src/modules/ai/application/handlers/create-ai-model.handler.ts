import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateAiModelCommand } from '../commands/create-ai-model.command';
import { AiModelRepository } from '../../domain/repositories/ai-model.repository.interface';
import { AI_MODEL_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { AiModelCreatedEvent } from '../../domain/events/ai-model-created.event';
import { AiModel } from '../../domain/entities/ai-model.entity';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';

@Injectable()
export class CreateAiModelHandler {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repository: AiModelRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async execute(command: CreateAiModelCommand): Promise<{ modelId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    await this.enforcement.enforceFeature(tenantId, 'aiModels');

    if (!command.nameEn?.trim()) {
      throw new BadRequestException('Model nameEn is required');
    }
    if (!command.nameAr?.trim()) {
      throw new BadRequestException('Model nameAr is required');
    }
    if (!command.descriptionEn?.trim()) {
      throw new BadRequestException('Model descriptionEn is required');
    }
    if (!command.descriptionAr?.trim()) {
      throw new BadRequestException('Model descriptionAr is required');
    }
    if (!command.modelType?.trim()) {
      throw new BadRequestException('Model modelType is required');
    }
    if (!command.version?.trim()) {
      throw new BadRequestException('Model version is required');
    }
    if (!command.createdBy?.trim()) {
      throw new BadRequestException('CreatedBy is required');
    }

    const model = AiModel.create({
      tenantId,
      branchId: command.branchId,
      nameEn: command.nameEn,
      nameAr: command.nameAr,
      descriptionEn: command.descriptionEn,
      descriptionAr: command.descriptionAr,
      modelType: command.modelType,
      version: command.version,
      createdBy: command.createdBy,
    });

    await this.repository.save(model);
    await this.eventPublisher.publish(
      new AiModelCreatedEvent(
        tenantId,
        model.id,
        model.nameEn,
        model.nameAr,
        model.modelType,
        model.version,
        model.createdBy,
        model.branchId,
      ),
    );

    return { modelId: model.id };
  }
}
