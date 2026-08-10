/**
 * Release 47 Step 12 — Healthcare Catalog Platform API.
 *
 * Route-level `@RequirePlatformPermission` is omitted for kind-polymorphic
 * endpoints; `HealthcareCatalogService` enforces resource-scoped permissions
 * (facility-type|specialty|module|feature|limit|compatibility-rule).
 * High-impact lifecycle transitions require fresh server-side step-up.
 */
import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { HealthcareCatalogService } from '../application/healthcare-catalog.service';
import type {
  AddCatalogAliasRequestDto,
  CreateCatalogItemRequestDto,
  LifecycleTransitionRequestDto,
  RetireCatalogAliasRequestDto,
  UpdateCatalogItemRequestDto,
  ValidateSelectionRequestDto,
} from '../application/dto/catalog.dto';

@Controller('platform/healthcare-catalog')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformHealthcareCatalogController {
  constructor(private readonly catalog: HealthcareCatalogService) {}

  @Get('items')
  @Header('Cache-Control', 'private, no-store')
  listItems(
    @CurrentUser() user: JwtClaimsVO,
    @Query()
    query: {
      kind?: string;
      lifecycle?: string;
      search?: string;
      missingTranslation?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    return this.catalog.listItems(user, query);
  }

  @Post('items')
  @Header('Cache-Control', 'private, no-store')
  createItem(
    @CurrentUser() user: JwtClaimsVO,
    @Body() body: CreateCatalogItemRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.catalog.createItem(user, body, idempotencyKey);
  }

  @Get('items/:id')
  @Header('Cache-Control', 'private, no-store')
  getItem(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.catalog.getItem(user, id);
  }

  @Patch('items/:id')
  @Header('Cache-Control', 'private, no-store')
  updateItem(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: UpdateCatalogItemRequestDto,
  ) {
    return this.catalog.updateItem(user, id, body);
  }

  @Post('items/:id/activate')
  @Header('Cache-Control', 'private, no-store')
  activate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: LifecycleTransitionRequestDto,
  ) {
    return this.catalog.transitionLifecycle(user, id, 'ACTIVE', body);
  }

  @Post('items/:id/deprecate')
  @Header('Cache-Control', 'private, no-store')
  deprecate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: LifecycleTransitionRequestDto,
  ) {
    return this.catalog.transitionLifecycle(user, id, 'DEPRECATED', body);
  }

  @Post('items/:id/retire')
  @Header('Cache-Control', 'private, no-store')
  retire(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: LifecycleTransitionRequestDto,
  ) {
    return this.catalog.transitionLifecycle(user, id, 'RETIRED', body);
  }

  @Post('items/:id/reactivate')
  @Header('Cache-Control', 'private, no-store')
  reactivate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: LifecycleTransitionRequestDto,
  ) {
    return this.catalog.transitionLifecycle(user, id, 'ACTIVE', body);
  }

  @Post('items/:id/aliases')
  @Header('Cache-Control', 'private, no-store')
  addAlias(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: AddCatalogAliasRequestDto,
  ) {
    return this.catalog.addAlias(user, id, body);
  }

  @Post('items/:id/aliases/:aliasId/retire')
  @Header('Cache-Control', 'private, no-store')
  retireAlias(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Param('aliasId') aliasId: string,
    @Body() body: RetireCatalogAliasRequestDto,
  ) {
    return this.catalog.retireAlias(user, id, aliasId, body);
  }

  @Get('items/:id/references')
  @Header('Cache-Control', 'private, no-store')
  references(@CurrentUser() user: JwtClaimsVO, @Param('id') id: string) {
    return this.catalog.getReferences(user, id);
  }

  @Get('compatibility-rules')
  @Header('Cache-Control', 'private, no-store')
  listRules(@CurrentUser() user: JwtClaimsVO) {
    return this.catalog.listRules(user);
  }

  @Post('compatibility-rules')
  @Header('Cache-Control', 'private, no-store')
  createRule(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      ruleType: string;
      subjectKey: string;
      targetKey: string;
      anyOfGroupKey?: string;
      explanationEn: string;
      explanationAr: string;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.catalog.createRule(user, body, idempotencyKey);
  }

  @Post('compatibility-rules/:id/activate')
  @Header('Cache-Control', 'private, no-store')
  activateRule(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { expectedVersion: number; reason: string },
  ) {
    return this.catalog.transitionRuleLifecycle(
      user,
      id,
      'ACTIVE',
      body.expectedVersion,
      body.reason,
    );
  }

  @Post('compatibility-rules/:id/retire')
  @Header('Cache-Control', 'private, no-store')
  retireRule(
    @CurrentUser() user: JwtClaimsVO,
    @Param('id') id: string,
    @Body() body: { expectedVersion: number; reason: string },
  ) {
    return this.catalog.transitionRuleLifecycle(
      user,
      id,
      'RETIRED',
      body.expectedVersion,
      body.reason,
    );
  }

  @Post('validate-selection')
  @Header('Cache-Control', 'private, no-store')
  validate(@CurrentUser() user: JwtClaimsVO, @Body() body: ValidateSelectionRequestDto) {
    return this.catalog.validateSelection(user, body);
  }

  @Get('drift-report')
  @Header('Cache-Control', 'private, no-store')
  drift(@CurrentUser() user: JwtClaimsVO) {
    return this.catalog.driftReport(user);
  }
}
