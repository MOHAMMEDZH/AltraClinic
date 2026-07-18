import type { LicensedModuleId, ModuleManifest, NavigationContribution } from '../types';

/** Maps static sidebar nav ids to registry module ownership. */
export const STATIC_SIDEBAR_NAV_MAP: Record<
  string,
  { moduleId: LicensedModuleId; placement: NavigationContribution['placement'] }
> = {
  dashboard: { moduleId: 'dashboard', placement: 'sidebar' },
  appointments: { moduleId: 'scheduling', placement: 'sidebar' },
  'my-appointments': { moduleId: 'patientPortal', placement: 'sidebar' },
  queue: { moduleId: 'queue', placement: 'sidebar' },
  patients: { moduleId: 'patients', placement: 'sidebar' },
  encounters: { moduleId: 'emr', placement: 'sidebar' },
  dental: { moduleId: 'dental', placement: 'sidebar' },
  beauty: { moduleId: 'beauty', placement: 'sidebar' },
  billing: { moduleId: 'billing', placement: 'sidebar' },
  subscription: { moduleId: 'settings', placement: 'sidebar' },
  inventory: { moduleId: 'inventory', placement: 'sidebar' },
  reports: { moduleId: 'reporting', placement: 'sidebar' },
  analytics: { moduleId: 'analytics', placement: 'sidebar' },
  workflows: { moduleId: 'workflow', placement: 'sidebar' },
  ai: { moduleId: 'ai', placement: 'sidebar' },
  settings: { moduleId: 'settings', placement: 'sidebar' },
};

export interface StaticNavItemLike {
  id: string;
  path: string;
  labelKey: string;
  icon: string;
  resourceId?: string;
  roles?: string[];
}

export interface NavParityMismatch {
  navId: string;
  field: string;
  expected: string;
  actual: string | undefined;
}

export function extractRegistrySidebarNav(manifests: ModuleManifest[]): NavigationContribution[] {
  const items: NavigationContribution[] = [];
  for (const manifest of manifests) {
    for (const nav of manifest.extensions.navigation ?? []) {
      if (nav.placement === 'sidebar') items.push(nav);
    }
  }
  return items.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function verifyStaticNavParity(
  staticItems: StaticNavItemLike[],
  manifests: ModuleManifest[],
): NavParityMismatch[] {
  const mismatches: NavParityMismatch[] = [];
  const registrySidebar = extractRegistrySidebarNav(manifests);

  for (const item of staticItems) {
    const mapping = STATIC_SIDEBAR_NAV_MAP[item.id];
    if (!mapping) {
      mismatches.push({ navId: item.id, field: 'mapping', expected: 'known module map', actual: undefined });
      continue;
    }

    const manifest = manifests.find((m) => m.moduleId === mapping.moduleId);
    if (!manifest) {
      mismatches.push({
        navId: item.id,
        field: 'moduleId',
        expected: mapping.moduleId,
        actual: undefined,
      });
      continue;
    }

    const nav = (manifest.extensions.navigation ?? []).find(
      (entry) => entry.placement === mapping.placement && entry.path === item.path,
    );

    if (!nav) {
      mismatches.push({
        navId: item.id,
        field: 'path',
        expected: item.path,
        actual: undefined,
      });
      continue;
    }

    if (nav.labelKey !== item.labelKey) {
      mismatches.push({ navId: item.id, field: 'labelKey', expected: item.labelKey, actual: nav.labelKey });
    }
    if (nav.icon !== item.icon) {
      mismatches.push({ navId: item.id, field: 'icon', expected: item.icon, actual: nav.icon });
    }
    const expectedResource = item.resourceId ?? undefined;
    const actualResource = nav.resourceId ?? undefined;
    if (expectedResource !== actualResource) {
      mismatches.push({
        navId: item.id,
        field: 'resourceId',
        expected: expectedResource ?? '(none)',
        actual: actualResource ?? '(none)',
      });
    }
  }

  const staticPaths = staticItems.map((item) => item.path);
  const registryPaths = registrySidebar.map((item) => item.path);
  const staticOrder = staticPaths.join('|');
  const registryOrder = registryPaths.join('|');
  if (staticOrder !== registryOrder) {
    mismatches.push({
      navId: 'ordering',
      field: 'sortOrder',
      expected: staticOrder,
      actual: registryOrder,
    });
  }

  return mismatches;
}

export function verifyRegistryRoutingParity(
  staticItems: StaticNavItemLike[],
  manifests: ModuleManifest[],
): NavParityMismatch[] {
  const mismatches: NavParityMismatch[] = [];

  for (const item of staticItems) {
    const mapping = STATIC_SIDEBAR_NAV_MAP[item.id];
    if (!mapping) continue;
    const manifest = manifests.find((m) => m.moduleId === mapping.moduleId);
    if (!manifest) continue;

    const route = (manifest.extensions.routing ?? []).find((entry) => {
      const normalized = entry.path.replace(/\*$/g, '').replace(/\/$/, '') || '/';
      const navNormalized = item.path === '/' ? '/' : item.path.replace(/\/$/, '');
      if (normalized === navNormalized || entry.path.startsWith(`${navNormalized}/`) || entry.path.startsWith(`${navNormalized}*`)) {
        return true;
      }
      return navNormalized.startsWith(`${normalized}/`) && entry.path.endsWith('*');
    });

    if (!route) {
      mismatches.push({
        navId: item.id,
        field: 'routing.path',
        expected: `${item.path}*`,
        actual: undefined,
      });
    }
  }

  return mismatches;
}
