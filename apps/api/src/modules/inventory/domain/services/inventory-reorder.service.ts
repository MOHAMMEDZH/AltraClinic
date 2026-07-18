import { Injectable } from '@nestjs/common';
import { InventoryItem } from '../entities/inventory-item.entity';

export interface ReorderCandidate {
  itemId: string;
  sku: string;
  nameEn: string;
  supplierId: string | null;
  quantityOnHand: number;
  reorderThreshold: number;
  orderQuantity: number;
  unitCost: number | null;
}

@Injectable()
export class InventoryReorderService {
  needsReorder(item: InventoryItem): boolean {
    return item.needsReorder();
  }

  computeOrderQuantity(input: {
    quantityOnHand: number;
    reorderThreshold: number;
    minQuantity?: number | null;
    maxQuantity?: number | null;
  }): number {
    const qty = input.quantityOnHand;
    if (input.maxQuantity != null && input.maxQuantity > qty) {
      return Math.ceil(input.maxQuantity - qty);
    }
    const floor = input.minQuantity ?? 0;
    const target = Math.max(floor + input.reorderThreshold, input.reorderThreshold * 2);
    return Math.max(1, Math.ceil(target - qty));
  }
}
