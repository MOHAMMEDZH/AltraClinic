import { Test, TestingModule } from '@nestjs/testing';
import { IssueInvoiceHandler } from '../application/handlers/issue-invoice.handler';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { AddInvoiceLineItemHandler } from '../application/handlers/add-invoice-line-item.handler';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('IssueInvoiceHandler', () => {
  let handler: IssueInvoiceHandler;
  let repo: InMemoryInvoiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueInvoiceHandler,
        CreateInvoiceHandler,
        AddInvoiceLineItemHandler,
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
      ],
    }).compile();

    handler = module.get(IssueInvoiceHandler);
    repo = module.get(INVOICE_REPOSITORY);

    const createHandler = module.get(CreateInvoiceHandler);
    const addLineHandler = module.get(AddInvoiceLineItemHandler);
    const created = await createHandler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-ISSUE-1',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'SYP',
      notes: null,
      lineItems: [],
    });
    await addLineHandler.execute({
      invoiceId: created.invoiceId,
      description: 'Consultation',
      quantity: 1,
      unitPrice: 100,
      discountPercent: 0,
      taxPercent: 0,
    });
  });

  it('issues a draft invoice with line items', async () => {
    const invoice = (await repo.list({ tenantId: 'tenant-1' }))[0];
    const result = await handler.execute({ invoiceId: invoice.invoiceId });
    expect(result.status).toBe('issued');
    const updated = await repo.findById(invoice.invoiceId, 'tenant-1');
    expect(updated?.status.status).toBe('issued');
  });
});
