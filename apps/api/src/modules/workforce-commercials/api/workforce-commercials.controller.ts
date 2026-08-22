import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionGuard, RequirePermission } from '../../auth/api/guards/permission.guard';
import { CommissionAccrualService } from '../services/commission-accrual.service';
import { StaffCommissionPlanService } from '../services/staff-commission-plan.service';
import {
  CorrectCommissionAccrualDto,
  CreateCommissionPlanDto,
  BindInvoiceLinePerformanceDto,
  ListCommissionPlansQueryDto,
  OwnerReportQueryDto,
  PostCollectedCommissionAccrualDto,
  PostCommissionAccrualDto,
  RegisterPackageSessionAllocationDto,
  ReverseCommissionAccrualDto,
  SetCommissionEligibilityDto,
  SettleCommissionAccrualDto,
} from './wave-f.dto';
import { InvoiceLinePerformanceAttributionService } from '../services/invoice-line-performance-attribution.service';
import { CommissionPackageAllocationService } from '../services/commission-package-allocation.service';

function actor(req: { user?: { userId?: string; sub?: string; roles?: string[] } }) {
  return {
    actorId: (req.user?.userId ?? req.user?.sub ?? '').trim(),
    actorRoles: req.user?.roles ?? [],
  };
}

@Controller('workforce-commercials')
@UseGuards(PermissionGuard)
export class WorkforceCommercialsController {
  constructor(
    private readonly plans: StaffCommissionPlanService,
    private readonly accruals: CommissionAccrualService,
    private readonly lineAttribution: InvoiceLinePerformanceAttributionService,
    private readonly packageAllocations: CommissionPackageAllocationService,
  ) {}

  @Patch('users/:userId/commission-eligibility')
  @RequirePermission('api.staff-commission', 'update')
  setEligibility(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: SetCommissionEligibilityDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.plans.setUserCommissionEligibility(
      userId,
      body.enabled,
      body.defaultPercent,
      body.effectiveFrom,
      a,
    );
  }

  @Post('plans')
  @RequirePermission('api.staff-commission', 'create')
  createPlan(
    @Body() body: CreateCommissionPlanDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.plans.createDraftPlan({ ...body, actor: a });
  }

  @Post('plans/:id/publish')
  @RequirePermission('api.staff-commission', 'update')
  publishPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    return this.plans.publishPlan(id, actor(req));
  }

  @Get('plans')
  @RequirePermission('api.staff-commission', 'view')
  listPlans(@Query() query: ListCommissionPlansQueryDto) {
    return this.plans.listPlans(query);
  }

  @Get('plans/:id')
  @RequirePermission('api.staff-commission', 'view')
  getPlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.plans.getPlan(id);
  }

  @Post('accruals/post')
  @RequirePermission('api.staff-commission', 'create')
  postAccrual(
    @Body() body: PostCommissionAccrualDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.accruals.postFromServicePerformance({
      servicePerformanceId: body.servicePerformanceId,
      invoiceLineId: body.invoiceLineId,
      reason: body.reason,
      actor: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('accruals/post-collected')
  @RequirePermission('api.staff-commission', 'create')
  postCollectedAccrual(
    @Body() body: PostCollectedCommissionAccrualDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.accruals.postFromCollectedPayment({
      servicePerformanceId: body.servicePerformanceId,
      invoiceLineId: body.invoiceLineId,
      paymentId: body.paymentId,
      reason: body.reason,
      actor: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('accruals/:id/reverse')
  @RequirePermission('api.staff-commission', 'manage')
  reverseAccrual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReverseCommissionAccrualDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.accruals.reverseAccrual({
      accrualId: id,
      refundId: body.refundId,
      proportion: body.proportion,
      reason: body.reason,
      actor: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('accruals/:id/correct')
  @RequirePermission('api.staff-commission', 'manage')
  correctAccrual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CorrectCommissionAccrualDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.accruals.correctAndRepost({
      accrualId: id,
      correctionEventId: body.correctionEventId,
      replacementInvoiceLineId: body.replacementInvoiceLineId,
      reason: body.reason,
      actor: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Post('package-allocations')
  @RequirePermission('api.staff-commission', 'create')
  registerPackageAllocation(
    @Body() body: RegisterPackageSessionAllocationDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    return this.packageAllocations.registerSessionAllocation({
      ...body,
      actor: actor(req),
    });
  }

  @Post('invoice-lines/bind-performance')
  @RequirePermission('api.staff-commission', 'update')
  bindInvoiceLinePerformance(
    @Body() body: BindInvoiceLinePerformanceDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    return this.lineAttribution.bindInvoiceLine({
      invoiceLineId: body.invoiceLineId,
      servicePerformanceId: body.servicePerformanceId,
      actor: actor(req),
    });
  }

  @Post('accruals/:id/settle')
  @RequirePermission('api.staff-commission', 'approve')
  settleAccrual(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettleCommissionAccrualDto,
    @Req() req: { user?: { userId?: string; sub?: string; roles?: string[] } },
  ) {
    const a = actor(req);
    return this.accruals.settleAccrual({
      accrualId: id,
      settlementReference: body.settlementReference,
      amount: body.amount,
      actor: a.actorId,
      actorRoles: a.actorRoles,
    });
  }

  @Get('accruals/:id')
  @RequirePermission('api.staff-commission', 'view')
  getAccrual(@Param('id', ParseUUIDPipe) id: string) {
    return this.accruals.getAccrual(id);
  }

  @Get('owner-report')
  @RequirePermission('api.staff-commission', 'export')
  ownerReport(@Query() query: OwnerReportQueryDto) {
    return this.accruals.ownerReport({
      userId: query.userId,
      branchId: query.branchId,
      clinicalServiceId: query.clinicalServiceId,
      planVersionId: query.planVersionId,
      from: query.from,
      to: query.to,
    });
  }
}
