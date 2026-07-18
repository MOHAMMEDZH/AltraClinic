import { InventoryReorderService } from '../domain/services/inventory-reorder.service';

describe('InventoryReorderService', () => {
  const service = new InventoryReorderService();

  it('computes order quantity to max when maxQuantity is set', () => {
    expect(
      service.computeOrderQuantity({
        quantityOnHand: 3,
        reorderThreshold: 5,
        maxQuantity: 20,
      }),
    ).toBe(17);
  });

  it('computes minimum reorder when no maxQuantity', () => {
    expect(
      service.computeOrderQuantity({
        quantityOnHand: 2,
        reorderThreshold: 5,
        minQuantity: 1,
      }),
    ).toBeGreaterThanOrEqual(1);
  });
});
