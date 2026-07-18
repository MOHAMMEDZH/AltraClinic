import { SearchRankerService } from '../application/services/search-ranker.service';
import { SEARCH_ENTITY_TYPES, SearchHit } from '../domain/search.types';

describe('SearchRankerService', () => {
  const ranker = new SearchRankerService();

  function hit(overrides: Partial<SearchHit>): SearchHit {
    return {
      type: SEARCH_ENTITY_TYPES.PATIENT,
      id: '1',
      tenantId: 't1',
      branchId: null,
      title: 'Ahmed Hassan',
      subtitle: null,
      url: '/patients/1',
      matchKind: 'contains',
      matchedField: 'name',
      createdAt: new Date('2026-06-01'),
      ...overrides,
    };
  }

  it('ranks exact matches above contains matches', () => {
    const ranked = ranker.rank(
      [
        hit({ id: 'a', title: 'Ahmed Ali', matchKind: 'contains' }),
        hit({ id: 'b', title: 'Ahmed', matchKind: 'exact' }),
      ],
      'Ahmed',
    );
    expect(ranked[0].id).toBe('b');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('boosts newer records within recency window', () => {
    const ranked = ranker.rank(
      [
        hit({ id: 'old', createdAt: new Date('2025-01-01'), matchKind: 'contains' }),
        hit({ id: 'new', createdAt: new Date(), matchKind: 'contains' }),
      ],
      'Ahmed',
    );
    expect(ranked[0].id).toBe('new');
  });

  it('paginates ranked results', () => {
    const ranked = ranker.rank(
      [hit({ id: '1' }), hit({ id: '2' }), hit({ id: '3' })],
      'Ahmed',
    );
    const page = ranker.paginate(ranked, 2, 1);
    expect(page).toHaveLength(1);
    expect(page[0].id).toBe('2');
  });
});
