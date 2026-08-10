/**
 * Release 47 Step 13 — Platform Plans HTTP API.
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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAuthRoute } from '../../auth/api/decorators/platform-auth-route.decorator';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { CurrentUser } from '../../auth/api/decorators/current-user.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformPlansService } from '../application/platform-plans.service';
import { PlanEntitlementsService } from '../application/plan-entitlements.service';

@Controller('platform/plans')
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformPlansController {
  constructor(
    private readonly plans: PlatformPlansService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  listPlans(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: { lifecycle?: string; search?: string; page?: string; pageSize?: string },
  ) {
    return this.plans.listPlans(user, query);
  }

  @Get('legacy-mappings')
  @Header('Cache-Control', 'private, no-store')
  legacyMappings(@CurrentUser() user: JwtClaimsVO) {
    return this.plans.getLegacyMappings(user);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  createPlan(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      canonicalKey: string;
      sortOrder?: number;
      translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.plans.createPlan(user, body, idempotencyKey);
  }

  @Get(':planId')
  @Header('Cache-Control', 'private, no-store')
  getPlan(@CurrentUser() user: JwtClaimsVO, @Param('planId') planId: string) {
    return this.plans.getPlan(user, planId);
  }

  @Patch(':planId')
  @Header('Cache-Control', 'private, no-store')
  updatePlan(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Body()
    body: {
      expectedVersion: number;
      sortOrder?: number;
      translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
  ) {
    return this.plans.updatePlan(user, planId, body);
  }

  @Post(':planId/activate')
  @Header('Cache-Control', 'private, no-store')
  activate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Body() body: { expectedVersion: number; reason: string },
  ) {
    return this.plans.transitionPlanLifecycle(user, planId, 'ACTIVE', body);
  }

  @Post(':planId/archive')
  @Header('Cache-Control', 'private, no-store')
  archive(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Body() body: { expectedVersion: number; reason: string },
  ) {
    return this.plans.transitionPlanLifecycle(user, planId, 'ARCHIVED', body);
  }

  @Post(':planId/reactivate')
  @Header('Cache-Control', 'private, no-store')
  reactivate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Body() body: { expectedVersion: number; reason: string },
  ) {
    return this.plans.transitionPlanLifecycle(user, planId, 'ACTIVE', body);
  }

  @Get(':planId/references')
  @Header('Cache-Control', 'private, no-store')
  references(@CurrentUser() user: JwtClaimsVO, @Param('planId') planId: string) {
    return this.plans.getReferences(user, planId);
  }

  @Post(':planId/aliases')
  @Header('Cache-Control', 'private, no-store')
  addAlias(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Body()
    body: {
      aliasValue: string;
      sourceNamespace: string;
      migrationNote?: string;
      expectedVersion: number;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.plans.addAlias(user, planId, { ...body, idempotencyKey });
  }

  @Post(':planId/aliases/:aliasId/retire')
  @Header('Cache-Control', 'private, no-store')
  retireAlias(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('aliasId') aliasId: string,
    @Body() body: { expectedVersion: number; reason: string },
  ) {
    return this.plans.retireAlias(user, planId, aliasId, body);
  }

  @Get(':planId/versions')
  @Header('Cache-Control', 'private, no-store')
  listVersions(@CurrentUser() user: JwtClaimsVO, @Param('planId') planId: string) {
    return this.plans.listVersions(user, planId);
  }

  @Get(':planId/versions/compare')
  @Header('Cache-Control', 'private, no-store')
  compare(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Query('leftId') leftId: string,
    @Query('rightId') rightId: string,
  ) {
    return this.plans.compareVersions(user, planId, leftId, rightId);
  }

  @Post(':planId/versions')
  @Header('Cache-Control', 'private, no-store')
  createDraft(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Body()
    body: {
      translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      effectiveFrom?: string | null;
      trialDefaultEnabled?: boolean | null;
      trialDefaultDays?: number | null;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.plans.createDraftVersion(user, planId, body, idempotencyKey);
  }

  @Get(':planId/versions/:versionId')
  @Header('Cache-Control', 'private, no-store')
  getVersion(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.plans.getVersion(user, planId, versionId);
  }

  @Patch(':planId/versions/:versionId')
  @Header('Cache-Control', 'private, no-store')
  updateDraft(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
      effectiveFrom?: string | null;
      trialDefaultEnabled?: boolean | null;
      trialDefaultDays?: number | null;
      internalReleaseNotes?: string | null;
    },
  ) {
    return this.plans.updateDraftVersion(user, planId, versionId, body);
  }

  @Get(':planId/versions/:versionId/entitlements')
  @Header('Cache-Control', 'private, no-store')
  getEntitlements(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.entitlements.getEntitlements(user, planId, versionId);
  }

  @Put(':planId/versions/:versionId/entitlements')
  @Header('Cache-Control', 'private, no-store')
  putEntitlements(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      entitlementKeys?: string[];
      grants?: Array<{ canonicalKey: string; kind?: string }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.entitlements.putEntitlements(user, planId, versionId, body, idempotencyKey);
  }

  @Post(':planId/versions/:versionId/entitlements/apply-required')
  @Header('Cache-Control', 'private, no-store')
  applyRequired(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; confirm?: boolean },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.entitlements.applyRequiredDependencies(
      user,
      planId,
      versionId,
      body,
      idempotencyKey,
    );
  }

  @Get(':planId/versions/:versionId/limits')
  @Header('Cache-Control', 'private, no-store')
  getLimits(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.entitlements.getLimits(user, planId, versionId);
  }

  @Put(':planId/versions/:versionId/limits')
  @Header('Cache-Control', 'private, no-store')
  putLimits(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      limits?: Array<{ canonicalKey: string; unlimited: boolean; valueText?: string | null }>;
      assignments?: Array<{
        canonicalKey: string;
        state: string;
        value?: string | null;
      }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.entitlements.putLimits(user, planId, versionId, body, idempotencyKey);
  }

  @Get(':planId/versions/:versionId/entitlement-preview')
  @Header('Cache-Control', 'private, no-store')
  entitlementPreview(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.entitlements.getEntitlementPreview(user, planId, versionId);
  }

  @Post(':planId/versions/:versionId/clone')
  @Header('Cache-Control', 'private, no-store')
  clone(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.plans.cloneVersion(user, planId, versionId, idempotencyKey);
  }

  @Get(':planId/versions/:versionId/readiness')
  @Header('Cache-Control', 'private, no-store')
  readiness(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.plans.getReadiness(user, planId, versionId);
  }

  @Post(':planId/versions/:versionId/publish')
  @Header('Cache-Control', 'private, no-store')
  publish(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.plans.publishVersion(user, planId, versionId, body, idempotencyKey);
  }

  @Post(':planId/versions/:versionId/retire')
  @Header('Cache-Control', 'private, no-store')
  retire(
    @CurrentUser() user: JwtClaimsVO,
    @Param('planId') planId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
  ) {
    return this.plans.retireVersion(user, planId, versionId, body);
  }
}
