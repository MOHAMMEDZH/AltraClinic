/**
 * Release 47 Step 15 — Platform Add-ons & Commercial Overrides HTTP API.
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
import { PlatformAddonsService } from '../application/platform-addons.service';
import { PlatformOverridesService } from '../application/platform-overrides.service';
import { CommercialCompositionService } from '../application/commercial-composition.service';
import type { AddOnLimitEffectType } from '../platform-addons.tokens';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformAddonsController {
  constructor(
    private readonly addons: PlatformAddonsService,
    private readonly overrides: PlatformOverridesService,
    private readonly composition: CommercialCompositionService,
  ) {}

  // ─── Add-ons ──────────────────────────────────────────────────────────────

  @Get('platform/add-ons')
  @Header('Cache-Control', 'private, no-store')
  listAddOns(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: { lifecycle?: string; search?: string; page?: string; pageSize?: string },
  ) {
    return this.addons.listAddOns(user, query);
  }

  @Post('platform/add-ons')
  @Header('Cache-Control', 'private, no-store')
  createAddOn(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      canonicalKey: string;
      translations: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.createAddOn(user, body, idempotencyKey);
  }

  @Get('platform/add-ons/:addOnId')
  @Header('Cache-Control', 'private, no-store')
  getAddOn(@CurrentUser() user: JwtClaimsVO, @Param('addOnId') addOnId: string) {
    return this.addons.getAddOn(user, addOnId);
  }

  @Patch('platform/add-ons/:addOnId')
  @Header('Cache-Control', 'private, no-store')
  updateAddOn(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      translations?: Array<{ locale: string; displayName: string; shortDescription: string }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.updateAddOn(user, addOnId, body, idempotencyKey);
  }

  // No separate reactivate route — ARCHIVED→ACTIVE uses activate (addon.activate).
  @Post('platform/add-ons/:addOnId/activate')
  @Header('Cache-Control', 'private, no-store')
  activateAddOn(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.transitionAddOnLifecycle(user, addOnId, 'ACTIVE', body, idempotencyKey);
  }

  @Post('platform/add-ons/:addOnId/archive')
  @Header('Cache-Control', 'private, no-store')
  archiveAddOn(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.transitionAddOnLifecycle(user, addOnId, 'ARCHIVED', body, idempotencyKey);
  }

  @Get('platform/add-ons/:addOnId/versions')
  @Header('Cache-Control', 'private, no-store')
  listVersions(@CurrentUser() user: JwtClaimsVO, @Param('addOnId') addOnId: string) {
    return this.addons.listVersions(user, addOnId);
  }

  @Get('platform/add-ons/:addOnId/versions/compare')
  @Header('Cache-Control', 'private, no-store')
  compareVersions(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Query('leftId') leftId: string,
    @Query('rightId') rightId: string,
  ) {
    return this.addons.compareVersions(user, addOnId, leftId, rightId);
  }

  @Post('platform/add-ons/:addOnId/versions')
  @Header('Cache-Control', 'private, no-store')
  createDraftVersion(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Body()
    body: {
      translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.createDraftVersion(user, addOnId, body, idempotencyKey);
  }

  @Get('platform/add-ons/:addOnId/versions/:versionId')
  @Header('Cache-Control', 'private, no-store')
  getVersion(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.addons.getVersion(user, addOnId, versionId);
  }

  @Put('platform/add-ons/:addOnId/versions/:versionId/entitlements')
  @Header('Cache-Control', 'private, no-store')
  replaceEntitlements(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; catalogItemIds: string[] },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.replaceEntitlements(user, addOnId, versionId, body, idempotencyKey);
  }

  @Put('platform/add-ons/:addOnId/versions/:versionId/limit-effects')
  @Header('Cache-Control', 'private, no-store')
  replaceLimitEffects(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      effects: Array<{
        catalogItemId: string;
        effectType: AddOnLimitEffectType;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.replaceLimitEffects(user, addOnId, versionId, body, idempotencyKey);
  }

  @Put('platform/add-ons/:addOnId/versions/:versionId/applicability')
  @Header('Cache-Control', 'private, no-store')
  replaceApplicability(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; planCanonicalKeys: string[] },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.replaceApplicability(user, addOnId, versionId, body, idempotencyKey);
  }

  @Get('platform/add-ons/:addOnId/versions/:versionId/readiness')
  @Header('Cache-Control', 'private, no-store')
  versionReadiness(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.addons.getReadiness(user, addOnId, versionId);
  }

  @Post('platform/add-ons/:addOnId/versions/:versionId/publish')
  @Header('Cache-Control', 'private, no-store')
  publishVersion(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.publishVersion(user, addOnId, versionId, body, idempotencyKey);
  }

  // No PATCH draft-version metadata route (addon.updateDraftVersion not implemented).
  @Post('platform/add-ons/:addOnId/versions/:versionId/retire')
  @Header('Cache-Control', 'private, no-store')
  retireVersion(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.retireVersion(user, addOnId, versionId, body, idempotencyKey);
  }

  @Post('platform/add-ons/:addOnId/versions/:versionId/clone')
  @Header('Cache-Control', 'private, no-store')
  cloneVersion(
    @CurrentUser() user: JwtClaimsVO,
    @Param('addOnId') addOnId: string,
    @Param('versionId') versionId: string,
    @Body()
    body: {
      translations?: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.addons.cloneVersion(user, addOnId, versionId, body ?? {}, idempotencyKey);
  }

  // ─── Commercial Overrides ─────────────────────────────────────────────────

  @Get('platform/commercial-overrides')
  @Header('Cache-Control', 'private, no-store')
  listOverrides(
    @CurrentUser() user: JwtClaimsVO,
    @Query() query: { lifecycle?: string; page?: string; pageSize?: string },
  ) {
    return this.overrides.listOverrides(user, query);
  }

  @Post('platform/commercial-overrides')
  @Header('Cache-Control', 'private, no-store')
  createOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      reasonCode: string;
      reasonNote: string;
      effectiveFrom?: string | null;
      expiresAt?: string | null;
      effects: Array<{
        effectKind: string;
        catalogItemId: string;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
      predecessorId?: string | null;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.createOverride(user, body, idempotencyKey);
  }

  @Get('platform/commercial-overrides/compare')
  @Header('Cache-Control', 'private, no-store')
  compareOverrides(
    @CurrentUser() user: JwtClaimsVO,
    @Query('leftId') leftId: string,
    @Query('rightId') rightId: string,
  ) {
    return this.overrides.compare(user, leftId, rightId);
  }

  @Get('platform/commercial-overrides/:overrideId')
  @Header('Cache-Control', 'private, no-store')
  getOverride(@CurrentUser() user: JwtClaimsVO, @Param('overrideId') overrideId: string) {
    return this.overrides.getOverride(user, overrideId);
  }

  // Effects replace is part of updateDraft (no separate override.replaceEffects).
  // No override.expire mutation endpoint.
  @Patch('platform/commercial-overrides/:overrideId')
  @Header('Cache-Control', 'private, no-store')
  updateOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      reasonCode?: string;
      reasonNote?: string;
      effectiveFrom?: string | null;
      expiresAt?: string | null;
      effects?: Array<{
        effectKind: string;
        catalogItemId: string;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.updateDraft(user, overrideId, body, idempotencyKey);
  }

  @Get('platform/commercial-overrides/:overrideId/readiness')
  @Header('Cache-Control', 'private, no-store')
  overrideReadiness(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
  ) {
    return this.overrides.getReadiness(user, overrideId);
  }

  @Post('platform/commercial-overrides/:overrideId/submit')
  @Header('Cache-Control', 'private, no-store')
  submitOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
    @Body() body: { expectedRowVersion: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.submit(user, overrideId, body, idempotencyKey);
  }

  @Post('platform/commercial-overrides/:overrideId/approve')
  @Header('Cache-Control', 'private, no-store')
  approveOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
    @Body() body: { expectedRowVersion: number },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.approve(user, overrideId, body, idempotencyKey);
  }

  @Post('platform/commercial-overrides/:overrideId/reject')
  @Header('Cache-Control', 'private, no-store')
  rejectOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.reject(user, overrideId, body, idempotencyKey);
  }

  @Post('platform/commercial-overrides/:overrideId/revoke')
  @Header('Cache-Control', 'private, no-store')
  revokeOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.revoke(user, overrideId, body, idempotencyKey);
  }

  @Post('platform/commercial-overrides/:overrideId/supersede')
  @Header('Cache-Control', 'private, no-store')
  supersedeOverride(
    @CurrentUser() user: JwtClaimsVO,
    @Param('overrideId') overrideId: string,
    @Body()
    body: {
      reasonCode: string;
      reasonNote: string;
      effectiveFrom?: string | null;
      expiresAt?: string | null;
      effects: Array<{
        effectKind: string;
        catalogItemId: string;
        unlimited?: boolean;
        valueText?: string | null;
      }>;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.overrides.supersede(user, overrideId, body, idempotencyKey);
  }

  // ─── Composition preview ──────────────────────────────────────────────────

  @Post('platform/commercial-composition/preview')
  @Header('Cache-Control', 'private, no-store')
  compositionPreview(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      planVersionId: string;
      addonVersionIds?: string[];
      overrideIds?: string[];
    },
  ) {
    return this.composition.preview(user, body);
  }
}
