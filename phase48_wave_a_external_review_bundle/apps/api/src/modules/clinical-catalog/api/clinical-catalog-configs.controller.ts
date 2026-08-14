import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import { TenantServiceConfigService } from '../application/tenant-service-config.service';
import type { UpsertTenantServiceConfigDto } from '../application/dto/clinical-catalog.dto';

@Controller('clinical-catalog/configs')
export class ClinicalCatalogConfigsController {
  constructor(
    private readonly catalog: ClinicalCatalogService,
    private readonly configs: TenantServiceConfigService,
  ) {}

  @Get()
  @RequirePermission('api.clinical-catalog', 'view')
  @Header('Cache-Control', 'private, no-store')
  async listConfigs(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: { clinicalServiceId?: string; branchId?: string },
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.configs.listConfigs(actor, query);
  }

  @Get('effective')
  @RequirePermission('api.clinical-catalog', 'view')
  @Header('Cache-Control', 'private, no-store')
  async effectiveConfig(
    @CurrentUser() user: JwtClaimsVO,
    @Query('clinicalServiceId') clinicalServiceId: string,
    @Query('branchId') branchId?: string,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.configs.getEffectiveConfig(actor, clinicalServiceId, branchId ?? null);
  }

  @Put()
  @RequirePermission('api.clinical-catalog', 'update')
  @Header('Cache-Control', 'private, no-store')
  async upsertConfig(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: UpsertTenantServiceConfigDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.configs.upsertConfig(actor, body);
  }

  @Patch(':id/enabled')
  @RequirePermission('api.clinical-catalog', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async setEnabled(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.configs.setEnabled(actor, id, body.enabled);
  }
}
