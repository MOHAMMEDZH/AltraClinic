import { BRANCH_CONTRIBUTION_SCHEMA_VERSION, type CanonicalBranchSurface } from './branch-types';

const PROVIDER = 'branch.builtin';

export const CANONICAL_BRANCH_INVENTORY_SURFACES: readonly CanonicalBranchSurface[] = [
  {
    surfaceId: 'inventory-branch-warehouses',
    localId: 'branch-warehouses',
    moduleId: 'inventory',
    surface: 'inventory',
    categoryId: 'branch-inventory',
    configurationCategory: 'branch-inventory',
    branchScoped: true,
    crossBranchAllowed: false,
    inheritanceMode: 'branch-override',
    adminResourceId: 'api.inventory',
    adminAction: 'update',
    settingsPath: '/settings/inventory#branch-warehouses',
    deepLinkTemplate: '/settings/inventory#branch-warehouses',
    labelKey: 'modules.inventory.branch.warehouses',
    descriptionKey: 'modules.inventory.branch.warehousesDesc',
    sortOrder: 120,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'inventory-branch-transfers',
    localId: 'branch-transfers',
    moduleId: 'inventory',
    surface: 'inventory',
    categoryId: 'branch-inventory',
    configurationCategory: 'branch-inventory',
    branchScoped: true,
    crossBranchAllowed: false,
    inheritanceMode: 'branch-override',
    adminResourceId: 'api.inventory',
    adminAction: 'update',
    settingsPath: '/settings/inventory#branch-transfers',
    deepLinkTemplate: '/settings/inventory#branch-transfers',
    labelKey: 'modules.inventory.branch.transfers',
    descriptionKey: 'modules.inventory.branch.transfersDesc',
    sortOrder: 130,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
] as const;

export const CANONICAL_BRANCH_INVENTORY_SURFACE_COUNT = CANONICAL_BRANCH_INVENTORY_SURFACES.length;
