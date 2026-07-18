export type StockRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';
export type StockRequestType = 'DEPARTMENT' | 'CLINICAL';

export interface StockRequestLineRecord {
  lineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantityRequested: number;
  quantityFulfilled: number;
  quantityRemaining: number;
  notes: string | null;
}

export interface StockRequestRecord {
  requestId: string;
  requestNumber: string;
  requestType: StockRequestType;
  status: StockRequestStatus;
  departmentName: string | null;
  patientId: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  fulfilledBy: string | null;
  fulfilledAt: Date | null;
  lines: StockRequestLineRecord[];
  metrics: {
    lineCount: number;
    fulfilledLineCount: number;
    totalRequested: number;
    totalFulfilled: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface StockRequestListFilter {
  tenantId: string;
  status?: string;
  requestType?: string;
  requestedBy?: string;
  limit: number;
  offset: number;
}

export interface StockRequestSummaryCounts {
  pendingApprovalCount: number;
  openFulfillmentCount: number;
}
