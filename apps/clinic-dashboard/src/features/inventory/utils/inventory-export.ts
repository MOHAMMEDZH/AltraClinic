import type { InventoryItem } from '../types/inventory.types';
import { itemDisplayName, stockStatus } from '../config/inventory-config';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildInventoryItemsCsv(items: InventoryItem[], locale: string): string {
  const headers = ['SKU', 'Barcode', 'Name', 'Quantity', 'Unit', 'Reorder', 'Status', 'Expiry', 'Storage'];
  const rows = items.map((item) => [
    item.sku,
    item.barcode ?? '',
    itemDisplayName(item, locale),
    String(item.quantityOnHand),
    item.unit,
    String(item.reorderThreshold),
    stockStatus(item),
    item.expiryDate ?? '',
    item.storageLocation ?? '',
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

export function downloadInventoryCsv(filename: string, csv: string): void {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  downloadInventoryBlob(filename, blob);
}

export function downloadInventoryBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
