import { GlobalSearchHandler } from '../application/handlers/global-search.handler';
import { SEARCH_ENTITY_TYPES } from '../domain/search.types';

describe('GlobalSearchHandler', () => {
  const tenantContext = {
    resolve: jest.fn().mockResolvedValue({ tenantId: 'tenant-1', branchId: null }),
  };
  const repository = {
    search: jest.fn().mockResolvedValue([
      {
        type: SEARCH_ENTITY_TYPES.PATIENT,
        id: 'p1',
        tenantId: 'tenant-1',
        branchId: null,
        title: 'Ahmed Hassan',
        subtitle: '+963...',
        url: '/patients/p1',
        matchKind: 'prefix',
        matchedField: 'name',
        createdAt: new Date(),
      },
    ]),
  };
  const ranker = {
    rank: jest.fn((hits) => hits.map((h: { score?: number }) => ({ ...h, score: 85 }))),
    paginate: jest.fn((hits) => hits),
  };
  const permissionFilter = {
    filterTypes: jest.fn((types) => types),
  };
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new GlobalSearchHandler(
    tenantContext as any,
    repository as any,
    ranker as any,
    permissionFilter as any,
    cache as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns ranked search results', async () => {
    const result = await handler.execute({
      q: 'Ahmed',
      userRoles: ['receptionist'],
    });

    expect(result.query).toBe('Ahmed');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].score).toBe(85);
    expect(repository.search).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', query: 'Ahmed' }),
    );
  });

  it('rejects queries shorter than 2 characters', async () => {
    await expect(handler.execute({ q: 'a', userRoles: ['owner'] })).rejects.toThrow(
      'at least 2 characters',
    );
  });

  it('returns cached results when available', async () => {
    cache.get.mockResolvedValueOnce({
      query: 'Ahmed',
      page: 1,
      limit: 20,
      total: 1,
      tookMs: 5,
      cached: false,
      results: [
        {
          type: SEARCH_ENTITY_TYPES.PATIENT,
          id: 'p1',
          tenantId: 'tenant-1',
          branchId: null,
          title: 'Cached',
          subtitle: null,
          url: '/patients/p1',
          matchKind: 'exact',
          matchedField: 'name',
          createdAt: new Date(),
          score: 99,
        },
      ],
    });

    const result = await handler.execute({ q: 'Ahmed', userRoles: ['owner'] });
    expect(result.cached).toBe(true);
    expect(result.results[0].title).toBe('Cached');
    expect(repository.search).not.toHaveBeenCalled();
  });
});
