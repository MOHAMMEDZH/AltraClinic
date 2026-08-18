import { Test, TestingModule } from '@nestjs/testing';
import { ConsumeInventoryHandler } from '../application/handlers/consume-inventory.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  EVENT_PUBLISHER,
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_WAREHOUSE_REPOSITORY,
} from '../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../domain/repositories/inventory-warehouse.repository.interface';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import { createMockWarehouseRepo } from './mock-warehouse.repository';
import { InventoryUsagePostingService } from '../application/services/inventory-usage-posting.service';

describe('ConsumeInventoryHandler', () => {
  let handler: ConsumeInventoryHandler;
  let repo: InventoryItemRepository;
  let warehouseRepo: InventoryWarehouseRepository;
  const usagePosting = {
    postUsage: jest.fn(async (input: { quantity: number }) => ({
      lines: [
        {
          usageLedgerId: 'u1',
          stockMovementId: 'm1',
          inventoryBatchId: null,
          quantity: input.quantity,
        },
      ],
    })),
  };
  const eventPublisher = { publish: jest.fn(async () => undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const inMemoryRepo = new InMemoryInventoryItemRepository();
    warehouseRepo = createMockWarehouseRepo(inMemoryRepo);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumeInventoryHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useValue: inMemoryRepo },
        { provide: INVENTORY_WAREHOUSE_REPOSITORY, useValue: warehouseRepo },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: eventPublisher },
        { provide: InventoryUsagePostingService, useValue: usagePosting },
      ],
    }).compile();

    handler = module.get(ConsumeInventoryHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);
  });

  it('requires usedByUserId for clinical consume and never copies recorder', async () => {
    const item = InventoryItem.create({
      itemId: 'item-1',
      tenantId: 'default',
      branchId: null,
      sku: 'TESTSKU',
      nameEn: 'Test Item',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 10,
      reorderThreshold: 2,
      expiryDate: null,
      supplierId: null,
    });
    await repo.save(item);

    await expect(
      handler.execute({
        itemId: 'item-1',
        quantity: 3,
        sourceDocumentId: null,
        consumedBy: 'recorder-1',
      }),
    ).rejects.toThrow(/usedByUserId is required/);

    const result = await handler.execute({
      itemId: 'item-1',
      quantity: 3,
      sourceDocumentId: null,
      consumedBy: 'recorder-1',
      usedByUserId: 'clinician-2',
    });

    expect(result.itemId).toBe('item-1');
    expect(result.quantity).toBe(3);
    expect(result.usageLedgerIds).toEqual(['u1']);
    expect(usagePosting.postUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'default',
        inventoryItemId: 'item-1',
        quantity: 3,
        usageType: 'CLINICAL_CONSUMPTION',
        usedByUserId: 'clinician-2',
        recordedByUserId: 'recorder-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalled();
  });

  it('requires usedByUserId for wastage and never copies recorder', async () => {
    const item = InventoryItem.create({
      itemId: 'item-waste',
      tenantId: 'default',
      branchId: null,
      sku: 'WASTE',
      nameEn: 'Waste Item',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 10,
      reorderThreshold: 2,
      expiryDate: null,
      supplierId: null,
    });
    await repo.save(item);

    await expect(
      handler.execute({
        itemId: 'item-waste',
        quantity: 1,
        sourceDocumentId: null,
        consumedBy: 'recorder-1',
        usageType: 'WASTAGE',
        reasonCode: 'WASTE',
      }),
    ).rejects.toThrow(/usedByUserId is required/);
    expect(usagePosting.postUsage).not.toHaveBeenCalled();
  });
});
