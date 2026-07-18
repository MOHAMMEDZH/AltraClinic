export const BATCH_EXPIRY_ALERT_DAYS = 30;

export type BatchStatus = 'ACTIVE' | 'DEPLETED' | 'DISPOSED';

export interface InventoryBatchRecord {
  batchId: string;
  tenantId: string;
  inventoryItemId: string;
  sku: string;
  itemNameEn: string;
  unit: string;
  lotNumber: string | null;
  manufacturedDate: Date | null;
  expiryDate: Date | null;
  quantityOnHand: number;
  status: BatchStatus;
  receivedAt: Date;
}

export interface BatchListFilter {
  tenantId: string;
  itemId?: string;
  expiry?: 'all' | 'expiring' | 'expired' | 'none';
  status?: BatchStatus | 'ACTIVE_ONLY';
  limit: number;
  offset: number;
}

export interface BatchListResult {
  batches: InventoryBatchRecord[];
  total: number;
}

export interface ExpirySummaryResult {
  expiringSoonCount: number;
  expiredCount: number;
  alertDays: number;
  recentDisposals: Array<{
    id: string;
    itemId: string;
    batchId: string | null;
    sku: string;
    itemName: string;
    quantity: number;
    unit: string;
    reason: string;
    disposedAt: string;
  }>;
}
