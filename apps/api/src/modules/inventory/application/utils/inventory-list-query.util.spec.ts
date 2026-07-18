import { BadRequestException } from '@nestjs/common';
import {
  INVENTORY_LIST_MAX_OFFSET,
  INVENTORY_SEARCH_MIN_LENGTH,
  normalizeInventoryListQuery,
  normalizeInventorySearchQuery,
} from './inventory-list-query.util';

describe('inventory-list-query.util', () => {
  it('requires at least two characters before applying search', () => {
    expect(normalizeInventorySearchQuery('a')).toBeUndefined();
    expect(normalizeInventorySearchQuery('ab')).toBe('ab');
  });

  it('clamps limit and offset', () => {
    const normalized = normalizeInventoryListQuery({ limit: 500, offset: 10, q: ' gloves ' });
    expect(normalized.limit).toBe(100);
    expect(normalized.offset).toBe(10);
    expect(normalized.q).toBe('gloves');
  });

  it('rejects offsets beyond the catalog hard cap', () => {
    expect(() => normalizeInventoryListQuery({ offset: INVENTORY_LIST_MAX_OFFSET + 1 })).toThrow(
      BadRequestException,
    );
  });

  it('documents the minimum search length constant', () => {
    expect(INVENTORY_SEARCH_MIN_LENGTH).toBeGreaterThanOrEqual(2);
  });
});
