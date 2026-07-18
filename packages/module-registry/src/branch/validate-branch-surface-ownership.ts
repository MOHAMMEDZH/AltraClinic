import type { BranchSurfaceOwnershipMetadata } from './branch-types';
import { CANONICAL_BRANCH_SURFACES } from './canonical-branch-surfaces';
import { CANONICAL_BRANCH_CATEGORY_ID_SET } from './canonical-branch-categories';
import { CANONICAL_BRANCH_FEATURE_IDS } from './branch-types';

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_BRANCH_FEATURE_IDS);

/** Derives explicit ownership metadata from canonical surfaces (Phase 36a H2). */
export function deriveBranchSurfaceOwnershipMetadata(): readonly BranchSurfaceOwnershipMetadata[] {
  return CANONICAL_BRANCH_SURFACES.map((surface) => ({
    surfaceId: surface.surfaceId,
    owningModuleId: surface.moduleId,
    featureId: surface.requiredFeature ?? null,
    configurationCategory: surface.configurationCategory,
    inheritanceScope: {
      inheritanceMode: surface.inheritanceMode,
      branchScoped: surface.branchScoped,
    },
    crossBranchSupport: surface.crossBranchAllowed,
  }));
}

/** Fail-closed validation that every canonical branch surface declares complete ownership metadata. */
export function validateBranchSurfaceOwnershipContract(): string[] {
  const errors: string[] = [];
  const ownership = deriveBranchSurfaceOwnershipMetadata();
  const seenSurfaceIds = new Set<string>();

  if (ownership.length !== CANONICAL_BRANCH_SURFACES.length) {
    errors.push(
      `Branch surface ownership contract count mismatch: ownership=${ownership.length} surfaces=${CANONICAL_BRANCH_SURFACES.length}`,
    );
  }

  for (const entry of ownership) {
    if (seenSurfaceIds.has(entry.surfaceId)) {
      errors.push(`Duplicate ownership contract surfaceId "${entry.surfaceId}"`);
    } else {
      seenSurfaceIds.add(entry.surfaceId);
    }

    if (!entry.owningModuleId) {
      errors.push(`Surface "${entry.surfaceId}" missing owningModuleId`);
    }

    if (entry.featureId !== null && !VALID_FEATURE_IDS.has(entry.featureId)) {
      errors.push(`Surface "${entry.surfaceId}" has invalid featureId "${entry.featureId}"`);
    }

    if (!CANONICAL_BRANCH_CATEGORY_ID_SET.has(entry.configurationCategory)) {
      errors.push(`Surface "${entry.surfaceId}" has invalid configurationCategory "${entry.configurationCategory}"`);
    }

    if (!entry.inheritanceScope.inheritanceMode) {
      errors.push(`Surface "${entry.surfaceId}" missing inheritanceScope.inheritanceMode`);
    }

    if (typeof entry.inheritanceScope.branchScoped !== 'boolean') {
      errors.push(`Surface "${entry.surfaceId}" missing inheritanceScope.branchScoped`);
    }

    if (typeof entry.crossBranchSupport !== 'boolean') {
      errors.push(`Surface "${entry.surfaceId}" missing crossBranchSupport`);
    }

    const canonical = CANONICAL_BRANCH_SURFACES.find((surface) => surface.surfaceId === entry.surfaceId);
    if (!canonical) {
      errors.push(`Orphan ownership contract entry "${entry.surfaceId}"`);
      continue;
    }

    if (entry.owningModuleId !== canonical.moduleId) {
      errors.push(
        `Surface "${entry.surfaceId}" owningModuleId mismatch: contract=${entry.owningModuleId} canonical=${canonical.moduleId}`,
      );
    }

    if ((entry.featureId ?? null) !== (canonical.requiredFeature ?? null)) {
      errors.push(
        `Surface "${entry.surfaceId}" featureId mismatch: contract=${String(entry.featureId)} canonical=${String(canonical.requiredFeature ?? null)}`,
      );
    }

    if (entry.configurationCategory !== canonical.configurationCategory) {
      errors.push(
        `Surface "${entry.surfaceId}" configurationCategory mismatch: contract=${entry.configurationCategory} canonical=${canonical.configurationCategory}`,
      );
    }

    if (entry.inheritanceScope.inheritanceMode !== canonical.inheritanceMode) {
      errors.push(`Surface "${entry.surfaceId}" inheritanceMode mismatch in ownership contract`);
    }

    if (entry.inheritanceScope.branchScoped !== canonical.branchScoped) {
      errors.push(`Surface "${entry.surfaceId}" branchScoped mismatch in ownership contract`);
    }

    if (entry.crossBranchSupport !== canonical.crossBranchAllowed) {
      errors.push(`Surface "${entry.surfaceId}" crossBranchSupport mismatch in ownership contract`);
    }
  }

  for (const surface of CANONICAL_BRANCH_SURFACES) {
    if (!seenSurfaceIds.has(surface.surfaceId)) {
      errors.push(`Missing ownership contract for canonical surface "${surface.surfaceId}"`);
    }
  }

  return errors;
}
