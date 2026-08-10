import type { ActivityContribution, ModuleManifest } from '../types';
import {
  collectManifestActivityContributions,
  validateBuiltinActivityIntegrity,
} from './validate-activity-integrity';
import { validateCanonicalActivityVocabulary } from './validate-canonical-activity-vocabulary';
import {
  validateStaticActivityCatalogParity,
  type StaticActivityCatalogEntryLike,
} from './validate-static-activity-catalog-parity';

function compareManifestToStaticCatalog(
  contributions: ActivityContribution[],
  entries: readonly StaticActivityCatalogEntryLike[],
): string[] {
  const errors: string[] = [];
  const staticByExtensionId = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(
      `Manifest/static catalog count mismatch: manifest=${contributions.length} static=${entries.length}`,
    );
  }

  for (const contribution of contributions) {
    const staticEntry = staticByExtensionId.get(contribution.extensionId);
    if (!staticEntry) {
      errors.push(`Manifest contribution "${contribution.extensionId}" missing from static catalog`);
      continue;
    }

    if (contribution.activityKind !== staticEntry.activityKind) {
      errors.push(
        `Manifest/static activityKind mismatch for "${contribution.extensionId}": manifest=${contribution.activityKind} static=${staticEntry.activityKind}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(
        `Manifest/static deepLinkTemplate mismatch for "${contribution.extensionId}": manifest=${contribution.deepLinkTemplate} static=${staticEntry.deepLinkTemplate}`,
      );
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(
        `Manifest/static providerKey mismatch for "${contribution.extensionId}": manifest=${String(contribution.providerKey ?? 'null')} static=${staticEntry.providerKey}`,
      );
    }

    if (contribution.activityKind === 'type') {
      if ((contribution.activityTypeId ?? null) !== (staticEntry.activityTypeId ?? null)) {
        errors.push(
          `Manifest/static activityTypeId mismatch for "${contribution.extensionId}"`,
        );
      }
    }
  }

  return errors;
}

/**
 * End-to-end activity layer parity:
 * Canonical Vocabulary → Manifest Contributions → STATIC_ACTIVITY_CATALOG.
 */
export function validateActivityLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: readonly StaticActivityCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalActivityVocabulary());
  errors.push(...validateBuiltinActivityIntegrity(manifests));
  errors.push(...validateStaticActivityCatalogParity(staticCatalogEntries));

  const contributions = collectManifestActivityContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
