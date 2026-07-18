import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LookupInventoryItemHandler } from '../application/handlers/lookup-inventory-item.handler';
import { InMemoryInventoryItemRepository } from '../infrastructure/in-memory-inventory.repository';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { INVENTORY_ITEM_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { InventoryItem } from '../domain/entities/inventory-item.entity';

describe('LookupInventoryItemHandler', () => {
  let handler: LookupInventoryItemHandler;
  let repo: InMemoryInventoryItemRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LookupInventoryItemHandler,
        { provide: INVENTORY_ITEM_REPOSITORY, useClass: InMemoryInventoryItemRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'default', environment: 'sandbox' }) },
        },
      ],
    }).compile();

    handler = module.get(LookupInventoryItemHandler);
    repo = module.get(INVENTORY_ITEM_REPOSITORY);

    const item = InventoryItem.create({
      itemId: 'item-bc-1',
      tenantId: 'default',
      branchId: null,
      sku: 'GLOVE-M',
      barcode: '5901234123457',
      nameEn: 'Gloves M',
      nameAr: null,
      unit: 'box',
      quantityOnHand: 12,
      reorderThreshold: 3,
      expiryDate: null,
      supplierId: null,
    });
    await repo.save(item);
  });

  it('finds item by barcode', async () => {
    const result = await handler.execute({ code: '5901234123457' });
    expect(result.matchedBy).toBe('barcode');
    expect(result.item.sku).toBe('GLOVE-M');
  });

  it('finds item by sku when barcode does not match', async () => {
    const result = await handler.execute({ code: 'GLOVE-M' });
    expect(result.matchedBy).toBe('sku');
    expect(result.item.itemId).toBe('item-bc-1');
  });

  it('throws when code is unknown', async () => {
    await expect(handler.execute({ code: 'UNKNOWN-CODE' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
