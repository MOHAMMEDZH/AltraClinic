import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { PurchaseOrderRepository, PurchaseOrderLineWithOrder } from '../domain/repositories/purchase-order.repository.interface';
import type { PurchaseOrderListFilter, PurchaseOrderRecord, PurchaseOrderStatus } from '../domain/repositories/purchase-order.types';

@Injectable()
export class PrismaPurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    supplierId?: string | null;
    notes?: string | null;
    requestedBy: string;
    lines: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
  }) {
    const orderId = randomUUID();
    const poNumber = await this.nextPoNumber(input.tenantId);

    await this.prisma.purchaseOrder.create({
      data: {
        id: orderId,
        tenantId: input.tenantId,
        poNumber,
        supplierId: input.supplierId ?? null,
        status: 'DRAFT',
        notes: input.notes?.trim() || null,
        requestedBy: input.requestedBy,
        lines: {
          create: input.lines.map((line, index) => ({
            id: randomUUID(),
            tenantId: input.tenantId,
            inventoryItemId: line.itemId,
            quantityOrdered: new Prisma.Decimal(line.quantity),
            quantityReceived: new Prisma.Decimal(0),
            unitCost: line.unitCost != null ? new Prisma.Decimal(line.unitCost) : null,
            sortOrder: index,
          })),
        },
      },
    });

    return { orderId, poNumber };
  }

  async list(filter: PurchaseOrderListFilter) {
    const where: Prisma.PurchaseOrderWhereInput = { tenantId: filter.tenantId };
    if (filter.supplierId) where.supplierId = filter.supplierId;
    if (filter.status === 'OPEN') {
      where.status = { in: ['APPROVED', 'PARTIALLY_RECEIVED'] };
    } else if (filter.status) {
      where.status = filter.status;
    }

    const [rows, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset,
        take: filter.limit,
        include: this.orderInclude(),
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { orders: rows.map((row) => this.toRecord(row)), total };
  }

  async findById(tenantId: string, orderId: string): Promise<PurchaseOrderRecord | null> {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: this.orderInclude(),
    });
    return row ? this.toRecord(row) : null;
  }

  async findLineById(tenantId: string, lineId: string): Promise<PurchaseOrderLineWithOrder | null> {
    const row = await this.prisma.purchaseOrderLine.findFirst({
      where: { id: lineId, tenantId },
      include: { purchaseOrder: { select: { poNumber: true, status: true } } },
    });
    if (!row) return null;
    return {
      lineId: row.id,
      purchaseOrderId: row.purchaseOrderId,
      itemId: row.inventoryItemId,
      quantityOrdered: row.quantityOrdered.toNumber(),
      quantityReceived: row.quantityReceived.toNumber(),
      poNumber: row.purchaseOrder.poNumber,
      status: row.purchaseOrder.status,
    };
  }

  async submit(tenantId: string, orderId: string) {
    await this.prisma.purchaseOrder.updateMany({
      where: { id: orderId, tenantId, status: 'DRAFT' },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approve(tenantId: string, orderId: string, approvedBy: string) {
    await this.prisma.purchaseOrder.updateMany({
      where: { id: orderId, tenantId, status: 'PENDING_APPROVAL' },
      data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
    });
  }

  async cancel(tenantId: string, orderId: string) {
    await this.prisma.purchaseOrder.updateMany({
      where: {
        id: orderId,
        tenantId,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
      },
      data: { status: 'CANCELLED' },
    });
  }

  async incrementLineReceived(tenantId: string, lineId: string, quantity: number) {
    const line = await this.prisma.purchaseOrderLine.findFirst({
      where: { id: lineId, tenantId },
    });
    if (!line) throw new Error('Line not found');
    const after = line.quantityReceived.toNumber() + quantity;
    await this.prisma.purchaseOrderLine.update({
      where: { id: lineId },
      data: { quantityReceived: new Prisma.Decimal(after) },
    });
  }

  async recomputeOrderStatus(tenantId: string, orderId: string) {
    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: orderId, tenantId },
    });
    if (lines.length === 0) return;

    let allReceived = true;
    let anyReceived = false;
    for (const line of lines) {
      const ordered = line.quantityOrdered.toNumber();
      const received = line.quantityReceived.toNumber();
      if (received > 0) anyReceived = true;
      if (received < ordered) allReceived = false;
    }

    let status: PurchaseOrderStatus = 'APPROVED';
    if (allReceived) status = 'RECEIVED';
    else if (anyReceived) status = 'PARTIALLY_RECEIVED';

    await this.prisma.purchaseOrder.updateMany({
      where: { id: orderId, tenantId, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'] } },
      data: { status },
    });
  }

  async getSummaryCounts(tenantId: string) {
    const [pendingApprovalCount, openPoCount] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { tenantId, status: 'PENDING_APPROVAL' } }),
      this.prisma.purchaseOrder.count({
        where: { tenantId, status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] } },
      }),
    ]);
    return { pendingApprovalCount, openPoCount };
  }

  private orderInclude() {
    return {
      supplier: { select: { nameEn: true } },
      lines: {
        orderBy: { sortOrder: 'asc' as const },
        include: {
          inventoryItem: { select: { sku: true, nameEn: true, unit: true, deletedAt: true } },
        },
      },
    };
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    poNumber: string;
    supplierId: string | null;
    status: string;
    notes: string | null;
    requestedBy: string;
    approvedBy: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    supplier: { nameEn: string } | null;
    lines: Array<{
      id: string;
      purchaseOrderId: string;
      inventoryItemId: string;
      quantityOrdered: Prisma.Decimal;
      quantityReceived: Prisma.Decimal;
      unitCost: Prisma.Decimal | null;
      sortOrder: number;
      inventoryItem: { sku: string; nameEn: string; unit: string; deletedAt: Date | null };
    }>;
  }): PurchaseOrderRecord {
    return {
      orderId: row.id,
      tenantId: row.tenantId,
      poNumber: row.poNumber,
      supplierId: row.supplierId,
      supplierName: row.supplier?.nameEn ?? null,
      status: row.status as PurchaseOrderStatus,
      notes: row.notes,
      requestedBy: row.requestedBy,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      lines: row.lines
        .filter((l) => !l.inventoryItem.deletedAt)
        .map((l) => ({
          lineId: l.id,
          purchaseOrderId: l.purchaseOrderId,
          itemId: l.inventoryItemId,
          sku: l.inventoryItem.sku,
          itemNameEn: l.inventoryItem.nameEn,
          unit: l.inventoryItem.unit,
          quantityOrdered: l.quantityOrdered.toNumber(),
          quantityReceived: l.quantityReceived.toNumber(),
          unitCost: l.unitCost?.toNumber() ?? null,
          sortOrder: l.sortOrder,
        })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async nextPoNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    return `PO-${String(count + 1).padStart(6, '0')}`;
  }
}
