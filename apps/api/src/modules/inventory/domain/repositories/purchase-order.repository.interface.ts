import type {
  PurchaseOrderListFilter,
  PurchaseOrderRecord,
  PurchaseOrderSummaryCounts,
} from './purchase-order.types';

export interface PurchaseOrderRepository {
  create(input: {
    tenantId: string;
    supplierId?: string | null;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
  }): Promise<{ orderId: string; poNumber: string }>;
  list(filter: PurchaseOrderListFilter): Promise<{ orders: PurchaseOrderRecord[]; total: number }>;
  findById(tenantId: string, orderId: string): Promise<PurchaseOrderRecord | null>;
  findLineById(tenantId: string, lineId: string): Promise<(PurchaseOrderLineWithOrder) | null>;
  submit(tenantId: string, orderId: string): Promise<void>;
  approve(tenantId: string, orderId: string, approvedBy: string): Promise<void>;
  cancel(tenantId: string, orderId: string): Promise<void>;
  incrementLineReceived(tenantId: string, lineId: string, quantity: number): Promise<void>;
  recomputeOrderStatus(tenantId: string, orderId: string): Promise<void>;
  getSummaryCounts(tenantId: string): Promise<PurchaseOrderSummaryCounts>;
}

export interface PurchaseOrderLineWithOrder {
  lineId: string;
  purchaseOrderId: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  poNumber: string;
  status: string;
}
