import type { ModuleManifest, BranchContribution } from '../types';
import { validateBuiltinBranchIntegrity, collectManifestBranchContributions } from './validate-branch-integrity';
import { validateCanonicalBranchVocabulary } from './validate-canonical-branch-vocabulary';
import {
  validateStaticBranchCatalogParity,
  type StaticBranchCatalogEntryLike,
} from './validate-static-branch-catalog-parity';
import { CANONICAL_BRANCH_SURFACES } from './canonical-branch-surfaces';

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_BRANCH_SURFACES.map((surface) => [`${surface.moduleId}/branch/${surface.localId}`, surface]),
);

const OWNERSHIP_FIELDS: (keyof BranchContribution)[] = [
  'moduleId',
  'localId',
  'surfaceId',
  'surface',
  'categoryId',
  'configurationCategory',
  'branchScoped',
  'crossBranchAllowed',
  'inheritanceMode',
  'adminResourceId',
  'adminAction',
  'settingsPath',
  'deepLinkTemplate',
  'requiredFeature',
  'providerKey',
  'labelKey',
  'descriptionKey',
  'sortOrder',
  'schemaVersion',
];

function compareCanonicalToManifestContribution(
  errors: string[],
  canonical: (typeof CANONICAL_BRANCH_SURFACES)[number],
  contribution: BranchContribution,
): void {
  for (const field of OWNERSHIP_FIELDS) {
    const actual = contribution[field];
    const expected = canonical[field as keyof typeof canonical];
    if (field === 'requiredFeature') {
      if ((actual ?? undefined) !== (expected ?? undefined)) {
        errors.push(
          `Canonical/manifest "${contribution.surfaceId}" requiredFeature mismatch: manifest=${String(actual)} canonical=${String(expected)}`,
        );
      }
      continue;
    }
    if ((actual ?? null) !== (expected ?? null)) {
      errors.push(
        `Canonical/manifest "${contribution.surfaceId}" ${field} mismatch: manifest=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
      );
    }
  }
}

function compareManifestToStaticCatalog(
  contributions: BranchContribution[],
  entries: StaticBranchCatalogEntryLike[],
): string[] {
  const errors: string[] = [];
  const staticByExtensionId = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(
      `Manifest/static branch catalog count mismatch: manifest=${contributions.length} static=${entries.length}`,
    );
  }

  for (const contribution of contributions) {
    const staticEntry = staticByExtensionId.get(contribution.extensionId);
    if (!staticEntry) {
      errors.push(`Manifest branch contribution "${contribution.extensionId}" missing from static catalog`);
      continue;
    }

    const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
    if (canonical) {
      compareCanonicalToManifestContribution(errors, canonical, contribution);
    }

    for (const field of OWNERSHIP_FIELDS) {
      const manifestValue = contribution[field];
      const staticValue = staticEntry[field as keyof StaticBranchCatalogEntryLike];
      if (field === 'requiredFeature') {
        if ((manifestValue ?? undefined) !== (staticValue ?? undefined)) {
          errors.push(
            `Manifest/static "${contribution.surfaceId}" requiredFeature mismatch: manifest=${String(manifestValue)} static=${String(staticValue)}`,
          );
        }
        continue;
      }
      if ((manifestValue ?? null) !== (staticValue ?? null)) {
        errors.push(
          `Manifest/static "${contribution.surfaceId}" ${field} mismatch: manifest=${String(manifestValue ?? 'null')} static=${String(staticValue ?? 'null')}`,
        );
      }
    }
  }

  for (const canonical of CANONICAL_BRANCH_SURFACES) {
    const extensionId = `${canonical.moduleId}/branch/${canonical.localId}`;
    if (!contributions.some((entry) => entry.extensionId === extensionId)) {
      errors.push(`Missing manifest contribution for canonical surface "${canonical.surfaceId}"`);
    }
    if (!staticByExtensionId.has(extensionId)) {
      errors.push(`Missing static catalog entry for canonical surface "${canonical.surfaceId}"`);
    }
  }

  return errors;
}

/**
 * End-to-end branch layer parity:
 * canonical vocabulary → manifest contributions → static catalog (field-by-field).
 */
export function validateBranchLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: StaticBranchCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalBranchVocabulary());
  errors.push(...validateBuiltinBranchIntegrity(manifests));
  errors.push(...validateStaticBranchCatalogParity(staticCatalogEntries));

  const contributions = collectManifestBranchContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
