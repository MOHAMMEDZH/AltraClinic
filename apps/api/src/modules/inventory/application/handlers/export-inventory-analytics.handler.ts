import { Injectable } from '@nestjs/common';
import { GetInventoryAnalyticsHandler } from './get-inventory-analytics.handler';

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(values: Array<string | number>): string {
  return values.map(csvEscape).join(',');
}

@Injectable()
export class ExportInventoryAnalyticsHandler {
  constructor(private readonly analyticsHandler: GetInventoryAnalyticsHandler) {}

  async execute(days?: number): Promise<string> {
    const data = await this.analyticsHandler.execute(days);
    const lines: string[] = [];

    lines.push(csvRow(['Inventory Analytics Report']));
    lines.push(csvRow(['Generated At', data.generatedAt]));
    lines.push(csvRow(['Period Days', data.periodDays]));
    lines.push('');

    lines.push(csvRow(['Stock Valuation']));
    lines.push(csvRow(['Total Stock Value', data.valuation.totalStockValue]));
    lines.push(csvRow(['Item Count', data.valuation.itemCount]));
    lines.push('');
    lines.push(csvRow(['Category', 'Stock Value', 'Item Count']));
    for (const row of data.valuation.byCategory) {
      lines.push(csvRow([row.categoryName, row.stockValue, row.itemCount]));
    }
    lines.push('');

    lines.push(csvRow(['Stock Health']));
    lines.push(csvRow(['Low Stock', data.stockHealth.lowStock]));
    lines.push(csvRow(['Out of Stock', data.stockHealth.outOfStock]));
    lines.push(csvRow(['Expiring Soon', data.stockHealth.expiringSoon]));
    lines.push(csvRow(['Expired', data.stockHealth.expired]));
    lines.push('');

    lines.push(csvRow(['Consumption']));
    lines.push(csvRow(['Total Quantity', data.consumption.totalQuantity]));
    lines.push(csvRow(['Event Count', data.consumption.eventCount]));
    lines.push('');
    lines.push(csvRow(['Date', 'Quantity', 'Events']));
    for (const row of data.consumption.byDay) {
      lines.push(csvRow([row.date, row.quantity, row.events]));
    }
    lines.push('');
    lines.push(csvRow(['SKU', 'Name', 'Quantity', 'Unit']));
    for (const row of data.consumption.topItems) {
      lines.push(csvRow([row.sku, row.name, row.quantity, row.unit]));
    }
    lines.push('');

    lines.push(csvRow(['Procurement']));
    lines.push(csvRow(['Active Suppliers', data.procurement.activeSupplierCount]));
    lines.push(csvRow(['Ordered Value', data.procurement.orderedValue]));
    lines.push(csvRow(['Received Value', data.procurement.receivedValue]));
    lines.push('');
    lines.push(csvRow(['PO Status', 'Count']));
    for (const row of data.procurement.byStatus) {
      lines.push(csvRow([row.status, row.count]));
    }
    lines.push('');
    lines.push(csvRow(['Supplier', 'Order Count']));
    for (const row of data.procurement.topSuppliers) {
      lines.push(csvRow([row.supplierName, row.orderCount]));
    }
    lines.push('');

    lines.push(csvRow(['Movements By Type']));
    lines.push(csvRow(['Movement Type', 'Count', 'Quantity']));
    for (const row of data.movements.byType) {
      lines.push(csvRow([row.movementType, row.count, row.quantity]));
    }

    return lines.join('\n');
  }
}
