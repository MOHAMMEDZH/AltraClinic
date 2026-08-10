import { getRouteById, getRouteByPath, type SuperAdminRouteDefinition } from './route-registry';

export interface BreadcrumbItem {
  id: string;
  label: string;
  path: string;
}

type Translate = (key: string, fallback?: string) => string;

/**
 * Builds the breadcrumb trail for a pathname by walking `breadcrumbParentId`
 * links up to the root. The trailing (current) entry uses the real pathname
 * so parameterized routes (e.g. `/platform-users/:id`) still link correctly.
 */
export function buildBreadcrumbs(pathname: string, t: Translate): BreadcrumbItem[] {
  const current = getRouteByPath(pathname);
  if (!current) return [];

  const chain: SuperAdminRouteDefinition[] = [];
  const seen = new Set<string>();
  let cursor: SuperAdminRouteDefinition | undefined = current;

  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor);
    cursor = cursor.breadcrumbParentId ? getRouteById(cursor.breadcrumbParentId) : undefined;
  }

  return chain.map((route, index) => ({
    id: route.id,
    label: t(route.navLabelKey ?? route.titleKey),
    path: index === chain.length - 1 ? pathname : route.path,
  }));
}
