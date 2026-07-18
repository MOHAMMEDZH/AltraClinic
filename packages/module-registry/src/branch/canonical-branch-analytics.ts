import { BRANCH_CONTRIBUTION_SCHEMA_VERSION, type CanonicalBranchSurface } from './branch-types';

const PROVIDER = 'branch.builtin';

export const CANONICAL_BRANCH_ANALYTICS_SURFACES: readonly CanonicalBranchSurface[] = [
  {
    surfaceId: 'analytics-branch-context',
    localId: 'branch-context',
    moduleId: 'analytics',
    surface: 'analytics',
    categoryId: 'branch-analytics',
    configurationCategory: 'branch-analytics',
    branchScoped: true,
    crossBranchAllowed: false,
    inheritanceMode: 'tenant-default',
    adminResourceId: 'api.analytics',
    adminAction: 'view',
    settingsPath: '/analytics#branch-context',
    deepLinkTemplate: '/analytics#branch-context',
    requiredFeature: 'analytics',
    labelKey: 'modules.analytics.branch.context',
    descriptionKey: 'modules.analytics.branch.contextDesc',
    sortOrder: 160,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
  {
    surfaceId: 'analytics-cross-branch',
    localId: 'cross-branch',
    moduleId: 'analytics',
    surface: 'analytics',
    categoryId: 'branch-analytics',
    configurationCategory: 'branch-analytics',
    branchScoped: false,
    crossBranchAllowed: true,
    inheritanceMode: 'tenant-default',
    adminResourceId: 'api.analytics',
    adminAction: 'view',
    settingsPath: '/analytics#cross-branch',
    deepLinkTemplate: '/analytics#cross-branch',
    requiredFeature: 'analytics',
    labelKey: 'modules.analytics.branch.crossBranch',
    descriptionKey: 'modules.analytics.branch.crossBranchDesc',
    sortOrder: 170,
    providerKey: PROVIDER,
    schemaVersion: BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  },
] as const;

export const CANONICAL_BRANCH_ANALYTICS_SURFACE_COUNT = CANONICAL_BRANCH_ANALYTICS_SURFACES.length;
