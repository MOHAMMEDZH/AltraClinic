import { Test, TestingModule } from '@nestjs/testing';
import { ListInvoicesHandler } from '../application/handlers/list-invoices.handler';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('ListInvoicesHandler', () => {
  let handler: ListInvoicesHandler;
  let repo: InMemoryInvoiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListInvoicesHandler,
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

    handler = module.get(ListInvoicesHandler);
    repo = module.get(INVOICE_REPOSITORY);

    const createHandler = module.get(CreateInvoiceHandler);
    await createHandler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-105',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'USD',
      notes: null,
      lineItems: [],
    });
  });

  it('lists invoices for tenant and branch', async () => {
    const result = await handler.execute({ branchId: 'branch-1' });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].branchId).toBe('branch-1');
  });
});

