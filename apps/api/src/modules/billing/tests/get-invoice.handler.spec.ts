import { Test, TestingModule } from '@nestjs/testing';
import { GetInvoiceHandler } from '../application/handlers/get-invoice.handler';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { EVENT_PUBLISHER, INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('GetInvoiceHandler', () => {
  let handler: GetInvoiceHandler;
  let repo: InMemoryInvoiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetInvoiceHandler,
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
        {
          provide: PrismaService,
          useValue: {
            invoicePayment: { findMany: async () => [] },
            invoice: {
              findFirst: async () => ({
                insuranceProvider: null,
                insurancePolicyNumber: null,
                insuranceAmount: { toNumber: () => 0 },
                patientResponsibility: { toNumber: () => 0 },
                insuranceClaimStatus: null,
              }),
            },
          },
        },
      ],
    }).compile();

    handler = module.get(GetInvoiceHandler);
    repo = module.get(INVOICE_REPOSITORY);

    const createHandler = module.get(CreateInvoiceHandler);
    await createHandler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-104',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'SYP',
      notes: null,
      lineItems: [],
    });
  });

  it('retrieves an invoice by id', async () => {
    const invoice = (await repo.list({ tenantId: 'tenant-1' }))[0];
    const result = await handler.execute({ invoiceId: invoice.invoiceId });
    expect(result.invoiceId).toBe(invoice.invoiceId);
  });
});

