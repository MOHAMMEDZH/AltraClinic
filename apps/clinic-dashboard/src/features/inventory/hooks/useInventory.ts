import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { INVENTORY_DEFAULT_PAGE_SIZE } from '../config/inventory-config';
import type { InventoryStatusFilter, InventoryStockFilter } from '../types/inventory.types';
import {
  adjustInventoryItem,
  archiveInventoryItem,
  bulkArchiveInventoryItems,
  consumeInventoryItem,
  createInventoryItem,
  exportInventoryItemsCsv,
  fetchInventoryItem,
  fetchInventoryItems,
  lookupInventoryItem,
  fetchInventoryMovements,
  fetchInventorySummary,
  fetchInventoryAnalytics,
  fetchInventoryUsageOwnerReport,
  fetchInventoryCategories,
  createInventoryCategory,
  receiveInventoryItem,
  reactivateInventoryItem,
  updateInventoryItem,
  fetchInventoryExpirySummary,
  fetchInventoryBatches,
  fetchInventoryItemBatches,
  disposeInventoryBatch,
  fetchInventorySuppliers,
  createInventorySupplier,
  updateInventorySupplier,
  deactivateInventorySupplier,
  reactivateInventorySupplier,
  fetchPurchaseOrders,
  createPurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  receivePurchaseOrderLine,
  fetchInventoryWarehouses,
  createInventoryWarehouse,
  updateInventoryWarehouse,
  deactivateInventoryWarehouse,
  reactivateInventoryWarehouse,
  setDefaultInventoryWarehouse,
  fetchStockTransfers,
  createStockTransfer,
  shipStockTransfer,
  cancelStockTransfer,
  receiveStockTransferLine,
  fetchStockCounts,
  createStockCount,
  startStockCount,
  submitStockCount,
  approveStockCount,
  cancelStockCount,
  updateStockCountLine,
  fetchStockRequests,
  createStockRequest,
  submitStockRequest,
  approveStockRequest,
  rejectStockRequest,
  cancelStockRequest,
  fulfillStockRequestLine,
  fetchWarehouseStock,
  fetchItemWarehouseStock,
  fetchInventorySupplier,
  exportInventoryAnalyticsCsv,
  previewAutoReorder,
  runAutoReorder,
  convertStockRequestToPo,
} from '../api/inventory-api';
import type { BatchExpiryFilter } from '../types/inventory.types';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useInventorySummary(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'summary', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventorySummary(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useInventoryAnalytics(days = 30, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'analytics', days, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventoryAnalytics(token, user.tenantId, days);
    },
    staleTime: 60_000,
  });
}

/** Owner accountability ledger (api.inventory export). PHI never requested from this hook. */
export function useInventoryUsageOwnerReport(days = 30, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'usage-owner-report', days, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const to = new Date();
      const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      return fetchInventoryUsageOwnerReport(token, user.tenantId, {
        from: from.toISOString(),
        to: to.toISOString(),
        limit: 50,
      });
    },
    staleTime: 60_000,
  });
}

export function useInventoryItems(params: {
  q?: string;
  status?: InventoryStatusFilter;
  stock?: InventoryStockFilter;
  categoryId?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? INVENTORY_DEFAULT_PAGE_SIZE;
  return useQuery({
    queryKey: ['inventory', 'items', params.q, params.status, params.stock, params.categoryId, page, pageSize, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventoryItems(token, user.tenantId, {
        q: params.q,
        status: params.status ?? 'active',
        stock: params.stock ?? 'all',
        categoryId: params.categoryId,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useLookupInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (code: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return lookupInventoryItem(token, user.tenantId, code);
    },
  });
}

export function useCreateInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createInventoryItem(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, body }: { itemId: string; body: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateInventoryItem(token, user.tenantId, itemId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useConsumeInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { itemId: string; quantity: number; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return consumeInventoryItem(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReceiveInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      quantity,
      notes,
      lotNumber,
      manufacturedDate,
      expiryDate,
    }: {
      itemId: string;
      quantity: number;
      notes?: string;
      lotNumber?: string;
      manufacturedDate?: string;
      expiryDate?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return receiveInventoryItem(token, user.tenantId, itemId, {
        quantity,
        notes,
        lotNumber,
        manufacturedDate,
        expiryDate,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useArchiveInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return archiveInventoryItem(token, user.tenantId, itemId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBulkArchiveInventoryItems() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return bulkArchiveInventoryItems(token, user.tenantId, itemIds);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useExportInventoryItemsCsv() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (params: {
      itemIds?: string[];
      q?: string;
      status?: string;
      stock?: string;
      categoryId?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return exportInventoryItemsCsv(token, user.tenantId, params);
    },
  });
}

export function useReactivateInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return reactivateInventoryItem(token, user.tenantId, itemId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useInventoryItem(itemId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'item', itemId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && itemId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !itemId) throw new Error('Not authenticated');
      return fetchInventoryItem(token, user.tenantId, itemId);
    },
    staleTime: 15_000,
  });
}

const MOVEMENT_PAGE_SIZE = 20;

export function useInventoryMovements(params: {
  itemId?: string;
  movementType?: string;
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'movements', params.itemId, params.movementType, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventoryMovements(token, user.tenantId, {
        itemId: params.itemId,
        movementType: params.movementType,
        limit: MOVEMENT_PAGE_SIZE,
        offset: (page - 1) * MOVEMENT_PAGE_SIZE,
      });
    },
    staleTime: 15_000,
  });
}

export function useAdjustInventoryItem() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      quantityAfter,
      reason,
      notes,
    }: {
      itemId: string;
      quantityAfter: number;
      reason: string;
      notes?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return adjustInventoryItem(token, user.tenantId, itemId, { quantityAfter, reason, notes });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useInventoryCategories(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'categories', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventoryCategories(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

export function useCreateInventoryCategory() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { nameEn: string; nameAr?: string | null; key?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createInventoryCategory(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory', 'categories'] });
    },
  });
}

const BATCH_PAGE_SIZE = 20;

export function useInventoryExpirySummary(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'expiry-summary', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventoryExpirySummary(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useInventoryBatches(params: {
  itemId?: string;
  expiry?: BatchExpiryFilter;
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'batches', params.itemId, params.expiry, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventoryBatches(token, user.tenantId, {
        itemId: params.itemId,
        expiry: params.expiry ?? 'all',
        limit: BATCH_PAGE_SIZE,
        offset: (page - 1) * BATCH_PAGE_SIZE,
      });
    },
    staleTime: 15_000,
  });
}

export function useInventoryItemBatches(itemId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'item-batches', itemId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && itemId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !itemId) throw new Error('Not authenticated');
      return fetchInventoryItemBatches(token, user.tenantId, itemId);
    },
    staleTime: 15_000,
  });
}

export function useDisposeInventoryBatch() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      batchId,
      quantity,
      reason,
      notes,
    }: {
      batchId: string;
      quantity: number;
      reason: string;
      notes?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return disposeInventoryBatch(token, user.tenantId, batchId, { quantity, reason, notes });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

const SUPPLIER_PAGE_SIZE = 20;

export function useInventorySuppliers(params: {
  q?: string;
  status?: 'active' | 'all';
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'suppliers', params.q, params.status, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchInventorySuppliers(token, user.tenantId, {
        q: params.q,
        status: params.status ?? 'active',
        limit: SUPPLIER_PAGE_SIZE,
        offset: (page - 1) * SUPPLIER_PAGE_SIZE,
      });
    },
    staleTime: 30_000,
  });
}

export function useInventorySuppliersList(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'suppliers', 'all-active', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const data = await fetchInventorySuppliers(token, user.tenantId, { status: 'active', limit: 200, offset: 0 });
      return data.suppliers;
    },
    staleTime: 60_000,
  });
}

export function useCreateInventorySupplier() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createInventorySupplier(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useUpdateInventorySupplier() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ supplierId, body }: { supplierId: string; body: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateInventorySupplier(token, user.tenantId, supplierId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useDeactivateInventorySupplier() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplierId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deactivateInventorySupplier(token, user.tenantId, supplierId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReactivateInventorySupplier() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplierId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return reactivateInventorySupplier(token, user.tenantId, supplierId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

const PO_PAGE_SIZE = 20;

export function usePurchaseOrders(params: {
  status?: string;
  supplierId?: string;
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'purchase-orders', params.status, params.supplierId, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchPurchaseOrders(token, user.tenantId, {
        status: params.status,
        supplierId: params.supplierId,
        limit: PO_PAGE_SIZE,
        offset: (page - 1) * PO_PAGE_SIZE,
      });
    },
    staleTime: 15_000,
  });
}

export function useCreatePurchaseOrder() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createPurchaseOrder(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useSubmitPurchaseOrder() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return submitPurchaseOrder(token, user.tenantId, orderId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useApprovePurchaseOrder() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approvePurchaseOrder(token, user.tenantId, orderId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useCancelPurchaseOrder() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelPurchaseOrder(token, user.tenantId, orderId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useReceivePurchaseOrderLine() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lineId,
      quantity,
      lotNumber,
      manufacturedDate,
      expiryDate,
      notes,
    }: {
      lineId: string;
      quantity: number;
      lotNumber?: string;
      manufacturedDate?: string;
      expiryDate?: string;
      notes?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return receivePurchaseOrderLine(token, user.tenantId, lineId, {
        quantity,
        lotNumber,
        manufacturedDate,
        expiryDate,
        notes,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

const TRANSFER_PAGE_SIZE = 20;

export function useInventoryWarehouses(params: {
  q?: string;
  status?: 'active' | 'all';
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'warehouses', params.q, params.status, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const data = await fetchInventoryWarehouses(token, user.tenantId, {
        q: params.q,
        status: params.status ?? 'active',
        limit: 100,
        offset: 0,
      });
      return data.warehouses;
    },
    staleTime: 15_000,
  });
}

export function useCreateInventoryWarehouse() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createInventoryWarehouse(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useUpdateInventoryWarehouse() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ warehouseId, body }: { warehouseId: string; body: Record<string, unknown> }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateInventoryWarehouse(token, user.tenantId, warehouseId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useDeactivateInventoryWarehouse() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (warehouseId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deactivateInventoryWarehouse(token, user.tenantId, warehouseId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useReactivateInventoryWarehouse() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (warehouseId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return reactivateInventoryWarehouse(token, user.tenantId, warehouseId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useSetDefaultInventoryWarehouse() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (warehouseId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return setDefaultInventoryWarehouse(token, user.tenantId, warehouseId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useStockTransfers(params: {
  status?: string;
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'stock-transfers', params.status, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchStockTransfers(token, user.tenantId, {
        status: params.status,
        limit: TRANSFER_PAGE_SIZE,
        offset: (page - 1) * TRANSFER_PAGE_SIZE,
      });
    },
    staleTime: 15_000,
  });
}

export function useCreateStockTransfer() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createStockTransfer(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useShipStockTransfer() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return shipStockTransfer(token, user.tenantId, transferId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useCancelStockTransfer() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelStockTransfer(token, user.tenantId, transferId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useReceiveStockTransferLine() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lineId, quantity }: { lineId: string; quantity: number }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return receiveStockTransferLine(token, user.tenantId, lineId, { quantity });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

const COUNT_PAGE_SIZE = 20;

export function useStockCounts(params: { status?: string; page?: number; enabled?: boolean }) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'stock-counts', params.status, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchStockCounts(token, user.tenantId, {
        status: params.status,
        limit: COUNT_PAGE_SIZE,
        offset: (page - 1) * COUNT_PAGE_SIZE,
      });
    },
    staleTime: 15_000,
  });
}

export function useCreateStockCount() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createStockCount(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useStartStockCount() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (countId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return startStockCount(token, user.tenantId, countId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useSubmitStockCount() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (countId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return submitStockCount(token, user.tenantId, countId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useApproveStockCount() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (countId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approveStockCount(token, user.tenantId, countId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useCancelStockCount() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (countId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelStockCount(token, user.tenantId, countId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useUpdateStockCountLine() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lineId, countedQuantity }: { lineId: string; countedQuantity: number }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateStockCountLine(token, user.tenantId, lineId, { countedQuantity });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useStockRequests(params: {
  status?: string;
  requestType?: string;
  requestedBy?: string;
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'stock-requests', params.status, params.requestType, params.requestedBy, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchStockRequests(token, user.tenantId, {
        status: params.status,
        requestType: params.requestType,
        requestedBy: params.requestedBy,
        limit: INVENTORY_DEFAULT_PAGE_SIZE,
        offset: (page - 1) * INVENTORY_DEFAULT_PAGE_SIZE,
      });
    },
    staleTime: 10_000,
  });
}

export function useCreateStockRequest() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createStockRequest(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useSubmitStockRequest() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return submitStockRequest(token, user.tenantId, requestId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useApproveStockRequest() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approveStockRequest(token, user.tenantId, requestId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useRejectStockRequest() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return rejectStockRequest(token, user.tenantId, requestId, { reason });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useCancelStockRequest() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return cancelStockRequest(token, user.tenantId, requestId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useFulfillStockRequestLine() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      lineId,
      quantity,
      usedByUserId,
      notes,
    }: {
      lineId: string;
      quantity: number;
      usedByUserId: string;
      notes?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fulfillStockRequestLine(token, user.tenantId, lineId, { quantity, usedByUserId, notes });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useWarehouseStock(params: {
  warehouseId?: string;
  q?: string;
  page?: number;
  enabled?: boolean;
}) {
  const { getValidAccessToken, user } = useAuth();
  const page = params.page ?? 1;
  return useQuery({
    queryKey: ['inventory', 'warehouse-stock', params.warehouseId, params.q, page, ...authKeys(user)],
    enabled: (params.enabled ?? true) && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchWarehouseStock(token, user.tenantId, {
        warehouseId: params.warehouseId,
        q: params.q,
        limit: INVENTORY_DEFAULT_PAGE_SIZE,
        offset: (page - 1) * INVENTORY_DEFAULT_PAGE_SIZE,
      });
    },
    staleTime: 15_000,
  });
}

export function useItemWarehouseStock(itemId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'item-warehouse-stock', itemId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && itemId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !itemId) throw new Error('Not authenticated');
      return fetchItemWarehouseStock(token, user.tenantId, itemId);
    },
    staleTime: 15_000,
  });
}

export function useInventorySupplier(supplierId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'supplier', supplierId, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId && supplierId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !supplierId) throw new Error('Not authenticated');
      return fetchInventorySupplier(token, user.tenantId, supplierId);
    },
    staleTime: 30_000,
  });
}

export function useExportInventoryAnalytics() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (days: number) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return exportInventoryAnalyticsCsv(token, user.tenantId, days);
    },
  });
}

export function usePreviewAutoReorder(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['inventory', 'reorder-preview', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return previewAutoReorder(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useRunAutoReorder() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { dryRun?: boolean; autoSubmit?: boolean }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return runAutoReorder(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useConvertStockRequestToPo() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      supplierId,
      autoSubmit,
    }: {
      requestId: string;
      supplierId?: string | null;
      autoSubmit?: boolean;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return convertStockRequestToPo(token, user.tenantId, requestId, { supplierId, autoSubmit });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
