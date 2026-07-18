import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../../common/tenant-scoped-access.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import {
  ChangeTenantSubscriptionPlanDto,
  GrantTenantEntitlementsDto,
  GrantTenantTrialDto,
} from '../application/dto/tenant-subscription.dto';
import {
  ChangeTenantSubscriptionPlanHandler,
  GetTenantEntitlementsHandler,
  GetTenantLicenseHandler,
  GetTenantSubscriptionHandler,
  GetTenantSubscriptionPaymentsHandler,
  GetTenantSubscriptionUsageHandler,
  GrantTenantEntitlementsHandler,
  GrantTenantTrialHandler,
  ListTenantSubscriptionPlansHandler,
  PreviewTenantPlanChangeHandler,
} from '../application/handlers/tenant-subscription.handlers';
import { PreviewPlanChangeDto } from '../application/dto/tenant-subscription.dto';

interface AuthenticatedRequest {
  user?: { id: string; sub?: string; roles: string[] };
}

@Controller('tenant/subscription')
@UseGuards(TenantScopedAccessGuard)
export class TenantSubscriptionController {
  constructor(
    private readonly getHandler: GetTenantSubscriptionHandler,
    private readonly licenseHandler: GetTenantLicenseHandler,
    private readonly entitlementsHandler: GetTenantEntitlementsHandler,
    private readonly previewHandler: PreviewTenantPlanChangeHandler,
    private readonly listPlansHandler: ListTenantSubscriptionPlansHandler,
    private readonly usageHandler: GetTenantSubscriptionUsageHandler,
    private readonly changePlanHandler: ChangeTenantSubscriptionPlanHandler,
    private readonly grantEntitlementsHandler: GrantTenantEntitlementsHandler,
    private readonly grantTrialHandler: GrantTenantTrialHandler,
    private readonly paymentsHandler: GetTenantSubscriptionPaymentsHandler,
  ) {}

  private actor(request: AuthenticatedRequest): { id: string; roles: string[] } {
    return { id: request.user?.sub ?? request.user?.id ?? '', roles: request.user?.roles ?? [] };
  }

  @Get()
  @RequirePermission('api.subscription', 'view')
  async getOverview() {
    return this.getHandler.execute();
  }

  @Get('license')
  @RequirePermission('api.subscription', 'view')
  async getLicense() {
    return this.licenseHandler.execute();
  }

  @Get('entitlements')
  async getEntitlements() {
    return this.entitlementsHandler.execute();
  }

  @Post('plan-change/preview')
  @RequirePermission('api.subscription', 'manage')
  async previewPlanChange(@Body() body: PreviewPlanChangeDto) {
    return this.previewHandler.execute({ plan: body.plan });
  }

  @Get('plans')
  @RequirePermission('api.subscription', 'view')
  listPlans() {
    return this.listPlansHandler.execute();
  }

  @Get('usage')
  @RequirePermission('api.subscription', 'view')
  async getUsage() {
    return this.usageHandler.execute();
  }

  @Get('payments')
  @RequirePermission('api.subscription', 'view')
  async getPayments() {
    return this.paymentsHandler.execute();
  }

  @Post('plan-change')
  @RequirePermission('api.subscription', 'manage')
  async changePlan(@Body() body: ChangeTenantSubscriptionPlanDto, @Req() request: AuthenticatedRequest) {
    const actor = this.actor(request);
    return this.changePlanHandler.execute({
      plan: body.plan,
      reason: body.reason,
      actorId: actor.id,
      actorRoles: actor.roles,
    });
  }

  @Patch('platform-tenants/:platformTenantId/entitlements')
  @RequirePermission('api.platform_admin', 'manage')
  async grantEntitlements(
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: GrantTenantEntitlementsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    return this.grantEntitlementsHandler.execute({
      platformTenantId,
      grantType: body.grantType,
      amount: body.amount,
      note: body.note,
      actorId: actor.id,
    });
  }

  @Post('platform-tenants/:platformTenantId/trial')
  @RequirePermission('api.platform_admin', 'manage')
  async grantTrial(
    @Param('platformTenantId') platformTenantId: string,
    @Body() body: GrantTenantTrialDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = this.actor(request);
    return this.grantTrialHandler.execute({
      platformTenantId,
      plan: body.plan,
      days: body.days,
      actorId: actor.id,
    });
  }
}
