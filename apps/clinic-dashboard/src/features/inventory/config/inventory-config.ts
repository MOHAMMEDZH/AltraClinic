import type { InventoryItem, InventoryStockFilter, StockMovementType, InventoryCategory, InventoryBatch } from '../types/inventory.types';

const BATCH_EXPIRY_ALERT_DAYS = 30;

export const INVENTORY_PAGE_SIZES = [20, 50, 100] as const;
export type InventoryPageSize = (typeof INVENTORY_PAGE_SIZES)[number];
export const INVENTORY_DEFAULT_PAGE_SIZE: InventoryPageSize = 50;
export const INVENTORY_SEARCH_MIN_LENGTH = 2;
/** @deprecated use INVENTORY_DEFAULT_PAGE_SIZE */
export const INVENTORY_PAGE_SIZE = INVENTORY_DEFAULT_PAGE_SIZE;
export const INVENTORY_ROW_HEIGHT = 52;
export const INVENTORY_GRID_MAX_HEIGHT = 640;
export const INVENTORY_GRID_COLUMNS =
  '96px minmax(140px, 1.2fr) 112px 96px 72px 96px 88px minmax(200px, auto)';
export const INVENTORY_GRID_COLUMNS_READONLY =
  '96px minmax(140px, 1.2fr) 112px 96px 72px 96px 88px';
export const INVENTORY_GRID_SELECT_COLUMN = '44px';

export type InventoryPermCheck = (action: string) => boolean;

export function canViewInventory(perm: InventoryPermCheck): boolean {
  return perm('view');
}

export function canCreateInventory(perm: InventoryPermCheck): boolean {
  return perm('create');
}

export function canUpdateInventory(perm: InventoryPermCheck): boolean {
  return perm('update');
}

export function canArchiveInventory(perm: InventoryPermCheck): boolean {
  return perm('delete');
}

export function canManageInventory(perm: InventoryPermCheck): boolean {
  return perm('manage');
}

export function canApproveInventory(perm: InventoryPermCheck): boolean {
  return perm('approve');
}

export function canRequestInventory(perm: InventoryPermCheck): boolean {
  return perm('update');
}

export function canExportInventory(perm: InventoryPermCheck): boolean {
  return perm('export');
}

export function isCatalogReadOnly(mode: InventoryWorkspaceMode): boolean {
  return mode === 'lookup';
}

export function isCatalogGridReadOnly(mode: InventoryWorkspaceMode): boolean {
  return mode === 'clinical' || mode === 'lookup';
}

export function isInventoryStaffWorkspace(mode: InventoryWorkspaceMode): boolean {
  return mode === 'operations' || mode === 'management';
}

export type InventoryBarcodeAction = 'navigate' | 'receive';

export type InventoryWorkspaceMode = 'operations' | 'management' | 'clinical' | 'lookup';

export function resolveInventoryWorkspaceMode(roles: string[]): InventoryWorkspaceMode {
  if (roles.some((r) => ['owner', 'super_admin'].includes(r))) {
    return 'operations';
  }
  if (roles.some((r) => ['general_manager', 'inventory_manager', 'accountant'].includes(r))) {
    return 'management';
  }
  if (roles.some((r) => ['doctor', 'dentist', 'specialist'].includes(r))) {
    return 'clinical';
  }
  return 'lookup';
}

export function categoryDisplayName(category: InventoryCategory, locale: string): string {
  if (locale.startsWith('ar') && category.nameAr) return category.nameAr;
  return category.nameEn;
}

export function supplierDisplayName(supplier: { nameEn: string; nameAr: string | null }, locale: string): string {
  if (locale.startsWith('ar') && supplier.nameAr) return supplier.nameAr;
  return supplier.nameEn;
}

export function warehouseDisplayName(warehouse: { nameEn: string; nameAr: string | null }, locale: string): string {
  if (locale.startsWith('ar') && warehouse.nameAr) return warehouse.nameAr;
  return warehouse.nameEn;
}

export function itemDisplayName(item: InventoryItem, locale: string): string {
  if (locale.startsWith('ar') && item.name.ar) return item.name.ar;
  return item.name.en;
}

export function stockStatus(item: InventoryItem): 'ok' | 'low' | 'out' | 'expired' | 'expiring' {
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

export function formatInventoryDate(iso: string | null, locale: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

export function formatCurrency(amount: number, locale: string, currency = 'USD'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

export const STOCK_FILTERS: InventoryStockFilter[] = ['all', 'low', 'out', 'expiring', 'expired'];

export function movementTypeLabelKey(type: StockMovementType): string {
  return `inventory.movementTypes.${type.toLowerCase()}`;
}

export function batchExpiryStatus(batch: InventoryBatch): 'ok' | 'expiring' | 'expired' | 'none' {
  if (!batch.expiryDate) return 'none';
  const expiry = new Date(batch.expiryDate);
  const now = new Date();
  if (expiry.getTime() < now.getTime()) return 'expired';
  const soon = new Date(now);
  soon.setDate(soon.getDate() + BATCH_EXPIRY_ALERT_DAYS);
  if (expiry.getTime() <= soon.getTime()) return 'expiring';
  return 'ok';
}
