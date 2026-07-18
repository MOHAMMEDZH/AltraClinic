import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { ListAiModelsQuery } from '../queries/list-ai-models.query';
import { AiModelRepository } from '../../domain/repositories/ai-model.repository.interface';
import { AI_MODEL_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AiModelDto } from '../dto/ai-model.dto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListAiModelsHandler {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repository: AiModelRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListAiModelsQuery): Promise<AiModelDto[]> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      return [];
    }

    const models = await this.repository.list({
      tenantId,
      branchId: query.branchId,
      modelType: query.modelType,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });

    return models.map((model) => ({
      modelId: model.id,
      tenantId: model.tenantId,
      branchId: model.branchId,
      nameEn: model.nameEn,
      nameAr: model.nameAr,
      descriptionEn: model.descriptionEn,
      descriptionAr: model.descriptionAr,
      modelType: model.modelType,
      version: model.version,
      status: model.status.value,
      createdBy: model.createdBy,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
      validatedBy: model.validatedBy,
      validatedAt: model.validatedAt?.toISOString() ?? null,
      validationNotes: model.validationNotes,
      deployedBy: model.deployedBy,
      deployedAt: model.deployedAt?.toISOString() ?? null,
      retiredBy: model.retiredBy,
      retiredAt: model.retiredAt?.toISOString() ?? null,
    }));
  }
}
