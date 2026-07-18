import type { PurchaseOrderRecord } from '../../domain/repositories/purchase-order.types';

export function mapPurchaseOrder(record: PurchaseOrderRecord) {
  return {
    orderId: record.orderId,
    poNumber: record.poNumber,
    supplierId: record.supplierId,
    supplierName: record.supplierName,
    status: record.status,
    notes: record.notes,
    requestedBy: record.requestedBy,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    lines: record.lines.map((l) => ({
      lineId: l.lineId,
      itemId: l.itemId,
      sku: l.sku,
      itemName: l.itemNameEn,
      unit: l.unit,
      quantityOrdered: l.quantityOrdered,
      quantityReceived: l.quantityReceived,
      quantityRemaining: Math.max(0, l.quantityOrdered - l.quantityReceived),
      unitCost: l.unitCost,
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
