/**
 * Wave H1 / P1-08 — Arabic catalog search OR builder (unit).
 */
import { buildClinicalCatalogSearchOr } from '../domain/clinical-catalog-search';

describe('Wave H1 clinical catalog search (unit)', () => {
  it('H1-SEARCH-01 — empty/whitespace yields no OR clauses', () => {
    expect(buildClinicalCatalogSearchOr('')).toEqual([]);
    expect(buildClinicalCatalogSearchOr('   ')).toEqual([]);
  });

  it('H1-SEARCH-02 — OR includes stableKey, translations.displayName, active aliases', () => {
    const or = buildClinicalCatalogSearchOr('استشارة');
    expect(or).toHaveLength(3);
    expect(or[0]).toEqual({
      stableKey: { contains: 'استشارة', mode: 'insensitive' },
    });
    expect(or[1]).toEqual({
      translations: {
        some: { displayName: { contains: 'استشارة', mode: 'insensitive' } },
      },
    });
    expect(or[2]).toEqual({
      aliases: {
        some: {
          isActive: true,
          aliasText: { contains: 'استشارة', mode: 'insensitive' },
        },
      },
    });
  });

  it('H1-SEARCH-03 — trims query before matching', () => {
    const or = buildClinicalCatalogSearchOr('  consult  ');
    expect(or[0]).toMatchObject({
      stableKey: { contains: 'consult', mode: 'insensitive' },
    });
  });

  it('H1-SEARCH-04 — inactive aliases are never matched (isActive true required)', () => {
    const aliasClause = buildClinicalCatalogSearchOr('x')[2] as {
      aliases: { some: { isActive: boolean } };
    };
    expect(aliasClause.aliases.some.isActive).toBe(true);
  });
});
