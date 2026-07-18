import { BRANCH_CONTRIBUTION_SCHEMA_VERSION, type CanonicalBranchSurface } from './branch-types';

const PROVIDER = 'branch.builtin';

export const CANONICAL_BRANCH_ADDRESS_SURFACES: readonly CanonicalBranchSurface[] = [
  {
    surfaceId: 'settings-branch-address',
    localId: 'branch-address',
    moduleId: 'settings',
    surface: 'address',
    categoryId: 'branch-address',
    configurationCategory: 'branch-address',
    branchScoped: true,
    crossBranchAllowed: false,
    inheritanceMode: 'branch-override',
    adminResourceId: 'api.settings',
    adminAction: 'update',
    settingsPath: '/settings/branches#address',
    deepLinkTemplate: '/settings/branches#address',
    labelKey: 'modules.settings.branch.address',
    descriptionKey: 'modules.settings.branch.addressDesc',
    sortOrder: 40,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'settings-branch-contact',
    localId: 'branch-contact',
    moduleId: 'settings',
    surface: 'address',
    categoryId: 'branch-address',
    configurationCategory: 'branch-address',
    branchScoped: true,
    crossBranchAllowed: false,
    inheritanceMode: 'branch-override',
    adminResourceId: 'api.settings',
    adminAction: 'update',
    settingsPath: '/settings/branches#contact',
    deepLinkTemplate: '/settings/branches#contact',
    labelKey: 'modules.settings.branch.contact',
    descriptionKey: 'modules.settings.branch.contactDesc',
    sortOrder: 50,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
] as const;

export const CANONICAL_BRANCH_ADDRESS_SURFACE_COUNT = CANONICAL_BRANCH_ADDRESS_SURFACES.length;
