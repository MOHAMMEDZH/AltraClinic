import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BillingPermissionGuard } from '../api/billing-permission.guard';
import { RequirePermission } from '../../auth/api/guards/permission.guard';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { RequireLicensedFeature } from '../../subscription/api/decorators/require-licensed-feature.decorator';
import { BillingFinancialService } from '../application/services/billing-financial.service';

@Controller('billing')
@UseGuards(BillingPermissionGuard)
@RequireLicensedModule('billing')
@RequireLicensedFeature('billing')
export class BillingFinancialController {
  constructor(private readonly financial: BillingFinancialService) {}

  @Get('invoices/next-number')
  @RequirePermission('api.billing', 'create')
  async nextInvoiceNumber(@Query('prefix') prefix?: string) {
    return { invoiceNumber: await this.financial.nextInvoiceNumber(prefix?.trim() || 'INV') };
  }

  @Post('invoices/:invoiceId/refunds')
  @RequirePermission('api.billing', 'approve')
  async recordRefund(
    @Param('invoiceId') invoiceId: string,
    @Body() body: {
      paymentId?: string;
      amount: number;
      reason: string;
      refundMethod: string;
      refundReference?: string;
      refundDate?: string;
      notes?: string;
    },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.financial.recordRefund({
      invoiceId,
      paymentId: body.paymentId ?? null,
      amount: body.amount,
      reason: body.reason,
      refundMethod: body.refundMethod,
      refundReference: body.refundReference ?? null,
      refundDate: body.refundDate ?? null,
      approvedBy: userId,
      notes: body.notes ?? null,
    });
  }

  @Get('refunds')
  @RequirePermission('api.billing', 'view')
  async listRefunds(@Query('invoiceId') invoiceId?: string) {
    return await this.financial.listRefunds(invoiceId?.trim() || undefined);
  }

  @Post('invoices/:invoiceId/credit-notes')
  @RequirePermission('api.billing', 'update')
  async createCreditNote(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { amount: number; reason: string; notes?: string; issue?: boolean },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.financial.createCreditNote({
      invoiceId,
      amount: body.amount,
      reason: body.reason,
      notes: body.notes ?? null,
      issuedBy: userId,
      issue: body.issue ?? true,
    });
  }

  @Get('credit-notes')
  @RequirePermission('api.billing', 'view')
  async listCreditNotes(@Query('invoiceId') invoiceId?: string) {
    return await this.financial.listCreditNotes(invoiceId?.trim() || undefined);
  }

  @Post('invoices/:invoiceId/write-off')
  @RequirePermission('api.billing', 'manage')
  async writeOff(
    @Param('invoiceId') invoiceId: string,
    @Body() body: { amount: number; reason: string; writeOffDate?: string; notes?: string },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.financial.writeOffInvoice({
      invoiceId,
      amount: body.amount,
      reason: body.reason,
      approvedBy: userId,
      writeOffDate: body.writeOffDate ?? null,
      notes: body.notes ?? null,
    });
  }

  @Post('cash-sessions/open')
  @RequirePermission('api.billing', 'approve')
  async openCashSession(
    @Body() body: { branchId?: string; openingBalance: number; notes?: string },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.financial.openCashSession({
      branchId: body.branchId ?? null,
      openingBalance: body.openingBalance,
      openedBy: userId,
      notes: body.notes ?? null,
    });
  }

  @Post('cash-sessions/:sessionId/close')
  @RequirePermission('api.billing', 'approve')
  async closeCashSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { actualCash: number; notes?: string },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.financial.closeCashSession({
      sessionId,
      actualCash: body.actualCash,
      closedBy: userId,
      notes: body.notes ?? null,
    });
  }

  @Get('cash-sessions/active')
  @RequirePermission('api.billing', 'view')
  async activeCashSession(@Query('branchId') branchId?: string) {
    return await this.financial.getActiveCashSession(branchId?.trim() || null);
  }

  @Get('cash-sessions')
  @RequirePermission('api.billing', 'view')
  async listCashSessions(@Query('limit') limit?: string) {
    const n = limit ? Number.parseInt(limit, 10) : 20;
    return await this.financial.listCashSessions(Number.isFinite(n) ? n : 20);
  }

  @Post('payment-plans')
  @RequirePermission('api.billing', 'create')
  async createPaymentPlan(
    @Body() body: {
      invoiceId: string;
      patientId: string;
      installmentCount: number;
      startDate: string;
      notes?: string;
    },
  ) {
    return await this.financial.createPaymentPlan(body);
  }

  @Get('payment-plans')
  @RequirePermission('api.billing', 'view')
  async listPaymentPlans(@Query('invoiceId') invoiceId?: string) {
    return await this.financial.listPaymentPlans(invoiceId?.trim() || undefined);
  }

  @Get('service-prices')
  @RequirePermission('api.billing', 'view')
  async listServicePrices(@Query('all') all?: string) {
    return await this.financial.listServicePrices(all !== 'true');
  }

  @Post('service-prices')
  @RequirePermission('api.billing', 'manage')
  async upsertServicePrice(
    @Body() body: {
      serviceCode: string;
      nameEn: string;
      nameAr?: string;
      unitPrice: number;
      currency?: string;
      taxPercent?: number;
      isActive?: boolean;
    },
  ) {
    return await this.financial.upsertServicePrice(body);
  }

  @Post('invoices/:invoiceId/split-payments')
  @RequirePermission('api.billing', 'approve')
  async splitPayments(
    @Param('invoiceId') invoiceId: string,
    @Body() body: {
      payments: Array<{ amount: number; paymentMethod: string; paymentReference?: string }>;
      paymentDate?: string;
    },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.financial.recordSplitPayments({
      invoiceId,
      payments: body.payments,
      recordedBy: userId,
      paymentDate: body.paymentDate ?? null,
    });
  }

  @Get('receipts/:receiptNumber')
  @RequirePermission('api.billing', 'view')
  async getReceipt(@Param('receiptNumber') receiptNumber: string) {
    return await this.financial.getReceipt(receiptNumber);
  }

  @Get('invoices/:invoiceId/receipts')
  @RequirePermission('api.billing', 'view')
  async listInvoiceReceipts(@Param('invoiceId') invoiceId: string) {
    return await this.financial.listInvoiceReceipts(invoiceId);
  }

  @Post('invoices/:invoiceId/insurance')
  @RequirePermission('api.billing', 'update')
  async applyInsurance(
    @Param('invoiceId') invoiceId: string,
    @Body() body: {
      insuranceProvider: string;
      insurancePolicyNumber?: string;
      insuranceAmount: number;
      patientResponsibility: number;
      insuranceClaimStatus?: string;
    },
  ) {
    return await this.financial.applyInsuranceAllocation({
      invoiceId,
      insuranceProvider: body.insuranceProvider,
      insurancePolicyNumber: body.insurancePolicyNumber ?? null,
      insuranceAmount: body.insuranceAmount,
      patientResponsibility: body.patientResponsibility,
      insuranceClaimStatus: body.insuranceClaimStatus ?? null,
    });
  }

  @Post('invoices/mark-overdue')
  @RequirePermission('api.billing', 'manage')
  async markOverdue() {
    return await this.financial.markOverdueInvoices();
  }
}
