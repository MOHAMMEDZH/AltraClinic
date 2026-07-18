import type { StockCountRecord } from '../../domain/repositories/stock-count.types';

export function mapStockCountResponse(row: StockCountRecord) {
  return {
    countId: row.countId,
    countNumber: row.countNumber,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouseName,
    status: row.status,
    notes: row.notes,
    requestedBy: row.requestedBy,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    metrics: row.metrics,
    lines: row.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      sku: line.sku,
      itemName: line.itemName,
      unit: line.unit,
      systemQuantity: line.systemQuantity,
      countedQuantity: line.countedQuantity,
      variance: line.variance,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
