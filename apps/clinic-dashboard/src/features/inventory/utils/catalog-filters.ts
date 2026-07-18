import type { InventoryStatusFilter, InventoryStockFilter } from '../types/inventory.types';

export interface CatalogFilterState {
  search: string;
  listQueryQ?: string;
  stock: InventoryStockFilter;
  categoryId: string;
  status: InventoryStatusFilter;
}

export function hasActiveCatalogFilters(filters: CatalogFilterState): boolean {
  return (
    Boolean(filters.listQueryQ) ||
    filters.stock !== 'all' ||
    Boolean(filters.categoryId) ||
    filters.status !== 'active'
  );
}

export function activeCatalogFilterCount(filters: CatalogFilterState): number {
  let count = 0;
  if (filters.listQueryQ) count += 1;
  if (filters.stock !== 'all') count += 1;
  if (filters.categoryId) count += 1;
  if (filters.status !== 'active') count += 1;
  return count;
}
