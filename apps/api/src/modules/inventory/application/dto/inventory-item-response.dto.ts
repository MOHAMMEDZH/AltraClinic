import { LocalizedText } from '../../domain/value-objects/localized-text.vo';

export class InventoryItemResponseDTO {
  itemId!: string;
  tenantId!: string;
  branchId!: string | null;
  sku!: string;
  name!: LocalizedText;
  unit!: string;
  quantityOnHand!: number;
  reorderThreshold!: number;
  expiryDate!: string | null;
  supplierId!: string | null;
  createdAt!: string;
  updatedAt!: string;
}
