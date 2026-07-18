import { Test, TestingModule } from '@nestjs/testing';
import { CreateInvoiceHandler } from '../application/handlers/create-invoice.handler';
import { InMemoryInvoiceRepository } from '../infrastructure/in-memory-invoice.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('CreateInvoiceHandler', () => {
  let handler: CreateInvoiceHandler;
  let repo: InMemoryInvoiceRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
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

    handler = module.get(CreateInvoiceHandler);
    repo = module.get(INVOICE_REPOSITORY);
  });

  it('creates and persists an invoice', async () => {
    const result = await handler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-100',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'SYP',
      notes: 'Test invoice',
      lineItems: [
        { description: 'Consultation', quantity: 1, unitPrice: 100, discountPercent: 0, taxPercent: 10 },
      ],
    });

    expect(result).toHaveProperty('invoiceId');
    const stored = await repo.findById(result.invoiceId, 'tenant-1');
    expect(stored).not.toBeNull();
    expect(stored?.invoiceNumber).toBe('INV-100');
    expect(stored?.amountTotal).toBeCloseTo(110);
  });

  it('rejects invoice creation without an active subscription', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
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
          useValue: { existsByCustomerId: async () => false },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    const guardedHandler = module.get(CreateInvoiceHandler);
    await expect(
      guardedHandler.execute({
        patientId: 'patient-1',
        invoiceNumber: 'INV-102',
        invoiceDate: new Date().toISOString(),
        dueDate: null,
        branchId: 'branch-1',
        currency: 'SYP',
        notes: null,
        lineItems: [],
      }),
    ).rejects.toThrow('Active subscription is required before invoice creation');
  });

  it('allows treatment invoices without subscription when requireActiveSubscription is false', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
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
          useValue: { existsByCustomerId: async () => false },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    const clinicalHandler = module.get(CreateInvoiceHandler);
    const result = await clinicalHandler.execute({
      patientId: 'patient-1',
      invoiceNumber: 'INV-B-CLINICAL',
      invoiceDate: new Date().toISOString(),
      dueDate: null,
      branchId: 'branch-1',
      currency: 'SYP',
      notes: 'Beauty plan',
      requireActiveSubscription: false,
      lineItems: [{ description: 'Botox session', quantity: 1, unitPrice: 350, discountPercent: 0, taxPercent: 0 }],
    });

    expect(result).toHaveProperty('invoiceId');
  });
});

