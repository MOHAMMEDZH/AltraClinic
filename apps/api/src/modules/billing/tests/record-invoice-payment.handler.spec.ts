import { Test, TestingModule } from '@nestjs/testing';
import { RecordInvoicePaymentHandler } from '../application/handlers/record-invoice-payment.handler';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { IssueInvoiceHandler } from '../application/handlers/issue-invoice.handler';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { BillingFinancialService } from '../application/services/billing-financial.service';
import { EVENT_PUBLISHER, INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('RecordInvoicePaymentHandler', () => {
  let handler: RecordInvoicePaymentHandler;
  let issueHandler: IssueInvoiceHandler;
  let repo: InMemoryInvoiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordInvoicePaymentHandler,
        CreateInvoiceHandler,
        IssueInvoiceHandler,
        { provide: INVOICE_REPOSITORY, useClass: InMemoryInvoiceRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', environment: 'sandbox' }) },
        },
        {
          provide: PATIENT_REPOSITORY,
          useValue: { findById: async () => ({ id: 'patient-1', tenantId: 'tenant-1' }) },
        },
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useValue: { existsByCustomerId: async () => true },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
        {
          provide: PrismaService,
          useValue: { invoicePayment: { create: async () => ({}) } },
        },
        {
          provide: BillingFinancialService,
          useValue: { createPaymentReceipt: async () => 'RCP-000001' },
        },
      ],
    }).compile();

    handler = module.get(RecordInvoicePaymentHandler);
    issueHandler = module.get(IssueInvoiceHandler);
    repo = module.get(INVOICE_REPOSITORY);

    const createHandler = module.get(CreateInvoiceHandler);
    await createHandler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-102',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'SYP',
      notes: null,
      lineItems: [{ description: 'Consultation', quantity: 1, unitPrice: 100, discountPercent: 0, taxPercent: 10 }],
    });
  });

  it('records a payment against an invoice', async () => {
    const invoice = (await repo.list({ tenantId: 'tenant-1' }))[0];
    await issueHandler.execute({ invoiceId: invoice.invoiceId });
    await handler.execute({
      invoiceId: invoice.invoiceId,
      amount: 110,
      paymentMethod: 'cash',
      paymentReference: 'RCPT-123',
      paymentDate: new Date().toISOString(),
      recordedBy: 'user-1',
    });

    const updatedInvoice = await repo.findById(invoice.invoiceId, 'tenant-1');
    expect(updatedInvoice?.status.status).toBe('paid');
    expect(updatedInvoice?.amountPaid).toBeCloseTo(110);
  });
});

