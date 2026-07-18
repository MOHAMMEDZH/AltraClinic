import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaInventoryRepository } from '../infrastructure/prisma-inventory.repository';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import { LocalizedText } from '../domain/value-objects/localized-text.vo';

const mockPrismaService = {
  inventoryItem: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

const TENANT_ID = 'tenant-001';
const BRANCH_ID = 'branch-001';

function makeItem(): InventoryItem {
  return InventoryItem.create({
    itemId: 'item-001',
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    sku: 'GLOVE-L',
    nameEn: 'Latex Gloves L',
    nameAr: 'قفازات لاتكس كبير',
    unit: 'box',
    quantityOnHand: 50,
    reorderThreshold: 10,
    supplierId: null,
    expiryDate: null,
  });
}

const prismaRow = (item: InventoryItem) => ({
  id: item.itemId,
  tenantId: item.tenantId,
  branchId: item.branchId,
  sku: item.sku,
  nameEn: item.name.en ?? '',
  nameAr: item.name.ar,
  unit: item.unit,
  quantityOnHand: new Prisma.Decimal(item.quantityOnHand),
  reorderThreshold: new Prisma.Decimal(item.reorderThreshold),
  expiryDate: null,
  supplierId: null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

describe('PrismaInventoryRepository', () => {
  let repo: PrismaInventoryRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaInventoryRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repo = module.get<PrismaInventoryRepository>(PrismaInventoryRepository);
  });

  describe('save()', () => {
    it('upserts with sku and localized name', async () => {
      const item = makeItem();
      await repo.save(item);

      expect(mockPrismaService.inventoryItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tenantId: TENANT_ID,
            sku: 'GLOVE-L',
            nameEn: 'Latex Gloves L',
            unit: 'box',
          }),
        }),
      );
    });

    it('stores quantity as Prisma.Decimal', async () => {
      const item = makeItem();
      await repo.save(item);

      const createArg = mockPrismaService.inventoryItem.upsert.mock.calls[0][0].create;
      expect(createArg.quantityOnHand).toBeInstanceOf(Prisma.Decimal);
      expect(createArg.quantityOnHand.toNumber()).toBe(50);
    });
  });

  describe('findById()', () => {
    it('returns null when not found', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValueOnce(null);
      const result = await repo.findById(TENANT_ID, 'item-999');
      expect(result).toBeNull();
    });

    it('queries with deletedAt null (soft delete guard)', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValueOnce(null);

      await repo.findById(TENANT_ID, 'item-001');

      expect(mockPrismaService.inventoryItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
    });

    it('reconstructs InventoryItem from row', async () => {
      const item = makeItem();
      mockPrismaService.inventoryItem.findFirst.mockResolvedValueOnce(prismaRow(item));

      const result = await repo.findById(TENANT_ID, item.itemId);

      expect(result).not.toBeNull();
      expect(result!.sku).toBe('GLOVE-L');
      expect(result!.name.en).toBe('Latex Gloves L');
      expect(result!.quantityOnHand).toBe(50);
    });
  });

  describe('findBySku()', () => {
    it('queries by trimmed SKU and tenantId', async () => {
      mockPrismaService.inventoryItem.findFirst.mockResolvedValueOnce(null);

      await repo.findBySku(TENANT_ID, '  GLOVE-L  ');

      expect(mockPrismaService.inventoryItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ sku: 'GLOVE-L', tenantId: TENANT_ID }),
        }),
      );
    });
  });

  describe('findByBranch()', () => {
    it('applies branchId when provided', async () => {
      mockPrismaService.inventoryItem.findMany.mockResolvedValueOnce([]);

      await repo.findByBranch(TENANT_ID, BRANCH_ID);

      expect(mockPrismaService.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: BRANCH_ID }),
        }),
      );
    });

    it('omits branchId filter when null', async () => {
      mockPrismaService.inventoryItem.findMany.mockResolvedValueOnce([]);

      await repo.findByBranch(TENANT_ID, null);

      const callArg = mockPrismaService.inventoryItem.findMany.mock.calls[0][0];
      expect(callArg.where.branchId).toBeUndefined();
    });
  });
});
