import type { RouteSnapshot } from './route-types';
import type { RouteParityMismatch } from './route-types';
import { listRegisteredComponentKeys } from './route-component-registry';
import type { RouteCatalogEntry } from './route-types';
import { flattenCatalogPaths } from './static-route-catalog';

export function validateRouteCatalog(catalog: RouteCatalogEntry[]): string[] {
  const errors: string[] = [];
  const registered = new Set(listRegisteredComponentKeys());
  const seenIds = new Set<string>();

  function walk(entries: RouteCatalogEntry[], parentPath = '') {
    for (const entry of entries) {
      if (seenIds.has(entry.id)) {
        errors.push(`Duplicate route id: ${entry.id}`);
      }
      seenIds.add(entry.id);

      if (!registered.has(entry.componentKey)) {
        errors.push(`Unknown componentKey "${entry.componentKey}" on route ${entry.id}`);
      }

      if (!entry.index && !entry.path && !entry.children?.length) {
        errors.push(`Route ${entry.id} must define path, index, or children`);
      }

      const childParent = entry.index
        ? parentPath
        : entry.path
          ? parentPath
            ? `${parentPath}/${entry.path}`
            : entry.path
          : parentPath;

      if (entry.children?.length) {
        walk(entry.children, childParent);
      }
    }
  }

  walk(catalog);
  return errors;
}

export function verifyRouteParity(
  expectedCatalog: RouteCatalogEntry[],
  actualSnapshot: RouteSnapshot,
): RouteParityMismatch[] {
  const expectedPaths = flattenCatalogPaths(expectedCatalog).sort();
  const actualPaths = [...actualSnapshot.paths].sort();
  const mismatches: RouteParityMismatch[] = [];

  if (expectedPaths.length !== actualPaths.length) {
    mismatches.push({
      id: 'path-count',
      field: 'length',
      expected: String(expectedPaths.length),
      actual: String(actualPaths.length),
    });
  }

  for (let i = 0; i < Math.max(expectedPaths.length, actualPaths.length); i += 1) {
    const expected = expectedPaths[i];
    const actual = actualPaths[i];
    if (expected !== actual) {
      mismatches.push({
        id: `path-${i}`,
        field: 'path',
        expected: expected ?? '(missing)',
        actual: actual ?? '(missing)',
      });
    }
  }

  return mismatches;
}

export function assertRouteCatalogValid(catalog: RouteCatalogEntry[]): void {
  const errors = validateRouteCatalog(catalog);
  if (errors.length > 0) {
    throw new Error(`Route catalog validation failed:\n${errors.join('\n')}`);
  }
}
