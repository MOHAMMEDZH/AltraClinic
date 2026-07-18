import type { SearchSnapshot } from './search-types';

/** Returns a comma-separated types param when all requested types are executable in the snapshot. */
export function resolveEntityTypesParam(
  snapshot: SearchSnapshot | undefined,
  entityTypes: string[],
): string {
  if (!snapshot || entityTypes.length === 0) return '';

  const allowed = new Set(snapshot.entityTypes);
  const filtered = entityTypes.filter((type) => allowed.has(type));
  return filtered.join(',');
}

/** Single-entity convenience for scoped lookups (e.g. AI patient search). */
export function resolveSingleEntityTypeParam(
  snapshot: SearchSnapshot | undefined,
  entityType: string,
): string {
  return resolveEntityTypesParam(snapshot, [entityType]);
}
