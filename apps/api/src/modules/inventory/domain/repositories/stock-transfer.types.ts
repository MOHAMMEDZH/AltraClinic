export type StockTransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface StockTransferLineRecord {
  lineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  quantityReceived: number;
  quantityRemaining: number;
}

export interface StockTransferRecord {
  transferId: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: StockTransferStatus;
  notes: string | null;
  requestedBy: string;
  shippedAt: Date | null;
  receivedAt: Date | null;
  lines: StockTransferLineRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StockTransferListFilter {
  tenantId: string;
  status?: string;
  warehouseId?: string;
  limit: number;
  offset: number;
}
