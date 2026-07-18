type InventoryCsvRow = {
  sku: string;
  barcode: string | null;
  name: { en: string | null; ar: string | null };
  quantityOnHand: number;
  unit: string;
  reorderThreshold: number;
  costPerUnit: number | null;
  expiryDate: string | null;
  storageLocation: string | null;
  categoryId: string | null;
  archivedAt: string | null;
};

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function stockStatusLabel(item: InventoryCsvRow): string {
  if (item.quantityOnHand <= 0) return 'out';
  if (item.expiryDate) {
    const expiry = new Date(item.expiryDate);
    const now = new Date();
    if (expiry.getTime() < now.getTime()) return 'expired';
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 7);
    if (expiry.getTime() <= soon.getTime()) return 'expiring';
  }
  if (item.quantityOnHand <= item.reorderThreshold) return 'low';
  return 'ok';
}

export function buildInventoryItemsCsv(items: InventoryCsvRow[]): string {
  const headers = [
    'SKU',
    'Barcode',
    'Name (EN)',
    'Name (AR)',
    'Quantity',
    'Unit',
    'Reorder',
    'Cost',
    'Status',
    'Expiry',
    'Storage',
    'CategoryId',
    'Archived',
  ];
  const rows = items.map((item) => [
    item.sku,
    item.barcode ?? '',
    item.name.en ?? '',
    item.name.ar ?? '',
    String(item.quantityOnHand),
    item.unit,
    String(item.reorderThreshold),
    item.costPerUnit != null ? String(item.costPerUnit) : '',
    stockStatusLabel(item),
    item.expiryDate ?? '',
    item.storageLocation ?? '',
    item.categoryId ?? '',
    item.archivedAt ?? '',
  ]);
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

export const INVENTORY_EXPORT_MAX_ITEMS = 5000;
export const INVENTORY_BULK_ARCHIVE_MAX_ITEMS = 100;
