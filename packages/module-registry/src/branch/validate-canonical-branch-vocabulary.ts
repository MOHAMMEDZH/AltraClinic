import {
  CANONICAL_BRANCH_CATEGORIES,
  CANONICAL_BRANCH_CATEGORY_ID_SET,
  CANONICAL_BRANCH_CONFIGURATION_CATEGORY_ID_SET,
} from './canonical-branch-categories';
import {
  CANONICAL_BRANCH_SETTINGS_ROUTE_PATHS,
  CANONICAL_BRANCH_SURFACE_ID_SET,
  CANONICAL_BRANCH_SURFACES,
} from './canonical-branch-surfaces';
import { CANONICAL_BRANCH_FEATURE_IDS, type BranchInheritanceMode } from './branch-types';
import { validateBranchCapabilityContract } from './branch-capability-contract';
import { validateBranchSurfaceOwnershipContract } from './validate-branch-surface-ownership';

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_BRANCH_FEATURE_IDS);
const VALID_INHERITANCE_MODES = new Set<BranchInheritanceMode>(['tenant-default', 'branch-override', 'branch-only']);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const VALID_ADMIN_ACTIONS = new Set(['view', 'update', 'manage']);
const SETTINGS_ROUTE_PATHS = new Set<string>(CANONICAL_BRANCH_SETTINGS_ROUTE_PATHS);
const BUILTIN_BRANCH_PROVIDER_KEY = 'branch.builtin';

function stripHash(path: string): string {
  return path.split('#')[0] ?? path;
}

export function validateCanonicalBranchVocabulary(): string[] {
  const errors: string[] = [
    ...validateBranchCapabilityContract(),
    ...validateBranchSurfaceOwnershipContract(),
  ];

  const seenCategoryIds = new Set<string>();
  for (const category of CANONICAL_BRANCH_CATEGORIES) {
    if (seenCategoryIds.has(category.categoryId)) {
      errors.push(`Duplicate branch categoryId "${category.categoryId}"`);
    } else {
      seenCategoryIds.add(category.categoryId);
    }

    if (category.categoryId !== category.configurationCategory) {
      errors.push(
        `Branch category "${category.categoryId}" configurationCategory mismatch: ${category.configurationCategory}`,
      );
    }
  }

  if (CANONICAL_BRANCH_CATEGORY_ID_SET.size !== CANONICAL_BRANCH_CATEGORIES.length) {
    errors.push('Canonical branch category IDs contain duplicates');
  }

  if (CANONICAL_BRANCH_CONFIGURATION_CATEGORY_ID_SET.size !== CANONICAL_BRANCH_CATEGORIES.length) {
    errors.push('Canonical branch configuration category IDs contain duplicates');
  }

  const seenSurfaceIds = new Set<string>();
  const seenExtensionIds = new Set<string>();
  const seenLocalIdsGlobal = new Set<string>();
  const seenDeepLinks = new Set<string>();
  const seenSettingsPaths = new Set<string>();
  const seenProviderKeys = new Set<string>();

  for (const surface of CANONICAL_BRANCH_SURFACES) {
    const extensionId = `${surface.moduleId}/branch/${surface.localId}`;

    if (seenSurfaceIds.has(surface.surfaceId)) {
      errors.push(`Duplicate branchSurfaceId "${surface.surfaceId}"`);
    } else {
      seenSurfaceIds.add(surface.surfaceId);
    }

    if (seenExtensionIds.has(extensionId)) {
      errors.push(`Duplicate branch extensionId "${extensionId}"`);
    } else {
      seenExtensionIds.add(extensionId);
    }

    const localKey = `${surface.moduleId}/${surface.localId}`;
    if (seenLocalIdsGlobal.has(localKey)) {
      errors.push(`Duplicate branch localId "${surface.localId}" on module "${surface.moduleId}"`);
    } else {
      seenLocalIdsGlobal.add(localKey);
    }

    if (!surface.moduleId) {
      errors.push(`Surface "${surface.surfaceId}" missing owning moduleId`);
    }

    if (!CANONICAL_BRANCH_CATEGORY_ID_SET.has(surface.categoryId)) {
      errors.push(`Surface "${surface.surfaceId}" references invalid categoryId "${surface.categoryId}"`);
    }

    if (!CANONICAL_BRANCH_CONFIGURATION_CATEGORY_ID_SET.has(surface.configurationCategory)) {
      errors.push(
        `Surface "${surface.surfaceId}" references invalid configurationCategory "${surface.configurationCategory}"`,
      );
    }

    if (surface.categoryId !== surface.configurationCategory) {
      errors.push(
        `Surface "${surface.surfaceId}" categoryId/configurationCategory mismatch: ${surface.categoryId} vs ${surface.configurationCategory}`,
      );
    }

    if (!VALID_INHERITANCE_MODES.has(surface.inheritanceMode)) {
      errors.push(`Surface "${surface.surfaceId}" has invalid inheritanceMode "${surface.inheritanceMode}"`);
    }

    if (typeof surface.branchScoped !== 'boolean') {
      errors.push(`Surface "${surface.surfaceId}" missing inheritance scope branchScoped`);
    }

    if (typeof surface.crossBranchAllowed !== 'boolean') {
      errors.push(`Surface "${surface.surfaceId}" missing crossBranchSupport (crossBranchAllowed)`);
    }

    if (surface.crossBranchAllowed && surface.branchScoped && surface.inheritanceMode === 'branch-only') {
      errors.push(
        `Surface "${surface.surfaceId}" cannot be branch-only with crossBranchAllowed and branchScoped both true`,
      );
    }

    if (surface.requiredFeature && !VALID_FEATURE_IDS.has(surface.requiredFeature)) {
      errors.push(`Surface "${surface.surfaceId}" has invalid featureId/requiredFeature "${surface.requiredFeature}"`);
    }

    if (!surface.providerKey || !PROVIDER_KEY_PATTERN.test(surface.providerKey)) {
      errors.push(`Surface "${surface.surfaceId}" has invalid providerKey "${surface.providerKey}"`);
    } else {
      seenProviderKeys.add(surface.providerKey);
      if (surface.providerKey !== BUILTIN_BRANCH_PROVIDER_KEY) {
        errors.push(
          `Surface "${surface.surfaceId}" must use builtin provider ownership "${BUILTIN_BRANCH_PROVIDER_KEY}"`,
        );
      }
    }

    if (!VALID_ADMIN_ACTIONS.has(surface.adminAction)) {
      errors.push(`Surface "${surface.surfaceId}" has invalid adminAction "${surface.adminAction}"`);
    }

    if (!surface.adminResourceId.startsWith('api.')) {
      errors.push(`Surface "${surface.surfaceId}" adminResourceId must start with "api."`);
    }

    const routeBase = stripHash(surface.settingsPath);
    if (!SETTINGS_ROUTE_PATHS.has(routeBase)) {
      errors.push(`Surface "${surface.surfaceId}" settingsPath "${surface.settingsPath}" not in known route list`);
    }

    if (seenSettingsPaths.has(surface.settingsPath)) {
      errors.push(`Duplicate branch settingsPath "${surface.settingsPath}" on surface "${surface.surfaceId}"`);
    } else {
      seenSettingsPaths.add(surface.settingsPath);
    }

    if (!surface.deepLinkTemplate.startsWith('/')) {
      errors.push(`Surface "${surface.surfaceId}" deepLinkTemplate must start with "/"`);
    } else if (seenDeepLinks.has(surface.deepLinkTemplate)) {
      errors.push(`Duplicate deepLinkTemplate "${surface.deepLinkTemplate}"`);
    } else {
      seenDeepLinks.add(surface.deepLinkTemplate);
    }
  }

  if (seenProviderKeys.size !== 1 || !seenProviderKeys.has(BUILTIN_BRANCH_PROVIDER_KEY)) {
    errors.push(
      `Builtin branch catalog must have exactly one provider ownership key "${BUILTIN_BRANCH_PROVIDER_KEY}"`,
    );
  }

  if (CANONICAL_BRANCH_SURFACE_ID_SET.size !== CANONICAL_BRANCH_SURFACES.length) {
    errors.push('Canonical branch surface IDs contain duplicates');
  }

  return errors;
}
