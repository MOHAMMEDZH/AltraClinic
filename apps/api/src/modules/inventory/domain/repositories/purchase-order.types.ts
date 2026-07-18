export const PURCHASE_ORDER_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export interface PurchaseOrderLineRecord {
  lineId: string;
  purchaseOrderId: string;
  itemId: string;
  sku: string;
  itemNameEn: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number | null;
  sortOrder: number;
}

export interface PurchaseOrderRecord {
  orderId: string;
  tenantId: string;
  poNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  status: PurchaseOrderStatus;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  lines: PurchaseOrderLineRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderListFilter {
  tenantId: string;
  status?: PurchaseOrderStatus | 'OPEN';
  supplierId?: string;
  limit: number;
  offset: number;
}

export interface PurchaseOrderSummaryCounts {
  pendingApprovalCount: number;
  openPoCount: number;
}
