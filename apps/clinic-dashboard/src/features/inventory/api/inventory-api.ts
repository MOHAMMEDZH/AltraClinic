import { ApiError, API_BASE, apiRequest } from '@/lib/api-client';
import type {
  InventoryItem,
  InventoryListResponse,
  InventorySummary,
  InventoryMovement,
  InventoryMovementListResponse,
  InventoryCategory,
  InventoryBatch,
  InventoryBatchListResponse,
  InventoryExpirySummary,
  BatchExpiryFilter,
  InventorySupplier,
  InventorySupplierListResponse,
  InventoryWarehouse,
  InventoryWarehouseListResponse,
  WarehouseStockLevel,
  StockTransfer,
  StockTransferListResponse,
  StockCount,
  StockCountListResponse,
  StockRequest,
  StockRequestListResponse,
  InventoryAnalytics,
  InventoryLookupResult,
  PurchaseOrder,
  PurchaseOrderListResponse,
} from '../types/inventory.types';

function mapItem(raw: Record<string, unknown>): InventoryItem {
  const name = raw.name as Record<string, unknown> | undefined;
  return {
    itemId: String(raw.itemId ?? raw.id ?? ''),
    tenantId: String(raw.tenantId ?? ''),
    branchId: raw.branchId ? String(raw.branchId) : null,
    categoryId: raw.categoryId != null ? String(raw.categoryId) : null,
    sku: String(raw.sku ?? ''),
    barcode: raw.barcode != null ? String(raw.barcode) : null,
    brand: raw.brand != null ? String(raw.brand) : null,
    name: {
      en: String(name?.en ?? raw.nameEn ?? ''),
      ar: name?.ar != null ? String(name.ar) : raw.nameAr != null ? String(raw.nameAr) : null,
    },
    unit: String(raw.unit ?? ''),
    quantityOnHand: Number(raw.quantityOnHand ?? 0),
    reorderThreshold: Number(raw.reorderThreshold ?? 0),
    minQuantity: raw.minQuantity != null ? Number(raw.minQuantity) : null,
    maxQuantity: raw.maxQuantity != null ? Number(raw.maxQuantity) : null,
    costPerUnit: raw.costPerUnit != null ? Number(raw.costPerUnit) : null,
    sellingPrice: raw.sellingPrice != null ? Number(raw.sellingPrice) : null,
    storageLocation: raw.storageLocation != null ? String(raw.storageLocation) : null,
    lotNumber: raw.lotNumber != null ? String(raw.lotNumber) : null,
    expiryDate: raw.expiryDate ? String(raw.expiryDate) : null,
    supplierId: raw.supplierId != null ? String(raw.supplierId) : null,
    archivedAt: raw.archivedAt ? String(raw.archivedAt) : null,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

function mapMovement(raw: Record<string, unknown>): InventoryMovement {
  return {
    id: String(raw.id ?? ''),
    itemId: String(raw.itemId ?? raw.inventoryItemId ?? ''),
    sku: String(raw.sku ?? ''),
    itemName: String(raw.itemName ?? raw.itemNameEn ?? ''),
    movementType: String(raw.movementType ?? 'CONSUME') as InventoryMovement['movementType'],
    quantity: Number(raw.quantity ?? 0),
    quantityBefore: Number(raw.quantityBefore ?? 0),
    quantityAfter: Number(raw.quantityAfter ?? 0),
    unit: String(raw.unit ?? ''),
    reason: raw.reason != null ? String(raw.reason) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    encounterId: raw.encounterId != null ? String(raw.encounterId) : null,
    performedBy: String(raw.performedBy ?? raw.consumedBy ?? ''),
    createdAt: String(raw.createdAt ?? raw.consumedAt ?? new Date().toISOString()),
  };
}

function mapBatch(raw: Record<string, unknown>): InventoryBatch {
  return {
    batchId: String(raw.batchId ?? ''),
    itemId: String(raw.itemId ?? raw.inventoryItemId ?? ''),
    sku: raw.sku != null ? String(raw.sku) : undefined,
    itemName: raw.itemName != null ? String(raw.itemName) : raw.itemNameEn != null ? String(raw.itemNameEn) : undefined,
    lotNumber: raw.lotNumber != null ? String(raw.lotNumber) : null,
    manufacturedDate: raw.manufacturedDate ? String(raw.manufacturedDate) : null,
    expiryDate: raw.expiryDate ? String(raw.expiryDate) : null,
    quantityOnHand: Number(raw.quantityOnHand ?? 0),
    unit: String(raw.unit ?? ''),
    status: String(raw.status ?? 'ACTIVE') as InventoryBatch['status'],
    receivedAt: String(raw.receivedAt ?? new Date().toISOString()),
  };
}

export async function fetchInventorySummary(
  token: string,
  tenantId: string,
): Promise<InventorySummary> {
  const data = await apiRequest<InventorySummary>('/inventory/summary', { token, tenantId });
  return {
    ...data,
    activeSupplierCount: data.activeSupplierCount ?? 0,
    pendingPoApprovalCount: data.pendingPoApprovalCount ?? 0,
    openPoCount: data.openPoCount ?? 0,
    activeWarehouseCount: data.activeWarehouseCount ?? 0,
    openTransferCount: data.openTransferCount ?? 0,
    pendingCountApprovalCount: data.pendingCountApprovalCount ?? 0,
    openCountSessions: data.openCountSessions ?? 0,
    pendingRequestApprovalCount: data.pendingRequestApprovalCount ?? 0,
    openRequestFulfillmentCount: data.openRequestFulfillmentCount ?? 0,
    recentMovements: (data.recentMovements ?? []).map((row) =>
      mapMovement(row as unknown as Record<string, unknown>),
    ),
  };
}

export async function fetchInventoryItems(
  token: string,
  tenantId: string,
  params: {
    q?: string;
    status?: string;
    stock?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<InventoryListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.stock && params.stock !== 'all') qs.set('stock', params.stock);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<InventoryListResponse>(`/inventory/items${suffix}`, { token, tenantId });
  return {
    ...data,
    items: (data.items ?? []).map((row) => mapItem(row as unknown as Record<string, unknown>)),
  };
}

export async function exportInventoryItemsCsv(
  token: string,
  tenantId: string,
  params: {
    itemIds?: string[];
    q?: string;
    status?: string;
    stock?: string;
    categoryId?: string;
  },
): Promise<{ blob: Blob; filename: string }> {
  const qs = new URLSearchParams();
  if (params.itemIds?.length) qs.set('ids', params.itemIds.join(','));
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.stock && params.stock !== 'all') qs.set('stock', params.stock);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const response = await fetch(`${API_BASE}/inventory/items/export${suffix}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
      Accept: 'text/csv',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const data = JSON.parse(text) as { message?: unknown };
      if (data.message) message = String(data.message);
    } catch {
      if (text) message = text;
    }
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`;
  return { blob: await response.blob(), filename };
}

export async function bulkArchiveInventoryItems(
  token: string,
  tenantId: string,
  itemIds: string[],
): Promise<{
  archived: string[];
  skipped: Array<{ itemId: string; reason: 'not_found' | 'already_archived' }>;
  count: number;
}> {
  return apiRequest('/inventory/items/bulk-archive', {
    method: 'POST',
    token,
    tenantId,
    body: { itemIds },
  });
}

export async function lookupInventoryItem(
  token: string,
  tenantId: string,
  code: string,
): Promise<InventoryLookupResult> {
  const qs = new URLSearchParams({ code: code.trim() });
  const data = await apiRequest<{ matchedBy: string; item: Record<string, unknown> }>(
    `/inventory/lookup?${qs.toString()}`,
    { token, tenantId },
  );
  return {
    matchedBy: data.matchedBy === 'sku' ? 'sku' : 'barcode',
    item: mapItem(data.item),
  };
}

export async function fetchInventoryItem(
  token: string,
  tenantId: string,
  itemId: string,
): Promise<InventoryItem> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/item/${encodeURIComponent(itemId)}`, {
    token,
    tenantId,
  });
  return mapItem(row);
}

export async function createInventoryItem(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ itemId: string }> {
  return apiRequest('/inventory/item', { method: 'POST', token, tenantId, body });
}

export async function updateInventoryItem(
  token: string,
  tenantId: string,
  itemId: string,
  body: Record<string, unknown>,
): Promise<InventoryItem> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/item/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
  return mapItem(row);
}

export async function consumeInventoryItem(
  token: string,
  tenantId: string,
  body: { itemId: string; quantity: number; notes?: string; sourceDocumentId?: string },
): Promise<{ itemId: string; quantity: number }> {
  return apiRequest('/inventory/item/consume', { method: 'POST', token, tenantId, body });
}

export async function receiveInventoryItem(
  token: string,
  tenantId: string,
  itemId: string,
  body: {
    quantity: number;
    notes?: string;
    lotNumber?: string;
    manufacturedDate?: string;
    expiryDate?: string;
  },
): Promise<InventoryItem> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/item/${encodeURIComponent(itemId)}/receive`,
    { method: 'POST', token, tenantId, body },
  );
  return mapItem(row);
}

export async function archiveInventoryItem(
  token: string,
  tenantId: string,
  itemId: string,
): Promise<void> {
  await apiRequest(`/inventory/item/${encodeURIComponent(itemId)}/archive`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function reactivateInventoryItem(
  token: string,
  tenantId: string,
  itemId: string,
): Promise<InventoryItem> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/item/${encodeURIComponent(itemId)}/reactivate`,
    { method: 'POST', token, tenantId },
  );
  return mapItem(row);
}

export async function fetchInventoryMovements(
  token: string,
  tenantId: string,
  params: { itemId?: string; encounterId?: string; movementType?: string; limit?: number; offset?: number },
): Promise<InventoryMovementListResponse> {
  const qs = new URLSearchParams();
  if (params.itemId) qs.set('itemId', params.itemId);
  if (params.encounterId) qs.set('encounterId', params.encounterId);
  if (params.movementType) qs.set('movementType', params.movementType);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<InventoryMovementListResponse>(`/inventory/movements${suffix}`, {
    token,
    tenantId,
  });
  return {
    ...data,
    movements: (data.movements ?? []).map((row) => mapMovement(row as unknown as Record<string, unknown>)),
  };
}

export async function adjustInventoryItem(
  token: string,
  tenantId: string,
  itemId: string,
  body: { quantityAfter: number; reason: string; notes?: string },
): Promise<InventoryItem> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/item/${encodeURIComponent(itemId)}/adjust`,
    { method: 'POST', token, tenantId, body },
  );
  return mapItem(row);
}

export async function fetchInventoryCategories(
  token: string,
  tenantId: string,
): Promise<InventoryCategory[]> {
  const data = await apiRequest<{ categories: InventoryCategory[] }>('/inventory/categories', {
    token,
    tenantId,
  });
  return data.categories ?? [];
}

export async function createInventoryCategory(
  token: string,
  tenantId: string,
  body: { nameEn: string; nameAr?: string | null; key?: string },
): Promise<{ categoryId: string }> {
  return apiRequest('/inventory/categories', { method: 'POST', token, tenantId, body });
}

export async function fetchInventoryExpirySummary(
  token: string,
  tenantId: string,
): Promise<InventoryExpirySummary> {
  return apiRequest<InventoryExpirySummary>('/inventory/expiry/summary', { token, tenantId });
}

export async function fetchInventoryBatches(
  token: string,
  tenantId: string,
  params: { itemId?: string; expiry?: BatchExpiryFilter; limit?: number; offset?: number },
): Promise<InventoryBatchListResponse> {
  const qs = new URLSearchParams();
  if (params.itemId) qs.set('itemId', params.itemId);
  if (params.expiry && params.expiry !== 'all') qs.set('expiry', params.expiry);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<InventoryBatchListResponse>(`/inventory/batches${suffix}`, { token, tenantId });
  return {
    ...data,
    batches: (data.batches ?? []).map((row) => mapBatch(row as unknown as Record<string, unknown>)),
  };
}

export async function fetchInventoryItemBatches(
  token: string,
  tenantId: string,
  itemId: string,
): Promise<InventoryBatch[]> {
  const data = await apiRequest<{ batches: InventoryBatch[] }>(
    `/inventory/item/${encodeURIComponent(itemId)}/batches`,
    { token, tenantId },
  );
  return (data.batches ?? []).map((row) => mapBatch(row as unknown as Record<string, unknown>));
}

export async function disposeInventoryBatch(
  token: string,
  tenantId: string,
  batchId: string,
  body: { quantity: number; reason: string; notes?: string },
): Promise<{ batchId: string; itemId: string; quantity: number }> {
  return apiRequest(`/inventory/batch/${encodeURIComponent(batchId)}/dispose`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

function mapSupplier(raw: Record<string, unknown>): InventorySupplier {
  const metrics = raw.metrics as Record<string, unknown> | undefined;
  return {
    supplierId: String(raw.supplierId ?? ''),
    code: String(raw.code ?? ''),
    nameEn: String(raw.nameEn ?? ''),
    nameAr: raw.nameAr != null ? String(raw.nameAr) : null,
    contactName: raw.contactName != null ? String(raw.contactName) : null,
    email: raw.email != null ? String(raw.email) : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    address: raw.address != null ? String(raw.address) : null,
    leadTimeDays: raw.leadTimeDays != null ? Number(raw.leadTimeDays) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    isActive: Boolean(raw.isActive ?? true),
    metrics: {
      linkedItemCount: Number(metrics?.linkedItemCount ?? 0),
      orderCount: Number(metrics?.orderCount ?? 0),
      avgLeadTimeDays: metrics?.avgLeadTimeDays != null ? Number(metrics.avgLeadTimeDays) : null,
      lastOrderDate: metrics?.lastOrderDate != null ? String(metrics.lastOrderDate) : null,
    },
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

export async function fetchInventorySuppliers(
  token: string,
  tenantId: string,
  params: { q?: string; status?: 'active' | 'all'; limit?: number; offset?: number },
): Promise<InventorySupplierListResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.status) qs.set('status', params.status);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<InventorySupplierListResponse>(`/inventory/suppliers${suffix}`, { token, tenantId });
  return {
    ...data,
    suppliers: (data.suppliers ?? []).map((row) => mapSupplier(row as unknown as Record<string, unknown>)),
  };
}

export async function fetchInventorySupplier(
  token: string,
  tenantId: string,
  supplierId: string,
): Promise<InventorySupplier> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/suppliers/${encodeURIComponent(supplierId)}`, {
    token,
    tenantId,
  });
  return mapSupplier(row);
}

export async function createInventorySupplier(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ supplierId: string }> {
  return apiRequest('/inventory/suppliers', { method: 'POST', token, tenantId, body });
}

export async function updateInventorySupplier(
  token: string,
  tenantId: string,
  supplierId: string,
  body: Record<string, unknown>,
): Promise<InventorySupplier> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/suppliers/${encodeURIComponent(supplierId)}`, {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
  return mapSupplier(row);
}

export async function deactivateInventorySupplier(
  token: string,
  tenantId: string,
  supplierId: string,
): Promise<InventorySupplier> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/suppliers/${encodeURIComponent(supplierId)}/deactivate`,
    { method: 'POST', token, tenantId },
  );
  return mapSupplier(row);
}

export async function reactivateInventorySupplier(
  token: string,
  tenantId: string,
  supplierId: string,
): Promise<InventorySupplier> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/suppliers/${encodeURIComponent(supplierId)}/reactivate`,
    { method: 'POST', token, tenantId },
  );
  return mapSupplier(row);
}

function mapPurchaseOrder(raw: Record<string, unknown>): PurchaseOrder {
  const lines = (raw.lines as Record<string, unknown>[] | undefined) ?? [];
  return {
    orderId: String(raw.orderId ?? ''),
    poNumber: String(raw.poNumber ?? ''),
    supplierId: raw.supplierId != null ? String(raw.supplierId) : null,
    supplierName: raw.supplierName != null ? String(raw.supplierName) : null,
    status: String(raw.status ?? 'DRAFT') as PurchaseOrder['status'],
    notes: raw.notes != null ? String(raw.notes) : null,
    requestedBy: String(raw.requestedBy ?? ''),
    approvedBy: raw.approvedBy != null ? String(raw.approvedBy) : null,
    approvedAt: raw.approvedAt ? String(raw.approvedAt) : null,
    lines: lines.map((l) => ({
      lineId: String(l.lineId ?? ''),
      itemId: String(l.itemId ?? ''),
      sku: String(l.sku ?? ''),
      itemName: String(l.itemName ?? ''),
      unit: String(l.unit ?? ''),
      quantityOrdered: Number(l.quantityOrdered ?? 0),
      quantityReceived: Number(l.quantityReceived ?? 0),
      quantityRemaining: Number(l.quantityRemaining ?? 0),
      unitCost: l.unitCost != null ? Number(l.unitCost) : null,
    })),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
}

export async function fetchPurchaseOrders(
  token: string,
  tenantId: string,
  params: { status?: string; supplierId?: string; limit?: number; offset?: number },
): Promise<PurchaseOrderListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.supplierId) qs.set('supplierId', params.supplierId);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<PurchaseOrderListResponse>(`/inventory/purchase-orders${suffix}`, { token, tenantId });
  return {
    ...data,
    orders: (data.orders ?? []).map((row) => mapPurchaseOrder(row as unknown as Record<string, unknown>)),
  };
}

export async function fetchPurchaseOrder(
  token: string,
  tenantId: string,
  orderId: string,
): Promise<PurchaseOrder> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/purchase-orders/${encodeURIComponent(orderId)}`, {
    token,
    tenantId,
  });
  return mapPurchaseOrder(row);
}

export async function createPurchaseOrder(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ orderId: string; poNumber: string }> {
  return apiRequest('/inventory/purchase-orders', { method: 'POST', token, tenantId, body });
}

export async function submitPurchaseOrder(
  token: string,
  tenantId: string,
  orderId: string,
): Promise<PurchaseOrder> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/purchase-orders/${encodeURIComponent(orderId)}/submit`,
    { method: 'POST', token, tenantId },
  );
  return mapPurchaseOrder(row);
}

export async function approvePurchaseOrder(
  token: string,
  tenantId: string,
  orderId: string,
): Promise<PurchaseOrder> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/purchase-orders/${encodeURIComponent(orderId)}/approve`,
    { method: 'POST', token, tenantId },
  );
  return mapPurchaseOrder(row);
}

export async function cancelPurchaseOrder(
  token: string,
  tenantId: string,
  orderId: string,
): Promise<PurchaseOrder> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/purchase-orders/${encodeURIComponent(orderId)}/cancel`,
    { method: 'POST', token, tenantId },
  );
  return mapPurchaseOrder(row);
}

export async function receivePurchaseOrderLine(
  token: string,
  tenantId: string,
  lineId: string,
  body: { quantity: number; lotNumber?: string; manufacturedDate?: string; expiryDate?: string; notes?: string },
): Promise<PurchaseOrder> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/purchase-orders/lines/${encodeURIComponent(lineId)}/receive`,
    { method: 'POST', token, tenantId, body },
  );
  return mapPurchaseOrder(row);
}

function mapWarehouse(raw: Record<string, unknown>): InventoryWarehouse {
  const metrics = raw.metrics as Record<string, unknown> | undefined;
  return {
    warehouseId: String(raw.warehouseId ?? raw.id ?? ''),
    branchId: raw.branchId ? String(raw.branchId) : null,
    code: String(raw.code ?? ''),
    nameEn: String(raw.nameEn ?? ''),
    nameAr: raw.nameAr != null ? String(raw.nameAr) : null,
    address: raw.address != null ? String(raw.address) : null,
    isDefault: Boolean(raw.isDefault),
    isActive: Boolean(raw.isActive ?? true),
    metrics: {
      itemCount: Number(metrics?.itemCount ?? 0),
      totalQuantity: Number(metrics?.totalQuantity ?? 0),
    },
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

function mapStockTransfer(raw: Record<string, unknown>): StockTransfer {
  const lines = (raw.lines as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    transferId: String(raw.transferId ?? raw.id ?? ''),
    transferNumber: String(raw.transferNumber ?? ''),
    fromWarehouseId: String(raw.fromWarehouseId ?? ''),
    fromWarehouseName: String(raw.fromWarehouseName ?? ''),
    toWarehouseId: String(raw.toWarehouseId ?? ''),
    toWarehouseName: String(raw.toWarehouseName ?? ''),
    status: raw.status as StockTransfer['status'],
    notes: raw.notes != null ? String(raw.notes) : null,
    requestedBy: String(raw.requestedBy ?? ''),
    shippedAt: raw.shippedAt ? String(raw.shippedAt) : null,
    receivedAt: raw.receivedAt ? String(raw.receivedAt) : null,
    lines: lines.map((line) => ({
      lineId: String(line.lineId ?? line.id ?? ''),
      itemId: String(line.itemId ?? ''),
      sku: String(line.sku ?? ''),
      itemName: String(line.itemName ?? ''),
      unit: String(line.unit ?? ''),
      quantity: Number(line.quantity ?? 0),
      quantityReceived: Number(line.quantityReceived ?? 0),
      quantityRemaining: Number(line.quantityRemaining ?? 0),
    })),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

export async function fetchInventoryWarehouses(
  token: string,
  tenantId: string,
  params?: { q?: string; status?: 'active' | 'all'; limit?: number; offset?: number },
): Promise<InventoryWarehouseListResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<InventoryWarehouseListResponse>(`/inventory/warehouses${suffix}`, { token, tenantId });
  return {
    ...data,
    warehouses: (data.warehouses ?? []).map((row) => mapWarehouse(row as unknown as Record<string, unknown>)),
  };
}

export async function createInventoryWarehouse(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ warehouseId: string }> {
  return apiRequest('/inventory/warehouses', { method: 'POST', token, tenantId, body });
}

export async function updateInventoryWarehouse(
  token: string,
  tenantId: string,
  warehouseId: string,
  body: Record<string, unknown>,
): Promise<InventoryWarehouse> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/warehouses/${encodeURIComponent(warehouseId)}`, {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
  return mapWarehouse(row);
}

export async function deactivateInventoryWarehouse(
  token: string,
  tenantId: string,
  warehouseId: string,
): Promise<InventoryWarehouse> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/warehouses/${encodeURIComponent(warehouseId)}/deactivate`,
    { method: 'POST', token, tenantId },
  );
  return mapWarehouse(row);
}

export async function reactivateInventoryWarehouse(
  token: string,
  tenantId: string,
  warehouseId: string,
): Promise<InventoryWarehouse> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/warehouses/${encodeURIComponent(warehouseId)}/reactivate`,
    { method: 'POST', token, tenantId },
  );
  return mapWarehouse(row);
}

export async function setDefaultInventoryWarehouse(
  token: string,
  tenantId: string,
  warehouseId: string,
): Promise<InventoryWarehouse> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/warehouses/${encodeURIComponent(warehouseId)}/set-default`,
    { method: 'POST', token, tenantId },
  );
  return mapWarehouse(row);
}

export async function fetchWarehouseStock(
  token: string,
  tenantId: string,
  params?: { warehouseId?: string; itemId?: string; q?: string; limit?: number; offset?: number },
): Promise<{ stock: WarehouseStockLevel[]; total: number; limit: number; offset: number }> {
  const qs = new URLSearchParams();
  if (params?.warehouseId) qs.set('warehouseId', params.warehouseId);
  if (params?.itemId) qs.set('itemId', params.itemId);
  if (params?.q) qs.set('q', params.q);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest(`/inventory/warehouses/stock${suffix}`, { token, tenantId });
}

export async function fetchItemWarehouseStock(
  token: string,
  tenantId: string,
  itemId: string,
): Promise<{ stock: WarehouseStockLevel[] }> {
  return apiRequest(`/inventory/item/${encodeURIComponent(itemId)}/warehouse-stock`, { token, tenantId });
}

export async function fetchStockTransfers(
  token: string,
  tenantId: string,
  params?: { status?: string; warehouseId?: string; limit?: number; offset?: number },
): Promise<StockTransferListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.warehouseId) qs.set('warehouseId', params.warehouseId);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<StockTransferListResponse>(`/inventory/stock-transfers${suffix}`, { token, tenantId });
  return {
    ...data,
    transfers: (data.transfers ?? []).map((row) => mapStockTransfer(row as unknown as Record<string, unknown>)),
  };
}

export async function fetchStockTransfer(
  token: string,
  tenantId: string,
  transferId: string,
): Promise<StockTransfer> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-transfers/${encodeURIComponent(transferId)}`, {
    token,
    tenantId,
  });
  return mapStockTransfer(row);
}

export async function createStockTransfer(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ transferId: string; transferNumber: string }> {
  return apiRequest('/inventory/stock-transfers', { method: 'POST', token, tenantId, body });
}

export async function shipStockTransfer(
  token: string,
  tenantId: string,
  transferId: string,
): Promise<StockTransfer> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-transfers/${encodeURIComponent(transferId)}/ship`,
    { method: 'POST', token, tenantId },
  );
  return mapStockTransfer(row);
}

export async function cancelStockTransfer(
  token: string,
  tenantId: string,
  transferId: string,
): Promise<StockTransfer> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-transfers/${encodeURIComponent(transferId)}/cancel`,
    { method: 'POST', token, tenantId },
  );
  return mapStockTransfer(row);
}

export async function receiveStockTransferLine(
  token: string,
  tenantId: string,
  lineId: string,
  body: Record<string, unknown>,
): Promise<StockTransfer> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-transfers/lines/${encodeURIComponent(lineId)}/receive`,
    { method: 'POST', token, tenantId, body },
  );
  return mapStockTransfer(row);
}

function mapStockCount(raw: Record<string, unknown>): StockCount {
  const metrics = raw.metrics as Record<string, unknown> | undefined;
  const lines = (raw.lines as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    countId: String(raw.countId ?? raw.id ?? ''),
    countNumber: String(raw.countNumber ?? ''),
    warehouseId: String(raw.warehouseId ?? ''),
    warehouseName: String(raw.warehouseName ?? ''),
    status: raw.status as StockCount['status'],
    notes: raw.notes != null ? String(raw.notes) : null,
    requestedBy: String(raw.requestedBy ?? ''),
    approvedBy: raw.approvedBy != null ? String(raw.approvedBy) : null,
    approvedAt: raw.approvedAt ? String(raw.approvedAt) : null,
    startedAt: raw.startedAt ? String(raw.startedAt) : null,
    completedAt: raw.completedAt ? String(raw.completedAt) : null,
    metrics: {
      lineCount: Number(metrics?.lineCount ?? 0),
      countedLineCount: Number(metrics?.countedLineCount ?? 0),
      varianceLineCount: Number(metrics?.varianceLineCount ?? 0),
    },
    lines: lines.map((line) => ({
      lineId: String(line.lineId ?? line.id ?? ''),
      itemId: String(line.itemId ?? ''),
      sku: String(line.sku ?? ''),
      itemName: String(line.itemName ?? ''),
      unit: String(line.unit ?? ''),
      systemQuantity: Number(line.systemQuantity ?? 0),
      countedQuantity: line.countedQuantity != null ? Number(line.countedQuantity) : null,
      variance: line.variance != null ? Number(line.variance) : null,
    })),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

export async function fetchStockCounts(
  token: string,
  tenantId: string,
  params?: { status?: string; warehouseId?: string; limit?: number; offset?: number },
): Promise<StockCountListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.warehouseId) qs.set('warehouseId', params.warehouseId);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<StockCountListResponse>(`/inventory/stock-counts${suffix}`, { token, tenantId });
  return {
    ...data,
    counts: (data.counts ?? []).map((row) => mapStockCount(row as unknown as Record<string, unknown>)),
  };
}

export async function fetchStockCount(token: string, tenantId: string, countId: string): Promise<StockCount> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-counts/${encodeURIComponent(countId)}`, {
    token,
    tenantId,
  });
  return mapStockCount(row);
}

export async function createStockCount(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ countId: string; countNumber: string }> {
  return apiRequest('/inventory/stock-counts', { method: 'POST', token, tenantId, body });
}

export async function startStockCount(token: string, tenantId: string, countId: string): Promise<StockCount> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-counts/${encodeURIComponent(countId)}/start`, {
    method: 'POST',
    token,
    tenantId,
  });
  return mapStockCount(row);
}

export async function submitStockCount(token: string, tenantId: string, countId: string): Promise<StockCount> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-counts/${encodeURIComponent(countId)}/submit`, {
    method: 'POST',
    token,
    tenantId,
  });
  return mapStockCount(row);
}

export async function approveStockCount(token: string, tenantId: string, countId: string): Promise<StockCount> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-counts/${encodeURIComponent(countId)}/approve`, {
    method: 'POST',
    token,
    tenantId,
  });
  return mapStockCount(row);
}

export async function cancelStockCount(token: string, tenantId: string, countId: string): Promise<StockCount> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-counts/${encodeURIComponent(countId)}/cancel`, {
    method: 'POST',
    token,
    tenantId,
  });
  return mapStockCount(row);
}

export async function updateStockCountLine(
  token: string,
  tenantId: string,
  lineId: string,
  body: Record<string, unknown>,
): Promise<StockCount> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-counts/lines/${encodeURIComponent(lineId)}/count`,
    { method: 'POST', token, tenantId, body },
  );
  return mapStockCount(row);
}

function mapStockRequest(raw: Record<string, unknown>): StockRequest {
  return {
    requestId: String(raw.requestId ?? ''),
    requestNumber: String(raw.requestNumber ?? ''),
    requestType: raw.requestType as StockRequest['requestType'],
    status: raw.status as StockRequest['status'],
    departmentName: raw.departmentName != null ? String(raw.departmentName) : null,
    patientId: raw.patientId != null ? String(raw.patientId) : null,
    warehouseId: raw.warehouseId != null ? String(raw.warehouseId) : null,
    warehouseName: raw.warehouseName != null ? String(raw.warehouseName) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    requestedBy: String(raw.requestedBy ?? ''),
    approvedBy: raw.approvedBy != null ? String(raw.approvedBy) : null,
    approvedAt: raw.approvedAt != null ? String(raw.approvedAt) : null,
    rejectedBy: raw.rejectedBy != null ? String(raw.rejectedBy) : null,
    rejectedAt: raw.rejectedAt != null ? String(raw.rejectedAt) : null,
    rejectionReason: raw.rejectionReason != null ? String(raw.rejectionReason) : null,
    fulfilledBy: raw.fulfilledBy != null ? String(raw.fulfilledBy) : null,
    fulfilledAt: raw.fulfilledAt != null ? String(raw.fulfilledAt) : null,
    metrics: {
      lineCount: Number((raw.metrics as Record<string, unknown>)?.lineCount ?? 0),
      fulfilledLineCount: Number((raw.metrics as Record<string, unknown>)?.fulfilledLineCount ?? 0),
      totalRequested: Number((raw.metrics as Record<string, unknown>)?.totalRequested ?? 0),
      totalFulfilled: Number((raw.metrics as Record<string, unknown>)?.totalFulfilled ?? 0),
    },
    lines: ((raw.lines as Record<string, unknown>[]) ?? []).map((line) => ({
      lineId: String(line.lineId ?? ''),
      itemId: String(line.itemId ?? ''),
      sku: String(line.sku ?? ''),
      itemName: String(line.itemName ?? ''),
      unit: String(line.unit ?? ''),
      quantityRequested: Number(line.quantityRequested ?? 0),
      quantityFulfilled: Number(line.quantityFulfilled ?? 0),
      quantityRemaining: Number(line.quantityRemaining ?? 0),
      notes: line.notes != null ? String(line.notes) : null,
    })),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

export async function fetchStockRequests(
  token: string,
  tenantId: string,
  params: { status?: string; requestType?: string; requestedBy?: string; limit?: number; offset?: number },
): Promise<StockRequestListResponse> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.requestType) qs.set('requestType', params.requestType);
  if (params.requestedBy) qs.set('requestedBy', params.requestedBy);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await apiRequest<StockRequestListResponse>(`/inventory/stock-requests${suffix}`, { token, tenantId });
  return {
    ...data,
    requests: (data.requests ?? []).map((row) => mapStockRequest(row as unknown as Record<string, unknown>)),
  };
}

export async function fetchStockRequest(token: string, tenantId: string, requestId: string): Promise<StockRequest> {
  const row = await apiRequest<Record<string, unknown>>(`/inventory/stock-requests/${encodeURIComponent(requestId)}`, {
    token,
    tenantId,
  });
  return mapStockRequest(row);
}

export async function createStockRequest(
  token: string,
  tenantId: string,
  body: Record<string, unknown>,
): Promise<{ requestId: string; requestNumber: string }> {
  return apiRequest('/inventory/stock-requests', { method: 'POST', token, tenantId, body });
}

export async function submitStockRequest(token: string, tenantId: string, requestId: string): Promise<StockRequest> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-requests/${encodeURIComponent(requestId)}/submit`,
    { method: 'POST', token, tenantId },
  );
  return mapStockRequest(row);
}

export async function approveStockRequest(token: string, tenantId: string, requestId: string): Promise<StockRequest> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-requests/${encodeURIComponent(requestId)}/approve`,
    { method: 'POST', token, tenantId },
  );
  return mapStockRequest(row);
}

export async function rejectStockRequest(
  token: string,
  tenantId: string,
  requestId: string,
  body: { reason?: string },
): Promise<StockRequest> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-requests/${encodeURIComponent(requestId)}/reject`,
    { method: 'POST', token, tenantId, body },
  );
  return mapStockRequest(row);
}

export async function cancelStockRequest(token: string, tenantId: string, requestId: string): Promise<StockRequest> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-requests/${encodeURIComponent(requestId)}/cancel`,
    { method: 'POST', token, tenantId },
  );
  return mapStockRequest(row);
}

export async function fulfillStockRequestLine(
  token: string,
  tenantId: string,
  lineId: string,
  body: { quantity: number; notes?: string },
): Promise<StockRequest> {
  const row = await apiRequest<Record<string, unknown>>(
    `/inventory/stock-requests/lines/${encodeURIComponent(lineId)}/fulfill`,
    { method: 'POST', token, tenantId, body },
  );
  return mapStockRequest(row);
}

export async function fetchInventoryAnalytics(
  token: string,
  tenantId: string,
  days = 30,
): Promise<InventoryAnalytics> {
  const data = await apiRequest<InventoryAnalytics>(
    `/inventory/analytics?days=${encodeURIComponent(String(days))}`,
    { token, tenantId },
  );
  return {
    ...data,
    valuation: {
      ...data.valuation,
      totalStockValue: Number(data.valuation?.totalStockValue ?? 0),
      itemCount: Number(data.valuation?.itemCount ?? 0),
      byCategory: (data.valuation?.byCategory ?? []).map((row) => ({
        ...row,
        stockValue: Number(row.stockValue ?? 0),
        itemCount: Number(row.itemCount ?? 0),
      })),
    },
    stockHealth: {
      lowStock: Number(data.stockHealth?.lowStock ?? 0),
      outOfStock: Number(data.stockHealth?.outOfStock ?? 0),
      expiringSoon: Number(data.stockHealth?.expiringSoon ?? 0),
      expired: Number(data.stockHealth?.expired ?? 0),
    },
    consumption: {
      totalQuantity: Number(data.consumption?.totalQuantity ?? 0),
      eventCount: Number(data.consumption?.eventCount ?? 0),
      byDay: (data.consumption?.byDay ?? []).map((row) => ({
        date: String(row.date),
        quantity: Number(row.quantity ?? 0),
        events: Number(row.events ?? 0),
      })),
      topItems: (data.consumption?.topItems ?? []).map((row) => ({
        ...row,
        quantity: Number(row.quantity ?? 0),
      })),
      byCategory: (data.consumption?.byCategory ?? []).map((row) => ({
        ...row,
        quantity: Number(row.quantity ?? 0),
      })),
      byProcedure: (data.consumption?.byProcedure ?? []).map((row) => ({
        ...row,
        quantity: Number(row.quantity ?? 0),
      })),
    },
    procurement: {
      activeSupplierCount: Number(data.procurement?.activeSupplierCount ?? 0),
      orderedValue: Number(data.procurement?.orderedValue ?? 0),
      receivedValue: Number(data.procurement?.receivedValue ?? 0),
      byStatus: data.procurement?.byStatus ?? [],
      topSuppliers: data.procurement?.topSuppliers ?? [],
    },
    movements: {
      byType: (data.movements?.byType ?? []).map((row) => ({
        movementType: String(row.movementType),
        count: Number(row.count ?? 0),
        quantity: Number(row.quantity ?? 0),
      })),
    },
  };
}

export async function exportInventoryAnalyticsCsv(
  token: string,
  tenantId: string,
  days = 30,
): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE}/inventory/analytics/export?days=${encodeURIComponent(String(days))}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': tenantId,
      Accept: 'text/csv',
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = response.statusText;
    try {
      const data = JSON.parse(text) as { message?: unknown };
      if (data.message) message = String(data.message);
    } catch {
      if (text) message = text;
    }
    throw new ApiError(message, response.status);
  }
  const disposition = response.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? `inventory-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  return { blob: await response.blob(), filename };
}

export async function previewAutoReorder(token: string, tenantId: string) {
  return apiRequest<{
    candidateCount: number;
    purchaseOrderCount: number;
    groups: Array<{
      supplierId: string | null;
      lines: Array<{
        itemId: string;
        sku: string;
        nameEn: string;
        orderQuantity: number;
      }>;
    }>;
  }>('/inventory/reorder/preview', { token, tenantId });
}

export async function runAutoReorder(
  token: string,
  tenantId: string,
  body: { dryRun?: boolean; autoSubmit?: boolean },
) {
  return apiRequest<{
    created: Array<{ orderId: string; poNumber: string; supplierId: string | null; lineCount: number }>;
    skipped: Array<{ itemId: string; reason: string }>;
    candidateCount: number;
    dryRun?: boolean;
  }>('/inventory/reorder/run', { method: 'POST', token, tenantId, body });
}

export async function convertStockRequestToPo(
  token: string,
  tenantId: string,
  requestId: string,
  body: { supplierId?: string | null; autoSubmit?: boolean },
) {
  return apiRequest<{
    orderId: string;
    poNumber: string;
    requestId: string;
    order: PurchaseOrder;
  }>(`/inventory/stock-requests/${encodeURIComponent(requestId)}/convert-to-po`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export function mapInventoryApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'permissionDenied';
    if (err.status === 404) return 'notFound';
    if (err.status === 400) return 'invalidRequest';
    if (err.status === 401) return 'notAuthenticated';
  }
  if (err instanceof Error && err.message === 'Not authenticated') return 'notAuthenticated';
  return 'generic';
}
