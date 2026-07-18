import type { LicensedModuleId, BranchContribution } from '../types';
import { moduleBranch } from '../builtin/extension-builders';
import { CANONICAL_BRANCH_SURFACES } from './canonical-branch-surfaces';
import type { CanonicalBranchSurface } from './branch-types';

function surfaceToContribution(surface: CanonicalBranchSurface): BranchContribution {
  return moduleBranch(surface.moduleId, surface.localId, {
    surfaceId: surface.surfaceId,
    surface: surface.surface,
    categoryId: surface.categoryId,
    configurationCategory: surface.configurationCategory,
    branchScoped: surface.branchScoped,
    crossBranchAllowed: surface.crossBranchAllowed,
    inheritanceMode: surface.inheritanceMode,
    adminResourceId: surface.adminResourceId,
    adminAction: surface.adminAction,
    settingsPath: surface.settingsPath,
    deepLinkTemplate: surface.deepLinkTemplate,
    requiredFeature: surface.requiredFeature,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    sortOrder: surface.sortOrder,
    providerKey: surface.providerKey,
    schemaVersion: surface.schemaVersion,
    departmentScoped: surface.departmentScoped,
    resourceId: surface.adminResourceId,
    featureId: surface.requiredFeature,
  });
}

export function buildBranchContributionsForModule(moduleId: LicensedModuleId): BranchContribution[] {
  return CANONICAL_BRANCH_SURFACES.filter((surface) => surface.moduleId === moduleId).map(surfaceToContribution);
}

export function buildAllBranchContributions(): BranchContribution[] {
  return CANONICAL_BRANCH_SURFACES.map(surfaceToContribution);
}

export function listAllBuiltinBranchContributions(): BranchContribution[] {
  return buildAllBranchContributions();
}
