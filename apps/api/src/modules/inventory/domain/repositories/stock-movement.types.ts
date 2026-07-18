export const STOCK_MOVEMENT_TYPES = ['INITIAL', 'RECEIVE', 'CONSUME', 'ADJUST', 'DISPOSE', 'TRANSFER_OUT', 'TRANSFER_IN'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export interface StockMovementRecord {
  id: string;
  inventoryItemId: string;
  sku: string;
  itemNameEn: string;
  movementType: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unit: string;
  reason: string | null;
  notes: string | null;
  encounterId: string | null;
  performedBy: string;
  createdAt: Date;
}

export interface StockMovementListFilter {
  tenantId: string;
  itemId?: string;
  encounterId?: string;
  movementType?: StockMovementType;
  limit: number;
  offset: number;
}

export interface StockMovementListResult {
  movements: StockMovementRecord[];
  total: number;
}
