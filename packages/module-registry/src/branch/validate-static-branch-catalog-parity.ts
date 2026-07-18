import { CANONICAL_BRANCH_SURFACE_COUNT, CANONICAL_BRANCH_SURFACES } from './canonical-branch-surfaces';
import type { CanonicalBranchSurface } from './branch-types';

export interface StaticBranchCatalogEntryLike {
  extensionId: string;
  surfaceId: string;
  moduleId: string;
  localId: string;
  surface: string;
  categoryId: string;
  configurationCategory: string;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  inheritanceMode: string;
  adminResourceId: string;
  adminAction: string;
  settingsPath: string;
  deepLinkTemplate: string;
  requiredFeature?: string;
  labelKey?: string;
  descriptionKey?: string;
  providerKey: string;
  sortOrder?: number;
  schemaVersion: number;
}

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_BRANCH_SURFACES.map((surface) => [`${surface.moduleId}/branch/${surface.localId}`, surface]),
);

function compareOptionalField(
  errors: string[],
  surfaceId: string,
  field: string,
  actual: unknown,
  expected: unknown,
): void {
  if ((actual ?? null) !== (expected ?? null)) {
    errors.push(
      `Static catalog "${surfaceId}" ${field} mismatch: static=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
    );
  }
}

function compareCanonicalToStaticEntry(
  errors: string[],
  canonical: CanonicalBranchSurface,
  entry: StaticBranchCatalogEntryLike,
): void {
  compareOptionalField(errors, entry.surfaceId, 'moduleId', entry.moduleId, canonical.moduleId);
  compareOptionalField(errors, entry.surfaceId, 'localId', entry.localId, canonical.localId);
  compareOptionalField(errors, entry.surfaceId, 'surfaceId', entry.surfaceId, canonical.surfaceId);
  compareOptionalField(errors, entry.surfaceId, 'surface', entry.surface, canonical.surface);
  compareOptionalField(errors, entry.surfaceId, 'categoryId', entry.categoryId, canonical.categoryId);
  compareOptionalField(
    errors,
    entry.surfaceId,
    'configurationCategory',
    entry.configurationCategory,
    canonical.configurationCategory,
  );
  compareOptionalField(errors, entry.surfaceId, 'branchScoped', entry.branchScoped, canonical.branchScoped);
  compareOptionalField(
    errors,
    entry.surfaceId,
    'crossBranchAllowed',
    entry.crossBranchAllowed,
    canonical.crossBranchAllowed,
  );
  compareOptionalField(errors, entry.surfaceId, 'inheritanceMode', entry.inheritanceMode, canonical.inheritanceMode);
  compareOptionalField(errors, entry.surfaceId, 'adminResourceId', entry.adminResourceId, canonical.adminResourceId);
  compareOptionalField(errors, entry.surfaceId, 'adminAction', entry.adminAction, canonical.adminAction);
  compareOptionalField(errors, entry.surfaceId, 'settingsPath', entry.settingsPath, canonical.settingsPath);
  compareOptionalField(errors, entry.surfaceId, 'deepLinkTemplate', entry.deepLinkTemplate, canonical.deepLinkTemplate);
  compareOptionalField(
    errors,
    entry.surfaceId,
    'requiredFeature',
    entry.requiredFeature,
    canonical.requiredFeature,
  );
  compareOptionalField(errors, entry.surfaceId, 'providerKey', entry.providerKey, canonical.providerKey);
  compareOptionalField(errors, entry.surfaceId, 'labelKey', entry.labelKey, canonical.labelKey);
  compareOptionalField(errors, entry.surfaceId, 'descriptionKey', entry.descriptionKey, canonical.descriptionKey);
  compareOptionalField(errors, entry.surfaceId, 'sortOrder', entry.sortOrder, canonical.sortOrder);
  compareOptionalField(errors, entry.surfaceId, 'schemaVersion', entry.schemaVersion, canonical.schemaVersion);
}

/** Fail-closed field-by-field parity between STATIC_BRANCH_CATALOG and canonical vocabulary. */
export function validateStaticBranchCatalogParity(entries: StaticBranchCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();
  const seenSurfaceIds = new Set<string>();
  const seenLocalIds = new Set<string>();
  const seenDeepLinks = new Set<string>();
  const seenSettingsPaths = new Set<string>();

  if (entries.length !== CANONICAL_BRANCH_SURFACE_COUNT) {
    errors.push(
      `Static branch catalog count mismatch: entries=${entries.length} expected=${CANONICAL_BRANCH_SURFACE_COUNT}`,
    );
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static catalog extensionId "${entry.extensionId}"`);
    } else {
      seenExtensionIds.add(entry.extensionId);
    }

    if (seenSurfaceIds.has(entry.surfaceId)) {
      errors.push(`Duplicate static catalog branchSurfaceId "${entry.surfaceId}"`);
    } else {
      seenSurfaceIds.add(entry.surfaceId);
    }

    const localKey = `${entry.moduleId}/${entry.localId}`;
    if (seenLocalIds.has(localKey)) {
      errors.push(`Duplicate static catalog localId "${entry.localId}" on module "${entry.moduleId}"`);
    } else {
      seenLocalIds.add(localKey);
    }

    if (seenDeepLinks.has(entry.deepLinkTemplate)) {
      errors.push(`Duplicate static catalog deepLinkTemplate "${entry.deepLinkTemplate}"`);
    } else {
      seenDeepLinks.add(entry.deepLinkTemplate);
    }

    if (seenSettingsPaths.has(entry.settingsPath)) {
      errors.push(`Duplicate static catalog settingsPath "${entry.settingsPath}"`);
    } else {
      seenSettingsPaths.add(entry.settingsPath);
    }

    if (!entry.extensionId.startsWith(`${entry.moduleId}/branch/`)) {
      errors.push(`Static catalog extensionId "${entry.extensionId}" has invalid module prefix`);
    }

    if (entry.schemaVersion !== 1) {
      errors.push(`Static catalog entry "${entry.surfaceId}" must have schemaVersion 1`);
    }

    if (typeof entry.branchScoped !== 'boolean' || typeof entry.crossBranchAllowed !== 'boolean') {
      errors.push(`Static catalog entry "${entry.surfaceId}" missing branch scope metadata`);
    }

    const canonical = CANONICAL_BY_EXTENSION_ID.get(entry.extensionId);
    if (!canonical) {
      errors.push(`Orphan static catalog entry "${entry.extensionId}" (no canonical entry)`);
      continue;
    }

    compareCanonicalToStaticEntry(errors, canonical, entry);
  }

  for (const canonical of CANONICAL_BRANCH_SURFACES) {
    const extensionId = `${canonical.moduleId}/branch/${canonical.localId}`;
    if (!seenExtensionIds.has(extensionId)) {
      errors.push(`Missing static catalog entry for canonical surface "${canonical.surfaceId}"`);
    }
  }

  return errors;
}

export { compareCanonicalToStaticEntry };
