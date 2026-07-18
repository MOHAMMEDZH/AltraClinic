import { BadRequestException } from '@nestjs/common';
import type { ListInventoryItemsQuery } from '../queries/list-inventory-items.query';

export const INVENTORY_LIST_MAX_LIMIT = 100;
export const INVENTORY_LIST_MAX_OFFSET = 100_000;
export const INVENTORY_SEARCH_MIN_LENGTH = 2;
export const INVENTORY_SEARCH_MAX_LENGTH = 100;

export interface NormalizedInventoryListQuery extends ListInventoryItemsQuery {
  limit: number;
  offset: number;
  q?: string;
}

export function normalizeInventorySearchQuery(q?: string): string | undefined {
  const trimmed = q?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length < INVENTORY_SEARCH_MIN_LENGTH) return undefined;
  return trimmed.slice(0, INVENTORY_SEARCH_MAX_LENGTH);
}

export function normalizeInventoryListQuery(
  query: ListInventoryItemsQuery = {},
): NormalizedInventoryListQuery {
  const limit = Math.min(Math.max(query.limit ?? 20, 1), INVENTORY_LIST_MAX_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);

  if (offset > INVENTORY_LIST_MAX_OFFSET) {
    throw new BadRequestException(`Catalog offset cannot exceed ${INVENTORY_LIST_MAX_OFFSET.toLocaleString()}`);
  }

  return {
    ...query,
    limit,
    offset,
    q: normalizeInventorySearchQuery(query.q),
  };
}
