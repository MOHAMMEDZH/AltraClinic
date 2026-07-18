import type { InventoryWarehouseRecord } from '../../domain/repositories/inventory-warehouse.types';
import type { StockTransferRecord } from '../../domain/repositories/stock-transfer.types';

export function mapWarehouseResponse(row: InventoryWarehouseRecord) {
  return {
    warehouseId: row.warehouseId,
    branchId: row.branchId,
    code: row.code,
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    address: row.address,
    isDefault: row.isDefault,
    isActive: row.isActive,
    metrics: row.metrics,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapStockTransferResponse(row: StockTransferRecord) {
  return {
    transferId: row.transferId,
    transferNumber: row.transferNumber,
    fromWarehouseId: row.fromWarehouseId,
    fromWarehouseName: row.fromWarehouseName,
    toWarehouseId: row.toWarehouseId,
    toWarehouseName: row.toWarehouseName,
    status: row.status,
    notes: row.notes,
    requestedBy: row.requestedBy,
    shippedAt: row.shippedAt?.toISOString() ?? null,
    receivedAt: row.receivedAt?.toISOString() ?? null,
    lines: row.lines.map((line) => ({
      lineId: line.lineId,
      itemId: line.itemId,
      sku: line.sku,
      itemName: line.itemName,
      unit: line.unit,
      quantity: line.quantity,
      quantityReceived: line.quantityReceived,
      quantityRemaining: line.quantityRemaining,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
