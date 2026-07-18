import type { JourneyContribution, ModuleManifest } from '../types';
import {
  collectManifestJourneyContributions,
  validateBuiltinJourneyIntegrity,
} from './validate-journey-integrity';
import { validateCanonicalJourneyVocabulary } from './validate-canonical-journey-vocabulary';
import {
  validateStaticJourneyCatalogParity,
  type StaticJourneyCatalogEntryLike,
} from './validate-static-journey-catalog-parity';

function compareManifestToStaticCatalog(
  contributions: JourneyContribution[],
  entries: StaticJourneyCatalogEntryLike[],
): string[] {
  const errors: string[] = [];
  const staticByExtensionId = new Map(entries.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== entries.length) {
    errors.push(
      `Manifest/static journey catalog count mismatch: manifest=${contributions.length} static=${entries.length}`,
    );
  }

  for (const contribution of contributions) {
    const staticEntry = staticByExtensionId.get(contribution.extensionId);
    if (!staticEntry) {
      errors.push(`Manifest journey contribution "${contribution.extensionId}" missing from static catalog`);
      continue;
    }

    if (contribution.journeyKind !== staticEntry.journeyKind) {
      errors.push(
        `Manifest/static journeyKind mismatch for "${contribution.extensionId}": manifest=${contribution.journeyKind} static=${staticEntry.journeyKind}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(`Manifest/static deepLinkTemplate mismatch for "${contribution.extensionId}"`);
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(`Manifest/static providerKey mismatch for "${contribution.extensionId}"`);
    }
  }

  return errors;
}

/**
 * End-to-end journey layer parity:
 * Canonical Vocabulary → Manifest Contributions → STATIC_JOURNEY_CATALOG.
 * Phase 40a: metadata only, zero runtime authority.
 */
export function validateJourneyLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: StaticJourneyCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalJourneyVocabulary());
  errors.push(...validateBuiltinJourneyIntegrity(manifests));
  errors.push(...validateStaticJourneyCatalogParity(staticCatalogEntries));

  const contributions = collectManifestJourneyContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
