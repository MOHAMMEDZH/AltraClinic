import type { AnalyticsContribution, ModuleManifest } from '../types';
import { validateBuiltinAnalyticsIntegrity } from './validate-analytics-integrity';
import { validateCanonicalAnalyticsVocabulary } from './validate-canonical-analytics-vocabulary';
import {
  validateStaticAnalyticsCatalogParity,
  type StaticAnalyticsCatalogEntryLike,
} from './validate-static-analytics-catalog-parity';

function collectManifestAnalyticsContributions(manifests: ModuleManifest[]): AnalyticsContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.analytics ?? []);
}

function compareManifestToStaticCatalog(
  contributions: AnalyticsContribution[],
  entries: StaticAnalyticsCatalogEntryLike[],
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

    if (contribution.analyticsId !== staticEntry.analyticsId) {
      errors.push(
        `Manifest/static analyticsId mismatch for "${contribution.extensionId}": manifest=${contribution.analyticsId} static=${staticEntry.analyticsId}`,
      );
    }

    if (contribution.analyticsKind !== staticEntry.analyticsKind) {
      errors.push(
        `Manifest/static analyticsKind mismatch for "${contribution.analyticsId}": manifest=${contribution.analyticsKind} static=${staticEntry.analyticsKind}`,
      );
    }

    if (contribution.deepLinkTemplate !== staticEntry.deepLinkTemplate) {
      errors.push(
        `Manifest/static deepLinkTemplate mismatch for "${contribution.analyticsId}": manifest=${contribution.deepLinkTemplate} static=${staticEntry.deepLinkTemplate}`,
      );
    }

    if ((contribution.permissionAction ?? null) !== staticEntry.permissionAction) {
      errors.push(
        `Manifest/static permissionAction mismatch for "${contribution.analyticsId}": manifest=${String(contribution.permissionAction ?? 'null')} static=${staticEntry.permissionAction}`,
      );
    }

    if ((contribution.providerKey ?? null) !== staticEntry.providerKey) {
      errors.push(
        `Manifest/static providerKey mismatch for "${contribution.analyticsId}": manifest=${String(contribution.providerKey ?? 'null')} static=${staticEntry.providerKey}`,
      );
    }
  }

  return errors;
}

/**
 * End-to-end analytics layer parity:
 * canonical vocabulary → manifest contributions → static catalog.
 */
export function validateAnalyticsLayerParity(
  manifests: ModuleManifest[],
  staticCatalogEntries: StaticAnalyticsCatalogEntryLike[],
): string[] {
  const errors: string[] = [];

  errors.push(...validateCanonicalAnalyticsVocabulary());
  errors.push(...validateBuiltinAnalyticsIntegrity(manifests));
  errors.push(...validateStaticAnalyticsCatalogParity(staticCatalogEntries));

  const contributions = collectManifestAnalyticsContributions(manifests);
  errors.push(...compareManifestToStaticCatalog(contributions, staticCatalogEntries));

  return errors;
}
