import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateBranchLayerParity, validateStaticBranchCatalogParity } from '@booking/module-registry/branch';
import type { BranchCatalogEntry } from './static-branch-catalog';
import { STATIC_BRANCH_CATALOG } from './static-branch-catalog';
import { resolveBranchCapabilitiesFromSnapshot } from './branch-resolver';
import type { BranchSnapshot } from './branch-types';
import { EMPTY_BRANCH_CAPABILITIES } from './branch-types';

export function assertBranchCatalogValid(entries: readonly BranchCatalogEntry[] = STATIC_BRANCH_CATALOG): string[] {
  return validateStaticBranchCatalogParity([...entries]);
}

export function assertBranchSnapshotValid(snapshot: BranchSnapshot): string[] {
  const errors: string[] = [];
  const seenSurfaceIds = new Set<string>();

  for (const entry of snapshot.entries) {
    if (seenSurfaceIds.has(entry.surfaceId)) {
      errors.push(`Duplicate surfaceId in snapshot: ${entry.surfaceId}`);
    }
    seenSurfaceIds.add(entry.surfaceId);

    if (!entry.configurationCategory) {
      errors.push(`Snapshot surface ${entry.surfaceId} missing configurationCategory`);
    }
    if (!entry.inheritanceMode) {
      errors.push(`Snapshot surface ${entry.surfaceId} missing inheritanceMode`);
    }
    if (typeof entry.branchScoped !== 'boolean' || typeof entry.crossBranchAllowed !== 'boolean') {
      errors.push(`Snapshot surface ${entry.surfaceId} missing scope metadata`);
    }

    const catalogEntry = STATIC_BRANCH_CATALOG.find((item) => item.extensionId === entry.extensionId);
    if (snapshot.source === 'registry' && !catalogEntry) {
      errors.push(`Snapshot entry missing catalog match: ${entry.extensionId}`);
    }
    if (catalogEntry && catalogEntry.moduleId !== entry.moduleId) {
      errors.push(`Snapshot ownership mismatch for ${entry.surfaceId}`);
    }
  }

  const capabilities = resolveBranchCapabilitiesFromSnapshot(snapshot);
  (Object.keys(EMPTY_BRANCH_CAPABILITIES) as (keyof typeof EMPTY_BRANCH_CAPABILITIES)[]).forEach((key) => {
    if (snapshot.capabilities[key] !== capabilities[key]) {
      errors.push(`Snapshot capability mismatch: ${key}`);
    }
  });

  if (snapshot.activeBranchId && !snapshot.accessibleBranchIds.includes(snapshot.activeBranchId)) {
    errors.push('activeBranchId must be in accessibleBranchIds');
  }

  if (snapshot.source === 'restricted') {
    if (snapshot.entries.length > 0) {
      errors.push('Restricted snapshot must not expose branch surfaces');
    }
    if (snapshot.capabilities.canSwitchBranch || snapshot.capabilities.canViewCrossBranch) {
      errors.push('Restricted snapshot must not enable switch/cross-branch capabilities');
    }
  }

  if (snapshot.view.configuration.whiteLabel == null) {
    errors.push('Snapshot configuration must include whiteLabel projection slice');
  }

  return errors;
}

export function assertBranchCatalogLoaded(): void {
  const errors = validateBranchLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_BRANCH_CATALOG]);
  if (errors.length > 0) {
    throw new Error(`Invalid static branch catalog:\n${errors.join('\n')}`);
  }
}
