import { BRANCH_CONTRIBUTION_SCHEMA_VERSION, type CanonicalBranchSurface } from './branch-types';

const PROVIDER = 'branch.builtin';

export const CANONICAL_BRANCH_REPORTING_SURFACES: readonly CanonicalBranchSurface[] = [
  {
    surfaceId: 'reporting-branch-filter',
    localId: 'branch-filter',
    moduleId: 'reporting',
    surface: 'reporting',
    categoryId: 'branch-reporting',
    configurationCategory: 'branch-reporting',
    branchScoped: true,
    crossBranchAllowed: false,
    inheritanceMode: 'tenant-default',
    adminResourceId: 'api.reporting',
    adminAction: 'view',
    settingsPath: '/reports#branch-filter',
    deepLinkTemplate: '/reports#branch-filter',
    requiredFeature: 'reports',
    labelKey: 'modules.reporting.branch.filter',
    descriptionKey: 'modules.reporting.branch.filterDesc',
    sortOrder: 140,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'reporting-cross-branch',
    localId: 'cross-branch',
    moduleId: 'reporting',
    surface: 'reporting',
    categoryId: 'branch-reporting',
    configurationCategory: 'branch-reporting',
    branchScoped: false,
    crossBranchAllowed: true,
    inheritanceMode: 'tenant-default',
    adminResourceId: 'api.reporting',
    adminAction: 'view',
    settingsPath: '/reports#cross-branch',
    deepLinkTemplate: '/reports#cross-branch',
    requiredFeature: 'reports',
    labelKey: 'modules.reporting.branch.crossBranch',
    descriptionKey: 'modules.reporting.branch.crossBranchDesc',
    sortOrder: 150,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
] as const;

export const CANONICAL_BRANCH_REPORTING_SURFACE_COUNT = CANONICAL_BRANCH_REPORTING_SURFACES.length;
