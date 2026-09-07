import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { RequirePlatformPermission } from '../../auth/api/decorators/require-platform-permission.decorator';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import {
  CreateClinicalServiceDraftDto,
  ListClinicalServicesQueryDto,
  UpdateClinicalServiceDraftDto,
} from '../application/dto/clinical-catalog.dto';

@Controller('platform/clinical-catalog')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformClinicalCatalogController {
  constructor(private readonly catalog: ClinicalCatalogService) {}

  @Get('services')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  listServices(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: ListClinicalServicesQueryDto,
  ) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.listServices(actor, query);
  }

  @Post('services')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  createDraft(@CurrentUser() user: JwtClaimsVO, @Body() body: CreateClinicalServiceDraftDto) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.createDraft(actor, body);
  }

  @Get('services/:id')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  getService(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.getService(actor, id);
  }

  @Patch('services/:id')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  updateDraft(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: UpdateClinicalServiceDraftDto,
  ) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.updateDraft(actor, id, body);
  }

  @Post('services/:id/publish')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  publish(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.publish(actor, id);
  }

  @Post('services/:id/deprecate')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  deprecate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.deprecate(actor, id);
  }

  @Post('services/:id/inactivate')
  @RequirePlatformPermission('clinical_catalog.admin')
  @Header('Cache-Control', 'private, no-store')
  inactivate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = this.catalog.platformActor(user.sub, user.roles);
    return this.catalog.inactivate(actor, id);
  }
}
