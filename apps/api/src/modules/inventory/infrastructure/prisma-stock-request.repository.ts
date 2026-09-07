import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { StockRequestRepository } from '../domain/repositories/stock-request.repository.interface';
import type {
  StockRequestListFilter,
  StockRequestRecord,
  StockRequestStatus,
  StockRequestType,
} from '../domain/repositories/stock-request.types';

type RequestRow = Prisma.InventoryStockRequestGetPayload<{
  include: {
    warehouse: { select: { nameEn: true } };
    lines: {
      include: {
        inventoryItem: { select: { sku: true; nameEn: true; unit: true; deletedAt: true } };
      };
    };
  };
}>;

@Injectable()
export class PrismaStockRequestRepository implements StockRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  private db(tx?: Prisma.TransactionClient) {
    return tx ?? this.prisma;
  }

  async create(input: {
    tenantId: string;
    requestType: string;
    departmentName?: string | null;
    patientId?: string | null;
    warehouseId?: string | null;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number; notes?: string | null }>;
  }) {
    if (!input.lines.length) throw new Error('At least one line is required');

    const requestId = randomUUID();
    const requestNumber = await this.nextRequestNumber(input.tenantId);

    const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId: input.tenantId, id: { in: itemIds }, deletedAt: null },
      select: { id: true },
    });
    if (items.length !== itemIds.length) throw new Error('One or more inventory items not found');

    await this.prisma.inventoryStockRequest.create({
      data: {
        id: requestId,
        tenantId: input.tenantId,
        requestNumber,
        requestType: input.requestType,
        status: 'DRAFT',
        departmentName: input.departmentName?.trim() || null,
        patientId: input.patientId ?? null,
        warehouseId: input.warehouseId ?? null,
        notes: input.notes?.trim() || null,
        requestedBy: input.requestedBy,
        lines: {
          create: input.lines.map((line, index) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            inventoryItemId: line.itemId,
            quantityRequested: line.quantity,
            notes: line.notes?.trim() || null,
            sortOrder: index,
          })),
        },
      },
    });

    return { requestId, requestNumber };
  }

  async list(filter: StockRequestListFilter) {
    const where: Prisma.InventoryStockRequestWhereInput = { tenantId: filter.tenantId };
    if (filter.status === 'OPEN') {
      where.status = { in: ['SUBMITTED', 'APPROVED'] };
    } else if (filter.status) {
      where.status = filter.status;
    }
    if (filter.requestType) where.requestType = filter.requestType;
    if (filter.requestedBy) where.requestedBy = filter.requestedBy;

    const [rows, total] = await Promise.all([
      this.prisma.inventoryStockRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: this.requestInclude(),
      }),
      this.prisma.inventoryStockRequest.count({ where }),
    ]);

    return { requests: rows.map((row) => this.toRecord(row)), total };
  }

  async findById(tenantId: string, requestId: string, tx?: Prisma.TransactionClient) {
    const row = await this.db(tx).inventoryStockRequest.findFirst({
      where: { id: requestId, tenantId },
      include: this.requestInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async submit(tenantId: string, requestId: string) {
    const updated = await this.prisma.inventoryStockRequest.updateMany({
      where: { id: requestId, tenantId, status: 'DRAFT' },
      data: { status: 'SUBMITTED' },
    });
    if (updated.count === 0) throw new Error('Request not found or not in draft');
  }

  async approve(tenantId: string, requestId: string, approvedBy: string) {
    const updated = await this.prisma.inventoryStockRequest.updateMany({
      where: { id: requestId, tenantId, status: 'SUBMITTED' },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    });
    if (updated.count === 0) throw new Error('Request not found or not pending approval');
  }

  async reject(tenantId: string, requestId: string, rejectedBy: string, reason?: string | null) {
    const updated = await this.prisma.inventoryStockRequest.updateMany({
      where: { id: requestId, tenantId, status: 'SUBMITTED' },
      data: {
        status: 'REJECTED',
        rejectedBy,
        rejectedAt: new Date(),
        rejectionReason: reason?.trim() || null,
      },
    });
    if (updated.count === 0) throw new Error('Request not found or not pending approval');
  }

  async cancel(tenantId: string, requestId: string) {
    const updated = await this.prisma.inventoryStockRequest.updateMany({
      where: { id: requestId, tenantId, status: { in: ['DRAFT', 'SUBMITTED'] } },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) throw new Error('Request not found or cannot be cancelled');
  }

  async incrementLineFulfilled(
    tenantId: string,
    lineId: string,
    quantity: number,
    tx?: Prisma.TransactionClient,
  ) {
    const db = this.db(tx);
    const line = await db.inventoryStockRequestLine.findFirst({
      where: { id: lineId, tenantId },
    });
    if (!line) throw new Error('Request line not found');

    const newFulfilled = line.quantityFulfilled.toNumber() + quantity;
    if (newFulfilled > line.quantityRequested.toNumber() + 0.0001) {
      throw new Error('Fulfillment quantity exceeds requested amount');
    }

    await db.inventoryStockRequestLine.update({
      where: { id: lineId },
      data: { quantityFulfilled: newFulfilled },
    });
  }

  async markFulfilled(
    tenantId: string,
    requestId: string,
    fulfilledBy: string,
    tx?: Prisma.TransactionClient,
  ) {
    await this.db(tx).inventoryStockRequest.updateMany({
      where: { id: requestId, tenantId },
      data: { status: 'FULFILLED', fulfilledBy, fulfilledAt: new Date() },
    });
  }

  async recomputeStatus(tenantId: string, requestId: string, tx?: Prisma.TransactionClient) {
    const db = this.db(tx);
    const request = await db.inventoryStockRequest.findFirst({
      where: { id: requestId, tenantId, status: 'APPROVED' },
      include: { lines: true },
    });
    if (!request) return;

    const allDone = request.lines.every(
      (line) => line.quantityFulfilled.toNumber() >= line.quantityRequested.toNumber(),
    );
    if (allDone) {
      await db.inventoryStockRequest.update({
        where: { id: requestId },
        data: { status: 'FULFILLED', fulfilledAt: new Date() },
      });
    }
  }

  async lockLineForUpdate(tenantId: string, lineId: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<
      Array<{
        lineId: string;
        requestId: string;
        requestNumber: string;
        status: string;
        itemId: string;
        quantityRequested: Prisma.Decimal | string | number;
        quantityFulfilled: Prisma.Decimal | string | number;
        warehouseId: string | null;
        patientId: string | null;
        fulfilledBy: string | null;
      }>
    >`
      SELECT
        l.id AS "lineId",
        r.id AS "requestId",
        r."requestNumber" AS "requestNumber",
        r.status AS status,
        l."inventoryItemId" AS "itemId",
        l."quantityRequested" AS "quantityRequested",
        l."quantityFulfilled" AS "quantityFulfilled",
        r."warehouseId" AS "warehouseId",
        r."patientId" AS "patientId",
        r."fulfilledBy" AS "fulfilledBy"
      FROM inventory_stock_request_lines l
      INNER JOIN inventory_stock_requests r ON r.id = l."stockRequestId"
      WHERE l.id = ${lineId}::uuid
        AND l."tenantId" = ${tenantId}::uuid
      FOR UPDATE OF l, r
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      lineId: row.lineId,
      requestId: row.requestId,
      requestNumber: row.requestNumber,
      status: row.status,
      itemId: row.itemId,
      quantityRequested: Number(row.quantityRequested),
      quantityFulfilled: Number(row.quantityFulfilled),
      warehouseId: row.warehouseId,
      patientId: row.patientId,
      fulfilledBy: row.fulfilledBy,
    };
  }

  async findRequestIdByLineId(tenantId: string, lineId: string) {
    const line = await this.prisma.inventoryStockRequestLine.findFirst({
      where: { id: lineId, tenantId },
      select: { stockRequestId: true },
    });
    return line?.stockRequestId ?? null;
  }

  async findLineById(tenantId: string, lineId: string) {
    const line = await this.prisma.inventoryStockRequestLine.findFirst({
      where: { id: lineId, tenantId },
      include: {
        stockRequest: { select: { id: true, requestNumber: true, status: true, warehouseId: true, patientId: true } },
      },
    });
    if (!line) return null;
    return {
      lineId: line.id,
      requestId: line.stockRequest.id,
      requestNumber: line.stockRequest.requestNumber,
      status: line.stockRequest.status,
      itemId: line.inventoryItemId,
      quantityRequested: line.quantityRequested.toNumber(),
      quantityFulfilled: line.quantityFulfilled.toNumber(),
      warehouseId: line.stockRequest.warehouseId,
      patientId: line.stockRequest.patientId,
    };
  }

  async getSummaryCounts(tenantId: string) {
    const [pendingApprovalCount, openFulfillmentCount] = await Promise.all([
      this.prisma.inventoryStockRequest.count({ where: { tenantId, status: 'SUBMITTED' } }),
      this.prisma.inventoryStockRequest.count({ where: { tenantId, status: 'APPROVED' } }),
    ]);
    return { pendingApprovalCount, openFulfillmentCount };
  }

  private requestInclude() {
    return {
      warehouse: { select: { nameEn: true } },
      lines: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          inventoryItem: { select: { sku: true, nameEn: true, unit: true, deletedAt: true } },
        },
      },
    };
  }

  private toRecord(row: RequestRow): StockRequestRecord {
    const lines = row.lines
      .filter((line) => line.inventoryItem.deletedAt == null)
      .map((line) => {
        const requested = line.quantityRequested.toNumber();
        const fulfilled = line.quantityFulfilled.toNumber();
        return {
          lineId: line.id,
          itemId: line.inventoryItemId,
          sku: line.inventoryItem.sku,
          itemName: line.inventoryItem.nameEn,
          unit: line.inventoryItem.unit,
          quantityRequested: requested,
          quantityFulfilled: fulfilled,
          quantityRemaining: Math.max(0, requested - fulfilled),
          notes: line.notes,
        };
      });

    const totalRequested = lines.reduce((sum, l) => sum + l.quantityRequested, 0);
    const totalFulfilled = lines.reduce((sum, l) => sum + l.quantityFulfilled, 0);

    return {
      requestId: row.id,
      requestNumber: row.requestNumber,
      requestType: row.requestType as StockRequestType,
      status: row.status as StockRequestStatus,
      departmentName: row.departmentName,
      patientId: row.patientId,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouse?.nameEn ?? null,
      notes: row.notes,
      requestedBy: row.requestedBy,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      rejectedBy: row.rejectedBy,
      rejectedAt: row.rejectedAt,
      rejectionReason: row.rejectionReason,
      fulfilledBy: row.fulfilledBy,
      fulfilledAt: row.fulfilledAt,
      lines,
      metrics: {
        lineCount: lines.length,
        fulfilledLineCount: lines.filter((l) => l.quantityRemaining <= 0).length,
        totalRequested,
        totalFulfilled,
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async nextRequestNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.inventoryStockRequest.count({ where: { tenantId } });
    return `REQ-${String(count + 1).padStart(5, '0')}`;
  }
}
