import { Test, TestingModule } from '@nestjs/testing';
import { CreateInventoryItemHandler } from '../application/handlers/create-inventory-item.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  EVENT_PUBLISHER,
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_SUPPLIER_REPOSITORY,
  INVENTORY_WAREHOUSE_REPOSITORY,
} from '../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../domain/repositories/inventory-item.repository.interface';
import { createMockWarehouseRepo } from './mock-warehouse.repository';

describe('CreateInventoryItemHandler', () => {
  let handler: CreateInventoryItemHandler;
  let repo: InventoryItemRepository;

  beforeEach(async () => {
    const inMemoryRepo = new InMemoryInventoryItemRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateInventoryItemHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useValue: inMemoryRepo },
        {
          provide: INVENTORY_SUPPLIER_REPOSITORY,
          useValue: { existsActive: async () => true, countActive: async () => 0 },
        },
        { provide: INVENTORY_WAREHOUSE_REPOSITORY, useValue: createMockWarehouseRepo(inMemoryRepo) },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish: async () => {} } },
      ],
    }).compile();

    handler = module.get(CreateInventoryItemHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);
  });

  it('creates and persists an inventory item', async () => {
    const command = {
      itemId: 'item-1',
      branchId: null,
      sku: 'TESTSKU',
      nameEn: 'Test Item',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 10,
      reorderThreshold: 2,
      expiryDate: null,
      supplierId: null,
    };

    const result = await handler.execute(command as any);
    expect(result).toHaveProperty('itemId');
    const saved = await repo.findById('default', result.itemId);
    expect(saved).not.toBeNull();
    expect(saved?.sku).toBe('TESTSKU');
  });
});
