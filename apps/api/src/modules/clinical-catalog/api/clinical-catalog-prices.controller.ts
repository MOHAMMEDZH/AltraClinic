import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import {
  CreateClinicalPriceDraftDto,
  ListClinicalPricesQueryDto,
  LookupClinicalPriceQueryDto,
  PublishClinicalPriceDto,
} from '../application/dto/clinical-catalog.dto';

@Controller('clinical-catalog/prices')
export class ClinicalCatalogPricesController {
  constructor(
    private readonly catalog: ClinicalCatalogService,
    private readonly prices: ClinicalPriceVersionService,
  ) {}

  @Get()
  @RequirePermission('api.billing', 'view')
  @Header('Cache-Control', 'private, no-store')
  async listPrices(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: ListClinicalPricesQueryDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.prices.listVersions(actor, {
      clinicalServiceId: query.clinicalServiceId,
      scope: query.scope,
      branchId: query.branchId,
      status: query.status,
    });
  }

  @Get('lookup')
  @RequirePermission('api.billing', 'view')
  @Header('Cache-Control', 'private, no-store')
  async lookup(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: LookupClinicalPriceQueryDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.prices.lookupActivePrice(
      actor,
      query.clinicalServiceId,
      query.branchId ?? null,
      {
        pricingUnit: query.pricingUnit,
        currency: query.currency,
        serviceVariantId: query.serviceVariantId ?? null,
        at: query.at ? new Date(query.at) : undefined,
      },
    );
  }

  @Post('drafts')
  @RequirePermission('api.billing', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async createDraft(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateClinicalPriceDraftDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.prices.createDraft(actor, body);
  }

  @Post(':id/publish')
  @RequirePermission('api.billing', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async publish(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: PublishClinicalPriceDto,
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.prices.publish(actor, id, body.reason);
  }

  @Post(':id/inactivate')
  @RequirePermission('api.billing', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async inactivate(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.prices.inactivate(actor, id);
  }

  @Post(':id/replace-scheduled')
  @RequirePermission('api.billing', 'manage')
  @Header('Cache-Control', 'private, no-store')
  async replaceScheduled(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { replacementDraftId: string },
  ) {
    const actor = await this.catalog.resolveTenantActor(user.sub, user.roles);
    return this.prices.replaceScheduled(actor, id, body.replacementDraftId);
  }
}
