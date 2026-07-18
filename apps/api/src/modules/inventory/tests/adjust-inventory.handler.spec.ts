import { Test, TestingModule } from '@nestjs/testing';
import { AdjustInventoryHandler } from '../application/handlers/adjust-inventory.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InventoryWarehouseRepository } from '../domain/repositories/inventory-warehouse.repository.interface';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import { createMockWarehouseRepo } from './mock-warehouse.repository';

describe('AdjustInventoryHandler', () => {
  let handler: AdjustInventoryHandler;
  let repo: InMemoryInventoryItemRepository;
  let warehouseRepo: InventoryWarehouseRepository;

  beforeEach(async () => {
    const inMemoryRepo = new InMemoryInventoryItemRepository();
    warehouseRepo = createMockWarehouseRepo(inMemoryRepo);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdjustInventoryHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useValue: inMemoryRepo },
        { provide: INVENTORY_WAREHOUSE_REPOSITORY, useValue: warehouseRepo },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(AdjustInventoryHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);
  });

  it('adjusts stock and records movement', async () => {
    const item = InventoryItem.create({
      itemId: 'item-1',
      tenantId: 'default',
      branchId: null,
      sku: 'ADJ-SKU',
      nameEn: 'Adjust Item',
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
      quantityAfter: 15,
      reason: 'Physical count correction',
      performedBy: 'user-1',
    });

    expect(result?.quantityOnHand).toBe(15);
    const movements = await repo.listStockMovements({
      tenantId: 'default',
      itemId: 'item-1',
      limit: 10,
      offset: 0,
    });
    expect(movements.movements).toHaveLength(1);
    expect(movements.movements[0].movementType).toBe('ADJUST');
  });
});
