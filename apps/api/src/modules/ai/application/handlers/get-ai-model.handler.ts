import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetAiModelQuery } from '../queries/get-ai-model.query';
import { AiModelRepository } from '../../domain/repositories/ai-model.repository.interface';
import { AI_MODEL_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { AiModelDto } from '../dto/ai-model.dto';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class GetAiModelHandler {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repository: AiModelRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: GetAiModelQuery): Promise<AiModelDto> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('Tenant context could not be resolved');
    }

    const model = await this.repository.findById(query.modelId, tenantId);
    if (!model) {
      throw new NotFoundException(`AI model ${query.modelId} not found`);
    }

    return {
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
    };
  }
}
