import type { ModuleManifest, WhiteLabelContribution } from '../types';
import { validateBuiltinWhiteLabelIntegrity, collectManifestWhiteLabelContributions } from './validate-white-label-integrity';
import { validateCanonicalWhiteLabelVocabulary } from './validate-canonical-white-label-vocabulary';
import {
  validateStaticWhiteLabelCatalogParity,
  type StaticWhiteLabelCatalogEntryLike,
} from './validate-static-white-label-catalog-parity';

function compareManifestToStaticCatalog(
  contributions: WhiteLabelContribution[],
  entries: readonly StaticWhiteLabelCatalogEntryLike[],
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

    if (contribution.surfaceId !== staticEntry.surfaceId) {
      errors.push(
        `Manifest/static surfaceId mismatch for "${contribution.extensionId}": manifest=${contribution.surfaceId} static=${staticEntry.surfaceId}`,
      );
    }

    if (contribution.surface !== staticEntry.surface) {
      errors.push(
        `Manifest/static surface mismatch for "${contribution.surfaceId}": manifest=${contribution.surface} static=${staticEntry.surface}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(
        `Manifest/static deepLinkTemplate mismatch for "${contribution.surfaceId}": manifest=${contribution.deepLinkTemplate} static=${staticEntry.deepLinkTemplate}`,
      );
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(
        `Manifest/static providerKey mismatch for "${contribution.surfaceId}": manifest=${String(contribution.providerKey)} static=${staticEntry.providerKey}`,
      );
    }

    if (contribution.requiredFeature !== staticEntry.requiredFeature) {
      errors.push(
        `Manifest/static requiredFeature mismatch for "${contribution.surfaceId}": manifest=${contribution.requiredFeature} static=${staticEntry.requiredFeature}`,
      );
    }
  }

  return errors;
}

/**
 * End-to-end white label layer parity:
 * canonical vocabulary → manifest contributions → static catalog.
 */
export function validateWhiteLabelLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: readonly StaticWhiteLabelCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalWhiteLabelVocabulary());
  errors.push(...validateBuiltinWhiteLabelIntegrity(manifests));
  errors.push(...validateStaticWhiteLabelCatalogParity(staticCatalogEntries));

  const contributions = collectManifestWhiteLabelContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
