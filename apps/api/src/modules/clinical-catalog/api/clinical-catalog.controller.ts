import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import {
  CreateClinicalServiceDraftDto,
  ListClinicalServicesQueryDto,
  UpdateClinicalServiceDraftDto,
} from '../application/dto/clinical-catalog.dto';

@Controller('clinical-catalog')
export class ClinicalCatalogController {
  constructor(private readonly catalog: ClinicalCatalogService) {}

  @Get('services')
  @RequirePermission('api.clinical-catalog', 'view')
  @Header('Cache-Control', 'private, no-store')
  async listServices(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: ListClinicalServicesQueryDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.listServices(actor, query);
  }

  @Post('services')
  @RequirePermission('api.clinical-catalog', 'create')
  @Header('Cache-Control', 'private, no-store')
  async createDraft(@CurrentUser() user: JwtClaimsVO, @Body() body: CreateClinicalServiceDraftDto) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.createDraft(actor, { ...body, provenance: 'TENANT_CUSTOM' });
  }

  @Get('services/:id')
  @RequirePermission('api.clinical-catalog', 'view')
  @Header('Cache-Control', 'private, no-store')
  async getService(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.getService(actor, id);
  }

  @Patch('services/:id')
  @RequirePermission('api.clinical-catalog', 'update')
  @Header('Cache-Control', 'private, no-store')
  async updateDraft(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: UpdateClinicalServiceDraftDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.updateDraft(actor, id, body);
  }

  @Post('services/:id/publish')
  @RequirePermission('api.clinical-catalog', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async publish(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.publish(actor, id);
  }

  @Post('services/:id/deprecate')
  @RequirePermission('api.clinical-catalog', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async deprecate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.deprecate(actor, id);
  }

  @Post('services/:id/inactivate')
  @RequirePermission('api.clinical-catalog', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async inactivate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.catalog.inactivate(actor, id);
  }
}
