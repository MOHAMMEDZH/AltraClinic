import { Test, TestingModule } from '@nestjs/testing';
import { ListInventoryItemsHandler } from '../application/handlers/list-inventory-items.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { INVENTORY_ITEM_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InventoryItem } from '../domain/entities/inventory-item.entity';

describe('ListInventoryItemsHandler', () => {
  let handler: ListInventoryItemsHandler;
  let repo: InMemoryInventoryItemRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListInventoryItemsHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useClass: InMemoryInventoryItemRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox', branchId: 'branch-1' }) },
        },
      ],
    }).compile();

    handler = module.get(ListInventoryItemsHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);
  });

  it('returns items filtered by branch when branchId is specified', async () => {
    const itemA = InventoryItem.create({
      itemId: 'item-1',
      tenantId: 'default',
      branchId: 'branch-1',
      sku: 'SKU-1',
      nameEn: 'Item One',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 5,
      reorderThreshold: 1,
      expiryDate: null,
      supplierId: null,
    });
    const itemB = InventoryItem.create({
      itemId: 'item-2',
      tenantId: 'default',
      branchId: 'branch-2',
      sku: 'SKU-2',
      nameEn: 'Item Two',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 3,
      reorderThreshold: 1,
      expiryDate: null,
      supplierId: null,
    });

    await repo.save(itemA);
    await repo.save(itemB);

    const result = await handler.execute({ branchId: 'branch-1' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.itemId).toBe('item-1');
  });

  it('returns all tenant items when branchId is null', async () => {
    const itemA = InventoryItem.create({
      itemId: 'item-1',
      tenantId: 'default',
      branchId: 'branch-1',
      sku: 'SKU-1',
      nameEn: 'Item One',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 5,
      reorderThreshold: 1,
      expiryDate: null,
      supplierId: null,
    });
    const itemB = InventoryItem.create({
      itemId: 'item-2',
      tenantId: 'default',
      branchId: 'branch-2',
      sku: 'SKU-2',
      nameEn: 'Item Two',
      nameAr: null,
      unit: 'pcs',
      quantityOnHand: 3,
      reorderThreshold: 1,
      expiryDate: null,
      supplierId: null,
    });

    await repo.save(itemA);
    await repo.save(itemB);

    const result = await handler.execute({ branchId: null });

    expect(result.items).toHaveLength(2);
  });

  it('paginates large in-memory catalogs without loading all rows into the response', async () => {
    const itemCount = 2_500;
    for (let i = 0; i < itemCount; i += 1) {
      await repo.save(
        InventoryItem.create({
          itemId: `scale-item-${i}`,
          tenantId: 'default',
          branchId: 'branch-1',
          sku: `SCALE-${String(i).padStart(5, '0')}`,
          nameEn: `Scale Item ${i}`,
          nameAr: null,
          unit: 'pcs',
          quantityOnHand: i % 50,
          reorderThreshold: 5,
          expiryDate: null,
          supplierId: null,
        }),
      );
    }

    const started = performance.now();
    const result = await handler.execute({ limit: 100, offset: 2_400 });
    const elapsed = performance.now() - started;

    expect(result.total).toBe(itemCount);
    expect(result.items).toHaveLength(100);
    expect(result.items[0]?.sku).toBe('SCALE-02400');
    expect(elapsed).toBeLessThan(2_000);
  });

  it('ignores single-character search terms at the API layer', async () => {
    await repo.save(
      InventoryItem.create({
        itemId: 'search-item',
        tenantId: 'default',
        branchId: 'branch-1',
        sku: 'ABC-123',
        nameEn: 'Alpha Supply',
        nameAr: null,
        unit: 'pcs',
        quantityOnHand: 10,
        reorderThreshold: 2,
        expiryDate: null,
        supplierId: null,
      }),
    );

    const filtered = await handler.execute({ q: 'a' });
    expect(filtered.total).toBe(1);

    const narrowed = await handler.execute({ q: 'ab' });
    expect(narrowed.total).toBe(1);
    expect(narrowed.items[0]?.sku).toBe('ABC-123');
  });
});

