import { Body, Controller, Get, GoneException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CommissionPermissionGuard } from '../api/commission-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { CalculateCommissionDto } from '../application/dto/calculate-commission.dto';
import { RecordCommissionPaymentDto } from '../application/dto/record-commission-payment.dto';
import { DisputeCommissionDto } from '../application/dto/dispute-commission.dto';
import { CalculateCommissionHandler } from '../application/handlers/calculate-commission.handler';
import { CreateCommissionRuleHandler } from '../application/handlers/create-commission-rule.handler';
import { ListCommissionRulesHandler } from '../application/handlers/list-commission-rules.handler';
import { CalculateCommissionFromInvoicesHandler } from '../application/handlers/calculate-commission-from-invoices.handler';
import { CreateCommissionRuleDto } from '../application/dto/create-commission-rule.dto';
import { ApproveCommissionHandler } from '../application/handlers/approve-commission.handler';
import { PayCommissionHandler } from '../application/handlers/pay-commission.handler';
import { DisputeCommissionHandler } from '../application/handlers/dispute-commission.handler';
import { GetCommissionHandler } from '../application/handlers/get-commission.handler';
import { ListCommissionsHandler } from '../application/handlers/list-commissions.handler';
import { ListCommissionRulesQuery } from '../application/queries/list-commission-rules.query';

const WAVE_F_CUTOVER =
  'Legacy commission financial writes are retired. Use /workforce-commercials for StaffCommissionPlanVersion + CommissionAccrual.';

@Controller('commissions')
@UseGuards(CommissionPermissionGuard)
@RequireLicensedModule('commission')
export class CommissionController {
  constructor(
    private readonly calculateCommissionHandler: CalculateCommissionHandler,
    private readonly calculateFromInvoicesHandler: CalculateCommissionFromInvoicesHandler,
    private readonly createCommissionRuleHandler: CreateCommissionRuleHandler,
    private readonly listCommissionRulesHandler: ListCommissionRulesHandler,
    private readonly approveCommissionHandler: ApproveCommissionHandler,
    private readonly payCommissionHandler: PayCommissionHandler,
    private readonly disputeCommissionHandler: DisputeCommissionHandler,
    private readonly getCommissionHandler: GetCommissionHandler,
    private readonly listCommissionsHandler: ListCommissionsHandler,
  ) {}

  /**
   * F1 cutover: block NEW financial calculation writes.
   * Wave F SoR is /workforce-commercials.
   */
  @Post('calculate-from-invoices')
  @RequirePermission('api.commission', 'create')
  async calculateFromInvoices(
    @Body()
    _body: {
      providerId: string;
      branchId?: string;
      periodStart: string;
      periodEnd: string;
      currency?: string;
    },
  ) {
    void _body;
    throw new GoneException(WAVE_F_CUTOVER);
  }

  @Get('rules/list')
  @RequirePermission('api.commission', 'view')
  async listCommissionRules(
    @Query('providerId') providerId?: string,
    @Query('serviceType') serviceType?: string,
  ) {
    return await this.listCommissionRulesHandler.execute(
      new ListCommissionRulesQuery(providerId?.trim() || null, serviceType?.trim() || null),
    );
  }

  /**
   * F1 cutover: block NEW financial calculation writes.
   */
  @Post('calculate')
  @RequirePermission('api.commission', 'create')
  async calculateCommission(@Body() _body: CalculateCommissionDto) {
    void _body;
    throw new GoneException(WAVE_F_CUTOVER);
  }

  /**
   * F1 cutover: block NEW commission rule creates (financial policy writes).
   */
  @Post('rules')
  @RequirePermission('api.commission', 'manage')
  async createCommissionRule(@Body() _body: CreateCommissionRuleDto) {
    void _body;
    throw new GoneException(WAVE_F_CUTOVER);
  }

  /**
   * Historical CommissionCalculation settlement only — approve existing rows.
   * Does not create new commission financial facts; prefer Wave F settle for accruals.
   */
  @Post(':commissionId/approve')
  @RequirePermission('api.commission', 'approve')
  async approveCommission(@Param('commissionId') commissionId: string) {
    return await this.approveCommissionHandler.execute({ commissionId });
  }

  /**
   * Historical CommissionCalculation settlement only — pay existing rows.
   * Kept for legacy settlement of pre-cutover CommissionCalculation rows.
   */
  @Post(':commissionId/pay')
  @RequirePermission('api.commission', 'approve')
  async payCommission(
    @Param('commissionId') commissionId: string,
    @Body() body: RecordCommissionPaymentDto,
  ) {
    return await this.payCommissionHandler.execute({
      commissionId,
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference ?? null,
      paymentDate: body.paymentDate ?? null,
    });
  }

  /**
   * Historical CommissionCalculation dispute only.
   */
  @Post(':commissionId/dispute')
  @RequirePermission('api.commission', 'update')
  async disputeCommission(
    @Param('commissionId') commissionId: string,
    @Body() body: DisputeCommissionDto,
  ) {
    return await this.disputeCommissionHandler.execute({ commissionId, reason: body.reason });
  }

  @Get(':commissionId')
  @RequirePermission('api.commission', 'view')
  async getCommission(@Param('commissionId') commissionId: string) {
    return await this.getCommissionHandler.execute({ commissionId });
  }

  @Get()
  @RequirePermission('api.commission', 'view')
  async listCommissions(
    @Query('providerId') providerId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return await this.listCommissionsHandler.execute({
      providerId: providerId?.trim() || null,
      branchId: branchId?.trim() || null,
      status: status?.trim() || null,
    });
  }
}
