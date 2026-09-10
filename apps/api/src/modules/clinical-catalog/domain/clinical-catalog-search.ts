import type { Prisma } from '@prisma/client';

/**
 * Wave H1 / P1-08 — catalog list search OR clauses (AR-02).
 * Matches stableKey, any-locale translation displayName, and ACTIVE aliases only.
 */
export function buildClinicalCatalogSearchOr(
  rawSearch: string,
): Prisma.CanonicalClinicalServiceDefinitionWhereInput[] {
  const search = rawSearch.trim();
  if (!search) return [];

  return [
    { stableKey: { contains: search, mode: 'insensitive' } },
    {
      translations: {
        some: { displayName: { contains: search, mode: 'insensitive' } },
      },
    },
    {
      aliases: {
        some: {
          isActive: true,
          aliasText: { contains: search, mode: 'insensitive' },
        },
      },
    },
  ];
}
