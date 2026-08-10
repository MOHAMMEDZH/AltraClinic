import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import type { RouteContributionView } from './route-types';

interface RoutingPayload {
  path?: string;
  componentKey?: string;
  layoutKey?: string;
  userAccessible?: boolean;
}

/**
 * Extracts routing contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractRoutingContributions(modules: EffectiveModuleView[]): RouteContributionView[] {
  const contributions: RouteContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'routing') continue;
      const payload = extension.payload as RoutingPayload;
      if (!payload.path || !payload.componentKey) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        path: payload.path,
        componentKey: payload.componentKey,
        layoutKey: payload.layoutKey,
        userVisible: extension.userVisible,
        userAccessible:
          typeof payload.userAccessible === 'boolean'
            ? payload.userAccessible
            : module.userAccessible && extension.userVisible,
      });
    }
  }

  return contributions.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Module IDs the tenant/user may access — derived from EffectiveModuleView only.
 */
export function resolveAccessibleModuleIds(modules: EffectiveModuleView[]): Set<string> {
  const ids = new Set<string>();
  for (const module of modules) {
    if (module.userAccessible) {
      ids.add(module.moduleId);
    }
  }
  return ids;
}

/**
 * Modules visible but locked (showWhenLocked UX) — routes stay registered, pages may show lock UI.
 */
export function resolveVisibleModuleIds(modules: EffectiveModuleView[]): Set<string> {
  const ids = new Set<string>();
  for (const module of modules) {
    if (module.userVisible) {
      ids.add(module.moduleId);
    }
  }
  return ids;
}

export function normalizeRegistryPath(path: string): string {
  return path.replace(/\*+$/, '').replace(/\/$/, '') || '/';
}

/**
 * Returns true when a catalog route path falls under a registry routing contribution prefix.
 */
export function routeMatchesContribution(catalogPath: string, contributionPath: string): boolean {
  const catalog = catalogPath === '/' ? '/' : catalogPath.replace(/\/$/, '');
  const prefix = normalizeRegistryPath(contributionPath);
  if (prefix === '/') return catalog === '/' || catalog.startsWith('/');
  if (catalog === prefix) return true;
  return catalog.startsWith(`${prefix}/`);
}

/**
 * Determines if a catalog route should be included for the current effective views.
 * Uses moduleId linkage + registry routing contribution coverage.
 */
export function isCatalogRouteIncluded(
  moduleId: string,
  catalogPath: string,
  modules: EffectiveModuleView[],
  contributions: RouteContributionView[],
): boolean {
  if (moduleId === 'core') return true;

  const moduleView = modules.find((m) => m.moduleId === moduleId);
  if (!moduleView?.userVisible) return false;

  const moduleContributions = contributions.filter((c) => c.moduleId === moduleId);
  if (moduleContributions.length === 0) {
    return moduleView.userAccessible;
  }

  return moduleContributions.some(
    (contribution) =>
      contribution.userVisible &&
      contribution.userAccessible &&
      routeMatchesContribution(catalogPath, contribution.path),
  );
}
