export interface CreateInventoryItemCommand {
  branchId?: string | null;
  categoryId?: string | null;
  sku: string;
  barcode?: string | null;
  brand?: string | null;
  nameEn: string;
  nameAr?: string | null;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  expiryDate?: string | null;
  supplierId?: string | null;
  costPerUnit?: number | null;
  sellingPrice?: number | null;
  storageLocation?: string | null;
  lotNumber?: string | null;
}
