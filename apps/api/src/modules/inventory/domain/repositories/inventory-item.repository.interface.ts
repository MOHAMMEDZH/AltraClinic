import { InventoryItem } from '../entities/inventory-item.entity';
import type {
  ConsumptionLogRecord,
  ConsumptionListFilter,
  ConsumptionListResult,
  InventoryListFilter,
  InventoryListResult,
} from './inventory-list.filter';
import type {
  StockMovementListFilter,
  StockMovementListResult,
  StockMovementRecord,
  StockMovementType,
} from './stock-movement.types';
import type {
  BatchListFilter,
  BatchListResult,
  ExpirySummaryResult,
  InventoryBatchRecord,
} from './inventory-batch.types';

export interface InventoryItemRepository {
  save(item: InventoryItem): Promise<void>;
  findById(tenantId: string, itemId: string, includeArchived?: boolean): Promise<InventoryItem | null>;
  findBySku(tenantId: string, sku: string): Promise<InventoryItem | null>;
  findByBarcode(tenantId: string, barcode: string): Promise<InventoryItem | null>;
  findByIds(tenantId: string, itemIds: string[], includeArchived?: boolean): Promise<InventoryItem[]>;
  findByBranch(tenantId: string, branchId?: string | null): Promise<InventoryItem[]>;
  listPage(filter: InventoryListFilter): Promise<InventoryListResult>;
  findByIds(tenantId: string, itemIds: string[], includeArchived?: boolean): Promise<InventoryItem[]>;
  archive(tenantId: string, itemId: string): Promise<void>;
  reactivate(tenantId: string, itemId: string): Promise<void>;
  recordConsumption(input: {
    tenantId: string;
    inventoryItemId: string;
    quantityUsed: number;
    consumedBy: string;
    notes?: string | null;
    encounterId?: string | null;
    patientId?: string | null;
    procedureCode?: string | null;
  }): Promise<void>;
  listConsumptions(filter: ConsumptionListFilter): Promise<ConsumptionListResult>;
  findConsumptionsByIds(tenantId: string, consumptionIds: string[]): Promise<ConsumptionLogRecord[]>;
  recordStockMovement(input: {
    tenantId: string;
    inventoryItemId: string;
    movementType: StockMovementType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    reason?: string | null;
    notes?: string | null;
    encounterId?: string | null;
    patientId?: string | null;
    procedureCode?: string | null;
    performedBy: string;
    warehouseId?: string | null;
  }): Promise<string>;
  listStockMovements(filter: StockMovementListFilter): Promise<StockMovementListResult>;
  listRecentStockMovements(tenantId: string, limit: number): Promise<StockMovementRecord[]>;
  createBatch(input: {
    tenantId: string;
    inventoryItemId: string;
    lotNumber?: string | null;
    manufacturedDate?: Date | null;
    expiryDate?: Date | null;
    quantity: number;
  }): Promise<string>;
  listBatches(filter: BatchListFilter): Promise<BatchListResult>;
  listBatchesForItem(tenantId: string, itemId: string): Promise<InventoryBatchRecord[]>;
  consumeFifoBatches(tenantId: string, itemId: string, quantity: number): Promise<number>;
  disposeBatch(input: {
    tenantId: string;
    batchId: string;
    quantity: number;
    reason: string;
    notes?: string | null;
    disposedBy: string;
  }): Promise<{ itemId: string; quantity: number }>;
  getExpirySummary(tenantId: string): Promise<ExpirySummaryResult>;
}
