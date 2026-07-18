import { describe, expect, it } from 'vitest';
import { activeCatalogFilterCount, hasActiveCatalogFilters } from './catalog-filters';

describe('catalog-filters', () => {
  it('detects default vs active filter sets', () => {
    expect(
      hasActiveCatalogFilters({
        search: '',
        stock: 'all',
        categoryId: '',
        status: 'active',
      }),
    ).toBe(false);

    expect(
      hasActiveCatalogFilters({
        search: 'glove',
        listQueryQ: 'glove',
        stock: 'low',
        categoryId: '',
        status: 'active',
      }),
    ).toBe(true);
  });

  it('counts active filters', () => {
    expect(
      activeCatalogFilterCount({
        search: 'ab',
        listQueryQ: 'ab',
        stock: 'expiring',
        categoryId: 'cat-1',
        status: 'archived',
      }),
    ).toBe(4);
  });
});
