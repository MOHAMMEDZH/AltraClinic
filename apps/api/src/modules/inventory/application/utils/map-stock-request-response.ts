import type { StockRequestRecord } from '../../domain/repositories/stock-request.types';

export function mapStockRequestResponse(row: StockRequestRecord) {
  return {
    requestId: row.requestId,
    requestNumber: row.requestNumber,
    requestType: row.requestType,
    status: row.status,
    departmentName: row.departmentName,
    patientId: row.patientId,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    notes: row.notes,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    fulfilledBy: row.fulfilledBy,
    fulfilledAt: row.fulfilledAt?.toISOString() ?? null,
    metrics: row.metrics,
    lines: row.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      sku: line.sku,
      itemName: line.itemName,
      unit: line.unit,
      quantityRequested: line.quantityRequested,
      quantityFulfilled: line.quantityFulfilled,
      quantityRemaining: line.quantityRemaining,
      notes: line.notes,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
