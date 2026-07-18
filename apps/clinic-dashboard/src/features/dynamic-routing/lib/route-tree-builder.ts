import { createElement } from 'react';
import type { RouteObject } from 'react-router-dom';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { RouteCatalogEntry, RouteCatalogSource, RouteSnapshot } from './route-types';
import { resolveRouteComponent } from './route-component-registry';
import {
  extractRoutingContributions,
  isCatalogRouteIncluded,
  resolveAccessibleModuleIds,
} from './route-resolver';
import { flattenCatalogPaths, normalizeCatalogPath } from './static-route-catalog';

export interface BuildRouteTreeOptions {
  catalog: RouteCatalogEntry[];
  modules: EffectiveModuleView[];
  source: RouteCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  /** When true, include all catalog routes (static parity / rollback). */
  includeAll?: boolean;
}

function catalogPathForEntry(entry: RouteCatalogEntry, parentPath = ''): string {
  if (entry.index) return parentPath ? normalizeCatalogPath(parentPath) : '/';
  if (!entry.path) return parentPath ? normalizeCatalogPath(parentPath) : '/';
  const joined = parentPath ? `${parentPath}/${entry.path}` : entry.path;
  return normalizeCatalogPath(joined);
}

function filterCatalogEntries(
  entries: RouteCatalogEntry[],
  modules: EffectiveModuleView[],
  contributions: ReturnType<typeof extractRoutingContributions>,
  includeAll: boolean,
  parentPath = '',
): RouteCatalogEntry[] {
  if (includeAll) return entries;

  const result: RouteCatalogEntry[] = [];
  for (const entry of entries) {
    const fullPath = catalogPathForEntry(entry, parentPath);
    const childParent = entry.index
      ? parentPath
      : entry.path
        ? parentPath
          ? `${parentPath}/${entry.path}`
          : entry.path
        : parentPath;

    if (!isCatalogRouteIncluded(entry.moduleId, fullPath, modules, contributions)) {
      continue;
    }

    const children = entry.children
      ? filterCatalogEntries(entry.children, modules, contributions, includeAll, childParent)
      : undefined;

    if (entry.children?.length && (!children || children.length === 0) && !entry.index && !entry.path) {
      continue;
    }

    result.push({
      ...entry,
      children,
    });
  }
  return result;
}

function buildRouteObjects(entries: RouteCatalogEntry[]): RouteObject[] {
  const routes: RouteObject[] = [];

  for (const entry of entries) {
    const Component = resolveRouteComponent(entry.componentKey);
    const element = createElement(Component);
    const children = entry.children?.length ? buildRouteObjects(entry.children) : undefined;

    if (entry.index) {
      routes.push({ index: true, element } as RouteObject);
      continue;
    }

    const route: RouteObject = { element };
    if (entry.path) {
      route.path = entry.path;
    }
    if (children?.length) {
      route.children = children;
    }
    routes.push(route);
  }

  return routes;
}

export function buildRouteSnapshot(options: BuildRouteTreeOptions): RouteSnapshot {
  const contributions = extractRoutingContributions(options.modules);
  const filtered = filterCatalogEntries(
    options.catalog,
    options.modules,
    contributions,
    options.includeAll ?? false,
  );
  const routeObjects = buildRouteObjects(filtered);
  const paths = flattenCatalogPaths(filtered);

  return {
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    paths,
    routeObjects,
  };
}

export function buildStaticRouteSnapshot(catalog: RouteCatalogEntry[]): RouteSnapshot {
  return buildRouteSnapshot({
    catalog,
    modules: [],
    source: 'static-only',
    catalogGeneration: null,
    entitlementVersion: null,
    includeAll: true,
  });
}

export function buildRegistryRouteSnapshot(
  catalog: RouteCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): RouteSnapshot {
  return buildRouteSnapshot({
    catalog,
    modules,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    includeAll: false,
  });
}

export function summarizeRouteSnapshot(snapshot: RouteSnapshot): {
  routeCount: number;
  accessibleModules: number;
} {
  return {
    routeCount: snapshot.paths.length,
    accessibleModules: snapshot.source === 'static-only' ? 0 : 0,
  };
}

export { resolveAccessibleModuleIds };
