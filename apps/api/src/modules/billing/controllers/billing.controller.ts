import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BillingFinancialService } from '../application/services/billing-financial.service';
import { BillingPermissionGuard } from '../api/billing-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { CreateInvoiceDto } from '../application/dto/create-invoice.dto';
import { AddInvoiceLineItemDto } from '../application/dto/add-invoice-line-item.dto';
import { RecordInvoicePaymentDto } from '../application/dto/record-invoice-payment.dto';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { AddInvoiceLineItemHandler } from '../application/handlers/add-invoice-line-item.handler';
import { RecordInvoicePaymentHandler } from '../application/handlers/record-invoice-payment.handler';
import { CancelInvoiceHandler } from '../application/handlers/cancel-invoice.handler';
import { IssueInvoiceHandler } from '../application/handlers/issue-invoice.handler';
import { GetInvoiceHandler } from '../application/handlers/get-invoice.handler';
import { ListInvoicesHandler } from '../application/handlers/list-invoices.handler';
import { BillInventoryConsumptionsHandler } from '../application/handlers/bill-inventory-consumptions.handler';
import { BillInventoryConsumptionsDto } from '../application/dto/bill-inventory-consumptions.dto';
import { GetBillingSummaryHandler } from '../application/handlers/get-billing-summary.handler';
import { GetBillingAnalyticsHandler } from '../application/handlers/get-billing-analytics.handler';
import { ExportInvoicesHandler } from '../application/handlers/export-invoices.handler';

@Controller('billing')
@UseGuards(BillingPermissionGuard)
@RequireLicensedModule('billing')
@RequireLicensedFeature('billing')
export class BillingController {
  constructor(
    private readonly createInvoiceHandler: CreateInvoiceHandler,
    private readonly addInvoiceLineItemHandler: AddInvoiceLineItemHandler,
    private readonly recordInvoicePaymentHandler: RecordInvoicePaymentHandler,
    private readonly cancelInvoiceHandler: CancelInvoiceHandler,
    private readonly issueInvoiceHandler: IssueInvoiceHandler,
    private readonly getInvoiceHandler: GetInvoiceHandler,
    private readonly listInvoicesHandler: ListInvoicesHandler,
    private readonly billConsumptionsHandler: BillInventoryConsumptionsHandler,
    private readonly summaryHandler: GetBillingSummaryHandler,
    private readonly analyticsHandler: GetBillingAnalyticsHandler,
    private readonly exportHandler: ExportInvoicesHandler,
    private readonly financial: BillingFinancialService,
  ) {}

  @Get('summary')
  @RequirePermission('api.billing', 'view')
  async getSummary(@Query('branchId') branchId?: string) {
    return await this.summaryHandler.execute(branchId?.trim() || null);
  }

  @Get('analytics')
  @RequirePermission('api.billing', 'view')
  async getAnalytics(@Query('days') days?: string, @Query('branchId') branchId?: string) {
    const parsed = days ? Number.parseInt(days, 10) : undefined;
    return await this.analyticsHandler.execute(Number.isFinite(parsed) ? parsed : undefined, branchId?.trim() || null);
  }

  @Get('invoices/export')
  @RequirePermission('api.billing', 'export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="invoices-export.csv"')
  async exportInvoices(
    @Query('branchId') branchId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
  ) {
    return await this.exportHandler.execute({
      branchId: branchId?.trim() || null,
      patientId: patientId?.trim() || null,
      status: status?.trim() || null,
    });
  }

  @Post('invoices')
  @RequirePermission('api.billing', 'create')
  async createInvoice(@Body() body: CreateInvoiceDto) {
    return await this.createInvoiceHandler.execute({
      patientId: body.patientId,
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate,
      dueDate: body.dueDate ?? null,
      branchId: body.branchId ?? null,
      currency: body.currency ?? 'SYP',
      notes: body.notes ?? null,
      lineItems: body.lineItems ?? [],
      requireActiveSubscription: body.requireActiveSubscription,
    });
  }

  @Post('invoices/:invoiceId/line-items')
  @RequirePermission('api.billing', 'update')
  async addLineItem(@Param('invoiceId') invoiceId: string, @Body() body: AddInvoiceLineItemDto) {
    return await this.addInvoiceLineItemHandler.execute({
      invoiceId,
      description: body.description,
      quantity: body.quantity,
      unitPrice: body.unitPrice,
      discountPercent: body.discountPercent ?? 0,
      taxPercent: body.taxPercent ?? 0,
    });
  }

  @Post('invoices/:invoiceId/payments')
  @RequirePermission('api.billing', 'approve')
  async recordPayment(
    @Param('invoiceId') invoiceId: string,
    @Body() body: RecordInvoicePaymentDto,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.recordInvoicePaymentHandler.execute({
      invoiceId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentReference: body.paymentReference ?? null,
      paymentDate: body.paymentDate ?? null,
      recordedBy: userId,
    });
  }

  @Post('invoices/:invoiceId/cancel')
  @RequirePermission('api.billing', 'delete')
  async cancelInvoice(@Param('invoiceId') invoiceId: string) {
    return await this.cancelInvoiceHandler.execute({ invoiceId });
  }

  @Post('invoices/:invoiceId/issue')
  @RequirePermission('api.billing', 'update')
  async issueInvoice(@Param('invoiceId') invoiceId: string) {
    return await this.issueInvoiceHandler.execute({ invoiceId });
  }

  @Get('invoices/:invoiceId')
  @RequirePermission('api.billing', 'view')
  async getInvoice(@Param('invoiceId') invoiceId: string) {
    return await this.getInvoiceHandler.execute({ invoiceId });
  }

  @Post('invoices/bill-consumptions')
  @RequirePermission('api.billing', 'create')
  async billConsumptions(@Body() body: BillInventoryConsumptionsDto) {
    return await this.billConsumptionsHandler.execute({
      patientId: body.patientId,
      consumptionIds: body.consumptionIds,
      invoiceId: body.invoiceId ?? null,
      currency: body.currency ?? null,
    });
  }

  @Get('invoices')
  @RequirePermission('api.billing', 'view')
  async listInvoices(
    @Query('branchId') branchId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (page || pageSize || search) {
      return await this.financial.listInvoicesPaginated({
        branchId: branchId?.trim() || null,
        patientId: patientId?.trim() || null,
        status: status?.trim() || null,
        search: search?.trim() || null,
        page: page ? Number.parseInt(page, 10) : undefined,
        pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
      });
    }
    return await this.listInvoicesHandler.execute({
      branchId: branchId?.trim() || null,
      patientId: patientId?.trim() || null,
      status: status?.trim() || null,
    });
  }
}
