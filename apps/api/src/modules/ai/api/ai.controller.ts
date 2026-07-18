import { Body, Controller, Get, Param, Post, Query, Req, UseFilters, UseGuards } from '@nestjs/common';
import { CreateAiModelDto } from '../application/dto/create-ai-model.dto';
import { ValidateAiModelDto } from '../application/dto/validate-ai-model.dto';
import { CreateAiModelHandler } from '../application/handlers/create-ai-model.handler';
import { ValidateAiModelHandler } from '../application/handlers/validate-ai-model.handler';
import { DeployAiModelHandler } from '../application/handlers/deploy-ai-model.handler';
import { RetireAiModelHandler } from '../application/handlers/retire-ai-model.handler';
import { GetAiModelHandler } from '../application/handlers/get-ai-model.handler';
import { ListAiModelsHandler } from '../application/handlers/list-ai-models.handler';
import { AiPermissionGuard } from './ai-permission.guard';
import { AiAccessGuard } from './ai-access.guard';
import { AiDomainExceptionFilter } from './ai-domain-exception.filter';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';

interface AuthenticatedRequest {
  user?: { id: string; roles: string[]; tenantId?: string };
}

@Controller('ai/models')
@UseGuards(AiAccessGuard)
@UseFilters(AiDomainExceptionFilter)
@RequireLicensedModule('ai')
export class AiController {
  constructor(
    private readonly createModelHandler: CreateAiModelHandler,
    private readonly validateModelHandler: ValidateAiModelHandler,
    private readonly deployModelHandler: DeployAiModelHandler,
    private readonly retireModelHandler: RetireAiModelHandler,
    private readonly getModelHandler: GetAiModelHandler,
    private readonly listModelsHandler: ListAiModelsHandler,
  ) {}

  @Post()
  @RequirePermission('api.ai', 'create')
  async create(@Body() body: CreateAiModelDto, @Req() request: AuthenticatedRequest) {
    return await this.createModelHandler.execute({
      nameEn: body.nameEn,
      nameAr: body.nameAr,
      descriptionEn: body.descriptionEn,
      descriptionAr: body.descriptionAr,
      modelType: body.modelType,
      version: body.version,
      branchId: body.branchId ?? null,
      createdBy: request.user?.id ?? '',
    });
  }

  @Post(':modelId/validate')
  @RequirePermission('api.ai', 'approve')
  async validate(
    @Param('modelId') modelId: string,
    @Body() body: ValidateAiModelDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return await this.validateModelHandler.execute({
      modelId,
      validatedBy: request.user?.id ?? '',
      validatedByRoles: request.user?.roles ?? [],
      notes: body?.notes?.trim() || null,
    });
  }

  @Post(':modelId/deploy')
  @RequirePermission('api.ai', 'approve')
  async deploy(@Param('modelId') modelId: string, @Req() request: AuthenticatedRequest) {
    return await this.deployModelHandler.execute({
      modelId,
      deployedBy: request.user?.id ?? '',
      deployedByRoles: request.user?.roles ?? [],
    });
  }

  @Post(':modelId/retire')
  @RequirePermission('api.ai', 'delete')
  async retire(@Param('modelId') modelId: string, @Req() request: AuthenticatedRequest) {
    return await this.retireModelHandler.execute({
      modelId,
      retiredBy: request.user?.id ?? '',
      retiredByRoles: request.user?.roles ?? [],
    });
  }

  @Get(':modelId')
  @RequirePermission('api.ai', 'view')
  async get(@Param('modelId') modelId: string) {
    return await this.getModelHandler.execute({ modelId });
  }

  @Get()
  @RequirePermission('api.ai', 'view')
  async list(
    @Query('branchId') branchId?: string,
    @Query('modelType') modelType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listModelsHandler.execute({
      branchId: branchId?.trim() || null,
      modelType: modelType?.trim() || null,
      status: status?.trim() || null,
      limit: Number.isNaN(Number(limit)) ? 50 : Math.max(Number(limit), 1),
      offset: Number.isNaN(Number(offset)) ? 0 : Math.max(Number(offset), 0),
    });
  }
}
