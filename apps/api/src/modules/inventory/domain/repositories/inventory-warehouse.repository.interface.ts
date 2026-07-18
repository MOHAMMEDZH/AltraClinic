import type {
  InventoryWarehouseListFilter,
  InventoryWarehouseRecord,
  StockDeltaResult,
  WarehouseStockListFilter,
  WarehouseStockRecord,
} from './inventory-warehouse.types';

export interface InventoryWarehouseRepository {
  list(filter: InventoryWarehouseListFilter): Promise<{ warehouses: InventoryWarehouseRecord[]; total: number }>;
  findById(tenantId: string, warehouseId: string): Promise<InventoryWarehouseRecord | null>;
  findByCode(tenantId: string, code: string): Promise<{ warehouseId: string } | null>;
  create(input: {
    tenantId: string;
    branchId?: string | null;
    code: string;
    nameEn: string;
    nameAr?: string | null;
    address?: string | null;
    isDefault?: boolean;
  }): Promise<{ warehouseId: string }>;
  update(input: {
    tenantId: string;
    warehouseId: string;
    code?: string;
    nameEn?: string;
    nameAr?: string | null;
    address?: string | null;
    branchId?: string | null;
  }): Promise<void>;
  deactivate(tenantId: string, warehouseId: string): Promise<void>;
  reactivate(tenantId: string, warehouseId: string): Promise<void>;
  setDefault(tenantId: string, warehouseId: string): Promise<void>;
  countActive(tenantId: string): Promise<number>;
  existsActive(tenantId: string, warehouseId: string): Promise<boolean>;
  ensureDefaultWarehouseId(tenantId: string): Promise<string>;
  applyStockDelta(input: {
    tenantId: string;
    warehouseId: string;
    itemId: string;
    delta: number;
  }): Promise<StockDeltaResult>;
  listStock(filter: WarehouseStockListFilter): Promise<{ stock: WarehouseStockRecord[]; total: number }>;
  listStockForItem(tenantId: string, itemId: string): Promise<WarehouseStockRecord[]>;
}
