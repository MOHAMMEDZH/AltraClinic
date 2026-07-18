import { Test, TestingModule } from '@nestjs/testing';
import { AddInvoiceLineItemHandler } from '../application/handlers/add-invoice-line-item.handler';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('AddInvoiceLineItemHandler', () => {
  let handler: AddInvoiceLineItemHandler;
  let repo: InMemoryInvoiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddInvoiceLineItemHandler,
        CreateInvoiceHandler,
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

    handler = module.get(AddInvoiceLineItemHandler);
    repo = module.get(INVOICE_REPOSITORY);

    const createHandler = module.get(CreateInvoiceHandler);
    await createHandler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-101',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'SYP',
      notes: null,
      lineItems: [],
    });
  });

  it('adds a line item to an existing invoice', async () => {
    const invoice = (await repo.list({ tenantId: 'tenant-1' }))[0];
    const result = await handler.execute({
      invoiceId: invoice.invoiceId,
      description: 'Medication',
      quantity: 2,
      unitPrice: 50,
      discountPercent: 5,
      taxPercent: 10,
    });

    expect(result.invoiceId).toBe(invoice.invoiceId);
    const updated = await repo.findById(invoice.invoiceId, 'tenant-1');
    expect(updated?.lineItems.length).toBe(1);
    expect(updated?.amountTotal).toBeGreaterThan(0);
  });
});

