import { Test, TestingModule } from '@nestjs/testing';
import { GetInventoryItemHandler } from '../application/handlers/get-inventory-item.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { INVENTORY_ITEM_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InventoryItem } from '../domain/entities/inventory-item.entity';

describe('GetInventoryItemHandler', () => {
  let handler: GetInventoryItemHandler;
  let repo: InMemoryInventoryItemRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetInventoryItemHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useClass: InMemoryInventoryItemRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(GetInventoryItemHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);
  });

  it('fetches inventory item by id', async () => {
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

    const result = await handler.execute({ itemId: 'item-1' });
    expect(result).not.toBeNull();
    expect(result?.sku).toBe('TESTSKU');
  });
});

