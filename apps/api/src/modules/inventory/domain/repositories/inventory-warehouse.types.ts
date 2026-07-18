export interface InventoryWarehouseRecord {
  warehouseId: string;
  branchId: string | null;
  code: string;
  nameEn: string;
  nameAr: string | null;
  address: string | null;
  isDefault: boolean;
  isActive: boolean;
  metrics: {
    itemCount: number;
    totalQuantity: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WarehouseStockRecord {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantityOnHand: number;
}

export interface InventoryWarehouseListFilter {
  tenantId: string;
  q?: string;
  status?: 'active' | 'all';
  limit: number;
  offset: number;
}

export interface WarehouseStockListFilter {
  tenantId: string;
  warehouseId?: string;
  itemId?: string;
  q?: string;
  limit: number;
  offset: number;
}

export interface StockDeltaResult {
  itemQtyBefore: number;
  itemQtyAfter: number;
  warehouseQtyBefore: number;
  warehouseQtyAfter: number;
}
