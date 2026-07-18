export interface LocalizedName {
  en: string;
  ar: string | null;
}

export interface InventoryCategory {
  categoryId: string;
  key: string;
  nameEn: string;
  nameAr: string | null;
  sortOrder: number;
  isSystem: boolean;
}

export interface InventoryItem {
  itemId: string;
  tenantId: string;
  branchId: string | null;
  categoryId: string | null;
  sku: string;
  barcode: string | null;
  brand: string | null;
  name: LocalizedName;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  costPerUnit: number | null;
  sellingPrice: number | null;
  storageLocation: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  supplierId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export type StockMovementType = 'INITIAL' | 'RECEIVE' | 'CONSUME' | 'ADJUST' | 'DISPOSE' | 'TRANSFER_OUT' | 'TRANSFER_IN';

export interface InventoryMovement {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  movementType: StockMovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unit: string;
  reason: string | null;
  notes: string | null;
  encounterId: string | null;
  performedBy: string;
  createdAt: string;
}

export interface InventoryMovementListResponse {
  movements: InventoryMovement[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  stockValue: number;
  activeSupplierCount: number;
  pendingPoApprovalCount: number;
  openPoCount: number;
  activeWarehouseCount: number;
  openTransferCount: number;
  pendingCountApprovalCount: number;
  openCountSessions: number;
  pendingRequestApprovalCount?: number;
  openRequestFulfillmentCount?: number;
  recentMovements: InventoryMovement[];
}

export interface InventorySupplier {
  supplierId: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  metrics: {
    linkedItemCount: number;
    orderCount: number;
    avgLeadTimeDays: number | null;
    lastOrderDate?: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface InventorySupplierListResponse {
  suppliers: InventorySupplier[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventoryWarehouse {
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
  createdAt: string;
  updatedAt: string;
}

export interface InventoryWarehouseListResponse {
  warehouses: InventoryWarehouse[];
  total: number;
  limit: number;
  offset: number;
}

export interface WarehouseStockLevel {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantityOnHand: number;
}

export type StockTransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';

export interface StockTransferLine {
  lineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  quantityReceived: number;
  quantityRemaining: number;
}

export interface StockTransfer {
  transferId: string;
  transferNumber: string;
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId: string;
  toWarehouseName: string;
  status: StockTransferStatus;
  notes: string | null;
  requestedBy: string;
  shippedAt: string | null;
  receivedAt: string | null;
  lines: StockTransferLine[];
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferListResponse {
  transfers: StockTransfer[];
  total: number;
  limit: number;
  offset: number;
}

export type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';

export interface StockCountLine {
  lineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
}

export interface StockCount {
  countId: string;
  countNumber: string;
  warehouseId: string;
  warehouseName: string;
  status: StockCountStatus;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  metrics: {
    lineCount: number;
    countedLineCount: number;
    varianceLineCount: number;
  };
  lines: StockCountLine[];
  createdAt: string;
  updatedAt: string;
}

export interface StockCountListResponse {
  counts: StockCount[];
  total: number;
  limit: number;
  offset: number;
}

export type StockRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'FULFILLED' | 'REJECTED' | 'CANCELLED';
export type StockRequestType = 'DEPARTMENT' | 'CLINICAL';

export interface StockRequestLine {
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

export interface StockRequest {
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
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  fulfilledBy: string | null;
  fulfilledAt: string | null;
  metrics: {
    lineCount: number;
    fulfilledLineCount: number;
    totalRequested: number;
    totalFulfilled: number;
  };
  lines: StockRequestLine[];
  createdAt: string;
  updatedAt: string;
}

export interface StockRequestListResponse {
  requests: StockRequest[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventoryAnalytics {
  periodDays: number;
  generatedAt: string;
  valuation: {
    totalStockValue: number;
    itemCount: number;
    byCategory: Array<{ categoryKey: string; categoryName: string; stockValue: number; itemCount: number }>;
  };
  stockHealth: {
    lowStock: number;
    outOfStock: number;
    expiringSoon: number;
    expired: number;
  };
  consumption: {
    totalQuantity: number;
    eventCount: number;
    byDay: Array<{ date: string; quantity: number; events: number }>;
    topItems: Array<{ itemId: string; sku: string; name: string; unit: string; quantity: number }>;
    byCategory: Array<{ categoryKey: string; categoryName: string; quantity: number }>;
    byProcedure: Array<{ procedureCode: string; quantity: number }>;
  };
  procurement: {
    activeSupplierCount: number;
    orderedValue: number;
    receivedValue: number;
    byStatus: Array<{ status: string; count: number }>;
    topSuppliers: Array<{ supplierId: string; supplierName: string; orderCount: number }>;
  };
  movements: {
    byType: Array<{ movementType: string; count: number; quantity: number }>;
  };
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface PurchaseOrderLine {
  lineId: string;
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number | null;
}

export interface PurchaseOrder {
  orderId: string;
  poNumber: string;
  supplierId: string | null;
  supplierName: string | null;
  status: PurchaseOrderStatus;
  notes: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  lines: PurchaseOrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderListResponse {
  orders: PurchaseOrder[];
  total: number;
  limit: number;
  offset: number;
}

export type InventoryStockFilter = 'all' | 'low' | 'out' | 'expiring' | 'expired';
export type InventoryStatusFilter = 'active' | 'archived';
export type InventoryLookupMatch = 'barcode' | 'sku';

export interface InventoryLookupResult {
  matchedBy: InventoryLookupMatch;
  item: InventoryItem;
}

export type BatchStatus = 'ACTIVE' | 'DEPLETED' | 'DISPOSED';
export type BatchExpiryFilter = 'all' | 'expiring' | 'expired' | 'none';

export interface InventoryBatch {
  batchId: string;
  itemId: string;
  sku?: string;
  itemName?: string;
  lotNumber: string | null;
  manufacturedDate: string | null;
  expiryDate: string | null;
  quantityOnHand: number;
  unit: string;
  status: BatchStatus;
  receivedAt: string;
}

export interface InventoryBatchListResponse {
  batches: InventoryBatch[];
  total: number;
  limit: number;
  offset: number;
}

export interface InventoryExpirySummary {
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
