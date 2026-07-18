import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { StockTransferRepository } from '../domain/repositories/stock-transfer.repository.interface';
import type { StockTransferListFilter, StockTransferRecord, StockTransferStatus } from '../domain/repositories/stock-transfer.types';

@Injectable()
export class PrismaStockTransferRepository implements StockTransferRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number }>;
  }) {
    const transferId = randomUUID();
    const transferNumber = await this.nextTransferNumber(input.tenantId);

    await this.prisma.inventoryStockTransfer.create({
      data: {
        id: transferId,
        tenantId: input.tenantId,
        transferNumber,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        status: 'DRAFT',
        notes: input.notes?.trim() || null,
        requestedBy: input.requestedBy,
        lines: {
          create: input.lines.map((line, index) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            inventoryItemId: line.itemId,
            quantity: new Prisma.Decimal(line.quantity),
            quantityReceived: new Prisma.Decimal(0),
            sortOrder: index,
          })),
        },
      },
    });

    return { transferId, transferNumber };
  }

  async list(filter: StockTransferListFilter) {
    const where: Prisma.InventoryStockTransferWhereInput = { tenantId: filter.tenantId };
    if (filter.status === 'OPEN') {
      where.status = 'IN_TRANSIT';
    } else if (filter.status) {
      where.status = filter.status;
    }
    if (filter.warehouseId) {
      where.OR = [{ fromWarehouseId: filter.warehouseId }, { toWarehouseId: filter.warehouseId }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.inventoryStockTransfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: this.transferInclude(),
      }),
      this.prisma.inventoryStockTransfer.count({ where }),
    ]);

    return { transfers: rows.map((row) => this.toRecord(row)), total };
  }

  async findById(tenantId: string, transferId: string) {
    const row = await this.prisma.inventoryStockTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: this.transferInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async ship(tenantId: string, transferId: string) {
    await this.prisma.inventoryStockTransfer.updateMany({
      where: { id: transferId, tenantId, status: 'DRAFT' },
      data: { status: 'IN_TRANSIT', shippedAt: new Date() },
    });
  }

  async receiveLine(tenantId: string, lineId: string, quantity: number) {
    const line = await this.prisma.inventoryStockTransferLine.findFirst({
      where: { id: lineId, tenantId },
      select: { quantity: true, quantityReceived: true },
    });
    if (!line) throw new Error('Transfer line not found');
    const remaining = line.quantity.toNumber() - line.quantityReceived.toNumber();
    if (quantity <= 0 || quantity > remaining) throw new Error('Invalid receive quantity');

    await this.prisma.inventoryStockTransferLine.update({
      where: { id: lineId },
      data: { quantityReceived: new Prisma.Decimal(line.quantityReceived.toNumber() + quantity) },
    });
  }

  async refreshStatus(tenantId: string, transferId: string) {
    const transfer = await this.prisma.inventoryStockTransfer.findFirst({
      where: { id: transferId, tenantId },
      include: { lines: true },
    });
    if (!transfer || transfer.status !== 'IN_TRANSIT') return;

    const allReceived = transfer.lines.every(
      (l) => l.quantityReceived.toNumber() >= l.quantity.toNumber(),
    );
    if (allReceived) {
      await this.prisma.inventoryStockTransfer.update({
        where: { id: transferId },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    }
  }

  async cancel(tenantId: string, transferId: string) {
    await this.prisma.inventoryStockTransfer.updateMany({
      where: { id: transferId, tenantId, status: 'DRAFT' },
      data: { status: 'CANCELLED' },
    });
  }

  async getOpenCount(tenantId: string) {
    return this.prisma.inventoryStockTransfer.count({
      where: { tenantId, status: 'IN_TRANSIT' },
    });
  }

  private transferInclude() {
    return {
      fromWarehouse: { select: { id: true, nameEn: true } },
      toWarehouse: { select: { id: true, nameEn: true } },
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
    transferNumber: string;
    fromWarehouseId: string;
    toWarehouseId: string;
    status: string;
    notes: string | null;
    requestedBy: string;
    shippedAt: Date | null;
    receivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    fromWarehouse: { nameEn: string };
    toWarehouse: { nameEn: string };
    lines: Array<{
      id: string;
      inventoryItemId: string;
      quantity: Prisma.Decimal;
      quantityReceived: Prisma.Decimal;
      inventoryItem: { sku: string; nameEn: string; unit: string };
    }>;
  }): StockTransferRecord {
    return {
      transferId: row.id,
      transferNumber: row.transferNumber,
      fromWarehouseId: row.fromWarehouseId,
      fromWarehouseName: row.fromWarehouse.nameEn,
      toWarehouseId: row.toWarehouseId,
      toWarehouseName: row.toWarehouse.nameEn,
      status: row.status as StockTransferStatus,
      notes: row.notes,
      requestedBy: row.requestedBy,
      shippedAt: row.shippedAt,
      receivedAt: row.receivedAt,
      lines: row.lines.map((line) => ({
        lineId: line.id,
        itemId: line.inventoryItemId,
        sku: line.inventoryItem.sku,
        itemName: line.inventoryItem.nameEn,
        unit: line.inventoryItem.unit,
        quantity: line.quantity.toNumber(),
        quantityReceived: line.quantityReceived.toNumber(),
        quantityRemaining: line.quantity.toNumber() - line.quantityReceived.toNumber(),
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async nextTransferNumber(tenantId: string) {
    const year = new Date().getFullYear();
    const prefix = `TRF-${year}-`;
    const latest = await this.prisma.inventoryStockTransfer.findFirst({
      where: { tenantId, transferNumber: { startsWith: prefix } },
      orderBy: { transferNumber: 'desc' },
      select: { transferNumber: true },
    });
    const seq = latest ? Number(latest.transferNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }
}
