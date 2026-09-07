import { Injectable } from '@nestjs/common';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import type {
  ConsumptionLogRecord,
  ConsumptionListFilter,
  ConsumptionListResult,
  InventoryListFilter,
  InventoryListResult,
} from '../domain/repositories/inventory-list.filter';
import type {
  StockMovementListFilter,
  StockMovementListResult,
  StockMovementRecord,
  StockMovementType,
} from '../domain/repositories/stock-movement.types';
import type {
  BatchListFilter,
  BatchListResult,
  ExpirySummaryResult,
  InventoryBatchRecord,
} from '../domain/repositories/inventory-batch.types';
import { BATCH_EXPIRY_ALERT_DAYS as ALERT_DAYS } from '../domain/repositories/inventory-batch.types';
import { randomUUID } from 'crypto';

@Injectable()
export class InMemoryInventoryItemRepository {
  private readonly store = new Map<string, Map<string, InventoryItem>>();
  private readonly archived = new Set<string>();

  private bucket(tenantId: string): Map<string, InventoryItem> {
    const key = tenantId.trim().toLowerCase();
    if (!this.store.has(key)) this.store.set(key, new Map());
    return this.store.get(key)!;
  }

  async save(item: InventoryItem): Promise<void> {
    const bucket = this.bucket(item.tenantId);
    bucket.set(item.itemId, item);
  }

  async findById(tenantId: string, itemId: string, includeArchived = false): Promise<InventoryItem | null> {
    const bucket = this.bucket(tenantId);
    const item = bucket.get(itemId);
    if (!item) return null;
    if (!includeArchived && this.archived.has(`${tenantId}:${itemId}`)) return null;
    return item;
  }

  async findBySku(tenantId: string, sku: string): Promise<InventoryItem | null> {
    const bucket = this.bucket(tenantId);
    for (const item of bucket.values()) {
      if (item.sku === sku && !this.archived.has(`${tenantId}:${item.itemId}`)) return item;
    }
    return null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<InventoryItem | null> {
    const normalized = barcode.trim();
    if (!normalized) return null;
    const bucket = this.bucket(tenantId);
    for (const item of bucket.values()) {
      if (item.barcode === normalized && !this.archived.has(`${tenantId}:${item.itemId}`)) return item;
    }
    return null;
  }

  async findByIds(tenantId: string, itemIds: string[], includeArchived = false): Promise<InventoryItem[]> {
    const bucket = this.bucket(tenantId);
    const uniqueIds = [...new Set(itemIds)];
    const items: InventoryItem[] = [];
    for (const itemId of uniqueIds) {
      const item = bucket.get(itemId);
      if (!item) continue;
      if (!includeArchived && this.archived.has(`${tenantId}:${itemId}`)) continue;
      items.push(item);
    }
    return items.sort((a, b) => (a.name.en ?? '').localeCompare(b.name.en ?? ''));
  }

  async findByBranch(tenantId: string, branchId?: string | null): Promise<InventoryItem[]> {
    const bucket = this.bucket(tenantId);
    const result: InventoryItem[] = [];
    for (const item of bucket.values()) {
      if (this.archived.has(`${tenantId}:${item.itemId}`)) continue;
      if (branchId == null || item.branchId === branchId) result.push(item);
    }
    return result;
  }

  async listPage(filter: InventoryListFilter): Promise<InventoryListResult> {
    let items = await this.findByBranch(filter.tenantId, filter.branchId);
    if (filter.q) {
      const q = filter.q.toLowerCase();
      items = items.filter(
        (i) =>
          i.sku.toLowerCase().includes(q) ||
          (i.barcode ?? '').toLowerCase().includes(q) ||
          (i.brand ?? '').toLowerCase().includes(q) ||
          (i.name.en ?? '').toLowerCase().includes(q) ||
          (i.name.ar ?? '').toLowerCase().includes(q),
      );
    }
    if (filter.categoryId) items = items.filter((i) => i.categoryId === filter.categoryId);
    if (filter.stock === 'low') items = items.filter((i) => i.quantityOnHand > 0 && i.needsReorder());
    if (filter.stock === 'out') items = items.filter((i) => i.quantityOnHand <= 0);
    const total = items.length;
    return { items: items.slice(filter.offset, filter.offset + filter.limit), total };
  }

  async archive(tenantId: string, itemId: string): Promise<void> {
    this.archived.add(`${tenantId}:${itemId}`);
  }

  async reactivate(tenantId: string, itemId: string): Promise<void> {
    this.archived.delete(`${tenantId}:${itemId}`);
  }

  async recordConsumption(): Promise<void> {
    throw new Error(
      'InventoryUsageLedger writes must go through InventoryUsagePostingService (AR-20)',
    );
  }

  async listRecentConsumptions(): Promise<ConsumptionLogRecord[]> {
    return [];
  }

  async listConsumptions(_filter: ConsumptionListFilter): Promise<ConsumptionListResult> {
    return { consumptions: [], total: 0 };
  }

  async findConsumptionsByIds(_tenantId: string, _consumptionIds: string[]): Promise<ConsumptionLogRecord[]> {
    return [];
  }

  private readonly movements: StockMovementRecord[] = [];
  private readonly batches: InventoryBatchRecord[] = [];
  private readonly disposals: Array<{
    id: string;
    tenantId: string;
    inventoryItemId: string;
    batchId: string | null;
    quantity: number;
    reason: string;
    disposedAt: Date;
    sku: string;
    itemNameEn: string;
    unit: string;
  }> = [];

  async recordStockMovement(input: {
    tenantId: string;
    inventoryItemId: string;
    movementType: StockMovementType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    reason?: string | null;
    notes?: string | null;
    encounterId?: string | null;
    performedBy: string;
  }): Promise<string> {
    const item = await this.findById(input.tenantId, input.inventoryItemId, true);
    const id = randomUUID();
    this.movements.push({
      id,
      inventoryItemId: input.inventoryItemId,
      sku: item?.sku ?? '',
      itemNameEn: item?.name.en ?? '',
      movementType: input.movementType,
      quantity: input.quantity,
      quantityBefore: input.quantityBefore,
      quantityAfter: input.quantityAfter,
      unit: item?.unit ?? '',
      reason: input.reason ?? null,
      notes: input.notes ?? null,
      encounterId: input.encounterId ?? null,
      performedBy: input.performedBy,
      createdAt: new Date(),
    });
    return id;
  }

  async listStockMovements(filter: StockMovementListFilter): Promise<StockMovementListResult> {
    let rows = this.movements.filter((m) => m.inventoryItemId && filter.tenantId);
    if (filter.itemId) rows = rows.filter((m) => m.inventoryItemId === filter.itemId);
    if (filter.encounterId) rows = rows.filter((m) => m.encounterId === filter.encounterId);
    if (filter.movementType) rows = rows.filter((m) => m.movementType === filter.movementType);
    rows = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const total = rows.length;
    return { movements: rows.slice(filter.offset, filter.offset + filter.limit), total };
  }

  async listRecentStockMovements(tenantId: string, limit: number): Promise<StockMovementRecord[]> {
    return this.movements
      .filter(() => Boolean(tenantId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async createBatch(input: {
    tenantId: string;
    inventoryItemId: string;
    lotNumber?: string | null;
    manufacturedDate?: Date | null;
    expiryDate?: Date | null;
    quantity: number;
  }): Promise<string> {
    const item = await this.findById(input.tenantId, input.inventoryItemId, true);
    const batchId = randomUUID();
    this.batches.push({
      batchId,
      tenantId: input.tenantId,
      inventoryItemId: input.inventoryItemId,
      sku: item?.sku ?? '',
      itemNameEn: item?.name.en ?? '',
      unit: item?.unit ?? '',
      lotNumber: input.lotNumber?.trim() || null,
      manufacturedDate: input.manufacturedDate ?? null,
      expiryDate: input.expiryDate ?? null,
      quantityOnHand: input.quantity,
      status: 'ACTIVE',
      receivedAt: new Date(),
    });
    return batchId;
  }

  async listBatches(filter: BatchListFilter): Promise<BatchListResult> {
    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + ALERT_DAYS);

    let rows = this.batches.filter((b) => b.tenantId === filter.tenantId);
    if (filter.itemId) rows = rows.filter((b) => b.inventoryItemId === filter.itemId);
    if (filter.status === 'ACTIVE_ONLY') rows = rows.filter((b) => b.status === 'ACTIVE' && b.quantityOnHand > 0);
    else if (filter.status) rows = rows.filter((b) => b.status === filter.status);

    if (filter.expiry === 'expiring') {
      rows = rows.filter(
        (b) =>
          b.status === 'ACTIVE' &&
          b.quantityOnHand > 0 &&
          b.expiryDate &&
          b.expiryDate >= now &&
          b.expiryDate <= expiringBefore,
      );
    } else if (filter.expiry === 'expired') {
      rows = rows.filter(
        (b) => b.status === 'ACTIVE' && b.quantityOnHand > 0 && b.expiryDate && b.expiryDate < now,
      );
    } else if (filter.expiry === 'none') {
      rows = rows.filter((b) => !b.expiryDate);
    }

    rows = [...rows].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return a.receivedAt.getTime() - b.receivedAt.getTime();
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.getTime() - b.expiryDate.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime();
    });

    const total = rows.length;
    return { batches: rows.slice(filter.offset, filter.offset + filter.limit), total };
  }

  async listBatchesForItem(tenantId: string, itemId: string): Promise<InventoryBatchRecord[]> {
    return this.batches
      .filter((b) => b.tenantId === tenantId && b.inventoryItemId === itemId && ['ACTIVE', 'DEPLETED'].includes(b.status))
      .sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return a.receivedAt.getTime() - b.receivedAt.getTime();
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.getTime() - b.expiryDate.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime();
      });
  }

  async consumeFifoBatches(tenantId: string, itemId: string, quantity: number): Promise<number> {
    const active = this.batches
      .filter((b) => b.tenantId === tenantId && b.inventoryItemId === itemId && b.status === 'ACTIVE' && b.quantityOnHand > 0)
      .sort((a, b) => {
        if (!a.expiryDate && !b.expiryDate) return a.receivedAt.getTime() - b.receivedAt.getTime();
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.getTime() - b.expiryDate.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime();
      });

    let remaining = quantity;
    let consumed = 0;
    for (const batch of active) {
      if (remaining <= 0) break;
      const take = Math.min(batch.quantityOnHand, remaining);
      batch.quantityOnHand -= take;
      if (batch.quantityOnHand <= 0) batch.status = 'DEPLETED';
      remaining -= take;
      consumed += take;
    }
    return consumed;
  }

  async disposeBatch(_input: {
    tenantId: string;
    batchId: string;
    quantity: number;
    reason: string;
    notes?: string | null;
    disposedBy: string;
  }): Promise<{ itemId: string; quantity: number }> {
    throw new Error(
      'disposeBatch repository primitive is closed. Use DisposeInventoryBatchHandler / InventoryUsagePostingService.disposeBatch',
    );
  }

  async getExpirySummary(tenantId: string): Promise<ExpirySummaryResult> {
    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + ALERT_DAYS);

    const active = this.batches.filter((b) => b.tenantId === tenantId && b.status === 'ACTIVE' && b.quantityOnHand > 0);
    const expiringSoonCount = active.filter(
      (b) => b.expiryDate && b.expiryDate >= now && b.expiryDate <= expiringBefore,
    ).length;
    const expiredCount = active.filter((b) => b.expiryDate && b.expiryDate < now).length;

    const recentDisposals = this.disposals
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => b.disposedAt.getTime() - a.disposedAt.getTime())
      .slice(0, 10)
      .map((d) => ({
        id: d.id,
        itemId: d.inventoryItemId,
        batchId: d.batchId,
        sku: d.sku,
        itemName: d.itemNameEn,
        quantity: d.quantity,
        unit: d.unit,
        reason: d.reason,
        disposedAt: d.disposedAt.toISOString(),
      }));

    return { expiringSoonCount, expiredCount, alertDays: ALERT_DAYS, recentDisposals };
  }
}
