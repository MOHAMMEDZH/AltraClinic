import {
  INVENTORY_DEFAULT_PAGE_SIZE,
  INVENTORY_PAGE_SIZES,
  INVENTORY_SEARCH_MIN_LENGTH,
} from '../config/inventory-config';

export {
  INVENTORY_SEARCH_MIN_LENGTH,
  INVENTORY_PAGE_SIZES,
  INVENTORY_DEFAULT_PAGE_SIZE,
};

export const INVENTORY_LARGE_CATALOG_THRESHOLD = 10_000;
export const INVENTORY_DEEP_PAGE_THRESHOLD = 50;
export const INVENTORY_PAGE_JUMP_THRESHOLD = 10;

/** Only query the API once the user has typed enough to avoid full-table scans. */
export function resolveInventoryListQuery(search: string): string | undefined {
  const trimmed = search.trim();
  if (!trimmed) return undefined;
  if (trimmed.length < INVENTORY_SEARCH_MIN_LENGTH) return undefined;
  return trimmed;
}

export function shouldShowSearchMinHint(search: string): boolean {
  const trimmed = search.trim();
  return trimmed.length > 0 && trimmed.length < INVENTORY_SEARCH_MIN_LENGTH;
}

export function formatCatalogCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function isLargeCatalog(total: number): boolean {
  return total >= INVENTORY_LARGE_CATALOG_THRESHOLD;
}

export function isDeepCatalogPage(page: number): boolean {
  return page >= INVENTORY_DEEP_PAGE_THRESHOLD;
}

export function clampCatalogPage(page: number, totalPages: number): number {
  if (totalPages <= 0) return 1;
  return Math.min(Math.max(1, Math.floor(page)), totalPages);
}
