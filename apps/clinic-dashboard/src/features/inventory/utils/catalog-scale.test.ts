import { describe, expect, it } from 'vitest';
import {
  clampCatalogPage,
  isDeepCatalogPage,
  isLargeCatalog,
  resolveInventoryListQuery,
  shouldShowSearchMinHint,
} from './catalog-scale';

describe('catalog-scale', () => {
  it('defers API search until two characters are entered', () => {
    expect(resolveInventoryListQuery('')).toBeUndefined();
    expect(resolveInventoryListQuery('g')).toBeUndefined();
    expect(resolveInventoryListQuery('gl')).toBe('gl');
  });

  it('shows a hint for single-character search input', () => {
    expect(shouldShowSearchMinHint('g')).toBe(true);
    expect(shouldShowSearchMinHint('gl')).toBe(false);
  });

  it('flags large catalogs and deep pages', () => {
    expect(isLargeCatalog(9_999)).toBe(false);
    expect(isLargeCatalog(10_000)).toBe(true);
    expect(isDeepCatalogPage(49)).toBe(false);
    expect(isDeepCatalogPage(50)).toBe(true);
  });

  it('clamps page jump values', () => {
    expect(clampCatalogPage(0, 20)).toBe(1);
    expect(clampCatalogPage(999, 20)).toBe(20);
    expect(clampCatalogPage(5, 20)).toBe(5);
  });
});
