import { Test, TestingModule } from '@nestjs/testing';
import { ConsumeInventoryHandler } from '../application/handlers/consume-inventory.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { EVENT_PUBLISHER, INVENTORY_ITEM_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../domain/repositories/inventory-warehouse.repository.interface';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import { createMockWarehouseRepo } from './mock-warehouse.repository';

describe('ConsumeInventoryHandler', () => {
  let handler: ConsumeInventoryHandler;
  let repo: InventoryItemRepository;
  let warehouseRepo: InventoryWarehouseRepository;

  beforeEach(async () => {
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
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    handler = module.get(ConsumeInventoryHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);
  });

  it('consumes inventory and emits event', async () => {
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
    await warehouseRepo.applyStockDelta({
      tenantId: 'default',
      warehouseId: 'warehouse-1',
      itemId: 'item-1',
      delta: 10,
    });

    const result = await handler.execute({
      itemId: 'item-1',
      quantity: 3,
      sourceDocumentId: null,
      consumedBy: 'user-1',
    });

    expect(result).toEqual({ itemId: 'item-1', quantity: 3 });
    const updated = await repo.findById('default', 'item-1');
    expect(updated?.quantityOnHand).toBe(7);
  });
});
