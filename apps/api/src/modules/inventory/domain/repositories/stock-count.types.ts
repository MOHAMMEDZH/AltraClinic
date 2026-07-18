export type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';

export interface StockCountLineRecord {
  lineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
}

export interface StockCountRecord {
  countId: string;
  countNumber: string;
  warehouseId: string;
  warehouseName: string;
  status: StockCountStatus;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  lines: StockCountLineRecord[];
  metrics: {
    lineCount: number;
    countedLineCount: number;
    varianceLineCount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface StockCountListFilter {
  tenantId: string;
  status?: string;
  warehouseId?: string;
  limit: number;
  offset: number;
}

export interface StockCountSummaryCounts {
  pendingApprovalCount: number;
  inProgressCount: number;
}
