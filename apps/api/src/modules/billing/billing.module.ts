import { Module } from '@nestjs/common';
import { BillingController } from './controllers/billing.controller';
import { BillingFinancialController } from './controllers/billing-financial.controller';
import { CreateInvoiceHandler } from './application/handlers/create-invoice.handler';
import { AddInvoiceLineItemHandler } from './application/handlers/add-invoice-line-item.handler';
import { RecordInvoicePaymentHandler } from './application/handlers/record-invoice-payment.handler';
import { CancelInvoiceHandler } from './application/handlers/cancel-invoice.handler';
import { IssueInvoiceHandler } from './application/handlers/issue-invoice.handler';
import { GetInvoiceHandler } from './application/handlers/get-invoice.handler';
import { ListInvoicesHandler } from './application/handlers/list-invoices.handler';
import { BillInventoryConsumptionsHandler } from './application/handlers/bill-inventory-consumptions.handler';
import { GetBillingSummaryHandler } from './application/handlers/get-billing-summary.handler';
import { GetBillingAnalyticsHandler } from './application/handlers/get-billing-analytics.handler';
import { ExportInvoicesHandler } from './application/handlers/export-invoices.handler';
import { BillingFinancialService } from './application/services/billing-financial.service';
import { PrismaInvoiceRepository } from './infrastructure/prisma-invoice.repository';
import { BillingPolicyService } from './policies/billing-policy.service';
import { BillingPermissionGuard } from './api/billing-permission.guard';
import { INVOICE_REPOSITORY } from '../../infrastructure/provider.tokens';
import { PatientsModule } from '../patients/patients.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [PatientsModule, SubscriptionModule, InventoryModule],
  controllers: [BillingFinancialController, BillingController],
  providers: [
    { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceRepository },
    CreateInvoiceHandler,
    AddInvoiceLineItemHandler,
    RecordInvoicePaymentHandler,
    CancelInvoiceHandler,
    IssueInvoiceHandler,
    GetInvoiceHandler,
    ListInvoicesHandler,
    BillInventoryConsumptionsHandler,
    GetBillingSummaryHandler,
    GetBillingAnalyticsHandler,
    ExportInvoicesHandler,
    BillingFinancialService,
    BillingPolicyService,
    BillingPermissionGuard,
  ],
  exports: [CreateInvoiceHandler],
})
export class BillingModule {}
