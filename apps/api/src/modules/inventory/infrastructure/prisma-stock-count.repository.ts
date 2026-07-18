import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { StockCountRepository } from '../domain/repositories/stock-count.repository.interface';
import type { StockCountListFilter, StockCountRecord, StockCountStatus } from '../domain/repositories/stock-count.types';

@Injectable()
export class PrismaStockCountRepository implements StockCountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    warehouseId: string;
    notes?: string | null;
    requestedBy: string;
    itemIds?: string[];
  }) {
    const countId = randomUUID();
    const countNumber = await this.nextCountNumber(input.tenantId);

    const stockRows = await this.prisma.inventoryWarehouseStock.findMany({
      where: {
        tenantId: input.tenantId,
        warehouseId: input.warehouseId,
        ...(input.itemIds?.length ? { inventoryItemId: { in: input.itemIds } } : {}),
      },
      include: {
        inventoryItem: { select: { id: true, deletedAt: true } },
      },
      orderBy: { inventoryItem: { nameEn: 'asc' } },
    });

    const activeRows = stockRows.filter((row) => row.inventoryItem.deletedAt == null);
    if (activeRows.length === 0) {
      throw new Error('No stock lines found for this warehouse');
    }

    await this.prisma.inventoryStockCount.create({
      data: {
        id: countId,
        tenantId: input.tenantId,
        countNumber,
        warehouseId: input.warehouseId,
        status: 'DRAFT',
        notes: input.notes?.trim() || null,
        requestedBy: input.requestedBy,
        lines: {
          create: activeRows.map((row, index) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            inventoryItemId: row.inventoryItemId,
            systemQuantity: row.quantityOnHand,
            sortOrder: index,
          })),
        },
      },
    });

    return { countId, countNumber };
  }

  async list(filter: StockCountListFilter) {
    const where: Prisma.InventoryStockCountWhereInput = { tenantId: filter.tenantId };
    if (filter.status === 'OPEN') {
      where.status = { in: ['IN_PROGRESS', 'PENDING_APPROVAL'] };
    } else if (filter.status) {
      where.status = filter.status;
    }
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;

    const [rows, total] = await Promise.all([
      this.prisma.inventoryStockCount.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: this.countInclude(),
      }),
      this.prisma.inventoryStockCount.count({ where }),
    ]);

    return { counts: rows.map((row) => this.toRecord(row)), total };
  }

  async findById(tenantId: string, countId: string) {
    const row = await this.prisma.inventoryStockCount.findFirst({
      where: { id: countId, tenantId },
      include: this.countInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async start(tenantId: string, countId: string) {
    const count = await this.prisma.inventoryStockCount.findFirst({
      where: { id: countId, tenantId, status: 'DRAFT' },
      include: { lines: true },
    });
    if (!count) throw new Error('Stock count not found or not in draft');

    await this.prisma.$transaction(async (tx) => {
      for (const line of count.lines) {
        const stock = await tx.inventoryWarehouseStock.findFirst({
          where: {
            tenantId,
            warehouseId: count.warehouseId,
            inventoryItemId: line.inventoryItemId,
          },
        });
        await tx.inventoryStockCountLine.update({
          where: { id: line.id },
          data: {
            systemQuantity: stock?.quantityOnHand ?? new Prisma.Decimal(0),
            countedQuantity: null,
          },
        });
      }
      await tx.inventoryStockCount.update({
        where: { id: countId },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
    });
  }

  async updateLine(tenantId: string, lineId: string, countedQuantity: number) {
    const line = await this.prisma.inventoryStockCountLine.findFirst({
      where: { id: lineId, tenantId },
      include: { stockCount: { select: { status: true } } },
    });
    if (!line) throw new Error('Count line not found');
    if (line.stockCount.status !== 'IN_PROGRESS') throw new Error('Count is not in progress');
    if (countedQuantity < 0) throw new Error('Counted quantity cannot be negative');

    await this.prisma.inventoryStockCountLine.update({
      where: { id: lineId },
      data: { countedQuantity: new Prisma.Decimal(countedQuantity) },
    });
  }

  async submit(tenantId: string, countId: string) {
    const count = await this.prisma.inventoryStockCount.findFirst({
      where: { id: countId, tenantId, status: 'IN_PROGRESS' },
      include: { lines: true },
    });
    if (!count) throw new Error('Stock count not found or not in progress');

    const uncounted = count.lines.some((l) => l.countedQuantity == null);
    if (uncounted) throw new Error('All lines must be counted before submit');

    await this.prisma.inventoryStockCount.update({
      where: { id: countId },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(tenantId: string, countId: string, approvedBy: string) {
    await this.prisma.inventoryStockCount.updateMany({
      where: { id: countId, tenantId, status: 'PENDING_APPROVAL' },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date(), completedAt: new Date() },
    });
  }

  async cancel(tenantId: string, countId: string) {
    await this.prisma.inventoryStockCount.updateMany({
      where: {
        id: countId,
        tenantId,
        status: { in: ['DRAFT', 'IN_PROGRESS', 'PENDING_APPROVAL'] },
      },
      data: { status: 'CANCELLED' },
    });
  }

  async getSummaryCounts(tenantId: string) {
    const [pendingApprovalCount, inProgressCount] = await Promise.all([
      this.prisma.inventoryStockCount.count({ where: { tenantId, status: 'PENDING_APPROVAL' } }),
      this.prisma.inventoryStockCount.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
    ]);
    return { pendingApprovalCount, inProgressCount };
  }

  async findCountIdByLineId(tenantId: string, lineId: string) {
    const line = await this.prisma.inventoryStockCountLine.findFirst({
      where: { id: lineId, tenantId },
      select: { stockCountId: true },
    });
    return line?.stockCountId ?? null;
  }

  private countInclude() {
    return {
      warehouse: { select: { nameEn: true } },
      lines: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          inventoryItem: { select: { sku: true, nameEn: true, unit: true } },
        },
      },
    };
  }

  private toRecord(row: {
    id: string;
    countNumber: string;
    warehouseId: string;
    status: string;
    notes: string | null;
    requestedBy: string;
    approvedBy: string | null;
    approvedAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    warehouse: { nameEn: string };
    lines: Array<{
      id: string;
      inventoryItemId: string;
      systemQuantity: Prisma.Decimal;
      countedQuantity: Prisma.Decimal | null;
      inventoryItem: { sku: string; nameEn: string; unit: string };
    }>;
  }): StockCountRecord {
    const lines = row.lines.map((line) => {
      const systemQuantity = line.systemQuantity.toNumber();
      const countedQuantity = line.countedQuantity?.toNumber() ?? null;
      const variance = countedQuantity != null ? countedQuantity - systemQuantity : null;
      return {
        lineId: line.id,
        itemId: line.inventoryItemId,
        sku: line.inventoryItem.sku,
        itemName: line.inventoryItem.nameEn,
        unit: line.inventoryItem.unit,
        systemQuantity,
        countedQuantity,
        variance,
      };
    });

    const countedLineCount = lines.filter((l) => l.countedQuantity != null).length;
    const varianceLineCount = lines.filter((l) => l.variance != null && l.variance !== 0).length;

    return {
      countId: row.id,
      countNumber: row.countNumber,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse.nameEn,
      status: row.status as StockCountStatus,
      notes: row.notes,
      requestedBy: row.requestedBy,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      lines,
      metrics: { lineCount: lines.length, countedLineCount, varianceLineCount },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async nextCountNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `SC-${year}-`;
    const latest = await this.prisma.inventoryStockCount.findFirst({
      where: { tenantId, countNumber: { startsWith: prefix } },
      orderBy: { countNumber: 'desc' },
      select: { countNumber: true },
    });
    const seq = latest ? Number(latest.countNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
