import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { InventoryItem } from '../domain/entities/inventory-item.entity';
import { InventoryItemRepository } from '../domain/repositories/inventory-item.repository.interface';
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
  BatchStatus,
  ExpirySummaryResult,
  InventoryBatchRecord,
} from '../domain/repositories/inventory-batch.types';
import { BATCH_EXPIRY_ALERT_DAYS } from '../domain/repositories/inventory-batch.types';
import { LocalizedText } from '../domain/value-objects/localized-text.vo';

const EXPIRY_ALERT_DAYS = 7;

@Injectable()
export class PrismaInventoryRepository implements InventoryItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(item: InventoryItem): Promise<void> {
    await this.prisma.inventoryItem.upsert({
      where: { id: item.itemId },
      create: {
        id: item.itemId,
        tenantId: item.tenantId,
        branchId: item.branchId,
        categoryId: item.categoryId,
        sku: item.sku,
        barcode: item.barcode,
        brand: item.brand,
        nameEn: item.name.en ?? '',
        nameAr: item.name.ar,
        unit: item.unit,
        quantityOnHand: new Prisma.Decimal(item.quantityOnHand),
        reorderThreshold: new Prisma.Decimal(item.reorderThreshold),
        minQuantity: item.minQuantity != null ? new Prisma.Decimal(item.minQuantity) : null,
        maxQuantity: item.maxQuantity != null ? new Prisma.Decimal(item.maxQuantity) : null,
        costPerUnit: item.costPerUnit != null ? new Prisma.Decimal(item.costPerUnit) : null,
        sellingPrice: item.sellingPrice != null ? new Prisma.Decimal(item.sellingPrice) : null,
        storageLocation: item.storageLocation,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        supplierId: item.supplierId ?? null,
        deletedAt: item.archivedAt,
        createdAt: item.createdAt,
      },
      update: {
        categoryId: item.categoryId,
        barcode: item.barcode,
        brand: item.brand,
        nameEn: item.name.en ?? '',
        nameAr: item.name.ar,
        unit: item.unit,
        quantityOnHand: new Prisma.Decimal(item.quantityOnHand),
        reorderThreshold: new Prisma.Decimal(item.reorderThreshold),
        minQuantity: item.minQuantity != null ? new Prisma.Decimal(item.minQuantity) : null,
        maxQuantity: item.maxQuantity != null ? new Prisma.Decimal(item.maxQuantity) : null,
        costPerUnit: item.costPerUnit != null ? new Prisma.Decimal(item.costPerUnit) : null,
        sellingPrice: item.sellingPrice != null ? new Prisma.Decimal(item.sellingPrice) : null,
        storageLocation: item.storageLocation,
        lotNumber: item.lotNumber,
        expiryDate: item.expiryDate,
        supplierId: item.supplierId ?? null,
        deletedAt: item.archivedAt,
        updatedAt: item.updatedAt,
      },
    });
  }

  async findById(tenantId: string, itemId: string, includeArchived = false): Promise<InventoryItem | null> {
    const row = await this.prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        tenantId,
        ...(includeArchived ? {} : { deletedAt: null }),
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findBySku(tenantId: string, sku: string): Promise<InventoryItem | null> {
    const row = await this.prisma.inventoryItem.findFirst({
      where: { tenantId, sku: sku.trim(), deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<InventoryItem | null> {
    const normalized = barcode.trim();
    if (!normalized) return null;
    const row = await this.prisma.inventoryItem.findFirst({
      where: { tenantId, barcode: normalized, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByIds(tenantId: string, itemIds: string[], includeArchived = false): Promise<InventoryItem[]> {
    const uniqueIds = [...new Set(itemIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        id: { in: uniqueIds },
        ...(includeArchived ? {} : { deletedAt: null }),
      },
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByBranch(tenantId: string, branchId?: string | null): Promise<InventoryItem[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(branchId ? { branchId } : {}),
      },
      orderBy: { nameEn: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async listPage(filter: InventoryListFilter): Promise<InventoryListResult> {
    if (filter.stock === 'low') {
      return this.listLowStockPage(filter);
    }

    const where = this.buildWhere(filter);
    const [rows, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        orderBy: { nameEn: 'asc' },
        skip: filter.offset,
        take: filter.limit,
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return { items: rows.map((r) => this.toDomain(r)), total };
  }

  private async listLowStockPage(filter: InventoryListFilter): Promise<InventoryListResult> {
    const q = filter.q?.trim();
    const qPattern = q ? `%${q}%` : null;
    const branchClause = filter.branchId
      ? Prisma.sql`AND branch_id = ${filter.branchId}::uuid`
      : Prisma.empty;
    const categoryClause = filter.categoryId
      ? Prisma.sql`AND category_id = ${filter.categoryId}::uuid`
      : Prisma.empty;
    const searchClause = qPattern
      ? Prisma.sql`AND (sku ILIKE ${qPattern} OR COALESCE(barcode, '') ILIKE ${qPattern} OR COALESCE(brand, '') ILIKE ${qPattern} OR name_en ILIKE ${qPattern} OR COALESCE(name_ar, '') ILIKE ${qPattern} OR COALESCE(lot_number, '') ILIKE ${qPattern} OR COALESCE(storage_location, '') ILIKE ${qPattern})`
      : Prisma.empty;
    const statusClause =
      filter.status === 'archived'
        ? Prisma.sql`AND deleted_at IS NOT NULL`
        : Prisma.sql`AND deleted_at IS NULL`;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tenant_id: string;
        branch_id: string | null;
        sku: string;
        name_en: string;
        name_ar: string | null;
        unit: string;
        quantity_on_hand: Prisma.Decimal;
        reorder_threshold: Prisma.Decimal;
        cost_per_unit: Prisma.Decimal | null;
        lot_number: string | null;
        expiry_date: Date | null;
        supplier_id: string | null;
        deleted_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>
    >`
      SELECT *
      FROM inventory_items
      WHERE tenant_id = ${filter.tenantId}::uuid
      ${statusClause}
      ${branchClause}
      ${categoryClause}
      ${searchClause}
      AND quantity_on_hand > 0
      AND quantity_on_hand <= reorder_threshold
      ORDER BY name_en ASC
      LIMIT ${filter.limit}
      OFFSET ${filter.offset}
    `;

    const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM inventory_items
      WHERE tenant_id = ${filter.tenantId}::uuid
      ${statusClause}
      ${branchClause}
      ${categoryClause}
      ${searchClause}
      AND quantity_on_hand > 0
      AND quantity_on_hand <= reorder_threshold
    `;

    return {
      items: rows.map((row) =>
        this.toDomain({
          id: row.id,
          tenantId: row.tenant_id,
          branchId: row.branch_id,
          categoryId: (row as { category_id?: string | null }).category_id ?? null,
          sku: row.sku,
          barcode: (row as { barcode?: string | null }).barcode ?? null,
          brand: (row as { brand?: string | null }).brand ?? null,
          nameEn: row.name_en,
          nameAr: row.name_ar,
          unit: row.unit,
          quantityOnHand: row.quantity_on_hand,
          reorderThreshold: row.reorder_threshold,
          minQuantity: (row as { min_quantity?: Prisma.Decimal | null }).min_quantity ?? null,
          maxQuantity: (row as { max_quantity?: Prisma.Decimal | null }).max_quantity ?? null,
          costPerUnit: row.cost_per_unit,
          sellingPrice: (row as { selling_price?: Prisma.Decimal | null }).selling_price ?? null,
          storageLocation: (row as { storage_location?: string | null }).storage_location ?? null,
          lotNumber: row.lot_number,
          expiryDate: row.expiry_date,
          supplierId: row.supplier_id,
          deletedAt: row.deleted_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
      ),
      total: Number(countRows[0]?.count ?? 0),
    };
  }

  async archive(tenantId: string, itemId: string): Promise<void> {
    await this.prisma.inventoryItem.updateMany({
      where: { id: itemId, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async reactivate(tenantId: string, itemId: string): Promise<void> {
    await this.prisma.inventoryItem.updateMany({
      where: { id: itemId, tenantId },
      data: { deletedAt: null },
    });
  }

  /**
   * Wave C: direct ledger insert without StockMovement is forbidden.
   * Use InventoryUsagePostingService.postUsage / postClinicalUsage instead.
   */
  async recordConsumption(_input: {
    tenantId: string;
    inventoryItemId: string;
    quantityUsed: number;
    consumedBy: string;
    notes?: string | null;
    encounterId?: string | null;
    patientId?: string | null;
    procedureCode?: string | null;
  }): Promise<void> {
    throw new Error(
      'InventoryUsageLedger writes must go through InventoryUsagePostingService (AR-20)',
    );
  }

  async listRecentConsumptions(tenantId: string, limit: number): Promise<ConsumptionLogRecord[]> {
    const rows = await this.prisma.inventoryUsageLedger.findMany({
      where: { tenantId },
      orderBy: { consumedAt: 'desc' },
      take: limit,
      include: {
        inventoryItem: {
          select: { sku: true, nameEn: true, unit: true, sellingPrice: true, costPerUnit: true },
        },
      },
    });
    return rows.map((row) => this.mapConsumptionRow(row));
  }

  private mapConsumptionRow(row: {
    id: string;
    inventoryItemId: string;
    quantityUsed: Prisma.Decimal;
    consumedBy: string;
    notes: string | null;
    encounterId: string | null;
    patientId: string | null;
    procedureCode: string | null;
    invoiceId: string | null;
    invoiceLineItemId: string | null;
    consumedAt: Date;
    inventoryItem: {
      sku: string;
      nameEn: string;
      unit: string;
      sellingPrice?: Prisma.Decimal | null;
      costPerUnit?: Prisma.Decimal | null;
    };
  }): ConsumptionLogRecord {
    const sellingPrice = row.inventoryItem.sellingPrice?.toNumber() ?? null;
    const costPerUnit = row.inventoryItem.costPerUnit?.toNumber() ?? null;
    return {
      id: row.id,
      inventoryItemId: row.inventoryItemId,
      sku: row.inventoryItem.sku,
      itemNameEn: row.inventoryItem.nameEn,
      quantityUsed: row.quantityUsed.toNumber(),
      unit: row.inventoryItem.unit,
      unitPrice: sellingPrice ?? costPerUnit,
      consumedBy: row.consumedBy,
      notes: row.notes,
      encounterId: row.encounterId,
      patientId: row.patientId,
      procedureCode: row.procedureCode,
      invoiceId: row.invoiceId,
      invoiceLineItemId: row.invoiceLineItemId,
      consumedAt: row.consumedAt,
    };
  }

  async listConsumptions(filter: ConsumptionListFilter): Promise<ConsumptionListResult> {
    const where: Prisma.inventoryUsageLedgerWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.itemId ? { inventoryItemId: filter.itemId } : {}),
      ...(filter.encounterId ? { encounterId: filter.encounterId } : {}),
      ...(filter.patientId ? { patientId: filter.patientId } : {}),
      ...(filter.procedureCode ? { procedureCode: filter.procedureCode } : {}),
      ...(filter.invoiceId ? { invoiceId: filter.invoiceId } : {}),
      ...(filter.unbilled ? { invoiceId: null, patientId: { not: null } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.inventoryUsageLedger.findMany({
        where,
        orderBy: { consumedAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: {
          inventoryItem: {
            select: { sku: true, nameEn: true, unit: true, sellingPrice: true, costPerUnit: true },
          },
        },
      }),
      this.prisma.inventoryUsageLedger.count({ where }),
    ]);
    return {
      consumptions: rows.map((row) => this.mapConsumptionRow(row)),
      total,
    };
  }

  async findConsumptionsByIds(tenantId: string, consumptionIds: string[]): Promise<ConsumptionLogRecord[]> {
    if (consumptionIds.length === 0) return [];
    const rows = await this.prisma.inventoryUsageLedger.findMany({
      where: { tenantId, id: { in: consumptionIds } },
      include: {
        inventoryItem: {
          select: { sku: true, nameEn: true, unit: true, sellingPrice: true, costPerUnit: true },
        },
      },
    });
    return rows.map((row) => this.mapConsumptionRow(row));
  }

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
    patientId?: string | null;
    procedureCode?: string | null;
    performedBy: string;
    warehouseId?: string | null;
  }): Promise<string> {
    const id = randomUUID();
    await this.prisma.inventoryStockMovement.create({
      data: {
        id,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        movementType: input.movementType,
        quantity: new Prisma.Decimal(input.quantity),
        quantityBefore: new Prisma.Decimal(input.quantityBefore),
        quantityAfter: new Prisma.Decimal(input.quantityAfter),
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        encounterId: input.encounterId ?? null,
        patientId: input.patientId ?? null,
        procedureCode: input.procedureCode ?? null,
        warehouseId: input.warehouseId ?? null,
        performedBy: input.performedBy,
      },
    });
    return id;
  }

  async listStockMovements(filter: StockMovementListFilter): Promise<StockMovementListResult> {
    const where: Prisma.InventoryStockMovementWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.itemId ? { inventoryItemId: filter.itemId } : {}),
      ...(filter.encounterId ? { encounterId: filter.encounterId } : {}),
      ...(filter.movementType ? { movementType: filter.movementType } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.inventoryStockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: { inventoryItem: { select: { sku: true, nameEn: true, unit: true } } },
      }),
      this.prisma.inventoryStockMovement.count({ where }),
    ]);
    return {
      movements: rows.map((row) => this.toMovementRecord(row)),
      total,
    };
  }

  async listRecentStockMovements(tenantId: string, limit: number): Promise<StockMovementRecord[]> {
    const rows = await this.prisma.inventoryStockMovement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { inventoryItem: { select: { sku: true, nameEn: true, unit: true } } },
    });
    return rows.map((row) => this.toMovementRecord(row));
  }

  private toMovementRecord(row: {
    id: string;
    inventoryItemId: string;
    movementType: string;
    quantity: Prisma.Decimal;
    quantityBefore: Prisma.Decimal;
    quantityAfter: Prisma.Decimal;
    reason: string | null;
    notes: string | null;
    encounterId: string | null;
    performedBy: string;
    createdAt: Date;
    inventoryItem: { sku: string; nameEn: string; unit: string };
  }): StockMovementRecord {
    return {
      id: row.id,
      inventoryItemId: row.inventoryItemId,
      sku: row.inventoryItem.sku,
      itemNameEn: row.inventoryItem.nameEn,
      movementType: row.movementType as StockMovementType,
      quantity: row.quantity.toNumber(),
      quantityBefore: row.quantityBefore.toNumber(),
      quantityAfter: row.quantityAfter.toNumber(),
      unit: row.inventoryItem.unit,
      reason: row.reason,
      notes: row.notes,
      encounterId: row.encounterId,
      performedBy: row.performedBy,
      createdAt: row.createdAt,
    };
  }

  private buildWhere(filter: InventoryListFilter): Prisma.InventoryItemWhereInput {
    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + EXPIRY_ALERT_DAYS);

    const where: Prisma.InventoryItemWhereInput = {
      tenantId: filter.tenantId,
      ...(filter.branchId ? { branchId: filter.branchId } : {}),
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
    };

    if (filter.status === 'active') where.deletedAt = null;
    else if (filter.status === 'archived') where.deletedAt = { not: null };
    else where.deletedAt = null;

    if (filter.q?.trim()) {
      const q = filter.q.trim();
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { nameEn: { contains: q, mode: 'insensitive' } },
        { nameAr: { contains: q, mode: 'insensitive' } },
        { lotNumber: { contains: q, mode: 'insensitive' } },
        { storageLocation: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (filter.stock === 'out') {
      where.quantityOnHand = { lte: new Prisma.Decimal(0) };
    } else if (filter.stock === 'expired') {
      where.expiryDate = { lt: now };
    } else if (filter.stock === 'expiring') {
      where.expiryDate = { gte: now, lte: expiringBefore };
    }

    return where;
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    branchId: string | null;
    categoryId: string | null;
    sku: string;
    barcode: string | null;
    brand: string | null;
    nameEn: string;
    nameAr: string | null;
    unit: string;
    quantityOnHand: Prisma.Decimal;
    reorderThreshold: Prisma.Decimal;
    minQuantity: Prisma.Decimal | null;
    maxQuantity: Prisma.Decimal | null;
    costPerUnit: Prisma.Decimal | null;
    sellingPrice: Prisma.Decimal | null;
    storageLocation: string | null;
    lotNumber: string | null;
    expiryDate: Date | null;
    supplierId: string | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): InventoryItem {
    return InventoryItem.restore({
      itemId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      categoryId: row.categoryId,
      sku: row.sku,
      barcode: row.barcode,
      brand: row.brand,
      name: new LocalizedText(row.nameEn, row.nameAr),
      unit: row.unit,
      quantityOnHand: row.quantityOnHand.toNumber(),
      reorderThreshold: row.reorderThreshold.toNumber(),
      minQuantity: row.minQuantity?.toNumber() ?? null,
      maxQuantity: row.maxQuantity?.toNumber() ?? null,
      costPerUnit: row.costPerUnit?.toNumber() ?? null,
      sellingPrice: row.sellingPrice?.toNumber() ?? null,
      storageLocation: row.storageLocation,
      lotNumber: row.lotNumber,
      expiryDate: row.expiryDate,
      supplierId: row.supplierId,
      archivedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async createBatch(input: {
    tenantId: string;
    inventoryItemId: string;
    lotNumber?: string | null;
    manufacturedDate?: Date | null;
    expiryDate?: Date | null;
    quantity: number;
  }): Promise<string> {
    const id = randomUUID();
    await this.prisma.inventoryBatch.create({
      data: {
        id,
        tenantId: input.tenantId,
        inventoryItemId: input.inventoryItemId,
        lotNumber: input.lotNumber?.trim() || null,
        manufacturedDate: input.manufacturedDate ?? null,
        expiryDate: input.expiryDate ?? null,
        quantityOnHand: new Prisma.Decimal(input.quantity),
        status: 'ACTIVE',
      },
    });
    return id;
  }

  async listBatches(filter: BatchListFilter): Promise<BatchListResult> {
    const where = this.buildBatchWhere(filter);
    const [rows, total] = await Promise.all([
      this.prisma.inventoryBatch.findMany({
        where,
        orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
        skip: filter.offset,
        take: filter.limit,
        include: { inventoryItem: { select: { sku: true, nameEn: true, unit: true, deletedAt: true } } },
      }),
      this.prisma.inventoryBatch.count({ where }),
    ]);
    return {
      batches: rows
        .filter((r) => !r.inventoryItem.deletedAt)
        .map((r) => this.toBatchRecord(r)),
      total,
    };
  }

  async listBatchesForItem(tenantId: string, itemId: string): Promise<InventoryBatchRecord[]> {
    const rows = await this.prisma.inventoryBatch.findMany({
      where: { tenantId, inventoryItemId: itemId, status: { in: ['ACTIVE', 'DEPLETED'] } },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
      include: { inventoryItem: { select: { sku: true, nameEn: true, unit: true } } },
    });
    return rows.map((r) => this.toBatchRecord(r));
  }

  async consumeFifoBatches(tenantId: string, itemId: string, quantity: number): Promise<number> {
    const rows = await this.prisma.inventoryBatch.findMany({
      where: { tenantId, inventoryItemId: itemId, status: 'ACTIVE', quantityOnHand: { gt: 0 } },
    });
    const batches = [...rows].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return a.receivedAt.getTime() - b.receivedAt.getTime();
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return a.expiryDate.getTime() - b.expiryDate.getTime() || a.receivedAt.getTime() - b.receivedAt.getTime();
    });
    let remaining = quantity;
    let consumed = 0;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const available = batch.quantityOnHand.toNumber();
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      const after = available - take;
      await this.prisma.inventoryBatch.update({
        where: { id: batch.id },
        data: {
          quantityOnHand: new Prisma.Decimal(after),
          status: after <= 0 ? 'DEPLETED' : 'ACTIVE',
        },
      });
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
    expiringBefore.setDate(expiringBefore.getDate() + BATCH_EXPIRY_ALERT_DAYS);

    const baseWhere = { tenantId, status: 'ACTIVE', quantityOnHand: { gt: 0 } };
    const [expiringSoonCount, expiredCount, recentDisposals] = await Promise.all([
      this.prisma.inventoryBatch.count({
        where: { ...baseWhere, expiryDate: { gte: now, lte: expiringBefore } },
      }),
      this.prisma.inventoryBatch.count({
        where: { ...baseWhere, expiryDate: { lt: now } },
      }),
      this.prisma.inventoryDisposalLog.findMany({
        where: { tenantId },
        orderBy: { disposedAt: 'desc' },
        take: 10,
        include: { inventoryItem: { select: { sku: true, nameEn: true, unit: true } } },
      }),
    ]);

    return {
      expiringSoonCount,
      expiredCount,
      alertDays: BATCH_EXPIRY_ALERT_DAYS,
      recentDisposals: recentDisposals.map((row) => ({
        id: row.id,
        itemId: row.inventoryItemId,
        batchId: row.batchId,
        sku: row.inventoryItem.sku,
        itemName: row.inventoryItem.nameEn,
        quantity: row.quantity.toNumber(),
        unit: row.inventoryItem.unit,
        reason: row.reason,
        disposedAt: row.disposedAt.toISOString(),
      })),
    };
  }

  private buildBatchWhere(filter: BatchListFilter): Prisma.InventoryBatchWhereInput {
    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + BATCH_EXPIRY_ALERT_DAYS);

    const where: Prisma.InventoryBatchWhereInput = {
      tenantId: filter.tenantId,
      inventoryItem: { deletedAt: null },
    };
    if (filter.itemId) where.inventoryItemId = filter.itemId;
    if (filter.status === 'ACTIVE_ONLY') {
      where.status = 'ACTIVE';
      where.quantityOnHand = { gt: 0 };
    } else if (filter.status) {
      where.status = filter.status;
    } else {
      where.status = { in: ['ACTIVE', 'DEPLETED'] };
    }

    if (filter.expiry === 'expiring') {
      where.expiryDate = { gte: now, lte: expiringBefore };
      where.quantityOnHand = { gt: 0 };
      where.status = 'ACTIVE';
    } else if (filter.expiry === 'expired') {
      where.expiryDate = { lt: now };
      where.quantityOnHand = { gt: 0 };
      where.status = 'ACTIVE';
    } else if (filter.expiry === 'none') {
      where.expiryDate = null;
    }

    return where;
  }

  private toBatchRecord(row: {
    id: string;
    tenantId: string;
    inventoryItemId: string;
    lotNumber: string | null;
    manufacturedDate: Date | null;
    expiryDate: Date | null;
    quantityOnHand: Prisma.Decimal;
    status: string;
    receivedAt: Date;
    inventoryItem: { sku: string; nameEn: string; unit: string };
  }): InventoryBatchRecord {
    return {
      batchId: row.id,
      tenantId: row.tenantId,
      inventoryItemId: row.inventoryItemId,
      sku: row.inventoryItem.sku,
      itemNameEn: row.inventoryItem.nameEn,
      unit: row.inventoryItem.unit,
      lotNumber: row.lotNumber,
      manufacturedDate: row.manufacturedDate,
      expiryDate: row.expiryDate,
      quantityOnHand: row.quantityOnHand.toNumber(),
      status: row.status as BatchStatus,
      receivedAt: row.receivedAt,
    };
  }
}
