import type { InventoryWarehouseRepository } from '../domain/repositories/inventory-warehouse.repository.interface';
import type { InventoryItemRepository } from '../domain/repositories/inventory-item.repository.interface';

export function createMockWarehouseRepo(repo: InventoryItemRepository): InventoryWarehouseRepository {
  const warehouseStock = new Map<string, number>();

  return {
    list: async () => ({ warehouses: [], total: 0 }),
    findById: async () => null,
    findByCode: async () => null,
    create: async () => ({ warehouseId: 'warehouse-1' }),
    update: async () => {},
    deactivate: async () => {},
    reactivate: async () => {},
    setDefault: async () => {},
    countActive: async () => 1,
    existsActive: async () => true,
    ensureDefaultWarehouseId: async () => 'warehouse-1',
    applyStockDelta: async ({ tenantId, warehouseId, itemId, delta }) => {
      const key = `${warehouseId}:${itemId}`;
      const warehouseQtyBefore = warehouseStock.get(key) ?? 0;
      const warehouseQtyAfter = warehouseQtyBefore + delta;
      if (warehouseQtyAfter < 0) throw new Error('Insufficient stock at warehouse');
      warehouseStock.set(key, warehouseQtyAfter);

      const item = await repo.findById(tenantId, itemId);
      if (!item) throw new Error('Inventory item not found');
      const itemQtyBefore = item.quantityOnHand;

      let itemTotal = 0;
      for (const [stockKey, qty] of warehouseStock) {
        if (stockKey.endsWith(`:${itemId}`)) itemTotal += qty;
      }

      if (itemTotal !== item.quantityOnHand) {
        item.adjustTo(itemTotal);
        await repo.save(item);
      }

      return {
        itemQtyBefore,
        itemQtyAfter: itemTotal,
        warehouseQtyBefore,
        warehouseQtyAfter,
      };
    },
    listStock: async () => ({ stock: [], total: 0 }),
    listStockForItem: async () => [],
  };
}
