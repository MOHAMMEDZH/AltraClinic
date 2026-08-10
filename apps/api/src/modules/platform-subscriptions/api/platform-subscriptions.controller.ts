/**
 * Release 47 Step 16 — Platform Subscription Commercial Assignment HTTP API.
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
import { PlatformSubscriptionsService } from '../application/platform-subscriptions.service';

@Controller()
@PlatformAuthRoute()
@UseGuards(PlatformPermissionGuard)
export class PlatformSubscriptionsController {
  constructor(private readonly subscriptions: PlatformSubscriptionsService) {}

  @Get('platform/subscriptions')
  @Header('Cache-Control', 'private, no-store')
  list(
    @CurrentUser() user: JwtClaimsVO,
    @Query()
    query: { lifecycle?: string; platformTenantId?: string; page?: string; pageSize?: string },
  ) {
    return this.subscriptions.list(user, query);
  }

  @Post('platform/subscriptions')
  @Header('Cache-Control', 'private, no-store')
  create(
    @CurrentUser() user: JwtClaimsVO,
    @Body()
    body: {
      platformTenantId: string;
      platformSubscriptionId?: string | null;
      commercialStart?: string | null;
      commercialEnd?: string | null;
      reasonCode?: string | null;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.create(user, body, idempotencyKey);
  }

  @Get('platform/subscriptions/:subscriptionId')
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentUser() user: JwtClaimsVO, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptions.get(user, subscriptionId);
  }

  @Patch('platform/subscriptions/:subscriptionId')
  @Header('Cache-Control', 'private, no-store')
  update(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; reasonCode?: string | null },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.update(user, subscriptionId, body, idempotencyKey);
  }

  @Get('platform/subscriptions/:subscriptionId/history')
  @Header('Cache-Control', 'private, no-store')
  history(@CurrentUser() user: JwtClaimsVO, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptions.history(user, subscriptionId);
  }

  @Put('platform/subscriptions/:subscriptionId/plan-version')
  @Header('Cache-Control', 'private, no-store')
  assignPlan(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; planVersionId: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.assignPlanVersion(user, subscriptionId, body, idempotencyKey);
  }

  @Put('platform/subscriptions/:subscriptionId/add-ons')
  @Header('Cache-Control', 'private, no-store')
  replaceAddOns(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; addOnVersionIds: string[] },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.replaceAddOns(user, subscriptionId, body, idempotencyKey);
  }

  @Put('platform/subscriptions/:subscriptionId/overrides')
  @Header('Cache-Control', 'private, no-store')
  replaceOverrides(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; overrideIds: string[] },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.replaceOverrides(user, subscriptionId, body, idempotencyKey);
  }

  @Put('platform/subscriptions/:subscriptionId/effective-dates')
  @Header('Cache-Control', 'private, no-store')
  updateDates(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body()
    body: {
      expectedRowVersion: number;
      commercialStart?: string | null;
      commercialEnd?: string | null;
      scheduledActivationAt?: string | null;
    },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.updateDates(user, subscriptionId, body, idempotencyKey);
  }

  @Get('platform/subscriptions/:subscriptionId/readiness')
  @Header('Cache-Control', 'private, no-store')
  readiness(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Query('action') action?: string,
  ) {
    return this.subscriptions.readiness(user, subscriptionId, action);
  }

  @Post('platform/subscriptions/:subscriptionId/preview')
  @Header('Cache-Control', 'private, no-store')
  preview(@CurrentUser() user: JwtClaimsVO, @Param('subscriptionId') subscriptionId: string) {
    return this.subscriptions.preview(user, subscriptionId);
  }

  @Get('platform/subscriptions/:subscriptionId/compare')
  @Header('Cache-Control', 'private, no-store')
  compare(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Query('otherId') otherId: string,
  ) {
    return this.subscriptions.compare(user, subscriptionId, otherId);
  }

  @Get('platform/subscriptions/:subscriptionId/runtime')
  @Header('Cache-Control', 'private, no-store')
  inspectRuntime(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptions.inspectRuntime(user, subscriptionId);
  }

  @Get('platform/subscriptions/:subscriptionId/runtime/explain')
  @Header('Cache-Control', 'private, no-store')
  explainRuntime(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Query('key') key: string,
  ) {
    return this.subscriptions.explainRuntime(user, subscriptionId, key ?? '');
  }

  @Post('platform/subscriptions/:subscriptionId/schedule')
  @Header('Cache-Control', 'private, no-store')
  schedule(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; scheduledActivationAt: string; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.schedule(user, subscriptionId, body, idempotencyKey);
  }

  @Post('platform/subscriptions/:subscriptionId/activate')
  @Header('Cache-Control', 'private, no-store')
  activate(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.activate(user, subscriptionId, body, idempotencyKey);
  }

  @Post('platform/subscriptions/:subscriptionId/suspend')
  @Header('Cache-Control', 'private, no-store')
  suspend(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.suspend(user, subscriptionId, body, idempotencyKey);
  }

  @Post('platform/subscriptions/:subscriptionId/resume')
  @Header('Cache-Control', 'private, no-store')
  resume(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.resume(user, subscriptionId, body, idempotencyKey);
  }

  @Post('platform/subscriptions/:subscriptionId/cancel')
  @Header('Cache-Control', 'private, no-store')
  cancel(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body()
    body: { expectedRowVersion: number; reason: string; cancellationEffectiveAt?: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.cancel(user, subscriptionId, body, idempotencyKey);
  }

  @Post('platform/subscriptions/:subscriptionId/supersede')
  @Header('Cache-Control', 'private, no-store')
  supersede(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body() body: { expectedRowVersion: number; reason: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.supersede(user, subscriptionId, body, idempotencyKey);
  }

  @Post('platform/subscriptions/:subscriptionId/renew')
  @Header('Cache-Control', 'private, no-store')
  renew(
    @CurrentUser() user: JwtClaimsVO,
    @Param('subscriptionId') subscriptionId: string,
    @Body()
    body: { expectedRowVersion: number; reason: string; renewalEffectiveAt: string },
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.subscriptions.renew(user, subscriptionId, body, idempotencyKey);
  }
}