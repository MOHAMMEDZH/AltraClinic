import { Test, TestingModule } from '@nestjs/testing';
import { ExportInventoryItemsHandler } from '../application/handlers/export-inventory-items.handler';
import { BulkArchiveInventoryItemsHandler } from '../application/handlers/bulk-archive-inventory-items.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { INVENTORY_ITEM_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InventoryItem } from '../domain/entities/inventory-item.entity';

describe('ExportInventoryItemsHandler', () => {
  let handler: ExportInventoryItemsHandler;
  let repo: InMemoryInventoryItemRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportInventoryItemsHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useClass: InMemoryInventoryItemRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(ExportInventoryItemsHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);

    await repo.save(
      InventoryItem.create({
        itemId: 'item-export-1',
        tenantId: 'default',
        branchId: null,
        sku: 'SKU-1',
        barcode: '111',
        nameEn: 'Item One',
        nameAr: null,
        unit: 'box',
        quantityOnHand: 5,
        reorderThreshold: 2,
        expiryDate: null,
        supplierId: null,
      }),
    );
  });

  it('exports selected item ids as csv', async () => {
    const csv = await handler.execute({ itemIds: ['item-export-1'] });
    expect(csv).toContain('SKU,Barcode');
    expect(csv).toContain('SKU-1');
    expect(csv).toContain('Item One');
  });
});

describe('BulkArchiveInventoryItemsHandler', () => {
  let handler: BulkArchiveInventoryItemsHandler;
  let repo: InMemoryInventoryItemRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BulkArchiveInventoryItemsHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useClass: InMemoryInventoryItemRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(BulkArchiveInventoryItemsHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);

    await repo.save(
      InventoryItem.create({
        itemId: 'item-archive-1',
        tenantId: 'default',
        branchId: null,
        sku: 'SKU-A',
        barcode: null,
        nameEn: 'Archive Me',
        nameAr: null,
        unit: 'ea',
        quantityOnHand: 1,
        reorderThreshold: 0,
        expiryDate: null,
        supplierId: null,
      }),
    );
  });

  it('archives multiple items and reports skipped entries', async () => {
    const result = await handler.execute({ itemIds: ['item-archive-1', 'missing-id'] });
    expect(result.archived).toEqual(['item-archive-1']);
    expect(result.skipped).toEqual([{ itemId: 'missing-id', reason: 'not_found' }]);
    await expect(repo.findById('default', 'item-archive-1')).resolves.toBeNull();
  });
});
