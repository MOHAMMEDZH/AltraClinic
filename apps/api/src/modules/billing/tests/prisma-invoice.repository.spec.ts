import { Test, TestingModule } from '@nestjs/testing';
import { PrismaInvoiceRepository } from '../infrastructure/prisma-invoice.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Invoice } from '../domain/entities/invoice.entity';

const mockPrismaService: {
  $transaction: jest.Mock;
  invoice: { upsert: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
  invoiceLineItem: { findMany: jest.Mock; deleteMany: jest.Mock; upsert: jest.Mock };
} = {
  $transaction: jest.fn((cb: (arg: typeof mockPrismaService) => unknown) => cb(mockPrismaService)),
  invoice: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  invoiceLineItem: {
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
};

const TENANT_ID = 'tenant-abc';
const BRANCH_ID = 'branch-001';

function makeInvoice(overrides: Partial<Parameters<typeof Invoice.create>[0]> = {}): Invoice {
  return Invoice.create({
    invoiceId: 'inv-001',
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    patientId: 'patient-001',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15'),
    currency: 'SYP',
    lineItems: [
      { description: 'Consultation', quantity: 1, unitPrice: 5000, discountPercent: 0, taxPercent: 10 },
    ],
    ...overrides,
  });
}

const prismaInvoiceRow = (invoice: Invoice) => ({
  id: invoice.invoiceId,
  tenantId: invoice.tenantId,
  branchId: invoice.branchId,
  patientId: invoice.patientId,
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: invoice.invoiceDate,
  dueDate: invoice.dueDate,
  currency: invoice.currency,
  status: 'DRAFT',
  amountSubtotal: { toNumber: () => invoice.amountSubtotal },
  amountDiscount: { toNumber: () => invoice.amountDiscount },
  amountTax: { toNumber: () => invoice.amountTax },
  amountTotal: { toNumber: () => invoice.amountTotal },
  amountPaid: { toNumber: () => 0 },
  notes: invoice.notes,
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
  deletedAt: null,
  lineItems: invoice.lineItems.map((li) => ({
    id: li.itemId,
    invoiceId: invoice.invoiceId,
    tenantId: invoice.tenantId,
    description: li.description,
    quantity: { toNumber: () => li.quantity },
    unitPrice: { toNumber: () => li.unitPrice },
    discountPercent: { toNumber: () => li.discountPercent },
    discountAmount: { toNumber: () => li.discountAmount },
    taxPercent: { toNumber: () => li.taxPercent },
    taxAmount: { toNumber: () => li.taxAmount },
    subtotal: { toNumber: () => li.subtotal },
    lineTotal: { toNumber: () => li.subtotal - li.discountAmount + li.taxAmount },
    serviceCode: null,
    encounterId: null,
    createdAt: new Date(),
  })),
});

describe('PrismaInvoiceRepository', () => {
  let repo: PrismaInvoiceRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaInvoiceRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaInvoiceRepository>(PrismaInvoiceRepository);
  });

  describe('save()', () => {
    it('calls upsert with correct mapped fields', async () => {
      const invoice = makeInvoice();
      mockPrismaService.invoiceLineItem.findMany.mockResolvedValueOnce([]);

      await repo.save(invoice);

      expect(mockPrismaService.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-001' },
          create: expect.objectContaining({
            id: 'inv-001',
            tenantId: TENANT_ID,
            invoiceNumber: 'INV-2024-001',
            status: 'DRAFT',
          }),
        }),
      );
    });

    it('upserts line items for each line', async () => {
      const invoice = makeInvoice();
      mockPrismaService.invoiceLineItem.findMany.mockResolvedValueOnce([]);

      await repo.save(invoice);

      expect(mockPrismaService.invoiceLineItem.upsert).toHaveBeenCalledTimes(
        invoice.lineItems.length,
      );
    });

    it('deletes removed line items when saving updated aggregate', async () => {
      const invoice = makeInvoice();
      const removedId = 'old-line-item-id';
      mockPrismaService.invoiceLineItem.findMany.mockResolvedValueOnce([{ id: removedId }]);

      await repo.save(invoice);

      expect(mockPrismaService.invoiceLineItem.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: [removedId] } },
      });
    });
  });

  describe('findById()', () => {
    it('returns null when invoice not found', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(null);

      const result = await repo.findById('nonexistent', TENANT_ID);
      expect(result).toBeNull();
    });

    it('returns restored Invoice with correct status', async () => {
      const invoice = makeInvoice();
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(prismaInvoiceRow(invoice));

      const result = await repo.findById('inv-001', TENANT_ID);

      expect(result).not.toBeNull();
      expect(result!.invoiceId).toBe('inv-001');
      expect(result!.status.status).toBe('draft');
      expect(result!.tenantId).toBe(TENANT_ID);
    });

    it('reconstructs line items from DB', async () => {
      const invoice = makeInvoice();
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(prismaInvoiceRow(invoice));

      const result = await repo.findById('inv-001', TENANT_ID);

      expect(result!.lineItems).toHaveLength(1);
      expect(result!.lineItems[0].description).toBe('Consultation');
      expect(result!.lineItems[0].unitPrice).toBe(5000);
    });

    it('enforces tenant isolation — only returns records matching tenantId', async () => {
      mockPrismaService.invoice.findFirst.mockResolvedValueOnce(null);

      const result = await repo.findById('inv-001', 'different-tenant');
      expect(result).toBeNull();

      expect(mockPrismaService.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: 'different-tenant' }) }),
      );
    });
  });

  describe('list()', () => {
    it('filters by status when provided', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, status: 'draft' });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        }),
      );
    });

    it('filters by patientId when provided', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValueOnce([]);

      await repo.list({ tenantId: TENANT_ID, patientId: 'patient-123' });

      expect(mockPrismaService.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ patientId: 'patient-123' }),
        }),
      );
    });

    it('returns empty array when no results', async () => {
      mockPrismaService.invoice.findMany.mockResolvedValueOnce([]);

      const result = await repo.list({ tenantId: TENANT_ID });
      expect(result).toEqual([]);
    });
  });
});
